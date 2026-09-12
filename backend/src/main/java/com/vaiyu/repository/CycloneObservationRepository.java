package com.vaiyu.repository;

import com.vaiyu.entity.CycloneObservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
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

    /**
     * Every fix in the archive, grouped by storm and in time order.
     *
     * <p>Used once to build the storm-DNA index, which needs whole tracks
     * rather than aggregates. The cyclone is fetched with the fix because the
     * caller groups by storm id, and a lazy proxy per row would turn one query
     * into ninety thousand.
     */
    @Query("select o from CycloneObservation o join fetch o.cyclone "
            + "order by o.cyclone.id, o.observedAt")
    List<CycloneObservation> findAllForSignatures();
}