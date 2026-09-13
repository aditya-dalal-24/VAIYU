package com.vaiyu.dto;

import java.util.UUID;

/**
 * One season's activity in one sea.
 *
 * <p>Built for the question people on the Indian coasts actually ask: is the
 * Arabian Sea getting busier, and how does a season compare with the ones
 * before it? Every number is counted from stored fixes.
 *
 * @param season           IBTrACS season year
 * @param subBasin         sub-basin code, or null for storms IBTrACS leaves
 *                         unassigned
 * @param subBasinName     expanded for display, e.g. "Arabian Sea"
 * @param storms           storms that reached at least tropical-storm force
 * @param ace              Accumulated Cyclone Energy in 10^4 kt^2: the sum of
 *                         the squared 1-minute wind over the season's 6-hourly
 *                         fixes at or above 34 kt. It rewards storms that were
 *                         both strong and long-lived, which is why a season of
 *                         one severe cyclone can outscore a season of four
 *                         weak ones
 * @param peakWindKph      strongest single reported wind in the season
 * @param strongestStorm   the storm that reached it, for a reader to open
 * @param strongestStormId its id, or null if it has no name to show
 */
public record SeasonActivityDto(
        int season,
        String subBasin,
        String subBasinName,
        long storms,
        double ace,
        Double peakWindKph,
        String strongestStorm,
        UUID strongestStormId
) {
}
