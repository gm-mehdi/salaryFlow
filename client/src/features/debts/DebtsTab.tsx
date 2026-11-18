"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { fmt, prettyDate } from "../../lib/format";
import type { DebtRow, State } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { IconPencil, IconPlus, IconTrash } from "../../components/icons";
import { EmptyState, ProgressBar, StatCard, cardCls, btnPrimary, btnGhost } from "../../components/ui";

const DEBT_KIND_LABEL: Record<DebtRow["kind"], string> = { i_owe: "I owe", owed_to_me: "Owed to me", loan: "Loan", installment: "Installments" };


export function DebtsTab({ state, onEditDebt, onPayDebt }: { state: State; onEditDebt: (d: DebtRow | null) => void; onPayDebt: (d: DebtRow) => void }) {
  const refresh = useRefresh();
  const cur = state.currency;
  const deletePayMut = useMutation({ mutationFn: async (id: number) => await api.deleteDebtPayment({ id }), onSuccess: refresh });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="You owe" value={fmt(state.totalDebtOwed, cur)} />
        <StatCard label="Owed to you" value={fmt(state.totalOwedToMe, cur)} />
      </div>
      {state.debts.length === 0 ? (
        <EmptyState title="No debts tracked" body="Add a loan, installments, money you borrowed, or money you lent to someone." />
      ) : (
        <div className="space-y-3">
          {state.debts.map((d) => (
            <article key={d.id} className={cardCls} aria-label={d.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display font-semibold">{d.name}</h2>
                  <p className="text-sm text-[var(--dim)]">
                    {DEBT_KIND_LABEL[d.kind]} · due day {d.dueDay}
                    {d.monthlyPayment > 0 ? ` · ${fmt(d.monthlyPayment, cur)}/month` : ""}
                    {d.interestRate > 0 ? ` · ${d.interestRate}% interest` : ""}
                    {d.payoffDate && d.remaining > 0 ? ` · paid off around ${d.payoffDate}` : ""}
                  </p>
                  {d.description && <p className="truncate text-sm text-[var(--dim)]">{d.description}</p>}
                </div>
                <p className="tnum text-lg font-bold">{fmt(d.remaining, cur)}</p>
              </div>
              <div className="mt-3"><ProgressBar pct={d.pctPaid} tone={d.remaining <= 0 ? "ok" : "warn"} /></div>
              <p className="mt-2 text-sm">Paid <span className="tnum font-semibold">{fmt(d.paidTotal, cur)}</span> of {fmt(d.initialAmount, cur)} · {d.pctPaid}%</p>
              {d.payments.length > 0 && (
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {d.payments.slice(0, 4).map((pay) => (
                    <li key={pay.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="text-[var(--dim)]">{prettyDate(pay.date)}{pay.note ? ` · ${pay.note}` : ""}</span>
                      <span className="flex items-center gap-2">
                        <span className="tnum font-medium">{fmt(pay.amount, cur)}</span>
                        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--danger)]" onClick={() => deletePayMut.mutate(pay.id)} disabled={deletePayMut.isPending} aria-label={`Remove payment of ${fmt(pay.amount, cur)} for ${d.name}`}><IconTrash /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" className={`${btnPrimary} flex-1`} disabled={d.remaining <= 0} onClick={() => onPayDebt(d)}>{d.remaining <= 0 ? "Settled" : "Record payment"}</button>
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)]" onClick={() => onEditDebt(d)} aria-label={`Edit debt ${d.name}`}><IconPencil /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      <button type="button" className={`${btnPrimary} w-full`} onClick={() => onEditDebt(null)}><IconPlus size={18} /> Add debt or loan</button>
    </div>
  );
}
