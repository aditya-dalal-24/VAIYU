package com.vaiyu.dto;

import com.vaiyu.domain.IntensityScale;
import com.vaiyu.repository.CycloneRepository.CycloneListRow;

import java.time.Instant;
import java.util.UUID;

/** A cyclone as it appears in lists and search results. */
public record CycloneSummaryDto(
        UUID id,
        String externalId,
        String name,
        String basin,
        Integer seasonYear,
        String status,
        long observationCount,
        Instant firstObservedAt,
        Instant lastObservedAt,
        Double peakWindKph,
        Double minPressureHpa,
        String peakCategory,
        Integer peakCategoryRank
) {
    public static CycloneSummaryDto from(CycloneListRow row) {
        return new CycloneSummaryDto(
                row.getId(),
                row.getExternalId(),
                row.getName(),
                row.getBasin(),
                row.getSeasonYear(),
                row.getStatus(),
                row.getObservationCount(),
                row.getFirstObservedAt(),
                row.getLastObservedAt(),
                row.getPeakWindKph(),
                row.getMinPressureHpa(),
                IntensityScale.labelOf(row.getPeakWindKph()),
                IntensityScale.rankOf(row.getPeakWindKph()));
    }
}
