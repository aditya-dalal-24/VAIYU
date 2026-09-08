package com.cyclovision.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "weather_data")
public class WeatherData {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "cyclone_id")
    private Cyclone cyclone;

    @Column(name = "measured_at", nullable = false)
    private Instant measuredAt;

    @Column(name = "latitude", nullable = false)
    private Double latitude;

    @Column(name = "longitude", nullable = false)
    private Double longitude;

    @Column(name = "sea_surface_temp_c")
    private Double seaSurfaceTempC;

    @Column(name = "wind_shear_kph")
    private Double windShearKph;

    @Column(name = "humidity_percent")
    private Double humidityPercent;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public Cyclone getCyclone() { return cyclone; }
    public void setCyclone(Cyclone cyclone) { this.cyclone = cyclone; }
    public Instant getMeasuredAt() { return measuredAt; }
    public void setMeasuredAt(Instant measuredAt) { this.measuredAt = measuredAt; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Double getSeaSurfaceTempC() { return seaSurfaceTempC; }
    public void setSeaSurfaceTempC(Double seaSurfaceTempC) { this.seaSurfaceTempC = seaSurfaceTempC; }
    public Double getWindShearKph() { return windShearKph; }
    public void setWindShearKph(Double windShearKph) { this.windShearKph = windShearKph; }
    public Double getHumidityPercent() { return humidityPercent; }
    public void setHumidityPercent(Double humidityPercent) { this.humidityPercent = humidityPercent; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
