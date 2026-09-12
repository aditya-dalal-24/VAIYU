package com.cyclovision.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

/**
 * Request body for {@code POST /api/v1/analysis/cyclone} on the Python AI
 * service (AI Service Contract section 5).
 *
 * <p>Rules the AI service enforces, so the caller must respect them:
 * <ul>
 *   <li>{@code observationHistory} is ordered oldest to newest; out-of-order
 *       history is rejected with HTTP 400.</li>
 *   <li>At least three observations in total (history plus current), or the
 *       service answers 422 {@code INSUFFICIENT_OBSERVATION_HISTORY}.</li>
 *   <li>{@code currentObservation} must carry {@code windSpeedKph}. Pressure is
 *       optional: the trajectory model handles its absence and says so, while
 *       intensity needs a real pressure to forecast from.</li>
 *   <li>{@code imageType} may name the sensor as {@code "<SENSOR>|<BAND>"},
 *       e.g. {@code "INSAT-3DR|TIR1 10.8 um"}. The keys a trained model knows
 *       are published by the service's health endpoint.</li>
 * </ul>
 *
 * <p>Nulls are omitted so an absent optional field is absent rather than
 * transmitted as {@code null}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAnalysisRequest(
        String requestId,
        String cycloneId,
        List<String> analysisTypes,
        Observation currentObservation,
        List<Observation> observationHistory,
        EnvironmentalData environmentalData,
        SatelliteImage satelliteImage
) {

    public static final String TRAJECTORY = "TRAJECTORY_PREDICTION";
    public static final String INTENSITY = "INTENSITY_PREDICTION";
    public static final String SATELLITE = "SATELLITE_ANALYSIS";
    public static final String SIMILARITY = "HISTORICAL_SIMILARITY";

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Observation(
            Instant timestamp,
            Double latitude,
            Double longitude,
            Double windSpeedKph,
            Double pressureHpa,
            Double movementSpeedKph,
            Double movementDirectionDegrees
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record EnvironmentalData(
            Double seaSurfaceTemperatureC,
            Double humidityPercent,
            Double windShearKph
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SatelliteImage(
            String imageUrl,
            String imageType,
            Instant capturedAt
    ) {
    }
}
