package com.cyclovision.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "cyclones")
public class Cyclone {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "external_source")
    private String externalSource;

    @Column(name = "external_id")
    private String externalId;

    @Column(name = "name")
    private String name;

    @Column(name = "basin", nullable = false)
    private String basin;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "current_category")
    private String currentCategory;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "cyclone")
    private List<CycloneObservation> observations;

    @OneToMany(mappedBy = "cyclone")
    private List<WeatherData> weatherData;

    @OneToMany(mappedBy = "cyclone")
    private List<SatelliteImage> satelliteImages;

    @OneToMany(mappedBy = "cyclone")
    private List<CyclonePrediction> predictions;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getExternalSource() {
        return externalSource;
    }

    public void setExternalSource(String externalSource) {
        this.externalSource = externalSource;
    }

    public String getExternalId() {
        return externalId;
    }

    public void setExternalId(String externalId) {
        this.externalId = externalId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getBasin() {
        return basin;
    }

    public void setBasin(String basin) {
        this.basin = basin;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCurrentCategory() {
        return currentCategory;
    }

    public void setCurrentCategory(String currentCategory) {
        this.currentCategory = currentCategory;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<CycloneObservation> getObservations() {
        return observations;
    }

    public void setObservations(List<CycloneObservation> observations) {
        this.observations = observations;
    }

    public List<WeatherData> getWeatherData() {
        return weatherData;
    }

    public void setWeatherData(List<WeatherData> weatherData) {
        this.weatherData = weatherData;
    }

    public List<SatelliteImage> getSatelliteImages() {
        return satelliteImages;
    }

    public void setSatelliteImages(List<SatelliteImage> satelliteImages) {
        this.satelliteImages = satelliteImages;
    }

    public List<CyclonePrediction> getPredictions() {
        return predictions;
    }

    public void setPredictions(List<CyclonePrediction> predictions) {
        this.predictions = predictions;
    }
}