ALTER TABLE fixed_payments ADD COLUMN amount REAL;
--> statement-breakpoint
DROP INDEX IF EXISTS fixed_payments_expense_month;
--> statement-breakpoint
CREATE INDEX fixed_payments_expense_month_idx ON fixed_payments (fixed_expense_id, month);
--> statement-breakpoint
UPDATE fixed_payments SET amount = (SELECT amount FROM fixed_expenses WHERE fixed_expenses.id = fixed_payments.fixed_expense_id) WHERE amount IS NULL;
