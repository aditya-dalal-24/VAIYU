"""Intensity prediction model (contract section 10).

Predicts two things that the contract deliberately keeps apart:

* **numerical forecasts** -- wind speed and central pressure at each horizon,
  produced as changes from the current fix and converted back to absolute
  values at inference;
* **a categorical trend** -- INTENSIFYING, WEAKENING or STABLE, from a separate
  classification head with its own loss.

Section 10 requires the numerical forecast to be reported separately from the
trend, so the trend is a real classifier rather than a threshold applied to the
regression output. The two heads share an encoder but are supervised
independently.

UNCERTAIN is not a trained class. It is reported at inference when the
classifier's confidence falls below a configured floor, which gives the fourth
contract value an honest meaning -- the model declining to commit -- instead of
asking it to learn a label no dataset marks.
"""

from __future__ import annotations

from typing import Dict, List, Sequence

import torch
import torch.nn as nn

from models.base import ForecastHead, MaskedSequenceEncoder

MODEL_NAME = "intensity-model-v1"
MODEL_VERSION = "1.0"

# Two regression outputs per horizon: delta wind (kph), delta pressure (hPa).
OUTPUTS_PER_HORIZON = 2

# Trained trend classes. UNCERTAIN is applied at inference, not learned.
TREND_CLASSES: List[str] = ["WEAKENING", "STABLE", "INTENSIFYING"]

# Below this maximum class probability the service reports UNCERTAIN.
DEFAULT_TREND_CONFIDENCE_FLOOR = 0.45


class IntensityModel(nn.Module):
    """Masked GRU encoder with per-horizon regression heads and a trend head."""

    def __init__(
        self,
        step_features: int,
        environment_features: int,
        horizons: Sequence[int],
        hidden_size: int = 64,
        num_layers: int = 1,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.horizons: List[int] = list(horizons)
        self.step_features = step_features
        self.environment_features = environment_features
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        self.encoder = MaskedSequenceEncoder(
            step_features=step_features,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout,
        )

        combined = self.encoder.output_size + environment_features

        self.heads = nn.ModuleDict(
            {
                str(horizon): ForecastHead(
                    input_size=combined,
                    output_size=OUTPUTS_PER_HORIZON,
                    hidden_size=hidden_size,
                    dropout=dropout,
                )
                for horizon in self.horizons
            }
        )

        # Separate head, separate loss: the categorical trend is not a
        # post-processed regression output.
        self.trend_head = ForecastHead(
            input_size=combined,
            output_size=len(TREND_CLASSES),
            hidden_size=hidden_size,
            dropout=dropout,
        )

    def forward(
        self,
        sequences: torch.Tensor,
        mask: torch.Tensor,
        environment: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """Return per-horizon deltas ``[batch, horizons, 2]`` and trend logits.

        Logits are returned unnormalised; the training loop applies
        cross-entropy and the inference layer applies softmax, so the
        probability is computed once in each context.
        """
        encoded = self.encoder(sequences, mask)
        combined = torch.cat([encoded, environment], dim=-1)

        outputs = [self.heads[str(horizon)](combined) for horizon in self.horizons]
        forecasts = torch.stack(outputs, dim=1)

        return forecasts, self.trend_head(combined)

    def config(self) -> Dict[str, object]:
        """Architecture parameters, stored in the checkpoint for exact rebuild."""
        return {
            "step_features": self.step_features,
            "environment_features": self.environment_features,
            "horizons": list(self.horizons),
            "hidden_size": self.hidden_size,
            "num_layers": self.num_layers,
            "trend_classes": list(TREND_CLASSES),
        }

    @classmethod
    def from_config(cls, config: Dict[str, object]) -> "IntensityModel":
        """Rebuild from a stored config before loading weights into it."""
        return cls(
            step_features=int(config["step_features"]),
            environment_features=int(config["environment_features"]),
            horizons=list(config["horizons"]),
            hidden_size=int(config.get("hidden_size", 64)),
            num_layers=int(config.get("num_layers", 1)),
        )
