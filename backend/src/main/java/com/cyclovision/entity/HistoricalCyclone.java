package com.cyclovision.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "historical_cyclones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HistoricalCyclone {

    @Id
    private String id;

    private String name;
    private Integer seasonYear;
    private String finalIntensity;
    private String finalLandfallLocation;

    @Column(length = 2000)
    private String impactSummary;

    private Double maxWindSpeedKmh;
    private Double minPressureHpa;
}
