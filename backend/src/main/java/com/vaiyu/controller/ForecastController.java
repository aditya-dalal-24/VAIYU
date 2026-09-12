package com.vaiyu.controller;

import com.vaiyu.dto.PredictionRunDto;
import com.vaiyu.service.PredictionService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Running the trained models, and reading back what they produced.
 *
 * <p>No inference happens here: the controller validates and delegates. The
 * distinction between "no forecast has been run" (404 on the latest endpoint),
 * "this storm cannot be forecast" (422) and "the model is not available" (503)
 * is preserved all the way to the client, because each needs a different
 * response from the person looking at the screen.
 */
@RestController
@RequestMapping("/api/v1")
public class ForecastController {

    private final PredictionService predictions;

    public ForecastController(PredictionService predictions) {
        this.predictions = predictions;
    }

    /**
     * Runs the models for one storm and stores the result.
     *
     * @param baseTime forecast from the latest reported fix at or before this
     *                 instant; omit for the storm's most recent fix. Fixes
     *                 after it are excluded from the input, which is what makes
     *                 a forecast from a past time a genuine forecast.
     * @param force    run the model even if a stored run exists for that fix
     */
    @PostMapping("/cyclones/{id}/forecast")
    public PredictionRunDto forecast(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant baseTime,
            @RequestParam(required = false) List<String> analyses,
            @RequestParam(defaultValue = "false") boolean force) {
        return predictions.forecast(id, baseTime, analyses, force);
    }

    /**
     * The most recent stored run for a storm.
     *
     * <p>204 when the storm exists but has never been forecast, which is the
     * ordinary state; 404 is reserved for a storm id that is not in the
     * archive at all.
     */
    @GetMapping("/cyclones/{id}/forecast/latest")
    public ResponseEntity<PredictionRunDto> latest(@PathVariable UUID id) {
        return predictions.latest(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/cyclones/{id}/forecast/history")
    public List<PredictionRunDto> history(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int limit) {
        return predictions.history(id, limit);
    }

    @GetMapping("/forecasts/{runId}")
    public PredictionRunDto run(@PathVariable UUID runId) {
        return predictions.get(runId);
    }
}
