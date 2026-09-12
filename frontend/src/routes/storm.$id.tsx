/**
 * Storm profile: one cyclone in full.
 *
 * Track, lifecycle, what the models said about it, and what the data can
 * support. The forecast-history panel matters more than it looks: a stored run
 * records which fix it was made from, so a reader can see that a forecast
 * predates the outcome it is being judged against.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { IntensityChart } from "@/components/charts/IntensityChart";
import {
  Button,
  CategoryChip,
  Empty,
  Metric,
  Panel,
  Provenance,
  Skeleton,
  StatusChip,
} from "@/components/console/primitives";
import { StormDnaPanel } from "@/components/dna/StormDnaPanel";
import { LazyStormMap } from "@/components/map/LazyStormMap";
import {
  categoryColorForWind,
  fmtCoords,
  fmtDateTime,
  fmtHours,
  fmtPressure,
  fmtWind,
} from "@/lib/format";
import {
  useCyclone,
  useForecastHistory,
  useLatestForecast,
  useSatelliteAnalysesForCyclone,
  useTrack,
} from "@/lib/queries";
import type { Observation, PredictionRun } from "@/lib/types";

/*
 * Stable empty arrays. `?? []` would hand every render a new array, which
 * changes the identity of every dependency computed from it and quietly
 * defeats the memos below.
 */
const NO_OBSERVATIONS: Observation[] = [];
const NO_RUNS: PredictionRun[] = [];

export const Route = createFileRoute("/storm/$id")({
  component: StormProfile,
});

function StormProfile() {
  const { id } = Route.useParams();
  const detail = useCyclone(id);
  const track = useTrack(id);
  const latest = useLatestForecast(id);
  const history = useForecastHistory(id, 10);
  const satellite = useSatelliteAnalysesForCyclone(id);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const observations = track.data ?? NO_OBSERVATIONS;
  const runs = history.data ?? NO_RUNS;
  const run = useMemo(() => {
    if (selectedRunId) return runs.find((r) => r.id === selectedRunId) ?? latest.data ?? null;
    return latest.data ?? null;
  }, [selectedRunId, runs, latest.data]);

  if (detail.isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <Empty
        tone="warning"
        title="Storm not found"
        detail={detail.error instanceof Error ? detail.error.message : null}
        action={
          <Link to="/explorer">
            <Button>Back to Explorer</Button>
          </Link>
        }
      />
    );
  }

  const storm = detail.data;
  const quality = storm.dataQuality;

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="space-y-2 p-2">
        {/* Identity and the numbers that define the storm. */}
        <Panel bodyClassName="flex flex-wrap items-start justify-between gap-4 p-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="font-display text-xl leading-none">
                {storm.name ?? storm.externalId}
              </h1>
              <span className="num text-xs text-muted-foreground">{storm.seasonYear}</span>
              <CategoryChip category={storm.peakCategory} rank={storm.peakCategoryRank} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <span className="label-xs">{storm.basinName}</span>
              <span className="num text-[0.6875rem] text-muted-foreground">{storm.externalId}</span>
              <span className="label-xs">{storm.status}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Metric
              label="Peak wind"
              value={fmtWind(storm.peakWindKph)}
              source="observed"
              accent={categoryColorForWind(storm.peakWindKph)}
            />
            <Metric
              label="Min pressure"
              value={fmtPressure(storm.minPressureHpa)}
              source="observed"
            />
            <Metric label="Fixes" value={String(quality.observationCount)} source="observed" />
            <Metric label="Duration" value={fmtHours(quality.trackDurationHours)} />
          </div>

          <div className="flex gap-2">
            <Link to="/lab/$id" params={{ id }}>
              <Button variant="primary">Prediction Lab</Button>
            </Link>
            <Link to="/">
              <Button>Mission Control</Button>
            </Link>
          </div>
        </Panel>

        <div className="grid gap-2 lg:grid-cols-[1.55fr_1fr]">
          <Panel title="Track" className="min-h-[380px]" bodyClassName="h-[380px]">
            {observations.length === 0 ? (
              <Empty title="No observations" detail="This storm has no stored track." />
            ) : (
              <LazyStormMap
                observations={observations}
                forecast={run?.trajectory.points ?? []}
                analogue={run?.analogues.points ?? []}
                baseTime={run?.baseObservationAt ?? null}
              />
            )}
          </Panel>

          <div className="space-y-2">
            <Panel title="Data quality" bodyClassName="p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Metric
                  label="With wind"
                  value={`${quality.withWindCount} / ${quality.observationCount}`}
                  source="observed"
                />
                <Metric
                  label="With pressure"
                  value={`${quality.withPressureCount} / ${quality.observationCount}`}
                  source="observed"
                />
                <Metric label="Largest gap" value={fmtHours(quality.largestGapHours)} />
                <Metric
                  label="Forecastable"
                  value={quality.forecastReady ? "Yes" : "No"}
                  accent={quality.forecastReady ? "var(--model)" : "var(--destructive)"}
                />
              </div>
              {quality.limitations.length > 0 ? (
                <ul className="mt-2.5 space-y-1 border-t border-border pt-2">
                  {quality.limitations.map((limitation) => (
                    <li
                      key={limitation}
                      className="text-[0.6875rem] leading-relaxed text-primary/90"
                    >
                      {limitation}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2.5 space-y-1 border-t border-border pt-2">
                <Provenance source="observed" detail={quality.observationSource} />
                <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                  Categories on the {quality.windScale}.
                </p>
              </div>
            </Panel>

            <Panel
              title="Forecast runs"
              action={
                <span className="num text-[0.6875rem] text-muted-foreground">{runs.length}</span>
              }
              bodyClassName="max-h-[220px]"
            >
              {history.isLoading ? (
                <div className="space-y-1 p-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : runs.length === 0 ? (
                <Empty
                  title="No model runs yet"
                  detail="Open the Prediction Lab to forecast this storm from any of its fixes."
                />
              ) : (
                <ul>
                  {runs.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRunId(item.id)}
                        className={`flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-1.5 text-left hover:bg-accent/50 ${
                          run?.id === item.id ? "bg-accent" : ""
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="num block text-[0.6875rem]">
                            base {fmtDateTime(item.baseObservationAt)}
                          </span>
                          <span className="num block text-[0.625rem] text-muted-foreground">
                            run {fmtDateTime(item.createdAt)} · {item.observationsUsed} fixes
                          </span>
                        </span>
                        <StatusChip status={item.overallStatus} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <StormDnaPanel cycloneId={id} />

        <Panel
          title="Lifecycle"
          provenance={
            run?.intensity.status === "COMPLETED" ? (
              <span className="label-xs text-model">with model forecast</span>
            ) : null
          }
          bodyClassName="p-2 pt-3"
        >
          <IntensityChart
            observations={observations}
            forecast={run?.intensity.points ?? []}
            baseTime={run?.baseObservationAt ?? null}
            height={240}
          />
        </Panel>

        <div className="grid gap-2 lg:grid-cols-2">
          <Panel title="Fixes" bodyClassName="max-h-[320px]">
            {observations.length === 0 ? (
              <Empty title="No observations" />
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-[var(--surface)]">
                  <tr className="border-b border-border text-left">
                    <th className="label-xs px-3 py-1.5">Time</th>
                    <th className="label-xs px-3 py-1.5">Position</th>
                    <th className="label-xs px-3 py-1.5 text-right">Wind</th>
                    <th className="label-xs px-3 py-1.5 text-right">Pressure</th>
                  </tr>
                </thead>
                <tbody className="num text-[0.6875rem]">
                  {observations.map((observation) => (
                    <tr key={observation.id} className="border-b border-border/40">
                      <td className="px-3 py-1">{fmtDateTime(observation.observedAt)}</td>
                      <td className="px-3 py-1">
                        {fmtCoords(observation.latitude, observation.longitude)}
                      </td>
                      <td
                        className="px-3 py-1 text-right"
                        style={{ color: categoryColorForWind(observation.windSpeedKph) }}
                      >
                        {fmtWind(observation.windSpeedKph)}
                      </td>
                      <td className="px-3 py-1 text-right">
                        {fmtPressure(observation.pressureHpa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel
            title="Satellite analyses"
            action={
              <Link to="/satellite">
                <Button size="sm" variant="ghost">
                  Open →
                </Button>
              </Link>
            }
            bodyClassName="max-h-[320px]"
          >
            {(satellite.data ?? []).length === 0 ? (
              <Empty
                title="No satellite analysis for this storm"
                detail="Upload a frame in Satellite Intelligence to have the vision model analyse it."
              />
            ) : (
              <ul>
                {(satellite.data ?? []).map((analysis) => (
                  <li
                    key={analysis.id}
                    className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="num block text-[0.6875rem]">
                        {fmtDateTime(analysis.createdAt)}
                      </span>
                      <span className="block truncate text-[0.625rem] text-muted-foreground">
                        {analysis.reason ?? analysis.modelName ?? analysis.imageType ?? ""}
                      </span>
                    </span>
                    <StatusChip status={analysis.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
