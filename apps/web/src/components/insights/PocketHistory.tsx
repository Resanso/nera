"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Mail, ReceiptText } from "lucide-react";
import type { PocketActivity } from "../../context/FinancialStore";
import type { EmailTransaction } from "../../lib/emailImport";

const PAGE = 15;

const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const day = (iso: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(iso));

type Row =
  | { kind: "email"; at: string; tx: EmailTransaction }
  | { kind: "activity"; at: string; a: PocketActivity };

const ACTIVITY = {
  topup: { label: "Isi dari Kantong Utama", icon: ArrowDownToLine, sign: "+" },
  withdraw: { label: "Tarik ke Kantong Utama", icon: ArrowUpFromLine, sign: "−" },
  spend: { label: "Pengeluaran", icon: ReceiptText, sign: "−" },
} as const;

/**
 * Everything that went into one pocket this month: receipts from email that land in it by
 * category, and what was recorded in the pocket itself (top ups, spending, withdrawals).
 * Email rows open the category editor, the way to move a receipt to another pocket.
 */
export function PocketHistory({
  emailTxs,
  activity,
  spentThisMonth,
  onEditEmail,
}: {
  /** counted email spending this month in this pocket's categories */
  emailTxs: EmailTransaction[];
  /** this pocket's own activity this month */
  activity: PocketActivity[];
  /** BNI spending the pocket reports this month, logged or not */
  spentThisMonth: number;
  onEditEmail: (tx: EmailTransaction) => void;
}) {
  const [shown, setShown] = useState(PAGE);
  const rows: Row[] = [
    ...emailTxs.map((tx) => ({ kind: "email" as const, at: tx.occurredAt, tx })),
    ...activity.map((a) => ({ kind: "activity" as const, at: a.at, a })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  const fromEmail = emailTxs.reduce((s, t) => s + t.amount, 0);
  const logged = activity.filter((a) => a.kind === "spend").reduce((s, a) => s + a.amount, 0);
  // demo pockets start with spending that has no entries behind it
  const earlier = Math.max(0, spentThisMonth - logged);

  return (
    <section aria-label="Riwayat kantong" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-bold text-[#2F240E]">Riwayat bulan ini</h3>
        <span className="text-[11px] text-[#736B60]">{rows.length} transaksi</span>
      </div>
      {fromEmail > 0 && (
        <p className="text-[11px] leading-relaxed text-[#736B60]">
          Terpakai {rp(fromEmail + logged + earlier)}: {rp(fromEmail)} dari struk email
          {logged + earlier > 0 && `, ${rp(logged + earlier)} dari kantong BNI`}. Ketuk struk email untuk melihat email aslinya atau memindahkannya.
        </p>
      )}

      {rows.length === 0 && earlier === 0 ? (
        <p className="rounded-2xl bg-[#F7F7F7] px-3 py-5 text-center text-xs text-[#736B60]">Belum ada transaksi di kantong ini bulan ini.</p>
      ) : (
        <ul className="divide-y divide-[#F1EEE8] rounded-2xl border border-[#F1EEE8]">
          {rows.slice(0, shown).map((r) => {
            if (r.kind === "email") {
              const t = r.tx;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onEditEmail(t)}
                    aria-label={`Ubah kategori ${t.merchant}`}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#FFF8E6]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF0BD] text-[#6D4C00]">
                      <Mail size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[#2F240E]">{t.merchant}</span>
                      <span className="block truncate text-[11px] text-[#736B60]">
                        {day(t.occurredAt)} · Email · {t.provider}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#2F240E]">−{rp(t.amount)}</span>
                    <ChevronRight size={16} className="shrink-0 text-[#A89F90]" />
                  </button>
                </li>
              );
            }
            const a = r.a;
            const meta = ACTIVITY[a.kind];
            const Icon = meta.icon;
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F2F4] text-[#2F240E]">
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[#2F240E]">{a.title || meta.label}</span>
                  <span className="block truncate text-[11px] text-[#736B60]">
                    {day(a.at)} · {a.kind === "spend" ? "Dicatat di kantong" : "Kantong BNI"}
                  </span>
                </span>
                <span className={`shrink-0 text-[13px] font-bold tabular-nums ${a.kind === "topup" ? "text-[#277449]" : "text-[#2F240E]"}`}>
                  {meta.sign}
                  {rp(a.amount)}
                </span>
                <span className="w-4 shrink-0" />
              </li>
            );
          })}
          {earlier > 0 && shown >= rows.length && (
            <li className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F2F4] text-[#2F240E]">
                <ReceiptText size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[#2F240E]">Pengeluaran BNI sebelumnya</span>
                <span className="block text-[11px] text-[#736B60]">Awal bulan, sebelum riwayat dicatat</span>
              </span>
              <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#2F240E]">−{rp(earlier)}</span>
              <span className="w-4 shrink-0" />
            </li>
          )}
        </ul>
      )}
      {rows.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="h-10 w-full rounded-[14px] border border-[#E9E5DD] text-[12px] font-semibold text-[#2F240E] hover:bg-[#FFF8E6]"
        >
          Tampilkan {Math.min(PAGE, rows.length - shown)} lagi
        </button>
      )}
    </section>
  );
}
