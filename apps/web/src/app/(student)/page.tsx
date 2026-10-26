"use client";

import React, { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { TopAppBar } from "../../components/common/TopAppBar";
import { useFinancialStore } from "../../context/FinancialStore";
import { POCKET_CATEGORIES, useEmailSpending, useEmailSpendingStore, weeklyJump } from "../../lib/emailSpending";
import { EmailPlanningConsent } from "../../components/consent/ConsentCard";
import { useEmailBalanceSync } from "../../lib/emailBalance";
import { emailApi } from "../../lib/emailImport";
import { NeraOrb } from "../../components/mascot/NeraOrb";
import type { NeraMood } from "../../components/mascot/moods";
import type { EmailCategory, EmailTransaction } from "../../lib/emailImport";
import { useTransactionDetail } from "../../components/insights/TransactionSheet";
import { GOAL_META, useOnboardingHydrated, useOnboardingStore } from "../../context/OnboardingStore";
import { Modal, Button } from "@nera/ui";
import { classifyPersonas, type BudgetPocket } from "@nera/core";
import {
  FileText,
  Wallet,
  Lock,
  QrCode,
  ArrowUpRight,
  WalletCards,
  Home,
  Coffee,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  TrendingDown,
  CalendarClock,
  ArrowDownLeft,
  ArrowUpFromLine,
  GraduationCap,
  Bus,
  ShoppingBag,
  Banknote,
  PiggyBank,
  Gift,
  ReceiptText,
  LifeBuoy,
  Mail,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  allowance: ArrowDownLeft,
  food: Coffee,
  transport: Bus,
  education: GraduationCap,
  loan: Banknote,
  saving: PiggyBank,
  other: ShoppingBag,
};

const HERO_MOOD: Record<string, NeraMood> = { AMAN: "idle", WASPADA: "thinking", KRITIS: "alert" };

// email receipt categories shown with the closest home category icon
const EMAIL_TO_HOME_CATEGORY: Partial<Record<EmailCategory, string>> = {
  food: "food",
  transport: "transport",
  education: "education",
};

const CATEGORY_COLORS: Record<string, string> = {
  allowance: "#22C55E",
  food: "#F59E0B",
  transport: "#D77A21",
  education: "#76520E",
  loan: "#EF4444",
  saving: "#BA8500",
  other: "#7D766B",
};

export default function HomePage() {
  const {
    dailyPocket,
    lockPocket,
    dailyBudgetSafe,
    runwayDays,
    score,
    state,
    transactions,
    nudges,
    monthlyAllowance,
    safeConsecutiveMonths,
    totalMonthlyInstallments,
    activeDebts,
    isSweepModalOpen,
    setSweepModalOpen,
    executeEndOfMonthSweep,
    addTransaction,
    resolveNudge,
    budgetPockets,
    assetsSet,
    pocketActivity,
  } = useFinancialStore();

  const [isPayKosOpen, setIsPayKosOpen] = useState(false);
  const [isQuickSpendOpen, setIsQuickSpendOpen] = useState(false);
  const [activeActionModal, setActiveActionModal] = useState<string | null>(null);
  const [isSuccessToastOpen, setIsSuccessToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [spendAmount, setSpendAmount] = useState("");
  const [spendTitle, setSpendTitle] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [recentOpen, setRecentOpen] = useState<null | "daily" | "spend">(null);
  const [isPlanningConsentOpen, setIsPlanningConsentOpen] = useState(false);

  const onboardingHydrated = useOnboardingHydrated();
  const onboardingCompleted = useOnboardingStore((s) => s.completed);
  const onboardingGoal = useOnboardingStore((s) => s.goal);
  const planMeta = onboardingGoal ? GOAL_META[onboardingGoal] : null;
  const showPlanCard = onboardingHydrated && onboardingCompleted && planMeta;

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const formatRupiahShort = (val: number) => {
    if (val >= 1000000) return `Rp${(val / 1000000).toFixed(1)}jt`;
    if (val >= 1000) return `Rp${(val / 1000).toFixed(0)}rb`;
    return `Rp${val}`;
  };


  // Last 5 transactions
  const recentTransactions = transactions.slice(0, 5);
  // "Transaksi Terakhir": BNI transactions plus receipts imported from email, newest first.
  // Kept separate from recentTransactions, which lists Daily Pocket (BNI) activity only.
  const emailSpending = useEmailSpending();
  // the balance the user entered follows their receipts (with "email_planning")
  useEmailBalanceSync();
  // email-based nudges; the email data only exists for users who agreed to email import,
  // and it never feeds the score or the runway (those stay on BNI data)
  const jump = useMemo(() => (emailSpending.ready ? weeklyJump(emailSpending.spends) : null), [emailSpending.ready, emailSpending.spends]);
  const planningConsent = useEmailSpendingStore((s) => s.planningConsent);

  // this month's spending exactly as Kantong counts it: pocket spending plus the receipts
  // that land in a pocket, against the pockets' budgets
  const spendingPockets = budgetPockets.filter((p) => p.kind === "spending");
  const monthSpent = spendingPockets.reduce((sum, p) => sum + p.spentThisMonth + emailSpending.spentForPocket(p.icon), 0);
  const monthBudget = spendingPockets.reduce((sum, p) => sum + p.targetAmount, 0);
  const monthPct = monthBudget > 0 ? Math.round((monthSpent / monthBudget) * 100) : 0;
  // receipts in categories no pos covers: in "Pengeluaran", not in the budget
  const coveredIcons = new Set(spendingPockets.map((p) => p.icon));
  const outsideBudget = emailSpending.byCategory
    .filter((c) => !Object.entries(POCKET_CATEGORIES).some(([icon, cats]) => coveredIcons.has(icon as BudgetPocket["icon"]) && cats?.includes(c.category)))
    .reduce((sum, c) => sum + c.amount, 0);
  const today = new Date();
  const daysLeftInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1;

  // "Uangmu bertahan" from real money: the balance the user entered and what they actually
  // spent over the last 30 days (receipts plus spending recorded in pockets). Only with the
  // "email_planning" consent; otherwise it stays on BNI data. The score never uses this.
  const estimate = useMemo(() => {
    if (!assetsSet || !planningConsent || !emailSpending.ready || emailSpending.spends.length === 0) return null;
    const DAY = 86_400_000;
    const now = Date.now();
    const since = now - 30 * DAY;
    const oldest = Math.min(...emailSpending.spends.map((t) => Date.parse(t.occurredAt)));
    const days = Math.max(1, Math.min(30, (now - oldest) / DAY));
    const spent =
      emailSpending.spends.filter((t) => Date.parse(t.occurredAt) >= since).reduce((sum, t) => sum + t.amount, 0) +
      pocketActivity.filter((a) => a.kind === "spend" && Date.parse(a.at) >= since).reduce((sum, a) => sum + a.amount, 0);
    const perDay = spent / days;
    const balance = dailyPocket + budgetPockets.reduce((sum, p) => sum + p.balance, 0);
    const runway = perDay > 0 ? Math.floor(balance / perDay) : 99;
    const budgetLeftPerDay = monthBudget > 0 ? Math.max(0, monthBudget - monthSpent) / daysLeftInMonth : Infinity;
    return { runway: Math.min(99, runway), perDay, balance, perDayBudget: Math.min(budgetLeftPerDay, balance / daysLeftInMonth) };
  }, [assetsSet, planningConsent, emailSpending.ready, emailSpending.spends, pocketActivity, dailyPocket, budgetPockets, monthBudget, monthSpent, daysLeftInMonth]);
  const shownRunway = estimate?.runway ?? runwayDays;
  const shownBudgetPerDay = estimate ? Math.round(estimate.perDayBudget) : dailyBudgetSafe;
  const runwayEndDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + shownRunway);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  })();
  // share of a 30-day month the money covers
  const runwayPct = Math.min(100, Math.round((shownRunway / 30) * 100));
  const hasEmailData = emailSpending.ready && emailSpending.spends.length > 0;
  const overBudget = budgetPockets
    .filter((p) => p.kind === "spending" && p.targetAmount > 0)
    .map((p) => ({ name: p.name, pct: Math.round(((p.spentThisMonth + emailSpending.spentForPocket(p.icon)) / p.targetAmount) * 100) }))
    .filter((p) => p.pct >= 90)
    .sort((a, b) => b.pct - a.pct);

  const combinedRecent = useMemo(
    () =>
      [
        ...transactions.map((tx) => ({ ...tx, source: undefined as string | undefined, emailTx: undefined as EmailTransaction | undefined })),
        ...emailSpending.recent.slice(0, 10).map((tx) => ({
          id: `email-${tx.id}`,
          emailTx: tx,
          title: tx.merchant,
          category: EMAIL_TO_HOME_CATEGORY[tx.category] ?? "other",
          amount: tx.amount,
          type: tx.type,
          timestamp: tx.occurredAt,
          source: tx.provider,
        })),
      ]
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, 5),
    [transactions, emailSpending.recent],
  );

  // Top matched persona for the "Manfaat BNI Untukmu" entry point
  const topPersona = useMemo(() => {
    const matches = classifyPersonas({
      transactions,
      nudges,
      score,
      state,
      monthlyAllowance,
      lockPocket,
      runwayDays,
      safeConsecutiveMonths,
      totalMonthlyInstallments,
      activeDebtsCount: activeDebts.length,
    });
    return matches[0] || null;
  }, [
    transactions,
    nudges,
    score,
    state,
    monthlyAllowance,
    lockPocket,
    runwayDays,
    safeConsecutiveMonths,
    totalMonthlyInstallments,
    activeDebts.length,
  ]);

  // State-based badge config
  const stateBadge = {
    AMAN: { label: `Skor ${score} · Kondisi Sehat`, bg: "bg-[#E8F8EE]", border: "border-[#22C55E]/30", text: "text-[#15803D]", dot: "bg-[#22C55E]" },
    WASPADA: { label: `Skor ${score} · Waspada`, bg: "bg-[#FFF3D6]", border: "border-[#FBBF24]/30", text: "text-[#92400E]", dot: "bg-[#FBBF24]" },
    KRITIS: { label: `Skor ${score} · Kritis`, bg: "bg-[#FBE4DE]", border: "border-[#EF4444]/30", text: "text-[#991B1B]", dot: "bg-[#EF4444]" },
  }[state];

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setIsSuccessToastOpen(true);
    setTimeout(() => setIsSuccessToastOpen(false), 3000);
  };
  // email transactions in Recent Activity open their detail and original email
  const txDetail = useTransactionDetail(triggerToast);

  const handlePayKos = () => {
    const kosAmount = 500000;
    addTransaction({
      title: "Pembayaran Tagihan Kos Bulan Ini",
      category: "other",
      amount: kosAmount,
      type: "expense",
      source: "AUTO_DEBET",
    });
    resolveNudge("nudge_kos");
    setIsPayKosOpen(false);
    triggerToast("Tagihan Kos Rp500.000 berhasil dibayar via BNI!");
  };

  const handleQuickSpend = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(spendAmount);
    if (!amount || amount <= 0) return;

    addTransaction({
      title: spendTitle || "Transaksi QRIS wondr",
      category: "food",
      amount,
      type: "expense",
      source: "QRIS_BNI",
    });

    setSpendAmount("");
    setSpendTitle("");
    setIsQuickSpendOpen(false);
    triggerToast(`Transaksi QRIS ${formatRupiah(amount)} berhasil dicatat!`);
  };

  // Two cards, Pocket and Pengeluaran; the hero above follows the one in view
  const POCKET_SLIDE_COUNT = 2;
  const CAROUSEL_GAP_PX = 10; // matches gap-2.5

  const handleSlideScroll = () => {
    const el = scrollRef.current;
    if (!el || el.children.length === 0) return;
    const first = el.children[0] as HTMLElement;
    const step = first.offsetWidth + CAROUSEL_GAP_PX;
    const nextIndex = Math.round(el.scrollLeft / step);
    setActiveSlide(Math.max(0, Math.min(POCKET_SLIDE_COUNT - 1, nextIndex)));
  };

  const scrollToSlide = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const slide = el.children[idx] as HTMLElement | undefined;
    if (!slide) return;
    el.scrollTo({ left: idx * (slide.offsetWidth + CAROUSEL_GAP_PX), behavior: "smooth" });
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F1F2F4]">
      {/* 1. TOP APP BAR (Branding + Notification) */}
      <TopAppBar homeBrand />

      <main className="flex-1 px-4 pb-8 space-y-7">
        {/* 2. HERO CARD: DAILY RUNWAY & SMART POCKET */}
        <div className="relative -mx-4 overflow-hidden rounded-b-[32px] bg-white px-6 pt-6 pb-7">

          {/* Status Badge */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${stateBadge.bg} border ${stateBadge.border} ${stateBadge.text} text-[11px] font-semibold`}>
              <span className={`w-2 h-2 rounded-full ${stateBadge.dot}`} />
              <span className="font-bold" title="Skor dihitung dari data BNI saja">{stateBadge.label}</span>
            </div>
            <Link
              href="/recovery"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 -mr-1 text-[11px] font-semibold text-[#76520E] transition-colors hover:bg-[#FFF3D6] hover:text-[#5B410C]"
            >
              <LifeBuoy size={13} strokeWidth={2.2} />
              Pemulihan
            </Link>
          </div>

          {/* Title: follows the card below (Pocket: how long the money lasts; Pengeluaran: spending) */}
          <div className="mt-5 max-w-[210px] relative z-10">
            {activeSlide === 0 ? (
              <>
                <p className="text-sm font-medium text-[#766D61]">Uangmu bertahan</p>
                <h2 className="text-[31px] font-bold text-[#2F240E] tracking-tight leading-tight mt-1 tabular-nums">
                  {shownRunway >= 99 ? "99+" : shownRunway} Hari Lagi
                </h2>
                <p className="text-xs text-[#817B70] mt-1">Estimasi aman hingga {runwayEndDate}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-[#766D61]">Terpakai dari budget</p>
                <h2 className="text-[28px] font-bold text-[#2F240E] tracking-tight leading-tight mt-1 tabular-nums">
                  {formatRupiah(monthSpent)}
                </h2>
                <p className="text-xs text-[#817B70] mt-1">
                  dari budget <span className="font-semibold tabular-nums">{formatRupiah(monthBudget)}</span>
                  {outsideBudget > 0 && (
                    <span className="block">
                      + <span className="tabular-nums">{formatRupiah(outsideBudget)}</span> di luar budget
                    </span>
                  )}
                </p>
              </>
            )}
          </div>

          {/* Nera: mood follows the financial state, cheers on successful actions */}
          <div className="absolute top-9 right-2 z-0 flex h-36 w-36 items-center justify-center">
            <NeraOrb mood={isSuccessToastOpen ? "happy" : HERO_MOOD[state]} size={128} />
          </div>

          <div className="relative z-10 mt-7 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-[#F4ECDD] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${activeSlide === 1 && monthPct >= 100 ? "bg-[#C43737]" : "bg-[#FFB900]"}`}
                  style={{ width: `${activeSlide === 0 ? runwayPct : Math.min(100, monthPct)}%` }}
                />
              </div>
              <span className="text-xs font-semibold tabular-nums text-[#473511]">{activeSlide === 0 ? runwayPct : monthPct}%</span>
            </div>

            {activeSlide === 0 ? (
              <>
                <div className="flex items-center gap-1.5 text-xs text-[#817B70]">
                  <FileText size={14} className="shrink-0 text-[#A36A00]" />
                  <span>
                    Rekomendasi budget: <strong className="text-[#533A08] font-semibold tabular-nums">{formatRupiah(shownBudgetPerDay)}</strong> / hari
                  </span>
                </div>
                {estimate ? (
                  <div className="flex items-start gap-1.5 text-xs text-[#817B70]">
                    <Mail size={14} className="mt-px shrink-0 text-[#A36A00]" />
                    <span>
                      Dari saldo <strong className="font-semibold text-[#533A08] tabular-nums">{formatRupiah(estimate.balance)}</strong> dan
                      pengeluaran nyata <strong className="font-semibold text-[#533A08] tabular-nums">{formatRupiah(Math.round(estimate.perDay))}</strong>/hari (30 hari terakhir)
                    </span>
                  </div>
                ) : hasEmailData && !assetsSet ? (
                  <Link href="/pockets" className="flex items-start gap-1.5 text-xs font-semibold text-[#76520E]">
                    <Mail size={14} className="mt-px shrink-0" />
                    <span className="underline underline-offset-2">Atur saldomu supaya estimasi ini memakai uang dan pengeluaranmu sendiri</span>
                  </Link>
                ) : hasEmailData && !planningConsent ? (
                  <button type="button" onClick={() => setIsPlanningConsentOpen(true)} className="flex items-start gap-1.5 text-left text-xs font-semibold text-[#76520E]">
                    <Mail size={14} className="mt-px shrink-0" />
                    <span className="underline underline-offset-2">Pakai pengeluaran dari struk email untuk estimasi ini</span>
                  </button>
                ) : (
                  <p className="text-[11px] text-[#A89F90]">Estimasi dari data BNI.</p>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-xs text-[#817B70]">
                  <FileText size={14} className="shrink-0 text-[#A36A00]" />
                  <span>
                    {monthBudget > monthSpent ? (
                      <>
                        Sisa budget <strong className="font-semibold text-[#533A08] tabular-nums">{formatRupiah(Math.round((monthBudget - monthSpent) / daysLeftInMonth))}</strong> / hari sampai akhir bulan
                      </>
                    ) : (
                      <strong className="font-semibold text-[#A92F2F]">Budget bulan ini sudah terlewati {formatRupiah(monthSpent - monthBudget)}</strong>
                    )}
                  </span>
                </div>
                {emailSpending.byCategory[0] && (
                  <Link href="/email" className="flex items-center gap-1.5 text-xs text-[#817B70]">
                    <Mail size={14} className="shrink-0 text-[#A36A00]" />
                    <span>
                      Terbesar dari email: <strong className="font-semibold text-[#533A08]">{emailSpending.byCategory[0].label}</strong>{" "}
                      <span className="tabular-nums">{formatRupiah(emailSpending.byCategory[0].amount)}</span>
                    </span>
                  </Link>
                )}
              </>
            )}

            {/* Pocket / Pengeluaran carousel */}
            <div className="pt-1">
              <div
                ref={scrollRef}
                onScroll={handleSlideScroll}
                aria-label="Kartu kantong"
                className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
              >
                {/* Slide 1: Daily Pocket */}
                <div className="w-full shrink-0 snap-center rounded-[22px] bg-[#F7F5F0] p-4">
                  <Link
                    href="/pockets"
                    aria-label="Buka Kantong"
                    className="-m-2 flex items-center justify-between gap-3 rounded-[16px] p-2 transition-[background-color,scale] hover:bg-white/60 active:scale-[0.96]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="w-10 h-10 rounded-[13px] bg-white shadow-sm flex items-center justify-center text-[#76520E] shrink-0">
                        <Wallet size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#2F240E] leading-tight">Daily Pocket</p>
                        <span className="text-[10px] text-[#736B60] block mt-0.5">{assetsSet ? "(Siap Pakai)" : "Saldo belum diatur"}</span>
                      </div>
                    </div>
                    <p
                      className="text-lg font-bold text-[#2F240E] shrink-0"
                      title={formatRupiah(assetsSet ? dailyPocket : 0)}
                    >
                      {formatRupiahShort(assetsSet ? dailyPocket : 0)}
                    </p>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setRecentOpen(recentOpen === "daily" ? null : "daily")}
                    aria-expanded={recentOpen === "daily"}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-[#E9E5DD] bg-white/80 px-4 py-2.5 text-xs font-bold text-[#736B60] transition-colors hover:border-[#EEDB9A] hover:bg-white hover:text-[#76520E]"
                  >
                    Recent Activity
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${
                        recentOpen === "daily" ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {recentOpen === "daily" && (
                    <ul className="animate-overlay-in mt-2 space-y-1.5">
                      {recentTransactions.slice(0, 2).map((tx) => (
                        <li
                          key={tx.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2"
                        >
                          <span className="truncate text-[11px] font-semibold text-[#2F240E]">
                            {tx.title}
                          </span>
                          <span
                            className={`shrink-0 text-[11px] font-bold ${
                              tx.type === "income" ? "text-[#277449]" : "text-[#2F240E]"
                            }`}
                          >
                            {tx.type === "income" ? "+" : "−"}
                            {formatRupiahShort(tx.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Slide 2: Pengeluaran (receipts from email) */}
                <div className="w-full shrink-0 snap-center rounded-[22px] bg-[#FFF3D6] p-4">
                  <Link
                    href="/email"
                    aria-label="Buka transaksi email"
                    className="-m-2 flex items-center justify-between gap-3 rounded-[16px] p-2 transition-[background-color,scale] hover:bg-white/50 active:scale-[0.96]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="w-10 h-10 rounded-[13px] bg-white/75 shadow-sm flex items-center justify-center text-[#76520E] shrink-0">
                        <ReceiptText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#2F240E] leading-tight">Pengeluaran</p>
                        <span className="text-[10px] text-[#76520E]/80 block mt-0.5">
                          {hasEmailData ? `${emailSpending.monthCount} struk email bulan ini` : "Belum ada struk email"}
                        </span>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-[#2F240E] shrink-0 tabular-nums" title={formatRupiah(emailSpending.monthTotal)}>
                      {formatRupiahShort(emailSpending.monthTotal)}
                    </p>
                  </Link>

                  {hasEmailData ? (
                    <button
                      type="button"
                      onClick={() => setRecentOpen(recentOpen === "spend" ? null : "spend")}
                      aria-expanded={recentOpen === "spend"}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-[#EEDB9A]/70 bg-white/80 px-4 py-2.5 text-xs font-bold text-[#76520E] transition-colors hover:bg-white"
                    >
                      Recent Activity
                      <ChevronDown size={14} className={`transition-transform duration-200 ${recentOpen === "spend" ? "rotate-180" : ""}`} />
                    </button>
                  ) : (
                    <Link
                      href="/email"
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-white/80 px-4 py-2.5 text-xs font-bold text-[#76520E] hover:bg-white"
                    >
                      Hubungkan Gmail
                      <ChevronRight size={14} />
                    </Link>
                  )}

                  {recentOpen === "spend" && (
                    <ul className="animate-overlay-in mt-2 space-y-1.5">
                      {emailSpending.spends.slice(0, 4).map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => txDetail.open(t)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-left hover:bg-white"
                          >
                            <span className="truncate text-[11px] font-semibold text-[#2F240E]">{t.merchant}</span>
                            <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#2F240E]">−{formatRupiahShort(t.amount)}</span>
                          </button>
                        </li>
                      ))}
                      <li>
                        <Link href="/email" className="block py-1 text-center text-[11px] font-semibold text-[#76520E] underline underline-offset-2">
                          Lihat semua transaksi
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              </div>

              {/* Dots */}
              <div className="flex items-center justify-center gap-1.5 pt-3">
                {Array.from({ length: POCKET_SLIDE_COUNT }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => scrollToSlide(idx)}
                    aria-label={`Ke kartu ${idx + 1}`}
                    className={`h-2 rounded-full transition-all duration-200 ${
                      activeSlide === idx ? "w-5 bg-[#FFB900]" : "w-2 bg-[#D8D3C9] hover:bg-[#C4BDAF]"
                    }`}
                  />
                ))}
              </div>

              {/* Quick chips */}
              <div className="grid grid-cols-2 gap-2.5 pt-2.5">
                <button
                  type="button"
                  onClick={() => setActiveActionModal("Transfer Saldo BNI")}
                  className="flex items-center justify-center gap-2 rounded-full border border-[#F0EEE9] bg-white px-4 py-3.5 text-[13px] font-bold text-[#2F240E] shadow-sm transition-colors hover:border-[#EEDB9A] hover:bg-[#FFF8E6]"
                >
                  <Banknote size={17} className="text-[#76520E]" />
                  Transfer &amp; Pay
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickSpendOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-full border border-[#F0EEE9] bg-white px-4 py-3.5 text-[13px] font-bold text-[#2F240E] shadow-sm transition-colors hover:border-[#EEDB9A] hover:bg-[#FFF8E6]"
                >
                  <QrCode size={17} className="text-[#76520E]" />
                  Scan QRIS
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2.5. RENCANA NERA (Onboarding plan summary) */}
        {showPlanCard && (
          <Link
            href="/onboarding"
            className="block overflow-hidden rounded-[22px] border border-[#FFE39A] bg-[#FFF8E6] p-4 transition-transform active:scale-[0.99]"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#FFB900] text-[#352500]">
                <Sparkles size={20} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A36A00]">Rencana Nera</p>
                  <span className="rounded-full bg-[#DDF0E6] px-1.5 py-0.5 text-[9px] font-bold text-[#277449]">
                    Aktif
                  </span>
                </div>
                <h4 className="mt-0.5 text-[14px] font-bold tracking-tight text-[#2F240E]">
                  {planMeta.label}
                </h4>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#7A6122]">
                  {planMeta.recommendation}
                </p>
              </div>
              <ChevronRight size={18} className="mt-1 shrink-0 text-[#A36A00]" />
            </div>
          </Link>
        )}

        {/* 3. QUICK ACTION SECTION */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold text-[#2F240E]">Quick Action</h3>
            <button
              onClick={() => setActiveActionModal("Semua Menu Quick Action")}
              className="cursor-pointer text-xs font-medium text-[#76520E] hover:underline"
            >
              Lihat Semua
            </button>
          </div>
          <div className="grid grid-cols-4 overflow-hidden rounded-[22px] bg-white px-1.5 py-3">
              {/* 1. Scan QRIS */}
              <button
                onClick={() => setIsQuickSpendOpen(true)}
                className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[15px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#BA8500]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#FFF0BD] text-[#6D4C00]">
                  <QrCode size={21} strokeWidth={2} />
                </div>
                <span className="text-[11px] font-semibold text-[#2F240E] text-center leading-tight">
                  Scan QRIS
                </span>
              </button>

              {/* 2. Transfer */}
              <button
                onClick={() => setActiveActionModal("Transfer Saldo BNI")}
                className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[15px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#BA8500]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#FFF0BD] text-[#6D4C00]">
                  <ArrowUpRight size={21} strokeWidth={2} />
                </div>
                <span className="text-[11px] font-semibold text-[#2F240E] text-center leading-tight">
                  Transfer
                </span>
              </button>

              {/* 3. Bayar Tagihan */}
              <button
                onClick={() => setIsPayKosOpen(true)}
                className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[15px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#BA8500]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#FFF0BD] text-[#6D4C00]">
                  <FileText size={21} strokeWidth={2} />
                </div>
                <span className="text-[11px] font-semibold text-[#2F240E] text-center leading-tight">
                  Bayar<br />Tagihan
                </span>
              </button>

              {/* 4. Top Up */}
              <button
                onClick={() => setActiveActionModal("Top Up Saldo Taplus Muda")}
                className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[15px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#BA8500]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#FFF0BD] text-[#6D4C00]">
                  <WalletCards size={21} strokeWidth={2} />
                </div>
                <span className="text-[11px] font-semibold text-[#2F240E] text-center leading-tight">
                  Top Up
                </span>
              </button>
          </div>
        </section>

        {/* 4. INSIGHT NERA (Smart Nudges) */}
        <section className="space-y-3">
          <h3 className="text-[16px] font-semibold text-[#2F240E]">Insight Nera</h3>

          <div className="overflow-hidden rounded-[24px] bg-white divide-y divide-[#F0EEE9]">
            {/* Nudge: Kos Payment */}
            {nudges.find((n) => n.category === "BILL_KOS") && (
              <div className="p-4 flex gap-3.5">
                <div className="w-10 h-10 rounded-[13px] bg-[#FFF0BD] text-[#76520E] flex items-center justify-center shrink-0 mt-0.5">
                  <Home size={21} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-[#2F240E]">
                    Kos Jatuh Tempo 3 Hari Lagi
                  </h4>
                  <p className="text-xs text-[#736B60] leading-relaxed mt-1">
                    Saldomu di Daily Pocket cukup ({formatRupiahShort(dailyPocket)}). Bayar sekarang agar runway tetap aman?
                  </p>
                  <div className="flex justify-end mt-2.5">
                    <button
                      onClick={() => setIsPayKosOpen(true)}
                      className="bg-[#FFB900] hover:bg-[#F2AE00] text-[#352500] text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                    >
                      Bayar via BNI
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Nudge: UKT */}
            {nudges.find((n) => n.category === "BILL_UKT") && (
              <div className="p-4 flex gap-3.5">
                <div className="w-10 h-10 rounded-[13px] bg-[#F7F5F0] text-[#76520E] flex items-center justify-center shrink-0 mt-0.5">
                  <GraduationCap size={21} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[#2F240E]">
                      UKT Semester Ganjil
                    </h4>
                    <span className="text-[11px] bg-[#F7F5F0] text-[#76520E] font-medium px-2 py-0.5 rounded-full shrink-0">
                      12 Hari
                    </span>
                  </div>
                  <p className="text-xs text-[#736B60] leading-relaxed mt-1">
                    Rp3.500.000 jatuh tempo 31 Agustus. Cashback 5% jika bayar via wondr by BNI.
                  </p>
                </div>
              </div>
            )}

            {/* Nudge: End-of-Month Sweep */}
            {nudges.find((n) => n.category === "SWEEP_LEFTOVER") && (
              <div className="p-4 flex gap-3.5">
                <div className="w-10 h-10 rounded-[13px] bg-[#F7F5F0] text-[#76520E] flex items-center justify-center shrink-0 mt-0.5">
                  <ArrowUpFromLine size={21} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-[#2F240E]">
                    Smart Sweep Akhir Bulan
                  </h4>
                  <p className="text-xs text-[#736B60] leading-relaxed mt-1">
                    Sisa saldo harianmu bisa disapu otomatis ke BNI Life Goals agar tidak boros.
                  </p>
                  <div className="flex justify-end mt-2.5">
                    <button
                      onClick={() => setSweepModalOpen(true)}
                      className="bg-[#3A2800] hover:bg-[#5A4009] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                    >
                      Sapu ke Life Goals
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Pockets at or over budget, counting email spending too */}
            {overBudget.length > 0 && (
              <Link href="/pockets" className="p-4 flex gap-3.5 transition-colors hover:bg-[#FFFBF0]">
                <div className="w-10 h-10 rounded-[13px] bg-[#FBE4DE] text-[#A92F2F] flex items-center justify-center shrink-0 mt-0.5">
                  <Wallet size={21} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-[#2F240E]">
                    {overBudget[0].pct >= 100 ? `Budget ${overBudget[0].name} terlewati` : `Budget ${overBudget[0].name} hampir habis`}
                  </h4>
                  <p className="text-xs text-[#736B60] leading-relaxed mt-1">
                    Sudah {overBudget[0].pct}% terpakai bulan ini
                    {hasEmailData ? ", termasuk pengeluaran dari email" : ""}
                    {overBudget.length > 1 ? `. ${overBudget.length - 1} kantong lain juga di atas 90%.` : "."} Lihat rekomendasi budget di Kantong.
                  </p>
                </div>
                <ChevronRight size={18} className="text-[#A89F90] shrink-0 self-center" />
              </Link>
            )}

            {/* Weekly Spending Insight: from email receipts when there are any, the demo nudge otherwise */}
            {jump ? (
              <Link href="/email" className="p-4 flex gap-3.5 transition-colors hover:bg-[#FFFBF0]">
                <div className="w-10 h-10 rounded-[13px] bg-[#F7F5F0] text-[#76520E] flex items-center justify-center shrink-0 mt-0.5">
                  <Coffee size={21} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-[#2F240E]">Pengeluaran {jump.label} Naik</h4>
                  <p className="text-xs text-[#736B60] leading-relaxed mt-1">
                    7 hari terakhir {formatRupiah(jump.thisWeek)}, {formatRupiah(Math.round(jump.delta))} di atas rata-rata
                    mingguanmu ({formatRupiah(Math.round(jump.avgWeek))}). Dari struk email.
                  </p>
                </div>
                <ChevronRight size={18} className="text-[#A89F90] shrink-0 self-center" />
              </Link>
            ) : (
              !hasEmailData && (
                <div className="p-4 flex gap-3.5">
                  <div className="w-10 h-10 rounded-[13px] bg-[#F7F5F0] text-[#76520E] flex items-center justify-center shrink-0 mt-0.5">
                    <Coffee size={21} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-[#2F240E]">Pengeluaran Jajan Naik</h4>
                    <p className="text-xs text-[#736B60] leading-relaxed mt-1">
                      Minggu ini jajan QRIS naik Rp85.000 dari rata-rata. Atur ritme belanjamu.
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        {/* 4.5. MANFAAT BNI UNTUKMU (Persona-based Privilege Hub entry point) */}
        {topPersona && (
          <section className="space-y-3">
            <h3 className="text-[16px] font-semibold text-[#2F240E]">Manfaat BNI Untukmu</h3>
            <Link href="/privileges">
              <div className="bg-[#FFD568] rounded-[22px] p-4 flex items-center gap-3.5 active:scale-[0.99] transition-transform">
                <div className="w-12 h-12 rounded-[15px] bg-white/55 text-[#47310A] flex items-center justify-center shrink-0">
                  <Gift size={22} className="stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-[#352500] tracking-tight">{topPersona.label}</h4>
                  <p className="text-xs text-[#5C471A] leading-relaxed mt-0.5">{topPersona.tagline}</p>
                </div>
                <ChevronRight size={20} className="text-[#5C471A] stroke-[2] shrink-0" />
              </div>
            </Link>
          </section>
        )}

        {/* 5. RECENT TRANSACTIONS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold text-[#2F240E]">Transaksi Terakhir</h3>
            <span className="text-xs font-medium text-[#736B60]">{transactions.length} total</span>
          </div>

          {emailSpending.ready && emailSpending.monthTotal > 0 ? (
            <Link
              href="/email"
              className="block rounded-[19px] bg-[#FFF3D6] px-4 py-3.5 text-[#5B410C] transition-colors hover:bg-[#FFEBC0]"
            >
              <div className="flex items-center gap-3">
                <Mail size={18} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium">Pengeluaran di luar BNI bulan ini</p>
                  <p className="text-base font-bold tabular-nums text-[#2F240E]">{formatRupiah(emailSpending.monthTotal)}</p>
                </div>
                <ChevronRight size={16} className="shrink-0" />
              </div>
            </Link>
          ) : (
            <Link
              href="/email"
              className="flex items-center gap-3 rounded-[19px] bg-[#FFF3D6] px-4 py-3 text-[#5B410C] transition-colors hover:bg-[#FFEBC0]"
            >
              <Mail size={18} className="shrink-0" />
              <span className="flex-1 text-xs font-semibold leading-snug">
                Ada transaksi GoPay, OVO atau Shopee? Impor dari email
              </span>
              <ChevronRight size={16} className="shrink-0" />
            </Link>
          )}

          <div className="bg-white rounded-[24px] overflow-hidden">
            {combinedRecent.map((tx, idx) => {
              const IconComp = CATEGORY_ICONS[tx.category] || ShoppingBag;
              const color = CATEGORY_COLORS[tx.category] || "#7D766B";
              const isLast = idx === combinedRecent.length - 1;
              const isIncome = tx.type === "income";
              const dateStr = new Date(tx.timestamp).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              });

              const Row = tx.emailTx ? "button" : "div";
              const emailTx = tx.emailTx;
              return (
                <Row
                  key={tx.id}
                  {...(emailTx && { type: "button" as const, onClick: () => txDetail.open(emailTx), "aria-label": `Detail ${tx.title}` })}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${!isLast ? "border-b border-[#F0EEE9]" : ""} ${emailTx ? "hover:bg-[#FFF8E6]" : ""}`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <IconComp size={16} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#2F240E]">{tx.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[#736B60]">
                      {dateStr}
                      {tx.source && ` · dari email ${tx.source}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[13px] font-semibold tabular-nums ${isIncome ? "text-[#277449]" : "text-[#2F240E]"}`}
                  >
                    {isIncome ? "+" : "-"}{formatRupiah(tx.amount)}
                  </span>
                  {emailTx && <ChevronRight size={16} className="-mr-1 shrink-0 text-[#A89F90]" />}
                </Row>
              );
            })}
          </div>
        </section>
      </main>

      {txDetail.sheet}

      {/* the "email_planning" consent, asked where it is used */}
      <Modal isOpen={isPlanningConsentOpen} onClose={() => setIsPlanningConsentOpen(false)} title="Estimasi dari struk email">
        <EmailPlanningConsent
          consent={{ version: "", emailImport: true, aiProcessing: false, emailPlanning: planningConsent }}
          busy={false}
          onChange={async (kind, granted) => {
            try {
              await emailApi.setConsent(kind, granted);
              await useEmailSpendingStore.getState().load(true);
              setIsPlanningConsentOpen(false);
              triggerToast(granted ? "Estimasi sekarang memakai pengeluaran nyatamu" : "Estimasi kembali memakai data BNI");
            } catch (e) {
              triggerToast((e as Error).message);
            }
          }}
        />
        <p className="mt-3 text-[11px] text-[#736B60]">
          Detail ada di{" "}
          <Link href="/privacy" className="font-semibold text-[#76520E] underline underline-offset-2">
            Kebijakan Privasi
          </Link>
          . Bisa diubah kapan saja di halaman Impor dari Email.
        </p>
      </Modal>

      {/* TOAST NOTIFICATION */}
      {isSuccessToastOpen && (
        <div className="absolute top-14 inset-x-0 mx-auto max-w-[390px] px-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-[#2F240E] text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-medium border border-white/10">
            <span className="shrink-0">
              <NeraOrb mood="happy" size={30} still trackPointer={false} />
            </span>
            <span className="flex-1">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* MODAL: BAYAR VIA BNI (TAGIHAN KOS) */}
      <Modal
        isOpen={isPayKosOpen}
        onClose={() => setIsPayKosOpen(false)}
        title="Pembayaran Tagihan Kos via BNI"
      >
        <div className="space-y-4">
          <div className="p-4 bg-[#F1F2F4] rounded-2xl border border-[#E9E5DD] space-y-2">
            <div className="flex items-center justify-between text-xs text-[#736B60]">
              <span>Tujuan Pembayaran</span>
              <span className="font-semibold text-[#2F240E]">Kos Griya Asri Tel-U</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#736B60]">
              <span>Nomor Virtual Account</span>
              <span className="font-mono font-medium text-[#2F240E]">8808 1301 2130 4501</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#736B60] pt-2 border-t border-[#E9E5DD]">
              <span>Total Tagihan</span>
              <span className="font-bold text-[#2F240E] text-base">Rp 500.000</span>
            </div>
          </div>

          <div className="p-3 bg-[#EBF5FF] rounded-xl border border-[#A36A00]/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-[#76520E]" />
              <span className="text-[#2F240E] font-medium">Daily Pocket</span>
            </div>
            <span className="font-bold text-[#76520E]">Sisa {formatRupiah(dailyPocket)}</span>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setIsPayKosOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={handlePayKos}
            >
              Konfirmasi Bayar
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: SCAN QRIS / CATAT TRANSAKSI */}
      <Modal
        isOpen={isQuickSpendOpen}
        onClose={() => setIsQuickSpendOpen(false)}
        title="Scan QRIS / Catat Transaksi"
      >
        <form onSubmit={handleQuickSpend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#2F240E] mb-1">
              Nama Merchant / Keterangan
            </label>
            <input
              type="text"
              placeholder="Contoh: Kopi Tuku / Makan Siang Kantin"
              value={spendTitle}
              onChange={(e) => setSpendTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#76520E]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2F240E] mb-1">
              Nominal Transaksi (Rp)
            </label>
            <input
              type="number"
              placeholder="Contoh: 25000"
              value={spendAmount}
              onChange={(e) => setSpendAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#76520E]"
              required
            />
          </div>

          <div className="p-3 bg-[#F1F2F4] rounded-xl border border-[#E9E5DD] text-xs text-[#736B60]">
            Transaksi akan otomatis memotong <strong>Daily Pocket</strong> dan menyesuaikan <strong>Runway Hari</strong> secara real-time.
          </div>

          <Button type="submit" variant="primary" fullWidth>
            Bayar Transaksi
          </Button>
        </form>
      </Modal>

      {/* MODAL: END-OF-MONTH SWEEP */}
      <Modal
        isOpen={isSweepModalOpen}
        onClose={() => setSweepModalOpen(false)}
        title="Smart Sweep ke BNI Life Goals"
      >
        <div className="space-y-4">
          <div className="text-center py-3">
            <div className="w-16 h-16 bg-[#DDF0E6] text-[#22C55E] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ArrowUpFromLine size={32} />
            </div>
            <h4 className="text-base font-bold text-[#2F240E]">
              Sapu Sisa Saldo Harian
            </h4>
            <p className="text-xs text-[#736B60] mt-1 leading-relaxed">
              Pindahkan seluruh sisa Daily Pocket ke tabungan BNI Life Goals agar uangmu tidak habis percuma di akhir bulan.
            </p>
          </div>

          <div className="p-4 bg-[#F1F2F4] rounded-2xl border border-[#E9E5DD] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#736B60]">Sisa Daily Pocket</span>
              <span className="font-bold text-[#2F240E]">{formatRupiah(dailyPocket)}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E9E5DD]">
              <span className="text-[#736B60]">Life Goals Setelah Sweep</span>
              <span className="font-bold text-[#5B410C]">{formatRupiah(lockPocket + dailyPocket)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" fullWidth onClick={() => setSweepModalOpen(false)}>
              Nanti Saja
            </Button>
            <Button variant="bni" fullWidth onClick={executeEndOfMonthSweep}>
              Sweep Sekarang
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: GENERIC ACTION (Transfer, Top Up, dll) */}
      <Modal
        isOpen={!!activeActionModal}
        onClose={() => setActiveActionModal(null)}
        title={activeActionModal || "Fitur wondr"}
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 bg-[#FFF3D6] text-[#76520E] rounded-2xl flex items-center justify-center mx-auto">
            <Sparkles size={28} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#2F240E]">{activeActionModal}</h4>
            <p className="text-xs text-[#736B60] mt-1 leading-relaxed">
              Layanan perbankan wondr by BNI terintegrasi langsung dengan proteksi kecerdasan finansial Nera.
            </p>
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              setActiveActionModal(null);
              triggerToast(`${activeActionModal} siap digunakan.`);
            }}
          >
            Lanjutkan di wondr
          </Button>
        </div>
      </Modal>
    </div>
  );
}
