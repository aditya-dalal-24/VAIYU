"""Held-out trajectory skill broken down by basin.

A checkpoint records one skill number over the whole held-out split, which
hides the question that matters for a given deployment: does the model predict
*this* basin, or is its average carried by the basins with the most data? The
North Indian Ocean is the smallest basin in IBTrACS by a wide margin, so it is
exactly where a global average could flatter a model that had learned little.

The split is rebuilt with the same config and seed used for training, so the
cyclones scored here are the ones the model never saw. Nothing is retrained and
nothing is written.

    .venv/Scripts/python evaluation/basin_report.py --basin NI
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Dict, List, Optional, Sequence

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evaluation.trajectory_metrics import evaluate_trajectory  # noqa: E402
from models.trajectory.model import TrajectoryModel  # noqa: E402
from preprocessing.scaler import SequenceScaler  # noqa: E402
from training.config import TrainingConfig  # noqa: E402
from training.pipeline import prepare_data  # noqa: E402

DEFAULT_DATASET = "data/processed/observations.csv"
DEFAULT_CHECKPOINT = "checkpoints/trajectory.pt"

# Below this a basin's mean error is noise, and reporting it would invite
# conclusions the sample cannot support.
MINIMUM_SAMPLES = 200

BASIN_LABELS = {
    "EP": "East/Central Pacific",
    "NA": "North Atlantic",
    "NI": "North Indian",
    "SI": "South Indian",
    "SP": "South Pacific",
    "WP": "West Pacific",
}


def basin_of(latitude: float, longitude: float) -> str:
    """Basin code from the position at forecast time."""
    if latitude >= 0:
        if 100 <= longitude <= 180:
            return "WP"
        if 30 <= longitude < 100:
            return "NI"
        if longitude < -100 or longitude > 180:
            return "EP"
        return "NA"
    if 20 <= longitude < 135:
        return "SI"
    return "SP"


def report(
    dataset_path: str = DEFAULT_DATASET,
    checkpoint_path: str = DEFAULT_CHECKPOINT,
    basins: Optional[Sequence[str]] = None,
) -> int:
    if not os.path.exists(checkpoint_path):
        print(
            "  no trained trajectory checkpoint found. Train one first; this "
            "tool only reads."
        )
        return 1

    config = TrainingConfig(dataset_path=dataset_path)
    print("  rebuilding the training split (same config and seed as training)...")
    data = prepare_data(config)

    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    model = TrajectoryModel.from_config(checkpoint["config"])
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    scaler = SequenceScaler.from_dict(checkpoint["scaler"])
    horizons: List[int] = list(checkpoint["horizons"])

    test = data.test
    codes = np.array([basin_of(row[0], row[1]) for row in test.base_states])

    print(
        f"\n  held-out split: {len(test)} samples, "
        f"{len(set(test.cyclone_ids.tolist()))} cyclones, "
        f"none seen in training"
    )
    print("  mean great-circle position error, and the margin over the linear")
    print("  extrapolation baseline at the longest horizon.\n")

    columns = "".join(f"{('+%dh' % h):>9}" for h in horizons)
    header = (
        f"  {'basin':<22}{'cyclones':>9}{'samples':>9}{columns}"
        f"{'vs linear':>14}"
    )
    print(header)
    print("  " + "-" * (len(header) - 2))

    wanted = {code.upper() for code in basins} if basins else None
    detail: Dict[str, Dict[str, object]] = {}

    for code in sorted(set(codes.tolist())):
        if wanted and code not in wanted:
            continue

        indices = np.flatnonzero(codes == code)
        label = f"{code}  {BASIN_LABELS.get(code, code)}"

        if len(indices) < MINIMUM_SAMPLES:
            print(
                f"  {label:<22}{'':>9}{len(indices):>9}"
                f"{'too few samples to report':>{9 * len(horizons) + 14}}"
            )
            continue

        subset = test.subset(indices)
        metrics = evaluate_trajectory(model, subset, scaler, horizons)
        per = metrics["per_horizon"]
        detail[code] = per

        longest = per[f"{horizons[-1]}h"]
        margin = (
            (longest["baseline_linear_km"] - longest["mean_error_km"])
            / longest["baseline_linear_km"]
            * 100
        )
        verdict = "beats" if margin > 0 else "LOSES"

        print(
            f"  {label:<22}{len(set(subset.cyclone_ids.tolist())):>9}{len(subset):>9}"
            + "".join(f"{per[f'{h}h']['mean_error_km']:>8.0f}k" for h in horizons)
            + f"{verdict + ' ' + format(abs(margin), '.0f') + '%':>14}"
        )

    for code, per in detail.items():
        print(f"\n  {code}  {BASIN_LABELS.get(code, code)} - against both baselines:")
        for horizon in horizons:
            row = per[f"{horizon}h"]
            print(
                f"    +{horizon:>3}h  n={row['n']:<6} "
                f"model {row['mean_error_km']:>6.0f} km   "
                f"persistence {row['baseline_persistence_km']:>6.0f} km   "
                f"linear {row['baseline_linear_km']:>6.0f} km   "
                f"p90 {row['p90_error_km']:>6.0f} km"
            )

    print(
        "\n  Beating persistence is a low bar. Beating linear extrapolation is "
        "what\n  indicates the model learned how tracks curve in that basin."
    )
    return 0


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--checkpoint", default=DEFAULT_CHECKPOINT)
    parser.add_argument(
        "--basin",
        action="append",
        help="report only this basin code (NI, WP, SI, ...); repeatable",
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    raise SystemExit(
        report(arguments.dataset, arguments.checkpoint, arguments.basin)
    )
