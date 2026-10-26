"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, EyeOff, Mail, Pencil, X } from "lucide-react";
import { useEmailSpendingStore } from "../../lib/emailSpending";
import { CATEGORY_LABEL, emailApi, type EmailCategory, type EmailTransaction, type OriginalEmail } from "../../lib/emailImport";

const SPENDING: EmailCategory[] = ["food", "transport", "shopping", "bills", "entertainment", "education", "travel", "other"];

/** Money that left the account without being spent: never counted in pockets. */
const NOT_SPENDING: { category: EmailCategory; label: string; hint: string }[] = [
  { category: "transfer", label: "Transfer ke orang lain", hint: "Patungan, bayar kos, kirim ke teman" },
  { category: "topup", label: "Pindah ke rekening/e-wallet sendiri", hint: "Top up GoPay, OVO, ke rekening lain milikmu" },
  { category: "investment", label: "Investasi", hint: "Saham, reksa dana, kripto" },
];

const merchantKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export type TransactionEdit = { category: EmailCategory; applyToMerchant: boolean } | { dismissed: true };

const CHANNEL: Record<EmailTransaction["channel"], string> = { gmail: "Gmail", forward: "Email diteruskan", demo: "Struk contoh" };

function statusOf(t: EmailTransaction, all: EmailTransaction[]) {
  if (t.dismissed) return "Disembunyikan, tidak dihitung";
  if (t.needsReview) return "Perlu dicek, belum dihitung sampai kamu konfirmasi";
  if (t.duplicateOf) return `Tidak dihitung: pembayaran yang sama sudah tercatat dari ${all.find((x) => x.id === t.duplicateOf)?.provider ?? "struk lain"}`;
  if (t.type === "income") return "Uang masuk, tidak dihitung sebagai pengeluaran";
  if (!t.countsTowardSpending) return `Tidak dihitung: ${CATEGORY_LABEL[t.category].toLowerCase()}, bukan belanja`;
  return "Dihitung sebagai pengeluaran";
}

/** The original email text with the amount Nera read marked, so the figure can be checked. */
function MarkedText({ text, amount }: { text: string; amount: number }) {
  const digits = amount.toLocaleString("id-ID");
  // "Rp 25.000", "Rp25.000,00", "IDR 25,000"
  const re = new RegExp(`((?:Rp|IDR)\\s?${digits.replace(/\./g, "[.,]")}(?:[.,]\\d{2})?)`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-[#FFE38A] px-0.5 font-bold text-[#2F240E]">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

/**
 * One email transaction: what Nera read and why it counts or not, the original email to
 * check the figure against, and fixes: its category (optionally for every receipt from the
 * same merchant, which Nera then remembers) or hiding it when Nera misread the email.
 */
export function TransactionSheet({
  tx,
  all,
  onSave,
  onClose,
  initialView = "detail",
}: {
  tx: EmailTransaction;
  /** every transaction, to count the same merchant's other rows */
  all: EmailTransaction[];
  onSave: (edit: TransactionEdit) => void;
  onClose: () => void;
  /** "edit" opens straight on the category picker */
  initialView?: "detail" | "edit";
}) {
  const [target, setTarget] = useState<Element | null>(null);
  const [view, setView] = useState<"detail" | "email" | "edit">(initialView);
  const [email, setEmail] = useState<{ status: "loading" } | { status: "ok"; data: OriginalEmail } | { status: "error"; message: string } | null>(null);
  const openEmail = async () => {
    setView("email");
    if (email?.status === "ok") return;
    setEmail({ status: "loading" });
    try {
      setEmail({ status: "ok", data: await emailApi.originalEmail(tx.id) });
    } catch (e) {
      setEmail({ status: "error", message: (e as Error).message });
    }
  };
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
    <div className="absolute inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Detail transaksi">
      <button type="button" aria-label="Tutup" onClick={onClose} className="animate-overlay-in absolute inset-0 h-full w-full bg-[#2F240E]/45 backdrop-blur-[2px]" />
      <div className="animate-sheet-in absolute inset-x-0 bottom-0 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex max-h-[85dvh] flex-col rounded-[26px] bg-white p-3 shadow-[0_-12px_40px_rgba(47,36,14,0.28)]">
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-[#D8D3C9]" />
          <div className="flex shrink-0 items-start gap-2 px-2 pb-2">
            {view !== "detail" && (
              <button
                type="button"
                onClick={() => (setView("detail"), setConfirmHide(false))}
                aria-label="Kembali"
                className="-ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#736B60] hover:bg-[#F7F5F0]"
              >
                <ChevronLeft size={20} />
              </button>
            )}
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
            {view === "detail" ? (
              <div className="space-y-3 px-2 pb-1">
                <p className="text-[26px] font-bold leading-tight tabular-nums text-[#2F240E]">
                  {tx.type === "income" ? "+" : "−"}
                  {rp}
                </p>
                <dl className="divide-y divide-[#F1EEE8] rounded-2xl border border-[#F1EEE8] text-[12px]">
                  {[
                    ["Tanggal", new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short" }).format(new Date(tx.occurredAt))],
                    ["Dari", `${tx.provider} · ${CHANNEL[tx.channel]}${tx.account ? ` (${tx.account})` : ""}`],
                    ["Kategori", CATEGORY_LABEL[tx.category]],
                    ["Status", statusOf(tx, all)],
                    ...(tx.externalRef ? [["No. pesanan", tx.externalRef]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 px-3 py-2.5">
                      <dt className="w-20 shrink-0 text-[#736B60]">{k}</dt>
                      <dd className="min-w-0 flex-1 font-medium text-[#2F240E]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={openEmail}
                    className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#FFB900] text-[13px] font-semibold text-[#352500] hover:bg-[#E6A700] active:scale-[0.96]"
                  >
                    <Mail size={16} />
                    Lihat email asli
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("edit")}
                    className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#E9E5DD] text-[13px] font-semibold text-[#2F240E] hover:bg-[#FFF8E6] active:scale-[0.96]"
                  >
                    <Pencil size={15} />
                    Ubah / sembunyikan
                  </button>
                </div>
              </div>
            ) : view === "email" ? (
              <div className="px-2 pb-1">
                {!email || email.status === "loading" ? (
                  <p className="py-8 text-center text-[12px] text-[#736B60]">Membuka email dari Gmail…</p>
                ) : email.status === "error" ? (
                  <p className="rounded-2xl bg-[#F7F7F7] px-3 py-6 text-center text-[12px] leading-relaxed text-[#736B60]">{email.message}</p>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-2xl bg-[#F7F7F7] px-3 py-2.5 text-[12px]">
                      <p className="font-bold text-[#2F240E]">{email.data.subject}</p>
                      <p className="mt-0.5 break-all text-[#736B60]">{email.data.from}</p>
                      <p className="text-[#736B60]">
                        {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(email.data.date))}
                      </p>
                    </div>
                    <p className="text-[11px] text-[#736B60]">
                      Nominal yang dibaca Nera ditandai kuning. Email ini dibuka langsung dari Gmail dan tidak disimpan.
                    </p>
                    <div className="whitespace-pre-wrap break-words rounded-2xl border border-[#F1EEE8] px-3 py-3 text-[12px] leading-relaxed text-[#4A3F2C]">
                      <MarkedText text={email.data.text} amount={tx.amount} />
                    </div>
                  </div>
                )}
              </div>
            ) : confirmHide ? (
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

          {view === "edit" && !confirmHide && (
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

/**
 * Opens the detail sheet from anywhere a transaction is listed (Beranda, charts), with the
 * save path every caller needs: write the change, then reload the shared email store.
 */
export function useTransactionDetail(notify: (message: string) => void) {
  const all = useEmailSpendingStore((s) => s.transactions);
  const [open, setOpen] = useState<{ tx: EmailTransaction; view: "detail" | "edit" } | null>(null);

  const save = async (tx: EmailTransaction, edit: TransactionEdit) => {
    setOpen(null);
    try {
      const r = await emailApi.editTransaction(tx.id, edit);
      await useEmailSpendingStore.getState().load(true);
      if ("dismissed" in edit) notify(`${tx.merchant} disembunyikan`);
      else notify(`${r.alsoChanged > 0 ? `${r.alsoChanged + 1} transaksi ` : ""}${tx.merchant} sekarang ${CATEGORY_LABEL[edit.category]}`);
    } catch (e) {
      notify((e as Error).message);
    }
  };

  return {
    open: (tx: EmailTransaction, view: "detail" | "edit" = "detail") => setOpen({ tx, view }),
    sheet: open && (
      <TransactionSheet
        key={open.tx.id}
        tx={open.tx}
        all={all}
        initialView={open.view}
        onClose={() => setOpen(null)}
        onSave={(edit) => save(open.tx, edit)}
      />
    ),
  };
}
