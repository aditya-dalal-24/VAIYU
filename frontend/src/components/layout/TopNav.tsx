import { Link } from "@tanstack/react-router";
import { Bell, UserRound } from "lucide-react";

import { useCyclone } from "@/state/cyclone-store";
import { Pill } from "@/components/ui/primitives";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/map", label: "Live Map" },
  { to: "/ai", label: "AI Analysis" },
  { to: "/predictions", label: "Predictions" },
  { to: "/historical", label: "Historical" },
  { to: "/alerts", label: "Alerts" },
] as const;

export function TopNav() {
  const { cyclone, live, setPanel } = useCyclone();

  return (
    <header className="panel mx-auto flex w-full items-center justify-between gap-6 px-5 py-3">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="grid grid-cols-2 gap-[2px]">
          <span className="h-2 w-2 rounded-[2px] bg-ink" />
          <span className="h-2 w-2 rounded-full bg-amber" />
          <span className="h-2 w-2 rounded-full bg-amber" />
          <span className="h-2 w-2 rounded-[2px] bg-ink" />
        </span>
        <span className="font-display text-sm font-medium tracking-[0.18em]">CYCLOVISION</span>
      </Link>

      <nav className="hidden items-center gap-7 lg:flex">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="font-display text-[12px] tracking-tight text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <span className="hidden font-display text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
          UPD: {cyclone.updatedSecondsAgo}s ago
        </span>
        {live ? <Pill tone="amber">Live ●</Pill> : <Pill tone="muted">Demo Mode</Pill>}
        <button
          onClick={() => setPanel("alerts")}
          aria-label="Open alerts"
          className="relative rounded-full border border-border p-1.5 hover:bg-secondary"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>
        <span className="rounded-full border border-border bg-secondary p-1.5">
          <UserRound className="h-3.5 w-3.5" />
        </span>
      </div>
    </header>
  );
}
