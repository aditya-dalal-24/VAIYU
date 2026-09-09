import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { PredictionPanel } from "@/components/dashboard/PredictionPanel";
import { TrajectoryPanel } from "@/components/dashboard/TrajectoryPanel";
import { RiskPanel } from "@/components/dashboard/RiskPanel";
import { StageView } from "@/components/dashboard/StageView";
import { IntensityChart } from "@/components/dashboard/Charts";

export const Route = createFileRoute("/predictions")({
  head: () => ({
    meta: [
      { title: "Forecast Predictions — CycloVision" },
      { name: "description", content: "6 to 48 hour cyclone trajectory and intensity forecasts with confidence radii and landfall risk." },
      { property: "og:title", content: "Forecast Predictions — CycloVision" },
      { property: "og:description", content: "Trajectory and intensity forecasts with confidence radii and landfall risk." },
    ],
  }),
  component: PredictionsPage,
});

function PredictionsPage() {
  return (
    <AppShell>
      <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <PredictionPanel />
        </div>
        <div className="panel relative min-h-[420px] overflow-hidden lg:min-h-[600px]">
          <StageView />
        </div>
        <div className="space-y-3">
          <TrajectoryPanel />
          <RiskPanel />
        </div>
      </div>
      <div className="mt-3">
        <IntensityChart />
      </div>
    </AppShell>
  );
}
