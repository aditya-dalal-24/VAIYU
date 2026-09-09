import { Btn, Panel, PanelTitle } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";
import { cn } from "@/lib/utils";

export function HistoricalPanel() {
  const { cyclone, compareId, setCompareId, setPanel } = useCyclone();
  const top = cyclone.historical[0];

  return (
    <Panel>
      <PanelTitle title="Historical Similarity" sub="Top 3 analogs" />

      {top ? (
        <>
          <p className="metric-value text-[34px] text-ink">{top.similarity}%</p>
          <p className="tech-label mt-1">Similarity</p>
        </>
      ) : null}

      {cyclone.historical.length === 0 ? (
        <p className="tech-label py-4 text-center text-muted-foreground">No historical analogs computed yet</p>
      ) : null}

      <div className="mt-3 space-y-1.5">
        {cyclone.historical.map((h) => (
          <button
            key={h.id}
            onClick={() => setCompareId(compareId === h.id ? null : h.id)}
            className={cn(
              "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
              compareId === h.id ? "border-clay bg-secondary" : "border-border hover:bg-secondary/60",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-[11px] tracking-[0.1em]">{h.name}</span>
              <span className="font-display text-[11px] text-clay">{h.similarity}%</span>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {h.year} · {h.intensity} · {h.landfall}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Btn className="flex-1" onClick={() => setCompareId(compareId ?? cyclone.historical[0]?.id ?? null)}>
          Compare
        </Btn>
        <Btn variant="ghost" onClick={() => setPanel("historical")}>
          Open
        </Btn>
      </div>
    </Panel>
  );
}
