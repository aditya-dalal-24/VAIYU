package com.vaiyu.repository;

import com.vaiyu.entity.Cyclone;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CycloneRepository extends JpaRepository<Cyclone, UUID> {

    Optional<Cyclone> findByExternalSourceAndExternalId(String externalSource, String externalId);

    List<Cyclone> findByExternalSourceAndExternalIdIn(String externalSource, List<String> externalIds);

    /**
     * One row per storm with the aggregates a list view needs, computed in the
     * database rather than by loading every observation.
     *
     * <p>Storms with no observations are excluded by the inner join: a storm
     * with no track cannot be displayed, mapped or forecast, so listing it
     * would only produce dead ends.
     */
    @Query(value = """
            select c.id as id,
                   c.externalId as externalId,
                   c.name as name,
                   c.basin as basin,
                   c.seasonYear as seasonYear,
                   c.status as status,
                   count(o.id) as observationCount,
                   min(o.observedAt) as firstObservedAt,
                   max(o.observedAt) as lastObservedAt,
                   max(o.windSpeedKph) as peakWindKph,
                   min(o.pressureHpa) as minPressureHpa
            from Cyclone c join c.observations o
            where (:basin is null or c.basin = :basin)
              and (:season is null or c.seasonYear = :season)
              and (:query is null or lower(coalesce(c.name, '')) like :query
                   or lower(c.externalId) like :query)
            group by c.id, c.externalId, c.name, c.basin, c.seasonYear, c.status
            """,
            countQuery = """
            select count(distinct c.id)
            from Cyclone c join c.observations o
            where (:basin is null or c.basin = :basin)
              and (:season is null or c.seasonYear = :season)
              and (:query is null or lower(coalesce(c.name, '')) like :query
                   or lower(c.externalId) like :query)
            """)
    Page<CycloneListRow> search(
            @Param("query") String query,
            @Param("basin") String basin,
            @Param("season") Integer season,
            Pageable pageable);

    /** Projection for {@link #search}. */
    interface CycloneListRow {
        UUID getId();

        String getExternalId();

        String getName();

        String getBasin();

        Integer getSeasonYear();

        String getStatus();

        long getObservationCount();

        Instant getFirstObservedAt();

        Instant getLastObservedAt();

        Double getPeakWindKph();

        Double getMinPressureHpa();
    }

    @Query("select distinct c.seasonYear from Cyclone c where c.seasonYear is not null order by c.seasonYear desc")
    List<Integer> findSeasons();

    @Query("select distinct c.basin from Cyclone c where c.basin is not null order by c.basin")
    List<String> findBasins();

    @Query("select count(c) from Cyclone c")
    long countAll();
}
