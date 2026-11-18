"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { fmt, todayStr } from "../../lib/format";
import type { DebtRow } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { ErrorAlert, Field, inputCls, btnPrimary } from "../../components/ui";

export function DebtPaymentForm({ debt, currency, onClose }: { debt: DebtRow; currency: string; onClose: () => void }) {
  const refresh = useRefresh();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saveMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
      return await api.addDebtPayment({ debtId: debt.id, amount: amt, date, note: note.trim() });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <p className="text-sm text-[var(--dim)]">{debt.name} — remaining {fmt(debt.remaining, currency)} of {fmt(debt.initialAmount, currency)}.</p>
      <Field label="Payment amount"><input aria-label="Debt payment amount" className={`${inputCls} tnum text-xl font-semibold`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
      <Field label="Date"><input aria-label="Debt payment date" className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <Field label="Note (optional)"><input aria-label="Debt payment note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : "Record payment"}</button>
    </form>
  );
}
