import { getJson } from "./client";
import type {
  BackendCycloneDetail,
  BackendCycloneSummary,
  BackendObservation,
} from "@/types/cyclone";

/**
 * Fetches all cyclones from the backend.
 */
export async function fetchAllCyclones(status?: string): Promise<BackendCycloneSummary[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return getJson<BackendCycloneSummary[]>(`/api/cyclones${query}`);
}

/**
 * Fetches active cyclones from the backend.
 */
export async function fetchActiveCyclones(): Promise<BackendCycloneSummary[]> {
  return getJson<BackendCycloneSummary[]>("/api/cyclones/active");
}

/**
 * Fetches a single cyclone's detail along with its latest observation.
 */
export async function fetchCycloneDetail(id: string): Promise<BackendCycloneDetail> {
  return getJson<BackendCycloneDetail>(`/api/cyclones/${encodeURIComponent(id)}`);
}

/**
 * Fetches observations track for a specific cyclone.
 */
export async function fetchCycloneObservations(id: string): Promise<BackendObservation[]> {
  return getJson<BackendObservation[]>(`/api/cyclones/${encodeURIComponent(id)}/observations`);
}
