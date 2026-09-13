"""Tests for the sea-surface-temperature join.

Two things here would be wrong in a way nothing downstream could detect: a grid
index that is off by a cell, which silently reads the temperature of the wrong
patch of ocean, and a land cell that becomes a number instead of an absence.
"""

from __future__ import annotations

import numpy as np

from training.prepare_sst import (
    LATITUDE_CELLS,
    LONGITUDE_CELLS,
    VALID_MAX_C,
    VALID_MIN_C,
    cell_of,
    sample,
)


def ocean(value: float = 28.0) -> np.ndarray:
    """A grid that is entirely ocean at one temperature."""
    return np.full((LATITUDE_CELLS, LONGITUDE_CELLS), value, dtype=float)


class TestGridIndexing:
    def test_the_equator_and_prime_meridian_land_on_their_own_cell(self):
        assert cell_of(0.0, 0.0) == (44, 0)

    def test_a_known_position_maps_to_the_expected_cell(self):
        # The grid starts at -88 and steps 2 degrees: 16N is (16+88)/2 = 52.
        # 90E is 90/2 = 45.
        assert cell_of(16.0, 90.0) == (52, 45)

    def test_western_longitudes_wrap_onto_the_zero_to_360_grid(self):
        # 60W is 300E.
        assert cell_of(25.0, -60.0) == cell_of(25.0, 300.0)

    def test_the_antimeridian_is_not_a_discontinuity(self):
        # 179E and 181E are the same meridian; so are -179 and 181.
        assert cell_of(15.0, -179.0) == cell_of(15.0, 181.0)

    def test_indices_stay_inside_the_grid_at_the_poles(self):
        for latitude in (-90.0, 90.0, -88.0, 88.0):
            lat_index, lon_index = cell_of(latitude, 10.0)
            assert 0 <= lat_index < LATITUDE_CELLS
            assert 0 <= lon_index < LONGITUDE_CELLS

    def test_every_longitude_stays_inside_the_grid(self):
        for longitude in (-360.0, -180.0, -0.5, 0.0, 179.9, 358.0, 360.0, 720.0):
            _, lon_index = cell_of(0.0, longitude)
            assert 0 <= lon_index < LONGITUDE_CELLS


class TestSampling:
    def test_an_ocean_cell_is_read_as_is(self):
        value, substituted = sample(ocean(29.4), 15.0, 90.0)

        assert value == 29.4
        assert substituted is False

    def test_a_land_cell_borrows_the_nearest_ocean_and_says_so(self):
        grid = ocean(27.0)
        lat_index, lon_index = cell_of(21.0, 89.0)
        grid[lat_index, lon_index] = np.nan

        value, substituted = sample(grid, 21.0, 89.0)

        # A real reading from about 220 km away, reported as a substitution
        # rather than presented as the value at the fix.
        assert value == 27.0
        assert substituted is True

    def test_an_inland_position_has_no_temperature_at_all(self):
        grid = np.full((LATITUDE_CELLS, LONGITUDE_CELLS), np.nan)

        value, substituted = sample(grid, 23.0, 79.0)

        # Rather than reaching further for something plausible: the models read
        # this absence through a presence flag.
        assert value is None
        assert substituted is False

    def test_the_neighbourhood_mean_ignores_the_gaps(self):
        grid = np.full((LATITUDE_CELLS, LONGITUDE_CELLS), np.nan)
        lat_index, lon_index = cell_of(10.0, 60.0)
        grid[lat_index + 1, lon_index] = 26.0
        grid[lat_index, lon_index + 1] = 28.0

        value, substituted = sample(grid, 10.0, 60.0)

        assert value == 27.0
        assert substituted is True

    def test_the_products_validity_range_is_the_one_it_states(self):
        # Guards the constants the reader uses to reject fill values: ERSST
        # declares -3 to 45 degrees, and a sentinel like -9999 must never be
        # read as a temperature.
        assert VALID_MIN_C == -3.0
        assert VALID_MAX_C == 45.0


class TestRoundTrip:
    """The join rewrites the observation table, so it must not damage it."""

    def test_the_north_atlantic_basin_code_survives(self, tmp_path, monkeypatch):
        import pandas as pd

        import training.prepare_sst as prepare_sst

        table = tmp_path / "observations.csv"
        table.write_text(
            "cyclone_id,timestamp,latitude,longitude,wind_speed_kph,pressure_hpa,"
            "season,basin,sub_basin,storm_name\n"
            "1984258N20264,1984-09-15 00:00:00,20.0,-95.0,65.0,,1984,NA,GM,EDOUARD\n"
            "2023129N08091,2023-05-12 00:00:00,12.0,88.0,120.0,980,2023,NI,BB,MOCHA\n",
            encoding="utf-8",
        )
        # No network in tests: every month resolves to an all-ocean grid.
        monkeypatch.setattr(prepare_sst, "download_month", lambda y, m, d: "stub")
        monkeypatch.setattr(prepare_sst, "read_month", lambda path: ocean(27.5))

        frame = prepare_sst.join(str(table), str(tmp_path))
        frame.to_csv(table, index=False)
        written = pd.read_csv(table, dtype=str, keep_default_na=False)

        assert written["basin"].tolist() == ["NA", "NI"]
        assert written["sub_basin"].tolist() == ["GM", "BB"]
        # An absent pressure stays absent rather than becoming a string or zero.
        assert written["pressure_hpa"].tolist()[0] == ""
        assert written["sea_surface_temperature_c"].tolist() == ["27.5", "27.5"]
