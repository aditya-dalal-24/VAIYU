"""Turning a contract request into model inputs, and model outputs into a response.

This is where the request payload meets the same feature code the training
pipeline uses. Nothing here invents a value: if a model is untrained, or the
request cannot support inference, the caller gets NOT_AVAILABLE with a reason.

A note on ``confidence``. The contract does not define how it is computed, so
this service uses one definition per analysis and states it:

* **trajectory** -- carried from the checkpoint's recorded validation skill
  against a no-change baseline. It is a property of the trained model, not of
  the individual request, and is omitted entirely when the checkpoint records
  no such metric. It is never synthesised.
* **intensity** -- the trend classifier's own probability for the class it
  chose, which is a genuine per-request quantity.
"""

from __future__ import annotations

import time
from datetime import timedelta, timezone
from typing import List, Optional, Tuple

import numpy as np
import torch

from app.schemas.contract import (
    AnalysisStatus,
    CycloneAnalysisRequest,
    IntensityForecastPoint,
    IntensityPrediction,
    IntensityTrend,
    ModelInfo,
    PredictedPosition,
    TrajectoryPrediction,
)
from models.intensity.model import DEFAULT_TREND_CONFIDENCE_FLOOR, TREND_CLASSES
from preprocessing.features import (
    EnvironmentalData,
    InsufficientHistory,
    Observation,
    build_sequence,
    environmental_features,
    normalise_longitude,
    observations_up_to,
)
from registry.registry import LoadedModel


def _observation(payload) -> Observation:
    return Observation(
        timestamp=payload.timestamp,
        latitude=payload.latitude,
        longitude=payload.longitude,
        wind_speed_kph=payload.wind_speed_kph,
        pressure_hpa=payload.pressure_hpa,
        movement_speed_kph=payload.movement_speed_kph,
        movement_direction_degrees=payload.movement_direction_degrees,
    )


def prepare_inputs(request: CycloneAnalysisRequest) -> Tuple[Observation, list, list, list]:
    """Build the model inputs for a request.

    Raises :class:`InsufficientHistory` when the observations cannot support a
    sequence; the router maps that onto 422 with the contract's error body.

    History is filtered to the current observation's timestamp before the
    sequence is built, so a caller that mistakenly includes a later fix cannot
    leak future information into the prediction.
    """
    current = _observation(request.current_observation)
    history = [_observation(item) for item in request.observation_history]

    combined = observations_up_to([*history, current], current.timestamp)

    steps, mask = build_sequence(combined)

    environment = environmental_features(
        EnvironmentalData(
            sea_surface_temperature_c=(
                request.environmental_data.sea_surface_temperature_c
                if request.environmental_data
                else None
            ),
            humidity_percent=(
                request.environmental_data.humidity_percent
                if request.environmental_data
                else None
            ),
            wind_shear_kph=(
                request.environmental_data.wind_shear_kph
                if request.environmental_data
                else None
            ),
        )
    )

    return current, steps, mask, environment


def _tensors(entry: LoadedModel, steps, mask, environment):
    """Scale inputs with the checkpoint's own scaler and convert to tensors."""
    scaler = entry.checkpoint.scaler

    sequence_array = np.asarray([steps], dtype=np.float32)
    mask_array = np.asarray([mask], dtype=np.float32)
    environment_array = np.asarray([environment], dtype=np.float32)

    scaled_sequence = scaler.transform_sequences(sequence_array, mask_array)
    scaled_environment = scaler.transform_environment(environment_array)

    return (
        torch.from_numpy(np.ascontiguousarray(scaled_sequence)),
        torch.from_numpy(np.ascontiguousarray(mask_array)),
        torch.from_numpy(np.ascontiguousarray(scaled_environment)),
    )


def _model_info(entry: LoadedModel, started: float) -> ModelInfo:
    return ModelInfo(
        name=entry.checkpoint.model_name,
        version=entry.checkpoint.model_version,
        inference_time_ms=int((time.perf_counter() - started) * 1000),
    )


def _recorded_confidence(entry: LoadedModel, key: str) -> Optional[float]:
    """Validation skill recorded at training time, if the checkpoint has it.

    Returns None rather than a placeholder when the metric is absent, so an
    untracked model reports no confidence instead of a made-up one.
    """
    metrics = (entry.checkpoint.metrics or {}) if entry.checkpoint else {}
    value = metrics.get(key)
    if value is None:
        return None
    try:
        return round(max(0.0, min(1.0, float(value))), 3)
    except (TypeError, ValueError):
        return None


def run_trajectory(
    entry: LoadedModel, current: Observation, steps, mask, environment
) -> TrajectoryPrediction:
    """Contract section 9. Positions are the predicted delta applied to the fix."""
    if not entry.is_ready:
        return TrajectoryPrediction(
            status=AnalysisStatus.NOT_AVAILABLE, reason=entry.reason
        )

    started = time.perf_counter()
    sequence, mask_tensor, environment_tensor = _tensors(entry, steps, mask, environment)

    with torch.no_grad():
        deltas = entry.model(sequence, mask_tensor, environment_tensor)[0].tolist()

    positions: List[PredictedPosition] = []
    for horizon, (delta_lat, delta_lon) in zip(entry.checkpoint.horizons, deltas):
        positions.append(
            PredictedPosition(
                forecast_hours=int(horizon),
                timestamp=(current.timestamp + timedelta(hours=int(horizon))).replace(
                    tzinfo=timezone.utc
                ),
                latitude=round(current.latitude + float(delta_lat), 3),
                longitude=round(
                    normalise_longitude(current.longitude + float(delta_lon)), 3
                ),
            )
        )

    return TrajectoryPrediction(
        status=AnalysisStatus.COMPLETED,
        confidence=_recorded_confidence(entry, "validation_skill"),
        predicted_positions=positions,
        model=_model_info(entry, started),
    )


def run_intensity(
    entry: LoadedModel, current: Observation, steps, mask, environment
) -> IntensityPrediction:
    """Contract section 10. Numerical forecast and trend come from separate heads."""
    if not entry.is_ready:
        return IntensityPrediction(
            status=AnalysisStatus.NOT_AVAILABLE, reason=entry.reason
        )

    # Intensity deltas are meaningless without a current wind and pressure to
    # apply them to, and the contract makes both optional on the observation.
    if current.wind_speed_kph is None or current.pressure_hpa is None:
        return IntensityPrediction(
            status=AnalysisStatus.NOT_AVAILABLE,
            reason=(
                "The current observation must include both windSpeedKph and "
                "pressureHpa for an intensity forecast."
            ),
        )

    started = time.perf_counter()
    sequence, mask_tensor, environment_tensor = _tensors(entry, steps, mask, environment)

    with torch.no_grad():
        deltas, trend_logits = entry.model(sequence, mask_tensor, environment_tensor)
        probabilities = torch.softmax(trend_logits, dim=-1)[0]

    forecast: List[IntensityForecastPoint] = []
    for horizon, (delta_wind, delta_pressure) in zip(
        entry.checkpoint.horizons, deltas[0].tolist()
    ):
        forecast.append(
            IntensityForecastPoint(
                forecast_hours=int(horizon),
                # Wind cannot go negative; pressure is left unclamped because a
                # deep low is physical and clamping would hide a bad model.
                wind_speed_kph=round(
                    max(0.0, current.wind_speed_kph + float(delta_wind)), 1
                ),
                pressure_hpa=round(current.pressure_hpa + float(delta_pressure), 1),
            )
        )

    best = int(torch.argmax(probabilities).item())
    confidence = float(probabilities[best].item())

    # UNCERTAIN is the model declining to commit, not a learned class.
    if confidence < DEFAULT_TREND_CONFIDENCE_FLOOR:
        trend = IntensityTrend.UNCERTAIN
    else:
        trend = IntensityTrend(TREND_CLASSES[best])

    return IntensityPrediction(
        status=AnalysisStatus.COMPLETED,
        trend=trend,
        confidence=round(confidence, 3),
        forecast=forecast,
        model=_model_info(entry, started),
    )
