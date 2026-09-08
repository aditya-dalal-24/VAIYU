package com.cyclovision.controller;

import com.cyclovision.entity.RiskAssessment;
import com.cyclovision.service.RiskScoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1/cyclones", "/api/cyclones"})
@RequiredArgsConstructor
public class RiskController {

    private final RiskScoringService riskScoringService;

    @GetMapping("/{id}/risk")
    public ResponseEntity<RiskAssessment> getRiskAssessment(@PathVariable String id) {
        return ResponseEntity.ok(riskScoringService.getLatestRisk(id));
    }
}
