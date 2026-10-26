"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { useFinancialStore } from "../../../context/FinancialStore";
import { POCKET_CATEGORIES, planBudget, useEmailSpending, useEmailSpendingStore } from "../../../lib/emailSpending";
import { BudgetPlanSheet, type ChosenLine } from "../../../components/insights/BudgetPlanSheet";
import { CATEGORY_LABEL, emailApi, type EmailTransaction } from "../../../lib/emailImport";
import { PocketHistory } from "../../../components/insights/PocketHistory";
import { TransactionSheet, type TransactionEdit } from "../../../components/insights/TransactionSheet";
import { PeriodFilter, periodRange } from "../../../components/insights/PeriodFilter";
import { inPeriod, presetPeriod, type Period } from "../../../lib/period";
import { NeraOrb } from "../../../components/mascot/NeraOrb";
import { PocketProfileSheet } from "../../../components/insights/PocketProfileSheet";
import { dueLabel, perDayNow, type ProfilePlan } from "../../../lib/pocketProfile";
import { usePushState } from "../../../lib/push";
import { onWalletError } from "../../../lib/wallet";
import { ReminderToggle } from "../../../components/insights/ReminderToggle";
import { EmailPlanningConsent } from "../../../components/consent/ConsentCard";
import { useEmailBalance, useEmailBalanceSync } from "../../../lib/emailBalance";
import { Modal, Button, cn } from "@nera/ui";
import type {
  BudgetPocket,
  BudgetPocketIcon,
  BudgetPocketKind,
  BudgetPocketTone,
} from "@nera/core";
import {
  Plus,
  ArrowLeftRight,
  Wallet,
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
  Search,
  Eye,
  EyeOff,
  Info,
  SlidersHorizontal,
  Layers,
  PiggyBank,
  ArrowRight,
  Zap,
  CalendarDays,
  Sparkles,
} from "lucide-react";

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

const MAIN_TONE: BudgetPocketTone = "mint";

const QUICK_AMOUNTS = [25000, 50000, 100000, 250000];

type DetailMode = "history" | "topup" | "spend" | "withdraw";

type FilterId = "all" | "mine" | "investment";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "mine", label: "Kantong Saya" },
  { id: "investment", label: "Investasi" },
];

type PocketCardItem = { type: "main" } | { type: "pocket"; pocket: BudgetPocket };

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);

const formatRupiahShort = (val: number) => {
  if (val >= 1000000) return `Rp${(val / 1000000).toFixed(1).replace(".0", "")}jt`;
  if (val >= 1000) return `Rp${(val / 1000).toFixed(0)}rb`;
  return `Rp${val}`;
};

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "";

const parseAmount = (raw: string) => Number(raw.replace(/\D/g, "")) || 0;
const formatAmountInput = (raw: string) => {
  const n = parseAmount(raw);
  return n ? n.toLocaleString("id-ID") : "";
};

const usagePct = (pocket: BudgetPocket) => {
  const base = pocket.kind === "spending" ? pocket.spentThisMonth : pocket.balance;
  if (pocket.targetAmount <= 0) return 0;
  return Math.min(100, Math.round((base / pocket.targetAmount) * 100));
};

const spendingStatus = (pct: number) => {
  if (pct >= 90) return { label: "Hampir habis", className: "bg-[#FBE4DE] text-[#A92F2F]" };
  if (pct >= 70) return { label: "Hati-hati", className: "bg-[#FFF3D6] text-[#76520E]" };
  return null;
};

const PLAN_APPLIED_KEY = "nera-budget-plan-applied";

const pocketSubtitle = (pocket: BudgetPocket) => {
  if (pocket.profile) {
    const due = dueLabel(pocket.profile.dueDate);
    return `${due.date} · ${due.relative}`;
  }
  return pocket.kind === "saving" ? "Kantong Tabungan" : "Kantong Belanja";
};

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
    setMonthlyIncome,
    assetsSet,
    setTotalAssets,
    confirmBalance,
  } = useFinancialStore();
  // Kantong Utama follows the receipts from email once the user entered their total
  useEmailBalanceSync();
  const emailBalance = useEmailBalance();
  const planningConsent = useEmailSpendingStore((s) => s.planningConsent);
  // the seeded balances are demo money, not the user's: until they enter their own
  // total, every balance on this page reads Rp0 (budgets and spending still show)
  const dailyPocket = assetsSet ? storedMain : 0;
  const budgetPockets = useMemo(
    () => (assetsSet ? storedPockets : storedPockets.map((p) => ({ ...p, balance: 0 }))),
    [assetsSet, storedPockets],
  );
  const [assetInput, setAssetInput] = useState("");
  const [incomeInput, setIncomeInput] = useState("");
  const [assetError, setAssetError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>("topup");
  const [detailAmount, setDetailAmount] = useState("");
  const [spendNote, setSpendNote] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isMainOpen, setIsMainOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<BudgetPocketKind>("spending");
  const [newIcon, setNewIcon] = useState<BudgetPocketIcon>("food");
  const [newTone, setNewTone] = useState<BudgetPocketTone>("teal");
  const [newTarget, setNewTarget] = useState("");
  const [newInitial, setNewInitial] = useState("");

  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showBalances, setShowBalances] = useState(true);
  const [period, setPeriod] = useState<Period>(() => presetPeriod("this_month"));

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // spending budgets also count receipts imported from email (other banks, e-wallets);
  // only the "used" figure changes, the pocket balance is BNI money and stays as is
  const emailSpending = useEmailSpending();
  // the pocket detail is always about this month's budget
  const withEmail = (p: BudgetPocket): BudgetPocket =>
    p.kind === "spending" ? { ...p, spentThisMonth: p.spentThisMonth + emailSpending.spentForPocket(p.icon) } : p;

  // the summary and cards follow the period filter. BNI pocket spending only exists for
  // this month, so other periods show email spending alone against the budget scaled to
  // the period's length (from the oldest imported receipt when the period starts earlier)
  const isThisMonth = period.key === "this_month";
  const periodEmail = emailSpending.inPeriod(period);
  const oldestEmail = emailSpending.recent.reduce((min, t) => Math.min(min, Date.parse(t.occurredAt)), Date.now());
  const periodDays = Math.max(
    1,
    (Math.min(period.to.getTime(), Date.now()) - Math.max(period.from.getTime(), oldestEmail)) / 86_400_000,
  );
  const budgetScale = isThisMonth ? 1 : periodDays / 30.44;
  const emailLabel = isThisMonth ? "bulan ini" : period.key === "custom" ? "di rentang ini" : period.label.toLowerCase();
  const forPeriod = (p: BudgetPocket): BudgetPocket =>
    p.kind === "spending"
      ? {
          ...p,
          spentThisMonth: (isThisMonth ? p.spentThisMonth : 0) + periodEmail.spentForPocket(p.icon),
          targetAmount: Math.round(p.targetAmount * budgetScale),
        }
      : p;
  const spentFromEmail = budgetPockets
    .filter((p) => p.kind === "spending")
    .reduce((sum, p) => sum + periodEmail.spentForPocket(p.icon), 0);
  // email spending in categories no pocket covers, so this page adds up with /email
  const coveredIcons = new Set(budgetPockets.filter((p) => p.kind === "spending").map((p) => p.icon));
  const uncovered = periodEmail.byCategory.filter(
    (c) => !Object.entries(POCKET_CATEGORIES).some(([icon, cats]) => coveredIcons.has(icon as BudgetPocket["icon"]) && cats?.includes(c.category)),
  );
  const uncoveredTotal = uncovered.reduce((sum, c) => sum + c.amount, 0);

  const spendingPockets = budgetPockets.filter((p) => p.kind === "spending").map(forPeriod);

  // pocket history: this month's receipts in the pocket's categories, plus its own activity
  const thisMonth = presetPeriod("this_month");
  const historyFor = (p: BudgetPocket) => ({
    emailTxs:
      p.kind === "spending"
        ? emailSpending.spends.filter((t) => POCKET_CATEGORIES[p.icon]?.includes(t.category) && inPeriod(t.occurredAt, thisMonth))
        : [],
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
      else
        triggerToast(
          `${r.alsoChanged > 0 ? `${r.alsoChanged + 1} transaksi ` : ""}${t.merchant} dipindah ke ${CATEGORY_LABEL[edit.category]}`,
        );
    } catch (e) {
      triggerToast((e as Error).message);
    }
  };

  // the whole budget proposed from email history ("Pakai budget ini")
  const plan = useMemo(
    () => (emailSpending.ready ? planBudget(emailSpending.spends, budgetPockets) : null),
    [emailSpending.ready, emailSpending.spends, budgetPockets],
  );
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
    triggerToast(
      `Budget ${formatRupiah(lines.reduce((s, l) => s + l.budget, 0))}/bulan dipakai${created ? ` · ${created} kantong baru` : ""}`,
    );
  };
  const createFromProfile = (plan: ProfilePlan) => {
    const id = createProfilePocket(
      {
        name: plan.draft.name,
        icon: plan.draft.icon,
        tone: plan.tone,
        targetAmount: plan.draft.amount,
        profile: { occasion: plan.draft.occasion, dueDate: plan.draft.dueDate },
      },
      plan.fromPockets.map((s) => ({ pocketId: s.pocket.id, amount: s.amount })),
      plan.fromMainNow,
    );
    setIsProfileOpen(false);
    openDetail(id, "topup");
    triggerToast(`Kantong ${plan.draft.name} siap. ${plan.perDay > 0 ? `Sisihkan ${formatRupiah(plan.perDay)} tiap hari` : "Uangnya sudah terkumpul"}`);
  };
  const savingPockets = budgetPockets.filter((p) => p.kind === "saving");
  const selectedPocket = budgetPockets.find((p) => p.id === selectedId) ?? null;

  const totals = useMemo(() => {
    const inPockets = budgetPockets.reduce((sum, p) => sum + p.balance, 0);
    const inSpending = spendingPockets.reduce((sum, p) => sum + p.balance, 0);
    const inSaving = savingPockets.reduce((sum, p) => sum + p.balance, 0);
    const budget = spendingPockets.reduce((sum, p) => sum + p.targetAmount, 0);
    const spent = spendingPockets.reduce((sum, p) => sum + p.spentThisMonth, 0);
    return {
      inPockets,
      inSpending,
      inSaving,
      all: inPockets + dailyPocket,
      budget,
      spent,
    };
  }, [budgetPockets, spendingPockets, savingPockets, dailyPocket]);

  const money = (val: number) => (showBalances ? formatRupiah(val) : "Rp — — —");

  const visibleCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const items: PocketCardItem[] = [{ type: "main" }];

    budgetPockets.forEach((pocket) => items.push({ type: "pocket", pocket }));

    return items.filter((item) => {
      if (item.type === "main") {
        if (activeFilter === "investment") return false;
      } else {
        if (activeFilter === "investment" && item.pocket.kind !== "saving") return false;
        if (activeFilter === "mine" && item.pocket.kind !== "spending") return false;
      }

      if (!query) return true;
      const name = item.type === "main" ? "kantong utama" : item.pocket.name.toLowerCase();
      return name.includes(query);
    });
  }, [budgetPockets, activeFilter, searchQuery]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const openDetail = (pocketId: string, mode: DetailMode = "topup") => {
    setSelectedId(pocketId);
    setDetailMode(mode);
    setDetailAmount("");
    setSpendNote("");
    setIsConfirmingDelete(false);
  };

  const closeDetail = () => setSelectedId(null);

  const resetCreateForm = () => {
    setNewName("");
    setNewKind("spending");
    setNewIcon("food");
    setNewTone("teal");
    setNewTarget("");
    setNewInitial("");
  };

  const openCreate = (kind: BudgetPocketKind = "spending") => {
    resetCreateForm();
    setNewKind(kind);
    if (kind === "saving") {
      setNewIcon("gadget");
      setNewTone("cyan");
    }
    setIsCreateOpen(true);
  };

  const detailLimit = selectedPocket
    ? detailMode === "topup"
      ? dailyPocket
      : selectedPocket.balance
    : 0;
  const detailValue = parseAmount(detailAmount);
  const isDetailValid = detailValue > 0 && detailValue <= detailLimit;

  const handleDetailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPocket || !isDetailValid) return;

    if (detailMode === "topup") {
      moveToBudgetPocket(selectedPocket.id, detailValue);
      triggerToast(`${formatRupiah(detailValue)} masuk ke Kantong ${selectedPocket.name}`);
    } else if (detailMode === "spend") {
      spendFromBudgetPocket(selectedPocket.id, detailValue, spendNote.trim() || "Pembayaran QRIS");
      triggerToast(`Pengeluaran ${formatRupiah(detailValue)} dicatat dari ${selectedPocket.name}`);
    } else {
      withdrawFromBudgetPocket(selectedPocket.id, detailValue);
      triggerToast(`${formatRupiah(detailValue)} kembali ke Kantong Utama`);
    }

    setDetailAmount("");
    setSpendNote("");
  };

  const handleDelete = () => {
    if (!selectedPocket) return;
    const { name, balance } = selectedPocket;
    deleteBudgetPocket(selectedPocket.id);
    closeDetail();
    triggerToast(
      balance > 0
        ? `Kantong ${name} dihapus. ${formatRupiah(balance)} kembali ke Kantong Utama`
        : `Kantong ${name} dihapus`
    );
  };

  const newTargetValue = parseAmount(newTarget);
  const newInitialValue = parseAmount(newInitial);
  const isCreateValid =
    newName.trim().length > 0 && newTargetValue > 0 && newInitialValue <= dailyPocket;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreateValid) return;

    createBudgetPocket(
      {
        name: newName.trim(),
        kind: newKind,
        icon: newIcon,
        tone: newTone,
        targetAmount: newTargetValue,
      },
      newInitialValue
    );
    setIsCreateOpen(false);
    triggerToast(`Kantong ${newName.trim()} siap dipakai`);
    resetCreateForm();
  };

  const mainTone = POCKET_TONES[MAIN_TONE];

  // reminders for Rencana dadakan pockets (Web Push); the worker reads the pockets from the DB
  const push = usePushState();
  // an op the server turned down (a balance changed elsewhere): say why; the DB's numbers are back
  useEffect(() => onWalletError((msg) => triggerToast(msg)), []);

  return (
    <div className="flex flex-col min-h-full bg-[#F1F2F4]">
      <TopAppBar title="Kantong" showBack />

      <main className="flex-1 space-y-5 px-4 pb-8 pt-3">
        {/* SEARCH */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A938A]"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kantong"
              aria-label="Cari kantong"
              className="h-11 w-full rounded-[14px] bg-[#E7E9EC] pl-10 pr-3 text-sm font-medium text-[#2F240E] placeholder:text-[#9A938A] focus:bg-white focus:outline-2 focus:outline-[#BA8500]"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsManageOpen(true)}
            aria-label="Kelola kantong"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#2F240E] transition-colors hover:bg-[#FFFBF0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]"
          >
            <SlidersHorizontal size={19} />
          </button>
        </div>

        {/* FILTERS */}
        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                aria-pressed={active}
                className={cn(
                  "h-9 shrink-0 rounded-full px-3.5 text-[13px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]",
                  active
                    ? "bg-[#2F240E] font-bold text-white"
                    : "bg-transparent font-medium text-[#A29B90] hover:text-[#2F240E]"
                )}
              >
                {filter.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => openCreate("spending")}
            aria-label="Buat kantong baru"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#2F240E] transition-colors hover:bg-[#E7E9EC] focus-visible:outline-2 focus-visible:outline-[#BA8500]"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* TOTAL ASET */}
        <section className="flex items-center justify-between rounded-[22px] bg-white px-4 py-4">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[15px] font-bold text-[#2F240E]">Aset Saya</h2>
            <button
              type="button"
              onClick={() => setIsInfoOpen(true)}
              aria-label="Informasi aset"
              className="text-[#FFB900] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-[#BA8500]"
            >
              <Info size={15} strokeWidth={2.4} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold tabular-nums text-[#2F240E]">
              {money(totals.all)}
            </span>
            {!assetsSet && (
              <button
                type="button"
                onClick={() => (setAssetInput(""), setAssetError(null), setIsInfoOpen(true))}
                className="h-7 rounded-full bg-[#FFB900] px-2.5 text-[11px] font-bold text-[#352500] hover:bg-[#E6A700]"
              >
                Atur
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowBalances((prev) => !prev)}
              aria-pressed={!showBalances}
              aria-label={showBalances ? "Sembunyikan saldo" : "Tampilkan saldo"}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#2F240E] transition-colors hover:bg-[#F1F2F4] focus-visible:outline-2 focus-visible:outline-[#BA8500]"
            >
              {showBalances ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </section>

        {/* BALANCE CHECK: the balance has run on receipts for a while, or went below 0 */}
        {emailBalance.needsCheck && (
          <section className="flex items-center gap-3 rounded-[20px] bg-[#FFF0BD] px-4 py-3.5">
            <NeraOrb mood={dailyPocket < 0 ? "alert" : "happy"} size={40} still trackPointer={false} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[#2F240E]">
                {dailyPocket < 0 ? "Saldomu perlu dicek" : <>Saldomu sekarang <span className="tabular-nums">{formatRupiah(totals.all)}</span>?</>}
              </p>
              <p className="text-[11px] leading-snug text-[#5C4A1E]">
                {dailyPocket < 0
                  ? "Pengeluaran dari struk email melebihi saldo yang tercatat. Mungkin ada uang masuk."
                  : `Nera mengurangi ${formatRupiah(emailBalance.deducted)} dari ${emailBalance.receipts} struk email sejak ${shortDate(emailBalance.since)}.`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {dailyPocket >= 0 && (
                <button
                  type="button"
                  onClick={() => (confirmBalance(), triggerToast("Saldo dikonfirmasi"))}
                  className="h-9 rounded-full bg-[#2F240E] px-3.5 text-[12px] font-semibold text-white hover:bg-[#46371A]"
                >
                  Benar
                </button>
              )}
              <button
                type="button"
                onClick={() => (setAssetInput(""), setAssetError(null), setIsInfoOpen(true))}
                className="h-9 rounded-full bg-white px-3.5 text-[12px] font-semibold text-[#2F240E] hover:bg-[#FFF8E1]"
              >
                Ubah
              </button>
            </div>
          </section>
        )}

        {/* AUTO BUDGET: the whole budget from the user's own receipts */}
        {plan && activeFilter !== "investment" && planAppliedMonth !== monthKey && (
          <section className="flex items-center gap-3 rounded-[20px] bg-[#FFF0BD] px-4 py-3.5">
            <NeraOrb mood="happy" size={40} still trackPointer={false} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[#2F240E]">
                Nera sudah menyusun budgetmu
              </p>
              <p className="text-[11px] leading-snug text-[#5C4A1E]">
                {plan.lines.filter((l) => !l.occasional).length} kantong · <span className="tabular-nums">{formatRupiah(plan.total)}</span>/bulan, dari kebiasaanmu sendiri
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPlanOpen(true)}
              className="h-9 shrink-0 rounded-full bg-[#2F240E] px-3.5 text-[12px] font-semibold text-white hover:bg-[#46371A]"
            >
              Lihat usulan
            </button>
          </section>
        )}

        {/* RENCANA DADAKAN: Nera plans a pocket for something coming up */}
        {activeFilter !== "investment" && (
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="flex w-full items-center gap-3 rounded-[20px] bg-white px-4 py-3.5 text-left transition-transform duration-150 hover:bg-[#FFFBF0] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#FFF0BD] text-[#76520E]">
              <Sparkles size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-[#2F240E]">Ada rencana dadakan?</span>
              <span className="block text-[11px] leading-snug text-[#736B60]">Diajak AYCE atau nonton? Nera siapkan kantongnya</span>
            </span>
            <ArrowRight size={17} className="shrink-0 text-[#76520E]" />
          </button>
        )}

        {/* BUDGET SUMMARY */}
        {spendingPockets.length > 0 && (
          <section className="rounded-[20px] bg-white px-4 py-3.5">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#F1EEE8] pb-3">
              <p className="min-w-0 truncate text-[11px] text-[#736B60]">{periodRange(period)}</p>
              <PeriodFilter value={period} onChange={setPeriod} />
            </div>
            {(() => {
              const pct = totals.budget > 0 ? Math.round((totals.spent / totals.budget) * 100) : 0;
              const over = totals.spent >= totals.budget;
              return (
                <>
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#736B60]">
                        {isThisMonth ? "Terpakai bulan ini" : `Terpakai ${period.key === "custom" ? "di rentang ini" : period.label.toLowerCase()}`}
                      </p>
                      <p className="mt-0.5 text-[24px] font-bold leading-tight tabular-nums text-[#2F240E]">{formatRupiah(totals.spent)}</p>
                      <p className="text-[12px] text-[#736B60]">
                        dari budget <span className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(totals.budget)}</span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold tabular-nums",
                        over ? "bg-[#FBEDED] text-[#A92F2F]" : pct >= 90 ? "bg-[#FFF3D6] text-[#76520E]" : "bg-[#E3F3E9] text-[#277449]",
                      )}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F1F2F4]">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-500", over ? "bg-[#C43737]" : "bg-[#FFB900]")}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <dl className="mt-3 space-y-1.5 border-t border-[#F1EEE8] pt-3 text-[12px]">
                    {isThisMonth && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#736B60]">Dicatat di kantong</dt>
                        <dd className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(totals.spent - spentFromEmail)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#736B60]">Dari struk email</dt>
                      <dd className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(spentFromEmail)}</dd>
                    </div>
                    {uncoveredTotal > 0 && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#736B60]">
                          Email tanpa kantong ({uncovered.map((c) => c.label).join(", ")})
                          <span className="block text-[11px]">tidak dihitung di sini</span>
                        </dt>
                        <dd className="tabular-nums text-[#736B60]">{formatRupiah(uncoveredTotal)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#736B60]">
                        Budget = target {spendingPockets.length} kantong belanja
                        {!isThisMonth && <span className="block text-[11px]">disesuaikan ke {Math.round(periodDays)} hari</span>}
                      </dt>
                      <dd className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(totals.budget)}</dd>
                    </div>
                  </dl>
                  {isThisMonth && monthlyIncome !== null && monthlyIncome > 0 && totals.budget > monthlyIncome && (
                    <p className="mt-3 rounded-xl bg-[#FBEDED] px-3 py-2 text-[12px] leading-relaxed text-[#A92F2F]">
                      Budget melebihi pemasukan bulananmu ({formatRupiah(monthlyIncome)}) sebesar{" "}
                      <b className="tabular-nums">{formatRupiah(totals.budget - monthlyIncome)}</b>. Turunkan target kantong yang
                      paling besar.
                    </p>
                  )}
                  {plan && planAppliedMonth === monthKey && (
                    <button
                      type="button"
                      onClick={() => setIsPlanOpen(true)}
                      className="mt-3 text-[12px] font-semibold text-[#76520E] underline underline-offset-2"
                    >
                      Susun ulang budget otomatis
                    </button>
                  )}
                </>
              );
            })()}
          </section>
        )}

        {/* POCKET GRID */}
        <section>
          <div className="grid grid-cols-2 gap-3">
              {visibleCards.map((item) => {
                if (item.type === "main") {
                  return (
                    <button
                      key="main"
                      type="button"
                      onClick={() => (assetsSet ? setIsMainOpen(true) : (setAssetInput(""), setAssetError(null), setIsInfoOpen(true)))}
                      className={cn(
                        "flex min-h-[186px] flex-col rounded-[24px] p-4 text-left transition-transform duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]",
                        mainTone.card
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-[16px]",
                          mainTone.iconWrap,
                          mainTone.icon
                        )}
                      >
                        <Wallet size={25} strokeWidth={2} />
                      </div>
                      <div className="mt-auto w-full pt-6">
                        <p className={cn("truncate text-[15px] font-bold", mainTone.title)}>
                          Kantong Utama
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-[18px] font-bold leading-tight tabular-nums",
                            mainTone.title
                          )}
                        >
                          {money(dailyPocket)}
                        </p>
                        <p className={cn("mt-1 text-[11px] font-medium", mainTone.muted)}>
                          {assetsSet ? "Siap dipakai" : "Saldo belum diatur"}
                        </p>
                      </div>
                    </button>
                  );
                }

                const pocket = item.pocket;
                const tone = POCKET_TONES[pocket.tone];
                const Icon = POCKET_ICONS[pocket.icon];

                return (
                  <button
                    key={pocket.id}
                    type="button"
                    onClick={() =>
                      openDetail(pocket.id, "history")
                    }
                    className={cn(
                      "flex min-h-[186px] flex-col rounded-[24px] p-4 text-left transition-transform duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]",
                      tone.card
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-[16px]",
                        tone.iconWrap,
                        tone.icon
                      )}
                    >
                      <Icon size={25} strokeWidth={2} />
                    </div>
                    <div className="mt-auto w-full pt-6">
                      <p className={cn("truncate text-[15px] font-bold", tone.title)}>{pocket.name}</p>
                      {pocket.kind === "spending" ? (
                        // spending pockets lead with what was used (BNI + email) against the
                        // budget; the BNI balance is the second figure
                        (() => {
                          const p = forPeriod(pocket);
                          const pct = p.targetAmount > 0 ? Math.round((p.spentThisMonth / p.targetAmount) * 100) : 0;
                          const over = pct >= 100;
                          return (
                            <>
                              <p className={cn("mt-1.5 text-[10px] font-medium", tone.muted)}>Terpakai {emailLabel}</p>
                              <p className={cn("text-[18px] font-bold leading-tight tabular-nums", tone.title)}>
                                {money(p.spentThisMonth)}
                              </p>
                              <div className={cn("mt-1.5 h-1.5 w-full overflow-hidden rounded-full", tone.track)}>
                                <div
                                  className={cn("h-full rounded-full transition-[width] duration-500", over ? "bg-[#C43737]" : tone.fill)}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                              <p className={cn("mt-1 text-[10px] font-medium tabular-nums", over ? "font-bold text-[#A92F2F]" : tone.muted)}>
                                {showBalances ? `${pct}% dari ${formatRupiahShort(p.targetAmount)}` : `${pct}% budget`}
                              </p>
                              <p className={cn("mt-1.5 text-[10px] font-medium", tone.muted)}>
                                Saldo <span className="font-bold tabular-nums">{money(pocket.balance)}</span>
                              </p>
                            </>
                          );
                        })()
                      ) : (
                        <>
                          <p className={cn("mt-0.5 text-[18px] font-bold leading-tight tabular-nums", tone.title)}>
                            {money(pocket.balance)}
                          </p>
                          <p className={cn("mt-1 text-[11px] font-medium", tone.muted)}>{pocketSubtitle(pocket)}</p>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}

              {visibleCards.length === 0 && (
                <div className="col-span-2 rounded-[22px] bg-white px-5 py-7 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#F1F2F4] text-[#76520E]">
                    <Search size={22} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#2F240E]">Kantong tidak ditemukan</p>
                  <p className="mt-1 text-xs text-[#736B60]">
                    Coba kata kunci lain atau buat kantong baru.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => openCreate("spending")}
                className={cn(
                  "flex min-h-[186px] flex-col items-center justify-center gap-2 rounded-[24px] border-[1.5px] border-dashed border-[#D8D3C9] bg-white/60 text-[#76520E] transition-colors duration-150 hover:bg-[#FFFBF0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]",
                  visibleCards.length === 0 && "col-span-2 min-h-[120px]"
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#FFF0BD]">
                  <Plus size={24} />
                </div>
                <span className="text-xs font-semibold">Kantong Baru</span>
              </button>
            </div>
          </section>

      </main>

      {/* TOAST */}
      {toastMessage && (
        <div className="absolute top-14 inset-x-0 mx-auto max-w-[390px] px-4 z-[60] animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-[#2F240E] text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-medium border border-white/10">
            <span className="shrink-0">
              <NeraOrb mood="happy" size={30} still trackPointer={false} />
            </span>
            <span className="flex-1">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* MODAL: KELOLA */}
      <Modal isOpen={isManageOpen} onClose={() => setIsManageOpen(false)} title="Kelola Kantong">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setIsManageOpen(false);
              setIsPickerOpen(true);
            }}
            disabled={budgetPockets.length === 0}
            className="flex w-full items-center gap-3 rounded-[16px] bg-[#F7F7F7] px-3.5 py-3 text-left transition-colors hover:bg-[#FFFBF0] disabled:opacity-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white text-[#76520E]">
              <ArrowLeftRight size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#2F240E]">Pindah Dana</p>
              <p className="text-[11px] text-[#736B60]">Alokasikan saldo Kantong Utama</p>
            </div>
            <ArrowRight size={16} className="text-[#B8B1A6]" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsManageOpen(false);
              openCreate("spending");
            }}
            className="flex w-full items-center gap-3 rounded-[16px] bg-[#F7F7F7] px-3.5 py-3 text-left transition-colors hover:bg-[#FFFBF0]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white text-[#76520E]">
              <Plus size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#2F240E]">Buat Kantong Baru</p>
              <p className="text-[11px] text-[#736B60]">Pisahkan uang sesuai kebutuhanmu</p>
            </div>
            <ArrowRight size={16} className="text-[#B8B1A6]" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowBalances((prev) => !prev);
              setIsManageOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-[16px] bg-[#F7F7F7] px-3.5 py-3 text-left transition-colors hover:bg-[#FFFBF0]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white text-[#76520E]">
              {showBalances ? <EyeOff size={17} /> : <Eye size={17} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#2F240E]">
                {showBalances ? "Sembunyikan Saldo" : "Tampilkan Saldo"}
              </p>
              <p className="text-[11px] text-[#736B60]">Atur privasi nominal di layar ini</p>
            </div>
            <ArrowRight size={16} className="text-[#B8B1A6]" />
          </button>
        </div>
      </Modal>

      {/* MODAL: INFO ASET */}
      <Modal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} title="Aset Saya">
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-[#736B60]">
            Aset Saya adalah total saldo Kantong Utama ditambah seluruh kantong yang kamu buat.
            {!assetsSet && " Belum diatur, jadi masih Rp0. Isi total saldo rekeningmu sekarang."}
            {emailBalance.active &&
              ` Setelah kamu isi, Nera mengurangi Kantong Utama sendiri dari struk email${emailBalance.receipts > 0 ? `: ${formatRupiah(emailBalance.deducted)} dari ${emailBalance.receipts} struk sejak ${shortDate(emailBalance.since)}` : ""}.`}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const total = parseAmount(assetInput);
              if (!setTotalAssets(total)) {
                setAssetError(`Minimal ${formatRupiah(totals.inPockets)}, karena sebanyak itu sudah ada di kantong-kantongmu.`);
                return;
              }
              setAssetError(null);
              setAssetInput("");
              setIsInfoOpen(false);
              triggerToast(`Aset Saya diatur ke ${formatRupiah(total)}`);
            }}
            className="space-y-2"
          >
            <label htmlFor="total-assets" className="block text-xs font-semibold text-[#2F240E]">
              {assetsSet ? "Ubah total saldo" : "Total saldo kamu"}
            </label>
            <div className="flex gap-2">
              <div className="flex flex-1 items-center rounded-xl border border-[#E9E5DD] px-3 focus-within:border-[#76520E]">
                <span className="text-sm font-semibold text-[#736B60]">Rp</span>
                <input
                  id="total-assets"
                  type="text"
                  inputMode="numeric"
                  placeholder={assetsSet ? totals.all.toLocaleString("id-ID") : "0"}
                  value={assetInput}
                  onChange={(e) => setAssetInput(formatAmountInput(e.target.value))}
                  className="w-full bg-transparent px-2 py-2.5 text-base font-semibold tabular-nums text-[#2F240E] focus:outline-none"
                />
              </div>
              <Button type="submit" disabled={!assetInput}>
                Simpan
              </Button>
            </div>
            {assetError ? (
              <p className="text-[11px] text-[#C43737]">{assetError}</p>
            ) : (
              <p className="text-[11px] text-[#736B60]">
                Kantong Utama jadi total ini dikurangi isi kantong ({formatRupiah(totals.inPockets)}).
              </p>
            )}
          </form>
          {/* the income budgets are measured against; the user's own figure, not BNI demo data */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const income = parseAmount(incomeInput);
              setMonthlyIncome(income > 0 ? income : null);
              setIncomeInput("");
              triggerToast(income > 0 ? `Pemasukan bulanan diatur ke ${formatRupiah(income)}` : "Pemasukan bulanan dikosongkan");
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
              <Button type="submit" variant="outline" disabled={!incomeInput}>
                Simpan
              </Button>
            </div>
            <p className="text-[11px] text-[#736B60]">
              {monthlyIncome ? `Sekarang ${formatRupiah(monthlyIncome)}. ` : "Belum diisi. "}Dipakai untuk membandingkan budget kantong.
            </p>
          </form>
          {assetsSet && (
          <div className="overflow-hidden rounded-[18px] border border-[#E9E5DD] divide-y divide-[#F0EEE9]">
            <div className="flex items-center justify-between px-3.5 py-3 text-xs">
              <span className="flex items-center gap-2 text-[#736B60]">
                <Wallet size={15} /> Kantong Utama
              </span>
              <span className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(dailyPocket)}</span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-3 text-xs">
              <span className="flex items-center gap-2 text-[#736B60]">
                <Layers size={15} /> Kantong Belanja
              </span>
              <span className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(totals.inSpending)}</span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-3 text-xs">
              <span className="flex items-center gap-2 text-[#736B60]">
                <PiggyBank size={15} /> Kantong Tabungan
              </span>
              <span className="font-semibold tabular-nums text-[#2F240E]">{formatRupiah(totals.inSaving)}</span>
            </div>
            <div className="flex items-center justify-between bg-[#FFFBF0] px-3.5 py-3 text-xs">
              <span className="font-bold text-[#2F240E]">Total Aset</span>
              <span className="font-bold tabular-nums text-[#2F240E]">{formatRupiah(totals.all)}</span>
            </div>
          </div>
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

      {/* MODAL: KANTONG UTAMA */}
      <Modal isOpen={isMainOpen} onClose={() => setIsMainOpen(false)} title="Kantong Utama">
        <div className="space-y-4">
          <div className={cn("rounded-[20px] p-4", mainTone.card)}>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-[14px]",
                  mainTone.iconWrap,
                  mainTone.icon
                )}
              >
                <Wallet size={20} />
              </div>
              <div>
                <p className={cn("text-[11px]", mainTone.muted)}>Saldo siap pakai</p>
                <p className={cn("text-xl font-bold tabular-nums", mainTone.title)}>
                  {formatRupiah(dailyPocket)}
                </p>
              </div>
            </div>
            <p className={cn("mt-3 text-[11px] leading-relaxed", mainTone.muted)}>
              Kantong Utama menampung uang yang belum dialokasikan. Pindahkan ke kantong lain agar
              pengeluaranmu lebih terkendali.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsMainOpen(false);
                setIsPickerOpen(true);
              }}
              disabled={budgetPockets.length === 0}
            >
              <ArrowLeftRight size={16} className="mr-1.5" />
              Pindah Dana
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsMainOpen(false);
                openCreate("spending");
              }}
            >
              <Plus size={16} className="mr-1.5" />
              Buat Kantong
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: PILIH KANTONG TUJUAN */}
      <Modal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} title="Pindah ke Kantong">
        <p className="text-xs text-[#736B60] -mt-1 mb-3">
          Dana diambil dari Kantong Utama ({formatRupiah(dailyPocket)}).
        </p>
        <div className="overflow-hidden rounded-[18px] border border-[#E9E5DD] divide-y divide-[#F0EEE9]">
          {budgetPockets.map((pocket) => {
            const tone = POCKET_TONES[pocket.tone];
            const Icon = POCKET_ICONS[pocket.icon];
            return (
              <button
                key={pocket.id}
                type="button"
                onClick={() => {
                  setIsPickerOpen(false);
                  openDetail(pocket.id, "topup");
                }}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-150 hover:bg-[#FFFBF0] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#BA8500]"
              >
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-[12px] shrink-0", tone.card, tone.icon)}>
                  <Icon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#2F240E]">{pocket.name}</p>
                  <p className="text-[11px] text-[#736B60]">{pocketSubtitle(pocket)}</p>
                </div>
                <span className="text-[13px] font-semibold tabular-nums text-[#2F240E]">
                  {formatRupiah(pocket.balance)}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* MODAL: DETAIL KANTONG */}
      <Modal
        variant="sheet"
        isOpen={!!selectedPocket}
        onClose={closeDetail}
        title={selectedPocket ? `Kantong ${selectedPocket.name}` : "Kantong"}
      >
        {selectedPocket &&
          (() => {
            const tone = POCKET_TONES[selectedPocket.tone];
            const Icon = POCKET_ICONS[selectedPocket.icon];
            const pct = usagePct(withEmail(selectedPocket));
            const isSpending = selectedPocket.kind === "spending";
            const status = isSpending ? spendingStatus(pct) : null;
            const remaining = Math.max(0, selectedPocket.targetAmount - selectedPocket.balance);
            const modes: { id: DetailMode; label: string; icon: React.ElementType }[] = [
              { id: "history", label: "Riwayat", icon: History },
              { id: "topup", label: "Isi", icon: ArrowDownToLine },
              ...(isSpending || selectedPocket.profile ? [{ id: "spend" as const, label: "Pakai", icon: ReceiptText }] : []),
              { id: "withdraw", label: "Tarik", icon: ArrowUpFromLine },
            ];

            return (
              <div className="space-y-4">
                <div className={cn("rounded-[20px] p-4", tone.card)}>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-11 w-11 items-center justify-center rounded-[14px]", tone.iconWrap, tone.icon)}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[11px]", tone.muted)}>Saldo kantong</p>
                      <p className={cn("text-xl font-bold tabular-nums", tone.title)}>
                        {formatRupiah(selectedPocket.balance)}
                      </p>
                    </div>
                    {status && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", status.className)}>
                        {status.label}
                      </span>
                    )}
                  </div>
                  <div className={cn("mt-3.5 h-1.5 w-full overflow-hidden rounded-full", tone.track)}>
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-500", pct >= 90 && isSpending ? "bg-[#C43737]" : tone.fill)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className={cn("mt-1.5 flex items-center justify-between text-[11px]", tone.muted)}>
                    <span className="flex items-center gap-1">
                      <Target size={12} />
                      {isSpending ? "Budget bulanan" : "Target"} {formatRupiah(selectedPocket.targetAmount)}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {isSpending ? `${pct}% terpakai` : `${pct}%`}
                    </span>
                  </div>
                  {!isSpending && (
                    <p className={cn("mt-1 text-[11px]", tone.muted)}>
                      {pct >= 100 ? "Target tercapai" : `Kurang ${formatRupiah(remaining)}`}
                    </p>
                  )}
                </div>

                {selectedPocket.profile &&
                  (() => {
                    const due = dueLabel(selectedPocket.profile.dueDate);
                    const today = perDayNow(selectedPocket);
                    const canSetAside = today > 0 && today <= dailyPocket && due.days >= 0;
                    return (
                      <div className="rounded-[18px] border border-[#F1EEE8] px-3.5 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#76520E]">Disusun Nera</p>
                        <p className="mt-0.5 text-[14px] font-bold text-[#2F240E]">{selectedPocket.profile.occasion}</p>
                        <p className="flex items-center gap-1 text-[12px] text-[#736B60]">
                          <CalendarDays size={13} />
                          {due.date} · {due.relative}
                        </p>
                        {today > 0 && due.days >= 0 ? (
                          <>
                            <p className="mt-2 text-[12px] text-[#5C4A1E]">
                              {due.days === 0 ? "Kurang hari ini" : "Sisihkan hari ini"}{" "}
                              <b className="tabular-nums">{formatRupiah(today)}</b>
                              {due.days > 1 && " supaya terkumpul tepat waktu"}
                            </p>
                            <button
                              type="button"
                              disabled={!canSetAside}
                              onClick={() => {
                                moveToBudgetPocket(selectedPocket.id, today);
                                triggerToast(`${formatRupiah(today)} disisihkan ke ${selectedPocket.name}`);
                              }}
                              className="mt-2 h-10 w-full rounded-[12px] bg-[#FFB900] text-[13px] font-bold text-[#352500] transition-transform duration-150 hover:bg-[#E6A700] active:scale-[0.96] disabled:opacity-40"
                            >
                              Sisihkan {formatRupiah(today)} dari Kantong Utama
                            </button>
                            {!canSetAside && today > dailyPocket && (
                              <p className="mt-1 text-[11px] text-[#A92F2F]">
                                {assetsSet ? `Kantong Utama tinggal ${formatRupiah(dailyPocket)}.` : "Atur Aset Saya dulu supaya bisa menyisihkan."}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="mt-2 text-[12px] text-[#277449]">
                            {selectedPocket.balance >= selectedPocket.targetAmount
                              ? "Uangnya sudah terkumpul. Saat bayar, pakai tab Pakai di bawah."
                              : "Hari-H sudah lewat. Sisa saldo bisa ditarik ke Kantong Utama."}
                          </p>
                        )}
                        {due.days >= 0 && selectedPocket.balance < selectedPocket.targetAmount && (
                          <div className="mt-2.5">
                            <ReminderToggle
                              state={push.state}
                              showAmounts={push.showAmounts}
                              onShowAmounts={push.setShowAmounts}
                              onChange={push.refresh}
                              notify={triggerToast}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* Segmented action switcher */}
                <div
                  className="grid gap-1 rounded-[14px] bg-[#F1F2F4] p-1"
                  style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}
                >
                  {modes.map((m) => {
                    const MIcon = m.icon;
                    const active = detailMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setDetailMode(m.id);
                          setDetailAmount("");
                        }}
                        aria-pressed={active}
                        className={cn(
                          "flex h-9 items-center justify-center gap-1.5 rounded-[11px] text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#BA8500]",
                          active
                            ? "bg-white text-[#2F240E]"
                            : "text-[#736B60] hover:text-[#2F240E]"
                        )}
                      >
                        <MIcon size={15} />
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                {detailMode === "history" ? (
                  <PocketHistory
                    {...historyFor(selectedPocket)}
                    spentThisMonth={isSpending ? selectedPocket.spentThisMonth : 0}
                    onEditEmail={setEditingTx}
                  />
                ) : (
                <form onSubmit={handleDetailSubmit} className="space-y-3">
                  {detailMode === "spend" && (
                    <div>
                      <label htmlFor="spend-note" className="mb-1 block text-xs font-semibold text-[#2F240E]">
                        Keterangan
                      </label>
                      <input
                        id="spend-note"
                        type="text"
                        placeholder="Contoh: Makan siang kantin"
                        value={spendNote}
                        onChange={(e) => setSpendNote(e.target.value)}
                        className="w-full rounded-xl border border-[#E9E5DD] px-3 py-2.5 text-sm focus:border-[#76520E] focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label htmlFor="pocket-amount" className="text-xs font-semibold text-[#2F240E]">
                        Nominal
                      </label>
                      <span className="text-[11px] text-[#736B60]">
                        {detailMode === "topup" ? "Kantong Utama" : "Saldo"} {formatRupiah(detailLimit)}
                      </span>
                    </div>
                    <div className="flex items-center rounded-xl border border-[#E9E5DD] px-3 focus-within:border-[#76520E]">
                      <span className="text-sm font-semibold text-[#736B60]">Rp</span>
                      <input
                        id="pocket-amount"
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={detailAmount}
                        onChange={(e) => setDetailAmount(formatAmountInput(e.target.value))}
                        className="w-full bg-transparent px-2 py-2.5 text-base font-semibold tabular-nums text-[#2F240E] focus:outline-none"
                      />
                    </div>
                    {detailValue > detailLimit && (
                      <p className="mt-1 text-[11px] text-[#C43737]">Nominal melebihi saldo yang tersedia.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={amt > detailLimit}
                        onClick={() => setDetailAmount(amt.toLocaleString("id-ID"))}
                        className="rounded-full bg-[#FFF3D6] px-3 py-1.5 text-[11px] font-semibold text-[#76520E] transition-colors duration-150 hover:bg-[#FFE39A] disabled:pointer-events-none disabled:opacity-40"
                      >
                        {formatRupiahShort(amt)}
                      </button>
                    ))}
                    {detailMode === "withdraw" && selectedPocket.balance > 0 && (
                      <button
                        type="button"
                        onClick={() => setDetailAmount(selectedPocket.balance.toLocaleString("id-ID"))}
                        className="rounded-full bg-[#FFF3D6] px-3 py-1.5 text-[11px] font-semibold text-[#76520E] transition-colors duration-150 hover:bg-[#FFE39A]"
                      >
                        Semua
                      </button>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant={detailMode === "topup" ? "primary" : "bni"}
                    fullWidth
                    disabled={!isDetailValid}
                  >
                    {detailMode === "topup" && "Isi Kantong"}
                    {detailMode === "spend" && "Catat Pengeluaran"}
                    {detailMode === "withdraw" && "Tarik ke Kantong Utama"}
                  </Button>
                </form>
                )}

                <div className="border-t border-[#E9E5DD] pt-3">
                  {isConfirmingDelete ? (
                    <div className="space-y-2.5">
                      <p className="text-xs leading-relaxed text-[#736B60]">
                        Hapus kantong ini?{" "}
                        {selectedPocket.balance > 0 &&
                          `Saldo ${formatRupiah(selectedPocket.balance)} akan dikembalikan ke Kantong Utama.`}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" fullWidth onClick={() => setIsConfirmingDelete(false)}>
                          Batal
                        </Button>
                        <Button variant="danger" size="sm" fullWidth onClick={handleDelete}>
                          Ya, Hapus
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#C43737] hover:underline"
                    >
                      <Trash2 size={14} />
                      Hapus kantong
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
      </Modal>

      {isProfileOpen && (
        <PocketProfileSheet
          money={{
            main: dailyPocket,
            pockets: budgetPockets,
            // what a day may cost: the income spread over the month, else the balance over the days left
            dailyBudgetSafe: monthlyIncome
              ? Math.round(monthlyIncome / 30)
              : assetsSet
                ? Math.round(Math.max(0, dailyPocket) / Math.max(1, new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1))
                : 0,
            monthlyAllowance: 0,
            balancesKnown: assetsSet,
          }}
          icons={POCKET_ICONS}
          tones={POCKET_TONES}
          onCreate={createFromProfile}
          onClose={() => setIsProfileOpen(false)}
        />
      )}

      {isPlanOpen && plan && (
        <BudgetPlanSheet plan={plan} income={monthlyIncome} onApply={applyPlan} onClose={() => setIsPlanOpen(false)} />
      )}

      {editingTx && (
        <TransactionSheet key={editingTx.id} tx={editingTx} all={allEmailTxs} onClose={() => setEditingTx(null)} onSave={(edit) => saveTxEdit(editingTx, edit)} />
      )}

      {/* MODAL: BUAT KANTONG */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Buat Kantong Baru">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Live preview */}
          {(() => {
            const tone = POCKET_TONES[newTone];
            const Icon = POCKET_ICONS[newIcon];
            return (
              <div className={cn("flex items-center gap-3 rounded-[20px] p-4", tone.card)}>
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-[14px]", tone.iconWrap, tone.icon)}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className={cn("truncate text-sm font-semibold", tone.title)}>
                    {newName.trim() || "Nama kantong"}
                  </p>
                  <p className={cn("mt-0.5 text-[11px]", tone.muted)}>
                    {newKind === "spending" ? "Kantong Belanja" : "Kantong Tabungan"} ·{" "}
                    {newTargetValue ? formatRupiah(newTargetValue) : "target belum diatur"}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-[#F1F2F4] p-1">
            {(
              [
                { id: "spending", label: "Kantong Belanja" },
                { id: "saving", label: "Kantong Tabungan" },
              ] as const
            ).map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={newKind === k.id}
                onClick={() => setNewKind(k.id)}
                className={cn(
                  "h-9 rounded-[11px] text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#BA8500]",
                  newKind === k.id ? "bg-white text-[#2F240E]" : "text-[#736B60] hover:text-[#2F240E]"
                )}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="pocket-name" className="mb-1 block text-xs font-semibold text-[#2F240E]">
              Nama kantong
            </label>
            <input
              id="pocket-name"
              type="text"
              maxLength={24}
              placeholder={newKind === "spending" ? "Contoh: Nongkrong" : "Contoh: Dana Darurat"}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-xl border border-[#E9E5DD] px-3 py-2.5 text-sm focus:border-[#76520E] focus:outline-none"
              required
            />
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-[#2F240E]">Ikon</legend>
            <div className="grid grid-cols-6 gap-1.5">
              {(Object.keys(POCKET_ICONS) as BudgetPocketIcon[]).map((key) => {
                const Icon = POCKET_ICONS[key];
                const active = newIcon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={ICON_LABELS[key]}
                    aria-pressed={active}
                    onClick={() => setNewIcon(key)}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-[12px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#BA8500]",
                      active
                        ? "bg-[#FFB900] text-[#352500]"
                        : "bg-[#F7F5F0] text-[#76520E] hover:bg-[#FFF0BD]"
                    )}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-[#2F240E]">Warna</legend>
            <div className="flex flex-wrap gap-2.5">
              {(Object.keys(POCKET_TONES) as BudgetPocketTone[]).map((key) => {
                const active = newTone === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={POCKET_TONES[key].label}
                    aria-pressed={active}
                    onClick={() => setNewTone(key)}
                    className={cn(
                      "h-8 w-8 rounded-full ring-offset-2 transition-shadow duration-150 focus-visible:outline-2 focus-visible:outline-[#BA8500]",
                      POCKET_TONES[key].swatch,
                      active ? "ring-2 ring-[#76520E]" : "ring-1 ring-[#E9E5DD]"
                    )}
                  />
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="pocket-target" className="mb-1 block text-xs font-semibold text-[#2F240E]">
                {newKind === "spending" ? "Budget / bulan" : "Target"}
              </label>
              <div className="flex items-center rounded-xl border border-[#E9E5DD] px-3 focus-within:border-[#76520E]">
                <span className="text-xs font-semibold text-[#736B60]">Rp</span>
                <input
                  id="pocket-target"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={newTarget}
                  onChange={(e) => setNewTarget(formatAmountInput(e.target.value))}
                  className="w-full min-w-0 bg-transparent px-1.5 py-2.5 text-sm font-semibold tabular-nums focus:outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="pocket-initial" className="mb-1 block text-xs font-semibold text-[#2F240E]">
                Isi awal
              </label>
              <div className="flex items-center rounded-xl border border-[#E9E5DD] px-3 focus-within:border-[#76520E]">
                <span className="text-xs font-semibold text-[#736B60]">Rp</span>
                <input
                  id="pocket-initial"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={newInitial}
                  onChange={(e) => setNewInitial(formatAmountInput(e.target.value))}
                  className="w-full min-w-0 bg-transparent px-1.5 py-2.5 text-sm font-semibold tabular-nums focus:outline-none"
                />
              </div>
            </div>
          </div>
          <p className={cn("text-[11px] -mt-2", newInitialValue > dailyPocket ? "text-[#C43737]" : "text-[#736B60]")}>
            Isi awal diambil dari Kantong Utama (tersedia {formatRupiah(dailyPocket)}).
          </p>

          <Button type="submit" variant="primary" fullWidth disabled={!isCreateValid}>
            Buat Kantong
          </Button>
        </form>
      </Modal>
    </div>
  );
}
