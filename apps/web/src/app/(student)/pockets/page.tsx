"use client";

import React, { useMemo, useState } from "react";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { useFinancialStore } from "../../../context/FinancialStore";
import { useEmailSpending } from "../../../lib/emailSpending";
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
  CheckCircle2,
  ArrowDownToLine,
  ArrowUpFromLine,
  ReceiptText,
  Target,
  Trash2,
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
};

// Warna kantong tetap di keluarga warm brand; hijau/merah hanya untuk status.
const POCKET_TONES: Record<
  BudgetPocketTone,
  { label: string; card: string; iconWrap: string; icon: string; title: string; muted: string; track: string; fill: string; swatch: string }
> = {
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
    card: "bg-[#FBE7D3]",
    iconWrap: "bg-white/70",
    icon: "text-[#8A4B14]",
    title: "text-[#2F240E]",
    muted: "text-[#7A5A40]",
    track: "bg-white/70",
    fill: "bg-[#8A4B14]",
    swatch: "bg-[#F5C9A0]",
  },
  cream: {
    label: "Gading",
    card: "bg-[#F7F5F0]",
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
};

// Warna segmen untuk bar alokasi di hero
const TONE_SEGMENT: Record<BudgetPocketTone, string> = {
  yellow: "#FFB900",
  sand: "#C9AE7E",
  peach: "#E8955A",
  cream: "#E2D9C6",
  brown: "#3A2800",
};

const QUICK_AMOUNTS = [25000, 50000, 100000, 250000];

type DetailMode = "topup" | "spend" | "withdraw";

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

export default function PocketsPage() {
  const {
    dailyPocket,
    budgetPockets,
    createBudgetPocket,
    moveToBudgetPocket,
    withdrawFromBudgetPocket,
    spendFromBudgetPocket,
    deleteBudgetPocket,
  } = useFinancialStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>("topup");
  const [detailAmount, setDetailAmount] = useState("");
  const [spendNote, setSpendNote] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<BudgetPocketKind>("spending");
  const [newIcon, setNewIcon] = useState<BudgetPocketIcon>("food");
  const [newTone, setNewTone] = useState<BudgetPocketTone>("yellow");
  const [newTarget, setNewTarget] = useState("");
  const [newInitial, setNewInitial] = useState("");

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // spending budgets also count receipts imported from email (other banks, e-wallets);
  // only the "used" figure changes, the pocket balance is BNI money and stays as is
  const emailSpending = useEmailSpending();
  const withEmail = (p: BudgetPocket): BudgetPocket =>
    p.kind === "spending" ? { ...p, spentThisMonth: p.spentThisMonth + emailSpending.spentForPocket(p.icon) } : p;

  const spendingPockets = budgetPockets.filter((p) => p.kind === "spending").map(withEmail);
  const savingPockets = budgetPockets.filter((p) => p.kind === "saving");
  const selectedPocket = budgetPockets.find((p) => p.id === selectedId) ?? null;

  const totals = useMemo(() => {
    const inPockets = budgetPockets.reduce((sum, p) => sum + p.balance, 0);
    const budget = spendingPockets.reduce((sum, p) => sum + p.targetAmount, 0);
    const spent = spendingPockets.reduce((sum, p) => sum + p.spentThisMonth, 0);
    return { inPockets, all: inPockets + dailyPocket, budget, spent };
  }, [budgetPockets, spendingPockets, dailyPocket]);

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
    setNewTone("yellow");
    setNewTarget("");
    setNewInitial("");
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
      triggerToast(`${formatRupiah(detailValue)} kembali ke Daily Pocket`);
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
        ? `Kantong ${name} dihapus. ${formatRupiah(balance)} kembali ke Daily Pocket`
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

  const allocationSegments = [
    ...budgetPockets.map((p) => ({ key: p.id, value: p.balance, color: TONE_SEGMENT[p.tone] })),
    { key: "utama", value: dailyPocket, color: "#F4ECDD" },
  ].filter((s) => s.value > 0);

  return (
    <div className="flex flex-col min-h-full bg-[#F1F2F4]">
      <TopAppBar title="Kantong" showBack />

      <main className="flex-1 px-4 pb-8 space-y-7">
        {/* HERO: TOTAL SALDO & ALOKASI */}
        <div className="-mx-4 rounded-b-[32px] bg-white px-6 pt-5 pb-6">
          <p className="text-sm font-medium text-[#766D61]">Total saldo di semua kantong</p>
          <h2 className="text-[31px] font-bold text-[#2F240E] tracking-tight leading-tight mt-1 tabular-nums">
            {formatRupiah(totals.all)}
          </h2>

          {/* Allocation bar */}
          <div
            className="mt-5 flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full"
            role="img"
            aria-label="Alokasi saldo per kantong"
          >
            {allocationSegments.map((seg) => (
              <div
                key={seg.key}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(seg.value / totals.all) * 100}%`, backgroundColor: seg.color }}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-[19px] bg-[#F7F7F7] p-3.5">
            <div className="w-10 h-10 rounded-[13px] bg-white flex items-center justify-center text-[#76520E] shrink-0">
              <Wallet size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#2F240E]">Kantong Utama</p>
              <p className="text-[11px] text-[#736B60] mt-0.5">Daily Pocket · siap dialokasikan</p>
            </div>
            <p className="text-sm font-bold text-[#2F240E] tabular-nums">{formatRupiah(dailyPocket)}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button
              variant="primary"
              onClick={() => {
                resetCreateForm();
                setIsCreateOpen(true);
              }}
            >
              <Plus size={18} className="mr-1.5" />
              Buat Kantong
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsPickerOpen(true)}
              disabled={budgetPockets.length === 0}
            >
              <ArrowLeftRight size={17} className="mr-1.5" />
              Pindah Dana
            </Button>
          </div>
        </div>

        {/* KANTONG BELANJA (BUDGET BULANAN) */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-[16px] font-semibold text-[#2F240E]">Budget Bulan Ini</h3>
              <p className="text-xs text-[#736B60] mt-0.5">
                Terpakai {formatRupiah(totals.spent)} dari {formatRupiah(totals.budget)}
              </p>
            </div>
            <span className="text-xs font-medium text-[#736B60]">{spendingPockets.length} kantong</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {spendingPockets.map((pocket) => {
              const tone = POCKET_TONES[pocket.tone];
              const Icon = POCKET_ICONS[pocket.icon];
              const pct = usagePct(pocket);
              const status = spendingStatus(pct);
              const fromEmail = emailSpending.spentForPocket(pocket.icon);

              return (
                <button
                  key={pocket.id}
                  onClick={() => openDetail(pocket.id, pocket.balance > 0 ? "spend" : "topup")}
                  className={cn(
                    "flex min-h-[164px] flex-col rounded-[22px] p-4 text-left cursor-pointer transition-transform duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]",
                    tone.card
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn("w-10 h-10 rounded-[13px] flex items-center justify-center", tone.iconWrap, tone.icon)}>
                      <Icon size={19} />
                    </div>
                    {status && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", status.className)}>
                        {status.label}
                      </span>
                    )}
                  </div>
                  <p className={cn("mt-3 text-xs font-semibold truncate w-full", tone.title)}>{pocket.name}</p>
                  <p className={cn("mt-0.5 text-[17px] font-bold tabular-nums", tone.title)}>
                    {formatRupiah(pocket.balance)}
                  </p>
                  <div className="mt-auto pt-3 w-full">
                    <div className={cn("h-1.5 w-full rounded-full overflow-hidden", tone.track)}>
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-500",
                          pct >= 90 ? "bg-[#C43737]" : tone.fill
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className={cn("mt-1.5 text-[10px]", tone.muted)}>
                      {pct}% dari {formatRupiahShort(pocket.targetAmount)} terpakai
                    </p>
                    {fromEmail > 0 && (
                      <p className={cn("text-[10px]", tone.muted)}>termasuk {formatRupiahShort(fromEmail)} dari email</p>
                    )}
                  </div>
                </button>
              );
            })}

            <button
              onClick={() => {
                resetCreateForm();
                setNewKind("spending");
                setIsCreateOpen(true);
              }}
              className="flex min-h-[164px] flex-col items-center justify-center gap-2 rounded-[22px] border-[1.5px] border-dashed border-[#D8D3C9] bg-white text-[#76520E] cursor-pointer transition-colors duration-150 hover:bg-[#FFFBF0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]"
            >
              <div className="w-10 h-10 rounded-[13px] bg-[#FFF0BD] flex items-center justify-center">
                <Plus size={20} />
              </div>
              <span className="text-xs font-semibold">Kantong Baru</span>
            </button>
          </div>
        </section>

        {/* KANTONG TABUNGAN (TARGET) */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-[16px] font-semibold text-[#2F240E]">Tabungan Impian</h3>
              <p className="text-xs text-[#736B60] mt-0.5">Sisihkan sedikit demi sedikit sampai target tercapai</p>
            </div>
          </div>

          {savingPockets.length === 0 ? (
            <div className="rounded-[22px] bg-white p-5 text-center">
              <p className="text-sm font-semibold text-[#2F240E]">Belum ada tabungan impian</p>
              <p className="text-xs text-[#736B60] mt-1">Buat kantong untuk laptop, liburan, atau dana darurat.</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => {
                  resetCreateForm();
                  setNewKind("saving");
                  setNewIcon("gadget");
                  setNewTone("brown");
                  setIsCreateOpen(true);
                }}
              >
                Buat Tabungan
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {savingPockets.map((pocket) => {
                const tone = POCKET_TONES[pocket.tone];
                const Icon = POCKET_ICONS[pocket.icon];
                const pct = usagePct(pocket);
                const remaining = Math.max(0, pocket.targetAmount - pocket.balance);

                return (
                  <button
                    key={pocket.id}
                    onClick={() => openDetail(pocket.id, "topup")}
                    className={cn(
                      "w-full rounded-[22px] p-4 text-left cursor-pointer transition-transform duration-150 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]",
                      tone.card
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0", tone.iconWrap, tone.icon)}>
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-semibold truncate", tone.title)}>{pocket.name}</p>
                        <p className={cn("text-[11px] mt-0.5", tone.muted)}>
                          {pct >= 100 ? "Target tercapai" : `Kurang ${formatRupiah(remaining)}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-[15px] font-bold tabular-nums", tone.title)}>
                          {formatRupiah(pocket.balance)}
                        </p>
                        <p className={cn("text-[11px] mt-0.5 tabular-nums", tone.muted)}>
                          dari {formatRupiahShort(pocket.targetAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3.5 flex items-center gap-2.5">
                      <div className={cn("h-1.5 flex-1 rounded-full overflow-hidden", tone.track)}>
                        <div
                          className={cn("h-full rounded-full transition-[width] duration-500", pct >= 100 ? "bg-[#277449]" : tone.fill)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={cn("text-[11px] font-semibold tabular-nums", tone.title)}>{pct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* TOAST */}
      {toastMessage && (
        <div className="absolute top-14 inset-x-0 mx-auto max-w-[390px] px-4 z-[60] animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-[#2F240E] text-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-medium border border-white/10">
            <CheckCircle2 size={18} className="text-[#22C55E] shrink-0" />
            <span className="flex-1">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* MODAL: PILIH KANTONG TUJUAN */}
      <Modal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} title="Pindah ke Kantong">
        <p className="text-xs text-[#736B60] -mt-1 mb-3">
          Dana diambil dari Daily Pocket ({formatRupiah(dailyPocket)}).
        </p>
        <div className="overflow-hidden rounded-[18px] border border-[#E9E5DD] divide-y divide-[#F0EEE9]">
          {budgetPockets.map((pocket) => {
            const tone = POCKET_TONES[pocket.tone];
            const Icon = POCKET_ICONS[pocket.icon];
            return (
              <button
                key={pocket.id}
                onClick={() => {
                  setIsPickerOpen(false);
                  openDetail(pocket.id, "topup");
                }}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left cursor-pointer transition-colors duration-150 hover:bg-[#FFFBF0] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#BA8500]"
              >
                <div className={cn("w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0", tone.card, tone.icon)}>
                  <Icon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#2F240E] truncate">{pocket.name}</p>
                  <p className="text-[11px] text-[#736B60]">
                    {pocket.kind === "spending" ? "Budget belanja" : "Tabungan"}
                  </p>
                </div>
                <span className="text-[13px] font-semibold text-[#2F240E] tabular-nums">
                  {formatRupiah(pocket.balance)}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* MODAL: DETAIL KANTONG */}
      <Modal
        isOpen={!!selectedPocket}
        onClose={closeDetail}
        title={selectedPocket ? `Kantong ${selectedPocket.name}` : "Kantong"}
      >
        {selectedPocket && (() => {
          const tone = POCKET_TONES[selectedPocket.tone];
          const Icon = POCKET_ICONS[selectedPocket.icon];
          const pct = usagePct(withEmail(selectedPocket));
          const isSpending = selectedPocket.kind === "spending";
          const modes: { id: DetailMode; label: string; icon: React.ElementType }[] = [
            { id: "topup", label: "Isi", icon: ArrowDownToLine },
            ...(isSpending ? [{ id: "spend" as const, label: "Pakai", icon: ReceiptText }] : []),
            { id: "withdraw", label: "Tarik", icon: ArrowUpFromLine },
          ];

          return (
            <div className="space-y-4">
              <div className={cn("rounded-[20px] p-4", tone.card)}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-11 h-11 rounded-[14px] flex items-center justify-center", tone.iconWrap, tone.icon)}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className={cn("text-[11px]", tone.muted)}>Saldo kantong</p>
                    <p className={cn("text-xl font-bold tabular-nums", tone.title)}>
                      {formatRupiah(selectedPocket.balance)}
                    </p>
                  </div>
                </div>
                <div className={cn("mt-3.5 h-1.5 w-full rounded-full overflow-hidden", tone.track)}>
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-500", tone.fill)}
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
              </div>

              {/* Segmented action switcher */}
              <div className="grid gap-1 rounded-[14px] bg-[#F1F2F4] p-1" style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}>
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
                        "flex h-9 items-center justify-center gap-1.5 rounded-[11px] text-xs font-semibold cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#BA8500]",
                        active ? "bg-white text-[#2F240E]" : "text-[#736B60] hover:text-[#2F240E]"
                      )}
                    >
                      <MIcon size={15} />
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleDetailSubmit} className="space-y-3">
                {detailMode === "spend" && (
                  <div>
                    <label htmlFor="spend-note" className="block text-xs font-semibold text-[#2F240E] mb-1">
                      Keterangan
                    </label>
                    <input
                      id="spend-note"
                      type="text"
                      placeholder="Contoh: Makan siang kantin"
                      value={spendNote}
                      onChange={(e) => setSpendNote(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#76520E]"
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="pocket-amount" className="text-xs font-semibold text-[#2F240E]">
                      Nominal
                    </label>
                    <span className="text-[11px] text-[#736B60]">
                      {detailMode === "topup" ? "Daily Pocket" : "Saldo"} {formatRupiah(detailLimit)}
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
                      className="w-full bg-transparent px-2 py-2.5 text-base font-semibold text-[#2F240E] tabular-nums focus:outline-none"
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
                      className="rounded-full bg-[#FFF3D6] px-3 py-1.5 text-[11px] font-semibold text-[#76520E] cursor-pointer transition-colors duration-150 hover:bg-[#FFE39A] disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {formatRupiahShort(amt)}
                    </button>
                  ))}
                  {detailMode === "withdraw" && selectedPocket.balance > 0 && (
                    <button
                      type="button"
                      onClick={() => setDetailAmount(selectedPocket.balance.toLocaleString("id-ID"))}
                      className="rounded-full bg-[#FFF3D6] px-3 py-1.5 text-[11px] font-semibold text-[#76520E] cursor-pointer transition-colors duration-150 hover:bg-[#FFE39A]"
                    >
                      Semua
                    </button>
                  )}
                </div>

                <Button type="submit" variant={detailMode === "topup" ? "primary" : "bni"} fullWidth disabled={!isDetailValid}>
                  {detailMode === "topup" && "Isi Kantong"}
                  {detailMode === "spend" && "Catat Pengeluaran"}
                  {detailMode === "withdraw" && "Tarik ke Daily Pocket"}
                </Button>
              </form>

              <div className="border-t border-[#E9E5DD] pt-3">
                {isConfirmingDelete ? (
                  <div className="space-y-2.5">
                    <p className="text-xs text-[#736B60] leading-relaxed">
                      Hapus kantong ini?{" "}
                      {selectedPocket.balance > 0 &&
                        `Saldo ${formatRupiah(selectedPocket.balance)} akan dikembalikan ke Daily Pocket.`}
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
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#C43737] cursor-pointer hover:underline"
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

      {/* MODAL: BUAT KANTONG */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Buat Kantong Baru">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Live preview */}
          {(() => {
            const tone = POCKET_TONES[newTone];
            const Icon = POCKET_ICONS[newIcon];
            return (
              <div className={cn("flex items-center gap-3 rounded-[20px] p-4", tone.card)}>
                <div className={cn("w-11 h-11 rounded-[14px] flex items-center justify-center", tone.iconWrap, tone.icon)}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold truncate", tone.title)}>{newName.trim() || "Nama kantong"}</p>
                  <p className={cn("text-[11px] mt-0.5", tone.muted)}>
                    {newKind === "spending" ? "Budget" : "Target"}{" "}
                    {newTargetValue ? formatRupiah(newTargetValue) : "belum diatur"}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-[#F1F2F4] p-1">
            {(
              [
                { id: "spending", label: "Budget Belanja" },
                { id: "saving", label: "Tabungan" },
              ] as const
            ).map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={newKind === k.id}
                onClick={() => setNewKind(k.id)}
                className={cn(
                  "h-9 rounded-[11px] text-xs font-semibold cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#BA8500]",
                  newKind === k.id ? "bg-white text-[#2F240E]" : "text-[#736B60] hover:text-[#2F240E]"
                )}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="pocket-name" className="block text-xs font-semibold text-[#2F240E] mb-1">
              Nama kantong
            </label>
            <input
              id="pocket-name"
              type="text"
              maxLength={24}
              placeholder={newKind === "spending" ? "Contoh: Nongkrong" : "Contoh: Dana Darurat"}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#76520E]"
              required
            />
          </div>

          <fieldset>
            <legend className="text-xs font-semibold text-[#2F240E] mb-1.5">Ikon</legend>
            <div className="grid grid-cols-5 gap-1.5">
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
                      "flex h-11 items-center justify-center rounded-[12px] cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#BA8500]",
                      active ? "bg-[#FFB900] text-[#352500]" : "bg-[#F7F5F0] text-[#76520E] hover:bg-[#FFF0BD]"
                    )}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold text-[#2F240E] mb-1.5">Warna</legend>
            <div className="flex gap-2.5">
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
                      "h-9 w-9 rounded-full cursor-pointer ring-offset-2 transition-shadow duration-150 focus-visible:outline-2 focus-visible:outline-[#BA8500]",
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
              <label htmlFor="pocket-target" className="block text-xs font-semibold text-[#2F240E] mb-1">
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
              <label htmlFor="pocket-initial" className="block text-xs font-semibold text-[#2F240E] mb-1">
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
            Isi awal diambil dari Daily Pocket (tersedia {formatRupiah(dailyPocket)}).
          </p>

          <Button type="submit" variant="primary" fullWidth disabled={!isCreateValid}>
            Buat Kantong
          </Button>
        </form>
      </Modal>
    </div>
  );
}
