-- Sub-basin, so the North Indian Ocean can be split the way the region
-- actually talks about it: the Arabian Sea and the Bay of Bengal are one
-- IBTrACS basin (NI) but two different threats to two different coastlines.
--
-- Nullable on purpose. IBTrACS codes a sub-basin for some basins and leaves it
-- as MM ("missing") for others, so a storm without one must read as "not
-- stated" rather than being assigned the nearest plausible sea.
--
-- The value is taken from the storm's genesis fix, which is the same rule
-- already used for `basin`, so a storm that crosses from one sub-basin to
-- another is attributed to where it formed.

ALTER TABLE cyclones
    ADD COLUMN sub_basin VARCHAR(8);

COMMENT ON COLUMN cyclones.sub_basin IS
    'IBTrACS SUBBASIN at the genesis fix: AS = Arabian Sea, BB = Bay of Bengal, '
    'and the corresponding codes in other basins. Null when IBTrACS states none.';

-- The Explorer filters by basin and sub-basin together, and the archive is
-- static between ingests, so one composite index serves both.
CREATE INDEX IF NOT EXISTS idx_cyclones_basin_sub_basin
    ON cyclones (basin, sub_basin);
