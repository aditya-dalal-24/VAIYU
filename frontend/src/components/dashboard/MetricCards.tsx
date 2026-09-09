import { useCyclone } from "@/state/cyclone-store";
import { Panel } from "@/components/ui/primitives";

function Metric({ value, unit, label }: { value: string; unit?: string | undefined; label: string }) {
  return (
    <div>
      <p className="metric-value text-[30px] text-ink">
        {value}
        {unit && value !== "—" ? <span className="ml-1 align-top text-[10px] tracking-[0.12em] text-muted-foreground">{unit}</span> : null}
      </p>
      <p className="tech-label mt-1.5">{label}</p>
    </div>
  );
}

export function LeftMetrics() {
  const { cyclone } = useCyclone();
  const hasObservation = cyclone.windKph > 0 || cyclone.pressureHpa > 0 || cyclone.lat !== 0 || cyclone.lon !== 0;

  return (
    <Panel className="grid grid-cols-2 gap-4">
      <Metric value={cyclone.windKph > 0 ? String(cyclone.windKph) : "—"} unit="KM/H" label="Wind Speed" />
      <Metric value={cyclone.pressureHpa > 0 ? String(cyclone.pressureHpa) : "—"} unit="HPA" label="Central Pressure" />
      <div className="col-span-2 border-t border-border pt-3">
        {hasObservation ? (
          <>
            <p className="font-display text-[13px] tracking-tight">
              {cyclone.lat.toFixed(1)}°N · {cyclone.lon.toFixed(1)}°E
            </p>
            <p className="tech-label mt-1">
              Current Position · {cyclone.movementDir !== "—" ? `${cyclone.movementDir} ${cyclone.movementKph} km/h` : "Stationary"}
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-[13px] tracking-tight text-muted-foreground">Coordinates Unavailable</p>
            <p className="tech-label mt-1">No telemetry observations in database for this cyclone</p>
          </>
        )}
      </div>
    </Panel>
  );
}

export function RightMetrics() {
  const { cyclone, setPanel } = useCyclone();
  const hasRisk = cyclone.risk.score > 0;

  return (
    <Panel className="grid grid-cols-2 gap-4">
      <button onClick={() => setPanel("risk")} className="text-left">
        <Metric value={hasRisk ? `${cyclone.risk.score}` : "—"} unit={hasRisk ? "/100" : undefined} label="Risk Score" />
      </button>
      <Metric value={hasRisk && cyclone.risk.confidence > 0 ? `${cyclone.risk.confidence}` : "—"} unit={hasRisk ? "%" : undefined} label="Prediction Confidence" />
      <div className="col-span-2 grid grid-cols-2 gap-4 border-t border-border pt-3">
        <div>
          <p className="font-display text-[13px]">{hasRisk ? cyclone.risk.level : "UNASSESSED"}</p>
          <p className="tech-label mt-1">Landfall Risk</p>
        </div>
        <div>
          <p className="font-display text-[13px]">{hasRisk ? cyclone.risk.coastalRisk : "UNASSESSED"}</p>
          <p className="tech-label mt-1">Coastal Risk</p>
        </div>
      </div>
    </Panel>
  );
}
