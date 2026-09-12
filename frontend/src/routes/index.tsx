/**
 * Mission Control.
 *
 * One screen that answers, in this order: where is the storm, what is it doing,
 * where does the model think it is going, and has anything like it happened
 * before. The map is the surface; everything else docks over it.
 *
 * The timeline is the spine. Scrubbing it moves the selected fix, and the
 * forecast is always made *from* that fix using only earlier data — so
 * replaying a past storm is a genuine forecast, not a lookup of the answer.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { StormPicker } from "@/components/console/StormPicker";
import { Button, Empty, Metric, Panel, Provenance, Skeleton } from "@/components/console/primitives";
import { ForecastPanel } from "@/components/forecast/ForecastPanel";
import { StormMap } from "@/components/map/StormMap";
import { TrackTimeline } from "@/components/timeline/TrackTimeline";
import { ClientOnly } from "@/components/ui/client-only";
import {
  categoryColorForWind,
  fmtCoords,
  fmtDateTime,
  fmtHours,
  fmtPressure,
  fmtWind,
} from "@/lib/format";
import { useCyclone, useCyclones, useLatestForecast, useRunForecast, useTrack } from "@/lib/queries";
import type { CycloneSummary, Observation } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: MissionControl,
});

function MissionControl() {
  const [selectedStormId, setSelectedStormId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [replay, setReplay] = useState(true);

  // Open on the most recent storm in the archive rather than an empty screen.
  const recent = useCyclones({ sort: "recent", size: 1 });
  useEffect(() => {
    if (!selectedStormId && recent.data?.items[0]) {
      setSelectedStormId(recent.data.items[0].id);
    }
  }, [recent.data, selectedStormId]);

  const detail = useCyclone(selectedStormId ?? undefined);
  const track = useTrack(selectedStormId ?? undefined);
  const latest = useLatestForecast(selectedStormId ?? undefined);
  const runForecast = useRunForecast(selectedStormId ?? undefined);

  const observations = track.data ?? [];

  // Default the scrubber to the storm's last fix whenever the storm changes.
  useEffect(() => {
    const newest = observations[observations.length - 1];
    setSelectedTime(newest ? newest.observedAt : null);
  }, [selectedStormId, observations.length]);

  const run = runForecast.data ?? latest.data ?? null;
  const forecastBase = run?.baseObservationAt ?? null;

  const selected = useMemo(
    () => observations.find((o) => o.observedAt === selectedTime) ?? observations.at(-1) ?? null,
    [observations, selectedTime],
  );

  function onSelectStorm(storm: CycloneSummary) {
    setSelectedStormId(storm.id);
    runForecast.reset();
  }

  function onSelectFix(observation: Observation) {
    setSelectedTime(observation.observedAt);
  }

  const forecastReady = detail.data?.dataQuality.forecastReady ?? false;

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-[248px] shrink-0 flex-col gap-2 border-r border-border p-2 lg:flex">
        <StormPicker
          selectedId={selectedStormId}
          onSelect={onSelectStorm}
          className="min-h-0 flex-1"
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          {track.isLoading || !selectedStormId ? (
            <div className="h-full w-full graticule" />
          ) : observations.length === 0 ? (
            <Empty
              title="No track for this storm"
              detail="This storm has no stored observations, so there is nothing to map."
            />
          ) : (
            <ClientOnly fallback={<div className="h-full w-full graticule" />}>
              <StormMap
                observations={observations}
                forecast={run?.trajectory.points ?? []}
                analogue={run?.analogues.points ?? []}
                baseTime={forecastBase ?? selectedTime}
                selectedTime={selectedTime}
                onSelect={onSelectFix}
                hideFuture={replay}
              />
            </ClientOnly>
          )}

          {/* Storm identity, docked top-left over the map. */}
          {detail.data ? (
            <div className="pointer-events-none absolute left-3 top-3 z-[400] panel px-3 py-2">
              <div className="flex items-baseline gap-2">
                <h1 className="font-display text-base leading-none">
                  {detail.data.name ?? detail.data.externalId}
                </h1>
                <span className="num text-[0.6875rem] text-muted-foreground">
                  {detail.data.seasonYear}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="label-xs">{detail.data.basinName}</span>
                <span className="num text-[0.625rem] text-muted-foreground">
                  {detail.data.externalId}
                </span>
              </div>
            </div>
          ) : null}

          <div className="absolute right-3 top-3 z-[400] flex items-center gap-2">
            <Button
              size="sm"
              variant={replay ? "primary" : "default"}
              onClick={() => setReplay((value) => !value)}
              title="Hide fixes after the selected time, so the map shows only what the model was given"
            >
              {replay ? "Replay mode on" : "Replay mode off"}
            </Button>
            {selectedStormId ? (
              <Link to="/storm/$id" params={{ id: selectedStormId }}>
                <Button size="sm">Storm profile</Button>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 space-y-2 p-2">
          {observations.length > 0 ? (
            <TrackTimeline
              observations={observations}
              selectedTime={selectedTime}
              baseTime={forecastBase}
              onSelect={onSelectFix}
            />
          ) : null}

          <div className="flex items-stretch gap-2">
            <Panel title="Selected fix" className="min-w-0 flex-1" bodyClassName="p-3">
              {selected ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <Metric
                    label="Time"
                    value={fmtDateTime(selected.observedAt)}
                    source="observed"
                  />
                  <Metric
                    label="Position"
                    value={fmtCoords(selected.latitude, selected.longitude)}
                    source="observed"
                  />
                  <Metric
                    label="Wind"
                    value={fmtWind(selected.windSpeedKph)}
                    source="observed"
                    accent={categoryColorForWind(selected.windSpeedKph)}
                    unitHint="1-minute sustained (IBTrACS USA_WIND)"
                  />
                  <Metric
                    label="Pressure"
                    value={fmtPressure(selected.pressureHpa)}
                    source="observed"
                  />
                </div>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </Panel>

            {detail.data ? (
              <Panel title="Data quality" className="w-[300px] shrink-0" bodyClassName="p-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Metric
                    label="Fixes"
                    value={String(detail.data.dataQuality.observationCount)}
                    source="observed"
                  />
                  <Metric
                    label="With pressure"
                    value={String(detail.data.dataQuality.withPressureCount)}
                    source="observed"
                  />
                  <Metric
                    label="Duration"
                    value={fmtHours(detail.data.dataQuality.trackDurationHours)}
                  />
                  <Metric
                    label="Largest gap"
                    value={fmtHours(detail.data.dataQuality.largestGapHours)}
                  />
                </div>
                {detail.data.dataQuality.limitations.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t border-border pt-2">
                    {detail.data.dataQuality.limitations.map((limitation) => (
                      <li key={limitation} className="text-[0.6875rem] leading-relaxed text-primary/90">
                        {limitation}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 border-t border-border pt-2 text-[0.6875rem] text-muted-foreground">
                    Complete track: every fix carries wind and pressure.
                  </p>
                )}
                <Provenance
                  source="observed"
                  detail={detail.data.dataQuality.observationSource}
                  className="mt-2"
                />
              </Panel>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="hidden w-[330px] shrink-0 border-l border-border p-2 xl:block">
        <ForecastPanel
          run={run}
          baseTime={selectedTime}
          isRunning={runForecast.isPending}
          error={runForecast.error}
          forecastReady={forecastReady}
          onRun={(force) =>
            runForecast.mutate({ baseTime: selectedTime ?? undefined, force })
          }
          className="h-full"
        />
      </aside>
    </div>
  );
}
