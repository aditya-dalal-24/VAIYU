package com.vaiyu.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Basin and sub-basin naming.
 *
 * <p>The sub-basin is the one piece of geography this archive carries that
 * readers on the Indian subcontinent care about most: IBTrACS files the Arabian
 * Sea and the Bay of Bengal under the single basin code NI, but they are seas
 * on opposite sides of the peninsula and a storm in one is no threat to the
 * coast of the other.
 */
class BasinTest {

    @ParameterizedTest
    @CsvSource({
            "AS, Arabian Sea",
            "BB, Bay of Bengal",
            "as, Arabian Sea",
            "bb, Bay of Bengal",
            "CS, Caribbean Sea",
            "GM, Gulf of Mexico",
    })
    @DisplayName("sub-basin codes are expanded for a reader")
    void namesSubBasins(String code, String expected) {
        assertThat(Basin.subBasinNameOf(code)).isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MM", "mm", "  "})
    @DisplayName("a sub-basin IBTrACS does not state has no name, rather than a plausible one")
    void unstatedSubBasinIsNull(String code) {
        assertThat(Basin.subBasinNameOf(code)).isNull();
    }

    @Test
    @DisplayName("a null sub-basin stays null")
    void nullSubBasin() {
        assertThat(Basin.subBasinNameOf(null)).isNull();
    }

    @Test
    @DisplayName("an unrecognised code is passed through rather than dropped or renamed")
    void unknownCodeSurvives() {
        // Better to show a reader the archive's own code than to invent a sea
        // or silently hide the storm's origin.
        assertThat(Basin.subBasinNameOf("ZZ")).isEqualTo("ZZ");
    }

    @ParameterizedTest
    @CsvSource({
            "NI, North Indian Ocean",
            "SI, South Indian Ocean",
            "NA, North Atlantic",
            "WP, West Pacific",
    })
    @DisplayName("basin codes are expanded for a reader")
    void namesBasins(String code, String expected) {
        assertThat(Basin.nameOf(code)).isEqualTo(expected);
    }
}
