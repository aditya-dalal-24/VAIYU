package com.vaiyu.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * One tropical cyclone from the best-track archive.
 *
 * <p>Identity is {@code (externalSource, externalId)} — for IBTrACS that is the
 * storm's SID, such as {@code 2023129N08091}. Keeping the source identifier is
 * what lets the analogue ensemble's matches resolve back to a storm here: the
 * AI service returns SIDs, and the same archive was loaded into this table.
 *
 * <p>{@code status} is {@code ARCHIVED} or {@code RECENT}, never "ACTIVE".
 * There is no live feed behind this data, so a claim of active monitoring would
 * not be supportable.
 */
@Entity
@Table(name = "cyclones")
@Getter
@Setter
public class Cyclone {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "external_source")
    private String externalSource;

    @Column(name = "external_id")
    private String externalId;

    /** Null for unnamed storms; the interface falls back to the identifier. */
    @Column(name = "name")
    private String name;

    /** IBTrACS basin code: NI, SI, NA, SA, EP, WP, SP. */
    @Column(name = "basin", nullable = false)
    private String basin;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "season_year")
    private Integer seasonYear;

    @Column(name = "current_category")
    private String currentCategory;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false)
    private Instant updatedAt;

    /**
     * Mapped for the aggregate query that powers the storm list. Loading it
     * eagerly would pull a whole track per storm, so it stays lazy and callers
     * read observations through their own repository.
     */
    @OneToMany(mappedBy = "cyclone", fetch = FetchType.LAZY)
    private List<CycloneObservation> observations = new ArrayList<>();
}
