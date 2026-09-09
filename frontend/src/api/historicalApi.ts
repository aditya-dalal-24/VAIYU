import { getJson } from "./client";
import type { BackendSimilarityResult } from "@/types/cyclone";

/**
 * Fetches similar historical cyclone matches from the backend.
 */
export async function fetchHistoricalMatches(cycloneId: string): Promise<BackendSimilarityResult[]> {
  return getJson<BackendSimilarityResult[]>(`/api/cyclones/${encodeURIComponent(cycloneId)}/similar-cyclones`);
}
