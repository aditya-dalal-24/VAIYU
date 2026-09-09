import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { StageView } from "@/components/dashboard/StageView";
import { LeftMetrics, RightMetrics } from "@/components/dashboard/MetricCards";
import { SatellitePanel } from "@/components/dashboard/SatellitePanel";
import { TrajectoryPanel } from "@/components/dashboard/TrajectoryPanel";
import { RiskPanel } from "@/components/dashboard/RiskPanel";
import { PredictionPanel } from "@/components/dashboard/PredictionPanel";
import { ActiveCyclones } from "@/components/dashboard/ActiveCyclones";
import { LayersControl } from "@/components/dashboard/LayersControl";
import { Btn } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CycloVision — Cyclone Intelligence Dashboard" },
      { name: "description", content: "Live cyclone tracking, AI satellite analysis, forecast trajectories and landfall risk in one mission-control dashboard." },
      { property: "og:title", content: "CycloVision — Cyclone Intelligence Dashboard" },
      { property: "og:description", content: "Live cyclone tracking, AI satellite analysis, forecast trajectories and landfall risk." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { setPanel, report, generateReport } = useCyclone();

  return (
    <AppShell>
      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <LeftMetrics />
          <SatellitePanel />
          <ActiveCyclones />
        </div>

        <div className="panel relative min-h-[420px] overflow-hidden lg:min-h-[640px]">
          <StageView />
        </div>

        <div className="space-y-3">
          <RightMetrics />
          <RiskPanel />
          <TrajectoryPanel />
          <LayersControl />
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <PredictionPanel />
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h3 className="text-[15px] font-medium tracking-tight">Situation Report</h3>
            <p className="tech-label mt-0.5">Compile a shareable briefing from current model output</p>
          </div>
          <div className="flex gap-2">
            <Btn onClick={() => setPanel("whatif")}>What-if</Btn>
            <Btn
              variant="amber"
              disabled={report.status === "running"}
              onClick={() => {
                setPanel("report");
                void generateReport();
              }}
            >
              {report.status === "running" ? "Compiling..." : "Generate report"}
            </Btn>
          </div>
        </div>
        <div className="space-y-3">
          <Btn className="w-full" onClick={() => setPanel("alerts")}>
            View alerts
          </Btn>
          <Btn className="w-full" onClick={() => setPanel("historical")}>
            Historical analogs
          </Btn>
        </div>
      </div>
    </AppShell>
  );
}
