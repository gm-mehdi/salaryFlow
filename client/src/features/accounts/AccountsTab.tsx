"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { fmt, prettyDate } from "../../lib/format";
import type { AccountRow, State } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { IconArrowSwap, IconPencil, IconPlus, IconTrash } from "../../components/icons";
import { EmptyState, cardCls, btnPrimary, btnGhost } from "../../components/ui";


export function AccountsTab({ state, onEditAccount, onTransfer }: { state: State; onEditAccount: (a: AccountRow | null) => void; onTransfer: () => void }) {
  const refresh = useRefresh();
  const cur = state.currency;
  const deleteTransferMut = useMutation({ mutationFn: async (id: number) => await api.deleteTransfer({ id }), onSuccess: refresh });
  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <p className="text-xs font-medium tracking-wide text-[var(--dim)] uppercase">Consolidated balance</p>
        <p className="tnum mt-1 text-2xl font-bold">{fmt(state.totalAccountBalance, cur)}</p>
        <p className="text-sm text-[var(--dim)]">Across {state.accounts.length} account{state.accounts.length === 1 ? "" : "s"}. Assign transactions to an account and its balance updates automatically.</p>
      </div>
      {state.accounts.length === 0 ? (
        <EmptyState title="No accounts yet" body="Add your cash wallet, bank account and savings account to track each balance separately." />
      ) : (
        <div className="space-y-3">
          {state.accounts.map((a) => (
            <article key={a.id} className={cardCls} aria-label={a.name}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold">{a.name}</h2>
                  <p className="text-sm capitalize text-[var(--dim)]">{a.type} · opened at {fmt(a.openingBalance, cur)}</p>
                </div>
                <p className={`tnum text-lg font-bold ${a.balance < 0 ? "text-[var(--danger)]" : ""}`}>{fmt(a.balance, cur)}</p>
              </div>
              <p className="mt-2 text-sm text-[var(--dim)]">In {fmt(a.incomeTotal, cur)} · Out {fmt(a.expenseTotal, cur)} · Transfers +{fmt(a.transfersIn, cur)} / −{fmt(a.transfersOut, cur)}</p>
              <div className="mt-3 flex justify-end">
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)]" onClick={() => onEditAccount(a)} aria-label={`Edit account ${a.name}`}><IconPencil /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btnPrimary} onClick={() => onEditAccount(null)}><IconPlus size={18} /> Add account</button>
        <button type="button" className={btnGhost} disabled={state.accounts.length < 2} onClick={onTransfer}><IconArrowSwap /> Transfer</button>
      </div>
      {state.transfers.length > 0 && (
        <section className={cardCls} aria-label="Transfers">
          <h2 className="font-display mb-1 font-semibold">Transfers</h2>
          <ul className="divide-y divide-[var(--border)]">
            {state.transfers.slice(0, 10).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{t.fromName} → {t.toName} <span className="text-[var(--dim)]">· {prettyDate(t.date)}</span></span>
                <span className="flex items-center gap-2">
                  <span className="tnum font-semibold">{fmt(t.amount, cur)}</span>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--danger)]" onClick={() => deleteTransferMut.mutate(t.id)} disabled={deleteTransferMut.isPending} aria-label={`Delete transfer of ${fmt(t.amount, cur)}`}><IconTrash /></button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
