export type Severity = "INFO" | "WATCH" | "WARNING" | "CRITICAL";
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type ForecastHour = 6 | 12 | 24 | 48;

export interface TrackPoint {
  lat: number;
  lon: number;
  t: string;
  windKph: number;
  pressureHpa: number;
}

export interface ForecastPoint {
  hour: ForecastHour;
  lat: number;
  lon: number;
  windKph: number;
  confidenceRadiusKm: number;
  intensityTrend: "INTENSIFY" | "STABLE" | "WEAKEN";
}

export interface SatelliteAnalysis {
  detected: boolean;
  eyeFormed: boolean;
  structureScore: number;
  confidence: number;
  classification: string;
  gradcamAvailable: boolean;
  gradcamImageUrl?: string | null;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  landfallProbability: number;
  confidence: number;
  coastalRisk: RiskLevel;
  distanceToCoastKm: number;
  regions: string[];
  explanation: string;
}

export interface HistoricalMatch {
  id: string;
  name: string;
  year: number;
  similarity: number;
  intensity: string;
  landfall: string;
  impact: string;
  windKph: number;
  pressureHpa: number;
  track: { lat: number; lon: number }[];
}

export interface Alert {
  id: string;
  severity: Severity;
  title: string;
  message: string;
  time: string;
}

export interface Explainability {
  classification: number;
  trajectory: number;
  intensity: number;
  risk: number;
  features: { name: string; weight: number }[];
}

export interface Cyclone {
  id: string;
  name: string;
  basin: string;
  category: string;
  windKph: number;
  pressureHpa: number;
  lat: number;
  lon: number;
  sstC?: number;
  humidity?: number;
  tempC?: number;
  movementDir: string;
  movementKph: number;
  distanceTravelledKm: number;
  updatedSecondsAgo: number;
  track: TrackPoint[];
  forecast: ForecastPoint[];
  satellite: SatelliteAnalysis;
  risk: RiskAssessment;
  explain: Explainability;
  historical: HistoricalMatch[];
  alerts: Alert[];
  series: { t: string; wind: number; pressure: number; coastKm: number; confidence: number }[];
}

// -------------------------------------------------------------
// BACKEND CONTRACT TYPES (Exact representation from Spring Boot)
// -------------------------------------------------------------

export interface BackendCycloneSummary {
  id: string;
  externalSource: string | null;
  externalId: string | null;
  name: string;
  basin: string;
  status: string;
  currentCategory: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendObservation {
  id: string;
  observedAt: string;
  latitude: number | null;
  longitude: number | null;
  windSpeedKph: number | null;
  pressureHpa: number | null;
  movementSpeedKph: number | null;
  movementDirectionDegrees: number | null;
  source: string | null;
}

export interface BackendCycloneDetail extends BackendCycloneSummary {
  latestObservation: BackendObservation | null;
}

export interface BackendPredictedPoint {
  id?: string;
  forecastHour: number;
  lat: number;
  longCoord: number;
  confidenceRadiusKm: number;
}

export interface BackendPrediction {
  id: string;
  cycloneId: string;
  generatedAt: string;
  modelVersion: string;
  predictedIntensityTrend: string;
  confidenceScore: number;
  explanation: string;
  trajectory: BackendPredictedPoint[];
}

export interface BackendRiskAssessment {
  id: string;
  cycloneId: string;
  riskLevel: string;
  riskScore: number;
  atRiskRegionsJson: string;
  landfallProbability48h: number;
  computedAt: string;
}

export interface BackendHistoricalCyclone {
  id: string;
  name: string;
  year: number;
  basin: string;
  maxWindKph: number;
  minPressureHpa: number;
  landfallLocation: string;
  casualties: number;
  damageCostUsd: number;
  trackJson: string;
}

export interface BackendSimilarityResult {
  id: string;
  cycloneId: string;
  similarityScore: number;
  rankOrder: number;
  historicalCyclone: BackendHistoricalCyclone | null;
}

export interface BackendAlert {
  id: string;
  cycloneId: string;
  cycloneName: string;
  severity: string;
  message: string;
  issuedAt: string;
  affectedRegionsJson: string;
}

export interface BackendSituationReport {
  cycloneId: string;
  cycloneName: string;
  generatedAt: string;
  executiveSummary: string;
  keyThreats: string[];
  recommendedActions: string[];
  meteorologicalSynthesis: string;
}

export interface BackendAiAnalysisResult {
  id: string;
  cycloneId: string;
  modelName: string;
  cycloneDetected: boolean;
  eyeFormed: boolean;
  structureScore: number;
  classification: string;
  confidence: number;
  gradcamImageUrl: string | null;
  generatedAt: string;
}
