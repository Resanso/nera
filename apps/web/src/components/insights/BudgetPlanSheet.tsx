"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import type { BudgetLine, BudgetPlan } from "../../lib/emailSpending";

const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const parseAmount = (raw: string) => Number(raw.replace(/\D/g, "")) || 0;

export type ChosenLine = BudgetLine & { budget: number };

/**
 * The "Pakai budget ini" screen: a complete budget proposed from the user's own receipts.
 * Every figure carries its reason; amounts can be edited and lines left out, but accepting
 * it as is takes one tap.
 */
export function BudgetPlanSheet({
  plan,
  income,
  onApply,
  onClose,
}: {
  plan: BudgetPlan;
  /** monthly income the user entered in Aset Saya; null until then */
  income: number | null;
  onApply: (lines: ChosenLine[]) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  const [rows, setRows] = useState(() => plan.lines.map((l) => ({ line: l, on: !l.occasional, amount: l.budget.toLocaleString("id-ID") })));

  useEffect(() => {
    setTarget(document.querySelector("[data-mobile-frame]") ?? document.body);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!target) return null;

  const chosen = rows.filter((r) => r.on && parseAmount(r.amount) > 0);
  const total = chosen.reduce((s, r) => s + parseAmount(r.amount), 0);
  const left = income === null ? null : income - total;
  const month = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date());
  const span = plan.months >= 2.5 ? "3 bulan" : plan.months >= 1.5 ? "2 bulan" : "1 bulan";
  const update = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return createPortal(
    <div className="absolute inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`Usulan budget ${month}`}>
      <button type="button" aria-label="Tutup" onClick={onClose} className="animate-overlay-in absolute inset-0 h-full w-full bg-[#2F240E]/45 backdrop-blur-[2px]" />
      <div className="animate-sheet-in pointer-events-none absolute inset-x-0 bottom-0 top-12 flex flex-col justify-end px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex pointer-events-auto max-h-full flex-col rounded-[26px] bg-white p-4 shadow-[0_-12px_40px_rgba(47,36,14,0.28)]">
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-[#D8D3C9]" />
          <div className="flex shrink-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#76520E]">Usulan dari {span} terakhir</p>
              <h2 className="mt-0.5 text-[20px] font-bold capitalize text-[#2F240E]">Budget {month}</h2>
              <p className="mt-0.5 text-[12px] text-[#736B60]">
                {income === null ? (
                  "Isi pemasukan bulanan di Aset Saya supaya Nera bisa membandingkannya."
                ) : (
                  <>
                    Pemasukan <span className="font-semibold tabular-nums text-[#2F240E]">{rp(income)}</span>/bulan
                  </>
                )}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full text-[#736B60] hover:bg-[#F7F5F0]">
              <X size={18} />
            </button>
          </div>

          <p className="mt-3 shrink-0 rounded-2xl bg-[#FFF8E6] px-3 py-2 text-[12px] leading-relaxed text-[#5C4A1E]">
            Tiap angka 90% dari rata-rata pengeluaranmu sendiri: sedikit lebih hemat, tapi masih realistis.
          </p>

          <ul className="mt-2 min-h-0 flex-1 divide-y divide-[#F1EEE8] overflow-y-auto overscroll-contain">
            {rows.map((r, i) => {
              const l = r.line;
              const amount = parseAmount(r.amount);
              return (
                <li key={l.category} className={`flex items-start gap-3 py-3 ${r.on ? "" : "opacity-50"}`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={r.on}
                    aria-label={`Pakai ${l.name}`}
                    onClick={() => update(i, { on: !r.on })}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${r.on ? "border-[#A36A00] bg-[#A36A00] text-white" : "border-[#D8D3C9] bg-white"}`}
                  >
                    {r.on && <Check size={13} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[14px] font-bold text-[#2F240E]">{l.name}</p>
                      <label className="flex shrink-0 items-center rounded-lg border border-[#E9E5DD] px-2 focus-within:border-[#76520E]">
                        <span className="text-[12px] font-semibold text-[#736B60]">Rp</span>
                        <input
                          id={`plan-${l.category}`}
                          type="text"
                          inputMode="numeric"
                          aria-label={`Budget ${l.name}`}
                          disabled={!r.on}
                          value={r.amount}
                          onChange={(e) => update(i, { amount: parseAmount(e.target.value).toLocaleString("id-ID") })}
                          className="w-[88px] bg-transparent py-1.5 pl-1 text-right text-[14px] font-bold tabular-nums text-[#2F240E] focus:outline-none"
                        />
                      </label>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F1EEE8]">
                      <div className="h-full rounded-full bg-[#B07A00]" style={{ width: `${income ? Math.min(100, (amount / income) * 100) : 0}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-[#736B60]">
                      rata-rata kamu <span className="tabular-nums">{rp(l.monthlyAvg)}</span>/bln
                      {l.topMerchants.length > 0 && ` · ${l.topMerchants.join(", ")}`}
                    </p>
                    {l.occasional && (
                      <p className="mt-0.5 text-[11px] leading-snug text-[#76520E]">
                        Sebagian besar dari satu pembayaran besar, jadi tidak dicentang. Lebih cocok jadi kantong tabungan.
                      </p>
                    )}
                    {l.pocket && (
                      <p className="text-[11px] text-[#736B60]">
                        Kantong {l.pocket.name} sekarang <span className="tabular-nums">{rp(l.pocket.target)}</span>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="shrink-0 space-y-3 border-t border-[#F1EEE8] pt-3">
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="text-[#736B60]">Total budget</span>
              <span className="font-bold tabular-nums text-[#2F240E]">{rp(total)}</span>
            </div>
            {left === null ? null : left >= 0 ? (
              <p className="text-[12px] text-[#277449]">
                Sisa <span className="font-semibold tabular-nums">{rp(left)}</span> bisa masuk tabungan.
              </p>
            ) : (
              <p className="text-[12px] leading-relaxed text-[#A92F2F]">
                Melebihi pemasukan <span className="font-semibold tabular-nums">{rp(-left)}</span>. Kurangi beberapa kantong, atau
                ini tanda pengeluaranmu sebagian dibayar dari sumber lain.
              </p>
            )}
            <button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => onApply(chosen.map((r) => ({ ...r.line, budget: parseAmount(r.amount) })))}
              className="h-12 w-full rounded-[14px] bg-[#FFB900] text-[15px] font-bold text-[#352500] hover:bg-[#E6A700] disabled:opacity-40"
            >
              Pakai budget ini
            </button>
          </div>
        </div>
      </div>
    </div>,
    target,
  );
}
