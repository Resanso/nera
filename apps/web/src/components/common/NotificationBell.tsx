"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BellIcon, CalendarClockIcon, CheckCircleIcon, ListChecksIcon, ShieldAlertIcon, WalletIcon, XIcon } from "@nera/ui/icons";
import { useFinancialStore } from "../../context/FinancialStore";
import { useEmailSpendingStore } from "../../lib/emailSpending";
import { useEmailBalance } from "../../lib/emailBalance";
import { daysUntil, dueLabel, perDayNow, todayWib } from "../../lib/pocketProfile";
import { usePushState } from "../../lib/push";
import { ReminderToggle } from "../insights/ReminderToggle";

const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const SEEN_KEY = "nera-notif-seen";

type Item = {
  /** stable per occurrence: a new day, count or target is a new notice */
  id: string;
  icon: React.ElementType;
  tone: string;
  title: string;
  body: string;
  href: string;
};

/**
 * What needs the user's attention right now, built from data the app already has: a consent
 * to renew, receipts to check, a balance to confirm, money to set aside for a Rencana
 * dadakan. Nothing is stored for it except which notices this browser has seen.
 */
function useNotifications(): Item[] {
  const { status, transactions, consentOutdated, load } = useEmailSpendingStore();
  const pockets = useFinancialStore((s) => s.budgetPockets);
  const activity = useFinancialStore((s) => s.pocketActivity);
  const assetsSet = useFinancialStore((s) => s.assetsSet);
  const balance = useEmailBalance();

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(() => {
    const today = todayWib();
    const items: Item[] = [];
    if (consentOutdated)
      items.push({
        id: "consent-outdated",
        icon: ShieldAlertIcon,
        tone: "bg-[#FBEDED] text-[#A92F2F]",
        title: "Perbarui persetujuan impor email",
        body: "Isi persetujuannya berubah. Struk baru belum masuk sampai kamu setuju lagi.",
        href: "/email",
      });
    if (balance.needsCheck)
      items.push({
        id: `balance-check-${today}`,
        icon: WalletIcon,
        tone: "bg-[#FFF3D6] text-[#76520E]",
        title: "Saldomu perlu dicek",
        body: "Saldo yang bisa dipakai mengikuti struk email. Pastikan angkanya masih sama dengan saldo rekeningmu.",
        href: "/pockets",
      });
    for (const p of pockets) {
      if (!p.profile || !assetsSet) continue;
      const due = dueLabel(p.profile.dueDate);
      if (due.days < 0) continue;
      if (p.balance >= p.targetAmount && p.targetAmount > 0) {
        items.push({
          id: `reached-${p.id}-${p.targetAmount}`,
          icon: CheckCircleIcon,
          tone: "bg-[#E3F3E9] text-[#277449]",
          title: `${p.name} sudah terkumpul`,
          body: `Uang untuk ${p.profile.occasion} siap dipakai.`,
          href: "/pockets",
        });
        continue;
      }
      const toppedUpToday = activity.some((a) => a.pocketId === p.id && a.kind === "topup" && todayWib(new Date(a.at)) === today);
      const amount = perDayNow(p);
      if (toppedUpToday || amount <= 0) continue;
      items.push({
        id: `setaside-${p.id}-${today}`,
        icon: CalendarClockIcon,
        tone: "bg-[#FFF0BD] text-[#6D4C00]",
        title: daysUntil(p.profile.dueDate) === 0 ? `Hari ini: ${p.name}` : `Sisihkan ${rp(amount)} untuk ${p.name}`,
        body: daysUntil(p.profile.dueDate) === 0 ? `Kantongnya masih kurang ${rp(amount)}.` : `${due.date} · ${due.relative}`,
        href: "/pockets",
      });
    }
    if (status === "ready") {
      const review = transactions.filter((t) => t.needsReview && !t.dismissed).length;
      if (review > 0)
        items.push({
          id: `review-${review}`,
          icon: ListChecksIcon,
          tone: "bg-[#F1F2F4] text-[#2F240E]",
          title: `${review} transaksi perlu dicek`,
          body: "Belum dihitung ke pengeluaranmu sampai kamu konfirmasi.",
          href: "/email",
        });
    }
    return items;
  }, [status, transactions, consentOutdated, pockets, activity, assetsSet, balance.needsCheck]);
}

const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
};

export function NotificationBell() {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => setSeen(readSeen()), []);
  const unread = items.filter((i) => !seen.includes(i.id)).length;

  const show = () => {
    setOpen(true);
    const next = [...new Set([...items.map((i) => i.id), ...seen])].slice(0, 200);
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F5F5] text-[#2F240E] transition-colors hover:bg-[#FFF3D6] sm:h-9 sm:w-9"
        aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
      >
        <BellIcon size={22} className="text-[#2F240E]" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#FFB900] ring-2 ring-white" />}
      </button>
      {open && <NotificationSheet items={items} onClose={() => setOpen(false)} />}
    </>
  );
}

function NotificationSheet({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const router = useRouter();
  const [target, setTarget] = useState<Element | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const push = usePushState();

  useEffect(() => {
    setTarget(document.querySelector("[data-mobile-frame]") ?? document.body);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!target) return null;

  return createPortal(
    <div className="absolute inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Notifikasi">
      <button type="button" aria-label="Tutup" onClick={onClose} className="animate-overlay-in absolute inset-0 h-full w-full bg-[#2F240E]/45 backdrop-blur-[2px]" />
      <div className="animate-sheet-in pointer-events-none absolute inset-x-0 bottom-0 top-12 flex flex-col justify-end px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex max-h-full flex-col rounded-[26px] bg-white p-4 shadow-[0_-12px_40px_rgba(47,36,14,0.28)]">
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-[#D8D3C9]" />
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold text-[#2F240E]">Notifikasi</h2>
            <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-full text-[#736B60] hover:bg-[#F7F5F0]">
              <XIcon size={18} />
            </button>
          </div>

          <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
            {items.length === 0 && (
              <li className="rounded-2xl bg-[#F7F7F7] px-3 py-6 text-center text-[13px] text-[#736B60]">Belum ada yang perlu kamu urus. Mantap!</li>
            )}
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push(item.href);
                    }}
                    className="flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-[#FFF8E6]"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-snug text-[#2F240E]">{item.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-[#736B60]">{item.body}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {push.state && push.state !== "unsupported" && (
            <div className="mt-3 shrink-0 border-t border-[#F1EEE8] pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#76520E]">Pengingat di HP</p>
              <ReminderToggle state={push.state} showAmounts={push.showAmounts} onShowAmounts={push.setShowAmounts} onChange={push.refresh} notify={setMessage} />
              {message && <p className="mt-1.5 text-[11px] text-[#736B60]">{message}</p>}
            </div>
          )}
        </div>
      </div>
    </div>,
    target,
  );
}
