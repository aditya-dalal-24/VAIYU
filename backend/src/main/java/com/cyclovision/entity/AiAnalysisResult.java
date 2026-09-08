package com.cyclovision.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_analysis_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAnalysisResult {

    @Id
    private String id;

    private String cycloneId;
    private String modelName;
    private Boolean cycloneDetected;
    private Boolean eyeFormed;
    private Double structureScore;
    private String classification;
    private Double confidence;

    @Column(length = 1000)
    private String gradcamImageUrl;

    private LocalDateTime generatedAt;
}
