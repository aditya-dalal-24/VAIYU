"""API tests: endpoints, validation, contract compliance and partial analysis.

Two registry states matter here and are tested separately: the untrained
service a fresh checkout produces, and a service with a checkpoint loaded. In
both cases the tests check the *shape* of the response against the contract,
never the scientific content of a prediction -- the models under test are
randomly initialised, and asserting anything about their numbers would be
asserting noise.
"""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from models.intensity.model import IntensityModel
from models.trajectory.model import TrajectoryModel
from preprocessing.features import ENVIRONMENTAL_FEATURE_COUNT, STEP_FEATURE_COUNT
from preprocessing.scaler import SequenceScaler
from registry.checkpoint import checkpoint_path, save_checkpoint
from registry.registry import reset_registry

HORIZONS = [6, 12, 24]

ANALYSIS_URL = "/api/v1/analysis/cyclone"
HEALTH_URL = "/api/v1/health"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def untrained_registry(temporary_checkpoint_dir):
    """The state of a fresh checkout: architectures present, no checkpoints."""
    reset_registry(temporary_checkpoint_dir)
    yield temporary_checkpoint_dir
    reset_registry()


@pytest.fixture
def trained_registry(temporary_checkpoint_dir):
    """A registry with checkpoints loaded.

    The weights are randomly initialised. That is deliberate: these tests
    verify plumbing and response shape, and must not be read as evidence that
    a model predicts anything correctly.
    """
    generator = np.random.default_rng(0)
    sequences = generator.normal(size=(20, 8, STEP_FEATURE_COUNT)).astype(np.float32)
    masks = np.ones((20, 8), dtype=np.float32)
    environments = generator.normal(
        size=(20, ENVIRONMENTAL_FEATURE_COUNT)
    ).astype(np.float32)
    scaler = SequenceScaler().fit(sequences, masks, environments)

    for key, factory, name in (
        ("trajectory", TrajectoryModel, "trajectory-model-v1"),
        ("intensity", IntensityModel, "intensity-model-v1"),
    ):
        save_checkpoint(
            path=checkpoint_path(temporary_checkpoint_dir, key),
            model=factory(
                step_features=STEP_FEATURE_COUNT,
                environment_features=ENVIRONMENTAL_FEATURE_COUNT,
                horizons=HORIZONS,
            ),
            scaler=scaler,
            model_name=name,
            model_version="1.0",
            horizons=HORIZONS,
            metrics={"validation_skill": 0.5},
        )

    reset_registry(temporary_checkpoint_dir)
    yield temporary_checkpoint_dir
    reset_registry()


class TestHealthEndpoint:
    def test_returns_the_contract_fields(self, client):
        response = client.get(HEALTH_URL)
        payload = response.json()

        assert response.status_code == 200
        assert payload["status"] == "UP"
        assert payload["service"] == "cyclovision-ai-service"
        assert payload["version"] == "1.0.0"

    def test_service_is_up_even_with_no_models(self, client, untrained_registry):
        """The service answers requests whether or not models are trained."""
        payload = client.get(HEALTH_URL).json()

        assert payload["status"] == "UP"
        assert payload["models"]["trajectory"]["available"] is False
        assert payload["models"]["trajectory"]["state"] == "UNTRAINED"


class TestRequestValidation:
    def test_malformed_body_returns_400(self, client):
        """Section 14 reserves 422 for valid-but-insufficient input."""
        response = client.post(ANALYSIS_URL, json={"nonsense": True})

        assert response.status_code == 400
        assert response.json()["errorCode"] == "INVALID_REQUEST"

    def test_invalid_latitude_returns_400(self, client, analysis_request_body):
        body = analysis_request_body()
        body["currentObservation"]["latitude"] = 120.0

        assert client.post(ANALYSIS_URL, json=body).status_code == 400

    def test_invalid_longitude_returns_400(self, client, analysis_request_body):
        body = analysis_request_body()
        body["currentObservation"]["longitude"] = -400.0

        assert client.post(ANALYSIS_URL, json=body).status_code == 400

    def test_invalid_timestamp_returns_400(self, client, analysis_request_body):
        body = analysis_request_body()
        body["currentObservation"]["timestamp"] = "not-a-timestamp"

        assert client.post(ANALYSIS_URL, json=body).status_code == 400

    def test_unknown_analysis_type_returns_400(self, client, analysis_request_body):
        body = analysis_request_body(analysis_types=["TELEPATHY"])

        assert client.post(ANALYSIS_URL, json=body).status_code == 400

    def test_empty_analysis_types_returns_400(self, client, analysis_request_body):
        body = analysis_request_body(analysis_types=[])

        assert client.post(ANALYSIS_URL, json=body).status_code == 400

    def test_out_of_order_history_returns_400(self, client, analysis_request_body):
        """Section 5 states history is ordered oldest to newest."""
        body = analysis_request_body()
        body["observationHistory"].reverse()

        response = client.post(ANALYSIS_URL, json=body)

        assert response.status_code == 400
        assert "oldest to newest" in response.json()["message"]

    def test_insufficient_history_returns_422(
        self, client, analysis_request_body, trained_registry
    ):
        """Valid JSON, too little data to model: 422, not 400."""
        body = analysis_request_body(history_count=1)

        response = client.post(ANALYSIS_URL, json=body)
        payload = response.json()

        assert response.status_code == 422
        assert payload["errorCode"] == "INSUFFICIENT_OBSERVATION_HISTORY"
        assert payload["status"] == "VALIDATION_ERROR"
        assert payload["requestId"] == body["requestId"]


class TestErrorContract:
    def test_error_body_matches_section_13(self, client):
        payload = client.post(ANALYSIS_URL, json={"bad": 1}).json()

        assert set(payload) >= {"timestamp", "status", "errorCode", "message"}

    def test_errors_never_leak_internals(self, client, analysis_request_body):
        body = analysis_request_body()
        body["currentObservation"]["latitude"] = 999.0
        text = client.post(ANALYSIS_URL, json=body).text

        assert "Traceback" not in text
        assert "site-packages" not in text
        assert ".py" not in text


class TestUntrainedBehaviour:
    def test_returns_503_when_nothing_can_run(
        self, client, analysis_request_body, untrained_registry
    ):
        response = client.post(ANALYSIS_URL, json=analysis_request_body())
        payload = response.json()

        assert response.status_code == 503
        assert payload["status"] == "NOT_AVAILABLE"

    def test_no_fabricated_predictions(
        self, client, analysis_request_body, untrained_registry
    ):
        """The core requirement: an untrained model produces nothing."""
        payload = client.post(ANALYSIS_URL, json=analysis_request_body()).json()

        trajectory = payload["trajectoryPrediction"]
        intensity = payload["intensityPrediction"]

        assert trajectory["status"] == "NOT_AVAILABLE"
        assert trajectory.get("predictedPositions", []) == []
        assert "confidence" not in trajectory or trajectory["confidence"] is None
        assert trajectory["reason"]

        assert intensity["status"] == "NOT_AVAILABLE"
        assert intensity.get("forecast", []) == []
        assert "trend" not in intensity or intensity["trend"] is None


class TestTrainedBehaviour:
    def test_response_matches_the_contract_shape(
        self, client, analysis_request_body, trained_registry
    ):
        response = client.post(ANALYSIS_URL, json=analysis_request_body())
        payload = response.json()

        assert response.status_code == 200
        assert set(payload) >= {
            "requestId",
            "cycloneId",
            "analysisTimestamp",
            "status",
            "trajectoryPrediction",
            "intensityPrediction",
        }
        assert payload["status"] == "COMPLETED"

    def test_trajectory_fields_and_horizons(
        self, client, analysis_request_body, trained_registry
    ):
        payload = client.post(ANALYSIS_URL, json=analysis_request_body()).json()
        trajectory = payload["trajectoryPrediction"]

        assert trajectory["status"] == "COMPLETED"
        assert [p["forecastHours"] for p in trajectory["predictedPositions"]] == HORIZONS

        for position in trajectory["predictedPositions"]:
            assert set(position) >= {
                "forecastHours",
                "timestamp",
                "latitude",
                "longitude",
            }
            assert -90 <= position["latitude"] <= 90
            assert -180 <= position["longitude"] <= 180

        assert trajectory["model"]["name"] == "trajectory-model-v1"
        assert trajectory["model"]["version"] == "1.0"

    def test_intensity_separates_numbers_from_trend(
        self, client, analysis_request_body, trained_registry
    ):
        payload = client.post(ANALYSIS_URL, json=analysis_request_body()).json()
        intensity = payload["intensityPrediction"]

        assert intensity["status"] == "COMPLETED"
        assert intensity["trend"] in {
            "INTENSIFYING",
            "WEAKENING",
            "STABLE",
            "UNCERTAIN",
        }
        for point in intensity["forecast"]:
            assert set(point) >= {"forecastHours", "windSpeedKph", "pressureHpa"}
            assert point["windSpeedKph"] >= 0

    def test_intensity_unavailable_without_wind_and_pressure(
        self, client, analysis_request_body, trained_registry
    ):
        body = analysis_request_body()
        body["currentObservation"]["windSpeedKph"] = None
        body["currentObservation"]["pressureHpa"] = None

        payload = client.post(ANALYSIS_URL, json=body).json()

        assert payload["intensityPrediction"]["status"] == "NOT_AVAILABLE"
        assert payload["intensityPrediction"]["forecast"] == []


class TestPartialAnalysis:
    def test_missing_imagery_does_not_block_numerical_forecasts(
        self, client, analysis_request_body, trained_registry
    ):
        """Section 2's partial-analysis principle, stated as a test."""
        body = analysis_request_body(
            analysis_types=[
                "TRAJECTORY_PREDICTION",
                "INTENSITY_PREDICTION",
                "SATELLITE_ANALYSIS",
            ]
        )

        response = client.post(ANALYSIS_URL, json=body)
        payload = response.json()

        assert response.status_code == 200
        assert payload["status"] == "PARTIAL"
        assert payload["trajectoryPrediction"]["status"] == "COMPLETED"
        assert payload["intensityPrediction"]["status"] == "COMPLETED"
        assert payload["satelliteAnalysis"]["status"] == "NOT_AVAILABLE"

    def test_extension_points_never_fabricate(
        self, client, analysis_request_body, trained_registry
    ):
        body = analysis_request_body(
            analysis_types=["SATELLITE_ANALYSIS", "HISTORICAL_SIMILARITY"]
        )
        payload = client.post(ANALYSIS_URL, json=body).json()

        satellite = payload["satelliteAnalysis"]
        similarity = payload["historicalSimilarity"]

        assert satellite["status"] == "NOT_AVAILABLE"
        assert "cycloneDetected" not in satellite or satellite["cycloneDetected"] is None
        assert similarity["status"] == "NOT_AVAILABLE"
        assert similarity["similarCyclones"] == []

    def test_only_requested_analyses_appear(
        self, client, analysis_request_body, trained_registry
    ):
        body = analysis_request_body(analysis_types=["TRAJECTORY_PREDICTION"])
        payload = client.post(ANALYSIS_URL, json=body).json()

        assert payload["trajectoryPrediction"]["status"] == "COMPLETED"
        assert "intensityPrediction" not in payload
        assert payload["status"] == "COMPLETED"

    def test_status_is_one_of_the_contract_values(
        self, client, analysis_request_body, trained_registry
    ):
        payload = client.post(ANALYSIS_URL, json=analysis_request_body()).json()

        assert payload["status"] in {
            "COMPLETED",
            "PARTIAL",
            "NOT_AVAILABLE",
            "FAILED",
            "VALIDATION_ERROR",
        }


class TestErrorRequestIdEcho:
    """Section 13 puts requestId in the error body.

    A client correlating a failure needs it most when the request was rejected,
    so it is echoed on a 400 too -- but only when the payload genuinely carried
    one, never invented.
    """

    def test_a_rejected_request_echoes_its_request_id(self, client):
        response = client.post(
            "/api/v1/analysis/cyclone", json={"requestId": "corr-123"}
        )

        assert response.status_code == 400
        assert response.json()["requestId"] == "corr-123"

    def test_no_request_id_is_invented_when_none_was_sent(self, client):
        response = client.post("/api/v1/analysis/cyclone", json={})

        assert response.status_code == 400
        assert "requestId" not in response.json()

    def test_a_non_string_request_id_is_not_echoed(self, client):
        response = client.post(
            "/api/v1/analysis/cyclone", json={"requestId": {"nested": "object"}}
        )

        assert response.status_code == 400
        assert "requestId" not in response.json()

    def test_the_error_shape_still_matches_section_13(self, client):
        body = client.post(
            "/api/v1/analysis/cyclone", json={"requestId": "corr-9"}
        ).json()

        assert set(body) >= {"timestamp", "status", "errorCode", "message"}
        assert body["status"] == "VALIDATION_ERROR"

    def test_a_rejected_request_leaks_no_internals(self, client):
        blob = client.post(
            "/api/v1/analysis/cyclone", json={"requestId": "corr-9"}
        ).text.lower()

        for leak in ("traceback", "site-packages", ".venv", "d:\\", "/users/"):
            assert leak not in blob


class TestUncertaintyRadiusProvenance:
    """The forecast cone must be a measurement, not a plausible number.

    The Spring client draws the map's uncertainty cone from
    uncertaintyRadiusKm, so a fabricated value would put a confident-looking
    circle on a map on no evidence. It comes from the held-out evaluation in
    the checkpoint, and is absent when no evaluation recorded one.
    """

    def _checkpoint(self, directory, metrics):
        generator = np.random.default_rng(0)
        sequences = generator.normal(size=(20, 8, STEP_FEATURE_COUNT)).astype(
            np.float32
        )
        masks = np.ones((20, 8), dtype=np.float32)
        environments = generator.normal(
            size=(20, ENVIRONMENTAL_FEATURE_COUNT)
        ).astype(np.float32)

        save_checkpoint(
            path=checkpoint_path(directory, "trajectory"),
            model=TrajectoryModel(
                step_features=STEP_FEATURE_COUNT,
                environment_features=ENVIRONMENTAL_FEATURE_COUNT,
                horizons=HORIZONS,
            ),
            scaler=SequenceScaler().fit(sequences, masks, environments),
            model_name="trajectory-model-v1",
            model_version="1.0",
            horizons=HORIZONS,
            metrics=metrics,
        )
        reset_registry(directory)

    def test_radius_is_the_recorded_mean_error_for_that_horizon(
        self, client, temporary_checkpoint_dir, analysis_request_body
    ):
        self._checkpoint(
            temporary_checkpoint_dir,
            {
                "validation_skill": 0.5,
                "per_horizon": {
                    "6h": {"mean_error_km": 28.15},
                    "12h": {"mean_error_km": 61.17},
                    "24h": {"mean_error_km": 144.73},
                },
            },
        )
        positions = client.post(ANALYSIS_URL, json=analysis_request_body()).json()[
            "trajectoryPrediction"
        ]["predictedPositions"]

        radii = {p["forecastHours"]: p["uncertaintyRadiusKm"] for p in positions}
        assert radii == {6: 28.1, 12: 61.2, 24: 144.7}
        reset_registry()

    def test_no_radius_when_the_evaluation_recorded_none(
        self, client, temporary_checkpoint_dir, analysis_request_body
    ):
        """Absent, not zero. A zero radius would draw a cone claiming perfect
        accuracy."""
        self._checkpoint(temporary_checkpoint_dir, {"validation_skill": 0.5})
        positions = client.post(ANALYSIS_URL, json=analysis_request_body()).json()[
            "trajectoryPrediction"
        ]["predictedPositions"]

        assert all("uncertaintyRadiusKm" not in p for p in positions)
        reset_registry()

    def test_a_malformed_metrics_block_yields_no_radius(
        self, client, temporary_checkpoint_dir, analysis_request_body
    ):
        self._checkpoint(
            temporary_checkpoint_dir,
            {"validation_skill": 0.5, "per_horizon": {"6h": {"mean_error_km": "n/a"}}},
        )
        positions = client.post(ANALYSIS_URL, json=analysis_request_body()).json()[
            "trajectoryPrediction"
        ]["predictedPositions"]

        assert all("uncertaintyRadiusKm" not in p for p in positions)
        reset_registry()

    def test_a_horizon_missing_from_metrics_gets_no_radius(
        self, client, temporary_checkpoint_dir, analysis_request_body
    ):
        self._checkpoint(
            temporary_checkpoint_dir,
            {
                "validation_skill": 0.5,
                "per_horizon": {"6h": {"mean_error_km": 28.15}},
            },
        )
        positions = client.post(ANALYSIS_URL, json=analysis_request_body()).json()[
            "trajectoryPrediction"
        ]["predictedPositions"]

        radii = {p["forecastHours"]: p.get("uncertaintyRadiusKm") for p in positions}
        assert radii[6] == 28.1
        assert radii[12] is None and radii[24] is None
        reset_registry()


class TestReloadIsOptIn:
    """Auto-reload stays off unless asked for.

    On Windows the reloader's child process can outlive its parent and keep
    serving stale code on the port, so a plain `python app/main.py` must not
    start it.
    """

    def test_off_by_default(self, monkeypatch):
        from app.main import _reload_requested

        monkeypatch.delenv("RELOAD", raising=False)
        assert _reload_requested() is False

    @pytest.mark.parametrize("value", ["1", "true", "YES"])
    def test_on_when_requested(self, monkeypatch, value):
        from app.main import _reload_requested

        monkeypatch.setenv("RELOAD", value)
        assert _reload_requested() is True

    @pytest.mark.parametrize("value", ["", "0", "no", "false"])
    def test_off_for_anything_else(self, monkeypatch, value):
        from app.main import _reload_requested

        monkeypatch.setenv("RELOAD", value)
        assert _reload_requested() is False
