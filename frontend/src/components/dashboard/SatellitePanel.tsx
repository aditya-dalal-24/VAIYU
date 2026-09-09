import { useState } from "react";

import satImg from "@/assets/satellite-cyclone.jpg";
import gradcamImg from "@/assets/satellite-gradcam.jpg";
import { Btn, Panel, PanelTitle, Pill } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";
import { cn } from "@/lib/utils";

const CHANNELS = ["Visible", "Infrared", "Water Vapor"] as const;

export function SatellitePanel() {
  const { cyclone, satellite, runAnalysis, setSatelliteView } = useCyclone();
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("Infrared");
  const result = satellite.result ?? cyclone.satellite;
  const running = satellite.status === "running";

  return (
    <Panel>
      <PanelTitle title="Satellite Vision" sub="AI — Live Analysis" right={<Pill tone="amber">{channel}</Pill>} />

      <div className="mb-3 flex gap-1">
        {CHANNELS.map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={cn(
              "rounded-full px-2.5 py-1 font-display text-[9px] uppercase tracking-[0.14em] transition-colors",
              channel === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border">
        <img
          src={satellite.view === "heatmap" && result.gradcamAvailable ? gradcamImg : satImg}
          alt={`Satellite ${channel} view of cyclone ${cyclone.name}`}
          loading="lazy"
          width={1024}
          height={1024}
          className={cn(
            "h-36 w-full object-cover transition-all duration-500",
            channel === "Visible" && "grayscale-[0.2]",
            channel === "Water Vapor" && "hue-rotate-[18deg] contrast-125",
            running && "animate-pulse",
          )}
        />
        {running ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <p className="tech-label">{satellite.step}</p>
          </div>
        ) : null}
      </div>

      {result.gradcamAvailable ? (
        <div className="mt-2 flex gap-1">
          {(["original", "heatmap"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setSatelliteView(v)}
              className={cn(
                "flex-1 rounded-full px-2 py-1 font-display text-[9px] uppercase tracking-[0.14em]",
                satellite.view === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {v === "original" ? "Original" : "AI Heatmap"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="tech-label">Cyclone Detected</span>
          <span>{result.detected ? "✓" : "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tech-label">Eye Formed</span>
          <span>{result.eyeFormed ? "✓" : "—"}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <div>
          <p className="metric-value text-[24px]">
            {result.structureScore > 0 ? `${result.structureScore}%` : "—"}
          </p>
          <p className="tech-label mt-1">Structure</p>
        </div>
        <div>
          <p className="metric-value text-[24px]">
            {result.confidence > 0 ? `${result.confidence}%` : "—"}
          </p>
          <p className="tech-label mt-1">Confidence</p>
        </div>
      </div>

      <p className="mt-2 font-display text-[11px] tracking-tight text-muted-foreground">
        {result.classification}
      </p>

      <Btn variant="solid" className="mt-3 w-full" onClick={runAnalysis} disabled={running}>
        {running ? satellite.step : satellite.status === "done" ? "Analysis Complete · Rerun" : "Run AI Analysis"}
      </Btn>
    </Panel>
  );
}
