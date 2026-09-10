"""Feature scaling fitted on training data only.

Standardisation statistics are computed from the training split and then frozen
into the checkpoint. Fitting them on the full dataset would leak validation and
test distributions into the model, and recomputing them at inference time would
mean a request was scaled differently from the data the model learned on.

Padded steps are excluded from the statistics: their zeros are structural, not
observations, and including them would drag every mean toward zero in
proportion to how many short tracks the dataset happens to contain.

Degenerate features
-------------------
A feature that never varied during training carries no information the model
could have learned from, and its standard deviation is ~0. Dividing by that
turns any deviation at inference into an enormous number. This is not
hypothetical: a dataset without environmental columns, served a request that
supplies them, produced model inputs in the millions and predictions to match.

Such features are recorded at fit time and **zeroed** on transform, which
presents the model with the constant it actually trained on. Clamping the
divisor instead only changes how large the wrong number is.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Sequence

import numpy as np

# Guards against dividing by a near-zero standard deviation.
MINIMUM_STD = 1e-6

# Below this training standard deviation a feature is treated as constant: the
# model cannot have learned anything from it, so it is zeroed rather than
# scaled. Absolute rather than relative, because these features carry physical
# units whose meaningful variation is far larger than this.
DEGENERATE_STD = 1e-4


@dataclass
class SequenceScaler:
    """Per-feature standardisation for step and environmental inputs."""

    step_mean: List[float] = field(default_factory=list)
    step_std: List[float] = field(default_factory=list)
    environment_mean: List[float] = field(default_factory=list)
    environment_std: List[float] = field(default_factory=list)
    # True where the feature was constant in training and must be zeroed.
    step_degenerate: List[bool] = field(default_factory=list)
    environment_degenerate: List[bool] = field(default_factory=list)
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

        step_std = flat.std(axis=0)
        self.step_mean = flat.mean(axis=0).tolist()
        self.step_std = np.maximum(step_std, MINIMUM_STD).tolist()
        self.step_degenerate = (step_std < DEGENERATE_STD).tolist()

        environment_std = environments.std(axis=0)
        self.environment_mean = environments.mean(axis=0).tolist()
        self.environment_std = np.maximum(environment_std, MINIMUM_STD).tolist()
        self.environment_degenerate = (environment_std < DEGENERATE_STD).tolist()

        self.fitted = True
        return self

    def transform_sequences(self, sequences: np.ndarray, masks: np.ndarray) -> np.ndarray:
        """Standardise step features, leaving padded rows at zero."""
        self._require_fitted()
        sequences = np.asarray(sequences, dtype=np.float32)
        scaled = (sequences - np.asarray(self.step_mean, dtype=np.float32)) / np.asarray(
            self.step_std, dtype=np.float32
        )

        # Features that never varied in training contribute nothing the model
        # could have learned; a deviation here would be noise multiplied by a
        # near-zero divisor.
        if self.step_degenerate:
            scaled[..., np.asarray(self.step_degenerate, dtype=bool)] = 0.0

        # Re-zero padding so it stays distinguishable from a real observation
        # that happens to sit at the training mean.
        return scaled * np.asarray(masks, dtype=np.float32)[..., None]

    def transform_environment(self, environments: np.ndarray) -> np.ndarray:
        """Standardise environmental features."""
        self._require_fitted()
        environments = np.asarray(environments, dtype=np.float32)
        scaled = (
            environments - np.asarray(self.environment_mean, dtype=np.float32)
        ) / np.asarray(self.environment_std, dtype=np.float32)

        if self.environment_degenerate:
            scaled[..., np.asarray(self.environment_degenerate, dtype=bool)] = 0.0

        return scaled

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
            "step_degenerate": self.step_degenerate,
            "environment_degenerate": self.environment_degenerate,
            "fitted": self.fitted,
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Sequence[float]]) -> "SequenceScaler":
        """Restore a scaler saved alongside trained weights.

        Checkpoints written before degeneracy was tracked have the flags
        derived from their stored deviations, so an older artifact is corrected
        on load rather than needing a retrain.
        """
        step_std = list(payload["step_std"])
        environment_std = list(payload["environment_std"])

        step_degenerate = payload.get("step_degenerate")
        if not step_degenerate:
            step_degenerate = [value <= MINIMUM_STD for value in step_std]

        environment_degenerate = payload.get("environment_degenerate")
        if not environment_degenerate:
            environment_degenerate = [value <= MINIMUM_STD for value in environment_std]

        return cls(
            step_mean=list(payload["step_mean"]),
            step_std=step_std,
            environment_mean=list(payload["environment_mean"]),
            environment_std=environment_std,
            step_degenerate=list(step_degenerate),
            environment_degenerate=list(environment_degenerate),
            fitted=bool(payload.get("fitted", True)),
        )
