"use client";

import { cardCls } from "./styles";

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={cardCls}>
      <p className="text-xs font-medium tracking-wide text-[var(--dim)] uppercase">{label}</p>
      <p className="tnum mt-1 text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-[var(--dim)]">{sub}</p>}
    </div>
  );
}
