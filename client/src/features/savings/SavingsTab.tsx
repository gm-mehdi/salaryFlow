"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { fmt, prettyDate } from "../../lib/format";
import type { GoalRow, State } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { IconPencil, IconPlus, IconTrash } from "../../components/icons";
import { EmptyState, ProgressBar, StatCard, cardCls, btnPrimary } from "../../components/ui";


export function SavingsTab({ state, onEditGoal, onAddEntry }: { state: State; onEditGoal: (g: GoalRow | null) => void; onAddEntry: (g: GoalRow) => void }) {
  const refresh = useRefresh();
  const cur = state.currency;
  const deleteEntryMut = useMutation({ mutationFn: async (id: number) => await api.deleteGoalEntry({ id }), onSuccess: refresh });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total saved" value={fmt(state.projections.totalSavingsSaved, cur)} />
        <StatCard label="Total targets" value={fmt(state.projections.totalSavingsTarget, cur)} />
      </div>
      <p className="text-sm text-[var(--dim)]">Contributions move money into a goal — they are savings, not expenses, so they never double-count in your spending.</p>
      {state.goals.length === 0 ? (
        <EmptyState title="No savings goals yet" body="Create a goal — emergency fund, car, phone, travel — then add contributions as you save." />
      ) : (
        <div className="space-y-3">
          {state.goals.map((g) => (
            <article key={g.id} className={cardCls} aria-label={g.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display font-semibold">{g.name}</h2>
                  {g.description && <p className="truncate text-sm text-[var(--dim)]">{g.description}</p>}
                  <p className="text-sm text-[var(--dim)]">
                    {g.targetDate ? `Target ${prettyDate(g.targetDate)}` : "No target date"}
                    {g.monthlyRequired != null && g.remaining > 0 ? ` · save ${fmt(g.monthlyRequired, cur)}/month` : ""}
                  </p>
                </div>
                <p className="tnum text-lg font-bold">{g.pct}%</p>
              </div>
              <div className="mt-3"><ProgressBar pct={g.pct} tone={g.pct >= 100 ? "ok" : "warn"} /></div>
              <p className="mt-2 text-sm"><span className="tnum font-semibold">{fmt(g.saved, cur)}</span> saved · <span className="tnum">{fmt(g.remaining, cur)}</span> to go of {fmt(g.targetAmount, cur)}</p>
              {g.entries.length > 0 && (
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {g.entries.slice(0, 4).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="text-[var(--dim)]">{prettyDate(e.date)}{e.note ? ` · ${e.note}` : ""}</span>
                      <span className="flex items-center gap-2">
                        <span className={`tnum font-medium ${e.amount < 0 ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>{e.amount < 0 ? "−" : "+"}{fmt(Math.abs(e.amount), cur)}</span>
                        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--danger)]" onClick={() => deleteEntryMut.mutate(e.id)} disabled={deleteEntryMut.isPending} aria-label={`Remove savings entry of ${fmt(Math.abs(e.amount), cur)} for ${g.name}`}><IconTrash /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" className={`${btnPrimary} flex-1`} onClick={() => onAddEntry(g)}>Add / withdraw</button>
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)]" onClick={() => onEditGoal(g)} aria-label={`Edit goal ${g.name}`}><IconPencil /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      <button type="button" className={`${btnPrimary} w-full`} onClick={() => onEditGoal(null)}><IconPlus size={18} /> New savings goal</button>
    </div>
  );
}
