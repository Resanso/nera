"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { TopAppBar } from "../../components/common/TopAppBar";
import { useFinancialStore } from "../../context/FinancialStore";
import { useEmailSpending } from "../../lib/emailSpending";
import type { EmailCategory } from "../../lib/emailImport";
import { Modal, Button } from "@nera/ui";
import { classifyPersonas } from "@nera/core";
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
  Layers,
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
  } = useFinancialStore();

  const [isPayKosOpen, setIsPayKosOpen] = useState(false);
  const [isQuickSpendOpen, setIsQuickSpendOpen] = useState(false);
  const [activeActionModal, setActiveActionModal] = useState<string | null>(null);
  const [isSuccessToastOpen, setIsSuccessToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [spendAmount, setSpendAmount] = useState("");
  const [spendTitle, setSpendTitle] = useState("");

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

  // Compute estimated runway end date
  const runwayEndDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + runwayDays);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }, [runwayDays]);

  // Compute runway percentage (assuming 30-day month)
  const runwayPct = useMemo(() => {
    return Math.min(100, Math.round((runwayDays / 30) * 100));
  }, [runwayDays]);

  // Last 5 transactions
  // BNI transactions plus receipts imported from email, newest first
  const emailSpending = useEmailSpending();
  const recentTransactions = useMemo(
    () =>
      [
        ...transactions.map((tx) => ({ ...tx, source: undefined as string | undefined })),
        ...emailSpending.recent.slice(0, 10).map((tx) => ({
          id: `email-${tx.id}`,
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

  return (
    <div className="flex flex-col min-h-full bg-[#F1F2F4]">
      {/* 1. TOP APP BAR (Branding + Notification) */}
      <TopAppBar homeBrand />

      <main className="flex-1 px-4 pb-8 space-y-7">
        {/* 2. HERO CARD: DAILY RUNWAY & SMART POCKET */}
        <div className="relative -mx-4 overflow-hidden rounded-b-[32px] bg-white px-6 pt-6 pb-7">

          {/* Status Badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${stateBadge.bg} border ${stateBadge.border} ${stateBadge.text} text-[11px] font-semibold`}>
            <span className={`w-2 h-2 rounded-full ${stateBadge.dot}`} />
            <span className="font-bold">{stateBadge.label}</span>
          </div>

          {/* Title & Runway Days */}
          <div className="mt-5 max-w-[210px] relative z-10">
            <p className="text-sm font-medium text-[#766D61]">Uangmu bertahan</p>
            <h2 className="text-[31px] font-bold text-[#2F240E] tracking-tight leading-tight mt-1">
              {runwayDays} Hari Lagi
            </h2>
            <p className="text-xs text-[#817B70] mt-1">
              Estimasi aman hingga {runwayEndDate}
            </p>
          </div>

          {/* Nera Mascot */}
          <div className="absolute top-9 right-2 w-36 h-36 pointer-events-none select-none z-0">
            <Image
              src="/images/nera-home-mascot.png"
              alt="Nera Bot Mascot"
              width={144}
              height={144}
              className="w-full h-full object-contain"
              priority
              unoptimized
            />
          </div>

          <div className="relative z-10 mt-7 space-y-4">
            {/* Runway Progress Bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-[#F4ECDD] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#FFB900] transition-all duration-500"
                  style={{ width: `${runwayPct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-[#473511]">{runwayPct}%</span>
            </div>

            {/* Recommendation Info Row */}
            <div className="flex items-center gap-1.5 text-xs text-[#817B70]">
              <FileText size={14} className="text-[#A36A00]" />
              <span>
                Rekomendasi budget:{" "}
                <strong className="text-[#533A08] font-semibold">
                  {formatRupiah(dailyBudgetSafe)}
                </strong>{" "}
                / hari
              </span>
            </div>

            {/* Pockets Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Pocket 1: Daily Pocket */}
              <div className="bg-[#F7F7F7] rounded-[19px] p-3.5 flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-[13px] bg-white flex items-center justify-center text-[#76520E] shrink-0">
                  <Wallet size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#2F240E] leading-tight">Daily Pocket</p>
                  <span className="text-[10px] text-[#736B60] block mt-0.5">(Siap Pakai)</span>
                  <p className="text-sm font-bold text-[#2F240E] mt-0.5" title={formatRupiah(dailyPocket)}>
                    {formatRupiahShort(dailyPocket)}
                  </p>
                </div>
              </div>

              {/* Pocket 2: Lock Pocket */}
              <div className="bg-[#FFF3D6] rounded-[19px] p-3.5 flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-[13px] bg-white/75 flex items-center justify-center text-[#76520E] shrink-0">
                  <Lock size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#2F240E] leading-tight">Lock Pocket</p>
                  <span className="text-[10px] text-[#736B60] block mt-0.5">(BNI Life Goals)</span>
                  <p className="text-sm font-bold text-[#2F240E] mt-0.5 flex items-center gap-1" title={formatRupiah(lockPocket)}>
                    <span>{formatRupiahShort(lockPocket)}</span>
                    <Lock size={12} className="text-[#76520E] shrink-0" />
                  </p>
                </div>
              </div>
            </div>

            {/* Budget Pockets entry point */}
            <Link
              href="/pockets"
              className="flex items-center gap-2.5 rounded-[19px] border border-[#F0EEE9] px-3.5 py-3 transition-colors duration-150 hover:bg-[#FFFBF0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]"
            >
              <div className="w-10 h-10 rounded-[13px] bg-[#FFF0BD] flex items-center justify-center text-[#6D4C00] shrink-0">
                <Layers size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#2F240E] leading-tight">Kantong Budget</p>
                <p className="text-[11px] text-[#736B60] mt-0.5">
                  {budgetPockets.length} kantong ·{" "}
                  {formatRupiah(budgetPockets.reduce((sum, p) => sum + p.balance, 0))}
                </p>
              </div>
              <ChevronRight size={18} className="text-[#76520E] shrink-0" />
            </Link>
          </div>
        </div>

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

            {/* Weekly Spending Insight */}
            <div className="p-4 flex gap-3.5">
              <div className="w-10 h-10 rounded-[13px] bg-[#F7F5F0] text-[#76520E] flex items-center justify-center shrink-0 mt-0.5">
                <Coffee size={21} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-[#2F240E]">
                  Pengeluaran Jajan Naik
                </h4>
                <p className="text-xs text-[#736B60] leading-relaxed mt-1">
                  Minggu ini jajan QRIS naik Rp85.000 dari rata-rata. Atur ritme belanjamu.
                </p>
              </div>
            </div>
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                {emailSpending.byCategory.slice(0, 3).map((c) => (
                  <span key={c.category} className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                    {c.label} {formatRupiah(c.amount)}
                  </span>
                ))}
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
            {recentTransactions.map((tx, idx) => {
              const IconComp = CATEGORY_ICONS[tx.category] || ShoppingBag;
              const color = CATEGORY_COLORS[tx.category] || "#7D766B";
              const isLast = idx === recentTransactions.length - 1;
              const isIncome = tx.type === "income";
              const dateStr = new Date(tx.timestamp).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              });

              return (
                <div
                  key={tx.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${!isLast ? "border-b border-[#F0EEE9]" : ""}`}
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
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* TOAST NOTIFICATION */}
      {isSuccessToastOpen && (
        <div className="absolute top-14 inset-x-0 mx-auto max-w-[390px] px-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-[#2F240E] text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-medium border border-white/10">
            <CheckCircle2 size={18} className="text-[#22C55E] shrink-0" />
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
