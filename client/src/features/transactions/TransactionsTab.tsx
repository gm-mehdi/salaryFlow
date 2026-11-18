"use client";

import { useMemo, useState } from "react";
import { BUILT_IN_EXPENSE, BUILT_IN_INCOME, PAYMENT_METHODS } from "../../lib/constants";
import { fmtShort, pad, unique } from "../../lib/format";
import type { State, Tx } from "../../lib/types";
import { EmptyState, TxRow, cardCls, inputCls } from "../../components/ui";

export function TransactionsTab({
  state,
  filters,
  onFilters,
  onEditTx,
}: {
  state: State;
  filters: { kind: string; category: string; type: string; search: string; sortBy: string; paymentMethod: string };
  onFilters: (f: { kind: string; category: string; type: string; search: string; sortBy: string; paymentMethod: string }) => void;
  onEditTx: (tx: Tx) => void;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const cur = state.currency;
  const categoryOptions = useMemo(
    () =>
      unique([
        ...BUILT_IN_EXPENSE,
        ...BUILT_IN_INCOME,
        ...state.categories.map((c) => c.name),
        ...state.summary.categoryStats.map((c) => c.category),
        ...state.transactions.map((t) => t.category),
      ]),
    [state.categories, state.summary.categoryStats, state.transactions],
  );
  const calDays = useMemo(() => {
    const [y = 1970, m = 1] = state.month.split("-").map(Number);
    const count = new Date(y, m, 0).getDate();
    const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
    const byDate = new Map<string, { income: number; expense: number }>();
    for (const t of state.allMonthTransactions) {
      if (t.source === "transfer") continue;
      const cur2 = byDate.get(t.date) ?? { income: 0, expense: 0 };
      if (t.kind === "income") cur2.income += t.amount; else cur2.expense += t.amount;
      byDate.set(t.date, cur2);
    }
    return { count, firstDow, byDate, y, m };
  }, [state.month, state.allMonthTransactions]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input aria-label="Search transactions" className={`${inputCls} flex-1`} placeholder="Search description, category, note…" value={filters.search} onChange={(e) => onFilters({ ...filters, search: e.target.value })} />
        <div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-[var(--border)] p-1" role="group" aria-label="History view">
          {(["list", "calendar"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-9 rounded-lg px-3 text-sm font-medium capitalize ${view === v ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--dim)]"}`}>{v}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Sort transactions" className={inputCls} value={filters.sortBy} onChange={(e) => onFilters({ ...filters, sortBy: e.target.value })}>
          <option value="date">Newest first</option>
          <option value="amount_desc">Amount: high to low</option>
          <option value="amount_asc">Amount: low to high</option>
        </select>
        <select aria-label="Filter by payment method" className={inputCls} value={filters.paymentMethod} onChange={(e) => onFilters({ ...filters, paymentMethod: e.target.value })}>
          <option value="all">All payment methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value="transfer">transfer</option>
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label="Filter by type"
          className={inputCls}
          value={filters.kind}
          onChange={(e) => onFilters({ ...filters, kind: e.target.value })}
        >
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
        </select>
        <select
          aria-label="Filter by category"
          className={inputCls}
          value={filters.category}
          onChange={(e) => onFilters({ ...filters, category: e.target.value })}
        >
          <option value="all">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Filter by fixed or variable"
          className={inputCls}
          value={filters.type}
          onChange={(e) => onFilters({ ...filters, type: e.target.value })}
        >
          <option value="all">Fixed + var.</option>
          <option value="fixed">Fixed only</option>
          <option value="variable">Variable only</option>
        </select>
      </div>

      <p className="text-sm text-[var(--dim)]">
        {state.transactionTotal} transaction{state.transactionTotal === 1 ? "" : "s"} in {state.monthLabel}
        {state.transactionTotal > state.transactions.length ? ` (showing ${state.transactions.length})` : ""}
      </p>

      {view === "calendar" ? (
        <section className={cardCls} aria-label="Calendar of financial activity">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[var(--dim)]">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: calDays.firstDow }, (_, i) => <span key={`blank-${i}`} />)}
            {Array.from({ length: calDays.count }, (_, i) => {
              const day = i + 1;
              const key = `${calDays.y}-${pad(calDays.m)}-${pad(day)}`;
              const agg = calDays.byDate.get(key);
              return (
                <div key={key} className="min-h-14 rounded-lg bg-[var(--surface-2)] p-1 text-center">
                  <p className="text-[11px] font-semibold">{day}</p>
                  {agg && agg.income > 0 && <p className="tnum text-[10px] font-medium text-[var(--accent)]">+{fmtShort(agg.income)}</p>}
                  {agg && agg.expense > 0 && <p className="tnum text-[10px] font-medium text-[var(--danger)]">−{fmtShort(agg.expense)}</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--dim)]">Daily totals from your real transactions in {state.monthLabel}. Transfers are excluded.</p>
        </section>
      ) : state.transactions.length === 0 ? (
        <EmptyState title="Nothing here yet" body="No transactions match this month and filters. Add one with the + button, or clear the filters." />
      ) : (
        <section className={cardCls} aria-label="Transaction history">
          <div className="divide-y divide-[var(--border)]">
            {state.transactions.map((tx) => (
              <TxRow key={`${tx.source}-${tx.id}`} tx={tx} currency={cur} onEdit={tx.source === "transaction" ? () => onEditTx(tx) : undefined} />
            ))}
          </div>
          <p className="pt-2 text-xs text-[var(--dim)]">Payments toward fixed expenses — full or partial — appear here automatically and are managed in the Fixed tab.</p>
        </section>
      )}
    </div>
  );
}
