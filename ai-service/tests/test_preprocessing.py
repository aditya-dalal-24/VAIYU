"""Preprocessing tests: feature construction, dataset building, scaling.

Covers the behaviours that would corrupt a model quietly rather than loudly:
missing values silently reading as zero, padding polluting the scaler, and
targets being invented where no observation exists.
"""

from __future__ import annotations

from datetime import timedelta

import numpy as np
import pandas as pd
import pytest

from preprocessing.dataset import (
    DatasetError,
    build_samples,
    describe_samples,
    load_observations,
    trend_from_wind_delta,
)
from preprocessing.features import (
    ENVIRONMENTAL_FEATURE_COUNT,
    SEQUENCE_LENGTH,
    STEP_FEATURE_COUNT,
    EnvironmentalData,
    build_sequence,
    environmental_features,
    normalise_longitude,
)
from preprocessing.scaler import SequenceScaler
from tests.conftest import BASE_TIME, make_observation


def track_frame(cyclone_id: str = "storm-a", steps: int = 12) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "cyclone_id": cyclone_id,
                "timestamp": BASE_TIME + timedelta(hours=index * 6),
                "latitude": 12.0 + index * 0.5,
                "longitude": 90.0 - index * 0.4,
                "wind_speed_kph": 80.0 + index * 5,
                "pressure_hpa": 990.0 - index * 3,
            }
            for index in range(steps)
        ]
    )


class TestFeatureConstruction:
    def test_sequence_shape_is_fixed(self, observation_track):
        steps, mask = build_sequence(observation_track)

        assert len(steps) == SEQUENCE_LENGTH
        assert len(mask) == SEQUENCE_LENGTH
        assert all(len(row) == STEP_FEATURE_COUNT for row in steps)

    def test_long_history_keeps_the_most_recent_window(self):
        track = [make_observation(hours=index * 6) for index in range(20)]
        steps, mask = build_sequence(track, sequence_length=SEQUENCE_LENGTH)

        assert len(steps) == SEQUENCE_LENGTH
        assert sum(mask) == SEQUENCE_LENGTH  # fully populated, nothing padded

    def test_longitude_is_encoded_circularly(self):
        """179 and -179 are three degrees apart, not 358."""
        east = build_sequence([make_observation(h, longitude=179.0) for h in (0, 6, 12)])[0]
        west = build_sequence([make_observation(h, longitude=-179.0) for h in (0, 6, 12)])[0]

        # sin/cos of longitude sit at indices 2 and 3.
        assert east[-1][2] == pytest.approx(west[-1][2], abs=0.1)
        assert east[-1][3] == pytest.approx(west[-1][3], abs=0.1)

    def test_normalise_longitude_wraps(self):
        assert normalise_longitude(190.0) == pytest.approx(-170.0)
        assert normalise_longitude(-190.0) == pytest.approx(170.0)
        assert normalise_longitude(45.0) == pytest.approx(45.0)

    def test_first_step_has_zero_rate_features(self, observation_track):
        """No borrowing a rate of change from a different storm."""
        steps, mask = build_sequence(observation_track[:3], sequence_length=3)

        # delta_hours is index 9; the first real step must not invent one.
        assert steps[0][9] == 0.0


class TestEnvironmentalFeatures:
    def test_absent_values_are_flagged_not_silently_imputed(self):
        features = environmental_features(None)

        assert len(features) == ENVIRONMENTAL_FEATURE_COUNT
        # Presence flags at odd indices must all be zero.
        assert features[1] == 0.0 and features[3] == 0.0 and features[5] == 0.0

    def test_present_values_are_flagged(self):
        features = environmental_features(
            EnvironmentalData(
                sea_surface_temperature_c=29.5, humidity_percent=80.0, wind_shear_kph=12.0
            )
        )

        assert features[0] == 29.5 and features[1] == 1.0
        assert features[2] == 80.0 and features[3] == 1.0
        assert features[4] == 12.0 and features[5] == 1.0

    def test_partial_environment_flags_only_what_is_present(self):
        features = environmental_features(
            EnvironmentalData(sea_surface_temperature_c=29.0)
        )

        assert features[1] == 1.0
        assert features[3] == 0.0
        assert features[5] == 0.0


class TestDatasetLoading:
    def test_missing_columns_raise_a_clear_error(self, tmp_path):
        path = tmp_path / "bad.csv"
        pd.DataFrame({"cyclone_id": ["a"], "timestamp": ["2026-01-01"]}).to_csv(
            path, index=False
        )

        with pytest.raises(DatasetError, match="missing required columns"):
            load_observations(str(path))

    def test_absent_file_raises(self, tmp_path):
        with pytest.raises(DatasetError, match="not found"):
            load_observations(str(tmp_path / "nope.csv"))

    def test_out_of_range_coordinates_raise(self, tmp_path):
        frame = track_frame()
        frame.loc[0, "latitude"] = 120.0
        path = tmp_path / "observations.csv"
        frame.to_csv(path, index=False)

        with pytest.raises(DatasetError, match="outside valid ranges"):
            load_observations(str(path))

    def test_duplicate_fixes_are_dropped(self, tmp_path):
        frame = pd.concat([track_frame(), track_frame()])
        path = tmp_path / "observations.csv"
        frame.to_csv(path, index=False)

        loaded = load_observations(str(path))

        assert len(loaded) == 12

    def test_rows_are_sorted_within_each_track(self, tmp_path):
        frame = track_frame().sample(frac=1, random_state=0)
        path = tmp_path / "observations.csv"
        frame.to_csv(path, index=False)

        loaded = load_observations(str(path))
        timestamps = loaded["timestamp"].tolist()

        assert timestamps == sorted(timestamps)


class TestSampleBuilding:
    def test_builds_samples_with_matching_widths(self):
        samples = build_samples(track_frame(), horizons=[6, 12, 24])

        assert len(samples) > 0
        assert samples.sequences.shape[2] == STEP_FEATURE_COUNT
        assert samples.environments.shape[1] == ENVIRONMENTAL_FEATURE_COUNT
        assert samples.position_targets.shape[1] == 3

    def test_horizons_without_an_observation_are_masked_not_invented(self):
        """A target is only produced where a real fix exists near T+h."""
        samples = build_samples(track_frame(steps=6), horizons=[6, 24, 48])

        # 48h targets cannot exist near the end of a 30-hour track.
        assert samples.target_masks[:, 2].sum() < len(samples)

    def test_empty_result_raises_rather_than_returning_nothing(self):
        short = track_frame(steps=2)

        with pytest.raises(DatasetError, match="no samples"):
            build_samples(short, horizons=[6])

    def test_describe_reports_counts(self):
        summary = describe_samples(build_samples(track_frame(), horizons=[6, 12]))

        assert summary["samples"] > 0
        assert summary["cyclones"] == 1
        assert summary["step_features"] == STEP_FEATURE_COUNT

    def test_multiple_cyclones_stay_separate(self):
        frame = pd.concat([track_frame("storm-a"), track_frame("storm-b")])
        samples = build_samples(frame, horizons=[6])

        assert set(samples.cyclone_ids.tolist()) == {"storm-a", "storm-b"}


class TestTrendLabels:
    def test_threshold_boundaries(self):
        assert trend_from_wind_delta(25.0) == 2   # INTENSIFYING
        assert trend_from_wind_delta(-25.0) == 0  # WEAKENING
        assert trend_from_wind_delta(0.0) == 1    # STABLE


class TestScaler:
    def test_padding_is_excluded_from_the_statistics(self):
        sequences = np.ones((4, 8, STEP_FEATURE_COUNT), dtype=np.float32) * 5.0
        masks = np.ones((4, 8), dtype=np.float32)
        masks[:, :4] = 0.0
        sequences[:, :4, :] = 0.0  # padded rows are zeroed
        environments = np.ones((4, ENVIRONMENTAL_FEATURE_COUNT), dtype=np.float32)

        scaler = SequenceScaler().fit(sequences, masks, environments)

        # Mean reflects the real steps only, not the zeros.
        assert scaler.step_mean[0] == pytest.approx(5.0)

    def test_transform_keeps_padding_at_zero(self):
        sequences = np.random.default_rng(0).normal(
            size=(3, 8, STEP_FEATURE_COUNT)
        ).astype(np.float32)
        masks = np.ones((3, 8), dtype=np.float32)
        masks[:, 0] = 0.0
        environments = np.ones((3, ENVIRONMENTAL_FEATURE_COUNT), dtype=np.float32)

        scaler = SequenceScaler().fit(sequences, masks, environments)
        scaled = scaler.transform_sequences(sequences, masks)

        assert np.allclose(scaled[:, 0, :], 0.0)

    def test_unfitted_scaler_refuses_to_transform(self):
        with pytest.raises(RuntimeError, match="not been fitted"):
            SequenceScaler().transform_sequences(
                np.zeros((1, 8, STEP_FEATURE_COUNT), dtype=np.float32),
                np.ones((1, 8), dtype=np.float32),
            )

    def test_round_trip_through_a_dict(self):
        sequences = np.random.default_rng(1).normal(
            size=(5, 8, STEP_FEATURE_COUNT)
        ).astype(np.float32)
        masks = np.ones((5, 8), dtype=np.float32)
        environments = np.ones((5, ENVIRONMENTAL_FEATURE_COUNT), dtype=np.float32)

        original = SequenceScaler().fit(sequences, masks, environments)
        restored = SequenceScaler.from_dict(original.to_dict())

        assert restored.fitted
        assert np.allclose(
            original.transform_sequences(sequences, masks),
            restored.transform_sequences(sequences, masks),
        )
