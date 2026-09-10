"""Tests for how a satellite frame's source reaches the model.

This fixes a latent defect: training tagged every frame with a sensor key
("GOES|10.7 UM THERMAL INFRARED"), while inference built its key from imageType
alone, so the two could never match. Every real request therefore used the
UNKNOWN embedding slot -- which training never taught, because every training
frame had a known source. Two changes close it, and both are pinned here:

* imageType may carry the sensor as "<SENSOR>|<BAND>", normalised exactly as
  training normalises catalog fields;
* training drops the source on a fraction of frames, so the UNKNOWN slot
  learns something real for requests that cannot name their sensor.
"""

from __future__ import annotations

import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.services import satellite_inference
from models.satellite.model import SatelliteDetectionModel
from preprocessing.satellite import (
    CLASS_NAMES,
    SatelliteFrame,
    SatelliteFrameDataset,
    source_key,
    source_key_from_image_type,
)
from registry.checkpoint import checkpoint_path, save_vision_checkpoint
from registry.registry import reset_registry

ANALYSIS_URL = "/api/v1/analysis/cyclone"


class TestImageTypeConvention:
    def test_sensor_and_band_produce_the_training_key(self):
        """The whole point: the same sensor and band give the same key on both
        sides, whatever the caller's casing or spacing."""
        catalog_key = SatelliteFrame(
            image_id="a", cyclone_id="A", path="a.png", is_cyclone=True,
            satellite="GOES", spectral_band="10.7 um Thermal Infrared",
        ).source_key

        assert source_key_from_image_type("GOES|10.7 um Thermal Infrared") == catalog_key
        assert source_key_from_image_type("goes | 10.7 UM thermal  infrared") == catalog_key

    def test_parenthetical_vendor_wording_is_ignored_on_both_sides(self):
        assert source_key_from_image_type(
            "GOES|10.7 um Thermal Infrared (GOES Clean IR)"
        ) == source_key("GOES", "10.7 um Thermal Infrared")

    def test_insat_example(self):
        assert source_key_from_image_type("INSAT-3DR|TIR1 10.8 um") == "INSAT-3DR|TIR1 10.8 UM"

    def test_a_plain_image_type_stays_valid_and_names_no_sensor(self):
        """The contract's own example is imageType "INFRARED"."""
        assert source_key_from_image_type("INFRARED") == "UNKNOWN_SATELLITE|INFRARED"

    def test_missing_image_type(self):
        assert source_key_from_image_type(None) == "UNKNOWN_SATELLITE|UNKNOWN_BAND"

    @pytest.mark.parametrize("value", ["|TIR1", "INSAT-3DR|", " | "])
    def test_a_half_empty_pair_does_not_invent_a_sensor(self, value):
        assert source_key_from_image_type(value).startswith("UNKNOWN_SATELLITE|")


def _frames(tmp_path, count=40):
    path = tmp_path / "frame.png"
    Image.fromarray(np.full((32, 32), 128, dtype=np.uint8), mode="L").save(path)
    return [
        SatelliteFrame(image_id=str(i), cyclone_id=f"S{i}", path=str(path),
                       is_cyclone=bool(i % 2), satellite="GOES", spectral_band="IR")
        for i in range(count)
    ]


def _sources(dataset):
    return [int(dataset[i][1]) for i in range(len(dataset))]


class TestSourceDropout:
    VOCABULARY = {"UNKNOWN": 0, "GOES|IR": 1}

    def test_training_frames_sometimes_use_the_unknown_slot(self, tmp_path):
        torch.manual_seed(0)
        dataset = SatelliteFrameDataset(_frames(tmp_path, 200), self.VOCABULARY,
                                        train=True, source_dropout=0.2)
        sources = _sources(dataset)

        assert 0 in sources and 1 in sources
        # ~20% of 200; loose bounds so the test is about behaviour, not luck.
        assert 15 <= sources.count(0) <= 70

    def test_evaluation_never_drops_the_source(self, tmp_path):
        """Per-source scores must describe the model as served."""
        dataset = SatelliteFrameDataset(_frames(tmp_path), self.VOCABULARY,
                                        train=False, source_dropout=0.9)
        assert set(_sources(dataset)) == {1}

    def test_zero_dropout_leaves_every_source_intact(self, tmp_path):
        dataset = SatelliteFrameDataset(_frames(tmp_path), self.VOCABULARY,
                                        train=True, source_dropout=0.0)
        assert set(_sources(dataset)) == {1}

    def test_full_dropout_trains_only_the_unknown_slot(self, tmp_path):
        dataset = SatelliteFrameDataset(_frames(tmp_path), self.VOCABULARY,
                                        train=True, source_dropout=1.0)
        assert set(_sources(dataset)) == {0}

    def test_seeded_runs_drop_the_same_frames(self, tmp_path):
        frames = _frames(tmp_path, 60)
        runs = []
        for _ in range(2):
            torch.manual_seed(7)
            runs.append(_sources(SatelliteFrameDataset(
                frames, self.VOCABULARY, train=True, source_dropout=0.3)))
        assert runs[0] == runs[1]

    @pytest.mark.parametrize("value", [-0.1, 1.5])
    def test_an_impossible_rate_is_rejected(self, tmp_path, value):
        with pytest.raises(ValueError):
            SatelliteFrameDataset(_frames(tmp_path, 2), self.VOCABULARY,
                                  train=True, source_dropout=value)


class TestInferenceUsesTheConvention:
    """End to end through the API, with the network stubbed out."""

    KNOWN = "INSAT-3DR|TIR1 10.8 UM"

    @pytest.fixture
    def served(self, temporary_checkpoint_dir, monkeypatch):
        save_vision_checkpoint(
            path=checkpoint_path(temporary_checkpoint_dir, "satellite"),
            model=SatelliteDetectionModel(source_count=2, pretrained=False),
            model_name="cyclone-vision-v1",
            model_version="1.0",
            source_vocabulary={"UNKNOWN": 0, self.KNOWN: 1},
            class_names=CLASS_NAMES,
            label_definition="test",
        )
        reset_registry(temporary_checkpoint_dir)
        image = Image.fromarray(np.full((64, 64), 128, dtype=np.uint8), mode="L")
        monkeypatch.setattr(satellite_inference, "_fetch", lambda url: (image, None))
        yield TestClient(app)
        reset_registry()

    def _block(self, client, body_factory, image_type):
        body = body_factory(analysis_types=["SATELLITE_ANALYSIS"])
        body["satelliteImage"] = {"imageUrl": "https://example.com/f.png",
                                  "imageType": image_type}
        return client.post(ANALYSIS_URL, json=body).json()["satelliteAnalysis"]

    def test_a_named_known_sensor_is_recognised(self, served, analysis_request_body):
        block = self._block(served, analysis_request_body, "INSAT-3DR|TIR1 10.8 um")

        assert block["status"] == "COMPLETED"
        assert "not trained on" not in (block.get("reason") or "")

    def test_a_plain_image_type_is_served_but_flagged(self, served, analysis_request_body):
        block = self._block(served, analysis_request_body, "INFRARED")

        assert block["status"] == "COMPLETED"
        assert "not trained on" in block["reason"]

    def test_an_unseen_sensor_is_flagged(self, served, analysis_request_body):
        block = self._block(served, analysis_request_body, "HIMAWARI-9|B13 10.4 um")
        assert "not trained on" in block["reason"]

    def test_health_publishes_the_exact_keys_to_send(self, served):
        """How a caller learns the strings the convention expects."""
        sources = served.get("/api/v1/health").json()["models"]["satellite"]["sources"]
        assert sources == [self.KNOWN]
