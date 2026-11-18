"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import type { AccountRow } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { ConfirmDeleteButton, ErrorAlert, Field, inputCls, btnPrimary } from "../../components/ui";

export function AccountForm({ initial, onClose }: { initial: AccountRow | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<"cash" | "bank" | "savings" | "other">(initial?.type ?? "bank");
  const [opening, setOpening] = useState(initial ? String(initial.openingBalance) : "0");
  const [error, setError] = useState<string | null>(null);
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Give this account a name.");
      const ob = Number(opening);
      if (!Number.isFinite(ob)) throw new Error("Enter a valid opening balance.");
      return await api.upsertAccount({ id: initial?.id ?? null, name: name.trim(), type, openingBalance: ob, active: initial?.active ?? true });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  const deleteMut = useMutation({
    mutationFn: async () => await api.deleteAccount({ id: initial!.id }),
    onSuccess: () => { refresh(); onClose(); },
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <Field label="Account name"><input aria-label="Account name" className={inputCls} placeholder="e.g. CIH Bank, Cash wallet" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select aria-label="Account type" className={inputCls} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="cash">Cash</option><option value="bank">Bank account</option><option value="savings">Savings account</option><option value="other">Other</option>
          </select>
        </Field>
        <Field label="Opening balance"><input aria-label="Opening balance" className={`${inputCls} tnum`} inputMode="decimal" type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} required /></Field>
      </div>
      <p className="text-sm text-[var(--dim)]">The balance then moves with every transaction you assign to this account, plus transfers.</p>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Add account"}</button>
      {initial && (
        <ConfirmDeleteButton label="Delete account" onConfirm={() => deleteMut.mutate()} disabled={deleteMut.isPending} />
      )}
    </form>
  );
}

