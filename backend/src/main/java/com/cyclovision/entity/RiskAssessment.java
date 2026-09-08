package com.cyclovision.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "risk_assessments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskAssessment {

    @Id
    private String id;

    private String cycloneId;
    private String riskLevel;
    private Double riskScore;

    @Column(length = 1000)
    private String atRiskRegionsJson;

    private Double landfallProbability48h;
    private LocalDateTime computedAt;
}
