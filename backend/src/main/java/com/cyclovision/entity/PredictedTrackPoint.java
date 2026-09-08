package com.cyclovision.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "predicted_track_points")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PredictedTrackPoint {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id")
    @JsonIgnore
    private Prediction prediction;

    private Integer forecastHour;
    private Double lat;
    private Double longCoord;
    private Double confidenceRadiusKm;
}
