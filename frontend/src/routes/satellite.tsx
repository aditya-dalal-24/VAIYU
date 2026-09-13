/**
 * Satellite Intelligence.
 *
 * Upload a frame, pick the storm it belongs to, and send it to the vision
 * model. What comes back is shown exactly as the model produced it, including
 * the case that matters today: no satellite checkpoint has been trained, so the
 * model reports itself unavailable with a reason. That is displayed as the
 * result — the alternative, inventing a detection and a confidence, is the
 * failure this screen exists to avoid.
 *
 * The upload is real: the file is stored by the backend and served at a URL the
 * AI service fetches, which is how the contract keeps binaries out of the JSON.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { StormPicker } from "@/components/console/StormPicker";
import {
  Button,
  Empty,
  Metric,
  Panel,
  Provenance,
  StatusChip,
} from "@/components/console/primitives";
import { ApiError } from "@/lib/api";
import { fmtConfidence, fmtCoords, fmtDateTime, fmtMs, stormName } from "@/lib/format";
import { useAnalyseSatellite, useSatelliteAnalyses, useSystemStatus } from "@/lib/queries";
import type { CycloneSummary, SatelliteAnalysis } from "@/lib/types";

export const Route = createFileRoute("/satellite")({
  component: SatelliteIntelligence,
});

function SatelliteIntelligence() {
  const status = useSystemStatus();
  const analyses = useSatelliteAnalyses(20);
  const analyse = useAnalyseSatellite();

  const [storm, setStorm] = useState<CycloneSummary | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageType, setImageType] = useState("");
  const [result, setResult] = useState<SatelliteAnalysis | null>(null);

  const model = status.data?.ai.models?.["satellite"];
  const knownSources = model?.sources ?? [];

  function submit() {
    if (!storm) return;
    setResult(null);
    analyse.mutate(
      {
        cycloneId: storm.id,
        file: file ?? undefined,
        imageType: imageType.trim() || undefined,
      },
      { onSuccess: setResult },
    );
  }

  // Upload only: the backend analyses images it stored itself, because the AI
  // service fetches the URL from inside the network and an arbitrary URL would
  // let a caller point it at internal hosts.
  const canSubmit = Boolean(storm) && Boolean(file);

  return (
    <div className="flex h-full min-h-0 gap-2 p-2">
      <aside className="hidden w-[240px] shrink-0 lg:block">
        <StormPicker selectedId={storm?.id ?? null} onSelect={setStorm} className="h-full" />
      </aside>

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[380px_1fr]">
        <div className="space-y-2">
          <Panel title="Model" bodyClassName="p-3">
            {!status.data ? (
              <p className="label-xs">Checking…</p>
            ) : !status.data.ai.reachable ? (
              <Empty tone="warning" title="AI service offline" detail={status.data.ai.detail} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Metric
                    label="State"
                    value={model?.state ?? "UNAVAILABLE"}
                    accent={model?.available ? "var(--model)" : "var(--absent)"}
                  />
                  <Metric label="Name" value={model?.name ?? "—"} />
                </div>
                {!model?.available ? (
                  <p className="mt-2 border-t border-border pt-2 text-[0.6875rem] leading-relaxed text-primary/90">
                    {model?.reason ??
                      "No satellite checkpoint is loaded. An analysis will be recorded, and it will report itself unavailable rather than returning a detection."}
                  </p>
                ) : knownSources.length > 0 ? (
                  <div className="mt-2 border-t border-border pt-2">
                    <span className="label-xs">Recognised sensors</span>
                    <ul className="num mt-1 space-y-0.5 text-[0.625rem] text-muted-foreground">
                      {knownSources.map((source) => (
                        <li key={source}>{source}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </Panel>

          <Panel title="Analyse a frame" bodyClassName="space-y-3 p-3">
            <div>
              <span className="label-xs">Storm</span>
              <p className="mt-0.5 text-xs">
                {storm ? (
                  <>
                    {stormName(storm.name, storm.externalId)}{" "}
                    <span className="num text-[0.625rem] text-muted-foreground">
                      {storm.externalId}
                    </span>
                  </>
                ) : (
                  <span className="text-absent">Pick a storm from the list</span>
                )}
              </p>
              <p className="mt-1 text-[0.625rem] leading-relaxed text-muted-foreground">
                The storm's latest reported fix is sent with the image, because the analysis request
                carries a position and inventing one would be fabricated input.
              </p>
            </div>

            <label className="block">
              <span className="label-xs">Image file</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/tiff,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-1 w-full cursor-pointer rounded border border-border bg-background px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-0.5 file:text-xs file:text-secondary-foreground"
              />
            </label>

            <label className="block">
              <span className="label-xs">Sensor and band</span>
              <input
                value={imageType}
                onChange={(event) => setImageType(event.target.value)}
                placeholder="INSAT-3DR|TIR1 10.8 um"
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-input"
              />
              <span className="mt-1 block text-[0.625rem] leading-relaxed text-muted-foreground">
                Optional. Naming the sensor lets the model use what it learned for that instrument;
                without it the result is flagged as an unknown source.
              </span>
            </label>

            <Button variant="primary" disabled={!canSubmit || analyse.isPending} onClick={submit}>
              {analyse.isPending ? "Analysing…" : "Send to model"}
            </Button>

            {analyse.error ? (
              <p className="text-[0.6875rem] leading-relaxed text-destructive">
                {analyse.error instanceof ApiError ? analyse.error.message : String(analyse.error)}
              </p>
            ) : null}
          </Panel>
        </div>

        <div className="min-h-0 space-y-2 overflow-auto">
          <Panel title="Result" bodyClassName="p-3">
            {!result ? (
              <Empty
                title="No analysis run yet"
                detail="Upload a frame and send it to the model. The result appears here exactly as the model returned it."
              />
            ) : (
              <AnalysisResult analysis={result} />
            )}
          </Panel>

          <Panel
            title="Recent analyses"
            action={
              <span className="num text-[0.6875rem] text-muted-foreground">
                {(analyses.data ?? []).length}
              </span>
            }
          >
            {(analyses.data ?? []).length === 0 ? (
              <Empty title="Nothing analysed yet" />
            ) : (
              <ul>
                {(analyses.data ?? []).map((analysis) => (
                  <li
                    key={analysis.id}
                    className="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="num block text-[0.6875rem]">
                        {fmtDateTime(analysis.createdAt)}
                      </span>
                      <span className="block truncate text-[0.625rem] text-muted-foreground">
                        {analysis.imageType ?? "unspecified sensor"} ·{" "}
                        {analysis.reason ?? analysis.modelName ?? ""}
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

function AnalysisResult({ analysis }: { analysis: SatelliteAnalysis }) {
  const completed = analysis.status === "COMPLETED";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <StatusChip status={analysis.status} />
        <Provenance
          source={completed ? "model" : "absent"}
          detail={
            analysis.modelName
              ? `${analysis.modelName} ${analysis.modelVersion ?? ""}`.trim()
              : undefined
          }
        />
      </div>

      {!completed ? (
        <Empty
          tone="warning"
          title="The model did not analyse this image"
          detail={analysis.reason}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Metric
              label="Cyclone detected"
              value={
                analysis.cycloneDetected === null ? "—" : analysis.cycloneDetected ? "Yes" : "No"
              }
              source="model"
              accent={analysis.cycloneDetected ? "var(--model)" : undefined}
            />
            <Metric label="Confidence" value={fmtConfidence(analysis.confidence)} source="model" />
            <Metric
              label="Centre"
              value={
                analysis.centerLatitude !== null && analysis.centerLongitude !== null
                  ? fmtCoords(analysis.centerLatitude, analysis.centerLongitude)
                  : "—"
              }
              source="model"
            />
            <Metric label="Inference" value={fmtMs(analysis.inferenceMs)} />
          </div>
          {analysis.reason ? (
            <p className="text-[0.6875rem] leading-relaxed text-primary/90">{analysis.reason}</p>
          ) : null}
          {analysis.labelDefinition ? (
            <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
              A positive answer means: {analysis.labelDefinition}
            </p>
          ) : null}
        </>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <figure>
          <figcaption className="label-xs mb-1">Submitted frame</figcaption>
          <img
            src={analysis.imageUrl}
            alt="Submitted satellite frame"
            className="w-full rounded border border-border bg-background object-contain"
          />
        </figure>
        <figure>
          <figcaption className="label-xs mb-1">Model attention</figcaption>
          {analysis.gradcamUrl ? (
            <img
              src={analysis.gradcamUrl}
              alt="Grad-CAM attention overlay produced by the model"
              className="w-full rounded border border-border bg-background object-contain"
            />
          ) : (
            <div className="flex h-full min-h-32 items-center justify-center rounded border border-border graticule px-4 text-center">
              <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                No attention overlay. The model does not produce one yet, so nothing is shown here
                rather than an illustration.
              </p>
            </div>
          )}
        </figure>
      </div>
    </div>
  );
}
