package com.vaiyu.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * One recorded call to the AI service: the inputs it was given, what each model
 * answered, and the reason where a model declined.
 *
 * <p>Runs are kept even when no model could answer. A stored reason ("no
 * pressure on the base fix", "no analogue index built") is the difference
 * between a system that explains itself and one that shows an empty panel.
 */
@Entity
@Table(name = "prediction_runs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PredictionRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cyclone_id", nullable = false)
    private Cyclone cyclone;

    /** The observation the forecast was made from. */
    @Column(name = "base_observation_at", nullable = false)
    private Instant baseObservationAt;

    @Column(name = "observations_used", nullable = false)
    private Integer observationsUsed;

    /** Comma-separated analysis types requested, as sent to the AI service. */
    @Column(name = "requested_analyses", nullable = false)
    private String requestedAnalyses;

    @Column(name = "ai_request_id")
    private String aiRequestId;

    @Column(name = "overall_status", nullable = false)
    private String overallStatus;

    /** Comma-separated ids of the observations sent to the model. */
    @Column(name = "input_observation_ids", columnDefinition = "text")
    private String inputObservationIds;

    /** What was filtered from the input and why, one note per line. */
    @Column(name = "input_notes", columnDefinition = "text")
    private String inputNotes;

    @Column(name = "trajectory_status")
    private String trajectoryStatus;

    @Column(name = "trajectory_reason", columnDefinition = "text")
    private String trajectoryReason;

    @Column(name = "trajectory_confidence")
    private Double trajectoryConfidence;

    @Column(name = "trajectory_model_name")
    private String trajectoryModelName;

    @Column(name = "trajectory_model_version")
    private String trajectoryModelVersion;

    @Column(name = "trajectory_feature_set")
    private String trajectoryFeatureSet;

    @Column(name = "intensity_status")
    private String intensityStatus;

    @Column(name = "intensity_reason", columnDefinition = "text")
    private String intensityReason;

    @Column(name = "intensity_confidence")
    private Double intensityConfidence;

    @Column(name = "intensity_trend")
    private String intensityTrend;

    @Column(name = "intensity_model_name")
    private String intensityModelName;

    @Column(name = "intensity_model_version")
    private String intensityModelVersion;

    @Column(name = "similarity_status")
    private String similarityStatus;

    @Column(name = "similarity_reason", columnDefinition = "text")
    private String similarityReason;

    @Column(name = "similarity_confidence")
    private Double similarityConfidence;

    @Column(name = "similarity_model_name")
    private String similarityModelName;

    @Column(name = "inference_ms")
    private Integer inferenceMs;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /*
     * Sets rather than lists, deliberately. A run has four child collections and
     * they are all fetched in one query for serialisation; Hibernate cannot fetch
     * multiple "bags" (unordered lists) at once, and splitting into four queries
     * per run would be worse. Ordering is applied where it is read, in
     * PredictionRunDto, so it does not depend on the collection type.
     */
    @OneToMany(mappedBy = "run", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<PredictionTrackPoint> trackPoints = new LinkedHashSet<>();

    @OneToMany(mappedBy = "run", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<PredictionIntensityPoint> intensityPoints = new LinkedHashSet<>();

    @OneToMany(mappedBy = "run", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<AnalogueMatch> analogueMatches = new LinkedHashSet<>();

    @OneToMany(mappedBy = "run", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<AnalogueForecastPoint> analogueForecast = new LinkedHashSet<>();

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public void addTrackPoint(PredictionTrackPoint point) {
        point.setRun(this);
        trackPoints.add(point);
    }

    public void addIntensityPoint(PredictionIntensityPoint point) {
        point.setRun(this);
        intensityPoints.add(point);
    }

    public void addAnalogueMatch(AnalogueMatch match) {
        match.setRun(this);
        analogueMatches.add(match);
    }

    public void addAnalogueForecastPoint(AnalogueForecastPoint point) {
        point.setRun(this);
        analogueForecast.add(point);
    }
}
