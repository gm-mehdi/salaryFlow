"use client";

import { fmt } from "../../lib/format";
import type { State, Tx } from "../../lib/types";
import { IconPlus } from "../../components/icons";
import { EmptyState, StatCard, TxRow, cardCls, btnPrimary } from "../../components/ui";

export function ExpensesTab({ state, onEditTx, onAdd }: { state: State; onEditTx: (tx: Tx) => void; onAdd: () => void }) {
  const cur = state.currency;
  const rows = state.allMonthTransactions.filter((t) => t.kind === "expense" && t.expenseType === "variable");
  const total = rows.reduce((sum, t) => sum + t.amount, 0);
  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <p className="text-xs font-medium tracking-wide text-[var(--dim)] uppercase">Variable spending · {state.monthLabel}</p>
        <p className="tnum mt-1 text-2xl font-bold">{fmt(total, cur)}</p>
        <p className="text-sm text-[var(--dim)]">{rows.length} purchase{rows.length === 1 ? "" : "s"} — fixed charges live in the Fixed tab and are only counted once paid.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No variable expenses yet" body="Log groceries, coffee, fuel, restaurants — every daily purchase — with the quick add button." />
      ) : (
        <section className={cardCls} aria-label="Variable expenses">
          <div className="divide-y divide-[var(--border)]">
            {rows.map((tx) => (
              <TxRow key={`${tx.source}-${tx.id}`} tx={tx} currency={cur} onEdit={tx.source === "transaction" ? () => onEditTx(tx) : undefined} />
            ))}
          </div>
        </section>
      )}
      <button type="button" className={`${btnPrimary} w-full`} onClick={onAdd}><IconPlus size={18} /> Quick add expense</button>
    </div>
  );
}
