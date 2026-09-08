package com.cyclovision.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "similarity_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SimilarityResult {

    @Id
    private String id;

    private String cycloneId;

    @ManyToOne
    @JoinColumn(name = "historical_cyclone_id")
    private HistoricalCyclone historicalCyclone;

    private Double similarityScore;
    private Integer rankOrder;
}
