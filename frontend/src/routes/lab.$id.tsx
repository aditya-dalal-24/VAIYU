/**
 * Prediction Lab — rewind, forecast, then verify.
 *
 * The workflow is the point. Pick a fix in the storm's past; see exactly which
 * observations the model will be given; run it; then reveal what the storm
 * actually did and score the forecast against it, next to two baselines.
 *
 * This is the honest version of a "Predict" button. The model is given only
 * fixes at or before the chosen time — the backend enforces that, not the UI —
 * so the outcome it is scored against was genuinely unknown to it. Errors are
 * great-circle kilometres computed from the archive's own later fixes, and a
 * horizon with no fix close enough to verify says so rather than being scored
 * against something else.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { IntensityChart } from "@/components/charts/IntensityChart";
import {
  Button,
  Empty,
  Metric,
  Panel,
  Provenance,
  Skeleton,
} from "@/components/console/primitives";
import { ForecastPanel } from "@/components/forecast/ForecastPanel";
import { LazyStormMap } from "@/components/map/LazyStormMap";
import { TrackTimeline } from "@/components/timeline/TrackTimeline";
import { ABSENT, fmtCoords, fmtDateTime, fmtKm, fmtPressure, fmtWind } from "@/lib/format";
import { useCyclone, useLatestForecast, useRunForecast, useTrack } from "@/lib/queries";
import type { Observation } from "@/lib/types";
import { meanOf, verifyForecast } from "@/lib/verify";
import { cn } from "@/lib/utils";

/*
 * Stable empty arrays. `?? []` would hand every render a new array, which
 * changes the identity of every dependency computed from it and quietly
 * defeats the memos below.
 */
const NO_OBSERVATIONS: Observation[] = [];

export const Route = createFileRoute("/lab/$id")({
  component: PredictionLab,
});

function PredictionLab() {
  const { id } = Route.useParams();
  const detail = useCyclone(id);
  const track = useTrack(id);
  const latest = useLatestForecast(id);
  const runForecast = useRunForecast(id);

  const observations = track.data ?? NO_OBSERVATIONS;
  const [baseTime, setBaseTime] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  /*
   * Default the base to two fixes before the end, so there is something left to
   * verify against. Starting at the final fix would produce a forecast nobody
   * can score.
   */
  useEffect(() => {
    if (observations.length >= 3 && !baseTime) {
      const fix = observations[Math.max(0, observations.length - 3)];
      if (fix) setBaseTime(fix.observedAt);
    }
  }, [observations, baseTime]);

  const run = runForecast.data ?? latest.data ?? null;
  const runMatchesBase = Boolean(run && baseTime && run.baseObservationAt === baseTime);

  const inputs = useMemo(() => {
    if (!baseTime) return [];
    const baseMs = new Date(baseTime).getTime();
    return observations.filter((o) => new Date(o.observedAt).getTime() <= baseMs).slice(-12);
  }, [observations, baseTime]);

  const verification = useMemo(() => {
    if (!run || !runMatchesBase || run.trajectory.status !== "COMPLETED") return [];
    return verifyForecast(
      run.trajectory.points,
      run.intensity.points,
      run.analogues.points,
      observations,
      run.baseObservationAt,
    );
  }, [run, runMatchesBase, observations]);

  const verifiable = verification.filter((row) => row.actual !== null);
  const meanError = meanOf(verifiable.map((row) => row.errorKm));
  const meanPersistence = meanOf(verifiable.map((row) => row.persistenceKm));
  const meanLinear = meanOf(verifiable.map((row) => row.linearKm));
  const meanAnalogue = meanOf(verifiable.map((row) => row.analogueErrorKm));

  if (detail.isLoading || track.isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (!detail.data) {
    return (
      <Empty
        tone="warning"
        title="Storm not found"
        action={
          <Link to="/explorer">
            <Button>Back to Explorer</Button>
          </Link>
        }
      />
    );
  }

  const storm = detail.data;

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="space-y-2 p-2">
        <Panel bodyClassName="flex flex-wrap items-center justify-between gap-3 p-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="label-xs">Prediction Lab</span>
              <h1 className="font-display text-lg leading-none">
                {storm.name ?? storm.externalId}
              </h1>
              <span className="num text-xs text-muted-foreground">{storm.seasonYear}</span>
            </div>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
              Forecast from any fix using only earlier data, then score it against what happened.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setRevealed((value) => !value)}
              disabled={!runMatchesBase || verifiable.length === 0}
              title={
                verifiable.length === 0
                  ? "Nothing to reveal: no reported fix falls near these horizons"
                  : "Show what the storm actually did after the base fix"
              }
            >
              {revealed ? "Hide outcome" : "Reveal outcome"}
            </Button>
            <Link to="/storm/$id" params={{ id }}>
              <Button>Storm profile</Button>
            </Link>
          </div>
        </Panel>

        <div className="grid gap-2 xl:grid-cols-[1fr_330px]">
          <div className="space-y-2">
            <Panel
              title="Observed and forecast"
              provenance={
                runMatchesBase ? (
                  <Provenance source="model" detail={run?.trajectory.model.name ?? undefined} />
                ) : null
              }
              className="min-h-[420px]"
              bodyClassName="h-[420px]"
            >
              {observations.length === 0 ? (
                <Empty title="No track" />
              ) : (
                <LazyStormMap
                  observations={observations}
                  forecast={runMatchesBase ? (run?.trajectory.points ?? []) : []}
                  analogue={runMatchesBase ? (run?.analogues.points ?? []) : []}
                  baseTime={baseTime}
                  selectedTime={baseTime}
                  onSelect={(observation) => {
                    setBaseTime(observation.observedAt);
                    setRevealed(false);
                  }}
                  hideFuture={!revealed}
                />
              )}
            </Panel>

            {observations.length > 0 ? (
              <TrackTimeline
                observations={observations}
                selectedTime={baseTime}
                baseTime={run?.baseObservationAt ?? null}
                onSelect={(observation) => {
                  setBaseTime(observation.observedAt);
                  setRevealed(false);
                }}
              />
            ) : null}

            <Panel
              title="Verification"
              provenance={
                verifiable.length > 0 ? (
                  <span className="label-xs">great-circle error against reported fixes</span>
                ) : null
              }
              bodyClassName="p-3"
            >
              {!runMatchesBase ? (
                <Empty
                  title="Run the model from this fix first"
                  detail="Verification compares a forecast with the fixes that followed it, so it needs a run made from the selected base time."
                />
              ) : verification.length === 0 ? (
                <Empty
                  title="No track forecast to verify"
                  detail={run?.trajectory.reason ?? undefined}
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    <Metric
                      label="Model error"
                      value={fmtKm(meanError)}
                      source="model"
                      unitHint="Mean great-circle distance from the reported fix"
                    />
                    <Metric label="Analogue error" value={fmtKm(meanAnalogue)} source="analogue" />
                    <Metric
                      label="Linear baseline"
                      value={fmtKm(meanLinear)}
                      unitHint="Continuing the storm's last observed motion"
                    />
                    <Metric
                      label="Persistence"
                      value={fmtKm(meanPersistence)}
                      unitHint="Assuming the storm does not move"
                    />
                  </div>

                  {meanError !== null && meanLinear !== null ? (
                    <p
                      className={cn(
                        "mt-2 text-[0.6875rem] leading-relaxed",
                        meanError < meanLinear ? "text-model" : "text-primary",
                      )}
                    >
                      {meanError < meanLinear
                        ? "The model beat simple extrapolation on this storm."
                        : "Simple extrapolation beat the model here — expected on a storm moving in a straight line, where extrapolation is hard to improve on."}
                    </p>
                  ) : null}

                  <table className="mt-3 w-full">
                    <thead>
                      <tr className="text-left">
                        <th className="label-xs pb-1">Horizon</th>
                        <th className="label-xs pb-1">Predicted</th>
                        <th className="label-xs pb-1">Actual</th>
                        <th className="label-xs pb-1 text-right">Error</th>
                        <th className="label-xs pb-1 text-right">Wind error</th>
                      </tr>
                    </thead>
                    <tbody className="num text-[0.6875rem]">
                      {verification.map((row) => (
                        <tr key={row.forecastHours} className="border-t border-border/60">
                          <td className="py-1 text-model">+{row.forecastHours}h</td>
                          <td className="py-1">
                            {fmtCoords(row.predictedLatitude, row.predictedLongitude)}
                          </td>
                          <td className="py-1">
                            {revealed && row.actual
                              ? fmtCoords(row.actual.latitude, row.actual.longitude)
                              : row.actual
                                ? "hidden"
                                : "no fix near this time"}
                          </td>
                          <td className="py-1 text-right">
                            {revealed ? fmtKm(row.errorKm) : ABSENT}
                          </td>
                          <td className="py-1 text-right">
                            {revealed && row.windErrorKph !== null
                              ? fmtWind(row.windErrorKph)
                              : ABSENT}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {verifiable.length < verification.length ? (
                    <p className="mt-2 text-[0.6875rem] text-muted-foreground">
                      {verification.length - verifiable.length} horizon(s) cannot be verified: the
                      storm has no reported fix within 90 minutes of that forecast time.
                    </p>
                  ) : null}
                </>
              )}
            </Panel>

            <Panel title="Intensity" bodyClassName="p-2 pt-3">
              <IntensityChart
                observations={
                  revealed
                    ? observations
                    : observations.filter(
                        (o) =>
                          !baseTime ||
                          new Date(o.observedAt).getTime() <= new Date(baseTime).getTime(),
                      )
                }
                forecast={runMatchesBase ? (run?.intensity.points ?? []) : []}
                baseTime={baseTime}
                height={220}
              />
            </Panel>
          </div>

          <div className="space-y-2">
            <ForecastPanel
              run={runMatchesBase ? run : null}
              baseTime={baseTime}
              isRunning={runForecast.isPending}
              error={runForecast.error}
              forecastReady={storm.dataQuality.forecastReady}
              onRun={(force) => {
                setRevealed(false);
                runForecast.mutate({ baseTime: baseTime ?? undefined, force });
              }}
            />

            <Panel
              title="Model input"
              action={
                <span className="num text-[0.6875rem] text-muted-foreground">
                  {inputs.length} fixes
                </span>
              }
              bodyClassName="max-h-[280px]"
            >
              {inputs.length === 0 ? (
                <Empty title="Select a base fix" />
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-[var(--surface)]">
                    <tr className="border-b border-border text-left">
                      <th className="label-xs px-2 py-1">Time</th>
                      <th className="label-xs px-2 py-1 text-right">Wind</th>
                      <th className="label-xs px-2 py-1 text-right">Pressure</th>
                    </tr>
                  </thead>
                  <tbody className="num text-[0.625rem]">
                    {inputs.map((observation, index) => (
                      <tr
                        key={observation.id}
                        className={cn(
                          "border-b border-border/40",
                          index === inputs.length - 1 && "text-model",
                        )}
                      >
                        <td className="px-2 py-1">{fmtDateTime(observation.observedAt)}</td>
                        <td className="px-2 py-1 text-right">
                          {fmtWind(observation.windSpeedKph)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmtPressure(observation.pressureHpa)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="border-t border-border px-2 py-1.5 text-[0.625rem] leading-relaxed text-muted-foreground">
                The last row is the base fix. The backend sends these fixes and excludes everything
                after, so the forecast cannot see the outcome.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
