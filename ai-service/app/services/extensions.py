"""Extension point for analyses that have no model yet.

Historical similarity (contract section 11) is listed in section 17 as work to
add after the MVP. It is wired into the request and response shapes so adding a
model later needs no contract change, but it produces no output: section 2
requires unavailability to be reported, not filled in.

Satellite analysis used to live here too. It is now implemented in
``app/services/satellite_inference.py``.

To implement historical similarity
----------------------------------
Replace the body below with real inference and return COMPLETED with the fields
the contract defines. The router, response schema and overall-status logic
already handle a completed block, so nothing outside this module changes.
"""

from __future__ import annotations

from app.schemas.contract import (
    AnalysisStatus,
    CycloneAnalysisRequest,
    HistoricalSimilarity,
)

NOT_IMPLEMENTED_REASON = (
    "No model is implemented for this analysis on this service instance."
)


def run_historical_similarity(
    request: CycloneAnalysisRequest,
) -> HistoricalSimilarity:
    """Contract section 11. No similarity index exists; returns NOT_AVAILABLE.

    When implemented, this returns identifiers and scores only -- Spring Boot
    enriches the historical record from the application database.
    """
    return HistoricalSimilarity(
        status=AnalysisStatus.NOT_AVAILABLE,
        reason=NOT_IMPLEMENTED_REASON,
        similar_cyclones=[],
    )
