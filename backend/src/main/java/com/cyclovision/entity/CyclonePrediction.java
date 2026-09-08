package com.cyclovision.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "cyclone_predictions")
public class CyclonePrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cyclone_id", nullable = false)
    private Cyclone cyclone;

    @Column(name = "prediction_type", nullable = false)
    private String predictionType;

    @Column(name = "model_name", nullable = false)
    private String modelName;

    @Column(name = "model_version", nullable = false)
    private String modelVersion;

    @Column(name = "base_timestamp", nullable = false)
    private Instant baseTimestamp;

    @Column(name = "forecast_timestamp", nullable = false)
    private Instant forecastTimestamp;

    @Column(name = "forecast_hours", nullable = false)
    private Integer forecastHours;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "predicted_wind_speed_kph")
    private Double predictedWindSpeedKph;

    @Column(name = "predicted_pressure_hpa")
    private Double predictedPressureHpa;

    @Column(name = "trend")
    private String trend;

    @Column(name = "confidence")
    private Double confidence;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public Cyclone getCyclone() { return cyclone; }
    public void setCyclone(Cyclone cyclone) { this.cyclone = cyclone; }
    public String getPredictionType() { return predictionType; }
    public void setPredictionType(String predictionType) { this.predictionType = predictionType; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }
    public Instant getBaseTimestamp() { return baseTimestamp; }
    public void setBaseTimestamp(Instant baseTimestamp) { this.baseTimestamp = baseTimestamp; }
    public Instant getForecastTimestamp() { return forecastTimestamp; }
    public void setForecastTimestamp(Instant forecastTimestamp) { this.forecastTimestamp = forecastTimestamp; }
    public Integer getForecastHours() { return forecastHours; }
    public void setForecastHours(Integer forecastHours) { this.forecastHours = forecastHours; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Double getPredictedWindSpeedKph() { return predictedWindSpeedKph; }
    public void setPredictedWindSpeedKph(Double predictedWindSpeedKph) { this.predictedWindSpeedKph = predictedWindSpeedKph; }
    public Double getPredictedPressureHpa() { return predictedPressureHpa; }
    public void setPredictedPressureHpa(Double predictedPressureHpa) { this.predictedPressureHpa = predictedPressureHpa; }
    public String getTrend() { return trend; }
    public void setTrend(String trend) { this.trend = trend; }
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
