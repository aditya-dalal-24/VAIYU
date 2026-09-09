"""Model registry: what exists, what is trained, and what can be served.

The registry is the single place that answers "can this analysis run right
now". It distinguishes states that a boolean would collapse, because the
contract requires the service to report *why* something is unavailable rather
than simply failing (section 2, "no fake scientific output").

States
------
``TRAINED``              a valid checkpoint is loaded and inference can run
``UNTRAINED``            the architecture exists, no checkpoint has been produced
``CHECKPOINT_INVALID``   a checkpoint exists but was rejected on validation
``LOAD_FAILED``          an unexpected error occurred while loading
``UNAVAILABLE``          a dependency is missing, so the model cannot be built

Only ``TRAINED`` permits a prediction. Every other state maps to NOT_AVAILABLE
with a reason, and no state produces a placeholder forecast.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional

from registry.checkpoint import (
    Checkpoint,
    CheckpointError,
    VisionCheckpoint,
    load_checkpoint,
    load_vision_checkpoint,
)

# Checkpoints live beside the service, outside version control: trained weights
# are build artifacts, not source.
DEFAULT_CHECKPOINT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "checkpoints"
)

TRAJECTORY_KEY = "trajectory"
INTENSITY_KEY = "intensity"
SATELLITE_KEY = "satellite"

# The vision model is loaded through a different checkpoint format, so the
# registry needs to know which loader applies to which key.
VISION_KEYS = {SATELLITE_KEY}


class ModelState(str, Enum):
    TRAINED = "TRAINED"
    UNTRAINED = "UNTRAINED"
    CHECKPOINT_INVALID = "CHECKPOINT_INVALID"
    LOAD_FAILED = "LOAD_FAILED"
    UNAVAILABLE = "UNAVAILABLE"


# Messages returned to callers. Deliberately free of filesystem paths and
# exception text, per contract section 13.
STATE_REASONS: Dict[ModelState, str] = {
    ModelState.UNTRAINED: (
        "The model architecture is available but no trained checkpoint has been "
        "produced yet."
    ),
    ModelState.CHECKPOINT_INVALID: (
        "A checkpoint exists but failed validation and was not loaded."
    ),
    ModelState.LOAD_FAILED: "The model could not be loaded on this service instance.",
    ModelState.UNAVAILABLE: "The model is not available on this service instance.",
}


@dataclass
class LoadedModel:
    """A registry entry: its state, and the model itself when serviceable."""

    key: str
    state: ModelState
    model: object = None
    checkpoint: Optional[object] = None  # Checkpoint or VisionCheckpoint
    detail: Optional[str] = None

    @property
    def is_ready(self) -> bool:
        return self.state is ModelState.TRAINED and self.model is not None

    @property
    def reason(self) -> Optional[str]:
        """Caller-facing explanation, or None when the model is serviceable."""
        if self.is_ready:
            return None
        return STATE_REASONS.get(self.state, STATE_REASONS[ModelState.UNAVAILABLE])

    def summary(self) -> Dict[str, object]:
        """Compact description for the health endpoint."""
        payload: Dict[str, object] = {
            "available": self.is_ready,
            "state": self.state.value,
        }
        if self.checkpoint is not None:
            payload["model"] = self.checkpoint.model_name
            payload["version"] = self.checkpoint.model_version
            if getattr(self.checkpoint, "horizons", None):
                payload["horizons"] = self.checkpoint.horizons
            if getattr(self.checkpoint, "source_vocabulary", None):
                # Which sensors this model actually saw, so an operator can
                # tell whether their imagery is in distribution.
                payload["sources"] = [
                    key
                    for key in self.checkpoint.source_vocabulary
                    if key != "UNKNOWN"
                ]
            if self.checkpoint.trained_at:
                payload["trainedAt"] = self.checkpoint.trained_at
        if not self.is_ready:
            payload["reason"] = self.reason
        return payload


class ModelRegistry:
    """Loads checkpoints once and reports what each model can do."""

    def __init__(self, checkpoint_dir: str = DEFAULT_CHECKPOINT_DIR):
        self.checkpoint_dir = checkpoint_dir
        self._entries: Dict[str, LoadedModel] = {}
        self.reload()

    def reload(self) -> None:
        """Re-read every checkpoint from disk.

        Called at startup, and available to tests that write a checkpoint and
        need the registry to notice it.
        """
        self._entries = {
            TRAJECTORY_KEY: self._load(TRAJECTORY_KEY),
            INTENSITY_KEY: self._load(INTENSITY_KEY),
            SATELLITE_KEY: self._load(SATELLITE_KEY),
        }

    def _load(self, key: str) -> LoadedModel:
        path = os.path.join(self.checkpoint_dir, f"{key}.pt")

        if not os.path.exists(path):
            # The expected state before any training has been run. Not an error.
            return LoadedModel(key=key, state=ModelState.UNTRAINED)

        try:
            checkpoint = (
                load_vision_checkpoint(path)
                if key in VISION_KEYS
                else load_checkpoint(path)
            )
        except CheckpointError as error:
            return LoadedModel(
                key=key, state=ModelState.CHECKPOINT_INVALID, detail=str(error)
            )
        except Exception as error:  # noqa: BLE001
            return LoadedModel(
                key=key, state=ModelState.LOAD_FAILED, detail=type(error).__name__
            )

        try:
            model = self._build(key, checkpoint)
        except Exception as error:  # noqa: BLE001
            return LoadedModel(
                key=key,
                state=ModelState.LOAD_FAILED,
                checkpoint=checkpoint,
                detail=type(error).__name__,
            )

        return LoadedModel(
            key=key, state=ModelState.TRAINED, model=model, checkpoint=checkpoint
        )

    @staticmethod
    def _build(key: str, checkpoint: Checkpoint):
        """Rebuild the architecture from the checkpoint's config and load weights."""
        if key == TRAJECTORY_KEY:
            from models.trajectory.model import TrajectoryModel

            model = TrajectoryModel.from_config(checkpoint.config)
        elif key == INTENSITY_KEY:
            from models.intensity.model import IntensityModel

            model = IntensityModel.from_config(checkpoint.config)
        elif key == SATELLITE_KEY:
            from models.satellite.model import SatelliteDetectionModel

            model = SatelliteDetectionModel.from_config(checkpoint.config)
        else:
            raise ValueError(f"unknown model key: {key}")

        # strict=True: a partial weight match means the architecture and the
        # checkpoint disagree, which must fail rather than load half a model.
        model.load_state_dict(checkpoint.state_dict, strict=True)
        model.eval()
        return model

    def get(self, key: str) -> LoadedModel:
        return self._entries.get(key, LoadedModel(key=key, state=ModelState.UNAVAILABLE))

    @property
    def trajectory(self) -> LoadedModel:
        return self.get(TRAJECTORY_KEY)

    @property
    def intensity(self) -> LoadedModel:
        return self.get(INTENSITY_KEY)

    @property
    def satellite(self) -> LoadedModel:
        return self.get(SATELLITE_KEY)

    def summary(self) -> Dict[str, Dict[str, object]]:
        """Per-model availability for the health endpoint."""
        return {key: entry.summary() for key, entry in self._entries.items()}


_registry: Optional[ModelRegistry] = None


def get_registry() -> ModelRegistry:
    """Process-wide registry, built on first use."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry


def reset_registry(checkpoint_dir: Optional[str] = None) -> ModelRegistry:
    """Rebuild the registry, optionally against a different directory.

    Used by tests to point the service at a temporary checkpoint directory.
    """
    global _registry
    _registry = ModelRegistry(checkpoint_dir or DEFAULT_CHECKPOINT_DIR)
    return _registry
