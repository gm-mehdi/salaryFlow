"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { BUILT_IN_EXPENSE } from "../../lib/constants";
import { unique } from "../../lib/format";
import type { BudgetRow, State } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { CategoryPicker, ConfirmDeleteButton, ErrorAlert, Field, inputCls, btnPrimary } from "../../components/ui";

export function BudgetForm({
  state,
  initial,
  onClose,
}: {
  state: State;
  initial: BudgetRow | null;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<"all" | "month">(initial?.month ? "month" : "all");
  const expenseOptions = useMemo(
    () => unique([...BUILT_IN_EXPENSE, ...state.categories.filter((c) => c.kind === "expense").map((c) => c.name)]),
    [state.categories],
  );
  const [category, setCategory] = useState(initial?.category ?? "Restaurants");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [error, setError] = useState<string | null>(null);

  const refresh = useRefresh();

  const saveMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a budget greater than zero.");
      return await api.upsertBudget({ category: category.trim(), amount: amt, month: scope === "month" ? state.month : null });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error ?? "Could not save. Try again.");
        return;
      }
      refresh();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save. Try again."),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!initial) throw new Error("Nothing to delete.");
      return await api.deleteBudget({ id: initial.id });
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        saveMut.mutate();
      }}
    >
      <Field label="Category">
        <CategoryPicker kind="expense" options={expenseOptions} value={category} onChange={setCategory} />
      </Field>
      <Field label="Monthly budget">
        <input aria-label="Monthly budget amount" className={`${inputCls} tnum text-xl font-semibold`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>
      <Field label="Applies to">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Budget scope">
          {([["all", "Every month"], ["month", `Only ${state.monthLabel}`]] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)} className={`min-h-10 rounded-xl border px-3 font-medium ${scope === v ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--dim)]"}`}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>
        {saveMut.isPending ? "Saving…" : initial ? "Save budget" : "Add budget"}
      </button>
      {initial && (
        <ConfirmDeleteButton label="Delete budget" onConfirm={() => deleteMut.mutate()} disabled={deleteMut.isPending} />
      )}
    </form>
  );
}
