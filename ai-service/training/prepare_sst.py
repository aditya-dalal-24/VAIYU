"""Join sea-surface temperature onto the observation table.

The models have always accepted environmental context -- the contract defines
it, the feature builder pairs every environmental value with a presence flag --
but nothing supplied any, so they ran on track history alone and every
environmental feature was a constant absent marker. This fills in the one field
that most plausibly carries information about intensity: the temperature of the
water the storm is over.

**Source: NOAA ERSST v5**, monthly mean SST on a 2-degree grid, 1854 to
present, one small file per month from NCEI. Nothing here needs an account or
an API key.

Why this product, and what it cannot do
---------------------------------------
The obvious alternative, OISST v2.1, is daily and 0.25 degrees -- far better
suited to a cyclone -- but it is 1.5 MB per day, so covering this archive means
about 21 GB and several hours of downloading. ERSST is 168 KB per month and
covers the whole record in under 100 MB.

The cost is resolution, and it is worth stating plainly rather than burying:

* A **monthly mean** cannot see a storm's cold wake, which is the mechanism by
  which a slow-moving cyclone starves itself. A fix on the 20th gets the same
  value as one on the 3rd.
* A **2-degree cell** is roughly 220 km across, wider than most storms' eyewall
  region, so it describes the water mass a storm is crossing rather than the
  water under its core.

So this is the broad thermal environment: enough to tell the Bay of Bengal in
May from the north Atlantic in November, not enough to explain why one storm
intensified and its neighbour did not. Whether the models make anything of it
is measured after retraining, not assumed here.

Land, ice and missing cells
---------------------------
ERSST leaves land as a missing value. A storm centre near a coast can therefore
land on a cell with no value at all. Rather than fill that with something
plausible, the nearest valid ocean cell within one grid step is used and the
substitution is counted in the run's log; beyond that the fix is left with no
SST, which the presence flag then reports honestly to the model.

Run from the ai-service directory, after prepare_ibtracs.py:

    .venv/Scripts/python training/prepare_sst.py \\
        --observations data/processed/observations.csv
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import urllib.error
import urllib.request
from typing import Dict, Optional, Tuple

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logger = logging.getLogger(__name__)

ERSST_URL = (
    "https://www.ncei.noaa.gov/pub/data/cmb/ersst/v5/netcdf/ersst.v5.{year}{month:02d}.nc"
)
DEFAULT_CACHE = "data/raw/ersst"

SST_COLUMN = "sea_surface_temperature_c"

# The grid: 2-degree cells, latitudes -88..88, longitudes 0..358.
GRID_STEP_DEGREES = 2.0
FIRST_LATITUDE = -88.0
LATITUDE_CELLS = 89
LONGITUDE_CELLS = 180

# How far to look for a valid ocean cell when the fix lands on land or ice.
# One cell: a real reading about 220 km away, which is a substitution worth
# counting, not an interpolation of thin air.
NEIGHBOUR_SEARCH_CELLS = 1

# ERSST's own stated validity range; anything outside it is a fill value that
# must not reach the model as a temperature.
VALID_MIN_C = -3.0
VALID_MAX_C = 45.0


def download_month(year: int, month: int, cache_dir: str) -> Optional[str]:
    """Fetch one month's file, or return None if it cannot be had.

    Cached by filename: re-running after adding a season downloads only the
    new months.
    """
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, f"ersst.v5.{year}{month:02d}.nc")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path

    url = ERSST_URL.format(year=year, month=month)
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "vaiyu-prepare-sst"})
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read()
    except (urllib.error.URLError, TimeoutError) as error:
        logger.warning("could not fetch %s-%02d: %s", year, month, error)
        return None

    with open(path, "wb") as handle:
        handle.write(payload)
    return path


def read_month(path: str) -> Optional[np.ndarray]:
    """Return one month's SST as a [lat, lon] array, with gaps as NaN."""
    try:
        import xarray as xr
    except ImportError as error:  # pragma: no cover - dependency is declared
        raise SystemExit(
            "xarray is required to read ERSST files: pip install -r requirements.txt"
        ) from error

    try:
        with xr.open_dataset(path) as dataset:
            grid = np.asarray(dataset["sst"].squeeze().values, dtype=float)
    except Exception as error:  # noqa: BLE001 - a corrupt cache file
        logger.warning("could not read %s: %s", path, error)
        return None

    if grid.shape != (LATITUDE_CELLS, LONGITUDE_CELLS):
        logger.warning("unexpected grid shape %s in %s", grid.shape, path)
        return None

    # Fill values and anything outside ERSST's stated range become NaN, so a
    # sentinel can never be read as a temperature.
    grid[(grid < VALID_MIN_C) | (grid > VALID_MAX_C)] = np.nan
    return grid


def cell_of(latitude: float, longitude: float) -> Tuple[int, int]:
    """The grid cell containing a position."""
    lat_index = int(round((latitude - FIRST_LATITUDE) / GRID_STEP_DEGREES))
    lon_index = int(round((longitude % 360.0) / GRID_STEP_DEGREES)) % LONGITUDE_CELLS
    return max(0, min(LATITUDE_CELLS - 1, lat_index)), lon_index


def sample(grid: np.ndarray, latitude: float, longitude: float) -> Tuple[Optional[float], bool]:
    """SST at a position, and whether a neighbouring cell had to be used."""
    lat_index, lon_index = cell_of(latitude, longitude)
    value = grid[lat_index, lon_index]
    if np.isfinite(value):
        return float(value), False

    # On land or ice: take the mean of the valid cells immediately around it.
    neighbours = []
    for d_lat in range(-NEIGHBOUR_SEARCH_CELLS, NEIGHBOUR_SEARCH_CELLS + 1):
        for d_lon in range(-NEIGHBOUR_SEARCH_CELLS, NEIGHBOUR_SEARCH_CELLS + 1):
            lat_neighbour = lat_index + d_lat
            if not 0 <= lat_neighbour < LATITUDE_CELLS:
                continue
            lon_neighbour = (lon_index + d_lon) % LONGITUDE_CELLS
            candidate = grid[lat_neighbour, lon_neighbour]
            if np.isfinite(candidate):
                neighbours.append(float(candidate))

    if not neighbours:
        return None, False
    return float(np.mean(neighbours)), True


def join(observations_path: str, cache_dir: str) -> pd.DataFrame:
    """Add an SST column to the observation table."""
    # keep_default_na=False, and only an empty cell counts as missing. The
    # North Atlantic's basin code is the literal string "NA", which pandas
    # otherwise reads as a missing value and writes back as an empty cell --
    # this join once erased the basin of 15,656 North Atlantic fixes that way,
    # and the database refused the result. prepare_ibtracs.py guards the same
    # trap for the same reason.
    frame = pd.read_csv(observations_path, keep_default_na=False, na_values=[""],
                        low_memory=False)
    if "timestamp" not in frame.columns:
        raise SystemExit(f"{observations_path} has no timestamp column")

    stamps = pd.to_datetime(frame["timestamp"], errors="coerce")
    frame["_year"] = stamps.dt.year
    frame["_month"] = stamps.dt.month

    months = sorted({(int(y), int(m)) for y, m in zip(frame["_year"], frame["_month"])
                     if pd.notna(y) and pd.notna(m)})
    logger.info("%d observations span %d months", len(frame), len(months))

    values = np.full(len(frame), np.nan)
    substituted = 0
    missing_months = 0

    for index, (year, month) in enumerate(months, start=1):
        path = download_month(year, month, cache_dir)
        grid = read_month(path) if path else None
        if grid is None:
            missing_months += 1
            continue

        rows = np.flatnonzero((frame["_year"] == year) & (frame["_month"] == month))
        for row in rows:
            value, used_neighbour = sample(
                grid,
                float(frame.iat[row, frame.columns.get_loc("latitude")]),
                float(frame.iat[row, frame.columns.get_loc("longitude")]),
            )
            if value is not None:
                values[row] = round(value, 2)
                substituted += int(used_neighbour)

        if index % 60 == 0 or index == len(months):
            logger.info("  %d/%d months joined", index, len(months))

    frame[SST_COLUMN] = values
    frame = frame.drop(columns=["_year", "_month"])

    present = int(np.isfinite(values).sum())
    logger.info(
        "SST present on %d of %d fixes (%.1f%%); %d used a neighbouring ocean cell; "
        "%d months unavailable",
        present,
        len(frame),
        100.0 * present / max(len(frame), 1),
        substituted,
        missing_months,
    )
    return frame


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--observations",
        default="data/processed/observations.csv",
        help="observation table to add the column to",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="where to write; defaults to updating the input in place",
    )
    parser.add_argument("--cache-dir", default=DEFAULT_CACHE, help="where ERSST files are kept")
    args = parser.parse_args()

    frame = join(args.observations, args.cache_dir)
    output = args.output or args.observations
    frame.to_csv(output, index=False)
    logger.info("wrote %s with %s", output, SST_COLUMN)


if __name__ == "__main__":
    main()
