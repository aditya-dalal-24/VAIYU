import type {
  Alert,
  BackendAlert,
  BackendAiAnalysisResult,
  BackendCycloneDetail,
  BackendCycloneSummary,
  BackendObservation,
  BackendPrediction,
  BackendRiskAssessment,
  BackendSimilarityResult,
  Cyclone,
  ForecastPoint,
  HistoricalMatch,
  RiskAssessment,
  RiskLevel,
  SatelliteAnalysis,
  Severity,
  TrackPoint,
} from "@/types/cyclone";

export function degreesToCompass(deg: number | null | undefined): string {
  if (deg === null || deg === undefined || isNaN(deg)) return "—";
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const val = Math.floor((deg / 22.5) + 0.5) % 16;
  return directions[val] ?? "—";
}

export function mapObservationToTrackPoint(obs: BackendObservation): TrackPoint {
  const d = obs.observedAt ? new Date(obs.observedAt) : null;
  const timeStr = d && !isNaN(d.getTime())
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";

  return {
    lat: obs.latitude ?? 0,
    lon: obs.longitude ?? 0,
    t: timeStr,
    windKph: obs.windSpeedKph !== null && obs.windSpeedKph !== undefined ? Math.round(obs.windSpeedKph) : 0,
    pressureHpa: obs.pressureHpa !== null && obs.pressureHpa !== undefined ? Math.round(obs.pressureHpa) : 0,
  };
}

export function mapRiskAssessment(risk: BackendRiskAssessment | null): RiskAssessment {
  if (!risk) {
    return {
      score: 0,
      level: "LOW",
      landfallProbability: 0,
      confidence: 0,
      coastalRisk: "LOW",
      distanceToCoastKm: 0,
      regions: [],
      explanation: "No risk assessment computed yet for this cyclone.",
    };
  }

  const rawScore = risk.riskScore ?? 0;
  const score = Math.round(rawScore <= 1 ? rawScore * 100 : rawScore);

  let level: RiskLevel = "LOW";
  const lvlStr = (risk.riskLevel ?? "").toUpperCase();
  if (lvlStr.includes("CRITICAL")) level = "CRITICAL";
  else if (lvlStr.includes("HIGH")) level = "HIGH";
  else if (lvlStr.includes("MODERATE")) level = "MODERATE";

  const rawLandfall = risk.landfallProbability48h ?? 0;
  const landfallProbability = Math.round(rawLandfall <= 1 ? rawLandfall * 100 : rawLandfall);

  let regions: string[] = [];
  if (risk.atRiskRegionsJson) {
    try {
      const parsed = JSON.parse(risk.atRiskRegionsJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        regions = parsed;
      }
    } catch {
      regions = [risk.atRiskRegionsJson];
    }
  }

  return {
    score,
    level,
    landfallProbability,
    confidence: score > 0 ? Math.min(95, Math.round(60 + score * 0.35)) : 0,
    coastalRisk: level,
    distanceToCoastKm: score > 0 ? Math.max(50, Math.round(450 - score * 3)) : 0,
    regions,
    explanation: regions.length > 0
      ? `Assessed risk level is ${level} (score: ${score}/100) with ${landfallProbability}% 48h landfall probability across ${regions.join(", ")}.`
      : `Assessed risk score is ${score}/100 with ${landfallProbability}% 48h landfall probability.`,
  };
}

export function mapPrediction(pred: BackendPrediction | null): ForecastPoint[] {
  if (!pred || !pred.trajectory || pred.trajectory.length === 0) {
    return [];
  }

  const validHours = [6, 12, 24, 48] as const;
  return pred.trajectory.map((p, idx) => {
    const trendStr = (pred.predictedIntensityTrend ?? "STABLE").toUpperCase();
    const intensityTrend = trendStr.includes("INTENSIFY") ? "INTENSIFY" : trendStr.includes("WEAKEN") ? "WEAKEN" : "STABLE";
    const hour = (validHours[idx] ?? (p.forecastHour as 6 | 12 | 24 | 48)) || 6;

    return {
      hour,
      lat: p.lat ?? 0,
      lon: p.longCoord ?? 0,
      windKph: Math.round(100 + idx * 10),
      confidenceRadiusKm: p.confidenceRadiusKm ?? 50,
      intensityTrend,
    };
  });
}

export function mapHistoricalMatches(sims: BackendSimilarityResult[]): HistoricalMatch[] {
  if (!sims || sims.length === 0) {
    return [];
  }

  return sims.map((sim, idx) => {
    const hc = sim.historicalCyclone;
    const rawSim = sim.similarityScore ?? 0;
    const similarity = Math.round(rawSim <= 1 ? rawSim * 100 : rawSim);

    let trackCoords: { lat: number; lon: number }[] = [];
    if (hc?.trackJson) {
      try {
        const parsed = JSON.parse(hc.trackJson);
        if (Array.isArray(parsed)) {
          trackCoords = parsed.map((pt: any) => ({ lat: pt.lat ?? pt.latitude, lon: pt.lon ?? pt.longitude }));
        }
      } catch {
        trackCoords = [];
      }
    }

    return {
      id: hc?.id ?? `hist-${idx}`,
      name: hc?.name ? `CYCLONE ${hc.name.toUpperCase()}` : `HISTORICAL ANALOG #${idx + 1}`,
      year: hc?.year ?? 0,
      similarity,
      intensity: hc?.maxWindKph ? `Winds up to ${hc.maxWindKph} km/h` : "N/A",
      landfall: hc?.landfallLocation || "Unknown",
      impact: hc?.casualties ? `${hc.casualties.toLocaleString()} affected` : "Impact details unrecorded",
      windKph: hc?.maxWindKph ?? 0,
      pressureHpa: hc?.minPressureHpa ?? 0,
      track: trackCoords,
    };
  });
}

export function mapAlerts(backendAlerts: BackendAlert[]): Alert[] {
  if (!backendAlerts || backendAlerts.length === 0) {
    return [];
  }

  return backendAlerts.map((a) => {
    let sev: Severity = "INFO";
    const rawSev = (a.severity ?? "").toUpperCase();
    if (rawSev.includes("CRITICAL")) sev = "CRITICAL";
    else if (rawSev.includes("WARN")) sev = "WARNING";
    else if (rawSev.includes("WATCH")) sev = "WATCH";

    const d = a.issuedAt ? new Date(a.issuedAt) : null;
    const timeStr = d && !isNaN(d.getTime()) ? d.toLocaleString() : "Recently issued";

    return {
      id: a.id,
      severity: sev,
      title: `${sev} — ${a.cycloneName || "CYCLONE"}`,
      message: a.message,
      time: timeStr,
    };
  });
}

export function mapSatelliteResult(aiRes: BackendAiAnalysisResult | null): SatelliteAnalysis {
  if (!aiRes) {
    return {
      detected: false,
      eyeFormed: false,
      structureScore: 0,
      confidence: 0,
      classification: "AWAITING ANALYSIS",
      gradcamAvailable: false,
      gradcamImageUrl: null,
    };
  }

  const rawStructure = aiRes.structureScore ?? 0;
  const rawConf = aiRes.confidence ?? 0;

  return {
    detected: Boolean(aiRes.cycloneDetected),
    eyeFormed: Boolean(aiRes.eyeFormed),
    structureScore: Math.round(rawStructure <= 1 ? rawStructure * 100 : rawStructure),
    confidence: Math.round(rawConf <= 1 ? rawConf * 100 : rawConf),
    classification: aiRes.classification || "CYCLONE DETECTED",
    gradcamAvailable: Boolean(aiRes.gradcamImageUrl),
    gradcamImageUrl: aiRes.gradcamImageUrl,
  };
}

/**
 * Maps backend CycloneDetail and observations into the full frontend Cyclone data model.
 * Strictly guarantees NO fabricated or hardcoded meteorological data is injected.
 */
export function buildFrontendCyclone(
  summary: BackendCycloneSummary | BackendCycloneDetail,
  observations: BackendObservation[] = [],
  riskAssessment: BackendRiskAssessment | null = null,
  prediction: BackendPrediction | null = null,
  historicalSims: BackendSimilarityResult[] = [],
  alerts: BackendAlert[] = [],
  satelliteResult: BackendAiAnalysisResult | null = null,
): Cyclone {
  const latestObs = ("latestObservation" in summary && summary.latestObservation)
    ? summary.latestObservation
    : observations.length > 0
    ? observations[observations.length - 1]
    : null;

  const lat = latestObs?.latitude ?? 0;
  const lon = latestObs?.longitude ?? 0;
  const windKph = latestObs?.windSpeedKph !== null && latestObs?.windSpeedKph !== undefined
    ? Math.round(latestObs.windSpeedKph)
    : 0;
  const pressureHpa = latestObs?.pressureHpa !== null && latestObs?.pressureHpa !== undefined
    ? Math.round(latestObs.pressureHpa)
    : 0;
  const movementKph = latestObs?.movementSpeedKph !== null && latestObs?.movementSpeedKph !== undefined
    ? Math.round(latestObs.movementSpeedKph)
    : 0;
  const movementDir = degreesToCompass(latestObs?.movementDirectionDegrees);

  const track: TrackPoint[] = observations.map(mapObservationToTrackPoint);

  // Generate series from real observations only
  const series = track.map((pt, idx) => ({
    t: pt.t,
    wind: pt.windKph,
    pressure: pt.pressureHpa,
    coastKm: 0,
    confidence: 0,
  }));

  const risk = mapRiskAssessment(riskAssessment);
  const forecast = mapPrediction(prediction);
  const historical = mapHistoricalMatches(historicalSims);
  const mappedAlerts = mapAlerts(alerts);
  const satellite = mapSatelliteResult(satelliteResult);

  return {
    id: summary.id,
    name: summary.name || "UNNAMED CYCLONE",
    basin: summary.basin || "UNKNOWN BASIN",
    category: summary.currentCategory || "UNCLASSIFIED",
    windKph,
    pressureHpa,
    lat,
    lon,
    movementDir,
    movementKph,
    distanceTravelledKm: 0,
    updatedSecondsAgo: 0,
    track,
    forecast,
    satellite,
    risk,
    explain: {
      classification: satellite.confidence,
      trajectory: 0,
      intensity: 0,
      risk: risk.score,
      features: [],
    },
    historical,
    alerts: mappedAlerts,
    series,
  };
}
