"""Model architecture tests: construction, shapes, forward pass, masking.

These assert software behaviour only. None of them claims a prediction is
scientifically correct -- an untrained model's outputs are arbitrary, and the
tests are written so that remains true without any of them failing.
"""

from __future__ import annotations

import torch

from models.base import MaskedSequenceEncoder, count_parameters
from models.intensity.model import TREND_CLASSES, IntensityModel
from models.trajectory.model import TrajectoryModel
from preprocessing.features import ENVIRONMENTAL_FEATURE_COUNT, STEP_FEATURE_COUNT

HORIZONS = [6, 12, 24]


def build_trajectory() -> TrajectoryModel:
    return TrajectoryModel(
        step_features=STEP_FEATURE_COUNT,
        environment_features=ENVIRONMENTAL_FEATURE_COUNT,
        horizons=HORIZONS,
    )


def build_intensity() -> IntensityModel:
    return IntensityModel(
        step_features=STEP_FEATURE_COUNT,
        environment_features=ENVIRONMENTAL_FEATURE_COUNT,
        horizons=HORIZONS,
    )


class TestTrajectoryModel:
    def test_initialises_with_a_head_per_horizon(self):
        model = build_trajectory()
        assert set(model.heads.keys()) == {"6", "12", "24"}
        assert count_parameters(model) > 0

    def test_forward_pass_output_shape(self, synthetic_batch):
        sequences, mask, environment = synthetic_batch(batch_size=4)
        model = build_trajectory()

        output = model(
            torch.from_numpy(sequences),
            torch.from_numpy(mask),
            torch.from_numpy(environment),
        )

        # [batch, horizons, (delta latitude, delta longitude)]
        assert output.shape == (4, len(HORIZONS), 2)
        assert torch.isfinite(output).all()

    def test_horizons_are_configurable(self, synthetic_batch):
        sequences, mask, environment = synthetic_batch(batch_size=2)
        model = TrajectoryModel(
            step_features=STEP_FEATURE_COUNT,
            environment_features=ENVIRONMENTAL_FEATURE_COUNT,
            horizons=[6, 12, 24, 48],
        )
        output = model(
            torch.from_numpy(sequences),
            torch.from_numpy(mask),
            torch.from_numpy(environment),
        )
        assert output.shape[1] == 4

    def test_config_round_trip_rebuilds_the_same_shape(self):
        model = build_trajectory()
        rebuilt = TrajectoryModel.from_config(model.config())

        assert rebuilt.horizons == model.horizons
        # A state dict from one must load into the other, which is what the
        # registry relies on when restoring a checkpoint.
        rebuilt.load_state_dict(model.state_dict(), strict=True)


class TestIntensityModel:
    def test_forward_returns_forecast_and_trend_logits(self, synthetic_batch):
        sequences, mask, environment = synthetic_batch(batch_size=3)
        model = build_intensity()

        forecast, trend_logits = model(
            torch.from_numpy(sequences),
            torch.from_numpy(mask),
            torch.from_numpy(environment),
        )

        assert forecast.shape == (3, len(HORIZONS), 2)
        assert trend_logits.shape == (3, len(TREND_CLASSES))
        assert torch.isfinite(forecast).all()
        assert torch.isfinite(trend_logits).all()

    def test_trend_head_is_separate_from_regression_heads(self):
        """Section 10 keeps the categorical trend apart from the numbers."""
        model = build_intensity()
        regression_parameters = {id(p) for p in model.heads.parameters()}
        trend_parameters = {id(p) for p in model.trend_head.parameters()}
        assert regression_parameters.isdisjoint(trend_parameters)

    def test_config_round_trip_rebuilds_the_same_shape(self):
        model = build_intensity()
        rebuilt = IntensityModel.from_config(model.config())
        rebuilt.load_state_dict(model.state_dict(), strict=True)


class TestMaskedEncoder:
    def test_padding_does_not_change_the_encoding(self):
        """Padding must not alter a sequence's representation.

        This is what stops a three-observation track from being read as if it
        had eight, which would make short histories systematically wrong. It
        holds only because the encoder packs its input: a GRU fed padded zeros
        evolves its hidden state through them, and masking the output afterwards
        cannot undo that.
        """
        encoder = MaskedSequenceEncoder(step_features=STEP_FEATURE_COUNT, hidden_size=16)
        encoder.eval()

        real_steps = 3
        generator = torch.Generator().manual_seed(0)
        content = torch.randn(1, real_steps, STEP_FEATURE_COUNT, generator=generator)

        # Same content, different amounts of trailing padding.
        short = torch.cat([content, torch.zeros(1, 1, STEP_FEATURE_COUNT)], dim=1)
        short_mask = torch.tensor([[1.0] * real_steps + [0.0]])

        long = torch.cat([content, torch.zeros(1, 4, STEP_FEATURE_COUNT)], dim=1)
        long_mask = torch.tensor([[1.0] * real_steps + [0.0] * 4])

        with torch.no_grad():
            first = encoder(short, short_mask)
            second = encoder(long, long_mask)

        # Identical throughout, because packing means the GRU never runs over
        # the padding at all -- masking the output alone would not achieve this.
        assert torch.allclose(first, second, atol=1e-5)

    def test_output_width_is_twice_the_hidden_size(self, synthetic_batch):
        sequences, mask, _ = synthetic_batch(batch_size=2)
        encoder = MaskedSequenceEncoder(step_features=STEP_FEATURE_COUNT, hidden_size=32)
        encoded = encoder(torch.from_numpy(sequences), torch.from_numpy(mask))
        assert encoded.shape == (2, 64)
