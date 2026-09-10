"""Build an imagery catalog from the satellite datasets this project uses.

`training/train_satellite.py` consumes a `catalog.json`, which is a flat list of
frames each carrying a storm identity, a path and a label. The datasets do not
arrive in that shape: the NASA IMPACT / GOES release arrives as `ImageFolder`
directories, and the HURSAT-style release arrives as an image archive beside a
label array. This script converts either into a catalog, and is the only place
that knows about their on-disk quirks.

Nothing here trains, and nothing is written outside the chosen output path.

    # NASA IMPACT / GOES Clean IR, ImageFolder layout
    .venv/Scripts/python training/prepare_satellite.py imagefolder \\
        --root data/processed/satellite/images \\
        --output data/processed/satellite/catalog.json

    # HURSAT-style label array beside a frame directory
    .venv/Scripts/python training/prepare_satellite.py hursat \\
        --labels "data/raw/Cyclone_Labels h5.npy" \\
        --frames data/raw/frames \\
        --output data/processed/satellite/catalog.json

Why storm identity is enforced
------------------------------
Every split in this project is by storm, never by frame. Storm-centred infrared
frames three hours apart are nearly identical, so splitting by frame puts almost
the same picture in train and test and reports an accuracy that means nothing.
That makes the storm id the single most important field here, and this script
**refuses to guess it**: if it cannot recover a storm identity from a filename it
fails and says so, rather than falling back to one-storm-per-image, which would
silently destroy the guarantee while still producing a trainable catalog.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter
from typing import Dict, Iterable, List, Optional, Sequence

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from preprocessing.satellite import SatelliteDatasetError  # noqa: E402

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}

# The NASA IMPACT release is single-band GOES Clean IR. Recording it rather than
# leaving it blank means the model's source embedding can distinguish these
# frames from INSAT-3D imagery if MOSDAC access ever arrives, instead of
# treating two differently-calibrated sensors as one source.
GOES_SATELLITE = "GOES"
GOES_BAND = "10.7 um Thermal Infrared"

HURSAT_SATELLITE = "HURSAT-B1"
HURSAT_BAND = "IRWIN Brightness Temperature"

# ImageFolder class directory names, mapped to the binary label.
POSITIVE_DIRECTORIES = {"cyclone", "cyclones", "tropical_cyclone", "positive", "1"}
NEGATIVE_DIRECTORIES = {
    "non_cyclone",
    "noncyclone",
    "not_cyclone",
    "ambient",
    "negative",
    "0",
}

SPLIT_DIRECTORIES = {
    "train": "train",
    "training": "train",
    "val": "validation",
    "valid": "validation",
    "validation": "validation",
    "test": "test",
    "testing": "test",
}

# A storm id is the leading token of the usual NASA IMPACT filename, e.g.
# "abs_000.jpg" -> "abs", or a full IBTrACS SID, or a basin-and-number code.
DEFAULT_STORM_PATTERN = r"^(?P<storm>[A-Za-z0-9]+?)[_-]\d+"

# Above this, a frame is at least a tropical storm. Below it the system is a
# depression, which the negative class in these datasets represents.
TROPICAL_STORM_KNOTS = 34.0


def _iter_images(root: str) -> Iterable[str]:
    for directory, _, filenames in os.walk(root):
        for filename in sorted(filenames):
            if os.path.splitext(filename)[1].lower() in IMAGE_EXTENSIONS:
                yield os.path.join(directory, filename)


def _storm_from_filename(filename: str, pattern: re.Pattern) -> Optional[str]:
    match = pattern.search(os.path.splitext(os.path.basename(filename))[0])
    if not match:
        return None
    try:
        storm = match.group("storm")
    except IndexError:
        storm = match.group(1)
    return storm.strip().upper() or None


def from_imagefolder(
    root: str,
    catalog_dir: str,
    storm_pattern: str = DEFAULT_STORM_PATTERN,
    satellite: str = GOES_SATELLITE,
    spectral_band: str = GOES_BAND,
) -> List[Dict[str, object]]:
    """Convert `{split}/{class}/{storm}_{frame}.jpg` trees into catalog entries.

    The directory split is preserved rather than recomputed: these releases are
    already partitioned by storm identity, and re-hashing would discard the
    dataset author's partition for no gain.

    Paths are written relative to ``catalog_dir``, because that is what
    ``load_catalog`` resolves against -- which is what keeps a catalog portable
    to the machine the training actually happens on.
    """
    if not os.path.isdir(root):
        raise SatelliteDatasetError(f"not a directory: {root}")

    pattern = re.compile(storm_pattern)
    entries: List[Dict[str, object]] = []
    unresolved: List[str] = []
    root_absolute = os.path.abspath(root)

    catalog_absolute = os.path.abspath(catalog_dir)

    for path in _iter_images(root_absolute):
        # Class and split come from the position under the image root...
        relative = os.path.relpath(path, root_absolute).replace("\\", "/")
        parts = relative.split("/")
        # ...but the stored path must resolve from the catalog's own directory.
        stored = os.path.relpath(path, catalog_absolute).replace("\\", "/")

        label: Optional[bool] = None
        split: Optional[str] = None
        for part in parts[:-1]:
            lowered = part.lower()
            if lowered in POSITIVE_DIRECTORIES:
                label = True
            elif lowered in NEGATIVE_DIRECTORIES:
                label = False
            if lowered in SPLIT_DIRECTORIES:
                split = SPLIT_DIRECTORIES[lowered]

        if label is None:
            raise SatelliteDatasetError(
                f"cannot tell the class of {relative!r}: no directory named "
                f"cyclone or non_cyclone above it. Expected "
                f"{{split}}/{{class}}/image.jpg under the root."
            )

        storm = _storm_from_filename(path, pattern)
        if storm is None:
            unresolved.append(relative)
            continue

        entries.append(
            {
                "image_id": os.path.splitext(os.path.basename(path))[0],
                "cyclone_id": storm,
                "storage_path": stored,
                "is_cyclone": label,
                "split": split,
                "satellite": satellite,
                "spectral_band": spectral_band,
                "image_type": "INFRARED",
            }
        )

    if unresolved:
        raise SatelliteDatasetError(
            f"could not recover a storm id from {len(unresolved)} filename(s), "
            f"for example {unresolved[:3]}. Every split in this project is by "
            f"storm, so a missing storm id would put near-identical frames in "
            f"both train and test. Pass --storm-pattern with a regex whose "
            f"'storm' group matches these names."
        )

    if not entries:
        raise SatelliteDatasetError(f"no images found under {root}")

    return entries


def from_hursat(
    labels_path: str,
    frames_root: Optional[str] = None,
    filename_template: str = "{basin}_{storm}_{time}.png",
    satellite: str = HURSAT_SATELLITE,
    spectral_band: str = HURSAT_BAND,
    wind_threshold_kt: float = TROPICAL_STORM_KNOTS,
) -> List[Dict[str, object]]:
    """Convert a HURSAT-style label array into catalog entries.

    The array this project carries is ``(n, 8)`` of objects:
    ``basin, storm_id, longitude, latitude, YYYYMMDDHH, wind_kt, _, pressure_hpa``.

    The label is derived from wind rather than invented: at or above
    ``wind_threshold_kt`` the system is at least a tropical storm, which is what
    the positive class means in these datasets. The threshold is recorded in the
    catalog so a later reader can see what "is_cyclone" was defined as.
    """
    import numpy as np

    if not os.path.exists(labels_path):
        raise SatelliteDatasetError(f"label array not found at {labels_path}")

    array = np.load(labels_path, allow_pickle=True)
    if array.ndim != 2 or array.shape[1] < 8:
        raise SatelliteDatasetError(
            f"expected a 2-D label array with at least 8 columns, got "
            f"shape {array.shape}"
        )

    entries: List[Dict[str, object]] = []
    missing_files = 0

    for row in array:
        basin = str(row[0]).strip().upper()
        storm = str(row[1]).strip().upper()
        timestamp = str(row[4]).strip()

        try:
            longitude = float(row[2])
            latitude = float(row[3])
            wind_kt = float(row[5])
        except (TypeError, ValueError):
            continue

        # A storm id repeats across basins and seasons, so the basin is part of
        # the identity. Getting this wrong would merge two storms into one and
        # break the split.
        cyclone_id = f"{basin}_{storm}"
        image_id = f"{cyclone_id}_{timestamp}"

        storage_path = filename_template.format(
            basin=basin, storm=storm, time=timestamp, cyclone_id=cyclone_id
        )
        if frames_root and not os.path.exists(
            os.path.join(frames_root, storage_path)
        ):
            missing_files += 1
            continue

        entries.append(
            {
                "image_id": image_id,
                "cyclone_id": cyclone_id,
                "storage_path": storage_path,
                "is_cyclone": wind_kt >= wind_threshold_kt,
                "satellite": satellite,
                "spectral_band": spectral_band,
                "image_type": "INFRARED",
                "ocean_basin": basin,
                "observed_at": timestamp,
                "latitude": latitude,
                "longitude": longitude,
                "wind_speed_kt": wind_kt,
                "label_definition": (
                    f"is_cyclone = USA_WIND >= {wind_threshold_kt:g} kt"
                ),
            }
        )

    if missing_files:
        print(
            f"  {missing_files} label rows had no matching image under "
            f"{frames_root} and were dropped"
        )

    if not entries:
        raise SatelliteDatasetError(
            "no catalog entries survived. If --frames was given, check that "
            "--filename-template matches the actual frame filenames."
        )

    return entries


def summarise(entries: Sequence[Dict[str, object]]) -> None:
    storms = {entry["cyclone_id"] for entry in entries}
    positive = sum(1 for entry in entries if entry["is_cyclone"])
    splits = Counter(str(entry.get("split") or "unassigned") for entry in entries)

    print(f"  frames:   {len(entries)}")
    print(f"  storms:   {len(storms)}")
    print(
        f"  labels:   {positive} cyclone / {len(entries) - positive} not "
        f"({positive / len(entries) * 100:.1f}% positive)"
    )
    print(f"  splits:   {dict(splits)}")

    # A storm appearing in two splits is the failure this whole script guards
    # against, so it is checked here rather than trusted.
    per_storm: Dict[str, set] = {}
    for entry in entries:
        if entry.get("split"):
            per_storm.setdefault(str(entry["cyclone_id"]), set()).add(
                str(entry["split"])
            )
    straddling = {storm for storm, names in per_storm.items() if len(names) > 1}
    if straddling:
        raise SatelliteDatasetError(
            f"{len(straddling)} storm(s) appear in more than one split, for "
            f"example {sorted(straddling)[:3]}. Frames of one storm three hours "
            f"apart are nearly identical, so this would inflate the test score. "
            f"Fix the directory layout or drop --keep-split."
        )

    if splits.get("unassigned"):
        print(
            "  no split recorded; training will hash storms into splits itself"
        )


def write_catalog(entries: Sequence[Dict[str, object]], output: str) -> None:
    directory = os.path.dirname(os.path.abspath(output))
    os.makedirs(directory, exist_ok=True)

    temporary = f"{output}.tmp"
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump(list(entries), handle, indent=1)
    os.replace(temporary, output)

    size_mb = os.path.getsize(output) / (1024 * 1024)
    print(f"\n  wrote {output} ({size_mb:.1f} MB)")
    print(
        "  train with:\n"
        f"    .venv/Scripts/python training/train_satellite.py --catalog {output}"
    )


def main(args) -> int:
    try:
        if args.layout == "imagefolder":
            entries = from_imagefolder(
                args.root,
                catalog_dir=os.path.dirname(os.path.abspath(args.output)),
                storm_pattern=args.storm_pattern,
                satellite=args.satellite or GOES_SATELLITE,
                spectral_band=args.spectral_band or GOES_BAND,
            )
        else:
            entries = from_hursat(
                args.labels,
                frames_root=args.frames,
                filename_template=args.filename_template,
                satellite=args.satellite or HURSAT_SATELLITE,
                spectral_band=args.spectral_band or HURSAT_BAND,
                wind_threshold_kt=args.wind_threshold,
            )

        if not args.keep_split:
            for entry in entries:
                entry.pop("split", None)

        summarise(entries)
        write_catalog(entries, args.output)
    except SatelliteDatasetError as error:
        print(f"  {error}")
        return 1

    return 0


def parse_args():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="layout", required=True)

    folder = subparsers.add_parser(
        "imagefolder",
        help="NASA IMPACT / GOES release: {split}/{class}/{storm}_{n}.jpg",
    )
    folder.add_argument("--root", required=True, help="directory holding the splits")
    folder.add_argument(
        "--storm-pattern",
        default=DEFAULT_STORM_PATTERN,
        help=(
            "regex with a 'storm' group, matched against each filename stem "
            f"(default: {DEFAULT_STORM_PATTERN!r})"
        ),
    )

    hursat = subparsers.add_parser(
        "hursat", help="HURSAT-style label array beside a frame directory"
    )
    hursat.add_argument("--labels", required=True, help="path to the .npy label array")
    hursat.add_argument(
        "--frames",
        help=(
            "directory of image frames. When given, label rows with no matching "
            "file are dropped and the count reported."
        ),
    )
    hursat.add_argument(
        "--filename-template",
        default="{basin}_{storm}_{time}.png",
        help="how a frame filename is built from the label row",
    )
    hursat.add_argument(
        "--wind-threshold",
        type=float,
        default=TROPICAL_STORM_KNOTS,
        help="knots at or above which a frame is labelled a cyclone",
    )

    for sub in (folder, hursat):
        sub.add_argument("--output", required=True, help="catalog.json to write")
        sub.add_argument("--satellite", help="override the recorded sensor name")
        sub.add_argument("--spectral-band", help="override the recorded band")
        sub.add_argument(
            "--keep-split",
            action="store_true",
            default=True,
            help="preserve a split recorded in the directory layout (default)",
        )
        sub.add_argument(
            "--no-keep-split",
            dest="keep_split",
            action="store_false",
            help="discard the directory split and let training hash storms",
        )

    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main(parse_args()))
