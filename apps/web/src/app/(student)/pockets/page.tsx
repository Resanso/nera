"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { useFinancialStore } from "../../../context/FinancialStore";
import { POCKET_CATEGORIES, planBudget, useEmailSpending, useEmailSpendingStore } from "../../../lib/emailSpending";
import { BudgetPlanSheet, type ChosenLine } from "../../../components/insights/BudgetPlanSheet";
import { CATEGORY_LABEL, emailApi, type EmailTransaction } from "../../../lib/emailImport";
import { PocketHistory } from "../../../components/insights/PocketHistory";
import { TransactionSheet, type TransactionEdit } from "../../../components/insights/TransactionSheet";
import { inPeriod, nextIncome, presetPeriod } from "../../../lib/period";
import { NeraOrb } from "../../../components/mascot/NeraOrb";
import { PocketProfileSheet } from "../../../components/insights/PocketProfileSheet";
import { dueLabel, perDayNow, type ProfilePlan } from "../../../lib/pocketProfile";
import { usePushState } from "../../../lib/push";
import { onWalletError } from "../../../lib/wallet";
import { ReminderToggle } from "../../../components/insights/ReminderToggle";
import { IncomeDayPicker } from "../../../components/insights/IncomeDayPicker";
import { EmailPlanningConsent } from "../../../components/consent/ConsentCard";
import { useEmailBalance, useEmailBalanceSync } from "../../../lib/emailBalance";
import { Modal, Button, cn } from "@nera/ui";
import type { BudgetPocket, BudgetPocketIcon, BudgetPocketKind, BudgetPocketTone } from "@nera/core";
import {
  Plus,
  Utensils,
  Bus,
  GraduationCap,
  Gamepad2,
  ShoppingBag,
  HeartPulse,
  Plane,
  Laptop,
  Gift,
  Home,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  ReceiptText,
  Target,
  Trash2,
  Eye,
  EyeOff,
  Zap,
  CalendarDays,
  Sparkles,
  ArrowRight,
  Check,
  ChevronRight,
  Pencil,
} from "lucide-react";

/*
 * Kantong, in three parts that each answer one question:
 * - "Bisa dipakai": how much can I still spend (and per day until the month ends)?
 * - Budget: am I within my limits this month? A budget ("pos") holds no money; what counts
 *   against it comes from email receipts and what the user logs.
 * - Tabungan & rencana: what have I set aside, and for what? This is money that really moved.
 */

const POCKET_ICONS: Record<BudgetPocketIcon, React.ElementType> = {
  food: Utensils,
  transport: Bus,
  education: GraduationCap,
  fun: Gamepad2,
  shopping: ShoppingBag,
  health: HeartPulse,
  travel: Plane,
  gadget: Laptop,
  gift: Gift,
  home: Home,
  utility: Zap,
};

const ICON_LABELS: Record<BudgetPocketIcon, string> = {
  food: "Makan",
  transport: "Transport",
  education: "Kuliah",
  fun: "Hiburan",
  shopping: "Belanja",
  health: "Kesehatan",
  travel: "Liburan",
  gadget: "Gadget",
  gift: "Hadiah",
  home: "Kos",
  utility: "Listrik",
};

interface PocketToneStyle {
  label: string;
  card: string;
  iconWrap: string;
  icon: string;
  title: string;
  muted: string;
  track: string;
  fill: string;
  swatch: string;
}

// Palet warna kantong mengikuti gaya kartu Bank Jago: pastel untuk kantong
// belanja, warna kuat untuk kartu khusus, dan kontras tinggi saat dipilih.
const POCKET_TONES: Record<BudgetPocketTone, PocketToneStyle> = {
  yellow: {
    label: "Kuning",
    card: "bg-[#FFF0BD]",
    iconWrap: "bg-white/70",
    icon: "text-[#6D4C00]",
    title: "text-[#2F240E]",
    muted: "text-[#6B5A35]",
    track: "bg-white/70",
    fill: "bg-[#76520E]",
    swatch: "bg-[#FFD568]",
  },
  sand: {
    label: "Pasir",
    card: "bg-[#F3EBDD]",
    iconWrap: "bg-white/70",
    icon: "text-[#76520E]",
    title: "text-[#2F240E]",
    muted: "text-[#736B60]",
    track: "bg-white/70",
    fill: "bg-[#76520E]",
    swatch: "bg-[#E3D3B6]",
  },
  peach: {
    label: "Peach",
    card: "bg-[#FBE3D4]",
    iconWrap: "bg-white/75",
    icon: "text-[#8A4B14]",
    title: "text-[#3A2415]",
    muted: "text-[#7A5A40]",
    track: "bg-white/70",
    fill: "bg-[#B65C29]",
    swatch: "bg-[#F5C9A0]",
  },
  cream: {
    label: "Gading",
    card: "bg-[#F7F5EC]",
    iconWrap: "bg-white",
    icon: "text-[#76520E]",
    title: "text-[#2F240E]",
    muted: "text-[#736B60]",
    track: "bg-white",
    fill: "bg-[#FFB900]",
    swatch: "bg-[#EDE8DE]",
  },
  brown: {
    label: "Cokelat",
    card: "bg-[#3A2800]",
    iconWrap: "bg-white/12",
    icon: "text-[#FFB900]",
    title: "text-white",
    muted: "text-[#E3D3B6]",
    track: "bg-white/15",
    fill: "bg-[#FFB900]",
    swatch: "bg-[#3A2800]",
  },
  mint: {
    label: "Mint",
    card: "bg-[#EAF3E1]",
    iconWrap: "bg-white/75",
    icon: "text-[#4C6B2F]",
    title: "text-[#263018]",
    muted: "text-[#5F6F4E]",
    track: "bg-white/70",
    fill: "bg-[#6E8B3D]",
    swatch: "bg-[#D6E7C3]",
  },
  teal: {
    label: "Teal",
    card: "bg-[#C6ECDF]",
    iconWrap: "bg-white/75",
    icon: "text-[#0C5C4F]",
    title: "text-[#0F3B34]",
    muted: "text-[#3D6A61]",
    track: "bg-white/70",
    fill: "bg-[#1B8A77]",
    swatch: "bg-[#8DD8C7]",
  },
  sky: {
    label: "Biru",
    card: "bg-[#CFE4FA]",
    iconWrap: "bg-white/75",
    icon: "text-[#1D4E7A]",
    title: "text-[#15324B]",
    muted: "text-[#4C6B87]",
    track: "bg-white/70",
    fill: "bg-[#2F6DA8]",
    swatch: "bg-[#A9CCF0]",
  },
  pink: {
    label: "Pink",
    card: "bg-[#F76C8B]",
    iconWrap: "bg-white/22",
    icon: "text-white",
    title: "text-white",
    muted: "text-[#FFE1E8]",
    track: "bg-white/25",
    fill: "bg-white",
    swatch: "bg-[#F76C8B]",
  },
  cyan: {
    label: "Sian",
    card: "bg-[#0BA5DE]",
    iconWrap: "bg-white",
    icon: "text-[#0B8FC0]",
    title: "text-white",
    muted: "text-[#D5F1FB]",
    track: "bg-white/25",
    fill: "bg-white",
    swatch: "bg-[#0BA5DE]",
  },
};

const QUICK_AMOUNTS = [25000, 50000, 100000, 250000];

type BudgetTab = "history" | "log" | "limit";
type GoalTab = "history" | "topup" | "withdraw" | "spend" | "target";

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

const formatRupiahShort = (val: number) => {
  if (val >= 1000000) return `Rp${(val / 1000000).toFixed(1).replace(".0", "")}jt`;
  if (val >= 1000) return `Rp${(val / 1000).toFixed(0)}rb`;
  return `Rp${val}`;
};

const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "");

const parseAmount = (raw: string) => Number(raw.replace(/\D/g, "")) || 0;
const formatAmountInput = (raw: string) => {
  const n = parseAmount(raw);
  return n ? n.toLocaleString("id-ID") : "";
};

const PLAN_APPLIED_KEY = "nera-budget-plan-applied";

const now = () => new Date();
const monthName = () => new Intl.DateTimeFormat("id-ID", { month: "long" }).format(now());
/** days left in this month, today included */
const daysLeftInMonth = () => {
  const d = now();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
};
const shortDay = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const monthEnd = () => {
  const d = now();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

/** A small amount field with the quick picks, shared by every money form on this page. */
function AmountField({
  id,
  label,
  hint,
  value,
  onChange,
  limit,
  overText,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  limit?: number;
  overText?: string;
}) {
  const n = parseAmount(value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-[#2F240E]">
          {label}
        </label>
        {hint && <span className="text-[11px] text-[#736B60]">{hint}</span>}
      </div>
      <div className="flex items-center rounded-xl border border-[#E9E5DD] px-3 focus-within:border-[#76520E]">
        <span className="text-sm font-semibold text-[#736B60]">Rp</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(formatAmountInput(e.target.value))}
          className="w-full bg-transparent px-2 py-2.5 text-base font-semibold tabular-nums text-[#2F240E] focus:outline-none"
        />
      </div>
      {limit !== undefined && n > limit && <p className="mt-1 text-[11px] text-[#C43737]">{overText}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt}
            type="button"
            disabled={limit !== undefined && amt > limit}
            onClick={() => onChange(amt.toLocaleString("id-ID"))}
            className="rounded-full bg-[#FFF3D6] px-3 py-1.5 text-[11px] font-semibold text-[#76520E] transition-colors duration-150 hover:bg-[#FFE39A] disabled:pointer-events-none disabled:opacity-40"
          >
            {formatRupiahShort(amt)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon: React.ElementType }[] }) {
  return (
    <div className="grid gap-1 rounded-[14px] bg-[#F1F2F4] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const Icon = o.icon;
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-[11px] text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#BA8500]",
              active ? "bg-white text-[#2F240E]" : "text-[#736B60] hover:text-[#2F240E]",
            )}
          >
            <Icon size={15} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PocketsPage() {
  const {
    dailyPocket: storedMain,
    budgetPockets: storedPockets,
    createBudgetPocket,
    createProfilePocket,
    moveToBudgetPocket,
    withdrawFromBudgetPocket,
    spendFromBudgetPocket,
    deleteBudgetPocket,
    setBudgetPocketTarget,
    pocketActivity,
    monthlyIncome,
    incomeDay,
    setMonthlyIncome,
    assetsSet,
    setTotalAssets,
    confirmBalance,
  } = useFinancialStore();
  // "Bisa dipakai" follows the receipts from email once the user entered their total
  useEmailBalanceSync();
  const emailBalance = useEmailBalance();
  const planningConsent = useEmailSpendingStore((s) => s.planningConsent);
  // until the user enters their own total, the demo's seeded balances read Rp0
  const spendable = assetsSet ? storedMain : 0;
  const pockets = useMemo(() => (assetsSet ? storedPockets : storedPockets.map((p) => ({ ...p, balance: 0 }))), [assetsSet, storedPockets]);
  const budgets = pockets.filter((p) => p.kind === "spending");
  const goals = pockets.filter((p) => p.kind === "saving");

  const [showBalances, setShowBalances] = useState(true);
  const money = (val: number) => (showBalances ? formatRupiah(val) : "Rp — — —");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };
  // an op the server turned down (a balance changed elsewhere): say why; the DB's numbers are back
  useEffect(() => onWalletError((msg) => triggerToast(msg)), []);

  // ---- budget: this month's spending per pos, from email receipts plus what was logged ----
  const emailSpending = useEmailSpending();
  const thisMonth = presetPeriod("this_month");
  const monthEmail = emailSpending.inPeriod(thisMonth);
  const spentOf = (p: BudgetPocket) => p.spentThisMonth + monthEmail.spentForPocket(p.icon);
  const budgetTotal = budgets.reduce((s, p) => s + p.targetAmount, 0);
  const spentTotal = budgets.reduce((s, p) => s + spentOf(p), 0);
  const loggedTotal = budgets.reduce((s, p) => s + p.spentThisMonth, 0);
  const emailTotal = spentTotal - loggedTotal;
  // email spending in categories no pos covers, so the numbers add up with /email
  const coveredIcons = new Set(budgets.map((p) => p.icon));
  const uncovered = monthEmail.byCategory.filter(
    (c) => !Object.entries(POCKET_CATEGORIES).some(([icon, cats]) => coveredIcons.has(icon as BudgetPocketIcon) && cats?.includes(c.category)),
  );
  const uncoveredTotal = uncovered.reduce((s, c) => s + c.amount, 0);
  const setAside = goals.reduce((s, p) => s + p.balance, 0);
  const total = spendable + setAside;
  // "Bisa dipakai" has to last until the next income when the user told us when it comes,
  // otherwise until the month ends
  const payday = incomeDay ? nextIncome(incomeDay) : null;
  const perDayLeft = Math.max(0, Math.floor(spendable / (payday?.days ?? daysLeftInMonth()) / 1000) * 1000);
  const lastsUntil = payday ? `pemasukan ${shortDay(payday.date)}` : monthEnd();

  // the whole budget proposed from email history ("Pakai budget ini")
  const plan = useMemo(() => (emailSpending.ready ? planBudget(emailSpending.spends, pockets) : null), [emailSpending.ready, emailSpending.spends, pockets]);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const monthKey = new Date().toISOString().slice(0, 7);
  const [planAppliedMonth, setPlanAppliedMonth] = useState<string | null>(null);
  useEffect(() => {
    try {
      setPlanAppliedMonth(localStorage.getItem(PLAN_APPLIED_KEY));
    } catch {}
  }, []);
  const applyPlan = (lines: ChosenLine[]) => {
    for (const l of lines) {
      if (l.pocket) setBudgetPocketTarget(l.pocket.id, l.budget);
      else createBudgetPocket({ name: l.name, kind: "spending", icon: l.icon, tone: l.tone, targetAmount: l.budget }, 0);
    }
    setIsPlanOpen(false);
    setPlanAppliedMonth(monthKey);
    try {
      localStorage.setItem(PLAN_APPLIED_KEY, monthKey);
    } catch {}
    const created = lines.filter((l) => !l.pocket).length;
    triggerToast(`Budget ${formatRupiah(lines.reduce((s, l) => s + l.budget, 0))}/bulan dipakai${created ? ` · ${created} pos baru` : ""}`);
  };

  // ---- history and receipts ----
  const historyFor = (p: BudgetPocket) => ({
    emailTxs: p.kind === "spending" ? emailSpending.spends.filter((t) => POCKET_CATEGORIES[p.icon]?.includes(t.category) && inPeriod(t.occurredAt, thisMonth)) : [],
    activity: pocketActivity.filter((a) => a.pocketId === p.id && inPeriod(a.at, thisMonth)),
  });
  const allEmailTxs = useEmailSpendingStore((s) => s.transactions);
  const [editingTx, setEditingTx] = useState<EmailTransaction | null>(null);
  const saveTxEdit = async (t: EmailTransaction, edit: TransactionEdit) => {
    setEditingTx(null);
    try {
      const r = await emailApi.editTransaction(t.id, edit);
      await useEmailSpendingStore.getState().load(true);
      if ("dismissed" in edit) triggerToast(`${t.merchant} disembunyikan`);
      else triggerToast(`${r.alsoChanged > 0 ? `${r.alsoChanged + 1} transaksi ` : ""}${t.merchant} dipindah ke ${CATEGORY_LABEL[edit.category]}`);
    } catch (e) {
      triggerToast((e as Error).message);
    }
  };

  // ---- detail sheet ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [budgetTab, setBudgetTab] = useState<BudgetTab>("history");
  const [goalTab, setGoalTab] = useState<GoalTab>("history");
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const selected = pockets.find((p) => p.id === selectedId) ?? null;
  const openDetail = (id: string, tab?: GoalTab) => {
    setSelectedId(id);
    setBudgetTab("history");
    setGoalTab(tab ?? "history");
    setAmountInput("");
    setNoteInput("");
    setIsConfirmingDelete(false);
  };
  const push = usePushState();

  // ---- saldo (total and income) ----
  const [isSaldoOpen, setIsSaldoOpen] = useState(false);
  const [assetInput, setAssetInput] = useState("");
  const [assetError, setAssetError] = useState<string | null>(null);
  const [incomeInput, setIncomeInput] = useState("");
  const [incomeDayInput, setIncomeDayInput] = useState<number | null>(null);
  const openSaldo = () => {
    setAssetInput("");
    setAssetError(null);
    setIncomeInput("");
    setIncomeDayInput(incomeDay);
    setIsSaldoOpen(true);
  };

  // ---- create ----
  const [createKind, setCreateKind] = useState<BudgetPocketKind | null>(null);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<BudgetPocketIcon>("food");
  const [newTone, setNewTone] = useState<BudgetPocketTone>("teal");
  const [newTarget, setNewTarget] = useState("");
  const [newInitial, setNewInitial] = useState("");
  const openCreate = (kind: BudgetPocketKind) => {
    setNewName("");
    setNewIcon(kind === "saving" ? "gadget" : "food");
    setNewTone(kind === "saving" ? "cyan" : "teal");
    setNewTarget("");
    setNewInitial("");
    setCreateKind(kind);
  };
  const newInitialValue = parseAmount(newInitial);
  const isCreateValid = newName.trim().length > 0 && parseAmount(newTarget) > 0 && (createKind !== "saving" || newInitialValue <= spendable);
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createKind || !isCreateValid) return;
    createBudgetPocket(
      { name: newName.trim(), kind: createKind, icon: newIcon, tone: newTone, targetAmount: parseAmount(newTarget) },
      createKind === "saving" ? newInitialValue : 0,
    );
    triggerToast(createKind === "spending" ? `Pos budget ${newName.trim()} dibuat` : `Tabungan ${newName.trim()} dibuat`);
    setCreateKind(null);
  };

  // ---- Rencana dadakan ----
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const createFromProfile = (p: ProfilePlan) => {
    const id = createProfilePocket(
      {
        name: p.draft.name,
        icon: p.draft.icon,
        tone: p.tone,
        targetAmount: p.draft.amount,
        profile: { occasion: p.draft.occasion, dueDate: p.draft.dueDate },
      },
      p.fromPockets.map((s) => ({ pocketId: s.pocket.id, amount: s.amount })),
      p.fromMainNow,
    );
    setIsProfileOpen(false);
    openDetail(id, "topup");
    triggerToast(`${p.draft.name} siap. ${p.perDay > 0 ? `Sisihkan ${formatRupiah(p.perDay)} tiap hari` : "Uangnya sudah terkumpul"}`);
  };

  const budgetPct = budgetTotal > 0 ? Math.round((spentTotal / budgetTotal) * 100) : 0;
  const budgetOver = spentTotal > budgetTotal;
  const showPlanCard = plan && planAppliedMonth !== monthKey;
  const steps = [
    { done: assetsSet, title: "Isi saldo rekeningmu", body: "Supaya Nera tahu berapa yang bisa dipakai.", action: openSaldo, cta: "Isi" },
    { done: monthlyIncome !== null, title: "Isi pemasukan per bulan", body: "Uang saku, gaji atau kiriman, untuk membandingkan budget.", action: openSaldo, cta: "Isi" },
    ...(plan ? [{ done: planAppliedMonth === monthKey, title: "Atur budget dari kebiasaanmu", body: "Nera menyusunnya dari struk emailmu.", action: () => setIsPlanOpen(true), cta: "Lihat" }] : []),
  ];
  const showSteps = !steps[0].done || !steps[1].done;

  return (
    <div className="flex min-h-full flex-col bg-[#F1F2F4]">
      <TopAppBar title="Kantong" showBack />

      <main className="flex-1 space-y-4 px-4 pb-10 pt-3">
        {/* BISA DIPAKAI */}
        <section aria-label="Saldo" className="rounded-[22px] bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-[#736B60]">Bisa dipakai</p>
            <button
              type="button"
              onClick={() => setShowBalances((v) => !v)}
              aria-pressed={!showBalances}
              aria-label={showBalances ? "Sembunyikan saldo" : "Tampilkan saldo"}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#2F240E] hover:bg-[#F1F2F4]"
            >
              {showBalances ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <p className={cn("text-[28px] font-bold leading-tight tabular-nums", spendable < 0 ? "text-[#A92F2F]" : "text-[#2F240E]")}>{money(spendable)}</p>
          {assetsSet ? (
            <p className="mt-0.5 text-[12px] text-[#736B60]">
              ≈ <span className="font-semibold tabular-nums text-[#2F240E]">{showBalances ? formatRupiah(perDayLeft) : "Rp —"}</span>/hari sampai {lastsUntil}
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] text-[#736B60]">Belum diisi. Mulai dari langkah di bawah.</p>
          )}
          <div className="mt-3 flex items-center gap-3 border-t border-[#F1EEE8] pt-3 text-[12px]">
            <div className="min-w-0 flex-1">
              <p className="text-[#736B60]">Disisihkan</p>
              <p className="font-semibold tabular-nums text-[#2F240E]">{money(setAside)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[#736B60]">Total saldo</p>
              <p className="font-semibold tabular-nums text-[#2F240E]">{money(total)}</p>
            </div>
            <button type="button" onClick={openSaldo} className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#F1F2F4] px-3 font-semibold text-[#2F240E] hover:bg-[#FFF3D6]">
              <Pencil size={13} />
              Ubah
            </button>
          </div>
        </section>

        {/* BALANCE CHECK: the balance has run on receipts for a while, or went below 0 */}
        {emailBalance.needsCheck && (
          <section className="flex items-center gap-3 rounded-[20px] bg-[#FFF0BD] px-4 py-3.5">
            <NeraOrb mood={spendable < 0 ? "alert" : "happy"} size={40} still trackPointer={false} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[#2F240E]">
                {spendable < 0 ? "Saldomu perlu dicek" : <>Saldomu sekarang <span className="tabular-nums">{formatRupiah(total)}</span>?</>}
              </p>
              <p className="text-[11px] leading-snug text-[#5C4A1E]">
                {spendable < 0
                  ? "Pengeluaran dari struk email melebihi saldo yang tercatat. Mungkin ada uang masuk."
                  : `Nera mengurangi ${formatRupiah(emailBalance.deducted)} dari ${emailBalance.receipts} struk email sejak ${shortDate(emailBalance.since)}.`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {spendable >= 0 && (
                <button
                  type="button"
                  onClick={() => (confirmBalance(), triggerToast("Saldo dikonfirmasi"))}
                  className="h-9 rounded-full bg-[#2F240E] px-3.5 text-[12px] font-semibold text-white hover:bg-[#46371A]"
                >
                  Benar
                </button>
              )}
              <button type="button" onClick={openSaldo} className="h-9 rounded-full bg-white px-3.5 text-[12px] font-semibold text-[#2F240E] hover:bg-[#FFF8E1]">
                Ubah
              </button>
            </div>
          </section>
        )}

        {/* FIRST STEPS */}
        {showSteps && (
          <section aria-label="Mulai" className="rounded-[20px] bg-white px-4 py-3.5">
            <p className="text-[13px] font-bold text-[#2F240E]">Mulai dalam {steps.length} langkah</p>
            <ol className="mt-2 space-y-2">
              {steps.map((s, i) => (
                <li key={s.title} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                      s.done ? "bg-[#E3F3E9] text-[#277449]" : "bg-[#FFF0BD] text-[#6D4C00]",
                    )}
                  >
                    {s.done ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[13px] font-semibold", s.done ? "text-[#736B60] line-through" : "text-[#2F240E]")}>{s.title}</span>
                    {!s.done && <span className="block text-[11px] leading-snug text-[#736B60]">{s.body}</span>}
                  </span>
                  {!s.done && (
                    <button type="button" onClick={s.action} className="h-8 shrink-0 rounded-full bg-[#FFB900] px-3 text-[12px] font-bold text-[#352500] hover:bg-[#E6A700]">
                      {s.cta}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* BUDGET */}
        <section aria-labelledby="budget-title" className="rounded-[22px] bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="budget-title" className="text-[16px] font-bold capitalize text-[#2F240E]">
              Budget {monthName()}
            </h2>
            <button type="button" onClick={() => openCreate("spending")} className="flex h-8 items-center gap-1 rounded-full bg-[#F1F2F4] px-3 text-[12px] font-semibold text-[#2F240E] hover:bg-[#FFF3D6]">
              <Plus size={14} />
              Pos
            </button>
          </div>

          {budgets.length > 0 && (
            <>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-[13px] text-[#736B60]">
                  Terpakai <span className="text-[20px] font-bold tabular-nums text-[#2F240E]">{formatRupiah(spentTotal)}</span>
                  <span className="block">dari {formatRupiah(budgetTotal)}</span>
                </p>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold tabular-nums",
                    budgetOver ? "bg-[#FBEDED] text-[#A92F2F]" : budgetPct >= 90 ? "bg-[#FFF3D6] text-[#76520E]" : "bg-[#E3F3E9] text-[#277449]",
                  )}
                >
                  {budgetPct}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#F1F2F4]">
                <div className={cn("h-full rounded-full transition-[width] duration-500", budgetOver ? "bg-[#C43737]" : "bg-[#FFB900]")} style={{ width: `${Math.min(100, budgetPct)}%` }} />
              </div>
            </>
          )}

          {monthlyIncome !== null && monthlyIncome > 0 && budgetTotal > monthlyIncome && (
            <p className="mt-3 rounded-xl bg-[#FBEDED] px-3 py-2 text-[12px] leading-relaxed text-[#A92F2F]">
              Budget melebihi pemasukanmu ({formatRupiah(monthlyIncome)}) sebesar <b className="tabular-nums">{formatRupiah(budgetTotal - monthlyIncome)}</b>. Turunkan pos yang paling
              besar.
            </p>
          )}

          {showPlanCard && (
            <button type="button" onClick={() => setIsPlanOpen(true)} className="mt-3 flex w-full items-center gap-3 rounded-[16px] bg-[#FFF0BD] px-3 py-3 text-left hover:bg-[#FFE7A0]">
              <NeraOrb mood="happy" size={34} still trackPointer={false} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-[#2F240E]">Susun otomatis dari kebiasaanmu</span>
                <span className="block text-[11px] text-[#5C4A1E]">
                  {plan.lines.filter((l) => !l.occasional).length} pos · <span className="tabular-nums">{formatRupiah(plan.total)}</span>/bulan
                </span>
              </span>
              <ArrowRight size={17} className="shrink-0 text-[#76520E]" />
            </button>
          )}

          <ul className="mt-3 divide-y divide-[#F1EEE8]">
            {budgets.map((p) => {
              const tone = POCKET_TONES[p.tone];
              const Icon = POCKET_ICONS[p.icon];
              const spent = spentOf(p);
              const left = p.targetAmount - spent;
              const pct = p.targetAmount > 0 ? Math.round((spent / p.targetAmount) * 100) : 0;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => openDetail(p.id)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]", tone.card, tone.icon)}>
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14px] font-semibold text-[#2F240E]">{p.name}</span>
                        <span className={cn("shrink-0 text-[13px] font-bold tabular-nums", left < 0 ? "text-[#A92F2F]" : "text-[#2F240E]")}>
                          {left < 0 ? `Lewat ${formatRupiahShort(-left)}` : `Sisa ${formatRupiahShort(left)}`}
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-[#F1F2F4]">
                        <span className={cn("block h-full rounded-full", left < 0 ? "bg-[#C43737]" : pct >= 90 ? "bg-[#E08A00]" : "bg-[#FFB900]")} style={{ width: `${Math.min(100, pct)}%` }} />
                      </span>
                      <span className="mt-1 block text-[11px] tabular-nums text-[#736B60]">
                        {formatRupiahShort(spent)} dari {formatRupiahShort(p.targetAmount)}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-[#A89F90]" />
                  </button>
                </li>
              );
            })}
            {budgets.length === 0 && <li className="py-4 text-center text-[12px] text-[#736B60]">Belum ada pos budget. Buat satu, atau susun otomatis.</li>}
          </ul>

          {budgets.length > 0 && (
            <details className="group mt-1 rounded-xl bg-[#F7F5F0] px-3 py-2 text-[12px]">
              <summary className="cursor-pointer list-none font-semibold text-[#76520E] [&::-webkit-details-marker]:hidden">
                Dari mana angka ini? <span className="inline-block transition-transform group-open:rotate-90">›</span>
              </summary>
              <dl className="mt-2 space-y-1.5">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#736B60]">Dari struk email</dt>
                  <dd className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(emailTotal)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#736B60]">Dicatat manual</dt>
                  <dd className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(loggedTotal)}</dd>
                </div>
                {uncoveredTotal > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#736B60]">
                      Struk tanpa pos ({uncovered.map((c) => c.label).join(", ")})<span className="block text-[11px]">tidak dihitung di budget</span>
                    </dt>
                    <dd className="tabular-nums text-[#736B60]">{formatRupiah(uncoveredTotal)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-[#736B60]">Budget = jumlah {budgets.length} pos</dt>
                  <dd className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(budgetTotal)}</dd>
                </div>
              </dl>
              {plan && planAppliedMonth === monthKey && (
                <button type="button" onClick={() => setIsPlanOpen(true)} className="mt-2 font-semibold text-[#76520E] underline underline-offset-2">
                  Susun ulang budget otomatis
                </button>
              )}
            </details>
          )}
        </section>

        {/* TABUNGAN & RENCANA */}
        <section aria-labelledby="goals-title" className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 id="goals-title" className="text-[16px] font-bold text-[#2F240E]">
              Tabungan & rencana
            </h2>
            <button type="button" onClick={() => openCreate("saving")} className="flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12px] font-semibold text-[#2F240E] hover:bg-[#FFF3D6]">
              <Plus size={14} />
              Tabungan
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="flex w-full items-center gap-3 rounded-[20px] bg-white px-4 py-3.5 text-left transition-transform duration-150 hover:bg-[#FFFBF0] active:scale-[0.96]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#FFF0BD] text-[#76520E]">
              <Sparkles size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-[#2F240E]">Ada rencana dadakan?</span>
              <span className="block text-[11px] leading-snug text-[#736B60]">Diajak AYCE atau nonton? Nera hitung berapa yang perlu disisihkan per hari</span>
            </span>
            <ArrowRight size={17} className="shrink-0 text-[#76520E]" />
          </button>

          <div className="grid grid-cols-2 gap-3">
            {goals.map((p) => {
              const tone = POCKET_TONES[p.tone];
              const Icon = POCKET_ICONS[p.icon];
              const pct = p.targetAmount > 0 ? Math.min(100, Math.round((p.balance / p.targetAmount) * 100)) : 0;
              const due = p.profile ? dueLabel(p.profile.dueDate) : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openDetail(p.id)}
                  className={cn("flex min-h-[156px] flex-col rounded-[22px] p-4 text-left transition-transform duration-150 active:scale-[0.96]", tone.card)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-[13px]", tone.iconWrap, tone.icon)}>
                      <Icon size={20} />
                    </span>
                    {due && (
                      <span className={cn("rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold", due.days <= 1 ? "text-[#A92F2F]" : tone.muted)}>{due.relative}</span>
                    )}
                  </div>
                  <div className="mt-auto pt-4">
                    <p className={cn("truncate text-[14px] font-bold", tone.title)}>{p.name}</p>
                    <p className={cn("text-[17px] font-bold leading-tight tabular-nums", tone.title)}>{money(p.balance)}</p>
                    <div className={cn("mt-1.5 h-1.5 w-full overflow-hidden rounded-full", tone.track)}>
                      <div className={cn("h-full rounded-full", tone.fill)} style={{ width: `${pct}%` }} />
                    </div>
                    <p className={cn("mt-1 text-[10px] font-medium tabular-nums", tone.muted)}>
                      {pct}% dari {formatRupiahShort(p.targetAmount)}
                    </p>
                  </div>
                </button>
              );
            })}
            {goals.length === 0 && (
              <p className="col-span-2 rounded-[20px] bg-white/60 px-4 py-5 text-center text-[12px] text-[#736B60]">
                Belum ada tabungan. Sisihkan untuk hal yang kamu tunggu, misalnya laptop atau mudik.
              </p>
            )}
          </div>
        </section>
      </main>

      {/* TOAST */}
      {toastMessage && (
        <div className="absolute inset-x-0 top-14 z-[70] mx-auto max-w-[390px] px-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#2F240E] p-3 text-xs font-medium text-white shadow-xl">
            <span className="shrink-0">
              <NeraOrb mood="happy" size={30} still trackPointer={false} />
            </span>
            <span className="flex-1">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* DETAIL */}
      <Modal variant="sheet" isOpen={!!selected} onClose={() => setSelectedId(null)} title={selected?.name ?? ""}>
        {selected &&
          (selected.kind === "spending"
            ? (() => {
                const p = selected;
                const tone = POCKET_TONES[p.tone];
                const Icon = POCKET_ICONS[p.icon];
                const spent = spentOf(p);
                const left = p.targetAmount - spent;
                const pct = p.targetAmount > 0 ? Math.round((spent / p.targetAmount) * 100) : 0;
                const amount = parseAmount(amountInput);
                return (
                  <div className="space-y-4">
                    <div className={cn("rounded-[20px] p-4", tone.card)}>
                      <div className="flex items-center gap-3">
                        <span className={cn("flex h-11 w-11 items-center justify-center rounded-[14px]", tone.iconWrap, tone.icon)}>
                          <Icon size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[11px]", tone.muted)}>{left < 0 ? "Lewat budget" : "Sisa budget bulan ini"}</p>
                          <p className={cn("text-xl font-bold tabular-nums", left < 0 ? "text-[#A92F2F]" : tone.title)}>{formatRupiah(Math.abs(left))}</p>
                        </div>
                      </div>
                      <div className={cn("mt-3.5 h-1.5 w-full overflow-hidden rounded-full", tone.track)}>
                        <div className={cn("h-full rounded-full", left < 0 ? "bg-[#C43737]" : tone.fill)} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <p className={cn("mt-1.5 text-[11px] tabular-nums", tone.muted)}>
                        Terpakai {formatRupiah(spent)} dari {formatRupiah(p.targetAmount)} · pos budget tidak menyimpan uang
                      </p>
                    </div>

                    <Segmented
                      value={budgetTab}
                      onChange={(v) => (setBudgetTab(v), setAmountInput(""), setNoteInput(""))}
                      options={[
                        { id: "history", label: "Riwayat", icon: History },
                        { id: "log", label: "Catat", icon: ReceiptText },
                        { id: "limit", label: "Budget", icon: Target },
                      ]}
                    />

                    {budgetTab === "history" && <PocketHistory {...historyFor(p)} spentThisMonth={p.spentThisMonth} onEditEmail={setEditingTx} />}

                    {budgetTab === "log" && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (amount <= 0 || amount > spendable) return;
                          spendFromBudgetPocket(p.id, amount, noteInput.trim() || "Pengeluaran");
                          triggerToast(`${formatRupiah(amount)} dicatat di ${p.name}`);
                          setAmountInput("");
                          setNoteInput("");
                        }}
                        className="space-y-3"
                      >
                        <p className="text-[12px] leading-relaxed text-[#736B60]">
                          Untuk belanja yang tidak ada struk emailnya, misalnya bayar tunai. Uangnya berkurang dari saldo yang bisa dipakai.
                        </p>
                        <div>
                          <label htmlFor="log-note" className="mb-1 block text-xs font-semibold text-[#2F240E]">
                            Keterangan
                          </label>
                          <input
                            id="log-note"
                            type="text"
                            maxLength={80}
                            placeholder="Contoh: Makan siang kantin"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            className="w-full rounded-xl border border-[#E9E5DD] px-3 py-2.5 text-sm focus:border-[#76520E] focus:outline-none"
                          />
                        </div>
                        <AmountField
                          id="log-amount"
                          label="Nominal"
                          hint={`Bisa dipakai ${formatRupiah(Math.max(0, spendable))}`}
                          value={amountInput}
                          onChange={setAmountInput}
                          limit={Math.max(0, spendable)}
                          overText="Melebihi saldo yang bisa dipakai."
                        />
                        <Button type="submit" variant="bni" fullWidth disabled={amount <= 0 || amount > spendable}>
                          Catat pengeluaran
                        </Button>
                      </form>
                    )}

                    {budgetTab === "limit" && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (amount <= 0) return;
                          setBudgetPocketTarget(p.id, amount);
                          triggerToast(`Budget ${p.name} jadi ${formatRupiah(amount)}/bulan`);
                          setAmountInput("");
                        }}
                        className="space-y-3"
                      >
                        <AmountField id="limit-amount" label="Budget per bulan" hint={`Sekarang ${formatRupiah(p.targetAmount)}`} value={amountInput} onChange={setAmountInput} />
                        <Button type="submit" variant="primary" fullWidth disabled={amount <= 0}>
                          Simpan budget
                        </Button>
                      </form>
                    )}

                    <DeleteRow
                      confirming={isConfirmingDelete}
                      setConfirming={setIsConfirmingDelete}
                      text="Hapus pos ini? Riwayat catatannya ikut terhapus; struk email tetap ada."
                      onDelete={() => {
                        deleteBudgetPocket(p.id);
                        setSelectedId(null);
                        triggerToast(`Pos ${p.name} dihapus`);
                      }}
                    />
                  </div>
                );
              })()
            : (() => {
                const p = selected;
                const tone = POCKET_TONES[p.tone];
                const Icon = POCKET_ICONS[p.icon];
                const pct = p.targetAmount > 0 ? Math.min(100, Math.round((p.balance / p.targetAmount) * 100)) : 0;
                const remaining = Math.max(0, p.targetAmount - p.balance);
                const amount = parseAmount(amountInput);
                const due = p.profile ? dueLabel(p.profile.dueDate) : null;
                const today = perDayNow(p);
                const canSetAside = today > 0 && today <= spendable && (due?.days ?? 0) >= 0;
                const limit = goalTab === "topup" ? Math.max(0, spendable) : p.balance;
                return (
                  <div className="space-y-4">
                    <div className={cn("rounded-[20px] p-4", tone.card)}>
                      <div className="flex items-center gap-3">
                        <span className={cn("flex h-11 w-11 items-center justify-center rounded-[14px]", tone.iconWrap, tone.icon)}>
                          <Icon size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[11px]", tone.muted)}>Terkumpul</p>
                          <p className={cn("text-xl font-bold tabular-nums", tone.title)}>{formatRupiah(p.balance)}</p>
                        </div>
                        <span className={cn("text-[13px] font-bold tabular-nums", tone.title)}>{pct}%</span>
                      </div>
                      <div className={cn("mt-3.5 h-1.5 w-full overflow-hidden rounded-full", tone.track)}>
                        <div className={cn("h-full rounded-full", tone.fill)} style={{ width: `${pct}%` }} />
                      </div>
                      <p className={cn("mt-1.5 text-[11px] tabular-nums", tone.muted)}>
                        Target {formatRupiah(p.targetAmount)} · {remaining > 0 ? `kurang ${formatRupiah(remaining)}` : "tercapai"}
                      </p>
                    </div>

                    {p.profile && due && (
                      <div className="rounded-[18px] border border-[#F1EEE8] px-3.5 py-3">
                        <p className="text-[14px] font-bold text-[#2F240E]">{p.profile.occasion}</p>
                        <p className="flex items-center gap-1 text-[12px] text-[#736B60]">
                          <CalendarDays size={13} />
                          {due.date} · {due.relative}
                        </p>
                        {today > 0 && due.days >= 0 ? (
                          <>
                            <button
                              type="button"
                              disabled={!canSetAside}
                              onClick={() => {
                                moveToBudgetPocket(p.id, today);
                                triggerToast(`${formatRupiah(today)} disisihkan ke ${p.name}`);
                              }}
                              className="mt-2.5 h-10 w-full rounded-[12px] bg-[#FFB900] text-[13px] font-bold text-[#352500] transition-transform duration-150 hover:bg-[#E6A700] active:scale-[0.96] disabled:opacity-40"
                            >
                              {due.days === 0 ? "Lengkapi" : "Sisihkan hari ini"} {formatRupiah(today)}
                            </button>
                            {!canSetAside && today > spendable && (
                              <p className="mt-1 text-[11px] text-[#A92F2F]">{assetsSet ? `Bisa dipakai tinggal ${formatRupiah(spendable)}.` : "Isi saldomu dulu supaya bisa menyisihkan."}</p>
                            )}
                            <div className="mt-2.5">
                              <ReminderToggle state={push.state} showAmounts={push.showAmounts} onShowAmounts={push.setShowAmounts} onChange={push.refresh} notify={triggerToast} />
                            </div>
                          </>
                        ) : (
                          <p className="mt-2 text-[12px] text-[#277449]">
                            {p.balance >= p.targetAmount ? "Uangnya sudah terkumpul. Saat bayar, pakai tab Bayar." : "Hari-H sudah lewat. Sisanya bisa ditarik ke saldo."}
                          </p>
                        )}
                      </div>
                    )}

                    <Segmented
                      value={goalTab}
                      onChange={(v) => (setGoalTab(v), setAmountInput(""), setNoteInput(""))}
                      options={[
                        { id: "history" as const, label: "Riwayat", icon: History },
                        { id: "topup" as const, label: "Isi", icon: ArrowDownToLine },
                        ...(p.profile ? [{ id: "spend" as const, label: "Bayar", icon: ReceiptText }] : []),
                        { id: "withdraw" as const, label: "Tarik", icon: ArrowUpFromLine },
                        ...(p.profile ? [] : [{ id: "target" as const, label: "Target", icon: Target }]),
                      ]}
                    />

                    {goalTab === "history" && <PocketHistory {...historyFor(p)} spentThisMonth={0} onEditEmail={setEditingTx} />}

                    {(goalTab === "topup" || goalTab === "withdraw" || goalTab === "spend") && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (amount <= 0 || amount > limit) return;
                          if (goalTab === "topup") {
                            moveToBudgetPocket(p.id, amount);
                            triggerToast(`${formatRupiah(amount)} disisihkan ke ${p.name}`);
                          } else if (goalTab === "withdraw") {
                            withdrawFromBudgetPocket(p.id, amount);
                            triggerToast(`${formatRupiah(amount)} kembali ke saldo`);
                          } else {
                            spendFromBudgetPocket(p.id, amount, noteInput.trim() || p.profile?.occasion || "Pembayaran");
                            triggerToast(`Pembayaran ${formatRupiah(amount)} dicatat dari ${p.name}`);
                          }
                          setAmountInput("");
                          setNoteInput("");
                        }}
                        className="space-y-3"
                      >
                        {goalTab === "spend" && (
                          <input
                            type="text"
                            aria-label="Keterangan"
                            maxLength={80}
                            placeholder={p.profile?.occasion ?? "Keterangan"}
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            className="w-full rounded-xl border border-[#E9E5DD] px-3 py-2.5 text-sm focus:border-[#76520E] focus:outline-none"
                          />
                        )}
                        <AmountField
                          id="goal-amount"
                          label={goalTab === "topup" ? "Sisihkan dari saldo" : goalTab === "withdraw" ? "Kembalikan ke saldo" : "Bayar dari kantong ini"}
                          hint={goalTab === "topup" ? `Bisa dipakai ${formatRupiah(limit)}` : `Terkumpul ${formatRupiah(p.balance)}`}
                          value={amountInput}
                          onChange={setAmountInput}
                          limit={limit}
                          overText="Melebihi saldo yang tersedia."
                        />
                        {goalTab === "withdraw" && p.balance > 0 && (
                          <button type="button" onClick={() => setAmountInput(p.balance.toLocaleString("id-ID"))} className="text-[12px] font-semibold text-[#76520E] underline underline-offset-2">
                            Tarik semua
                          </button>
                        )}
                        <Button type="submit" variant={goalTab === "topup" ? "primary" : "bni"} fullWidth disabled={amount <= 0 || amount > limit}>
                          {goalTab === "topup" ? "Sisihkan" : goalTab === "withdraw" ? "Tarik ke saldo" : "Catat pembayaran"}
                        </Button>
                      </form>
                    )}

                    {goalTab === "target" && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (amount <= 0) return;
                          setBudgetPocketTarget(p.id, amount);
                          triggerToast(`Target ${p.name} jadi ${formatRupiah(amount)}`);
                          setAmountInput("");
                        }}
                        className="space-y-3"
                      >
                        <AmountField id="goal-target" label="Target" hint={`Sekarang ${formatRupiah(p.targetAmount)}`} value={amountInput} onChange={setAmountInput} />
                        <Button type="submit" variant="primary" fullWidth disabled={amount <= 0}>
                          Simpan target
                        </Button>
                      </form>
                    )}

                    <DeleteRow
                      confirming={isConfirmingDelete}
                      setConfirming={setIsConfirmingDelete}
                      text={`Hapus ${p.name}?${p.balance > 0 ? ` ${formatRupiah(p.balance)} kembali ke saldo yang bisa dipakai.` : ""}`}
                      onDelete={() => {
                        deleteBudgetPocket(p.id);
                        setSelectedId(null);
                        triggerToast(p.balance > 0 ? `${p.name} dihapus. ${formatRupiah(p.balance)} kembali ke saldo` : `${p.name} dihapus`);
                      }}
                    />
                  </div>
                );
              })())}
      </Modal>

      {isProfileOpen && (
        <PocketProfileSheet
          money={{
            main: spendable,
            pockets,
            // what a day may cost: the income spread over the month, else the balance over the days left
            dailyBudgetSafe: monthlyIncome ? Math.round(monthlyIncome / 30) : assetsSet ? perDayLeft : 0,
            monthlyAllowance: 0,
            balancesKnown: assetsSet,
          }}
          icons={POCKET_ICONS}
          tones={POCKET_TONES}
          onCreate={createFromProfile}
          onClose={() => setIsProfileOpen(false)}
        />
      )}

      {isPlanOpen && plan && <BudgetPlanSheet plan={plan} income={monthlyIncome} onApply={applyPlan} onClose={() => setIsPlanOpen(false)} />}

      {editingTx && (
        <TransactionSheet key={editingTx.id} tx={editingTx} all={allEmailTxs} onClose={() => setEditingTx(null)} onSave={(edit) => saveTxEdit(editingTx, edit)} />
      )}

      {/* SALDO */}
      <Modal variant="sheet" isOpen={isSaldoOpen} onClose={() => setIsSaldoOpen(false)} title="Saldo & pemasukan">
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = parseAmount(assetInput);
              if (!setTotalAssets(t)) {
                setAssetError(`Minimal ${formatRupiah(setAside)}, karena sebanyak itu sudah kamu sisihkan.`);
                return;
              }
              setAssetError(null);
              setAssetInput("");
              triggerToast(`Total saldo diatur ke ${formatRupiah(t)}`);
            }}
            className="space-y-2"
          >
            <label htmlFor="total-assets" className="block text-xs font-semibold text-[#2F240E]">
              Total saldo rekeningmu
            </label>
            <div className="flex gap-2">
              <div className="flex flex-1 items-center rounded-xl border border-[#E9E5DD] px-3 focus-within:border-[#76520E]">
                <span className="text-sm font-semibold text-[#736B60]">Rp</span>
                <input
                  id="total-assets"
                  type="text"
                  inputMode="numeric"
                  placeholder={assetsSet ? total.toLocaleString("id-ID") : "0"}
                  value={assetInput}
                  onChange={(e) => setAssetInput(formatAmountInput(e.target.value))}
                  className="w-full bg-transparent px-2 py-2.5 text-base font-semibold tabular-nums text-[#2F240E] focus:outline-none"
                />
              </div>
              <Button type="submit" disabled={!assetInput}>
                Simpan
              </Button>
            </div>
            <p className={cn("text-[11px]", assetError ? "text-[#C43737]" : "text-[#736B60]")}>
              {assetError ??
                `Yang bisa dipakai = total ini dikurangi yang disisihkan (${formatRupiah(setAside)}).${
                  emailBalance.active ? ` Setelah itu Nera mengurangi sendiri dari struk email${emailBalance.receipts > 0 ? ` (${formatRupiah(emailBalance.deducted)} dari ${emailBalance.receipts} struk sejak ${shortDate(emailBalance.since)})` : ""}.` : ""
                }`}
            </p>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const income = incomeInput ? parseAmount(incomeInput) : (monthlyIncome ?? 0);
              setMonthlyIncome(income > 0 ? income : null, incomeDayInput);
              setIncomeInput("");
              triggerToast(
                income > 0
                  ? `Pemasukan ${formatRupiah(income)}/bulan${incomeDayInput ? `, masuk tiap tanggal ${incomeDayInput}` : ""}`
                  : "Pemasukan dikosongkan",
              );
            }}
            className="space-y-2"
          >
            <label htmlFor="monthly-income" className="block text-xs font-semibold text-[#2F240E]">
              Pemasukan per bulan
            </label>
            <div className="flex gap-2">
              <div className="flex flex-1 items-center rounded-xl border border-[#E9E5DD] px-3 focus-within:border-[#76520E]">
                <span className="text-sm font-semibold text-[#736B60]">Rp</span>
                <input
                  id="monthly-income"
                  type="text"
                  inputMode="numeric"
                  placeholder={monthlyIncome ? monthlyIncome.toLocaleString("id-ID") : "Uang saku, gaji, kiriman"}
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(formatAmountInput(e.target.value))}
                  className="w-full bg-transparent px-2 py-2.5 text-base font-semibold tabular-nums text-[#2F240E] focus:outline-none"
                />
              </div>
              <Button type="submit" variant="outline" disabled={!incomeInput && incomeDayInput === incomeDay}>
                Simpan
              </Button>
            </div>
            <IncomeDayPicker value={incomeDayInput} onChange={setIncomeDayInput} />
            <p className="text-[11px] text-[#736B60]">
              {monthlyIncome ? `Sekarang ${formatRupiah(monthlyIncome)}. ` : "Belum diisi. "}
              Dipakai untuk membandingkan budget{incomeDay ? " dan membagi saldo per hari sampai uangnya masuk" : ""}.
            </p>
          </form>

          {assetsSet && (
            <dl className="divide-y divide-[#F0EEE9] overflow-hidden rounded-[18px] border border-[#E9E5DD] text-xs">
              <div className="flex justify-between px-3.5 py-3">
                <dt className="text-[#736B60]">Bisa dipakai</dt>
                <dd className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(spendable)}</dd>
              </div>
              <div className="flex justify-between px-3.5 py-3">
                <dt className="text-[#736B60]">Disisihkan ({goals.length} tabungan)</dt>
                <dd className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(setAside)}</dd>
              </div>
              <div className="flex justify-between bg-[#FFFBF0] px-3.5 py-3">
                <dt className="font-bold text-[#2F240E]">Total saldo</dt>
                <dd className="font-bold tabular-nums text-[#2F240E]">{formatRupiah(total)}</dd>
              </div>
            </dl>
          )}

          {/* the "email_planning" consent, asked where the balance uses it */}
          {emailSpending.ready && !planningConsent && (
            <EmailPlanningConsent
              consent={{ version: "", emailImport: true, aiProcessing: false, emailPlanning: false }}
              busy={false}
              onChange={async (kind, granted) => {
                try {
                  await emailApi.setConsent(kind, granted);
                  await useEmailSpendingStore.getState().load(true);
                  triggerToast("Saldo sekarang mengikuti struk emailmu");
                } catch (e) {
                  triggerToast((e as Error).message);
                }
              }}
            />
          )}
        </div>
      </Modal>

      {/* CREATE */}
      <Modal isOpen={createKind !== null} onClose={() => setCreateKind(null)} title={createKind === "spending" ? "Pos budget baru" : "Tabungan baru"}>
        <form onSubmit={handleCreate} className="space-y-4">
          <p className="text-[12px] leading-relaxed text-[#736B60]">
            {createKind === "spending"
              ? "Batas belanja per bulan untuk satu jenis pengeluaran. Struk email di kategori ini terhitung otomatis."
              : "Uang yang kamu sisihkan dari saldo untuk sesuatu yang ditunggu."}
          </p>
          <div>
            <label htmlFor="pocket-name" className="mb-1 block text-xs font-semibold text-[#2F240E]">
              Nama
            </label>
            <input
              id="pocket-name"
              type="text"
              maxLength={24}
              placeholder={createKind === "spending" ? "Contoh: Nongkrong" : "Contoh: Dana Darurat"}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-xl border border-[#E9E5DD] px-3 py-2.5 text-sm focus:border-[#76520E] focus:outline-none"
              required
            />
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-[#2F240E]">{createKind === "spending" ? "Jenis pengeluaran" : "Ikon"}</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(POCKET_ICONS) as BudgetPocketIcon[]).map((key) => {
                const Icon = POCKET_ICONS[key];
                const active = newIcon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setNewIcon(key)}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-0.5 rounded-[12px] text-[10px] font-semibold transition-colors duration-150",
                      active ? "bg-[#FFB900] text-[#352500]" : "bg-[#F7F5F0] text-[#76520E] hover:bg-[#FFF0BD]",
                    )}
                  >
                    <Icon size={18} />
                    {ICON_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-[#2F240E]">Warna</legend>
            <div className="flex flex-wrap gap-2.5">
              {(Object.keys(POCKET_TONES) as BudgetPocketTone[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={POCKET_TONES[key].label}
                  aria-pressed={newTone === key}
                  onClick={() => setNewTone(key)}
                  className={cn("h-8 w-8 rounded-full ring-offset-2 transition-shadow duration-150", POCKET_TONES[key].swatch, newTone === key ? "ring-2 ring-[#76520E]" : "ring-1 ring-[#E9E5DD]")}
                />
              ))}
            </div>
          </fieldset>

          <AmountField id="pocket-target" label={createKind === "spending" ? "Budget per bulan" : "Target"} value={newTarget} onChange={setNewTarget} />
          {createKind === "saving" && (
            <AmountField
              id="pocket-initial"
              label="Sisihkan sekarang (opsional)"
              hint={`Bisa dipakai ${formatRupiah(Math.max(0, spendable))}`}
              value={newInitial}
              onChange={setNewInitial}
              limit={Math.max(0, spendable)}
              overText="Melebihi saldo yang bisa dipakai."
            />
          )}

          <Button type="submit" variant="primary" fullWidth disabled={!isCreateValid}>
            {createKind === "spending" ? "Buat pos budget" : "Buat tabungan"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function DeleteRow({ confirming, setConfirming, text, onDelete }: { confirming: boolean; setConfirming: (v: boolean) => void; text: string; onDelete: () => void }) {
  return (
    <div className="border-t border-[#E9E5DD] pt-3">
      {confirming ? (
        <div className="space-y-2.5">
          <p className="text-xs leading-relaxed text-[#736B60]">{text}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" fullWidth onClick={() => setConfirming(false)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" fullWidth onClick={onDelete}>
              Ya, hapus
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="flex items-center gap-1.5 text-xs font-semibold text-[#C43737] hover:underline">
          <Trash2 size={14} />
          Hapus
        </button>
      )}
    </div>
  );
}
