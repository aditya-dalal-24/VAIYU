package com.vaiyu.ai;

import com.vaiyu.ai.dto.AiAnalysisRequest;
import com.vaiyu.entity.CycloneObservation;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The rules that keep model input matching model training.
 *
 * <p>These are the tests that matter most in the backend. If the request
 * factory sends the wrong fixes, every forecast downstream is quietly wrong
 * while looking perfectly healthy.
 */
class AiRequestFactoryTest {

    private final AiRequestFactory factory = new AiRequestFactory();
    private static final UUID CYCLONE = UUID.randomUUID();
    private static final List<String> ANALYSES = List.of(AiAnalysisRequest.TRAJECTORY);

    @Test
    @DisplayName("interpolated three-hourly rows are excluded")
    void dropsInterpolatedRows() {
        // IBTrACS resamples tracks to three-hourly; only 00/06/12/18Z are
        // reported. A 03Z row is interpolated from the 06Z fix, so using one as
        // a forecast base would leak hours of the future into the forecast.
        List<CycloneObservation> track = new ArrayList<>();
        track.add(fix("2023-05-12T00:00:00Z", 12.0, 88.0, 100.0, 990.0));
        track.add(fix("2023-05-12T03:00:00Z", 12.3, 88.1, 105.0, 988.0));
        track.add(fix("2023-05-12T06:00:00Z", 12.6, 88.2, 110.0, 986.0));
        track.add(fix("2023-05-12T09:00:00Z", 12.9, 88.3, 115.0, 984.0));
        track.add(fix("2023-05-12T12:00:00Z", 13.2, 88.4, 120.0, 982.0));

        AiRequestFactory.Plan plan = factory.build(CYCLONE, track, null, ANALYSES, null);

        assertThat(plan.observations()).hasSize(3);
        assertThat(plan.observations())
                .allSatisfy(observation ->
                        assertThat(observation.getObservedAt().toString()).matches(".*T(00|06|12|18):00:00Z"));
        assertThat(plan.notes())
                .anySatisfy(note -> assertThat(note).contains("interpolated"));
    }

    @Test
    @DisplayName("fixes after the base time never reach the model")
    void excludesTheFuture() {
        List<CycloneObservation> track = synopticTrack(8);
        Instant base = Instant.parse("2023-05-12T18:00:00Z");

        AiRequestFactory.Plan plan = factory.build(CYCLONE, track, base, ANALYSES, null);

        assertThat(plan.baseTime()).isEqualTo(base);
        assertThat(plan.observations())
                .allSatisfy(observation ->
                        assertThat(observation.getObservedAt()).isBeforeOrEqualTo(base));
        assertThat(plan.request().currentObservation().timestamp()).isEqualTo(base);
    }

    @Test
    @DisplayName("history is ordered oldest to newest, with the base last")
    void ordersHistory() {
        List<CycloneObservation> shuffled = new ArrayList<>(synopticTrack(5));
        java.util.Collections.reverse(shuffled);

        AiRequestFactory.Plan plan = factory.build(CYCLONE, shuffled, null, ANALYSES, null);

        List<Instant> history = plan.request().observationHistory().stream()
                .map(AiAnalysisRequest.Observation::timestamp)
                .toList();
        assertThat(history).isSorted();
        assertThat(plan.request().currentObservation().timestamp())
                .isAfter(history.get(history.size() - 1));
    }

    @Test
    @DisplayName("too few reported fixes is refused with a count, not sent")
    void refusesShortTracks() {
        List<CycloneObservation> track = synopticTrack(2);

        assertThatThrownBy(() -> factory.build(CYCLONE, track, null, ANALYSES, null))
                .isInstanceOf(AiRequestFactory.InsufficientObservationsException.class)
                .hasMessageContaining("2 reported synoptic")
                .satisfies(thrown -> assertThat(
                        ((AiRequestFactory.InsufficientObservationsException) thrown).usable())
                        .isEqualTo(2));
    }

    @Test
    @DisplayName("fixes without wind are dropped, because training had none")
    void dropsFixesWithoutWind() {
        List<CycloneObservation> track = new ArrayList<>(synopticTrack(4));
        track.get(1).setWindSpeedKph(null);

        AiRequestFactory.Plan plan = factory.build(CYCLONE, track, null, ANALYSES, null);

        assertThat(plan.observations()).hasSize(3);
        assertThat(plan.observations())
                .allSatisfy(observation -> assertThat(observation.getWindSpeedKph()).isNotNull());
    }

    @Test
    @DisplayName("a base fix without pressure is flagged, not rejected")
    void notesMissingPressure() {
        List<CycloneObservation> track = new ArrayList<>(synopticTrack(4));
        track.get(track.size() - 1).setPressureHpa(null);

        AiRequestFactory.Plan plan = factory.build(CYCLONE, track, null, ANALYSES, null);

        assertThat(plan.request().currentObservation().pressureHpa()).isNull();
        assertThat(plan.notes())
                .anySatisfy(note -> assertThat(note).contains("no pressure"));
    }

    @Test
    @DisplayName("at most twelve fixes are sent")
    void capsWindow() {
        AiRequestFactory.Plan plan =
                factory.build(CYCLONE, synopticTrack(30), null, ANALYSES, null);

        assertThat(plan.observations()).hasSize(AiRequestFactory.MAX_OBSERVATIONS);
        // The window keeps the most recent fixes: the newest must survive.
        assertThat(plan.baseTime())
                .isEqualTo(Instant.parse("2023-05-12T00:00:00Z").plusSeconds(29 * 6 * 3600L));
    }

    @Test
    @DisplayName("no environmental data is invented")
    void sendsNoEnvironmentalData() {
        AiRequestFactory.Plan plan =
                factory.build(CYCLONE, synopticTrack(4), null, ANALYSES, null);

        // No weather data has been joined to these tracks. Sending a plausible
        // sea-surface temperature would be fabricated input.
        assertThat(plan.request().environmentalData()).isNull();
    }

    private static List<CycloneObservation> synopticTrack(int count) {
        List<CycloneObservation> track = new ArrayList<>();
        Instant start = Instant.parse("2023-05-12T00:00:00Z");
        for (int index = 0; index < count; index++) {
            track.add(fix(
                    start.plusSeconds(index * 6 * 3600L).toString(),
                    12.0 + index * 0.3,
                    88.0 + index * 0.2,
                    100.0 + index * 5,
                    990.0 - index * 2));
        }
        return track;
    }

    private static CycloneObservation fix(
            String time, double lat, double lon, Double wind, Double pressure) {
        CycloneObservation observation = new CycloneObservation();
        setId(observation, UUID.randomUUID());
        observation.setObservedAt(Instant.parse(time));
        observation.setLatitude(lat);
        observation.setLongitude(lon);
        observation.setWindSpeedKph(wind);
        observation.setPressureHpa(pressure);
        return observation;
    }

    /** The id is database-generated, so tests set it directly. */
    private static void setId(CycloneObservation observation, UUID id) {
        try {
            Field field = CycloneObservation.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(observation, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
