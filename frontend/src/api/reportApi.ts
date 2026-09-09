import { getJson } from "./client";
import type { BackendSituationReport } from "@/types/cyclone";

/**
 * Fetches situation report for a cyclone from the backend.
 */
export async function fetchSituationReport(cycloneId: string): Promise<BackendSituationReport> {
  return getJson<BackendSituationReport>(`/api/cyclones/${encodeURIComponent(cycloneId)}/report`);
}
