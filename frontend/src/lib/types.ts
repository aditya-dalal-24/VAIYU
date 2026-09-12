/**
 * Types mirroring the Spring Boot API.
 *
 * Nulls are load-bearing throughout. An absent confidence means the model's
 * checkpoint recorded no evaluation; an absent uncertainty radius means no cone
 * may be drawn; an absent pressure means the fix never carried one. The UI must
 * render those as gaps, never as zero.
 */

export type AnalysisStatus =
  "COMPLETED" | "PARTIAL" | "NOT_AVAILABLE" | "FAILED" | "VALIDATION_ERROR";

export type ModelState =
  "TRAINED" | "UNTRAINED" | "CHECKPOINT_INVALID" | "LOAD_FAILED" | "UNAVAILABLE";

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface Observation {
  id: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  windSpeedKph: number | null;
  pressureHpa: number | null;
  movementSpeedKph: number | null;
  movementDirectionDegrees: number | null;
  category: string | null;
  categoryRank: number | null;
  source: string;
}

export interface DataQuality {
  observationCount: number;
  withWindCount: number;
  withPressureCount: number;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  largestGapHours: number | null;
  trackDurationHours: number | null;
  forecastReady: boolean;
  limitations: string[];
  observationSource: string;
  windScale: string;
}

export interface CycloneSummary {
  id: string;
  externalId: string;
  name: string | null;
  basin: string;
  /** IBTrACS sub-basin code at genesis, e.g. AS or BB; null when not stated. */
  subBasin: string | null;
  subBasinName: string | null;
  seasonYear: number | null;
  status: string;
  observationCount: number;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  peakWindKph: number | null;
  minPressureHpa: number | null;
  peakCategory: string | null;
  peakCategoryRank: number | null;
}

export interface CycloneDetail extends Omit<CycloneSummary, "observationCount"> {
  basinName: string;
  subBasin: string | null;
  subBasinName: string | null;
  latestObservation: Observation | null;
  peakObservation: Observation | null;
  dataQuality: DataQuality;
}

export interface ModelRef {
  name: string | null;
  version: string | null;
  featureSetVersion: string | null;
}

export interface TrackPoint {
  forecastHours: number;
  forecastAt: string;
  latitude: number;
  longitude: number;
  /** The model's measured held-out mean error at this horizon, in km. */
  uncertaintyRadiusKm: number | null;
}

export interface TrackForecast {
  status: AnalysisStatus | null;
  reason: string | null;
  confidence: number | null;
  model: ModelRef;
  points: TrackPoint[];
}

export interface IntensityPoint {
  forecastHours: number;
  forecastAt: string;
  windSpeedKph: number | null;
  pressureHpa: number | null;
  category: string | null;
}

export interface IntensityForecast {
  status: AnalysisStatus | null;
  reason: string | null;
  confidence: number | null;
  trend: string | null;
  model: ModelRef;
  points: IntensityPoint[];
}

export interface AnalogueMatch {
  rank: number;
  externalId: string;
  name: string | null;
  seasonYear: number | null;
  similarityScore: number;
  basis: string[];
  /** Present when that storm is also in this database. */
  cycloneId: string | null;
}

export interface AnaloguePoint {
  forecastHours: number;
  forecastAt: string;
  latitude: number;
  longitude: number;
  windSpeedKph: number | null;
  /** Members' mean distance from the ensemble mean: their disagreement. */
  spreadKm: number | null;
  memberCount: number | null;
}

export interface AnalogueForecast {
  status: AnalysisStatus | null;
  reason: string | null;
  confidence: number | null;
  model: ModelRef;
  matches: AnalogueMatch[];
  points: AnaloguePoint[];
}

export interface PredictionRun {
  id: string;
  cycloneId: string;
  cycloneName: string | null;
  cycloneExternalId: string;
  baseObservationAt: string;
  createdAt: string;
  overallStatus: AnalysisStatus;
  observationsUsed: number;
  inputNotes: string[];
  inputObservationIds: string[];
  inferenceMs: number | null;
  trajectory: TrackForecast;
  intensity: IntensityForecast;
  analogues: AnalogueForecast;
}

export interface SatelliteAnalysis {
  id: string;
  cycloneId: string | null;
  imageUrl: string;
  imageType: string | null;
  capturedAt: string | null;
  status: AnalysisStatus;
  reason: string | null;
  cycloneDetected: boolean | null;
  confidence: number | null;
  centerLatitude: number | null;
  centerLongitude: number | null;
  gradcamUrl: string | null;
  modelName: string | null;
  modelVersion: string | null;
  labelDefinition: string | null;
  inferenceMs: number | null;
  createdAt: string;
}

export interface SystemModel {
  available: boolean;
  state: ModelState | null;
  name: string | null;
  version: string | null;
  horizons: number[] | null;
  trainedAt: string | null;
  reason: string | null;
  sources: string[] | null;
  analogueStorms: number | null;
}

export interface SystemStatus {
  ai: {
    reachable: boolean;
    url: string;
    version: string | null;
    detail: string | null;
    models: Record<string, SystemModel>;
  };
  data: {
    cyclones: number;
    observations: number;
    forecastRuns: number;
    satelliteAnalyses: number;
    latestObservation: string | null;
    observationSource: string;
    windScale: string;
    ingestSourceAvailable: boolean;
    ingestSourcePath: string;
  };
}

/**
 * A storm's life measured from its fixes.
 *
 * Every numeric field is nullable because a storm's data may not support it: a
 * track with no pressure reading has no minimum pressure, a single-fix track no
 * speed. Null means "not knowable from the fixes", never zero.
 */
export interface StormSignature {
  cycloneId: string;
  name: string | null;
  externalId: string;
  basin: string;
  seasonYear: number | null;

  lifetimeHours: number | null;
  fixCount: number;
  genesisLatitude: number | null;
  genesisLongitude: number | null;
  peakWindKph: number | null;
  minPressureHpa: number | null;
  peakLatitude: number | null;
  timeToPeakFraction: number | null;
  hoursAtHurricaneForce: number | null;

  trackLengthKm: number | null;
  netDisplacementKm: number | null;
  sinuosity: number | null;
  meanTranslationKph: number | null;
  maxTranslationKph: number | null;
  polewardDegrees: number | null;

  maxIntensification24hKph: number | null;
  maxWeakening24hKph: number | null;
  rapidIntensification: boolean;

  traits: string[];
  limitations: string[];
}

export interface StormNeighbour {
  cycloneId: string;
  name: string | null;
  externalId: string;
  basin: string;
  seasonYear: number | null;
  /** Standard deviations of the archive, averaged over shared traits. */
  distance: number;
  traitsCompared: number;
  peakWindKph: number | null;
  lifetimeHours: number | null;
  trackLengthKm: number | null;
  sharedTraits: string[];
}

export interface StormDna {
  signature: StormSignature;
  neighbours: StormNeighbour[];
  method: string;
  comparedWith: number;
}

/**
 * A selectable sub-basin. Paired with its basin because a sub-basin only means
 * something inside one: AS is the Arabian Sea within the North Indian Ocean.
 */
export interface SubBasinOption {
  basin: string;
  code: string;
  name: string;
}

export interface FilterOptions {
  seasons: number[];
  basins: string[];
  subBasins: SubBasinOption[];
}

export interface ApiErrorBody {
  timestamp: string;
  status: number;
  errorCode: string;
  message: string;
  path: string;
  usableObservations?: number;
}
