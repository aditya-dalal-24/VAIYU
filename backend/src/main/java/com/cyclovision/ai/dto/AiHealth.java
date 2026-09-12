package com.cyclovision.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

/**
 * Response from {@code GET /api/v1/health} on the AI service (contract
 * section 4).
 *
 * <p>The service is {@code UP} whether or not any model is loaded; each model
 * reports its own state, which is how the backend can tell an untrained
 * deployment from a trained one without reading logs. States are
 * {@code TRAINED}, {@code UNTRAINED}, {@code CHECKPOINT_INVALID},
 * {@code LOAD_FAILED} and {@code UNAVAILABLE}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiHealth(
        String status,
        String service,
        String version,
        Map<String, ModelStatus> models
) {

    public static final String TRAINED = "TRAINED";

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ModelStatus(
            Boolean available,
            String state,
            String model,
            String version,
            List<Integer> horizons,
            String trainedAt,
            String reason,
            /* Satellite only: the SENSOR|BAND keys this model was trained on. */
            List<String> sources,
            /* Historical similarity only: how many archive storms are indexed. */
            Integer analogueStorms
    ) {
        public boolean trained() {
            return Boolean.TRUE.equals(available) && TRAINED.equals(state);
        }
    }

    public ModelStatus model(String key) {
        return models == null ? null : models.get(key);
    }

    public boolean modelTrained(String key) {
        ModelStatus status = model(key);
        return status != null && status.trained();
    }
}
