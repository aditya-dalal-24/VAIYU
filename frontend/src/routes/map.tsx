import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { StageView } from "@/components/dashboard/StageView";
import { LayersControl } from "@/components/dashboard/LayersControl";
import { ActiveCyclones } from "@/components/dashboard/ActiveCyclones";
import { LeftMetrics } from "@/components/dashboard/MetricCards";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Live Cyclone Map — CycloVision" },
      { name: "description", content: "Interactive 2D and 3D cyclone map with wind particles, tracks, forecast corridor and risk zones." },
      { property: "og:title", content: "Live Cyclone Map — CycloVision" },
      { property: "og:description", content: "Interactive cyclone map with wind particles, tracks and risk zones." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  return (
    <AppShell>
      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3">
          <ActiveCyclones />
          <LayersControl />
          <LeftMetrics />
        </div>
        <div className="panel relative min-h-[520px] overflow-hidden lg:min-h-[720px]">
          <StageView />
        </div>
      </div>
    </AppShell>
  );
}
