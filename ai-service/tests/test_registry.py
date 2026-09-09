"""Registry and checkpoint tests.

The requirement being defended: an untrained or unloadable model must never
present itself as trained, and must never produce a prediction.
"""

from __future__ import annotations

import numpy as np
import pytest
import torch

from models.trajectory.model import MODEL_NAME, MODEL_VERSION, TrajectoryModel
from preprocessing.features import ENVIRONMENTAL_FEATURE_COUNT, STEP_FEATURE_COUNT
from preprocessing.scaler import SequenceScaler
from registry.checkpoint import (
    CheckpointError,
    checkpoint_path,
    load_checkpoint,
    save_checkpoint,
)
from registry.registry import ModelRegistry, ModelState

HORIZONS = [6, 12, 24]


def fitted_scaler() -> SequenceScaler:
    generator = np.random.default_rng(0)
    sequences = generator.normal(size=(20, 8, STEP_FEATURE_COUNT)).astype(np.float32)
    masks = np.ones((20, 8), dtype=np.float32)
    environments = generator.normal(
        size=(20, ENVIRONMENTAL_FEATURE_COUNT)
    ).astype(np.float32)
    return SequenceScaler().fit(sequences, masks, environments)


def write_checkpoint(directory: str, key: str = "trajectory", **overrides) -> str:
    model = TrajectoryModel(
        step_features=STEP_FEATURE_COUNT,
        environment_features=ENVIRONMENTAL_FEATURE_COUNT,
        horizons=HORIZONS,
    )
    return save_checkpoint(
        path=checkpoint_path(directory, key),
        model=model,
        scaler=fitted_scaler(),
        model_name=overrides.get("model_name", MODEL_NAME),
        model_version=overrides.get("model_version", MODEL_VERSION),
        horizons=HORIZONS,
        metrics=overrides.get("metrics", {"validation_skill": 0.5}),
    )


class TestCheckpointRoundTrip:
    def test_save_then_load_preserves_identity_and_scaler(self, temporary_checkpoint_dir):
        path = write_checkpoint(temporary_checkpoint_dir)
        checkpoint = load_checkpoint(path)

        assert checkpoint.model_name == MODEL_NAME
        assert checkpoint.model_version == MODEL_VERSION
        assert checkpoint.horizons == HORIZONS
        assert checkpoint.scaler.fitted

    def test_weights_survive_the_round_trip(self, temporary_checkpoint_dir):
        path = write_checkpoint(temporary_checkpoint_dir)
        checkpoint = load_checkpoint(path)

        rebuilt = TrajectoryModel.from_config(checkpoint.config)
        rebuilt.load_state_dict(checkpoint.state_dict, strict=True)

        original = torch.load(path, map_location="cpu", weights_only=False)["state_dict"]
        for name, tensor in rebuilt.state_dict().items():
            assert torch.allclose(tensor, original[name])

    def test_missing_file_raises(self, temporary_checkpoint_dir):
        with pytest.raises(CheckpointError, match="does not exist"):
            load_checkpoint(checkpoint_path(temporary_checkpoint_dir, "absent"))

    def test_corrupt_file_raises(self, tmp_path):
        path = tmp_path / "trajectory.pt"
        path.write_bytes(b"this is not a checkpoint")
        with pytest.raises(CheckpointError, match="could not be read"):
            load_checkpoint(str(path))

    def test_incomplete_checkpoint_raises(self, tmp_path):
        path = tmp_path / "trajectory.pt"
        torch.save({"format_version": 1, "model_name": "x"}, str(path))
        with pytest.raises(CheckpointError, match="missing required fields"):
            load_checkpoint(str(path))

    def test_feature_set_mismatch_is_rejected(self, tmp_path, temporary_checkpoint_dir):
        """A model trained on a different feature layout must not be served.

        The tensor shapes still line up, so nothing would fail at runtime --
        the model would simply return confident, wrong numbers.
        """
        path = write_checkpoint(temporary_checkpoint_dir)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["feature_set_version"] = "0.9"

        altered = tmp_path / "trajectory.pt"
        torch.save(payload, str(altered))

        with pytest.raises(CheckpointError, match="feature set"):
            load_checkpoint(str(altered))

    def test_unfitted_scaler_is_rejected(self, tmp_path, temporary_checkpoint_dir):
        path = write_checkpoint(temporary_checkpoint_dir)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["scaler"]["fitted"] = False

        altered = tmp_path / "trajectory.pt"
        torch.save(payload, str(altered))

        with pytest.raises(CheckpointError, match="unfitted scaler"):
            load_checkpoint(str(altered))


class TestRegistryStates:
    def test_no_checkpoint_reports_untrained(self, temporary_checkpoint_dir):
        registry = ModelRegistry(temporary_checkpoint_dir)

        assert registry.trajectory.state is ModelState.UNTRAINED
        assert registry.intensity.state is ModelState.UNTRAINED
        assert not registry.trajectory.is_ready
        assert registry.trajectory.model is None

    def test_untrained_model_reports_a_reason_and_no_model_name(
        self, temporary_checkpoint_dir
    ):
        registry = ModelRegistry(temporary_checkpoint_dir)
        summary = registry.trajectory.summary()

        assert summary["available"] is False
        assert summary["state"] == "UNTRAINED"
        assert "reason" in summary
        # Nothing that could be mistaken for a trained model's identity.
        assert "model" not in summary

    def test_valid_checkpoint_reports_trained(self, temporary_checkpoint_dir):
        write_checkpoint(temporary_checkpoint_dir)
        registry = ModelRegistry(temporary_checkpoint_dir)

        assert registry.trajectory.state is ModelState.TRAINED
        assert registry.trajectory.is_ready
        assert registry.trajectory.summary()["model"] == MODEL_NAME
        assert registry.trajectory.reason is None

    def test_invalid_checkpoint_reports_invalid_not_trained(
        self, temporary_checkpoint_dir
    ):
        path = checkpoint_path(temporary_checkpoint_dir, "trajectory")
        with open(path, "wb") as handle:
            handle.write(b"corrupt")

        registry = ModelRegistry(temporary_checkpoint_dir)

        assert registry.trajectory.state is ModelState.CHECKPOINT_INVALID
        assert not registry.trajectory.is_ready
        assert registry.trajectory.model is None

    def test_reasons_never_leak_internal_paths(self, temporary_checkpoint_dir):
        path = checkpoint_path(temporary_checkpoint_dir, "trajectory")
        with open(path, "wb") as handle:
            handle.write(b"corrupt")

        registry = ModelRegistry(temporary_checkpoint_dir)
        reason = registry.trajectory.reason or ""

        assert temporary_checkpoint_dir not in reason
        assert ".pt" not in reason
        assert "Traceback" not in reason

    def test_one_model_trained_does_not_make_the_other_ready(
        self, temporary_checkpoint_dir
    ):
        write_checkpoint(temporary_checkpoint_dir, key="trajectory")
        registry = ModelRegistry(temporary_checkpoint_dir)

        assert registry.trajectory.is_ready
        assert not registry.intensity.is_ready
