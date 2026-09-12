/**
 * Console primitives: the small, repeated pieces the whole interface is built
 * from.
 *
 * The important one is {@link Provenance}. Every number on screen is tagged
 * with where it came from — measured, model, or historical analogue — because
 * a forecast presented like an observation is the central dishonesty this
 * product has to avoid.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ABSENT } from "@/lib/format";

export type Source = "observed" | "model" | "analogue" | "absent";

const SOURCE_STYLE: Record<Source, { dot: string; text: string; label: string }> = {
  observed: {
    dot: "bg-observed",
    text: "text-observed",
    label: "Observed",
  },
  model: {
    dot: "bg-model",
    text: "text-model",
    label: "Model",
  },
  analogue: {
    dot: "bg-analogue",
    text: "text-analogue",
    label: "Analogue",
  },
  absent: {
    dot: "bg-absent",
    text: "text-absent",
    label: "No data",
  },
};

/** Where a value came from, as a compact tag. */
export function Provenance({
  source,
  detail,
  className,
}: {
  source: Source;
  detail?: string | null | undefined;
  className?: string | undefined;
}) {
  const style = SOURCE_STYLE[source];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 label-xs", className)}
      title={detail ?? undefined}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden />
      <span className={style.text}>{style.label}</span>
      {detail ? <span className="text-muted-foreground normal-case tracking-normal">{detail}</span> : null}
    </span>
  );
}

/** A flat panel with an optional header row. */
export function Panel({
  title,
  action,
  provenance,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode | undefined;
  action?: ReactNode | undefined;
  provenance?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
}) {
  return (
    <section className={cn("panel flex min-h-0 flex-col overflow-hidden", className)}>
      {title ? (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="label-xs truncate text-foreground/90">{title}</h2>
            {provenance}
          </div>
          {action}
        </header>
      ) : null}
      {/*
        `grow` rather than `flex-1`: flex-1 also sets flex-basis to 0, which
        silently defeats a caller's `bodyClassName="h-[420px]"` whenever the
        section's own height is only a min-height — the body collapses to zero
        and a fixed-height map renders as an empty rectangle. Growing from an
        auto basis honours an explicit height and still fills the leftover
        space when the section is stretched by its grid row.
      */}
      <div className={cn("min-h-0 grow overflow-auto", bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * A labelled measurement. `value` is pre-formatted so the caller decides how
 * absence reads; when it is the em dash, the whole metric dims.
 */
export function Metric({
  label,
  value,
  unitHint,
  source,
  accent,
  className,
}: {
  label: string;
  value: string;
  unitHint?: string | undefined;
  source?: Source | undefined;
  accent?: string | undefined;
  className?: string | undefined;
}) {
  const missing = value === ABSENT;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1.5">
        <span className="label-xs">{label}</span>
        {source ? (
          <span
            className={cn("h-1.5 w-1.5 rounded-full", SOURCE_STYLE[source].dot)}
            title={SOURCE_STYLE[source].label}
            aria-hidden
          />
        ) : null}
      </div>
      <div
        className={cn(
          "num mt-0.5 truncate text-lg leading-tight",
          missing && "text-absent",
        )}
        style={!missing && accent ? { color: accent } : undefined}
        title={unitHint}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * The honest empty state: what is missing and why, never a spinner that never
 * resolves or a chart of zeroes.
 */
export function Empty({
  title,
  detail,
  action,
  tone = "neutral",
  className,
}: {
  title: string;
  detail?: string | null | undefined;
  action?: ReactNode | undefined;
  tone?: "neutral" | "warning" | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "graticule flex h-full min-h-32 flex-col items-center justify-center gap-2 px-6 py-8 text-center",
        className,
      )}
    >
      <p
        className={cn(
          "text-sm font-medium",
          tone === "warning" ? "text-primary" : "text-foreground/80",
        )}
      >
        {title}
      </p>
      {detail ? (
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{detail}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted/60", className)} />;
}

/** Category chip coloured by the intensity ramp. */
export function CategoryChip({
  category,
  rank,
  className,
}: {
  category: string | null;
  rank: number | null;
  className?: string | undefined;
}) {
  if (!category) {
    return <span className={cn("label-xs text-absent", className)}>Uncategorised</span>;
  }
  const color = `var(--cat-${Math.max(0, Math.min(6, rank ?? 0))})`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium",
        className,
      )}
      style={{ borderColor: `${color}`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {category}
    </span>
  );
}

/** Status of one analysis block, coloured by whether it produced anything. */
export function StatusChip({ status }: { status: string | null | undefined }) {
  const value = status ?? "UNKNOWN";
  const tone =
    value === "COMPLETED"
      ? "text-model border-model/40"
      : value === "PARTIAL"
        ? "text-primary border-primary/40"
        : value === "FAILED"
          ? "text-destructive border-destructive/40"
          : "text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider",
        tone,
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  title,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void | undefined;
  variant?: "default" | "primary" | "ghost" | undefined;
  size?: "sm" | "md" | undefined;
  disabled?: boolean | undefined;
  title?: string | undefined;
  type?: "button" | "submit" | undefined;
  className?: string | undefined;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "px-2 py-1 text-[0.6875rem]" : "px-3 py-1.5 text-xs",
        variant === "primary" &&
          "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "default" &&
          "border-border bg-secondary text-secondary-foreground hover:border-input hover:bg-accent",
        variant === "ghost" && "border-transparent text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
