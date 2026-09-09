"""Feature scaling fitted on training data only.

Standardisation statistics are computed from the training split and then frozen
into the checkpoint. Fitting them on the full dataset would leak validation and
test distributions into the model, and recomputing them at inference time would
mean a request was scaled differently from the data the model learned on.

Padded steps are excluded from the statistics: their zeros are structural, not
observations, and including them would drag every mean toward zero in
proportion to how many short tracks the dataset happens to contain.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Sequence

import numpy as np

# Guards against dividing by a near-zero standard deviation for a feature that
# is constant across the training set.
MINIMUM_STD = 1e-6


@dataclass
class SequenceScaler:
    """Per-feature standardisation for step and environmental inputs."""

    step_mean: List[float] = field(default_factory=list)
    step_std: List[float] = field(default_factory=list)
    environment_mean: List[float] = field(default_factory=list)
    environment_std: List[float] = field(default_factory=list)
    fitted: bool = False

    def fit(
        self,
        sequences: np.ndarray,
        masks: np.ndarray,
        environments: np.ndarray,
    ) -> "SequenceScaler":
        """Fit on training data.

        ``sequences`` is ``[n, steps, step_features]``, ``masks`` is
        ``[n, steps]`` with 1 for real steps, ``environments`` is
        ``[n, environment_features]``.
        """
        sequences = np.asarray(sequences, dtype=np.float64)
        masks = np.asarray(masks, dtype=np.float64)
        environments = np.asarray(environments, dtype=np.float64)

        real = masks.reshape(-1) > 0
        flat = sequences.reshape(-1, sequences.shape[-1])[real]
        if flat.size == 0:
            raise ValueError("no unmasked steps to fit the scaler on")

        self.step_mean = flat.mean(axis=0).tolist()
        self.step_std = np.maximum(flat.std(axis=0), MINIMUM_STD).tolist()

        self.environment_mean = environments.mean(axis=0).tolist()
        self.environment_std = np.maximum(
            environments.std(axis=0), MINIMUM_STD
        ).tolist()

        self.fitted = True
        return self

    def transform_sequences(self, sequences: np.ndarray, masks: np.ndarray) -> np.ndarray:
        """Standardise step features, leaving padded rows at zero."""
        self._require_fitted()
        sequences = np.asarray(sequences, dtype=np.float32)
        scaled = (sequences - np.asarray(self.step_mean, dtype=np.float32)) / np.asarray(
            self.step_std, dtype=np.float32
        )
        # Re-zero padding so it stays distinguishable from a real observation
        # that happens to sit at the training mean.
        return scaled * np.asarray(masks, dtype=np.float32)[..., None]

    def transform_environment(self, environments: np.ndarray) -> np.ndarray:
        """Standardise environmental features."""
        self._require_fitted()
        environments = np.asarray(environments, dtype=np.float32)
        return (
            environments - np.asarray(self.environment_mean, dtype=np.float32)
        ) / np.asarray(self.environment_std, dtype=np.float32)

    def _require_fitted(self) -> None:
        if not self.fitted:
            raise RuntimeError(
                "scaler has not been fitted; load it from a checkpoint or fit "
                "it on the training split before transforming"
            )

    def to_dict(self) -> Dict[str, object]:
        """Serialise for storage inside a model checkpoint."""
        return {
            "step_mean": self.step_mean,
            "step_std": self.step_std,
            "environment_mean": self.environment_mean,
            "environment_std": self.environment_std,
            "fitted": self.fitted,
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Sequence[float]]) -> "SequenceScaler":
        """Restore a scaler saved alongside trained weights."""
        return cls(
            step_mean=list(payload["step_mean"]),
            step_std=list(payload["step_std"]),
            environment_mean=list(payload["environment_mean"]),
            environment_std=list(payload["environment_std"]),
            fitted=bool(payload.get("fitted", True)),
        )
