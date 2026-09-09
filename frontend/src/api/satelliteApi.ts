import { postJson } from "./client";
import type { BackendAiAnalysisResult } from "@/types/cyclone";

/**
 * Executes AI satellite analysis for a cyclone on the backend.
 */
export async function runSatelliteAnalysis(cycloneId: string, imageId = "sat-default"): Promise<BackendAiAnalysisResult> {
  return postJson<BackendAiAnalysisResult>("/api/satellite/analyze", {
    cycloneId,
    imageId,
  });
}
