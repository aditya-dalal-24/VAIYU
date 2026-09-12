/**
 * What the models said, and how they were asked.
 *
 * The panel is built to be read top to bottom as an argument: the inputs, then
 * each model's answer with its own status, then the historical analogues as an
 * independent second opinion. Where a model declined, its reason takes the
 * place of the numbers — no blank chart, no zeroes.
 */

import { Link } from "@tanstack/react-router";

import { Button, Empty, Metric, Panel, Provenance, StatusChip } from "@/components/console/primitives";
import {
  ABSENT,
  categoryColorForWind,
  fmtConfidence,
  fmtCoords,
  fmtDateTime,
  fmtKm,
  fmtMs,
  fmtPressure,
  fmtWind,
  titleCase,
} from "@/lib/format";
import type { PredictionRun } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ForecastPanel({
  run,
  baseTime,
  isRunning,
  error,
  onRun,
  forecastReady,
  className,
}: {
  run: PredictionRun | null | undefined;
  baseTime: string | null;
  isRunning: boolean;
  error: unknown;
  onRun: (force: boolean) => void;
  forecastReady: boolean;
  className?: string | undefined;
}) {
  const staleBase = Boolean(run && baseTime && run.baseObservationAt !== baseTime);

  return (
    <Panel
      title="Forecast"
      provenance={run ? <StatusChip status={run.overallStatus} /> : null}
      action={
        <Button
          variant="primary"
          size="sm"
          disabled={isRunning || !forecastReady}
          onClick={() => onRun(true)}
          title={
            forecastReady
              ? "Send the fixes up to the selected time to the trained models"
              : "This storm has too few reported fixes to forecast"
          }
        >
          {isRunning ? "Running model…" : staleBase || !run ? "Run model" : "Re-run"}
        </Button>
      }
      className={className}
      bodyClassName="divide-y divide-border"
    >
      {!forecastReady ? (
        <Empty
          title="This storm cannot be forecast"
          detail="The models need at least three reported fixes with a wind speed. See the data-quality panel for what is missing."
        />
      ) : error ? (
        <ForecastError error={error} />
      ) : isRunning ? (
        <div className="graticule flex h-40 flex-col items-center justify-center gap-2">
          <div className="h-1 w-28 overflow-hidden rounded bg-muted">
            <div className="h-full w-1/3 animate-[loading_1.1s_ease-in-out_infinite] rounded bg-model" />
          </div>
          <p className="label-xs">Inference running on the AI service</p>
          <style>{`@keyframes loading{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}`}</style>
        </div>
      ) : !run ? (
        <Empty
          title="No forecast yet"
          detail={
            baseTime
              ? `Run the models from ${fmtDateTime(baseTime)} to see a predicted track, intensity and historical analogues.`
              : "Select a fix on the timeline, then run the models."
          }
        />
      ) : (
        <>
          {staleBase ? (
            <div className="bg-primary/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-primary">
              Showing the forecast made from {fmtDateTime(run.baseObservationAt)}. The timeline
              is on a different fix — run the model again to forecast from there.
            </div>
          ) : null}

          <RunHeader run={run} />
          <TrackSection run={run} />
          <IntensitySection run={run} />
          <AnalogueSection run={run} />
          <InputSection run={run} />
        </>
      )}
    </Panel>
  );
}

function ForecastError({ error }: { error: unknown }) {
  if (error instanceof ApiError) {
    if (error.isUnprocessable) {
      return (
        <Empty
          tone="warning"
          title="The models declined this request"
          detail={error.message}
        />
      );
    }
    if (error.isUnavailable) {
      return (
        <Empty
          tone="warning"
          title="No model available"
          detail={`${error.message} The archive stays browsable; forecasting resumes when the AI service has a trained checkpoint loaded.`}
        />
      );
    }
    if (error.isOffline) {
      return (
        <Empty tone="warning" title="Backend unreachable" detail={error.message} />
      );
    }
    return <Empty tone="warning" title="Forecast failed" detail={error.message} />;
  }
  return (
    <Empty
      tone="warning"
      title="Forecast failed"
      detail={error instanceof Error ? error.message : "Unknown error."}
    />
  );
}

function RunHeader({ run }: { run: PredictionRun }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-3 py-2.5">
      <Metric
        label="Forecast base"
        value={fmtDateTime(run.baseObservationAt)}
        source="observed"
      />
      <Metric label="Fixes used" value={String(run.observationsUsed)} source="observed" />
      <Metric label="Run at" value={fmtDateTime(run.createdAt)} />
      <Metric label="Inference" value={fmtMs(run.inferenceMs)} />
    </div>
  );
}

function TrackSection({ run }: { run: PredictionRun }) {
  const { trajectory } = run;
  return (
    <div className="px-3 py-2.5">
      <SectionHead
        title="Predicted track"
        status={trajectory.status}
        model={`${trajectory.model.name ?? ABSENT} ${trajectory.model.version ?? ""}`.trim()}
        confidence={trajectory.confidence}
        confidenceHint="Skill against a persistence baseline on held-out storms at the longest horizon"
        source="model"
      />
      {trajectory.status !== "COMPLETED" ? (
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
          {trajectory.reason ?? "The track model produced no forecast."}
        </p>
      ) : (
        <>
          {trajectory.reason ? (
            <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-primary">
              {trajectory.reason}
            </p>
          ) : null}
          <table className="mt-2 w-full">
            <thead>
              <tr className="text-left">
                <th className="label-xs pb-1">Horizon</th>
                <th className="label-xs pb-1">Position</th>
                <th className="label-xs pb-1 text-right">Mean error</th>
              </tr>
            </thead>
            <tbody className="num text-xs">
              {trajectory.points.map((point) => (
                <tr key={point.forecastHours} className="border-t border-border/60">
                  <td className="py-1 text-model">+{point.forecastHours}h</td>
                  <td className="py-1">{fmtCoords(point.latitude, point.longitude)}</td>
                  <td
                    className={cn(
                      "py-1 text-right",
                      point.uncertaintyRadiusKm === null && "text-absent",
                    )}
                    title={
                      point.uncertaintyRadiusKm === null
                        ? "This checkpoint recorded no held-out error at this horizon, so no cone is drawn"
                        : "The model's measured mean position error at this horizon on storms it never saw"
                    }
                  >
                    {fmtKm(point.uncertaintyRadiusKm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function IntensitySection({ run }: { run: PredictionRun }) {
  const { intensity } = run;
  return (
    <div className="px-3 py-2.5">
      <SectionHead
        title="Predicted intensity"
        status={intensity.status}
        model={`${intensity.model.name ?? ABSENT} ${intensity.model.version ?? ""}`.trim()}
        confidence={intensity.confidence}
        confidenceHint="Model's own confidence in the trend class"
        source="model"
      />
      {intensity.status !== "COMPLETED" ? (
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
          {intensity.reason ?? "The intensity model produced no forecast."}
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="label-xs">Trend</span>
            <span className="num text-sm text-model">{titleCase(intensity.trend)}</span>
          </div>
          <table className="mt-2 w-full">
            <thead>
              <tr className="text-left">
                <th className="label-xs pb-1">Horizon</th>
                <th className="label-xs pb-1">Wind</th>
                <th className="label-xs pb-1">Pressure</th>
                <th className="label-xs pb-1 text-right">Category</th>
              </tr>
            </thead>
            <tbody className="num text-xs">
              {intensity.points.map((point) => (
                <tr key={point.forecastHours} className="border-t border-border/60">
                  <td className="py-1 text-model">+{point.forecastHours}h</td>
                  <td
                    className="py-1"
                    style={{ color: categoryColorForWind(point.windSpeedKph) }}
                  >
                    {fmtWind(point.windSpeedKph)}
                  </td>
                  <td className="py-1">{fmtPressure(point.pressureHpa)}</td>
                  <td className="py-1 text-right text-[0.6875rem] text-muted-foreground">
                    {point.category ?? ABSENT}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function AnalogueSection({ run }: { run: PredictionRun }) {
  const { analogues } = run;
  return (
    <div className="px-3 py-2.5">
      <SectionHead
        title="Historical analogues"
        status={analogues.status}
        model={analogues.model.name ?? ABSENT}
        confidence={analogues.confidence}
        confidenceHint="Ensemble skill against persistence on held-out storms"
        source="analogue"
      />
      {analogues.status !== "COMPLETED" ? (
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
          {analogues.reason ?? "No analogue analysis was produced."}
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
            Storms whose previous 24 hours evolved like this one. Their subsequent tracks form
            a second forecast, independent of the neural models.
          </p>
          <ul className="mt-2 space-y-1">
            {analogues.matches.map((match) => (
              <li
                key={match.rank}
                className="flex items-center justify-between gap-2 border-t border-border/60 py-1"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="num text-[0.6875rem] text-absent">#{match.rank}</span>
                  {match.cycloneId ? (
                    <Link
                      to="/storm/$id"
                      params={{ id: match.cycloneId }}
                      className="truncate text-xs text-analogue hover:underline"
                    >
                      {match.name ?? match.externalId}
                    </Link>
                  ) : (
                    <span className="truncate text-xs">{match.name ?? match.externalId}</span>
                  )}
                  <span className="num text-[0.6875rem] text-muted-foreground">
                    {match.seasonYear ?? ""}
                  </span>
                </span>
                <span
                  className="num text-[0.6875rem] text-analogue"
                  title={`Match basis: ${match.basis.join(", ").toLowerCase().replace(/_/g, " ")}`}
                >
                  {match.similarityScore.toFixed(3)}
                </span>
              </li>
            ))}
          </ul>
          {analogues.points.length > 0 ? (
            <table className="mt-2 w-full">
              <thead>
                <tr className="text-left">
                  <th className="label-xs pb-1">Ensemble</th>
                  <th className="label-xs pb-1">Position</th>
                  <th className="label-xs pb-1 text-right">Spread</th>
                </tr>
              </thead>
              <tbody className="num text-xs">
                {analogues.points.map((point) => (
                  <tr key={point.forecastHours} className="border-t border-border/60">
                    <td className="py-1 text-analogue">+{point.forecastHours}h</td>
                    <td className="py-1">{fmtCoords(point.latitude, point.longitude)}</td>
                    <td
                      className="py-1 text-right"
                      title={`${point.memberCount ?? 0} storms; spread is their mean distance from the ensemble mean`}
                    >
                      {fmtKm(point.spreadKm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      )}
    </div>
  );
}

/** What went in, so a forecast can be inspected rather than trusted. */
function InputSection({ run }: { run: PredictionRun }) {
  return (
    <div className="px-3 py-2.5">
      <div className="label-xs">Inputs</div>
      <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
        {run.observationsUsed} reported fixes up to {fmtDateTime(run.baseObservationAt)}. Later
        fixes were excluded, so this is a forecast rather than a lookup.
      </p>
      {run.inputNotes.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {run.inputNotes.map((note) => (
            <li key={note} className="text-[0.6875rem] leading-relaxed text-primary/90">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        to="/lab/$id"
        params={{ id: run.cycloneId }}
        className="mt-2 inline-block text-[0.6875rem] text-observed hover:underline"
      >
        Open in Prediction Lab →
      </Link>
    </div>
  );
}

function SectionHead({
  title,
  status,
  model,
  confidence,
  confidenceHint,
  source,
}: {
  title: string;
  status: string | null;
  model: string;
  confidence: number | null;
  confidenceHint: string;
  source: "model" | "analogue";
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="label-xs text-foreground/90">{title}</span>
          <StatusChip status={status} />
        </div>
        <Provenance source={source} detail={model} className="mt-1" />
      </div>
      <div className="text-right">
        <div className="label-xs">Skill</div>
        <div
          className={cn("num text-sm", confidence === null ? "text-absent" : "text-foreground")}
          title={confidence === null ? "No evaluation was recorded for this model" : confidenceHint}
        >
          {fmtConfidence(confidence)}
        </div>
      </div>
    </div>
  );
}
