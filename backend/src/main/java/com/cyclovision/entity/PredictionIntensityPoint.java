package com.cyclovision.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** One forecast wind and pressure produced by the intensity model. */
@Entity
@Table(name = "prediction_intensity_points")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PredictionIntensityPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private PredictionRun run;

    @Column(name = "forecast_hours", nullable = false)
    private Integer forecastHours;

    @Column(name = "forecast_at", nullable = false)
    private Instant forecastAt;

    @Column(name = "wind_speed_kph")
    private Double windSpeedKph;

    @Column(name = "pressure_hpa")
    private Double pressureHpa;
}
