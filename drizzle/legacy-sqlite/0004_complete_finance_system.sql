ALTER TABLE transactions ADD COLUMN account_id INTEGER;
--> statement-breakpoint
ALTER TABLE transactions ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE fixed_expenses ADD COLUMN end_month TEXT;
--> statement-breakpoint
ALTER TABLE fixed_expenses ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'bank transfer';
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN month_start_day INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TABLE budgets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  month TEXT
);
--> statement-breakpoint
INSERT INTO budgets_new (id, category, amount, month) SELECT id, category, amount, NULL FROM budgets;
--> statement-breakpoint
DROP TABLE budgets;
--> statement-breakpoint
ALTER TABLE budgets_new RENAME TO budgets;
--> statement-breakpoint
CREATE UNIQUE INDEX budgets_category_month_idx ON budgets (category, month);
--> statement-breakpoint
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank',
  opening_balance REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_account_id INTEGER NOT NULL,
  to_account_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  target_date TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE savings_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'i_owe',
  initial_amount REAL NOT NULL,
  monthly_payment REAL NOT NULL DEFAULT 0,
  due_day INTEGER NOT NULL DEFAULT 1,
  interest_rate REAL NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE debt_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
