"""Build and evaluate the analogue-ensemble index.

    .venv/Scripts/python training/build_analogue_index.py \\
        --dataset data/processed/observations.csv

Two things happen, in this order, because the second must not flatter the first:

1. **Evaluation.** Storms are split with the same hash and fractions the neural
   models use, so the held-out storms are the same ones. An index is built from
   the training and validation storms only, and every complete 24-hour window
   of the held-out storms is forecast from it. Analogues must have finished
   before the query time -- the strict rewind rule -- so early-archive queries
   get fewer analogues, and the scores are conservative for that reason. Each
   forecast is scored against the reported fixes, next to persistence and
   linear extrapolation, exactly as the trajectory model is.
2. **Serving index.** Built from every storm, with the evaluation attached.
   Serving from all storms is standard -- more analogues for a live storm -- and
   the recorded skill was measured with the held-out storms excluded.

Nothing is fitted, so there is nothing to overfit; the evaluation still matters,
because an analogue forecast can simply be worse than extrapolating the track.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
import time

from typing import Sequence

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.analogue.index import (  # noqa: E402
    AGGREGATION_MEAN,
    AGGREGATIONS,
    HORIZONS_HOURS,
    LAG_COLUMNS,
    AnalogueIndex,
    _apply_offset,
    _east_north_km,
)
from preprocessing.dataset import load_observations  # noqa: E402
from preprocessing.splits import split_by_cyclone  # noqa: E402
from training.config import TrainingConfig  # noqa: E402

logger = logging.getLogger(__name__)

DEFAULT_OUTPUT = "checkpoints"


def evaluate(
    train_index: AnalogueIndex,
    test_index: AnalogueIndex,
    members: int,
    curvature: bool = True,
    aggregations: Sequence[str] = (AGGREGATION_MEAN,),
):
    """Forecast every held-out window and score it against what happened.

    Several member-weighting schemes are scored in the same pass. Finding the
    nearest members is the expensive part and is shared between them, so
    comparing three costs barely more than comparing one — and the comparison
    has to be on identical windows to mean anything.
    """
    primary = aggregations[0]
    errors = {a: {h: [] for h in HORIZONS_HOURS} for a in aggregations}
    spreads = {a: {h: [] for h in HORIZONS_HOURS} for a in aggregations}
    wind_errors = {a: {h: [] for h in HORIZONS_HOURS} for a in aggregations}

    # Baselines do not depend on how members are combined.
    persistence = {h: [] for h in HORIZONS_HOURS}
    linear = {h: [] for h in HORIZONS_HOURS}
    wind_persistence = {h: [] for h in HORIZONS_HOURS}
    no_analogues = 0

    present = np.ones(train_index.features.shape[1], dtype=bool)
    east6, north6 = LAG_COLUMNS[6]

    for row in range(len(test_index)):
        lat, lon = float(test_index.latitudes[row]), float(test_index.longitudes[row])
        moment = test_index.window_times[row].astype("datetime64[us]").astype(object)
        vector = test_index.features[row]
        wind = float(vector[11])

        chosen = train_index.query(vector, present, moment, lat, lon, members=members)
        if not chosen:
            no_analogues += 1
            continue
        motion = (-float(vector[east6]), -float(vector[north6])) if curvature else None
        points = {
            aggregation: {
                p["forecast_hours"]: p
                for p in train_index.forecast(
                    chosen, lat, lon, wind, motion_6h=motion, aggregation=aggregation
                )
            }
            for aggregation in aggregations
        }

        # Linear extrapolation continues the last 6 h of motion.
        motion_east = -float(vector[east6])
        motion_north = -float(vector[north6])

        for h, hours in enumerate(HORIZONS_HOURS):
            if not test_index.outcome_mask[row, h]:
                continue
            true_east, true_north, true_dwind = test_index.outcomes[row, h]
            true_lat, true_lon = _apply_offset(lat, lon, true_east, true_north)

            scored = False
            for aggregation in aggregations:
                point = points[aggregation].get(hours)
                if point is None:
                    continue
                errors[aggregation][hours].append(math.hypot(*_east_north_km(
                    true_lat, true_lon, point["latitude"], point["longitude"])))
                spreads[aggregation][hours].append(point["spread_km"])
                wind_errors[aggregation][hours].append(
                    abs(point["wind_speed_kph"] - (wind + true_dwind)))
                scored = True

            if not scored:
                continue
            persistence[hours].append(math.hypot(true_east, true_north))
            scale = hours / 6.0
            linear[hours].append(math.hypot(
                true_east - motion_east * scale, true_north - motion_north * scale))
            wind_persistence[hours].append(abs(true_dwind))

    def summarise(aggregation: str):
        per_horizon = {}
        for hours in HORIZONS_HOURS:
            if not errors[aggregation][hours]:
                continue
            err = np.asarray(errors[aggregation][hours])
            per_horizon[f"{hours}h"] = {
                "n": int(err.size),
                "mean_error_km": round(float(err.mean()), 2),
                "median_error_km": round(float(np.median(err)), 2),
                "baseline_persistence_km": round(float(np.mean(persistence[hours])), 2),
                "baseline_linear_km": round(float(np.mean(linear[hours])), 2),
                "beats_linear": bool(err.mean() < np.mean(linear[hours])),
                "mean_spread_km": round(float(np.mean(spreads[aggregation][hours])), 2),
                # Is a wide ensemble actually a less reliable one? If not, the
                # spread is decoration and must not be presented as uncertainty.
                "spread_error_correlation": round(
                    float(np.corrcoef(spreads[aggregation][hours], err)[0, 1]), 3),
                "wind_mae_kph": round(float(np.mean(wind_errors[aggregation][hours])), 2),
                "wind_persistence_mae_kph": round(float(np.mean(wind_persistence[hours])), 2),
            }
        return per_horizon

    per_horizon = summarise(primary)
    longest = f"{max(HORIZONS_HOURS)}h"
    skill = None
    if longest in per_horizon:
        row = per_horizon[longest]
        skill = round(max(0.0, 1.0 - row["mean_error_km"] / row["baseline_persistence_km"]), 3)

    metrics = {
        "per_horizon": per_horizon,
        "validation_skill": skill,
        "queries": len(test_index),
        "queries_without_analogues": no_analogues,
        "test_storms": test_index.storm_count,
        "confidence_definition": (
            "skill of the analogue-ensemble mean against persistence at the longest "
            "horizon on held-out storms, 1 - error / persistence_error"
        ),
    }

    # Every scheme scored on the same windows, so the choice between them is a
    # measurement rather than a preference. The one actually served is
    # `aggregation_served`.
    if len(aggregations) > 1:
        metrics["by_aggregation"] = {
            aggregation: summarise(aggregation) for aggregation in aggregations
        }
    metrics["aggregation_served"] = primary
    return metrics


def main(args) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    started = time.time()

    frame = load_observations(args.dataset)
    config = TrainingConfig(dataset_path=args.dataset)
    storms = frame["cyclone_id"].astype(str).unique().tolist()
    assignment = split_by_cyclone(
        storms,
        train_fraction=config.train_fraction,
        validation_fraction=config.validation_fraction,
    )
    test_ids = {s for s, split in assignment.items() if split == "test"}
    logger.info("storms: %d total, %d held out", len(storms), len(test_ids))

    in_test = frame["cyclone_id"].astype(str).isin(test_ids)
    train_index = AnalogueIndex.build(frame[~in_test])
    test_index = AnalogueIndex.build(frame[in_test])
    logger.info(
        "evaluation index: %d windows from %d storms; %d held-out query windows",
        len(train_index), train_index.storm_count, len(test_index),
    )

    metrics = evaluate(
        train_index, test_index, args.members, curvature=True, aggregations=AGGREGATIONS
    )
    # The first design, averaging absolute displacements, kept as a recorded
    # comparison: it lost to linear extrapolation, which is why it is not served.
    absolute = evaluate(train_index, test_index, args.members, curvature=False)
    metrics["absolute_displacement_method"] = absolute["per_horizon"]
    logger.info("held-out metrics: %s", json.dumps(metrics, indent=2))

    serving = AnalogueIndex.build(
        frame,
        metadata={
            "model_name": "analogue-ensemble-v1",
            "model_version": "1.0",
            "members": args.members,
            "dataset_version": args.dataset_version,
            "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "metrics": metrics,
        },
    )
    path = serving.save(args.output)
    logger.info(
        "saved serving index: %d windows from %d storms to %s (%.0f s)",
        len(serving), serving.storm_count, path, time.time() - started,
    )
    return 0


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, help="observation table (prepare_ibtracs.py output)")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="directory for the index files")
    parser.add_argument("--members", type=int, default=10, help="analogue storms per forecast")
    parser.add_argument("--dataset-version")
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main(parse_args()))
