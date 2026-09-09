/**
 * Centralized API Client for CycloVision Frontend.
 * Connects directly to the Spring Boot REST Backend.
 */

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export const API_BASE = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8080/api";
export const hasBackend = Boolean(API_BASE);

/**
 * Normalizes and resolves an endpoint path against API_BASE without duplicate '/api' prefixes.
 */
export function resolveUrl(path: string): string {
  const base = API_BASE.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // If base ends with /api and cleanPath begins with /api/, strip one /api
  if (base.endsWith("/api") && cleanPath.startsWith("/api/")) {
    return `${base}${cleanPath.substring(4)}`;
  }
  return `${base}${cleanPath}`;
}

/**
 * Performs a typed HTTP request against the backend.
 * Throws ApiError if HTTP status is not 2xx.
 */
export async function apiRequest<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const url = resolveUrl(endpoint);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError(`Network error reaching ${url}: ${msg}`, 0);
  }

  if (!res.ok) {
    let errorDetail = "";
    try {
      const body = await res.json();
      errorDetail = body.message || body.error || JSON.stringify(body);
    } catch {
      errorDetail = res.statusText;
    }
    throw new ApiError(`Backend Error ${res.status} on ${endpoint}: ${errorDetail || res.statusText}`, res.status);
  }

  // If response has no content (204 No Content), return null as T
  if (res.status === 204) {
    return null as T;
  }

  return (await res.json()) as T;
}

export async function getJson<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: "GET" });
}

export async function postJson<T>(endpoint: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method: "POST",
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return apiRequest<T>(endpoint, init);
}
