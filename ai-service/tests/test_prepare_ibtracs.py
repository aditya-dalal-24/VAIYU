"""Tests for the IBTrACS -> observation table adapter.

This adapter shipped without tests, and a leak got through: IBTrACS's
three-hourly interpolated rows went into training, each carrying information
from the fix after it. The tests below pin that and the adapter's other silent
failure modes -- the "NA" basin code, the averaging-period trap in WMO_WIND --
so none can come back unnoticed.
"""

from __future__ import annotations

import pandas as pd
import pytest

from training.prepare_ibtracs import KNOTS_TO_KPH, convert

HEADER = "SID,SEASON,BASIN,SUBBASIN,NAME,ISO_TIME,NATURE,LAT,LON,WMO_PRES,USA_WIND,USA_PRES"
UNITS = ",year,,,,,,degrees_north,degrees_east,mb,kts,mb"


def row(sid="2020001N10100", basin="WP", time="2020-01-01 00:00:00", nature="TS",
        lat=10.0, lon=130.0, wmo_pres="", usa_wind=50, usa_pres=990):
    return (f"{sid},2020,{basin},MM,TEST,{time},{nature},{lat},{lon},"
            f"{wmo_pres},{usa_wind},{usa_pres}")


def write(tmp_path, *rows):
    path = tmp_path / "ibtracs.csv"
    path.write_text("\n".join([HEADER, UNITS, *rows]) + "\n", encoding="utf-8")
    return str(path)


def every_three_hours(**overrides):
    """One day of a track as IBTrACS publishes it: 3-hourly, half interpolated."""
    return [
        row(time=f"2020-01-01 {hour:02d}:00:00", lat=10.0 + hour * 0.1, **overrides)
        for hour in range(0, 24, 3)
    ]


class TestSynopticFilter:
    """The leakage guard.

    A 03Z row is interpolated between the 00Z and 06Z fixes, so as an input at
    03Z it carries three hours of the future. Only 00/06/12/18Z may be kept.
    """

    def test_only_synoptic_hours_survive(self, tmp_path):
        table = convert(write(tmp_path, *every_three_hours()))

        assert sorted(table["timestamp"].dt.hour.unique()) == [0, 6, 12, 18]
        assert len(table) == 4

    def test_an_interpolated_position_never_reaches_the_table(self, tmp_path):
        # The 03Z row's latitude (10.3) is an interpolation; it must not appear.
        table = convert(write(tmp_path, *every_three_hours()))
        assert 10.3 not in table["latitude"].round(3).tolist()

    def test_off_hour_agency_fixes_are_dropped_too(self, tmp_path):
        """Occasional landfall-time rows (e.g. 04:30) would give an irregular
        spacing the live feeds never produce; the filter is strictly synoptic."""
        rows = every_three_hours() + [row(time="2020-01-01 04:30:00", lat=10.45)]
        table = convert(write(tmp_path, *rows))

        assert (table["timestamp"].dt.minute == 0).all()
        assert 10.45 not in table["latitude"].tolist()

    def test_matches_the_hours_the_live_adapter_uses(self):
        """Training and serving must agree on what counts as a fix."""
        from preprocessing.ibtracs_live import SYNOPTIC_HOURS

        assert tuple(SYNOPTIC_HOURS) == (0, 6, 12, 18)


class TestOtherSilentFailures:
    def test_north_atlantic_basin_code_is_not_read_as_missing(self, tmp_path):
        table = convert(write(tmp_path, *every_three_hours(basin="NA")))

        assert len(table) == 4
        assert (table["basin"] == "NA").all()

    def test_wind_comes_from_usa_wind(self, tmp_path):
        table = convert(write(tmp_path, *every_three_hours(usa_wind=50)))
        assert table["wind_speed_kph"].iloc[0] == pytest.approx(50 * KNOTS_TO_KPH)

    def test_wmo_pressure_fills_a_missing_usa_pressure(self, tmp_path):
        table = convert(
            write(tmp_path, row(usa_pres="", wmo_pres=995))
        )
        assert table["pressure_hpa"].iloc[0] == 995

    def test_a_fix_without_wind_is_dropped_not_defaulted(self, tmp_path):
        table = convert(write(tmp_path, row(usa_wind="")))
        assert table.empty

    def test_non_tropical_stages_are_excluded(self, tmp_path):
        for nature in ("ET", "DS", "SS", "MX"):
            assert convert(write(tmp_path, row(nature=nature))).empty, nature

    def test_output_is_ordered_by_storm_then_time(self, tmp_path):
        rows = list(reversed(every_three_hours()))
        table = convert(write(tmp_path, *rows))

        assert table["timestamp"].is_monotonic_increasing

    def test_longitude_is_normalised(self, tmp_path):
        table = convert(write(tmp_path, row(lon=200.0)))
        assert table["longitude"].iloc[0] == pytest.approx(-160.0)

    def test_output_has_the_dataset_contract_columns(self, tmp_path):
        from preprocessing.dataset import REQUIRED_COLUMNS

        table = convert(write(tmp_path, *every_three_hours()))
        assert set(REQUIRED_COLUMNS) <= set(table.columns)
        assert pd.api.types.is_datetime64_any_dtype(table["timestamp"])
