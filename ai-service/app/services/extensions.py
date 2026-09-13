"""Historical similarity (contract section 11), served by the analogue ensemble.

The index is built offline by ``training/build_analogue_index.py`` and read from
the checkpoint directory. Without one, the analysis reports NOT_AVAILABLE with a
reason, exactly like an untrained model: section 2 requires unavailability to be
reported, not filled in.

What is returned
----------------
* ``similarCyclones`` -- the contract's evidence list: archive storm ids (IBTrACS
  SIDs), a similarity score and the basis the match used. Spring Boot enriches
  the historical record from its own database, as section 11 says.
* ``analogueForecast`` -- what those storms did next, applied to this storm's
  position and averaged, with the members' spread. An optional additive field.
* ``confidence`` -- the ensemble's measured skill against persistence on
  held-out storms, recorded when the index was built. Absent if not measured.

Explainability (section 12) remains an extension point and is not produced
here.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from datetime import timedelta, timezone
from typing import Dict, Optional, Tuple

from registry.registry import position_evaluation

from app.schemas.contract import (
    AnalogueForecastPoint,
    AnalysisStatus,
    CycloneAnalysisRequest,
    HistoricalSimilarity,
    ModelInfo,
    SimilarCyclone,
)

logger = logging.getLogger(__name__)

NO_INDEX_REASON = "No analogue index has been built on this service instance."
INVALID_INDEX_REASON = (
    "The analogue index on this service instance could not be loaded."
)
SHORT_HISTORY_REASON = (
    "Analogue matching needs a current wind speed and at least 12 hours of "
    "observation history."
)
NO_ANALOGUES_REASON = (
    "No archive storm finished before this observation time in the same "
    "hemisphere, so there is nothing to compare against."
)

# Kept for callers and tests that referred to the old stub's reason.
NOT_IMPLEMENTED_REASON = NO_INDEX_REASON

_cache: Dict[str, Tuple[float, object]] = {}
_lock = threading.Lock()


def _checkpoint_dir() -> str:
    from registry.registry import get_registry

    return get_registry().checkpoint_dir


def load_index(directory: Optional[str] = None):
    """Return ``(index, reason)``; the index is cached until its file changes."""
    from models.analogue.index import ARRAYS_FILENAME, AnalogueIndex

    directory = directory or _checkpoint_dir()
    path = os.path.join(directory, ARRAYS_FILENAME)
    if not os.path.exists(path):
        return None, NO_INDEX_REASON

    stamp = os.path.getmtime(path)
    with _lock:
        cached = _cache.get(directory)
        if cached and cached[0] == stamp:
            return cached[1], None
        try:
            index = AnalogueIndex.load(directory)
        except Exception:  # noqa: BLE001 - any unreadable index is one outcome
            logger.exception("analogue index could not be loaded")
            return None, INVALID_INDEX_REASON
        _cache[directory] = (stamp, index)
        return index, None


def summary(directory: Optional[str] = None) -> Dict[str, object]:
    """Health-endpoint entry, in the same shape as the neural models'."""
    index, reason = load_index(directory)
    if index is None:
        return {"available": False,
                "state": "UNTRAINED" if reason == NO_INDEX_REASON else "CHECKPOINT_INVALID",
                "reason": reason}
    meta = index.metadata
    return {
        "available": True,
        "state": "TRAINED",
        "model": meta.get("model_name"),
        "version": meta.get("model_version"),
        "horizons": meta.get("horizons"),
        "analogueStorms": index.storm_count,
        "trainedAt": meta.get("built_at"),
        "evaluation": position_evaluation(meta.get("metrics")),
    }


def run_historical_similarity(request: CycloneAnalysisRequest) -> HistoricalSimilarity:
    """Contract section 11: analogue storms, and what they did next."""
    from app.services.inference import _observation
    from models.analogue.index import (
        DEFAULT_LISTED,
        DEFAULT_MEMBERS,
        motion_from,
        query_from_track,
        similarity_score,
    )
    from preprocessing.features import observations_up_to

    index, reason = load_index()
    if index is None:
        return HistoricalSimilarity(status=AnalysisStatus.NOT_AVAILABLE, reason=reason)

    started = time.perf_counter()
    current = _observation(request.current_observation)
    history = [_observation(item) for item in request.observation_history]
    track = observations_up_to([*history, current], current.timestamp)

    described = query_from_track(track) if track else None
    if described is None:
        return HistoricalSimilarity(
            status=AnalysisStatus.NOT_AVAILABLE, reason=SHORT_HISTORY_REASON
        )
    newest, vector, present = described

    members = int(index.metadata.get("members") or DEFAULT_MEMBERS)
    chosen = index.query(
        vector, present, newest.timestamp, newest.latitude, newest.longitude, members=members
    )
    if not chosen:
        return HistoricalSimilarity(
            status=AnalysisStatus.NOT_AVAILABLE, reason=NO_ANALOGUES_REASON
        )

    basis = index.groups_used(present)
    similar = []
    for rank, pick in enumerate(chosen[:DEFAULT_LISTED], start=1):
        row = pick["row"]
        season = int(index.seasons[row])
        name = str(index.storm_names[row]).strip()
        similar.append(SimilarCyclone(
            historical_cyclone_id=str(index.storm_ids[row]),
            similarity_score=similarity_score(pick["distance"]),
            rank=rank,
            similarity_basis=basis,
            historical_cyclone_name=name if name and name.upper() not in {"NOT_NAMED", "UNNAMED", "NAN"} else None,
            season=season if season > 0 else None,
        ))

    base_time = newest.timestamp.replace(tzinfo=timezone.utc)
    forecast = [
        AnalogueForecastPoint(
            forecast_hours=point["forecast_hours"],
            timestamp=base_time + timedelta(hours=point["forecast_hours"]),
            latitude=point["latitude"],
            longitude=point["longitude"],
            wind_speed_kph=point["wind_speed_kph"],
            spread_km=point["spread_km"],
            member_count=point["member_count"],
        )
        for point in index.forecast(
            chosen, newest.latitude, newest.longitude, newest.wind_speed_kph,
            motion_6h=motion_from(vector, present),
        )
    ]

    meta = index.metadata
    metrics = meta.get("metrics") or {}
    skill = metrics.get("validation_skill")
    return HistoricalSimilarity(
        status=AnalysisStatus.COMPLETED,
        similar_cyclones=similar,
        confidence=round(float(skill), 3) if isinstance(skill, (int, float)) else None,
        analogue_forecast=forecast,
        model=ModelInfo(
            name=str(meta.get("model_name") or "analogue-ensemble-v1"),
            version=str(meta.get("model_version") or "1.0"),
            inference_time_ms=int((time.perf_counter() - started) * 1000),
            training_dataset_version=meta.get("dataset_version"),
        ),
    )
