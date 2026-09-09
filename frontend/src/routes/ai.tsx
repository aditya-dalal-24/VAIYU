import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { SatellitePanel } from "@/components/dashboard/SatellitePanel";
import { ExplainPanel } from "@/components/dashboard/ExplainPanel";
import { ActiveCyclones } from "@/components/dashboard/ActiveCyclones";
import { IntensityChart, ConfidenceChart } from "@/components/dashboard/Charts";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "AI Analysis — CycloVision" },
      { name: "description", content: "Satellite cyclone detection, Grad-CAM heatmaps, model confidence and feature importance." },
      { property: "og:title", content: "AI Analysis — CycloVision" },
      { property: "og:description", content: "Satellite detection, Grad-CAM heatmaps and explainable model drivers." },
    ],
  }),
  component: AiPage,
});

function AiPage() {
  return (
    <AppShell>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
        <SatellitePanel />
        <ExplainPanel />
        <ActiveCyclones />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <IntensityChart />
        <ConfidenceChart />
      </div>
    </AppShell>
  );
}
