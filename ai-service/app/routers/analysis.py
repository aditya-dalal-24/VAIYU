"""Unified analysis endpoint (contract sections 5, 6, 13 and 14).

The four specialised endpoints listed in section 3 are explicitly future work;
section 17 asks for the unified endpoint first, and ``analysisTypes`` already
selects between the same analyses.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Response, status as http_status
from fastapi.responses import JSONResponse

from app.schemas.contract import (
    AnalysisStatus,
    CycloneAnalysisRequest,
    CycloneAnalysisResponse,
    ErrorResponse,
)
from app.services.analysis_service import analyse
from preprocessing.features import InsufficientHistory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["analysis"])


def error_body(
    error_code: str,
    message: str,
    request_id: Optional[str] = None,
    status: AnalysisStatus = AnalysisStatus.VALIDATION_ERROR,
) -> dict:
    """Contract section 13 error payload, camelCased for the wire."""
    return ErrorResponse(
        timestamp=datetime.now(timezone.utc),
        status=status,
        error_code=error_code,
        message=message,
        request_id=request_id,
    ).model_dump(mode="json", by_alias=True, exclude_none=True)


@router.post(
    "/analysis/cyclone",
    response_model=CycloneAnalysisResponse,
    response_model_exclude_none=True,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def analyse_cyclone(request: CycloneAnalysisRequest, response: Response):
    """Run the requested analyses.

    Status mapping follows section 14: 200 when anything completed or partially
    completed, 422 when the payload is valid but too thin to model, 503 when no
    requested analysis could run at all.
    """
    try:
        result = analyse(request)

    except InsufficientHistory as error:
        # Valid JSON, insufficient model input. Returned as a raw JSONResponse
        # because the declared response_model is the success schema and would
        # otherwise reject the error body.
        return JSONResponse(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_body(error.error_code, str(error), request.request_id),
        )

    except Exception:  # noqa: BLE001 - nothing below the router should escape
        logger.exception("unexpected failure during analysis")
        return JSONResponse(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_body(
                "INTERNAL_ERROR",
                "An unexpected error occurred during analysis.",
                request.request_id,
                AnalysisStatus.FAILED,
            ),
        )

    if result.status is AnalysisStatus.NOT_AVAILABLE:
        # Nothing requested could run: the models are absent, not the input.
        response.status_code = http_status.HTTP_503_SERVICE_UNAVAILABLE
    elif result.status is AnalysisStatus.FAILED:
        response.status_code = http_status.HTTP_500_INTERNAL_SERVER_ERROR

    return result
