package com.vaiyu.service;

import com.vaiyu.domain.Geo;
import com.vaiyu.domain.IntensityScale;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A storm's life measured from its fixes.
 *
 * <p>Everything here is arithmetic on reported positions, winds and pressures.
 * No model is involved, nothing is interpolated to fill a gap, and a quantity
 * the fixes cannot support comes out null. That is what makes the result
 * comparable across an archive spanning 1980 to now: a 1983 storm with eight
 * fixes and a 2024 storm with sixty are described by the same definitions, and
 * where the older one is silent it stays silent instead of being guessed at.
 *
 * <p>Two choices are worth knowing. Distances are great-circle, so a recurving
 * track is not foreshortened by comparing degrees at different latitudes. And
 * the 24-hour intensity changes are taken over real 24-hour windows found in
 * the data rather than over "four fixes", because fixes are not always six
 * hours apart and a gap would otherwise be read as a rate.
 */
final class StormSignature {

    /**
     * Rapid intensification: 30 kt of wind gained in 24 hours, which is
     * 55.6 kph. The threshold is the National Hurricane Center's, stated here
     * in kph because that is the unit this system stores and displays.
     */
    static final double RAPID_INTENSIFICATION_KPH_24H = 55.6;

    /** Hurricane force, from the same scale the rest of the system uses. */
    static final double HURRICANE_FORCE_KPH = IntensityScale.CATEGORY_1.lowerKph();

    /** Tolerance when looking for a fix roughly 24 hours after another. */
    private static final Duration WINDOW = Duration.ofHours(24);
    private static final Duration WINDOW_TOLERANCE = Duration.ofMinutes(90);

    /** One fix, reduced to what a signature needs. */
    record Fix(Instant observedAt, double latitude, double longitude,
               Double windKph, Double pressureHpa) {
    }

    /**
     * The computed signature.
     *
     * <p>Held as a record of boxed values rather than a primitive array so that
     * "absent" and "zero" cannot be confused, which matters for every field
     * here: a storm that never moved and a storm whose movement is unknown are
     * different storms.
     */
    record Result(
            Double lifetimeHours,
            int fixCount,
            Double genesisLatitude,
            Double genesisLongitude,
            Double peakWindKph,
            Double minPressureHpa,
            Double peakLatitude,
            Double timeToPeakFraction,
            Double hoursAtHurricaneForce,
            Double trackLengthKm,
            Double netDisplacementKm,
            Double sinuosity,
            Double meanTranslationKph,
            Double maxTranslationKph,
            Double polewardDegrees,
            Double maxIntensification24hKph,
            Double maxWeakening24hKph,
            boolean rapidIntensification,
            List<String> traits,
            List<String> limitations
    ) {
        /** The same signature with its traits filled in. */
        Result withTraits(List<String> derived) {
            return new Result(lifetimeHours, fixCount, genesisLatitude, genesisLongitude,
                    peakWindKph, minPressureHpa, peakLatitude, timeToPeakFraction,
                    hoursAtHurricaneForce, trackLengthKm, netDisplacementKm, sinuosity,
                    meanTranslationKph, maxTranslationKph, polewardDegrees,
                    maxIntensification24hKph, maxWeakening24hKph, rapidIntensification,
                    derived, limitations);
        }
    }

    private StormSignature() {
    }

    /** Computes a signature from fixes that must already be in time order. */
    static Result of(List<Fix> fixes) {
        List<String> limitations = new ArrayList<>();
        int count = fixes.size();

        if (count == 0) {
            limitations.add("This storm has no stored fixes, so it has no signature.");
            return empty(limitations);
        }

        Fix first = fixes.get(0);
        Fix last = fixes.get(count - 1);

        Double lifetimeHours = count < 2
                ? null
                : hours(Duration.between(first.observedAt(), last.observedAt()));
        if (lifetimeHours == null) {
            limitations.add("A single fix gives no lifetime, track length or speed.");
        }

        // --- Intensity -------------------------------------------------------
        Double peakWind = null;
        Double peakLatitude = null;
        Instant peakAt = null;
        Double minPressure = null;
        int windFixes = 0;

        for (Fix fix : fixes) {
            if (fix.windKph() != null) {
                windFixes++;
                if (peakWind == null || fix.windKph() > peakWind) {
                    peakWind = fix.windKph();
                    peakLatitude = fix.latitude();
                    peakAt = fix.observedAt();
                }
            }
            if (fix.pressureHpa() != null
                    && (minPressure == null || fix.pressureHpa() < minPressure)) {
                minPressure = fix.pressureHpa();
            }
        }

        if (windFixes == 0) {
            limitations.add("No fix carries a wind speed, so peak intensity and "
                    + "intensification rate are unknown.");
        }
        if (minPressure == null) {
            limitations.add("No fix carries a central pressure.");
        }

        Double timeToPeakFraction = null;
        if (peakAt != null && lifetimeHours != null && lifetimeHours > 0) {
            double elapsed = hours(Duration.between(first.observedAt(), peakAt));
            timeToPeakFraction = round(elapsed / lifetimeHours, 3);
        }

        // Time at hurricane force, credited only between consecutive fixes that
        // both report it. A gap is not filled in, so this is a floor rather
        // than an estimate.
        Double hoursAtHurricaneForce = null;
        if (windFixes >= 2) {
            double atForce = 0;
            boolean measurable = false;
            for (int i = 1; i < count; i++) {
                Fix previous = fixes.get(i - 1);
                Fix current = fixes.get(i);
                if (previous.windKph() == null || current.windKph() == null) {
                    continue;
                }
                measurable = true;
                if (previous.windKph() >= HURRICANE_FORCE_KPH
                        && current.windKph() >= HURRICANE_FORCE_KPH) {
                    atForce += hours(Duration.between(previous.observedAt(), current.observedAt()));
                }
            }
            hoursAtHurricaneForce = measurable ? round(atForce, 1) : null;
        }

        // --- Motion ----------------------------------------------------------
        Double trackLengthKm = null;
        Double maxTranslationKph = null;
        if (count >= 2) {
            double length = 0;
            double fastest = 0;
            for (int i = 1; i < count; i++) {
                Fix previous = fixes.get(i - 1);
                Fix current = fixes.get(i);
                double leg = Geo.distanceKm(previous.latitude(), previous.longitude(),
                        current.latitude(), current.longitude());
                length += leg;
                double legHours = hours(
                        Duration.between(previous.observedAt(), current.observedAt()));
                if (legHours > 0) {
                    fastest = Math.max(fastest, leg / legHours);
                }
            }
            trackLengthKm = round(length, 1);
            maxTranslationKph = round(fastest, 1);
        }

        Double netDisplacementKm = count < 2 ? null : round(Geo.distanceKm(
                first.latitude(), first.longitude(), last.latitude(), last.longitude()), 1);

        // A storm that ends where it began has a real displacement of zero and
        // a sinuosity that is not a number, so the ratio is only reported when
        // the denominator is meaningful.
        Double sinuosity = (trackLengthKm != null && netDisplacementKm != null
                && netDisplacementKm >= 1.0)
                ? round(trackLengthKm / netDisplacementKm, 2)
                : null;
        if (sinuosity == null && trackLengthKm != null) {
            limitations.add("The storm ended where it started, so how crooked its "
                    + "track was cannot be expressed as a ratio.");
        }

        Double meanTranslationKph = (trackLengthKm != null && lifetimeHours != null
                && lifetimeHours > 0)
                ? round(trackLengthKm / lifetimeHours, 1)
                : null;

        Double polewardDegrees = count < 2
                ? null
                : round(Math.abs(last.latitude()) - Math.abs(first.latitude()), 2);

        // --- Change over 24-hour windows -------------------------------------
        Double maxIntensification = null;
        Double maxWeakening = null;
        for (int i = 0; i < count; i++) {
            Fix from = fixes.get(i);
            if (from.windKph() == null) {
                continue;
            }
            Fix to = fixAfter(fixes, i);
            if (to == null || to.windKph() == null) {
                continue;
            }
            double change = to.windKph() - from.windKph();
            if (maxIntensification == null || change > maxIntensification) {
                maxIntensification = change;
            }
            if (maxWeakening == null || change < maxWeakening) {
                maxWeakening = change;
            }
        }
        if (maxIntensification == null && windFixes > 0) {
            limitations.add("No two fixes 24 hours apart both report a wind, so the "
                    + "24-hour intensity change is unknown.");
        }

        // Compared at the precision the value is reported to, so the flag can
        // never contradict the number beside it. Unrounded, a genuine 55.6 kph
        // gain computed as 115.6 - 60.0 lands at 55.59999999999999 and reads
        // as below the threshold.
        Double reportedIntensification = round(maxIntensification, 1);
        boolean rapid = reportedIntensification != null
                && reportedIntensification >= RAPID_INTENSIFICATION_KPH_24H;

        Result measured = new Result(
                round(lifetimeHours, 1), count,
                round(first.latitude(), 2), round(first.longitude(), 2),
                round(peakWind, 1), round(minPressure, 1), round(peakLatitude, 2),
                timeToPeakFraction, hoursAtHurricaneForce,
                trackLengthKm, netDisplacementKm, sinuosity,
                meanTranslationKph, maxTranslationKph, polewardDegrees,
                reportedIntensification, round(maxWeakening, 1), rapid,
                List.of(), List.copyOf(limitations));

        return measured.withTraits(traitsOf(measured));
    }

    /**
     * The first fix at least 24 hours after {@code index}, within an hour and a
     * half of exactly 24.
     *
     * <p>Counting four fixes ahead instead would silently measure a 48-hour
     * change whenever a six-hourly track has a hole in it.
     */
    private static Fix fixAfter(List<Fix> fixes, int index) {
        Instant from = fixes.get(index).observedAt();
        Instant target = from.plus(WINDOW);
        for (int i = index + 1; i < fixes.size(); i++) {
            Fix candidate = fixes.get(i);
            Duration off = Duration.between(target, candidate.observedAt()).abs();
            if (off.compareTo(WINDOW_TOLERANCE) <= 0) {
                return candidate;
            }
            if (candidate.observedAt().isAfter(target)) {
                return null;
            }
        }
        return null;
    }

    /**
     * Plain-language facts, each one a restatement of a field above.
     *
     * <p>These are phrased as descriptions, never as judgements: "gained 30 kt
     * in 24 hours" is in the data, while "dangerous" is not.
     */
    private static List<String> traitsOf(Result r) {
        List<String> traits = new ArrayList<>();

        if (r.rapidIntensification()) {
            traits.add("Rapidly intensified");
        }
        if (r.peakWindKph() != null) {
            String category = IntensityScale.labelOf(r.peakWindKph());
            if (category != null) {
                traits.add("Peaked at " + category);
            }
        }
        if (r.genesisLatitude() != null) {
            double abs = Math.abs(r.genesisLatitude());
            if (abs < 12) {
                traits.add("Formed in the deep tropics");
            } else if (abs > 25) {
                traits.add("Formed at high latitude");
            }
        }
        if (r.timeToPeakFraction() != null) {
            if (r.timeToPeakFraction() <= 0.33) {
                traits.add("Peaked early in its life");
            } else if (r.timeToPeakFraction() >= 0.67) {
                traits.add("Peaked late in its life");
            }
        }
        if (r.sinuosity() != null && r.sinuosity() >= 1.6) {
            traits.add("Wandering track");
        }
        if (r.polewardDegrees() != null && r.polewardDegrees() >= 15) {
            traits.add("Recurved far poleward");
        }
        if (r.meanTranslationKph() != null) {
            if (r.meanTranslationKph() <= 12) {
                traits.add("Slow moving");
            } else if (r.meanTranslationKph() >= 30) {
                traits.add("Fast moving");
            }
        }
        if (r.lifetimeHours() != null && r.lifetimeHours() >= 288) {
            traits.add("Long lived");
        }
        if (r.hoursAtHurricaneForce() != null && r.hoursAtHurricaneForce() >= 72) {
            traits.add("Long spell at hurricane force");
        }
        return List.copyOf(traits);
    }

    private static Result empty(List<String> limitations) {
        return new Result(null, 0, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, false,
                List.of(), List.copyOf(limitations));
    }

    private static double hours(Duration duration) {
        return duration.toMinutes() / 60.0;
    }

    private static Double round(Double value, int places) {
        if (value == null) {
            return null;
        }
        double factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }
}
