import { Panel, PanelTitle, Btn } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";
import { cn } from "@/lib/utils";

export function ActiveCyclones() {
  const { cyclones, selectedId, selectCyclone, loading, error, refetch } = useCyclone();

  return (
    <Panel>
      <PanelTitle title="Active Cyclones" sub={`· ${String(cyclones.length).padStart(2, "0")}`} />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-destructive">
          <p className="font-medium">Failed to load cyclones</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{error}</p>
          <Btn variant="outline" className="mt-2 text-[10px] h-7 px-2" onClick={refetch}>
            Retry
          </Btn>
        </div>
      ) : loading && cyclones.length === 0 ? (
        <div className="py-6 text-center">
          <p className="tech-label animate-pulse">Loading active cyclones from backend...</p>
        </div>
      ) : cyclones.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground">
          <p className="tech-label">No active cyclones currently tracked</p>
          <Btn variant="outline" className="mt-2 text-[10px]" onClick={refetch}>
            Refresh
          </Btn>
        </div>
      ) : (
        <div className="space-y-1.5">
          {cyclones.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCyclone(c.id)}
              className={cn(
                "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                selectedId === c.id ? "border-clay bg-secondary" : "border-border hover:bg-secondary/60",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-[11px] tracking-[0.12em]">{c.name}</span>
                <span className="font-display text-[11px] text-clay">{c.risk?.level ?? "MONITORING"}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {c.basin} · {c.windKph ?? 0} km/h
              </p>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
