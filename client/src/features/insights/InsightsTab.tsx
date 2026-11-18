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
import { fmt, fmtShort } from "../../lib/format";
import type { State } from "../../lib/types";
import { IconTrend } from "../../components/icons";
import { EmptyState, InsightStat, cardCls, tooltipStyle } from "../../components/ui";

export function InsightsTab({ state }: { state: State }) {
  const s = state.summary;
  const p = state.prevSummary;
  const cur = state.currency;
  const topCat = s.categoryStats[0];
  const lowCat = s.categoryStats.length > 1 ? s.categoryStats[s.categoryStats.length - 1] : undefined;
  const trendData = state.series.map((m) => ({ ...m, short: m.label.split(" ")[0]?.slice(0, 3) ?? "" }));
  const yearData = state.year.months.map((m) => ({ ...m, short: m.label.split(" ")[0]?.slice(0, 3) ?? "" }));
  const hasTrend = state.series.some((m) => m.income > 0 || m.expenses > 0);

  const compareRows: { label: string; now: number; before: number }[] = [
    { label: "Income", now: s.income, before: p.income },
    { label: "Expenses", now: s.expenses, before: p.expenses },
    { label: "Fixed expenses", now: s.fixedExpenses, before: p.fixedExpenses },
    { label: "Variable expenses", now: s.variableExpenses, before: p.variableExpenses },
    { label: "Savings", now: s.savings, before: p.savings },
  ];

  return (
    <div className="space-y-4">
      <section className={cardCls} aria-label="Key numbers">
        <h2 className="font-display mb-1 flex items-center gap-2 font-semibold"><span className="text-[var(--accent)]"><IconTrend /></span>{state.monthLabel} in numbers</h2>
        <div className="divide-y divide-[var(--border)]">
          <InsightStat label="Total income" value={fmt(s.income, cur)} />
          <InsightStat label="Total expenses" value={fmt(s.expenses, cur)} />
          <InsightStat label="Fixed share of expenses" value={s.expenses > 0 ? `${Math.round((s.fixedExpenses / s.expenses) * 100)}%` : "—"} />
          <InsightStat label="Variable share of expenses" value={s.expenses > 0 ? `${Math.round((s.variableExpenses / s.expenses) * 100)}%` : "—"} />
          <InsightStat label="Savings" value={fmt(s.savings, cur)} />
          <InsightStat label="Savings rate" value={s.income > 0 ? `${s.savedPct}%` : "—"} />
          <InsightStat label="Average daily spending" value={fmt(s.avgDaily, cur)} />
          <InsightStat label="Biggest spending category" value={topCat ? `${topCat.category} · ${fmt(topCat.amount, cur)}` : "—"} />
          <InsightStat label="Smallest spending category" value={lowCat ? `${lowCat.category} · ${fmt(lowCat.amount, cur)}` : "—"} />
          <InsightStat label="Biggest single expense" value={s.biggestExpense ? `${s.biggestExpense.description} · ${fmt(s.biggestExpense.amount, cur)}` : "—"} />
          <InsightStat label="Remaining balance" value={fmt(s.balance, cur)} />
        </div>
      </section>

      <section className={cardCls} aria-label="Observations">
        <h2 className="font-display mb-2 font-semibold">Observations</h2>
        <ul className="space-y-2">
          {state.insights.map((text, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </section>

      <section className={cardCls} aria-label="Month comparison">
        <h2 className="font-display mb-1 font-semibold">This month vs last month</h2>
        <div className="divide-y divide-[var(--border)]">
          {compareRows.map((r) => {
            const delta = r.now - r.before;
            return (
              <div key={r.label} className="flex items-baseline justify-between gap-2 py-2.5 text-sm">
                <span className="text-[var(--dim)]">{r.label}</span>
                <span className="tnum font-semibold">{fmt(r.now, cur)}</span>
                <span className={`tnum w-28 text-right text-xs ${delta === 0 ? "text-[var(--dim)]" : delta > 0 ? "text-[var(--warn)]" : "text-[var(--accent)]"}`}>
                  {delta === 0 ? "no change" : `${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta), cur)}`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {hasTrend && (
        <section className={cardCls} aria-label="Income expenses and savings trend">
          <h2 className="font-display mb-3 font-semibold">Income, expenses & savings trend</h2>
          <div className="h-56 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="short" tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v ?? 0), cur)} />
                <Line type="monotone" dataKey="income" name="Income" stroke="#0e6b5c" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#e4572e" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="savings" name="Savings" stroke="#3e7cb1" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--dim)]">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#0e6b5c" }} />Income</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#e4572e" }} />Expenses</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#3e7cb1" }} />Savings</span>
          </div>

          <h3 className="font-display mt-5 mb-3 font-semibold">Fixed vs variable by month</h3>
          <div className="h-48 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="short" tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v ?? 0), cur)} />
                <Bar dataKey="fixedExpenses" name="Fixed" stackId="e" fill="#3e7cb1" />
                <Bar dataKey="variableExpenses" name="Variable" stackId="e" fill="#e8a33d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className={cardCls} aria-label="Yearly overview">
        <h2 className="font-display mb-1 font-semibold">{state.year.year} overview</h2>
        <div className="grid grid-cols-3 gap-2 py-2 text-center">
          <div><p className="text-xs text-[var(--dim)]">Income</p><p className="tnum font-bold">{fmt(state.year.totalIncome, cur)}</p></div>
          <div><p className="text-xs text-[var(--dim)]">Expenses</p><p className="tnum font-bold">{fmt(state.year.totalExpenses, cur)}</p></div>
          <div><p className="text-xs text-[var(--dim)]">Savings</p><p className="tnum font-bold">{fmt(state.year.totalSavings, cur)}</p></div>
        </div>
        <p className="mb-2 text-center text-sm text-[var(--dim)]">
          All-time leftover savings: <strong className={`tnum ${state.lifetimeSavings < 0 ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>{fmt(state.lifetimeSavings, cur)}</strong>
        </p>
        <div className="h-44 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="short" tick={{ fill: "var(--dim)", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tickFormatter={fmtShort} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v ?? 0), cur)} />
              <Bar dataKey="income" name="Income" fill="#0e6b5c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#e4572e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
