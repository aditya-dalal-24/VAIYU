"""Tests for the analogue ensemble (historical similarity, contract section 11).

Synthetic storms with known motion make the right answer unambiguous: a storm
that has been moving east should find eastward-moving analogues, and their
forecast should continue east by the distance those analogues travelled.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import extensions
import models.analogue.index as index_module
from models.analogue.index import (
    GROUPS,
    AnalogueError,
    AnalogueIndex,
    _east_north_km,
    query_from_track,
    similarity_score,
)
from registry.registry import reset_registry

ANALYSIS_URL = "/api/v1/analysis/cyclone"


def storm_rows(storm_id, start, lat0, lon0, dlat, dlon, count=12, wind0=80.0,
               dwind=0.0, name="TEST", season=None, pressure=True):
    rows = []
    for i in range(count):
        rows.append({
            "cyclone_id": storm_id,
            "timestamp": start + timedelta(hours=6 * i),
            "latitude": lat0 + dlat * i,
            "longitude": lon0 + dlon * i,
            "wind_speed_kph": wind0 + dwind * i,
            "pressure_hpa": (990.0 - dwind * i / 2) if pressure else np.nan,
            "storm_name": name,
            "season": season or start.year,
        })
    return rows


def archive():
    """Eastward and northward movers in two regions, well in the past."""
    rows = []
    base = datetime(2000, 6, 1)
    for k in range(6):
        rows += storm_rows(f"EAST{k}", base + timedelta(days=20 * k), 15.0 + k * 0.2, 85.0,
                           0.0, 0.5, name=f"EAST{k}")
        rows += storm_rows(f"NORTH{k}", base + timedelta(days=20 * k + 5), 12.0 + k * 0.2, 88.0,
                           0.5, 0.0, name=f"NORTH{k}")
    rows += storm_rows("SOUTH0", base, -15.0, 60.0, 0.0, 0.5, name="SOUTH0")
    frame = pd.DataFrame(rows)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"])
    return frame


@dataclass
class Fix:
    timestamp: datetime
    latitude: float
    longitude: float
    wind_speed_kph: Optional[float]
    pressure_hpa: Optional[float] = None


def eastward_query(when=datetime(2026, 6, 1), lat=15.5, lon=86.0, fixes=5, pressure=990.0):
    return [
        Fix(when - timedelta(hours=6 * (fixes - 1 - i)), lat, lon - 0.5 * (fixes - 1 - i), 80.0, pressure)
        for i in range(fixes)
    ]


@pytest.fixture(scope="module")
def index():
    return AnalogueIndex.build(archive())


class TestBuild:
    def test_windows_need_a_full_24_hours_of_history(self, index):
        # 12 fixes per storm at 6 h: the first four cannot see 24 h back.
        per_storm = pd.Series(index.storm_ids).value_counts()
        assert (per_storm <= 12 - 4).all()

    def test_outcomes_come_from_reported_fixes(self, index):
        row = int(np.flatnonzero(index.storm_ids == "EAST0")[0])
        east, north, dwind = index.outcomes[row, 2]  # +24 h
        expected_east, expected_north = _east_north_km(
            index.latitudes[row], index.longitudes[row],
            index.latitudes[row], index.longitudes[row] + 2.0)
        assert east == pytest.approx(expected_east, rel=1e-6)
        assert north == pytest.approx(expected_north, abs=1e-6)

    def test_missing_pressure_is_stored_as_unknown_not_zero(self):
        frame = pd.DataFrame(storm_rows("NOP", datetime(2001, 1, 1), 15, 85, 0, 0.5, pressure=False))
        built = AnalogueIndex.build(frame)
        pressure_column = GROUPS["PRESSURE"][0]
        assert np.isnan(built.features[:, pressure_column]).all()

    def test_an_empty_table_is_an_error(self):
        frame = pd.DataFrame(storm_rows("TINY", datetime(2001, 1, 1), 15, 85, 0, 0.5, count=3))
        with pytest.raises(AnalogueError):
            AnalogueIndex.build(frame)


class TestQuery:
    def _query(self, index, fixes, **kwargs):
        newest, vector, present = query_from_track(fixes)
        return index.query(vector, present, newest.timestamp, newest.latitude,
                           newest.longitude, **kwargs), present

    def test_similar_motion_ranks_first(self, index):
        chosen, _ = self._query(index, eastward_query())
        # Five of the six eastward storms share the query's season; the sixth
        # (September) is rightly pushed back by the SEASON group.
        top = [str(index.storm_ids[c["row"]]) for c in chosen[:5]]
        assert all(storm.startswith("EAST") for storm in top)

    def test_at_most_one_window_per_storm(self, index):
        chosen, _ = self._query(index, eastward_query(), members=10)
        storms = [str(index.storm_ids[c["row"]]) for c in chosen]
        assert len(storms) == len(set(storms))

    def test_analogues_must_have_finished_before_the_query(self, index):
        """The rewind rule: at a moment inside the archive's time span, only
        storms whose outcome had already happened are eligible."""
        moment = datetime(2000, 7, 25)  # after EAST0-2 / NORTH0-2 ended, before the rest
        chosen, _ = self._query(index, eastward_query(when=moment, lat=40.0, lon=150.0))
        for c in chosen:
            outcome_end = index.window_times[c["row"]] + np.timedelta64(24, "h")
            assert outcome_end < np.datetime64(moment)

    def test_the_query_storm_itself_is_excluded(self, index):
        """A storm in the archive must not be its own analogue."""
        rows = np.flatnonzero(index.storm_ids == "EAST0")
        row = int(rows[len(rows) // 2])
        t = index.window_times[row].astype("datetime64[us]").astype(object)
        lat, lon = float(index.latitudes[row]), float(index.longitudes[row])
        fixes = eastward_query(when=t, lat=lat, lon=lon)
        chosen, _ = self._query(index, fixes)
        assert "EAST0" not in {str(index.storm_ids[c["row"]]) for c in chosen}

    def test_only_same_hemisphere_analogues(self, index):
        chosen, _ = self._query(index, eastward_query(lat=-15.5, lon=61.0))
        assert all(index.latitudes[c["row"]] < 0 for c in chosen)

    def test_a_query_without_pressure_does_not_match_on_pressure(self, index):
        _, present = self._query(index, eastward_query(pressure=None))
        assert "PRESSURE" not in index.groups_used(present)

    def test_twelve_hours_of_history_is_the_minimum(self):
        assert query_from_track(eastward_query(fixes=2)) is None
        assert query_from_track(eastward_query(fixes=3)) is not None

    def test_a_current_fix_without_wind_cannot_be_matched(self):
        fixes = eastward_query()
        fixes[-1] = Fix(fixes[-1].timestamp, fixes[-1].latitude, fixes[-1].longitude, None)
        assert query_from_track(fixes) is None


class TestForecast:
    def test_continues_the_analogues_motion_from_the_query_position(self, index):
        fixes = eastward_query()
        newest, vector, present = query_from_track(fixes)
        chosen = index.query(vector, present, newest.timestamp, newest.latitude,
                             newest.longitude, members=5)
        points = {p["forecast_hours"]: p for p in index.forecast(
            chosen, newest.latitude, newest.longitude, newest.wind_speed_kph)}

        # Analogues moved 2 degrees east in 24 h, due east.
        assert points[24]["longitude"] == pytest.approx(newest.longitude + 2.0, abs=0.1)
        assert points[24]["latitude"] == pytest.approx(newest.latitude, abs=0.1)
        assert points[24]["spread_km"] < 25
        assert points[24]["member_count"] == 5

    def test_similarity_score_is_bounded(self):
        assert similarity_score(0.0) == 1.0
        assert 0 < similarity_score(10.0) < 0.1


class TestPersistence:
    def test_round_trip(self, index, tmp_path):
        index.save(str(tmp_path))
        loaded = AnalogueIndex.load(str(tmp_path))

        assert len(loaded) == len(index)
        np.testing.assert_allclose(loaded.features, index.features, equal_nan=True)
        assert (loaded.window_times == index.window_times).all()

    def test_missing_index_is_reported(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            AnalogueIndex.load(str(tmp_path))


class TestApi:
    def _body(self, fixes):
        def obs(f):
            return {"timestamp": f.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "latitude": f.latitude, "longitude": f.longitude,
                    "windSpeedKph": f.wind_speed_kph, "pressureHpa": f.pressure_hpa}
        return {"requestId": "sim-1", "cycloneId": "Q", "analysisTypes": ["HISTORICAL_SIMILARITY"],
                "currentObservation": obs(fixes[-1]),
                "observationHistory": [obs(f) for f in fixes[:-1]]}

    def test_without_an_index_it_is_not_available(self, temporary_checkpoint_dir):
        reset_registry(temporary_checkpoint_dir)
        try:
            block = TestClient(app).post(ANALYSIS_URL, json=self._body(eastward_query())).json()[
                "historicalSimilarity"]
            assert block["status"] == "NOT_AVAILABLE"
            assert block["reason"] == extensions.NO_INDEX_REASON
            assert block["similarCyclones"] == []
        finally:
            reset_registry()

    def test_with_an_index_it_returns_evidence_and_a_forecast(self, temporary_checkpoint_dir, index):
        index.metadata = {"model_name": "analogue-ensemble-v1", "model_version": "1.0",
                          "members": 5, "metrics": {"validation_skill": 0.5}}
        index.save(temporary_checkpoint_dir)
        reset_registry(temporary_checkpoint_dir)
        try:
            client = TestClient(app)
            block = client.post(ANALYSIS_URL, json=self._body(eastward_query())).json()[
                "historicalSimilarity"]

            assert block["status"] == "COMPLETED"
            first = block["similarCyclones"][0]
            assert first["rank"] == 1 and first["historicalCycloneId"].startswith("EAST")
            assert 0 < first["similarityScore"] <= 1
            assert "TRACK_PATTERN" in first["similarityBasis"]
            assert [p["forecastHours"] for p in block["analogueForecast"]] == [6, 12, 24]
            assert block["confidence"] == 0.5
            assert block["model"]["name"] == "analogue-ensemble-v1"

            health = client.get("/api/v1/health").json()["models"]["similarity"]
            assert health["state"] == "TRAINED"
        finally:
            reset_registry()

    def test_confidence_is_absent_when_never_measured(self, temporary_checkpoint_dir, index):
        index.metadata = {"model_name": "analogue-ensemble-v1", "model_version": "1.0"}
        index.save(temporary_checkpoint_dir)
        reset_registry(temporary_checkpoint_dir)
        try:
            block = TestClient(app).post(ANALYSIS_URL, json=self._body(eastward_query())).json()[
                "historicalSimilarity"]
            assert "confidence" not in block
        finally:
            reset_registry()

    def test_short_history_is_explained(self, temporary_checkpoint_dir, index):
        index.save(temporary_checkpoint_dir)
        reset_registry(temporary_checkpoint_dir)
        try:
            body = self._body(eastward_query(fixes=5))
            body["observationHistory"] = body["observationHistory"][-1:]
            block = TestClient(app).post(ANALYSIS_URL, json=body).json()["historicalSimilarity"]
            assert block["status"] == "NOT_AVAILABLE"
            assert "12 hours" in block["reason"]
        finally:
            reset_registry()


class TestAggregationSchemes:
    """How ten members become one forecast is a measured choice, not a default.

    The equal-weighted mean has always been served. These pin the two
    alternatives so that whichever the evaluation picks, the others stay
    available and behave as their names claim.
    """

    @staticmethod
    def _chosen(index, members=5):
        fixes = eastward_query()
        newest, vector, present = query_from_track(fixes)
        return newest, index.query(
            vector, present, newest.timestamp, newest.latitude, newest.longitude,
            members=members,
        )

    def test_every_scheme_produces_a_forecast_for_the_same_members(self, index):
        newest, chosen = self._chosen(index)
        assert chosen, "fixture must find members"

        for aggregation in index_module.AGGREGATIONS:
            points = index.forecast(
                chosen, newest.latitude, newest.longitude, newest.wind_speed_kph,
                aggregation=aggregation,
            )
            assert points, f"{aggregation} produced no points"
            for point in points:
                assert point["member_count"] >= 1
                assert -90 <= point["latitude"] <= 90

    def test_the_schemes_agree_on_which_horizons_they_cover(self, index):
        newest, chosen = self._chosen(index)

        horizons = {
            aggregation: [
                p["forecast_hours"]
                for p in index.forecast(
                    chosen, newest.latitude, newest.longitude, newest.wind_speed_kph,
                    aggregation=aggregation,
                )
            ]
            for aggregation in index_module.AGGREGATIONS
        }

        # A scheme may move the forecast; it must never change which horizons
        # are answerable, or the comparison between them is not like for like.
        assert len({tuple(v) for v in horizons.values()}) == 1

    def test_an_exact_match_does_not_take_the_whole_weight(self):
        # Without the epsilon a zero distance would make one member the entire
        # ensemble, and the spread would collapse to zero.
        weights = index_module._weights_for(
            [{"row": 0, "distance": 0.0}, {"row": 1, "distance": 0.5}],
            index_module.AGGREGATION_DISTANCE,
        )

        assert weights[0] > weights[1]
        assert float(weights[1] / weights[0]) > 0.05

    def test_the_median_ignores_one_wild_member(self):
        values = np.array([10.0, 11.0, 10.5, 400.0])
        weights = np.ones(4)

        mean = index_module._combine(values, weights, index_module.AGGREGATION_MEAN)
        median = index_module._combine(values, weights, index_module.AGGREGATION_MEDIAN)

        assert mean > 100
        assert 10.0 <= median <= 11.0

    def test_equal_weights_reduce_to_the_plain_mean(self):
        values = np.array([1.0, 2.0, 6.0])
        weights = np.ones(3)

        assert index_module._combine(
            values, weights, index_module.AGGREGATION_DISTANCE
        ) == pytest.approx(3.0)

    def test_infinitely_distant_members_get_no_weight(self):
        weights = index_module._weights_for(
            [{"row": 0, "distance": 0.3}, {"row": 1, "distance": float("inf")}],
            index_module.AGGREGATION_DISTANCE,
        )

        assert weights[0] > 0
        assert weights[1] == 0.0

    def test_all_infinitely_distant_members_fall_back_to_equal_weights(self):
        # The case that crashed the first evaluation run: every member at one
        # horizon lacked a feature group the query had, so every weight was
        # zero and np.average divided by zero.
        weights = index_module._weights_for(
            [{"row": 0, "distance": float("inf")}, {"row": 1, "distance": float("inf")}],
            index_module.AGGREGATION_DISTANCE,
        )

        assert np.all(weights == 1.0)
        assert index_module._combine(
            np.array([4.0, 8.0]), weights, index_module.AGGREGATION_DISTANCE
        ) == pytest.approx(6.0)
