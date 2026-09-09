import { useState } from "react";
import { X } from "lucide-react";

import { Bar, Btn, Pill } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4 backdrop-blur-sm">
      <div className="panel max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-medium tracking-tight">{title}</h2>
            {sub ? <p className="tech-label mt-1">{sub}</p> : null}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full border border-border p-1.5 hover:bg-secondary">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-[12px] last:border-0">
      <span className="tech-label">{l}</span>
      <span className="font-display">{v}</span>
    </div>
  );
}

export function Modals() {
  const { panel, setPanel, cyclone, report, generateReport, compareId, setCompareId } = useCyclone();
  const [windDelta, setWindDelta] = useState(0);
  const [sstDelta, setSstDelta] = useState(0);

  if (!panel) return null;
  const close = () => setPanel(null);
  const r = cyclone.risk;

  if (panel === "risk") {
    const isAssessed = r.score > 0 || r.regions.length > 0;
    return (
      <Modal title="Risk Assessment" sub={`${cyclone.name} · landfall analysis`} onClose={close}>
        {isAssessed ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="metric-value text-[44px] text-ink">{r.score}</span>
              <Pill tone={r.level === "LOW" ? "muted" : r.level === "CRITICAL" ? "danger" : "amber"}>{r.level}</Pill>
            </div>
            <div className="mt-3">
              <Bar value={r.score} />
            </div>
            <div className="mt-4">
              <Row l="Landfall Probability" v={`${r.landfallProbability}%`} />
              <Row l="Prediction Confidence" v={`${r.confidence}%`} />
              <Row l="Coastal Risk" v={r.coastalRisk} />
              <Row l="Distance to Coast" v={`${r.distanceToCoastKm} km`} />
              <Row l="Affected Regions" v={r.regions.join(", ")} />
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">{r.explanation}</p>
          </>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p className="tech-label">No risk assessment has been computed yet for this system.</p>
          </div>
        )}
      </Modal>
    );
  }

  if (panel === "historical") {
    return (
      <Modal title="Historical Comparison" sub="Closest analog cyclones" onClose={close}>
        <div className="space-y-2">
          {cyclone.historical.length === 0 ? (
            <p className="tech-label py-6 text-center text-muted-foreground">No historical analogs computed yet</p>
          ) : (
            cyclone.historical.map((h) => (
              <button
                key={h.id}
                onClick={() => setCompareId(compareId === h.id ? null : h.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  compareId === h.id ? "border-clay bg-secondary" : "border-border hover:bg-secondary/60",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-[13px] tracking-[0.08em]">
                    {h.name} · {h.year}
                  </span>
                  <span className="font-display text-[12px] text-clay">{h.similarity}%</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {h.intensity} · {h.windKph} km/h · {h.pressureHpa} hPa · landfall {h.landfall}
                </p>
                <p className="mt-1 text-[11px]">{h.impact}</p>
                <div className="mt-2">
                  <Bar value={h.similarity} />
                </div>
              </button>
            ))
          )}
        </div>
        <p className="tech-label mt-3">Selected analog overlays on the globe and map</p>
      </Modal>
    );
  }

  if (panel === "alerts") {
    return (
      <Modal title="Alerts" sub={`${cyclone.alerts.length} active notifications`} onClose={close}>
        <div className="space-y-2">
          {cyclone.alerts.length === 0 ? (
            <p className="tech-label py-6 text-center text-muted-foreground">No active advisories or warnings issued</p>
          ) : (
            cyclone.alerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
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
      </Modal>
    );
  }

  if (panel === "report") {
    return (
      <Modal title="Situation Report" sub={`${cyclone.name} · auto-generated`} onClose={close}>
        {report.status === "done" ? (
          <>
            <pre className="max-h-[45vh] overflow-auto rounded-xl border border-border bg-secondary/50 p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
              {report.text}
            </pre>
            <div className="mt-3 flex gap-2">
              <Btn onClick={() => void navigator.clipboard.writeText(report.text)}>Copy report</Btn>
              <Btn variant="amber" onClick={() => void generateReport()}>
                Regenerate
              </Btn>
            </div>
          </>
        ) : (
          <div className="py-6 text-center">
            <p className="tech-label mb-4">{report.status === "running" ? "Compiling report..." : "No report generated yet"}</p>
            <Btn variant="amber" disabled={report.status === "running"} onClick={() => void generateReport()}>
              Generate report
            </Btn>
          </div>
        )}
      </Modal>
    );
  }

  const projectedWind = Math.max(0, cyclone.windKph + windDelta + sstDelta * 6);
  const projectedScore = Math.max(0, Math.min(100, Math.round(r.score + windDelta * 0.25 + sstDelta * 4)));

  return (
    <Modal title="What-If Simulation" sub="Adjust drivers to see projected outcome" onClose={close}>
      <div className="space-y-5">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="tech-label">Wind speed delta</span>
            <span className="font-display">
              {windDelta > 0 ? "+" : ""}
              {windDelta} km/h
            </span>
          </div>
          <input
            type="range"
            min={-60}
            max={60}
            step={5}
            value={windDelta}
            onChange={(e) => setWindDelta(Number(e.target.value))}
            className="w-full accent-[var(--amber)]"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="tech-label">Sea surface temp delta</span>
            <span className="font-display">
              {sstDelta > 0 ? "+" : ""}
              {sstDelta} °C
            </span>
          </div>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.5}
            value={sstDelta}
            onChange={(e) => setSstDelta(Number(e.target.value))}
            className="w-full accent-[var(--amber)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <div>
            <p className="metric-value text-[30px] text-ink">{Math.round(projectedWind)}</p>
            <p className="tech-label mt-1">Projected Wind (km/h)</p>
          </div>
          <div>
            <p className="metric-value text-[30px] text-ink">{projectedScore}</p>
            <p className="tech-label mt-1">Projected Risk Score</p>
          </div>
        </div>
        <Bar value={projectedScore} />
        <p className="text-[11px] text-muted-foreground">
          Simulation is a frontend sensitivity view based on the current model output; it does not modify backend
          forecasts.
        </p>
      </div>
    </Modal>
  );
}
