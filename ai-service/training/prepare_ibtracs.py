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

**Only tropical stages are kept, and ``NR`` counts as one.** Extratropical,
subtropical, disturbance and mixed fixes are positively coded as something
else, are a different physical regime, and would teach the model motion it will
never be asked to forecast. They stay out.

``NR`` is different: it means *not reported*, not *not tropical*. Measured
against this archive its fixes sit at a median 12.7 degrees of latitude against
41.5 for extratropical ones, so they are tropical in character, and the live
adapter has always accepted them (``TROPICAL_NATURES`` in
``preprocessing/ibtracs_live.py``).

An earlier version of this file kept ``NR`` only inside storms coded ``TS``
somewhere, on the theory that those were gap-coded real storms and the rest were
unclassifiable. The North Indian Ocean shows why that was wrong. Between 1990
and 1995 the basin has 1,952 ``NR`` fixes and 57 ``TS`` ones: only 5 of its 58
storms carry a single ``TS`` fix, because that is simply how the agency recorded
the basin then. The restriction therefore deleted six consecutive seasons of
Indian Ocean cyclones -- among them 1991113N10091, the April 1991 Bangladesh
cyclone, which has 65 fixes every one of which reports a ``USA_WIND`` and is
coded ``NR`` throughout, and which killed on the order of 138,000 people. A
filter that silently erases the deadliest storm in the record is not a
conservative filter; it is a broken one.

**Pressure is optional; wind is not.** A fix needs a position and a wind to be
usable, because every sequence feature and every target is built from those.
Requiring a central pressure as well discarded 14,000 fixes and 476 whole
storms, and it fell hardest exactly where the data is thinnest: two thirds of
North Indian Ocean fixes report a wind, but only two thirds of those also
report a pressure. The models were built for this -- the step features carry a
``pressure_present`` flag and training applies pressure dropout -- and the
intensity loss and metrics mask the pressure component per fix, so an absent
reading contributes nothing rather than being learned as no change.

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

# IBTrACS marks the tropical-cyclone stage as TS. NR means no agency coded the
# nature of that fix, which in some basins and eras is every fix there is; see
# the module docstring for why those are kept.
TROPICAL_NATURE = "TS"
UNCODED_NATURE = "NR"

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

    keep_nature = frame["NATURE"].isin([TROPICAL_NATURE, UNCODED_NATURE])
    uncoded = int((frame["NATURE"] == UNCODED_NATURE).sum())
    frame = frame[keep_nature]
    logger.info(
        "%d tropical-stage rows (%d of them fixes whose nature was never coded)",
        len(frame),
        uncoded,
    )

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
            # Arabian Sea (AS) and Bay of Bengal (BB) are sub-basins of the
            # North Indian Ocean, and the distinction is the one people in the
            # region actually use.
            "sub_basin": frame["SUBBASIN"],
            "storm_name": frame["NAME"],
        }
    )

    before = len(table)
    table = table.dropna(
        subset=["cyclone_id", "timestamp", "latitude", "longitude", "wind_speed_kph"]
    )
    logger.info(
        "%d rows have a position and a wind (dropped %d); %d of those also report a pressure",
        len(table),
        before - len(table),
        int(table["pressure_hpa"].notna().sum()),
    )

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
    north_indian = table[table["basin"] == "NI"]
    if not north_indian.empty:
        logger.info(
            "north Indian Ocean sub-basins: %s",
            north_indian.groupby("sub_basin")["cyclone_id"].nunique().to_dict(),
        )


if __name__ == "__main__":
    main()
