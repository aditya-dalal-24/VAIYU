import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { HistoricalPanel } from "@/components/dashboard/HistoricalPanel";
import { StageView } from "@/components/dashboard/StageView";
import { Btn, Panel, PanelTitle } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";

export const Route = createFileRoute("/historical")({
  head: () => ({
    meta: [
      { title: "Historical Analogs — CycloVision" },
      { name: "description", content: "Compare the active cyclone with historical storms and replay its track through the time machine." },
      { property: "og:title", content: "Historical Analogs — CycloVision" },
      { property: "og:description", content: "Compare with historical storms and replay tracks through the time machine." },
    ],
  }),
  component: HistoricalPage,
});

function TimeMachine() {
  const { cyclone, replayProgress, setReplayProgress, replaying, setReplaying } = useCyclone();
  const total = cyclone.track.length;
  const index = Math.max(1, Math.min(total, Math.round(replayProgress)));
  const point = cyclone.track[index - 1];

  useEffect(() => {
    if (!replaying) return;
    const id = window.setInterval(() => {
      setReplayProgress(index >= total ? 1 : index + 1);
    }, 700);
    return () => window.clearInterval(id);
  }, [replaying, index, total, setReplayProgress]);

  return (
    <Panel>
      <PanelTitle title="Time Machine" sub={`Replay observed track · ${index}/${total}`} />
      <input
        type="range"
        min={1}
        max={total}
        step={1}
        value={index}
        onChange={(e) => setReplayProgress(Number(e.target.value))}
        className="w-full accent-[var(--amber)]"
      />
      {point ? (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[12px]">
          <div>
            <p className="font-display">{point.t}</p>
            <p className="tech-label mt-1">Timestamp</p>
          </div>
          <div>
            <p className="font-display">
              {point.lat.toFixed(1)}°N {point.lon.toFixed(1)}°E
            </p>
            <p className="tech-label mt-1">Position</p>
          </div>
          <div>
            <p className="font-display">{point.windKph} km/h</p>
            <p className="tech-label mt-1">Wind</p>
          </div>
          <div>
            <p className="font-display">{point.pressureHpa} hPa</p>
            <p className="tech-label mt-1">Pressure</p>
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Btn variant="amber" className="flex-1" onClick={() => setReplaying(!replaying)}>
          {replaying ? "Pause replay" : "Play replay"}
        </Btn>
        <Btn
          onClick={() => {
            setReplaying(false);
            setReplayProgress(total);
          }}
        >
          Reset
        </Btn>
      </div>
    </Panel>
  );
}

function HistoricalPage() {
  return (
    <AppShell>
      <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <HistoricalPanel />
        </div>
        <div className="panel relative min-h-[420px] overflow-hidden lg:min-h-[600px]">
          <StageView />
        </div>
        <TimeMachine />
      </div>
    </AppShell>
  );
}
