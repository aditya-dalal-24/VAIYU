"""Shared fixtures.

Synthetic tensors here exist only to exercise software behaviour -- shapes,
wiring, error paths, checkpoint round-trips. They are never used to make a
claim about scientific accuracy, and no test asserts that a prediction is
meteorologically correct.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from preprocessing.features import (  # noqa: E402
    ENVIRONMENTAL_FEATURE_COUNT,
    SEQUENCE_LENGTH,
    STEP_FEATURE_COUNT,
    Observation,
)

BASE_TIME = datetime(2026, 9, 8, 0, 0, 0)


def make_observation(hours: int, latitude: float = 15.0, longitude: float = 88.0,
                     wind: float = 110.0, pressure: float = 970.0) -> Observation:
    """One fix, ``hours`` after the base time."""
    return Observation(
        timestamp=BASE_TIME + timedelta(hours=hours),
        latitude=latitude,
        longitude=longitude,
        wind_speed_kph=wind,
        pressure_hpa=pressure,
    )


@pytest.fixture
def observation_track():
    """Five fixes, six hours apart, moving north-west and intensifying."""
    return [
        make_observation(
            hours=index * 6,
            latitude=13.0 + index * 0.6,
            longitude=90.0 - index * 0.5,
            wind=90.0 + index * 8,
            pressure=985.0 - index * 4,
        )
        for index in range(5)
    ]


@pytest.fixture
def analysis_request_body():
    """A minimal valid request body, in contract camelCase."""

    def build(analysis_types=None, history_count: int = 4, **overrides):
        history = [
            {
                "timestamp": (BASE_TIME + timedelta(hours=index * 6)).isoformat() + "Z",
                "latitude": 13.0 + index * 0.6,
                "longitude": 90.0 - index * 0.5,
                "windSpeedKph": 90.0 + index * 8,
                "pressureHpa": 985.0 - index * 4,
            }
            for index in range(history_count)
        ]
        body = {
            "requestId": "11111111-1111-1111-1111-111111111111",
            "cycloneId": "22222222-2222-2222-2222-222222222222",
            # `is None` rather than a truthiness check: an explicitly empty
            # list is a case the validation tests need to reach.
            "analysisTypes": (
                ["TRAJECTORY_PREDICTION", "INTENSITY_PREDICTION"]
                if analysis_types is None
                else analysis_types
            ),
            "currentObservation": {
                "timestamp": (
                    BASE_TIME + timedelta(hours=history_count * 6)
                ).isoformat() + "Z",
                "latitude": 16.2,
                "longitude": 87.5,
                "windSpeedKph": 130.0,
                "pressureHpa": 962.0,
                "movementSpeedKph": 15.0,
                "movementDirectionDegrees": 315.0,
            },
            "observationHistory": history,
            "environmentalData": {
                "seaSurfaceTemperatureC": 29.5,
                "humidityPercent": 80.0,
                "windShearKph": 12.0,
            },
        }
        body.update(overrides)
        return body

    return build


@pytest.fixture
def synthetic_batch():
    """Random model inputs for shape and forward-pass tests."""

    def build(batch_size: int = 4):
        generator = np.random.default_rng(0)
        sequences = generator.normal(
            size=(batch_size, SEQUENCE_LENGTH, STEP_FEATURE_COUNT)
        ).astype(np.float32)
        mask = np.ones((batch_size, SEQUENCE_LENGTH), dtype=np.float32)
        # Pad the tail of one row, so masking is exercised.
        if batch_size > 1:
            mask[0, -2:] = 0.0
        environment = generator.normal(
            size=(batch_size, ENVIRONMENTAL_FEATURE_COUNT)
        ).astype(np.float32)
        return sequences, mask, environment

    return build


@pytest.fixture
def temporary_checkpoint_dir(tmp_path):
    """An empty checkpoint directory, isolated from the real one."""
    directory = tmp_path / "checkpoints"
    directory.mkdir()
    return str(directory)
