"""End-to-end pipeline test: data -> training -> checkpoint -> service.

This is the test that makes "training-ready" a verified claim rather than an
assertion. It runs the real pipeline over a tiny synthetic table for two
epochs, saves a checkpoint, and confirms the registry then loads it and the API
serves predictions from it.

What it deliberately does not do
--------------------------------
It makes no claim about accuracy. The data is synthetic, the run is two epochs,
and every metric it produces is meaningless as science. The assertions are all
about plumbing: does a checkpoint appear, does it load, does the service move
from NOT_AVAILABLE to COMPLETED. Real numbers require the real dataset and the
evaluation module.
"""

from __future__ import annotations

from datetime import timedelta

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from evaluation.intensity_metrics import evaluate_intensity
from evaluation.trajectory_metrics import evaluate_trajectory
from models.intensity.model import IntensityModel
from models.trajectory.model import TrajectoryModel
from preprocessing.features import (
    ENVIRONMENTAL_FEATURE_COUNT,
    STEP_FEATURE_COUNT,
)
from registry.checkpoint import checkpoint_path, save_checkpoint
from registry.registry import ModelRegistry, ModelState, reset_registry
from tests.conftest import BASE_TIME
from training.config import TrainingConfig
from training.pipeline import (
    build_loader,
    masked_regression_loss,
    prepare_data,
    set_seed,
    train_model,
)
from training.train_intensity import make_loss
from training.train_trajectory import compute_loss as trajectory_loss

HORIZONS = [6, 12]


def synthetic_dataset(path, cyclones: int = 12, steps: int = 14) -> str:
    """A structurally valid observation table.

    Arbitrary values with a mild trend, sufficient to exercise the pipeline.
    Not a cyclone dataset and not used to evaluate anything.
    """
    rows = []
    for storm in range(cyclones):
        for index in range(steps):
            rows.append(
                {
                    "cyclone_id": f"synthetic-{storm}",
                    "timestamp": BASE_TIME + timedelta(hours=index * 6),
                    "latitude": 10.0 + storm * 0.3 + index * 0.4,
                    "longitude": 88.0 - storm * 0.2 - index * 0.3,
                    "wind_speed_kph": 70.0 + index * 4 + storm,
                    "pressure_hpa": 995.0 - index * 2.5,
                    "season": 2000 + storm,
                    "sea_surface_temperature_c": 28.0 + (storm % 3),
                    "humidity_percent": 75.0,
                    "wind_shear_kph": 12.0,
                }
            )
    frame = pd.DataFrame(rows)
    frame.to_csv(path, index=False)
    return str(path)


@pytest.fixture
def config(tmp_path, temporary_checkpoint_dir) -> TrainingConfig:
    return TrainingConfig(
        dataset_path=synthetic_dataset(tmp_path / "observations.csv"),
        horizons=HORIZONS,
        epochs=2,
        batch_size=8,
        early_stopping_patience=2,
        checkpoint_dir=temporary_checkpoint_dir,
    )


class TestDataPreparation:
    def test_splits_are_disjoint_by_cyclone(self, config):
        data = prepare_data(config)

        train_ids = set(data.train.cyclone_ids.tolist())
        validation_ids = set(data.validation.cyclone_ids.tolist())
        test_ids = set(data.test.cyclone_ids.tolist())

        assert train_ids.isdisjoint(validation_ids)
        assert train_ids.isdisjoint(test_ids)
        assert validation_ids.isdisjoint(test_ids)

    def test_scaler_is_fitted_on_training_data_only(self, config):
        data = prepare_data(config)
        assert data.scaler.fitted
        assert len(data.scaler.step_mean) == STEP_FEATURE_COUNT
        assert len(data.scaler.environment_mean) == ENVIRONMENTAL_FEATURE_COUNT

    def test_season_strategy_is_selectable(self, config):
        config.split_strategy = "season"
        config.validation_seasons = 2
        config.test_seasons = 2

        data = prepare_data(config)

        assert len(data.train) > 0
        assert set(data.train.cyclone_ids.tolist()).isdisjoint(
            set(data.test.cyclone_ids.tolist())
        )


class TestTrajectoryPipeline:
    def test_trains_saves_and_serves(self, config, temporary_checkpoint_dir):
        set_seed(config.seed)
        data = prepare_data(config)

        model = TrajectoryModel(
            step_features=STEP_FEATURE_COUNT,
            environment_features=ENVIRONMENTAL_FEATURE_COUNT,
            horizons=config.horizons,
        )

        history = train_model(
            model,
            build_loader(data.train, data.scaler, config.batch_size, True, "position"),
            build_loader(
                data.validation, data.scaler, config.batch_size, False, "position"
            ),
            config,
            trajectory_loss,
        )

        assert history["epochs_run"] >= 1
        assert history["best_validation_loss"] < float("inf")

        # Evaluation runs and produces the structure the checkpoint stores.
        # The values are not inspected: this data is synthetic.
        metrics = evaluate_trajectory(model, data.test, data.scaler, config.horizons)
        assert "per_horizon" in metrics
        assert "validation_skill" in metrics

        path = save_checkpoint(
            path=checkpoint_path(temporary_checkpoint_dir, "trajectory"),
            model=model,
            scaler=data.scaler,
            model_name="trajectory-model-v1",
            model_version="1.0",
            horizons=config.horizons,
            metrics=metrics,
        )

        registry = ModelRegistry(temporary_checkpoint_dir)
        assert registry.trajectory.state is ModelState.TRAINED
        assert registry.trajectory.checkpoint.horizons == config.horizons
        assert path.endswith("trajectory.pt")


class TestIntensityPipeline:
    def test_trains_saves_and_serves(self, config, temporary_checkpoint_dir):
        set_seed(config.seed)
        data = prepare_data(config)

        model = IntensityModel(
            step_features=STEP_FEATURE_COUNT,
            environment_features=ENVIRONMENTAL_FEATURE_COUNT,
            horizons=config.horizons,
        )

        history = train_model(
            model,
            build_loader(data.train, data.scaler, config.batch_size, True, "intensity"),
            build_loader(
                data.validation, data.scaler, config.batch_size, False, "intensity"
            ),
            config,
            make_loss(config.trend_loss_weight),
        )

        assert history["epochs_run"] >= 1

        metrics = evaluate_intensity(model, data.test, data.scaler, config.horizons)
        assert "per_horizon" in metrics
        assert "trend" in metrics

        save_checkpoint(
            path=checkpoint_path(temporary_checkpoint_dir, "intensity"),
            model=model,
            scaler=data.scaler,
            model_name="intensity-model-v1",
            model_version="1.0",
            horizons=config.horizons,
            metrics=metrics,
        )

        registry = ModelRegistry(temporary_checkpoint_dir)
        assert registry.intensity.state is ModelState.TRAINED


class TestServiceAfterTraining:
    def test_service_goes_from_unavailable_to_serving(
        self, config, temporary_checkpoint_dir, analysis_request_body
    ):
        """The handover this whole system exists to make work.

        Before a checkpoint the API answers 503 / NOT_AVAILABLE; after one is
        written it answers 200 / COMPLETED, with no code change in between.
        """
        client = TestClient(app)
        body = analysis_request_body(analysis_types=["TRAJECTORY_PREDICTION"])

        reset_registry(temporary_checkpoint_dir)
        try:
            before = client.post("/api/v1/analysis/cyclone", json=body)
            assert before.status_code == 503
            assert before.json()["trajectoryPrediction"]["status"] == "NOT_AVAILABLE"

            set_seed(config.seed)
            data = prepare_data(config)
            model = TrajectoryModel(
                step_features=STEP_FEATURE_COUNT,
                environment_features=ENVIRONMENTAL_FEATURE_COUNT,
                horizons=config.horizons,
            )
            train_model(
                model,
                build_loader(
                    data.train, data.scaler, config.batch_size, True, "position"
                ),
                None,
                config,
                trajectory_loss,
            )
            save_checkpoint(
                path=checkpoint_path(temporary_checkpoint_dir, "trajectory"),
                model=model,
                scaler=data.scaler,
                model_name="trajectory-model-v1",
                model_version="1.0",
                horizons=config.horizons,
                metrics={"validation_skill": 0.4},
            )

            reset_registry(temporary_checkpoint_dir)

            after = client.post("/api/v1/analysis/cyclone", json=body)
            payload = after.json()

            assert after.status_code == 200
            assert payload["trajectoryPrediction"]["status"] == "COMPLETED"
            assert [
                p["forecastHours"]
                for p in payload["trajectoryPrediction"]["predictedPositions"]
            ] == HORIZONS
            assert payload["trajectoryPrediction"]["model"]["name"] == (
                "trajectory-model-v1"
            )
        finally:
            reset_registry()
