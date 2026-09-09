"""Intensity evaluation (contract section 10).

Scores the two outputs separately, matching the contract's separation of the
numerical forecast from the categorical trend:

* **wind and pressure** -- mean absolute error per horizon, in the contract's
  units (kph, hPa), against a persistence baseline that assumes intensity holds
  steady. Persistence is genuinely hard to beat over six hours, so reporting it
  alongside is the difference between a meaningful score and a flattering one.
* **trend** -- accuracy, macro F1 and a confusion matrix. Accuracy alone hides
  the usual failure here, which is a model that predicts STABLE for everything
  because STABLE is the commonest class. Macro F1 and the majority-class
  baseline both expose that.

Nothing is computed until a model has actually been trained.
"""

from __future__ import annotations

from typing import Dict, List, Sequence

import numpy as np
import torch

from models.intensity.model import TREND_CLASSES
from models.base import device_of
from preprocessing.dataset import SupervisedSamples
from preprocessing.scaler import SequenceScaler


@torch.no_grad()
def predict(
    model: torch.nn.Module, samples: SupervisedSamples, scaler: SequenceScaler
):
    """Return per-horizon intensity deltas and predicted trend classes."""
    model.eval()
    device = device_of(model)
    sequences = scaler.transform_sequences(samples.sequences, samples.masks)
    environments = scaler.transform_environment(samples.environments)

    deltas, trend_logits = model(
        torch.from_numpy(np.ascontiguousarray(sequences)).to(device),
        torch.from_numpy(np.ascontiguousarray(samples.masks)).to(device),
        torch.from_numpy(np.ascontiguousarray(environments)).to(device),
    )
    trend_predictions = torch.argmax(trend_logits, dim=-1).cpu().numpy()
    return deltas.cpu().numpy(), trend_predictions


def _macro_f1(actual: np.ndarray, predicted: np.ndarray, class_count: int) -> float:
    """Unweighted mean F1 across classes, so a rare class still counts."""
    scores: List[float] = []
    for index in range(class_count):
        true_positive = float(((predicted == index) & (actual == index)).sum())
        false_positive = float(((predicted == index) & (actual != index)).sum())
        false_negative = float(((predicted != index) & (actual == index)).sum())

        if true_positive + false_positive + false_negative == 0:
            continue  # class absent from this split entirely

        precision = (
            true_positive / (true_positive + false_positive)
            if true_positive + false_positive
            else 0.0
        )
        recall = (
            true_positive / (true_positive + false_negative)
            if true_positive + false_negative
            else 0.0
        )
        scores.append(
            0.0
            if precision + recall == 0
            else 2 * precision * recall / (precision + recall)
        )
    return float(np.mean(scores)) if scores else 0.0


def evaluate_intensity(
    model: torch.nn.Module,
    samples: SupervisedSamples,
    scaler: SequenceScaler,
    horizons: Sequence[int],
) -> Dict[str, object]:
    """Wind, pressure and trend scores on a held-out split."""
    if len(samples) == 0:
        return {}

    deltas, trend_predictions = predict(model, samples, scaler)

    per_horizon: Dict[str, Dict[str, float]] = {}

    for position, horizon in enumerate(horizons):
        mask = samples.target_masks[:, position] > 0
        if not mask.any():
            continue

        scores: Dict[str, float] = {"n": int(mask.sum())}

        for offset, (quantity, unit) in enumerate(
            (("wind", "kph"), ("pressure", "hPa"))
        ):
            actual = samples.intensity_targets[mask, position, offset]
            predicted = deltas[mask, position, offset]

            model_mae = float(np.abs(predicted - actual).mean())
            # Persistence predicts no change, so its error is the size of the
            # actual change.
            baseline_mae = float(np.abs(actual).mean())

            scores[f"{quantity}_mae_{unit}"] = round(model_mae, 3)
            scores[f"{quantity}_baseline_mae_{unit}"] = round(baseline_mae, 3)
            scores[f"{quantity}_beats_persistence"] = bool(model_mae < baseline_mae)

        per_horizon[f"{horizon}h"] = scores

    trend_mask = samples.trend_mask > 0
    trend: Dict[str, object] = {"n": int(trend_mask.sum())}

    if trend_mask.any():
        actual = samples.trend_targets[trend_mask]
        predicted = trend_predictions[trend_mask]

        counts = np.bincount(actual, minlength=len(TREND_CLASSES))
        majority = float(counts.max() / counts.sum())

        trend.update(
            {
                "accuracy": round(float((predicted == actual).mean()), 3),
                "macro_f1": round(_macro_f1(actual, predicted, len(TREND_CLASSES)), 3),
                "majority_class_baseline": round(majority, 3),
                "beats_majority_baseline": bool(
                    float((predicted == actual).mean()) > majority
                ),
                "class_distribution": {
                    name: int(counts[index]) for index, name in enumerate(TREND_CLASSES)
                },
                "confusion_matrix": _confusion(actual, predicted, len(TREND_CLASSES)),
                "classes": list(TREND_CLASSES),
            }
        )

    return {
        "per_horizon": per_horizon,
        "trend": trend,
        "test_samples": len(samples),
        "test_cyclones": int(len(set(samples.cyclone_ids.tolist()))),
    }


def _confusion(actual: np.ndarray, predicted: np.ndarray, class_count: int):
    """Rows are the true class, columns the predicted class."""
    matrix = np.zeros((class_count, class_count), dtype=int)
    for true_index, predicted_index in zip(actual, predicted):
        matrix[int(true_index), int(predicted_index)] += 1
    return matrix.tolist()


def format_report(metrics: Dict[str, object]) -> List[str]:
    """Human-readable lines for logging after an evaluation run."""
    lines: List[str] = []
    for horizon, scores in (metrics.get("per_horizon") or {}).items():
        lines.append(
            f"+{horizon:<4} wind MAE {scores.get('wind_mae_kph', float('nan')):7.2f} kph | "
            f"pressure MAE {scores.get('pressure_mae_hPa', float('nan')):7.2f} hPa "
            f"(n={scores['n']})"
        )
    trend = metrics.get("trend") or {}
    if "accuracy" in trend:
        lines.append(
            f"trend accuracy {trend['accuracy']:.3f} | macro F1 {trend['macro_f1']:.3f} "
            f"| majority baseline {trend['majority_class_baseline']:.3f}"
        )
    return lines
