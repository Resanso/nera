"use client";

import { useMemo, useState } from "react";
import type { EmailTransaction } from "../../lib/emailImport";
import type { Period } from "../../lib/period";

/**
 * Charts for the Insight tab of /email, all for the selected period:
 * spending trend, top merchants and the weekday pattern. Categories are already in the
 * analysis card above, so they are not repeated here.
 * Single series everywhere, so one amber that clears 3:1 on white; values are always
 * printed beside the marks or in the readout, never colour alone.
 */
const BAR = "#B07A00";
const BAR_ACTIVE = "#7A5400";

const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const rpShort = (n: number) =>
  n >= 1_000_000 ? `Rp${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt` : n >= 1000 ? `Rp${Math.round(n / 1000)}rb` : `Rp${n}`;

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

type Bucket = { start: Date; label: string; tick: string; total: number; count: number };
type Unit = "day" | "week" | "month";

/** Day buckets up to a month, weeks up to ~4 months, months beyond. */
function buckets(txs: EmailTransaction[], period: Period): { unit: Unit; items: Bucket[] } {
  // "all time" starts at the oldest receipt instead of the year 2000
  const oldest = txs.reduce((min, t) => Math.min(min, Date.parse(t.occurredAt)), Date.now());
  const from = startOfDay(period.key === "all" ? new Date(oldest) : period.from);
  const to = new Date(Math.min(period.to.getTime(), Date.now() + 1));
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY));
  const unit: Unit = days <= 31 ? "day" : days <= 124 ? "week" : "month";

  const keyOf = (d: Date) => {
    if (unit === "day") return startOfDay(d);
    if (unit === "week") {
      const s = startOfDay(d);
      return new Date(s.getFullYear(), s.getMonth(), s.getDate() - ((s.getDay() + 6) % 7)); // Monday
    }
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };
  const next = (d: Date) =>
    unit === "day"
      ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      : unit === "week"
        ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
        : new Date(d.getFullYear(), d.getMonth() + 1, 1);

  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("id-ID", o);
  const items: Bucket[] = [];
  const index = new Map<number, Bucket>();
  for (let d = keyOf(from); d < to; d = next(d)) {
    const b: Bucket = {
      start: d,
      label:
        unit === "day"
          ? fmt({ weekday: "short", day: "numeric", month: "short" }).format(d)
          : unit === "week"
            ? `Minggu ${fmt({ day: "numeric", month: "short" }).format(d)}`
            : fmt({ month: "long", year: "numeric" }).format(d),
      tick: unit === "month" ? fmt({ month: "short" }).format(d) : fmt({ day: "numeric", month: "short" }).format(d),
      total: 0,
      count: 0,
    };
    items.push(b);
    index.set(d.getTime(), b);
  }
  for (const t of txs) {
    const b = index.get(keyOf(new Date(t.occurredAt)).getTime());
    if (b) (b.total += t.amount), b.count++;
  }
  return { unit, items };
}

const UNIT_WORD: Record<Unit, string> = { day: "hari", week: "minggu", month: "bulan" };

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] bg-white p-4">
      <h3 className="text-[14px] font-bold text-[#2F240E]">{title}</h3>
      {sub && <p className="mt-0.5 text-[11px] text-[#736B60]">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TrendChart({ txs, period }: { txs: EmailTransaction[]; period: Period }) {
  const { unit, items } = useMemo(() => buckets(txs, period), [txs, period]);
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((b) => b.total));
  const avg = items.reduce((s, b) => s + b.total, 0) / Math.max(1, items.length);
  const peak = items.reduce((best, b, i) => (b.total > items[best].total ? i : best), 0);
  const shownIdx = active ?? peak;
  const shown = items[shownIdx];
  // a handful of ticks, always the first and last
  const every = Math.max(1, Math.ceil(items.length / 5));
  const last = items.length - 1;
  const showTick = (i: number) => i === last || (i % every === 0 && last - i >= every / 2);

  return (
    <Card title="Tren pengeluaran" sub={`Per ${UNIT_WORD[unit]} · rata-rata ${rp(avg)}/${UNIT_WORD[unit]}`}>
      <div aria-live="polite" className="mb-2 flex items-baseline justify-between gap-2 rounded-xl bg-[#F7F7F7] px-3 py-2">
        <span className="truncate text-[11px] text-[#736B60]">
          {active === null ? "Tertinggi · " : ""}
          {shown?.label}
        </span>
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#2F240E]">
          {rp(shown?.total ?? 0)}
          <span className="ml-1 text-[11px] font-medium text-[#736B60]">· {shown?.count ?? 0} trx</span>
        </span>
      </div>
      <div className="relative h-32" onMouseLeave={() => setActive(null)}>
        {/* average line: the one reference the reader compares bars against */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-[#D8D3C9]"
          style={{ bottom: `${(avg / max) * 100}%` }}
        />
        <div role="list" className="absolute inset-0 flex items-end gap-[2px]">
          {items.map((b, i) => (
            <button
              key={b.start.getTime()}
              type="button"
              role="listitem"
              aria-label={`${b.label}: ${rp(b.total)}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              className="flex h-full min-w-0 flex-1 items-end justify-center"
            >
              <span
                className="block w-full max-w-6 rounded-t-[4px] transition-[height,background-color] duration-300"
                style={{
                  height: b.total > 0 ? `max(${(b.total / max) * 100}%, 3px)` : "0px",
                  background: i === shownIdx ? BAR_ACTIVE : BAR,
                }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex border-t border-[#E9E5DD] pt-1">
        {items.map((b, i) => (
          <span key={b.start.getTime()} className="relative min-w-0 flex-1 text-center text-[10px] text-[#A89F90]">
            {showTick(i) ? (
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{b.tick}</span>
            ) : null}
            &nbsp;
          </span>
        ))}
      </div>
    </Card>
  );
}

function MerchantList({ txs }: { txs: EmailTransaction[] }) {
  const rows = useMemo(() => {
    const totals = new Map<string, { name: string; amount: number; count: number }>();
    for (const t of txs) {
      const key = t.merchant.trim().toLowerCase();
      const r = totals.get(key) ?? { name: t.merchant, amount: 0, count: 0 };
      r.amount += t.amount;
      r.count++;
      totals.set(key, r);
    }
    return [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [txs]);

  return (
    <Card title="Merchant teratas" sub="5 tempat dengan pengeluaran terbesar">
      <ol className="divide-y divide-[#F1EEE8]">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-3 py-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF0BD] text-[11px] font-bold text-[#6D4C00]">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-[#2F240E]">{r.name}</span>
              <span className="block text-[11px] text-[#736B60]">{r.count}× transaksi</span>
            </span>
            <span className="shrink-0 text-[12px] font-bold tabular-nums text-[#2F240E]">{rpShort(r.amount)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const WEEKDAYS_LONG = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function WeekdayChart({ txs }: { txs: EmailTransaction[] }) {
  const totals = useMemo(() => {
    const t = Array(7).fill(0) as number[];
    for (const x of txs) t[(new Date(x.occurredAt).getDay() + 6) % 7] += x.amount;
    return t;
  }, [txs]);
  const max = Math.max(1, ...totals);
  const top = totals.indexOf(Math.max(...totals));

  return (
    <Card title="Pola harian" sub={`Paling banyak keluar di hari ${WEEKDAYS_LONG[top]}`}>
      <div className="flex h-24 items-end gap-2">
        {totals.map((v, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            {i === top && <span className="text-[10px] font-bold tabular-nums text-[#2F240E]">{rpShort(v)}</span>}
            <span
              title={`${WEEKDAYS_LONG[i]}: ${rp(v)}`}
              className="block w-full max-w-6 rounded-t-[4px]"
              style={{ height: v > 0 ? `max(${(v / max) * 70}%, 3px)` : "0px", background: i === top ? BAR_ACTIVE : BAR }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 border-t border-[#E9E5DD] pt-1">
        {WEEKDAYS.map((d, i) => (
          <span key={d} className={`flex-1 text-center text-[10px] ${i === top ? "font-bold text-[#2F240E]" : "text-[#A89F90]"}`}>
            {d}
          </span>
        ))}
      </div>
    </Card>
  );
}

/** `txs`: counted spending inside the period. */
export function SpendingCharts({ txs, period }: { txs: EmailTransaction[]; period: Period }) {
  if (txs.length === 0)
    return (
      <p className="rounded-[20px] bg-white px-4 py-6 text-center text-xs text-[#736B60]">
        Belum ada pengeluaran di periode ini.
      </p>
    );
  return (
    <>
      <TrendChart txs={txs} period={period} />
      <MerchantList txs={txs} />
      <WeekdayChart txs={txs} />
    </>
  );
}
