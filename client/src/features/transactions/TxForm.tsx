"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { BUILT_IN_EXPENSE, BUILT_IN_INCOME, PAYMENT_METHODS } from "../../lib/constants";
import { todayStr, unique } from "../../lib/format";
import type { State, Tx } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { CategoryPicker, ConfirmDeleteButton, ErrorAlert, Field, inputCls, btnPrimary } from "../../components/ui";

export function TxForm({
  state,
  initial,
  defaultKind,
  onClose,
}: {
  state: State;
  initial: Tx | null;
  defaultKind: "income" | "expense";
  onClose: () => void;
}) {
  const editing = initial != null;
  const [kind, setKind] = useState<"income" | "expense">(initial?.kind ?? defaultKind);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const expenseOptions = useMemo(
    () => unique([...BUILT_IN_EXPENSE, ...state.categories.filter((c) => c.kind === "expense").map((c) => c.name)]),
    [state.categories],
  );
  const incomeOptions = useMemo(
    () => unique([...BUILT_IN_INCOME, ...state.categories.filter((c) => c.kind === "income").map((c) => c.name)]),
    [state.categories],
  );
  const [category, setCategory] = useState(
    initial?.category ?? (defaultKind === "income" ? (state.salaryCategory || "Salary") : "Groceries"),
  );
  const [expenseType, setExpenseType] = useState<"fixed" | "variable">(initial?.expenseType ?? "variable");
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "card");
  const [accountId, setAccountId] = useState<string>(initial?.accountId != null ? String(initial.accountId) : "");
  const [recurring, setRecurring] = useState(initial?.recurring ?? false);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const refresh = useRefresh();

  const saveMut = useMutation({
    mutationFn: async (force: boolean) => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
      if (!category.trim()) throw new Error("Choose or enter a category.");
      const acct = accountId === "" ? null : Number(accountId);
      if (editing && initial) {
        return await api.updateTransaction({
          id: initial.id,
          amount: amt,
          category: category.trim(),
          date,
          description: description.trim(),
          paymentMethod,
          note: note.trim(),
          expenseType: kind === "expense" ? expenseType : null,
          accountId: acct,
          recurring,
        });
      }
      return await api.addTransaction({
        kind,
        expenseType: kind === "expense" ? expenseType : null,
        amount: amt,
        category: category.trim(),
        date,
        description: description.trim(),
        paymentMethod,
        note: note.trim(),
        accountId: acct,
        recurring,
        force,
      });
    },
    onSuccess: (res) => {
      if (res.duplicate) {
        setDuplicate(true);
        setError(res.error);
        return;
      }
      if (!res.ok) {
        setError(res.error ?? "Could not save. Try again.");
        return;
      }
      // Register a brand-new custom category so it appears in pickers later.
      const known = kind === "income" ? incomeOptions : expenseOptions;
      if (!known.includes(category.trim())) {
        void api.upsertCategory({ name: category.trim(), kind }).then(refresh);
      }
      refresh();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save. Try again."),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!initial) throw new Error("Nothing to delete.");
      return await api.deleteTransaction({ id: initial.id });
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
        setDuplicate(false);
        saveMut.mutate(false);
      }}
    >
      {!editing && (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Transaction kind">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setCategory(k === "income" ? (state.salaryCategory || "Salary") : "Groceries");
              }}
              className={`min-h-11 rounded-xl border px-3 font-semibold capitalize ${
                kind === k
                  ? k === "income"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
                  : "border-[var(--border)] text-[var(--dim)]"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <Field label="Amount">
        <input
          aria-label="Amount"
          className={`${inputCls} tnum text-xl font-semibold`}
          inputMode="decimal"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </Field>

      <Field label="Category">
        <CategoryPicker
          kind={kind}
          options={kind === "income" ? incomeOptions : expenseOptions}
          value={category}
          onChange={setCategory}
        />
      </Field>

      {kind === "expense" && (
        <Field label="Expense type">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Expense type">
            {(["variable", "fixed"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={expenseType === t}
                onClick={() => setExpenseType(t)}
                className={`min-h-10 rounded-xl border px-3 font-medium capitalize ${
                  expenseType === t ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--dim)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input aria-label="Date" className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Payment method">
          <select aria-label="Payment method" className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>

      {state.accounts.length > 0 && (
        <Field label="Account (optional)">
          <select aria-label="Account" className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">No account</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
      )}

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
        <span className="font-medium">{kind === "income" ? "Recurring income" : "Recurring expense"}</span>
        <input type="checkbox" aria-label="Recurring" className="h-5 w-5 accent-[var(--accent)]" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
      </label>

      <Field label="Description">
        <input aria-label="Description" className={inputCls} placeholder={kind === "income" ? "e.g. Freelance project" : "e.g. Weekly groceries"} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <Field label="Notes (optional)">
        <input aria-label="Notes" className={inputCls} placeholder="Anything to remember" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {duplicate ? (
        <button type="button" className={btnPrimary} disabled={saveMut.isPending} onClick={() => saveMut.mutate(true)}>
          Add anyway — it's not a duplicate
        </button>
      ) : (
        <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>
          {saveMut.isPending ? "Saving…" : editing ? "Save changes" : kind === "income" ? "Add income" : "Add expense"}
        </button>
      )}

      {editing && (
        <ConfirmDeleteButton label="Delete transaction" onConfirm={() => deleteMut.mutate()} disabled={deleteMut.isPending} />
      )}
    </form>
  );
}

