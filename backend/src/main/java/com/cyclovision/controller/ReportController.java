package com.cyclovision.controller;

import lombok.Builder;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping({"/api/v1/cyclones", "/api/cyclones"})
public class ReportController {

    @GetMapping("/{id}/report")
    public ResponseEntity<SituationReportDto> getSituationReport(@PathVariable String id) {
        SituationReportDto report = SituationReportDto.builder()
                .cycloneId(id)
                .cycloneName("Cyclone Biparjoy")
                .generatedAt(LocalDateTime.now().toString())
                .executiveSummary("Cyclone Biparjoy has intensified into a Very Severe Cyclonic Storm over the Arabian Sea, moving North-Northwestward at 14 km/h with central pressure hovering near 954 hPa.")
                .keyThreats(List.of(
                        "Destructive sustained wind speeds up to 165 km/h near storm center",
                        "Storm surge of 2-3 meters above astronomical tide inundating low-lying coastal areas of Kutch",
                        "Heavy to extremely heavy rainfall (150-250mm) across coastal Gujarat"
                ))
                .recommendedActions(List.of(
                        "Issue evacuation notices for settlements within 5km of coastline in high-risk zones",
                        "Suspend maritime activities and recall fishing vessels to safe harbor immediately",
                        "Pre-position National Disaster Response Force (NDRF) teams in Mandvi, Bhuj, and Dwarka"
                ))
                .meteorologicalSynthesis("Multi-modal ResNet analysis indicates a fully closed eye feature with symmetric convective clouds. XGBoost + Kalman trajectory models project a curving trajectory towards the Kutch/Saurashtra coast by Day 2.")
                .build();

        return ResponseEntity.ok(report);
    }

    @Data
    @Builder
    public static class SituationReportDto {
        private String cycloneId;
        private String cycloneName;
        private String generatedAt;
        private String executiveSummary;
        private List<String> keyThreats;
        private List<String> recommendedActions;
        private String meteorologicalSynthesis;
    }
}
