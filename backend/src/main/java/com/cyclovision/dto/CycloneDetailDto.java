package com.cyclovision.dto;

import java.time.Instant;
import java.util.UUID;

/** Everything about one storm except its full track and its forecasts. */
public record CycloneDetailDto(
        UUID id,
        String externalId,
        String name,
        String basin,
        String basinName,
        Integer seasonYear,
        String status,
        Instant firstObservedAt,
        Instant lastObservedAt,
        Double peakWindKph,
        Double minPressureHpa,
        String peakCategory,
        Integer peakCategoryRank,
        ObservationDto latestObservation,
        ObservationDto peakObservation,
        DataQualityDto dataQuality
) {
}
