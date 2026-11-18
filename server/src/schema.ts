// SalaryFlow schema: user-owned finance records on Neon Postgres.
// All figures are computed from these rows at read time; nothing is seeded.

import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  kind: text("kind", { enum: ["income", "expense"] }).notNull(),
  expenseType: text("expense_type", { enum: ["fixed", "variable"] }),
  amount: doublePrecision("amount").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  description: text("description").notNull().default(""),
  paymentMethod: text("payment_method").notNull().default("cash"),
  note: text("note").notNull().default(""),
  accountId: integer("account_id"),
  recurring: boolean("recurring").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const fixedExpenses = pgTable("fixed_expenses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: doublePrecision("amount").notNull(),
  category: text("category").notNull(),
  paymentDay: integer("payment_day").notNull(),
  frequency: text("frequency", {
    enum: ["weekly", "monthly", "quarterly", "yearly"],
  })
    .notNull()
    .default("monthly"),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
  startMonth: text("start_month").notNull(), // YYYY-MM
  endMonth: text("end_month"),
  paymentMethod: text("payment_method").notNull().default("bank transfer"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const fixedPayments = pgTable("fixed_payments", {
  id: serial("id").primaryKey(),
  fixedExpenseId: integer("fixed_expense_id").notNull(),
  month: text("month").notNull(), // YYYY-MM
  amount: doublePrecision("amount"), // null on legacy full payments = full expense amount
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgets = pgTable(
  "budgets",
  {
    id: serial("id").primaryKey(),
    category: text("category").notNull(),
    amount: doublePrecision("amount").notNull(),
    month: text("month"),
  },
  (t) => [uniqueIndex("budgets_category_month_idx").on(t.category, t.month)],
);

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["cash", "bank", "savings", "other"] }).notNull().default("bank"),
  openingBalance: doublePrecision("opening_balance").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  fromAccountId: integer("from_account_id").notNull(),
  toAccountId: integer("to_account_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  date: text("date").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const savingsGoals = pgTable("savings_goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  targetAmount: doublePrecision("target_amount").notNull(),
  targetDate: text("target_date"),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const savingsEntries = pgTable("savings_entries", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  date: text("date").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const debts = pgTable("debts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["i_owe", "owed_to_me", "loan", "installment"] })
    .notNull()
    .default("i_owe"),
  initialAmount: doublePrecision("initial_amount").notNull(),
  monthlyPayment: doublePrecision("monthly_payment").notNull().default(0),
  dueDay: integer("due_day").notNull().default(1),
  interestRate: doublePrecision("interest_rate").notNull().default(0),
  startDate: text("start_date").notNull().default(""),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const debtPayments = pgTable("debt_payments", {
  id: serial("id").primaryKey(),
  debtId: integer("debt_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  date: text("date").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["income", "expense"] }).notNull(),
  },
  (t) => [uniqueIndex("categories_name_kind").on(t.name, t.kind)],
);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  currency: text("currency").notNull().default("MAD"),
  salaryAmount: doublePrecision("salary_amount"),
  salaryDay: integer("salary_day"),
  salaryCategory: text("salary_category").notNull().default("Salary"),
  monthStartDay: integer("month_start_day").notNull().default(1),
});
