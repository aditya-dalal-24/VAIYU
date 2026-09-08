package com.cyclovision.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "predictions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Prediction {

    @Id
    private String id;

    private String cycloneId;
    private LocalDateTime generatedAt;
    private String modelVersion;
    private String predictedIntensityTrend;
    private Double confidenceScore;

    @Column(length = 2000)
    private String explanation;

    @OneToMany(mappedBy = "prediction", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("forecastHour ASC")
    @Builder.Default
    private List<PredictedTrackPoint> trajectory = new ArrayList<>();
}
