import type { api, ApiResponse } from "../api";

export type State = ApiResponse<typeof api, "getState">;
export type Tx = State["transactions"][number];
export type FixedRow = State["fixed"][number];
export type BudgetRow = State["budgets"][number];
export type AccountRow = State["accounts"][number];
export type GoalRow = State["goals"][number];
export type DebtRow = State["debts"][number];
export type Tab =
  | "dashboard"
  | "income"
  | "expenses"
  | "transactions"
  | "fixed"
  | "budgets"
  | "savings"
  | "debts"
  | "accounts"
  | "reports"
  | "insights"
  | "settings";

export type SheetState =
  | { type: "chooser" }
  | { type: "more" }
  | { type: "tx"; tx: Tx | null; kind: "income" | "expense" }
  | { type: "fixed"; fixed: FixedRow | null }
  | { type: "budget"; budget: BudgetRow | null }
  | { type: "account"; account: AccountRow | null }
  | { type: "transfer" }
  | { type: "goal"; goal: GoalRow | null }
  | { type: "goalEntry"; goal: GoalRow }
  | { type: "debt"; debt: DebtRow | null }
  | { type: "debtPayment"; debt: DebtRow }
  | null;
