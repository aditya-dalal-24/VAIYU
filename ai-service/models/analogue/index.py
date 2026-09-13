"""Analogue ensemble over the best-track archive (contract section 11).

The locked product scope defines historical similarity as an *independent
second forecast*: find past storms whose last 24 hours evolved like the current
one, then aggregate what those storms did next. Not a decorative list of
similar storms -- the list is the evidence, the aggregate is the forecast.

It is independent of the trajectory and intensity networks by construction: no
learned weights, no shared scaler, nothing but the archive and a distance. When
it agrees with the networks that is corroboration; when it disagrees, that is
information a single model cannot give.

Method
------
Every storm in the archive is cut into 24-hour evolution windows ending at a
fix T, each needing reported fixes at T-24, T-18, T-12, T-6 and T. A window is
described by four groups of numbers, each standardised and weighted equally so
no group dominates by having more dimensions:

* ``TRACK_PATTERN`` -- where the storm was 6/12/18/24 h before T, in km east and
  north of its position at T. Shape of the recent track, independent of where
  on Earth it happened.
* ``LOCATION`` -- latitude and circular longitude at T, so a Bay of Bengal storm
  prefers Bay of Bengal analogues when shapes are equally close.
* ``WIND_SPEED`` -- wind at T and its change over the last 12 and 24 h.
* ``PRESSURE`` -- central pressure at T, used only when the query has one.
* ``SEASON`` -- circular month.

A query is matched over whichever lags it actually has (at least 12 h of
history is required). Analogues must share the query's hemisphere, and at most
one window per storm is used, so ten analogues are ten storms.

Each window also stores what happened next: displacement in km east and north at
+6/+12/+24 h and the wind change, taken only from reported fixes. The forecast
applies each analogue's displacement to the query's own position and averages.
The spread of the members is reported alongside, because an ensemble whose
members disagree by 400 km is not saying the same thing as one within 40 km.

Temporal safety
---------------
An analogue may only be used if its whole outcome -- up to T+24 h -- ended
strictly before the query's current time. For a live storm that excludes
nothing, since the archive is in the past. For a rewind (a forecast made from an
earlier time T) it is what keeps the analogue pool from knowing the future. The
query's own storm is excluded separately, by space-time proximity rather than
by id, because live and archive identifiers do not match.
"""

from __future__ import annotations

import json
import math
import os
import warnings
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Sequence

import numpy as np

INDEX_VERSION = "1.0"
ARRAYS_FILENAME = "analogue_index.npz"
METADATA_FILENAME = "analogue_index.json"

LAGS_HOURS = (6, 12, 18, 24)
HORIZONS_HOURS = (6, 12, 24)
FIX_TOLERANCE_HOURS = 1.5
MIN_QUERY_HISTORY_HOURS = 12

KM_PER_DEGREE_LATITUDE = 110.574
KM_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111.320

# Same-storm exclusion: an archive storm with any fix this close in space and
# time to the query's current fix is probably the query storm itself.
# How the members of an ensemble are combined into one forecast.
AGGREGATION_MEAN = "mean"
AGGREGATION_MEDIAN = "median"
AGGREGATION_DISTANCE = "distance_weighted"
AGGREGATIONS = (AGGREGATION_MEAN, AGGREGATION_MEDIAN, AGGREGATION_DISTANCE)

SAME_STORM_DEGREES = 3.0
SAME_STORM_HOURS = 48.0

DEFAULT_MEMBERS = 10
DEFAULT_LISTED = 5

# Feature layout. Order matters: the group map below indexes into it.
FEATURE_NAMES: List[str] = [
    *(f"track_east_km_-{lag}h" for lag in LAGS_HOURS),
    *(f"track_north_km_-{lag}h" for lag in LAGS_HOURS),
    "latitude",
    "longitude_sin",
    "longitude_cos",
    "wind_kph",
    "wind_change_12h_kph",
    "wind_change_24h_kph",
    "pressure_hpa",
    "month_sin",
    "month_cos",
]
GROUPS: Dict[str, List[int]] = {
    "TRACK_PATTERN": list(range(0, 8)),
    "LOCATION": [8, 9, 10],
    "WIND_SPEED": [11, 12, 13],
    "PRESSURE": [14],
    "SEASON": [15, 16],
}
# Track lag columns, so a query missing a lag can mask exactly that lag.
LAG_COLUMNS: Dict[int, List[int]] = {
    lag: [index, index + len(LAGS_HOURS)] for index, lag in enumerate(LAGS_HOURS)
}
WIND_24H_COLUMN = FEATURE_NAMES.index("wind_change_24h_kph")


class AnalogueError(Exception):
    """Raised when an index cannot be built, loaded or queried."""


def _east_north_km(lat0: float, lon0: float, lat: float, lon: float) -> tuple[float, float]:
    """Local km offsets of (lat, lon) from (lat0, lon0), dateline-safe."""
    dlon = ((lon - lon0 + 180.0) % 360.0) - 180.0
    east = dlon * KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * math.cos(math.radians(lat0))
    north = (lat - lat0) * KM_PER_DEGREE_LATITUDE
    return east, north


def _apply_offset(lat0: float, lon0: float, east: float, north: float) -> tuple[float, float]:
    lat = lat0 + north / KM_PER_DEGREE_LATITUDE
    cos_lat = max(math.cos(math.radians(lat0)), 1e-6)
    lon = lon0 + east / (KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * cos_lat)
    return lat, ((lon + 180.0) % 360.0) - 180.0


def _at(times: np.ndarray, target: np.datetime64) -> int:
    """Index of the fix within FIX_TOLERANCE_HOURS of ``target``, else -1."""
    position = int(np.searchsorted(times, target))
    best, gap = -1, FIX_TOLERANCE_HOURS * 3600.0
    for candidate in (position - 1, position):
        if 0 <= candidate < len(times):
            seconds = abs((times[candidate] - target) / np.timedelta64(1, "s"))
            if seconds <= gap:
                best, gap = candidate, seconds
    return best


def describe(
    lat: float,
    lon: float,
    wind: float,
    pressure: Optional[float],
    month: int,
    lagged: Dict[int, tuple[float, float, Optional[float]]],
) -> tuple[np.ndarray, np.ndarray]:
    """Feature vector and a presence mask for one moment.

    ``lagged`` maps a lag in hours to that earlier fix's (lat, lon, wind).
    Missing lags, pressure or wind changes are masked rather than filled, so a
    query is only ever compared on what it actually knows.
    """
    vector = np.zeros(len(FEATURE_NAMES), dtype=np.float64)
    present = np.ones(len(FEATURE_NAMES), dtype=bool)

    for index, lag in enumerate(LAGS_HOURS):
        if lag in lagged:
            east, north = _east_north_km(lat, lon, lagged[lag][0], lagged[lag][1])
            vector[index], vector[index + len(LAGS_HOURS)] = east, north
        else:
            present[LAG_COLUMNS[lag]] = False

    vector[8] = lat
    vector[9] = math.sin(math.radians(lon))
    vector[10] = math.cos(math.radians(lon))
    vector[11] = wind
    for column, lag in ((12, 12), (13, 24)):
        earlier = lagged.get(lag)
        if earlier is not None and earlier[2] is not None:
            vector[column] = wind - earlier[2]
        else:
            present[column] = False
    if pressure is not None:
        vector[14] = pressure
    else:
        present[14] = False
    angle = 2 * math.pi * (month - 1) / 12.0
    vector[15], vector[16] = math.sin(angle), math.cos(angle)
    return vector, present


@dataclass
class AnalogueIndex:
    """Archive windows, their outcomes, and the statistics used to compare them."""

    features: np.ndarray        # [n, F]
    outcomes: np.ndarray        # [n, horizons, 3]  east km, north km, wind change
    outcome_mask: np.ndarray    # [n, horizons]     1 where the outcome fix exists
    storm_ids: np.ndarray       # [n]
    storm_names: np.ndarray     # [n]
    seasons: np.ndarray         # [n]
    window_times: np.ndarray    # [n] datetime64 of T
    latitudes: np.ndarray       # [n] position at T, for same-storm exclusion
    longitudes: np.ndarray      # [n]
    center: np.ndarray          # [F]
    scale: np.ndarray           # [F]
    metadata: Dict[str, object] = field(default_factory=dict)

    def __len__(self) -> int:
        return int(self.features.shape[0])

    @property
    def storm_count(self) -> int:
        return int(len(set(self.storm_ids.tolist())))

    # ------------------------------------------------------------------ build

    @classmethod
    def build(cls, frame, metadata: Optional[Dict[str, object]] = None) -> "AnalogueIndex":
        """Cut every storm in an observation table into complete 24 h windows."""
        required = {"cyclone_id", "timestamp", "latitude", "longitude", "wind_speed_kph"}
        missing = required - set(frame.columns)
        if missing:
            raise AnalogueError(f"observation table is missing: {sorted(missing)}")

        features, outcomes, masks = [], [], []
        ids, names, seasons, times, lats, lons = [], [], [], [], [], []

        for storm_id, group in frame.sort_values("timestamp").groupby("cyclone_id", sort=False):
            stamps = group["timestamp"].to_numpy(dtype="datetime64[ns]")
            lat = group["latitude"].to_numpy(dtype=float)
            lon = group["longitude"].to_numpy(dtype=float)
            wind = group["wind_speed_kph"].to_numpy(dtype=float)
            pressure = (
                group["pressure_hpa"].to_numpy(dtype=float)
                if "pressure_hpa" in group
                else np.full(len(group), np.nan)
            )
            name = str(group["storm_name"].iloc[0]) if "storm_name" in group else ""
            season = int(group["season"].iloc[0]) if "season" in group else -1

            for t in range(len(group)):
                lagged = {}
                for lag in LAGS_HOURS:
                    j = _at(stamps, stamps[t] - np.timedelta64(lag, "h"))
                    if j < 0:
                        break
                    lagged[lag] = (lat[j], lon[j], wind[j])
                if len(lagged) != len(LAGS_HOURS):
                    continue  # archive windows must be complete

                future = np.zeros((len(HORIZONS_HOURS), 3))
                future_mask = np.zeros(len(HORIZONS_HOURS))
                for h, hours in enumerate(HORIZONS_HOURS):
                    j = _at(stamps, stamps[t] + np.timedelta64(hours, "h"))
                    if j >= 0:
                        east, north = _east_north_km(lat[t], lon[t], lat[j], lon[j])
                        future[h] = (east, north, wind[j] - wind[t])
                        future_mask[h] = 1.0
                if not future_mask.any():
                    continue  # nothing happened next that could inform a forecast

                month = int(str(stamps[t])[5:7])
                vector, known = describe(
                    lat[t], lon[t], wind[t],
                    None if np.isnan(pressure[t]) else float(pressure[t]),
                    month, lagged,
                )
                # Unknown values are stored as NaN, never as a stand-in number,
                # so a window without pressure cannot look like a 0 hPa storm.
                vector[~known] = np.nan
                features.append(vector)
                outcomes.append(future)
                masks.append(future_mask)
                ids.append(str(storm_id))
                names.append(name)
                seasons.append(season)
                times.append(stamps[t])
                lats.append(lat[t])
                lons.append(lon[t])

        if not features:
            raise AnalogueError("no complete 24-hour windows could be built")

        features_array = np.asarray(features)
        center = np.nan_to_num(np.nanmean(features_array, axis=0))
        scale = np.nan_to_num(np.nanstd(features_array, axis=0), nan=1.0)
        scale[scale < 1e-9] = 1.0

        return cls(
            features=features_array,
            outcomes=np.asarray(outcomes),
            outcome_mask=np.asarray(masks),
            storm_ids=np.asarray(ids),
            storm_names=np.asarray(names),
            seasons=np.asarray(seasons, dtype=int),
            window_times=np.asarray(times, dtype="datetime64[ns]"),
            latitudes=np.asarray(lats),
            longitudes=np.asarray(lons),
            center=center,
            scale=scale,
            metadata=dict(metadata or {}),
        )

    # ------------------------------------------------------------ persistence

    def save(self, directory: str) -> str:
        os.makedirs(directory, exist_ok=True)
        arrays = os.path.join(directory, ARRAYS_FILENAME)
        temporary = arrays + ".tmp.npz"
        np.savez_compressed(
            temporary,
            features=self.features, outcomes=self.outcomes, outcome_mask=self.outcome_mask,
            storm_ids=self.storm_ids, storm_names=self.storm_names, seasons=self.seasons,
            window_times=self.window_times.astype("datetime64[s]").astype(np.int64),
            latitudes=self.latitudes, longitudes=self.longitudes,
            center=self.center, scale=self.scale,
        )
        os.replace(temporary, arrays)

        meta = {**self.metadata, "index_version": INDEX_VERSION,
                "feature_names": FEATURE_NAMES, "horizons": list(HORIZONS_HOURS),
                "windows": len(self), "storms": self.storm_count}
        meta_path = os.path.join(directory, METADATA_FILENAME)
        with open(meta_path + ".tmp", "w", encoding="utf-8") as handle:
            json.dump(meta, handle, indent=1, default=str)
        os.replace(meta_path + ".tmp", meta_path)
        return arrays

    @classmethod
    def load(cls, directory: str) -> "AnalogueIndex":
        arrays = os.path.join(directory, ARRAYS_FILENAME)
        meta_path = os.path.join(directory, METADATA_FILENAME)
        if not (os.path.exists(arrays) and os.path.exists(meta_path)):
            raise FileNotFoundError("no analogue index has been built")
        with open(meta_path, encoding="utf-8") as handle:
            meta = json.load(handle)
        if meta.get("index_version") != INDEX_VERSION or meta.get("feature_names") != FEATURE_NAMES:
            raise AnalogueError("the analogue index was built with a different layout")
        data = np.load(arrays, allow_pickle=False)
        return cls(
            features=data["features"], outcomes=data["outcomes"],
            outcome_mask=data["outcome_mask"], storm_ids=data["storm_ids"],
            storm_names=data["storm_names"], seasons=data["seasons"],
            window_times=data["window_times"].astype("datetime64[s]").astype("datetime64[ns]"),
            latitudes=data["latitudes"], longitudes=data["longitudes"],
            center=data["center"], scale=data["scale"], metadata=meta,
        )

    # ------------------------------------------------------------------ query

    def query(
        self,
        vector: np.ndarray,
        present: np.ndarray,
        at_time: datetime,
        lat: float,
        lon: float,
        members: int = DEFAULT_MEMBERS,
        exclude_storm_ids: Sequence[str] = (),
    ) -> List[Dict[str, object]]:
        """The ``members`` closest windows from distinct, eligible storms."""
        now = np.datetime64(at_time.replace(tzinfo=None), "ns")

        # Temporal safety: the analogue's whole outcome must predate the query.
        eligible = self.window_times + np.timedelta64(max(HORIZONS_HOURS), "h") < now
        # Same hemisphere: storms turn the other way across the equator.
        eligible &= np.sign(self.latitudes) == (1.0 if lat >= 0 else -1.0)
        # The query's own storm, found by space-time proximity.
        near_time = np.abs((self.window_times - now) / np.timedelta64(1, "h")) <= SAME_STORM_HOURS
        near_space = (np.abs(self.latitudes - lat) <= SAME_STORM_DEGREES) & (
            np.abs(((self.longitudes - lon + 180) % 360) - 180) <= SAME_STORM_DEGREES
        )
        same_storm = set(self.storm_ids[near_time & near_space].tolist()) | set(exclude_storm_ids)
        if same_storm:
            eligible &= ~np.isin(self.storm_ids, list(same_storm))
        if not eligible.any():
            return []

        distance = self._distance(vector, present, np.flatnonzero(eligible))
        order = np.argsort(distance)

        chosen: List[Dict[str, object]] = []
        seen = set()
        candidates = np.flatnonzero(eligible)
        for position in order:
            row = int(candidates[position])
            storm = str(self.storm_ids[row])
            if storm in seen:
                continue
            seen.add(storm)
            chosen.append({"row": row, "distance": float(distance[position])})
            if len(chosen) >= members:
                break
        return chosen

    def _distance(self, vector: np.ndarray, present: np.ndarray, rows: np.ndarray) -> np.ndarray:
        """Group-balanced standardised distance over the query's known features."""
        z_query = (vector - self.center) / self.scale
        z_index = (self.features[rows] - self.center) / self.scale
        squared = (z_index - z_query) ** 2

        total = np.zeros(len(rows))
        groups_used = 0
        for columns in GROUPS.values():
            known = [c for c in columns if present[c]]
            if not known:
                continue
            # An index window can be missing every feature in a group the
            # query has -- common now that the archive keeps storms which
            # never reported a pressure -- and nanmean warns about the empty
            # slice. The NaN it returns is handled on the next line, so the
            # warning is expected rather than informative, and is silenced
            # here so it cannot bury a warning that does matter.
            with np.errstate(invalid="ignore"), warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                part = np.nanmean(squared[:, known], axis=1)
            # A window missing a whole group the query has is ranked last for
            # that query rather than treated as a perfect match.
            total += np.where(np.isnan(part), np.inf, part)
            groups_used += 1
        return np.sqrt(total / max(groups_used, 1))

    def groups_used(self, present: np.ndarray) -> List[str]:
        return [name for name, columns in GROUPS.items() if any(present[c] for c in columns)]

    def forecast(
        self,
        chosen: Sequence[Dict[str, object]],
        lat: float,
        lon: float,
        wind: float,
        motion_6h: Optional[tuple[float, float]] = None,
        aggregation: str = AGGREGATION_MEAN,
    ) -> List[Dict[str, object]]:
        """Aggregate the members' outcomes into a forecast per horizon.

        With ``motion_6h`` -- the query's own displacement over the last 6 h, in
        km east and north -- the analogues contribute only their *curvature*:
        each member's deviation from continuing its own last-6 h motion, added
        to the query's own straight-line continuation. Averaging members'
        absolute displacements instead mixes in their different speeds, which
        measured worse than plain linear extrapolation on held-out storms; the
        deviation is the part extrapolation cannot know. Without ``motion_6h``
        (no fix 6 h back) the absolute displacements are used.

        ``aggregation`` chooses how the members are combined: the plain mean,
        their median, or a mean weighted by closeness. Which of the three is
        best is a measured question, not an obvious one, so
        ``training/build_analogue_index.py`` scores all three on the same
        held-out windows in one pass and records them side by side.
        """
        east6, north6 = LAG_COLUMNS[6]
        points = []
        for h, hours in enumerate(HORIZONS_HOURS):
            usable = [c for c in chosen if self.outcome_mask[c["row"], h]]
            rows = [c["row"] for c in usable]
            if not rows:
                continue
            # Weights travel with the rows so a member dropped for having no
            # outcome at this horizon cannot shift the weighting of the rest.
            weights = _weights_for(usable, aggregation)
            scale = hours / 6.0
            if motion_6h is not None:
                # Member position = query's own extrapolation + member's deviation
                # from its own extrapolation (its T-6 offset is -motion).
                member_east = motion_6h[0] * scale + (
                    self.outcomes[rows, h, 0] + self.features[rows, east6] * scale
                )
                member_north = motion_6h[1] * scale + (
                    self.outcomes[rows, h, 1] + self.features[rows, north6] * scale
                )
            else:
                member_east = self.outcomes[rows, h, 0]
                member_north = self.outcomes[rows, h, 1]

            members = [_apply_offset(lat, lon, e, n) for e, n in zip(member_east, member_north)]
            mean_lat, mean_lon = _apply_offset(
                lat, lon,
                _combine(member_east, weights, aggregation),
                _combine(member_north, weights, aggregation),
            )
            spread = float(np.mean([
                math.hypot(*_east_north_km(mean_lat, mean_lon, m_lat, m_lon))
                for m_lat, m_lon in members
            ]))
            points.append({
                "forecast_hours": hours,
                "latitude": round(mean_lat, 3),
                "longitude": round(mean_lon, 3),
                "wind_speed_kph": round(max(0.0, wind + _combine(
                    self.outcomes[rows, h, 2], weights, aggregation)), 1),
                "spread_km": round(spread, 1),
                "member_count": len(rows),
            })
        return points


def _weights_for(usable: Sequence[Dict[str, object]], aggregation: str) -> np.ndarray:
    """Per-member weights for the chosen scheme.

    Closeness weighting uses 1/(distance + eps), so a member that matched the
    query almost exactly counts for more than the tenth-nearest. The epsilon
    keeps an exact match from taking the whole weight, which would turn a
    ten-member ensemble into a single storm.
    """
    if aggregation != AGGREGATION_DISTANCE:
        return np.ones(len(usable), dtype=float)
    distances = np.asarray([float(c["distance"]) for c in usable], dtype=float)
    # A member can carry an infinite distance: `_distance` ranks a window that
    # lacks a whole feature group the query has last rather than dropping it.
    # It gets no weight -- but if every member is like that, there is nothing
    # to prefer between them, so they fall back to equal weights instead of
    # dividing by zero.
    finite = np.isfinite(distances)
    if not finite.any():
        return np.ones(len(usable), dtype=float)
    weights = np.zeros(len(usable), dtype=float)
    weights[finite] = 1.0 / (distances[finite] + 0.05)
    return weights


def _combine(values: np.ndarray, weights: np.ndarray, aggregation: str) -> float:
    """Reduce members to one number under the chosen scheme."""
    values = np.asarray(values, dtype=float)
    if aggregation == AGGREGATION_MEDIAN:
        # Robust to one member that went somewhere nothing else did.
        return float(np.median(values))
    if aggregation == AGGREGATION_DISTANCE:
        return float(np.average(values, weights=weights))
    return float(np.mean(values))


def motion_from(vector: np.ndarray, present: np.ndarray) -> Optional[tuple[float, float]]:
    """The query's last-6 h displacement (km east, north), if it has that fix."""
    east6, north6 = LAG_COLUMNS[6]
    if not (present[east6] and present[north6]):
        return None
    return -float(vector[east6]), -float(vector[north6])


def query_from_track(fixes: Sequence[object]) -> Optional[tuple]:
    """Describe the newest fix of a track, oldest first, for an index query.

    Each fix needs ``timestamp``, ``latitude``, ``longitude``, ``wind_speed_kph``
    and optionally ``pressure_hpa``. Returns ``None`` when the track does not
    reach MIN_QUERY_HISTORY_HOURS back from its newest fix with reported fixes.
    """
    ordered = sorted(fixes, key=lambda f: f.timestamp)
    current = ordered[-1]
    if current.wind_speed_kph is None:
        return None

    stamps = np.asarray([np.datetime64(f.timestamp.replace(tzinfo=None), "ns") for f in ordered])
    lagged = {}
    for lag in LAGS_HOURS:
        j = _at(stamps, stamps[-1] - np.timedelta64(lag, "h"))
        if j >= 0 and j != len(ordered) - 1:
            earlier = ordered[j]
            lagged[lag] = (earlier.latitude, earlier.longitude, earlier.wind_speed_kph)

    if not any(lag >= MIN_QUERY_HISTORY_HOURS for lag in lagged):
        return None

    vector, present = describe(
        current.latitude, current.longitude, current.wind_speed_kph,
        current.pressure_hpa, current.timestamp.month, lagged,
    )
    return current, vector, present


def similarity_score(distance: float) -> float:
    """Map a standardised distance to (0, 1]; 1 is an identical window."""
    return round(1.0 / (1.0 + distance), 3)
