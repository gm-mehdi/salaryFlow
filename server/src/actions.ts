// SalaryFlow actions. Every figure the UI shows is computed here from the
// user's stored rows — no seeded or invented data. A month's expenses are
// variable + fixed expense transactions PLUS amounts actually paid toward
// due fixed expenses (full or partial), each payment counted exactly once.

import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { and, asc, desc, eq } from "drizzle-orm";
import * as schema from "./schema";

// ---------- helpers ----------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function shiftMonth(key: string, delta: number): string {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthLabel(key: string): string {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1] ?? ""} ${y}`;
}

function daysInMonth(key: string): number {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function monthDiff(a: string, b: string): number {
  const [ya = 1970, ma = 1] = a.split("-").map(Number);
  const [yb = 1970, mb = 1] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return round2((part / whole) * 100);
}

type FixedRow = typeof schema.fixedExpenses.$inferSelect;

function dueInMonth(f: FixedRow, month: string): boolean {
  if (monthDiff(f.startMonth, month) < 0) return false;
  if (f.endMonth && month > f.endMonth) return false;
  const diff = monthDiff(f.startMonth, month);
  if (f.frequency === "monthly" || f.frequency === "weekly") return true;
  if (f.frequency === "quarterly") return diff % 3 === 0;
  return diff % 12 === 0; // yearly
}

// Monthly obligation: a weekly charge is counted 4x per month (labelled as such in the UI).
function obligation(f: FixedRow, _month: string): number {
  return f.frequency === "weekly" ? round2(f.amount * 4) : f.amount;
}

function effectiveDate(f: FixedRow, month: string): string {
  const day = Math.min(f.paymentDay, daysInMonth(month));
  return `${month}-${pad(day)}`;
}

interface EffExpense {
  amount: number;
  category: string;
  date: string;
  description: string;
  type: "fixed" | "variable";
}

interface MonthSummary {
  salary: number;
  additionalIncome: number;
  income: number;
  fixedExpenses: number;
  variableExpenses: number;
  expenses: number;
  balance: number;
  savings: number;
  spentPct: number;
  savedPct: number;
  fixedPctOfIncome: number;
  variablePctOfIncome: number;
  avgDaily: number;
  categoryStats: { category: string; amount: number; pctOfExpenses: number }[];
  biggestExpense: { description: string; category: string; amount: number; date: string } | null;
  expenseCount: number;
}

interface AllData {
  txs: (typeof schema.transactions.$inferSelect)[];
  fixed: FixedRow[];
  payments: (typeof schema.fixedPayments.$inferSelect)[];
  budgets: (typeof schema.budgets.$inferSelect)[];
  categories: (typeof schema.categories.$inferSelect)[];
  accounts: (typeof schema.accounts.$inferSelect)[];
  transfers: (typeof schema.transfers.$inferSelect)[];
  goals: (typeof schema.savingsGoals.$inferSelect)[];
  goalEntries: (typeof schema.savingsEntries.$inferSelect)[];
  debts: (typeof schema.debts.$inferSelect)[];
  debtPayments: (typeof schema.debtPayments.$inferSelect)[];
  settingsRow: typeof schema.settings.$inferSelect | null;
}

async function loadAll(ctx: Ctx): Promise<AllData> {
  const db = ctx.db<typeof schema>();
  const [txs, fixed, payments, budgets, categories, accounts, transfers, goals, goalEntries, debts, debtPayments, settingsRows] =
    await Promise.all([
      db.select().from(schema.transactions).orderBy(desc(schema.transactions.date), desc(schema.transactions.id)),
      db.select().from(schema.fixedExpenses).orderBy(asc(schema.fixedExpenses.paymentDay)),
      db.select().from(schema.fixedPayments),
      db.select().from(schema.budgets).orderBy(asc(schema.budgets.category)),
      db.select().from(schema.categories).orderBy(asc(schema.categories.name)),
      db.select().from(schema.accounts).orderBy(asc(schema.accounts.name)),
      db.select().from(schema.transfers).orderBy(desc(schema.transfers.date), desc(schema.transfers.id)),
      db.select().from(schema.savingsGoals).orderBy(asc(schema.savingsGoals.name)),
      db.select().from(schema.savingsEntries).orderBy(desc(schema.savingsEntries.date), desc(schema.savingsEntries.id)),
      db.select().from(schema.debts).orderBy(asc(schema.debts.name)),
      db.select().from(schema.debtPayments).orderBy(desc(schema.debtPayments.date), desc(schema.debtPayments.id)),
      db.select().from(schema.settings),
    ]);
  return { txs, fixed, payments, budgets, categories, accounts, transfers, goals, goalEntries, debts, debtPayments, settingsRow: settingsRows[0] ?? null };
}

function summarize(
  data: AllData,
  month: string,
  salaryCategory: string,
): MonthSummary {
  const monthTxs = data.txs.filter((t) => monthKeyOf(t.date) === month);
  const incomes = monthTxs.filter((t) => t.kind === "income");
  const salary = incomes
    .filter((t) => t.category === salaryCategory)
    .reduce((s, t) => s + t.amount, 0);
  const additionalIncome = incomes
    .filter((t) => t.category !== salaryCategory)
    .reduce((s, t) => s + t.amount, 0);
  const income = salary + additionalIncome;

  const eff: EffExpense[] = [];
  for (const t of monthTxs) {
    if (t.kind !== "expense") continue;
    eff.push({
      amount: t.amount,
      category: t.category,
      date: t.date,
      description: t.description || t.category,
      type: t.expenseType === "fixed" ? "fixed" : "variable",
    });
  }
  // Partial payments: sum every payment row for this expense + month.
  // Legacy rows with amount = null count as the full expense amount.
  const paidByExpense = new Map<number, number>();
  for (const p of data.payments) {
    if (p.month !== month) continue;
    const f = data.fixed.find((x) => x.id === p.fixedExpenseId);
    if (!f) continue;
    const amt = p.amount ?? obligation(f, month);
    paidByExpense.set(p.fixedExpenseId, (paidByExpense.get(p.fixedExpenseId) ?? 0) + amt);
  }
  for (const f of data.fixed) {
    if (!f.active || !dueInMonth(f, month)) continue;
    const paidAmt = paidByExpense.get(f.id) ?? 0;
    if (paidAmt <= 0) continue;
    eff.push({
      amount: round2(Math.min(paidAmt, obligation(f, month))),
      category: f.category,
      date: effectiveDate(f, month),
      description: f.name,
      type: "fixed",
    });
  }

  const fixedExpenses = eff.filter((e) => e.type === "fixed").reduce((s, e) => s + e.amount, 0);
  const variableExpenses = eff.filter((e) => e.type === "variable").reduce((s, e) => s + e.amount, 0);
  const expenses = fixedExpenses + variableExpenses;
  const balance = income - expenses;

  const byCat = new Map<string, number>();
  for (const e of eff) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const categoryStats = [...byCat.entries()]
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      pctOfExpenses: pct(amount, expenses),
    }))
    .sort((a, b) => b.amount - a.amount);

  const biggest = eff.length
    ? eff.reduce((a, b) => (b.amount > a.amount ? b : a))
    : null;

  const now = new Date();
  const isCurrent = month === currentMonthKey(now);
  const elapsedDays = isCurrent ? now.getDate() : daysInMonth(month);

  return {
    salary: round2(salary),
    additionalIncome: round2(additionalIncome),
    income: round2(income),
    fixedExpenses: round2(fixedExpenses),
    variableExpenses: round2(variableExpenses),
    expenses: round2(expenses),
    balance: round2(balance),
    savings: round2(balance),
    spentPct: pct(expenses, income),
    savedPct: pct(balance, income),
    fixedPctOfIncome: pct(fixedExpenses, income),
    variablePctOfIncome: pct(variableExpenses, income),
    avgDaily: round2(expenses / Math.max(1, elapsedDays)),
    categoryStats,
    biggestExpense: biggest
      ? { description: biggest.description, category: biggest.category, amount: round2(biggest.amount), date: biggest.date }
      : null,
    expenseCount: eff.length,
  };
}

function fmtMoney(n: number, currency: string): string {
  const abs = Math.abs(n);
  const str = abs.toLocaleString("en-US", { maximumFractionDigits: abs % 1 === 0 ? 0 : 2 });
  return `${n < 0 ? "−" : ""}${str} ${currency}`;
}

function buildInsights(
  cur: MonthSummary,
  prev: MonthSummary,
  prevMonth: string,
  hasPrevData: boolean,
  currency: string,
): string[] {
  const out: string[] = [];
  if (cur.income === 0 && cur.expenses === 0) {
    out.push("Nothing recorded for this month yet. Add income or an expense and insights will appear here.");
    return out;
  }
  if (cur.income > 0) {
    out.push(`Fixed expenses represent ${cur.fixedPctOfIncome}% of your monthly income.`);
    const top = cur.categoryStats[0];
    if (top) {
      out.push(`You spent ${pct(top.amount, cur.income)}% of your income on ${top.category.toLowerCase()}.`);
    }
  }
  if (cur.savings > 0) {
    out.push(`You saved ${fmtMoney(cur.savings, currency)} this month — a savings rate of ${cur.savedPct}%.`);
  } else if (cur.savings < 0 && cur.income > 0) {
    out.push(`You spent ${fmtMoney(Math.abs(cur.savings), currency)} more than you earned this month.`);
  }
  if (hasPrevData) {
    if (cur.expenses !== prev.expenses && (cur.expenses > 0 || prev.expenses > 0)) {
      const diff = Math.abs(cur.expenses - prev.expenses);
      const dir = cur.expenses < prev.expenses ? "less" : "more";
      out.push(`You spent ${fmtMoney(diff, currency)} ${dir} this month compared to ${monthLabel(prevMonth).split(" ")[0]}.`);
    }
    // Biggest category swing vs last month
    const prevMap = new Map(prev.categoryStats.map((c) => [c.category, c.amount]));
    let best: { cat: string; change: number } | null = null;
    for (const c of cur.categoryStats) {
      const p = prevMap.get(c.category) ?? 0;
      if (p <= 0) continue;
      const change = ((c.amount - p) / p) * 100;
      if (!best || Math.abs(change) > Math.abs(best.change)) best = { cat: c.category, change };
    }
    if (best && Math.abs(best.change) >= 1) {
      const dir = best.change > 0 ? "increased" : "decreased";
      out.push(`Your ${best.cat.toLowerCase()} expenses ${dir} by ${Math.abs(round2(best.change))}% compared to last month.`);
    }
  }
  const third = cur.categoryStats[2];
  if (third) {
    out.push(`Your ${third.category.toLowerCase()} expenses are your third-largest spending category.`);
  }
  if (cur.expenses > 0) {
    out.push(`Your average daily spending this month is ${fmtMoney(cur.avgDaily, currency)}.`);
  }
  if (cur.biggestExpense) {
    out.push(`Your biggest single expense was ${cur.biggestExpense.description} at ${fmtMoney(cur.biggestExpense.amount, currency)}.`);
  }
  return out;
}

// ---------- shared response shapes ----------

const txOut = z.object({
  id: z.number(),
  kind: z.enum(["income", "expense"]),
  expenseType: z.enum(["fixed", "variable"]).nullable(),
  amount: z.number(),
  category: z.string(),
  date: z.string(),
  description: z.string(),
  paymentMethod: z.string(),
  note: z.string(),
  accountId: z.number().nullable(),
  accountName: z.string(),
  recurring: z.boolean(),
  source: z.enum(["transaction", "fixed", "transfer"]),
});

const categoryStat = z.object({
  category: z.string(),
  amount: z.number(),
  pctOfExpenses: z.number(),
});

const summaryOut = z.object({
  salary: z.number(),
  additionalIncome: z.number(),
  income: z.number(),
  fixedExpenses: z.number(),
  variableExpenses: z.number(),
  expenses: z.number(),
  balance: z.number(),
  savings: z.number(),
  spentPct: z.number(),
  savedPct: z.number(),
  fixedPctOfIncome: z.number(),
  variablePctOfIncome: z.number(),
  avgDaily: z.number(),
  categoryStats: z.array(categoryStat),
  biggestExpense: z
    .object({ description: z.string(), category: z.string(), amount: z.number(), date: z.string() })
    .nullable(),
  expenseCount: z.number(),
});

const fixedPaymentOut = z.object({
  id: z.number(),
  amount: z.number(),
  month: z.string(),
});

const fixedOut = z.object({
  id: z.number(),
  name: z.string(),
  amount: z.number(),
  monthlyAmount: z.number(),
  category: z.string(),
  paymentDay: z.number(),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  description: z.string(),
  active: z.boolean(),
  startMonth: z.string(),
  endMonth: z.string().nullable(),
  paymentMethod: z.string(),
  dueThisMonth: z.boolean(),
  paidThisMonth: z.boolean(),
  paidAmount: z.number(),
  remainingAmount: z.number(),
  isPartiallyPaid: z.boolean(),
  status: z.enum(["paid", "partial", "pending", "overdue", "upcoming", "not_due", "inactive"]),
  dueDate: z.string(),
  daysUntilDue: z.number(),
  payments: z.array(fixedPaymentOut),
});

const budgetOut = z.object({
  id: z.number(),
  category: z.string(),
  amount: z.number(),
  spent: z.number(),
  remaining: z.number(),
  pctUsed: z.number(),
  month: z.string().nullable(),
  monthSpecific: z.boolean(),
  warning: z.enum(["ok", "watch75", "warning90", "exceeded"]),
});

const accountOut = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(["cash", "bank", "savings", "other"]),
  openingBalance: z.number(),
  balance: z.number(),
  incomeTotal: z.number(),
  expenseTotal: z.number(),
  transfersIn: z.number(),
  transfersOut: z.number(),
  active: z.boolean(),
});

const transferOut = z.object({
  id: z.number(),
  fromAccountId: z.number(),
  toAccountId: z.number(),
  fromName: z.string(),
  toName: z.string(),
  amount: z.number(),
  date: z.string(),
  note: z.string(),
});

const goalEntryOut = z.object({ id: z.number(), amount: z.number(), date: z.string(), note: z.string() });

const goalOut = z.object({
  id: z.number(),
  name: z.string(),
  targetAmount: z.number(),
  targetDate: z.string().nullable(),
  description: z.string(),
  saved: z.number(),
  remaining: z.number(),
  pct: z.number(),
  monthlyRequired: z.number().nullable(),
  monthsLeft: z.number().nullable(),
  entries: z.array(goalEntryOut),
});

const debtPaymentOut = z.object({ id: z.number(), amount: z.number(), date: z.string(), note: z.string() });

const debtOut = z.object({
  id: z.number(),
  name: z.string(),
  kind: z.enum(["i_owe", "owed_to_me", "loan", "installment"]),
  initialAmount: z.number(),
  monthlyPayment: z.number(),
  dueDay: z.number(),
  interestRate: z.number(),
  startDate: z.string(),
  description: z.string(),
  paidTotal: z.number(),
  remaining: z.number(),
  pctPaid: z.number(),
  payoffDate: z.string().nullable(),
  payments: z.array(debtPaymentOut),
});

const projectionOut = z.object({
  projectedEndBalance: z.number(),
  projectedSavings: z.number(),
  upcomingFixedPending: z.number(),
  avgVariableLast3: z.number(),
  avgIncomeLast3: z.number(),
  expectedAnnualSavings: z.number(),
  totalDebtRemaining: z.number(),
  totalSavingsSaved: z.number(),
  totalSavingsTarget: z.number(),
});

const seriesOut = z.object({
  month: z.string(),
  label: z.string(),
  income: z.number(),
  expenses: z.number(),
  fixedExpenses: z.number(),
  variableExpenses: z.number(),
  savings: z.number(),
});

const stateResponse = z.object({
  currency: z.string(),
  salaryAmount: z.number().nullable(),
  salaryDay: z.number().nullable(),
  salaryCategory: z.string(),
  monthStartDay: z.number(),
  needsSalaryPrompt: z.boolean(),
  month: z.string(),
  monthLabel: z.string(),
  summary: summaryOut,
  prevSummary: summaryOut,
  insights: z.array(z.string()),
  fixed: z.array(fixedOut),
  fixedExpected: z.number(),
  fixedPaid: z.number(),
  fixedPending: z.number(),
  budgets: z.array(budgetOut),
  categories: z.array(z.object({ id: z.number(), name: z.string(), kind: z.enum(["income", "expense"]) })),
  transactions: z.array(txOut),
  transactionTotal: z.number(),
  allMonthTransactions: z.array(txOut),
  accounts: z.array(accountOut),
  totalAccountBalance: z.number(),
  transfers: z.array(transferOut),
  goals: z.array(goalOut),
  debts: z.array(debtOut),
  totalDebtOwed: z.number(),
  totalOwedToMe: z.number(),
  projections: projectionOut,
  compareMonth: z.string().nullable(),
  compareLabel: z.string().nullable(),
  compareSummary: summaryOut.nullable(),
  unpaidBills: z.array(z.object({ name: z.string(), amount: z.number(), dueDate: z.string(), status: z.string() })),
  topExpenses: z.array(z.object({ description: z.string(), category: z.string(), amount: z.number(), date: z.string() })),
  series: z.array(seriesOut),
  year: z.object({
    year: z.number(),
    months: z.array(seriesOut),
    totalIncome: z.number(),
    totalExpenses: z.number(),
    totalSavings: z.number(),
  }),
  /** Sum of (income − expenses) across every month that has data. */
  lifetimeSavings: z.number(),
});

const okResponse = z.object({
  ok: z.boolean(),
  id: z.number().nullable(),
  duplicate: z.boolean(),
  error: z.string().nullable(),
});

type OkOut = z.infer<typeof okResponse>;
const ok = (id: number | null): OkOut => ({ ok: true, id, duplicate: false, error: null });
const fail = (error: string): OkOut => ({ ok: false, id: null, duplicate: false, error });

// ---------- actions ----------

export const Actions = {
  getState: defineAction({
    description: "Returns the full SalaryFlow state for a month: summary, insights, fixed expenses, budgets, transactions, trend series, and yearly overview, all computed from stored records.",
    request: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      filterKind: z.enum(["all", "income", "expense"]).default("all"),
      filterCategory: z.string().default("all"),
      filterType: z.enum(["all", "fixed", "variable"]).default("all"),
      search: z.string().max(120).default(""),
      sortBy: z.enum(["date", "amount_desc", "amount_asc"]).default("date"),
      filterPaymentMethod: z.string().default("all"),
      compareMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().default(null),
    }),
    response: stateResponse,
    async handler(ctx, args): Promise<z.infer<typeof stateResponse>> {
      const data = await loadAll(ctx);
      const currency = data.settingsRow?.currency ?? "MAD";
      const salaryCategory = data.settingsRow?.salaryCategory ?? "Salary";
      const month = args.month;
      const prevMonth = shiftMonth(month, -1);

      const summary = summarize(data, month, salaryCategory);
      const prevSummary = summarize(data, prevMonth, salaryCategory);
      const hasPrevData = prevSummary.income > 0 || prevSummary.expenses > 0;
      const insights = buildInsights(summary, prevSummary, prevMonth, hasPrevData, currency);

      // Fixed expenses for the viewed month — with partial payment totals
      const paymentsForMonth = data.payments.filter((p) => p.month === month);
      const paidByExpense = new Map<number, number>();
      for (const p of paymentsForMonth) {
        const f = data.fixed.find((x) => x.id === p.fixedExpenseId);
        if (!f) continue;
        const amt = p.amount ?? obligation(f, month);
        paidByExpense.set(p.fixedExpenseId, (paidByExpense.get(p.fixedExpenseId) ?? 0) + amt);
      }
      const activeDue = data.fixed.filter((f) => f.active && dueInMonth(f, month));
      const fixedExpected = round2(activeDue.reduce((s2, f) => s2 + obligation(f, month), 0));
      const fixedPaid = round2(
        activeDue.reduce((s2, f) => s2 + Math.min(paidByExpense.get(f.id) ?? 0, obligation(f, month)), 0),
      );
      const todayKey = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
      const fixed = data.fixed.map((f) => {
        const obl = obligation(f, month);
        const rawPaid = paidByExpense.get(f.id) ?? 0;
        const paidAmount = round2(Math.min(rawPaid, obl));
        const remainingAmount = round2(Math.max(0, obl - paidAmount));
        const expensePayments = paymentsForMonth
          .filter((p) => p.fixedExpenseId === f.id)
          .map((p) => ({ id: p.id, amount: round2(p.amount ?? obl), month: p.month }))
          .sort((a, b) => a.id - b.id);
        const dueDate = effectiveDate(f, month);
        const daysUntilDue = Math.round((new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${todayKey}T00:00:00`).getTime()) / 86400000);
        const due = dueInMonth(f, month);
        let status: "paid" | "partial" | "pending" | "overdue" | "upcoming" | "not_due" | "inactive" = "pending";
        if (!f.active) status = "inactive";
        else if (!due) status = "not_due";
        else if (paidAmount >= obl && obl > 0) status = "paid";
        else if (paidAmount > 0) status = dueDate < todayKey && month <= currentMonthKey() ? "overdue" : "partial";
        else if (month < currentMonthKey() || (month === currentMonthKey() && dueDate < todayKey)) status = "overdue";
        else if (daysUntilDue > 7) status = "upcoming";
        else status = "pending";
        return {
          id: f.id,
          name: f.name,
          amount: f.amount,
          monthlyAmount: obl,
          category: f.category,
          paymentDay: f.paymentDay,
          frequency: f.frequency,
          description: f.description,
          active: f.active,
          startMonth: f.startMonth,
          endMonth: f.endMonth ?? null,
          paymentMethod: f.paymentMethod,
          dueThisMonth: due,
          paidThisMonth: paidAmount >= obl && obl > 0,
          paidAmount,
          remainingAmount,
          isPartiallyPaid: paidAmount > 0 && paidAmount < obl,
          status,
          dueDate,
          daysUntilDue,
          payments: expensePayments,
        };
      });

      // Budgets vs this month's spending per category.
      // A month-specific row wins over the every-month template for that category.
      const spentByCat = new Map(summary.categoryStats.map((c) => [c.category, c.amount]));
      const effBudgets = new Map<string, (typeof data.budgets)[number]>();
      for (const b of data.budgets) if (b.month == null) effBudgets.set(b.category, b);
      for (const b of data.budgets) if (b.month === month) effBudgets.set(b.category, b);
      const budgets = [...effBudgets.values()].map((b) => {
        const spent = spentByCat.get(b.category) ?? 0;
        const pctUsed = pct(spent, b.amount);
        return {
          id: b.id,
          category: b.category,
          amount: b.amount,
          spent: round2(spent),
          remaining: round2(b.amount - spent),
          pctUsed,
          month: b.month ?? null,
          monthSpecific: b.month === month,
          warning: (pctUsed > 100 ? "exceeded" : pctUsed >= 90 ? "warning90" : pctUsed >= 75 ? "watch75" : "ok") as "ok" | "watch75" | "warning90" | "exceeded",
        };
      }).sort((a, b) => a.category.localeCompare(b.category));

      // Transaction list: real rows + paid fixed payments as read-only rows
      const acctName = (id: number | null) => data.accounts.find((a) => a.id === id)?.name ?? "";
      const allRows: z.infer<typeof txOut>[] = data.txs.map((t) => ({
        id: t.id,
        kind: t.kind,
        expenseType: t.expenseType,
        amount: t.amount,
        category: t.category,
        date: t.date,
        description: t.description,
        paymentMethod: t.paymentMethod,
        note: t.note,
        accountId: t.accountId ?? null,
        accountName: acctName(t.accountId ?? null),
        recurring: t.recurring,
        source: "transaction" as const,
      }));
      for (const p of data.payments) {
        const f = data.fixed.find((x) => x.id === p.fixedExpenseId);
        if (!f || !dueInMonth(f, p.month)) continue;
        const obl = obligation(f, p.month);
        const payAmt = round2(p.amount ?? obl);
        const monthPayments = data.payments.filter(
          (x) => x.fixedExpenseId === f.id && x.month === p.month,
        );
        const monthTotal = monthPayments.reduce(
          (s2, x) => s2 + (x.amount ?? obl),
          0,
        );
        const isPartial = monthTotal < obl;
        allRows.push({
          id: -p.id,
          kind: "expense",
          expenseType: "fixed",
          amount: payAmt,
          category: f.category,
          date: effectiveDate(f, p.month),
          description: isPartial ? `${f.name} (partial)` : f.name,
          paymentMethod: f.paymentMethod,
          note: isPartial ? `Partial payment — ${fmtMoney(payAmt, currency)} of ${fmtMoney(obl, currency)}` : "",
          accountId: null,
          accountName: "",
          recurring: true,
          source: "fixed",
        });
      }
      // Transfers appear in history but are never income or expenses.
      for (const tr of data.transfers) {
        allRows.push({
          id: -100000 - tr.id,
          kind: "expense",
          expenseType: null,
          amount: tr.amount,
          category: "Transfer",
          date: tr.date,
          description: `Transfer: ${acctName(tr.fromAccountId)} → ${acctName(tr.toAccountId)}`,
          paymentMethod: "transfer",
          note: tr.note,
          accountId: tr.fromAccountId,
          accountName: acctName(tr.fromAccountId),
          recurring: false,
          source: "transfer",
        });
      }
      allRows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));

      const q = args.search.trim().toLowerCase();
      const monthRows = allRows.filter((r) => monthKeyOf(r.date) === month);
      const filtered = monthRows.filter((r) => {
        if (args.filterKind !== "all" && r.kind !== args.filterKind) return false;
        if (args.filterCategory !== "all" && r.category !== args.filterCategory) return false;
        if (args.filterType !== "all" && r.kind === "expense" && r.expenseType !== args.filterType) return false;
        if (args.filterPaymentMethod !== "all" && r.paymentMethod !== args.filterPaymentMethod) return false;
        if (q && !`${r.description} ${r.category} ${r.note}`.toLowerCase().includes(q)) return false;
        return true;
      });
      if (args.sortBy === "amount_desc") filtered.sort((a, b) => b.amount - a.amount);
      else if (args.sortBy === "amount_asc") filtered.sort((a, b) => a.amount - b.amount);

      // Trend series: earliest data month .. current month, last 12
      const dataMonths = [
        ...data.txs.map((t) => monthKeyOf(t.date)),
        ...data.payments.map((p) => p.month),
      ].sort();
      const start = dataMonths[0] ?? currentMonthKey();
      const end = currentMonthKey();
      const span: string[] = [];
      let cursor = start;
      while (cursor <= end && span.length < 60) {
        span.push(cursor);
        cursor = shiftMonth(cursor, 1);
      }
      const seriesMonths = span.slice(-12);
      const series = seriesMonths.map((m) => {
        const s = summarize(data, m, salaryCategory);
        return {
          month: m,
          label: monthLabel(m),
          income: s.income,
          expenses: s.expenses,
          fixedExpenses: s.fixedExpenses,
          variableExpenses: s.variableExpenses,
          savings: s.savings,
        };
      });

      // All-time leftover savings: sum of (income − expenses) for every month in the data span.
      const lifetimeSavings = round2(
        span.reduce((acc, m) => acc + summarize(data, m, salaryCategory).savings, 0),
      );

      // Yearly overview for the viewed month's year
      const yearNum = Number(month.slice(0, 4));
      const yearMonths = Array.from({ length: 12 }, (_, i) => `${yearNum}-${pad(i + 1)}`);
      const yearSeries = yearMonths.map((m) => {
        const s = summarize(data, m, salaryCategory);
        return {
          month: m,
          label: monthLabel(m),
          income: s.income,
          expenses: s.expenses,
          fixedExpenses: s.fixedExpenses,
          variableExpenses: s.variableExpenses,
          savings: s.savings,
        };
      });

      // Salary prompt: salary configured but not yet recorded this (current) month
      const cur = currentMonthKey();
      const needsSalaryPrompt =
        data.settingsRow?.salaryAmount != null &&
        !data.txs.some(
          (t) => t.kind === "income" && t.category === salaryCategory && monthKeyOf(t.date) === cur,
        );

      // ---- Accounts: balance = opening + assigned income − assigned expenses + transfers in − out (all time) ----
      const accountsOut = data.accounts.map((a) => {
        const inc = data.txs.filter((t) => t.accountId === a.id && t.kind === "income").reduce((s2, t) => s2 + t.amount, 0);
        const exp = data.txs.filter((t) => t.accountId === a.id && t.kind === "expense").reduce((s2, t) => s2 + t.amount, 0);
        const tIn = data.transfers.filter((t) => t.toAccountId === a.id).reduce((s2, t) => s2 + t.amount, 0);
        const tOut = data.transfers.filter((t) => t.fromAccountId === a.id).reduce((s2, t) => s2 + t.amount, 0);
        return {
          id: a.id, name: a.name, type: a.type, openingBalance: round2(a.openingBalance),
          balance: round2(a.openingBalance + inc - exp + tIn - tOut),
          incomeTotal: round2(inc), expenseTotal: round2(exp),
          transfersIn: round2(tIn), transfersOut: round2(tOut), active: a.active,
        };
      });
      const totalAccountBalance = round2(accountsOut.reduce((s2, a) => s2 + a.balance, 0));

      const transfersOut = data.transfers.map((t) => ({
        id: t.id, fromAccountId: t.fromAccountId, toAccountId: t.toAccountId,
        fromName: acctName(t.fromAccountId), toName: acctName(t.toAccountId),
        amount: round2(t.amount), date: t.date, note: t.note,
      }));

      // ---- Savings goals ----
      const nowD = new Date();
      const goalsOut = data.goals.map((g) => {
        const entries = data.goalEntries.filter((e) => e.goalId === g.id);
        const saved = round2(entries.reduce((s2, e) => s2 + e.amount, 0));
        const remaining = round2(Math.max(0, g.targetAmount - saved));
        let monthsLeft: number | null = null;
        let monthlyRequired: number | null = null;
        if (g.targetDate) {
          const td = new Date(`${g.targetDate}T00:00:00`);
          monthsLeft = Math.max(0, (td.getFullYear() - nowD.getFullYear()) * 12 + (td.getMonth() - nowD.getMonth()));
          monthlyRequired = monthsLeft > 0 ? round2(remaining / monthsLeft) : remaining;
        }
        return {
          id: g.id, name: g.name, targetAmount: round2(g.targetAmount), targetDate: g.targetDate ?? null,
          description: g.description, saved, remaining,
          pct: g.targetAmount > 0 ? round2(Math.min(100, (saved / g.targetAmount) * 100)) : 0,
          monthlyRequired, monthsLeft,
          entries: entries.map((e) => ({ id: e.id, amount: round2(e.amount), date: e.date, note: e.note })),
        };
      });

      // ---- Debts ----
      const debtsOut = data.debts.map((d) => {
        const pays = data.debtPayments.filter((x) => x.debtId === d.id);
        const paidTotal = round2(pays.reduce((s2, x) => s2 + x.amount, 0));
        const remaining = round2(Math.max(0, d.initialAmount - paidTotal));
        let payoffDate: string | null = null;
        if (remaining > 0 && d.monthlyPayment > 0) {
          const n = Math.ceil(remaining / d.monthlyPayment);
          payoffDate = shiftMonth(currentMonthKey(), n);
        } else if (remaining <= 0) payoffDate = currentMonthKey();
        return {
          id: d.id, name: d.name, kind: d.kind, initialAmount: round2(d.initialAmount),
          monthlyPayment: round2(d.monthlyPayment), dueDay: d.dueDay, interestRate: d.interestRate,
          startDate: d.startDate, description: d.description, paidTotal, remaining,
          pctPaid: d.initialAmount > 0 ? round2((paidTotal / d.initialAmount) * 100) : 0,
          payoffDate,
          payments: pays.map((x) => ({ id: x.id, amount: round2(x.amount), date: x.date, note: x.note })),
        };
      });
      const totalDebtOwed = round2(debtsOut.filter((d) => d.kind !== "owed_to_me").reduce((s2, d) => s2 + d.remaining, 0));
      const totalOwedToMe = round2(debtsOut.filter((d) => d.kind === "owed_to_me").reduce((s2, d) => s2 + d.remaining, 0));

      // ---- Projections (clearly estimates, from actual history) ----
      const last3 = [shiftMonth(month, -1), shiftMonth(month, -2), shiftMonth(month, -3)].map((m) => summarize(data, m, salaryCategory));
      const avgVariableLast3 = round2(last3.reduce((s2, x) => s2 + x.variableExpenses, 0) / 3);
      const avgIncomeLast3 = round2(last3.reduce((s2, x) => s2 + x.income, 0) / 3);
      const baseIncome = summary.income > 0 ? summary.income : (data.settingsRow?.salaryAmount ?? avgIncomeLast3);
      const projectedSavings = round2(baseIncome - fixedExpected - (summary.variableExpenses > 0 ? summary.variableExpenses : avgVariableLast3));
      const projections = {
        projectedEndBalance: round2(summary.balance - round2(fixedExpected - fixedPaid) - (month === currentMonthKey() ? 0 : 0)),
        projectedSavings,
        upcomingFixedPending: round2(fixedExpected - fixedPaid),
        avgVariableLast3,
        avgIncomeLast3,
        expectedAnnualSavings: round2(projectedSavings * 12),
        totalDebtRemaining: totalDebtOwed,
        totalSavingsSaved: round2(goalsOut.reduce((s2, g) => s2 + g.saved, 0)),
        totalSavingsTarget: round2(goalsOut.reduce((s2, g) => s2 + g.targetAmount, 0)),
      };

      const compareSummary = args.compareMonth ? summarize(data, args.compareMonth, salaryCategory) : null;

      // Extra data-driven insights from budgets, bills, debts and goals
      for (const b of budgets) {
        if (b.warning === "exceeded") insights.push(`Your ${b.category.toLowerCase()} budget is exceeded by ${fmtMoney(Math.abs(b.remaining), currency)}.`);
        else if (b.warning === "warning90") insights.push(`You have used ${b.pctUsed}% of your ${b.category.toLowerCase()} budget — only ${fmtMoney(b.remaining, currency)} left.`);
        else if (b.warning === "watch75") insights.push(`You have used ${b.pctUsed}% of your ${b.category.toLowerCase()} budget.`);
      }
      const overdueCount = fixed.filter((f) => f.status === "overdue").length;
      if (overdueCount > 0) insights.push(`You have ${overdueCount} overdue fixed charge${overdueCount === 1 ? "" : "s"} in ${monthLabel(month)}.`);
      const dueSoon = fixed.filter((f) => f.dueThisMonth && f.active && f.remainingAmount > 0 && f.daysUntilDue >= 0 && f.daysUntilDue <= 5);
      for (const f of dueSoon) insights.push(`${f.name} (${fmtMoney(f.remainingAmount, currency)}) is due ${f.daysUntilDue === 0 ? "today" : `in ${f.daysUntilDue} day${f.daysUntilDue === 1 ? "" : "s"}`}.`);
      if (totalDebtOwed > 0) insights.push(`Your outstanding debts total ${fmtMoney(totalDebtOwed, currency)}.`);
      if (projections.totalSavingsSaved > 0) insights.push(`You have saved ${fmtMoney(projections.totalSavingsSaved, currency)} toward your savings goals so far.`);

      const unpaidBills = fixed
        .filter((f) => f.dueThisMonth && f.active && f.remainingAmount > 0)
        .map((f) => ({ name: f.name, amount: f.remainingAmount, dueDate: f.dueDate, status: f.status }));

      // Top individual expenses this month (real transactions + fixed payments)
      const topExpenses = monthRows
        .filter((r) => r.kind === "expense" && r.source !== "transfer")
        .slice()
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map((r) => ({ description: r.description || r.category, category: r.category, amount: round2(r.amount), date: r.date }));

      return {
        currency,
        salaryAmount: data.settingsRow?.salaryAmount ?? null,
        salaryDay: data.settingsRow?.salaryDay ?? null,
        salaryCategory,
        monthStartDay: data.settingsRow?.monthStartDay ?? 1,
        needsSalaryPrompt,
        month,
        monthLabel: monthLabel(month),
        summary,
        prevSummary,
        insights,
        fixed,
        fixedExpected,
        fixedPaid,
        fixedPending: round2(fixedExpected - fixedPaid),
        budgets,
        categories: data.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
        transactions: filtered.slice(0, 200),
        transactionTotal: filtered.length,
        allMonthTransactions: monthRows.slice(0, 400),
        accounts: accountsOut,
        totalAccountBalance,
        transfers: transfersOut,
        goals: goalsOut,
        debts: debtsOut,
        totalDebtOwed,
        totalOwedToMe,
        projections,
        compareMonth: args.compareMonth ?? null,
        compareLabel: args.compareMonth ? monthLabel(args.compareMonth) : null,
        compareSummary,
        unpaidBills,
        topExpenses,
        series,
        year: {
          year: yearNum,
          months: yearSeries,
          totalIncome: round2(yearSeries.reduce((s, m) => s + m.income, 0)),
          totalExpenses: round2(yearSeries.reduce((s, m) => s + m.expenses, 0)),
          totalSavings: round2(yearSeries.reduce((s, m) => s + m.savings, 0)),
        },
        lifetimeSavings,
      };
    },
  }),

  addTransaction: defineAction({
    description: "Adds an income or expense transaction, flagging an exact duplicate instead of saving it unless forced.",
    request: z.object({
      kind: z.enum(["income", "expense"]),
      expenseType: z.enum(["fixed", "variable"]).nullable().default(null),
      amount: z.number().positive().max(1_000_000_000),
      category: z.string().min(1).max(60),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      description: z.string().max(200).default(""),
      paymentMethod: z.string().max(40).default("cash"),
      note: z.string().max(500).default(""),
      accountId: z.number().int().positive().nullable().default(null),
      recurring: z.boolean().default(false),
      force: z.boolean().default(false),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      if (!args.force) {
        const existing = await db.select().from(schema.transactions);
        const dup = existing.some(
          (t) =>
            t.kind === args.kind &&
            t.amount === args.amount &&
            t.category === args.category &&
            t.date === args.date &&
            t.description === args.description,
        );
        if (dup) return { ok: false, id: null, duplicate: true, error: "This looks like a duplicate transaction." };
      }
      const [row] = await db
        .insert(schema.transactions)
        .values({
          kind: args.kind,
          expenseType: args.kind === "expense" ? (args.expenseType ?? "variable") : null,
          amount: args.amount,
          category: args.category,
          date: args.date,
          description: args.description,
          paymentMethod: args.paymentMethod,
          note: args.note,
          accountId: args.accountId,
          recurring: args.recurring,
        })
        .returning({ id: schema.transactions.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  updateTransaction: defineAction({
    description: "Edits an existing income or expense transaction.",
    request: z.object({
      id: z.number().int().positive(),
      amount: z.number().positive().max(1_000_000_000),
      category: z.string().min(1).max(60),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      description: z.string().max(200).default(""),
      paymentMethod: z.string().max(40).default("cash"),
      note: z.string().max(500).default(""),
      expenseType: z.enum(["fixed", "variable"]).nullable().default(null),
      accountId: z.number().int().positive().nullable().default(null),
      recurring: z.boolean().default(false),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.transactions).where(eq(schema.transactions.id, args.id));
      const existing = rows[0];
      if (!existing) return fail("Transaction not found.");
      await db
        .update(schema.transactions)
        .set({
          amount: args.amount,
          category: args.category,
          date: args.date,
          description: args.description,
          paymentMethod: args.paymentMethod,
          note: args.note,
          accountId: args.accountId,
          recurring: args.recurring,
          expenseType: existing.kind === "expense" ? (args.expenseType ?? existing.expenseType ?? "variable") : null,
        })
        .where(eq(schema.transactions.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  deleteTransaction: defineAction({
    description: "Deletes one transaction by id.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.transactions).where(eq(schema.transactions.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  addSalaryForMonth: defineAction({
    description: "Records the configured monthly salary as income for the given month, refusing to duplicate it.",
    request: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      const [s] = await db.select().from(schema.settings);
      if (!s || s.salaryAmount == null) return fail("Set your salary amount in Settings first.");
      const exists = (await db.select().from(schema.transactions)).some(
        (t) => t.kind === "income" && t.category === s.salaryCategory && monthKeyOf(t.date) === args.month,
      );
      if (exists) return fail("Salary is already recorded for this month.");
      const day = Math.min(s.salaryDay ?? 1, daysInMonth(args.month));
      const [row] = await db
        .insert(schema.transactions)
        .values({
          kind: "income",
          expenseType: null,
          amount: s.salaryAmount,
          category: s.salaryCategory,
          date: `${args.month}-${pad(day)}`,
          description: "Monthly salary",
          paymentMethod: "bank transfer",
          note: "",
        })
        .returning({ id: schema.transactions.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  upsertFixedExpense: defineAction({
    description: "Creates or edits a recurring fixed expense (rent, subscriptions, bills).",
    request: z.object({
      id: z.number().int().positive().nullable().default(null),
      name: z.string().min(1).max(80),
      amount: z.number().positive().max(1_000_000_000),
      category: z.string().min(1).max(60),
      paymentDay: z.number().int().min(1).max(31),
      frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
      description: z.string().max(300).default(""),
      active: z.boolean().default(true),
      startMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().default(null),
      endMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().default(null),
      paymentMethod: z.string().max(40).default("bank transfer"),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      if (args.id) {
        await db
          .update(schema.fixedExpenses)
          .set({
            name: args.name,
            amount: args.amount,
            category: args.category,
            paymentDay: args.paymentDay,
            frequency: args.frequency,
            description: args.description,
            active: args.active,
            endMonth: args.endMonth,
            paymentMethod: args.paymentMethod,
            ...(args.startMonth ? { startMonth: args.startMonth } : {}),
          })
          .where(eq(schema.fixedExpenses.id, args.id));
        ctx.invalidateQueries();
        return ok(args.id);
      }
      const [row] = await db
        .insert(schema.fixedExpenses)
        .values({
          name: args.name,
          amount: args.amount,
          category: args.category,
          paymentDay: args.paymentDay,
          frequency: args.frequency,
          description: args.description,
          active: args.active,
          startMonth: args.startMonth ?? currentMonthKey(),
          endMonth: args.endMonth,
          paymentMethod: args.paymentMethod,
        })
        .returning({ id: schema.fixedExpenses.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  deleteFixedExpense: defineAction({
    description: "Deletes a fixed expense and its payment history.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.fixedPayments).where(eq(schema.fixedPayments.fixedExpenseId, args.id));
      await db.delete(schema.fixedExpenses).where(eq(schema.fixedExpenses.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  toggleFixedPayment: defineAction({
    description: "Marks a fixed expense fully paid or unpaid for a month. Paying inserts one payment for the remaining amount; unpaying removes all payments for that month so it never double-counts.",
    request: z.object({
      fixedExpenseId: z.number().int().positive(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      paid: z.boolean(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      const [f] = await db.select().from(schema.fixedExpenses).where(eq(schema.fixedExpenses.id, args.fixedExpenseId));
      if (!f) return fail("Fixed expense not found.");
      if (args.paid) {
        if (!dueInMonth(f, args.month)) return fail("This expense is not due in that month.");
        const existing = await db
          .select()
          .from(schema.fixedPayments)
          .where(and(eq(schema.fixedPayments.fixedExpenseId, args.fixedExpenseId), eq(schema.fixedPayments.month, args.month)));
        const alreadyPaid = existing.reduce((s2, p) => s2 + (p.amount ?? obligation(f, args.month)), 0);
        const remaining = round2(obligation(f, args.month) - alreadyPaid);
        if (remaining <= 0) return ok(args.fixedExpenseId);
        await db
          .insert(schema.fixedPayments)
          .values({ fixedExpenseId: args.fixedExpenseId, month: args.month, amount: remaining });
      } else {
        await db
          .delete(schema.fixedPayments)
          .where(and(eq(schema.fixedPayments.fixedExpenseId, args.fixedExpenseId), eq(schema.fixedPayments.month, args.month)));
      }
      ctx.invalidateQueries();
      return ok(args.fixedExpenseId);
    },
  }),

  recordFixedPayment: defineAction({
    description: "Records a partial payment toward a fixed expense for a month, e.g. 100 MAD toward a 700 MAD expense leaving 600 MAD remaining. Only the amount paid counts in monthly totals.",
    request: z.object({
      fixedExpenseId: z.number().int().positive(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      amount: z.number().positive().max(1_000_000_000),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      const [f] = await db.select().from(schema.fixedExpenses).where(eq(schema.fixedExpenses.id, args.fixedExpenseId));
      if (!f) return fail("Fixed expense not found.");
      if (!dueInMonth(f, args.month)) return fail("This expense is not due in that month.");
      const existing = await db
        .select()
        .from(schema.fixedPayments)
        .where(and(eq(schema.fixedPayments.fixedExpenseId, args.fixedExpenseId), eq(schema.fixedPayments.month, args.month)));
      const alreadyPaid = round2(existing.reduce((s2, p) => s2 + (p.amount ?? obligation(f, args.month)), 0));
      const remaining = round2(obligation(f, args.month) - alreadyPaid);
      if (remaining <= 0) return fail("This expense is already fully paid for this month.");
      if (args.amount > remaining) {
        return fail(`That is more than the ${remaining} remaining. Enter ${remaining} or less.`);
      }
      const [row] = await db
        .insert(schema.fixedPayments)
        .values({ fixedExpenseId: args.fixedExpenseId, month: args.month, amount: round2(args.amount) })
        .returning({ id: schema.fixedPayments.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  deleteFixedPayment: defineAction({
    description: "Removes one partial or full payment record for a fixed expense, reducing the paid amount for that month.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.fixedPayments).where(eq(schema.fixedPayments.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  upsertBudget: defineAction({
    description: "Creates or updates the budget for one expense category, either for every month (month null) or for one specific month.",
    request: z.object({
      category: z.string().min(1).max(60),
      amount: z.number().positive().max(1_000_000_000),
      month: z.string().regex(/^\d{4}-\d{2}$/).nullable().default(null),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      const all = await db.select().from(schema.budgets);
      const existing = all.find((b) => b.category === args.category && (b.month ?? null) === (args.month ?? null));
      if (existing) {
        await db.update(schema.budgets).set({ amount: args.amount }).where(eq(schema.budgets.id, existing.id));
        ctx.invalidateQueries();
        return ok(existing.id);
      }
      const [row] = await db
        .insert(schema.budgets)
        .values({ category: args.category, amount: args.amount, month: args.month })
        .returning({ id: schema.budgets.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  copyBudgetsFromPreviousMonth: defineAction({
    description: "Copies the previous month's effective budgets into the given month as month-specific budgets, skipping categories that already have one.",
    request: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      const data = await loadAll(ctx);
      const prev = shiftMonth(args.month, -1);
      const eff = new Map<string, number>();
      for (const b of data.budgets) if (b.month == null) eff.set(b.category, b.amount);
      for (const b of data.budgets) if (b.month === prev) eff.set(b.category, b.amount);
      let copied = 0;
      for (const [category, amount] of eff) {
        if (data.budgets.some((b) => b.category === category && b.month === args.month)) continue;
        await db.insert(schema.budgets).values({ category, amount, month: args.month });
        copied++;
      }
      ctx.invalidateQueries();
      return ok(copied);
    },
  }),

  deleteBudget: defineAction({
    description: "Removes the budget for one category.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.budgets).where(eq(schema.budgets.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  upsertCategory: defineAction({
    description: "Adds a custom income or expense category (ignored if it already exists).",
    request: z.object({
      name: z.string().min(1).max(60),
      kind: z.enum(["income", "expense"]),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.insert(schema.categories).values({ name: args.name, kind: args.kind }).onConflictDoNothing();
      ctx.invalidateQueries();
      return ok(null);
    },
  }),

  deleteCategory: defineAction({
    description: "Removes a custom category; existing transactions keep their category name.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.categories).where(eq(schema.categories.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  saveSettings: defineAction({
    description: "Saves currency, monthly salary amount, salary payment day, and salary category.",
    request: z.object({
      currency: z.string().min(1).max(8),
      salaryAmount: z.number().positive().max(1_000_000_000).nullable(),
      salaryDay: z.number().int().min(1).max(31).nullable(),
      salaryCategory: z.string().min(1).max(60),
      monthStartDay: z.number().int().min(1).max(28).default(1),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db
        .insert(schema.settings)
        .values({
          id: 1,
          currency: args.currency,
          salaryAmount: args.salaryAmount,
          salaryDay: args.salaryDay,
          salaryCategory: args.salaryCategory,
          monthStartDay: args.monthStartDay,
        })
        .onConflictDoUpdate({
          target: schema.settings.id,
          set: {
            currency: args.currency,
            salaryAmount: args.salaryAmount,
            salaryDay: args.salaryDay,
            salaryCategory: args.salaryCategory,
            monthStartDay: args.monthStartDay,
          },
        });
      ctx.invalidateQueries();
      return ok(1);
    },
  }),


  upsertAccount: defineAction({
    description: "Creates or edits a financial account (cash, bank, savings, other) with an opening balance.",
    request: z.object({
      id: z.number().int().positive().nullable().default(null),
      name: z.string().min(1).max(60),
      type: z.enum(["cash", "bank", "savings", "other"]).default("bank"),
      openingBalance: z.number().min(-1_000_000_000).max(1_000_000_000).default(0),
      active: z.boolean().default(true),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      if (args.id) {
        await db.update(schema.accounts).set({ name: args.name, type: args.type, openingBalance: args.openingBalance, active: args.active }).where(eq(schema.accounts.id, args.id));
        ctx.invalidateQueries();
        return ok(args.id);
      }
      const [row] = await db.insert(schema.accounts).values({ name: args.name, type: args.type, openingBalance: args.openingBalance, active: args.active }).returning({ id: schema.accounts.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  deleteAccount: defineAction({
    description: "Deletes an account and its transfers; transactions keep their data but lose the account link.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      const allTr = await db.select().from(schema.transfers);
      for (const t of allTr) if (t.fromAccountId === args.id || t.toAccountId === args.id) await db.delete(schema.transfers).where(eq(schema.transfers.id, t.id));
      const allTx = await db.select().from(schema.transactions);
      for (const t of allTx) if (t.accountId === args.id) await db.update(schema.transactions).set({ accountId: null }).where(eq(schema.transactions.id, t.id));
      await db.delete(schema.accounts).where(eq(schema.accounts.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  addTransfer: defineAction({
    description: "Records a transfer between two of the user's own accounts. Transfers are never counted as income or expenses.",
    request: z.object({
      fromAccountId: z.number().int().positive(),
      toAccountId: z.number().int().positive(),
      amount: z.number().positive().max(1_000_000_000),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().max(300).default(""),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      if (args.fromAccountId === args.toAccountId) return fail("Choose two different accounts.");
      const db = ctx.db<typeof schema>();
      const [row] = await db.insert(schema.transfers).values({ fromAccountId: args.fromAccountId, toAccountId: args.toAccountId, amount: round2(args.amount), date: args.date, note: args.note }).returning({ id: schema.transfers.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  deleteTransfer: defineAction({
    description: "Deletes one account transfer.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.transfers).where(eq(schema.transfers.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  upsertGoal: defineAction({
    description: "Creates or edits a savings goal with a target amount and optional target date.",
    request: z.object({
      id: z.number().int().positive().nullable().default(null),
      name: z.string().min(1).max(80),
      targetAmount: z.number().positive().max(1_000_000_000),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
      description: z.string().max(300).default(""),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      if (args.id) {
        await db.update(schema.savingsGoals).set({ name: args.name, targetAmount: args.targetAmount, targetDate: args.targetDate, description: args.description }).where(eq(schema.savingsGoals.id, args.id));
        ctx.invalidateQueries();
        return ok(args.id);
      }
      const [row] = await db.insert(schema.savingsGoals).values({ name: args.name, targetAmount: args.targetAmount, targetDate: args.targetDate, description: args.description }).returning({ id: schema.savingsGoals.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  deleteGoal: defineAction({
    description: "Deletes a savings goal and its contributions.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.savingsEntries).where(eq(schema.savingsEntries.goalId, args.id));
      await db.delete(schema.savingsGoals).where(eq(schema.savingsGoals.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  addGoalEntry: defineAction({
    description: "Adds a savings contribution (positive) or withdrawal (negative) to a goal. Savings movements are not expenses.",
    request: z.object({
      goalId: z.number().int().positive(),
      amount: z.number().refine((v) => v !== 0, "Amount cannot be zero.").refine((v) => Math.abs(v) <= 1_000_000_000, "Too large."),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().max(300).default(""),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      const [row] = await db.insert(schema.savingsEntries).values({ goalId: args.goalId, amount: round2(args.amount), date: args.date, note: args.note }).returning({ id: schema.savingsEntries.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  deleteGoalEntry: defineAction({
    description: "Deletes one savings contribution or withdrawal.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.savingsEntries).where(eq(schema.savingsEntries.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  upsertDebt: defineAction({
    description: "Creates or edits a debt, loan, installment, or amount owed to the user.",
    request: z.object({
      id: z.number().int().positive().nullable().default(null),
      name: z.string().min(1).max(80),
      kind: z.enum(["i_owe", "owed_to_me", "loan", "installment"]).default("i_owe"),
      initialAmount: z.number().positive().max(1_000_000_000),
      monthlyPayment: z.number().min(0).max(1_000_000_000).default(0),
      dueDay: z.number().int().min(1).max(31).default(1),
      interestRate: z.number().min(0).max(100).default(0),
      startDate: z.string().max(10).default(""),
      description: z.string().max(300).default(""),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      const vals = { name: args.name, kind: args.kind, initialAmount: args.initialAmount, monthlyPayment: args.monthlyPayment, dueDay: args.dueDay, interestRate: args.interestRate, startDate: args.startDate, description: args.description };
      if (args.id) {
        await db.update(schema.debts).set(vals).where(eq(schema.debts.id, args.id));
        ctx.invalidateQueries();
        return ok(args.id);
      }
      const [row] = await db.insert(schema.debts).values(vals).returning({ id: schema.debts.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  deleteDebt: defineAction({
    description: "Deletes a debt and its payment history.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.debtPayments).where(eq(schema.debtPayments.debtId, args.id));
      await db.delete(schema.debts).where(eq(schema.debts.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  addDebtPayment: defineAction({
    description: "Records a payment toward a debt, reducing its remaining balance.",
    request: z.object({
      debtId: z.number().int().positive(),
      amount: z.number().positive().max(1_000_000_000),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().max(300).default(""),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      const [row] = await db.insert(schema.debtPayments).values({ debtId: args.debtId, amount: round2(args.amount), date: args.date, note: args.note }).returning({ id: schema.debtPayments.id });
      ctx.invalidateQueries();
      return ok(row?.id ?? null);
    },
  }),

  deleteDebtPayment: defineAction({
    description: "Deletes one debt payment.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.debtPayments).where(eq(schema.debtPayments.id, args.id));
      ctx.invalidateQueries();
      return ok(args.id);
    },
  }),

  exportBackup: defineAction({
    description: "Exports the complete financial database as a JSON backup that can be restored later.",
    request: z.object({}),
    response: z.object({ json: z.string(), filename: z.string() }),
    async handler(ctx) {
      const data = await loadAll(ctx);
      const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        settings: data.settingsRow,
        transactions: data.txs,
        fixedExpenses: data.fixed,
        fixedPayments: data.payments,
        budgets: data.budgets,
        categories: data.categories,
        accounts: data.accounts,
        transfers: data.transfers,
        savingsGoals: data.goals,
        savingsEntries: data.goalEntries,
        debts: data.debts,
        debtPayments: data.debtPayments,
      };
      return { json: JSON.stringify(payload, null, 2), filename: `salaryflow-backup-${currentMonthKey()}.json` };
    },
  }),

  importBackup: defineAction({
    description: "Restores a complete JSON backup, replacing all current data. Validates the backup shape before touching anything.",
    request: z.object({ json: z.string().min(2).max(20_000_000) }),
    response: okResponse,
    async handler(ctx, args): Promise<OkOut> {
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(args.json) as Record<string, unknown>; } catch { return fail("That file is not valid JSON."); }
      if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.fixedExpenses)) return fail("That does not look like a SalaryFlow backup.");
      const db = ctx.db<typeof schema>();
      const arr = (k: string) => (Array.isArray(parsed[k]) ? (parsed[k] as Record<string, unknown>[]) : []);
      await db.delete(schema.fixedPayments);
      await db.delete(schema.savingsEntries);
      await db.delete(schema.debtPayments);
      await db.delete(schema.transfers);
      await db.delete(schema.transactions);
      await db.delete(schema.fixedExpenses);
      await db.delete(schema.savingsGoals);
      await db.delete(schema.debts);
      await db.delete(schema.accounts);
      await db.delete(schema.budgets);
      await db.delete(schema.categories);
      await db.delete(schema.settings);
      const st = parsed.settings as Record<string, unknown> | null;
      if (st) await db.insert(schema.settings).values({ id: 1, currency: String(st.currency ?? "MAD"), salaryAmount: (st.salaryAmount as number) ?? null, salaryDay: (st.salaryDay as number) ?? null, salaryCategory: String(st.salaryCategory ?? "Salary"), monthStartDay: Number(st.monthStartDay ?? 1) });
      for (const t of arr("transactions")) await db.insert(schema.transactions).values({ kind: t.kind as "income" | "expense", expenseType: (t.expenseType as "fixed" | "variable") ?? null, amount: Number(t.amount), category: String(t.category), date: String(t.date), description: String(t.description ?? ""), paymentMethod: String(t.paymentMethod ?? "cash"), note: String(t.note ?? ""), accountId: (t.accountId as number) ?? null, recurring: Boolean(t.recurring) });
      for (const f of arr("fixedExpenses")) await db.insert(schema.fixedExpenses).values({ name: String(f.name), amount: Number(f.amount), category: String(f.category), paymentDay: Number(f.paymentDay), frequency: (f.frequency as "weekly" | "monthly" | "quarterly" | "yearly") ?? "monthly", description: String(f.description ?? ""), active: f.active !== false, startMonth: String(f.startMonth ?? currentMonthKey()), endMonth: (f.endMonth as string) ?? null, paymentMethod: String(f.paymentMethod ?? "bank transfer") });
      // Rebuild fixed payments against new ids by matching expense name+month is unreliable; restore by original order mapping using names
      const newFixed = await db.select().from(schema.fixedExpenses);
      const oldFixed = arr("fixedExpenses");
      const idMap = new Map<number, number>();
      oldFixed.forEach((f, i) => { const nf = newFixed.find((x) => x.name === String(f.name)); if (nf) idMap.set(Number(f.id), nf.id); void i; });
      for (const p of arr("fixedPayments")) { const nid = idMap.get(Number(p.fixedExpenseId)); if (nid) await db.insert(schema.fixedPayments).values({ fixedExpenseId: nid, month: String(p.month), amount: (p.amount as number) ?? null }); }
      for (const b of arr("budgets")) await db.insert(schema.budgets).values({ category: String(b.category), amount: Number(b.amount), month: (b.month as string) ?? null });
      for (const c of arr("categories")) await db.insert(schema.categories).values({ name: String(c.name), kind: (c.kind as "income" | "expense") ?? "expense" }).onConflictDoNothing();
      const accIdMap = new Map<number, number>();
      for (const a of arr("accounts")) { const [row] = await db.insert(schema.accounts).values({ name: String(a.name), type: (a.type as "cash" | "bank" | "savings" | "other") ?? "bank", openingBalance: Number(a.openingBalance ?? 0), active: a.active !== false }).returning({ id: schema.accounts.id }); if (row) accIdMap.set(Number(a.id), row.id); }
      for (const t of arr("transfers")) { const from = accIdMap.get(Number(t.fromAccountId)); const to = accIdMap.get(Number(t.toAccountId)); if (from && to) await db.insert(schema.transfers).values({ fromAccountId: from, toAccountId: to, amount: Number(t.amount), date: String(t.date), note: String(t.note ?? "") }); }
      const goalIdMap = new Map<number, number>();
      for (const g of arr("savingsGoals")) { const [row] = await db.insert(schema.savingsGoals).values({ name: String(g.name), targetAmount: Number(g.targetAmount), targetDate: (g.targetDate as string) ?? null, description: String(g.description ?? "") }).returning({ id: schema.savingsGoals.id }); if (row) goalIdMap.set(Number(g.id), row.id); }
      for (const e of arr("savingsEntries")) { const gid = goalIdMap.get(Number(e.goalId)); if (gid) await db.insert(schema.savingsEntries).values({ goalId: gid, amount: Number(e.amount), date: String(e.date), note: String(e.note ?? "") }); }
      const debtIdMap = new Map<number, number>();
      for (const d of arr("debts")) { const [row] = await db.insert(schema.debts).values({ name: String(d.name), kind: (d.kind as "i_owe" | "owed_to_me" | "loan" | "installment") ?? "i_owe", initialAmount: Number(d.initialAmount), monthlyPayment: Number(d.monthlyPayment ?? 0), dueDay: Number(d.dueDay ?? 1), interestRate: Number(d.interestRate ?? 0), startDate: String(d.startDate ?? ""), description: String(d.description ?? "") }).returning({ id: schema.debts.id }); if (row) debtIdMap.set(Number(d.id), row.id); }
      for (const pay of arr("debtPayments")) { const did = debtIdMap.get(Number(pay.debtId)); if (did) await db.insert(schema.debtPayments).values({ debtId: did, amount: Number(pay.amount), date: String(pay.date), note: String(pay.note ?? "") }); }
      ctx.invalidateQueries();
      return ok(null);
    },
  }),

  exportData: defineAction({
    description: "Builds a CSV export of all transactions, fixed expenses, and budgets.",
    request: z.object({}),
    response: z.object({ csv: z.string(), filename: z.string() }),
    async handler(ctx) {
      const data = await loadAll(ctx);
      const currency = data.settingsRow?.currency ?? "MAD";
      const esc = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines: string[] = [];
      lines.push("Transactions");
      lines.push("Date,Type,Kind,Category,Amount,Currency,Payment method,Description,Note");
      const sorted = [...data.txs].sort((a, b) => (a.date < b.date ? -1 : 1));
      for (const t of sorted) {
        lines.push([t.date, t.kind, t.kind === "expense" ? (t.expenseType ?? "") : "", t.category, t.amount, currency, t.paymentMethod, t.description, t.note].map(esc).join(","));
      }
      lines.push("");
      lines.push("Fixed expenses");
      lines.push("Name,Category,Amount,Currency,Frequency,Payment day,Active,Description");
      for (const f of data.fixed) {
        lines.push([f.name, f.category, f.amount, currency, f.frequency, f.paymentDay, f.active ? "yes" : "no", f.description].map(esc).join(","));
      }
      lines.push("");
      lines.push("Fixed expense payments");
      lines.push("Expense,Month,Amount,Currency");
      for (const p of data.payments) {
        const f = data.fixed.find((x) => x.id === p.fixedExpenseId);
        lines.push([f?.name ?? `#${p.fixedExpenseId}`, p.month, p.amount ?? f?.amount ?? "", currency].map(esc).join(","));
      }
      lines.push("");
      lines.push("Budgets");
      lines.push("Category,Monthly budget,Month,Currency");
      for (const b of data.budgets) {
        lines.push([b.category, b.amount, b.month ?? "every month", currency].map(esc).join(","));
      }
      lines.push("");
      lines.push("Accounts");
      lines.push("Name,Type,Opening balance,Currency");
      for (const a of data.accounts) lines.push([a.name, a.type, a.openingBalance, currency].map(esc).join(","));
      lines.push("");
      lines.push("Transfers (not income or expenses)");
      lines.push("Date,From account,To account,Amount,Currency,Note");
      for (const t of data.transfers) {
        const from = data.accounts.find((a) => a.id === t.fromAccountId)?.name ?? `#${t.fromAccountId}`;
        const to = data.accounts.find((a) => a.id === t.toAccountId)?.name ?? `#${t.toAccountId}`;
        lines.push([t.date, from, to, t.amount, currency, t.note].map(esc).join(","));
      }
      lines.push("");
      lines.push("Savings goals");
      lines.push("Goal,Target,Saved so far,Target date,Currency");
      for (const g of data.goals) {
        const saved = data.goalEntries.filter((e) => e.goalId === g.id).reduce((s2, e) => s2 + e.amount, 0);
        lines.push([g.name, g.targetAmount, saved, g.targetDate ?? "", currency].map(esc).join(","));
      }
      lines.push("");
      lines.push("Debts");
      lines.push("Name,Kind,Initial,Paid,Monthly payment,Due day,Interest %,Currency");
      for (const d of data.debts) {
        const paid = data.debtPayments.filter((x) => x.debtId === d.id).reduce((s2, x) => s2 + x.amount, 0);
        lines.push([d.name, d.kind, d.initialAmount, paid, d.monthlyPayment, d.dueDay, d.interestRate, currency].map(esc).join(","));
      }
      return { csv: lines.join("\n"), filename: `salaryflow-export-${currentMonthKey()}.csv` };
    },
  }),

  clearAllData: defineAction({
    description: "Deletes every transaction, fixed expense, payment, budget, account, transfer, savings goal, debt, custom category, and the saved settings.",
    request: z.object({}),
    response: okResponse,
    async handler(ctx): Promise<OkOut> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.fixedPayments);
      await db.delete(schema.savingsEntries);
      await db.delete(schema.debtPayments);
      await db.delete(schema.transfers);
      await db.delete(schema.transactions);
      await db.delete(schema.fixedExpenses);
      await db.delete(schema.savingsGoals);
      await db.delete(schema.debts);
      await db.delete(schema.accounts);
      await db.delete(schema.budgets);
      await db.delete(schema.categories);
      await db.delete(schema.settings);
      ctx.invalidateQueries();
      return ok(null);
    },
  }),
} satisfies ActionsModule;
