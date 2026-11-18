"use client";

import { cardCls } from "./styles";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className={`${cardCls} py-8 text-center`}>
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--dim)]">{body}</p>
    </div>
  );
}
