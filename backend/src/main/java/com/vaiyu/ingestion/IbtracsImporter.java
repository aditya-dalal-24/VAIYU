package com.vaiyu.ingestion;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Loads real best-track observations into PostgreSQL.
 *
 * <p><strong>Source.</strong> The observation table produced by the AI
 * service's {@code training/prepare_ibtracs.py} from NOAA IBTrACS v04r01. That
 * file is used rather than any other IBTrACS export for three reasons, and the
 * choice is not arbitrary:
 * <ul>
 *   <li><em>Wind definition.</em> It takes wind from {@code USA_WIND} alone.
 *       IBTrACS pools agencies that report 1-, 3- and 10-minute sustained
 *       winds, so a column mixing them would bake in a bias that never shows up
 *       as an error. Everything here is therefore 1-minute sustained,
 *       converted to km/h.</li>
 *   <li><em>Reported fixes only.</em> IBTrACS resamples tracks to three-hourly,
 *       and the in-between rows are interpolated from the following fix. The
 *       file keeps 00/06/12/18Z only, so what is stored is what was observed,
 *       and a forecast made from any stored fix cannot have been contaminated
 *       by a later one.</li>
 *   <li><em>It is the table the models were trained on.</em> Inference input
 *       therefore matches training by construction rather than by hope.</li>
 * </ul>
 *
 * <p><strong>Status is deliberately never "ACTIVE".</strong> This is a
 * best-track archive with no live feed attached, so claiming a storm is active
 * would be a claim the data cannot support. Storms are {@code ARCHIVED}, or
 * {@code RECENT} when their last fix is within a week of the newest fix in the
 * dataset.
 *
 * <p>Idempotent: re-running inserts only what is missing, using the schema's
 * own unique constraints.
 */
@Component
public class IbtracsImporter {

    private static final Logger log = LoggerFactory.getLogger(IbtracsImporter.class);

    public static final String SOURCE = "IBTrACS";
    /** Recorded on every row so the wind definition travels with the data. */
    public static final String OBSERVATION_SOURCE = "IBTrACS_v04r01_USA_1MIN";

    private static final int BATCH = 1_000;
    private static final Duration RECENT_WINDOW = Duration.ofDays(7);

    private final JdbcTemplate jdbc;
    private final String defaultPath;

    public IbtracsImporter(
            JdbcTemplate jdbc,
            @Value("${vaiyu.ingest.observations-path:../ai-service/data/processed/observations.csv}")
            String defaultPath) {
        this.jdbc = jdbc;
        this.defaultPath = defaultPath;
    }

    /**
     * @param sourceFile        the file read
     * @param storms            storms present in the file
     * @param stormsInserted    storms new to the database
     * @param observations      observation rows read
     * @param observationsInserted rows new to the database
     * @param malformedRows     rows skipped because a required field was unusable
     * @param latestObservation newest fix in the file
     */
    public record Summary(
            String sourceFile,
            int storms,
            int stormsInserted,
            int observations,
            int observationsInserted,
            int malformedRows,
            Instant latestObservation,
            long durationMs
    ) {
    }

    public String defaultPath() {
        return defaultPath;
    }

    public boolean sourceAvailable() {
        return Files.isReadable(Path.of(defaultPath));
    }

    @Transactional
    public Summary importFrom(String pathOrNull) {
        long started = System.currentTimeMillis();
        Path path = Path.of(pathOrNull == null || pathOrNull.isBlank() ? defaultPath : pathOrNull);
        if (!Files.isReadable(path)) {
            throw new IllegalStateException(
                    "Observation table not readable at " + path.toAbsolutePath()
                            + ". Generate it with the AI service's "
                            + "training/prepare_ibtracs.py, or set "
                            + "vaiyu.ingest.observations-path.");
        }

        List<Row> rows = read(path);
        if (rows.isEmpty()) {
            throw new IllegalStateException("No usable observations found in " + path);
        }

        int malformed = malformedCount;
        Instant latest = rows.stream().map(Row::observedAt).max(Instant::compareTo).orElseThrow();

        // 1. Storms. One row per storm, carrying the name, basin and season.
        Map<String, Row> firstByStorm = new HashMap<>();
        Map<String, Instant> lastFixByStorm = new HashMap<>();
        for (Row row : rows) {
            firstByStorm.putIfAbsent(row.stormId(), row);
            lastFixByStorm.merge(row.stormId(), row.observedAt(),
                    (a, b) -> a.isAfter(b) ? a : b);
        }

        int stormsBefore = count("cyclones");
        List<Object[]> stormBatch = new ArrayList<>(firstByStorm.size());
        for (Row row : firstByStorm.values()) {
            Instant lastFix = lastFixByStorm.get(row.stormId());
            String status = latest.minus(RECENT_WINDOW).isAfter(lastFix) ? "ARCHIVED" : "RECENT";
            // `row` here is the storm's genesis fix, so both the basin and
            // the sub-basin describe where it formed.
            stormBatch.add(new Object[]{
                    SOURCE, row.stormId(), displayName(row.stormName()),
                    row.basin(), subBasinOrNull(row.subBasin()), status, row.season()
            });
        }
        jdbc.batchUpdate("""
                INSERT INTO cyclones
                    (external_source, external_id, name, basin, sub_basin, status, season_year)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                -- The schema's unique index on these columns is partial
                -- (both must be non-null), so the predicate is repeated here:
                -- Postgres can only infer a partial index when it matches.
                ON CONFLICT (external_source, external_id)
                    WHERE external_source IS NOT NULL AND external_id IS NOT NULL
                DO UPDATE
                    SET name = EXCLUDED.name,
                        basin = EXCLUDED.basin,
                        sub_basin = EXCLUDED.sub_basin,
                        status = EXCLUDED.status,
                        season_year = EXCLUDED.season_year,
                        updated_at = now()
                """, stormBatch);
        int stormsAfter = count("cyclones");

        // 2. Observations, keyed to their storm by external id.
        Map<String, java.util.UUID> idByExternal = new HashMap<>();
        jdbc.query("SELECT external_id, id FROM cyclones WHERE external_source = ?",
                rs -> {
                    idByExternal.put(rs.getString(1), rs.getObject(2, java.util.UUID.class));
                }, SOURCE);

        int observationsBefore = count("cyclone_observations");
        List<Object[]> batch = new ArrayList<>(BATCH);
        int written = 0;
        for (Row row : rows) {
            java.util.UUID cycloneId = idByExternal.get(row.stormId());
            if (cycloneId == null) {
                continue;
            }
            batch.add(new Object[]{
                    cycloneId,
                    java.sql.Timestamp.from(row.observedAt()),
                    row.latitude(), row.longitude(),
                    row.windSpeedKph(), row.pressureHpa(),
                    OBSERVATION_SOURCE,
                    row.stormId() + "@" + row.observedAt()
            });
            if (batch.size() >= BATCH) {
                written += flush(batch);
            }
        }
        written += flush(batch);
        int observationsAfter = count("cyclone_observations");

        long elapsed = System.currentTimeMillis() - started;
        Summary summary = new Summary(
                path.toString(),
                firstByStorm.size(), stormsAfter - stormsBefore,
                rows.size(), observationsAfter - observationsBefore,
                malformed, latest, elapsed);
        log.info("IBTrACS import: {} storms ({} new), {} observations ({} new), {} malformed, {} ms",
                summary.storms(), summary.stormsInserted(), summary.observations(),
                summary.observationsInserted(), summary.malformedRows(), elapsed);
        return summary;
    }

    private int flush(List<Object[]> batch) {
        if (batch.isEmpty()) {
            return 0;
        }
        jdbc.batchUpdate("""
                INSERT INTO cyclone_observations
                    (cyclone_id, observed_at, latitude, longitude,
                     wind_speed_kph, pressure_hpa, source, source_record_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (cyclone_id, observed_at, source) DO NOTHING
                """, batch);
        int size = batch.size();
        batch.clear();
        return size;
    }

    private int count(String table) {
        Integer value = jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
        return value == null ? 0 : value;
    }

    /**
     * A sub-basin code, or null when IBTrACS does not state one.
     *
     * <p>IBTrACS writes MM for "missing". Stored as null so the interface can
     * say nothing rather than showing a reader a sea the archive never named.
     */
    private static String subBasinOrNull(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty() || trimmed.equalsIgnoreCase("MM")
                || trimmed.equalsIgnoreCase("NAN")) {
            return null;
        }
        return trimmed.toUpperCase();
    }

    /**
     * IBTrACS writes unnamed storms as NOT_NAMED or UNNAMED. Keeping that as a
     * display name would put "NOT_NAMED" in the interface, so it becomes null
     * and the UI falls back to the storm id.
     */
    private static String displayName(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()
                || trimmed.equalsIgnoreCase("NOT_NAMED")
                || trimmed.equalsIgnoreCase("UNNAMED")
                || trimmed.equalsIgnoreCase("NAN")) {
            return null;
        }
        return trimmed;
    }

    private int malformedCount;

    private record Row(
            String stormId, Instant observedAt, double latitude, double longitude,
            Double windSpeedKph, Double pressureHpa, Integer season, String basin,
            String subBasin, String stormName
    ) {
    }

    private List<Row> read(Path path) {
        malformedCount = 0;
        List<Row> rows = new ArrayList<>(100_000);
        try (BufferedReader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            String header = reader.readLine();
            if (header == null) {
                return rows;
            }
            Map<String, Integer> column = new HashMap<>();
            String[] names = header.split(",");
            for (int i = 0; i < names.length; i++) {
                column.put(names[i].trim().toLowerCase(), i);
            }
            for (String required : List.of("cyclone_id", "timestamp", "latitude", "longitude")) {
                if (!column.containsKey(required)) {
                    throw new IllegalStateException(
                            "Observation table is missing the '" + required + "' column");
                }
            }

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                String[] parts = line.split(",", -1);
                try {
                    Instant observedAt = LocalDateTime
                            .parse(parts[column.get("timestamp")].trim().replace(' ', 'T'))
                            .toInstant(ZoneOffset.UTC);
                    rows.add(new Row(
                            parts[column.get("cyclone_id")].trim(),
                            observedAt,
                            Double.parseDouble(parts[column.get("latitude")]),
                            Double.parseDouble(parts[column.get("longitude")]),
                            optionalDouble(parts, column.get("wind_speed_kph")),
                            optionalDouble(parts, column.get("pressure_hpa")),
                            optionalInt(parts, column.get("season")),
                            optionalString(parts, column.get("basin")),
                            // Older tables have no sub_basin column at all;
                            // that reads as "not stated", not as an error.
                            optionalString(parts, column.get("sub_basin")),
                            optionalString(parts, column.get("storm_name"))
                    ));
                } catch (RuntimeException e) {
                    // A row missing a position or carrying an unparseable
                    // timestamp is dropped and counted, never defaulted: an
                    // invented coordinate is indistinguishable downstream from
                    // a measured one.
                    malformedCount++;
                }
            }
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Could not read " + path + ": " + e.getMessage(), e);
        }
        return rows;
    }

    private static Double optionalDouble(String[] parts, Integer index) {
        if (index == null || index >= parts.length) {
            return null;
        }
        String value = parts[index].trim();
        if (value.isEmpty()) {
            return null;
        }
        try {
            return Double.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer optionalInt(String[] parts, Integer index) {
        Double value = optionalDouble(parts, index);
        return value == null ? null : value.intValue();
    }

    private static String optionalString(String[] parts, Integer index) {
        if (index == null || index >= parts.length) {
            return null;
        }
        String value = parts[index].trim();
        return value.isEmpty() ? null : value;
    }
}
