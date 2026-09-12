package com.cyclovision.domain;

/**
 * Wind-speed categories for a measured wind.
 *
 * <p>The scale matters and is therefore named in the API. Every wind in this
 * system comes from IBTrACS {@code USA_WIND}, which is a <em>1-minute</em>
 * sustained wind, so the Saffir-Simpson thresholds apply. The India
 * Meteorological Department's familiar labels ("Very Severe Cyclonic Storm")
 * are defined for 3-minute sustained winds; there is no fixed factor between
 * the two averaging periods, so applying IMD labels to this data would look
 * more authoritative while being wrong. Categorising is a deterministic
 * function of a real measurement, not an estimate.
 */
public enum IntensityScale {

    TROPICAL_DEPRESSION("Tropical Depression", 0, 63),
    TROPICAL_STORM("Tropical Storm", 63, 119),
    CATEGORY_1("Category 1", 119, 154),
    CATEGORY_2("Category 2", 154, 178),
    CATEGORY_3("Category 3", 178, 209),
    CATEGORY_4("Category 4", 209, 252),
    CATEGORY_5("Category 5", 252, Integer.MAX_VALUE);

    /** Named in responses so a client never has to guess the convention. */
    public static final String SCALE_NAME = "Saffir-Simpson (1-minute sustained wind)";

    private final String label;
    private final double lowerKph;
    private final double upperKph;

    IntensityScale(String label, double lowerKph, double upperKph) {
        this.label = label;
        this.lowerKph = lowerKph;
        this.upperKph = upperKph;
    }

    public String label() {
        return label;
    }

    public double lowerKph() {
        return lowerKph;
    }

    /** Null in, null out: an absent wind has no category. */
    public static IntensityScale of(Double windKph) {
        if (windKph == null || windKph < 0) {
            return null;
        }
        for (IntensityScale scale : values()) {
            if (windKph < scale.upperKph) {
                return scale;
            }
        }
        return CATEGORY_5;
    }

    public static String labelOf(Double windKph) {
        IntensityScale scale = of(windKph);
        return scale == null ? null : scale.label();
    }

    /** Rank for colouring and comparison; null when there is no wind. */
    public static Integer rankOf(Double windKph) {
        IntensityScale scale = of(windKph);
        return scale == null ? null : scale.ordinal();
    }
}
