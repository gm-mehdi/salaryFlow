"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { todayStr } from "../../lib/format";
import type { DebtRow } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { ConfirmDeleteButton, ErrorAlert, Field, inputCls, btnPrimary } from "../../components/ui";

export function DebtForm({ initial, onClose }: { initial: DebtRow | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<"i_owe" | "owed_to_me" | "loan" | "installment">(initial?.kind ?? "i_owe");
  const [initialAmount, setInitialAmount] = useState(initial ? String(initial.initialAmount) : "");
  const [monthlyPayment, setMonthlyPayment] = useState(initial ? String(initial.monthlyPayment) : "");
  const [dueDay, setDueDay] = useState(initial ? String(initial.dueDay) : "1");
  const [interestRate, setInterestRate] = useState(initial ? String(initial.interestRate) : "0");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const saveMut = useMutation({
    mutationFn: async () => {
      const ia = Number(initialAmount);
      if (!name.trim()) throw new Error("Give this debt a name.");
      if (!Number.isFinite(ia) || ia <= 0) throw new Error("Enter an initial amount greater than zero.");
      return await api.upsertDebt({ id: initial?.id ?? null, name: name.trim(), kind, initialAmount: ia, monthlyPayment: Number(monthlyPayment) || 0, dueDay: Number(dueDay) || 1, interestRate: Number(interestRate) || 0, startDate: initial?.startDate ?? todayStr(), description: description.trim() });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  const deleteMut = useMutation({ mutationFn: async () => await api.deleteDebt({ id: initial!.id }), onSuccess: () => { refresh(); onClose(); } });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <Field label="Name"><input aria-label="Debt name" className={inputCls} placeholder="e.g. Car loan, Borrowed from a friend" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="Type">
        <select aria-label="Debt type" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="i_owe">I owe someone</option><option value="loan">Loan</option><option value="installment">Installments</option><option value="owed_to_me">Someone owes me</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Initial amount"><input aria-label="Initial amount" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={initialAmount} onChange={(e) => setInitialAmount(e.target.value)} required /></Field>
        <Field label="Monthly payment"><input aria-label="Monthly payment" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} /></Field>
        <Field label="Due day"><input aria-label="Due day" className={inputCls} type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></Field>
        <Field label="Interest rate % (optional)"><input aria-label="Interest rate" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} /></Field>
      </div>
      <Field label="Description (optional)"><input aria-label="Debt description" className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Add debt"}</button>
      {initial && (
        <ConfirmDeleteButton label="Delete debt" onConfirm={() => deleteMut.mutate()} disabled={deleteMut.isPending} />
      )}
    </form>
  );
}

