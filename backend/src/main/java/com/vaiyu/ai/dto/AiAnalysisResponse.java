package com.vaiyu.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.List;

/**
 * Response body from {@code POST /api/v1/analysis/cyclone} (contract section 6).
 *
 * <p>Every analysis block carries its own {@code status}, so one analysis being
 * unavailable never invalidates the others. {@code reason} explains an
 * incomplete block, and is also set on a completed trajectory when the forecast
 * was made without a pressure reading.
 *
 * <p>Unknown properties are ignored, which is the backward-compatible growth
 * path the contract describes in section 18: the AI service may add optional
 * fields without breaking this client.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiAnalysisResponse(
        String requestId,
        String cycloneId,
        Instant analysisTimestamp,
        String status,
        SatelliteAnalysis satelliteAnalysis,
        TrajectoryPrediction trajectoryPrediction,
        IntensityPrediction intensityPrediction,
        HistoricalSimilarity historicalSimilarity,
        List<Explanation> explanations
) {

    /** Contract section 7. */
    public static final String COMPLETED = "COMPLETED";
    public static final String PARTIAL = "PARTIAL";
    public static final String NOT_AVAILABLE = "NOT_AVAILABLE";
    public static final String FAILED = "FAILED";
    public static final String VALIDATION_ERROR = "VALIDATION_ERROR";

    /** True when at least one requested analysis produced output. */
    public boolean hasUsableResult() {
        return COMPLETED.equals(status) || PARTIAL.equals(status);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ModelInfo(
            String name,
            String version,
            Integer inferenceTimeMs,
            String trainingDatasetVersion,
            String featureSetVersion
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Coordinate(Double latitude, Double longitude) {
    }

    /** Head shared by every analysis block. */
    public interface Block {
        String status();

        String reason();

        ModelInfo model();

        default boolean completed() {
            return COMPLETED.equals(status());
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PredictedPosition(
            Integer forecastHours,
            Instant timestamp,
            Double latitude,
            Double longitude,
            /*
             * The model's measured held-out mean error at this horizon, in km.
             * Absent when the checkpoint recorded no evaluation - it is a
             * measurement, never a placeholder, so the map must draw no cone
             * when it is missing.
             */
            Double uncertaintyRadiusKm
    ) {
    }

    /** Contract section 9. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TrajectoryPrediction(
            String status,
            String reason,
            ModelInfo model,
            Double confidence,
            List<PredictedPosition> predictedPositions
    ) implements Block {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record IntensityForecastPoint(
            Integer forecastHours,
            Double windSpeedKph,
            Double pressureHpa
    ) {
    }

    /** Contract section 10. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record IntensityPrediction(
            String status,
            String reason,
            ModelInfo model,
            String trend,
            Double confidence,
            List<IntensityForecastPoint> forecast
    ) implements Block {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SatelliteFeatures(
            Boolean eyeDetected,
            Boolean spiralStructureDetected,
            Double cloudDensity
    ) {
    }

    /** Contract section 8. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SatelliteAnalysis(
            String status,
            String reason,
            ModelInfo model,
            Boolean cycloneDetected,
            Double confidence,
            Coordinate cycloneCenter,
            SatelliteFeatures features,
            String gradcamImageUrl
    ) implements Block {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SimilarCyclone(
            String historicalCycloneId,
            Double similarityScore,
            Integer rank,
            List<String> similarityBasis,
            String historicalCycloneName,
            Integer season
    ) {
    }

    /**
     * One horizon of the analogue ensemble's own forecast: an optional additive
     * field (section 18) that the AI service returns alongside the contract's
     * similar-storm list. {@code spreadKm} is the members' mean distance from
     * the ensemble mean, so a wide spread means the analogues disagree.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AnalogueForecastPoint(
            Integer forecastHours,
            Instant timestamp,
            Double latitude,
            Double longitude,
            Double windSpeedKph,
            Double spreadKm,
            Integer memberCount
    ) {
    }

    /** Contract section 11. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HistoricalSimilarity(
            String status,
            String reason,
            ModelInfo model,
            List<SimilarCyclone> similarCyclones,
            Double confidence,
            List<AnalogueForecastPoint> analogueForecast
    ) implements Block {
    }

    /** Contract section 12. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Explanation(
            String analysisType,
            String factor,
            String direction,
            Double importance
    ) {
    }
}
