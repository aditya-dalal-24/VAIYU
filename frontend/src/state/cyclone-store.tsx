import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  buildFrontendCyclone,
  mapAlerts,
  mapHistoricalMatches,
  mapPrediction,
  mapRiskAssessment,
  mapSatelliteResult,
} from "@/api/adapters";
import { fetchAlerts } from "@/api/alertApi";
import { fetchActiveCyclones, fetchAllCyclones, fetchCycloneDetail, fetchCycloneObservations } from "@/api/cycloneApi";
import { fetchHistoricalMatches } from "@/api/historicalApi";
import { fetchPrediction, triggerPrediction } from "@/api/predictionApi";
import { fetchSituationReport } from "@/api/reportApi";
import { fetchRisk } from "@/api/riskApi";
import { runSatelliteAnalysis } from "@/api/satelliteApi";
import type { Cyclone, ForecastPoint, SatelliteAnalysis } from "@/types/cyclone";

export type ViewMode = "3D" | "2D";
export type LayerKey = "wind" | "history" | "prediction" | "corridor" | "risk" | "satellite";
export type PanelKey = "risk" | "historical" | "report" | "alerts" | "whatif" | null;

interface SatelliteState {
  status: "idle" | "running" | "done";
  step: string;
  result: SatelliteAnalysis | null;
  view: "original" | "heatmap";
}

interface PredictionState {
  status: "idle" | "running" | "done";
  revealedHours: number[];
  points: ForecastPoint[];
  tab: "trajectory" | "intensity";
}

interface Store {
  cyclones: Cyclone[];
  cyclone: Cyclone;
  selectedId: string;
  selectCyclone: (id: string) => void;
  loading: boolean;
  error: string | null;
  live: boolean;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  layers: Record<LayerKey, boolean>;
  toggleLayer: (k: LayerKey) => void;
  satellite: SatelliteState;
  setSatelliteView: (v: "original" | "heatmap") => void;
  runAnalysis: () => Promise<void>;
  prediction: PredictionState;
  setPredictionTab: (t: "trajectory" | "intensity") => void;
  runPrediction: () => Promise<void>;
  focusHour: number | null;
  setFocusHour: (h: number | null) => void;
  compareId: string | null;
  setCompareId: (id: string | null) => void;
  replayProgress: number;
  setReplayProgress: (n: number) => void;
  replaying: boolean;
  setReplaying: (b: boolean) => void;
  panel: PanelKey;
  setPanel: (p: PanelKey) => void;
  report: { status: "idle" | "running" | "done"; text: string };
  generateReport: () => Promise<void>;
  cameraNonce: number;
  focusGlobe: () => void;
  refetch: () => void;
}

const Ctx = createContext<Store | null>(null);

const defaultLayers: Record<LayerKey, boolean> = {
  wind: true,
  history: true,
  prediction: true,
  corridor: true,
  risk: true,
  satellite: false,
};

const EMPTY_FALLBACK_CYCLONE: Cyclone = {
  id: "empty",
  name: "NO ACTIVE CYCLONES",
  basin: "INDIAN OCEAN",
  category: "MONITORING",
  windKph: 0,
  pressureHpa: 1013,
  lat: 15.0,
  lon: 80.0,
  movementDir: "N",
  movementKph: 0,
  distanceTravelledKm: 0,
  updatedSecondsAgo: 0,
  track: [{ lat: 15.0, lon: 80.0, t: "NOW", windKph: 0, pressureHpa: 1013 }],
  forecast: [
    { hour: 6, lat: 15.3, lon: 80.2, windKph: 0, confidenceRadiusKm: 50, intensityTrend: "STABLE" },
    { hour: 12, lat: 15.8, lon: 80.5, windKph: 0, confidenceRadiusKm: 90, intensityTrend: "STABLE" },
    { hour: 24, lat: 16.5, lon: 81.0, windKph: 0, confidenceRadiusKm: 140, intensityTrend: "STABLE" },
    { hour: 48, lat: 17.5, lon: 81.8, windKph: 0, confidenceRadiusKm: 220, intensityTrend: "STABLE" },
  ],
  satellite: {
    detected: false,
    eyeFormed: false,
    structureScore: 0,
    confidence: 0,
    classification: "QUIET CONDITIONS",
    gradcamAvailable: false,
  },
  risk: {
    score: 0,
    level: "LOW",
    landfallProbability: 0,
    confidence: 100,
    coastalRisk: "LOW",
    distanceToCoastKm: 999,
    regions: ["None"],
    explanation: "No active storm system detected in monitored basins.",
  },
  explain: {
    classification: 0,
    trajectory: 0,
    intensity: 0,
    risk: 0,
    features: [],
  },
  historical: [],
  alerts: [],
  series: [{ t: "NOW", wind: 0, pressure: 1013, coastKm: 999, confidence: 100 }],
};

export function CycloneProvider({ children }: { children: ReactNode }) {
  // Query 1: Fetch active cyclones from backend
  const {
    data: rawCyclones,
    isLoading: isListLoading,
    error: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ["cyclones", "active"],
    queryFn: async () => {
      try {
        const active = await fetchActiveCyclones();
        if (active && active.length > 0) return active;
        // If no active cyclones returned, check all cyclones
        const all = await fetchAllCyclones();
        return all ?? [];
      } catch (err) {
        // Re-throw to allow error handling in UI
        throw err;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });

  // Track selected cyclone ID
  const [selectedId, setSelectedId] = useState<string>("");

  // Update selectedId when cyclones load
  useEffect(() => {
    if (rawCyclones && rawCyclones.length > 0) {
      if (!selectedId || !rawCyclones.some((c) => c.id === selectedId)) {
        const first = rawCyclones[0];
        if (first) {
          setSelectedId(first.id);
        }
      }
    }
  }, [rawCyclones, selectedId]);

  // Query 2: Fetch detailed cyclone data for selectedId
  const {
    data: selectedDetail,
    isLoading: isDetailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ["cyclone", "detail", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;

      const [detail, observations, risk, historical, alerts] = await Promise.allSettled([
        fetchCycloneDetail(selectedId),
        fetchCycloneObservations(selectedId),
        fetchRisk(selectedId),
        fetchHistoricalMatches(selectedId),
        fetchAlerts(),
      ]);

      const backendDetail = detail.status === "fulfilled" ? detail.value : null;
      const backendObs = observations.status === "fulfilled" ? observations.value : [];
      const backendRisk = risk.status === "fulfilled" ? risk.value : null;
      const backendHist = historical.status === "fulfilled" ? historical.value : [];
      const backendAlerts = alerts.status === "fulfilled" ? alerts.value : [];

      if (!backendDetail) {
        const summary = rawCyclones?.find((c) => c.id === selectedId);
        if (!summary) return null;
        return buildFrontendCyclone(summary, backendObs, backendRisk, null, backendHist, backendAlerts);
      }

      return buildFrontendCyclone(backendDetail, backendObs, backendRisk, null, backendHist, backendAlerts);
    },
    enabled: Boolean(selectedId),
    staleTime: 30_000,
  });

  // Map initial summary cyclones to basic Cyclone objects
  const cyclones: Cyclone[] = useMemo(() => {
    if (!rawCyclones || rawCyclones.length === 0) return [];
    return rawCyclones.map((summary) => {
      if (selectedDetail && selectedDetail.id === summary.id) {
        return selectedDetail;
      }
      return buildFrontendCyclone(summary);
    });
  }, [rawCyclones, selectedDetail]);

  const cyclone: Cyclone = useMemo(() => {
    if (selectedDetail) return selectedDetail;
    const first = cyclones[0];
    if (first) return first;
    return EMPTY_FALLBACK_CYCLONE;
  }, [selectedDetail, cyclones]);

  const [view, setView] = useState<ViewMode>("3D");
  const [layers, setLayers] = useState(defaultLayers);
  const [satellite, setSatellite] = useState<SatelliteState>({
    status: "idle",
    step: "",
    result: null,
    view: "original",
  });
  const [prediction, setPrediction] = useState<PredictionState>({
    status: "idle",
    revealedHours: [],
    points: [],
    tab: "trajectory",
  });
  const [focusHour, setFocusHour] = useState<number | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [replayProgress, setReplayProgress] = useState(1);
  const [replaying, setReplaying] = useState(false);
  const [panel, setPanel] = useState<PanelKey>(null);
  const [report, setReport] = useState<Store["report"]>({ status: "idle", text: "" });
  const [cameraNonce, setCameraNonce] = useState(0);

  const selectCyclone = useCallback((id: string) => {
    setSelectedId(id);
    setSatellite({ status: "idle", step: "", result: null, view: "original" });
    setPrediction({ status: "idle", revealedHours: [], points: [], tab: "trajectory" });
    setFocusHour(null);
    setCompareId(null);
    setReport({ status: "idle", text: "" });
    setReplayProgress(1);
    setReplaying(false);
    setCameraNonce((n) => n + 1);
  }, []);

  const toggleLayer = useCallback((k: LayerKey) => {
    setLayers((l) => ({ ...l, [k]: !l[k] }));
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!cyclone.id || cyclone.id === "empty") return;
    setSatellite((s) => ({ ...s, status: "running", step: "QUERYING AI SERVICE..." }));
    try {
      const aiRes = await runSatelliteAnalysis(cyclone.id);
      const result = mapSatelliteResult(aiRes);
      setSatellite({ status: "done", step: "ANALYSIS COMPLETE", result, view: "original" });
    } catch {
      setSatellite((s) => ({
        ...s,
        status: "done",
        step: "DEFAULT ANALYSIS RETAINED",
        result: cyclone.satellite,
        view: "original",
      }));
    }
  }, [cyclone.id, cyclone.satellite]);

  const runPrediction = useCallback(async () => {
    if (!cyclone.id || cyclone.id === "empty") return;
    setPrediction((p) => ({ ...p, status: "running", revealedHours: [] }));
    let points: ForecastPoint[] = [];
    try {
      const predRes = await triggerPrediction(cyclone.id);
      points = mapPrediction(predRes);
    } catch {
      try {
        const predRes = await fetchPrediction(cyclone.id);
        points = mapPrediction(predRes);
      } catch {
        points = cyclone.forecast;
      }
    }
    setPrediction((p) => ({ ...p, points }));
    for (const point of points) {
      await new Promise((r) => setTimeout(r, 250));
      setPrediction((p) => ({ ...p, revealedHours: [...p.revealedHours, point.hour] }));
    }
    setPrediction((p) => ({ ...p, status: "done" }));
  }, [cyclone.id, cyclone.lat, cyclone.lon, cyclone.forecast]);

  const generateReport = useCallback(async () => {
    if (!cyclone.id || cyclone.id === "empty") return;
    setReport({ status: "running", text: "" });
    try {
      const rep = await fetchSituationReport(cyclone.id);
      const formatted = [
        `============================================================`,
        `CYCLOVISION SITUATION REPORT — ${rep.cycloneName?.toUpperCase() || cyclone.name}`,
        `GENERATED AT: ${new Date(rep.generatedAt).toLocaleString()}`,
        `============================================================`,
        ``,
        `EXECUTIVE SUMMARY:`,
        rep.executiveSummary || "No executive summary available.",
        ``,
        `KEY THREATS:`,
        ...(rep.keyThreats && rep.keyThreats.length > 0 ? rep.keyThreats.map((t) => `• ${t}`) : ["• Monitoring coastal impacts"]),
        ``,
        `RECOMMENDED ACTIONS:`,
        ...(rep.recommendedActions && rep.recommendedActions.length > 0
          ? rep.recommendedActions.map((a) => `• ${a}`)
          : ["• Maintain alert level"]),
        ``,
        `METEOROLOGICAL SYNTHESIS:`,
        rep.meteorologicalSynthesis || "ResNet-34 + trajectory model synthesis active.",
      ].join("\n");
      setReport({ status: "done", text: formatted });
    } catch {
      // Fallback formatting from cyclone properties
      const fallbackReport = [
        `CYCLOVISION SITUATION REPORT — ${cyclone.name} / ${cyclone.basin.toUpperCase()}`,
        ``,
        `STATUS            ${cyclone.category}`,
        `POSITION          ${cyclone.lat.toFixed(1)}°N ${cyclone.lon.toFixed(1)}°E`,
        `INTENSITY         ${cyclone.windKph} km/h sustained · ${cyclone.pressureHpa} hPa central pressure`,
        `MOVEMENT          ${cyclone.movementDir} at ${cyclone.movementKph} km/h`,
        ``,
        `RISK ASSESSMENT   ${cyclone.risk.level} (${cyclone.risk.score}/100)`,
        `LANDFALL          ${cyclone.risk.landfallProbability}% probability`,
        `AFFECTED REGIONS  ${cyclone.risk.regions.join(", ")}`,
      ].join("\n");
      setReport({ status: "done", text: fallbackReport });
    }
  }, [cyclone]);

  const focusGlobe = useCallback(() => setCameraNonce((n) => n + 1), []);

  const refetch = useCallback(() => {
    void refetchList();
    void refetchDetail();
  }, [refetchList, refetchDetail]);

  const errorMessage = listError instanceof Error ? listError.message : detailError instanceof Error ? detailError.message : null;

  const value: Store = {
    cyclones,
    cyclone,
    selectedId,
    selectCyclone,
    loading: isListLoading || isDetailLoading,
    error: errorMessage,
    live: true,
    view,
    setView,
    layers,
    toggleLayer,
    satellite,
    setSatelliteView: (v) => setSatellite((s) => ({ ...s, view: v })),
    runAnalysis,
    prediction,
    setPredictionTab: (t) => setPrediction((p) => ({ ...p, tab: t })),
    runPrediction,
    focusHour,
    setFocusHour,
    compareId,
    setCompareId,
    replayProgress,
    setReplayProgress,
    replaying,
    setReplaying,
    panel,
    setPanel,
    report,
    generateReport,
    cameraNonce,
    focusGlobe,
    refetch,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCyclone() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCyclone must be used inside CycloneProvider");
  return ctx;
}
