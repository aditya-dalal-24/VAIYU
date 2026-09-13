/**
 * Seasons: how active each year was, and in which sea.
 *
 * This screen exists for one comparison in particular. The Arabian Sea and the
 * Bay of Bengal are a single IBTrACS basin code, but they are two seas on
 * opposite sides of the Indian peninsula, and over this archive they have not
 * behaved alike — so the default view is the North Indian Ocean with the two
 * split apart.
 *
 * Everything here is counted from stored fixes. The one number that needs
 * explaining is ACE, and the page explains it rather than assuming the reader
 * knows: the summed square of the 1-minute wind over 6-hourly fixes at or
 * above 34 kt, which rewards storms that were both strong and long-lived.
 *
 * The decadal panel is where a reader could most easily be misled, so the
 * caveat sits next to the numbers: the earliest decades of this archive were
 * observed with less satellite coverage than the latest, and a rising count is
 * not by itself evidence of a rising number of storms.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Button,
  Empty,
  Metric,
  Panel,
  Provenance,
  Skeleton,
} from "@/components/console/primitives";
import { ABSENT, BASIN_NAMES, fmtNumber, fmtWind, stormName } from "@/lib/format";
import { useFilters, useSeasonActivity } from "@/lib/queries";
import type { SeasonActivity } from "@/lib/types";

export const Route = createFileRoute("/seasons")({
  component: Seasons,
});

/** Named ActivityMetric so it cannot be confused with the Metric component. */
type ActivityMetric = "storms" | "ace";

/** The two seas this screen is built around, in the order they are drawn. */
const NORTH_INDIAN_SEAS = ["AS", "BB"] as const;

const SEA_COLOURS: Record<string, string> = {
  AS: "var(--cat-3)",
  BB: "var(--observed)",
};

interface SeasonRow {
  season: number;
  bySea: Record<string, SeasonActivity>;
  totalStorms: number;
  totalAce: number;
}

function group(rows: SeasonActivity[]): SeasonRow[] {
  const bySeason = new Map<number, SeasonRow>();
  for (const row of rows) {
    const existing = bySeason.get(row.season) ?? {
      season: row.season,
      bySea: {},
      totalStorms: 0,
      totalAce: 0,
    };
    existing.bySea[row.subBasin ?? "none"] = row;
    existing.totalStorms += row.storms;
    existing.totalAce += row.ace;
    bySeason.set(row.season, existing);
  }
  return [...bySeason.values()].sort((a, b) => b.season - a.season);
}

/** Seas present in the data, so a basin with no sub-basins still renders. */
function seasIn(rows: SeasonActivity[]): string[] {
  const codes = new Set(rows.map((row) => row.subBasin ?? "none"));
  const known = NORTH_INDIAN_SEAS.filter((code) => codes.has(code));
  const rest = [...codes].filter((code) => !known.includes(code as "AS" | "BB")).sort();
  return [...known, ...rest];
}

function nameOfSea(rows: SeasonActivity[], code: string): string {
  if (code === "none") return "Not stated";
  return rows.find((row) => row.subBasin === code)?.subBasinName ?? code;
}

function Decades({ rows, seas }: { rows: SeasonActivity[]; seas: string[] }) {
  const decades = useMemo(() => {
    const map = new Map<number, Record<string, { storms: number; ace: number }>>();
    const seasons = new Map<number, Set<number>>();
    for (const row of rows) {
      const decade = Math.floor(row.season / 10) * 10;
      const entry = map.get(decade) ?? {};
      const sea = row.subBasin ?? "none";
      const current = entry[sea] ?? { storms: 0, ace: 0 };
      entry[sea] = { storms: current.storms + row.storms, ace: current.ace + row.ace };
      map.set(decade, entry);
      const years = seasons.get(decade) ?? new Set<number>();
      years.add(row.season);
      seasons.set(decade, years);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([decade, entry]) => ({
        decade,
        entry,
        seasonsCovered: seasons.get(decade)?.size ?? 0,
      }));
  }, [rows]);

  if (decades.length === 0) return null;

  return (
    <Panel
      title="By decade"
      provenance={<Provenance source="observed" detail="summed from reported fixes" />}
      bodyClassName="p-3"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="label-xs py-1 pr-3">Decade</th>
              {seas.map((sea) => (
                <th key={sea} className="label-xs py-1 pr-3 text-right">
                  {nameOfSea(rows, sea)} ACE
                </th>
              ))}
              {seas.map((sea) => (
                <th key={`${sea}-storms`} className="label-xs py-1 pr-3 text-right">
                  {nameOfSea(rows, sea)} storms
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num text-[0.6875rem]">
            {decades.map(({ decade, entry, seasonsCovered }) => (
              <tr key={decade} className="border-b border-border/40">
                <td className="py-1.5 pr-3">
                  {decade}s
                  {seasonsCovered < 10 ? (
                    <span className="ml-1 font-sans text-[0.625rem] text-primary/90">
                      {seasonsCovered} of 10 seasons
                    </span>
                  ) : null}
                </td>
                {seas.map((sea) => (
                  <td
                    key={sea}
                    className="py-1.5 pr-3 text-right"
                    style={{ color: SEA_COLOURS[sea] }}
                  >
                    {fmtNumber(entry[sea]?.ace ?? 0, 1)}
                  </td>
                ))}
                {seas.map((sea) => (
                  <td
                    key={`${sea}-storms`}
                    className="py-1.5 pr-3 text-right text-muted-foreground"
                  >
                    {entry[sea]?.storms ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 border-t border-border pt-2 text-[0.625rem] leading-relaxed text-muted-foreground">
        Read the earliest decades with care. This archive starts in 1980, and the satellite coverage
        behind a 1980s best track is not the coverage behind a 2020s one, so part of any rise across
        decades is in the observing rather than in the weather. A decade with fewer than ten seasons
        is marked.
      </p>
    </Panel>
  );
}

function Seasons() {
  const [basin, setBasin] = useState("NI");
  const [metric, setMetric] = useState<ActivityMetric>("ace");

  const filters = useFilters();
  const activity = useSeasonActivity(basin);

  const rows = activity.data ?? [];
  const seas = useMemo(() => seasIn(rows), [rows]);
  const grouped = useMemo(() => group(rows), [rows]);

  const chartData = useMemo(
    () =>
      [...grouped]
        .sort((a, b) => a.season - b.season)
        .map((row) => {
          const point: Record<string, number | string> = { season: row.season };
          for (const sea of seas) {
            point[sea] =
              metric === "ace" ? (row.bySea[sea]?.ace ?? 0) : (row.bySea[sea]?.storms ?? 0);
          }
          return point;
        }),
    [grouped, seas, metric],
  );

  const busiest = useMemo(
    () => [...grouped].sort((a, b) => b.totalAce - a.totalAce)[0] ?? null,
    [grouped],
  );

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="space-y-2 p-2">
        <Panel bodyClassName="flex flex-wrap items-end justify-between gap-4 p-3">
          <div className="min-w-0">
            <h1 className="font-display text-lg leading-none">Seasons</h1>
            <p className="mt-1.5 max-w-2xl text-[0.6875rem] leading-relaxed text-muted-foreground">
              How much energy each season put into storms, split by the sea they formed in. The
              North Indian Ocean is one IBTrACS basin and two seas: the Arabian Sea and the Bay of
              Bengal lie on opposite sides of the peninsula, and a storm in one is no threat to the
              coast of the other.
            </p>
          </div>

          <div className="flex items-end gap-3">
            <label>
              <span className="label-xs">Basin</span>
              <select
                value={basin}
                onChange={(event) => setBasin(event.target.value)}
                className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-input"
              >
                {(filters.data?.basins ?? ["NI"]).map((code) => (
                  <option key={code} value={code}>
                    {BASIN_NAMES[code] ?? code}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-1">
              <Button
                variant={metric === "ace" ? "primary" : undefined}
                size="sm"
                onClick={() => setMetric("ace")}
                title="Accumulated Cyclone Energy: the summed square of the 1-minute wind over 6-hourly fixes at or above 34 kt"
              >
                Energy
              </Button>
              <Button
                variant={metric === "storms" ? "primary" : undefined}
                size="sm"
                onClick={() => setMetric("storms")}
                title="Storms that reached at least tropical-storm force"
              >
                Storms
              </Button>
            </div>
          </div>
        </Panel>

        {activity.isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : rows.length === 0 ? (
          <Empty
            title="No seasons to show"
            detail="No storm in this basin reached tropical-storm force in the stored archive."
          />
        ) : (
          <>
            <Panel
              title={metric === "ace" ? "Accumulated cyclone energy by season" : "Storms by season"}
              provenance={<Provenance source="observed" detail="counted from reported fixes" />}
              action={
                busiest ? (
                  <span className="num text-[0.6875rem] text-muted-foreground">
                    busiest {busiest.season}
                  </span>
                ) : null
              }
              className="min-h-[320px]"
              bodyClassName="h-[320px] p-2 pt-3"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="season"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 10 }}
                    width={40}
                    label={{
                      value: metric === "ace" ? "10⁴ kt²" : "storms",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10, fill: "var(--muted-foreground)" },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                    formatter={(value: number, key: string) => [
                      metric === "ace" ? value.toFixed(1) : String(value),
                      nameOfSea(rows, key),
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(key: string) => nameOfSea(rows, key)}
                  />
                  {seas.map((sea) => (
                    <Bar
                      key={sea}
                      dataKey={sea}
                      stackId="seas"
                      fill={SEA_COLOURS[sea] ?? "var(--muted-foreground)"}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <div className="grid gap-2 lg:grid-cols-[1fr_1fr]">
              <Decades rows={rows} seas={seas} />

              <Panel
                title="Season by season"
                action={
                  <span className="num text-[0.6875rem] text-muted-foreground">
                    {grouped.length} seasons
                  </span>
                }
                bodyClassName="max-h-[420px]"
              >
                <table className="w-full">
                  <thead className="sticky top-0 bg-[var(--surface)]">
                    <tr className="border-b border-border text-left">
                      <th className="label-xs px-3 py-1.5">Season</th>
                      {seas.map((sea) => (
                        <th key={sea} className="label-xs px-3 py-1.5 text-right">
                          {nameOfSea(rows, sea)}
                        </th>
                      ))}
                      <th className="label-xs px-3 py-1.5">Strongest</th>
                    </tr>
                  </thead>
                  <tbody className="num text-[0.6875rem]">
                    {grouped.map((row) => {
                      const strongest = seas
                        .map((sea) => row.bySea[sea])
                        .filter((entry): entry is SeasonActivity => Boolean(entry))
                        .sort((a, b) => (b.peakWindKph ?? 0) - (a.peakWindKph ?? 0))[0];
                      return (
                        <tr key={row.season} className="border-b border-border/40">
                          <td className="px-3 py-1.5">{row.season}</td>
                          {seas.map((sea) => {
                            const entry = row.bySea[sea];
                            return (
                              <td key={sea} className="px-3 py-1.5 text-right">
                                {entry ? (
                                  <>
                                    <span style={{ color: SEA_COLOURS[sea] }}>
                                      {fmtNumber(entry.ace, 1)}
                                    </span>
                                    <span className="ml-1.5 text-[0.625rem] text-muted-foreground">
                                      {entry.storms}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-absent">{ABSENT}</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-1.5">
                            {strongest?.strongestStormId ? (
                              <Link
                                to="/storm/$id"
                                params={{ id: strongest.strongestStormId }}
                                className="hover:text-primary"
                              >
                                {stormName(strongest.strongestStorm, ABSENT)}
                                <span className="ml-1.5 text-[0.625rem] text-muted-foreground">
                                  {fmtWind(strongest.peakWindKph)}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-absent">{ABSENT}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            </div>

            <Panel title="What these numbers are" bodyClassName="p-3">
              <div className="grid gap-4 sm:grid-cols-3">
                <Metric
                  label="Energy"
                  value="ACE, 10⁴ kt²"
                  unitHint="summed square of the 1-minute wind over 6-hourly fixes at or above 34 kt"
                />
                <Metric
                  label="Storms"
                  value="reached 34 kt"
                  unitHint="a storm is counted in the sea it formed in"
                />
                <Metric
                  label="Wind scale"
                  value="1-minute sustained"
                  unitHint="IBTrACS USA_WIND, so seasons are comparable across basins"
                />
              </div>
              <p className="mt-2.5 border-t border-border pt-2 text-[0.625rem] leading-relaxed text-muted-foreground">
                ACE rewards storms that were both strong and long-lived, so one severe cyclone can
                outscore a season of four weak ones — which is the point of showing it next to the
                count rather than instead of it. A storm that formed in one sea and moved into the
                other is counted where it formed, the same rule the rest of the archive uses.
              </p>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
