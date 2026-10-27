/** Time filters for email transactions, in the user's local time. `to` is exclusive. */
export type PeriodKey = "this_month" | "last_month" | "3m" | "6m" | "12m" | "all" | "custom";

export type Period = { key: PeriodKey; label: string; from: Date; to: Date };

export const PERIOD_PRESETS: { key: Exclude<PeriodKey, "custom">; label: string; short: string }[] = [
  { key: "this_month", label: "Bulan ini", short: "Bulan ini" },
  { key: "last_month", label: "Bulan lalu", short: "Bulan lalu" },
  { key: "3m", label: "3 bulan terakhir", short: "3 bln" },
  { key: "6m", label: "6 bulan terakhir", short: "6 bln" },
  { key: "12m", label: "1 tahun terakhir", short: "1 thn" },
  { key: "all", label: "Semua waktu", short: "Semua" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const fmt = (d: Date) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(d);

export function presetPeriod(key: Exclude<PeriodKey, "custom">, now = new Date()): Period {
  const label = PERIOD_PRESETS.find((p) => p.key === key)!.label;
  const y = now.getFullYear();
  const m = now.getMonth();
  const tomorrow = addDays(startOfDay(now), 1);
  switch (key) {
    case "this_month":
      return { key, label, from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
    case "last_month":
      return { key, label, from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
    case "3m":
    case "6m":
    case "12m": {
      const months = key === "3m" ? 3 : key === "6m" ? 6 : 12;
      return { key, label, from: new Date(y, m - months, now.getDate()), to: tomorrow };
    }
    case "all":
      return { key, label, from: new Date(2000, 0, 1), to: tomorrow };
  }
}

/** Inclusive dates from <input type="date"> ("2026-01-31"). */
export function customPeriod(fromValue: string, toValue: string): Period | null {
  const from = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
  const toDay = toValue ? new Date(`${toValue}T00:00:00`) : null;
  if (!from || !toDay || isNaN(+from) || isNaN(+toDay) || toDay < from) return null;
  return { key: "custom", label: `${fmt(from)} – ${fmt(toDay)}`, from, to: addDays(toDay, 1) };
}

export const inPeriod = (iso: string, p: Period) => {
  const t = Date.parse(iso);
  return t >= p.from.getTime() && t < p.to.getTime();
};

/** <input type="date"> value for a Date, local time. */
export const dateInputValue = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * When the monthly income should arrive next, from the day of the month the user set (31 falls
 * on the month's last day). `days` counts today up to the day before, the days the money
 * left now has to last; on payday itself the next one is a month away.
 */
export function nextIncome(day: number, now = new Date()) {
  const on = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date = on(today.getFullYear(), today.getMonth());
  if (date <= today) date = on(today.getFullYear(), today.getMonth() + 1);
  return { date, days: Math.round((date.getTime() - today.getTime()) / 86_400_000) };
}
