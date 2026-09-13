package com.vaiyu.dto;

import com.vaiyu.ai.dto.AiHealth;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * What the system can currently do, and on what data.
 *
 * <p>The interface uses this to say "the satellite model has no checkpoint, so
 * that panel is unavailable" rather than showing a decorative "AI powered"
 * badge. Every field is observed: model states come from the AI service's own
 * health endpoint, counts from the database.
 */
public record SystemStatusDto(
        Ai ai,
        Data data
) {
    /**
     * @param reachable whether the AI service answered at all
     * @param models    per-model state keyed by trajectory, intensity,
     *                  satellite, similarity
     */
    public record Ai(
            boolean reachable,
            String url,
            String version,
            String detail,
            Map<String, Model> models
    ) {
    }

    /**
     * @param state    TRAINED, UNTRAINED, CHECKPOINT_INVALID, LOAD_FAILED or UNAVAILABLE
     * @param reason   why it is not usable, when it is not
     * @param horizons forecast horizons in hours, where the model has them
     * @param sources  satellite only: sensor keys the model was trained on
     * @param evaluation track forecasters: held-out error per horizon beside the
     *                   straight-line baseline, exactly as the checkpoint
     *                   recorded it, so the interface can describe how a
     *                   forecast compares without a claim that goes stale
     */
    public record Model(
            boolean available,
            String state,
            String name,
            String version,
            List<Integer> horizons,
            String trainedAt,
            String reason,
            List<String> sources,
            Integer analogueStorms,
            List<AiHealth.HorizonEvaluation> evaluation
    ) {
    }

    public record Data(
            long cyclones,
            long observations,
            long forecastRuns,
            long satelliteAnalyses,
            Instant latestObservation,
            String observationSource,
            String windScale,
            boolean ingestSourceAvailable,
            String ingestSourcePath
    ) {
    }
}
