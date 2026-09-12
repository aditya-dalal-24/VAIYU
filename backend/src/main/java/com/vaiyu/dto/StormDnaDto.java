package com.vaiyu.dto;

import java.util.List;
import java.util.UUID;

/**
 * One storm's signature, and the archive storms whose signatures are closest.
 *
 * <p>This is <em>not</em> the analogue ensemble. The analogue engine matches the
 * last 24 hours of a storm's track in order to forecast the next 24, and its
 * output is a second forecast. This compares whole completed lives — where a
 * storm formed, how fast it strengthened, how far and how crookedly it
 * travelled — and forecasts nothing. Two storms can be neighbours here and
 * never appear in each other's analogue list, and that is not a contradiction.
 *
 * @param signature    the storm being described
 * @param neighbours   closest signatures, nearest first
 * @param method       how distance was computed, for the interface to quote
 * @param comparedWith how many archive storms had enough data to be compared
 */
public record StormDnaDto(
        StormSignatureDto signature,
        List<Neighbour> neighbours,
        String method,
        int comparedWith
) {

    /**
     * A neighbouring storm.
     *
     * <p>{@code distance} is in standard deviations of the archive, averaged
     * over the traits both storms have: 0 would be an identical signature, and
     * around 1 means they differ by a typical storm's worth on each trait. It
     * is reported rather than converted into a percentage similarity, because
     * any such conversion would imply a scale that does not exist.
     *
     * @param traitsCompared how many traits the distance was actually computed
     *                       from: traits both storms have <em>and</em> that vary
     *                       across the archive. Fewer traits make a distance
     *                       less meaningful, so the count travels with it
     */
    public record Neighbour(
            UUID cycloneId,
            String name,
            String externalId,
            String basin,
            Integer seasonYear,
            double distance,
            int traitsCompared,
            Double peakWindKph,
            Double lifetimeHours,
            Double trackLengthKm,
            List<String> sharedTraits
    ) {
    }
}
