package com.vaiyu.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The storm signature, which is arithmetic on measurements and must therefore
 * be exactly right or absent.
 *
 * <p>The cases here are the ones where a plausible implementation quietly lies:
 * a gap in the track read as an intensification rate, a date-line crossing read
 * as a 39,000 km leg, and a missing wind read as a zero.
 */
class StormSignatureTest {

    private static final Instant T0 = Instant.parse("2020-05-01T00:00:00Z");

    private static StormSignature.Fix fix(int hours, double lat, double lon,
                                          Double wind, Double pressure) {
        return new StormSignature.Fix(T0.plus(Duration.ofHours(hours)), lat, lon, wind, pressure);
    }

    @Test
    @DisplayName("a storm with no fixes has a signature of nothing, and says so")
    void emptyTrack() {
        StormSignature.Result result = StormSignature.of(List.of());

        assertThat(result.fixCount()).isZero();
        assertThat(result.lifetimeHours()).isNull();
        assertThat(result.peakWindKph()).isNull();
        assertThat(result.limitations()).isNotEmpty();
    }

    @Test
    @DisplayName("a single fix yields no lifetime, track length or speed")
    void singleFix() {
        StormSignature.Result result = StormSignature.of(List.of(fix(0, 12.0, 88.0, 65.0, 998.0)));

        assertThat(result.fixCount()).isEqualTo(1);
        assertThat(result.peakWindKph()).isEqualTo(65.0);
        assertThat(result.lifetimeHours()).isNull();
        assertThat(result.trackLengthKm()).isNull();
        assertThat(result.meanTranslationKph()).isNull();
        assertThat(result.limitations())
                .anySatisfy(note -> assertThat(note).contains("single fix"));
    }

    @Test
    @DisplayName("an absent wind is absent, not zero")
    void missingWindIsNotZero() {
        StormSignature.Result result = StormSignature.of(List.of(
                fix(0, 10.0, 90.0, null, null),
                fix(6, 11.0, 90.0, null, null)));

        assertThat(result.peakWindKph()).isNull();
        assertThat(result.minPressureHpa()).isNull();
        assertThat(result.maxIntensification24hKph()).isNull();
        assertThat(result.rapidIntensification()).isFalse();
        assertThat(result.limitations())
                .anySatisfy(note -> assertThat(note).contains("wind speed"));
    }

    @Test
    @DisplayName("the 24-hour change uses a real 24-hour window, not four fixes")
    void gapIsNotReadAsARate() {
        // Fixes at 0 and 48 hours only. Counting "the next fix" as +24h would
        // report a 48-hour gain of 80 kph as a 24-hour rate.
        StormSignature.Result gappy = StormSignature.of(List.of(
                fix(0, 10.0, 90.0, 60.0, 1000.0),
                fix(48, 14.0, 88.0, 140.0, 960.0)));

        assertThat(gappy.maxIntensification24hKph()).isNull();
        assertThat(gappy.rapidIntensification()).isFalse();

        StormSignature.Result contiguous = StormSignature.of(List.of(
                fix(0, 10.0, 90.0, 60.0, 1000.0),
                fix(24, 12.0, 89.0, 140.0, 960.0)));

        assertThat(contiguous.maxIntensification24hKph()).isEqualTo(80.0);
        assertThat(contiguous.rapidIntensification()).isTrue();
    }

    @Test
    @DisplayName("rapid intensification is the 30 kt threshold, not a rounder number")
    void rapidIntensificationThreshold() {
        double justUnder = StormSignature.RAPID_INTENSIFICATION_KPH_24H - 0.2;
        StormSignature.Result under = StormSignature.of(List.of(
                fix(0, 10.0, 90.0, 60.0, null),
                fix(24, 11.0, 90.0, 60.0 + justUnder, null)));
        assertThat(under.rapidIntensification()).isFalse();

        StormSignature.Result over = StormSignature.of(List.of(
                fix(0, 10.0, 90.0, 60.0, null),
                fix(24, 11.0, 90.0, 60.0 + StormSignature.RAPID_INTENSIFICATION_KPH_24H, null)));
        assertThat(over.rapidIntensification()).isTrue();
    }

    @Test
    @DisplayName("crossing the date line is a short leg, not a trip round the world")
    void antimeridian() {
        StormSignature.Result result = StormSignature.of(List.of(
                fix(0, 15.0, 179.0, 90.0, null),
                fix(6, 15.0, -179.0, 95.0, null)));

        // Two degrees of longitude at 15°N is about 215 km.
        assertThat(result.trackLengthKm()).isBetween(200.0, 230.0);
        assertThat(result.maxTranslationKph()).isLessThan(60.0);
    }

    @Test
    @DisplayName("a straight track has sinuosity 1, a curved one more")
    void sinuosity() {
        StormSignature.Result straight = StormSignature.of(List.of(
                fix(0, 10.0, 90.0, 80.0, null),
                fix(6, 12.0, 90.0, 80.0, null),
                fix(12, 14.0, 90.0, 80.0, null)));
        assertThat(straight.sinuosity()).isCloseTo(1.0, org.assertj.core.data.Offset.offset(0.02));

        StormSignature.Result hooked = StormSignature.of(List.of(
                fix(0, 10.0, 90.0, 80.0, null),
                fix(6, 14.0, 90.0, 80.0, null),
                fix(12, 10.5, 90.0, 80.0, null)));
        assertThat(hooked.sinuosity()).isGreaterThan(2.0);
    }

    @Test
    @DisplayName("a storm that ends where it began reports no sinuosity rather than infinity")
    void loopingTrack() {
        StormSignature.Result result = StormSignature.of(List.of(
                fix(0, 10.0, 90.0, 80.0, null),
                fix(6, 12.0, 90.0, 80.0, null),
                fix(12, 10.0, 90.0, 80.0, null)));

        assertThat(result.trackLengthKm()).isGreaterThan(400.0);
        assertThat(result.sinuosity()).isNull();
        assertThat(result.limitations())
                .anySatisfy(note -> assertThat(note).contains("ended where it started"));
    }

    @Test
    @DisplayName("time at hurricane force counts only intervals both ends of which report it")
    void hurricaneForceHours() {
        StormSignature.Result result = StormSignature.of(List.of(
                fix(0, 10.0, 90.0, 100.0, null),    // below
                fix(6, 11.0, 90.0, 130.0, null),    // above
                fix(12, 12.0, 90.0, 150.0, null),   // above  -> 6 hours credited
                fix(18, 13.0, 90.0, 110.0, null))); // below

        assertThat(StormSignature.HURRICANE_FORCE_KPH).isEqualTo(119.0);
        assertThat(result.hoursAtHurricaneForce()).isEqualTo(6.0);
    }

    @Test
    @DisplayName("the peak is located in space and in time")
    void peakPlacement() {
        StormSignature.Result result = StormSignature.of(List.of(
                fix(0, 10.0, 90.0, 60.0, 1000.0),
                fix(24, 18.0, 88.0, 200.0, 950.0),
                fix(48, 26.0, 86.0, 80.0, 990.0)));

        assertThat(result.peakWindKph()).isEqualTo(200.0);
        assertThat(result.peakLatitude()).isEqualTo(18.0);
        assertThat(result.minPressureHpa()).isEqualTo(950.0);
        assertThat(result.timeToPeakFraction()).isEqualTo(0.5);
        assertThat(result.polewardDegrees()).isEqualTo(16.0);
        assertThat(result.traits()).contains("Peaked at Category 3");
    }

    @Test
    @DisplayName("poleward travel is measured away from the equator in both hemispheres")
    void southernHemisphere() {
        StormSignature.Result result = StormSignature.of(List.of(
                fix(0, -12.0, 60.0, 90.0, null),
                fix(24, -22.0, 62.0, 90.0, null)));

        assertThat(result.polewardDegrees()).isEqualTo(10.0);
    }

    @Test
    @DisplayName("a long real track produces every trait without exploding")
    void longTrack() {
        List<StormSignature.Fix> fixes = new ArrayList<>();
        for (int i = 0; i < 60; i++) {
            fixes.add(fix(i * 6, 8.0 + i * 0.3, 92.0 - i * 0.2, 50.0 + i, 1005.0 - i));
        }

        StormSignature.Result result = StormSignature.of(fixes);

        assertThat(result.fixCount()).isEqualTo(60);
        assertThat(result.lifetimeHours()).isEqualTo(354.0);
        assertThat(result.trackLengthKm()).isGreaterThan(2000.0);
        assertThat(result.meanTranslationKph()).isGreaterThan(0.0);
        assertThat(result.maxIntensification24hKph()).isEqualTo(4.0);
        assertThat(result.limitations()).isEmpty();
        assertThat(result.traits()).contains("Long lived", "Peaked late in its life");
    }
}
