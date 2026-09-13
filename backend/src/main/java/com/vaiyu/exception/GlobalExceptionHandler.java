package com.vaiyu.exception;

import com.vaiyu.ai.AiRequestFactory;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.ErrorResponse;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One error shape for the whole API.
 *
 * <p>Messages are written for the person reading the screen: what went wrong
 * and what it means for them. Internal detail never crosses this boundary —
 * unexpected failures are logged with their stack trace and answered with a
 * generic message, since a stack trace in an API response is both a leak and
 * useless to the caller.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> notFound(
            ResourceNotFoundException ex, HttpServletRequest request) {
        return body(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.getMessage(), request);
    }

    /** Not enough stored observations to forecast from. */
    @ExceptionHandler(AiRequestFactory.InsufficientObservationsException.class)
    public ResponseEntity<Map<String, Object>> insufficient(
            AiRequestFactory.InsufficientObservationsException ex, HttpServletRequest request) {
        ResponseEntity<Map<String, Object>> response = body(
                HttpStatus.UNPROCESSABLE_ENTITY, "INSUFFICIENT_OBSERVATION_HISTORY",
                ex.getMessage(), request);
        response.getBody().put("usableObservations", ex.usable());
        return response;
    }

    @ExceptionHandler(AiRequestRejectedException.class)
    public ResponseEntity<Map<String, Object>> rejected(
            AiRequestRejectedException ex, HttpServletRequest request) {
        return body(HttpStatus.UNPROCESSABLE_ENTITY, ex.getErrorCode(), ex.getMessage(), request);
    }

    @ExceptionHandler(AiServiceUnavailableException.class)
    public ResponseEntity<Map<String, Object>> aiUnavailable(
            AiServiceUnavailableException ex, HttpServletRequest request) {
        return body(HttpStatus.SERVICE_UNAVAILABLE, "AI_SERVICE_UNAVAILABLE",
                ex.getMessage(), request);
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> badRequest(
            Exception ex, HttpServletRequest request) {
        return body(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", ex.getMessage(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> invalid(
            MethodArgumentNotValidException ex, HttpServletRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .orElse("Request failed validation.");
        return body(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", message, request);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> conflict(
            IllegalStateException ex, HttpServletRequest request) {
        return body(HttpStatus.CONFLICT, "PRECONDITION_FAILED", ex.getMessage(), request);
    }

    /**
     * Spring's own web failures, which already know their correct status.
     *
     * <p>Without this the catch-all below would flatten every one of them to
     * 500, and a mistyped URL would answer "an unexpected error occurred" —
     * sending the caller to look for a server fault that does not exist. Each
     * of these types implements {@link ErrorResponse}, which carries the
     * status; they are listed explicitly because that is an interface rather
     * than a common exception superclass, so it cannot be handled by type.
     */
    @ExceptionHandler({
            NoResourceFoundException.class,
            NoHandlerFoundException.class,
            HttpRequestMethodNotSupportedException.class,
            HttpMediaTypeNotSupportedException.class,
            MissingServletRequestParameterException.class,
            ErrorResponseException.class,
    })
    public ResponseEntity<Map<String, Object>> springWebError(
            Exception ex, HttpServletRequest request) {
        HttpStatus status = ex instanceof ErrorResponse response
                ? HttpStatus.valueOf(response.getStatusCode().value())
                : HttpStatus.INTERNAL_SERVER_ERROR;
        String message;
        if (ex instanceof org.springframework.web.server.ResponseStatusException rse
                && rse.getReason() != null) {
            // The reason is written for the caller; getMessage() would prefix
            // it with the status and wrap it in quotes.
            message = rse.getReason();
        } else if (status == HttpStatus.NOT_FOUND) {
            message = "No endpoint " + request.getMethod() + " " + request.getRequestURI() + ".";
        } else {
            message = ex.getMessage();
        }
        return body(status, status.name(), message, request);
    }

    /** Upload larger than the configured multipart limit. */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> tooLarge(
            MaxUploadSizeExceededException ex, HttpServletRequest request) {
        return body(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE",
                "That file is larger than this service accepts.", request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> unexpected(
            Exception ex, HttpServletRequest request) {
        log.error("Unhandled failure on {} {}", request.getMethod(), request.getRequestURI(), ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                "An unexpected error occurred.", request);
    }

    private ResponseEntity<Map<String, Object>> body(
            HttpStatus status, String code, String message, HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("errorCode", code);
        body.put("message", message);
        body.put("path", request.getRequestURI());
        return new ResponseEntity<>(body, status);
    }
}
