"""Currently-active storms from IBTrACS, for basins the ATCF decks do not cover.

`preprocessing/atcf.py` reads operational b-decks, but only NHC's are reachable
without credentials, and NHC carries the Atlantic and East/Central Pacific only.
IBTrACS publishes a small `ACTIVE` list alongside its historical archive, and
that list is global: it carries West Pacific, North Indian, South Indian and
South Pacific storms with no account and no API key. It is the open source that
closes the basin gap.

What it costs
-------------
IBTrACS is a best-track *archive*, not an operational feed, so the ACTIVE list
runs roughly one to two days behind the b-decks. Use ATCF where a storm is in
`al` / `cp` / `ep`; use this for every other basin.

Two traps in this file
----------------------
**Off-synoptic rows are interpolated, and the interpolation reads forward.**
IBTrACS resamples tracks to three-hourly, but only 00/06/12/18Z are reported
fixes. A 03Z row's position and wind are interpolated *between* the 00Z and 06Z
fixes, so a row stamped 03Z carries information from 06Z. Feeding those to a
model as observations at 03Z would leak three hours of the future into every
sample -- the precise thing section 8 forbids. Only synoptic rows are kept.

**`WMO_WIND` is empty here; `USA_WIND` is populated.** The historical archive has
both, and `WMO_WIND` is unusable anyway because it mixes 1-, 3- and 10-minute
averaging periods between agencies. `training/prepare_ibtracs.py` already uses
`USA_WIND` for that reason, so training and this path agree by construction.
"""

from __future__ import annotations

import io
import logging
import urllib.request
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

from preprocessing.atcf import KNOTS_TO_KPH, AtcfError, AtcfFix

logger = logging.getLogger(__name__)

IBTRACS_ACTIVE_URL = (
    "https://www.ncei.noaa.gov/data/"
    "international-best-track-archive-for-climate-stewardship-ibtracs/"
    "v04r01/access/csv/ibtracs.ACTIVE.list.v04r01.csv"
)

FETCH_TIMEOUT_SECONDS = 60
MAX_BYTES = 16 * 1024 * 1024

# Only these hours are reported fixes. Everything else is interpolated, and the
# interpolation uses the following fix -- future data relative to its own stamp.
SYNOPTIC_HOURS = (0, 6, 12, 18)

# IBTrACS nature codes. TS is tropical; NR means the nature was not coded, which
# is common on provisional tracks and is not evidence against a storm being
# tropical. DS (disturbance), ET (extratropical), SS (subtropical) and MX (mixed)
# are excluded: the models were trained on tropical fixes, and feeding the others
# in would be an out-of-distribution request dressed up as a normal one.
#
# Training (prepare_ibtracs.py) keeps TS only, and the difference is deliberate.
# Measured on the synoptic rows of ibtracs.since1980: 10,226 NR rows across 911
# storms, median USA_WIND 25 kt, and 721 of those storms also carry TS rows --
# NR is overwhelmingly the weak, uncoded start or end of storms that are
# otherwise tropical. That is not worth admitting into training, where the
# uncoded remainder could be anything. It is worth admitting here, because the
# current season is provisional and largely uncoded: dropping NR would discard
# live storms whose nature simply has not been assigned yet. The count of NR
# fixes is carried on each storm and printed by live_check, so it is visible
# rather than silent.
TROPICAL_NATURES = frozenset({"TS", "NR"})
UNCODED_NATURE = "NR"

BASIN_NAMES = {
    "NA": "North Atlantic",
    "SA": "South Atlantic",
    "EP": "East Pacific",
    "WP": "West Pacific",
    "NI": "North Indian",
    "SI": "South Indian",
    "SP": "South Pacific",
}

# Columns the loader needs. The full file has 174.
_USED_COLUMNS = [
    "SID",
    "SEASON",
    "BASIN",
    "NAME",
    "ISO_TIME",
    "NATURE",
    "LAT",
    "LON",
    "USA_WIND",
    "USA_PRES",
]


@dataclass(frozen=True)
class ActiveStorm:
    """One active storm and its usable fixes, oldest first."""

    storm_id: str
    name: str
    basin: str
    season: int
    fixes: List[AtcfFix]
    # Fixes whose nature was not coded (NR). Training used coded tropical
    # fixes only, so these are the part of a live request that is least like
    # the training data; see TROPICAL_NATURES.
    uncoded_fixes: int = 0

    @property
    def basin_name(self) -> str:
        return BASIN_NAMES.get(self.basin, self.basin)

    def summary(self) -> str:
        text = (
            f"{self.storm_id}  {self.name:<12} {self.basin_name:<14} "
            f"{len(self.fixes):>3} fixes  "
            f"{self.fixes[0].timestamp:%Y-%m-%d %HZ} to "
            f"{self.fixes[-1].timestamp:%Y-%m-%d %HZ}"
        )
        if self.uncoded_fixes:
            text += f"  ({self.uncoded_fixes} uncoded)"
        return text


def parse_active(text: str, basins: Optional[Sequence[str]] = None) -> List[ActiveStorm]:
    """Parse the ACTIVE list into storms with synoptic-only fixes.

    ``basins`` filters by IBTrACS basin code (``NI``, ``WP``, ...). Rows without
    a position, wind or pressure are dropped rather than defaulted, matching the
    ATCF parser: an invented pressure is indistinguishable downstream from a
    measured one.
    """
    import pandas as pd

    # keep_default_na would turn the North Atlantic basin code "NA" into NaN,
    # so blanks are named explicitly instead.
    frame = pd.read_csv(
        io.StringIO(text),
        skiprows=[1],  # a units row sits under the header
        keep_default_na=False,
        na_values=[""],
        usecols=lambda name: name in _USED_COLUMNS,
        low_memory=False,
    )

    frame["ISO_TIME"] = pd.to_datetime(frame["ISO_TIME"], errors="coerce")
    for column in ("LAT", "LON", "USA_WIND", "USA_PRES"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    total = len(frame)
    frame = frame[frame["ISO_TIME"].dt.hour.isin(SYNOPTIC_HOURS)]
    after_synoptic = len(frame)

    frame = frame[frame["NATURE"].isin(TROPICAL_NATURES)]
    after_nature = len(frame)

    frame = frame.dropna(subset=["ISO_TIME", "LAT", "LON", "USA_WIND", "USA_PRES"])
    frame = frame[frame["USA_PRES"] > 0]

    if basins:
        wanted = {code.upper() for code in basins}
        frame = frame[frame["BASIN"].isin(wanted)]

    logger.info(
        "IBTrACS ACTIVE: %d rows -> %d synoptic -> %d tropical -> %d usable",
        total,
        after_synoptic,
        after_nature,
        len(frame),
    )

    storms: List[ActiveStorm] = []
    for storm_id, group in frame.groupby("SID", sort=True):
        group = group.sort_values("ISO_TIME")
        fixes = [
            AtcfFix(
                timestamp=row.ISO_TIME.to_pydatetime(),
                latitude=float(row.LAT),
                longitude=float(row.LON),
                wind_speed_kph=float(row.USA_WIND) * KNOTS_TO_KPH,
                pressure_hpa=float(row.USA_PRES),
            )
            for row in group.itertuples()
        ]
        if len(fixes) < 3:
            continue

        first = group.iloc[0]
        storms.append(
            ActiveStorm(
                storm_id=str(storm_id),
                name=str(first["NAME"]),
                basin=str(first["BASIN"]),
                season=int(first["SEASON"]),
                fixes=fixes,
                uncoded_fixes=int((group["NATURE"] == UNCODED_NATURE).sum()),
            )
        )

    return storms


def fetch_active_storms(
    basins: Optional[Sequence[str]] = None,
    url: str = IBTRACS_ACTIVE_URL,
) -> List[ActiveStorm]:
    """Download and parse the ACTIVE list.

    Raises ``AtcfError`` when the list cannot be retrieved. An empty result is
    not an error: outside a basin's season there are legitimately no storms.
    """
    try:
        request = urllib.request.Request(
            url, headers={"User-Agent": "cyclovision-ai-service"}
        )
        with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
            payload = response.read(MAX_BYTES)
    except Exception as error:  # noqa: BLE001 - an unreachable archive is one outcome
        raise AtcfError(
            f"could not retrieve the IBTrACS active list: {type(error).__name__}"
        )

    return parse_active(payload.decode("utf-8", errors="replace"), basins=basins)


def find_storm(
    identifier: str,
    basins: Optional[Sequence[str]] = None,
    url: str = IBTRACS_ACTIVE_URL,
) -> ActiveStorm:
    """Look one storm up by IBTrACS SID or by name, case-insensitively."""
    storms = fetch_active_storms(basins=basins, url=url)
    if not storms:
        raise AtcfError("the IBTrACS active list currently contains no usable storms")

    wanted = identifier.strip().upper()
    for storm in storms:
        if storm.storm_id.upper() == wanted or storm.name.upper() == wanted:
            return storm

    available = ", ".join(f"{s.name} ({s.storm_id})" for s in storms)
    raise AtcfError(f"no active storm matched {identifier!r}; available: {available}")


def basin_counts(storms: Sequence[ActiveStorm]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for storm in storms:
        counts[storm.basin] = counts.get(storm.basin, 0) + 1
    return counts
