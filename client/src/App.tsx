"use client";

// SalaryFlow — personal salary & expense manager.
// All data comes from server actions computed over the user's stored rows;
// the app starts empty and every figure updates when records change.

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
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
LineChart,
Line,
} from "recharts";
import { api, type ApiResponse } from "./api";

type State = ApiResponse<typeof api, "getState">;
type Tx = State["transactions"][number];
type FixedRow = State["fixed"][number];
type BudgetRow = State["budgets"][number];
type AccountRow = State["accounts"][number];
type GoalRow = State["goals"][number];
type DebtRow = State["debts"][number];
type Tab = "dashboard" | "income" | "expenses" | "transactions" | "fixed" | "budgets" | "savings" | "debts" | "accounts" | "reports" | "insights" | "settings";

// ---------- constants ----------

const BUILT_IN_EXPENSE = [
  "Housing", "Groceries", "Restaurants", "Coffee", "Transportation", "Fuel",
  "Shopping", "Entertainment", "Travel", "Food delivery", "Personal care",
  "Utilities", "Subscriptions", "Health", "Education", "Other",
];
const BUILT_IN_INCOME = ["Salary", "Freelance", "Bonus", "Side project", "Other income"];
const PAYMENT_METHODS = ["cash", "card", "bank transfer", "mobile payment", "other"];
const CURRENCIES = ["MAD", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "CHF", "JPY", "INR", "EGP", "TND", "DZD"];
const CAT_COLORS = ["#0e6b5c", "#e8a33d", "#3e7cb1", "#e4572e", "#6a994e", "#bc4749", "#577590", "#9c6644", "#2a9d8f", "#bc6c25"];

// ---------- small helpers ----------

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftMonthKey(key: string, delta: number): string {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function fmt(n: number, currency: string): string {
  const v = Math.abs(n);
  const s = v.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? "−" : ""}${s} ${currency}`;
}

function fmtShort(n: number): string {
  if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}k`;
  return `${Math.round(n)}`;
}

function prettyDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function unique(list: string[]): string[] {
  return [...new Set(list)];
}

// ---------- icons (inline SVG, lucide-style paths) ----------

function I({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const IconHome = () => (<I><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></I>);
const IconList = () => (<I><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></I>);
const IconRepeat = () => (<I><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></I>);
const IconTarget = () => (<I><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></I>);
const IconChart = () => (<I><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 15v3M12 10v8M17 6v12" /></I>);
const IconSliders = () => (<I><path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></I>);
const IconPlus = ({ size = 22 }: { size?: number }) => (<I size={size}><path d="M12 5v14M5 12h14" /></I>);
const IconX = () => (<I size={18}><path d="M18 6 6 18M6 6l12 12" /></I>);
const IconCheck = () => (<I size={18}><path d="M20 6 9 17l-5-5" /></I>);
const IconTrash = () => (<I size={17}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></I>);
const IconPencil = () => (<I size={15}><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></I>);
const IconChevronLeft = () => (<I size={20}><path d="m15 18-6-6 6-6" /></I>);
const IconChevronRight = () => (<I size={20}><path d="m9 18 6-6-6-6" /></I>);
const IconDownload = () => (<I size={18}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></I>);
const IconWallet = () => (<I><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></I>);
const IconAlert = () => (<I size={16}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></I>);
const IconTrend = () => (<I size={18}><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></I>);
const IconPiggy = () => (<I><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 1 3 2 4V18a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1h5v1a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-3.3c1-.6 2-1.7 2-3.2 0-.4-.1-.8-.2-1.2C21 9.6 20 5 19 5Z" /><path d="M2 9v1c0 1.1.9 2 2 2h1" /><path d="M16 11h.01" /></I>);
const IconLandmark = () => (<I><path d="M3 22h18" /><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7" /><path d="m12 2 9 5H3z" /></I>);
const IconScale = () => (<I><path d="M12 3v18" /><path d="M5 7h14" /><path d="m5 7-3 6a3.5 3.5 0 0 0 6 0L5 7Z" /><path d="m19 7-3 6a3.5 3.5 0 0 0 6 0l-3-6Z" /><path d="M8 21h8" /></I>);
const IconArrowSwap = () => (<I><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></I>);
const IconFile = () => (<I><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></I>);
const IconDots = () => (<I><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></I>);

// ---------- shared UI ----------

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--text)] outline-none focus:border-[var(--accent)]";
const labelCls = "mb-1 block text-sm font-medium text-[var(--dim)]";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-medium text-[var(--text)] disabled:opacity-50";
const cardCls = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-[var(--surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Close dialog" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text)]">
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className={`${cardCls} py-8 text-center`}>
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--dim)]">{body}</p>
    </div>
  );
}

function ProgressBar({ pct, tone }: { pct: number; tone: "ok" | "warn" | "over" }) {
  const color = tone === "over" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

function CategoryPicker({
  kind,
  options,
  value,
  onChange,
}: {
  kind: "income" | "expense";
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const isCustom = !options.includes(value);
  const [customText, setCustomText] = useState(isCustom ? value : "");
  return (
    <div className="space-y-2">
      <select
        aria-label={kind === "income" ? "Income category" : "Expense category"}
        className={inputCls}
        value={isCustom ? "__custom__" : value}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            onChange(customText || "");
          } else {
            onChange(e.target.value);
          }
        }}
      >
        {options.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
        <option value="__custom__">＋ New category…</option>
      </select>
      {isCustom && (
        <input
          aria-label="Custom category name"
          className={inputCls}
          placeholder="Category name"
          value={customText}
          onChange={(e) => {
            setCustomText(e.target.value);
            onChange(e.target.value);
          }}
        />
      )}
    </div>
  );
}

// ---------- forms ----------

type SheetState =
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

function TxForm({
  state,
  initial,
  defaultKind,
  onClose,
}: {
  state: State;
  initial: Tx | null;
  defaultKind: "income" | "expense";
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const editing = initial != null;
  const [kind, setKind] = useState<"income" | "expense">(initial?.kind ?? defaultKind);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const expenseOptions = useMemo(
    () => unique([...BUILT_IN_EXPENSE, ...state.categories.filter((c) => c.kind === "expense").map((c) => c.name)]),
    [state.categories],
  );
  const incomeOptions = useMemo(
    () => unique([...BUILT_IN_INCOME, ...state.categories.filter((c) => c.kind === "income").map((c) => c.name)]),
    [state.categories],
  );
  const [category, setCategory] = useState(
    initial?.category ?? (defaultKind === "income" ? (state.salaryCategory || "Salary") : "Groceries"),
  );
  const [expenseType, setExpenseType] = useState<"fixed" | "variable">(initial?.expenseType ?? "variable");
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "card");
  const [accountId, setAccountId] = useState<string>(initial?.accountId != null ? String(initial.accountId) : "");
  const [recurring, setRecurring] = useState(initial?.recurring ?? false);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["state"] });

  const saveMut = useMutation({
    mutationFn: async (force: boolean) => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
      if (!category.trim()) throw new Error("Choose or enter a category.");
      const acct = accountId === "" ? null : Number(accountId);
      if (editing && initial) {
        return await api.updateTransaction({
          id: initial.id,
          amount: amt,
          category: category.trim(),
          date,
          description: description.trim(),
          paymentMethod,
          note: note.trim(),
          expenseType: kind === "expense" ? expenseType : null,
          accountId: acct,
          recurring,
        });
      }
      return await api.addTransaction({
        kind,
        expenseType: kind === "expense" ? expenseType : null,
        amount: amt,
        category: category.trim(),
        date,
        description: description.trim(),
        paymentMethod,
        note: note.trim(),
        accountId: acct,
        recurring,
        force,
      });
    },
    onSuccess: (res) => {
      if (res.duplicate) {
        setDuplicate(true);
        setError(res.error);
        return;
      }
      if (!res.ok) {
        setError(res.error ?? "Could not save. Try again.");
        return;
      }
      // Register a brand-new custom category so it appears in pickers later.
      const known = kind === "income" ? incomeOptions : expenseOptions;
      if (!known.includes(category.trim())) {
        void api.upsertCategory({ name: category.trim(), kind }).then(refresh);
      }
      refresh();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save. Try again."),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!initial) throw new Error("Nothing to delete.");
      return await api.deleteTransaction({ id: initial.id });
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setDuplicate(false);
        saveMut.mutate(false);
      }}
    >
      {!editing && (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Transaction kind">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setCategory(k === "income" ? (state.salaryCategory || "Salary") : "Groceries");
              }}
              className={`min-h-11 rounded-xl border px-3 font-semibold capitalize ${
                kind === k
                  ? k === "income"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
                  : "border-[var(--border)] text-[var(--dim)]"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <Field label="Amount">
        <input
          aria-label="Amount"
          className={`${inputCls} tnum text-xl font-semibold`}
          inputMode="decimal"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </Field>

      <Field label="Category">
        <CategoryPicker
          kind={kind}
          options={kind === "income" ? incomeOptions : expenseOptions}
          value={category}
          onChange={setCategory}
        />
      </Field>

      {kind === "expense" && (
        <Field label="Expense type">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Expense type">
            {(["variable", "fixed"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={expenseType === t}
                onClick={() => setExpenseType(t)}
                className={`min-h-10 rounded-xl border px-3 font-medium capitalize ${
                  expenseType === t ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--dim)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input aria-label="Date" className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Payment method">
          <select aria-label="Payment method" className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>

      {state.accounts.length > 0 && (
        <Field label="Account (optional)">
          <select aria-label="Account" className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">No account</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
      )}

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
        <span className="font-medium">{kind === "income" ? "Recurring income" : "Recurring expense"}</span>
        <input type="checkbox" aria-label="Recurring" className="h-5 w-5 accent-[var(--accent)]" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
      </label>

      <Field label="Description">
        <input aria-label="Description" className={inputCls} placeholder={kind === "income" ? "e.g. Freelance project" : "e.g. Weekly groceries"} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <Field label="Notes (optional)">
        <input aria-label="Notes" className={inputCls} placeholder="Anything to remember" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {error && (
        <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </div>
      )}

      {duplicate ? (
        <button type="button" className={btnPrimary} disabled={saveMut.isPending} onClick={() => saveMut.mutate(true)}>
          Add anyway — it's not a duplicate
        </button>
      ) : (
        <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>
          {saveMut.isPending ? "Saving…" : editing ? "Save changes" : kind === "income" ? "Add income" : "Add expense"}
        </button>
      )}

      {editing && (
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--danger)] px-4 py-2 font-medium text-[var(--danger)]"
          disabled={deleteMut.isPending}
          onClick={() => {
            if (confirmDelete) deleteMut.mutate();
            else setConfirmDelete(true);
          }}
        >
          <IconTrash /> {confirmDelete ? "Tap again to delete" : "Delete transaction"}
        </button>
      )}
    </form>
  );
}

function FixedForm({
  state,
  initial,
  onClose,
}: {
  state: State;
  initial: FixedRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const editing = initial != null;
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const expenseOptions = useMemo(
    () => unique([...BUILT_IN_EXPENSE, ...state.categories.filter((c) => c.kind === "expense").map((c) => c.name)]),
    [state.categories],
  );
  const [category, setCategory] = useState(initial?.category ?? "Housing");
  const [paymentDay, setPaymentDay] = useState(initial ? String(initial.paymentDay) : "1");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "yearly">(initial?.frequency ?? "monthly");
  const [startMonth, setStartMonth] = useState(initial?.startMonth ?? "");
  const [endMonth, setEndMonth] = useState(initial?.endMonth ?? "");
  const [payMethod, setPayMethod] = useState(initial?.paymentMethod ?? "bank transfer");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["state"] });

  const saveMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      const day = Number(paymentDay);
      if (!name.trim()) throw new Error("Give this expense a name.");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
      if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error("Payment day must be between 1 and 31.");
      return await api.upsertFixedExpense({
        id: initial?.id ?? null,
        name: name.trim(),
        amount: amt,
        category: category.trim() || "Other",
        paymentDay: day,
        frequency,
        description: description.trim(),
        active,
        startMonth: startMonth === "" ? null : startMonth,
        endMonth: endMonth === "" ? null : endMonth,
        paymentMethod: payMethod,
      });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error ?? "Could not save. Try again.");
        return;
      }
      refresh();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save. Try again."),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!initial) throw new Error("Nothing to delete.");
      return await api.deleteFixedExpense({ id: initial.id });
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        saveMut.mutate();
      }}
    >
      <Field label="Name">
        <input aria-label="Fixed expense name" className={inputCls} placeholder="e.g. Rent, Netflix, Internet" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <input aria-label="Amount" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Payment day">
          <input aria-label="Payment day of month" className={inputCls} type="number" min="1" max="31" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} required />
        </Field>
      </div>
      <Field label="Category">
        <CategoryPicker kind="expense" options={expenseOptions} value={category} onChange={setCategory} />
      </Field>
      <Field label="Frequency">
        <select aria-label="Frequency" className={inputCls} value={frequency} onChange={(e) => setFrequency(e.target.value as "weekly" | "monthly" | "quarterly" | "yearly")}>
          <option value="weekly">Weekly (counted ×4 per month)</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start month (optional)">
          <input aria-label="Start month" className={inputCls} type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
        </Field>
        <Field label="End month (optional)">
          <input aria-label="End month" className={inputCls} type="month" value={endMonth ?? ""} onChange={(e) => setEndMonth(e.target.value)} />
        </Field>
      </div>
      <Field label="Payment method">
        <select aria-label="Fixed expense payment method" className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Field>
      <Field label="Description (optional)">
        <input aria-label="Description" className={inputCls} placeholder="e.g. Fiber 100 Mbps plan" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
        <span className="font-medium">Active</span>
        <input
          type="checkbox"
          aria-label="Active"
          className="h-5 w-5 accent-[var(--accent)]"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </label>
      {error && (
        <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>
        {saveMut.isPending ? "Saving…" : editing ? "Save changes" : "Add fixed expense"}
      </button>
      {editing && (
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--danger)] px-4 py-2 font-medium text-[var(--danger)]"
          disabled={deleteMut.isPending}
          onClick={() => {
            if (confirmDelete) deleteMut.mutate();
            else setConfirmDelete(true);
          }}
        >
          <IconTrash /> {confirmDelete ? "Tap again to delete" : "Delete fixed expense"}
        </button>
      )}
    </form>
  );
}

function BudgetForm({
  state,
  initial,
  onClose,
}: {
  state: State;
  initial: BudgetRow | null;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<"all" | "month">(initial?.month ? "month" : "all");
  const queryClient = useQueryClient();
  const expenseOptions = useMemo(
    () => unique([...BUILT_IN_EXPENSE, ...state.categories.filter((c) => c.kind === "expense").map((c) => c.name)]),
    [state.categories],
  );
  const [category, setCategory] = useState(initial?.category ?? "Restaurants");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["state"] });

  const saveMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a budget greater than zero.");
      return await api.upsertBudget({ category: category.trim(), amount: amt, month: scope === "month" ? state.month : null });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error ?? "Could not save. Try again.");
        return;
      }
      refresh();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save. Try again."),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!initial) throw new Error("Nothing to delete.");
      return await api.deleteBudget({ id: initial.id });
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        saveMut.mutate();
      }}
    >
      <Field label="Category">
        <CategoryPicker kind="expense" options={expenseOptions} value={category} onChange={setCategory} />
      </Field>
      <Field label="Monthly budget">
        <input aria-label="Monthly budget amount" className={`${inputCls} tnum text-xl font-semibold`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>
      <Field label="Applies to">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Budget scope">
          {([["all", "Every month"], ["month", `Only ${state.monthLabel}`]] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)} className={`min-h-10 rounded-xl border px-3 font-medium ${scope === v ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--dim)]"}`}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      {error && (
        <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>
        {saveMut.isPending ? "Saving…" : initial ? "Save budget" : "Add budget"}
      </button>
      {initial && (
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--danger)] px-4 py-2 font-medium text-[var(--danger)]"
          disabled={deleteMut.isPending}
          onClick={() => {
            if (confirmDelete) deleteMut.mutate();
            else setConfirmDelete(true);
          }}
        >
          <IconTrash /> {confirmDelete ? "Tap again to delete" : "Delete budget"}
        </button>
      )}
    </form>
  );
}


// ---------- accounts / goals / debts forms ----------

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["state"] });
}

function AccountForm({ initial, onClose }: { initial: AccountRow | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<"cash" | "bank" | "savings" | "other">(initial?.type ?? "bank");
  const [opening, setOpening] = useState(initial ? String(initial.openingBalance) : "0");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Give this account a name.");
      const ob = Number(opening);
      if (!Number.isFinite(ob)) throw new Error("Enter a valid opening balance.");
      return await api.upsertAccount({ id: initial?.id ?? null, name: name.trim(), type, openingBalance: ob, active: initial?.active ?? true });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  const deleteMut = useMutation({
    mutationFn: async () => await api.deleteAccount({ id: initial!.id }),
    onSuccess: () => { refresh(); onClose(); },
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <Field label="Account name"><input aria-label="Account name" className={inputCls} placeholder="e.g. CIH Bank, Cash wallet" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select aria-label="Account type" className={inputCls} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="cash">Cash</option><option value="bank">Bank account</option><option value="savings">Savings account</option><option value="other">Other</option>
          </select>
        </Field>
        <Field label="Opening balance"><input aria-label="Opening balance" className={`${inputCls} tnum`} inputMode="decimal" type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} required /></Field>
      </div>
      <p className="text-sm text-[var(--dim)]">The balance then moves with every transaction you assign to this account, plus transfers.</p>
      {error && <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{error}</div>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Add account"}</button>
      {initial && (
        <button type="button" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--danger)] px-4 py-2 font-medium text-[var(--danger)]" disabled={deleteMut.isPending} onClick={() => { if (confirmDelete) deleteMut.mutate(); else setConfirmDelete(true); }}>
          <IconTrash /> {confirmDelete ? "Tap again to delete" : "Delete account"}
        </button>
      )}
    </form>
  );
}

function TransferForm({ state, onClose }: { state: State; onClose: () => void }) {
  const refresh = useRefresh();
  const [from, setFrom] = useState(state.accounts[0] ? String(state.accounts[0].id) : "");
  const [to, setTo] = useState(state.accounts[1] ? String(state.accounts[1].id) : "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saveMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
      if (!from || !to || from === to) throw new Error("Choose two different accounts.");
      return await api.addTransfer({ fromAccountId: Number(from), toAccountId: Number(to), amount: amt, date, note: note.trim() });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From"><select aria-label="From account" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)}>{state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="To"><select aria-label="To account" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>{state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      </div>
      <Field label="Amount"><input aria-label="Transfer amount" className={`${inputCls} tnum text-xl font-semibold`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
      <Field label="Date"><input aria-label="Transfer date" className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <Field label="Note (optional)"><input aria-label="Transfer note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <p className="text-sm text-[var(--dim)]">Transfers move money between your own accounts — they never count as income or expenses.</p>
      {error && <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{error}</div>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : "Record transfer"}</button>
    </form>
  );
}

function GoalForm({ initial, onClose }: { initial: GoalRow | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(initial ? String(initial.targetAmount) : "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveMut = useMutation({
    mutationFn: async () => {
      const t = Number(target);
      if (!name.trim()) throw new Error("Give this goal a name.");
      if (!Number.isFinite(t) || t <= 0) throw new Error("Enter a target greater than zero.");
      return await api.upsertGoal({ id: initial?.id ?? null, name: name.trim(), targetAmount: t, targetDate: targetDate === "" ? null : targetDate, description: description.trim() });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  const deleteMut = useMutation({ mutationFn: async () => await api.deleteGoal({ id: initial!.id }), onSuccess: () => { refresh(); onClose(); } });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <Field label="Goal name"><input aria-label="Goal name" className={inputCls} placeholder="e.g. Emergency fund, Car, Travel" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target amount"><input aria-label="Target amount" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={target} onChange={(e) => setTarget(e.target.value)} required /></Field>
        <Field label="Target date (optional)"><input aria-label="Target date" className={inputCls} type="date" value={targetDate ?? ""} onChange={(e) => setTargetDate(e.target.value)} /></Field>
      </div>
      <Field label="Description (optional)"><input aria-label="Goal description" className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {error && <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{error}</div>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Create goal"}</button>
      {initial && (
        <button type="button" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--danger)] px-4 py-2 font-medium text-[var(--danger)]" disabled={deleteMut.isPending} onClick={() => { if (confirmDelete) deleteMut.mutate(); else setConfirmDelete(true); }}>
          <IconTrash /> {confirmDelete ? "Tap again to delete" : "Delete goal"}
        </button>
      )}
    </form>
  );
}

function GoalEntryForm({ goal, onClose }: { goal: GoalRow; onClose: () => void }) {
  const refresh = useRefresh();
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saveMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
      return await api.addGoalEntry({ goalId: goal.id, amount: mode === "add" ? amt : -amt, date, note: note.trim() });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <p className="text-sm text-[var(--dim)]">{goal.name} — saved so far is tracked separately from spending, so contributions never double-count as expenses.</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Contribution or withdrawal">
        {([["add", "Add money"], ["withdraw", "Withdraw"]] as const).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)} className={`min-h-11 rounded-xl border px-3 font-semibold ${mode === v ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--dim)]"}`}>{label}</button>
        ))}
      </div>
      <Field label="Amount"><input aria-label="Savings amount" className={`${inputCls} tnum text-xl font-semibold`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
      <Field label="Date"><input aria-label="Savings date" className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <Field label="Note (optional)"><input aria-label="Savings note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {error && <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{error}</div>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : mode === "add" ? "Add contribution" : "Record withdrawal"}</button>
    </form>
  );
}

function DebtForm({ initial, onClose }: { initial: DebtRow | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<"i_owe" | "owed_to_me" | "loan" | "installment">(initial?.kind ?? "i_owe");
  const [initialAmount, setInitialAmount] = useState(initial ? String(initial.initialAmount) : "");
  const [monthlyPayment, setMonthlyPayment] = useState(initial ? String(initial.monthlyPayment) : "");
  const [dueDay, setDueDay] = useState(initial ? String(initial.dueDay) : "1");
  const [interestRate, setInterestRate] = useState(initial ? String(initial.interestRate) : "0");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveMut = useMutation({
    mutationFn: async () => {
      const ia = Number(initialAmount);
      if (!name.trim()) throw new Error("Give this debt a name.");
      if (!Number.isFinite(ia) || ia <= 0) throw new Error("Enter an initial amount greater than zero.");
      return await api.upsertDebt({ id: initial?.id ?? null, name: name.trim(), kind, initialAmount: ia, monthlyPayment: Number(monthlyPayment) || 0, dueDay: Number(dueDay) || 1, interestRate: Number(interestRate) || 0, startDate: initial?.startDate ?? todayStr(), description: description.trim() });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  const deleteMut = useMutation({ mutationFn: async () => await api.deleteDebt({ id: initial!.id }), onSuccess: () => { refresh(); onClose(); } });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <Field label="Name"><input aria-label="Debt name" className={inputCls} placeholder="e.g. Car loan, Borrowed from a friend" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="Type">
        <select aria-label="Debt type" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="i_owe">I owe someone</option><option value="loan">Loan</option><option value="installment">Installments</option><option value="owed_to_me">Someone owes me</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Initial amount"><input aria-label="Initial amount" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={initialAmount} onChange={(e) => setInitialAmount(e.target.value)} required /></Field>
        <Field label="Monthly payment"><input aria-label="Monthly payment" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} /></Field>
        <Field label="Due day"><input aria-label="Due day" className={inputCls} type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></Field>
        <Field label="Interest rate % (optional)"><input aria-label="Interest rate" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} /></Field>
      </div>
      <Field label="Description (optional)"><input aria-label="Debt description" className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {error && <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{error}</div>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Add debt"}</button>
      {initial && (
        <button type="button" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--danger)] px-4 py-2 font-medium text-[var(--danger)]" disabled={deleteMut.isPending} onClick={() => { if (confirmDelete) deleteMut.mutate(); else setConfirmDelete(true); }}>
          <IconTrash /> {confirmDelete ? "Tap again to delete" : "Delete debt"}
        </button>
      )}
    </form>
  );
}

function DebtPaymentForm({ debt, currency, onClose }: { debt: DebtRow; currency: string; onClose: () => void }) {
  const refresh = useRefresh();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saveMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
      return await api.addDebtPayment({ debtId: debt.id, amount: amt, date, note: note.trim() });
    },
    onSuccess: (res) => { if (!res.ok) { setError(res.error ?? "Could not save."); return; } refresh(); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}>
      <p className="text-sm text-[var(--dim)]">{debt.name} — remaining {fmt(debt.remaining, currency)} of {fmt(debt.initialAmount, currency)}.</p>
      <Field label="Payment amount"><input aria-label="Debt payment amount" className={`${inputCls} tnum text-xl font-semibold`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
      <Field label="Date"><input aria-label="Debt payment date" className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <Field label="Note (optional)"><input aria-label="Debt payment note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {error && <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{error}</div>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : "Record payment"}</button>
    </form>
  );
}

// ---------- transaction row ----------

function TxRow({ tx, currency, onEdit }: { tx: Tx; currency: string; onEdit?: () => void }) {
  const isIncome = tx.kind === "income";
  const inner = (
    <>
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: isIncome ? "var(--accent)" : tx.expenseType === "fixed" ? "#3e7cb1" : "var(--danger)" }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{tx.description || tx.category}</span>
        <span className="block text-xs text-[var(--dim)]">
          {tx.category} · {prettyDate(tx.date)}
          {tx.source === "fixed" ? " · fixed expense" : tx.paymentMethod ? ` · ${tx.paymentMethod}` : ""}
        </span>
        {tx.note && <span className="block truncate text-xs text-[var(--dim)]">{tx.note}</span>}
      </span>
      <span className={`tnum font-semibold ${isIncome ? "text-[var(--accent)]" : ""}`}>
        {isIncome ? "+" : "−"}{fmt(tx.amount, currency).replace(/^-/, "").replace(/^−/, "")}
      </span>
    </>
  );
  if (onEdit) {
    return (
      <button type="button" onClick={onEdit} aria-label={`Edit ${tx.description || tx.category}`} className="flex w-full items-start gap-3 px-1 py-3 text-left">
        {inner}
      </button>
    );
  }
  return <div className="flex w-full items-start gap-3 px-1 py-3">{inner}</div>;
}

// ---------- dashboard ----------

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={cardCls}>
      <p className="text-xs font-medium tracking-wide text-[var(--dim)] uppercase">{label}</p>
      <p className="tnum mt-1 text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-[var(--dim)]">{sub}</p>}
    </div>
  );
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--text)",
  fontSize: 13,
};

function Dashboard({
  state,
  onSeeAll,
  onEditTx,
  onAddSalary,
  salaryBusy,
}: {
  state: State;
  onSeeAll: () => void;
  onEditTx: (tx: Tx) => void;
  onAddSalary: () => void;
  salaryBusy: boolean;
}) {
  const s = state.summary;
  const cur = state.currency;
  const isCurrentMonth = state.month === currentMonthKey();
  const chartData = state.series.slice(-6).map((m) => ({ ...m, short: m.label.split(" ")[0]?.slice(0, 3) ?? "" }));
  const hasChartData = state.series.some((m) => m.income > 0 || m.expenses > 0);
  const totalSplit = s.fixedExpenses + s.variableExpenses;
  const latest = state.transactions.slice(0, 5);
  const isEmpty = s.income === 0 && s.expenses === 0 && state.fixed.length === 0;

  return (
    <div className="space-y-4">
      {state.needsSalaryPrompt && isCurrentMonth && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
          <span className="text-[var(--accent)]"><IconWallet /></span>
          <p className="flex-1 text-sm">
            Your salary of <strong className="tnum">{state.salaryAmount != null ? fmt(state.salaryAmount, cur) : ""}</strong> isn't recorded for {state.monthLabel.split(" ")[0]} yet.
          </p>
          <button type="button" className={btnPrimary} disabled={salaryBusy} onClick={onAddSalary}>
            {salaryBusy ? "Adding…" : "Add it"}
          </button>
        </div>
      )}

      <section aria-label="Remaining balance" className="rounded-3xl bg-[var(--accent)] p-5 text-white">
        <p className="text-sm text-white/80">Remaining balance · {state.monthLabel}</p>
        <p className="tnum mt-1 text-4xl font-extrabold">{fmt(s.balance, cur)}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1">{s.spentPct}% of income spent</span>
          <span className="rounded-full bg-white/15 px-3 py-1">{s.savedPct}% saved</span>
          <span className="rounded-full bg-white/15 px-3 py-1">Income {fmt(s.income, cur)}</span>
        </div>
      </section>

      {isEmpty ? (
        <EmptyState
          title="Start with your salary"
          body="Add your monthly salary in Settings, log expenses with the + button, and this dashboard fills in automatically."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Salary" value={fmt(s.salary, cur)} sub={s.additionalIncome > 0 ? `+ ${fmt(s.additionalIncome, cur)} other income` : "No extra income"} />
            <StatCard label="Additional income" value={fmt(s.additionalIncome, cur)} sub={`Total income ${fmt(s.income, cur)}`} />
            <StatCard label="Total expenses" value={fmt(s.expenses, cur)} sub={`${s.expenseCount} expense${s.expenseCount === 1 ? "" : "s"} this month`} />
            <StatCard label="Fixed expenses" value={fmt(s.fixedExpenses, cur)} sub={`${s.fixedPctOfIncome}% of income`} />
            <StatCard label="Variable expenses" value={fmt(s.variableExpenses, cur)} sub={`${s.variablePctOfIncome}% of income`} />
            <StatCard label="Saved to goals" value={fmt(state.projections.totalSavingsSaved, cur)} sub={state.projections.totalSavingsTarget > 0 ? `of ${fmt(state.projections.totalSavingsTarget, cur)} targets` : "No goals yet"} />
            {state.accounts.length > 0 && <StatCard label="All accounts" value={fmt(state.totalAccountBalance, cur)} sub={`${state.accounts.length} account${state.accounts.length === 1 ? "" : "s"}`} />}
            {state.totalDebtOwed > 0 && <StatCard label="Debts outstanding" value={fmt(state.totalDebtOwed, cur)} sub={state.totalOwedToMe > 0 ? `${fmt(state.totalOwedToMe, cur)} owed to you` : "See Debts"} />}
          </div>

          <section className={cardCls} aria-label="Projection for this month">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display font-semibold">Projected end of month</h3>
              <span className="rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warn)]">Estimate</span>
            </div>
            <p className="tnum mt-1 text-2xl font-bold">{fmt(state.projections.projectedEndBalance, cur)}</p>
            <p className="mt-1 text-sm text-[var(--dim)]">
              After the {fmt(state.projections.upcomingFixedPending, cur)} of fixed charges still pending. Based on your actual income, paid charges and spending so far — not a promise.
            </p>
          </section>

          {state.unpaidBills.length > 0 && (
            <section className={cardCls} aria-label="Upcoming and unpaid bills">
              <h3 className="font-display mb-2 font-semibold">Bills still to pay</h3>
              <ul className="divide-y divide-[var(--border)]">
                {state.unpaidBills.slice(0, 5).map((b) => (
                  <li key={b.name} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>{b.name} <span className="text-[var(--dim)]">· due {prettyDate(b.dueDate)}</span>{b.status === "overdue" && <span className="ml-1 font-semibold text-[var(--danger)]">overdue</span>}</span>
                    <span className="tnum font-semibold">{fmt(b.amount, cur)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={cardCls} aria-label="Savings this month">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display font-semibold">Savings this month</h3>
              <span className={`tnum font-bold ${s.savings < 0 ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>{fmt(s.savings, cur)}</span>
            </div>
            <div className="mt-3">
              <ProgressBar pct={Math.max(0, s.savedPct)} tone={s.savings < 0 ? "over" : "ok"} />
            </div>
            <p className="mt-2 text-sm text-[var(--dim)]">
              {s.income > 0
                ? `Savings rate ${s.savedPct}% · average daily spending ${fmt(s.avgDaily, cur)}`
                : "Add income to see your savings rate."}
            </p>
            <div className="mt-3 flex items-baseline justify-between border-t border-[var(--border)] pt-3">
              <div>
                <p className="text-sm font-medium">Total savings (all months)</p>
                <p className="text-xs text-[var(--dim)]">Sum of leftover money: income − expenses, month by month</p>
              </div>
              <span className={`tnum text-lg font-bold ${state.lifetimeSavings < 0 ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>
                {fmt(state.lifetimeSavings, cur)}
              </span>
            </div>
          </section>

          {hasChartData && (
            <section className={cardCls} aria-label="Income versus expenses chart">
              <h3 className="font-display mb-3 font-semibold">Income vs expenses</h3>
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

          {totalSplit > 0 && (
            <section className={cardCls} aria-label="Fixed versus variable breakdown">
              <h3 className="font-display mb-3 font-semibold">Fixed vs variable</h3>
              <div className="flex h-4 w-full overflow-hidden rounded-full" aria-hidden="true">
                <div style={{ width: `${(s.fixedExpenses / totalSplit) * 100}%`, background: "#3e7cb1" }} />
                <div style={{ width: `${(s.variableExpenses / totalSplit) * 100}%`, background: "#e8a33d" }} />
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <p className="flex justify-between"><span><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: "#3e7cb1" }} />Fixed</span><span className="tnum font-medium">{fmt(s.fixedExpenses, cur)} · {Math.round((s.fixedExpenses / totalSplit) * 100)}%</span></p>
                <p className="flex justify-between"><span><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: "#e8a33d" }} />Variable</span><span className="tnum font-medium">{fmt(s.variableExpenses, cur)} · {Math.round((s.variableExpenses / totalSplit) * 100)}%</span></p>
              </div>
            </section>
          )}

          {s.categoryStats.length > 0 && (
            <section className={cardCls} aria-label="Spending by category">
              <h3 className="font-display mb-1 font-semibold">Where your money goes</h3>
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
      )}

      <section className={cardCls} aria-label="Latest transactions">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display font-semibold">Latest transactions</h3>
          <button type="button" className="min-h-9 px-2 text-sm font-medium text-[var(--accent)]" onClick={onSeeAll}>
            See all
          </button>
        </div>
        {latest.length === 0 ? (
          <p className="py-3 text-sm text-[var(--dim)]">No transactions in {state.monthLabel} yet. Tap + to add your first one.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {latest.map((tx) => (
              <TxRow key={`${tx.source}-${tx.id}`} tx={tx} currency={cur} onEdit={tx.source === "transaction" ? () => onEditTx(tx) : undefined} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- transactions tab ----------

function TransactionsTab({
  state,
  filters,
  onFilters,
  onEditTx,
}: {
  state: State;
  filters: { kind: string; category: string; type: string; search: string; sortBy: string; paymentMethod: string };
  onFilters: (f: { kind: string; category: string; type: string; search: string; sortBy: string; paymentMethod: string }) => void;
  onEditTx: (tx: Tx) => void;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const cur = state.currency;
  const categoryOptions = useMemo(
    () =>
      unique([
        ...BUILT_IN_EXPENSE,
        ...BUILT_IN_INCOME,
        ...state.categories.map((c) => c.name),
        ...state.summary.categoryStats.map((c) => c.category),
        ...state.transactions.map((t) => t.category),
      ]),
    [state.categories, state.summary.categoryStats, state.transactions],
  );
  const calDays = useMemo(() => {
    const [y = 1970, m = 1] = state.month.split("-").map(Number);
    const count = new Date(y, m, 0).getDate();
    const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
    const byDate = new Map<string, { income: number; expense: number }>();
    for (const t of state.allMonthTransactions) {
      if (t.source === "transfer") continue;
      const cur2 = byDate.get(t.date) ?? { income: 0, expense: 0 };
      if (t.kind === "income") cur2.income += t.amount; else cur2.expense += t.amount;
      byDate.set(t.date, cur2);
    }
    return { count, firstDow, byDate, y, m };
  }, [state.month, state.allMonthTransactions]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input aria-label="Search transactions" className={`${inputCls} flex-1`} placeholder="Search description, category, note…" value={filters.search} onChange={(e) => onFilters({ ...filters, search: e.target.value })} />
        <div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-[var(--border)] p-1" role="group" aria-label="History view">
          {(["list", "calendar"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-9 rounded-lg px-3 text-sm font-medium capitalize ${view === v ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--dim)]"}`}>{v}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Sort transactions" className={inputCls} value={filters.sortBy} onChange={(e) => onFilters({ ...filters, sortBy: e.target.value })}>
          <option value="date">Newest first</option>
          <option value="amount_desc">Amount: high to low</option>
          <option value="amount_asc">Amount: low to high</option>
        </select>
        <select aria-label="Filter by payment method" className={inputCls} value={filters.paymentMethod} onChange={(e) => onFilters({ ...filters, paymentMethod: e.target.value })}>
          <option value="all">All payment methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value="transfer">transfer</option>
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label="Filter by type"
          className={inputCls}
          value={filters.kind}
          onChange={(e) => onFilters({ ...filters, kind: e.target.value })}
        >
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
        </select>
        <select
          aria-label="Filter by category"
          className={inputCls}
          value={filters.category}
          onChange={(e) => onFilters({ ...filters, category: e.target.value })}
        >
          <option value="all">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Filter by fixed or variable"
          className={inputCls}
          value={filters.type}
          onChange={(e) => onFilters({ ...filters, type: e.target.value })}
        >
          <option value="all">Fixed + var.</option>
          <option value="fixed">Fixed only</option>
          <option value="variable">Variable only</option>
        </select>
      </div>

      <p className="text-sm text-[var(--dim)]">
        {state.transactionTotal} transaction{state.transactionTotal === 1 ? "" : "s"} in {state.monthLabel}
        {state.transactionTotal > state.transactions.length ? ` (showing ${state.transactions.length})` : ""}
      </p>

      {view === "calendar" ? (
        <section className={cardCls} aria-label="Calendar of financial activity">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[var(--dim)]">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: calDays.firstDow }, (_, i) => <span key={`blank-${i}`} />)}
            {Array.from({ length: calDays.count }, (_, i) => {
              const day = i + 1;
              const key = `${calDays.y}-${pad(calDays.m)}-${pad(day)}`;
              const agg = calDays.byDate.get(key);
              return (
                <div key={key} className="min-h-14 rounded-lg bg-[var(--surface-2)] p-1 text-center">
                  <p className="text-[11px] font-semibold">{day}</p>
                  {agg && agg.income > 0 && <p className="tnum text-[10px] font-medium text-[var(--accent)]">+{fmtShort(agg.income)}</p>}
                  {agg && agg.expense > 0 && <p className="tnum text-[10px] font-medium text-[var(--danger)]">−{fmtShort(agg.expense)}</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--dim)]">Daily totals from your real transactions in {state.monthLabel}. Transfers are excluded.</p>
        </section>
      ) : state.transactions.length === 0 ? (
        <EmptyState title="Nothing here yet" body="No transactions match this month and filters. Add one with the + button, or clear the filters." />
      ) : (
        <section className={cardCls} aria-label="Transaction history">
          <div className="divide-y divide-[var(--border)]">
            {state.transactions.map((tx) => (
              <TxRow key={`${tx.source}-${tx.id}`} tx={tx} currency={cur} onEdit={tx.source === "transaction" ? () => onEditTx(tx) : undefined} />
            ))}
          </div>
          <p className="pt-2 text-xs text-[var(--dim)]">Payments toward fixed expenses — full or partial — appear here automatically and are managed in the Fixed tab.</p>
        </section>
      )}
    </div>
  );
}

// ---------- fixed expenses tab ----------

function FixedTab({
  state,
  onEditFixed,
}: {
  state: State;
  onEditFixed: (f: FixedRow | null) => void;
}) {
  const queryClient = useQueryClient();
  const cur = state.currency;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["state"] });
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  const togglePaidMut = useMutation({
    mutationFn: async (f: FixedRow) =>
      await api.toggleFixedPayment({ fixedExpenseId: f.id, month: state.month, paid: !f.paidThisMonth }),
    onSuccess: refresh,
  });

  const recordPartialMut = useMutation({
    mutationFn: async (args: { fixed: FixedRow; amount: number }) =>
      await api.recordFixedPayment({ fixedExpenseId: args.fixed.id, month: state.month, amount: args.amount }),
    onSuccess: (res) => {
      if (!res.ok) {
        setPayError(res.error ?? "Could not save this payment. Try again.");
        return;
      }
      setPayError(null);
      setPayingId(null);
      setPayAmount("");
      refresh();
    },
    onError: (e) => setPayError(e instanceof Error ? e.message : "Could not save this payment."),
  });

  const deletePaymentMut = useMutation({
    mutationFn: async (paymentId: number) => await api.deleteFixedPayment({ id: paymentId }),
    onSuccess: refresh,
  });

  const toggleActiveMut = useMutation({
    mutationFn: async (f: FixedRow) =>
      await api.upsertFixedExpense({
        id: f.id,
        name: f.name,
        amount: f.amount,
        category: f.category,
        paymentDay: f.paymentDay,
        frequency: f.frequency,
        description: f.description,
        active: !f.active,
        startMonth: f.startMonth,
        endMonth: f.endMonth,
        paymentMethod: f.paymentMethod,
      }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Expected" value={fmt(state.fixedExpected, cur)} />
        <StatCard label="Paid" value={fmt(state.fixedPaid, cur)} />
        <StatCard label="Remaining" value={fmt(state.fixedPending, cur)} />
      </div>
      <p className="text-sm text-[var(--dim)]">For {state.monthLabel}. Use <strong>Pay part</strong> when you only pay some of an expense — for example 100 {cur} of a 700 {cur} bill. Only what you pay counts in your totals, and the rest shows as remaining.</p>

      {state.fixed.length === 0 ? (
        <EmptyState title="No fixed expenses yet" body="Add rent, subscriptions and bills here once, then pay them in full or in part each month." />
      ) : (
        <div className="space-y-3">
          {state.fixed.map((f) => {
            const pctPaid = f.amount > 0 ? Math.round((f.paidAmount / f.amount) * 100) : 0;
            const isPaying = payingId === f.id;
            return (
            <article key={f.id} className={`${cardCls} ${!f.active ? "opacity-60" : ""}`} aria-label={f.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display font-semibold">{f.name}</h3>
                  <p className="text-sm text-[var(--dim)]">
                    {f.category} · due {prettyDate(f.dueDate)}
                    {f.dueThisMonth && f.active && f.remainingAmount > 0 ? (f.daysUntilDue < 0 ? ` · ${Math.abs(f.daysUntilDue)}d overdue` : f.daysUntilDue === 0 ? " · due today" : ` · in ${f.daysUntilDue}d`) : ""} · {f.frequency}
                    {f.frequency === "weekly" ? ` · ${fmt(f.monthlyAmount, cur)}/month` : ""}
                    {f.endMonth ? ` · until ${f.endMonth}` : ""}
                  </p>
                  {f.description && <p className="truncate text-sm text-[var(--dim)]">{f.description}</p>}
                </div>
                <p className="tnum text-lg font-bold">{fmt(f.amount, cur)}</p>
              </div>

              {f.active && f.dueThisMonth && f.paidAmount > 0 && (
                <div className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span>Paid <strong className="tnum">{fmt(f.paidAmount, cur)}</strong></span>
                    <span className={f.remainingAmount > 0 ? "font-semibold" : "text-[var(--accent)]"}>
                      {f.remainingAmount > 0 ? <>Remaining <span className="tnum">{fmt(f.remainingAmount, cur)}</span></> : "Fully paid"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar pct={pctPaid} tone={f.paidThisMonth ? "ok" : "warn"} />
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--dim)]">{pctPaid}% paid</p>
                  {f.payments.length > 0 && (
                    <ul className="mt-2 divide-y divide-[var(--border)]">
                      {f.payments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                          <span className="text-[var(--dim)]">Payment</span>
                          <span className="flex items-center gap-2">
                            <span className="tnum font-medium">{fmt(p.amount, cur)}</span>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--danger)]"
                              onClick={() => deletePaymentMut.mutate(p.id)}
                              disabled={deletePaymentMut.isPending}
                              aria-label={`Remove payment of ${fmt(p.amount, cur)} for ${f.name}`}
                            >
                              <IconTrash />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {isPaying && (
                <form
                  className="mt-3 space-y-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)]/40 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPayError(null);
                    const amt = Number(payAmount);
                    if (!Number.isFinite(amt) || amt <= 0) {
                      setPayError("Enter an amount greater than zero.");
                      return;
                    }
                    if (amt > f.remainingAmount) {
                      setPayError(`That is more than the ${fmt(f.remainingAmount, cur)} remaining.`);
                      return;
                    }
                    recordPartialMut.mutate({ fixed: f, amount: amt });
                  }}
                >
                  <p className="text-sm font-medium">
                    Pay part of {f.name} — remaining is <span className="tnum font-bold">{fmt(f.remainingAmount, cur)}</span>
                  </p>
                  <div className="flex gap-2">
                    <input
                      aria-label={`Amount to pay for ${f.name}`}
                      className={`${inputCls} tnum flex-1 text-lg font-semibold`}
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="0.01"
                      max={f.remainingAmount}
                      placeholder={String(f.remainingAmount)}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => setPayAmount(String(f.remainingAmount))}
                    >
                      All {fmt(f.remainingAmount, cur)}
                    </button>
                  </div>
                  {payError && (
                    <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">{payError}</p>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" className={`${btnPrimary} flex-1`} disabled={recordPartialMut.isPending}>
                      {recordPartialMut.isPending ? "Saving…" : "Save payment"}
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => { setPayingId(null); setPayAmount(""); setPayError(null); }}
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-[var(--dim)]">Example: enter 100 and you will see Paid 100 {cur} · Remaining {fmt(Math.max(0, f.remainingAmount - (Number(payAmount) || 0)), cur)} before saving.</p>
                </form>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!f.active ? (
                  <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--dim)]">Inactive</span>
                ) : !f.dueThisMonth ? (
                  <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--dim)]">Not due this month</span>
                ) : f.paidThisMonth ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"><IconCheck /> Paid</span>
                ) : f.status === "overdue" ? (
                  <span className="rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-semibold text-[var(--danger)]">Overdue</span>
                ) : f.isPartiallyPaid ? (
                  <span className="rounded-full bg-[var(--warn-soft)] px-3 py-1 text-xs font-semibold text-[var(--warn)]">Partially paid · {fmt(f.remainingAmount, cur)} left</span>
                ) : f.status === "upcoming" ? (
                  <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--dim)]">Upcoming · {prettyDate(f.dueDate)}</span>
                ) : (
                  <span className="rounded-full bg-[var(--warn-soft)] px-3 py-1 text-xs font-semibold text-[var(--warn)]">Pending</span>
                )}
                <span className="flex-1" />
                {f.active && f.dueThisMonth && !f.paidThisMonth && (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      if (isPaying) {
                        setPayingId(null);
                        setPayAmount("");
                        setPayError(null);
                      } else {
                        setPayingId(f.id);
                        setPayAmount("");
                        setPayError(null);
                      }
                    }}
                    aria-label={`Pay part of ${f.name}`}
                    aria-expanded={isPaying}
                  >
                    Pay part
                  </button>
                )}
                {f.active && f.dueThisMonth && (
                  <button
                    type="button"
                    className={f.paidThisMonth ? btnGhost : btnPrimary}
                    disabled={togglePaidMut.isPending}
                    onClick={() => togglePaidMut.mutate(f)}
                    aria-label={f.paidThisMonth ? `Mark ${f.name} unpaid` : f.isPartiallyPaid ? `Pay remaining for ${f.name}` : `Mark ${f.name} paid`}
                  >
                    {f.paidThisMonth ? "Mark unpaid" : f.isPartiallyPaid ? "Pay rest" : "Mark paid"}
                  </button>
                )}
                <button type="button" className={btnGhost} onClick={() => toggleActiveMut.mutate(f)} aria-label={f.active ? `Deactivate ${f.name}` : `Activate ${f.name}`} disabled={toggleActiveMut.isPending}>
                  {f.active ? "Deactivate" : "Activate"}
                </button>
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)]" onClick={() => onEditFixed(f)} aria-label={`Edit ${f.name}`}>
                  <IconPencil />
                </button>
              </div>
            </article>
            );
          })}
        </div>
      )}

      <button type="button" className={`${btnPrimary} w-full`} onClick={() => onEditFixed(null)}>
        <IconPlus size={18} /> Add fixed expense
      </button>
    </div>
  );
}

// ---------- budgets tab ----------

function BudgetsTab({
  state,
  onEditBudget,
}: {
  state: State;
  onEditBudget: (b: BudgetRow | null) => void;
}) {
  const queryClient = useQueryClient();
  const cur = state.currency;
  const [copied, setCopied] = useState<string | null>(null);
  const copyMut = useMutation({
    mutationFn: async () => await api.copyBudgetsFromPreviousMonth({ month: state.month }),
    onSuccess: (res) => {
      setCopied(res.ok ? (res.id && res.id > 0 ? `Copied ${res.id} budget${res.id === 1 ? "" : "s"} from last month.` : "Nothing new to copy — this month already has them.") : (res.error ?? "Copy failed."));
      queryClient.invalidateQueries({ queryKey: ["state"] });
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[var(--dim)]">Monthly limits per category for {state.monthLabel}. Warnings appear at 75% and 90%; over 100% is exceeded. A month-only budget overrides the every-month one.</p>
        <button type="button" className={`${btnGhost} shrink-0`} disabled={copyMut.isPending} onClick={() => copyMut.mutate()}>
          Copy last month
        </button>
      </div>
      {copied && <p className="text-sm text-[var(--accent)]" role="status">{copied}</p>}
      {state.budgets.length === 0 ? (
        <EmptyState title="No budgets yet" body="Set a monthly limit for restaurants, shopping, transport — whatever you want to keep an eye on." />
      ) : (
        <div className="space-y-3">
          {state.budgets.map((b) => {
            const tone = b.warning === "exceeded" ? "over" : b.warning === "warning90" || b.warning === "watch75" ? "warn" : "ok";
            return (
              <article key={b.id} className={cardCls} aria-label={`${b.category} budget`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display font-semibold">{b.category} {b.monthSpecific && <span className="ml-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">{state.monthLabel.split(" ")[0]} only</span>}</h3>
                  <p className="tnum text-sm text-[var(--dim)]">
                    <span className="text-base font-bold text-[var(--text)]">{fmt(b.spent, cur)}</span> of {fmt(b.amount, cur)}
                  </p>
                </div>
                <div className="mt-3">
                  <ProgressBar pct={b.pctUsed} tone={tone} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className={`text-sm ${tone === "over" ? "font-semibold text-[var(--danger)]" : tone === "warn" ? "font-medium text-[var(--warn)]" : "text-[var(--dim)]"}`}>
                    {b.warning === "exceeded" ? (
                      <span className="inline-flex items-center gap-1"><IconAlert /> Budget exceeded — over by {fmt(Math.abs(b.remaining), cur)}</span>
                    ) : b.warning === "warning90" ? (
                      <span className="inline-flex items-center gap-1"><IconAlert /> 90% used — {fmt(b.remaining, cur)} left</span>
                    ) : b.warning === "watch75" ? (
                      <span className="inline-flex items-center gap-1"><IconAlert /> 75% used — {fmt(b.remaining, cur)} left</span>
                    ) : (
                      `${fmt(b.remaining, cur)} left · ${b.pctUsed}% used`
                    )}
                  </p>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)]" onClick={() => onEditBudget(b)} aria-label={`Edit ${b.category} budget`}>
                    <IconPencil />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <button type="button" className={`${btnPrimary} w-full`} onClick={() => onEditBudget(null)}>
        <IconPlus size={18} /> Add budget
      </button>
    </div>
  );
}

// ---------- insights tab ----------

function InsightStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="text-sm text-[var(--dim)]">{label}</span>
      <span className="tnum text-right font-semibold">{value}</span>
    </div>
  );
}

function InsightsTab({ state }: { state: State }) {
  const s = state.summary;
  const p = state.prevSummary;
  const cur = state.currency;
  const topCat = s.categoryStats[0];
  const lowCat = s.categoryStats.length > 1 ? s.categoryStats[s.categoryStats.length - 1] : undefined;
  const trendData = state.series.map((m) => ({ ...m, short: m.label.split(" ")[0]?.slice(0, 3) ?? "" }));
  const yearData = state.year.months.map((m) => ({ ...m, short: m.label.split(" ")[0]?.slice(0, 3) ?? "" }));
  const hasTrend = state.series.some((m) => m.income > 0 || m.expenses > 0);

  const compareRows: { label: string; now: number; before: number }[] = [
    { label: "Income", now: s.income, before: p.income },
    { label: "Expenses", now: s.expenses, before: p.expenses },
    { label: "Fixed expenses", now: s.fixedExpenses, before: p.fixedExpenses },
    { label: "Variable expenses", now: s.variableExpenses, before: p.variableExpenses },
    { label: "Savings", now: s.savings, before: p.savings },
  ];

  return (
    <div className="space-y-4">
      <section className={cardCls} aria-label="Key numbers">
        <h3 className="font-display mb-1 flex items-center gap-2 font-semibold"><span className="text-[var(--accent)]"><IconTrend /></span>{state.monthLabel} in numbers</h3>
        <div className="divide-y divide-[var(--border)]">
          <InsightStat label="Total income" value={fmt(s.income, cur)} />
          <InsightStat label="Total expenses" value={fmt(s.expenses, cur)} />
          <InsightStat label="Fixed share of expenses" value={s.expenses > 0 ? `${Math.round((s.fixedExpenses / s.expenses) * 100)}%` : "—"} />
          <InsightStat label="Variable share of expenses" value={s.expenses > 0 ? `${Math.round((s.variableExpenses / s.expenses) * 100)}%` : "—"} />
          <InsightStat label="Savings" value={fmt(s.savings, cur)} />
          <InsightStat label="Savings rate" value={s.income > 0 ? `${s.savedPct}%` : "—"} />
          <InsightStat label="Average daily spending" value={fmt(s.avgDaily, cur)} />
          <InsightStat label="Biggest spending category" value={topCat ? `${topCat.category} · ${fmt(topCat.amount, cur)}` : "—"} />
          <InsightStat label="Smallest spending category" value={lowCat ? `${lowCat.category} · ${fmt(lowCat.amount, cur)}` : "—"} />
          <InsightStat label="Biggest single expense" value={s.biggestExpense ? `${s.biggestExpense.description} · ${fmt(s.biggestExpense.amount, cur)}` : "—"} />
          <InsightStat label="Remaining balance" value={fmt(s.balance, cur)} />
        </div>
      </section>

      <section className={cardCls} aria-label="Observations">
        <h3 className="font-display mb-2 font-semibold">Observations</h3>
        <ul className="space-y-2">
          {state.insights.map((text, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </section>

      <section className={cardCls} aria-label="Month comparison">
        <h3 className="font-display mb-1 font-semibold">This month vs last month</h3>
        <div className="divide-y divide-[var(--border)]">
          {compareRows.map((r) => {
            const delta = r.now - r.before;
            return (
              <div key={r.label} className="flex items-baseline justify-between gap-2 py-2.5 text-sm">
                <span className="text-[var(--dim)]">{r.label}</span>
                <span className="tnum font-semibold">{fmt(r.now, cur)}</span>
                <span className={`tnum w-28 text-right text-xs ${delta === 0 ? "text-[var(--dim)]" : delta > 0 ? "text-[var(--warn)]" : "text-[var(--accent)]"}`}>
                  {delta === 0 ? "no change" : `${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta), cur)}`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {hasTrend && (
        <section className={cardCls} aria-label="Income expenses and savings trend">
          <h3 className="font-display mb-3 font-semibold">Income, expenses & savings trend</h3>
          <div className="h-56 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="short" tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v ?? 0), cur)} />
                <Line type="monotone" dataKey="income" name="Income" stroke="#0e6b5c" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#e4572e" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="savings" name="Savings" stroke="#3e7cb1" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--dim)]">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#0e6b5c" }} />Income</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#e4572e" }} />Expenses</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#3e7cb1" }} />Savings</span>
          </div>

          <h4 className="font-display mt-5 mb-3 font-semibold">Fixed vs variable by month</h4>
          <div className="h-48 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="short" tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v ?? 0), cur)} />
                <Bar dataKey="fixedExpenses" name="Fixed" stackId="e" fill="#3e7cb1" />
                <Bar dataKey="variableExpenses" name="Variable" stackId="e" fill="#e8a33d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className={cardCls} aria-label="Yearly overview">
        <h3 className="font-display mb-1 font-semibold">{state.year.year} overview</h3>
        <div className="grid grid-cols-3 gap-2 py-2 text-center">
          <div><p className="text-xs text-[var(--dim)]">Income</p><p className="tnum font-bold">{fmt(state.year.totalIncome, cur)}</p></div>
          <div><p className="text-xs text-[var(--dim)]">Expenses</p><p className="tnum font-bold">{fmt(state.year.totalExpenses, cur)}</p></div>
          <div><p className="text-xs text-[var(--dim)]">Savings</p><p className="tnum font-bold">{fmt(state.year.totalSavings, cur)}</p></div>
        </div>
        <p className="mb-2 text-center text-sm text-[var(--dim)]">
          All-time leftover savings: <strong className={`tnum ${state.lifetimeSavings < 0 ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>{fmt(state.lifetimeSavings, cur)}</strong>
        </p>
        <div className="h-44 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="short" tick={{ fill: "var(--dim)", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tickFormatter={fmtShort} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v ?? 0), cur)} />
              <Bar dataKey="income" name="Income" fill="#0e6b5c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#e4572e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}


// ---------- income & expenses tabs ----------

function IncomeTab({ state, onEditTx, onAdd }: { state: State; onEditTx: (tx: Tx) => void; onAdd: () => void }) {
  const cur = state.currency;
  const rows = state.allMonthTransactions.filter((t) => t.kind === "income");
  const s = state.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Salary" value={fmt(s.salary, cur)} sub={state.salaryCategory} />
        <StatCard label="Additional income" value={fmt(s.additionalIncome, cur)} sub="Bonuses, freelance, other" />
      </div>
      <p className="text-sm text-[var(--dim)]">All income received in {state.monthLabel}. Mark income as recurring in its form to label regular sources; your configured salary can be recorded in one tap from Home.</p>
      {rows.length === 0 ? (
        <EmptyState title="No income this month" body="Add a salary payment, bonus, freelance payment or any other income." />
      ) : (
        <section className={cardCls} aria-label="Income records">
          <div className="divide-y divide-[var(--border)]">
            {rows.map((tx) => (
              <TxRow key={`${tx.source}-${tx.id}`} tx={tx} currency={cur} onEdit={tx.source === "transaction" ? () => onEditTx(tx) : undefined} />
            ))}
          </div>
        </section>
      )}
      <button type="button" className={`${btnPrimary} w-full`} onClick={onAdd}><IconPlus size={18} /> Add income</button>
    </div>
  );
}

function ExpensesTab({ state, onEditTx, onAdd }: { state: State; onEditTx: (tx: Tx) => void; onAdd: () => void }) {
  const cur = state.currency;
  const rows = state.allMonthTransactions.filter((t) => t.kind === "expense" && t.expenseType === "variable");
  const total = rows.reduce((sum, t) => sum + t.amount, 0);
  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <p className="text-xs font-medium tracking-wide text-[var(--dim)] uppercase">Variable spending · {state.monthLabel}</p>
        <p className="tnum mt-1 text-2xl font-bold">{fmt(total, cur)}</p>
        <p className="text-sm text-[var(--dim)]">{rows.length} purchase{rows.length === 1 ? "" : "s"} — fixed charges live in the Fixed tab and are only counted once paid.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No variable expenses yet" body="Log groceries, coffee, fuel, restaurants — every daily purchase — with the quick add button." />
      ) : (
        <section className={cardCls} aria-label="Variable expenses">
          <div className="divide-y divide-[var(--border)]">
            {rows.map((tx) => (
              <TxRow key={`${tx.source}-${tx.id}`} tx={tx} currency={cur} onEdit={tx.source === "transaction" ? () => onEditTx(tx) : undefined} />
            ))}
          </div>
        </section>
      )}
      <button type="button" className={`${btnPrimary} w-full`} onClick={onAdd}><IconPlus size={18} /> Quick add expense</button>
    </div>
  );
}

// ---------- savings tab ----------

function SavingsTab({ state, onEditGoal, onAddEntry }: { state: State; onEditGoal: (g: GoalRow | null) => void; onAddEntry: (g: GoalRow) => void }) {
  const refresh = useRefresh();
  const cur = state.currency;
  const deleteEntryMut = useMutation({ mutationFn: async (id: number) => await api.deleteGoalEntry({ id }), onSuccess: refresh });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total saved" value={fmt(state.projections.totalSavingsSaved, cur)} />
        <StatCard label="Total targets" value={fmt(state.projections.totalSavingsTarget, cur)} />
      </div>
      <p className="text-sm text-[var(--dim)]">Contributions move money into a goal — they are savings, not expenses, so they never double-count in your spending.</p>
      {state.goals.length === 0 ? (
        <EmptyState title="No savings goals yet" body="Create a goal — emergency fund, car, phone, travel — then add contributions as you save." />
      ) : (
        <div className="space-y-3">
          {state.goals.map((g) => (
            <article key={g.id} className={cardCls} aria-label={g.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display font-semibold">{g.name}</h3>
                  {g.description && <p className="truncate text-sm text-[var(--dim)]">{g.description}</p>}
                  <p className="text-sm text-[var(--dim)]">
                    {g.targetDate ? `Target ${prettyDate(g.targetDate)}` : "No target date"}
                    {g.monthlyRequired != null && g.remaining > 0 ? ` · save ${fmt(g.monthlyRequired, cur)}/month` : ""}
                  </p>
                </div>
                <p className="tnum text-lg font-bold">{g.pct}%</p>
              </div>
              <div className="mt-3"><ProgressBar pct={g.pct} tone={g.pct >= 100 ? "ok" : "warn"} /></div>
              <p className="mt-2 text-sm"><span className="tnum font-semibold">{fmt(g.saved, cur)}</span> saved · <span className="tnum">{fmt(g.remaining, cur)}</span> to go of {fmt(g.targetAmount, cur)}</p>
              {g.entries.length > 0 && (
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {g.entries.slice(0, 4).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="text-[var(--dim)]">{prettyDate(e.date)}{e.note ? ` · ${e.note}` : ""}</span>
                      <span className="flex items-center gap-2">
                        <span className={`tnum font-medium ${e.amount < 0 ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>{e.amount < 0 ? "−" : "+"}{fmt(Math.abs(e.amount), cur)}</span>
                        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--danger)]" onClick={() => deleteEntryMut.mutate(e.id)} disabled={deleteEntryMut.isPending} aria-label={`Remove savings entry of ${fmt(Math.abs(e.amount), cur)} for ${g.name}`}><IconTrash /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" className={`${btnPrimary} flex-1`} onClick={() => onAddEntry(g)}>Add / withdraw</button>
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)]" onClick={() => onEditGoal(g)} aria-label={`Edit goal ${g.name}`}><IconPencil /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      <button type="button" className={`${btnPrimary} w-full`} onClick={() => onEditGoal(null)}><IconPlus size={18} /> New savings goal</button>
    </div>
  );
}

// ---------- debts tab ----------

const DEBT_KIND_LABEL: Record<DebtRow["kind"], string> = { i_owe: "I owe", owed_to_me: "Owed to me", loan: "Loan", installment: "Installments" };

function DebtsTab({ state, onEditDebt, onPayDebt }: { state: State; onEditDebt: (d: DebtRow | null) => void; onPayDebt: (d: DebtRow) => void }) {
  const refresh = useRefresh();
  const cur = state.currency;
  const deletePayMut = useMutation({ mutationFn: async (id: number) => await api.deleteDebtPayment({ id }), onSuccess: refresh });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="You owe" value={fmt(state.totalDebtOwed, cur)} />
        <StatCard label="Owed to you" value={fmt(state.totalOwedToMe, cur)} />
      </div>
      {state.debts.length === 0 ? (
        <EmptyState title="No debts tracked" body="Add a loan, installments, money you borrowed, or money you lent to someone." />
      ) : (
        <div className="space-y-3">
          {state.debts.map((d) => (
            <article key={d.id} className={cardCls} aria-label={d.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display font-semibold">{d.name}</h3>
                  <p className="text-sm text-[var(--dim)]">
                    {DEBT_KIND_LABEL[d.kind]} · due day {d.dueDay}
                    {d.monthlyPayment > 0 ? ` · ${fmt(d.monthlyPayment, cur)}/month` : ""}
                    {d.interestRate > 0 ? ` · ${d.interestRate}% interest` : ""}
                    {d.payoffDate && d.remaining > 0 ? ` · paid off around ${d.payoffDate}` : ""}
                  </p>
                  {d.description && <p className="truncate text-sm text-[var(--dim)]">{d.description}</p>}
                </div>
                <p className="tnum text-lg font-bold">{fmt(d.remaining, cur)}</p>
              </div>
              <div className="mt-3"><ProgressBar pct={d.pctPaid} tone={d.remaining <= 0 ? "ok" : "warn"} /></div>
              <p className="mt-2 text-sm">Paid <span className="tnum font-semibold">{fmt(d.paidTotal, cur)}</span> of {fmt(d.initialAmount, cur)} · {d.pctPaid}%</p>
              {d.payments.length > 0 && (
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {d.payments.slice(0, 4).map((pay) => (
                    <li key={pay.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="text-[var(--dim)]">{prettyDate(pay.date)}{pay.note ? ` · ${pay.note}` : ""}</span>
                      <span className="flex items-center gap-2">
                        <span className="tnum font-medium">{fmt(pay.amount, cur)}</span>
                        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--danger)]" onClick={() => deletePayMut.mutate(pay.id)} disabled={deletePayMut.isPending} aria-label={`Remove payment of ${fmt(pay.amount, cur)} for ${d.name}`}><IconTrash /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" className={`${btnPrimary} flex-1`} disabled={d.remaining <= 0} onClick={() => onPayDebt(d)}>{d.remaining <= 0 ? "Settled" : "Record payment"}</button>
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)]" onClick={() => onEditDebt(d)} aria-label={`Edit debt ${d.name}`}><IconPencil /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      <button type="button" className={`${btnPrimary} w-full`} onClick={() => onEditDebt(null)}><IconPlus size={18} /> Add debt or loan</button>
    </div>
  );
}

// ---------- accounts tab ----------

function AccountsTab({ state, onEditAccount, onTransfer }: { state: State; onEditAccount: (a: AccountRow | null) => void; onTransfer: () => void }) {
  const refresh = useRefresh();
  const cur = state.currency;
  const deleteTransferMut = useMutation({ mutationFn: async (id: number) => await api.deleteTransfer({ id }), onSuccess: refresh });
  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <p className="text-xs font-medium tracking-wide text-[var(--dim)] uppercase">Consolidated balance</p>
        <p className="tnum mt-1 text-2xl font-bold">{fmt(state.totalAccountBalance, cur)}</p>
        <p className="text-sm text-[var(--dim)]">Across {state.accounts.length} account{state.accounts.length === 1 ? "" : "s"}. Assign transactions to an account and its balance updates automatically.</p>
      </div>
      {state.accounts.length === 0 ? (
        <EmptyState title="No accounts yet" body="Add your cash wallet, bank account and savings account to track each balance separately." />
      ) : (
        <div className="space-y-3">
          {state.accounts.map((a) => (
            <article key={a.id} className={cardCls} aria-label={a.name}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-semibold">{a.name}</h3>
                  <p className="text-sm capitalize text-[var(--dim)]">{a.type} · opened at {fmt(a.openingBalance, cur)}</p>
                </div>
                <p className={`tnum text-lg font-bold ${a.balance < 0 ? "text-[var(--danger)]" : ""}`}>{fmt(a.balance, cur)}</p>
              </div>
              <p className="mt-2 text-sm text-[var(--dim)]">In {fmt(a.incomeTotal, cur)} · Out {fmt(a.expenseTotal, cur)} · Transfers +{fmt(a.transfersIn, cur)} / −{fmt(a.transfersOut, cur)}</p>
              <div className="mt-3 flex justify-end">
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)]" onClick={() => onEditAccount(a)} aria-label={`Edit account ${a.name}`}><IconPencil /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btnPrimary} onClick={() => onEditAccount(null)}><IconPlus size={18} /> Add account</button>
        <button type="button" className={btnGhost} disabled={state.accounts.length < 2} onClick={onTransfer}><IconArrowSwap /> Transfer</button>
      </div>
      {state.transfers.length > 0 && (
        <section className={cardCls} aria-label="Transfers">
          <h3 className="font-display mb-1 font-semibold">Transfers</h3>
          <ul className="divide-y divide-[var(--border)]">
            {state.transfers.slice(0, 10).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{t.fromName} → {t.toName} <span className="text-[var(--dim)]">· {prettyDate(t.date)}</span></span>
                <span className="flex items-center gap-2">
                  <span className="tnum font-semibold">{fmt(t.amount, cur)}</span>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--danger)]" onClick={() => deleteTransferMut.mutate(t.id)} disabled={deleteTransferMut.isPending} aria-label={`Delete transfer of ${fmt(t.amount, cur)}`}><IconTrash /></button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------- reports & projections ----------

function ReportsTab({ state, compareMonth, onCompareMonth }: { state: State; compareMonth: string; onCompareMonth: (m: string) => void }) {
  const cur = state.currency;
  const s = state.summary;
  const cmp = state.compareSummary;
  const [extraSavings, setExtraSavings] = useState("500");
  const extra = Number(extraSavings) || 0;
  const simMonthly = state.projections.projectedSavings + extra;
  const yearData = state.year.months.map((m) => ({ ...m, short: m.label.split(" ")[0]?.slice(0, 3) ?? "" }));
  const avgIncome = state.year.months.filter((m) => m.income > 0);
  const monthlyAvgExpenses = state.year.months.length ? state.year.totalExpenses / 12 : 0;
  return (
    <div className="space-y-4">
      <section className={cardCls} aria-label="Monthly report">
        <h3 className="font-display mb-1 font-semibold">{state.monthLabel} report</h3>
        <div className="divide-y divide-[var(--border)]">
          <InsightStat label="Total income" value={fmt(s.income, cur)} />
          <InsightStat label="Total expenses" value={fmt(s.expenses, cur)} />
          <InsightStat label="Fixed expenses (paid)" value={fmt(s.fixedExpenses, cur)} />
          <InsightStat label="Variable expenses" value={fmt(s.variableExpenses, cur)} />
          <InsightStat label="Savings / remaining" value={fmt(s.savings, cur)} />
          <InsightStat label="Savings rate" value={s.income > 0 ? `${s.savedPct}%` : "—"} />
          <InsightStat label="Opening position (accounts)" value={state.accounts.length ? fmt(state.totalAccountBalance, cur) : "No accounts tracked"} />
        </div>
      </section>

      <section className={cardCls} aria-label="Top categories and expenses">
        <h3 className="font-display mb-2 font-semibold">Top 5 spending categories</h3>
        {s.categoryStats.length === 0 ? <p className="text-sm text-[var(--dim)]">No spending recorded this month.</p> : (
          <ul className="space-y-1.5">
            {s.categoryStats.slice(0, 5).map((c, i) => (
              <li key={c.category} className="flex justify-between text-sm"><span>{i + 1}. {c.category}</span><span className="tnum font-medium">{fmt(c.amount, cur)} · {c.pctOfExpenses}%</span></li>
            ))}
          </ul>
        )}
        <h4 className="font-display mt-4 mb-2 font-semibold">Highest individual expenses</h4>
        {state.topExpenses.length === 0 ? <p className="text-sm text-[var(--dim)]">None yet.</p> : (
          <ul className="space-y-1.5">
            {state.topExpenses.map((e, i) => (
              <li key={i} className="flex justify-between text-sm"><span>{e.description} <span className="text-[var(--dim)]">· {prettyDate(e.date)}</span></span><span className="tnum font-medium">{fmt(e.amount, cur)}</span></li>
            ))}
          </ul>
        )}
        <h4 className="font-display mt-4 mb-2 font-semibold">Budget performance</h4>
        {state.budgets.length === 0 ? <p className="text-sm text-[var(--dim)]">No budgets set.</p> : (
          <ul className="space-y-1.5">
            {state.budgets.map((b) => (
              <li key={b.id} className="flex justify-between text-sm"><span>{b.category}</span><span className={`tnum font-medium ${b.warning === "exceeded" ? "text-[var(--danger)]" : ""}`}>{fmt(b.spent, cur)} / {fmt(b.amount, cur)} · {b.pctUsed}%</span></li>
            ))}
          </ul>
        )}
        <h4 className="font-display mt-4 mb-2 font-semibold">Outstanding unpaid bills</h4>
        {state.unpaidBills.length === 0 ? <p className="text-sm text-[var(--dim)]">All due charges are paid for {state.monthLabel}.</p> : (
          <ul className="space-y-1.5">
            {state.unpaidBills.map((b) => (
              <li key={b.name} className="flex justify-between text-sm"><span>{b.name} <span className="text-[var(--dim)]">· due {prettyDate(b.dueDate)}</span></span><span className="tnum font-medium">{fmt(b.amount, cur)}</span></li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardCls} aria-label="Compare months">
        <h3 className="font-display mb-2 font-semibold">Compare with another month</h3>
        <Field label="Compare month">
          <input aria-label="Month to compare" className={inputCls} type="month" value={compareMonth} onChange={(e) => onCompareMonth(e.target.value)} />
        </Field>
        {cmp ? (
          <div className="mt-3 divide-y divide-[var(--border)]">
            {([
              ["Income", s.income, cmp.income],
              ["Expenses", s.expenses, cmp.expenses],
              ["Fixed", s.fixedExpenses, cmp.fixedExpenses],
              ["Variable", s.variableExpenses, cmp.variableExpenses],
              ["Savings", s.savings, cmp.savings],
            ] as const).map(([label, now, other]) => (
              <div key={label} className="flex items-baseline justify-between gap-2 py-2 text-sm">
                <span className="text-[var(--dim)]">{label}</span>
                <span className="tnum font-semibold">{fmt(now, cur)}</span>
                <span className="tnum text-[var(--dim)]">vs {fmt(other, cur)} in {state.compareLabel}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-[var(--dim)]">Pick a month to compare against {state.monthLabel}.</p>}
        <p className="mt-3 text-sm text-[var(--dim)]">Year-to-date: income {fmt(state.year.totalIncome, cur)} · expenses {fmt(state.year.totalExpenses, cur)} · savings {fmt(state.year.totalSavings, cur)}. Average monthly expenses in {state.year.year}: {fmt(Math.round(monthlyAvgExpenses), cur)}{avgIncome.length ? "" : ""}.</p>
      </section>

      <section className={cardCls} aria-label="Annual overview chart">
        <h3 className="font-display mb-3 font-semibold">{state.year.year} — month by month</h3>
        <div className="h-44 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="short" tick={{ fill: "var(--dim)", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tickFormatter={fmtShort} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v ?? 0), cur)} />
              <Bar dataKey="income" name="Income" fill="#0e6b5c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#e4572e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="savings" name="Savings" fill="#3e7cb1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={cardCls} aria-label="Projections and simulator">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display font-semibold">Projections</h3>
          <span className="rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warn)]">Estimates only</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          <InsightStat label="Projected end-of-month balance" value={fmt(state.projections.projectedEndBalance, cur)} />
          <InsightStat label="Projected monthly savings" value={fmt(state.projections.projectedSavings, cur)} />
          <InsightStat label="Fixed charges still pending" value={fmt(state.projections.upcomingFixedPending, cur)} />
          <InsightStat label="Average variable spending (last 3 months)" value={fmt(state.projections.avgVariableLast3, cur)} />
          <InsightStat label="Average income (last 3 months)" value={fmt(state.projections.avgIncomeLast3, cur)} />
          <InsightStat label="Expected annual savings at this pace" value={fmt(state.projections.expectedAnnualSavings, cur)} />
        </div>
        <h4 className="font-display mt-4 mb-2 font-semibold">Scenario simulator</h4>
        <Field label="If I save extra each month">
          <input aria-label="Extra monthly savings" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="50" value={extraSavings} onChange={(e) => setExtraSavings(e.target.value)} />
        </Field>
        <p className="mt-2 text-sm">
          Saving an extra <strong className="tnum">{fmt(extra, cur)}</strong> a month means projected savings of <strong className="tnum">{fmt(simMonthly, cur)}</strong> per month — <strong className="tnum">{fmt(simMonthly * 12, cur)}</strong> over a year
          {state.goals[0] && state.goals[0].remaining > 0 && simMonthly > 0 ? <>, reaching your “{state.goals[0].name}” goal in about {Math.ceil(state.goals[0].remaining / simMonthly)} month{Math.ceil(state.goals[0].remaining / simMonthly) === 1 ? "" : "s"} at that pace</> : ""}.
        </p>
        <p className="mt-1 text-xs text-[var(--dim)]">Projections use your recorded income, fixed charges and recent spending patterns. They are estimates, clearly separate from your actual balances above.</p>
      </section>
    </div>
  );
}

// ---------- settings tab ----------

function SettingsTab({ state, onAddSalary, salaryBusy }: { state: State; onAddSalary: () => void; salaryBusy: boolean }) {
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState(state.currency);
  const [salaryAmount, setSalaryAmount] = useState(state.salaryAmount != null ? String(state.salaryAmount) : "");
  const [salaryDay, setSalaryDay] = useState(state.salaryDay != null ? String(state.salaryDay) : "1");
  const [salaryCategory, setSalaryCategory] = useState(state.salaryCategory);
  const [monthStartDay, setMonthStartDay] = useState(String(state.monthStartDay ?? 1));
  const [backupText, setBackupText] = useState("");
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [saved, setSaved] = useState(false);
  const [catName, setCatName] = useState("");
  const [catKind, setCatKind] = useState<"income" | "expense">("expense");
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["state"] });

  const saveMut = useMutation({
    mutationFn: async () =>
      await api.saveSettings({
        currency,
        salaryAmount: salaryAmount.trim() === "" ? null : Number(salaryAmount),
        salaryDay: salaryDay.trim() === "" ? null : Number(salaryDay),
        salaryCategory: salaryCategory.trim() || "Salary",
        monthStartDay: Math.min(28, Math.max(1, Number(monthStartDay) || 1)),
      }),
    onSuccess: (res) => {
      if (res.ok) {
        setSaved(true);
        refresh();
      }
    },
  });

  const addCatMut = useMutation({
    mutationFn: async () => await api.upsertCategory({ name: catName.trim(), kind: catKind }),
    onSuccess: () => {
      setCatName("");
      refresh();
    },
  });

  const deleteCatMut = useMutation({
    mutationFn: async (id: number) => await api.deleteCategory({ id }),
    onSuccess: refresh,
  });

  const exportMut = useMutation({
    mutationFn: async () => await api.exportData({}),
    onSuccess: (res) => {
      try {
        const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setExportError("Your browser blocked the download. Try again from the Transactions tab later.");
      }
    },
    onError: () => setExportError("Export failed. Try again."),
  });

  const clearMut = useMutation({
    mutationFn: async () => await api.clearAllData({}),
    onSuccess: () => {
      setConfirmClear(false);
      refresh();
    },
  });

  return (
    <div className="space-y-4">
      <section className={cardCls} aria-label="Currency and salary">
        <h3 className="font-display mb-3 font-semibold">Currency & salary</h3>
        <div className="space-y-4">
          <Field label="Currency">
            <select aria-label="Currency" className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly salary amount">
              <input aria-label="Monthly salary amount" className={`${inputCls} tnum`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="e.g. 12000" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} />
            </Field>
            <Field label="Salary payment day">
              <input aria-label="Salary payment day" className={inputCls} type="number" min="1" max="31" value={salaryDay} onChange={(e) => setSalaryDay(e.target.value)} />
            </Field>
          </div>
          <p className="text-sm text-[var(--dim)]">Day of the month your salary usually arrives. When you record this month’s salary, that entry is dated on this day.</p>
          <Field label="Salary category name">
            <input aria-label="Salary category name" className={inputCls} value={salaryCategory} onChange={(e) => setSalaryCategory(e.target.value)} />
          </Field>
          <Field label="Financial month starts on day">
            <input aria-label="Financial month start day" className={inputCls} type="number" min="1" max="28" value={monthStartDay} onChange={(e) => setMonthStartDay(e.target.value)} />
          </Field>
          <p className="text-sm text-[var(--dim)]">For payday-to-payday cycles (e.g. 25th → 24th). Saved for now; dashboards still use calendar months (1st–end).</p>
          <p className="text-sm text-[var(--dim)]">Locale: Morocco · dates shown day / month. Appearance follows your device's light or dark setting automatically.</p>
          <button type="button" className={`${btnPrimary} w-full`} disabled={saveMut.isPending} onClick={() => { setSaved(false); saveMut.mutate(); }}>
            {saveMut.isPending ? "Saving…" : "Save settings"}
          </button>
          {saved && <p className="text-center text-sm text-[var(--accent)]">Settings saved.</p>}
          <button type="button" className={`${btnGhost} w-full`} disabled={salaryBusy || !state.needsSalaryPrompt} onClick={onAddSalary}>
            {state.needsSalaryPrompt ? "Record this month's salary now" : state.salaryAmount != null ? "Salary already recorded this month" : "Set a salary amount to enable quick record"}
          </button>
        </div>
      </section>

      <section className={cardCls} aria-label="Custom categories">
        <h3 className="font-display mb-3 font-semibold">Custom categories</h3>
        <p className="mb-3 text-sm text-[var(--dim)]">Add your own labels (e.g. Pets, Gifts). Built-in categories stay available.</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!catName.trim() || addCatMut.isPending) return;
            addCatMut.mutate();
          }}
        >
          <Field label="Category name">
            <input
              aria-label="New category name"
              className={inputCls}
              placeholder="e.g. Pets, Gifts"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <div className="flex gap-2">
            <select
              aria-label="New category kind"
              className={`${inputCls} min-w-0 flex-1`}
              value={catKind}
              onChange={(e) => setCatKind(e.target.value as "income" | "expense")}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <button type="submit" className={`${btnPrimary} shrink-0 px-5`} disabled={!catName.trim() || addCatMut.isPending}>
              {addCatMut.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
        {state.categories.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--dim)]">No custom categories yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {state.categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">{c.name} <span className="text-[var(--dim)]">· {c.kind}</span></span>
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--danger)]" onClick={() => deleteCatMut.mutate(c.id)} aria-label={`Delete category ${c.name}`}>
                  <IconTrash />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardCls} aria-label="Your data">
        <h3 className="font-display mb-2 font-semibold">Your data</h3>
        <p className="mb-3 text-sm text-[var(--dim)]">Everything is stored in SalaryFlow's database and survives closing the app. Export a CSV any time as your backup.</p>
        <div className="space-y-2">
          <button type="button" className={`${btnGhost} w-full`} disabled={exportMut.isPending} onClick={() => { setExportError(null); exportMut.mutate(); }}>
            <IconDownload /> {exportMut.isPending ? "Preparing…" : "Export CSV (opens in Excel)"}
          </button>
          <BackupControls backupText={backupText} setBackupText={setBackupText} backupMsg={backupMsg} setBackupMsg={setBackupMsg} confirmImport={confirmImport} setConfirmImport={setConfirmImport} refresh={refresh} />
          {exportError && <p className="text-sm text-[var(--danger)]" role="alert">{exportError}</p>}
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--danger)] px-4 py-2 font-medium text-[var(--danger)]"
            disabled={clearMut.isPending}
            onClick={() => {
              if (confirmClear) clearMut.mutate();
              else setConfirmClear(true);
            }}
          >
            <IconTrash /> {confirmClear ? "Tap again to erase everything" : "Erase all data"}
          </button>
        </div>
      </section>

      <section className={cardCls} aria-label="Session">
        <h3 className="font-display mb-2 font-semibold">Session</h3>
        <p className="mb-3 text-sm text-[var(--dim)]">Lock the app on this device. You will need the app password again to unlock.</p>
        <button
          type="button"
          className={`${btnGhost} w-full`}
          onClick={() => {
            void fetch("/api/logout", { method: "POST" }).then(() => {
              window.location.href = "/login";
            });
          }}
        >
          Lock app
        </button>
      </section>

      <p className="px-1 text-center text-xs text-[var(--dim)]">SalaryFlow follows your device's light or dark appearance automatically.</p>
    </div>
  );
}

function BackupControls({
  backupText, setBackupText, backupMsg, setBackupMsg, confirmImport, setConfirmImport, refresh,
}: {
  backupText: string;
  setBackupText: (v: string) => void;
  backupMsg: string | null;
  setBackupMsg: (v: string | null) => void;
  confirmImport: boolean;
  setConfirmImport: (v: boolean) => void;
  refresh: () => void;
}) {
  const backupMut = useMutation({
    mutationFn: async () => await api.exportBackup({}),
    onSuccess: (res) => {
      try {
        const url = URL.createObjectURL(new Blob([res.json], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
        setBackupMsg("Backup downloaded. Keep it somewhere safe — it contains your full financial history.");
      } catch {
        setBackupMsg("Your browser blocked the download. Try again.");
      }
    },
    onError: () => setBackupMsg("Backup failed. Try again."),
  });
  const importMut = useMutation({
    mutationFn: async () => await api.importBackup({ json: backupText }),
    onSuccess: (res) => {
      if (!res.ok) { setBackupMsg(res.error ?? "Restore failed."); return; }
      setBackupText("");
      setConfirmImport(false);
      setBackupMsg("Backup restored. All sections now show the restored data.");
      refresh();
    },
    onError: () => setBackupMsg("Restore failed. Check the backup text and try again."),
  });
  return (
    <div className="space-y-2 border-t border-[var(--border)] pt-3">
      <button type="button" className={`${btnGhost} w-full`} disabled={backupMut.isPending} onClick={() => { setBackupMsg(null); backupMut.mutate(); }}>
        <IconDownload /> {backupMut.isPending ? "Preparing…" : "Download full backup (JSON)"}
      </button>
      <Field label="Restore a backup — paste its contents">
        <textarea aria-label="Backup contents" className={`${inputCls} min-h-24`} placeholder='{"version": 2, "transactions": […]}' value={backupText} onChange={(e) => setBackupText(e.target.value)} />
      </Field>
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--warn)] px-4 py-2 font-medium text-[var(--warn)] disabled:opacity-50"
        disabled={!backupText.trim() || importMut.isPending}
        onClick={() => { if (confirmImport) importMut.mutate(); else setConfirmImport(true); }}
      >
        {importMut.isPending ? "Restoring…" : confirmImport ? "Tap again — this replaces ALL current data" : "Restore backup"}
      </button>
      {backupMsg && <p className="text-sm text-[var(--dim)]" role="status">{backupMsg}</p>}
    </div>
  );
}

// ---------- app shell ----------

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
