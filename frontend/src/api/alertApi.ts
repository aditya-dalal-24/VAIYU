import { getJson } from "./client";
import type { BackendAlert } from "@/types/cyclone";

/**
 * Fetches all active alerts from the backend.
 */
export async function fetchAlerts(): Promise<BackendAlert[]> {
  return getJson<BackendAlert[]>("/api/alerts");
}
