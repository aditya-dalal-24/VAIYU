package com.vaiyu.dto;

import java.time.Instant;
import java.util.List;

/**
 * What the data can and cannot support, stated plainly.
 *
 * <p>This exists so the interface can say "3 fixes, none with pressure, so no
 * intensity forecast" instead of showing an empty panel. Judging a forecast
 * requires knowing what went into it, and every field here is counted from
 * stored observations rather than estimated.
 *
 * @param observationCount    stored fixes for this storm
 * @param withWindCount       fixes carrying a wind speed (required by the models)
 * @param withPressureCount   fixes carrying a pressure (required by intensity)
 * @param largestGapHours     biggest interval between consecutive fixes
 * @param trackDurationHours  first fix to last fix
 * @param forecastReady       whether a forecast can run at all
 * @param limitations         plain-language reasons a forecast is limited
 * @param observationSource   provenance, including the wind averaging period
 */
public record DataQualityDto(
        long observationCount,
        long withWindCount,
        long withPressureCount,
        Instant firstObservedAt,
        Instant lastObservedAt,
        Double largestGapHours,
        Double trackDurationHours,
        boolean forecastReady,
        List<String> limitations,
        String observationSource,
        String windScale
) {
}
