import { Btn, Panel, PanelTitle } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";
import { cn } from "@/lib/utils";

export function PredictionPanel() {
  const { cyclone, prediction, setPredictionTab, runPrediction, focusHour, setFocusHour } = useCyclone();
  const running = prediction.status === "running";
  const points = prediction.points.length > 0 ? prediction.points : cyclone.forecast;
  const shown =
    prediction.status === "idle"
      ? points
      : points.filter((f) => prediction.revealedHours.includes(f.hour));

  return (
    <Panel>
      <PanelTitle title="Prediction" sub={running ? "Executing forecast models..." : "Model output"} />

      <div className="mb-3 flex gap-1">
        {(["trajectory", "intensity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setPredictionTab(t)}
            className={cn(
              "flex-1 rounded-full px-2 py-1 font-display text-[9px] uppercase tracking-[0.14em]",
              prediction.tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {prediction.tab === "trajectory" ? (
        <div className="space-y-1.5">
          {shown.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <p className="tech-label">No forecast points generated yet</p>
              <p className="mt-1 text-[10px]">Click Predict to execute forecast models</p>
            </div>
          ) : (
            shown.map((f) => (
              <button
                key={f.hour}
                onClick={() => setFocusHour(focusHour === f.hour ? null : f.hour)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors",
                  focusHour === f.hour ? "border-clay bg-secondary" : "border-border hover:bg-secondary/60",
                )}
              >
                <span className="font-display tracking-[0.12em]">+{f.hour}H</span>
                <span>
                  {f.lat.toFixed(1)}°N {f.lon.toFixed(1)}°E
                </span>
                <span className="text-muted-foreground">±{f.confidenceRadiusKm} km</span>
              </button>
            ))
          )}
          {running && shown.length < points.length ? (
            <p className="tech-label animate-pulse pt-1">Running trajectory ensemble...</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between rounded-lg border border-border px-2.5 py-2">
            <span className="font-display tracking-[0.12em]">CURRENT</span>
            <span>{cyclone.category ? cyclone.category.replace(" CYCLONIC STORM", "") : "UNCLASSIFIED"}</span>
          </div>
          {points.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground">
              <p className="tech-label">No intensity forecast available</p>
            </div>
          ) : (
            points.map((f) => (
              <div key={f.hour} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-2">
                <span className="font-display tracking-[0.12em]">+{f.hour}H</span>
                <span>{f.windKph > 0 ? `${f.windKph} km/h` : "—"}</span>
                <span className="text-clay">
                  {f.intensityTrend} {f.intensityTrend === "INTENSIFY" ? "↑" : f.intensityTrend === "WEAKEN" ? "↓" : "→"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <Btn variant="amber" className="mt-3 w-full" onClick={() => void runPrediction()} disabled={running}>
        {running ? "Generating forecast..." : "Predict"}
      </Btn>
    </Panel>
  );
}
