"""Feature set 1.1: presence-aware pressure, Coriolis, 12-hour wind change.

The trigger was a real bug. Pressure is optional in the contract, and a missing
value used to enter the model as 0 hPa -- far outside anything in training -- so
a trajectory request without pressure came back COMPLETED with a forecast
pointing the wrong way. Wind had the same silent-zero path. These tests pin the
fix, and the features added to match the 14-feature intensity model on branch
arpitsecond (pressure_available, coriolis_param, lag_12h_wind_change_kts).
"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta

import numpy as np
import pytest

from preprocessing.dataset import withhold_pressure
from preprocessing.features import (
    FEATURE_SET_VERSION,
    MIN_OBSERVATIONS,
    NEUTRAL_PRESSURE_HPA,
    STEP_FEATURE_NAMES,
    InsufficientHistory,
    Observation,
    build_sequence,
    coriolis_parameter,
    wind_change_12h,
)
from preprocessing.scaler import DEGENERATE_STD, SequenceScaler

COL = {name: index for index, name in enumerate(STEP_FEATURE_NAMES)}
START = datetime(2023, 5, 12)


def track(count=6, step_hours=6, pressure=True, wind=True, latitude=15.0):
    return [
        Observation(
            timestamp=START + timedelta(hours=step_hours * i),
            latitude=latitude + 0.3 * i,
            longitude=90.0 - 0.2 * i,
            wind_speed_kph=(60.0 + 5 * i) if wind else None,
            pressure_hpa=(1000.0 - 2 * i) if pressure else None,
        )
        for i in range(count)
    ]


def real_rows(steps, mask):
    return [row for row, flag in zip(steps, mask) if flag]


def test_version_was_bumped_so_old_checkpoints_are_refused():
    """A 1.0 checkpoint would read these 20 columns as its 16 and serve
    nonsense; the registry refuses a version mismatch instead."""
    assert FEATURE_SET_VERSION == "1.1"
    assert len(STEP_FEATURE_NAMES) == 20


class TestMissingPressure:
    def test_present_pressure_is_used_and_flagged(self):
        rows = real_rows(*build_sequence(track()))
        assert rows[-1][COL["pressure_hpa"]] == pytest.approx(990.0)
        assert all(row[COL["pressure_present"]] == 1.0 for row in rows)

    def test_missing_pressure_is_neutral_and_flagged_not_zero(self):
        """The bug: a missing pressure became 0 hPa."""
        rows = real_rows(*build_sequence(track(pressure=False)))

        for row in rows:
            assert row[COL["pressure_hpa"]] == NEUTRAL_PRESSURE_HPA
            assert row[COL["pressure_present"]] == 0.0
            assert row[COL["pressure_delta"]] == 0.0

    def test_no_zero_pressure_ever_reaches_the_model(self):
        mixed = track()
        mixed[2] = replace(mixed[2], pressure_hpa=None)
        mixed[4] = replace(mixed[4], pressure_hpa=None)
        rows = real_rows(*build_sequence(mixed))

        assert all(row[COL["pressure_hpa"]] > 900 for row in rows)

    def test_no_tendency_is_invented_across_a_gap(self):
        mixed = track()
        mixed[3] = replace(mixed[3], pressure_hpa=None)
        rows = real_rows(*build_sequence(mixed))

        # Step 3 lacks pressure, and step 4's predecessor lacks it.
        assert rows[3][COL["pressure_delta"]] == 0.0
        assert rows[4][COL["pressure_delta"]] == 0.0
        assert rows[5][COL["pressure_delta"]] == pytest.approx(-2.0)


class TestMissingWind:
    def test_history_fixes_without_wind_are_dropped(self):
        """As they are from the training table."""
        fixes = track(count=6)
        fixes[1] = replace(fixes[1], wind_speed_kph=None)
        steps, mask = build_sequence(fixes)

        assert sum(mask) == 5
        assert all(row[COL["wind_speed_kph"]] > 0 for row in real_rows(steps, mask))

    def test_too_few_fixes_with_wind_is_insufficient_history(self):
        fixes = track(count=MIN_OBSERVATIONS)
        fixes[0] = replace(fixes[0], wind_speed_kph=None)

        with pytest.raises(InsufficientHistory, match="wind speed"):
            build_sequence(fixes)


class TestCoriolis:
    def test_zero_at_the_equator_and_signed_by_hemisphere(self):
        assert coriolis_parameter(0.0) == pytest.approx(0.0)
        assert coriolis_parameter(15.0) > 0
        assert coriolis_parameter(-15.0) == pytest.approx(-coriolis_parameter(15.0))

    def test_value_in_units_of_1e_minus_4(self):
        # f(15N) = 2 * 7.2921159e-5 * sin(15 deg) = 3.775e-5 s^-1 = 0.3775e-4
        assert coriolis_parameter(15.0) == pytest.approx(0.3775, abs=1e-4)

    def test_spread_is_not_mistaken_for_a_constant(self):
        """In raw s^-1 the spread would fall under the scaler's degenerate
        threshold and the feature would be silently zeroed."""
        values = [coriolis_parameter(lat) for lat in np.linspace(-40, 40, 81)]
        assert np.std(values) > DEGENERATE_STD * 100

    def test_it_is_in_every_step(self):
        rows = real_rows(*build_sequence(track(latitude=20.0)))
        assert rows[0][COL["coriolis_param"]] == pytest.approx(coriolis_parameter(20.0))


class TestWindChange12h:
    def test_change_against_the_fix_twelve_hours_earlier(self):
        fixes = track(count=5)  # 6-hourly, wind 60, 65, 70, 75, 80
        change, present = wind_change_12h(fixes[4], fixes[:4])

        assert present == 1.0
        assert change == pytest.approx(80.0 - 70.0)

    def test_absent_when_no_fix_falls_in_the_window(self):
        fixes = track(count=2)  # only 6 h of history
        assert wind_change_12h(fixes[1], fixes[:1]) == (0.0, 0.0)

    def test_first_steps_of_a_short_track_are_flagged_absent(self):
        rows = real_rows(*build_sequence(track(count=4)))

        assert [row[COL["wind_change_12h_present"]] for row in rows] == [0.0, 0.0, 1.0, 1.0]

    def test_lookback_may_reach_before_the_window(self):
        """Fixes older than the 8-step window are still in the past."""
        rows = real_rows(*build_sequence(track(count=12)))
        assert rows[0][COL["wind_change_12h_present"]] == 1.0

    def test_a_later_fix_is_never_used(self):
        """The future-data guard, at the level of this one feature."""
        fixes = track(count=5)
        change, present = wind_change_12h(fixes[0], fixes[1:])
        assert (change, present) == (0.0, 0.0)


class TestPressureDropoutMakesTheFlagLearnable:
    def _sequences(self):
        rows, mask = build_sequence(track(count=8))
        sequences = np.array([rows] * 50, dtype=np.float32)
        masks = np.array([mask] * 50, dtype=np.float32)
        return sequences, masks

    def test_withholding_touches_only_the_chosen_samples(self):
        sequences, masks = self._sequences()
        out = withhold_pressure(sequences, masks, rows=[0, 3])

        assert (out[[0, 3], :, COL["pressure_present"]] == 0).all()
        assert (out[[0, 3], :, COL["pressure_hpa"]] == NEUTRAL_PRESSURE_HPA).all()
        untouched = [i for i in range(50) if i not in (0, 3)]
        np.testing.assert_array_equal(out[untouched], sequences[untouched])
        np.testing.assert_array_equal(sequences[:, :, COL["pressure_present"]], 1.0)

    def test_without_dropout_the_scaler_would_zero_the_flag(self):
        """The reason dropout exists: a constant flag is degenerate."""
        sequences, masks = self._sequences()
        environments = np.zeros((50, 6), dtype=np.float32)
        scaler = SequenceScaler().fit(sequences, masks, environments)

        assert scaler.step_degenerate[COL["pressure_present"]] is True

    def test_with_dropout_the_flag_survives_scaling(self):
        sequences, masks = self._sequences()
        sequences = withhold_pressure(sequences, masks, rows=range(0, 50, 5))
        environments = np.zeros((50, 6), dtype=np.float32)
        scaler = SequenceScaler().fit(sequences, masks, environments)

        assert scaler.step_degenerate[COL["pressure_present"]] is False
