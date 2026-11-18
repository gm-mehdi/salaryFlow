export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shiftMonthKey(key: string, delta: number): string {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function fmt(n: number, currency: string): string {
  const v = Math.abs(n);
  const s = v.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? "−" : ""}${s} ${currency}`;
}

export function fmtShort(n: number): string {
  if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}k`;
  return `${Math.round(n)}`;
}

export function prettyDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function unique(list: string[]): string[] {
  return [...new Set(list)];
}
