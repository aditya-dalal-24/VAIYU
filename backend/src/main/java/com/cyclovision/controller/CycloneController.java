package com.cyclovision.controller;

import com.cyclovision.entity.Cyclone;
import com.cyclovision.entity.CycloneObservation;
import com.cyclovision.service.CycloneService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/v1/cyclones", "/api/cyclones"})
@RequiredArgsConstructor
public class CycloneController {

    private final CycloneService cycloneService;

    @GetMapping
    public ResponseEntity<List<Cyclone>> getAllCyclones() {
        return ResponseEntity.ok(cycloneService.getActiveCyclones());
    }

    @GetMapping("/active")
    public ResponseEntity<List<Cyclone>> getActiveCyclones() {
        return ResponseEntity.ok(cycloneService.getActiveCyclones());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Cyclone> getCycloneById(@PathVariable String id) {
        return cycloneService.getCycloneById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/observations")
    public ResponseEntity<List<CycloneObservation>> getObservations(@PathVariable String id) {
        return ResponseEntity.ok(cycloneService.getCycloneObservations(id));
    }
}
