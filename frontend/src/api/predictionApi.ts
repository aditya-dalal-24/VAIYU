import { getJson, postJson } from "./client";
import type { BackendPrediction } from "@/types/cyclone";

/**
 * Fetches latest predictions for a cyclone from the backend.
 */
export async function fetchPrediction(cycloneId: string): Promise<BackendPrediction> {
  return getJson<BackendPrediction>(`/api/cyclones/${encodeURIComponent(cycloneId)}/predictions`);
}

/**
 * Triggers a prediction run for a cyclone on the backend.
 */
export async function triggerPrediction(cycloneId: string): Promise<BackendPrediction> {
  return postJson<BackendPrediction>(`/api/cyclones/${encodeURIComponent(cycloneId)}/predict`);
}
