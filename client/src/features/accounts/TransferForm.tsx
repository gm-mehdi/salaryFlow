"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { todayStr } from "../../lib/format";
import type { State } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { ErrorAlert, Field, inputCls, btnPrimary } from "../../components/ui";

export function TransferForm({ state, onClose }: { state: State; onClose: () => void }) {
  const refresh = useRefresh();
  const [from, setFrom] = useState(state.accounts[0] ? String(state.accounts[0].id) : "");
  const [to, setTo] = useState(state.accounts[1] ? String(state.accounts[1].id) : "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saveMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
      if (!from || !to || from === to) throw new Error("Choose two different accounts.");
      return await api.addTransfer({ fromAccountId: Number(from), toAccountId: Number(to), amount: amt, date, note: note.trim() });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From"><select aria-label="From account" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)}>{state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="To"><select aria-label="To account" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>{state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      </div>
      <Field label="Amount"><input aria-label="Transfer amount" className={`${inputCls} tnum text-xl font-semibold`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
      <Field label="Date"><input aria-label="Transfer date" className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <Field label="Note (optional)"><input aria-label="Transfer note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <p className="text-sm text-[var(--dim)]">Transfers move money between your own accounts — they never count as income or expenses.</p>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : "Record transfer"}</button>
    </form>
  );
}

