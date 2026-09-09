import { lazy, Suspense } from "react";

import { ClientOnly } from "@/components/ui/client-only";
import { useCyclone } from "@/state/cyclone-store";
import { cn } from "@/lib/utils";

const Globe3D = lazy(() => import("@/components/globe/Globe3D"));
const CycloneMap = lazy(() => import("@/components/map/CycloneMap"));

function StageLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <p className="tech-label animate-pulse">{label}</p>
    </div>
  );
}

export function StageView({ className }: { className?: string }) {
  const { cyclone, view, setView } = useCyclone();

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div className="absolute inset-0">
        <ClientOnly fallback={<StageLoading label="Loading cyclone..." />}>
          <Suspense fallback={<StageLoading label={view === "3D" ? "Rendering globe..." : "Loading map..."} />}>
            {view === "3D" ? <Globe3D /> : <CycloneMap />}
          </Suspense>
        </ClientOnly>
      </div>

      {view === "3D" ? (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex flex-col items-center text-center">
          <span className="rounded-full border border-border bg-card/85 px-3 py-1 font-display text-[10px] uppercase tracking-[0.18em]">
            Live Cyclone
          </span>
          <h1 className="metric-value mt-4 text-[42px] text-ink md:text-[56px]">
            {cyclone.name} /<br />
            {(cyclone.basin || "NORTH INDIAN").toUpperCase()}
          </h1>
          <p className="tech-label mt-3">{cyclone.category}</p>
        </div>
      ) : null}

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/90 p-1">
        {(["3D", "2D"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-full px-4 py-1.5 font-display text-[10px] uppercase tracking-[0.16em] transition-colors",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "3D" ? "3D Globe" : "2D Map"}
          </button>
        ))}
      </div>
    </div>
  );
}
