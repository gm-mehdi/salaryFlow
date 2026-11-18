# Data Plan

## Context provenance
- `Build a web version I can use on my phone now` (final user answer to the web-vs-Android choice; the artifact is the web phone version of the SalaryFlow request)
- `These numbers are illustrative, not predefined financial data` (prior user statement; the database starts EMPTY — no seeded salary, transactions, budgets, or fixed expenses)
- `Use MAD (Moroccan Dirham) as the default currency, but allow me to change it in settings` (prior user statement; settings default currency = MAD, user-editable)
- `Use realistic sample data only for testing. Make sure the final application allows me to start with a clean database` (prior user statement; audit test rows are created via the public actions in the sandbox only; production starts empty)
- `how can i add an amout for example "lmazot" i spend 100 mad from 700 mad so the rest to spend is 600 mad` / `Yes, add partial payments to SalaryFlow` (2026-11-12 user request; fixed expenses now support partial payments — each payment row carries its own amount, totals count only what was actually paid, and the card shows paid / remaining)

## Tested sources
### User-entered data in the artifact's own SQLite DB (ctx.db)
**Used by**: every action (getState, addTransaction, updateTransaction, deleteTransaction, upsertFixedExpense, deleteFixedExpense, toggleFixedPayment, recordFixedPayment, deleteFixedPayment, upsertBudget, deleteBudget, upsertCategory, deleteCategory, saveSettings, exportData, clearAllData)
**Test command**: scaffold probe — inspected existing `client/src/api.ts`, `server/src/actions.ts`, `server/src/schema.ts`, and `drizzle/0001_initial.sql` in place; the ctx.db/drizzle stack is the artifact runtime's own database and needs no external probe.
**Sample output**: scaffold schema `entries(id, text, created_at)` and working typed actions `listEntries`/`addEntry`, confirming the DB + actions channel works before replacing it with the finance schema.
**Processing**: All figures (dashboard totals, percentages, insights, budget consumption, month-over-month comparisons, yearly overview) are computed server-side from stored rows at read time, so any add/edit/delete updates every surface. Fixed expenses are templates paid per month via payment rows, never duplicated as transactions.

## Web-search sources
None — no external facts, prices, or feeds. All numbers derive from the user's own stored records.

## Agent-task sources
None.

## Long-term data behavior
- **Refresh policy**: None. Data changes only when the user adds/edits/deletes their own records. No scheduled refresh, no spawnTask.
- **Growth**: One row per transaction, per fixed expense, per fixed-expense payment (multiple partial payments allowed per expense + YYYY-MM, each with its own amount; legacy full payments have amount backfilled to the expense amount by migration 0003), per category budget, per custom category, plus a single settings row. Unbounded but user-paced; list actions cap returned transactions per query.
- **Ordering**: Transactions newest-first by date then id; fixed expenses by payment day; budgets and categories by name; insights computed for the selected month with the previous month as comparison baseline.
- **Time semantics**: Dates are stored as plain `YYYY-MM-DD` calendar dates (no timezones); the current month is derived from the viewer's local date rendering. Month keys are `YYYY-MM` strings.

## Rejected approaches
- **Tried**: Seed the dashboard with the example numbers (12,000 MAD salary etc.)
  **Why rejected**: The request explicitly says those numbers are illustrative and the user must start with a clean database.
- **Tried**: Generate fixed-expense payments as transactions each month
  **Why rejected**: The request forbids double counting; payments are tracked as separate fixed-expense payment rows and included in expense totals exactly once, by effective date.
- **Imagery not needed**: A finance tracker has no visual subjects; charts are drawn from the user's own stored numbers with Recharts, and category dots/icons use Lucide-style glyphs and CSS, not photos.

## 2026-11-17 complete-system upgrade
- Migration 0004 adds: transactions.account_id + recurring; fixed_expenses.end_month + payment_method + weekly frequency; budgets.month (null = every month, YYYY-MM = month-specific, month row wins); settings.month_start_day; new tables accounts, transfers, savings_goals, savings_entries, debts, debt_payments. No existing rows are rewritten except the budgets table rebuild, which copies id/category/amount verbatim with month = NULL.
- All new figures are computed server-side from stored rows: account balances (opening + assigned income − assigned expenses + transfers), goal progress / monthly-required, debt remaining / payoff month, projections (projected end balance after pending fixed charges, projected savings from actual income − expected fixed − actual or 3-month-average variable), month comparison, top expenses, unpaid bills.
- Transfers and savings-goal movements are deliberately excluded from income/expense totals to avoid double counting.
- Backup: exportBackup returns the full DB as JSON; importBackup validates shape, then restores with id remapping for linked rows (fixed payments, transfers, goal entries, debt payments).
