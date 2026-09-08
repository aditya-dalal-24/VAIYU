-- Enable pgcrypto extension for gen_random_uuid() if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. CYCLONES
-- ============================================================
CREATE TABLE cyclones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_source VARCHAR,
    external_id VARCHAR,
    name VARCHAR,
    basin VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    current_category VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint only enforced when both are present
CREATE UNIQUE INDEX uk_cyclones_ext_source_id 
ON cyclones (external_source, external_id) 
WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

-- ============================================================
-- 2. CYCLONE OBSERVATIONS
-- ============================================================
CREATE TABLE cyclone_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cyclone_id UUID NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    wind_speed_kph DOUBLE PRECISION,
    pressure_hpa DOUBLE PRECISION,
    movement_speed_kph DOUBLE PRECISION,
    movement_direction_degrees DOUBLE PRECISION,
    source VARCHAR NOT NULL,
    source_record_id VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_obs_cyclone FOREIGN KEY (cyclone_id) 
        REFERENCES cyclones(id) ON DELETE CASCADE,
    CONSTRAINT chk_obs_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_obs_lon CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_obs_dir CHECK (movement_direction_degrees BETWEEN 0 AND 360),
    CONSTRAINT chk_obs_wind CHECK (wind_speed_kph >= 0),
    CONSTRAINT chk_obs_press CHECK (pressure_hpa >= 0),
    CONSTRAINT chk_obs_mov_spd CHECK (movement_speed_kph >= 0),
    CONSTRAINT uk_obs_cyclone_time_source UNIQUE (cyclone_id, observed_at, source)
);

-- ============================================================
-- 3. WEATHER DATA
-- ============================================================
CREATE TABLE weather_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cyclone_id UUID,
    measured_at TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    sea_surface_temp_c DOUBLE PRECISION,
    wind_shear_kph DOUBLE PRECISION,
    humidity_percent DOUBLE PRECISION,
    source VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_weather_cyclone FOREIGN KEY (cyclone_id) 
        REFERENCES cyclones(id) ON DELETE SET NULL,
    CONSTRAINT chk_weather_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_weather_lon CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_weather_shear CHECK (wind_shear_kph >= 0),
    CONSTRAINT chk_weather_humidity CHECK (humidity_percent BETWEEN 0 AND 100)
);

-- ============================================================
-- 4. SATELLITE IMAGES
-- ============================================================
CREATE TABLE satellite_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cyclone_id UUID,
    image_url TEXT NOT NULL,
    image_type VARCHAR NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    source VARCHAR NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_sat_img_cyclone FOREIGN KEY (cyclone_id) 
        REFERENCES cyclones(id) ON DELETE SET NULL
);

-- ============================================================
-- 5. CYCLONE PREDICTIONS
-- ============================================================
CREATE TABLE cyclone_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cyclone_id UUID NOT NULL,
    prediction_type VARCHAR NOT NULL,
    model_name VARCHAR NOT NULL,
    model_version VARCHAR NOT NULL,
    base_timestamp TIMESTAMPTZ NOT NULL,
    forecast_timestamp TIMESTAMPTZ NOT NULL,
    forecast_hours INTEGER NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    predicted_wind_speed_kph DOUBLE PRECISION,
    predicted_pressure_hpa DOUBLE PRECISION,
    trend VARCHAR,
    confidence DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_pred_cyclone FOREIGN KEY (cyclone_id) 
        REFERENCES cyclones(id) ON DELETE CASCADE,
    CONSTRAINT chk_pred_hours CHECK (forecast_hours >= 0),
    CONSTRAINT chk_pred_conf CHECK (confidence BETWEEN 0 AND 1),
    CONSTRAINT chk_pred_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_pred_lon CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_pred_wind CHECK (predicted_wind_speed_kph >= 0),
    CONSTRAINT chk_pred_press CHECK (predicted_pressure_hpa >= 0),
    CONSTRAINT uk_pred_cyclone_model_time UNIQUE (
        cyclone_id, prediction_type, model_name, model_version, base_timestamp, forecast_timestamp
    )
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_cyclones_status ON cyclones(status);
CREATE INDEX idx_obs_cyclone_time ON cyclone_observations(cyclone_id, observed_at DESC);
CREATE INDEX idx_weather_time ON weather_data(measured_at DESC);
CREATE INDEX idx_sat_img_cyclone_time ON satellite_images(cyclone_id, captured_at DESC);
CREATE INDEX idx_pred_cyclone_type_base ON cyclone_predictions(cyclone_id, prediction_type, base_timestamp DESC);
