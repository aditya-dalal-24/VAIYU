import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { ActiveCyclones } from "@/components/dashboard/ActiveCyclones";
import { Btn, Panel, PanelTitle, Pill } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Cyclone Alerts — CycloVision" },
      { name: "description", content: "Warnings, watches and advisories issued for the active cyclone, with a one-click situation report." },
      { property: "og:title", content: "Cyclone Alerts — CycloVision" },
      { property: "og:description", content: "Warnings, watches and advisories for the active cyclone." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const { cyclone, setPanel, generateReport, report } = useCyclone();

  return (
    <AppShell>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel>
          <PanelTitle
            title="Alert Feed"
            sub={`${cyclone.name} · ${cyclone.alerts.length} notifications`}
            right={<Pill tone="amber">{cyclone.risk.level}</Pill>}
          />
          <div className="space-y-2">
            {cyclone.alerts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="tech-label">No active warning or watch advisories issued</p>
              </div>
            ) : (
              cyclone.alerts.map((a) => (
                <div key={a.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-[12px] tracking-[0.08em]">{a.title}</span>
                    <Pill tone={a.severity === "CRITICAL" ? "danger" : a.severity === "INFO" ? "muted" : "amber"}>
                      {a.severity}
                    </Pill>
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted-foreground">{a.message}</p>
                  <p className="tech-label mt-1.5">{a.time}</p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel>
            <PanelTitle title="Actions" sub="Briefings & assessment" />
            <div className="space-y-2">
              <Btn
                variant="amber"
                className="w-full"
                disabled={report.status === "running"}
                onClick={() => {
                  setPanel("report");
                  void generateReport();
                }}
              >
                {report.status === "running" ? "Compiling..." : "Generate report"}
              </Btn>
              <Btn className="w-full" onClick={() => setPanel("risk")}>
                Risk details
              </Btn>
              <Btn className="w-full" onClick={() => setPanel("whatif")}>
                What-if simulation
              </Btn>
            </div>
          </Panel>
          <ActiveCyclones />
        </div>
      </div>
    </AppShell>
  );
}
