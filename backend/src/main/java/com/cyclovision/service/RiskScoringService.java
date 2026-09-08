package com.cyclovision.service;

import com.cyclovision.entity.CycloneObservation;
import com.cyclovision.entity.RiskAssessment;
import com.cyclovision.repository.CycloneObservationRepository;
import com.cyclovision.repository.RiskAssessmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RiskScoringService {

    private final RiskAssessmentRepository riskAssessmentRepository;
    private final CycloneObservationRepository observationRepository;

    public RiskAssessment calculateRisk(String cycloneId) {
        List<CycloneObservation> obs = observationRepository.findByCycloneIdOrderByObservedAtAsc(cycloneId);
        double wind = 150.0;
        double pressure = 955.0;

        if (!obs.isEmpty()) {
            CycloneObservation latest = obs.get(obs.size() - 1);
            if (latest.getWindSpeedKmh() != null) wind = latest.getWindSpeedKmh();
            if (latest.getPressureHpa() != null) pressure = latest.getPressureHpa();
        }

        // Rule-based formula computation
        double normWind = Math.min(1.0, wind / 220.0);
        double normPressure = Math.min(1.0, (1013.0 - pressure) / 100.0);
        double distToCoastKm = 120.0; // Proximity to Kutch/Saurashtra coast
        double normCoastRisk = Math.max(0.0, 1.0 - (distToCoastKm / 500.0));
        double confidence = 0.88;

        double riskScore = 0.35 * normWind + 0.25 * normPressure + 0.25 * normCoastRisk + 0.15 * confidence;
        riskScore = Math.min(1.0, Math.max(0.0, riskScore));

        String level = "Low";
        if (riskScore > 0.8) level = "Critical";
        else if (riskScore > 0.6) level = "High";
        else if (riskScore > 0.35) level = "Moderate";

        RiskAssessment assessment = RiskAssessment.builder()
                .id(UUID.randomUUID().toString())
                .cycloneId(cycloneId)
                .riskLevel(level)
                .riskScore(Math.round(riskScore * 100.0) / 100.0)
                .atRiskRegionsJson("[\"Kutch District\", \"Saurashtra Coast\", \"Devbhumi Dwarka\"]")
                .landfallProbability48h(0.78)
                .computedAt(LocalDateTime.now())
                .build();

        return riskAssessmentRepository.save(assessment);
    }

    public RiskAssessment getLatestRisk(String cycloneId) {
        return riskAssessmentRepository.findFirstByCycloneIdOrderByComputedAtDesc(cycloneId)
                .orElseGet(() -> calculateRisk(cycloneId));
    }
}
