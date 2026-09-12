package com.vaiyu.controller;

import com.vaiyu.dto.SatelliteAnalysisDto;
import com.vaiyu.service.SatelliteAnalysisService;
import com.vaiyu.service.SatelliteImageStore;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Satellite intelligence: upload a frame, have the vision model analyse it,
 * and read past analyses.
 *
 * <p>Uploads are hosted here because the AI service fetches imagery by URL
 * rather than taking bytes in the analysis request.
 */
@RestController
@RequestMapping("/api/v1/satellite")
public class SatelliteController {

    private final SatelliteAnalysisService analyses;
    private final SatelliteImageStore images;

    public SatelliteController(SatelliteAnalysisService analyses, SatelliteImageStore images) {
        this.analyses = analyses;
        this.images = images;
    }

    /** Stores a frame and returns the URL the analysis step needs. */
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SatelliteImageStore.Stored upload(@RequestPart("file") MultipartFile file) {
        return images.store(file);
    }

    @GetMapping("/images/{id}")
    public ResponseEntity<Resource> image(@PathVariable String id) {
        return images.load(id)
                .map(resource -> ResponseEntity.ok()
                        .contentType(MediaTypeFactory.getMediaType(resource)
                                .orElse(MediaType.APPLICATION_OCTET_STREAM))
                        .body(resource))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Runs the vision model on one image.
     *
     * @param imageType sensor and band, by convention {@code "<SENSOR>|<BAND>"}
     *                  (for example {@code "INSAT-3DR|TIR1 10.8 um"}). The keys
     *                  a trained model recognises are listed by
     *                  {@code /api/v1/system/status}.
     */
    @PostMapping("/analyze")
    public SatelliteAnalysisDto analyse(@RequestBody AnalyzeRequest request) {
        return analyses.analyse(
                request.cycloneId(), request.imageUrl(), request.imageType(), request.capturedAt());
    }

    public record AnalyzeRequest(
            UUID cycloneId,
            String imageUrl,
            String imageType,
            Instant capturedAt
    ) {
    }

    @GetMapping("/analyses")
    public List<SatelliteAnalysisDto> recent(@RequestParam(defaultValue = "20") int limit) {
        return analyses.recent(limit);
    }

    @GetMapping("/analyses/cyclone/{cycloneId}")
    public List<SatelliteAnalysisDto> forCyclone(@PathVariable UUID cycloneId) {
        return analyses.forCyclone(cycloneId);
    }
}
