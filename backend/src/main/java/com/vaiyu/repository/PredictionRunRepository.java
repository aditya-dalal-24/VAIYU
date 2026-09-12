package com.vaiyu.repository;

import com.vaiyu.entity.PredictionRun;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PredictionRunRepository extends JpaRepository<PredictionRun, UUID> {

    /*
     * Entity graphs rather than lazy access: these runs are serialised straight
     * after loading, and open-in-view is off, so a lazy collection would fail
     * outside the transaction.
     */
    @EntityGraph(attributePaths = {
            "trackPoints", "intensityPoints", "analogueMatches", "analogueForecast"})
    Optional<PredictionRun> findWithDetailById(UUID id);

    @EntityGraph(attributePaths = {
            "trackPoints", "intensityPoints", "analogueMatches", "analogueForecast"})
    List<PredictionRun> findByCycloneIdOrderByCreatedAtDesc(UUID cycloneId, Pageable pageable);

    @EntityGraph(attributePaths = {
            "trackPoints", "intensityPoints", "analogueMatches", "analogueForecast"})
    Optional<PredictionRun> findFirstByCycloneIdOrderByCreatedAtDesc(UUID cycloneId);

    /** The newest run made from exactly this base fix, to avoid re-running the model. */
    @EntityGraph(attributePaths = {
            "trackPoints", "intensityPoints", "analogueMatches", "analogueForecast"})
    Optional<PredictionRun> findFirstByCycloneIdAndBaseObservationAtOrderByCreatedAtDesc(
            UUID cycloneId, Instant baseObservationAt);

    long countByCycloneId(UUID cycloneId);

    @Query("select count(r) from PredictionRun r where r.overallStatus in ('COMPLETED','PARTIAL')")
    long countUsable();

    @Query("""
            select r.trajectoryModelName, r.trajectoryModelVersion, count(r)
            from PredictionRun r
            where r.trajectoryModelName is not null
            group by r.trajectoryModelName, r.trajectoryModelVersion
            """)
    List<Object[]> countByTrajectoryModel();

    @Query("select r from PredictionRun r where r.cyclone.id = :cycloneId and r.overallStatus in ('COMPLETED','PARTIAL') order by r.createdAt desc")
    @EntityGraph(attributePaths = {
            "trackPoints", "intensityPoints", "analogueMatches", "analogueForecast"})
    List<PredictionRun> findUsableByCyclone(@Param("cycloneId") UUID cycloneId, Pageable pageable);
}
