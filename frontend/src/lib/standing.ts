/**
 * How the analogue ensemble's forecast stands against the alternatives.
 *
 * Computed from the evaluations the checkpoints recorded, never written as a
 * fixed sentence: a retrain can move these numbers, and a claim like "less
 * accurate than a straight line" has to move with them or it becomes the kind
 * of confident, stale statement this interface exists to avoid.
 */

import type { HorizonEvaluation, SystemStatus } from "./types";

export interface HorizonStanding {
  hours: number;
  /** Positive: the analogue forecast beats straight-line extrapolation. */
  vsLinearPct: number;
  /** True when the neural track model is more accurate at this horizon. */
  modelIsBetter: boolean | null;
}

export interface AnalogueStanding {
  horizons: HorizonStanding[];
  /** Weakest correlation between member spread and actual error, if recorded. */
  spreadErrorCorrelation: number | null;
}

function byHours(rows: HorizonEvaluation[] | null | undefined) {
  return new Map((rows ?? []).map((row) => [row.hours, row]));
}

export function analogueStanding(status: SystemStatus | undefined): AnalogueStanding | null {
  const analogue = status?.ai.models?.["similarity"]?.evaluation;
  if (!analogue || analogue.length === 0) return null;
  const model = byHours(status?.ai.models?.["trajectory"]?.evaluation);

  const horizons = analogue.map((row) => {
    const track = model.get(row.hours);
    return {
      hours: row.hours,
      vsLinearPct: (100 * (row.linearBaselineKm - row.meanErrorKm)) / row.linearBaselineKm,
      modelIsBetter: track ? track.meanErrorKm < row.meanErrorKm : null,
    };
  });

  const correlations = analogue
    .map((row) => row.spreadErrorCorrelation)
    .filter((value): value is number => value !== null && value !== undefined);

  return {
    horizons,
    spreadErrorCorrelation: correlations.length ? Math.min(...correlations) : null,
  };
}

/** "4% worse" / "2% better", rounded to what the evaluation can support. */
export function describeMargin(pct: number): string {
  const rounded = Math.round(Math.abs(pct));
  if (rounded === 0) return "level";
  return `${rounded}% ${pct > 0 ? "better" : "worse"}`;
}

/** True when the neural model beats the analogues at every recorded horizon. */
export function modelBetterEverywhere(standing: AnalogueStanding): boolean {
  return standing.horizons.length > 0 && standing.horizons.every((h) => h.modelIsBetter === true);
}
