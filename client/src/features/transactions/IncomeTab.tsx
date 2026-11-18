"use client";

import { fmt } from "../../lib/format";
import type { State, Tx } from "../../lib/types";
import { IconPlus } from "../../components/icons";
import { EmptyState, StatCard, TxRow, cardCls, btnPrimary } from "../../components/ui";

export function IncomeTab({ state, onEditTx, onAdd }: { state: State; onEditTx: (tx: Tx) => void; onAdd: () => void }) {
  const cur = state.currency;
  const rows = state.allMonthTransactions.filter((t) => t.kind === "income");
  const s = state.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Salary" value={fmt(s.salary, cur)} sub={state.salaryCategory} />
        <StatCard label="Additional income" value={fmt(s.additionalIncome, cur)} sub="Bonuses, freelance, other" />
      </div>
      <p className="text-sm text-[var(--dim)]">All income received in {state.monthLabel}. Mark income as recurring in its form to label regular sources; your configured salary can be recorded in one tap from Home.</p>
      {rows.length === 0 ? (
        <EmptyState title="No income this month" body="Add a salary payment, bonus, freelance payment or any other income." />
      ) : (
        <section className={cardCls} aria-label="Income records">
          <div className="divide-y divide-[var(--border)]">
            {rows.map((tx) => (
              <TxRow key={`${tx.source}-${tx.id}`} tx={tx} currency={cur} onEdit={tx.source === "transaction" ? () => onEditTx(tx) : undefined} />
            ))}
          </div>
        </section>
      )}
      <button type="button" className={`${btnPrimary} w-full`} onClick={onAdd}><IconPlus size={18} /> Add income</button>
    </div>
  );
}

