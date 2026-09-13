-- Sea-surface temperature per fix.
--
-- The AI contract has always accepted environmental context and the models
-- have always carried a presence flag for it, but nothing supplied any, so
-- every forecast ran on track history alone. This is the column that changes
-- that: NOAA ERSST v5 monthly mean SST, sampled at each fix's position by the
-- AI service's own preparation step, so the value a forecast is given at
-- inference is the same quantity the model was trained on.
--
-- Nullable, and that is load-bearing. ERSST has no value over land or ice, and
-- a fix whose cell has none keeps none: the models read the absence through a
-- presence flag rather than through an invented temperature. A zero here would
-- be a freezing ocean, which is why the check below rejects anything outside
-- the product's own stated validity range instead of defaulting.

ALTER TABLE cyclone_observations
    ADD COLUMN sea_surface_temperature_c DOUBLE PRECISION;

ALTER TABLE cyclone_observations
    ADD CONSTRAINT chk_obs_sst
        CHECK (sea_surface_temperature_c IS NULL
               OR (sea_surface_temperature_c >= -3 AND sea_surface_temperature_c <= 45));

COMMENT ON COLUMN cyclone_observations.sea_surface_temperature_c IS
    'Monthly mean SST at this fix position, NOAA ERSST v5 (2-degree grid). A '
    'monthly mean on a coarse grid: it describes the water mass the storm is '
    'crossing, not the water under its core, and cannot show a cold wake. '
    'Null where the product has no value, never substituted.';
