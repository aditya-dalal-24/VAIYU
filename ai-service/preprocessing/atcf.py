"""ATCF best-track parsing, for live and recent storms.

ATCF is the format the operational centres publish best tracks in: NHC for the
Atlantic and East/Central Pacific, JTWC for the Indian Ocean and West Pacific.
The layout is identical across basins, so a parser written once serves whichever
source is reachable.

Availability, verified from this environment
--------------------------------------------
``ftp.nhc.noaa.gov/atcf/btk/``     reachable, carries ``al`` / ``cp`` / ``ep`` only
``metoc.navy.mil`` (JTWC)          403 Forbidden
``rsmcnewdelhi.imd.gov.in`` (IMD)  unreachable
MOSDAC (ISRO)                      requires an account

So **no North Indian Ocean live track source is currently open**. That is a data
access problem, not a code one: this module parses a JTWC or IMD b-deck the
moment one can be obtained, since the format is the same.

A note on repeated rows
-----------------------
Each synoptic time appears once per wind-radii threshold (34/50/64 kt), so the
same fix repeats two or three times in the file. Only the first row per
timestamp is kept; treating them as separate observations would triple the
apparent track density and corrupt every rate-of-change feature.
"""

from __future__ import annotations

import logging
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Sequence

logger = logging.getLogger(__name__)

KNOTS_TO_KPH = 1.852

NHC_BTK_URL = "https://ftp.nhc.noaa.gov/atcf/btk/b{storm_id}.dat"

FETCH_TIMEOUT_SECONDS = 30
MAX_DECK_BYTES = 4 * 1024 * 1024

# Rows whose fourth field is not BEST are forecast aids, not observations.
BEST_TRACK_TAG = "BEST"


class AtcfError(Exception):
    """Raised when a deck cannot be retrieved or contains no usable fixes."""


@dataclass(frozen=True)
class AtcfFix:
    """One best-track fix, in contract units."""

    timestamp: datetime
    latitude: float
    longitude: float
    wind_speed_kph: float
    pressure_hpa: float

    def as_observation_payload(self) -> Dict[str, object]:
        """Shape the contract's observation object expects (section 5)."""
        return {
            "timestamp": self.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "latitude": self.latitude,
            "longitude": self.longitude,
            "windSpeedKph": round(self.wind_speed_kph, 1),
            "pressureHpa": self.pressure_hpa,
        }


def _coordinate(raw: str) -> Optional[float]:
    """ATCF stores tenths of a degree with a hemisphere suffix: '269N', '1611W'."""
    raw = raw.strip()
    if len(raw) < 2 or not raw[:-1].isdigit():
        return None
    value = int(raw[:-1]) / 10.0
    return -value if raw[-1] in ("S", "W") else value


def parse_deck(text: str) -> List[AtcfFix]:
    """Parse a b-deck into deduplicated fixes, oldest first.

    Rows missing a coordinate, wind or pressure are skipped rather than
    defaulted: an invented pressure would be indistinguishable from a measured
    one downstream. Early depression fixes often carry pressure 0, and those
    are dropped for the same reason.
    """
    fixes: Dict[datetime, AtcfFix] = {}

    for line in text.splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) < 10 or parts[4] != BEST_TRACK_TAG:
            continue

        try:
            stamp = datetime.strptime(parts[2], "%Y%m%d%H")
        except ValueError:
            continue

        if stamp in fixes:
            continue  # same fix, different wind-radii threshold

        latitude = _coordinate(parts[6])
        longitude = _coordinate(parts[7])
        if latitude is None or longitude is None:
            continue

        try:
            wind_kt = float(parts[8])
            pressure = float(parts[9])
        except ValueError:
            continue

        # A zero pressure is ATCF's missing marker, not a real measurement.
        if pressure <= 0 or wind_kt < 0:
            continue

        fixes[stamp] = AtcfFix(
            timestamp=stamp,
            latitude=latitude,
            longitude=longitude,
            wind_speed_kph=wind_kt * KNOTS_TO_KPH,
            pressure_hpa=pressure,
        )

    return [fixes[key] for key in sorted(fixes)]


def fetch_deck(storm_id: str, url_template: str = NHC_BTK_URL) -> List[AtcfFix]:
    """Download and parse a storm's b-deck.

    ``storm_id`` is the ATCF identifier, e.g. ``ep122026`` or ``io012026``.
    """
    url = url_template.format(storm_id=storm_id.lower())

    try:
        request = urllib.request.Request(
            url, headers={"User-Agent": "cyclovision-ai-service"}
        )
        with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
            payload = response.read(MAX_DECK_BYTES)
    except Exception as error:  # noqa: BLE001 - a blocked or absent deck is one outcome
        raise AtcfError(
            f"could not retrieve the best track for {storm_id}: {type(error).__name__}"
        )

    fixes = parse_deck(payload.decode("utf-8", errors="replace"))
    if not fixes:
        raise AtcfError(f"no usable best-track fixes for {storm_id}")

    logger.info(
        "%s: %d fixes, %s to %s",
        storm_id,
        len(fixes),
        fixes[0].timestamp,
        fixes[-1].timestamp,
    )
    return fixes


def build_request(
    fixes: Sequence[AtcfFix],
    request_id: str,
    cyclone_id: str,
    analysis_types: Optional[Sequence[str]] = None,
    up_to_index: Optional[int] = None,
) -> Dict[str, object]:
    """Assemble a contract analysis request from a track.

    ``up_to_index`` truncates the track so later fixes can verify the forecast.
    Everything from that index onward is excluded, which is what makes a check
    against those fixes a test rather than a demonstration.
    """
    usable = list(fixes[:up_to_index]) if up_to_index is not None else list(fixes)

    if len(usable) < 3:
        raise AtcfError(
            "at least three fixes are required to build an analysis request"
        )

    return {
        "requestId": request_id,
        "cycloneId": cyclone_id,
        "analysisTypes": list(
            analysis_types or ["TRAJECTORY_PREDICTION", "INTENSITY_PREDICTION"]
        ),
        "currentObservation": usable[-1].as_observation_payload(),
        "observationHistory": [
            fix.as_observation_payload() for fix in usable[:-1]
        ],
    }


def training_overlap(
    fixes: Sequence[AtcfFix],
    observations_path: str,
    degrees: float = 3.0,
    hours: float = 12.0,
) -> Dict[str, object]:
    """Check whether a storm looks present in the training archive.

    Scoring a model on a storm it trained on is the single easiest way to
    produce a flattering and meaningless result, and identifiers differ between
    ATCF and IBTrACS so the names cannot simply be compared. This matches on
    space and time instead: any archive fix within ``degrees`` and ``hours`` of
    one of this storm's fixes is treated as a probable overlap.

    A heuristic deliberately biased toward false positives -- being warned about
    a clean storm costs a second look, while missing a contaminated one
    invalidates the whole test.
    """
    import pandas as pd

    try:
        archive = pd.read_csv(observations_path, parse_dates=["timestamp"])
    except Exception as error:  # noqa: BLE001
        return {"checked": False, "reason": f"archive unreadable: {type(error).__name__}"}

    matches = []
    for fix in fixes:
        window = archive[
            (archive["timestamp"] >= fix.timestamp - pd.Timedelta(hours=hours))
            & (archive["timestamp"] <= fix.timestamp + pd.Timedelta(hours=hours))
            & (archive["latitude"].sub(fix.latitude).abs() <= degrees)
            & (archive["longitude"].sub(fix.longitude).abs() <= degrees)
        ]
        if not window.empty:
            matches.extend(window["cyclone_id"].unique().tolist())

    unique = sorted(set(matches))
    return {
        "checked": True,
        "overlaps": bool(unique),
        "archive_storm_ids": unique[:5],
        "archive_last_observation": str(archive["timestamp"].max()),
    }
