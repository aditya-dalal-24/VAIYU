package com.cyclovision.repository;

import com.cyclovision.entity.CyclonePrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CyclonePredictionRepository extends JpaRepository<CyclonePrediction, UUID> {
    List<CyclonePrediction> findByCycloneIdOrderByBaseTimestampDesc(UUID cycloneId);
    List<CyclonePrediction> findByPredictionType(String predictionType);
    Optional<CyclonePrediction> findFirstByCycloneIdOrderByBaseTimestampDesc(UUID cycloneId);
}
