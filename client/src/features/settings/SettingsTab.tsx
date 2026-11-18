"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { CURRENCIES } from "../../lib/constants";
import { fmt } from "../../lib/format";
import type { State } from "../../lib/types";
import { useRefresh } from "../../hooks/useRefresh";
import { IconDownload, IconTrash } from "../../components/icons";
import { Field, cardCls, inputCls, btnPrimary, btnGhost } from "../../components/ui";
import { BackupControls } from "./BackupControls";


export function SettingsTab({ state, onAddSalary, salaryBusy }: { state: State; onAddSalary: () => void; salaryBusy: boolean }) {
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

  const refresh = useRefresh();

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
        <h2 className="font-display mb-3 font-semibold">Currency & salary</h2>
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
        <h2 className="font-display mb-3 font-semibold">Custom categories</h2>
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
        <h2 className="font-display mb-2 font-semibold">Your data</h2>
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
        <h2 className="font-display mb-2 font-semibold">Session</h2>
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

