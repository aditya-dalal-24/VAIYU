export interface CycloneObservation {
  id?: string;
  cycloneId?: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  windSpeedKph: number;
  pressureHpa: number;
  movementDirectionDegrees?: number;
  movementSpeedKph?: number;
  source?: string;
}

export interface Cyclone {
  id: string;
  externalSource?: string;
  externalId?: string;
  name: string;
  basin: string;
  status: string;
  currentCategory?: string;
  createdAt?: string;
  updatedAt?: string;
  latestObservation?: CycloneObservation;
  observations?: CycloneObservation[];
}

export interface PredictedTrackPoint {
  id?: string;
  predictionId?: string;
  forecastHour: number;
  lat: number;
  longCoord: number;
  confidenceRadiusKm: number;
}

export interface Prediction {
  id?: string;
  cycloneId: string;
  generatedAt: string;
  modelVersion: string;
  predictedIntensityTrend: 'INTENSIFY' | 'WEAKEN' | 'STABLE';
  confidenceScore: number;
  explanation?: string;
  trajectory: PredictedTrackPoint[];
}

export interface SatelliteImage {
  id: string;
  cycloneId: string;
  capturedAt: string;
  imageType: 'VISIBLE' | 'INFRARED' | 'WATER_VAPOR';
  storagePath: string;
  source: string;
}

export interface AiAnalysisResult {
  id?: string;
  cycloneId: string;
  modelName: string;
  cycloneDetected: boolean;
  eyeFormed: boolean;
  structureScore: number;
  classification: string;
  confidence: number;
  gradcamImageUrl?: string;
  generatedAt?: string;
}

export interface HistoricalCyclone {
  id: string;
  name: string;
  year: number;
  finalIntensity: string;
  finalLandfallLocation: string;
  impactSummary: string;
  maxWindSpeedKmh: number;
  minPressureHpa: number;
  trackPoints?: CycloneObservation[];
}

export interface SimilarityResult {
  id?: string;
  cycloneId: string;
  historicalCyclone: HistoricalCyclone;
  similarityScore: number;
  rank: number;
}

export interface RiskAssessment {
  id?: string;
  cycloneId: string;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  riskScore: number;
  atRiskRegions: string[];
  landfallProbability48h: number;
  computedAt: string;
}

export interface Alert {
  id: string;
  cycloneId?: string;
  cycloneName: string;
  severity: 'Info' | 'Watch' | 'Warning' | 'Critical';
  message: string;
  issuedAt: string;
  affectedRegions: string[];
}

export interface SituationReport {
  cycloneId: string;
  cycloneName: string;
  generatedAt: string;
  executiveSummary: string;
  keyThreats: string[];
  recommendedActions: string[];
  meteorologicalSynthesis: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'ADMIN' | 'METEOROLOGIST' | 'OPERATOR';
  title: string;
  organization: string;
  authProvider: 'google' | 'github' | 'imd_sso';
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}
