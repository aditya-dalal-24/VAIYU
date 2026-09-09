import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function Panel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel p-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-medium tracking-tight">{title}</h3>
        {sub ? <p className="tech-label mt-0.5">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("tech-label", className)}>{children}</span>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost" | "amber";
  size?: "sm" | "md";
};

export function Btn({ className, variant = "outline", size = "md", ...rest }: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-display uppercase tracking-[0.14em] transition-colors disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-[10px]" : "px-4 py-2.5 text-[11px]",
        variant === "solid" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "outline" && "border border-border bg-transparent text-foreground hover:bg-secondary",
        variant === "ghost" && "text-muted-foreground hover:text-foreground",
        variant === "amber" && "bg-amber text-accent-foreground hover:opacity-90",
        className,
      )}
      {...rest}
    />
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "amber" | "danger" | "ink" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.16em]",
        tone === "muted" && "bg-secondary text-secondary-foreground",
        tone === "amber" && "bg-amber/20 text-clay",
        tone === "danger" && "bg-destructive/15 text-destructive",
        tone === "ink" && "bg-primary text-primary-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-center justify-between gap-3 py-1.5 text-left"
      aria-pressed={checked}
    >
      <span className="text-xs text-foreground/80">{label}</span>
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-[5px] border text-[9px]",
          checked ? "border-clay bg-clay text-primary-foreground" : "border-border",
        )}
      >
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}

export function Bar({ value, tone = "amber" }: { value: number; tone?: "amber" | "ink" }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={cn("h-full rounded-full", tone === "amber" ? "bg-amber" : "bg-primary")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
