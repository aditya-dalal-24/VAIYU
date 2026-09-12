package com.vaiyu.service;

import com.vaiyu.dto.StormDnaDto;
import com.vaiyu.dto.StormSignatureDto;
import com.vaiyu.entity.Cyclone;
import com.vaiyu.entity.CycloneObservation;
import com.vaiyu.exception.ResourceNotFoundException;
import com.vaiyu.repository.CycloneObservationRepository;
import com.vaiyu.repository.CycloneRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Storm DNA: a storm's whole life as comparable numbers, and its nearest
 * neighbours in the archive.
 *
 * <p>This is deliberately not the analogue ensemble. The analogue engine in the
 * AI service matches the last 24 hours of a track to forecast the next 24; this
 * compares completed lives and forecasts nothing. Keeping them apart matters
 * because they answer different questions and would otherwise be read as one
 * disagreeing with itself.
 *
 * <p>Distance is Euclidean over standardised traits — each trait divided by its
 * own spread across the archive, so that a difference of 500 km of track length
 * and a difference of 20 kph of peak wind can be added up at all. Storms are
 * compared only on the traits they both have, and the result carries how many
 * that was, because a distance over five traits is not the same claim as a
 * distance over nine.
 */
@Service
@Transactional(readOnly = true)
public class StormDnaService {

    private static final Logger log = LoggerFactory.getLogger(StormDnaService.class);

    /**
     * Below this many shared traits a distance says more about what is missing
     * than about the storms, so the candidate is left out entirely rather than
     * ranked on thin evidence.
     */
    private static final int MINIMUM_SHARED_TRAITS = 6;

    private static final int DEFAULT_NEIGHBOURS = 6;
    private static final int MAX_NEIGHBOURS = 20;

    static final String METHOD =
            "Euclidean distance over nine traits measured from the reported fixes, each "
            + "standardised by its spread across the archive. Storms are compared only on "
            + "traits they both have. No model is involved.";

    /** The comparable traits, in the order the vectors use. */
    private enum Trait {
        LIFETIME_HOURS,
        PEAK_WIND_KPH,
        TRACK_LENGTH_KM,
        SINUOSITY,
        MEAN_TRANSLATION_KPH,
        POLEWARD_DEGREES,
        MAX_INTENSIFICATION_24H,
        GENESIS_ABS_LATITUDE,
        TIME_TO_PEAK_FRACTION;

        static final Trait[] ALL = values();
    }

    private final CycloneRepository cyclones;
    private final CycloneObservationRepository observations;

    /**
     * Signatures for the whole archive, held between requests.
     *
     * <p>Building it reads every stored fix, which is too much to repeat per
     * request and far too little to be worth a table: the archive changes only
     * when someone runs an ingest. The index records the fix count it was built
     * from and is rebuilt when that changes, so a newly ingested season is
     * never silently missing from the comparison.
     */
    private volatile Index index;

    public StormDnaService(CycloneRepository cyclones,
                           CycloneObservationRepository observations) {
        this.cyclones = cyclones;
        this.observations = observations;
    }

    /** One storm's signature, computed from its own fixes only. */
    public StormSignatureDto signatureOf(UUID cycloneId) {
        Cyclone cyclone = cyclones.findById(cycloneId)
                .orElseThrow(() -> new ResourceNotFoundException("No cyclone with id " + cycloneId));
        List<StormSignature.Fix> fixes =
                observations.findByCycloneIdOrderByObservedAtAsc(cycloneId).stream()
                        .map(StormDnaService::toFix)
                        .toList();
        return toDto(cyclone, StormSignature.of(fixes));
    }

    /** A storm's signature together with the archive storms closest to it. */
    public StormDnaDto dnaOf(UUID cycloneId, int limit) {
        StormSignatureDto signature = signatureOf(cycloneId);
        Index current = index();

        double[] subject = current.vectors.get(cycloneId);
        if (subject == null) {
            // The storm is in the archive but its own signature has too little
            // in it to compare. Saying so beats returning an arbitrary list.
            return new StormDnaDto(signature, List.of(), METHOD, 0);
        }

        int wanted = Math.min(Math.max(1, limit), MAX_NEIGHBOURS);
        List<StormDnaDto.Neighbour> ranked = new ArrayList<>();

        for (Map.Entry<UUID, double[]> entry : current.vectors.entrySet()) {
            if (entry.getKey().equals(cycloneId)) {
                continue;
            }
            Scored scored = distance(subject, entry.getValue(), current);
            if (scored == null) {
                continue;
            }
            Summary other = current.summaries.get(entry.getKey());
            if (other == null) {
                continue;
            }
            ranked.add(new StormDnaDto.Neighbour(
                    entry.getKey(), other.name, other.externalId, other.basin, other.season,
                    round(scored.distance, 3), scored.traitsCompared,
                    other.peakWindKph, other.lifetimeHours, other.trackLengthKm,
                    sharedTraits(signature.traits(), other.traits)));
        }

        ranked.sort(Comparator.comparingDouble(StormDnaDto.Neighbour::distance));
        return new StormDnaDto(
                signature,
                ranked.size() > wanted ? List.copyOf(ranked.subList(0, wanted)) : List.copyOf(ranked),
                METHOD,
                ranked.size());
    }

    // --- comparison ---------------------------------------------------------

    private record Scored(double distance, int traitsCompared) {
    }

    /**
     * Distance over the traits both storms have.
     *
     * <p>Two different things are counted, and conflating them would be a
     * mistake. <em>Shared</em> traits are those both storms actually have, and
     * the floor is set on those, because a distance computed from three
     * measurements says more about what is missing than about the storms.
     * <em>Informative</em> traits are the shared ones that also vary across the
     * archive: a trait every storm shares the same value for contributes
     * nothing and has a spread of zero, so it drops out of the metric without
     * that being a sign of thin data.
     *
     * <p>The sum of squares is divided by the number of terms before the square
     * root, so a storm compared on four traits is not flattered by having fewer
     * of them to add up than one compared on nine.
     */
    private Scored distance(double[] a, double[] b, Index current) {
        double sum = 0;
        int shared = 0;
        int informative = 0;
        for (int i = 0; i < Trait.ALL.length; i++) {
            if (Double.isNaN(a[i]) || Double.isNaN(b[i])) {
                continue;
            }
            shared++;
            double spread = current.spread[i];
            if (spread <= 0) {
                continue;
            }
            double difference = (a[i] - b[i]) / spread;
            sum += difference * difference;
            informative++;
        }
        if (shared < MINIMUM_SHARED_TRAITS || informative == 0) {
            return null;
        }
        return new Scored(Math.sqrt(sum / informative), informative);
    }

    private static List<String> sharedTraits(List<String> subject, List<String> other) {
        List<String> shared = new ArrayList<>();
        for (String trait : other) {
            if (subject.contains(trait)) {
                shared.add(trait);
            }
        }
        return List.copyOf(shared);
    }

    // --- the archive index --------------------------------------------------

    /** Per-storm identity and headline numbers, kept for the neighbour list. */
    private record Summary(String name, String externalId, String basin, Integer season,
                           Double peakWindKph, Double lifetimeHours, Double trackLengthKm,
                           List<String> traits) {
    }

    private record Index(long builtFromFixCount,
                         Map<UUID, double[]> vectors,
                         Map<UUID, Summary> summaries,
                         double[] spread) {
    }

    private Index index() {
        long fixes = observations.count();
        Index current = index;
        if (current != null && current.builtFromFixCount == fixes) {
            return current;
        }
        synchronized (this) {
            if (index != null && index.builtFromFixCount == fixes) {
                return index;
            }
            Index built = build(fixes);
            index = built;
            return built;
        }
    }

    private Index build(long fixCount) {
        long started = System.currentTimeMillis();

        Map<UUID, List<StormSignature.Fix>> byStorm = new HashMap<>();
        for (CycloneObservation observation : observations.findAllForSignatures()) {
            byStorm.computeIfAbsent(observation.getCyclone().getId(), key -> new ArrayList<>())
                    .add(toFix(observation));
        }

        Map<UUID, double[]> vectors = new HashMap<>();
        Map<UUID, Summary> summaries = new HashMap<>();

        for (Cyclone cyclone : cyclones.findAll()) {
            List<StormSignature.Fix> fixes = byStorm.get(cyclone.getId());
            if (fixes == null) {
                continue;
            }
            StormSignature.Result signature = StormSignature.of(fixes);
            double[] vector = vectorOf(signature);
            if (countPresent(vector) < MINIMUM_SHARED_TRAITS) {
                continue;
            }
            vectors.put(cyclone.getId(), vector);
            summaries.put(cyclone.getId(), new Summary(
                    cyclone.getName(), cyclone.getExternalId(), cyclone.getBasin(),
                    cyclone.getSeasonYear(), signature.peakWindKph(),
                    signature.lifetimeHours(), signature.trackLengthKm(),
                    signature.traits()));
        }

        double[] spread = spreadOf(vectors.values());
        log.info("Built storm DNA index: {} comparable storms from {} fixes in {} ms",
                vectors.size(), fixCount, System.currentTimeMillis() - started);
        return new Index(fixCount, Map.copyOf(vectors), Map.copyOf(summaries), spread);
    }

    /**
     * Standard deviation of each trait across the archive.
     *
     * <p>This is what makes the traits addable. A trait that does not vary gets
     * a spread of zero and is then skipped in every comparison, rather than
     * dividing by zero and producing an infinite distance.
     */
    private static double[] spreadOf(Iterable<double[]> vectors) {
        int traits = Trait.ALL.length;
        double[] sum = new double[traits];
        double[] sumSquares = new double[traits];
        int[] counts = new int[traits];

        for (double[] vector : vectors) {
            for (int i = 0; i < traits; i++) {
                if (Double.isNaN(vector[i])) {
                    continue;
                }
                sum[i] += vector[i];
                sumSquares[i] += vector[i] * vector[i];
                counts[i]++;
            }
        }

        double[] spread = new double[traits];
        for (int i = 0; i < traits; i++) {
            if (counts[i] < 2) {
                spread[i] = 0;
                continue;
            }
            double mean = sum[i] / counts[i];
            double variance = Math.max(0, sumSquares[i] / counts[i] - mean * mean);
            spread[i] = Math.sqrt(variance);
        }
        return spread;
    }

    /** NaN marks a trait this storm does not have; it is never a value. */
    private static double[] vectorOf(StormSignature.Result signature) {
        double[] vector = new double[Trait.ALL.length];
        vector[Trait.LIFETIME_HOURS.ordinal()] = or(signature.lifetimeHours());
        vector[Trait.PEAK_WIND_KPH.ordinal()] = or(signature.peakWindKph());
        vector[Trait.TRACK_LENGTH_KM.ordinal()] = or(signature.trackLengthKm());
        vector[Trait.SINUOSITY.ordinal()] = or(signature.sinuosity());
        vector[Trait.MEAN_TRANSLATION_KPH.ordinal()] = or(signature.meanTranslationKph());
        vector[Trait.POLEWARD_DEGREES.ordinal()] = or(signature.polewardDegrees());
        vector[Trait.MAX_INTENSIFICATION_24H.ordinal()] =
                or(signature.maxIntensification24hKph());
        vector[Trait.GENESIS_ABS_LATITUDE.ordinal()] = signature.genesisLatitude() == null
                ? Double.NaN
                : Math.abs(signature.genesisLatitude());
        vector[Trait.TIME_TO_PEAK_FRACTION.ordinal()] = or(signature.timeToPeakFraction());
        return vector;
    }

    private static double or(Double value) {
        return value == null ? Double.NaN : value;
    }

    private static int countPresent(double[] vector) {
        int present = 0;
        for (double value : vector) {
            if (!Double.isNaN(value)) {
                present++;
            }
        }
        return present;
    }

    // --- mapping ------------------------------------------------------------

    private static StormSignature.Fix toFix(CycloneObservation observation) {
        return new StormSignature.Fix(
                observation.getObservedAt(),
                observation.getLatitude(),
                observation.getLongitude(),
                observation.getWindSpeedKph(),
                observation.getPressureHpa());
    }

    private static StormSignatureDto toDto(Cyclone cyclone, StormSignature.Result s) {
        return new StormSignatureDto(
                cyclone.getId(), cyclone.getName(), cyclone.getExternalId(),
                cyclone.getBasin(), cyclone.getSeasonYear(),
                s.lifetimeHours(), s.fixCount(), s.genesisLatitude(), s.genesisLongitude(),
                s.peakWindKph(), s.minPressureHpa(), s.peakLatitude(),
                s.timeToPeakFraction(), s.hoursAtHurricaneForce(),
                s.trackLengthKm(), s.netDisplacementKm(), s.sinuosity(),
                s.meanTranslationKph(), s.maxTranslationKph(), s.polewardDegrees(),
                s.maxIntensification24hKph(), s.maxWeakening24hKph(),
                s.rapidIntensification(), s.traits(), s.limitations());
    }

    private static double round(double value, int places) {
        double factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }

    /** Default neighbour count, for callers that do not care. */
    public static int defaultNeighbours() {
        return DEFAULT_NEIGHBOURS;
    }
}
