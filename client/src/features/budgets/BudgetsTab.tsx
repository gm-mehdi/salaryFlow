"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api";
import { fmt } from "../../lib/format";
import type { BudgetRow, State } from "../../lib/types";
import { IconAlert, IconPencil, IconPlus } from "../../components/icons";
import { EmptyState, ProgressBar, cardCls, btnGhost, btnPrimary } from "../../components/ui";


export function BudgetsTab({
  state,
  onEditBudget,
}: {
  state: State;
  onEditBudget: (b: BudgetRow | null) => void;
}) {
  const queryClient = useQueryClient();
  const cur = state.currency;
  const [copied, setCopied] = useState<string | null>(null);
  const copyMut = useMutation({
    mutationFn: async () => await api.copyBudgetsFromPreviousMonth({ month: state.month }),
    onSuccess: (res) => {
      setCopied(res.ok ? (res.id && res.id > 0 ? `Copied ${res.id} budget${res.id === 1 ? "" : "s"} from last month.` : "Nothing new to copy — this month already has them.") : (res.error ?? "Copy failed."));
      queryClient.invalidateQueries({ queryKey: ["state"] });
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[var(--dim)]">Monthly limits per category for {state.monthLabel}. Warnings appear at 75% and 90%; over 100% is exceeded. A month-only budget overrides the every-month one.</p>
        <button type="button" className={`${btnGhost} shrink-0`} disabled={copyMut.isPending} onClick={() => copyMut.mutate()}>
          Copy last month
        </button>
      </div>
      {copied && <p className="text-sm text-[var(--accent)]" role="status">{copied}</p>}
      {state.budgets.length === 0 ? (
        <EmptyState title="No budgets yet" body="Set a monthly limit for restaurants, shopping, transport — whatever you want to keep an eye on." />
      ) : (
        <div className="space-y-3">
          {state.budgets.map((b) => {
            const tone = b.warning === "exceeded" ? "over" : b.warning === "warning90" || b.warning === "watch75" ? "warn" : "ok";
            return (
              <article key={b.id} className={cardCls} aria-label={`${b.category} budget`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display font-semibold">{b.category} {b.monthSpecific && <span className="ml-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">{state.monthLabel.split(" ")[0]} only</span>}</h2>
                  <p className="tnum text-sm text-[var(--dim)]">
                    <span className="text-base font-bold text-[var(--text)]">{fmt(b.spent, cur)}</span> of {fmt(b.amount, cur)}
                  </p>
                </div>
                <div className="mt-3">
                  <ProgressBar pct={b.pctUsed} tone={tone} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className={`text-sm ${tone === "over" ? "font-semibold text-[var(--danger)]" : tone === "warn" ? "font-medium text-[var(--warn)]" : "text-[var(--dim)]"}`}>
                    {b.warning === "exceeded" ? (
                      <span className="inline-flex items-center gap-1"><IconAlert /> Budget exceeded — over by {fmt(Math.abs(b.remaining), cur)}</span>
                    ) : b.warning === "warning90" ? (
                      <span className="inline-flex items-center gap-1"><IconAlert /> 90% used — {fmt(b.remaining, cur)} left</span>
                    ) : b.warning === "watch75" ? (
                      <span className="inline-flex items-center gap-1"><IconAlert /> 75% used — {fmt(b.remaining, cur)} left</span>
                    ) : (
                      `${fmt(b.remaining, cur)} left · ${b.pctUsed}% used`
                    )}
                  </p>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)]" onClick={() => onEditBudget(b)} aria-label={`Edit ${b.category} budget`}>
                    <IconPencil />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <button type="button" className={`${btnPrimary} w-full`} onClick={() => onEditBudget(null)}>
        <IconPlus size={18} /> Add budget
      </button>
    </div>
  );
}
