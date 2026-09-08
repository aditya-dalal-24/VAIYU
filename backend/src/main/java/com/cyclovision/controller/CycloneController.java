package com.cyclovision.controller;

import com.cyclovision.dto.CycloneDetailResponse;
import com.cyclovision.dto.CycloneObservationResponse;
import com.cyclovision.dto.CycloneSummaryResponse;
import com.cyclovision.service.CycloneService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cyclones")
public class CycloneController {

    private final CycloneService cycloneService;

    public CycloneController(CycloneService cycloneService) {
        this.cycloneService = cycloneService;
    }

    @GetMapping
    public ResponseEntity<List<CycloneSummaryResponse>> getAllCyclones(
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(
                cycloneService.getAllCyclones(status)
        );
    }

    @GetMapping("/active")
    public ResponseEntity<List<CycloneSummaryResponse>> getActiveCyclones() {
        return ResponseEntity.ok(
                cycloneService.getActiveCyclones()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<CycloneDetailResponse> getCycloneById(
            @PathVariable UUID id
    ) {
        return ResponseEntity.ok(
                cycloneService.getCycloneById(id)
        );
    }

    @GetMapping("/{id}/observations")
    public ResponseEntity<List<CycloneObservationResponse>>
    getCycloneObservations(@PathVariable UUID id) {

        return ResponseEntity.ok(
                cycloneService.getCycloneObservations(id)
        );
    }
}