"""Tests for the IBTrACS active-storm source.

The filters here are not cosmetic. Dropping off-synoptic rows prevents three
hours of future data entering every sample, and the nature filter decides
whether a request is in-distribution at all. Both are asserted directly.
"""

from __future__ import annotations

from datetime import datetime

import pytest

from preprocessing.atcf import KNOTS_TO_KPH, AtcfError
from preprocessing.ibtracs_live import (
    SYNOPTIC_HOURS,
    basin_counts,
    find_storm,
    parse_active,
)

HEADER = "SID,SEASON,BASIN,SUBBASIN,NAME,ISO_TIME,NATURE,LAT,LON,USA_WIND,USA_PRES"
UNITS = ",year,,,,,,degrees_north,degrees_east,kts,mb"


def row(
    sid="2026244N23132",
    basin="WP",
    name="KROVANH",
    time="2026-09-01 00:00:00",
    nature="TS",
    lat=23.1,
    lon=132.0,
    wind=55,
    pres=985,
    season=2026,
):
    return (
        f"{sid},{season},{basin},,{name},{time},{nature},{lat},{lon},{wind},{pres}"
    )


def csv(*rows):
    return "\n".join([HEADER, UNITS, *rows]) + "\n"


def synoptic_track(sid="2026244N23132", basin="WP", name="KROVANH", nature="TS"):
    """Four fixes at 00/06/12/18Z -- all reported, none interpolated."""
    return [
        row(sid=sid, basin=basin, name=name, nature=nature,
            time=f"2026-09-01 {hour:02d}:00:00", lat=23.0 + index * 0.5,
            lon=132.0 - index * 0.4, wind=55 + index * 5, pres=985 - index * 3)
        for index, hour in enumerate((0, 6, 12, 18))
    ]


class TestSynopticFilter:
    """The leakage guard.

    IBTrACS resamples to three-hourly, but only 00/06/12/18Z are reported
    fixes; a 03Z row is interpolated between the 00Z and 06Z fixes and so
    carries information from 06Z. Using it as an observation at 03Z would leak
    three hours of the future into the sample.
    """

    def test_off_synoptic_rows_are_dropped(self):
        rows = synoptic_track() + [
            row(time="2026-09-01 03:00:00", lat=23.25),
            row(time="2026-09-01 09:00:00", lat=23.75),
            row(time="2026-09-01 21:00:00", lat=24.75),
        ]
        storms = parse_active(csv(*rows))

        assert len(storms) == 1
        hours = {fix.timestamp.hour for fix in storms[0].fixes}
        assert hours <= set(SYNOPTIC_HOURS)
        assert len(storms[0].fixes) == 4

    def test_an_interpolated_position_never_reaches_a_fix(self):
        """The interpolated 03Z latitude must not appear anywhere."""
        interpolated_latitude = 23.25
        rows = synoptic_track() + [
            row(time="2026-09-01 03:00:00", lat=interpolated_latitude)
        ]
        fixes = parse_active(csv(*rows))[0].fixes

        assert all(fix.latitude != interpolated_latitude for fix in fixes)

    def test_a_track_of_only_interpolated_rows_yields_nothing(self):
        rows = [
            row(time=f"2026-09-01 {hour:02d}:00:00") for hour in (3, 9, 15, 21)
        ]
        assert parse_active(csv(*rows)) == []


class TestNatureFilter:
    def test_tropical_rows_are_kept(self):
        assert len(parse_active(csv(*synoptic_track(nature="TS")))) == 1

    def test_uncoded_rows_are_kept(self):
        """NR means the nature was not coded, which is common on provisional
        tracks and is not evidence against a storm being tropical."""
        assert len(parse_active(csv(*synoptic_track(nature="NR")))) == 1

    def test_extratropical_and_disturbance_rows_are_excluded(self):
        for nature in ("ET", "DS", "SS", "MX"):
            assert parse_active(csv(*synoptic_track(nature=nature))) == [], nature


class TestColumnHandling:
    def test_north_atlantic_basin_code_survives_csv_parsing(self):
        """The Atlantic basin code is literally the string "NA", which pandas
        turns into a missing value unless told otherwise."""
        storms = parse_active(csv(*synoptic_track(basin="NA", name="EDOUARD")))

        assert len(storms) == 1
        assert storms[0].basin == "NA"
        assert storms[0].basin_name == "North Atlantic"

    def test_wind_comes_from_usa_wind_and_is_converted(self):
        storms = parse_active(csv(*synoptic_track()))
        assert storms[0].fixes[0].wind_speed_kph == pytest.approx(55 * KNOTS_TO_KPH)

    def test_rows_without_wind_or_pressure_are_dropped_not_defaulted(self):
        rows = synoptic_track() + [
            row(time="2026-09-02 00:00:00", wind="", pres=980),
            row(time="2026-09-02 06:00:00", wind=60, pres=""),
            row(time="2026-09-02 12:00:00", wind=60, pres=0),
        ]
        assert len(parse_active(csv(*rows))[0].fixes) == 4

    def test_fixes_are_ordered_oldest_first(self):
        rows = list(reversed(synoptic_track()))
        fixes = parse_active(csv(*rows))[0].fixes

        assert [f.timestamp for f in fixes] == sorted(f.timestamp for f in fixes)
        assert fixes[0].timestamp == datetime(2026, 9, 1, 0)


class TestStormGrouping:
    def test_storms_are_separated_by_sid(self):
        rows = synoptic_track(sid="A", name="ALPHA") + synoptic_track(
            sid="B", name="BETA", basin="NI"
        )
        storms = parse_active(csv(*rows))

        assert {s.storm_id for s in storms} == {"A", "B"}
        assert basin_counts(storms) == {"WP": 1, "NI": 1}

    def test_storms_with_too_few_fixes_are_dropped(self):
        """Fewer than three fixes cannot build a request, so surfacing such a
        storm would only produce a failure later."""
        rows = synoptic_track(sid="A", name="ALPHA") + [
            row(sid="B", name="BETA", time="2026-09-01 00:00:00"),
            row(sid="B", name="BETA", time="2026-09-01 06:00:00"),
        ]
        storms = parse_active(csv(*rows))

        assert [s.storm_id for s in storms] == ["A"]

    def test_basin_filter_selects_only_requested_basins(self):
        rows = synoptic_track(sid="A", name="ALPHA", basin="WP") + synoptic_track(
            sid="B", name="BETA", basin="NI"
        )

        storms = parse_active(csv(*rows), basins=["NI"])
        assert [s.storm_id for s in storms] == ["B"]

    def test_basin_filter_is_case_insensitive(self):
        rows = synoptic_track(basin="NI")
        assert len(parse_active(csv(*rows), basins=["ni"])) == 1

    def test_summary_reports_the_span(self):
        summary = parse_active(csv(*synoptic_track()))[0].summary()

        assert "KROVANH" in summary
        assert "West Pacific" in summary
        assert "4 fixes" in summary


class TestFindStorm:
    def _stub(self, monkeypatch, text):
        from preprocessing import ibtracs_live

        monkeypatch.setattr(
            ibtracs_live,
            "fetch_active_storms",
            lambda basins=None, url=None: parse_active(text, basins=basins),
        )

    def test_matches_by_name_case_insensitively(self, monkeypatch):
        self._stub(monkeypatch, csv(*synoptic_track()))
        assert find_storm("krovanh").storm_id == "2026244N23132"

    def test_matches_by_sid(self, monkeypatch):
        self._stub(monkeypatch, csv(*synoptic_track()))
        assert find_storm("2026244N23132").name == "KROVANH"

    def test_unknown_storm_lists_what_is_available(self, monkeypatch):
        self._stub(monkeypatch, csv(*synoptic_track()))

        with pytest.raises(AtcfError, match="KROVANH"):
            find_storm("NOSUCHSTORM")

    def test_an_empty_list_is_reported_clearly(self, monkeypatch):
        self._stub(monkeypatch, csv())

        with pytest.raises(AtcfError, match="no usable storms"):
            find_storm("KROVANH")
