import { Bar, Panel, PanelTitle } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";

export function ExplainPanel() {
  const { cyclone } = useCyclone();
  const e = cyclone.explain;

  return (
    <Panel>
      <PanelTitle title="Explainable AI" sub="Model confidence & drivers" />

      <div className="grid grid-cols-4 gap-3 border-b border-border pb-3">
        {[
          { l: "Classification", v: `${e.classification}%` },
          { l: "Trajectory", v: `${e.trajectory}%` },
          { l: "Intensity", v: `${e.intensity}%` },
          { l: "Risk", v: `${e.risk}/100` },
        ].map((m) => (
          <div key={m.l}>
            <p className="metric-value text-[20px]">{m.v}</p>
            <p className="tech-label mt-1">{m.l}</p>
          </div>
        ))}
      </div>

      <p className="tech-label mt-3">Feature Importance</p>
      <div className="mt-2 space-y-2">
        {e.features.map((f) => (
          <div key={f.name}>
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="tech-label">{f.name}</span>
              <span className="font-display">{f.weight}%</span>
            </div>
            <Bar value={f.weight} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
