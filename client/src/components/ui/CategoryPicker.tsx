"use client";

import { useState } from "react";
import { inputCls } from "./styles";

export function CategoryPicker({
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
