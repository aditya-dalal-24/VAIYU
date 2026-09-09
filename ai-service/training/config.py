"""Training configuration.

Every knob a training run needs, in one dataclass, so a run is described by a
single object that can be logged and reproduced rather than by scattered
command-line defaults.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from typing import List, Optional

from preprocessing.dataset import DEFAULT_HORIZONS_HOURS
from preprocessing.features import SEQUENCE_LENGTH

DEFAULT_CHECKPOINT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "checkpoints"
)


@dataclass
class TrainingConfig:
    """Configuration for one training run."""

    # Data
    dataset_path: str
    horizons: List[int] = field(default_factory=lambda: list(DEFAULT_HORIZONS_HOURS))
    sequence_length: int = SEQUENCE_LENGTH
    dataset_version: Optional[str] = None

    # Split. "cyclone" hashes storms into splits; "season" holds out the most
    # recent seasons, which is stricter and preferred when the archive spans
    # enough years.
    split_strategy: str = "cyclone"
    train_fraction: float = 0.70
    validation_fraction: float = 0.15
    validation_seasons: int = 2
    test_seasons: int = 2

    # Architecture
    hidden_size: int = 64
    num_layers: int = 1
    dropout: float = 0.1

    # Optimisation
    epochs: int = 60
    batch_size: int = 64
    learning_rate: float = 1e-3
    weight_decay: float = 1e-4
    gradient_clip: float = 1.0

    # Stop when validation stops improving, so the run length adapts to the
    # dataset instead of being guessed in advance.
    early_stopping_patience: int = 10

    # Weight on the trend classification loss relative to the regression loss.
    # Intensity only.
    trend_loss_weight: float = 0.5

    # Reproducibility
    seed: int = 42

    # "auto" uses a GPU when one is present. Training and serving need not
    # happen on the same machine: checkpoints always load onto CPU.
    device: str = "auto"

    checkpoint_dir: str = DEFAULT_CHECKPOINT_DIR

    def to_dict(self) -> dict:
        return asdict(self)

    def describe(self) -> str:
        return json.dumps(self.to_dict(), indent=2, default=str)

    @classmethod
    def from_json(cls, path: str) -> "TrainingConfig":
        """Load a configuration from a JSON file."""
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
        return cls(**payload)
