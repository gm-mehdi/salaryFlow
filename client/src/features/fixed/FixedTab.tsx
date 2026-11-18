"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { fmt, prettyDate } from "../../lib/format";
import type { FixedRow, State } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { IconCheck, IconPencil, IconPlus, IconTrash } from "../../components/icons";
import { EmptyState, ProgressBar, StatCard, cardCls, btnPrimary, btnGhost, inputCls } from "../../components/ui";

export function FixedTab({
  state,
  onEditFixed,
}: {
  state: State;
  onEditFixed: (f: FixedRow | null) => void;
}) {
  const refresh = useRefresh();
  const cur = state.currency;
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  const togglePaidMut = useMutation({
    mutationFn: async (f: FixedRow) =>
      await api.toggleFixedPayment({ fixedExpenseId: f.id, month: state.month, paid: !f.paidThisMonth }),
    onSuccess: refresh,
  });

  const recordPartialMut = useMutation({
    mutationFn: async (args: { fixed: FixedRow; amount: number }) =>
      await api.recordFixedPayment({ fixedExpenseId: args.fixed.id, month: state.month, amount: args.amount }),
    onSuccess: (res) => {
      if (!res.ok) {
        setPayError(res.error ?? "Could not save this payment. Try again.");
        return;
      }
      setPayError(null);
      setPayingId(null);
      setPayAmount("");
      refresh();
    },
    onError: (e) => setPayError(e instanceof Error ? e.message : "Could not save this payment."),
  });

  const deletePaymentMut = useMutation({
    mutationFn: async (paymentId: number) => await api.deleteFixedPayment({ id: paymentId }),
    onSuccess: refresh,
  });

  const toggleActiveMut = useMutation({
    mutationFn: async (f: FixedRow) =>
      await api.upsertFixedExpense({
        id: f.id,
        name: f.name,
        amount: f.amount,
        category: f.category,
        paymentDay: f.paymentDay,
        frequency: f.frequency,
        description: f.description,
        active: !f.active,
        startMonth: f.startMonth,
        endMonth: f.endMonth,
        paymentMethod: f.paymentMethod,
      }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Expected" value={fmt(state.fixedExpected, cur)} />
        <StatCard label="Paid" value={fmt(state.fixedPaid, cur)} />
        <StatCard label="Remaining" value={fmt(state.fixedPending, cur)} />
      </div>
      <p className="text-sm text-[var(--dim)]">For {state.monthLabel}. Use <strong>Pay part</strong> when you only pay some of an expense — for example 100 {cur} of a 700 {cur} bill. Only what you pay counts in your totals, and the rest shows as remaining.</p>

      {state.fixed.length === 0 ? (
        <EmptyState title="No fixed expenses yet" body="Add rent, subscriptions and bills here once, then pay them in full or in part each month." />
      ) : (
        <div className="space-y-3">
          {state.fixed.map((f) => {
            const pctPaid = f.amount > 0 ? Math.round((f.paidAmount / f.amount) * 100) : 0;
            const isPaying = payingId === f.id;
            return (
            <article key={f.id} className={`${cardCls} ${!f.active ? "opacity-60" : ""}`} aria-label={f.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display font-semibold">{f.name}</h2>
                  <p className="text-sm text-[var(--dim)]">
                    {f.category} · due {prettyDate(f.dueDate)}
                    {f.dueThisMonth && f.active && f.remainingAmount > 0 ? (f.daysUntilDue < 0 ? ` · ${Math.abs(f.daysUntilDue)}d overdue` : f.daysUntilDue === 0 ? " · due today" : ` · in ${f.daysUntilDue}d`) : ""} · {f.frequency}
                    {f.frequency === "weekly" ? ` · ${fmt(f.monthlyAmount, cur)}/month` : ""}
                    {f.endMonth ? ` · until ${f.endMonth}` : ""}
                  </p>
                  {f.description && <p className="truncate text-sm text-[var(--dim)]">{f.description}</p>}
                </div>
                <p className="tnum text-lg font-bold">{fmt(f.amount, cur)}</p>
              </div>

              {f.active && f.dueThisMonth && f.paidAmount > 0 && (
                <div className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span>Paid <strong className="tnum">{fmt(f.paidAmount, cur)}</strong></span>
                    <span className={f.remainingAmount > 0 ? "font-semibold" : "text-[var(--accent)]"}>
                      {f.remainingAmount > 0 ? <>Remaining <span className="tnum">{fmt(f.remainingAmount, cur)}</span></> : "Fully paid"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar pct={pctPaid} tone={f.paidThisMonth ? "ok" : "warn"} />
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--dim)]">{pctPaid}% paid</p>
                  {f.payments.length > 0 && (
                    <ul className="mt-2 divide-y divide-[var(--border)]">
                      {f.payments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                          <span className="text-[var(--dim)]">Payment</span>
                          <span className="flex items-center gap-2">
                            <span className="tnum font-medium">{fmt(p.amount, cur)}</span>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--danger)]"
                              onClick={() => deletePaymentMut.mutate(p.id)}
                              disabled={deletePaymentMut.isPending}
                              aria-label={`Remove payment of ${fmt(p.amount, cur)} for ${f.name}`}
                            >
                              <IconTrash />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {isPaying && (
                <form
                  className="mt-3 space-y-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)]/40 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPayError(null);
                    const amt = Number(payAmount);
                    if (!Number.isFinite(amt) || amt <= 0) {
                      setPayError("Enter an amount greater than zero.");
                      return;
                    }
                    if (amt > f.remainingAmount) {
                      setPayError(`That is more than the ${fmt(f.remainingAmount, cur)} remaining.`);
                      return;
                    }
                    recordPartialMut.mutate({ fixed: f, amount: amt });
                  }}
                >
                  <p className="text-sm font-medium">
                    Pay part of {f.name} — remaining is <span className="tnum font-bold">{fmt(f.remainingAmount, cur)}</span>
                  </p>
                  <div className="flex gap-2">
                    <input
                      aria-label={`Amount to pay for ${f.name}`}
                      className={`${inputCls} tnum flex-1 text-lg font-semibold`}
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="0.01"
                      max={f.remainingAmount}
                      placeholder={String(f.remainingAmount)}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => setPayAmount(String(f.remainingAmount))}
                    >
                      All {fmt(f.remainingAmount, cur)}
                    </button>
                  </div>
                  {payError && (
                    <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{payError}</p>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" className={`${btnPrimary} flex-1`} disabled={recordPartialMut.isPending}>
                      {recordPartialMut.isPending ? "Saving…" : "Save payment"}
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => { setPayingId(null); setPayAmount(""); setPayError(null); }}
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-[var(--dim)]">Example: enter 100 and you will see Paid 100 {cur} · Remaining {fmt(Math.max(0, f.remainingAmount - (Number(payAmount) || 0)), cur)} before saving.</p>
                </form>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!f.active ? (
                  <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--dim)]">Inactive</span>
                ) : !f.dueThisMonth ? (
                  <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--dim)]">Not due this month</span>
                ) : f.paidThisMonth ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"><IconCheck /> Paid</span>
                ) : f.status === "overdue" ? (
                  <span className="rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-semibold text-[var(--danger)]">Overdue</span>
                ) : f.isPartiallyPaid ? (
                  <span className="rounded-full bg-[var(--warn-soft)] px-3 py-1 text-xs font-semibold text-[var(--warn)]">Partially paid · {fmt(f.remainingAmount, cur)} left</span>
                ) : f.status === "upcoming" ? (
                  <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--dim)]">Upcoming · {prettyDate(f.dueDate)}</span>
                ) : (
                  <span className="rounded-full bg-[var(--warn-soft)] px-3 py-1 text-xs font-semibold text-[var(--warn)]">Pending</span>
                )}
                <span className="flex-1" />
                {f.active && f.dueThisMonth && !f.paidThisMonth && (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      if (isPaying) {
                        setPayingId(null);
                        setPayAmount("");
                        setPayError(null);
                      } else {
                        setPayingId(f.id);
                        setPayAmount("");
                        setPayError(null);
                      }
                    }}
                    aria-label={`Pay part of ${f.name}`}
                    aria-expanded={isPaying}
                  >
                    Pay part
                  </button>
                )}
                {f.active && f.dueThisMonth && (
                  <button
                    type="button"
                    className={f.paidThisMonth ? btnGhost : btnPrimary}
                    disabled={togglePaidMut.isPending}
                    onClick={() => togglePaidMut.mutate(f)}
                    aria-label={f.paidThisMonth ? `Mark ${f.name} unpaid` : f.isPartiallyPaid ? `Pay remaining for ${f.name}` : `Mark ${f.name} paid`}
                  >
                    {f.paidThisMonth ? "Mark unpaid" : f.isPartiallyPaid ? "Pay rest" : "Mark paid"}
                  </button>
                )}
                <button type="button" className={btnGhost} onClick={() => toggleActiveMut.mutate(f)} aria-label={f.active ? `Deactivate ${f.name}` : `Activate ${f.name}`} disabled={toggleActiveMut.isPending}>
                  {f.active ? "Deactivate" : "Activate"}
                </button>
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)]" onClick={() => onEditFixed(f)} aria-label={`Edit ${f.name}`}>
                  <IconPencil />
                </button>
              </div>
            </article>
            );
          })}
        </div>
      )}

      <button type="button" className={`${btnPrimary} w-full`} onClick={() => onEditFixed(null)}>
        <IconPlus size={18} /> Add fixed expense
      </button>
    </div>
  );
}
