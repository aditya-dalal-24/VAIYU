/**
 * The storm's life as one draggable band.
 *
 * Dragging moves the selected fix, and everything else on screen follows it —
 * map position, measurements, and the forecast base. It is drawn as SVG rather
 * than with a chart library because a scrubber needs exact hit targets and
 * keyboard control, which a chart's tooltip layer fights.
 *
 * Wind is the filled area, pressure the thin line, and each is drawn only where
 * it exists: a fix without pressure breaks the pressure line rather than having
 * a value interpolated across it.
 */

import { useCallback, useMemo, useRef } from "react";

import { categoryColor, fmtDateTime, fmtPressure, fmtWind } from "@/lib/format";
import type { Observation } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEIGHT = 74;
const TOP = 10;
const BOTTOM = 16;
const PLOT = HEIGHT - TOP - BOTTOM;

interface Placed {
  observation: Observation;
  time: number;
  x: number;
  windY: number | null;
  pressureY: number | null;
}

export function TrackTimeline({
  observations,
  selectedTime,
  baseTime,
  onSelect,
  className,
}: {
  observations: Observation[];
  selectedTime: string | null;
  baseTime?: string | null | undefined;
  onSelect: (observation: Observation) => void;
  className?: string | undefined;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  const placed = useMemo<Placed[]>(() => {
    if (observations.length === 0) return [];

    const times = observations.map((o) => new Date(o.observedAt).getTime());
    const start = Math.min(...times);
    const end = Math.max(...times);
    const span = Math.max(1, end - start);

    const winds = observations
      .map((o) => o.windSpeedKph)
      .filter((value): value is number => value !== null);
    const pressures = observations
      .map((o) => o.pressureHpa)
      .filter((value): value is number => value !== null);

    const maxWind = winds.length > 0 ? Math.max(...winds) : 0;
    const minPressure = pressures.length > 0 ? Math.min(...pressures) : 0;
    const maxPressure = pressures.length > 0 ? Math.max(...pressures) : 0;

    return observations.map((observation, index) => {
      const time = times[index] ?? start;
      const wind = observation.windSpeedKph;
      const pressure = observation.pressureHpa;
      return {
        observation,
        time,
        x: ((time - start) / span) * 100,
        windY: wind === null || maxWind <= 0 ? null : TOP + PLOT - (wind / maxWind) * PLOT,
        pressureY:
          pressure === null
            ? null
            : maxPressure === minPressure
              ? TOP + PLOT / 2
              : // Inverted, so a deepening low rises on the band.
                TOP + ((pressure - minPressure) / (maxPressure - minPressure)) * PLOT,
      };
    });
  }, [observations]);

  const pick = useCallback(
    (clientX: number) => {
      if (placed.length === 0 || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const targetX = ratio * 100;
      let closest = placed[0] as Placed;
      let distance = Infinity;
      for (const candidate of placed) {
        const delta = Math.abs(candidate.x - targetX);
        if (delta < distance) {
          distance = delta;
          closest = candidate;
        }
      }
      onSelect(closest.observation);
    },
    [placed, onSelect],
  );

  const step = useCallback(
    (direction: -1 | 1) => {
      if (placed.length === 0) return;
      const current = placed.findIndex((item) => item.observation.observedAt === selectedTime);
      const next = Math.min(
        placed.length - 1,
        Math.max(0, (current === -1 ? 0 : current) + direction),
      );
      const target = placed[next];
      if (target) onSelect(target.observation);
    },
    [placed, selectedTime, onSelect],
  );

  if (placed.length === 0) {
    return (
      <div className={cn("panel flex h-[74px] items-center justify-center", className)}>
        <span className="label-xs">No track to scrub</span>
      </div>
    );
  }

  const first = placed[0] as Placed;
  const last = placed[placed.length - 1] as Placed;

  const windPath = placed
    .filter((item): item is Placed & { windY: number } => item.windY !== null)
    .map((item) => `${item.x},${item.windY}`);
  const pressurePath = placed
    .filter((item): item is Placed & { pressureY: number } => item.pressureY !== null)
    .map((item) => `${item.x},${item.pressureY}`);

  const selected = placed.find((item) => item.observation.observedAt === selectedTime) ?? null;
  const base = baseTime
    ? (placed.find((item) => item.observation.observedAt === baseTime) ?? null)
    : null;

  return (
    <div className={cn("panel relative overflow-hidden", className)}>
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex items-center gap-3">
          <span className="label-xs">Lifecycle</span>
          <span className="num text-[0.6875rem] text-muted-foreground">
            {placed.length} fixes · {fmtDateTime(first.observation.observedAt)} →{" "}
            {fmtDateTime(last.observation.observedAt)}
          </span>
        </div>
        {selected ? (
          <div className="flex items-center gap-3">
            <span className="num text-[0.6875rem] text-observed">
              {fmtDateTime(selected.observation.observedAt)}
            </span>
            <span
              className="num text-[0.6875rem]"
              style={{ color: categoryColor(selected.observation.categoryRank) }}
            >
              {fmtWind(selected.observation.windSpeedKph)}
            </span>
            <span className="num text-[0.6875rem] text-muted-foreground">
              {fmtPressure(selected.observation.pressureHpa)}
            </span>
          </div>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 100 ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-[74px] w-full cursor-ew-resize touch-none"
        role="slider"
        tabIndex={0}
        aria-label="Storm lifecycle"
        aria-valuetext={selected ? fmtDateTime(selected.observation.observedAt) : undefined}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pick(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) pick(event.clientX);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          }
        }}
      >
        {windPath.length > 1 ? (
          <>
            <polygon
              points={`${first.x},${HEIGHT - BOTTOM} ${windPath.join(" ")} ${last.x},${HEIGHT - BOTTOM}`}
              fill="oklch(0.78 0.125 232 / 0.18)"
            />
            <polyline
              points={windPath.join(" ")}
              fill="none"
              stroke="oklch(0.78 0.125 232)"
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}

        {pressurePath.length > 1 ? (
          <polyline
            points={pressurePath.join(" ")}
            fill="none"
            stroke="oklch(0.66 0.022 254)"
            strokeWidth={0.6}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* A tick per fix: the track's real sampling, visible at a glance. */}
        {placed.map((item) => (
          <line
            key={item.observation.id}
            x1={item.x}
            x2={item.x}
            y1={HEIGHT - BOTTOM}
            y2={HEIGHT - BOTTOM + 3.5}
            stroke={categoryColor(item.observation.categoryRank)}
            strokeWidth={0.8}
            opacity={0.85}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {base ? (
          <line
            x1={base.x}
            x2={base.x}
            y1={TOP - 6}
            y2={HEIGHT - BOTTOM + 4}
            stroke="oklch(0.8 0.14 74)"
            strokeWidth={1}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {selected ? (
          <>
            <line
              x1={selected.x}
              x2={selected.x}
              y1={TOP - 6}
              y2={HEIGHT - BOTTOM + 4}
              stroke="oklch(0.94 0.008 250)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={selected.x} cy={TOP - 6} r={1.6} fill="oklch(0.94 0.008 250)" />
          </>
        ) : null}
      </svg>

      <div className="flex items-center justify-between px-3 pb-1.5">
        <span className="label-xs">Wind · pressure</span>
        <span className="label-xs">
          Drag or use ← → · {base ? "amber marks the forecast base" : "no forecast base"}
        </span>
      </div>
    </div>
  );
}
