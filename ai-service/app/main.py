"""CycloVision AI inference service.

An internal service: the React frontend never calls it directly, Spring Boot
does (contract section 1). All endpoints live under /api/v1 (section 2).

The service starts and serves whether or not models are trained. With no
checkpoints present it answers every analysis with NOT_AVAILABLE and a reason,
which is a supported state -- section 2 requires reporting unavailability
rather than fabricating output.
"""

from __future__ import annotations

import logging
import os
import sys

# Running "python app/main.py" puts app/ on sys.path rather than the service
# root, which would break the package imports below.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone  # noqa: E402
from typing import Optional  # noqa: E402

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from app.routers import analysis, health  # noqa: E402
from app.routers.health import SERVICE_NAME, SERVICE_VERSION  # noqa: E402
from app.schemas.contract import AnalysisStatus, ErrorResponse  # noqa: E402

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CycloVision AI Service",
    description=(
        "Internal AI/ML inference service. See "
        "'CycloVision AI Service Contract.txt' for the authoritative contract."
    ),
    version=SERVICE_VERSION,
)

# Spring Boot is the only intended caller and the service is not publicly
# exposed, so this stays permissive for local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analysis.router)


def _error(
    status_code: int,
    error_code: str,
    message: str,
    request_id: Optional[str] = None,
) -> JSONResponse:
    """Contract section 13 error shape, with no internals leaked."""
    payload = ErrorResponse(
        timestamp=datetime.now(timezone.utc),
        status=AnalysisStatus.VALIDATION_ERROR
        if status_code < 500
        else AnalysisStatus.FAILED,
        error_code=error_code,
        message=message,
        request_id=request_id,
    )
    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(mode="json", by_alias=True, exclude_none=True),
    )


def _requested_id(error: RequestValidationError) -> Optional[str]:
    """Recover requestId from a payload that failed validation.

    Section 13 puts requestId in the error body, and a client correlating a
    failure needs it most when the request was rejected. It is echoed only when
    it is genuinely a string in the body -- never invented, and never trusted
    for anything but correlation.
    """
    body = getattr(error, "body", None)
    if isinstance(body, dict):
        candidate = body.get("requestId") or body.get("request_id")
        if isinstance(candidate, str) and candidate.strip():
            return candidate[:200]
    return None


@app.exception_handler(RequestValidationError)
def handle_validation_error(request: Request, error: RequestValidationError):
    """Malformed payload -> 400.

    FastAPI's default is 422, which section 14 reserves for structurally valid
    input the models cannot work with. A schema violation is a bad request.
    """
    first = error.errors()[0] if error.errors() else {}
    location = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
    detail = first.get("msg", "Request failed validation.")
    message = f"{location}: {detail}" if location else detail
    return _error(400, "INVALID_REQUEST", message, _requested_id(error))


@app.exception_handler(Exception)
def handle_unexpected_error(request: Request, error: Exception):
    """Unexpected failure -> 500, with no stack trace on the wire (section 13)."""
    logger.exception("unhandled error")
    return _error(500, "INTERNAL_ERROR", "An unexpected error occurred.")


@app.get("/", include_in_schema=False)
def root():
    """Service banner. Reports what is loaded, never what is aspired to."""
    from registry.registry import get_registry

    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "endpoints": ["/api/v1/health", "/api/v1/analysis/cyclone"],
        "models": get_registry().summary(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
