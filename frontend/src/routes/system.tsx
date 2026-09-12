/**
 * System and provenance.
 *
 * What is loaded, what it was trained on, where the data came from, and what
 * the system therefore cannot do. This screen exists so nothing elsewhere has
 * to be taken on faith: every claim the interface makes about the models is
 * checkable here against the AI service's own health report.
 */

import { createFileRoute } from "@tanstack/react-router";

import { Empty, Metric, Panel, Skeleton, StatusChip } from "@/components/console/primitives";
import { fmtDateTime } from "@/lib/format";
import { useSystemStatus } from "@/lib/queries";
import type { SystemModel } from "@/lib/types";
import { API_BASE } from "@/lib/api";

export const Route = createFileRoute("/system")({
  component: System,
});

const MODEL_LABELS: Record<string, { title: string; purpose: string }> = {
  trajectory: {
    title: "Track model",
    purpose: "Predicts where the storm will be at +6, +12 and +24 hours.",
  },
  intensity: {
    title: "Intensity model",
    purpose: "Predicts wind, pressure and a strengthening or weakening trend.",
  },
  similarity: {
    title: "Analogue ensemble",
    purpose:
      "Finds past storms whose previous 24 hours evolved like this one, and aggregates what they did next as a second, independent forecast.",
  },
  satellite: {
    title: "Satellite vision model",
    purpose: "Classifies a satellite frame. Needs imagery to be trained on.",
  },
};

function System() {
  const { data, isLoading, isError, error } = useSystemStatus();

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Empty
        tone="warning"
        title="Cannot reach the backend"
        detail={
          error instanceof Error
            ? `${error.message} The Spring Boot service is expected at ${API_BASE}.`
            : null
        }
      />
    );
  }

  const models = Object.entries(data.ai.models ?? {});

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="space-y-2 p-2">
        <Panel title="Pipeline" bodyClassName="p-3">
          <div className="flex flex-wrap items-center gap-2 text-[0.6875rem]">
            <Node label="React console" detail="this browser" ok />
            <Arrow />
            <Node label="Spring Boot" detail={API_BASE} ok />
            <Arrow />
            <Node
              label="PostgreSQL"
              detail={`${data.data.observations.toLocaleString()} fixes`}
              ok={data.data.observations > 0}
            />
            <Arrow />
            <Node label="AI service" detail={data.ai.url} ok={data.ai.reachable} />
            <Arrow />
            <Node
              label="Trained models"
              detail={`${models.filter(([, model]) => model.available).length} of ${models.length} loaded`}
              ok={models.some(([, model]) => model.available)}
            />
          </div>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
            The browser never calls the AI service directly. Spring Boot owns orchestration,
            validation and persistence, and is the only client of the Python service.
          </p>
        </Panel>

        <div className="grid gap-2 lg:grid-cols-2">
          <Panel title="Models" bodyClassName="divide-y divide-border">
            {!data.ai.reachable ? (
              <Empty tone="warning" title="AI service offline" detail={data.ai.detail} />
            ) : models.length === 0 ? (
              <Empty title="The AI service reported no models" />
            ) : (
              models.map(([key, model]) => <ModelRow key={key} name={key} model={model} />)
            )}
          </Panel>

          <div className="space-y-2">
            <Panel title="Data" bodyClassName="p-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Metric
                  label="Storms"
                  value={data.data.cyclones.toLocaleString()}
                  source="observed"
                />
                <Metric
                  label="Observations"
                  value={data.data.observations.toLocaleString()}
                  source="observed"
                />
                <Metric label="Forecast runs" value={data.data.forecastRuns.toLocaleString()} />
                <Metric
                  label="Satellite analyses"
                  value={data.data.satelliteAnalyses.toLocaleString()}
                />
                <Metric
                  label="Newest fix"
                  value={fmtDateTime(data.data.latestObservation)}
                  source="observed"
                />
                <Metric label="AI service version" value={data.ai.version ?? "—"} />
              </div>
            </Panel>

            <Panel title="Provenance" bodyClassName="space-y-2 p-3">
              <Field label="Observation source" value={data.data.observationSource} />
              <Field label="Wind scale" value={data.data.windScale} />
              <Field
                label="Ingest source"
                value={
                  data.data.ingestSourceAvailable
                    ? data.data.ingestSourcePath
                    : `${data.data.ingestSourcePath} (not readable from the backend)`
                }
              />
              <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                Observations come from the NOAA IBTrACS best-track archive, filtered to reported
                00/06/12/18Z fixes with wind taken from a single agency so averaging periods are not
                mixed. That is the same table the models were trained on, so what they are asked at
                inference matches what they learned from.
              </p>
              <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                There is no live feed: this is an archive, so storms are marked ARCHIVED or RECENT
                and never "active".
              </p>
            </Panel>
          </div>
        </div>

        <Panel title="What this system does not do" bodyClassName="space-y-1.5 p-3">
          <Limitation>
            It does not issue warnings. Model output is not an official forecast from any
            meteorological agency.
          </Limitation>
          <Limitation>
            It does not estimate landfall risk or impact. Doing that credibly needs coastline
            geometry and exposure data that are not in this system, so it is absent rather than
            approximated.
          </Limitation>
          <Limitation>
            It does not use environmental fields. Sea-surface temperature, humidity and wind shear
            are accepted by the model interface but no such data has been joined to these tracks, so
            the models run on track history alone.
          </Limitation>
          <Limitation>
            It does not analyse satellite imagery yet. The pipeline is built and the vision model
            has an architecture, but no imagery has been obtained to train it.
          </Limitation>
        </Panel>
      </div>
    </div>
  );
}

function ModelRow({ name, model }: { name: string; model: SystemModel }) {
  const label = MODEL_LABELS[name] ?? { title: name, purpose: "" };
  return (
    <div className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{label.title}</span>
            <StatusChip status={model.state} />
          </div>
          <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
            {label.purpose}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="num text-[0.6875rem]">{model.name ?? "—"}</div>
          <div className="num text-[0.625rem] text-muted-foreground">
            {model.version ? `v${model.version}` : ""}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {model.horizons && model.horizons.length > 0 ? (
          <Metric
            label="Horizons"
            value={model.horizons.map((hours) => `+${hours}h`).join(" · ")}
          />
        ) : null}
        {model.trainedAt ? <Metric label="Trained" value={fmtDateTime(model.trainedAt)} /> : null}
        {model.analogueStorms ? (
          <Metric label="Archive storms" value={model.analogueStorms.toLocaleString()} />
        ) : null}
      </div>

      {model.reason ? (
        <p className="mt-2 border-t border-border pt-2 text-[0.6875rem] leading-relaxed text-primary/90">
          {model.reason}
        </p>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="label-xs">{label}</span>
      <p className="num mt-0.5 break-all text-[0.6875rem]">{value}</p>
    </div>
  );
}

function Limitation({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
      <span className="mt-[0.3rem] h-1 w-1 shrink-0 rounded-full bg-absent" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Node({ label, detail, ok }: { label: string; detail: string; ok: boolean }) {
  return (
    <span className="panel-raised px-2 py-1.5">
      <span className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-model" : "bg-destructive"}`}
          aria-hidden
        />
        <span className="text-[0.6875rem] font-medium">{label}</span>
      </span>
      <span className="num mt-0.5 block text-[0.625rem] text-muted-foreground">{detail}</span>
    </span>
  );
}

function Arrow() {
  return <span className="text-muted-foreground">→</span>;
}
