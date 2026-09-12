package com.vaiyu.exception;

/**
 * The AI service could not be reached, timed out, or has no model able to
 * answer. Surfaced as HTTP 503 with the reason the AI service gave, because
 * "the model is not loaded" and "the service is down" need different responses
 * from an operator.
 */
public class AiServiceUnavailableException extends RuntimeException {
    public AiServiceUnavailableException(String message) {
        super(message);
    }
}
