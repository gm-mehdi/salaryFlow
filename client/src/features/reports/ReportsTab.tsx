"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { useState } from "react";
import { fmt, fmtShort, prettyDate, shiftMonthKey } from "../../lib/format";
import type { State } from "../../lib/types";
import { IconChevronLeft, IconChevronRight } from "../../components/icons";
import { EmptyState, Field, InsightStat, StatCard, cardCls, inputCls, tooltipStyle } from "../../components/ui";

export function ReportsTab({ state, compareMonth, onCompareMonth }: { state: State; compareMonth: string; onCompareMonth: (m: string) => void }) {
  const cur = state.currency;
  const s = state.summary;
  const cmp = state.compareSummary;
  const [extraSavings, setExtraSavings] = useState("500");
  const extra = Number(extraSavings) || 0;
  const simMonthly = state.projections.projectedSavings + extra;
  const yearData = state.year.months.map((m) => ({ ...m, short: m.label.split(" ")[0]?.slice(0, 3) ?? "" }));
  const avgIncome = state.year.months.filter((m) => m.income > 0);
  const monthlyAvgExpenses = state.year.months.length ? state.year.totalExpenses / 12 : 0;
  return (
    <div className="space-y-4">
      <section className={cardCls} aria-label="Monthly report">
        <h2 className="font-display mb-1 font-semibold">{state.monthLabel} report</h2>
        <div className="divide-y divide-[var(--border)]">
          <InsightStat label="Total income" value={fmt(s.income, cur)} />
          <InsightStat label="Total expenses" value={fmt(s.expenses, cur)} />
          <InsightStat label="Fixed expenses (paid)" value={fmt(s.fixedExpenses, cur)} />
          <InsightStat label="Variable expenses" value={fmt(s.variableExpenses, cur)} />
          <InsightStat label="Savings / remaining" value={fmt(s.savings, cur)} />
          <InsightStat label="Savings rate" value={s.income > 0 ? `${s.savedPct}%` : "—"} />
          <InsightStat label="Opening position (accounts)" value={state.accounts.length ? fmt(state.totalAccountBalance, cur) : "No accounts tracked"} />
        </div>
      </section>

      <section className={cardCls} aria-label="Top categories and expenses">
        <h2 className="font-display mb-2 font-semibold">Top 5 spending categories</h2>
        {s.categoryStats.length === 0 ? <p className="text-sm text-[var(--dim)]">No spending recorded this month.</p> : (
          <ul className="space-y-1.5">
            {s.categoryStats.slice(0, 5).map((c, i) => (
              <li key={c.category} className="flex justify-between text-sm"><span>{i + 1}. {c.category}</span><span className="tnum font-medium">{fmt(c.amount, cur)} · {c.pctOfExpenses}%</span></li>
            ))}
          </ul>
        )}
        <h3 className="font-display mt-4 mb-2 font-semibold">Highest individual expenses</h3>
        {state.topExpenses.length === 0 ? <p className="text-sm text-[var(--dim)]">None yet.</p> : (
          <ul className="space-y-1.5">
            {state.topExpenses.map((e, i) => (
              <li key={i} className="flex justify-between text-sm"><span>{e.description} <span className="text-[var(--dim)]">· {prettyDate(e.date)}</span></span><span className="tnum font-medium">{fmt(e.amount, cur)}</span></li>
            ))}
          </ul>
        )}
        <h3 className="font-display mt-4 mb-2 font-semibold">Budget performance</h3>
        {state.budgets.length === 0 ? <p className="text-sm text-[var(--dim)]">No budgets set.</p> : (
          <ul className="space-y-1.5">
            {state.budgets.map((b) => (
              <li key={b.id} className="flex justify-between text-sm"><span>{b.category}</span><span className={`tnum font-medium ${b.warning === "exceeded" ? "text-[var(--danger)]" : ""}`}>{fmt(b.spent, cur)} / {fmt(b.amount, cur)} · {b.pctUsed}%</span></li>
            ))}
          </ul>
        )}
        <h3 className="font-display mt-4 mb-2 font-semibold">Outstanding unpaid bills</h3>
        {state.unpaidBills.length === 0 ? <p className="text-sm text-[var(--dim)]">All due charges are paid for {state.monthLabel}.</p> : (
          <ul className="space-y-1.5">
            {state.unpaidBills.map((b) => (
              <li key={b.name} className="flex justify-between text-sm"><span>{b.name} <span className="text-[var(--dim)]">· due {prettyDate(b.dueDate)}</span></span><span className="tnum font-medium">{fmt(b.amount, cur)}</span></li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardCls} aria-label="Compare months">
        <h2 className="font-display mb-2 font-semibold">Compare with another month</h2>
        <Field label="Compare month">
          <input aria-label="Month to compare" className={inputCls} type="month" value={compareMonth} onChange={(e) => onCompareMonth(e.target.value)} />
        </Field>
        {cmp ? (
          <div className="mt-3 divide-y divide-[var(--border)]">
            {([
              ["Income", s.income, cmp.income],
              ["Expenses", s.expenses, cmp.expenses],
              ["Fixed", s.fixedExpenses, cmp.fixedExpenses],
              ["Variable", s.variableExpenses, cmp.variableExpenses],
              ["Savings", s.savings, cmp.savings],
            ] as const).map(([label, now, other]) => (
              <div key={label} className="flex items-baseline justify-between gap-2 py-2 text-sm">
                <span className="text-[var(--dim)]">{label}</span>
                <span className="tnum font-semibold">{fmt(now, cur)}</span>
                <span className="tnum text-[var(--dim)]">vs {fmt(other, cur)} in {state.compareLabel}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-[var(--dim)]">Pick a month to compare against {state.monthLabel}.</p>}
        <p className="mt-3 text-sm text-[var(--dim)]">Year-to-date: income {fmt(state.year.totalIncome, cur)} · expenses {fmt(state.year.totalExpenses, cur)} · savings {fmt(state.year.totalSavings, cur)}. Average monthly expenses in {state.year.year}: {fmt(Math.round(monthlyAvgExpenses), cur)}{avgIncome.length ? "" : ""}.</p>
      </section>

      <section className={cardCls} aria-label="Annual overview chart">
        <h2 className="font-display mb-3 font-semibold">{state.year.year} — month by month</h2>
        <div className="h-44 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="short" tick={{ fill: "var(--dim)", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tickFormatter={fmtShort} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v ?? 0), cur)} />
              <Bar dataKey="income" name="Income" fill="#0e6b5c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#e4572e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="savings" name="Savings" fill="#3e7cb1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={cardCls} aria-label="Projections and simulator">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display font-semibold">Projections</h2>
          <span className="rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warn)]">Estimates only</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          <InsightStat label="Projected end-of-month balance" value={fmt(state.projections.projectedEndBalance, cur)} />
          <InsightStat label="Projected monthly savings" value={fmt(state.projections.projectedSavings, cur)} />
          <InsightStat label="Fixed charges still pending" value={fmt(state.projections.upcomingFixedPending, cur)} />
          <InsightStat label="Average variable spending (last 3 months)" value={fmt(state.projections.avgVariableLast3, cur)} />
          <InsightStat label="Average income (last 3 months)" value={fmt(state.projections.avgIncomeLast3, cur)} />
          <InsightStat label="Expected annual savings at this pace" value={fmt(state.projections.expectedAnnualSavings, cur)} />
        </div>
        <h3 className="font-display mt-4 mb-2 font-semibold">Scenario simulator</h3>
        <Field label="If I save extra each month">
          <input aria-label="Extra monthly savings" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="50" value={extraSavings} onChange={(e) => setExtraSavings(e.target.value)} />
        </Field>
        <p className="mt-2 text-sm">
          Saving an extra <strong className="tnum">{fmt(extra, cur)}</strong> a month means projected savings of <strong className="tnum">{fmt(simMonthly, cur)}</strong> per month — <strong className="tnum">{fmt(simMonthly * 12, cur)}</strong> over a year
          {state.goals[0] && state.goals[0].remaining > 0 && simMonthly > 0 ? <>, reaching your “{state.goals[0].name}” goal in about {Math.ceil(state.goals[0].remaining / simMonthly)} month{Math.ceil(state.goals[0].remaining / simMonthly) === 1 ? "" : "s"} at that pace</> : ""}.
        </p>
        <p className="mt-1 text-xs text-[var(--dim)]">Projections use your recorded income, fixed charges and recent spending patterns. They are estimates, clearly separate from your actual balances above.</p>
      </section>
    </div>
  );
}
