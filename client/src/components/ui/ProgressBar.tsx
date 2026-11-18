"use client";

export function ProgressBar({ pct, tone }: { pct: number; tone: "ok" | "warn" | "over" }) {
  const color = tone === "over" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}
