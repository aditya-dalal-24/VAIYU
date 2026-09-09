import { Bar, Btn, Panel, PanelTitle, Pill } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";

export function RiskPanel() {
  const { cyclone, setPanel, layers, toggleLayer } = useCyclone();
  const r = cyclone.risk;
  const isAssessed = r.score > 0 || r.regions.length > 0;

  return (
    <Panel>
      <PanelTitle
        title="Risk"
        sub="Landfall Assessment"
        right={
          <Pill tone={!isAssessed ? "muted" : r.level === "LOW" ? "muted" : r.level === "CRITICAL" ? "danger" : "amber"}>
            {isAssessed ? r.level : "UNASSESSED"}
          </Pill>
        }
      />

      <p className="metric-value text-[40px] text-ink">{isAssessed ? r.level : "—"}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="metric-value text-[22px]">{isAssessed ? r.score : "—"}</span>
        <span className="tech-label">/ 100 Risk Score</span>
      </div>
      <div className="mt-2">
        <Bar value={isAssessed ? r.score : 0} />
      </div>

      <div className="mt-4 space-y-2.5 border-t border-border pt-3 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="tech-label">Landfall Probability</span>
          <span className="font-display">{isAssessed ? `${r.landfallProbability}%` : "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tech-label">Prediction Confidence</span>
          <span className="font-display">{isAssessed && r.confidence > 0 ? `${r.confidence}%` : "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tech-label">Coastal Risk</span>
          <span className="font-display">{isAssessed ? r.coastalRisk : "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tech-label">Distance to Coast</span>
          <span className="font-display">{isAssessed && r.distanceToCoastKm > 0 ? `${r.distanceToCoastKm} km` : "—"}</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Btn className="flex-1" onClick={() => setPanel("risk")}>
          Risk Details
        </Btn>
        <Btn variant={layers.risk ? "solid" : "outline"} onClick={() => toggleLayer("risk")}>
          Risk Zone
        </Btn>
      </div>
    </Panel>
  );
}
