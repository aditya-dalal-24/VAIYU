"""Train the satellite detection model (contract section 8).

Ready to run once an imagery catalog exists. Nothing is executed at import, and
no results are produced without training.

    .venv/Scripts/python training/train_satellite.py \
        --catalog data/satellite/catalog.json

The catalog format is documented in ``preprocessing.satellite``.

Two decisions shape this pipeline, both forced by how small cyclone imagery
archives are:

**Splits are by storm, never by image.** Frames of one cyclone minutes apart
are near-duplicates. Splitting on images puts the same storm on both sides and
reports an accuracy that means nothing. If the catalog already carries a
``split`` field it is used as-is; otherwise storms are hashed into splits.

**The backbone is pretrained and mostly frozen.** Fitting a convolutional
network from scratch on a few hundred frames memorises them.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from typing import Dict, List, Sequence

import torch
import torch.nn as nn

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evaluation.satellite_metrics import evaluate_satellite, format_report  # noqa: E402
from models.base import resolve_device  # noqa: E402
from models.satellite.model import (  # noqa: E402
    MODEL_NAME,
    MODEL_VERSION,
    SatelliteDetectionModel,
    trainable_parameter_count,
)
from preprocessing.satellite import (  # noqa: E402
    CLASS_NAMES,
    UNKNOWN_SOURCE,
    SatelliteFrame,
    build_source_vocabulary,
    describe_frames,
    load_catalog,
    torch_dataset,
)
from preprocessing.splits import assert_no_cyclone_overlap, split_by_cyclone  # noqa: E402
from registry.checkpoint import checkpoint_path, save_vision_checkpoint  # noqa: E402
from training.config import DEFAULT_CHECKPOINT_DIR  # noqa: E402
from training.pipeline import set_seed  # noqa: E402

logger = logging.getLogger(__name__)

# One frame in five trains the UNKNOWN source slot. High enough that the slot
# learns a usable sensor-agnostic representation, low enough that known-source
# frames still dominate what the source embedding learns.
DEFAULT_SOURCE_DROPOUT = 0.2

DEFAULT_LABEL_DEFINITION = (
    "cycloneDetected is true when the frame shows a system at or above "
    "tropical-storm strength. In the reference dataset that is a 34-knot "
    "threshold, and every frame contains some system, so this is an intensity "
    "threshold rather than presence detection."
)


def partition(frames: Sequence[SatelliteFrame]) -> Dict[str, List[SatelliteFrame]]:
    """Split frames by storm, honouring a catalog-provided split if present."""
    labelled = [frame for frame in frames if frame.split]

    if len(labelled) == len(frames):
        splits: Dict[str, List[SatelliteFrame]] = {
            "train": [],
            "validation": [],
            "test": [],
        }
        for frame in frames:
            splits.setdefault(str(frame.split), []).append(frame)
        logger.info("using the split recorded in the catalog")
    else:
        assignment = split_by_cyclone({frame.cyclone_id for frame in frames})
        splits = {"train": [], "validation": [], "test": []}
        for frame in frames:
            splits[assignment[frame.cyclone_id]].append(frame)
        logger.info("catalog had no split field; storms hashed into splits")

    # Fail loudly now rather than reporting an inflated score at the end.
    assert_no_cyclone_overlap(
        {name: [frame.cyclone_id for frame in group] for name, group in splits.items()}
    )
    return splits


def build_loader(
    frames, vocabulary, batch_size: int, train: bool, source_dropout: float = 0.0
):
    from torch.utils.data import DataLoader

    if not frames:
        return None
    return DataLoader(
        torch_dataset(frames, vocabulary, train=train, source_dropout=source_dropout),
        batch_size=batch_size,
        shuffle=train,
    )


def main(args) -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )
    set_seed(args.seed)

    frames = load_catalog(args.catalog)
    logger.info("catalog: %s", json.dumps(describe_frames(frames), indent=2))

    splits = partition(frames)
    for name, group in splits.items():
        logger.info(
            "%s: %d frames, %d storms",
            name,
            len(group),
            len({frame.cyclone_id for frame in group}),
        )

    if not splits["train"]:
        raise SystemExit("the split produced an empty training set")

    # Vocabulary comes from the training split only. A source that appears
    # solely in test must map to UNKNOWN, exactly as an unseen sensor would at
    # serve time -- otherwise the test score would flatter the model.
    vocabulary = build_source_vocabulary(splits["train"])
    logger.info("source vocabulary: %s", vocabulary)

    device = resolve_device(args.device)
    logger.info("training on %s", device)

    model = SatelliteDetectionModel(source_count=len(vocabulary))
    model.freeze_backbone(trainable_blocks=args.trainable_blocks)
    model.to(device)
    logger.info("trainable parameters: %d", trainable_parameter_count(model))

    train_loader = build_loader(
        splits["train"], vocabulary, args.batch_size, True, args.source_dropout
    )
    logger.info("source dropout: %.2f", args.source_dropout)
    validation_loader = build_loader(
        splits["validation"], vocabulary, args.batch_size, False
    )
    test_loader = build_loader(splits["test"], vocabulary, args.batch_size, False)

    # Class imbalance is reweighted rather than left for the model to exploit
    # by always answering with the commoner class.
    positives = sum(1 for frame in splits["train"] if frame.is_cyclone)
    negatives = len(splits["train"]) - positives
    pos_weight = torch.tensor(
        [negatives / max(positives, 1)], dtype=torch.float32
    )
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight.to(device))

    optimiser = torch.optim.AdamW(
        [p for p in model.parameters() if p.requires_grad],
        lr=args.learning_rate,
        weight_decay=args.weight_decay,
    )

    best_score = -1.0
    best_state = None
    stale = 0

    for epoch in range(1, args.epochs + 1):
        model.train()
        total = 0.0
        for images, sources, labels in train_loader:
            images, sources, labels = (
                images.to(device),
                sources.to(device),
                labels.to(device),
            )
            optimiser.zero_grad()
            loss = criterion(model(images, sources), labels)
            loss.backward()
            optimiser.step()
            total += float(loss.item()) * len(labels)

        message = f"epoch {epoch:>3}  loss {total / len(splits['train']):.4f}"

        if validation_loader is not None:
            scores = evaluate_satellite(model, validation_loader, splits["validation"])
            # Selecting on F1 rather than accuracy: with an imbalanced set,
            # accuracy rewards a model that simply predicts the common class.
            reference = scores.get("f1", 0.0)
            message += f"  val acc {scores.get('accuracy', 0):.3f}  f1 {reference:.3f}"
        else:
            reference = -total

        logger.info(message)

        if reference > best_score + 1e-6:
            best_score = reference
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
            stale = 0
        else:
            stale += 1
            if stale >= args.patience:
                logger.info("stopping early: no validation gain in %d epochs", args.patience)
                break

    if best_state is not None:
        model.load_state_dict(best_state)

    metrics: Dict[str, object] = {}
    if test_loader is not None:
        metrics = {
            "test": evaluate_satellite(model, test_loader, splits["test"]),
            "validation": (
                evaluate_satellite(model, validation_loader, splits["validation"])
                if validation_loader is not None
                else {}
            ),
        }
        for line in format_report(metrics["test"]):
            logger.info("held-out: %s", line)

        # The same held-out frames with every source withheld. This is what the
        # service delivers when a request's imageType does not name a known
        # sensor, so it is measured rather than assumed to match the score above.
        withheld_loader = build_loader(
            splits["test"], {UNKNOWN_SOURCE: 0}, args.batch_size, False
        )
        metrics["test_source_withheld"] = evaluate_satellite(
            model, withheld_loader, splits["test"]
        )
        withheld = metrics["test_source_withheld"]
        logger.info(
            "held-out with source withheld: accuracy %.3f  f1 %.3f",
            withheld.get("accuracy", 0.0),
            withheld.get("f1", 0.0),
        )
    else:
        logger.warning("test split is empty; no held-out metrics were computed")

    # Device-neutral artifact: train on a GPU box, serve on anything.
    model.to("cpu")

    path = save_vision_checkpoint(
        path=checkpoint_path(args.checkpoint_dir, "satellite"),
        model=model,
        model_name=MODEL_NAME,
        model_version=MODEL_VERSION,
        source_vocabulary=vocabulary,
        class_names=CLASS_NAMES,
        label_definition=args.label_definition,
        metrics={**metrics, "source_dropout": args.source_dropout},
        dataset_version=args.dataset_version,
    )
    logger.info("saved checkpoint to %s", path)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", required=True, help="path to catalog.json")
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--patience", type=int, default=6)
    parser.add_argument(
        "--trainable-blocks",
        type=int,
        default=1,
        help="how many trailing residual blocks to fine-tune",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--source-dropout",
        type=float,
        default=DEFAULT_SOURCE_DROPOUT,
        help=(
            "fraction of training frames whose source is replaced with UNKNOWN, "
            "so the model can still serve images whose sensor it cannot identify"
        ),
    )
    parser.add_argument(
        "--device",
        default="auto",
        help="auto (GPU when present), cpu, or cuda",
    )
    parser.add_argument("--checkpoint-dir", default=DEFAULT_CHECKPOINT_DIR)
    parser.add_argument("--dataset-version")
    parser.add_argument("--label-definition", default=DEFAULT_LABEL_DEFINITION)
    return parser.parse_args()


if __name__ == "__main__":
    main(parse_args())
