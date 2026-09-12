package com.cyclovision.controller;

import com.cyclovision.dto.CycloneDetailDto;
import com.cyclovision.dto.CycloneSummaryDto;
import com.cyclovision.dto.ObservationDto;
import com.cyclovision.dto.PageResponse;
import com.cyclovision.service.CycloneQueryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Browsing the storm archive. Read-only, and independent of the AI service, so
 * the archive stays usable whether or not a model is loaded.
 */
@RestController
@RequestMapping("/api/v1/cyclones")
public class CycloneController {

    private final CycloneQueryService cyclones;

    public CycloneController(CycloneQueryService cyclones) {
        this.cyclones = cyclones;
    }

    /**
     * Search and filter. Paged by default because the archive holds thousands
     * of storms and sending all of them would be slow and useless.
     *
     * @param query  matches storm name or IBTrACS identifier
     * @param basin  IBTrACS basin code, e.g. NI
     * @param season season year
     * @param sort   recent (default), intensity, pressure, name, observations, oldest
     */
    @GetMapping
    public PageResponse<CycloneSummaryDto> search(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String basin,
            @RequestParam(required = false) Integer season,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return cyclones.search(query, basin, season, sort, page, size);
    }

    /** Filter values that actually exist in the data, for building the UI. */
    @GetMapping("/filters")
    public Map<String, Object> filters() {
        return Map.of(
                "seasons", cyclones.seasons(),
                "basins", cyclones.basins());
    }

    @GetMapping("/{id}")
    public CycloneDetailDto detail(@PathVariable UUID id) {
        return cyclones.detail(id);
    }

    /** The observed track, oldest fix first. */
    @GetMapping("/{id}/track")
    public List<ObservationDto> track(@PathVariable UUID id) {
        return cyclones.track(id);
    }

    @GetMapping("/{id}/observations")
    public ResponseEntity<List<ObservationDto>> observations(@PathVariable UUID id) {
        return ResponseEntity.ok(cyclones.track(id));
    }
}
