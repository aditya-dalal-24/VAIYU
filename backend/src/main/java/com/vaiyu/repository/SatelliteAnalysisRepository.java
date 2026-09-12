package com.vaiyu.repository;

import com.vaiyu.entity.SatelliteAnalysis;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SatelliteAnalysisRepository extends JpaRepository<SatelliteAnalysis, UUID> {

    List<SatelliteAnalysis> findByCycloneIdOrderByCreatedAtDesc(UUID cycloneId);

    List<SatelliteAnalysis> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
