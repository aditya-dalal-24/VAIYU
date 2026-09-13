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
                   c.subBasin as subBasin,
                   c.seasonYear as seasonYear,
                   c.status as status,
                   count(o.id) as observationCount,
                   min(o.observedAt) as firstObservedAt,
                   max(o.observedAt) as lastObservedAt,
                   max(o.windSpeedKph) as peakWindKph,
                   min(o.pressureHpa) as minPressureHpa
            from Cyclone c join c.observations o
            where (:basin is null or c.basin = :basin)
              and (:subBasin is null or c.subBasin = :subBasin)
              and (:season is null or c.seasonYear = :season)
              and (:query is null or lower(coalesce(c.name, '')) like :query
                   or lower(c.externalId) like :query)
            group by c.id, c.externalId, c.name, c.basin, c.subBasin, c.seasonYear, c.status
            """,
            countQuery = """
            select count(distinct c.id)
            from Cyclone c join c.observations o
            where (:basin is null or c.basin = :basin)
              and (:subBasin is null or c.subBasin = :subBasin)
              and (:season is null or c.seasonYear = :season)
              and (:query is null or lower(coalesce(c.name, '')) like :query
                   or lower(c.externalId) like :query)
            """)
    Page<CycloneListRow> search(
            @Param("query") String query,
            @Param("basin") String basin,
            @Param("subBasin") String subBasin,
            @Param("season") Integer season,
            Pageable pageable);

    /** Projection for {@link #search}. */
    interface CycloneListRow {
        UUID getId();

        String getExternalId();

        String getName();

        String getBasin();

        String getSubBasin();

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

    /**
     * Sub-basins that actually occur, with the basin each belongs to.
     *
     * <p>Paired with its basin because a sub-basin only means anything inside
     * one: "AS" is the Arabian Sea within the North Indian Ocean, and offering
     * it while the Atlantic is selected would be a filter that can only ever
     * return nothing.
     */
    @Query("""
            select distinct c.basin as basin, c.subBasin as code
            from Cyclone c
            where c.subBasin is not null
            order by c.basin, c.subBasin
            """)
    List<SubBasinRow> findSubBasins();

    /** Projection for {@link #findSubBasins}. */
    interface SubBasinRow {
        String getBasin();

        String getCode();
    }

    /**
     * Season-by-season activity, grouped by the sea a storm formed in.
     *
     * <p>Native SQL for two reasons JPQL cannot serve: Accumulated Cyclone
     * Energy needs a squared sum over fixes, and naming the strongest storm of
     * each group needs a per-group ordering. Both are computed in the database
     * over 109,000 fixes rather than pulled into memory.
     *
     * <p>The 62.9 kph floor is 34 knots, the threshold ACE is defined on. It is
     * written as 62.9 rather than 63 deliberately: 34 kt converts to 62.968
     * kph, so a fix reported at exactly 34 kt would fall below a 63 kph
     * comparison and silently vanish from the season it belongs to.
     */
    @Query(value = """
            with active as (
                select c.season_year as season,
                       c.sub_basin as sub_basin,
                       count(distinct c.id) as storms,
                       sum(power(o.wind_speed_kph / 1.852, 2)) / 10000.0 as ace,
                       max(o.wind_speed_kph) as peak_wind_kph
                from cyclones c
                join cyclone_observations o on o.cyclone_id = c.id
                where (:basin is null or c.basin = :basin)
                  and o.wind_speed_kph >= 62.9
                  and c.season_year is not null
                group by c.season_year, c.sub_basin
            ),
            strongest as (
                select distinct on (c.season_year, c.sub_basin)
                       c.season_year as season,
                       c.sub_basin as sub_basin,
                       c.id as storm_id,
                       c.name as storm_name,
                       c.external_id as storm_external_id
                from cyclones c
                join cyclone_observations o on o.cyclone_id = c.id
                where (:basin is null or c.basin = :basin)
                  and o.wind_speed_kph >= 62.9
                  and c.season_year is not null
                order by c.season_year, c.sub_basin, o.wind_speed_kph desc
            )
            select a.season as season,
                   a.sub_basin as subBasin,
                   a.storms as storms,
                   a.ace as ace,
                   a.peak_wind_kph as peakWindKph,
                   coalesce(s.storm_name, s.storm_external_id) as strongestStorm,
                   s.storm_id as strongestStormId
            from active a
            left join strongest s
                on s.season = a.season
               and (s.sub_basin = a.sub_basin
                    or (s.sub_basin is null and a.sub_basin is null))
            order by a.season desc, a.sub_basin
            """, nativeQuery = true)
    List<SeasonActivityRow> findSeasonActivity(@Param("basin") String basin);

    /** Projection for {@link #findSeasonActivity}. */
    interface SeasonActivityRow {
        int getSeason();

        String getSubBasin();

        long getStorms();

        double getAce();

        Double getPeakWindKph();

        String getStrongestStorm();

        UUID getStrongestStormId();
    }

    @Query("select distinct c.basin from Cyclone c where c.basin is not null order by c.basin")
    List<String> findBasins();

    @Query("select count(c) from Cyclone c")
    long countAll();
}
