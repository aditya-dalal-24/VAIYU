package com.cyclovision.ai;

import com.cyclovision.ai.dto.AiAnalysisRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * How the client classifies what the AI service answers.
 *
 * <p>Run against a real HTTP server from the JDK rather than a mocked
 * exchange, so the parsing, status handling and timeout behaviour under test
 * are the ones production uses.
 *
 * <p>The case worth singling out is 503. The AI service returns a full analysis
 * body with a reason per block when no model can run, and the earlier client
 * discarded it — which is precisely how an operator ends up staring at an empty
 * panel with no explanation.
 */
class AiServiceClientTest {

    private HttpServer server;

    @AfterEach
    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    private AiServiceClient clientReturning(int status, String body) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> respond(exchange, status, body));
        server.start();
        return clientFor("http://127.0.0.1:" + server.getAddress().getPort());
    }

    private AiServiceClient clientFor(String url) {
        AiServiceProperties properties = new AiServiceProperties(
                url,
                Duration.ofMillis(500),
                Duration.ofSeconds(5),
                Duration.ofSeconds(5),
                Duration.ofMillis(800));
        return new AiServiceClient(properties, new ObjectMapper().findAndRegisterModules(),
                RestClient.builder());
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream stream = exchange.getResponseBody()) {
            stream.write(bytes);
        }
    }

    private static AiAnalysisRequest request() {
        AiAnalysisRequest.Observation observation = new AiAnalysisRequest.Observation(
                Instant.parse("2023-05-12T00:00:00Z"), 12.0, 88.0, 100.0, 990.0, null, null);
        return new AiAnalysisRequest(
                "test-1", "cyclone-1", List.of(AiAnalysisRequest.TRAJECTORY),
                observation, List.of(observation, observation), null, null);
    }

    @Test
    @DisplayName("200 is parsed into a completed outcome with model output")
    void parsesCompleted() throws IOException {
        String body = """
                {
                  "requestId": "test-1",
                  "cycloneId": "cyclone-1",
                  "analysisTimestamp": "2026-09-12T06:00:00Z",
                  "status": "PARTIAL",
                  "trajectoryPrediction": {
                    "status": "COMPLETED",
                    "model": {"name": "trajectory-model-v1", "version": "1.0",
                              "inferenceTimeMs": 11, "featureSetVersion": "1.1"},
                    "confidence": 0.63,
                    "predictedPositions": [
                      {"forecastHours": 6, "timestamp": "2023-05-12T06:00:00Z",
                       "latitude": 12.6, "longitude": 88.2, "uncertaintyRadiusKm": 29.0}
                    ]
                  },
                  "intensityPrediction": {
                    "status": "NOT_AVAILABLE",
                    "reason": "The current observation must include both windSpeedKph and pressureHpa."
                  }
                }
                """;

        AiAnalysisOutcome outcome = clientReturning(200, body).analyse(request(), false);

        assertThat(outcome).isInstanceOf(AiAnalysisOutcome.Completed.class);
        var response = outcome.responseOrNull();
        assertThat(response).isNotNull();
        assertThat(response.status()).isEqualTo("PARTIAL");
        assertThat(response.trajectoryPrediction().predictedPositions()).hasSize(1);
        assertThat(response.trajectoryPrediction().predictedPositions().get(0)
                .uncertaintyRadiusKm()).isEqualTo(29.0);
        assertThat(response.trajectoryPrediction().model().featureSetVersion()).isEqualTo("1.1");
        // The block that declined keeps its reason, so the UI can explain it.
        assertThat(response.intensityPrediction().reason()).contains("pressureHpa");
    }

    @Test
    @DisplayName("503 keeps the body's per-analysis reasons instead of discarding them")
    void keepsUnavailableReason() throws IOException {
        String body = """
                {
                  "requestId": "test-1",
                  "status": "NOT_AVAILABLE",
                  "trajectoryPrediction": {
                    "status": "NOT_AVAILABLE",
                    "reason": "The model architecture is available but no trained checkpoint has been produced yet."
                  }
                }
                """;

        AiAnalysisOutcome outcome = clientReturning(503, body).analyse(request(), false);

        assertThat(outcome).isInstanceOf(AiAnalysisOutcome.Unavailable.class);
        assertThat(outcome.detail()).contains("no trained checkpoint");
        assertThat(outcome.responseOrNull()).isNotNull();
    }

    @Test
    @DisplayName("422 becomes a rejection carrying the service's error code")
    void classifiesRejection() throws IOException {
        String body = """
                {
                  "timestamp": "2026-09-12T06:00:00Z",
                  "status": "VALIDATION_ERROR",
                  "errorCode": "INSUFFICIENT_OBSERVATION_HISTORY",
                  "message": "At least 3 observations are required.",
                  "requestId": "test-1"
                }
                """;

        AiAnalysisOutcome outcome = clientReturning(422, body).analyse(request(), false);

        assertThat(outcome).isInstanceOf(AiAnalysisOutcome.Rejected.class);
        AiAnalysisOutcome.Rejected rejected = (AiAnalysisOutcome.Rejected) outcome;
        assertThat(rejected.errorCode()).isEqualTo("INSUFFICIENT_OBSERVATION_HISTORY");
        assertThat(rejected.detail()).contains("At least 3 observations");
    }

    @Test
    @DisplayName("400 is a rejection too, not a crash")
    void classifiesBadRequest() throws IOException {
        AiAnalysisOutcome outcome = clientReturning(400, """
                {"status":"VALIDATION_ERROR","errorCode":"INVALID_REQUEST",
                 "message":"observationHistory must be ordered oldest to newest"}
                """).analyse(request(), false);

        assertThat(outcome).isInstanceOf(AiAnalysisOutcome.Rejected.class);
        assertThat(outcome.detail()).contains("oldest to newest");
    }

    @Test
    @DisplayName("a 500 is unreachable rather than a silent empty result")
    void classifiesServerError() throws IOException {
        AiAnalysisOutcome outcome = clientReturning(500, """
                {"status":"FAILED","errorCode":"INTERNAL_ERROR","message":"An unexpected error occurred."}
                """).analyse(request(), false);

        assertThat(outcome).isInstanceOf(AiAnalysisOutcome.Unreachable.class);
        assertThat(outcome.detail()).contains("HTTP 500");
    }

    @Test
    @DisplayName("an unparseable body is not treated as a successful analysis")
    void rejectsGarbage() throws IOException {
        AiAnalysisOutcome outcome = clientReturning(200, "not json at all").analyse(request(), false);

        assertThat(outcome).isInstanceOf(AiAnalysisOutcome.Unreachable.class);
        assertThat(outcome.detail()).contains("could not read");
    }

    @Test
    @DisplayName("a dead service is reported as unreachable, not as an error page")
    void handlesConnectionFailure() {
        // Port 1 is not listening; the connect timeout applies.
        AiAnalysisOutcome outcome = clientFor("http://127.0.0.1:1").analyse(request(), false);

        assertThat(outcome).isInstanceOf(AiAnalysisOutcome.Unreachable.class);
        assertThat(outcome.detail()).contains("could not be reached");
    }

    @Test
    @DisplayName("health reports model states, and is empty when unreachable")
    void readsHealth() throws IOException {
        String body = """
                {
                  "status": "UP",
                  "service": "cyclovision-ai-service",
                  "version": "1.0.0",
                  "models": {
                    "trajectory": {"available": true, "state": "TRAINED",
                                   "model": "trajectory-model-v1", "version": "1.0",
                                   "horizons": [6, 12, 24]},
                    "satellite": {"available": false, "state": "UNTRAINED",
                                  "reason": "no trained checkpoint"}
                  }
                }
                """;

        var health = clientReturning(200, body).health();

        assertThat(health).isPresent();
        assertThat(health.get().modelTrained("trajectory")).isTrue();
        assertThat(health.get().modelTrained("satellite")).isFalse();
        assertThat(health.get().model("satellite").reason()).contains("no trained checkpoint");
        assertThat(health.get().model("trajectory").horizons()).containsExactly(6, 12, 24);

        assertThat(clientFor("http://127.0.0.1:1").health()).isEmpty();
    }
}
