"""ATCF parsing and live-check safety tests.

The parser handles a format with two traps that would corrupt features silently:
each fix repeats once per wind-radii threshold, and a missing pressure is
encoded as 0 rather than blank. Both are covered here.

The overlap check is covered too, because it is the guard against the mistake
that prompted it: scoring the model on a storm it had trained on, which
produced excellent and meaningless numbers.
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd
import pytest

from preprocessing.atcf import (
    KNOTS_TO_KPH,
    AtcfError,
    build_request,
    parse_deck,
    training_overlap,
)

# Two synoptic times, each repeated at the 34 kt and 50 kt radii thresholds,
# exactly as the operational files publish them.
DECK = """\
EP, 12, 2026090906,   , BEST,   0, 269N, 1611W,  55,  981, TS,  34, NEQ,  200,  120,   90,  160, 1007,  230,
EP, 12, 2026090906,   , BEST,   0, 269N, 1611W,  55,  981, TS,  50, NEQ,   80,   80,   50,   60, 1007,  230,
EP, 12, 2026090912,   , BEST,   0, 277N, 1617W,  50,  985, TS,  34, NEQ,  220,  140,  110,  180, 1007,  230,
EP, 12, 2026090912,   , BEST,   0, 277N, 1617W,  50,  985, TS,  50, NEQ,   70,   70,   40,   60, 1007,  230,
"""


class TestParseDeck:
    def test_repeated_radii_rows_collapse_to_one_fix(self):
        """Four rows, two synoptic times, two fixes.

        Counting them separately would double the apparent track density and
        make every delta_hours and rate feature wrong.
        """
        fixes = parse_deck(DECK)

        assert len(fixes) == 2
        assert fixes[0].timestamp == datetime(2026, 9, 9, 6)
        assert fixes[1].timestamp == datetime(2026, 9, 9, 12)

    def test_coordinates_decode_with_hemisphere(self):
        fixes = parse_deck(DECK)

        assert fixes[0].latitude == pytest.approx(26.9)
        assert fixes[0].longitude == pytest.approx(-161.1)  # W is negative

    def test_southern_and_eastern_hemispheres(self):
        deck = "SH, 01, 2026010100,   , BEST,   0, 155S,  875E,  60,  975, TS,  34, NEQ,\n"
        fix = parse_deck(deck)[0]

        assert fix.latitude == pytest.approx(-15.5)
        assert fix.longitude == pytest.approx(87.5)

    def test_wind_is_converted_to_contract_units(self):
        fixes = parse_deck(DECK)
        assert fixes[0].wind_speed_kph == pytest.approx(55 * KNOTS_TO_KPH)

    def test_missing_pressure_is_dropped_not_defaulted(self):
        """ATCF writes 0 for an absent pressure; an invented value would be
        indistinguishable from a measured one downstream."""
        deck = DECK + (
            "EP, 12, 2026090918,   , BEST,   0, 287N, 1630W,  50,    0, TS,  34, NEQ,\n"
        )
        fixes = parse_deck(deck)

        assert len(fixes) == 2
        assert all(fix.pressure_hpa > 0 for fix in fixes)

    def test_forecast_aid_rows_are_ignored(self):
        deck = DECK + (
            "EP, 12, 2026090918,  03, OFCL,  24, 300N, 1700W,  60,  975, TS,  34, NEQ,\n"
        )
        assert len(parse_deck(deck)) == 2

    def test_fixes_come_back_oldest_first(self):
        reversed_deck = "\n".join(reversed(DECK.strip().splitlines()))
        fixes = parse_deck(reversed_deck)

        assert [f.timestamp for f in fixes] == sorted(f.timestamp for f in fixes)

    def test_empty_or_garbage_yields_nothing(self):
        assert parse_deck("") == []
        assert parse_deck("not,a,deck\n") == []


class TestBuildRequest:
    def _fixes(self, count=6):
        rows = []
        for index in range(count):
            hour = 6 * index
            rows.append(
                f"EP, 12, 202609{9 + hour // 24:02d}{hour % 24:02d},   , BEST,   0, "
                f"{260 + index * 8}N, {1600 + index * 6}W,  55,  {981 + index}, TS,  34, NEQ,"
            )
        return parse_deck("\n".join(rows))

    def test_current_observation_is_the_latest_fix(self):
        fixes = self._fixes()
        body = build_request(fixes, "r", "c")

        assert body["currentObservation"]["timestamp"].startswith(
            fixes[-1].timestamp.strftime("%Y-%m-%dT%H")
        )
        assert len(body["observationHistory"]) == len(fixes) - 1

    def test_history_is_oldest_to_newest(self):
        body = build_request(self._fixes(), "r", "c")
        stamps = [item["timestamp"] for item in body["observationHistory"]]

        assert stamps == sorted(stamps)

    def test_truncation_withholds_later_fixes(self):
        """The mechanism that makes a live check a test.

        Fixes at and beyond the cut must not appear anywhere in the request.
        """
        fixes = self._fixes()
        body = build_request(fixes, "r", "c", up_to_index=4)

        included = {body["currentObservation"]["timestamp"]} | {
            item["timestamp"] for item in body["observationHistory"]
        }
        for withheld in fixes[4:]:
            assert withheld.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ") not in included

    def test_too_few_fixes_raises(self):
        with pytest.raises(AtcfError, match="three fixes"):
            build_request(self._fixes(6), "r", "c", up_to_index=2)


class TestTrainingOverlap:
    def _archive(self, tmp_path, latitude=26.9, longitude=-161.1):
        frame = pd.DataFrame(
            [
                {
                    "cyclone_id": "2026238N10223",
                    "timestamp": datetime(2026, 9, 9, 6),
                    "latitude": latitude,
                    "longitude": longitude,
                    "wind_speed_kph": 100.0,
                    "pressure_hpa": 980.0,
                }
            ]
        )
        path = tmp_path / "observations.csv"
        frame.to_csv(path, index=False)
        return str(path)

    def test_detects_a_storm_present_in_the_archive(self, tmp_path):
        result = training_overlap(parse_deck(DECK), self._archive(tmp_path))

        assert result["checked"] is True
        assert result["overlaps"] is True
        assert "2026238N10223" in result["archive_storm_ids"]

    def test_clears_a_storm_far_from_anything_archived(self, tmp_path):
        # Same times, opposite side of the world.
        archive = self._archive(tmp_path, latitude=-30.0, longitude=100.0)
        result = training_overlap(parse_deck(DECK), archive)

        assert result["overlaps"] is False

    def test_clears_a_storm_outside_the_time_window(self, tmp_path):
        frame = pd.DataFrame(
            [
                {
                    "cyclone_id": "old-storm",
                    "timestamp": datetime(2020, 9, 9, 6),
                    "latitude": 26.9,
                    "longitude": -161.1,
                    "wind_speed_kph": 100.0,
                    "pressure_hpa": 980.0,
                }
            ]
        )
        path = tmp_path / "observations.csv"
        frame.to_csv(path, index=False)

        assert training_overlap(parse_deck(DECK), str(path))["overlaps"] is False

    def test_missing_archive_is_reported_not_raised(self, tmp_path):
        result = training_overlap(parse_deck(DECK), str(tmp_path / "absent.csv"))

        assert result["checked"] is False
        assert "reason" in result
