"""Satellite detection evaluation (contract section 8).

Classification scores, reported with the context that makes them meaningful:

* **A majority-class baseline.** With a modest test set, answering with the
  commoner class alone can look respectable. A model that does not clear that
  bar has learned nothing, and accuracy alone will not show it.
* **Per-storm accuracy.** Frames of one cyclone are near-duplicates, so a test
  split of a handful of storms can be carried by one easy case. The aggregate
  hides that; the breakdown does not.
* **Per-source accuracy.** The model is trained across sensors and bands. If it
  works on one source and fails on another, that is the single most important
  thing to know before pointing it at a new feed, and it is invisible in a
  pooled score.

Nothing here is computed until a model has actually been trained.
"""

from __future__ import annotations

from typing import Dict, List, Sequence

import numpy as np
import torch

from models.base import device_of
from preprocessing.satellite import SatelliteFrame


@torch.no_grad()
def predict_probabilities(model, loader) -> tuple:
    """Run the model over a loader, returning probabilities and labels."""
    model.eval()
    device = device_of(model)
    probabilities: List[float] = []
    labels: List[float] = []

    for images, sources, targets in loader:
        logits = model(images.to(device), sources.to(device))
        probabilities.extend(torch.sigmoid(logits).reshape(-1).tolist())
        labels.extend(targets.reshape(-1).tolist())

    return np.asarray(probabilities), np.asarray(labels)


def classification_scores(
    probabilities: np.ndarray, labels: np.ndarray, threshold: float = 0.5
) -> Dict[str, object]:
    """Accuracy, precision, recall, F1 and the baseline that contextualises them."""
    if labels.size == 0:
        return {}

    predictions = (probabilities >= threshold).astype(float)

    true_positive = float(((predictions == 1) & (labels == 1)).sum())
    false_positive = float(((predictions == 1) & (labels == 0)).sum())
    false_negative = float(((predictions == 0) & (labels == 1)).sum())
    true_negative = float(((predictions == 0) & (labels == 0)).sum())

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
    f1 = (
        2 * precision * recall / (precision + recall) if precision + recall else 0.0
    )

    positive_rate = float(labels.mean())
    majority = max(positive_rate, 1.0 - positive_rate)
    accuracy = float((predictions == labels).mean())

    return {
        "n": int(labels.size),
        "accuracy": round(accuracy, 3),
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "positive_rate": round(positive_rate, 3),
        "majority_class_baseline": round(majority, 3),
        "beats_majority_baseline": bool(accuracy > majority),
        "confusion_matrix": {
            "true_positive": int(true_positive),
            "false_positive": int(false_positive),
            "true_negative": int(true_negative),
            "false_negative": int(false_negative),
        },
    }


def _grouped_accuracy(
    probabilities: np.ndarray,
    labels: np.ndarray,
    keys: Sequence[str],
    threshold: float = 0.5,
) -> Dict[str, Dict[str, float]]:
    """Accuracy within each group, with its sample count."""
    predictions = (probabilities >= threshold).astype(float)
    correct = predictions == labels

    grouped: Dict[str, List[bool]] = {}
    for key, hit in zip(keys, correct):
        grouped.setdefault(str(key), []).append(bool(hit))

    return {
        key: {"n": len(hits), "accuracy": round(float(np.mean(hits)), 3)}
        for key, hits in sorted(grouped.items())
    }


def evaluate_satellite(
    model,
    loader,
    frames: Sequence[SatelliteFrame],
    threshold: float = 0.5,
) -> Dict[str, object]:
    """Full evaluation over a held-out split.

    ``frames`` must be in the same order the loader yields them, which holds
    when the loader is built with ``shuffle=False``.
    """
    probabilities, labels = predict_probabilities(model, loader)
    if labels.size == 0:
        return {}

    scores = classification_scores(probabilities, labels, threshold)

    scores["per_storm_accuracy"] = _grouped_accuracy(
        probabilities, labels, [frame.cyclone_id for frame in frames], threshold
    )
    scores["per_source_accuracy"] = _grouped_accuracy(
        probabilities, labels, [frame.source_key for frame in frames], threshold
    )

    basins = [frame.ocean_basin for frame in frames if frame.ocean_basin]
    if len(basins) == len(frames):
        scores["per_basin_accuracy"] = _grouped_accuracy(
            probabilities, labels, basins, threshold
        )

    scores["test_storms"] = len({frame.cyclone_id for frame in frames})

    return scores


def format_report(metrics: Dict[str, object]) -> List[str]:
    """Human-readable lines for logging after an evaluation run."""
    if not metrics:
        return ["no evaluation data"]

    lines = [
        f"accuracy {metrics['accuracy']:.3f} "
        f"(majority baseline {metrics['majority_class_baseline']:.3f}) "
        f"| precision {metrics['precision']:.3f} "
        f"| recall {metrics['recall']:.3f} "
        f"| f1 {metrics['f1']:.3f}  (n={metrics['n']})"
    ]

    for label, key in (("per storm", "per_storm_accuracy"), ("per source", "per_source_accuracy")):
        group = metrics.get(key) or {}
        if group:
            detail = ", ".join(
                f"{name}={scores['accuracy']:.2f}" for name, scores in group.items()
            )
            lines.append(f"{label}: {detail}")

    return lines
