package com.vaiyu.exception;

/**
 * The AI service validated the request and refused it — most often too few
 * observations to build a model input sequence. Surfaced as HTTP 422 with the
 * service's own error code, so the client can tell a bad request from an
 * outage.
 */
public class AiRequestRejectedException extends RuntimeException {

    private final String errorCode;

    public AiRequestRejectedException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
