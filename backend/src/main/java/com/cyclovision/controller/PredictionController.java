package com.cyclovision.controller;

import com.cyclovision.entity.Prediction;
import com.cyclovision.repository.PredictionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1/cyclones", "/api/cyclones"})
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionRepository predictionRepository;

    @GetMapping("/{id}/predictions")
    public ResponseEntity<Prediction> getPredictions(@PathVariable String id) {
        return predictionRepository.findFirstByCycloneIdOrderByGeneratedAtDesc(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/predict")
    public ResponseEntity<Prediction> runPrediction(@PathVariable String id) {
        return predictionRepository.findFirstByCycloneIdOrderByGeneratedAtDesc(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
