/**
 * The one path from the browser to the backend.
 *
 * The frontend never talks to the Python AI service: Spring Boot owns
 * orchestration, persistence and validation, and the AI service is not exposed
 * publicly. Every call here hits Spring Boot.
 */

import type {
  CycloneDetail,
  CycloneSummary,
  Observation,
  PageResponse,
  PredictionRun,
  SatelliteAnalysis,
  SystemStatus,
} from "./types";

// 8081 matches the documented default in the README; 8080 is left free
// because it is so often already taken by another service.
const RAW_BASE =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8081";

export const API_BASE = RAW_BASE.replace(/\/+$/, "").replace(/\/api$/, "");

/**
 * An error carrying what the backend actually said.
 *
 * The distinction matters to the interface: 422 means this storm cannot be
 * forecast (too few fixes), 503 means the model is not loaded, and a network
 * failure means the backend is down. Each needs a different message, so the
 * code and status travel with the error rather than being flattened.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode?: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The storm's data cannot support what was asked. */
  get isUnprocessable() {
    return this.status === 422;
  }

  /** The model or AI service is unavailable, but the request was fine. */
  get isUnavailable() {
    return this.status === 503;
  }

  get isNotFound() {
    return this.status === 404;
  }

  /** The backend itself could not be reached. */
  get isOffline() {
    return this.status === 0;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
    });
  } catch (cause) {
    throw new ApiError(
      "The backend is not reachable. Start the Spring Boot service on " + API_BASE + ".",
      0,
      "BACKEND_OFFLINE",
      cause,
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  const body = text ? safeJson(text) : null;

  if (!response.ok) {
    const parsed = body as { message?: string; errorCode?: string } | null;
    throw new ApiError(
      parsed?.message ?? `${response.status} ${response.statusText}`,
      response.status,
      parsed?.errorCode,
      body,
    );
  }

  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function query(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : "";
}

export const api = {
  systemStatus: () => request<SystemStatus>("/api/v1/system/status"),

  cyclones: (params: {
    query?: string | undefined;
    basin?: string | undefined;
    season?: number | undefined;
    sort?: string | undefined;
    page?: number | undefined;
    size?: number | undefined;
  }) => request<PageResponse<CycloneSummary>>(`/api/v1/cyclones${query(params)}`),

  filters: () => request<{ seasons: number[]; basins: string[] }>("/api/v1/cyclones/filters"),

  cyclone: (id: string) => request<CycloneDetail>(`/api/v1/cyclones/${id}`),

  track: (id: string) => request<Observation[]>(`/api/v1/cyclones/${id}/track`),

  /** Runs the models. `force` re-runs even when a stored run exists. */
  forecast: (
    id: string,
    options: { baseTime?: string | undefined; force?: boolean | undefined } = {},
  ) =>
    request<PredictionRun>(
      `/api/v1/cyclones/${id}/forecast${query({
        baseTime: options.baseTime,
        force: options.force,
      })}`,
      { method: "POST" },
    ),

  /**
   * The stored run for a storm, or null when it has never been forecast.
   * The backend answers 204 for that case, which `request` maps to null; a
   * 404 here means the storm id itself is unknown and stays an error.
   */
  latestForecast: (id: string) =>
    request<PredictionRun | null>(`/api/v1/cyclones/${id}/forecast/latest`),

  forecastHistory: (id: string, limit = 10) =>
    request<PredictionRun[]>(`/api/v1/cyclones/${id}/forecast/history${query({ limit })}`),

  forecastRun: (runId: string) => request<PredictionRun>(`/api/v1/forecasts/${runId}`),

  uploadSatelliteImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ id: string; url: string; bytes: number; contentType: string }>(
      "/api/v1/satellite/images",
      { method: "POST", body: form },
    );
  },

  analyseSatellite: (payload: {
    cycloneId: string;
    imageUrl: string;
    imageType?: string | undefined;
    capturedAt?: string | undefined;
  }) =>
    request<SatelliteAnalysis>("/api/v1/satellite/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  satelliteAnalyses: (limit = 20) =>
    request<SatelliteAnalysis[]>(`/api/v1/satellite/analyses${query({ limit })}`),

  satelliteAnalysesForCyclone: (cycloneId: string) =>
    request<SatelliteAnalysis[]>(`/api/v1/satellite/analyses/cyclone/${cycloneId}`),
};
