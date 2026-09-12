/**
 * Formatting for measured values.
 *
 * One rule underpins all of it: a missing value renders as an em dash, never as
 * zero and never as a guess. `windOrNull` exists so callers cannot accidentally
 * coerce null to 0 on the way to a chart.
 */

/** What absence looks like. */
export const ABSENT = "—";

export function fmtWind(kph: number | null | undefined): string {
  if (kph === null || kph === undefined) return ABSENT;
  return `${Math.round(kph)} km/h`;
}

export function fmtPressure(hpa: number | null | undefined): string {
  if (hpa === null || hpa === undefined) return ABSENT;
  return `${Math.round(hpa)} hPa`;
}

export function fmtKm(km: number | null | undefined, digits = 0): string {
  if (km === null || km === undefined) return ABSENT;
  return `${km.toFixed(digits)} km`;
}

export function fmtNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return ABSENT;
  return value.toFixed(digits);
}

/** Confidence as a percentage. Absent confidence means none was measured. */
export function fmtConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined) return ABSENT;
  return `${Math.round(value * 100)}%`;
}

/**
 * A storm's name as the archive holds it.
 *
 * IBTrACS joins alternate names with a colon, because a storm that crosses
 * basins is renamed by the next agency: the Pacific typhoon Matmo became
 * Bulbul on entering the Bay of Bengal, and the archive stores "BULBUL:MATMO".
 * Both names are kept — 46 storms have two, and which one a reader recognises
 * depends on where they live — but separated so the value does not read as a
 * data glitch.
 */
export function stormName(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback;
  return name.includes(":") ? name.split(":").join(" / ") : name;
}

/**
 * Basin codes, expanded.
 *
 * The backend already sends a `basinName` for a single storm, but the filter
 * lists arrive as bare codes, and "NI" is not a thing most readers can name.
 */
export const BASIN_NAMES: Record<string, string> = {
  NI: "North Indian Ocean",
  SI: "South Indian Ocean",
  NA: "North Atlantic",
  SA: "South Atlantic",
  EP: "East Pacific",
  WP: "West Pacific",
  SP: "South Pacific",
};

export function basinName(code: string | null | undefined): string {
  if (!code) return ABSENT;
  return BASIN_NAMES[code] ?? code;
}

export function fmtCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew}`;
}

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

const DATE_ONLY = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const TIME_ONLY = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

/** Everything in this system is UTC, and says so. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return ABSENT;
  return `${DATE_TIME.format(new Date(iso)).replace(",", "")}Z`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ABSENT;
  return DATE_ONLY.format(new Date(iso));
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return ABSENT;
  return `${TIME_ONLY.format(new Date(iso))}Z`;
}

export function fmtHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return ABSENT;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function fmtHorizon(hours: number): string {
  return `+${hours}h`;
}

/** Milliseconds as the model reported them. */
export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return ABSENT;
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Category colour by Saffir-Simpson rank. The ramp is ordered, so a reader can
 * compare two storms by hue without reading a number.
 */
export function categoryColor(rank: number | null | undefined): string {
  if (rank === null || rank === undefined) return "var(--absent)";
  const clamped = Math.max(0, Math.min(6, rank));
  return `var(--cat-${clamped})`;
}

export function categoryColorForWind(kph: number | null | undefined): string {
  return categoryColor(categoryRank(kph));
}

/** Mirrors the backend's IntensityScale, for colouring values client-side. */
export function categoryRank(kph: number | null | undefined): number | null {
  if (kph === null || kph === undefined) return null;
  if (kph < 63) return 0;
  if (kph < 119) return 1;
  if (kph < 154) return 2;
  if (kph < 178) return 3;
  if (kph < 209) return 4;
  if (kph < 252) return 5;
  return 6;
}

export function stormLabel(
  storm: { name?: string | null; externalId: string } | null | undefined,
): string {
  if (!storm) return ABSENT;
  return storm.name?.trim() ? storm.name : storm.externalId;
}

/** "INTENSIFYING" -> "Intensifying". */
export function titleCase(value: string | null | undefined): string {
  if (!value) return ABSENT;
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function hoursBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}
