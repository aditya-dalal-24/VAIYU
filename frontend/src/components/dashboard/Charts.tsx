import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Panel, PanelTitle } from "@/components/ui/primitives";
import { useCyclone } from "@/state/cyclone-store";

const axis = { stroke: "var(--muted-foreground)", fontSize: 9 } as const;

export function IntensityChart() {
  const { cyclone } = useCyclone();
  const hasSeries = cyclone.series && cyclone.series.length > 0 && cyclone.series.some((s) => s.wind > 0 || s.pressure > 0);

  return (
    <Panel>
      <PanelTitle title="Intensity Timeline" sub="Observed wind speed & central pressure" />
      <div className="h-44 w-full">
        {hasSeries ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cyclone.series} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="t" tick={axis} tickLine={false} axisLine={false} />
              <YAxis tick={axis} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  fontSize: 11,
                }}
              />
              <Line type="monotone" dataKey="wind" name="Wind (km/h)" stroke="var(--amber)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pressure" name="Pressure (hPa)" stroke="var(--primary)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center">
            <p className="tech-label text-muted-foreground">No historical observation telemetry available to plot</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function ConfidenceChart() {
  const { cyclone } = useCyclone();
  const hasData = cyclone.series && cyclone.series.length > 0 && cyclone.series.some((s) => s.confidence > 0);

  return (
    <Panel>
      <PanelTitle title="Model Trajectory Confidence" sub="Certainty across observation steps" />
      <div className="h-44 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cyclone.series} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="t" tick={axis} tickLine={false} axisLine={false} />
              <YAxis tick={axis} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="confidence"
                name="Confidence (%)"
                stroke="var(--amber)"
                fill="var(--amber)"
                fillOpacity={0.18}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center">
            <p className="tech-label text-muted-foreground">Ensemble confidence uncomputed for current system</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
