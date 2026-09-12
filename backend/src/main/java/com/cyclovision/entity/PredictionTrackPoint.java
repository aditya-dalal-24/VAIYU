package com.cyclovision.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** One forecast position produced by the trajectory model. */
@Entity
@Table(name = "prediction_track_points")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PredictionTrackPoint {

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

    @Column(name = "latitude", nullable = false)
    private Double latitude;

    @Column(name = "longitude", nullable = false)
    private Double longitude;

    /**
     * The model's measured held-out mean error at this horizon, in km, or null
     * when its checkpoint recorded no evaluation. Null must stay null: a zero
     * would render as a cone claiming perfect accuracy.
     */
    @Column(name = "uncertainty_radius_km")
    private Double uncertaintyRadiusKm;
}
