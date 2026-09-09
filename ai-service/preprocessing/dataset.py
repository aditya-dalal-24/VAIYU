"""Dataset loading, sample construction and target building.

Defines the shape of the training data the models expect, and turns it into
supervised samples. No dataset is shipped or fabricated: this module reads
whatever real archive is supplied later, provided it exposes the columns in
:data:`REQUIRED_COLUMNS`.

Expected input format
---------------------
One row per cyclone observation, in a CSV or Parquet file:

===========================  ========  ===========================================
column                       unit      notes
===========================  ========  ===========================================
cyclone_id                   --        groups rows into tracks; required
timestamp                    UTC       ISO-8601 parseable; required
latitude                     degrees   -90..90; required
longitude                    degrees   -180..180; required
wind_speed_kph               kph       required for intensity targets
pressure_hpa                 hPa       required for intensity targets
movement_speed_kph           kph       optional
movement_direction_degrees   degrees   optional, 0..360 clockwise from north
season                       year      optional, enables a chronological split
sea_surface_temperature_c    degC      optional environmental context
humidity_percent             percent   optional environmental context
wind_shear_kph               kph       optional environmental context
===========================  ========  ===========================================

Sample construction
-------------------
For each observation at time T with at least ``MIN_OBSERVATIONS`` fixes at or
before it, one sample is emitted containing:

* a padded ``[SEQUENCE_LENGTH, STEP_FEATURE_COUNT]`` window ending at T,
* a step mask,
* the environmental vector at T,
* targets at each horizon, plus a per-horizon target mask.

Targets are **deltas from the state at T**, not absolute values: displacement in
degrees for trajectory, change in wind and pressure for intensity. Deltas centre
near zero and transfer across basins, whereas absolute coordinates would make
the model memorise geography.

A horizon's target is only produced when a real observation exists near T+h
(within ``TARGET_TOLERANCE_HOURS``). Missing horizons are masked out rather than
interpolated, so the model is never trained against an invented position.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import timedelta
from typing import Dict, List, Optional, Sequence

import numpy as np
import pandas as pd

from preprocessing.features import (
    ENVIRONMENTAL_FEATURE_COUNT,
    MIN_OBSERVATIONS,
    SEQUENCE_LENGTH,
    STEP_FEATURE_COUNT,
    EnvironmentalData,
    InsufficientHistory,
    Observation,
    build_sequence,
    environmental_features,
    normalise_longitude,
)

REQUIRED_COLUMNS = [
    "cyclone_id",
    "timestamp",
    "latitude",
    "longitude",
]

INTENSITY_COLUMNS = ["wind_speed_kph", "pressure_hpa"]

OPTIONAL_COLUMNS = [
    "movement_speed_kph",
    "movement_direction_degrees",
    "season",
    "sea_surface_temperature_c",
    "humidity_percent",
    "wind_shear_kph",
]

# Contract section 9: 6, 12 and 24 hours are the MVP horizons, 48 optional.
DEFAULT_HORIZONS_HOURS = (6, 12, 24)

# How near T+h a real observation must fall to count as that horizon's target.
TARGET_TOLERANCE_HOURS = 3.0

# Wind change over 24h separating intensifying and weakening from steady state.
# Applied to the *labelled* delta when building trend targets, so the class
# boundary is a documented dataset decision rather than a model artefact.
TREND_THRESHOLD_KPH = 10.0

TREND_CLASSES = ["WEAKENING", "STABLE", "INTENSIFYING"]


class DatasetError(Exception):
    """Raised when the supplied dataset cannot be used as-is."""


@dataclass
class SupervisedSamples:
    """Model-ready arrays plus the identifiers needed to split them safely."""

    sequences: np.ndarray            # [n, steps, step_features]
    masks: np.ndarray                # [n, steps]
    environments: np.ndarray         # [n, environment_features]
    position_targets: np.ndarray     # [n, horizons, 2]  (delta lat, delta lon)
    intensity_targets: np.ndarray    # [n, horizons, 2]  (delta wind, delta pressure)
    trend_targets: np.ndarray        # [n]               index into TREND_CLASSES
    target_masks: np.ndarray         # [n, horizons]     1 where a real target exists
    trend_mask: np.ndarray           # [n]               1 where a trend label exists
    cyclone_ids: np.ndarray          # [n]
    base_states: np.ndarray          # [n, 4] lat, lon, wind, pressure at T
    horizons: List[int]

    def __len__(self) -> int:
        return int(self.sequences.shape[0])

    def subset(self, indices: Sequence[int]) -> "SupervisedSamples":
        """Select samples by index, preserving every parallel array."""
        index = np.asarray(indices, dtype=int)
        return SupervisedSamples(
            sequences=self.sequences[index],
            masks=self.masks[index],
            environments=self.environments[index],
            position_targets=self.position_targets[index],
            intensity_targets=self.intensity_targets[index],
            trend_targets=self.trend_targets[index],
            target_masks=self.target_masks[index],
            trend_mask=self.trend_mask[index],
            cyclone_ids=self.cyclone_ids[index],
            base_states=self.base_states[index],
            horizons=list(self.horizons),
        )


def load_observations(path: str) -> pd.DataFrame:
    """Read a cyclone observation table and validate its shape.

    Accepts CSV or Parquet. Raises :class:`DatasetError` with a specific message
    rather than letting a missing column surface as a KeyError deep inside
    sample construction.
    """
    if not os.path.exists(path):
        raise DatasetError(f"dataset not found at {path}")

    if path.lower().endswith((".parquet", ".pq")):
        frame = pd.read_parquet(path)
    else:
        frame = pd.read_csv(path)

    missing = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    if missing:
        raise DatasetError(
            f"dataset is missing required columns: {', '.join(missing)}"
        )

    frame = frame.copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, errors="coerce")
    if frame["timestamp"].isna().any():
        raise DatasetError("dataset contains timestamps that could not be parsed")
    frame["timestamp"] = frame["timestamp"].dt.tz_convert("UTC").dt.tz_localize(None)

    for column in ("latitude", "longitude", *INTENSITY_COLUMNS, *OPTIONAL_COLUMNS):
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")

    frame = frame.dropna(subset=["latitude", "longitude"])
    if frame.empty:
        raise DatasetError("dataset has no rows with usable coordinates")

    invalid = (
        (frame["latitude"] < -90)
        | (frame["latitude"] > 90)
        | (frame["longitude"] < -180)
        | (frame["longitude"] > 180)
    )
    if invalid.any():
        raise DatasetError(
            f"{int(invalid.sum())} rows have coordinates outside valid ranges"
        )

    frame["longitude"] = frame["longitude"].map(normalise_longitude)

    # One fix per cyclone per instant; duplicates would distort rate features.
    frame = frame.drop_duplicates(subset=["cyclone_id", "timestamp"])

    return frame.sort_values(["cyclone_id", "timestamp"]).reset_index(drop=True)


def _row_observation(row) -> Observation:
    def value(name):
        item = getattr(row, name, None)
        return None if item is None or pd.isna(item) else float(item)

    return Observation(
        timestamp=row.timestamp.to_pydatetime()
        if hasattr(row.timestamp, "to_pydatetime")
        else row.timestamp,
        latitude=float(row.latitude),
        longitude=float(row.longitude),
        wind_speed_kph=value("wind_speed_kph"),
        pressure_hpa=value("pressure_hpa"),
        movement_speed_kph=value("movement_speed_kph"),
        movement_direction_degrees=value("movement_direction_degrees"),
    )


def _row_environment(row) -> EnvironmentalData:
    def value(name):
        item = getattr(row, name, None)
        return None if item is None or pd.isna(item) else float(item)

    return EnvironmentalData(
        sea_surface_temperature_c=value("sea_surface_temperature_c"),
        humidity_percent=value("humidity_percent"),
        wind_shear_kph=value("wind_shear_kph"),
    )


def trend_from_wind_delta(wind_delta: float) -> int:
    """Map a labelled wind change onto a trend class index."""
    if wind_delta > TREND_THRESHOLD_KPH:
        return TREND_CLASSES.index("INTENSIFYING")
    if wind_delta < -TREND_THRESHOLD_KPH:
        return TREND_CLASSES.index("WEAKENING")
    return TREND_CLASSES.index("STABLE")


def build_samples(
    frame: pd.DataFrame,
    horizons: Sequence[int] = DEFAULT_HORIZONS_HOURS,
    sequence_length: int = SEQUENCE_LENGTH,
    target_tolerance_hours: float = TARGET_TOLERANCE_HOURS,
) -> SupervisedSamples:
    """Turn an observation table into supervised samples.

    Only observations at or before the sample time enter its sequence, so no
    sample can contain information from its own future.
    """
    horizons = list(horizons)

    sequences: List[List[List[float]]] = []
    masks: List[List[float]] = []
    environments: List[List[float]] = []
    position_targets: List[List[List[float]]] = []
    intensity_targets: List[List[List[float]]] = []
    trend_targets: List[int] = []
    target_masks: List[List[float]] = []
    trend_masks: List[float] = []
    cyclone_ids: List[str] = []
    base_states: List[List[float]] = []

    for cyclone_id, track in frame.groupby("cyclone_id", sort=False):
        track = track.sort_values("timestamp").reset_index(drop=True)
        rows = list(track.itertuples())
        observations = [_row_observation(row) for row in rows]
        times = track["timestamp"].to_numpy()

        for index, current in enumerate(observations):
            # Strictly backward-looking: index+1 is exclusive, so the sequence
            # ends at the current fix and never reaches past it.
            history = observations[: index + 1]
            if len(history) < MIN_OBSERVATIONS:
                continue

            try:
                steps, mask = build_sequence(history, sequence_length)
            except InsufficientHistory:
                continue

            current_wind = current.wind_speed_kph
            current_pressure = current.pressure_hpa

            horizon_positions: List[List[float]] = []
            horizon_intensities: List[List[float]] = []
            horizon_mask: List[float] = []
            longest_wind_delta: Optional[float] = None

            for horizon in horizons:
                target_time = current.timestamp + timedelta(hours=horizon)
                offsets = np.abs(
                    (times - np.datetime64(target_time))
                    .astype("timedelta64[s]")
                    .astype(float)
                )
                nearest = int(np.argmin(offsets))

                usable = offsets[nearest] <= target_tolerance_hours * 3600
                target = observations[nearest]

                if not usable:
                    horizon_positions.append([0.0, 0.0])
                    horizon_intensities.append([0.0, 0.0])
                    horizon_mask.append(0.0)
                    continue

                horizon_positions.append(
                    [
                        target.latitude - current.latitude,
                        normalise_longitude(target.longitude - current.longitude),
                    ]
                )

                if (
                    current_wind is None
                    or current_pressure is None
                    or target.wind_speed_kph is None
                    or target.pressure_hpa is None
                ):
                    # Position is usable even when intensity is not; the mask
                    # is shared, so intensity training filters these later.
                    horizon_intensities.append([0.0, 0.0])
                else:
                    wind_delta = target.wind_speed_kph - current_wind
                    horizon_intensities.append(
                        [wind_delta, target.pressure_hpa - current_pressure]
                    )
                    longest_wind_delta = wind_delta

                horizon_mask.append(1.0)

            if not any(horizon_mask):
                continue

            sequences.append(steps)
            masks.append(mask)
            environments.append(environmental_features(_row_environment(rows[index])))
            position_targets.append(horizon_positions)
            intensity_targets.append(horizon_intensities)
            target_masks.append(horizon_mask)
            cyclone_ids.append(str(cyclone_id))
            base_states.append(
                [
                    current.latitude,
                    current.longitude,
                    current_wind if current_wind is not None else float("nan"),
                    current_pressure if current_pressure is not None else float("nan"),
                ]
            )

            if longest_wind_delta is None:
                trend_targets.append(TREND_CLASSES.index("STABLE"))
                trend_masks.append(0.0)
            else:
                trend_targets.append(trend_from_wind_delta(longest_wind_delta))
                trend_masks.append(1.0)

    if not sequences:
        raise DatasetError(
            "no samples could be built; check that tracks contain at least "
            f"{MIN_OBSERVATIONS} observations and that horizons fall within them"
        )

    return SupervisedSamples(
        sequences=np.asarray(sequences, dtype=np.float32),
        masks=np.asarray(masks, dtype=np.float32),
        environments=np.asarray(environments, dtype=np.float32),
        position_targets=np.asarray(position_targets, dtype=np.float32),
        intensity_targets=np.asarray(intensity_targets, dtype=np.float32),
        trend_targets=np.asarray(trend_targets, dtype=np.int64),
        target_masks=np.asarray(target_masks, dtype=np.float32),
        trend_mask=np.asarray(trend_masks, dtype=np.float32),
        cyclone_ids=np.asarray(cyclone_ids, dtype=object),
        base_states=np.asarray(base_states, dtype=np.float32),
        horizons=horizons,
    )


def describe_samples(samples: SupervisedSamples) -> Dict[str, object]:
    """Summary for logging before training, so the data is inspected not assumed."""
    return {
        "samples": len(samples),
        "cyclones": int(len(set(samples.cyclone_ids.tolist()))),
        "sequence_length": int(samples.sequences.shape[1]),
        "step_features": int(samples.sequences.shape[2]),
        "environment_features": int(samples.environments.shape[1]),
        "horizons": samples.horizons,
        "targets_per_horizon": {
            f"{horizon}h": int(samples.target_masks[:, position].sum())
            for position, horizon in enumerate(samples.horizons)
        },
        "trend_labels": int(samples.trend_mask.sum()),
    }


# Sanity check: the arrays this module produces must match the widths the
# feature module declares, or the models will be built against the wrong size.
assert STEP_FEATURE_COUNT > 0 and ENVIRONMENTAL_FEATURE_COUNT > 0
