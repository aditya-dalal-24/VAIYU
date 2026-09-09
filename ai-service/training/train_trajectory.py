"""Train the trajectory model (contract section 9).

Ready to run once a real dataset exists. Nothing here is executed at import,
and no results are produced without training.

    .venv/Scripts/python training/train_trajectory.py \
        --dataset data/processed/observations.csv

The dataset must expose the columns documented in ``preprocessing.dataset``.
Add ``--config path.json`` to supply a full :class:`TrainingConfig` instead of
individual flags.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys

import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evaluation.trajectory_metrics import evaluate_trajectory  # noqa: E402
from models.base import count_parameters  # noqa: E402
from models.trajectory.model import (  # noqa: E402
    MODEL_NAME,
    MODEL_VERSION,
    TrajectoryModel,
)
from preprocessing.features import (  # noqa: E402
    ENVIRONMENTAL_FEATURE_COUNT,
    STEP_FEATURE_COUNT,
)
from registry.checkpoint import checkpoint_path, save_checkpoint  # noqa: E402
from training.config import TrainingConfig  # noqa: E402
from training.pipeline import (  # noqa: E402
    build_loader,
    masked_regression_loss,
    prepare_data,
    set_seed,
    train_model,
)

logger = logging.getLogger(__name__)


def compute_loss(model: torch.nn.Module, batch) -> torch.Tensor:
    """Masked regression loss over predicted displacement."""
    sequences, mask, environment, targets, target_mask, _, _ = batch
    predictions = model(sequences, mask, environment)
    return masked_regression_loss(predictions, targets, target_mask)


def main(config: TrainingConfig) -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )
    logger.info("configuration:\n%s", config.describe())

    set_seed(config.seed)

    data = prepare_data(config)

    model = TrajectoryModel(
        step_features=STEP_FEATURE_COUNT,
        environment_features=ENVIRONMENTAL_FEATURE_COUNT,
        horizons=config.horizons,
        hidden_size=config.hidden_size,
        num_layers=config.num_layers,
        dropout=config.dropout,
    )
    logger.info("trainable parameters: %d", count_parameters(model))

    train_loader = build_loader(
        data.train, data.scaler, config.batch_size, True, "position"
    )
    validation_loader = build_loader(
        data.validation, data.scaler, config.batch_size, False, "position"
    )

    history = train_model(
        model, train_loader, validation_loader, config, compute_loss
    )

    # Held-out evaluation, computed only from real training. The skill score
    # recorded here is what the service later reports as trajectory confidence;
    # if evaluation cannot run, no confidence is stored and none is served.
    metrics = {}
    if len(data.test) > 0:
        metrics = evaluate_trajectory(model, data.test, data.scaler, config.horizons)
        logger.info("held-out metrics:\n%s", json.dumps(metrics, indent=2))
    else:
        logger.warning("test split is empty; no held-out metrics were computed")

    path = checkpoint_path(config.checkpoint_dir, "trajectory")
    save_checkpoint(
        path=path,
        model=model,
        scaler=data.scaler,
        model_name=MODEL_NAME,
        model_version=MODEL_VERSION,
        horizons=config.horizons,
        metrics={**metrics, "training": history},
        dataset_version=config.dataset_version,
    )
    logger.info("saved checkpoint to %s", path)


def parse_args() -> TrainingConfig:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", help="path to a TrainingConfig JSON file")
    parser.add_argument("--dataset", help="path to the observation table")
    parser.add_argument("--epochs", type=int)
    parser.add_argument("--batch-size", type=int)
    parser.add_argument("--learning-rate", type=float)
    parser.add_argument("--hidden-size", type=int)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--device", help="auto (GPU when present), cpu, or cuda")
    parser.add_argument("--split-strategy", choices=("cyclone", "season"))
    parser.add_argument(
        "--horizons",
        type=int,
        nargs="+",
        help="forecast horizons in hours, e.g. --horizons 6 12 24",
    )
    args = parser.parse_args()

    if args.config:
        config = TrainingConfig.from_json(args.config)
    elif args.dataset:
        config = TrainingConfig(dataset_path=args.dataset)
    else:
        parser.error("either --config or --dataset is required")

    for name, value in (
        ("dataset_path", args.dataset),
        ("epochs", args.epochs),
        ("batch_size", args.batch_size),
        ("learning_rate", args.learning_rate),
        ("hidden_size", args.hidden_size),
        ("seed", args.seed),
        ("device", args.device),
        ("split_strategy", args.split_strategy),
        ("horizons", args.horizons),
    ):
        if value is not None:
            setattr(config, name, value)

    return config


if __name__ == "__main__":
    main(parse_args())
