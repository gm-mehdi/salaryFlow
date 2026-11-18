DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  expense_type TEXT,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  payment_day INTEGER NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  start_month TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE fixed_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fixed_expense_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  paid_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX fixed_payments_expense_month ON fixed_payments (fixed_expense_id, month);
--> statement-breakpoint
CREATE TABLE budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL
);
--> statement-breakpoint
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX categories_name_kind ON categories (name, kind);
--> statement-breakpoint
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'MAD',
  salary_amount REAL,
  salary_day INTEGER,
  salary_category TEXT NOT NULL DEFAULT 'Salary'
);
