"""Tests for the live-check scoring helpers.

The pieces worth testing here are the ones that decide *what counts as a fair
score*: where the track is cut, and which real fix is allowed to verify a
forecast horizon. A bug in either turns a failing forecast into a passing one.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from evaluation.live_check import (
    VERIFY_TOLERANCE_HOURS,
    baselines,
    choose_cut,
    great_circle_km,
    verifying_fix,
)
from preprocessing.atcf import AtcfFix


def track(count: int, step_hours: float = 6.0):
    start = datetime(2026, 9, 1)
    return [
        AtcfFix(
            timestamp=start + timedelta(hours=step_hours * index),
            latitude=20.0 + index * 0.5,
            longitude=-80.0 - index * 0.5,
            wind_speed_kph=100.0,
            pressure_hpa=980.0,
        )
        for index in range(count)
    ]


class TestGreatCircleKm:
    def test_identical_points_are_zero(self):
        assert great_circle_km(20.0, -80.0, 20.0, -80.0) == pytest.approx(0.0)

    def test_one_degree_of_latitude_is_about_111_km(self):
        assert great_circle_km(20.0, -80.0, 21.0, -80.0) == pytest.approx(111.2, abs=1.0)

    def test_a_degree_of_longitude_shrinks_toward_the_pole(self):
        equator = great_circle_km(0.0, 0.0, 0.0, 1.0)
        high = great_circle_km(60.0, 0.0, 60.0, 1.0)

        assert high == pytest.approx(equator / 2, rel=0.02)

    def test_crossing_the_dateline_is_a_short_hop(self):
        """Naive coordinate subtraction would report ~40,000 km here."""
        assert great_circle_km(10.0, 179.5, 10.0, -179.5) < 120.0

    def test_symmetric(self):
        forward = great_circle_km(15.0, 88.0, 18.0, 91.0)
        backward = great_circle_km(18.0, 91.0, 15.0, 88.0)

        assert forward == pytest.approx(backward)


class TestChooseCut:
    def test_cut_leaves_at_least_the_requested_hold_back(self):
        fixes = track(20)
        cut = choose_cut(fixes, hold_back_hours=24.0)

        withheld = (fixes[-1].timestamp - fixes[cut].timestamp).total_seconds() / 3600.0
        assert withheld >= 24.0

    def test_cut_is_the_latest_such_index(self):
        """Withholding more than asked wastes usable history."""
        fixes = track(20)
        cut = choose_cut(fixes, hold_back_hours=24.0)

        later = (fixes[-1].timestamp - fixes[cut + 1].timestamp).total_seconds() / 3600.0
        assert later < 24.0

    def test_returns_none_when_the_track_cannot_fund_both_sides(self):
        # Four fixes over 18h cannot both withhold 48h and keep three of history.
        assert choose_cut(track(4), hold_back_hours=48.0) is None

    def test_never_cuts_away_the_minimum_history(self):
        fixes = track(6)
        cut = choose_cut(fixes, hold_back_hours=6.0)

        assert cut is None or cut >= 3


class TestVerifyingFix:
    def _future(self):
        return track(5)  # 6-hourly from 2026-09-01 00Z

    def test_picks_the_nearest_fix_in_time(self):
        future = self._future()
        target = datetime(2026, 9, 1, 12, 20)

        assert verifying_fix(future, target).timestamp == datetime(2026, 9, 1, 12)

    def test_refuses_a_fix_outside_the_tolerance(self):
        """Scoring +24h against a fix eight hours away would be a fabricated
        verification, so no fix is better than a distant one."""
        future = self._future()
        target = future[-1].timestamp + timedelta(hours=VERIFY_TOLERANCE_HOURS + 1)

        assert verifying_fix(future, target) is None

    def test_accepts_a_fix_just_inside_the_tolerance(self):
        future = self._future()
        target = future[2].timestamp + timedelta(
            hours=VERIFY_TOLERANCE_HOURS - 0.1
        )

        assert verifying_fix(future, target) is future[2]

    def test_no_future_fixes_means_no_verification(self):
        assert verifying_fix([], datetime(2026, 9, 1)) is None


class TestBaselines:
    """The two references that make a position error readable.

    Without them a "58 km mean error" reads as good or bad depending on nothing,
    and a model that has learned only to continue the last heading looks skilful.
    """

    def test_persistence_is_the_current_position(self):
        fixes = track(4)
        persistence, _ = baselines(fixes, hours=24.0)

        assert persistence == (fixes[-1].latitude, fixes[-1].longitude)

    def test_persistence_does_not_depend_on_the_horizon(self):
        fixes = track(4)

        assert baselines(fixes, 6.0)[0] == baselines(fixes, 48.0)[0]

    def test_linear_continues_the_last_observed_motion(self):
        # track() steps +0.5 lat and -0.5 lon every 6 h.
        fixes = track(4)
        _, linear = baselines(fixes, hours=12.0)

        assert linear[0] == pytest.approx(fixes[-1].latitude + 1.0)
        assert linear[1] == pytest.approx(fixes[-1].longitude - 1.0)

    def test_linear_uses_only_the_last_leg_not_the_whole_track(self):
        """A track that turns must not have the turn averaged away."""
        fixes = track(3)
        turned = fixes[:-1] + [
            AtcfFix(
                timestamp=fixes[-1].timestamp,
                latitude=fixes[-2].latitude - 1.0,  # reversed direction
                longitude=fixes[-2].longitude,
                wind_speed_kph=100.0,
                pressure_hpa=980.0,
            )
        ]
        _, linear = baselines(turned, hours=6.0)

        assert linear[0] == pytest.approx(turned[-1].latitude - 1.0)

    def test_a_single_fix_has_no_linear_baseline(self):
        persistence, linear = baselines(track(1), hours=6.0)

        assert linear is None
        assert persistence == (20.0, -80.0)

    def test_duplicate_timestamps_do_not_divide_by_zero(self):
        fixes = track(2)
        stalled = [fixes[0], AtcfFix(
            timestamp=fixes[0].timestamp,
            latitude=fixes[1].latitude,
            longitude=fixes[1].longitude,
            wind_speed_kph=100.0,
            pressure_hpa=980.0,
        )]

        assert baselines(stalled, hours=6.0)[1] is None
