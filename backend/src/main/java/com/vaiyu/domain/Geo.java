package com.vaiyu.domain;

/**
 * Distance on the sphere.
 *
 * <p>Tracks are compared by great-circle distance rather than by differences in
 * degrees, because a degree of longitude is 111 km at the equator and 48 km at
 * 65°N — measuring a recurving storm in degrees would make the poleward half of
 * its track look slower than it was. The mean Earth radius is used; the
 * ellipsoidal correction is far below the resolution of a best-track position,
 * which is reported to a tenth of a degree.
 */
public final class Geo {

    /** IUGG mean Earth radius, in kilometres. */
    public static final double EARTH_RADIUS_KM = 6371.0088;

    private Geo() {
    }

    /**
     * Great-circle distance in kilometres.
     *
     * <p>Uses the haversine form, which stays numerically stable for the small
     * separations between consecutive six-hourly fixes, where the spherical law
     * of cosines loses precision.
     */
    public static double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double deltaPhi = phi2 - phi1;
        double deltaLambda = Math.toRadians(normaliseLongitudeDelta(lon2 - lon1));

        double sinPhi = Math.sin(deltaPhi / 2);
        double sinLambda = Math.sin(deltaLambda / 2);
        double a = sinPhi * sinPhi + Math.cos(phi1) * Math.cos(phi2) * sinLambda * sinLambda;
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1.0, Math.sqrt(a)));
    }

    /**
     * Shortest signed longitude difference, in degrees.
     *
     * <p>A storm crossing the antimeridian goes from +179 to -179, which is a
     * two-degree step east and not a 358-degree step west. Without this, every
     * west Pacific track that crosses the date line reports a single
     * 39,000 km jump.
     */
    public static double normaliseLongitudeDelta(double degrees) {
        double delta = degrees % 360.0;
        if (delta > 180.0) {
            delta -= 360.0;
        } else if (delta < -180.0) {
            delta += 360.0;
        }
        return delta;
    }
}
