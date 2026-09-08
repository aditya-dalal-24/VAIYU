package com.cyclovision.dto;

import java.time.Instant;
import java.util.UUID;

public class CycloneObservationResponse {
    private UUID id;
    private Instant observedAt;
    private Double latitude;
    private Double longitude;
    private Double windSpeedKph;
    private Double pressureHpa;
    private Double movementSpeedKph;
    private Double movementDirectionDegrees;
    private String source;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public Instant getObservedAt() { return observedAt; }
    public void setObservedAt(Instant observedAt) { this.observedAt = observedAt; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Double getWindSpeedKph() { return windSpeedKph; }
    public void setWindSpeedKph(Double windSpeedKph) { this.windSpeedKph = windSpeedKph; }
    public Double getPressureHpa() { return pressureHpa; }
    public void setPressureHpa(Double pressureHpa) { this.pressureHpa = pressureHpa; }
    public Double getMovementSpeedKph() { return movementSpeedKph; }
    public void setMovementSpeedKph(Double movementSpeedKph) { this.movementSpeedKph = movementSpeedKph; }
    public Double getMovementDirectionDegrees() { return movementDirectionDegrees; }
    public void setMovementDirectionDegrees(Double movementDirectionDegrees) { this.movementDirectionDegrees = movementDirectionDegrees; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
}
