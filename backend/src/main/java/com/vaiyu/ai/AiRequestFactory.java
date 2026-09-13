package com.vaiyu.ai;

import com.vaiyu.ai.dto.AiAnalysisRequest;
import com.vaiyu.entity.CycloneObservation;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Turns stored observations into an AI analysis request that matches how the
 * models were trained.
 *
 * <p>This class exists because the database and the model do not agree about
 * what an observation is, and reconciling that silently would produce
 * confident nonsense.
 *
 * <p><strong>Only synoptic fixes are sent.</strong> IBTrACS publishes tracks
 * resampled to three-hourly, but only the 00/06/12/18Z rows are reported
 * fixes: the 03/09/15/21Z rows are interpolated between them, which is why the
 * AI service's own training pipeline drops them. Two consequences, both
 * avoided here by filtering to synoptic hours:
 * <ul>
 *   <li>An interpolated row is computed partly from the <em>next</em> fix, so
 *       feeding one as the forecast base leaks a few hours of the future into
 *       a forecast.</li>
 *   <li>The models never saw three-hourly spacing in training, so sending it
 *       would be an out-of-distribution request.</li>
 * </ul>
 *
 * <p><strong>Wind is required, pressure is not.</strong> The models were
 * trained on fixes that all had wind, so a fix without it is dropped, and a
 * base fix without it cannot anchor a forecast at all. Pressure may be absent:
 * the trajectory model handles that and reports the measured cost, while
 * intensity declines because it forecasts pressure from the current pressure.
 */
@Component
public class AiRequestFactory {

    /** Reported synoptic hours. Everything else in IBTrACS is interpolated. */
    private static final Set<Integer> SYNOPTIC_HOURS = Set.of(0, 6, 12, 18);

    /** The AI service refuses fewer than this (422 INSUFFICIENT_OBSERVATION_HISTORY). */
    public static final int MINIMUM_OBSERVATIONS = 3;

    /**
     * How many fixes to send. The sequence encoder keeps the most recent 8, and
     * the analogue ensemble looks back 24 h from the base fix; 12 synoptic fixes
     * (66 h) covers both with margin, and sending more would only be discarded.
     */
    public static final int MAX_OBSERVATIONS = 12;

    /**
     * One request plus the exact observations behind it, so the UI can show a
     * forecast's inputs instead of asking the operator to trust it.
     *
     * @param request      what will be sent to the AI service
     * @param observations the fixes used, oldest first; the last is the base
     * @param notes        what was filtered out and why, for display
     */
    public record Plan(
            AiAnalysisRequest request,
            List<CycloneObservation> observations,
            List<String> notes
    ) {
        public CycloneObservation base() {
            return observations.get(observations.size() - 1);
        }

        public Instant baseTime() {
            return base().getObservedAt();
        }
    }

    /**
     * Thrown when stored observations cannot support a forecast. This is a
     * client-visible condition, not a bug: many archived storms have too few
     * reported fixes before a given moment.
     */
    public static class InsufficientObservationsException extends RuntimeException {
        private final int usable;

        public InsufficientObservationsException(String message, int usable) {
            super(message);
            this.usable = usable;
        }

        public int usable() {
            return usable;
        }
    }

    /**
     * Builds a request that forecasts from {@code baseTime}.
     *
     * @param observations all stored observations for the cyclone, any order
     * @param baseTime     forecast from the latest synoptic fix at or before
     *                     this moment; null means "the most recent fix". Later
     *                     fixes are excluded, which is what makes a replay from
     *                     a past time an honest forecast rather than a lookup.
     */
    public Plan build(
            UUID cycloneId,
            List<CycloneObservation> observations,
            Instant baseTime,
            List<String> analysisTypes,
            AiAnalysisRequest.SatelliteImage image
    ) {
        List<String> notes = new ArrayList<>();

        List<CycloneObservation> ordered = observations.stream()
                .filter(o -> o.getObservedAt() != null)
                .sorted(Comparator.comparing(CycloneObservation::getObservedAt))
                .toList();

        // Never let a fix after the base time reach the model.
        List<CycloneObservation> upToBase = baseTime == null
                ? ordered
                : ordered.stream().filter(o -> !o.getObservedAt().isAfter(baseTime)).toList();

        int beforeSynoptic = upToBase.size();
        List<CycloneObservation> synoptic = upToBase.stream()
                .filter(AiRequestFactory::isSynoptic)
                .filter(o -> o.getWindSpeedKph() != null)
                .toList();

        int droppedInterpolated = beforeSynoptic - synoptic.size();
        if (droppedInterpolated > 0) {
            notes.add(droppedInterpolated + " interpolated or incomplete rows excluded; "
                    + "the models were trained on reported 00/06/12/18Z fixes only");
        }

        if (synoptic.size() < MINIMUM_OBSERVATIONS) {
            throw new InsufficientObservationsException(
                    "This cyclone has only " + synoptic.size() + " reported synoptic "
                            + "observation(s) at or before the selected time. The models need "
                            + MINIMUM_OBSERVATIONS + ".",
                    synoptic.size());
        }

        List<CycloneObservation> window = synoptic.size() <= MAX_OBSERVATIONS
                ? synoptic
                : synoptic.subList(synoptic.size() - MAX_OBSERVATIONS, synoptic.size());

        CycloneObservation base = window.get(window.size() - 1);
        List<AiAnalysisRequest.Observation> history = window.subList(0, window.size() - 1)
                .stream()
                .map(AiRequestFactory::toPayload)
                .toList();

        if (base.getPressureHpa() == null) {
            notes.add("The base fix has no pressure reading: the track forecast still "
                    + "runs, and the intensity forecast cannot");
        }

        AiAnalysisRequest request = new AiAnalysisRequest(
                "cv-" + UUID.randomUUID(),
                cycloneId.toString(),
                analysisTypes,
                toPayload(base),
                history,
                /*
                 * Environmental context, when the base fix has any.
                 *
                 * Only sea-surface temperature is ever populated, because that
                 * is the only field joined to this archive: NOAA ERSST v5
                 * monthly means, sampled at each fix by the AI service's own
                 * preparation step, so a forecast is handed the same quantity
                 * the model was trained on. Humidity and wind shear stay null
                 * because nothing supplies them, and the models read that
                 * absence through a presence flag. Sending a plausible number
                 * instead would be fabricated input.
                 */
                environmentOf(base),
                image
        );

        return new Plan(request, window, notes);
    }

    private static boolean isSynoptic(CycloneObservation observation) {
        var utc = observation.getObservedAt().atZone(ZoneOffset.UTC);
        return SYNOPTIC_HOURS.contains(utc.getHour()) && utc.getMinute() == 0;
    }

    /**
     * The environmental vector for a fix, or null when it has nothing in it.
     *
     * <p>Null rather than a record of three nulls: the contract makes the whole
     * object optional, and an empty one would suggest the question was asked
     * and answered with nothing, rather than not asked.
     */
    private static AiAnalysisRequest.EnvironmentalData environmentOf(CycloneObservation base) {
        Double seaSurfaceTemperature = base.getSeaSurfaceTemperatureC();
        if (seaSurfaceTemperature == null) {
            return null;
        }
        return new AiAnalysisRequest.EnvironmentalData(seaSurfaceTemperature, null, null);
    }

    private static AiAnalysisRequest.Observation toPayload(CycloneObservation o) {
        return new AiAnalysisRequest.Observation(
                o.getObservedAt(),
                o.getLatitude(),
                o.getLongitude(),
                o.getWindSpeedKph(),
                o.getPressureHpa(),
                o.getMovementSpeedKph(),
                o.getMovementDirectionDegrees()
        );
    }
}
