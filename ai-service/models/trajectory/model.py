"""Trajectory prediction model (contract section 9).

Predicts where a cyclone will be at each forecast horizon, as a **displacement
from its current position** in decimal degrees. Predicting the delta rather
than an absolute coordinate keeps the target centred near zero and lets the
model transfer between basins instead of memorising where storms tend to sit.

Output maps onto ``trajectoryPrediction.predictedPositions``: adding the
predicted delta to the current fix gives the latitude and longitude the
contract asks for, and the horizon supplies ``forecastHours`` and the timestamp.

The model is trained; it does not fabricate. Until a checkpoint exists the
registry reports it untrained and the service returns NOT_AVAILABLE.
"""

from __future__ import annotations

from typing import Dict, List, Sequence

import torch
import torch.nn as nn

from models.base import ForecastHead, MaskedSequenceEncoder

MODEL_NAME = "trajectory-model-v1"
MODEL_VERSION = "1.0"

# Two outputs per horizon: delta latitude and delta longitude, in degrees.
OUTPUTS_PER_HORIZON = 2


class TrajectoryModel(nn.Module):
    """Masked GRU encoder with one direct output head per forecast horizon."""

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

        # A ModuleDict keyed by horizon, so a checkpoint fails loudly if it was
        # trained for a different set of horizons than the one requested.
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

    def forward(
        self,
        sequences: torch.Tensor,
        mask: torch.Tensor,
        environment: torch.Tensor,
    ) -> torch.Tensor:
        """Return ``[batch, horizons, 2]`` of (delta latitude, delta longitude)."""
        encoded = self.encoder(sequences, mask)
        combined = torch.cat([encoded, environment], dim=-1)

        outputs = [self.heads[str(horizon)](combined) for horizon in self.horizons]
        return torch.stack(outputs, dim=1)

    def config(self) -> Dict[str, object]:
        """Architecture parameters, stored in the checkpoint for exact rebuild."""
        return {
            "step_features": self.step_features,
            "environment_features": self.environment_features,
            "horizons": list(self.horizons),
            "hidden_size": self.hidden_size,
            "num_layers": self.num_layers,
        }

    @classmethod
    def from_config(cls, config: Dict[str, object]) -> "TrajectoryModel":
        """Rebuild from a stored config before loading weights into it."""
        return cls(
            step_features=int(config["step_features"]),
            environment_features=int(config["environment_features"]),
            horizons=list(config["horizons"]),
            hidden_size=int(config.get("hidden_size", 64)),
            num_layers=int(config.get("num_layers", 1)),
        )
