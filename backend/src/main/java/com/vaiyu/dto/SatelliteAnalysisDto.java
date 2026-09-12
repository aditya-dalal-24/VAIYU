package com.vaiyu.dto;

import com.vaiyu.entity.SatelliteAnalysis;

import java.time.Instant;
import java.util.UUID;

/**
 * What the vision model answered about one image.
 *
 * <p>Result fields are null unless the model produced them. When no satellite
 * checkpoint is loaded, {@code status} is NOT_AVAILABLE and {@code reason}
 * explains it — the interface shows that instead of a detection.
 */
public record SatelliteAnalysisDto(
        UUID id,
        UUID cycloneId,
        String imageUrl,
        String imageType,
        Instant capturedAt,
        String status,
        String reason,
        Boolean cycloneDetected,
        Double confidence,
        Double centerLatitude,
        Double centerLongitude,
        String gradcamUrl,
        String modelName,
        String modelVersion,
        String labelDefinition,
        Integer inferenceMs,
        Instant createdAt
) {
    public static SatelliteAnalysisDto from(SatelliteAnalysis a) {
        return new SatelliteAnalysisDto(
                a.getId(),
                a.getCyclone() == null ? null : a.getCyclone().getId(),
                a.getImageUrl(),
                a.getImageType(),
                a.getCapturedAt(),
                a.getStatus(),
                a.getReason(),
                a.getCycloneDetected(),
                a.getConfidence(),
                a.getCenterLatitude(),
                a.getCenterLongitude(),
                a.getGradcamUrl(),
                a.getModelName(),
                a.getModelVersion(),
                a.getLabelDefinition(),
                a.getInferenceMs(),
                a.getCreatedAt());
    }
}
