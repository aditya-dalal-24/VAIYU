/**
 * Cyclone Explorer: the archive as a working table.
 *
 * Filtering and paging happen server-side, so this stays responsive over
 * thousands of storms. Rows are ranked by whatever the operator sorts on, and
 * each row shows the two numbers that define a storm's severity — peak wind and
 * minimum pressure — plus how many fixes support them, because a 4-fix track
 * and a 60-fix track are not equally trustworthy.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button, CategoryChip, Empty, Panel, Skeleton } from "@/components/console/primitives";
import { BASIN_NAMES, categoryColor, fmtDate, fmtPressure, fmtWind, stormName } from "@/lib/format";
import { useCyclones, useFilters } from "@/lib/queries";

export const Route = createFileRoute("/explorer")({
  component: Explorer,
});

const SORTS = [
  { value: "recent", label: "Most recent" },
  { value: "intensity", label: "Strongest" },
  { value: "pressure", label: "Deepest" },
  { value: "observations", label: "Most fixes" },
  { value: "name", label: "Name" },
] as const;

function Explorer() {
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const [basin, setBasin] = useState<string>("");
  const [subBasin, setSubBasin] = useState<string>("");
  const [season, setSeason] = useState<string>("");
  const [sort, setSort] = useState<string>("recent");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(raw.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [raw]);

  const filters = useFilters();

  /*
   * A sub-basin belongs to exactly one basin, so the options narrow with the
   * basin selection. Offering "Arabian Sea" while the Atlantic is selected
   * would be a filter that can only ever return nothing.
   */
  const subBasinOptions = (filters.data?.subBasins ?? []).filter(
    (option) => !basin || option.basin === basin,
  );

  /*
   * With no basin chosen the list spans every ocean -- the Bay of Bengal next
   * to the Gulf of Mexico -- so it is grouped by basin to stay readable. With
   * one basin chosen there is nothing to group.
   */
  const groupedSubBasins = subBasinOptions.reduce<Record<string, typeof subBasinOptions>>(
    (groups, option) => {
      const group = groups[option.basin] ?? [];
      group.push(option);
      groups[option.basin] = group;
      return groups;
    },
    {},
  );

  const { data, isLoading, isError, error } = useCyclones({
    query: query || undefined,
    basin: basin || undefined,
    subBasin: subBasin || undefined,
    season: season ? Number(season) : undefined,
    sort,
    page,
    size: 30,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <Panel className="shrink-0" bodyClassName="flex flex-wrap items-end gap-3 p-3">
        <label className="min-w-[220px] flex-1">
          <span className="label-xs">Search</span>
          <input
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            placeholder="Storm name or IBTrACS identifier"
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-input"
          />
        </label>

        <label>
          <span className="label-xs">Basin</span>
          <select
            value={basin}
            onChange={(event) => {
              setBasin(event.target.value);
              // The chosen sea may not be in the new basin.
              setSubBasin("");
              setPage(0);
            }}
            className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-input"
          >
            <option value="">All</option>
            {(filters.data?.basins ?? []).map((code) => (
              <option key={code} value={code}>
                {BASIN_NAMES[code] ?? code}
              </option>
            ))}
          </select>
        </label>

        {subBasinOptions.length > 0 ? (
          <label>
            <span className="label-xs">Sea</span>
            <select
              value={subBasin}
              onChange={(event) => {
                setSubBasin(event.target.value);
                setPage(0);
              }}
              className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-input"
            >
              <option value="">All</option>
              {basin
                ? subBasinOptions.map((option) => (
                    <option key={`${option.basin}-${option.code}`} value={option.code}>
                      {option.name}
                    </option>
                  ))
                : Object.entries(groupedSubBasins).map(([code, options]) => (
                    <optgroup key={code} label={BASIN_NAMES[code] ?? code}>
                      {options.map((option) => (
                        <option key={`${option.basin}-${option.code}`} value={option.code}>
                          {option.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
            </select>
          </label>
        ) : null}

        <label>
          <span className="label-xs">Season</span>
          <select
            value={season}
            onChange={(event) => {
              setSeason(event.target.value);
              setPage(0);
            }}
            className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-input"
          >
            <option value="">All</option>
            {(filters.data?.seasons ?? []).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="label-xs">Sort</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(0);
            }}
            className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-input"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto text-right">
          <span className="label-xs">Matches</span>
          <div className="num text-sm">{data ? data.totalItems.toLocaleString() : "—"}</div>
        </div>
      </Panel>

      <Panel className="min-h-0 flex-1" bodyClassName="min-h-0">
        {isLoading ? (
          <div className="space-y-1 p-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <Empty
            tone="warning"
            title="Cannot load the archive"
            detail={error instanceof Error ? error.message : null}
          />
        ) : !data || data.items.length === 0 ? (
          <Empty
            title="Nothing matches these filters"
            detail="Try a different season or clear the search."
          />
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-[var(--surface)]">
              <tr className="border-b border-border text-left">
                <th className="label-xs px-3 py-2">Storm</th>
                <th className="label-xs px-3 py-2">Basin</th>
                <th className="label-xs px-3 py-2">Season</th>
                <th className="label-xs px-3 py-2">Active</th>
                <th className="label-xs px-3 py-2 text-right">Peak wind</th>
                <th className="label-xs px-3 py-2 text-right">Min pressure</th>
                <th className="label-xs px-3 py-2 text-right">Fixes</th>
                <th className="label-xs px-3 py-2">Peak category</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((storm) => (
                <tr key={storm.id} className="border-b border-border/50 hover:bg-accent/40">
                  <td className="px-3 py-1.5">
                    <Link
                      to="/storm/$id"
                      params={{ id: storm.id }}
                      className="flex items-center gap-2 text-xs hover:underline"
                    >
                      <span
                        className="h-4 w-0.5 rounded"
                        style={{ background: categoryColor(storm.peakCategoryRank) }}
                        aria-hidden
                      />
                      <span className="font-medium">{stormName(storm.name, storm.externalId)}</span>
                      {/* An unnamed storm is shown by its identifier already,
                          so repeating it beside itself says nothing. */}
                      {storm.name ? (
                        <span className="num text-[0.625rem] text-muted-foreground">
                          {storm.externalId}
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    <span className="num text-xs" title={BASIN_NAMES[storm.basin] ?? storm.basin}>
                      {storm.basin}
                    </span>
                    {storm.subBasinName ? (
                      <span className="block text-[0.625rem] leading-tight">
                        {storm.subBasinName}
                      </span>
                    ) : null}
                  </td>
                  <td className="num px-3 py-1.5 text-xs">{storm.seasonYear ?? "—"}</td>
                  <td className="num px-3 py-1.5 text-[0.6875rem] text-muted-foreground">
                    {fmtDate(storm.firstObservedAt)} → {fmtDate(storm.lastObservedAt)}
                  </td>
                  <td
                    className="num px-3 py-1.5 text-right text-xs"
                    style={{ color: categoryColor(storm.peakCategoryRank) }}
                  >
                    {fmtWind(storm.peakWindKph)}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-xs">
                    {fmtPressure(storm.minPressureHpa)}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-xs text-muted-foreground">
                    {storm.observationCount}
                  </td>
                  <td className="px-3 py-1.5">
                    <CategoryChip category={storm.peakCategory} rank={storm.peakCategoryRank} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Link to="/lab/$id" params={{ id: storm.id }}>
                      <Button size="sm" variant="ghost">
                        Lab →
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {data && data.totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-between px-1">
          <span className="label-xs">
            Page {data.page + 1} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              disabled={page + 1 >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
