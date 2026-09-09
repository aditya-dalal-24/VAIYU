import { hasBackend } from "@/api/client";
import { useCyclone } from "@/state/cyclone-store";

export function DataSourceStrip() {
  const { cyclone } = useCyclone();
  const items = [
    { l: "Data Source", v: hasBackend ? "Spring Boot REST API" : "Offline" },
    { l: "Basin", v: cyclone.basin || "North Indian" },
    { l: "Category", v: cyclone.category || "Tropical Cyclone" },
    { l: "SST", v: cyclone.sstC !== undefined ? `${cyclone.sstC} °C` : "Pending API" },
    { l: "Humidity", v: cyclone.humidity !== undefined ? `${cyclone.humidity}%` : "Pending API" },
    { l: "Telemetry", v: cyclone.track.length > 0 ? `${cyclone.track.length} points` : "None" },
  ];

  return (
    <div className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-2.5">
      {items.map((i) => (
        <span key={i.l} className="flex items-center gap-2">
          <span className="tech-label">{i.l}</span>
          <span className="font-display text-[11px]">{i.v}</span>
        </span>
      ))}
    </div>
  );
}
