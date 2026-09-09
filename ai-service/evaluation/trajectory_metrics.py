"""Trajectory evaluation (contract section 9).

Position error is measured as great-circle distance in kilometres, not as an
error in degrees. A degree of longitude is about 111 km at the equator and
about 55 km at 60 degrees latitude, so a degree-space error would understate
mistakes at high latitude and make basins incomparable.

Every score is reported against two baselines, because a distance in kilometres
alone does not say whether a model is useful:

``persistence``  the cyclone does not move
``linear``       the last observed motion continues at the same rate

Beating persistence is a low bar. Beating linear extrapolation is the one that
indicates the model learned something about how tracks curve.

Nothing is computed until a model has actually been trained; these functions
produce numbers only from a real model and a real held-out split.
"""

from __future__ import annotations

from typing import Dict, List, Sequence

import numpy as np
import torch

from models.base import device_of
from preprocessing.dataset import SupervisedSamples
from preprocessing.scaler import SequenceScaler

EARTH_RADIUS_KM = 6371.0


def great_circle_km(
    lat1: np.ndarray, lon1: np.ndarray, lat2: np.ndarray, lon2: np.ndarray
) -> np.ndarray:
    """Vectorised great-circle distance in kilometres."""
    lat1, lon1, lat2, lon2 = (np.radians(np.asarray(v, dtype=np.float64))
                              for v in (lat1, lon1, lat2, lon2))
    d_lat = lat2 - lat1
    d_lon = lon2 - lon1
    a = np.sin(d_lat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(d_lon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.clip(np.sqrt(a), 0.0, 1.0))


@torch.no_grad()
def predict_deltas(
    model: torch.nn.Module, samples: SupervisedSamples, scaler: SequenceScaler
) -> np.ndarray:
    """Model displacement predictions for a split, as ``[n, horizons, 2]``."""
    model.eval()
    device = device_of(model)
    sequences = scaler.transform_sequences(samples.sequences, samples.masks)
    environments = scaler.transform_environment(samples.environments)

    predictions = model(
        torch.from_numpy(np.ascontiguousarray(sequences)).to(device),
        torch.from_numpy(np.ascontiguousarray(samples.masks)).to(device),
        torch.from_numpy(np.ascontiguousarray(environments)).to(device),
    )
    return predictions.cpu().numpy()


def evaluate_trajectory(
    model: torch.nn.Module,
    samples: SupervisedSamples,
    scaler: SequenceScaler,
    horizons: Sequence[int],
) -> Dict[str, object]:
    """Position error per horizon, against persistence and linear baselines.

    Also records ``validation_skill``: skill against persistence at the longest
    horizon, in [0, 1]. That single number is what the service reports as
    trajectory confidence, and it exists only because a real evaluation
    produced it.
    """
    if len(samples) == 0:
        return {}

    deltas = predict_deltas(model, samples, scaler)

    base_lat = samples.base_states[:, 0]
    base_lon = samples.base_states[:, 1]

    # Last observed step motion, for the linear baseline. Padding trails the
    # real steps, so the final real row is at length-1 rather than at -1. The
    # step feature layout puts lat_delta and lon_delta at indices 12 and 13.
    lengths = samples.masks.sum(axis=1).astype(int).clip(min=1)
    rows = np.arange(samples.sequences.shape[0])
    last_step = samples.sequences[rows, lengths - 1, :]
    step_lat_delta = last_step[:, 12]
    step_lon_delta = last_step[:, 13]

    per_horizon: Dict[str, Dict[str, float]] = {}
    skill_at_longest: float = 0.0

    for position, horizon in enumerate(horizons):
        mask = samples.target_masks[:, position] > 0
        if not mask.any():
            continue

        actual_lat = base_lat[mask] + samples.position_targets[mask, position, 0]
        actual_lon = base_lon[mask] + samples.position_targets[mask, position, 1]

        predicted_lat = base_lat[mask] + deltas[mask, position, 0]
        predicted_lon = base_lon[mask] + deltas[mask, position, 1]

        model_error = great_circle_km(actual_lat, actual_lon, predicted_lat, predicted_lon)

        persistence_error = great_circle_km(
            actual_lat, actual_lon, base_lat[mask], base_lon[mask]
        )

        # The last step covers roughly one reporting interval; scale it to the
        # horizon. Approximate by design -- it is a baseline, not a forecast.
        scale = horizon / 6.0
        linear_error = great_circle_km(
            actual_lat,
            actual_lon,
            base_lat[mask] + step_lat_delta[mask] * scale,
            base_lon[mask] + step_lon_delta[mask] * scale,
        )

        mean_error = float(model_error.mean())
        mean_persistence = float(persistence_error.mean())
        skill = 0.0 if mean_persistence == 0 else 1.0 - mean_error / mean_persistence

        per_horizon[f"{horizon}h"] = {
            "n": int(mask.sum()),
            "mean_error_km": round(mean_error, 2),
            "median_error_km": round(float(np.median(model_error)), 2),
            "p90_error_km": round(float(np.percentile(model_error, 90)), 2),
            "baseline_persistence_km": round(mean_persistence, 2),
            "baseline_linear_km": round(float(linear_error.mean()), 2),
            "beats_persistence": bool(mean_error < mean_persistence),
            "beats_linear": bool(mean_error < float(linear_error.mean())),
            "skill_vs_persistence": round(max(0.0, min(1.0, skill)), 3),
        }
        skill_at_longest = max(0.0, min(1.0, skill))

    return {
        "per_horizon": per_horizon,
        "validation_skill": round(skill_at_longest, 3),
        "test_samples": len(samples),
        "test_cyclones": int(len(set(samples.cyclone_ids.tolist()))),
        "confidence_definition": (
            "skill against a persistence baseline on held-out cyclones, "
            "1 - model_error / baseline_error"
        ),
    }


def format_report(metrics: Dict[str, object]) -> List[str]:
    """Human-readable lines for logging after an evaluation run."""
    lines: List[str] = []
    for horizon, scores in (metrics.get("per_horizon") or {}).items():
        lines.append(
            f"+{horizon:<4} model {scores['mean_error_km']:8.2f} km | "
            f"persistence {scores['baseline_persistence_km']:8.2f} km | "
            f"linear {scores['baseline_linear_km']:8.2f} km  (n={scores['n']})"
        )
    return lines
