/**
 * Scoring a forecast against what the storm actually did.
 *
 * This is the "rewind and verify" arithmetic: for each forecast horizon, find
 * the reported fix nearest that time and measure the great-circle distance to
 * the predicted position. Two rules keep it honest:
 *
 *   - A horizon with no fix within the tolerance is reported as unverifiable,
 *     never scored against the closest available fix at some other time.
 *   - Position error is great-circle distance in km, not degrees: a degree of
 *     longitude is 111 km at the equator and 55 km at 60° latitude, so degree
 *     error would flatter high-latitude forecasts.
 *
 * Baselines are included because an error alone is unreadable. Persistence (the
 * storm stops) and linear extrapolation (its last motion continues) are what
 * make 150 km either good or poor.
 */

import type { AnaloguePoint, Observation, TrackPoint } from "./types";

/** A reported fix must fall this close to the forecast time to verify it. */
export const VERIFY_TOLERANCE_HOURS = 1.5;

const EARTH_RADIUS_KM = 6371;

export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface VerificationRow {
  forecastHours: number;
  forecastAt: string;
  predictedLatitude: number;
  predictedLongitude: number;
  predictedWindKph: number | null;
  /** The reported fix used to verify, or null when none is close enough. */
  actual: Observation | null;
  errorKm: number | null;
  windErrorKph: number | null;
  persistenceKm: number | null;
  linearKm: number | null;
  analogueErrorKm: number | null;
}

function nearestFix(observations: Observation[], targetIso: string): Observation | null {
  const target = new Date(targetIso).getTime();
  let best: Observation | null = null;
  let bestGap = VERIFY_TOLERANCE_HOURS * 3_600_000;
  for (const observation of observations) {
    const gap = Math.abs(new Date(observation.observedAt).getTime() - target);
    if (gap <= bestGap) {
      bestGap = gap;
      best = observation;
    }
  }
  return best;
}

/**
 * @param observations the storm's whole track, including fixes after the base
 * @param baseTime     the fix the forecast was made from
 */
export function verifyForecast(
  forecast: TrackPoint[],
  intensity: { forecastHours: number; windSpeedKph: number | null }[],
  analogue: AnaloguePoint[],
  observations: Observation[],
  baseTime: string,
): VerificationRow[] {
  const baseMs = new Date(baseTime).getTime();
  const base = observations.find((o) => o.observedAt === baseTime) ?? null;
  const future = observations.filter((o) => new Date(o.observedAt).getTime() > baseMs);

  // Linear extrapolation needs the motion over the last leg before the base.
  const priorIndex = observations.findIndex((o) => o.observedAt === baseTime) - 1;
  const prior = priorIndex >= 0 ? observations[priorIndex] : null;

  return forecast.map((point) => {
    const actual = nearestFix(future, point.forecastAt);
    const windForecast =
      intensity.find((i) => i.forecastHours === point.forecastHours)?.windSpeedKph ?? null;
    const analoguePoint = analogue.find((a) => a.forecastHours === point.forecastHours) ?? null;

    let errorKm: number | null = null;
    let persistenceKm: number | null = null;
    let linearKm: number | null = null;
    let analogueErrorKm: number | null = null;
    let windErrorKph: number | null = null;

    if (actual) {
      errorKm = greatCircleKm(actual.latitude, actual.longitude, point.latitude, point.longitude);

      if (base) {
        persistenceKm = greatCircleKm(
          actual.latitude,
          actual.longitude,
          base.latitude,
          base.longitude,
        );

        if (prior) {
          const hoursPerLeg =
            (new Date(base.observedAt).getTime() - new Date(prior.observedAt).getTime()) /
            3_600_000;
          if (hoursPerLeg > 0) {
            const scale = point.forecastHours / hoursPerLeg;
            const projectedLat = base.latitude + (base.latitude - prior.latitude) * scale;
            const projectedLon = base.longitude + (base.longitude - prior.longitude) * scale;
            linearKm = greatCircleKm(actual.latitude, actual.longitude, projectedLat, projectedLon);
          }
        }
      }

      if (analoguePoint) {
        analogueErrorKm = greatCircleKm(
          actual.latitude,
          actual.longitude,
          analoguePoint.latitude,
          analoguePoint.longitude,
        );
      }

      if (windForecast !== null && actual.windSpeedKph !== null) {
        windErrorKph = Math.abs(windForecast - actual.windSpeedKph);
      }
    }

    return {
      forecastHours: point.forecastHours,
      forecastAt: point.forecastAt,
      predictedLatitude: point.latitude,
      predictedLongitude: point.longitude,
      predictedWindKph: windForecast,
      actual,
      errorKm,
      windErrorKph,
      persistenceKm,
      linearKm,
      analogueErrorKm,
    };
  });
}

export function meanOf(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return present.reduce((total, value) => total + value, 0) / present.length;
}
