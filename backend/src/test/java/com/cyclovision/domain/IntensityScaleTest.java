package com.cyclovision.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Categorising a measured wind.
 *
 * <p>The thresholds are Saffir-Simpson, which is defined for 1-minute
 * sustained winds -- the definition of the IBTrACS column this data uses.
 * Applying IMD's 3-minute labels to the same numbers would read as more
 * authoritative while being wrong, so the scale is named rather than assumed.
 */
class IntensityScaleTest {

    @ParameterizedTest
    @CsvSource({
            "30, Tropical Depression",
            "62, Tropical Depression",
            "63, Tropical Storm",
            "118, Tropical Storm",
            "119, Category 1",
            "153, Category 1",
            "154, Category 2",
            "178, Category 3",
            "209, Category 4",
            "252, Category 5",
            "343, Category 5",
    })
    @DisplayName("boundaries follow the 1-minute sustained scale")
    void categorises(double windKph, String expected) {
        assertThat(IntensityScale.labelOf(windKph)).isEqualTo(expected);
    }

    @Test
    @DisplayName("an absent wind has no category, rather than the lowest one")
    void absentWindHasNoCategory() {
        assertThat(IntensityScale.of(null)).isNull();
        assertThat(IntensityScale.labelOf(null)).isNull();
        assertThat(IntensityScale.rankOf(null)).isNull();
    }

    @Test
    @DisplayName("ranks increase with intensity, for ordered colouring")
    void ranksAreOrdered() {
        assertThat(IntensityScale.rankOf(40.0)).isEqualTo(0);
        assertThat(IntensityScale.rankOf(90.0)).isEqualTo(1);
        assertThat(IntensityScale.rankOf(300.0)).isEqualTo(6);
    }

    @Test
    @DisplayName("the scale is named in the API so a client need not guess")
    void scaleIsNamed() {
        assertThat(IntensityScale.SCALE_NAME).contains("1-minute");
    }
}
