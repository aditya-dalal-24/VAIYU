package com.cyclovision.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "cyclone_observations")
public class CycloneObservation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cyclone_id", nullable = false)
    private Cyclone cyclone;

    @Column(name = "observed_at", nullable = false)
    private Instant observedAt;

    @Column(name = "latitude", nullable = false)
    private Double latitude;

    @Column(name = "longitude", nullable = false)
    private Double longitude;

    @Column(name = "wind_speed_kph")
    private Double windSpeedKph;

    @Column(name = "pressure_hpa")
    private Double pressureHpa;

    @Column(name = "movement_speed_kph")
    private Double movementSpeedKph;

    @Column(name = "movement_direction_degrees")
    private Double movementDirectionDegrees;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "source_record_id")
    private String sourceRecordId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Cyclone getCyclone() {
        return cyclone;
    }

    public void setCyclone(Cyclone cyclone) {
        this.cyclone = cyclone;
    }

    public Instant getObservedAt() {
        return observedAt;
    }

    public void setObservedAt(Instant observedAt) {
        this.observedAt = observedAt;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Double getWindSpeedKph() {
        return windSpeedKph;
    }

    public void setWindSpeedKph(Double windSpeedKph) {
        this.windSpeedKph = windSpeedKph;
    }

    public Double getPressureHpa() {
        return pressureHpa;
    }

    public void setPressureHpa(Double pressureHpa) {
        this.pressureHpa = pressureHpa;
    }

    public Double getMovementSpeedKph() {
        return movementSpeedKph;
    }

    public void setMovementSpeedKph(Double movementSpeedKph) {
        this.movementSpeedKph = movementSpeedKph;
    }

    public Double getMovementDirectionDegrees() {
        return movementDirectionDegrees;
    }

    public void setMovementDirectionDegrees(Double movementDirectionDegrees) {
        this.movementDirectionDegrees = movementDirectionDegrees;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getSourceRecordId() {
        return sourceRecordId;
    }

    public void setSourceRecordId(String sourceRecordId) {
        this.sourceRecordId = sourceRecordId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}