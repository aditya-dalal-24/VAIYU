package com.vaiyu.repository;

import com.vaiyu.entity.CycloneObservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CycloneObservationRepository
        extends JpaRepository<CycloneObservation, UUID> {

    List<CycloneObservation> findByCycloneIdOrderByObservedAtAsc(UUID cycloneId);

    List<CycloneObservation> findByCycloneIdOrderByObservedAtDesc(UUID cycloneId);

    Optional<CycloneObservation> findByCycloneIdAndSourceRecordId(
            UUID cycloneId,
            String sourceRecordId
    );

    Optional<CycloneObservation> findFirstByCycloneIdOrderByObservedAtDesc(
            UUID cycloneId
    );

    /** Newest fix in the archive, for reporting data freshness. */
    Optional<CycloneObservation> findFirstByOrderByObservedAtDesc();
}