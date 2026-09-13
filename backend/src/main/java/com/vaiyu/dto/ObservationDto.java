package com.vaiyu.dto;

import com.vaiyu.domain.IntensityScale;
import com.vaiyu.entity.CycloneObservation;

import java.time.Instant;
import java.util.UUID;

/**
 * One observed fix. Values are exactly what was measured: a null stays null so
 * the interface can show a gap instead of a plausible number.
 */
public record ObservationDto(
        UUID id,
        Instant observedAt,
        double latitude,
        double longitude,
        Double windSpeedKph,
        Double pressureHpa,
        /**
         * Monthly mean SST at this position from NOAA ERSST v5, or null where
         * the product has none. A monthly mean on a 2-degree grid: the water
         * mass the storm crossed, not the water under its core.
         */
        Double seaSurfaceTemperatureC,
        Double movementSpeedKph,
        Double movementDirectionDegrees,
        String category,
        Integer categoryRank,
        String source
) {
    public static ObservationDto from(CycloneObservation o) {
        return new ObservationDto(
                o.getId(),
                o.getObservedAt(),
                o.getLatitude(),
                o.getLongitude(),
                o.getWindSpeedKph(),
                o.getPressureHpa(),
                o.getSeaSurfaceTemperatureC(),
                o.getMovementSpeedKph(),
                o.getMovementDirectionDegrees(),
                IntensityScale.labelOf(o.getWindSpeedKph()),
                IntensityScale.rankOf(o.getWindSpeedKph()),
                o.getSource());
    }
}
