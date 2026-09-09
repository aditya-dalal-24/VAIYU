"""Shared training machinery: data preparation, the loop, and reproducibility.

Both training scripts use this so the split, the scaling and the early-stopping
behaviour are identical between the two models, and any change applies to both.
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset

from models.base import device_of, resolve_device
from preprocessing.dataset import (
    SupervisedSamples,
    build_samples,
    describe_samples,
    load_observations,
)
from preprocessing.scaler import SequenceScaler
from preprocessing.splits import (
    assert_no_cyclone_overlap,
    split_by_cyclone,
    split_by_season,
    summarise_split,
)
from training.config import TrainingConfig

logger = logging.getLogger(__name__)


def set_seed(seed: int) -> None:
    """Seed every generator the run touches.

    Full bit-for-bit determinism on all backends is not guaranteed, but a run
    is repeatable in practice, which is what reproducing a result requires.
    """
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


@dataclass
class PreparedData:
    """Split, scaled samples ready for training."""

    train: SupervisedSamples
    validation: SupervisedSamples
    test: SupervisedSamples
    scaler: SequenceScaler
    split_counts: Dict[str, int]
    description: Dict[str, object]


def prepare_data(config: TrainingConfig) -> PreparedData:
    """Load the dataset, build samples, split by cyclone, and fit the scaler.

    The scaler is fitted on the training split only. Fitting it on everything
    would leak the validation and test distributions into the model.
    """
    frame = load_observations(config.dataset_path)
    samples = build_samples(
        frame,
        horizons=config.horizons,
        sequence_length=config.sequence_length,
    )

    description = describe_samples(samples)
    logger.info("dataset: %s", description)

    cyclone_ids = samples.cyclone_ids.tolist()

    if config.split_strategy == "season":
        if "season" not in frame.columns:
            raise ValueError(
                "split_strategy='season' requires a 'season' column in the dataset"
            )
        seasons = (
            frame.drop_duplicates("cyclone_id")
            .set_index("cyclone_id")["season"]
            .to_dict()
        )
        pairs = [(str(cid), int(seasons[cid])) for cid in dict.fromkeys(cyclone_ids)]
        assignment = split_by_season(
            pairs,
            validation_seasons=config.validation_seasons,
            test_seasons=config.test_seasons,
        )
    else:
        assignment = split_by_cyclone(
            cyclone_ids,
            train_fraction=config.train_fraction,
            validation_fraction=config.validation_fraction,
        )

    indices: Dict[str, List[int]] = {"train": [], "validation": [], "test": []}
    for position, cyclone_id in enumerate(cyclone_ids):
        indices[assignment[str(cyclone_id)]].append(position)

    # Fail loudly now rather than reporting an inflated score later.
    assert_no_cyclone_overlap(
        {
            split: [cyclone_ids[position] for position in positions]
            for split, positions in indices.items()
        }
    )

    if not indices["train"]:
        raise ValueError("the split produced an empty training set")

    train = samples.subset(indices["train"])
    validation = samples.subset(indices["validation"])
    test = samples.subset(indices["test"])

    scaler = SequenceScaler().fit(train.sequences, train.masks, train.environments)

    split_counts = summarise_split(assignment)
    logger.info("cyclones per split: %s", split_counts)
    logger.info(
        "samples per split: train=%d validation=%d test=%d",
        len(train),
        len(validation),
        len(test),
    )

    return PreparedData(
        train=train,
        validation=validation,
        test=test,
        scaler=scaler,
        split_counts=split_counts,
        description=description,
    )


def build_loader(
    samples: SupervisedSamples,
    scaler: SequenceScaler,
    batch_size: int,
    shuffle: bool,
    target_kind: str,
) -> Optional[DataLoader]:
    """Wrap a split in a DataLoader, or None when the split is empty.

    ``target_kind`` selects which target tensor is included: ``position`` for
    the trajectory model, ``intensity`` for the intensity model.
    """
    if len(samples) == 0:
        return None

    sequences = scaler.transform_sequences(samples.sequences, samples.masks)
    environments = scaler.transform_environment(samples.environments)

    targets = (
        samples.position_targets
        if target_kind == "position"
        else samples.intensity_targets
    )

    dataset = TensorDataset(
        torch.from_numpy(np.ascontiguousarray(sequences)),
        torch.from_numpy(np.ascontiguousarray(samples.masks)),
        torch.from_numpy(np.ascontiguousarray(environments)),
        torch.from_numpy(np.ascontiguousarray(targets)),
        torch.from_numpy(np.ascontiguousarray(samples.target_masks)),
        torch.from_numpy(np.ascontiguousarray(samples.trend_targets)),
        torch.from_numpy(np.ascontiguousarray(samples.trend_mask)),
    )
    return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle)


def masked_regression_loss(
    predictions: torch.Tensor, targets: torch.Tensor, mask: torch.Tensor
) -> torch.Tensor:
    """Smooth L1 over horizons that have a real target.

    Horizons without an observation near T+h are masked out entirely, so the
    model is never trained toward a target that does not exist. Smooth L1 is
    used rather than MSE because track and intensity data contain genuine
    outliers -- rapid intensification, sharp recurvature -- that a squared loss
    would let dominate the gradient.
    """
    per_element = torch.nn.functional.smooth_l1_loss(
        predictions, targets, reduction="none"
    )
    per_horizon = per_element.mean(dim=-1)

    masked = per_horizon * mask
    denominator = mask.sum()
    if denominator.item() == 0:
        return torch.zeros((), device=predictions.device, requires_grad=True)
    return masked.sum() / denominator


def to_device(batch: Tuple, device: torch.device) -> Tuple:
    """Move every tensor in a batch onto the training device."""
    return tuple(
        item.to(device) if isinstance(item, torch.Tensor) else item for item in batch
    )


def train_model(
    model: torch.nn.Module,
    train_loader: DataLoader,
    validation_loader: Optional[DataLoader],
    config: TrainingConfig,
    compute_loss: Callable[[torch.nn.Module, Tuple], torch.Tensor],
) -> Dict[str, object]:
    """Run the training loop with early stopping on validation loss.

    ``compute_loss`` receives the model and one batch and returns a scalar
    loss, which is what differs between the two models.

    The model is moved to ``config.device`` -- "auto" meaning a GPU when one is
    present -- and returned on the CPU, so the checkpoint written afterwards is
    portable to a machine without one.

    Returns a history dictionary. It reports losses only -- scientific
    evaluation belongs to the evaluation module, run explicitly after training.
    """
    device = resolve_device(config.device)
    logger.info("training on %s", device)
    model.to(device)

    optimiser = torch.optim.AdamW(
        model.parameters(),
        lr=config.learning_rate,
        weight_decay=config.weight_decay,
    )

    best_validation = float("inf")
    best_state: Optional[Dict[str, torch.Tensor]] = None
    epochs_without_improvement = 0
    history: List[Dict[str, float]] = []

    for epoch in range(1, config.epochs + 1):
        model.train()
        total = 0.0
        batches = 0

        for batch in train_loader:
            batch = to_device(batch, device)
            optimiser.zero_grad()
            loss = compute_loss(model, batch)
            loss.backward()
            # Recurrent networks can produce large gradients on outlier
            # sequences; clipping keeps one storm from destabilising the run.
            torch.nn.utils.clip_grad_norm_(model.parameters(), config.gradient_clip)
            optimiser.step()

            total += float(loss.item())
            batches += 1

        train_loss = total / max(batches, 1)
        validation_loss = (
            evaluate_loss(model, validation_loader, compute_loss)
            if validation_loader is not None
            else float("nan")
        )

        history.append(
            {"epoch": epoch, "train_loss": train_loss, "validation_loss": validation_loss}
        )
        logger.info(
            "epoch %3d  train %.5f  validation %.5f", epoch, train_loss, validation_loss
        )

        reference = validation_loss if validation_loader is not None else train_loss
        if reference < best_validation - 1e-6:
            best_validation = reference
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= config.early_stopping_patience:
                logger.info(
                    "stopping early: no improvement in %d epochs",
                    config.early_stopping_patience,
                )
                break

    # Serve the best epoch, not the last one.
    if best_state is not None:
        model.load_state_dict(best_state)

    # Back to CPU before the caller evaluates and saves. A checkpoint holding
    # CUDA tensors would still load elsewhere via map_location, but keeping the
    # artifact device-neutral avoids depending on that.
    model.to("cpu")

    return {
        "epochs_run": len(history),
        "best_validation_loss": best_validation,
        "history": history,
    }


@torch.no_grad()
def evaluate_loss(
    model: torch.nn.Module,
    loader: DataLoader,
    compute_loss: Callable[[torch.nn.Module, Tuple], torch.Tensor],
) -> float:
    """Mean loss over a loader, with the model in eval mode."""
    model.eval()
    device = device_of(model)
    total = 0.0
    batches = 0
    for batch in loader:
        total += float(compute_loss(model, to_device(batch, device)).item())
        batches += 1
    return total / max(batches, 1)
