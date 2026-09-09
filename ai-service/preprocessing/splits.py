"""Leakage-safe dataset splitting.

Two kinds of leakage would make an evaluation meaningless here, and each needs
a different defence.

**Cyclone leakage.** Consecutive fixes of one storm are near-duplicates: three
hours apart, a cyclone has barely moved and barely changed intensity. Splitting
individual observations at random puts almost-identical rows on both sides, and
the model is scored on storms it effectively memorised. Whole cyclones
therefore move together, which is what :func:`split_by_cyclone` enforces.

**Temporal leakage.** A sample built at time T must not contain any observation
after T. That is handled at sequence-construction time in
``preprocessing.features``; splitting alone cannot prevent it.

:func:`split_by_season` is offered for the stricter evaluation: train on earlier
seasons and test on later ones, which mirrors how the model will actually be
used and additionally rules out any shared-era effects.
"""

from __future__ import annotations

import hashlib
from typing import Dict, Iterable, List, Sequence, Tuple

DEFAULT_TRAIN_FRACTION = 0.70
DEFAULT_VALIDATION_FRACTION = 0.15


def _stable_fraction(key: str, salt: str) -> float:
    """Deterministic value in [0, 1) derived from an identifier.

    Hashing rather than shuffling means a cyclone lands in the same split
    regardless of how many other cyclones are present, so adding data later
    does not silently move storms between train and test.
    """
    digest = hashlib.sha256(f"{salt}:{key}".encode("utf-8")).hexdigest()
    return int(digest[:16], 16) / float(1 << 64)


def split_by_cyclone(
    cyclone_ids: Iterable[str],
    train_fraction: float = DEFAULT_TRAIN_FRACTION,
    validation_fraction: float = DEFAULT_VALIDATION_FRACTION,
    salt: str = "cyclovision",
) -> Dict[str, str]:
    """Assign each cyclone id to ``train``, ``validation`` or ``test``.

    Every observation of a cyclone inherits its storm's split, so no storm can
    appear on two sides.
    """
    if not 0 < train_fraction < 1:
        raise ValueError("train_fraction must be between 0 and 1")
    if not 0 <= validation_fraction < 1:
        raise ValueError("validation_fraction must be between 0 and 1")
    if train_fraction + validation_fraction >= 1:
        raise ValueError("train and validation fractions must leave room for a test set")

    assignment: Dict[str, str] = {}
    for cyclone_id in dict.fromkeys(cyclone_ids):  # de-duplicate, keep order
        position = _stable_fraction(str(cyclone_id), salt)
        if position < train_fraction:
            assignment[str(cyclone_id)] = "train"
        elif position < train_fraction + validation_fraction:
            assignment[str(cyclone_id)] = "validation"
        else:
            assignment[str(cyclone_id)] = "test"
    return assignment


def split_by_season(
    cyclone_seasons: Sequence[Tuple[str, int]],
    validation_seasons: int = 2,
    test_seasons: int = 2,
) -> Dict[str, str]:
    """Chronological split: the most recent seasons become validation and test.

    Stricter than :func:`split_by_cyclone` and closer to real use, because the
    model is asked about storms from years it never saw. Prefer this when the
    dataset spans enough seasons to give each split a usable number of storms.
    """
    seasons = sorted({season for _, season in cyclone_seasons})
    if len(seasons) < validation_seasons + test_seasons + 1:
        raise ValueError(
            "not enough distinct seasons for a chronological split; "
            "use split_by_cyclone instead"
        )

    test_years = set(seasons[-test_seasons:])
    validation_years = set(seasons[-(test_seasons + validation_seasons) : -test_seasons])

    assignment: Dict[str, str] = {}
    for cyclone_id, season in cyclone_seasons:
        if season in test_years:
            assignment[str(cyclone_id)] = "test"
        elif season in validation_years:
            assignment[str(cyclone_id)] = "validation"
        else:
            assignment[str(cyclone_id)] = "train"
    return assignment


def summarise_split(assignment: Dict[str, str]) -> Dict[str, int]:
    """Count cyclones per split, for logging before a training run starts."""
    counts: Dict[str, int] = {"train": 0, "validation": 0, "test": 0}
    for split in assignment.values():
        counts[split] = counts.get(split, 0) + 1
    return counts


def assert_no_cyclone_overlap(splits: Dict[str, Sequence[str]]) -> None:
    """Raise if any cyclone id appears in more than one split.

    Called by the training pipelines before fitting, so a bad split fails
    loudly at the start rather than producing an inflated score at the end.
    """
    seen: Dict[str, str] = {}
    for split_name, ids in splits.items():
        for cyclone_id in ids:
            previous = seen.get(str(cyclone_id))
            if previous is not None and previous != split_name:
                raise ValueError(
                    f"cyclone {cyclone_id} appears in both '{previous}' and "
                    f"'{split_name}'; splits must be disjoint by cyclone"
                )
            seen[str(cyclone_id)] = split_name
