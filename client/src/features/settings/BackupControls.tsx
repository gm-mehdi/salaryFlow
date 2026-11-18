"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { IconDownload } from "../../components/icons";
import { Field, btnGhost, inputCls } from "../../components/ui";

export function BackupControls({
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

