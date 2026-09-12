package com.vaiyu.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * One horizon of the analogue ensemble's forecast: where the matched historical
 * storms went next, applied to this storm.
 *
 * <p>This is a second forecast, independent of the neural models — it shares no
 * weights with them. {@code spreadKm} is the members' mean distance from the
 * ensemble mean, so a large value means the analogues disagreed.
 */
@Entity
@Table(name = "analogue_forecast_points")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalogueForecastPoint {

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

    @Column(name = "wind_speed_kph")
    private Double windSpeedKph;

    @Column(name = "spread_km")
    private Double spreadKm;

    @Column(name = "member_count")
    private Integer memberCount;
}
