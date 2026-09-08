package com.cyclovision.controller;

import com.cyclovision.entity.AiAnalysisResult;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping({"/api/v1/satellite", "/api/satellite"})
@RequiredArgsConstructor
public class SatelliteController {

    @PostMapping("/analyze")
    public ResponseEntity<AiAnalysisResult> analyzeImage(@RequestBody SatelliteAnalyzeRequest request) {
        AiAnalysisResult result = AiAnalysisResult.builder()
                .id("ai-res-" + System.currentTimeMillis())
                .cycloneId(request.getCycloneId())
                .modelName("ResNet34-GradCAM-v1")
                .cycloneDetected(true)
                .eyeFormed(true)
                .structureScore(0.94)
                .classification("Very Severe Cyclonic Storm")
                .confidence(0.92)
                .gradcamImageUrl("https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80")
                .generatedAt(LocalDateTime.now())
                .build();

        return ResponseEntity.ok(result);
    }

    public static class SatelliteAnalyzeRequest {
        private String cycloneId;
        private String imageId;

        public String getCycloneId() { return cycloneId; }
        public void setCycloneId(String cycloneId) { this.cycloneId = cycloneId; }
        public String getImageId() { return imageId; }
        public void setImageId(String imageId) { this.imageId = imageId; }
    }
}
