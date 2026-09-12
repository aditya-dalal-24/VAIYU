/**
 * Wind and pressure against time: observed, then forecast.
 *
 * The boundary between the two is drawn explicitly — a vertical rule at the
 * forecast base — and the forecast series are dashed. A reader should never
 * have to guess which part of a line was measured.
 *
 * Gaps are real gaps: `connectNulls` is off, so a fix without pressure breaks
 * the pressure line instead of drawing a straight segment across missing data.
 */

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Empty } from "@/components/console/primitives";
import { fmtDateTime, fmtPressure, fmtTime, fmtWind } from "@/lib/format";
import type { IntensityPoint, Observation } from "@/lib/types";

interface Row {
  time: number;
  observedWind?: number | null;
  observedPressure?: number | null;
  forecastWind?: number | null;
  forecastPressure?: number | null;
}

export function IntensityChart({
  observations,
  forecast = [],
  baseTime,
  height = 220,
}: {
  observations: Observation[];
  forecast?: IntensityPoint[] | undefined;
  baseTime?: string | null | undefined;
  height?: number | undefined;
}) {
  if (observations.length === 0) {
    return <Empty title="No observations to chart" />;
  }

  const rows = new Map<number, Row>();

  for (const observation of observations) {
    const time = new Date(observation.observedAt).getTime();
    rows.set(time, {
      time,
      observedWind: observation.windSpeedKph,
      observedPressure: observation.pressureHpa,
    });
  }

  for (const point of forecast) {
    const time = new Date(point.forecastAt).getTime();
    const existing = rows.get(time) ?? { time };
    rows.set(time, {
      ...existing,
      forecastWind: point.windSpeedKph,
      forecastPressure: point.pressureHpa,
    });
  }

  // The forecast line must start where the observations end, or it floats
  // disconnected from the storm it belongs to.
  if (forecast.length > 0 && baseTime) {
    const baseMs = new Date(baseTime).getTime();
    const base = rows.get(baseMs);
    if (base) {
      rows.set(baseMs, {
        ...base,
        forecastWind: base.observedWind ?? null,
        forecastPressure: base.observedPressure ?? null,
      });
    }
  }

  const data = [...rows.values()].sort((a, b) => a.time - b.time);
  const baseMs = baseTime ? new Date(baseTime).getTime() : null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          scale="time"
          tickFormatter={(value: number) => fmtTime(new Date(value).toISOString())}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          stroke="var(--border)"
          minTickGap={48}
        />
        <YAxis
          yAxisId="wind"
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          stroke="var(--border)"
          width={44}
          label={{
            value: "km/h",
            position: "insideTopLeft",
            fill: "var(--muted-foreground)",
            fontSize: 9,
            offset: 8,
          }}
        />
        <YAxis
          yAxisId="pressure"
          orientation="right"
          domain={["dataMin - 4", "dataMax + 4"]}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          stroke="var(--border)"
          width={44}
          label={{
            value: "hPa",
            position: "insideTopRight",
            fill: "var(--muted-foreground)",
            fontSize: 9,
            offset: 8,
          }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 11,
          }}
          labelFormatter={(value) => fmtDateTime(new Date(Number(value)).toISOString())}
          formatter={(value, name) => {
            const numeric = typeof value === "number" ? value : Number(value);
            const isPressure = String(name).toLowerCase().includes("pressure");
            return [isPressure ? fmtPressure(numeric) : fmtWind(numeric), String(name)];
          }}
        />
        <Legend
          verticalAlign="top"
          height={22}
          wrapperStyle={{ fontSize: 10, color: "var(--muted-foreground)" }}
        />

        {baseMs ? (
          <ReferenceLine
            yAxisId="wind"
            x={baseMs}
            stroke="var(--model)"
            strokeDasharray="4 3"
            label={{
              value: "forecast base",
              fill: "var(--model)",
              fontSize: 9,
              position: "insideTopRight",
            }}
          />
        ) : null}

        <Line
          yAxisId="wind"
          type="monotone"
          dataKey="observedWind"
          name="Wind (observed)"
          stroke="var(--observed)"
          strokeWidth={1.8}
          dot={false}
          connectNulls={false}
        />
        <Line
          yAxisId="pressure"
          type="monotone"
          dataKey="observedPressure"
          name="Pressure (observed)"
          stroke="var(--muted-foreground)"
          strokeWidth={1.2}
          strokeDasharray="3 2"
          dot={false}
          connectNulls={false}
        />
        <Line
          yAxisId="wind"
          type="monotone"
          dataKey="forecastWind"
          name="Wind (model)"
          stroke="var(--model)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={{ r: 2.5, fill: "var(--model)" }}
          connectNulls
        />
        <Line
          yAxisId="pressure"
          type="monotone"
          dataKey="forecastPressure"
          name="Pressure (model)"
          stroke="var(--primary)"
          strokeWidth={1.4}
          strokeDasharray="2 3"
          dot={{ r: 2, fill: "var(--primary)" }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
