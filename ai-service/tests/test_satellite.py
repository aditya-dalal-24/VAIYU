"""Satellite analysis tests (contract section 8).

Covers the catalog interface, the model, source conditioning, the checkpoint,
and the API path end to end -- including a real training run over synthetic
images, so "training-ready" is verified for this model too.

As elsewhere, synthetic images exercise software behaviour only. No test claims
the classifier is scientifically accurate; on generated noise it cannot be.
"""

from __future__ import annotations

import json
import os

import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from evaluation.satellite_metrics import classification_scores, evaluate_satellite
from models.satellite.model import SatelliteDetectionModel
from preprocessing.satellite import (
    CLASS_NAMES,
    SatelliteDatasetError,
    build_source_vocabulary,
    build_transform,
    describe_frames,
    load_catalog,
    source_key,
    torch_dataset,
)
from registry.checkpoint import (
    CheckpointError,
    checkpoint_path,
    load_vision_checkpoint,
    save_vision_checkpoint,
)
from registry.registry import ModelRegistry, ModelState, reset_registry

ANALYSIS_URL = "/api/v1/analysis/cyclone"


def write_catalog(directory, storms: int = 6, frames_per_storm: int = 4,
                  sources=(("NOAA GOES", "10.7 um Thermal Infrared"),)):
    """A structurally valid catalog with generated frames.

    Random pixels, not satellite imagery. Sufficient to drive the pipeline.
    """
    images_dir = os.path.join(str(directory), "images")
    os.makedirs(images_dir, exist_ok=True)

    generator = np.random.default_rng(0)
    entries = []

    for storm in range(storms):
        satellite, band = sources[storm % len(sources)]
        # Whole storms into one split, matching the leakage rule.
        split = "train" if storm < storms - 2 else ("validation" if storm == storms - 2 else "test")
        for index in range(frames_per_storm):
            image_id = f"s{storm}_{index}"
            path = os.path.join(images_dir, f"{image_id}.png")
            Image.fromarray(
                generator.integers(0, 255, size=(64, 64), dtype=np.uint8), mode="L"
            ).save(path)

            entries.append(
                {
                    "image_id": image_id,
                    "cyclone_id": f"storm-{storm}",
                    "storage_path": os.path.join("images", f"{image_id}.png"),
                    "is_cyclone": bool(index % 2),
                    "split": split,
                    "satellite": satellite,
                    "spectral_band": band,
                    "image_type": "infrared",
                    "ocean_basin": "Atlantic",
                }
            )

    catalog_path = os.path.join(str(directory), "catalog.json")
    with open(catalog_path, "w", encoding="utf-8") as handle:
        json.dump(entries, handle)
    return catalog_path


class TestSourceKey:
    def test_same_sensor_and_band_share_a_key(self):
        first = source_key("NOAA GOES", "10.7 um Thermal Infrared (GOES Clean IR)")
        second = source_key("noaa goes", "10.7 um Thermal Infrared")
        assert first == second

    def test_different_sensors_differ(self):
        assert source_key("NOAA GOES", "10.7 um IR") != source_key("INSAT-3D", "10.7 um IR")

    def test_different_bands_differ(self):
        """Brightness means something different in each band."""
        assert source_key("NOAA GOES", "Visible") != source_key("NOAA GOES", "Infrared")

    def test_missing_metadata_still_produces_a_key(self):
        assert source_key(None, None, "infrared")


class TestCatalog:
    def test_loads_and_resolves_paths(self, tmp_path):
        frames = load_catalog(write_catalog(tmp_path))

        assert len(frames) == 24
        assert all(os.path.exists(frame.path) for frame in frames)

    def test_missing_catalog_raises(self, tmp_path):
        with pytest.raises(SatelliteDatasetError, match="not found"):
            load_catalog(str(tmp_path / "absent.json"))

    def test_missing_required_field_raises(self, tmp_path):
        path = tmp_path / "catalog.json"
        path.write_text(json.dumps([{"image_id": "a"}]), encoding="utf-8")

        with pytest.raises(SatelliteDatasetError, match="missing"):
            load_catalog(str(path))

    def test_missing_image_file_raises(self, tmp_path):
        catalog_path = write_catalog(tmp_path)
        with open(catalog_path, encoding="utf-8") as handle:
            entries = json.load(handle)
        os.remove(os.path.join(str(tmp_path), entries[0]["storage_path"]))

        with pytest.raises(SatelliteDatasetError, match="do not exist"):
            load_catalog(catalog_path)

    def test_describe_reports_sources_and_storms(self, tmp_path):
        summary = describe_frames(load_catalog(write_catalog(tmp_path)))

        assert summary["frames"] == 24
        assert summary["storms"] == 6
        assert len(summary["sources"]) == 1

    def test_multiple_sources_are_tracked_separately(self, tmp_path):
        catalog = write_catalog(
            tmp_path,
            sources=(("NOAA GOES", "10.7 um IR"), ("INSAT-3D", "Visible")),
        )
        summary = describe_frames(load_catalog(catalog))

        assert len(summary["sources"]) == 2


class TestSourceVocabulary:
    def test_unknown_is_always_index_zero(self, tmp_path):
        vocabulary = build_source_vocabulary(load_catalog(write_catalog(tmp_path)))
        assert vocabulary["UNKNOWN"] == 0

    def test_every_source_gets_a_distinct_index(self, tmp_path):
        catalog = write_catalog(
            tmp_path,
            sources=(("NOAA GOES", "IR"), ("INSAT-3D", "Visible"), ("Himawari", "IR")),
        )
        vocabulary = build_source_vocabulary(load_catalog(catalog))

        assert len(set(vocabulary.values())) == len(vocabulary)
        assert len(vocabulary) == 4  # three sources plus UNKNOWN


class TestModel:
    def test_forward_pass_shape(self):
        model = SatelliteDetectionModel(source_count=3, pretrained=False)
        images = torch.randn(5, 3, 224, 224)
        sources = torch.tensor([0, 1, 2, 1, 0])

        logits = model(images, sources)

        assert logits.shape == (5,)
        assert torch.isfinite(logits).all()

    def test_source_changes_the_output(self):
        """Conditioning must actually reach the prediction.

        If the embedding were ignored, every sensor would get the same answer
        and the multi-source handling would be decorative.
        """
        torch.manual_seed(0)
        model = SatelliteDetectionModel(source_count=4, pretrained=False)
        model.eval()

        image = torch.randn(1, 3, 224, 224)
        with torch.no_grad():
            first = model(image, torch.tensor([1]))
            second = model(image, torch.tensor([2]))

        assert not torch.allclose(first, second)

    def test_freeze_backbone_leaves_the_head_trainable(self):
        model = SatelliteDetectionModel(source_count=2, pretrained=False)
        model.freeze_backbone(trainable_blocks=1)

        assert all(p.requires_grad for p in model.head.parameters())
        assert all(p.requires_grad for p in model.backbone.layer4.parameters())
        assert not any(p.requires_grad for p in model.backbone.layer1.parameters())

    def test_config_round_trip(self):
        model = SatelliteDetectionModel(source_count=5, pretrained=False)
        rebuilt = SatelliteDetectionModel.from_config(model.config())
        rebuilt.load_state_dict(model.state_dict(), strict=True)


class TestVisionCheckpoint:
    def build(self, directory, vocabulary=None):
        model = SatelliteDetectionModel(source_count=3, pretrained=False)
        return save_vision_checkpoint(
            path=checkpoint_path(directory, "satellite"),
            model=model,
            model_name="cyclone-vision-v1",
            model_version="1.0",
            source_vocabulary=vocabulary or {"UNKNOWN": 0, "NOAA GOES|IR": 1, "INSAT-3D|VISIBLE": 2},
            class_names=CLASS_NAMES,
            label_definition="34-knot threshold",
        )

    def test_round_trip(self, temporary_checkpoint_dir):
        path = self.build(temporary_checkpoint_dir)
        checkpoint = load_vision_checkpoint(path)

        assert checkpoint.model_name == "cyclone-vision-v1"
        assert checkpoint.knows_source("NOAA GOES|IR")
        assert not checkpoint.knows_source("HIMAWARI|IR")
        assert checkpoint.source_index("HIMAWARI|IR") == 0
        assert checkpoint.label_definition == "34-knot threshold"

    def test_corrupt_file_rejected(self, tmp_path):
        path = tmp_path / "satellite.pt"
        path.write_bytes(b"not a checkpoint")

        with pytest.raises(CheckpointError, match="could not be read"):
            load_vision_checkpoint(str(path))

    def test_image_spec_mismatch_rejected(self, tmp_path, temporary_checkpoint_dir):
        path = self.build(temporary_checkpoint_dir)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["image_spec_version"] = "0.1"

        altered = tmp_path / "satellite.pt"
        torch.save(payload, str(altered))

        with pytest.raises(CheckpointError, match="image spec"):
            load_vision_checkpoint(str(altered))

    def test_registry_loads_it(self, temporary_checkpoint_dir):
        self.build(temporary_checkpoint_dir)
        registry = ModelRegistry(temporary_checkpoint_dir)

        assert registry.satellite.state is ModelState.TRAINED
        assert registry.satellite.is_ready
        assert "NOAA GOES|IR" in registry.satellite.summary()["sources"]

    def test_untrained_satellite_reports_a_reason(self, temporary_checkpoint_dir):
        registry = ModelRegistry(temporary_checkpoint_dir)

        assert registry.satellite.state is ModelState.UNTRAINED
        assert not registry.satellite.is_ready
        assert registry.satellite.reason


class TestEvaluation:
    def test_baseline_is_reported(self):
        probabilities = np.array([0.9, 0.8, 0.2, 0.1])
        labels = np.array([1.0, 1.0, 0.0, 0.0])

        scores = classification_scores(probabilities, labels)

        assert scores["accuracy"] == 1.0
        assert scores["majority_class_baseline"] == 0.5
        assert scores["beats_majority_baseline"] is True

    def test_always_predicting_one_class_does_not_beat_the_baseline(self):
        """The failure the baseline exists to expose."""
        probabilities = np.array([0.9, 0.9, 0.9, 0.9, 0.9])
        labels = np.array([1.0, 1.0, 1.0, 0.0, 0.0])

        scores = classification_scores(probabilities, labels)

        assert scores["accuracy"] == 0.6
        assert scores["majority_class_baseline"] == 0.6
        assert scores["beats_majority_baseline"] is False


class TestApiIntegration:
    def test_untrained_satellite_returns_not_available(
        self, temporary_checkpoint_dir, analysis_request_body
    ):
        reset_registry(temporary_checkpoint_dir)
        try:
            client = TestClient(app)
            body = analysis_request_body(analysis_types=["SATELLITE_ANALYSIS"])
            body["satelliteImage"] = {
                "imageUrl": "https://example.com/frame.png",
                "imageType": "INFRARED",
            }

            payload = client.post(ANALYSIS_URL, json=body).json()
            block = payload["satelliteAnalysis"]

            assert block["status"] == "NOT_AVAILABLE"
            assert block["reason"]
            assert "cycloneDetected" not in block or block["cycloneDetected"] is None
        finally:
            reset_registry()

    def test_trained_satellite_without_an_image_says_so(
        self, temporary_checkpoint_dir, analysis_request_body
    ):
        """A trained model plus no imagery is a different failure from no model."""
        TestVisionCheckpoint().build(temporary_checkpoint_dir)
        reset_registry(temporary_checkpoint_dir)
        try:
            client = TestClient(app)
            body = analysis_request_body(analysis_types=["SATELLITE_ANALYSIS"])

            block = client.post(ANALYSIS_URL, json=body).json()["satelliteAnalysis"]

            assert block["status"] == "NOT_AVAILABLE"
            assert "no satelliteimage" in block["reason"].lower()
        finally:
            reset_registry()

    def test_unreachable_image_degrades_not_crashes(
        self, temporary_checkpoint_dir, analysis_request_body
    ):
        TestVisionCheckpoint().build(temporary_checkpoint_dir)
        reset_registry(temporary_checkpoint_dir)
        try:
            client = TestClient(app)
            body = analysis_request_body(analysis_types=["SATELLITE_ANALYSIS"])
            body["satelliteImage"] = {
                "imageUrl": "http://127.0.0.1:9/nothing-here.png",
                "imageType": "INFRARED",
            }

            response = client.post(ANALYSIS_URL, json=body)
            block = response.json()["satelliteAnalysis"]

            assert block["status"] == "NOT_AVAILABLE"
            # Null fields are omitted rather than serialised as null, so the
            # absence of the key is what "no detection was made" looks like.
            assert block.get("cycloneDetected") is None
            assert "Traceback" not in response.text
        finally:
            reset_registry()

    def test_non_http_url_is_refused(
        self, temporary_checkpoint_dir, analysis_request_body
    ):
        TestVisionCheckpoint().build(temporary_checkpoint_dir)
        reset_registry(temporary_checkpoint_dir)
        try:
            client = TestClient(app)
            body = analysis_request_body(analysis_types=["SATELLITE_ANALYSIS"])
            body["satelliteImage"] = {"imageUrl": "file:///etc/passwd"}

            block = client.post(ANALYSIS_URL, json=body).json()["satelliteAnalysis"]

            assert block["status"] == "NOT_AVAILABLE"
            assert "http" in block["reason"].lower()
        finally:
            reset_registry()

    def test_satellite_does_not_block_numerical_forecasts(
        self, temporary_checkpoint_dir, analysis_request_body
    ):
        """Section 2: missing imagery must not prevent a trajectory forecast."""
        reset_registry(temporary_checkpoint_dir)
        try:
            client = TestClient(app)
            body = analysis_request_body(
                analysis_types=["TRAJECTORY_PREDICTION", "SATELLITE_ANALYSIS"]
            )

            payload = client.post(ANALYSIS_URL, json=body).json()

            # Both unavailable here because nothing is trained, but each
            # reports independently rather than one masking the other.
            assert payload["trajectoryPrediction"]["status"] == "NOT_AVAILABLE"
            assert payload["satelliteAnalysis"]["status"] == "NOT_AVAILABLE"
        finally:
            reset_registry()


class TestTrainingPipeline:
    def test_dataset_yields_model_ready_batches(self, tmp_path):
        frames = load_catalog(write_catalog(tmp_path))
        vocabulary = build_source_vocabulary(frames)
        dataset = torch_dataset(frames, vocabulary, train=False)

        image, source, label = dataset[0]

        assert image.shape == (3, 224, 224)
        assert source.dtype == torch.long
        assert label.item() in (0.0, 1.0)

    def test_augmentation_only_applies_to_training(self, tmp_path):
        frames = load_catalog(write_catalog(tmp_path))
        image = Image.open(frames[0].path).convert("L")

        evaluation_transform = build_transform(train=False)
        first = evaluation_transform(image)
        second = evaluation_transform(image)

        # Evaluation must be deterministic, or a score is not reproducible.
        assert torch.allclose(first, second)

    def test_end_to_end_train_and_serve(self, tmp_path, temporary_checkpoint_dir):
        """Catalog -> training -> checkpoint -> registry, in one run.

        Two epochs on generated noise. Asserts only that the machinery works;
        the resulting model predicts nothing meaningful and no score is checked.
        """
        from torch.utils.data import DataLoader

        frames = load_catalog(write_catalog(tmp_path, storms=6, frames_per_storm=4))
        train_frames = [f for f in frames if f.split == "train"]
        test_frames = [f for f in frames if f.split == "test"]

        vocabulary = build_source_vocabulary(train_frames)
        model = SatelliteDetectionModel(source_count=len(vocabulary), pretrained=False)
        model.freeze_backbone(trainable_blocks=1)

        loader = DataLoader(
            torch_dataset(train_frames, vocabulary, train=True), batch_size=4, shuffle=True
        )
        optimiser = torch.optim.AdamW(
            [p for p in model.parameters() if p.requires_grad], lr=1e-3
        )
        criterion = torch.nn.BCEWithLogitsLoss()

        for _ in range(2):
            model.train()
            for images, sources, labels in loader:
                optimiser.zero_grad()
                criterion(model(images, sources), labels).backward()
                optimiser.step()

        test_loader = DataLoader(
            torch_dataset(test_frames, vocabulary, train=False), batch_size=4
        )
        metrics = evaluate_satellite(model, test_loader, test_frames)
        assert "accuracy" in metrics
        assert "per_source_accuracy" in metrics
        assert "per_storm_accuracy" in metrics

        save_vision_checkpoint(
            path=checkpoint_path(temporary_checkpoint_dir, "satellite"),
            model=model,
            model_name="cyclone-vision-v1",
            model_version="1.0",
            source_vocabulary=vocabulary,
            class_names=CLASS_NAMES,
            metrics=metrics,
        )

        registry = ModelRegistry(temporary_checkpoint_dir)
        assert registry.satellite.state is ModelState.TRAINED
