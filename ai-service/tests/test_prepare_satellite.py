"""Tests for the satellite catalog builder.

The property that matters is storm identity. Storm-centred infrared frames three
hours apart are nearly identical, so if a storm's frames land in both train and
test the reported accuracy is meaningless. These tests assert the script refuses
to produce such a catalog rather than producing one that trains fine and scores
a lie.
"""

from __future__ import annotations

import json

import numpy as np
import pytest
from PIL import Image

from preprocessing.satellite import SatelliteDatasetError, load_catalog
from training.prepare_satellite import (
    TROPICAL_STORM_KNOTS,
    from_hursat,
    from_imagefolder,
    summarise,
    write_catalog,
)


def make_tree(root, layout):
    """layout: {split: {class: [(storm, frame_count)]}}"""
    for split, classes in layout.items():
        for label, storms in classes.items():
            directory = root / split / label
            directory.mkdir(parents=True, exist_ok=True)
            for storm, count in storms:
                for frame in range(count):
                    image = Image.fromarray(
                        np.full((32, 32), 128, dtype=np.uint8), mode="L"
                    )
                    image.save(directory / f"{storm}_{frame:03d}.jpg")
    return root


def simple_tree(tmp_path):
    return make_tree(
        tmp_path / "images",
        {
            "train": {"cyclone": [("alpha", 3)], "non_cyclone": [("bravo", 2)]},
            "validation": {"cyclone": [("charlie", 2)]},
            "test": {"non_cyclone": [("delta", 2)]},
        },
    )


class TestImageFolder:
    def test_reads_every_frame(self, tmp_path):
        entries = from_imagefolder(str(simple_tree(tmp_path)), str(tmp_path))
        assert len(entries) == 9

    def test_class_comes_from_the_directory_name(self, tmp_path):
        entries = from_imagefolder(str(simple_tree(tmp_path)), str(tmp_path))
        by_storm = {e["cyclone_id"]: e["is_cyclone"] for e in entries}

        assert by_storm["ALPHA"] is True
        assert by_storm["BRAVO"] is False

    def test_directory_split_is_preserved(self, tmp_path):
        """These releases are already partitioned by storm; re-hashing would
        throw the dataset author's partition away for nothing."""
        entries = from_imagefolder(str(simple_tree(tmp_path)), str(tmp_path))
        by_storm = {e["cyclone_id"]: e["split"] for e in entries}

        assert by_storm["ALPHA"] == "train"
        assert by_storm["CHARLIE"] == "validation"
        assert by_storm["DELTA"] == "test"

    def test_storm_id_groups_frames_of_one_storm(self, tmp_path):
        entries = from_imagefolder(str(simple_tree(tmp_path)), str(tmp_path))
        alpha = [e for e in entries if e["cyclone_id"] == "ALPHA"]

        assert len(alpha) == 3
        assert len({e["image_id"] for e in alpha}) == 3

    def test_paths_resolve_from_the_catalog_directory(self, tmp_path):
        """load_catalog resolves storage_path against the catalog's own
        directory, which is what makes a catalog portable to the training
        machine. Paths relative to anything else silently resolve to nothing.
        """
        root = simple_tree(tmp_path)
        output = tmp_path / "catalog.json"
        entries = from_imagefolder(str(root), str(tmp_path))
        write_catalog(entries, str(output))

        frames = load_catalog(str(output))
        assert len(frames) == len(entries)

    def test_catalog_written_beside_the_images_uses_the_images_prefix(self, tmp_path):
        entries = from_imagefolder(str(simple_tree(tmp_path)), str(tmp_path))
        assert all(e["storage_path"].startswith("images/") for e in entries)

    def test_records_the_sensor_and_band(self, tmp_path):
        entries = from_imagefolder(str(simple_tree(tmp_path)), str(tmp_path))

        assert entries[0]["satellite"] == "GOES"
        assert "10.7" in entries[0]["spectral_band"]

    def test_alternative_class_directory_names_are_accepted(self, tmp_path):
        root = make_tree(
            tmp_path / "images",
            {"train": {"cyclones": [("alpha", 1)], "ambient": [("bravo", 1)]}},
        )
        entries = from_imagefolder(str(root), str(tmp_path))

        assert {e["cyclone_id"]: e["is_cyclone"] for e in entries} == {
            "ALPHA": True,
            "BRAVO": False,
        }

    def test_an_unrecognised_class_directory_fails_loudly(self, tmp_path):
        root = make_tree(tmp_path / "images", {"train": {"maybe": [("alpha", 1)]}})

        with pytest.raises(SatelliteDatasetError, match="cannot tell the class"):
            from_imagefolder(str(root), str(tmp_path))

    def test_an_unrecoverable_storm_id_fails_rather_than_guessing(self, tmp_path):
        """The critical refusal.

        Falling back to one storm per image would produce a catalog that trains
        without complaint and reports an inflated score, because near-identical
        frames would be split across train and test.
        """
        directory = tmp_path / "images" / "train" / "cyclone"
        directory.mkdir(parents=True)
        Image.fromarray(np.zeros((32, 32), dtype=np.uint8), mode="L").save(
            directory / "frame.jpg"
        )

        with pytest.raises(SatelliteDatasetError, match="storm id"):
            from_imagefolder(str(tmp_path / "images"), str(tmp_path))

    def test_a_custom_storm_pattern_is_honoured(self, tmp_path):
        directory = tmp_path / "images" / "train" / "cyclone"
        directory.mkdir(parents=True)
        Image.fromarray(np.zeros((32, 32), dtype=np.uint8), mode="L").save(
            directory / "2019114N06084-0001.jpg"
        )

        entries = from_imagefolder(
            str(tmp_path / "images"),
            str(tmp_path),
            storm_pattern=r"^(?P<storm>[A-Za-z0-9]+)-\d+",
        )
        assert entries[0]["cyclone_id"] == "2019114N06084"

    def test_a_missing_root_is_reported(self, tmp_path):
        with pytest.raises(SatelliteDatasetError, match="not a directory"):
            from_imagefolder(str(tmp_path / "absent"), str(tmp_path))


class TestLeakageGuard:
    def test_a_storm_in_two_splits_is_rejected(self, tmp_path):
        root = make_tree(
            tmp_path / "images",
            {
                "train": {"cyclone": [("alpha", 2)]},
                "test": {"cyclone": [("alpha", 2)]},  # same storm, both splits
            },
        )
        entries = from_imagefolder(str(root), str(tmp_path))

        with pytest.raises(SatelliteDatasetError, match="more than one split"):
            summarise(entries)

    def test_disjoint_storms_pass(self, tmp_path):
        summarise(from_imagefolder(str(simple_tree(tmp_path)), str(tmp_path)))


class TestHursat:
    def labels(self, tmp_path, rows):
        path = tmp_path / "labels.npy"
        np.save(path, np.array(rows, dtype=object), allow_pickle=True)
        return str(path)

    def _row(self, basin="ATLN", storm="200301L", lon=-66.0, lat=31.4,
             time="2003041815", wind=55.0, pres=985.0):
        return [basin, storm, lon, lat, time, wind, 0.0, pres]

    def test_reads_the_eight_column_layout(self, tmp_path):
        entries = from_hursat(self.labels(tmp_path, [self._row()]))

        assert len(entries) == 1
        assert entries[0]["latitude"] == pytest.approx(31.4)
        assert entries[0]["longitude"] == pytest.approx(-66.0)

    def test_identity_combines_basin_and_storm(self, tmp_path):
        """A storm number repeats across basins and seasons, so the basin is
        part of the identity; merging two storms would break the split."""
        rows = [
            self._row(basin="ATLN", storm="200301L"),
            self._row(basin="EPAC", storm="200301L"),
        ]
        entries = from_hursat(self.labels(tmp_path, rows))

        assert {e["cyclone_id"] for e in entries} == {"ATLN_200301L", "EPAC_200301L"}

    def test_label_is_derived_from_wind_not_invented(self, tmp_path):
        rows = [
            self._row(wind=TROPICAL_STORM_KNOTS + 1, time="2003041815"),
            self._row(wind=TROPICAL_STORM_KNOTS - 1, time="2003041818"),
        ]
        entries = from_hursat(self.labels(tmp_path, rows))

        assert [e["is_cyclone"] for e in entries] == [True, False]

    def test_the_threshold_at_the_boundary_is_inclusive(self, tmp_path):
        entries = from_hursat(
            self.labels(tmp_path, [self._row(wind=TROPICAL_STORM_KNOTS)])
        )
        assert entries[0]["is_cyclone"] is True

    def test_the_label_definition_is_recorded(self, tmp_path):
        """So a later reader can see what "is_cyclone" was defined as rather
        than having to guess it from the data."""
        entries = from_hursat(self.labels(tmp_path, [self._row()]))
        assert "34" in entries[0]["label_definition"]

    def test_a_custom_threshold_changes_the_labels(self, tmp_path):
        entries = from_hursat(
            self.labels(tmp_path, [self._row(wind=55.0)]), wind_threshold_kt=64.0
        )
        assert entries[0]["is_cyclone"] is False

    def test_rows_with_unparseable_numbers_are_skipped(self, tmp_path):
        rows = [self._row(), self._row(lat="not-a-number", time="2003041818")]
        assert len(from_hursat(self.labels(tmp_path, rows))) == 1

    def test_rows_without_a_matching_frame_are_dropped(self, tmp_path):
        frames = tmp_path / "frames"
        frames.mkdir()
        (frames / "ATLN_200301L_2003041815.png").write_bytes(b"x")

        rows = [self._row(time="2003041815"), self._row(time="2003041818")]
        entries = from_hursat(
            self.labels(tmp_path, rows), frames_root=str(frames)
        )

        assert len(entries) == 1
        assert entries[0]["storage_path"] == "ATLN_200301L_2003041815.png"

    def test_all_frames_missing_is_an_error_not_an_empty_catalog(self, tmp_path):
        frames = tmp_path / "frames"
        frames.mkdir()

        with pytest.raises(SatelliteDatasetError, match="filename-template"):
            from_hursat(
                self.labels(tmp_path, [self._row()]), frames_root=str(frames)
            )

    def test_a_wrong_shaped_array_is_rejected(self, tmp_path):
        path = tmp_path / "bad.npy"
        np.save(path, np.zeros((5, 3)))

        with pytest.raises(SatelliteDatasetError, match="8 columns"):
            from_hursat(str(path))

    def test_a_missing_file_is_reported(self, tmp_path):
        with pytest.raises(SatelliteDatasetError, match="not found"):
            from_hursat(str(tmp_path / "absent.npy"))


class TestWriteCatalog:
    def test_writes_valid_json_that_load_catalog_accepts(self, tmp_path):
        root = simple_tree(tmp_path)
        output = tmp_path / "catalog.json"
        write_catalog(from_imagefolder(str(root), str(tmp_path)), str(output))

        assert json.loads(output.read_text(encoding="utf-8"))
        assert len(load_catalog(str(output))) == 9

    def test_creates_the_output_directory(self, tmp_path):
        output = tmp_path / "nested" / "deeper" / "catalog.json"
        write_catalog([{"image_id": "a", "cyclone_id": "A",
                        "storage_path": "a.png", "is_cyclone": True}], str(output))

        assert output.exists()

    def test_no_temporary_file_is_left_behind(self, tmp_path):
        output = tmp_path / "catalog.json"
        write_catalog(from_imagefolder(str(simple_tree(tmp_path)), str(tmp_path)),
                      str(output))

        assert not (tmp_path / "catalog.json.tmp").exists()
