"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { BudgetPocket, BudgetPocketIcon, BudgetPocketTone } from "@nera/core";
import { CATEGORY_LABEL, NotSignedIn, emailApi, type EmailCategory, type EmailTransaction } from "./emailImport";
import { inPeriod, presetPeriod, type Period } from "./period";

/**
 * Spending imported from email receipts (other banks, e-wallets, merchants), shared by
 * Beranda, Kantong and Coach. It never touches the BNI balances: that money left
 * another account. Not used for risk scoring or offers (Google Limited Use).
 */
type State = {
  status: "idle" | "loading" | "signed-out" | "ready" | "error";
  transactions: EmailTransaction[];
  /** user agreed to AI processing; the chatbot only gets spending context with it */
  aiConsent: boolean;
  loadedAt: number;
  load: (force?: boolean) => Promise<void>;
};

const STALE_MS = 60_000;

export const useEmailSpendingStore = create<State>((set, get) => ({
  status: "idle",
  transactions: [],
  aiConsent: false,
  loadedAt: 0,
  load: async (force = false) => {
    const { status, loadedAt } = get();
    if (status === "loading" || (!force && status === "ready" && Date.now() - loadedAt < STALE_MS)) return;
    set({ status: "loading" });
    try {
      const [transactions, status] = await Promise.all([emailApi.transactions(), emailApi.status()]);
      set({ status: "ready", transactions, aiConsent: status.consent.aiProcessing, loadedAt: Date.now() });
    } catch (e) {
      set({ status: e instanceof NotSignedIn ? "signed-out" : "error", transactions: [] });
    }
  },
}));

/** Counted spending only: not transfers/top-ups, not duplicates, not awaiting review. */
export const isCountedSpend = (t: EmailTransaction) => t.type === "expense" && t.countsTowardSpending && !t.needsReview;

/** Email categories feeding each kind of budget pocket. */
export const POCKET_CATEGORIES: Partial<Record<BudgetPocketIcon, EmailCategory[]>> = {
  food: ["food"],
  transport: ["transport"],
  education: ["education"],
  shopping: ["shopping"],
  fun: ["entertainment"],
  home: ["bills"],
  utility: ["bills"],
  travel: ["travel"],
};

export type SpendingTotals = {
  total: number;
  byCategory: { category: EmailCategory; label: string; amount: number }[];
  spentForPocket: (icon: BudgetPocketIcon) => number;
};

function summarize(spends: EmailTransaction[]): SpendingTotals {
  const totals = new Map<EmailCategory, number>();
  for (const t of spends) totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  return {
    total: spends.reduce((sum, t) => sum + t.amount, 0),
    byCategory: [...totals]
      .map(([category, amount]) => ({ category, label: CATEGORY_LABEL[category], amount }))
      .sort((a, b) => b.amount - a.amount),
    spentForPocket: (icon) => (POCKET_CATEGORIES[icon] ?? []).reduce((sum, c) => sum + (totals.get(c) ?? 0), 0),
  };
}

export type EmailSpending = {
  ready: boolean;
  aiConsent: boolean;
  monthTotal: number;
  byCategory: SpendingTotals["byCategory"];
  /** newest first, counted spending and income, for transaction lists */
  recent: EmailTransaction[];
  spentForPocket: (icon: BudgetPocketIcon) => number;
  /** the same figures for any period (Kantong's period filter) */
  inPeriod: (p: Period) => SpendingTotals;
  /** all counted spending, newest first */
  spends: EmailTransaction[];
};

export function useEmailSpending(): EmailSpending {
  const { status, transactions, aiConsent, load } = useEmailSpendingStore();
  useEffect(() => {
    load();
  }, [load]);

  const spends = transactions.filter(isCountedSpend);
  // local calendar month, the same as Kantong's "Bulan ini" filter
  const thisMonth = presetPeriod("this_month");
  const month = summarize(spends.filter((t) => inPeriod(t.occurredAt, thisMonth)));

  return {
    ready: status === "ready",
    aiConsent,
    monthTotal: month.total,
    byCategory: month.byCategory,
    recent: transactions.filter((t) => isCountedSpend(t) || t.type === "income"),
    spentForPocket: month.spentForPocket,
    inPeriod: (p) => summarize(spends.filter((t) => inPeriod(t.occurredAt, p))),
    spends,
  };
}

/** Plain-text summary for the coach's context. */
export function spendingSummary(s: EmailSpending): string | null {
  // only shared with the AI chatbot when the user agreed to AI processing
  if (!s.ready || !s.aiConsent || s.monthTotal === 0) return null;
  const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
  const parts = s.byCategory.slice(0, 4).map((c) => `${c.label} ${rp(c.amount)}`);
  return `Pengeluaran di luar BNI bulan ini (dari struk email): ${rp(s.monthTotal)}. Terbesar: ${parts.join(", ")}.`;
}

const DAY = 86_400_000;
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

/** What a new pocket for an email category looks like. */
const NEW_POCKET: Partial<Record<EmailCategory, { name: string; icon: BudgetPocketIcon; tone: BudgetPocketTone }>> = {
  food: { name: "Makan & Minum", icon: "food", tone: "mint" },
  transport: { name: "Transportasi", icon: "transport", tone: "peach" },
  education: { name: "Keperluan Kuliah", icon: "education", tone: "cream" },
  shopping: { name: "Belanja", icon: "shopping", tone: "pink" },
  entertainment: { name: "Hiburan", icon: "fun", tone: "pink" },
  bills: { name: "Tagihan", icon: "utility", tone: "sky" },
  travel: { name: "Jalan-jalan", icon: "travel", tone: "cyan" },
};

export type PocketSuggestion =
  | { kind: "create"; key: string; category: EmailCategory; name: string; icon: BudgetPocketIcon; tone: BudgetPocketTone; monthlyAvg: number; budget: number }
  | { kind: "raise"; key: string; pocketId: string; name: string; monthlyAvg: number; current: number; budget: number };

/**
 * Pocket suggestions from the last 90 days of email receipts: a pocket for a category
 * the user spends on regularly but has no pocket for, or a budget that is far below
 * what they actually spend. Suggested budgets are 90% of the monthly average, a
 * reachable target rather than an aspirational one. Needs four weeks of history.
 */
export function suggestPockets(spends: EmailTransaction[], pockets: BudgetPocket[], now = new Date()): PocketSuggestion[] {
  const since = now.getTime() - 90 * DAY;
  const recent = spends.filter((t) => Date.parse(t.occurredAt) >= since);
  if (recent.length === 0) return [];
  const oldest = Math.min(...recent.map((t) => Date.parse(t.occurredAt)));
  const spanDays = (now.getTime() - oldest) / DAY;
  if (spanDays < 28) return [];
  const months = Math.min(3, spanDays / 30.44);

  const monthly = new Map<EmailCategory, number>();
  for (const t of recent) monthly.set(t.category, (monthly.get(t.category) ?? 0) + t.amount / months);

  const spending = pockets.filter((p) => p.kind === "spending");
  const out: PocketSuggestion[] = [];

  for (const p of spending) {
    const cats = POCKET_CATEGORIES[p.icon] ?? [];
    const avg = cats.reduce((sum, c) => sum + (monthly.get(c) ?? 0), 0);
    if (cats.length && avg >= p.targetAmount * 1.2 && avg - p.targetAmount >= 50_000) {
      out.push({ kind: "raise", key: `raise:${p.id}`, pocketId: p.id, name: p.name, monthlyAvg: avg, current: p.targetAmount, budget: roundTo(avg * 0.9, 10_000) });
    }
  }
  for (const [category, avg] of monthly) {
    const preset = NEW_POCKET[category];
    const covered = spending.some((p) => POCKET_CATEGORIES[p.icon]?.includes(category));
    if (preset && !covered && avg >= 100_000) {
      out.push({ kind: "create", key: `create:${category}`, category, ...preset, monthlyAvg: avg, budget: roundTo(avg * 0.9, 10_000) });
    }
  }
  return out.sort((a, b) => b.monthlyAvg - a.monthlyAvg).slice(0, 3);
}

/** The category whose spending this week jumped most above its 4-week average. */
export function weeklyJump(spends: EmailTransaction[], now = new Date()) {
  const t0 = now.getTime();
  if (!spends.some((t) => Date.parse(t.occurredAt) <= t0 - 14 * DAY)) return null;
  const week = new Map<EmailCategory, number>();
  const prior = new Map<EmailCategory, number>();
  for (const t of spends) {
    const age = t0 - Date.parse(t.occurredAt);
    if (age < 0 || age >= 35 * DAY) continue;
    const bucket = age < 7 * DAY ? week : prior;
    bucket.set(t.category, (bucket.get(t.category) ?? 0) + t.amount);
  }
  let best: { category: EmailCategory; label: string; thisWeek: number; avgWeek: number; delta: number } | null = null;
  for (const [category, thisWeek] of week) {
    const avgWeek = (prior.get(category) ?? 0) / 4;
    const delta = thisWeek - avgWeek;
    if (delta >= 25_000 && thisWeek >= avgWeek * 1.3 && (!best || delta > best.delta)) {
      best = { category, label: CATEGORY_LABEL[category], thisWeek, avgWeek, delta };
    }
  }
  return best;
}
