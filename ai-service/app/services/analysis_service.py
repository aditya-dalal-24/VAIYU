"""Orchestrates the unified analysis endpoint.

Each requested analysis runs independently, which is what contract section 2
means by partial analysis: absent imagery must not prevent a trajectory
forecast when the numerical data is there. One analysis failing or being
unavailable never stops another from running.

Overall status follows section 7:

* every requested block completed          -> COMPLETED
* some completed, some did not             -> PARTIAL
* none completed                           -> NOT_AVAILABLE
* an unexpected failure inside an analysis -> that block is FAILED
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List

from app.schemas.contract import (
    AnalysisStatus,
    AnalysisType,
    CycloneAnalysisRequest,
    CycloneAnalysisResponse,
    IntensityPrediction,
    SatelliteAnalysis,
    TrajectoryPrediction,
)
from app.services import extensions
from app.services.inference import prepare_inputs, run_intensity, run_trajectory
from app.services.satellite_inference import run_satellite
from preprocessing.features import InsufficientHistory
from registry.registry import ModelRegistry, get_registry

logger = logging.getLogger(__name__)

# Analyses that need a feature sequence. If none of these is requested, the
# request needs no observation history and must not be rejected for lacking it.
SEQUENCE_ANALYSES = {
    AnalysisType.TRAJECTORY_PREDICTION,
    AnalysisType.INTENSITY_PREDICTION,
}

FAILURE_REASON = "The analysis failed unexpectedly on this service instance."


def analyse(
    request: CycloneAnalysisRequest, registry: ModelRegistry | None = None
) -> CycloneAnalysisResponse:
    """Run every requested analysis and assemble the contract response.

    Raises :class:`InsufficientHistory` only when a sequence-based analysis was
    requested and the observations cannot support one; the router turns that
    into 422.
    """
    registry = registry or get_registry()
    requested = set(request.analysis_types)

    response = CycloneAnalysisResponse(
        request_id=request.request_id,
        cyclone_id=request.cyclone_id,
        analysis_timestamp=datetime.now(timezone.utc),
        status=AnalysisStatus.NOT_AVAILABLE,
    )

    current = steps = mask = environment = None
    if requested & SEQUENCE_ANALYSES:
        # Deliberately not caught: a caller asking for a forecast without
        # enough history gets 422, which section 14 reserves for exactly this.
        current, steps, mask, environment = prepare_inputs(request)

    if AnalysisType.TRAJECTORY_PREDICTION in requested:
        try:
            response.trajectory_prediction = run_trajectory(
                registry.trajectory, current, steps, mask, environment
            )
        except Exception:  # noqa: BLE001 - one analysis must not sink the rest
            logger.exception("trajectory analysis failed")
            response.trajectory_prediction = TrajectoryPrediction(
                status=AnalysisStatus.FAILED, reason=FAILURE_REASON
            )

    if AnalysisType.INTENSITY_PREDICTION in requested:
        try:
            response.intensity_prediction = run_intensity(
                registry.intensity, current, steps, mask, environment
            )
        except Exception:  # noqa: BLE001
            logger.exception("intensity analysis failed")
            response.intensity_prediction = IntensityPrediction(
                status=AnalysisStatus.FAILED, reason=FAILURE_REASON
            )

    if AnalysisType.SATELLITE_ANALYSIS in requested:
        try:
            response.satellite_analysis = run_satellite(registry.satellite, request)
        except Exception:  # noqa: BLE001 - one analysis must not sink the rest
            logger.exception("satellite analysis failed")
            response.satellite_analysis = SatelliteAnalysis(
                status=AnalysisStatus.FAILED, reason=FAILURE_REASON
            )

    if AnalysisType.HISTORICAL_SIMILARITY in requested:
        response.historical_similarity = extensions.run_historical_similarity(request)

    response.status = _overall_status(
        [
            block.status
            for block in (
                response.trajectory_prediction,
                response.intensity_prediction,
                response.satellite_analysis,
                response.historical_similarity,
            )
            if block is not None
        ]
    )

    return response


def _overall_status(statuses: List[AnalysisStatus]) -> AnalysisStatus:
    """Combine per-analysis statuses into the top-level one (section 7)."""
    if not statuses:
        return AnalysisStatus.NOT_AVAILABLE

    completed = [status for status in statuses if status is AnalysisStatus.COMPLETED]

    if len(completed) == len(statuses):
        return AnalysisStatus.COMPLETED
    if completed:
        return AnalysisStatus.PARTIAL
    if any(status is AnalysisStatus.FAILED for status in statuses):
        return AnalysisStatus.FAILED
    return AnalysisStatus.NOT_AVAILABLE
