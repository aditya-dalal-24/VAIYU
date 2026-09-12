-- Real model output, and nothing else.
--
-- Everything in this migration records the result of an actual call to the AI
-- service: which observations were used, what each model answered, and the
-- reason when a model could not answer. Tables from the earlier prototype that
-- existed to hold hardcoded values (fixed similarity scores, a fixed landfall
-- probability, a stock-photo "Grad-CAM") are dropped at the end.

-- ============================================================
-- 1. PREDICTION RUNS
--    One row per analysis request, successful or not. Keeping the
--    unsuccessful ones is deliberate: "the model declined, and here is why"
--    is information, and silently storing nothing looks identical to never
--    having asked.
-- ============================================================
CREATE TABLE prediction_runs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cyclone_id              UUID NOT NULL,

    -- The fix the forecast was made from. Together with created_at this is
    -- what makes a replay auditable: a forecast made from an earlier base
    -- time used only data available at that time.
    base_observation_at     TIMESTAMPTZ NOT NULL,
    observations_used       INTEGER NOT NULL,
    requested_analyses      VARCHAR NOT NULL,

    ai_request_id           VARCHAR,
    overall_status          VARCHAR NOT NULL,

    -- The exact fixes that fed the model, and what was filtered out and why.
    -- Persisted rather than recomputed so a stored forecast stays auditable
    -- even after the archive is re-ingested.
    input_observation_ids   TEXT,
    input_notes             TEXT,

    trajectory_status       VARCHAR,
    trajectory_reason       TEXT,
    trajectory_confidence   DOUBLE PRECISION,
    trajectory_model_name   VARCHAR,
    trajectory_model_version VARCHAR,
    trajectory_feature_set  VARCHAR,

    intensity_status        VARCHAR,
    intensity_reason        TEXT,
    intensity_confidence    DOUBLE PRECISION,
    intensity_trend         VARCHAR,
    intensity_model_name    VARCHAR,
    intensity_model_version VARCHAR,

    similarity_status       VARCHAR,
    similarity_reason       TEXT,
    similarity_confidence   DOUBLE PRECISION,
    similarity_model_name   VARCHAR,

    inference_ms            INTEGER,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_run_cyclone FOREIGN KEY (cyclone_id)
        REFERENCES cyclones(id) ON DELETE CASCADE,
    CONSTRAINT chk_run_obs_used CHECK (observations_used >= 0),
    CONSTRAINT chk_run_traj_conf CHECK (trajectory_confidence BETWEEN 0 AND 1),
    CONSTRAINT chk_run_int_conf CHECK (intensity_confidence BETWEEN 0 AND 1),
    CONSTRAINT chk_run_sim_conf CHECK (similarity_confidence BETWEEN 0 AND 1)
);

CREATE INDEX idx_runs_cyclone_created ON prediction_runs (cyclone_id, created_at DESC);
CREATE INDEX idx_runs_cyclone_base ON prediction_runs (cyclone_id, base_observation_at DESC);

-- ============================================================
-- 2. FORECAST TRACK POINTS
--    uncertainty_radius_km is the model's measured held-out mean error at that
--    horizon, or NULL when its checkpoint recorded no evaluation. It is
--    nullable on purpose: a zero would draw a cone claiming perfect accuracy.
-- ============================================================
CREATE TABLE prediction_track_points (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                UUID NOT NULL,
    forecast_hours        INTEGER NOT NULL,
    forecast_at           TIMESTAMPTZ NOT NULL,
    latitude              DOUBLE PRECISION NOT NULL,
    longitude             DOUBLE PRECISION NOT NULL,
    uncertainty_radius_km DOUBLE PRECISION,

    CONSTRAINT fk_track_run FOREIGN KEY (run_id)
        REFERENCES prediction_runs(id) ON DELETE CASCADE,
    CONSTRAINT chk_track_hours CHECK (forecast_hours > 0),
    CONSTRAINT chk_track_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_track_lon CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_track_radius CHECK (uncertainty_radius_km >= 0),
    CONSTRAINT uk_track_run_hours UNIQUE (run_id, forecast_hours)
);

-- ============================================================
-- 3. FORECAST INTENSITY POINTS
-- ============================================================
CREATE TABLE prediction_intensity_points (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id         UUID NOT NULL,
    forecast_hours INTEGER NOT NULL,
    forecast_at    TIMESTAMPTZ NOT NULL,
    wind_speed_kph DOUBLE PRECISION,
    pressure_hpa   DOUBLE PRECISION,

    CONSTRAINT fk_intensity_run FOREIGN KEY (run_id)
        REFERENCES prediction_runs(id) ON DELETE CASCADE,
    CONSTRAINT chk_intensity_hours CHECK (forecast_hours > 0),
    CONSTRAINT chk_intensity_wind CHECK (wind_speed_kph >= 0),
    CONSTRAINT chk_intensity_press CHECK (pressure_hpa > 0),
    CONSTRAINT uk_intensity_run_hours UNIQUE (run_id, forecast_hours)
);

-- ============================================================
-- 4. ANALOGUE MATCHES
--    Historical storms the analogue ensemble actually selected, by the id the
--    AI service returned (an IBTrACS SID). The application database stays the
--    authority for the historical record, per contract section 11, so this
--    stores the match and not a copy of the storm.
-- ============================================================
CREATE TABLE analogue_matches (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                UUID NOT NULL,
    rank_order            INTEGER NOT NULL,
    historical_external_id VARCHAR NOT NULL,
    historical_name       VARCHAR,
    season_year           INTEGER,
    similarity_score      DOUBLE PRECISION NOT NULL,
    similarity_basis      VARCHAR,
    -- Resolved against the cyclones table when the storm is ingested here,
    -- so the UI can link straight to its profile.
    matched_cyclone_id    UUID,

    CONSTRAINT fk_analogue_run FOREIGN KEY (run_id)
        REFERENCES prediction_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_analogue_cyclone FOREIGN KEY (matched_cyclone_id)
        REFERENCES cyclones(id) ON DELETE SET NULL,
    CONSTRAINT chk_analogue_score CHECK (similarity_score BETWEEN 0 AND 1),
    CONSTRAINT chk_analogue_rank CHECK (rank_order > 0),
    CONSTRAINT uk_analogue_run_rank UNIQUE (run_id, rank_order)
);

-- ============================================================
-- 5. ANALOGUE ENSEMBLE FORECAST
--    The second, independent forecast: where the matched storms went next,
--    applied to this storm. spread_km is the members' disagreement.
-- ============================================================
CREATE TABLE analogue_forecast_points (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id         UUID NOT NULL,
    forecast_hours INTEGER NOT NULL,
    forecast_at    TIMESTAMPTZ NOT NULL,
    latitude       DOUBLE PRECISION NOT NULL,
    longitude      DOUBLE PRECISION NOT NULL,
    wind_speed_kph DOUBLE PRECISION,
    spread_km      DOUBLE PRECISION,
    member_count   INTEGER,

    CONSTRAINT fk_analogue_fc_run FOREIGN KEY (run_id)
        REFERENCES prediction_runs(id) ON DELETE CASCADE,
    CONSTRAINT chk_analogue_fc_hours CHECK (forecast_hours > 0),
    CONSTRAINT chk_analogue_fc_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_analogue_fc_lon CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_analogue_fc_spread CHECK (spread_km >= 0),
    CONSTRAINT uk_analogue_fc_run_hours UNIQUE (run_id, forecast_hours)
);

-- ============================================================
-- 6. SATELLITE ANALYSES
--    Stores what the vision model actually answered about one image. Nullable
--    result columns with a status and reason: when no satellite checkpoint
--    exists the row records the refusal rather than a fabricated detection.
-- ============================================================
CREATE TABLE satellite_analyses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cyclone_id       UUID,
    image_url        TEXT NOT NULL,
    image_type       VARCHAR,
    captured_at      TIMESTAMPTZ,

    status           VARCHAR NOT NULL,
    reason           TEXT,
    cyclone_detected BOOLEAN,
    confidence       DOUBLE PRECISION,
    center_latitude  DOUBLE PRECISION,
    center_longitude DOUBLE PRECISION,
    gradcam_url      TEXT,
    model_name       VARCHAR,
    model_version    VARCHAR,
    label_definition TEXT,
    inference_ms     INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_sat_analysis_cyclone FOREIGN KEY (cyclone_id)
        REFERENCES cyclones(id) ON DELETE SET NULL,
    CONSTRAINT chk_sat_conf CHECK (confidence BETWEEN 0 AND 1),
    CONSTRAINT chk_sat_lat CHECK (center_latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_sat_lon CHECK (center_longitude BETWEEN -180 AND 180)
);

CREATE INDEX idx_sat_analyses_cyclone ON satellite_analyses (cyclone_id, created_at DESC);

-- ============================================================
-- 7. CYCLONE SEASON
--    IBTrACS carries the season year and it was being discarded on ingest,
--    which made "storms of 2019" impossible to ask for.
-- ============================================================
ALTER TABLE cyclones ADD COLUMN IF NOT EXISTS season_year INTEGER;
CREATE INDEX IF NOT EXISTS idx_cyclones_season ON cyclones (season_year);

-- ============================================================
-- 8. DROP THE PROTOTYPE'S FABRICATION TABLES
--    These were created by Hibernate's ddl-auto rather than by a migration,
--    and every one of them stored invented values: fixed similarity scores,
--    a fixed 0.78 landfall probability, a hardcoded 0.92 vision confidence.
--    Their replacements above hold real model output. IF EXISTS because a
--    clean database never had them.
-- ============================================================
DROP TABLE IF EXISTS predicted_track_point CASCADE;
DROP TABLE IF EXISTS predicted_track_points CASCADE;
DROP TABLE IF EXISTS prediction CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS ai_analysis_result CASCADE;
DROP TABLE IF EXISTS ai_analysis_results CASCADE;
DROP TABLE IF EXISTS risk_assessment CASCADE;
DROP TABLE IF EXISTS risk_assessments CASCADE;
DROP TABLE IF EXISTS similarity_result CASCADE;
DROP TABLE IF EXISTS similarity_results CASCADE;
DROP TABLE IF EXISTS historical_cyclone CASCADE;
DROP TABLE IF EXISTS historical_cyclones CASCADE;
DROP TABLE IF EXISTS alert CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
