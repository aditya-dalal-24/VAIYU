"""Does blending the neural track forecast with the analogue ensemble help?

The analogue ensemble loses to plain linear extrapolation at +6 h and +12 h and
trails the neural track model at every horizon. On its own it does not earn a
forecast of its own. The one reason it might still be worth serving is that it
is wrong in a *different* way from the network -- it uses whole historical
tracks where the network uses the storm's own recent motion -- and averaging
two forecasts with different errors can beat both. This measures whether that
is true here, rather than assuming it.

How it stays fair
-----------------
* **Same moments.** Both methods forecast the same storm from the same fix, so
  every comparison is paired.
* **Nothing seen in training.** The split is rebuilt with the neural model's
  own config and seed. The analogue index is built from that split's *training*
  storms only, so no held-out storm can be its own analogue.
* **The weight is not tuned on the result.** The blend weight is chosen on the
  validation storms and then applied, once, to the test storms. Choosing it on
  the test set would report the best of twenty-one tries as if it were one.
* **Storm-level uncertainty.** Fixes from one storm are strongly correlated, so
  a confidence interval over fixes would be far too narrow. The interval on the
  improvement resamples whole storms.

Where the analogue ensemble has no forecast (too little history, or no
eligible analogue) the blend falls back to the neural forecast, which is what
serving would do, and the coverage is reported.

Nothing is retrained and nothing is written unless ``--output`` is given.

    .venv/Scripts/python evaluation/blend_report.py
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from collections import namedtuple
from typing import Dict, List, Optional

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evaluation.trajectory_metrics import predict_deltas  # noqa: E402
from models.analogue.index import (  # noqa: E402
    DEFAULT_MEMBERS,
    AnalogueIndex,
    motion_from,
    query_from_track,
)
from models.trajectory.model import TrajectoryModel  # noqa: E402
from preprocessing.dataset import load_observations  # noqa: E402
from preprocessing.features import normalise_longitude  # noqa: E402
from preprocessing.scaler import SequenceScaler  # noqa: E402
from training.config import TrainingConfig  # noqa: E402
from training.pipeline import prepare_data  # noqa: E402

DEFAULT_DATASET = "data/processed/observations.csv"
DEFAULT_CHECKPOINT = "checkpoints/trajectory.pt"
EARTH_RADIUS_KM = 6371.0088

# Weight on the neural forecast. 1.0 is the network alone, 0.0 the analogues.
WEIGHTS = np.round(np.linspace(0.0, 1.0, 21), 2)
BOOTSTRAP_RESAMPLES = 2000

Fix = namedtuple("Fix", "timestamp latitude longitude wind_speed_kph pressure_hpa")


def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance, vectorised."""
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = np.radians(((np.asarray(lon2) - np.asarray(lon1) + 180.0) % 360.0) - 180.0)
    a = np.sin(d_phi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.minimum(1.0, np.sqrt(a)))


def analogue_deltas(samples, frame, index, horizons, members) -> np.ndarray:
    """Analogue forecast for every sample as ``[n, horizons, 2]`` degree deltas.

    NaN where the analogue ensemble has no forecast for that sample or horizon.
    """
    out = np.full((len(samples), len(horizons), 2), np.nan, dtype=float)
    tracks = {
        storm: group.sort_values("timestamp")
        for storm, group in frame.groupby(frame["cyclone_id"].astype(str))
    }

    for row in range(len(samples)):
        storm = str(samples.cyclone_ids[row])
        track = tracks.get(storm)
        if track is None:
            continue
        moment = np.datetime64(samples.base_times[row], "ns")
        history = track[track["timestamp"].values <= moment]
        if history.empty:
            continue

        fixes = [
            Fix(
                ts.to_pydatetime(),
                float(lat),
                float(lon),
                None if np.isnan(wind) else float(wind),
                None if np.isnan(pressure) else float(pressure),
            )
            for ts, lat, lon, wind, pressure in zip(
                history["timestamp"],
                history["latitude"],
                history["longitude"],
                history["wind_speed_kph"].astype(float),
                history["pressure_hpa"].astype(float),
            )
        ]
        described = query_from_track(fixes)
        if described is None:
            continue
        newest, vector, present = described

        chosen = index.query(
            vector, present, newest.timestamp, newest.latitude, newest.longitude,
            members=members, exclude_storm_ids=[storm],
        )
        if not chosen:
            continue

        points = {
            p["forecast_hours"]: p
            for p in index.forecast(
                chosen, newest.latitude, newest.longitude, newest.wind_speed_kph,
                motion_6h=motion_from(vector, present),
            )
        }
        base_lat = float(samples.base_states[row, 0])
        base_lon = float(samples.base_states[row, 1])
        for position, hours in enumerate(horizons):
            point = points.get(hours)
            if point is None:
                continue
            out[row, position, 0] = point["latitude"] - base_lat
            out[row, position, 1] = normalise_longitude(point["longitude"] - base_lon)

        if (row + 1) % 2000 == 0:
            print(f"    {row + 1}/{len(samples)} analogue forecasts")

    return out


def errors_for(samples, gru, analogue, position, weight):
    """Per-sample error of the blend at one horizon, with the analogue fallback.

    Returns (errors, storm ids, covered mask) over samples that have a real
    target at this horizon.
    """
    real = samples.target_masks[:, position] > 0
    base_lat = samples.base_states[:, 0].astype(float)
    base_lon = samples.base_states[:, 1].astype(float)

    true_lat = base_lat + samples.position_targets[:, position, 0]
    true_lon = base_lon + samples.position_targets[:, position, 1]

    g_lat, g_lon = gru[:, position, 0], gru[:, position, 1]
    a_lat, a_lon = analogue[:, position, 0], analogue[:, position, 1]
    covered = ~np.isnan(a_lat)

    b_lat = np.where(covered, weight * g_lat + (1 - weight) * np.nan_to_num(a_lat), g_lat)
    b_lon = np.where(covered, weight * g_lon + (1 - weight) * np.nan_to_num(a_lon), g_lon)

    error = haversine_km(true_lat, true_lon, base_lat + b_lat, base_lon + b_lon)
    return error[real], samples.cyclone_ids[real], covered[real]


def storm_bootstrap(diff: np.ndarray, storms: np.ndarray, rng) -> tuple:
    """95% interval on the mean paired difference, resampling whole storms."""
    unique = np.unique(storms)
    by_storm = {s: diff[storms == s] for s in unique}
    means = np.empty(BOOTSTRAP_RESAMPLES)
    for i in range(BOOTSTRAP_RESAMPLES):
        pick = rng.choice(unique, size=len(unique), replace=True)
        values = np.concatenate([by_storm[s] for s in pick])
        means[i] = values.mean()
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def main(args) -> int:
    started = time.time()
    config = TrainingConfig(dataset_path=args.dataset)
    print("  rebuilding the neural model's split (same config and seed as training)...")
    data = prepare_data(config)

    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    model = TrajectoryModel.from_config(checkpoint["config"])
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    scaler = SequenceScaler.from_dict(checkpoint["scaler"])
    horizons: List[int] = list(checkpoint["horizons"])

    frame = load_observations(args.dataset)
    train_storms = set(map(str, data.train.cyclone_ids.tolist()))
    held_out = set(map(str, data.validation.cyclone_ids.tolist())) | set(
        map(str, data.test.cyclone_ids.tolist()))
    assert not (train_storms & held_out), "split leak: a storm is in training and held out"

    print("  building an analogue index from training storms only...")
    index = AnalogueIndex.build(frame[frame["cyclone_id"].astype(str).isin(train_storms)])
    print(f"    {len(index)} windows from {index.storm_count} storms")

    results: Dict[str, object] = {"horizons": horizons, "members": args.members}
    splits = {"validation": data.validation, "test": data.test}
    predictions = {}
    for name, samples in splits.items():
        print(f"  forecasting the {name} split ({len(samples)} samples)...")
        with torch.no_grad():
            gru = predict_deltas(model, samples, scaler).astype(float)
        analogue = analogue_deltas(samples, frame, index, horizons, args.members)
        predictions[name] = (samples, gru, analogue)

    rng = np.random.default_rng(7)
    print()
    header = (f"  {'horizon':<8}{'weight*':>8}{'network':>10}{'analogue':>10}"
              f"{'blend':>9}{'change':>9}   {'95% CI on change (by storm)':<28}{'coverage':>9}")
    print(header)
    print("  " + "-" * (len(header) - 2))

    per_horizon = {}
    for position, hours in enumerate(horizons):
        v_samples, v_gru, v_analogue = predictions["validation"]
        validation_means = [
            float(errors_for(v_samples, v_gru, v_analogue, position, w)[0].mean())
            for w in WEIGHTS
        ]
        chosen = float(WEIGHTS[int(np.argmin(validation_means))])

        t_samples, t_gru, t_analogue = predictions["test"]
        network, storms, covered = errors_for(t_samples, t_gru, t_analogue, position, 1.0)
        blend, _, _ = errors_for(t_samples, t_gru, t_analogue, position, chosen)

        # The analogue ensemble alone, on the samples where it has a forecast.
        analogue_only, _, _ = errors_for(t_samples, t_gru, t_analogue, position, 0.0)
        analogue_mean = float(analogue_only[covered].mean()) if covered.any() else math.nan

        diff = network - blend  # positive means the blend is better
        low, high = storm_bootstrap(diff, storms, rng)
        change_pct = 100.0 * diff.mean() / network.mean()

        per_horizon[f"{hours}h"] = {
            "weight_on_network": chosen,
            "network_km": round(float(network.mean()), 2),
            "analogue_km_where_available": round(analogue_mean, 2),
            "blend_km": round(float(blend.mean()), 2),
            "improvement_km": round(float(diff.mean()), 2),
            "improvement_pct": round(change_pct, 2),
            "improvement_ci95_km": [round(low, 2), round(high, 2)],
            "significant": bool(low > 0 or high < 0),
            "analogue_coverage": round(float(covered.mean()), 3),
            "test_samples": int(network.size),
            "test_storms": int(len(np.unique(storms))),
            "validation_curve_km": dict(zip(map(str, WEIGHTS.tolist()),
                                            [round(m, 2) for m in validation_means])),
        }
        print(
            f"  +{hours:<7}{chosen:>8.2f}{network.mean():>9.1f}k{analogue_mean:>9.1f}k"
            f"{blend.mean():>8.1f}k{-diff.mean():>+8.1f}k   "
            f"[{-high:+.2f}, {-low:+.2f}] km{'':<9}{covered.mean():>8.0%}"
        )

    results["per_horizon"] = per_horizon
    print()
    print("  weight* = share given to the neural forecast, chosen on validation storms.")
    print("  change  = blend minus network on test storms; negative is better.")
    print("  An interval that contains zero means the blend is not distinguishable")
    print("  from the network alone.")
    print(f"\n  done in {time.time() - started:.0f} s")

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as handle:
            json.dump(results, handle, indent=2)
        print(f"  wrote {args.output}")
    return 0


def parse_args(argv: Optional[List[str]] = None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--checkpoint", default=DEFAULT_CHECKPOINT)
    parser.add_argument("--members", type=int, default=DEFAULT_MEMBERS)
    parser.add_argument("--output", help="write the results as JSON")
    return parser.parse_args(argv)


if __name__ == "__main__":
    sys.exit(main(parse_args()))
