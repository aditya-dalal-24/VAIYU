/**
 * Data access hooks.
 *
 * Caching is deliberate: the archive never changes while the app is open, so
 * storms and tracks are cached hard; system status is polled because a model
 * can come and go; forecasts are never refetched on focus because each one is a
 * recorded model run rather than a live value.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";
import type { PredictionRun } from "./types";

const ARCHIVE_STALE = 30 * 60 * 1000;

export const keys = {
  systemStatus: ["system-status"] as const,
  filters: ["cyclone-filters"] as const,
  seasonActivity: (basin: string) => ["season-activity", basin] as const,
  cyclones: (params: unknown) => ["cyclones", params] as const,
  cyclone: (id: string) => ["cyclone", id] as const,
  track: (id: string) => ["track", id] as const,
  stormDna: (id: string, limit: number) => ["storm-dna", id, limit] as const,
  latestForecast: (id: string) => ["forecast-latest", id] as const,
  forecastHistory: (id: string) => ["forecast-history", id] as const,
  run: (id: string) => ["forecast-run", id] as const,
  satellite: (limit: number) => ["satellite-analyses", limit] as const,
  satelliteForCyclone: (id: string) => ["satellite-analyses", "cyclone", id] as const,
};

export function useSystemStatus() {
  return useQuery({
    queryKey: keys.systemStatus,
    queryFn: api.systemStatus,
    // A model may be loaded or a service restarted while the app is open.
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useFilters() {
  return useQuery({
    queryKey: keys.filters,
    queryFn: api.filters,
    staleTime: ARCHIVE_STALE,
  });
}

/** Season-by-season activity. As static as the archive, so cached hard. */
export function useSeasonActivity(basin: string) {
  return useQuery({
    queryKey: keys.seasonActivity(basin),
    queryFn: () => api.seasonActivity(basin || undefined),
    staleTime: ARCHIVE_STALE,
  });
}

export function useCyclones(params: {
  query?: string | undefined;
  basin?: string | undefined;
  subBasin?: string | undefined;
  season?: number | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  size?: number | undefined;
}) {
  return useQuery({
    queryKey: keys.cyclones(params),
    queryFn: () => api.cyclones(params),
    staleTime: ARCHIVE_STALE,
  });
}

export function useCyclone(id: string | undefined) {
  return useQuery({
    queryKey: keys.cyclone(id ?? "none"),
    queryFn: () => api.cyclone(id as string),
    enabled: Boolean(id),
    staleTime: ARCHIVE_STALE,
  });
}

export function useTrack(id: string | undefined) {
  return useQuery({
    queryKey: keys.track(id ?? "none"),
    queryFn: () => api.track(id as string),
    enabled: Boolean(id),
    staleTime: ARCHIVE_STALE,
  });
}

/**
 * A storm's measured signature and its nearest archive neighbours. Derived from
 * stored fixes, so it is as stable as the archive and cached hard.
 */
export function useStormDna(id: string | undefined, limit = 6) {
  return useQuery({
    queryKey: keys.stormDna(id ?? "none", limit),
    queryFn: () => api.stormDna(id as string, limit),
    enabled: Boolean(id),
    staleTime: ARCHIVE_STALE,
  });
}

/**
 * The most recent stored run for a storm, or null when none has been made —
 * a normal state for almost every storm in the archive, so it must not surface
 * as an error.
 */
export function useLatestForecast(id: string | undefined) {
  return useQuery({
    queryKey: keys.latestForecast(id ?? "none"),
    // 204 (no run yet) arrives as null; a 404 means the storm id is unknown
    // and is left to surface as an error.
    queryFn: () => api.latestForecast(id as string),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useForecastHistory(id: string | undefined, limit = 10) {
  return useQuery({
    queryKey: keys.forecastHistory(id ?? "none"),
    queryFn: () => api.forecastHistory(id as string, limit),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * Runs the models. The result is written into the cache for the storm so the
 * map and panels update without another round trip.
 */
export function useRunForecast(cycloneId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (options: { baseTime?: string | undefined; force?: boolean | undefined } = {}) =>
      api.forecast(cycloneId as string, options),
    onSuccess: (run: PredictionRun) => {
      if (!cycloneId) return;
      client.setQueryData(keys.latestForecast(cycloneId), run);
      client.setQueryData(keys.run(run.id), run);
      client.invalidateQueries({ queryKey: keys.forecastHistory(cycloneId) });
      client.invalidateQueries({ queryKey: keys.systemStatus });
    },
  });
}

export function useForecastRun(runId: string | undefined) {
  return useQuery({
    queryKey: keys.run(runId ?? "none"),
    queryFn: () => api.forecastRun(runId as string),
    enabled: Boolean(runId),
    staleTime: Infinity,
  });
}

export function useSatelliteAnalyses(limit = 20) {
  return useQuery({
    queryKey: keys.satellite(limit),
    queryFn: () => api.satelliteAnalyses(limit),
    staleTime: 60_000,
  });
}

export function useSatelliteAnalysesForCyclone(id: string | undefined) {
  return useQuery({
    queryKey: keys.satelliteForCyclone(id ?? "none"),
    queryFn: () => api.satelliteAnalysesForCyclone(id as string),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useAnalyseSatellite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      cycloneId: string;
      file?: File | undefined;
      imageUrl?: string | undefined;
      imageType?: string | undefined;
      capturedAt?: string | undefined;
    }) => {
      // An uploaded file has to be hosted before the AI service can fetch it.
      let imageUrl = input.imageUrl;
      if (input.file) {
        const stored = await api.uploadSatelliteImage(input.file);
        imageUrl = stored.url;
      }
      if (!imageUrl) {
        throw new Error("Provide an image file or an image URL.");
      }
      return api.analyseSatellite({
        cycloneId: input.cycloneId,
        imageUrl,
        imageType: input.imageType,
        capturedAt: input.capturedAt,
      });
    },
    onSuccess: (_result, variables) => {
      client.invalidateQueries({ queryKey: ["satellite-analyses"] });
      client.invalidateQueries({ queryKey: keys.satelliteForCyclone(variables.cycloneId) });
    },
  });
}
