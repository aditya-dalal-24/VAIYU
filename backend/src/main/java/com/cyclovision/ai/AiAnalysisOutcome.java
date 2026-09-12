package com.cyclovision.ai;

import com.cyclovision.ai.dto.AiAnalysisResponse;

/**
 * The result of one call to the AI service, as something the orchestration can
 * branch on without catching exceptions for ordinary conditions.
 *
 * <p>A model being untrained, or an analysis having nothing to work with, is a
 * normal state in this system rather than an error — the contract models it as
 * {@code NOT_AVAILABLE} with a reason. Discarding that reason (as returning an
 * empty {@code Optional} would) is exactly what loses the explanation the
 * operator needs, so every variant here keeps one.
 */
public sealed interface AiAnalysisOutcome {

    /** Human-readable explanation, safe to return to a client. */
    String detail();

    /** HTTP 200: at least one requested analysis completed. */
    record Completed(AiAnalysisResponse response) implements AiAnalysisOutcome {
        @Override
        public String detail() {
            return "Analysis " + response.status();
        }
    }

    /**
     * HTTP 503: nothing requested could run, because no model is loaded. The
     * body is still the full analysis response, with a reason per block, so it
     * is kept and passed on.
     */
    record Unavailable(AiAnalysisResponse response, String detail) implements AiAnalysisOutcome {
    }

    /** HTTP 400/422: the request itself was not usable. */
    record Rejected(String errorCode, String detail) implements AiAnalysisOutcome {
    }

    /**
     * The AI service could not be reached, timed out, returned 5xx, or sent a
     * body this client could not parse. Distinct from {@link Unavailable}: the
     * models may be fine and the service is not answering.
     */
    record Unreachable(String detail) implements AiAnalysisOutcome {
    }

    default boolean completed() {
        return this instanceof Completed;
    }

    default AiAnalysisResponse responseOrNull() {
        if (this instanceof Completed completed) {
            return completed.response();
        }
        if (this instanceof Unavailable unavailable) {
            return unavailable.response();
        }
        return null;
    }
}
