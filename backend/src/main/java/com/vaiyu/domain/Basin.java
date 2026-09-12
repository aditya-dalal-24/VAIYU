package com.vaiyu.domain;

/** IBTrACS basin codes, expanded for display. */
public final class Basin {

    private Basin() {
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
