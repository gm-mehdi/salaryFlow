"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { todayStr } from "../../lib/format";
import type { GoalRow } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { ErrorAlert, Field, inputCls, btnPrimary } from "../../components/ui";

export function GoalEntryForm({ goal, onClose }: { goal: GoalRow; onClose: () => void }) {
  const refresh = useRefresh();
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saveMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
      return await api.addGoalEntry({ goalId: goal.id, amount: mode === "add" ? amt : -amt, date, note: note.trim() });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <p className="text-sm text-[var(--dim)]">{goal.name} — saved so far is tracked separately from spending, so contributions never double-count as expenses.</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Contribution or withdrawal">
        {([["add", "Add money"], ["withdraw", "Withdraw"]] as const).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)} className={`min-h-11 rounded-xl border px-3 font-semibold ${mode === v ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--dim)]"}`}>{label}</button>
        ))}
      </div>
      <Field label="Amount"><input aria-label="Savings amount" className={`${inputCls} tnum text-xl font-semibold`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
      <Field label="Date"><input aria-label="Savings date" className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <Field label="Note (optional)"><input aria-label="Savings note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : mode === "add" ? "Add contribution" : "Record withdrawal"}</button>
    </form>
  );
}

