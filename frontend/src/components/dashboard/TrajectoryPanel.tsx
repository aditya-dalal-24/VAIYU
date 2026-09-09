import { Btn, Panel, PanelTitle } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";

export function TrajectoryPanel() {
  const { cyclone, runPrediction, focusGlobe, setFocusHour, layers, toggleLayer } = useCyclone();
  const pts = cyclone.forecast;
  const windValues = [cyclone.windKph, ...pts.map((p) => p.windKph)].filter((w) => w > 0);
  const maxW = windValues.length > 0 ? Math.max(...windValues) : 120;
  const hasTrajectory = pts.length > 0;

  return (
    <Panel>
      <PanelTitle
        title="Trajectory"
        sub={cyclone.movementDir !== "—" ? `${cyclone.movementDir} · ${cyclone.movementKph} km/h` : "Stationary / Track Pending"}
      />

      <div className="flex h-20 items-end gap-1.5">
        {[{ hour: 0, windKph: cyclone.windKph }, ...pts].map((p) => (
          <button
            key={p.hour}
            onClick={() => setFocusHour(p.hour === 0 ? null : p.hour)}
            className="group flex flex-1 flex-col items-center gap-1"
          >
            <span
              className="w-full rounded-t-sm bg-clay/70 transition-all group-hover:bg-amber"
              style={{ height: `${maxW > 0 ? Math.max(4, (p.windKph / maxW) * 58) : 4}px` }}
            />
            <span className="tech-label">{p.hour === 0 ? "NOW" : `+${p.hour}`}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[11px]">
        <div>
          <p className="font-display text-[13px]">
            {cyclone.track.length > 1 ? `${cyclone.track.length} points` : "Single point"}
          </p>
          <p className="tech-label mt-1">Observed History</p>
        </div>
        <div>
          <p className="font-display text-[13px]">
            {hasTrajectory ? `${pts.length} steps` : "Pending"}
          </p>
          <p className="tech-label mt-1">Forecast Ensemble</p>
        </div>
      </div>

      <Btn
        className="mt-3 w-full"
        onClick={() => {
          if (!layers.prediction) toggleLayer("prediction");
          if (!layers.corridor) toggleLayer("corridor");
          focusGlobe();
          void runPrediction();
        }}
      >
        View Forecast
      </Btn>
    </Panel>
  );
}
