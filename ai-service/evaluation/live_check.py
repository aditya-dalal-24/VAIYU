"""Score the running service against a real storm's later fixes.

Held-out evaluation answers "how does this model do across many storms". This
answers a different and complementary question: does the deployed service, on a
specific real storm, produce a forecast that matches what the storm then did.
It exercises the whole path -- fetch, feature construction, scaling, checkpoint,
inference, response -- against ground truth the model was not given.

How it avoids flattering itself
-------------------------------
The track is cut at a chosen point. Everything before goes into the request;
everything after is withheld and used only to score. And before reporting
anything it checks whether the storm appears in the training archive, because
scoring a model on a storm it trained on produces excellent numbers that mean
nothing -- a trap this tool exists partly because of.

    .venv/Scripts/python evaluation/live_check.py --storm ep142026 --hold-back 12
"""

from __future__ import annotations

import argparse
import math
import os
import sys
from datetime import timedelta
from typing import List, Optional, Sequence

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from preprocessing.atcf import (  # noqa: E402
    AtcfError,
    AtcfFix,
    build_request,
    fetch_deck,
    training_overlap,
)

DEFAULT_SERVICE = "http://localhost:8000/api/v1/analysis/cyclone"
DEFAULT_ARCHIVE = "data/processed/observations.csv"

# How near a forecast time a real fix must fall to verify it.
VERIFY_TOLERANCE_HOURS = 1.5


def great_circle_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    a = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * 6371.0 * math.asin(min(1.0, math.sqrt(a)))


def choose_cut(fixes: Sequence[AtcfFix], hold_back_hours: float) -> Optional[int]:
    """Latest index leaving ``hold_back_hours`` of track to verify against."""
    last = fixes[-1].timestamp
    for index in range(len(fixes) - 1, 2, -1):
        span = (last - fixes[index].timestamp).total_seconds() / 3600.0
        if span >= hold_back_hours:
            return index
    return None


def verifying_fix(future: Sequence[AtcfFix], target) -> Optional[AtcfFix]:
    if not future:
        return None
    best = min(future, key=lambda f: abs((f.timestamp - target).total_seconds()))
    if abs((best.timestamp - target).total_seconds()) > VERIFY_TOLERANCE_HOURS * 3600:
        return None
    return best


def main(args) -> int:
    try:
        fixes = fetch_deck(args.storm)
    except AtcfError as error:
        print(f"  {error}")
        return 1

    print(
        f"  {args.storm}: {len(fixes)} fixes, "
        f"{fixes[0].timestamp:%Y-%m-%d %HZ} to {fixes[-1].timestamp:%Y-%m-%d %HZ}"
    )

    if os.path.exists(args.archive):
        overlap = training_overlap(fixes, args.archive)
        if overlap.get("overlaps"):
            print(
                "  WARNING: this storm appears in the training archive "
                f"(near {', '.join(overlap['archive_storm_ids'])}). "
                "Any score below is contaminated and must not be reported."
            )
            if not args.allow_seen:
                print("  refusing to continue; pass --allow-seen to override")
                return 2
        else:
            print(
                "  training-archive check: no overlap "
                f"(archive ends {overlap.get('archive_last_observation')})"
            )
    else:
        print("  training-archive check: skipped, no archive found")

    cut = choose_cut(fixes, args.hold_back)
    if cut is None:
        print(
            f"  track is too short to withhold {args.hold_back}h and still leave "
            "three fixes of history"
        )
        return 1

    current = fixes[cut - 1]
    future = fixes[cut:]

    print(
        f"  forecasting from {current.timestamp:%Y-%m-%d %HZ} "
        f"({current.latitude:.1f}, {current.longitude:.1f}; "
        f"{current.wind_speed_kph:.0f} kph, {current.pressure_hpa:.0f} hPa)"
    )
    print(f"  withheld {len(future)} later fixes for verification")

    body = build_request(
        fixes,
        request_id=f"live-{args.storm}",
        cyclone_id=args.storm,
        up_to_index=cut,
    )

    try:
        response = requests.post(args.service, json=body, timeout=90)
    except Exception as error:  # noqa: BLE001
        print(f"  service unreachable: {type(error).__name__}")
        return 1

    if response.status_code != 200:
        print(f"  service returned {response.status_code}: {response.text[:200]}")
        return 1

    result = response.json()
    print(f"\n  overall status: {result['status']}")

    trajectory = result.get("trajectoryPrediction") or {}
    if trajectory.get("status") == "COMPLETED":
        model = trajectory.get("model") or {}
        print(
            f"\n  TRAJECTORY  {model.get('name')} v{model.get('version')}"
            f"  (skill {trajectory.get('confidence')})"
        )
        errors: List[float] = []
        for position in trajectory.get("predictedPositions", []):
            target = current.timestamp + timedelta(hours=position["forecastHours"])
            truth = verifying_fix(future, target)
            if truth is None:
                print(f"    +{position['forecastHours']:>3}h   no verifying fix yet")
                continue
            error = great_circle_km(
                truth.latitude, truth.longitude,
                position["latitude"], position["longitude"],
            )
            errors.append(error)
            print(
                f"    +{position['forecastHours']:>3}h   forecast "
                f"{position['latitude']:6.2f},{position['longitude']:8.2f}   actual "
                f"{truth.latitude:6.2f},{truth.longitude:8.2f}   error {error:6.0f} km"
            )
        if errors:
            print(f"    mean position error: {sum(errors) / len(errors):.0f} km")

    intensity = result.get("intensityPrediction") or {}
    if intensity.get("status") == "COMPLETED":
        print(
            f"\n  INTENSITY   trend {intensity.get('trend')} "
            f"(confidence {intensity.get('confidence')})"
        )
        for point in intensity.get("forecast", []):
            target = current.timestamp + timedelta(hours=point["forecastHours"])
            truth = verifying_fix(future, target)
            if truth is None:
                print(f"    +{point['forecastHours']:>3}h   no verifying fix yet")
                continue
            print(
                f"    +{point['forecastHours']:>3}h   forecast "
                f"{point['windSpeedKph']:6.1f} kph {point['pressureHpa']:6.1f} hPa   "
                f"actual {truth.wind_speed_kph:6.1f} kph {truth.pressure_hpa:6.1f} hPa   "
                f"error {abs(point['windSpeedKph'] - truth.wind_speed_kph):5.1f} kph / "
                f"{abs(point['pressureHpa'] - truth.pressure_hpa):4.1f} hPa"
            )

    for key, label in (
        ("satelliteAnalysis", "SATELLITE"),
        ("historicalSimilarity", "SIMILARITY"),
    ):
        block = result.get(key)
        if block and block.get("status") != "COMPLETED":
            print(f"\n  {label}: {block['status']} - {block.get('reason')}")

    print(
        "\n  One storm is an anecdote. Read this as an end-to-end check of the "
        "deployed path, not as a measure of forecast skill."
    )
    return 0


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--storm",
        required=True,
        help="ATCF identifier, e.g. ep142026 (NHC) or io012026 (JTWC, when reachable)",
    )
    parser.add_argument(
        "--hold-back",
        type=float,
        default=24.0,
        help="hours of track to withhold for verification",
    )
    parser.add_argument("--service", default=DEFAULT_SERVICE)
    parser.add_argument("--archive", default=DEFAULT_ARCHIVE)
    parser.add_argument(
        "--allow-seen",
        action="store_true",
        help="continue even when the storm appears in the training archive",
    )
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main(parse_args()))
