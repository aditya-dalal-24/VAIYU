package com.cyclovision.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * What the vision model answered about one satellite image.
 *
 * <p>The result columns are nullable and paired with a status and reason. When
 * no satellite checkpoint exists, the row records that refusal — it does not
 * record a detection. The prototype this replaces stored a fixed 0.92
 * confidence and a stock photograph as a "Grad-CAM"; nothing here is populated
 * unless the model produced it.
 */
@Entity
@Table(name = "satellite_analyses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SatelliteAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cyclone_id")
    private Cyclone cyclone;

    @Column(name = "image_url", nullable = false, columnDefinition = "text")
    private String imageUrl;

    /** Sensor and band, by convention {@code "<SENSOR>|<BAND>"}. */
    @Column(name = "image_type")
    private String imageType;

    @Column(name = "captured_at")
    private Instant capturedAt;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "reason", columnDefinition = "text")
    private String reason;

    @Column(name = "cyclone_detected")
    private Boolean cycloneDetected;

    @Column(name = "confidence")
    private Double confidence;

    @Column(name = "center_latitude")
    private Double centerLatitude;

    @Column(name = "center_longitude")
    private Double centerLongitude;

    @Column(name = "gradcam_url", columnDefinition = "text")
    private String gradcamUrl;

    @Column(name = "model_name")
    private String modelName;

    @Column(name = "model_version")
    private String modelVersion;

    /** What a positive answer means, as the model's checkpoint defines it. */
    @Column(name = "label_definition", columnDefinition = "text")
    private String labelDefinition;

    @Column(name = "inference_ms")
    private Integer inferenceMs;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
