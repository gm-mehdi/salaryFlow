"use client";

// SalaryFlow — personal salary & expense manager.
// All data comes from server actions computed over the user's stored rows;
// the app starts empty and every figure updates when records change.

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api } from "./api";
import { currentMonthKey, shiftMonthKey } from "./lib/format";
import type { SheetState, Tab } from "./lib/types";
import {
  IconArrowSwap,
  IconChart,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconFile,
  IconHome,
  IconLandmark,
  IconList,
  IconPiggy,
  IconPlus,
  IconRepeat,
  IconScale,
  IconSliders,
  IconTarget,
  IconWallet,
} from "./components/icons";
import { Sheet, btnPrimary, cardCls } from "./components/ui";
import { Dashboard } from "./features/dashboard/Dashboard";
import { IncomeTab } from "./features/transactions/IncomeTab";
import { ExpensesTab } from "./features/transactions/ExpensesTab";
import { TransactionsTab } from "./features/transactions/TransactionsTab";
import { TxForm } from "./features/transactions/TxForm";
import { FixedTab } from "./features/fixed/FixedTab";
import { FixedForm } from "./features/fixed/FixedForm";
import { BudgetsTab } from "./features/budgets/BudgetsTab";
import { BudgetForm } from "./features/budgets/BudgetForm";
import { SavingsTab } from "./features/savings/SavingsTab";
import { GoalForm } from "./features/savings/GoalForm";
import { GoalEntryForm } from "./features/savings/GoalEntryForm";
import { DebtsTab } from "./features/debts/DebtsTab";
import { DebtForm } from "./features/debts/DebtForm";
import { DebtPaymentForm } from "./features/debts/DebtPaymentForm";
import { AccountsTab } from "./features/accounts/AccountsTab";
import { AccountForm } from "./features/accounts/AccountForm";
import { TransferForm } from "./features/accounts/TransferForm";
import { SettingsTab } from "./features/settings/SettingsTab";

const ReportsTab = dynamic(
  () => import("./features/reports/ReportsTab").then((m) => ({ default: m.ReportsTab })),
  { ssr: false },
);
const InsightsTab = dynamic(
  () => import("./features/insights/InsightsTab").then((m) => ({ default: m.InsightsTab })),
  { ssr: false },
);

const TABS: { id: Tab; label: string; icon: () => ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: IconHome },
  { id: "income", label: "Income", icon: IconWallet },
  { id: "expenses", label: "Expenses", icon: IconList },
  { id: "fixed", label: "Fixed Charges", icon: IconRepeat },
  { id: "budgets", label: "Budgets", icon: IconTarget },
  { id: "savings", label: "Savings Goals", icon: IconPiggy },
  { id: "debts", label: "Debts", icon: IconScale },
  { id: "accounts", label: "Accounts", icon: IconLandmark },
  { id: "transactions", label: "Transactions", icon: IconArrowSwap },
  { id: "reports", label: "Reports", icon: IconFile },
  { id: "insights", label: "Insights", icon: IconChart },
  { id: "settings", label: "Settings", icon: IconSliders },
];
const MOBILE_TABS: Tab[] = ["dashboard", "income", "expenses", "fixed"];

export function App() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonthKey());
  const [tab, setTab] = useState<Tab>("dashboard");
  const [filters, setFilters] = useState({ kind: "all", category: "all", type: "all", search: "", sortBy: "date", paymentMethod: "all" });
  const [compareMonth, setCompareMonth] = useState(shiftMonthKey(currentMonthKey(), -1));
  const [sheet, setSheet] = useState<SheetState>(null);

  const stateQ = useQuery({
    queryKey: ["state", month, filters.kind, filters.category, filters.type, filters.search, filters.sortBy, filters.paymentMethod, compareMonth],
    queryFn: () =>
      api.getState({
        month,
        filterKind: filters.kind as "all" | "income" | "expense",
        filterCategory: filters.category,
        filterType: filters.type as "all" | "fixed" | "variable",
        search: filters.search,
        sortBy: filters.sortBy as "date" | "amount_desc" | "amount_asc",
        filterPaymentMethod: filters.paymentMethod,
        compareMonth: compareMonth || null,
      }),
  });

  const addSalaryMut = useMutation({
    mutationFn: async () => await api.addSalaryForMonth({ month: currentMonthKey() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["state"] }),
  });

  const state = stateQ.data;
  const isCurrentMonth = month === currentMonthKey();
  const monthTitle = state?.monthLabel ?? month;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4 lg:flex" aria-label="Sections">
        <p className="font-display px-2 pb-3 text-lg font-extrabold">SalaryFlow</p>
        <nav className="flex flex-col gap-1" aria-label="Main sections">
          {TABS.map((t) => {
            const Icon = t.icon;
            const activeTab = tab === t.id;
            return (
              <button key={t.id} type="button" aria-current={activeTab ? "page" : undefined} onClick={() => setTab(t.id)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium ${activeTab ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--dim)] hover:text-[var(--text)]"}`}>
                <Icon /> {t.label}
              </button>
            );
          })}
        </nav>
        <p className="mt-auto px-2 text-xs text-[var(--dim)]">MAD · Morocco</p>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-32 lg:ml-60 lg:max-w-none lg:px-8">
        {/* Month switcher */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <button type="button" aria-label="Previous month" className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]" onClick={() => setMonth(shiftMonthKey(month, -1))}>
            <IconChevronLeft />
          </button>
          <div className="text-center">
            <h1 className="font-display text-xl font-bold">{monthTitle}</h1>
            {isCurrentMonth ? (
              <p className="text-xs font-medium text-[var(--accent)]">Current month</p>
            ) : (
              <button type="button" className="min-h-6 text-xs font-medium text-[var(--accent)] underline" onClick={() => setMonth(currentMonthKey())}>
                Back to this month
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Next month"
            disabled={isCurrentMonth}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] disabled:opacity-40"
            onClick={() => setMonth(shiftMonthKey(month, 1))}
          >
            <IconChevronRight />
          </button>
        </div>

        {stateQ.isPending && (
          <div className="py-16 text-center" role="status">
            <p className="font-display text-lg font-semibold">Loading your finances…</p>
            <p className="mt-1 text-sm text-[var(--dim)]">Crunching the numbers for {monthTitle}.</p>
          </div>
        )}

        {stateQ.isError && (
          <div className={`${cardCls} py-10 text-center`} role="alert">
            <p className="font-display text-lg font-semibold">Couldn't load your data</p>
            <p className="mt-1 text-sm text-[var(--dim)]">Something went wrong reading your records. Your data is still stored — try again.</p>
            <button type="button" className={`${btnPrimary} mt-4`} onClick={() => void stateQ.refetch()}>
              Retry
            </button>
          </div>
        )}

        {state && (
          <>
            {tab === "dashboard" && (
              <Dashboard
                state={state}
                onSeeAll={() => setTab("transactions")}
                onEditTx={(tx) => setSheet({ type: "tx", tx, kind: tx.kind })}
                onAddSalary={() => addSalaryMut.mutate()}
                salaryBusy={addSalaryMut.isPending}
              />
            )}
            {tab === "income" && <IncomeTab state={state} onEditTx={(tx) => setSheet({ type: "tx", tx, kind: tx.kind })} onAdd={() => setSheet({ type: "tx", tx: null, kind: "income" })} />}
            {tab === "expenses" && <ExpensesTab state={state} onEditTx={(tx) => setSheet({ type: "tx", tx, kind: tx.kind })} onAdd={() => setSheet({ type: "tx", tx: null, kind: "expense" })} />}
            {tab === "transactions" && (
              <TransactionsTab state={state} filters={filters} onFilters={setFilters} onEditTx={(tx) => setSheet({ type: "tx", tx, kind: tx.kind })} />
            )}
            {tab === "fixed" && <FixedTab state={state} onEditFixed={(f) => setSheet({ type: "fixed", fixed: f })} />}
            {tab === "budgets" && <BudgetsTab state={state} onEditBudget={(b) => setSheet({ type: "budget", budget: b })} />}
            {tab === "savings" && <SavingsTab state={state} onEditGoal={(g) => setSheet({ type: "goal", goal: g })} onAddEntry={(g) => setSheet({ type: "goalEntry", goal: g })} />}
            {tab === "debts" && <DebtsTab state={state} onEditDebt={(d) => setSheet({ type: "debt", debt: d })} onPayDebt={(d) => setSheet({ type: "debtPayment", debt: d })} />}
            {tab === "accounts" && <AccountsTab state={state} onEditAccount={(a) => setSheet({ type: "account", account: a })} onTransfer={() => setSheet({ type: "transfer" })} />}
            {tab === "reports" && <ReportsTab state={state} compareMonth={compareMonth} onCompareMonth={setCompareMonth} />}
            {tab === "insights" && <InsightsTab state={state} />}
            {tab === "settings" && <SettingsTab state={state} onAddSalary={() => addSalaryMut.mutate()} salaryBusy={addSalaryMut.isPending} />}
          </>
        )}
      </main>

      {/* Quick-add FAB */}
      {state && tab !== "settings" && (
        <button
          type="button"
          aria-label="Add transaction or income"
          className="fixed right-4 bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg shadow-black/25"
          onClick={() => setSheet({ type: "chooser" })}
        >
          <IconPlus size={26} />
        </button>
      )}

      {/* Bottom navigation (mobile) */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {TABS.filter((t) => MOBILE_TABS.includes(t.id)).map((t) => {
            const Icon = t.icon;
            const activeTab = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={activeTab ? "page" : undefined}
                onClick={() => setTab(t.id)}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium ${activeTab ? "text-[var(--accent)]" : "text-[var(--dim)]"}`}
              >
                <Icon />
                {t.label.split(" ")[0]}
              </button>
            );
          })}
          <button
            type="button"
            aria-label="More sections"
            onClick={() => setSheet({ type: "more" })}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium ${!MOBILE_TABS.includes(tab) ? "text-[var(--accent)]" : "text-[var(--dim)]"}`}
          >
            <IconDots />
            More
          </button>
        </div>
      </nav>

      {sheet?.type === "more" && (
        <Sheet title="All sections" onClose={() => setSheet(null)}>
          <div className="grid grid-cols-2 gap-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const activeTab = tab === t.id;
              return (
                <button key={t.id} type="button" aria-current={activeTab ? "page" : undefined} onClick={() => { setTab(t.id); setSheet(null); }} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium ${activeTab ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)]"}`}>
                  <Icon /> {t.label}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {/* Sheets */}
      {sheet?.type === "chooser" && state && (
        <Sheet title="Add" onClose={() => setSheet(null)}>
          <div className="space-y-2">
            {[
              { label: "Expense", sub: "Groceries, coffee, transport…", kind: "expense" as const },
              { label: "Income", sub: "Freelance, bonus, side project…", kind: "income" as const },
            ].map((opt) => (
              <button
                key={opt.kind}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-left"
                onClick={() => setSheet({ type: "tx", tx: null, kind: opt.kind })}
              >
                <span className={opt.kind === "income" ? "text-[var(--accent)]" : "text-[var(--danger)]"}><IconPlus size={20} /></span>
                <span>
                  <span className="block font-display font-semibold">{opt.label}</span>
                  <span className="block text-sm text-[var(--dim)]">{opt.sub}</span>
                </span>
              </button>
            ))}
            <button type="button" className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-left" onClick={() => setSheet({ type: "fixed", fixed: null })}>
              <span className="text-[var(--accent)]"><IconRepeat /></span>
              <span>
                <span className="block font-display font-semibold">Fixed expense</span>
                <span className="block text-sm text-[var(--dim)]">Rent, subscriptions, bills…</span>
              </span>
            </button>
            <button type="button" className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-left" onClick={() => setSheet({ type: "budget", budget: null })}>
              <span className="text-[var(--accent)]"><IconTarget /></span>
              <span>
                <span className="block font-display font-semibold">Budget</span>
                <span className="block text-sm text-[var(--dim)]">A monthly limit for a category</span>
              </span>
            </button>
            <button type="button" className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-left" onClick={() => setSheet({ type: "goal", goal: null })}>
              <span className="text-[var(--accent)]"><IconPiggy /></span>
              <span>
                <span className="block font-display font-semibold">Savings goal</span>
                <span className="block text-sm text-[var(--dim)]">Emergency fund, car, travel…</span>
              </span>
            </button>
            <button type="button" className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-left" onClick={() => setSheet({ type: "account", account: null })}>
              <span className="text-[var(--accent)]"><IconLandmark /></span>
              <span>
                <span className="block font-display font-semibold">Account</span>
                <span className="block text-sm text-[var(--dim)]">Cash, bank or savings account</span>
              </span>
            </button>
            {state.accounts.length >= 2 && (
              <button type="button" className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-left" onClick={() => setSheet({ type: "transfer" })}>
                <span className="text-[var(--accent)]"><IconArrowSwap /></span>
                <span>
                  <span className="block font-display font-semibold">Transfer</span>
                  <span className="block text-sm text-[var(--dim)]">Move money between your accounts</span>
                </span>
              </button>
            )}
          </div>
        </Sheet>
      )}

      {sheet?.type === "account" && state && (
        <Sheet title={sheet.account ? "Edit account" : "Add account"} onClose={() => setSheet(null)}>
          <AccountForm initial={sheet.account} onClose={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet?.type === "transfer" && state && (
        <Sheet title="Transfer between accounts" onClose={() => setSheet(null)}>
          <TransferForm state={state} onClose={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet?.type === "goal" && state && (
        <Sheet title={sheet.goal ? "Edit savings goal" : "New savings goal"} onClose={() => setSheet(null)}>
          <GoalForm initial={sheet.goal} onClose={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet?.type === "goalEntry" && state && (
        <Sheet title="Savings movement" onClose={() => setSheet(null)}>
          <GoalEntryForm goal={sheet.goal} onClose={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet?.type === "debt" && state && (
        <Sheet title={sheet.debt ? "Edit debt" : "Add debt"} onClose={() => setSheet(null)}>
          <DebtForm initial={sheet.debt} onClose={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet?.type === "debtPayment" && state && (
        <Sheet title="Record debt payment" onClose={() => setSheet(null)}>
          <DebtPaymentForm debt={sheet.debt} currency={state.currency} onClose={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet?.type === "tx" && state && (
        <Sheet title={sheet.tx ? "Edit transaction" : sheet.kind === "income" ? "Add income" : "Add expense"} onClose={() => setSheet(null)}>
          <TxForm state={state} initial={sheet.tx} defaultKind={sheet.kind} onClose={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet?.type === "fixed" && state && (
        <Sheet title={sheet.fixed ? "Edit fixed expense" : "Add fixed expense"} onClose={() => setSheet(null)}>
          <FixedForm state={state} initial={sheet.fixed} onClose={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet?.type === "budget" && state && (
        <Sheet title={sheet.budget ? "Edit budget" : "Add budget"} onClose={() => setSheet(null)}>
          <BudgetForm state={state} initial={sheet.budget} onClose={() => setSheet(null)} />
        </Sheet>
      )}
    </div>
  );
}
