package com.cyclovision.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * A historical storm the analogue ensemble selected for one run.
 *
 * <p>The score and the basis come from the AI service; the storm itself stays
 * in the {@code cyclones} table, so {@code matchedCycloneId} is resolved on
 * save when that storm has been ingested here.
 */
@Entity
@Table(name = "analogue_matches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalogueMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private PredictionRun run;

    @Column(name = "rank_order", nullable = false)
    private Integer rankOrder;

    /** IBTrACS storm identifier as returned by the AI service. */
    @Column(name = "historical_external_id", nullable = false)
    private String historicalExternalId;

    @Column(name = "historical_name")
    private String historicalName;

    @Column(name = "season_year")
    private Integer seasonYear;

    @Column(name = "similarity_score", nullable = false)
    private Double similarityScore;

    /** Which feature groups the match used, comma-separated. */
    @Column(name = "similarity_basis")
    private String similarityBasis;

    @Column(name = "matched_cyclone_id")
    private UUID matchedCycloneId;
}
