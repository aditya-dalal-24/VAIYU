package com.cyclovision.controller;

import com.cyclovision.ingestion.service.CycloneIngestionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/internal/ingest")
public class IngestionController {

    private final CycloneIngestionService ingestionService;

    public IngestionController(CycloneIngestionService ingestionService) {
        this.ingestionService = ingestionService;
    }

    @PostMapping("/trigger")
    public ResponseEntity<Map<String, String>> triggerIngestion() {
        ingestionService.runIngestion();
        return ResponseEntity.ok(Map.of("status", "success", "message", "Ingestion completed successfully"));
    }
}
