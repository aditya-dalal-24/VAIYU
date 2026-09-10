"""Pydantic schemas for the CycloVision AI Service Contract.

Field names and shapes follow the contract document exactly (sections 4-14).
The wire format is camelCase; Python attributes stay snake_case, bridged by a
generated alias.

Section 18 forbids silently renaming fields, so treat the aliases here as the
published surface: grow it with optional fields, and cut a new API version for
anything breaking.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(word.capitalize() for word in rest)


class ContractModel(BaseModel):
    """Base: camelCase on the wire, snake_case in Python."""

    model_config = ConfigDict(
        alias_generator=_camel,
        populate_by_name=True,
        protected_namespaces=(),
    )


class AnalysisStatus(str, Enum):
    """Contract section 7. These are the only permitted status values."""

    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    NOT_AVAILABLE = "NOT_AVAILABLE"
    FAILED = "FAILED"
    VALIDATION_ERROR = "VALIDATION_ERROR"


class AnalysisType(str, Enum):
    """Requestable analyses (contract section 5)."""

    SATELLITE_ANALYSIS = "SATELLITE_ANALYSIS"
    TRAJECTORY_PREDICTION = "TRAJECTORY_PREDICTION"
    INTENSITY_PREDICTION = "INTENSITY_PREDICTION"
    HISTORICAL_SIMILARITY = "HISTORICAL_SIMILARITY"


class IntensityTrend(str, Enum):
    """Contract section 10."""

    INTENSIFYING = "INTENSIFYING"
    WEAKENING = "WEAKENING"
    STABLE = "STABLE"
    UNCERTAIN = "UNCERTAIN"


# ---------------------------------------------------------------------------
# Request (contract section 5)
# ---------------------------------------------------------------------------


class ObservationPayload(ContractModel):
    """One cyclone fix. Coordinates in decimal degrees, timestamps ISO-8601 UTC."""

    timestamp: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    wind_speed_kph: Optional[float] = Field(default=None, ge=0)
    pressure_hpa: Optional[float] = Field(default=None, gt=0)
    movement_speed_kph: Optional[float] = Field(default=None, ge=0)
    movement_direction_degrees: Optional[float] = Field(default=None, ge=0, le=360)


class EnvironmentalDataPayload(ContractModel):
    sea_surface_temperature_c: Optional[float] = None
    humidity_percent: Optional[float] = Field(default=None, ge=0, le=100)
    wind_shear_kph: Optional[float] = Field(default=None, ge=0)


class SatelliteImagePayload(ContractModel):
    """A reference to imagery. Binaries never travel inside the JSON body."""

    image_url: str = Field(min_length=1)
    image_type: Optional[str] = None
    captured_at: Optional[datetime] = None


class CycloneAnalysisRequest(ContractModel):
    request_id: str = Field(min_length=1)
    cyclone_id: str = Field(min_length=1)
    analysis_types: List[AnalysisType] = Field(min_length=1)
    current_observation: ObservationPayload
    # Ordered oldest to newest, per the rules under section 5.
    observation_history: List[ObservationPayload] = Field(default_factory=list)
    environmental_data: Optional[EnvironmentalDataPayload] = None
    satellite_image: Optional[SatelliteImagePayload] = None

    @field_validator("observation_history")
    @classmethod
    def _check_ordering(cls, history: List[ObservationPayload]):
        """Reject history that is not oldest-to-newest.

        The contract states the ordering as a rule, so a caller breaking it is
        a malformed request rather than something to silently sort away: out of
        order history usually means the caller assembled it wrongly.
        """
        timestamps = [item.timestamp for item in history]
        if any(later < earlier for earlier, later in zip(timestamps, timestamps[1:])):
            raise ValueError(
                "observationHistory must be ordered oldest to newest"
            )
        return history


# ---------------------------------------------------------------------------
# Response (contract section 6)
# ---------------------------------------------------------------------------


class ModelInfo(ContractModel):
    """Contract section 15.

    ``inferenceTimeMs``, ``trainingDatasetVersion`` and ``featureSetVersion``
    are the optional metadata section 15 names. The last two matter when
    training and serving happen on different machines: they say which data and
    which feature layout produced the prediction, which is otherwise
    guesswork once a checkpoint has been copied between hosts.
    """

    name: str
    version: str
    inference_time_ms: Optional[int] = None
    training_dataset_version: Optional[str] = None
    feature_set_version: Optional[str] = None


class AnalysisBlock(ContractModel):
    """Common head of every analysis section.

    ``reason`` is an optional extension carrying why a block did not complete.
    Section 2 requires unavailability to be reported plainly rather than
    papered over with a fabricated result.
    """

    status: AnalysisStatus
    reason: Optional[str] = None
    model: Optional[ModelInfo] = None


class Coordinate(ContractModel):
    latitude: float
    longitude: float


class SatelliteFeatures(ContractModel):
    eye_detected: Optional[bool] = None
    spiral_structure_detected: Optional[bool] = None
    cloud_density: Optional[float] = None


class SatelliteAnalysis(AnalysisBlock):
    """Contract section 8. Future extension point; no model implemented."""

    cyclone_detected: Optional[bool] = None
    confidence: Optional[float] = None
    cyclone_center: Optional[Coordinate] = None
    features: Optional[SatelliteFeatures] = None
    gradcam_image_url: Optional[str] = None


class PredictedPosition(ContractModel):
    forecast_hours: int
    timestamp: datetime
    latitude: float
    longitude: float
    # Section 9 allows an uncertainty radius as an extension, and the Spring
    # client draws the map's forecast cone from it. It carries the model's own
    # held-out mean error at this horizon -- a measurement, never a guess -- and
    # stays absent when no evaluation recorded one.
    uncertainty_radius_km: Optional[float] = Field(default=None, ge=0)


class TrajectoryPrediction(AnalysisBlock):
    """Contract section 9."""

    confidence: Optional[float] = None
    predicted_positions: List[PredictedPosition] = Field(default_factory=list)


class IntensityForecastPoint(ContractModel):
    forecast_hours: int
    wind_speed_kph: float
    pressure_hpa: float


class IntensityPrediction(AnalysisBlock):
    """Contract section 10. Trend stays separate from the numerical forecast."""

    trend: Optional[IntensityTrend] = None
    confidence: Optional[float] = None
    forecast: List[IntensityForecastPoint] = Field(default_factory=list)


class SimilarCyclone(ContractModel):
    historical_cyclone_id: str
    similarity_score: float
    rank: int
    similarity_basis: List[str] = Field(default_factory=list)
    # Optional labels from a model index. Section 11 keeps the application
    # database authoritative for the historical record, so these are a
    # convenience for display and are omitted when the index has no name.
    historical_cyclone_name: Optional[str] = None
    season: Optional[int] = None


class HistoricalSimilarity(AnalysisBlock):
    """Contract section 11. Future extension point; no model implemented."""

    similar_cyclones: List[SimilarCyclone] = Field(default_factory=list)


class Explanation(ContractModel):
    """Contract section 12. Must be derived from model output, never written."""

    analysis_type: AnalysisType
    factor: str
    direction: str
    importance: float


class CycloneAnalysisResponse(ContractModel):
    request_id: str
    cyclone_id: str
    analysis_timestamp: datetime
    status: AnalysisStatus
    satellite_analysis: Optional[SatelliteAnalysis] = None
    trajectory_prediction: Optional[TrajectoryPrediction] = None
    intensity_prediction: Optional[IntensityPrediction] = None
    historical_similarity: Optional[HistoricalSimilarity] = None
    explanations: List[Explanation] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Health and errors (contract sections 4 and 13)
# ---------------------------------------------------------------------------


class HealthResponse(ContractModel):
    """Contract section 4.

    ``status``, ``service`` and ``version`` are the contract-required fields.
    ``models`` is an optional additive extension (section 18) reporting which
    models are actually loaded.
    """

    status: str
    service: str
    version: str
    models: Optional[dict] = None


class ErrorResponse(ContractModel):
    """Contract section 13. Carries no stack trace, secret or internal path."""

    timestamp: datetime
    status: AnalysisStatus
    error_code: str
    message: str
    request_id: Optional[str] = None
