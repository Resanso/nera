"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";
import type { EmailTransaction } from "../../lib/emailImport";

const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const when = (iso: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** The transactions behind one figure in a chart (a merchant, a day), each opening its detail. */
export function TxListSheet({
  title,
  txs,
  onPick,
  onClose,
}: {
  title: string;
  txs: EmailTransaction[];
  onPick: (tx: EmailTransaction) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => {
    setTarget(document.querySelector("[data-mobile-frame]") ?? document.body);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!target) return null;

  const sorted = [...txs].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const total = txs.reduce((s, t) => s + t.amount, 0);

  return createPortal(
    <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Tutup" onClick={onClose} className="animate-overlay-in absolute inset-0 h-full w-full bg-[#2F240E]/45 backdrop-blur-[2px]" />
      <div className="animate-sheet-in pointer-events-none absolute inset-x-0 bottom-0 top-12 flex flex-col justify-end px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex pointer-events-auto max-h-full flex-col rounded-[26px] bg-white p-3 shadow-[0_-12px_40px_rgba(47,36,14,0.28)]">
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-[#D8D3C9]" />
          <div className="flex shrink-0 items-start gap-2 px-2 pb-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-[#2F240E]">{title}</p>
              <p className="text-[11px] text-[#736B60]">
                {txs.length} transaksi · <span className="tabular-nums">{rp(total)}</span> · ketuk untuk lihat email aslinya
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full text-[#736B60] hover:bg-[#F7F5F0]">
              <X size={18} />
            </button>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-[#F1EEE8] overflow-y-auto overscroll-contain">
            {sorted.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onPick(t)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-[#FFF8E6]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[#2F240E]">{t.merchant}</span>
                    <span className="block truncate text-[11px] text-[#736B60]">
                      {when(t.occurredAt)} · {t.provider}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#2F240E]">−{rp(t.amount)}</span>
                  <ChevronRight size={16} className="shrink-0 text-[#A89F90]" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    target,
  );
}
