"""Convert an IBTrACS export into the observation table the pipeline expects.

IBTrACS is the standard best-track archive, so this is the adapter most users
will need first. It is a data-preparation utility, not part of the model: the
training pipelines read the table this writes, and know nothing about IBTrACS.

Two decisions here matter enough to state plainly, because both are silent
sources of a model that looks fine and is wrong.

**Wind comes from ``USA_WIND`` alone.** IBTrACS pools agencies that report
different averaging periods -- 1-minute for the US agencies, 3-minute for IMD,
10-minute for others -- so ``WMO_WIND`` mixes three definitions of the same
quantity. Training across that bakes in a systematic bias that never shows up
as an error. Pressure is a central minimum rather than an average, so
``WMO_PRES`` is a safe fallback where ``USA_PRES`` is missing.

**Only tropical (``NATURE == TS``) fixes are kept.** Extratropical, subtropical
and disturbance stages are a different physical regime, and would teach the
model motion it will never be asked to forecast.

**Only synoptic fixes (00/06/12/18Z) are kept.** IBTrACS resamples every track
to three-hourly, but the 03/09/15/21Z rows are interpolations *between* reported
fixes -- a 03Z row is computed from the 06Z fix. A sample whose forecast time is
03Z therefore carries three hours of the future in its own input, which section
8 forbids. The effect is not cosmetic: kept in, those rows made 42% of the table,
and they flattered the held-out comparison against linear extrapolation by
roughly a factor of two, because extrapolating a short interpolated leg is a
handicapped baseline. Operational feeds (ATCF, the IBTrACS active list after
`preprocessing/ibtracs_live.py`) deliver 6-hourly fixes, so this also makes
training match what the service is actually sent.

Run from the ai-service directory:

    .venv/Scripts/python training/prepare_ibtracs.py \\
        --input data/raw/ibtracs.since1980.csv \\
        --output data/processed/observations.csv
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from preprocessing.features import normalise_longitude  # noqa: E402
from preprocessing.ibtracs_live import SYNOPTIC_HOURS  # noqa: E402

logger = logging.getLogger(__name__)

KNOTS_TO_KPH = 1.852

# IBTrACS marks the tropical-cyclone stage as TS.
TROPICAL_NATURE = "TS"

SOURCE_COLUMNS = [
    "SID", "SEASON", "BASIN", "SUBBASIN", "NAME", "ISO_TIME", "NATURE",
    "LAT", "LON", "WMO_PRES", "USA_WIND", "USA_PRES",
]

NUMERIC_COLUMNS = ["LAT", "LON", "WMO_PRES", "USA_WIND", "USA_PRES"]


def convert(input_path: str, basins=None) -> pd.DataFrame:
    """Read an IBTrACS CSV and return the pipeline's observation table."""
    if not os.path.exists(input_path):
        raise SystemExit(f"IBTrACS file not found: {input_path}")

    # keep_default_na=False: the North Atlantic basin code is the literal
    # string "NA", which pandas would otherwise read as a missing value and
    # silently drop the entire basin.
    frame = pd.read_csv(
        input_path,
        usecols=SOURCE_COLUMNS,
        skiprows=[1],  # second line is a units header
        low_memory=False,
        keep_default_na=False,
        na_values=[" ", ""],
    )
    logger.info("read %d rows", len(frame))

    for column in NUMERIC_COLUMNS:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    frame = frame[frame["NATURE"] == TROPICAL_NATURE]
    logger.info("%d tropical-stage rows", len(frame))

    # Interpolated rows read forward in time; see the module docstring. The
    # same hours are used by the live adapter, so training and serving agree by
    # construction.
    stamps = pd.to_datetime(frame["ISO_TIME"], errors="coerce")
    synoptic = stamps.dt.hour.isin(SYNOPTIC_HOURS) & (stamps.dt.minute == 0)
    logger.info(
        "%d synoptic rows kept; %d interpolated or off-hour rows dropped",
        int(synoptic.sum()),
        int((~synoptic).sum()),
    )
    frame = frame[synoptic]

    if basins:
        wanted = {basin.upper() for basin in basins}
        frame = frame[frame["BASIN"].str.upper().isin(wanted)]
        logger.info("%d rows in basins %s", len(frame), sorted(wanted))

    table = pd.DataFrame(
        {
            "cyclone_id": frame["SID"],
            "timestamp": pd.to_datetime(frame["ISO_TIME"], errors="coerce"),
            "latitude": frame["LAT"],
            "longitude": frame["LON"].map(normalise_longitude),
            "wind_speed_kph": frame["USA_WIND"] * KNOTS_TO_KPH,
            "pressure_hpa": frame["USA_PRES"].fillna(frame["WMO_PRES"]),
            "season": frame["SEASON"],
            "basin": frame["BASIN"],
            "storm_name": frame["NAME"],
        }
    )

    before = len(table)
    table = table.dropna(
        subset=["cyclone_id", "timestamp", "latitude", "longitude",
                "wind_speed_kph", "pressure_hpa"]
    )
    logger.info("%d rows have a complete fix (dropped %d)", len(table), before - len(table))

    table = table.drop_duplicates(subset=["cyclone_id", "timestamp"])

    return table.sort_values(["cyclone_id", "timestamp"]).reset_index(drop=True)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="IBTrACS CSV export")
    parser.add_argument("--output", required=True, help="where to write the table")
    parser.add_argument(
        "--basins",
        nargs="+",
        help="restrict to basins, e.g. --basins NI  (default: all)",
    )
    parser.add_argument(
        "--min-track-length",
        type=int,
        default=4,
        help="drop storms with fewer fixes than this",
    )
    args = parser.parse_args()

    table = convert(args.input, args.basins)

    lengths = table.groupby("cyclone_id")["timestamp"].transform("size")
    table = table[lengths >= args.min_track_length]

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    table.to_csv(args.output, index=False)

    logger.info(
        "wrote %s: %d observations, %d storms, %s to %s",
        args.output,
        len(table),
        table["cyclone_id"].nunique(),
        table["timestamp"].min().date(),
        table["timestamp"].max().date(),
    )
    logger.info("per basin: %s", table.groupby("basin")["cyclone_id"].nunique().to_dict())


if __name__ == "__main__":
    main()
