"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { BUILT_IN_EXPENSE, PAYMENT_METHODS } from "../../lib/constants";
import { unique } from "../../lib/format";
import type { FixedRow, State } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { CategoryPicker, ConfirmDeleteButton, ErrorAlert, Field, inputCls, btnPrimary } from "../../components/ui";

export function FixedForm({
  state,
  initial,
  onClose,
}: {
  state: State;
  initial: FixedRow | null;
  onClose: () => void;
}) {
  const editing = initial != null;
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const expenseOptions = useMemo(
    () => unique([...BUILT_IN_EXPENSE, ...state.categories.filter((c) => c.kind === "expense").map((c) => c.name)]),
    [state.categories],
  );
  const [category, setCategory] = useState(initial?.category ?? "Housing");
  const [paymentDay, setPaymentDay] = useState(initial ? String(initial.paymentDay) : "1");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "yearly">(initial?.frequency ?? "monthly");
  const [startMonth, setStartMonth] = useState(initial?.startMonth ?? "");
  const [endMonth, setEndMonth] = useState(initial?.endMonth ?? "");
  const [payMethod, setPayMethod] = useState(initial?.paymentMethod ?? "bank transfer");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useRefresh();

  const saveMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      const day = Number(paymentDay);
      if (!name.trim()) throw new Error("Give this expense a name.");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
      if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error("Payment day must be between 1 and 31.");
      return await api.upsertFixedExpense({
        id: initial?.id ?? null,
        name: name.trim(),
        amount: amt,
        category: category.trim() || "Other",
        paymentDay: day,
        frequency,
        description: description.trim(),
        active,
        startMonth: startMonth === "" ? null : startMonth,
        endMonth: endMonth === "" ? null : endMonth,
        paymentMethod: payMethod,
      });
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
      return await api.deleteFixedExpense({ id: initial.id });
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
      <Field label="Name">
        <input aria-label="Fixed expense name" className={inputCls} placeholder="e.g. Rent, Netflix, Internet" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <input aria-label="Amount" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Payment day">
          <input aria-label="Payment day of month" className={inputCls} type="number" min="1" max="31" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} required />
        </Field>
      </div>
      <Field label="Category">
        <CategoryPicker kind="expense" options={expenseOptions} value={category} onChange={setCategory} />
      </Field>
      <Field label="Frequency">
        <select aria-label="Frequency" className={inputCls} value={frequency} onChange={(e) => setFrequency(e.target.value as "weekly" | "monthly" | "quarterly" | "yearly")}>
          <option value="weekly">Weekly (counted ×4 per month)</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start month (optional)">
          <input aria-label="Start month" className={inputCls} type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
        </Field>
        <Field label="End month (optional)">
          <input aria-label="End month" className={inputCls} type="month" value={endMonth ?? ""} onChange={(e) => setEndMonth(e.target.value)} />
        </Field>
      </div>
      <Field label="Payment method">
        <select aria-label="Fixed expense payment method" className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Field>
      <Field label="Description (optional)">
        <input aria-label="Description" className={inputCls} placeholder="e.g. Fiber 100 Mbps plan" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
        <span className="font-medium">Active</span>
        <input
          type="checkbox"
          aria-label="Active"
          className="h-5 w-5 accent-[var(--accent)]"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </label>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>
        {saveMut.isPending ? "Saving…" : editing ? "Save changes" : "Add fixed expense"}
      </button>
      {editing && (
        <ConfirmDeleteButton label="Delete fixed expense" onConfirm={() => deleteMut.mutate()} disabled={deleteMut.isPending} />
      )}
    </form>
  );
}

