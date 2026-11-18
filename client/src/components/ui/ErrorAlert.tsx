"use client";

import type { ReactNode } from "react";

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
      {children}
    </div>
  );
}
