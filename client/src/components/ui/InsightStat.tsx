"use client";

import { cardCls } from "./styles";

export function InsightStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="text-sm text-[var(--dim)]">{label}</span>
      <span className="tnum text-right font-semibold">{value}</span>
    </div>
  );
}
