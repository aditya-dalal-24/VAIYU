package com.vaiyu.controller;

import com.vaiyu.dto.CycloneDetailDto;
import com.vaiyu.dto.CycloneSummaryDto;
import com.vaiyu.dto.ObservationDto;
import com.vaiyu.dto.PageResponse;
import com.vaiyu.dto.StormDnaDto;
import com.vaiyu.service.CycloneQueryService;
import com.vaiyu.service.StormDnaService;
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
    private final StormDnaService dna;

    public CycloneController(CycloneQueryService cyclones, StormDnaService dna) {
        this.cyclones = cyclones;
        this.dna = dna;
    }

    /**
     * Search and filter. Paged by default because the archive holds thousands
     * of storms and sending all of them would be slow and useless.
     *
     * @param query  matches storm name or IBTrACS identifier
     * @param basin    IBTrACS basin code, e.g. NI
     * @param subBasin IBTrACS sub-basin code, e.g. AS for the Arabian Sea or
     *                 BB for the Bay of Bengal
     * @param season   season year
     * @param sort   recent (default), intensity, pressure, name, observations, oldest
     */
    @GetMapping
    public PageResponse<CycloneSummaryDto> search(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String basin,
            @RequestParam(required = false) String subBasin,
            @RequestParam(required = false) Integer season,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return cyclones.search(query, basin, subBasin, season, sort, page, size);
    }

    /** Filter values that actually exist in the data, for building the UI. */
    @GetMapping("/filters")
    public Map<String, Object> filters() {
        return Map.of(
                "seasons", cyclones.seasons(),
                "basins", cyclones.basins(),
                "subBasins", cyclones.subBasins());
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

    /**
     * Storm DNA: this storm's life measured from its fixes, and the archive
     * storms whose signatures are closest to it.
     *
     * <p>Nothing here is predicted. It is a description of what the storm did,
     * and a comparison with what other storms did, computed from stored
     * observations alone — which is why it works for every storm in the
     * archive, including the ones no model has been run on.
     *
     * @param limit how many neighbours to return, 1 to 20
     */
    @GetMapping("/{id}/dna")
    public StormDnaDto dna(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer limit) {
        return dna.dnaOf(id, limit == null ? StormDnaService.defaultNeighbours() : limit);
    }
}
