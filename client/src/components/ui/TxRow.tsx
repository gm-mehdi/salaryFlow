"use client";

import { fmt, prettyDate } from "../../lib/format";
import type { Tx } from "../../lib/types";

export function TxRow({ tx, currency, onEdit }: { tx: Tx; currency: string; onEdit?: () => void }) {
  const isIncome = tx.kind === "income";
  const inner = (
    <>
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: isIncome ? "var(--accent)" : tx.expenseType === "fixed" ? "#3e7cb1" : "var(--danger)" }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{tx.description || tx.category}</span>
        <span className="block text-xs text-[var(--dim)]">
          {tx.category} · {prettyDate(tx.date)}
          {tx.source === "fixed" ? " · fixed expense" : tx.paymentMethod ? ` · ${tx.paymentMethod}` : ""}
        </span>
        {tx.note && <span className="block truncate text-xs text-[var(--dim)]">{tx.note}</span>}
      </span>
      <span className={`tnum font-semibold ${isIncome ? "text-[var(--accent)]" : ""}`}>
        {isIncome ? "+" : "−"}{fmt(tx.amount, currency).replace(/^-/, "").replace(/^−/, "")}
      </span>
    </>
  );
  if (onEdit) {
    return (
      <button type="button" onClick={onEdit} aria-label={`Edit ${tx.description || tx.category}`} className="flex w-full items-start gap-3 px-1 py-3 text-left">
        {inner}
      </button>
    );
  }
  return <div className="flex w-full items-start gap-3 px-1 py-3">{inner}</div>;
}
