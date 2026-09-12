/**
 * Storm DNA: a storm's whole life as numbers, and the archive storms whose
 * lives were closest.
 *
 * Two things this must keep straight. It is not a forecast and not the analogue
 * ensemble — the analogue engine matches the last 24 hours to predict the next
 * 24, while this compares completed lives — so it is drawn in the observed hue
 * rather than the model or analogue one. And the comparison table puts this
 * storm in the first row, so a distance is read against the numbers that
 * produced it instead of being taken on trust.
 */

import { Link } from "@tanstack/react-router";

import { Empty, Metric, Panel, Provenance, Skeleton } from "@/components/console/primitives";
import { ABSENT, fmtKm, fmtNumber, fmtPressure, fmtWind } from "@/lib/format";
import { useStormDna } from "@/lib/queries";
import type { StormSignature } from "@/lib/types";

function fmtHoursShort(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return ABSENT;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

function fmtDegrees(value: number | null | undefined): string {
  if (value === null || value === undefined) return ABSENT;
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}°`;
}

/** Where in its life the peak fell, said in words rather than as a decimal. */
function fmtPeakTiming(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) return ABSENT;
  return `${Math.round(fraction * 100)}% in`;
}

function Traits({ traits }: { traits: string[] }) {
  if (traits.length === 0) {
    return (
      <p className="text-[0.6875rem] text-muted-foreground">
        Nothing about this storm stood out from the archive.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {traits.map((trait) => (
        <span
          key={trait}
          className="rounded-sm border border-observed/40 bg-observed/10 px-1.5 py-0.5 text-[0.625rem] text-observed"
        >
          {trait}
        </span>
      ))}
    </div>
  );
}

function SignatureGrid({ signature }: { signature: StormSignature }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="label-xs mb-1.5">Life</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
          <Metric
            label="Lifetime"
            value={fmtHoursShort(signature.lifetimeHours)}
            source="observed"
          />
          <Metric label="Fixes" value={String(signature.fixCount)} source="observed" />
          <Metric label="Peak wind" value={fmtWind(signature.peakWindKph)} source="observed" />
          <Metric
            label="Min pressure"
            value={fmtPressure(signature.minPressureHpa)}
            source="observed"
          />
          <Metric
            label="Formed at"
            value={
              signature.genesisLatitude === null || signature.genesisLatitude === undefined
                ? ABSENT
                : `${Math.abs(signature.genesisLatitude).toFixed(1)}°${signature.genesisLatitude >= 0 ? "N" : "S"}`
            }
            source="observed"
          />
          <Metric
            label="Peaked at"
            value={
              signature.peakLatitude === null || signature.peakLatitude === undefined
                ? ABSENT
                : `${Math.abs(signature.peakLatitude).toFixed(1)}°${signature.peakLatitude >= 0 ? "N" : "S"}`
            }
            source="observed"
          />
          <Metric
            label="Peak timing"
            value={fmtPeakTiming(signature.timeToPeakFraction)}
            unitHint="of its life"
          />
          <Metric
            label="At hurricane force"
            value={fmtHoursShort(signature.hoursAtHurricaneForce)}
            source="observed"
          />
        </div>
      </div>

      <div className="border-t border-border pt-2.5">
        <p className="label-xs mb-1.5">Track</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
          <Metric
            label="Distance travelled"
            value={fmtKm(signature.trackLengthKm)}
            source="observed"
          />
          <Metric
            label="Start to end"
            value={fmtKm(signature.netDisplacementKm)}
            source="observed"
          />
          <Metric
            label="Crookedness"
            value={fmtNumber(signature.sinuosity, 2)}
            unitHint="1.0 is straight"
          />
          <Metric label="Poleward" value={fmtDegrees(signature.polewardDegrees)} />
          <Metric
            label="Mean speed"
            value={fmtWind(signature.meanTranslationKph)}
            source="observed"
          />
          <Metric
            label="Fastest leg"
            value={fmtWind(signature.maxTranslationKph)}
            source="observed"
          />
        </div>
      </div>

      <div className="border-t border-border pt-2.5">
        <p className="label-xs mb-1.5">Change over 24 hours</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
          <Metric
            label="Strongest gain"
            value={fmtWind(signature.maxIntensification24hKph)}
            source="observed"
            accent={signature.rapidIntensification ? "var(--cat-5)" : undefined}
          />
          <Metric
            label="Steepest fall"
            value={
              signature.maxWeakening24hKph === null || signature.maxWeakening24hKph === undefined
                ? ABSENT
                : fmtWind(Math.abs(signature.maxWeakening24hKph))
            }
            source="observed"
          />
          <Metric
            label="Rapid intensification"
            value={signature.rapidIntensification ? "Yes" : "No"}
            unitHint="30 kt in 24 h"
            accent={signature.rapidIntensification ? "var(--cat-5)" : undefined}
          />
        </div>
      </div>
    </div>
  );
}

export function StormDnaPanel({ cycloneId }: { cycloneId: string }) {
  const dna = useStormDna(cycloneId);

  if (dna.isLoading) {
    return (
      <Panel title="Storm DNA" bodyClassName="p-3">
        <Skeleton className="h-40 w-full" />
      </Panel>
    );
  }

  if (dna.isError || !dna.data) {
    return (
      <Panel title="Storm DNA" bodyClassName="p-3">
        <Empty
          tone="warning"
          title="Signature unavailable"
          detail={dna.error instanceof Error ? dna.error.message : null}
        />
      </Panel>
    );
  }

  const { signature, neighbours, method, comparedWith } = dna.data;

  return (
    <Panel
      title="Storm DNA"
      provenance={<Provenance source="observed" detail="derived from reported fixes" />}
      action={
        <span className="num text-[0.6875rem] text-muted-foreground">
          {comparedWith.toLocaleString()} storms compared
        </span>
      }
      bodyClassName="p-3"
    >
      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-3">
          <SignatureGrid signature={signature} />
          <div className="border-t border-border pt-2.5">
            <p className="label-xs mb-1.5">What stands out</p>
            <Traits traits={signature.traits} />
          </div>
          {signature.limitations.length > 0 ? (
            <ul className="space-y-1 border-t border-border pt-2.5">
              {signature.limitations.map((limitation) => (
                <li key={limitation} className="text-[0.6875rem] leading-relaxed text-primary/90">
                  {limitation}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="space-y-2">
          <div>
            <p className="label-xs">Closest lives in the archive</p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
              Storms whose whole lives resemble this one. This is not a forecast and not the
              analogue ensemble, which matches recent motion to predict what comes next.
            </p>
          </div>

          {neighbours.length === 0 ? (
            <Empty
              title="Not comparable"
              detail="This storm has too few measured traits to be placed against the archive."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-xs py-1 pr-2">Storm</th>
                    <th className="label-xs py-1 pr-2 text-right">Peak</th>
                    <th className="label-xs py-1 pr-2 text-right">Life</th>
                    <th className="label-xs py-1 pr-2 text-right">Track</th>
                    <th
                      className="label-xs py-1 text-right"
                      title="Standard deviations of the archive, averaged over shared traits. 0 is identical."
                    >
                      Dist.
                    </th>
                  </tr>
                </thead>
                <tbody className="num text-[0.6875rem]">
                  {/* The subject first, so a distance is read against the numbers it came from. */}
                  <tr className="border-b border-border/60 bg-accent/40">
                    <td className="py-1.5 pr-2">
                      <span className="text-foreground">
                        {signature.name ?? signature.externalId}
                      </span>{" "}
                      <span className="text-muted-foreground">{signature.seasonYear}</span>
                      <span className="ml-1 text-[0.625rem] text-muted-foreground">
                        {signature.basin}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right">{fmtWind(signature.peakWindKph)}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {fmtHoursShort(signature.lifetimeHours)}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{fmtKm(signature.trackLengthKm)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">this storm</td>
                  </tr>
                  {neighbours.map((neighbour, index) => (
                    <tr key={neighbour.cycloneId} className="border-b border-border/40">
                      <td className="py-1.5 pr-2">
                        <Link
                          to="/storm/$id"
                          params={{ id: neighbour.cycloneId }}
                          className="hover:text-primary"
                        >
                          <span className="text-muted-foreground">#{index + 1}</span>{" "}
                          <span className="text-foreground">
                            {neighbour.name ?? neighbour.externalId}
                          </span>{" "}
                          <span className="text-muted-foreground">{neighbour.seasonYear}</span>
                          <span className="ml-1 text-[0.625rem] text-muted-foreground">
                            {neighbour.basin}
                          </span>
                        </Link>
                        {neighbour.sharedTraits.length > 0 ? (
                          <span className="mt-0.5 block font-sans text-[0.625rem] leading-snug text-observed/80">
                            {neighbour.sharedTraits.join(" · ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-2 text-right align-top">
                        {fmtWind(neighbour.peakWindKph)}
                      </td>
                      <td className="py-1.5 pr-2 text-right align-top">
                        {fmtHoursShort(neighbour.lifetimeHours)}
                      </td>
                      <td className="py-1.5 pr-2 text-right align-top">
                        {fmtKm(neighbour.trackLengthKm)}
                      </td>
                      <td
                        className="py-1.5 text-right align-top"
                        title={`${neighbour.traitsCompared} traits compared`}
                      >
                        {neighbour.distance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="border-t border-border pt-2 text-[0.625rem] leading-relaxed text-muted-foreground">
            {method}
          </p>
        </div>
      </div>
    </Panel>
  );
}
