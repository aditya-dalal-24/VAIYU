"""Checkpoint saving, loading and validation.

A checkpoint holds everything needed to reproduce inference exactly: the
weights, the architecture config to rebuild the module, the fitted scaler, the
feature-set version and the horizons the model was trained for. Weights alone
would be useless -- a model served with a different scaler or a different
feature layout produces confident nonsense.

Every checkpoint is validated on load. A file that is corrupt, truncated, or
was trained against a different feature set is rejected rather than partially
applied, because a silently mismatched model is worse than an absent one.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import torch

from preprocessing.features import FEATURE_SET_VERSION
from preprocessing.satellite import IMAGE_SPEC_VERSION
from preprocessing.scaler import SequenceScaler

# Bumped if the checkpoint envelope itself changes shape.
CHECKPOINT_FORMAT_VERSION = 1

REQUIRED_KEYS = [
    "format_version",
    "model_name",
    "model_version",
    "feature_set_version",
    "config",
    "state_dict",
    "scaler",
    "horizons",
]

# The vision model has no sequence scaler and no forecast horizons; it carries
# an image spec version and the source vocabulary it was trained against.
REQUIRED_VISION_KEYS = [
    "format_version",
    "model_name",
    "model_version",
    "image_spec_version",
    "config",
    "state_dict",
    "source_vocabulary",
    "class_names",
]


class CheckpointError(Exception):
    """Raised when a checkpoint cannot be read or is not usable as-is."""


@dataclass
class Checkpoint:
    """A validated checkpoint, ready to rebuild a model from."""

    model_name: str
    model_version: str
    feature_set_version: str
    config: Dict[str, Any]
    state_dict: Dict[str, Any]
    scaler: SequenceScaler
    horizons: list
    trained_at: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    dataset_version: Optional[str] = None


def save_checkpoint(
    path: str,
    model,
    scaler: SequenceScaler,
    model_name: str,
    model_version: str,
    horizons,
    metrics: Optional[Dict[str, Any]] = None,
    dataset_version: Optional[str] = None,
) -> str:
    """Write a checkpoint atomically.

    Written to a temporary file and moved into place, so an interrupted save
    cannot leave a half-written checkpoint that later loads as valid.
    """
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)

    payload = {
        "format_version": CHECKPOINT_FORMAT_VERSION,
        "model_name": model_name,
        "model_version": model_version,
        "feature_set_version": FEATURE_SET_VERSION,
        "config": model.config(),
        "state_dict": model.state_dict(),
        "scaler": scaler.to_dict(),
        "horizons": list(horizons),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics or {},
        "dataset_version": dataset_version,
    }

    temporary = f"{path}.tmp"
    torch.save(payload, temporary)
    os.replace(temporary, path)
    return path


def load_checkpoint(path: str) -> Checkpoint:
    """Read and validate a checkpoint.

    Raises :class:`CheckpointError` for anything that would make the loaded
    model unsafe to serve.
    """
    if not os.path.exists(path):
        raise CheckpointError("checkpoint file does not exist")

    try:
        # weights_only=False: the envelope carries the scaler and config
        # dictionaries alongside tensors. Checkpoints are produced by this
        # service's own training pipeline, not accepted from callers.
        payload = torch.load(path, map_location="cpu", weights_only=False)
    except Exception as error:  # noqa: BLE001 - any read failure is one outcome
        raise CheckpointError(f"checkpoint could not be read: {type(error).__name__}")

    if not isinstance(payload, dict):
        raise CheckpointError("checkpoint is not in the expected format")

    missing = [key for key in REQUIRED_KEYS if key not in payload]
    if missing:
        raise CheckpointError(
            f"checkpoint is missing required fields: {', '.join(missing)}"
        )

    if payload["format_version"] != CHECKPOINT_FORMAT_VERSION:
        raise CheckpointError(
            f"checkpoint format version {payload['format_version']} is not "
            f"supported (expected {CHECKPOINT_FORMAT_VERSION})"
        )

    # The most important check. A model trained on a different feature layout
    # would accept the same tensor shapes and return confident, wrong numbers.
    if payload["feature_set_version"] != FEATURE_SET_VERSION:
        raise CheckpointError(
            f"checkpoint was trained with feature set "
            f"{payload['feature_set_version']}, but this service uses "
            f"{FEATURE_SET_VERSION}; retrain before serving"
        )

    try:
        scaler = SequenceScaler.from_dict(payload["scaler"])
    except Exception:  # noqa: BLE001
        raise CheckpointError("checkpoint contains an unreadable scaler")

    if not scaler.fitted:
        raise CheckpointError("checkpoint contains an unfitted scaler")

    return Checkpoint(
        model_name=str(payload["model_name"]),
        model_version=str(payload["model_version"]),
        feature_set_version=str(payload["feature_set_version"]),
        config=dict(payload["config"]),
        state_dict=payload["state_dict"],
        scaler=scaler,
        horizons=list(payload["horizons"]),
        trained_at=payload.get("trained_at"),
        metrics=payload.get("metrics") or {},
        dataset_version=payload.get("dataset_version"),
    )


def checkpoint_path(directory: str, model_key: str) -> str:
    """Conventional path for a model's checkpoint."""
    return os.path.join(directory, f"{model_key}.pt")


# ---------------------------------------------------------------------------
# Vision checkpoints (contract section 8)
# ---------------------------------------------------------------------------


@dataclass
class VisionCheckpoint:
    """A validated satellite-model checkpoint."""

    model_name: str
    model_version: str
    image_spec_version: str
    config: Dict[str, Any]
    state_dict: Dict[str, Any]
    source_vocabulary: Dict[str, int]
    class_names: list
    label_definition: Optional[str] = None
    trained_at: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    dataset_version: Optional[str] = None

    def source_index(self, key: str) -> int:
        """Embedding index for a source key, 0 when it was never trained on."""
        return int(self.source_vocabulary.get(key, 0))

    def knows_source(self, key: str) -> bool:
        """Whether this source was represented in the training data."""
        return key in self.source_vocabulary


def save_vision_checkpoint(
    path: str,
    model,
    model_name: str,
    model_version: str,
    source_vocabulary: Dict[str, int],
    class_names,
    label_definition: Optional[str] = None,
    metrics: Optional[Dict[str, Any]] = None,
    dataset_version: Optional[str] = None,
) -> str:
    """Write a satellite checkpoint atomically."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)

    payload = {
        "format_version": CHECKPOINT_FORMAT_VERSION,
        "model_name": model_name,
        "model_version": model_version,
        "image_spec_version": IMAGE_SPEC_VERSION,
        "config": model.config(),
        "state_dict": model.state_dict(),
        "source_vocabulary": dict(source_vocabulary),
        "class_names": list(class_names),
        # Carried so the meaning of a positive prediction travels with the
        # model rather than living only in a training script.
        "label_definition": label_definition,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics or {},
        "dataset_version": dataset_version,
    }

    temporary = f"{path}.tmp"
    torch.save(payload, temporary)
    os.replace(temporary, path)
    return path


def load_vision_checkpoint(path: str) -> VisionCheckpoint:
    """Read and validate a satellite checkpoint."""
    if not os.path.exists(path):
        raise CheckpointError("checkpoint file does not exist")

    try:
        payload = torch.load(path, map_location="cpu", weights_only=False)
    except Exception as error:  # noqa: BLE001
        raise CheckpointError(f"checkpoint could not be read: {type(error).__name__}")

    if not isinstance(payload, dict):
        raise CheckpointError("checkpoint is not in the expected format")

    missing = [key for key in REQUIRED_VISION_KEYS if key not in payload]
    if missing:
        raise CheckpointError(
            f"checkpoint is missing required fields: {', '.join(missing)}"
        )

    if payload["format_version"] != CHECKPOINT_FORMAT_VERSION:
        raise CheckpointError(
            f"checkpoint format version {payload['format_version']} is not "
            f"supported (expected {CHECKPOINT_FORMAT_VERSION})"
        )

    # As with the feature set: a model trained under a different image pipeline
    # accepts the same tensor shapes and returns confident, wrong answers.
    if payload["image_spec_version"] != IMAGE_SPEC_VERSION:
        raise CheckpointError(
            f"checkpoint was trained with image spec "
            f"{payload['image_spec_version']}, but this service uses "
            f"{IMAGE_SPEC_VERSION}; retrain before serving"
        )

    vocabulary = payload["source_vocabulary"]
    if not isinstance(vocabulary, dict) or not vocabulary:
        raise CheckpointError("checkpoint contains an empty source vocabulary")

    return VisionCheckpoint(
        model_name=str(payload["model_name"]),
        model_version=str(payload["model_version"]),
        image_spec_version=str(payload["image_spec_version"]),
        config=dict(payload["config"]),
        state_dict=payload["state_dict"],
        source_vocabulary={str(k): int(v) for k, v in vocabulary.items()},
        class_names=list(payload["class_names"]),
        label_definition=payload.get("label_definition"),
        trained_at=payload.get("trained_at"),
        metrics=payload.get("metrics") or {},
        dataset_version=payload.get("dataset_version"),
    )
