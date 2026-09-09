"""Health endpoint (contract section 4)."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.contract import HealthResponse
from registry.registry import get_registry

router = APIRouter(prefix="/api/v1", tags=["health"])

SERVICE_NAME = "cyclovision-ai-service"
SERVICE_VERSION = "1.0.0"


@router.get("/health", response_model=HealthResponse, response_model_exclude_none=True)
def health() -> HealthResponse:
    """Report service liveness and which models are actually loaded.

    ``status``, ``service`` and ``version`` are exactly the contract's fields.
    ``models`` is an additive optional extension (section 18) so an operator can
    tell an untrained deployment from a trained one without reading logs -- the
    service is UP either way, because it answers requests either way.
    """
    return HealthResponse(
        status="UP",
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
        models=get_registry().summary(),
    )
