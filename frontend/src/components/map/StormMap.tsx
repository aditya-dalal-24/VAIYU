/**
 * The storm map.
 *
 * Three things are drawn and they must never be mistaken for one another, so
 * each has its own colour, line style and marker shape:
 *
 *   observed track   solid cold-blue line, filled circles at every reported fix
 *   model forecast   dashed amber line, hollow squares, optional error circles
 *   analogue forecast dotted violet line, hollow circles, spread circles
 *
 * Error circles are drawn only where the backend supplied a radius, which it
 * does only when the model's checkpoint recorded a held-out error at that
 * horizon. A missing radius draws nothing rather than a zero-radius point,
 * because a cone implies a measurement that would not exist.
 */

import { useEffect, useMemo } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Pane,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

import { categoryColor, fmtCoords, fmtDateTime, fmtKm, fmtWind, fmtPressure } from "@/lib/format";
import type { AnaloguePoint, Observation, TrackPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

import "leaflet/dist/leaflet.css";

const OBSERVED = "oklch(0.78 0.125 232)";
const MODEL = "oklch(0.8 0.14 74)";
const ANALOGUE = "oklch(0.73 0.15 300)";

export interface StormMapProps {
  observations: Observation[];
  forecast?: TrackPoint[] | undefined;
  analogue?: AnaloguePoint[] | undefined;
  /** The fix a forecast was made from; drawn as the boundary marker. */
  baseTime?: string | null | undefined;
  selectedTime?: string | null | undefined;
  onSelect?: (observation: Observation) => void | undefined;
  /** Hide fixes after the base time, so a replay shows only what the model saw. */
  hideFuture?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Leaflet draws a straight line between consecutive longitudes, so a track
 * crossing the antimeridian would streak across the whole world. Unwrapping
 * keeps each step on the short side.
 */
function unwrap(points: { latitude: number; longitude: number }[]): LatLngExpression[] {
  let offset = 0;
  const out: LatLngExpression[] = [];
  points.forEach((point, index) => {
    const previous = index > 0 ? points[index - 1] : undefined;
    if (previous) {
      const delta = point.longitude - previous.longitude;
      if (delta > 180) offset -= 360;
      else if (delta < -180) offset += 360;
    }
    out.push([point.latitude, point.longitude + offset]);
  });
  return out;
}

function FitBounds({ bounds, dependency }: { bounds: LatLngBoundsExpression | null; dependency: string }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [56, 56], animate: true, maxZoom: 7 });
    // Refit only when the storm or forecast identity changes, never on every
    // render: refitting under the user's cursor makes the map feel broken.
  }, [dependency, map]);
  return null;
}

export function StormMap({
  observations,
  forecast = [],
  analogue = [],
  baseTime,
  selectedTime,
  onSelect,
  hideFuture = false,
  className,
}: StormMapProps) {
  const visible = useMemo(() => {
    if (!hideFuture || !baseTime) return observations;
    const cutoff = new Date(baseTime).getTime();
    return observations.filter((o) => new Date(o.observedAt).getTime() <= cutoff);
  }, [observations, hideFuture, baseTime]);

  const observedLine = useMemo(() => unwrap(visible), [visible]);

  const base = useMemo(() => {
    if (!baseTime) return visible.at(-1) ?? null;
    return (
      visible.find((o) => o.observedAt === baseTime) ??
      visible.at(-1) ??
      null
    );
  }, [visible, baseTime]);

  /* The forecast line starts at the fix it was made from, so the join between
     observation and prediction is visible rather than implied. */
  const forecastLine = useMemo(() => {
    if (forecast.length === 0) return [];
    const anchor = base ? [{ latitude: base.latitude, longitude: base.longitude }] : [];
    return unwrap([...anchor, ...forecast]);
  }, [forecast, base]);

  const analogueLine = useMemo(() => {
    if (analogue.length === 0) return [];
    const anchor = base ? [{ latitude: base.latitude, longitude: base.longitude }] : [];
    return unwrap([...anchor, ...analogue]);
  }, [analogue, base]);

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    const all = [...observedLine, ...forecastLine, ...analogueLine] as [number, number][];
    if (all.length === 0) return null;
    const lats = all.map((p) => p[0]);
    const lons = all.map((p) => p[1]);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];
  }, [observedLine, forecastLine, analogueLine]);

  const boundsKey = `${observations[0]?.id ?? "none"}-${visible.length}-${forecast.length}-${analogue.length}`;

  const center = useMemo<LatLngExpression>(() => {
    const last = visible.at(-1);
    return last ? [last.latitude, last.longitude] : [15, 80];
  }, [visible]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <MapContainer
        center={center}
        zoom={5}
        minZoom={2}
        className="h-full w-full"
        zoomControl={false}
        attributionControl
        worldCopyJump
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={["a", "b", "c", "d"]}
          maxZoom={19}
        />

        <FitBounds bounds={bounds} dependency={boundsKey} />

        {/* Error and spread circles sit under the lines so they never hide a track. */}
        <Pane name="uncertainty" style={{ zIndex: 390 }}>
          {forecast.map((point) =>
            point.uncertaintyRadiusKm ? (
              <Circle
                key={`unc-${point.forecastHours}`}
                center={[point.latitude, point.longitude]}
                radius={point.uncertaintyRadiusKm * 1000}
                pathOptions={{
                  color: MODEL,
                  weight: 1,
                  opacity: 0.45,
                  fillColor: MODEL,
                  fillOpacity: 0.06,
                  dashArray: "2 4",
                }}
              />
            ) : null,
          )}
          {analogue.map((point) =>
            point.spreadKm ? (
              <Circle
                key={`spread-${point.forecastHours}`}
                center={[point.latitude, point.longitude]}
                radius={point.spreadKm * 1000}
                pathOptions={{
                  color: ANALOGUE,
                  weight: 1,
                  opacity: 0.35,
                  fillColor: ANALOGUE,
                  fillOpacity: 0.05,
                  dashArray: "1 5",
                }}
              />
            ) : null,
          )}
        </Pane>

        {analogueLine.length > 1 ? (
          <Polyline
            positions={analogueLine}
            pathOptions={{ color: ANALOGUE, weight: 2, opacity: 0.8, dashArray: "1 6" }}
          />
        ) : null}

        {forecastLine.length > 1 ? (
          <Polyline
            positions={forecastLine}
            pathOptions={{ color: MODEL, weight: 2.5, opacity: 0.95, dashArray: "7 5" }}
          />
        ) : null}

        {/* Observed track, segment by segment, coloured by the intensity at the
            start of each segment: the line itself carries the storm's history. */}
        {observedLine.length > 1
          ? observedLine.slice(0, -1).map((point, index) => (
              <Polyline
                key={`seg-${index}`}
                positions={[point, observedLine[index + 1] as LatLngExpression]}
                pathOptions={{
                  color: categoryColor(visible[index]?.categoryRank ?? null),
                  weight: 2.5,
                  opacity: 0.9,
                }}
              />
            ))
          : null}

        {visible.map((observation, index) => {
          const isBase = base?.id === observation.id;
          const isSelected = selectedTime === observation.observedAt;
          const color = categoryColor(observation.categoryRank);
          const position = observedLine[index] as LatLngExpression;
          return (
            <CircleMarker
              key={observation.id}
              center={position}
              radius={isBase ? 6.5 : isSelected ? 5.5 : 3.4}
              pathOptions={{
                color: isBase ? MODEL : color,
                weight: isBase || isSelected ? 2.5 : 1,
                fillColor: color,
                fillOpacity: isSelected || isBase ? 1 : 0.75,
              }}
              eventHandlers={{ click: () => onSelect?.(observation) }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                <div className="space-y-0.5">
                  <div className="label-xs">{fmtDateTime(observation.observedAt)}</div>
                  <div className="num text-xs">
                    {fmtWind(observation.windSpeedKph)} · {fmtPressure(observation.pressureHpa)}
                  </div>
                  <div className="num text-[0.6875rem] text-muted-foreground">
                    {fmtCoords(observation.latitude, observation.longitude)}
                  </div>
                  {isBase ? (
                    <div className="text-[0.6875rem] text-model">Forecast base fix</div>
                  ) : null}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Forecast positions: square-ish markers to separate them from fixes. */}
        {forecast.map((point) => (
          <CircleMarker
            key={`fc-${point.forecastHours}`}
            center={[point.latitude, point.longitude]}
            radius={4.5}
            pathOptions={{ color: MODEL, weight: 2, fillColor: "transparent", fillOpacity: 0 }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <div className="space-y-0.5">
                <div className="label-xs text-model">Model +{point.forecastHours}h</div>
                <div className="num text-[0.6875rem]">
                  {fmtCoords(point.latitude, point.longitude)}
                </div>
                <div className="num text-[0.6875rem] text-muted-foreground">
                  {point.uncertaintyRadiusKm
                    ? `Mean error at this horizon ${fmtKm(point.uncertaintyRadiusKm)}`
                    : "No measured error for this horizon"}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {analogue.map((point) => (
          <CircleMarker
            key={`an-${point.forecastHours}`}
            center={[point.latitude, point.longitude]}
            radius={3.6}
            pathOptions={{ color: ANALOGUE, weight: 1.5, fillColor: "transparent", fillOpacity: 0 }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <div className="space-y-0.5">
                <div className="label-xs text-analogue">Analogues +{point.forecastHours}h</div>
                <div className="num text-[0.6875rem]">
                  {fmtCoords(point.latitude, point.longitude)}
                </div>
                <div className="num text-[0.6875rem] text-muted-foreground">
                  {point.memberCount ?? 0} storms · spread {fmtKm(point.spreadKm)}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      <MapLegend
        hasForecast={forecast.length > 0}
        hasAnalogue={analogue.length > 0}
      />
    </div>
  );
}

function MapLegend({
  hasForecast,
  hasAnalogue,
}: {
  hasForecast: boolean;
  hasAnalogue: boolean;
}) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] panel px-2.5 py-2">
      <div className="label-xs mb-1.5">Layers</div>
      <div className="space-y-1">
        <LegendRow color={OBSERVED} label="Observed fixes" style="solid" />
        {hasForecast ? (
          <LegendRow color={MODEL} label="Model forecast" style="dashed" />
        ) : null}
        {hasAnalogue ? (
          <LegendRow color={ANALOGUE} label="Analogue ensemble" style="dotted" />
        ) : null}
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  style,
}: {
  color: string;
  label: string;
  style: "solid" | "dashed" | "dotted";
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-0 w-6 shrink-0"
        style={{
          borderTopWidth: 2,
          borderTopStyle: style,
          borderTopColor: color,
        }}
        aria-hidden
      />
      <span className="text-[0.6875rem] text-muted-foreground">{label}</span>
    </div>
  );
}
