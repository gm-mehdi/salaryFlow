"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { CAT_COLORS } from "../../lib/constants";
import { fmt, fmtShort } from "../../lib/format";
import type { State } from "../../lib/types";
import { cardCls, tooltipStyle } from "../../components/ui";

export function DashboardCharts({
  state,
  chartData,
  hasChartData,
}: {
  state: State;
  chartData: Array<{ short: string; income: number; expenses: number; label: string }>;
  hasChartData: boolean;
}) {
  const s = state.summary;
  const cur = state.currency;

  return (
    <>
      {hasChartData && (
        <section className={cardCls} aria-label="Income versus expenses chart">
          <h2 className="font-display mb-3 font-semibold">Income vs expenses</h2>
          <div className="h-52 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="short" tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v ?? 0), cur)} />
                <Bar dataKey="income" name="Income" fill="#0e6b5c" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#e4572e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-[var(--dim)]">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#0e6b5c" }} />Income</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#e4572e" }} />Expenses</span>
          </div>
        </section>
      )}

      {s.categoryStats.length > 0 && (
        <section className={cardCls} aria-label="Spending by category">
          <h2 className="font-display mb-1 font-semibold">Where your money goes</h2>
          <div className="mx-auto h-52 w-full max-w-60" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={s.categoryStats} dataKey="amount" nameKey="category" innerRadius={58} outerRadius={84} paddingAngle={2} strokeWidth={0}>
                  {s.categoryStats.map((c, i) => (
                    <Cell key={c.category} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v ?? 0), cur)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {s.categoryStats.map((c, i) => (
              <li key={c.category} className="flex items-center justify-between py-2 text-sm">
                <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />{c.category}</span>
                <span className="tnum font-medium">{fmt(c.amount, cur)} <span className="text-[var(--dim)]">· {c.pctOfExpenses}%</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
