"use client";

import { useState } from "react";
import { IconTrash } from "../icons";

export function ConfirmDeleteButton({
  label,
  onConfirm,
  disabled,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--danger)] px-4 py-2 font-medium text-[var(--danger)]"
      disabled={disabled}
      onClick={() => {
        if (confirmDelete) onConfirm();
        else setConfirmDelete(true);
      }}
    >
      <IconTrash /> {confirmDelete ? "Tap again to delete" : label}
    </button>
  );
}
