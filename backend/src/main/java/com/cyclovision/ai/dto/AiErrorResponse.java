package com.cyclovision.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;

/**
 * Error body from the AI service (contract section 13).
 *
 * <p>Returned with 400 (invalid request) and 422 (valid JSON the models cannot
 * work with, such as too few observations). The contract guarantees it never
 * contains stack traces, secrets or internal paths, so {@code message} is safe
 * to surface to an operator.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiErrorResponse(
        Instant timestamp,
        String status,
        String errorCode,
        String message,
        String requestId
) {

    /** Too few observations to build a model input sequence. */
    public static final String INSUFFICIENT_HISTORY = "INSUFFICIENT_OBSERVATION_HISTORY";

    public String describe() {
        if (message != null && !message.isBlank()) {
            return message;
        }
        return errorCode != null ? errorCode : "The AI service rejected the request.";
    }
}
