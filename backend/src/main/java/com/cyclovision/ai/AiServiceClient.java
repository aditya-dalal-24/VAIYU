package com.cyclovision.ai;

import com.cyclovision.ai.dto.AiAnalysisRequest;
import com.cyclovision.ai.dto.AiAnalysisResponse;
import com.cyclovision.ai.dto.AiErrorResponse;
import com.cyclovision.ai.dto.AiHealth;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Optional;

/**
 * The only path from Spring Boot to the Python AI service (contract
 * section 16). Controllers never call the AI service; they call services, which
 * call this.
 *
 * <p>Everything here is deliberately synchronous. An analysis is one short
 * blocking call per request, and a reactive pipeline for that would add
 * complexity without changing behaviour.
 *
 * <p><strong>Failure handling.</strong> Responses are read as text and then
 * parsed according to status, because the AI service returns two different
 * shapes: the analysis response for 200 and 503, and the section 13 error body
 * for 400 and 422. A 503 still carries a reason for every analysis block, so it
 * is parsed and kept rather than discarded — losing it is what would leave an
 * operator staring at an empty screen with no explanation.
 */
@Component
public class AiServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);

    private static final String ANALYSIS_PATH = "/api/v1/analysis/cyclone";
    private static final String HEALTH_PATH = "/api/v1/health";

    private final AiServiceProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient analysisClient;
    private final RestClient satelliteClient;
    private final RestClient healthClient;

    /**
     * @param builder the auto-configured builder, so tests can bind a mock
     *                server to it instead of reaching the network
     */
    public AiServiceClient(AiServiceProperties properties,
                           ObjectMapper objectMapper,
                           RestClient.Builder builder) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.analysisClient = client(builder, properties.readTimeout());
        this.satelliteClient = client(builder, properties.satelliteTimeout());
        this.healthClient = client(builder, properties.healthTimeout());
    }

    /**
     * One client per timeout budget. They are built from a clone of the shared
     * builder so each keeps its own request factory: satellite analysis needs a
     * long read timeout because the service downloads the image first, while a
     * health check must fail fast.
     */
    private RestClient client(RestClient.Builder builder, Duration readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) properties.connectTimeout().toMillis());
        factory.setReadTimeout((int) readTimeout.toMillis());
        return builder.clone()
                .baseUrl(properties.url())
                .requestFactory((ClientHttpRequestFactory) factory)
                .build();
    }

    /**
     * Runs the unified analysis (contract sections 5 and 6).
     *
     * @param request     the analysis request; its history must already be
     *                    ordered oldest to newest and hold at least three
     *                    observations, which {@code AiRequestFactory} ensures
     * @param withImagery true when the request carries a satellite image, which
     *                    needs the longer timeout because the service fetches
     *                    the image before running the model
     */
    public AiAnalysisOutcome analyse(AiAnalysisRequest request, boolean withImagery) {
        RestClient client = withImagery ? satelliteClient : analysisClient;
        ResponseEntity<String> entity;
        try {
            entity = client.post()
                    .uri(ANALYSIS_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    // Suppress the default throw-on-error so every status is
                    // classified in one place below.
                    .onStatus(status -> true, (req, res) -> { })
                    .toEntity(String.class);
        } catch (Exception e) {
            log.warn("AI service unreachable at {}: {}", properties.url(), e.getMessage());
            return new AiAnalysisOutcome.Unreachable(
                    "The AI service could not be reached. It may not be running.");
        }

        int status = entity.getStatusCode().value();
        String body = entity.getBody();

        return switch (status / 100) {
            case 2 -> parseAnalysis(body)
                    .<AiAnalysisOutcome>map(AiAnalysisOutcome.Completed::new)
                    .orElseGet(() -> new AiAnalysisOutcome.Unreachable(
                            "The AI service returned a response this backend could not read."));
            case 4 -> rejected(status, body);
            default -> serverSide(status, body);
        };
    }

    private AiAnalysisOutcome rejected(int status, String body) {
        AiErrorResponse error = parse(body, AiErrorResponse.class).orElse(null);
        String detail = error != null
                ? error.describe()
                : "The AI service rejected the request (HTTP " + status + ").";
        String code = error != null ? error.errorCode() : "AI_REQUEST_REJECTED";
        log.info("AI service rejected the request: {} {}", code, detail);
        return new AiAnalysisOutcome.Rejected(code, detail);
    }

    private AiAnalysisOutcome serverSide(int status, String body) {
        // 503 means no requested model could run. The body is the full analysis
        // response with a reason per block, which is worth keeping.
        if (status == 503) {
            AiAnalysisResponse response = parseAnalysis(body).orElse(null);
            String detail = firstReason(response)
                    .orElse("No AI model is currently available to run this analysis.");
            log.info("AI service reports no model available: {}", detail);
            return new AiAnalysisOutcome.Unavailable(response, detail);
        }
        log.warn("AI service returned HTTP {}", status);
        return new AiAnalysisOutcome.Unreachable(
                "The AI service failed while running the analysis (HTTP " + status + ").");
    }

    private Optional<String> firstReason(AiAnalysisResponse response) {
        if (response == null) {
            return Optional.empty();
        }
        return java.util.stream.Stream.of(
                        response.trajectoryPrediction(),
                        response.intensityPrediction(),
                        response.satelliteAnalysis(),
                        response.historicalSimilarity())
                .filter(java.util.Objects::nonNull)
                .map(AiAnalysisResponse.Block::reason)
                .filter(reason -> reason != null && !reason.isBlank())
                .findFirst();
    }

    /** Contract section 4. Empty when the service cannot be reached. */
    public Optional<AiHealth> health() {
        try {
            AiHealth health = healthClient.get()
                    .uri(HEALTH_PATH)
                    .retrieve()
                    .body(AiHealth.class);
            return Optional.ofNullable(health);
        } catch (Exception e) {
            log.debug("AI health check failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<AiAnalysisResponse> parseAnalysis(String body) {
        return parse(body, AiAnalysisResponse.class);
    }

    private <T> Optional<T> parse(String body, Class<T> type) {
        if (body == null || body.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(objectMapper.readValue(body, type));
        } catch (Exception e) {
            log.warn("Could not parse AI service response as {}: {}",
                    type.getSimpleName(), e.getMessage());
            return Optional.empty();
        }
    }

    public String baseUrl() {
        return properties.url();
    }
}
