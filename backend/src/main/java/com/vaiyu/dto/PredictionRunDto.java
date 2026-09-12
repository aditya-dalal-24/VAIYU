package com.vaiyu.dto;

import com.vaiyu.domain.IntensityScale;
import com.vaiyu.entity.PredictionRun;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * One model run as the API returns it.
 *
 * <p>Each forecast block carries its own status and reason, so a client can
 * render "the intensity model declined because this fix has no pressure"
 * instead of an empty chart. Nulls are meaningful throughout: an absent
 * confidence means the checkpoint recorded no evaluation, and an absent
 * uncertainty radius means the map must draw no cone.
 */
public record PredictionRunDto(
        UUID id,
        UUID cycloneId,
        String cycloneName,
        String cycloneExternalId,
        Instant baseObservationAt,
        Instant createdAt,
        String overallStatus,
        int observationsUsed,
        List<String> inputNotes,
        List<UUID> inputObservationIds,
        Integer inferenceMs,
        TrackForecast trajectory,
        IntensityForecast intensity,
        AnalogueForecast analogues
) {

    public record ModelRef(String name, String version, String featureSetVersion) {
    }

    public record TrackPoint(
            int forecastHours,
            Instant forecastAt,
            double latitude,
            double longitude,
            Double uncertaintyRadiusKm
    ) {
    }

    public record TrackForecast(
            String status,
            String reason,
            Double confidence,
            ModelRef model,
            List<TrackPoint> points
    ) {
        public boolean completed() {
            return "COMPLETED".equals(status);
        }
    }

    public record IntensityPoint(
            int forecastHours,
            Instant forecastAt,
            Double windSpeedKph,
            Double pressureHpa,
            String category
    ) {
    }

    public record IntensityForecast(
            String status,
            String reason,
            Double confidence,
            String trend,
            ModelRef model,
            List<IntensityPoint> points
    ) {
    }

    public record AnalogueMatch(
            int rank,
            String externalId,
            String name,
            Integer seasonYear,
            double similarityScore,
            List<String> basis,
            /* Set when that storm is also in this database, so the UI can link to it. */
            UUID cycloneId
    ) {
    }

    public record AnaloguePoint(
            int forecastHours,
            Instant forecastAt,
            double latitude,
            double longitude,
            Double windSpeedKph,
            Double spreadKm,
            Integer memberCount
    ) {
    }

    public record AnalogueForecast(
            String status,
            String reason,
            Double confidence,
            ModelRef model,
            List<AnalogueMatch> matches,
            List<AnaloguePoint> points
    ) {
    }

    public static PredictionRunDto from(PredictionRun run) {
        return new PredictionRunDto(
                run.getId(),
                run.getCyclone().getId(),
                run.getCyclone().getName(),
                run.getCyclone().getExternalId(),
                run.getBaseObservationAt(),
                run.getCreatedAt(),
                run.getOverallStatus(),
                run.getObservationsUsed() == null ? 0 : run.getObservationsUsed(),
                splitLines(run.getInputNotes()),
                splitIds(run.getInputObservationIds()),
                run.getInferenceMs(),
                new TrackForecast(
                        run.getTrajectoryStatus(),
                        run.getTrajectoryReason(),
                        run.getTrajectoryConfidence(),
                        new ModelRef(run.getTrajectoryModelName(),
                                run.getTrajectoryModelVersion(),
                                run.getTrajectoryFeatureSet()),
                        run.getTrackPoints().stream()
                                .sorted(java.util.Comparator.comparing(
                                        com.vaiyu.entity.PredictionTrackPoint::getForecastHours))
                                .map(p -> new TrackPoint(
                                        p.getForecastHours(), p.getForecastAt(),
                                        p.getLatitude(), p.getLongitude(),
                                        p.getUncertaintyRadiusKm()))
                                .toList()),
                new IntensityForecast(
                        run.getIntensityStatus(),
                        run.getIntensityReason(),
                        run.getIntensityConfidence(),
                        run.getIntensityTrend(),
                        new ModelRef(run.getIntensityModelName(),
                                run.getIntensityModelVersion(), null),
                        run.getIntensityPoints().stream()
                                .sorted(java.util.Comparator.comparing(
                                        com.vaiyu.entity.PredictionIntensityPoint::getForecastHours))
                                .map(p -> new IntensityPoint(
                                        p.getForecastHours(), p.getForecastAt(),
                                        p.getWindSpeedKph(), p.getPressureHpa(),
                                        IntensityScale.labelOf(p.getWindSpeedKph())))
                                .toList()),
                new AnalogueForecast(
                        run.getSimilarityStatus(),
                        run.getSimilarityReason(),
                        run.getSimilarityConfidence(),
                        new ModelRef(run.getSimilarityModelName(), null, null),
                        run.getAnalogueMatches().stream()
                                .sorted(java.util.Comparator.comparing(
                                        com.vaiyu.entity.AnalogueMatch::getRankOrder))
                                .map(m -> new AnalogueMatch(
                                        m.getRankOrder(), m.getHistoricalExternalId(),
                                        m.getHistoricalName(), m.getSeasonYear(),
                                        m.getSimilarityScore(),
                                        splitCsv(m.getSimilarityBasis()),
                                        m.getMatchedCycloneId()))
                                .toList(),
                        run.getAnalogueForecast().stream()
                                .sorted(java.util.Comparator.comparing(
                                        com.vaiyu.entity.AnalogueForecastPoint::getForecastHours))
                                .map(p -> new AnaloguePoint(
                                        p.getForecastHours(), p.getForecastAt(),
                                        p.getLatitude(), p.getLongitude(),
                                        p.getWindSpeedKph(), p.getSpreadKm(),
                                        p.getMemberCount()))
                                .toList()));
    }

    private static List<String> splitLines(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split("\n")).map(String::trim)
                .filter(s -> !s.isEmpty()).toList();
    }

    private static List<String> splitCsv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(",")).map(String::trim)
                .filter(s -> !s.isEmpty()).toList();
    }

    private static List<UUID> splitIds(String value) {
        return splitCsv(value).stream().map(s -> {
            try {
                return UUID.fromString(s);
            } catch (IllegalArgumentException e) {
                return null;
            }
        }).filter(java.util.Objects::nonNull).toList();
    }
}
