"""Satellite imagery loading and preprocessing (contract section 8).

Handles frames from **multiple sources**. A GOES 10.7 um clean-IR frame, an
INSAT-3D infrared frame and a visible-band image are not interchangeable: they
differ in calibration, resolution, dynamic range and in what the brightness of
a pixel physically means. Feeding them to one model as if they were the same
picture is the quiet way to build a classifier that works on the sensor it was
trained on and silently degrades on every other.

Two mechanisms address that:

* **Source conditioning.** Each frame carries a source key -- satellite and
  spectral band -- which the model embeds alongside the visual features, so it
  can learn per-sensor offsets rather than averaging them away.
* **Vocabulary tracking.** The sources seen in training are recorded in the
  checkpoint. A frame from an unseen sensor is still served, but the response
  says the model is extrapolating rather than reporting the same confidence it
  would for a familiar source.

Expected dataset format
-----------------------
A ``catalog.json`` listing every image, alongside an ``images/`` tree. Each
catalog entry uses these fields:

===================  ========  ===================================================
field                required  notes
===================  ========  ===================================================
image_id             yes       unique identifier
cyclone_id           yes       groups frames into storms; drives the split
storage_path         yes       path to the file, resolved against the catalog dir
is_cyclone           yes       label; see the threshold note below
split                no        train / validation / test; derived if absent
satellite            no        e.g. "NOAA GOES", "INSAT-3D"
spectral_band        no        e.g. "10.7 um Thermal Infrared"
image_type           no        e.g. "infrared", "visible", "water_vapor"
wind_speed_knots     no        recorded for provenance, not used as a target
ocean_basin          no        recorded so basin coverage can be reported
===================  ========  ===================================================

A note on the label
-------------------
In the NASA IMPACT reference dataset ``is_cyclone`` marks a 34-knot intensity
threshold: every frame contains *some* system, and the negatives are 15-33 kt
depressions. The model is therefore answering "is this at or above
tropical-storm strength", not "is there a storm in this picture". That
distinction is carried into the checkpoint and out to the API, because
``cycloneDetected`` in a UI would otherwise overstate it.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

# Bumped when the image pipeline changes. A checkpoint records the version it
# was trained with, and the registry refuses a mismatch rather than serving a
# model fed differently than it was fitted.
IMAGE_SPEC_VERSION = "1.0"

# ImageNet input size, so pretrained backbone weights see what they expect.
IMAGE_SIZE = 224

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# Reserved index for a source the model never saw in training.
UNKNOWN_SOURCE = "UNKNOWN"

CLASS_NAMES = ["NOT_CYCLONE", "CYCLONE"]

REQUIRED_CATALOG_FIELDS = ["image_id", "cyclone_id", "storage_path", "is_cyclone"]


class SatelliteDatasetError(Exception):
    """Raised when the imagery catalog cannot be used as-is."""


@dataclass
class SatelliteFrame:
    """One catalog entry, resolved to an absolute path."""

    image_id: str
    cyclone_id: str
    path: str
    is_cyclone: bool
    split: Optional[str] = None
    satellite: Optional[str] = None
    spectral_band: Optional[str] = None
    image_type: Optional[str] = None
    ocean_basin: Optional[str] = None

    @property
    def source_key(self) -> str:
        """Canonical source identity: which sensor, in which band.

        Two frames share a key only if they came from the same instrument
        observing the same part of the spectrum, which is the granularity at
        which calibration actually differs.
        """
        return source_key(self.satellite, self.spectral_band, self.image_type)


def source_key(
    satellite: Optional[str],
    spectral_band: Optional[str] = None,
    image_type: Optional[str] = None,
) -> str:
    """Build a normalised source key from whatever metadata is available."""
    sensor = " ".join((satellite or "UNKNOWN_SATELLITE").split()).upper()
    band = (spectral_band or image_type or "UNKNOWN_BAND").strip().upper()
    # Spectral band strings carry wavelengths and vendor wording; keep the
    # leading token so "10.7 um Thermal Infrared (GOES Clean IR)" and
    # "10.7 um Thermal IR" do not become two different sources.
    band = " ".join(band.split("(")[0].split())
    return f"{sensor}|{band}"


IMAGE_TYPE_SEPARATOR = "|"


def source_key_from_image_type(image_type: Optional[str]) -> str:
    """Source key for an inference request, from its ``imageType`` alone.

    The contract's request carries no sensor field, only a free-string
    ``imageType``. The convention that lets a caller name the sensor without a
    contract change is ``"<SENSOR>|<BAND>"`` -- for example
    ``"INSAT-3DR|TIR1 10.8 um"`` -- normalised exactly as training normalises
    catalog fields, so the same sensor and band always produce the same key.
    The exact keys a trained model knows are published by the health endpoint
    under ``models.satellite.sources``.

    A plain value such as ``"INFRARED"`` (the contract's own example) remains
    valid. It cannot identify a sensor, so it maps to a key no model was trained
    on, and inference uses the UNKNOWN source slot -- which training now teaches
    through source dropout rather than leaving at its random initial value.
    """
    if image_type and IMAGE_TYPE_SEPARATOR in image_type:
        sensor, band = image_type.split(IMAGE_TYPE_SEPARATOR, 1)
        if sensor.strip() and band.strip():
            return source_key(sensor, band)
    return source_key(None, None, image_type)


def load_catalog(catalog_path: str) -> List[SatelliteFrame]:
    """Read and validate an imagery catalog.

    ``storage_path`` entries are resolved relative to the catalog's own
    directory, so a catalog is portable between machines.
    """
    if not os.path.exists(catalog_path):
        raise SatelliteDatasetError(f"catalog not found at {catalog_path}")

    try:
        with open(catalog_path, encoding="utf-8") as handle:
            entries = json.load(handle)
    except json.JSONDecodeError as error:
        raise SatelliteDatasetError(f"catalog is not valid JSON: {error.msg}")

    if not isinstance(entries, list) or not entries:
        raise SatelliteDatasetError("catalog must be a non-empty list of entries")

    root = os.path.dirname(os.path.abspath(catalog_path))

    frames: List[SatelliteFrame] = []
    missing_files = 0

    for index, entry in enumerate(entries):
        absent = [field for field in REQUIRED_CATALOG_FIELDS if field not in entry]
        if absent:
            raise SatelliteDatasetError(
                f"catalog entry {index} is missing: {', '.join(absent)}"
            )

        path = _resolve(root, str(entry["storage_path"]))
        if path is None:
            missing_files += 1
            continue

        frames.append(
            SatelliteFrame(
                image_id=str(entry["image_id"]),
                cyclone_id=str(entry["cyclone_id"]),
                path=path,
                is_cyclone=bool(entry["is_cyclone"]),
                split=entry.get("split"),
                satellite=entry.get("satellite"),
                spectral_band=entry.get("spectral_band"),
                image_type=entry.get("image_type"),
                ocean_basin=entry.get("ocean_basin"),
            )
        )

    if not frames:
        raise SatelliteDatasetError(
            "no catalog entry resolved to a readable image file; check that "
            "storage_path values are correct relative to the catalog"
        )

    if missing_files:
        raise SatelliteDatasetError(
            f"{missing_files} of {len(entries)} catalog entries point at files "
            "that do not exist; refusing to train on a partial dataset"
        )

    return frames


def _resolve(root: str, storage_path: str) -> Optional[str]:
    """Find an image file, tolerating catalogs written with a path prefix.

    Reference catalogs often store paths like
    ``data/processed/satellite/images/train/...`` relative to a project root
    that no longer matches. Falling back to the ``images/`` suffix keeps such a
    catalog usable without editing every entry.
    """
    candidates = [os.path.join(root, storage_path), storage_path]

    marker = "images/"
    normalised = storage_path.replace("\\", "/")
    if marker in normalised:
        candidates.append(
            os.path.join(root, normalised[normalised.index(marker) :])
        )

    for candidate in candidates:
        if os.path.exists(candidate):
            return os.path.abspath(candidate)
    return None


def build_source_vocabulary(frames: Sequence[SatelliteFrame]) -> Dict[str, int]:
    """Map each source key seen in training to an embedding index.

    Index 0 is always reserved for UNKNOWN, so a frame from a sensor the model
    never saw has somewhere to go instead of crashing or being silently
    mapped onto an unrelated source.
    """
    vocabulary = {UNKNOWN_SOURCE: 0}
    for key in sorted({frame.source_key for frame in frames}):
        if key not in vocabulary:
            vocabulary[key] = len(vocabulary)
    return vocabulary


def describe_frames(frames: Sequence[SatelliteFrame]) -> Dict[str, object]:
    """Summary for logging before training, so the data is inspected not assumed."""
    positive = sum(1 for frame in frames if frame.is_cyclone)
    sources: Dict[str, int] = {}
    basins: Dict[str, int] = {}
    for frame in frames:
        sources[frame.source_key] = sources.get(frame.source_key, 0) + 1
        if frame.ocean_basin:
            basins[frame.ocean_basin] = basins.get(frame.ocean_basin, 0) + 1

    return {
        "frames": len(frames),
        "storms": len({frame.cyclone_id for frame in frames}),
        "positive": positive,
        "negative": len(frames) - positive,
        "sources": sources,
        "basins": basins,
    }


def build_transform(train: bool):
    """Preprocessing pipeline, identical at training and inference.

    Grayscale is replicated to three channels rather than replacing the
    backbone's first convolution, which would discard the pretrained filters
    that make transfer learning worth doing on a small archive.

    Augmentation is rotation and translation only. A horizontal flip mirrors
    the spiral's chirality, turning a Northern Hemisphere storm into one that
    rotates the wrong way -- a transformation that produces images no sensor
    would ever record.
    """
    from torchvision import transforms

    shared = [
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.Grayscale(num_output_channels=3),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ]

    if not train:
        return transforms.Compose(shared)

    return transforms.Compose(
        [
            transforms.RandomRotation(180),
            transforms.RandomAffine(degrees=0, translate=(0.06, 0.06)),
            *shared,
        ]
    )


def load_image(path_or_file):
    """Open an image as single-channel, whatever its stored format."""
    from PIL import Image

    return Image.open(path_or_file).convert("L")


class SatelliteFrameDataset:
    """torch Dataset over catalog frames.

    Defined as a plain class and given the Dataset interface at construction so
    importing this module does not require torch -- the forecasting analyses
    must keep working on an install without it.
    """

    def __init__(self, frames: Sequence[SatelliteFrame], vocabulary: Dict[str, int],
                 train: bool, source_dropout: float = 0.0):
        if not 0.0 <= source_dropout <= 1.0:
            raise ValueError("source_dropout must be between 0 and 1")
        self.frames = list(frames)
        self.vocabulary = dict(vocabulary)
        self.transform = build_transform(train)
        # Only ever applied while training. Evaluation must see real sources,
        # or the per-source scores would describe a model nobody serves.
        self.source_dropout = source_dropout if train else 0.0

    def __len__(self) -> int:
        return len(self.frames)

    def __getitem__(self, index: int):
        import torch

        frame = self.frames[index]
        image = self.transform(load_image(frame.path))
        source = self.vocabulary.get(frame.source_key, 0)
        # Without this, slot 0 (UNKNOWN) is never trained -- every training frame
        # has a known source -- yet it is exactly the slot inference uses when a
        # request's imageType does not name a sensor the model knows. Dropping
        # the source on a fraction of frames teaches slot 0 a sensor-agnostic
        # representation. torch's RNG is used so a seeded run is reproducible.
        if self.source_dropout and float(torch.rand(())) < self.source_dropout:
            source = 0
        label = 1.0 if frame.is_cyclone else 0.0

        return (
            image,
            torch.tensor(source, dtype=torch.long),
            torch.tensor(label, dtype=torch.float32),
        )


def torch_dataset(frames, vocabulary, train: bool, source_dropout: float = 0.0):
    """Wrap :class:`SatelliteFrameDataset` as a real ``torch.utils.data.Dataset``."""
    from torch.utils.data import Dataset

    class _Wrapped(SatelliteFrameDataset, Dataset):
        pass

    return _Wrapped(frames, vocabulary, train, source_dropout=source_dropout)
