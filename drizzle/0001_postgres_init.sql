CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  expense_type TEXT,
  amount DOUBLE PRECISION NOT NULL,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  note TEXT NOT NULL DEFAULT '',
  account_id INTEGER,
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  category TEXT NOT NULL,
  payment_day INTEGER NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  start_month TEXT NOT NULL,
  end_month TEXT,
  payment_method TEXT NOT NULL DEFAULT 'bank transfer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS fixed_payments (
  id SERIAL PRIMARY KEY,
  fixed_expense_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  amount DOUBLE PRECISION,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS fixed_payments_expense_month_idx ON fixed_payments (fixed_expense_id, month);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  month TEXT
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS budgets_category_month_idx ON budgets (category, month);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank',
  opening_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  from_account_id INTEGER NOT NULL,
  to_account_id INTEGER NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS savings_goals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  target_amount DOUBLE PRECISION NOT NULL,
  target_date TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS savings_entries (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS debts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'i_owe',
  initial_amount DOUBLE PRECISION NOT NULL,
  monthly_payment DOUBLE PRECISION NOT NULL DEFAULT 0,
  due_day INTEGER NOT NULL DEFAULT 1,
  interest_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS debt_payments (
  id SERIAL PRIMARY KEY,
  debt_id INTEGER NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_kind ON categories (name, kind);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'MAD',
  salary_amount DOUBLE PRECISION,
  salary_day INTEGER,
  salary_category TEXT NOT NULL DEFAULT 'Salary',
  month_start_day INTEGER NOT NULL DEFAULT 1
);
