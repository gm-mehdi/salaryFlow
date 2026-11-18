"use client";

import type { ReactNode } from "react";
import { labelCls } from "./styles";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}
