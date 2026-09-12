package com.vaiyu.dto;

import java.util.List;
import java.util.UUID;

/**
 * A storm's life reduced to comparable numbers.
 *
 * <p>Every field is measured or derived arithmetically from the stored fixes —
 * there is no model here and nothing is estimated. A field a storm's data
 * cannot support is null rather than filled in: a track with no pressure
 * reading has no minimum pressure, and a single-fix track has no translation
 * speed. {@code limitations} says which of them are absent and why, so a
 * reader never has to guess whether a blank means zero.
 *
 * @param lifetimeHours            first fix to last fix
 * @param fixCount                 how many fixes the signature was built from
 * @param genesisLatitude          latitude of the first fix
 * @param genesisLongitude         longitude of the first fix
 * @param peakWindKph              strongest reported wind
 * @param minPressureHpa           lowest reported central pressure
 * @param peakLatitude             latitude at the strongest reported wind
 * @param timeToPeakFraction       where in its life the peak fell, 0 to 1
 * @param hoursAtHurricaneForce    time reported at or above 119 kph
 * @param trackLengthKm            distance travelled along the track
 * @param netDisplacementKm        straight-line first fix to last fix
 * @param sinuosity                track length over net displacement; 1.0 is a
 *                                 straight line, higher means it wandered
 * @param meanTranslationKph       track length over lifetime
 * @param maxTranslationKph        fastest leg between consecutive fixes
 * @param polewardDegrees          latitude gained away from the equator
 * @param maxIntensification24hKph largest wind gain over any 24-hour window
 * @param maxWeakening24hKph       largest wind loss over any 24-hour window
 * @param rapidIntensification     whether it gained 30 kt (55.6 kph) in 24 hours
 * @param traits                   plain-language facts, each implied by a field
 *                                 above rather than judged
 * @param limitations              what could not be computed, and why
 */
public record StormSignatureDto(
        UUID cycloneId,
        String name,
        String externalId,
        String basin,
        Integer seasonYear,

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
}
