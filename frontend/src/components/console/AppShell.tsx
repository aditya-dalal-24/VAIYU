/**
 * The console chrome: a single thin rail across the top, and nothing else.
 *
 * There is no sidebar and no card grid. Every screen here is a working surface
 * — usually a map with docked panels — so the chrome takes 40 pixels and gets
 * out of the way. The rail's right-hand side reports which models are actually
 * loaded, because that governs what any screen can show.
 */

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useSystemStatus } from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Mission Control" },
  { to: "/explorer", label: "Explorer" },
  { to: "/satellite", label: "Satellite" },
  { to: "/system", label: "System" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <TopRail />
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

function TopRail() {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-4 border-b border-border bg-[var(--surface)] px-3">
      <div className="flex min-w-0 items-center gap-4">
        <Link to="/" className="flex items-center gap-2">
          <Mark />
          <span className="font-display text-[0.8125rem] font-semibold tracking-tight">
            VAIYU
          </span>
          <span className="label-xs hidden sm:inline">Cyclone Intelligence</span>
        </Link>
        <nav className="flex items-center gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
              activeProps={{ className: "active" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <ModelRail />
    </header>
  );
}

/** A stylised eye and spiral bands: readable at 16 px, no gradients. */
function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="2.1" fill="var(--primary)" />
      <path
        d="M12 3.2c4.2 0 6.6 2.3 6.6 5.1 0 2.2-1.8 3.7-4 3.7"
        fill="none"
        stroke="var(--observed)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 20.8c-4.2 0-6.6-2.3-6.6-5.1 0-2.2 1.8-3.7 4-3.7"
        fill="none"
        stroke="var(--observed)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Model availability, always visible. If the AI service is down or a model has
 * no checkpoint, that is the first thing an operator needs to know.
 */
function ModelRail() {
  const { data, isLoading } = useSystemStatus();

  if (isLoading) {
    return <span className="label-xs">Checking models…</span>;
  }

  if (!data || !data.ai.reachable) {
    return (
      <Link to="/system" className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden />
        <span className="label-xs text-destructive">AI service offline</span>
      </Link>
    );
  }

  const models = data.ai.models ?? {};
  const order = ["trajectory", "intensity", "similarity", "satellite"] as const;
  const short: Record<string, string> = {
    trajectory: "Track",
    intensity: "Intensity",
    similarity: "Analogues",
    satellite: "Satellite",
  };

  return (
    <Link to="/system" className="flex items-center gap-3" title="Model availability">
      {order
        .flatMap((key) => {
          const model = models[key];
          return model ? [{ key, model }] : [];
        })
        .map(({ key, model }) => {
          const ready = model.available;
          return (
            <span key={key} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  ready ? "bg-model" : "bg-absent",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "label-xs",
                  ready ? "text-foreground/70" : "text-absent",
                )}
              >
                {short[key] ?? key}
              </span>
            </span>
          );
        })}
    </Link>
  );
}
