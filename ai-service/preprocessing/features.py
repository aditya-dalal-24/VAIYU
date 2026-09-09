"""Feature definition shared by training and inference.

This module is the single place a cyclone observation becomes a numeric vector.
Training scripts and the FastAPI request handlers both call into it, which is
what stops a model being fed differently at serve time than it was at fit time
-- the most common and least visible cause of a model that scores well offline
and behaves badly in production.

Units follow the contract (section 2): decimal degrees, kilometres per hour,
hectopascals, ISO-8601 UTC timestamps.

Temporal safety
---------------
Every function here builds a feature vector for a step at time T from that step
and earlier steps only. Nothing in this module can see forward in time, which
is the first of the two leakage defences (the second is the cyclone-level split
in ``preprocessing.splits``).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Sequence

# Contract section 13 gives INSUFFICIENT_OBSERVATION_HISTORY as an error with
# "At least three observations are required." That is the floor enforced here.
MIN_OBSERVATIONS = 3

# Per-step features, in a fixed order. Models are built against this length, so
# appending a feature is a retrain, and reordering silently corrupts a loaded
# checkpoint -- hence FEATURE_SET_VERSION below.
STEP_FEATURE_NAMES: List[str] = [
    "latitude",
    "abs_latitude",
    "longitude_sin",
    "longitude_cos",
    "wind_speed_kph",
    "pressure_hpa",
    "movement_speed_kph",
    "heading_sin",
    "heading_cos",
    "delta_hours",
    "wind_delta",
    "pressure_delta",
    "lat_delta",
    "lon_delta",
    "month_sin",
    "month_cos",
]

# Environmental fields are optional in the contract, so each carries a presence
# flag rather than being silently imputed to a value the model reads as real.
ENVIRONMENTAL_FEATURE_NAMES: List[str] = [
    "sea_surface_temperature_c",
    "sea_surface_temperature_present",
    "humidity_percent",
    "humidity_present",
    "wind_shear_kph",
    "wind_shear_present",
]

STEP_FEATURE_COUNT = len(STEP_FEATURE_NAMES)
ENVIRONMENTAL_FEATURE_COUNT = len(ENVIRONMENTAL_FEATURE_NAMES)

# Bumped whenever the feature layout changes. A checkpoint records the version
# it was trained with, and the registry refuses to load a mismatch instead of
# serving quietly wrong numbers.
FEATURE_SET_VERSION = "1.0"

# Sequence length fed to the encoder. Shorter histories are padded on the right
# and masked; longer ones keep the most recent steps.
SEQUENCE_LENGTH = 8

# Neutral stand-ins for absent optional fields, paired with a presence flag so
# the model can tell "missing" from "genuinely this value".
DEFAULT_SEA_SURFACE_TEMPERATURE_C = 28.0
DEFAULT_HUMIDITY_PERCENT = 75.0
DEFAULT_WIND_SHEAR_KPH = 15.0

EARTH_RADIUS_KM = 6371.0


@dataclass(frozen=True)
class Observation:
    """One cyclone fix in contract units.

    ``timestamp`` is always stored as naive UTC. Mixing aware and naive values
    makes ordering comparisons raise at runtime, so conversion happens once, on
    the way in.
    """

    timestamp: datetime
    latitude: float
    longitude: float
    wind_speed_kph: Optional[float] = None
    pressure_hpa: Optional[float] = None
    movement_speed_kph: Optional[float] = None
    movement_direction_degrees: Optional[float] = None

    def __post_init__(self) -> None:
        if self.timestamp.tzinfo is not None:
            object.__setattr__(
                self,
                "timestamp",
                self.timestamp.astimezone(timezone.utc).replace(tzinfo=None),
            )


@dataclass(frozen=True)
class EnvironmentalData:
    """Optional environmental context (contract section 5)."""

    sea_surface_temperature_c: Optional[float] = None
    humidity_percent: Optional[float] = None
    wind_shear_kph: Optional[float] = None


class InsufficientHistory(Exception):
    """Raised when a sequence cannot be built from the supplied observations.

    Carries ``error_code`` so the API layer can map it onto the contract's
    error response (section 13) without inspecting the message text.
    """

    def __init__(self, message: str, error_code: str = "INSUFFICIENT_OBSERVATION_HISTORY"):
        super().__init__(message)
        self.error_code = error_code


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(min(1.0, math.sqrt(a) ** 2)))


def bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing from point 1 to point 2, in degrees clockwise from north."""
    d_lon = math.radians(lon2 - lon1)
    y = math.sin(d_lon) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(
        math.radians(lat1)
    ) * math.cos(math.radians(lat2)) * math.cos(d_lon)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def normalise_longitude(longitude: float) -> float:
    """Wrap a longitude into [-180, 180)."""
    return ((longitude + 180.0) % 360.0) - 180.0


def _step_features(
    current: Observation, previous: Optional[Observation]
) -> List[float]:
    """Feature vector for one step, relative to the step before it.

    ``previous`` is the preceding observation in the same track, or None for
    the first step, in which case every rate-of-change feature is zero rather
    than borrowed from another storm.
    """
    longitude = math.radians(normalise_longitude(current.longitude))

    wind = current.wind_speed_kph if current.wind_speed_kph is not None else 0.0
    pressure = current.pressure_hpa if current.pressure_hpa is not None else 0.0

    if previous is None:
        delta_hours = 0.0
        wind_delta = 0.0
        pressure_delta = 0.0
        lat_delta = 0.0
        lon_delta = 0.0
    else:
        delta_hours = (current.timestamp - previous.timestamp).total_seconds() / 3600.0
        previous_wind = previous.wind_speed_kph if previous.wind_speed_kph is not None else wind
        previous_pressure = (
            previous.pressure_hpa if previous.pressure_hpa is not None else pressure
        )
        wind_delta = wind - previous_wind
        pressure_delta = pressure - previous_pressure
        lat_delta = current.latitude - previous.latitude
        lon_delta = normalise_longitude(current.longitude - previous.longitude)

    # Prefer reported motion; otherwise derive it from the previous fix. Both
    # are legitimate, and the contract makes the reported fields optional.
    if current.movement_speed_kph is not None:
        speed = current.movement_speed_kph
    elif previous is not None and delta_hours > 0:
        speed = (
            haversine_km(
                previous.latitude, previous.longitude, current.latitude, current.longitude
            )
            / delta_hours
        )
    else:
        speed = 0.0

    if current.movement_direction_degrees is not None:
        heading = math.radians(current.movement_direction_degrees)
    elif previous is not None:
        heading = math.radians(
            bearing_degrees(
                previous.latitude, previous.longitude, current.latitude, current.longitude
            )
        )
    else:
        heading = 0.0

    month_angle = 2 * math.pi * (current.timestamp.month - 1) / 12.0

    return [
        current.latitude,
        abs(current.latitude),
        # Longitude is circular: 179 and -179 are adjacent, and a raw value
        # would put them at opposite ends of the model's input range.
        math.sin(longitude),
        math.cos(longitude),
        wind,
        pressure,
        speed,
        math.sin(heading),
        math.cos(heading),
        delta_hours,
        wind_delta,
        pressure_delta,
        lat_delta,
        lon_delta,
        math.sin(month_angle),
        math.cos(month_angle),
    ]


def environmental_features(environment: Optional[EnvironmentalData]) -> List[float]:
    """Environmental vector with an explicit presence flag per field."""
    if environment is None:
        environment = EnvironmentalData()

    def with_flag(value: Optional[float], default: float):
        return (default, 0.0) if value is None else (value, 1.0)

    sst, sst_present = with_flag(
        environment.sea_surface_temperature_c, DEFAULT_SEA_SURFACE_TEMPERATURE_C
    )
    humidity, humidity_present = with_flag(
        environment.humidity_percent, DEFAULT_HUMIDITY_PERCENT
    )
    shear, shear_present = with_flag(
        environment.wind_shear_kph, DEFAULT_WIND_SHEAR_KPH
    )

    return [sst, sst_present, humidity, humidity_present, shear, shear_present]


def build_sequence(
    observations: Sequence[Observation],
    sequence_length: int = SEQUENCE_LENGTH,
) -> tuple[List[List[float]], List[float]]:
    """Fixed-length step matrix and mask ending at the most recent observation.

    ``observations`` must be ordered oldest to newest and must already be
    restricted to fixes at or before the prediction time; this function does
    not filter by time, it only shapes what it is given. Callers that hold a
    full track use :func:`observations_up_to` first.

    Returns the padded ``[sequence_length, STEP_FEATURE_COUNT]`` matrix and a
    mask of the same length where 1 marks a real step and 0 marks padding.
    Padding is appended, which is what ``pack_padded_sequence`` requires; the
    newest real observation sits at index ``sum(mask) - 1``.
    """
    if len(observations) < MIN_OBSERVATIONS:
        raise InsufficientHistory(
            f"At least {MIN_OBSERVATIONS} observations are required."
        )

    ordered = sorted(observations, key=lambda item: item.timestamp)

    # Keep the most recent window: older context beyond this adds little and
    # would force every sequence to carry the length of the longest track.
    window = ordered[-sequence_length:]

    rows: List[List[float]] = []
    for index, observation in enumerate(window):
        previous = window[index - 1] if index > 0 else None
        rows.append(_step_features(observation, previous))

    mask = [1.0] * len(rows)

    pad_count = sequence_length - len(rows)
    if pad_count > 0:
        rows = rows + [[0.0] * STEP_FEATURE_COUNT] * pad_count
        mask = mask + [0.0] * pad_count

    return rows, mask


def observations_up_to(
    observations: Sequence[Observation], moment: datetime
) -> List[Observation]:
    """Observations at or before ``moment``, oldest first.

    The explicit guard against future data. Sequence building for a prediction
    at time T goes through here, so a fix after T cannot reach the model even
    if a caller passes a whole track.
    """
    cutoff = moment
    if cutoff.tzinfo is not None:
        cutoff = cutoff.astimezone(timezone.utc).replace(tzinfo=None)

    return sorted(
        (item for item in observations if item.timestamp <= cutoff),
        key=lambda item: item.timestamp,
    )
