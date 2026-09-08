package com.cyclovision.repository;

import com.cyclovision.entity.CycloneObservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CycloneObservationRepository extends JpaRepository<CycloneObservation, UUID> {
    List<CycloneObservation> findByCycloneIdOrderByObservedAtDesc(UUID cycloneId);
    Optional<CycloneObservation> findFirstByCycloneIdOrderByObservedAtDesc(UUID cycloneId);
}
