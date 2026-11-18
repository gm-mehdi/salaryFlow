"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import type { GoalRow } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { ConfirmDeleteButton, ErrorAlert, Field, inputCls, btnPrimary } from "../../components/ui";

export function GoalForm({ initial, onClose }: { initial: GoalRow | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(initial ? String(initial.targetAmount) : "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const saveMut = useMutation({
    mutationFn: async () => {
      const t = Number(target);
      if (!name.trim()) throw new Error("Give this goal a name.");
      if (!Number.isFinite(t) || t <= 0) throw new Error("Enter a target greater than zero.");
      return await api.upsertGoal({ id: initial?.id ?? null, name: name.trim(), targetAmount: t, targetDate: targetDate === "" ? null : targetDate, description: description.trim() });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  const deleteMut = useMutation({ mutationFn: async () => await api.deleteGoal({ id: initial!.id }), onSuccess: () => { refresh(); onClose(); } });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <Field label="Goal name"><input aria-label="Goal name" className={inputCls} placeholder="e.g. Emergency fund, Car, Travel" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target amount"><input aria-label="Target amount" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={target} onChange={(e) => setTarget(e.target.value)} required /></Field>
        <Field label="Target date (optional)"><input aria-label="Target date" className={inputCls} type="date" value={targetDate ?? ""} onChange={(e) => setTargetDate(e.target.value)} /></Field>
      </div>
      <Field label="Description (optional)"><input aria-label="Goal description" className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Create goal"}</button>
      {initial && (
        <ConfirmDeleteButton label="Delete goal" onConfirm={() => deleteMut.mutate()} disabled={deleteMut.isPending} />
      )}
    </form>
  );
}

