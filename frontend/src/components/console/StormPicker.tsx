/**
 * Storm dock: search the archive and pick one.
 *
 * Search is debounced and paged server-side — the archive holds thousands of
 * storms, so the list never tries to hold all of them. Each row carries the
 * storm's peak intensity as a colour bar, which makes scanning a season for the
 * severe events a glance rather than a read.
 */

import { useEffect, useState } from "react";

import { Empty, Panel, Skeleton } from "@/components/console/primitives";
import { categoryColor, fmtDate, fmtWind } from "@/lib/format";
import { useCyclones } from "@/lib/queries";
import type { CycloneSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StormPicker({
  selectedId,
  onSelect,
  basin,
  className,
}: {
  selectedId: string | null;
  onSelect: (storm: CycloneSummary) => void;
  basin?: string | undefined;
  className?: string | undefined;
}) {
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(raw.trim()), 250);
    return () => clearTimeout(timer);
  }, [raw]);

  const { data, isLoading, isError, error } = useCyclones({
    query: query || undefined,
    basin,
    sort: "recent",
    size: 40,
  });

  return (
    <Panel
      title="Storms"
      action={
        <span className="num text-[0.6875rem] text-muted-foreground">
          {data ? data.totalItems.toLocaleString() : "—"}
        </span>
      }
      className={className}
      bodyClassName="flex flex-col"
    >
      <div className="shrink-0 border-b border-border p-2">
        <input
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder="Name or IBTrACS id…"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-input"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <Empty
            tone="warning"
            title="Cannot load the archive"
            detail={error instanceof Error ? error.message : undefined}
          />
        ) : !data || data.items.length === 0 ? (
          <Empty
            title="No storms match"
            detail={
              query
                ? `Nothing found for “${query}”.`
                : "The archive appears to be empty. Run ingestion to load it."
            }
          />
        ) : (
          <ul>
            {data.items.map((storm) => (
              <li key={storm.id}>
                <button
                  type="button"
                  onClick={() => onSelect(storm)}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-border/50 px-2 py-1.5 text-left transition-colors hover:bg-accent/60",
                    selectedId === storm.id && "bg-accent",
                  )}
                >
                  <span
                    className="h-7 w-0.5 shrink-0 rounded"
                    style={{ background: categoryColor(storm.peakCategoryRank) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-medium">
                        {storm.name ?? storm.externalId}
                      </span>
                      <span className="num shrink-0 text-[0.6875rem] text-muted-foreground">
                        {storm.seasonYear ?? ""}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="num text-[0.625rem] text-muted-foreground">
                        {storm.basin} · {fmtDate(storm.lastObservedAt)}
                      </span>
                      <span
                        className="num text-[0.625rem]"
                        style={{ color: categoryColor(storm.peakCategoryRank) }}
                      >
                        {fmtWind(storm.peakWindKph)}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
