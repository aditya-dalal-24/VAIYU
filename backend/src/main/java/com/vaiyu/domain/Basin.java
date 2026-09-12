package com.vaiyu.domain;

/** IBTrACS basin and sub-basin codes, expanded for display. */
public final class Basin {

    private Basin() {
    }

    /**
     * The sub-basin a storm formed in, expanded for display.
     *
     * <p>The two that matter most to readers on the Indian subcontinent are
     * the Arabian Sea and the Bay of Bengal: IBTrACS files both under the
     * single basin code NI, but they are different seas on either side of the
     * peninsula, and a storm in one is no threat to the coastline of the
     * other. IBTrACS uses MM for "missing", which is reported as no sub-basin
     * rather than guessed at.
     */
    public static String subBasinNameOf(String code) {
        if (code == null || code.isBlank() || code.equalsIgnoreCase("MM")) {
            return null;
        }
        return switch (code.toUpperCase()) {
            case "AS" -> "Arabian Sea";
            case "BB" -> "Bay of Bengal";
            case "CS" -> "Caribbean Sea";
            case "GM" -> "Gulf of Mexico";
            case "CP" -> "Central Pacific";
            case "EA" -> "Eastern Australia";
            case "WA" -> "Western Australia";
            case "NA" -> "North Atlantic";
            case "SA" -> "South Atlantic";
            case "SI" -> "South Indian Ocean";
            case "SP" -> "South Pacific";
            case "EP" -> "East Pacific";
            case "WP" -> "West Pacific";
            default -> code;
        };
    }

    public static String nameOf(String code) {
        if (code == null) {
            return null;
        }
        return switch (code.toUpperCase()) {
            case "NI" -> "North Indian Ocean";
            case "SI" -> "South Indian Ocean";
            case "NA" -> "North Atlantic";
            case "SA" -> "South Atlantic";
            case "EP" -> "East Pacific";
            case "WP" -> "West Pacific";
            case "SP" -> "South Pacific";
            default -> code;
        };
    }
}
