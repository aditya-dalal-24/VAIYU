import { getJson } from "./client";
import type { BackendRiskAssessment } from "@/types/cyclone";

/**
 * Fetches risk assessment for a specific cyclone from the backend.
 */
export async function fetchRisk(cycloneId: string): Promise<BackendRiskAssessment> {
  return getJson<BackendRiskAssessment>(`/api/cyclones/${encodeURIComponent(cycloneId)}/risk`);
}
