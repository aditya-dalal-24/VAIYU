"""Temporal-safety and leakage tests.

The two failures these guard against are the ones that would make every other
number in the project meaningless, and neither shows up as an error at
training time -- both simply produce a model that scores well and is wrong.

1. **Future data in an input.** A prediction made at time T must not see any
   observation after T.
2. **The same cyclone on both sides of a split.** Consecutive fixes are
   near-duplicates, so a storm in train and test means the model is scored on
   what it memorised.
"""

from __future__ import annotations

from datetime import timedelta

import pandas as pd
import pytest

from preprocessing.dataset import build_samples
from preprocessing.features import (
    MIN_OBSERVATIONS,
    InsufficientHistory,
    build_sequence,
    observations_up_to,
)
from preprocessing.splits import (
    assert_no_cyclone_overlap,
    split_by_cyclone,
    split_by_season,
)
from tests.conftest import BASE_TIME, make_observation


class TestFutureObservationsExcluded:
    def test_observations_after_the_cutoff_are_dropped(self):
        track = [make_observation(hours=index * 6) for index in range(6)]
        cutoff = BASE_TIME + timedelta(hours=12)

        visible = observations_up_to(track, cutoff)

        assert len(visible) == 3
        assert all(item.timestamp <= cutoff for item in visible)

    def test_the_cutoff_itself_is_included(self):
        track = [make_observation(hours=index * 6) for index in range(4)]
        cutoff = BASE_TIME + timedelta(hours=6)
        assert any(item.timestamp == cutoff for item in observations_up_to(track, cutoff))

    def test_result_is_ordered_oldest_first(self):
        track = [make_observation(hours=hours) for hours in (12, 0, 6, 18)]
        visible = observations_up_to(track, BASE_TIME + timedelta(hours=18))
        timestamps = [item.timestamp for item in visible]
        assert timestamps == sorted(timestamps)

    def test_sequence_ends_at_the_most_recent_observation(self):
        """Real steps come first and padding trails, as packing requires."""
        track = [make_observation(hours=index * 6) for index in range(4)]
        steps, mask = build_sequence(track, sequence_length=8)

        assert mask[0] == 1.0
        assert mask[-1] == 0.0  # padded, because only 4 of 8 slots are real
        assert sum(mask) == 4
        # Every real step precedes every padded one.
        assert mask == [1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0]

    def test_samples_never_contain_their_own_future(self):
        """Each sample's sequence is built only from fixes at or before its time."""
        rows = []
        for index in range(10):
            rows.append(
                {
                    "cyclone_id": "storm-a",
                    "timestamp": BASE_TIME + timedelta(hours=index * 6),
                    "latitude": 12.0 + index * 0.5,
                    "longitude": 90.0 - index * 0.4,
                    "wind_speed_kph": 80.0 + index * 5,
                    "pressure_hpa": 990.0 - index * 3,
                }
            )
        frame = pd.DataFrame(rows)

        samples = build_samples(frame, horizons=[6, 12])

        # The latitude feature of the final real step must equal the base
        # latitude recorded for that sample: the sequence ends at T, not after.
        for index in range(len(samples)):
            length = int(samples.masks[index].sum())
            last_step_latitude = samples.sequences[index, length - 1, 0]
            assert last_step_latitude == pytest.approx(
                samples.base_states[index, 0], abs=1e-4
            )
            # And nothing beyond the final real step carries data.
            assert samples.sequences[index, length:].sum() == 0.0


class TestInsufficientHistory:
    def test_too_few_observations_raises(self):
        track = [make_observation(hours=index * 6) for index in range(MIN_OBSERVATIONS - 1)]
        with pytest.raises(InsufficientHistory):
            build_sequence(track)

    def test_error_carries_the_contract_error_code(self):
        with pytest.raises(InsufficientHistory) as raised:
            build_sequence([make_observation(hours=0)])
        assert raised.value.error_code == "INSUFFICIENT_OBSERVATION_HISTORY"


class TestSplitLeakage:
    def test_a_cyclone_lands_in_exactly_one_split(self):
        ids = [f"storm-{index}" for index in range(200)]
        assignment = split_by_cyclone(ids)

        by_split = {"train": [], "validation": [], "test": []}
        for cyclone_id, split in assignment.items():
            by_split[split].append(cyclone_id)

        # Raises if any id appears twice.
        assert_no_cyclone_overlap(by_split)
        assert sum(len(v) for v in by_split.values()) == len(ids)

    def test_assignment_is_stable_as_data_grows(self):
        """A storm keeps its split when more storms are added.

        Without this, retraining on a larger archive silently moves storms
        between train and test and makes runs incomparable.
        """
        small = split_by_cyclone([f"storm-{i}" for i in range(50)])
        large = split_by_cyclone([f"storm-{i}" for i in range(500)])

        for cyclone_id, split in small.items():
            assert large[cyclone_id] == split

    def test_all_three_splits_are_populated(self):
        assignment = split_by_cyclone([f"storm-{index}" for index in range(300)])
        assert set(assignment.values()) == {"train", "validation", "test"}

    def test_overlap_detection_raises(self):
        with pytest.raises(ValueError, match="appears in both"):
            assert_no_cyclone_overlap(
                {"train": ["storm-a", "storm-b"], "test": ["storm-b"]}
            )

    def test_season_split_holds_out_the_most_recent_years(self):
        pairs = [(f"storm-{year}-{i}", year) for year in range(2010, 2020) for i in range(3)]
        assignment = split_by_season(pairs, validation_seasons=2, test_seasons=2)

        seasons = {cid: year for cid, year in pairs}
        test_years = {seasons[c] for c, s in assignment.items() if s == "test"}
        train_years = {seasons[c] for c, s in assignment.items() if s == "train"}

        # No year is both trained on and tested on.
        assert test_years.isdisjoint(train_years)
        assert max(train_years) < min(test_years)

    def test_season_split_needs_enough_seasons(self):
        pairs = [("storm-a", 2019), ("storm-b", 2020)]
        with pytest.raises(ValueError, match="not enough distinct seasons"):
            split_by_season(pairs)
