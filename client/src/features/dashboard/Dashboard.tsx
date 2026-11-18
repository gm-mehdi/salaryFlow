"use client";

import dynamic from "next/dynamic";
import { currentMonthKey, fmt, prettyDate } from "../../lib/format";
import type { State, Tx } from "../../lib/types";
import { IconWallet } from "../../components/icons";
import { EmptyState, ProgressBar, StatCard, TxRow, cardCls, btnPrimary } from "../../components/ui";

const DashboardCharts = dynamic(
  () => import("./DashboardCharts").then((m) => ({ default: m.DashboardCharts })),
  {
    ssr: false,
    loading: () => <div className={`${cardCls} h-52 animate-pulse bg-[var(--surface-2)]`} aria-hidden="true" />,
  },
);

export function Dashboard({
  state,
  onSeeAll,
  onEditTx,
  onAddSalary,
  salaryBusy,
}: {
  state: State;
  onSeeAll: () => void;
  onEditTx: (tx: Tx) => void;
  onAddSalary: () => void;
  salaryBusy: boolean;
}) {
  const s = state.summary;
  const cur = state.currency;
  const isCurrentMonth = state.month === currentMonthKey();
  const chartData = state.series.slice(-6).map((m) => ({ ...m, short: m.label.split(" ")[0]?.slice(0, 3) ?? "" }));
  const hasChartData = state.series.some((m) => m.income > 0 || m.expenses > 0);
  const totalSplit = s.fixedExpenses + s.variableExpenses;
  const latest = state.transactions.slice(0, 5);
  const isEmpty = s.income === 0 && s.expenses === 0 && state.fixed.length === 0;
  const showCharts = !isEmpty && (hasChartData || s.categoryStats.length > 0);

  return (
    <div className="space-y-4">
      {state.needsSalaryPrompt && isCurrentMonth && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
          <span className="text-[var(--accent)]"><IconWallet /></span>
          <p className="flex-1 text-sm">
            Your salary of <strong className="tnum">{state.salaryAmount != null ? fmt(state.salaryAmount, cur) : ""}</strong> isn't recorded for {state.monthLabel.split(" ")[0]} yet.
          </p>
          <button type="button" className={btnPrimary} disabled={salaryBusy} onClick={onAddSalary}>
            {salaryBusy ? "Adding…" : "Add it"}
          </button>
        </div>
      )}

      <section aria-label="Remaining balance" className="rounded-3xl bg-[var(--accent)] p-5 text-white">
        <p className="text-sm text-white/80">Remaining balance · {state.monthLabel}</p>
        <p className="tnum mt-1 text-4xl font-extrabold">{fmt(s.balance, cur)}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1">{s.spentPct}% of income spent</span>
          <span className="rounded-full bg-white/15 px-3 py-1">{s.savedPct}% saved</span>
          <span className="rounded-full bg-white/15 px-3 py-1">Income {fmt(s.income, cur)}</span>
        </div>
      </section>

      {isEmpty ? (
        <EmptyState
          title="Start with your salary"
          body="Add your monthly salary in Settings, log expenses with the + button, and this dashboard fills in automatically."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Salary" value={fmt(s.salary, cur)} sub={s.additionalIncome > 0 ? `+ ${fmt(s.additionalIncome, cur)} other income` : "No extra income"} />
            <StatCard label="Additional income" value={fmt(s.additionalIncome, cur)} sub={`Total income ${fmt(s.income, cur)}`} />
            <StatCard label="Total expenses" value={fmt(s.expenses, cur)} sub={`${s.expenseCount} expense${s.expenseCount === 1 ? "" : "s"} this month`} />
            <StatCard label="Fixed expenses" value={fmt(s.fixedExpenses, cur)} sub={`${s.fixedPctOfIncome}% of income`} />
            <StatCard label="Variable expenses" value={fmt(s.variableExpenses, cur)} sub={`${s.variablePctOfIncome}% of income`} />
            <StatCard label="Saved to goals" value={fmt(state.projections.totalSavingsSaved, cur)} sub={state.projections.totalSavingsTarget > 0 ? `of ${fmt(state.projections.totalSavingsTarget, cur)} targets` : "No goals yet"} />
            {state.accounts.length > 0 && <StatCard label="All accounts" value={fmt(state.totalAccountBalance, cur)} sub={`${state.accounts.length} account${state.accounts.length === 1 ? "" : "s"}`} />}
            {state.totalDebtOwed > 0 && <StatCard label="Debts outstanding" value={fmt(state.totalDebtOwed, cur)} sub={state.totalOwedToMe > 0 ? `${fmt(state.totalOwedToMe, cur)} owed to you` : "See Debts"} />}
          </div>

          <section className={cardCls} aria-label="Projection for this month">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display font-semibold">Projected end of month</h2>
              <span className="rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warn)]">Estimate</span>
            </div>
            <p className="tnum mt-1 text-2xl font-bold">{fmt(state.projections.projectedEndBalance, cur)}</p>
            <p className="mt-1 text-sm text-[var(--dim)]">
              After the {fmt(state.projections.upcomingFixedPending, cur)} of fixed charges still pending. Based on your actual income, paid charges and spending so far — not a promise.
            </p>
          </section>

          {state.unpaidBills.length > 0 && (
            <section className={cardCls} aria-label="Upcoming and unpaid bills">
              <h2 className="font-display mb-2 font-semibold">Bills still to pay</h2>
              <ul className="divide-y divide-[var(--border)]">
                {state.unpaidBills.slice(0, 5).map((b) => (
                  <li key={b.name} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>{b.name} <span className="text-[var(--dim)]">· due {prettyDate(b.dueDate)}</span>{b.status === "overdue" && <span className="ml-1 font-semibold text-[var(--danger)]">overdue</span>}</span>
                    <span className="tnum font-semibold">{fmt(b.amount, cur)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={cardCls} aria-label="Savings this month">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display font-semibold">Savings this month</h2>
              <span className={`tnum font-bold ${s.savings < 0 ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>{fmt(s.savings, cur)}</span>
            </div>
            <div className="mt-3">
              <ProgressBar pct={Math.max(0, s.savedPct)} tone={s.savings < 0 ? "over" : "ok"} />
            </div>
            <p className="mt-2 text-sm text-[var(--dim)]">
              {s.income > 0
                ? `Savings rate ${s.savedPct}% · average daily spending ${fmt(s.avgDaily, cur)}`
                : "Add income to see your savings rate."}
            </p>
            <div className="mt-3 flex items-baseline justify-between border-t border-[var(--border)] pt-3">
              <div>
                <p className="text-sm font-medium">Total savings (all months)</p>
                <p className="text-xs text-[var(--dim)]">Sum of leftover money: income − expenses, month by month</p>
              </div>
              <span className={`tnum text-lg font-bold ${state.lifetimeSavings < 0 ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>
                {fmt(state.lifetimeSavings, cur)}
              </span>
            </div>
          </section>

          {totalSplit > 0 && (
            <section className={cardCls} aria-label="Fixed versus variable breakdown">
              <h2 className="font-display mb-3 font-semibold">Fixed vs variable</h2>
              <div className="flex h-4 w-full overflow-hidden rounded-full" aria-hidden="true">
                <div style={{ width: `${(s.fixedExpenses / totalSplit) * 100}%`, background: "#3e7cb1" }} />
                <div style={{ width: `${(s.variableExpenses / totalSplit) * 100}%`, background: "#e8a33d" }} />
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <p className="flex justify-between"><span><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: "#3e7cb1" }} />Fixed</span><span className="tnum font-medium">{fmt(s.fixedExpenses, cur)} · {Math.round((s.fixedExpenses / totalSplit) * 100)}%</span></p>
                <p className="flex justify-between"><span><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: "#e8a33d" }} />Variable</span><span className="tnum font-medium">{fmt(s.variableExpenses, cur)} · {Math.round((s.variableExpenses / totalSplit) * 100)}%</span></p>
              </div>
            </section>
          )}

          {showCharts && <DashboardCharts state={state} chartData={chartData} hasChartData={hasChartData} />}
        </>
      )}

      <section className={cardCls} aria-label="Latest transactions">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display font-semibold">Latest transactions</h2>
          <button type="button" className="min-h-9 px-2 text-sm font-medium text-[var(--accent)]" onClick={onSeeAll}>
            See all
          </button>
        </div>
        {latest.length === 0 ? (
          <p className="py-3 text-sm text-[var(--dim)]">No transactions in {state.monthLabel} yet. Tap + to add your first one.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {latest.map((tx) => (
              <TxRow key={`${tx.source}-${tx.id}`} tx={tx} currency={cur} onEdit={tx.source === "transaction" ? () => onEditTx(tx) : undefined} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
