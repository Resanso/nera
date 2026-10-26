"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, EyeOff, X } from "lucide-react";
import { CATEGORY_LABEL, type EmailCategory, type EmailTransaction } from "../../lib/emailImport";

const SPENDING: EmailCategory[] = ["food", "transport", "shopping", "bills", "entertainment", "education", "travel", "other"];

/** Money that left the account without being spent: never counted in pockets. */
const NOT_SPENDING: { category: EmailCategory; label: string; hint: string }[] = [
  { category: "transfer", label: "Transfer ke orang lain", hint: "Patungan, bayar kos, kirim ke teman" },
  { category: "topup", label: "Pindah ke rekening/e-wallet sendiri", hint: "Top up GoPay, OVO, ke rekening lain milikmu" },
  { category: "investment", label: "Investasi", hint: "Saham, reksa dana, kripto" },
];

const merchantKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export type TransactionEdit = { category: EmailCategory; applyToMerchant: boolean } | { dismissed: true };

/**
 * Fix how one email transaction is read: its category (optionally for every receipt from
 * the same merchant, which Nera then remembers) or hide it when Nera misread the email.
 */
export function TransactionSheet({
  tx,
  all,
  onSave,
  onClose,
}: {
  tx: EmailTransaction;
  /** every transaction, to count the same merchant's other rows */
  all: EmailTransaction[];
  onSave: (edit: TransactionEdit) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  const [category, setCategory] = useState<EmailCategory>(tx.category);
  const others = all.filter((t) => t.id !== tx.id && !t.dismissed && merchantKey(t.merchant) === merchantKey(tx.merchant)).length;
  // a payee from a bank notification ("WARTEG ARJUNA") is one kind of spending; a platform's
  // own receipts ("Grab", "Shopee") mix food, rides and goods, so those start unticked
  const [applyAll, setApplyAll] = useState(merchantKey(tx.merchant) !== merchantKey(tx.provider));
  const [confirmHide, setConfirmHide] = useState(false);

  useEffect(() => {
    setTarget(document.querySelector("[data-mobile-frame]") ?? document.body);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!target) return null;

  const rp = `Rp${tx.amount.toLocaleString("id-ID")}`;
  const chip = (c: EmailCategory, label: string, hint?: string) => {
    const selected = category === c;
    return (
      <button
        key={c}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => setCategory(c)}
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${selected ? "bg-[#FFF8E6]" : "hover:bg-[#F7F5F0]"}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[#2F240E]">{label}</span>
          {hint && <span className="block text-[11px] text-[#736B60]">{hint}</span>}
        </span>
        {selected && <Check size={18} className="shrink-0 text-[#A36A00]" />}
      </button>
    );
  };

  return createPortal(
    <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label="Ubah transaksi">
      <button type="button" aria-label="Tutup" onClick={onClose} className="animate-overlay-in absolute inset-0 h-full w-full bg-[#2F240E]/45 backdrop-blur-[2px]" />
      <div className="animate-sheet-in absolute inset-x-0 bottom-0 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex max-h-[85dvh] flex-col rounded-[26px] bg-white p-3 shadow-[0_-12px_40px_rgba(47,36,14,0.28)]">
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-[#D8D3C9]" />
          <div className="flex shrink-0 items-start gap-2 px-2 pb-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-[#2F240E]">{tx.merchant}</p>
              <p className="text-[11px] text-[#736B60]">
                {tx.provider} · <span className="tabular-nums">{rp}</span>
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full text-[#736B60] hover:bg-[#F7F5F0]">
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {confirmHide ? (
              <div className="space-y-3 px-2 py-2">
                <p className="text-[13px] leading-relaxed text-[#2F240E]">
                  Sembunyikan transaksi ini? Nominalnya tidak lagi dihitung di kantong dan grafik. Pakai ini kalau Nera salah
                  membaca email, misalnya email promo atau nominal yang keliru.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirmHide(false)} className="h-11 rounded-[14px] border border-[#E9E5DD] text-sm font-semibold text-[#2F240E]">
                    Batal
                  </button>
                  <button type="button" onClick={() => onSave({ dismissed: true })} className="h-11 rounded-[14px] bg-[#A92F2F] text-sm font-semibold text-white">
                    Sembunyikan
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#736B60]">Pengeluaran</p>
                <div role="radiogroup" aria-label="Kategori pengeluaran" className="grid grid-cols-2">
                  {SPENDING.map((c) => chip(c, CATEGORY_LABEL[c]))}
                </div>
                <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-[#736B60]">Bukan belanja · tidak dihitung</p>
                <div role="radiogroup" aria-label="Bukan belanja">
                  {NOT_SPENDING.map((n) => chip(n.category, n.label, n.hint))}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmHide(true)}
                  className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[#A92F2F] hover:bg-[#FBEDED]"
                >
                  <EyeOff size={16} className="shrink-0" />
                  <span className="text-[13px] font-semibold">Nera salah baca, sembunyikan</span>
                </button>
              </>
            )}
          </div>

          {!confirmHide && (
            <div className="shrink-0 space-y-2 border-t border-[#F1EEE8] px-1 pt-3">
              {category !== "other" && (
                <label className="flex items-start gap-2.5 px-2 text-[12px] leading-snug text-[#2F240E]">
                  <input
                    id="apply-merchant"
                    type="checkbox"
                    checked={applyAll}
                    onChange={(e) => setApplyAll(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#A36A00]"
                  />
                  <span>
                    {others > 0 ? `Terapkan juga ke ${others} transaksi lain dari ` : "Ingat untuk transaksi berikutnya dari "}
                    <b>{tx.merchant}</b>
                    {others > 0 && " dan berikutnya"}
                  </span>
                </label>
              )}
              <button
                type="button"
                disabled={category === tx.category && !(applyAll && others > 0 && category !== "other")}
                onClick={() => onSave({ category, applyToMerchant: applyAll && category !== "other" })}
                className="h-11 w-full rounded-[14px] bg-[#FFB900] text-sm font-semibold text-[#352500] hover:bg-[#E6A700] disabled:opacity-40"
              >
                Simpan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    target,
  );
}
