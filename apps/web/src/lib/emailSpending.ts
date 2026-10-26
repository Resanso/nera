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
  /** receipts may feed the Beranda estimate (consent "email_planning") */
  planningConsent: boolean;
  /** agreed to email import before, but not to the current wording: syncing is paused */
  consentOutdated: boolean;
  loadedAt: number;
  load: (force?: boolean) => Promise<void>;
};

const STALE_MS = 60_000;

export const useEmailSpendingStore = create<State>((set, get) => ({
  status: "idle",
  transactions: [],
  aiConsent: false,
  planningConsent: false,
  consentOutdated: false,
  loadedAt: 0,
  load: async (force = false) => {
    const { status, loadedAt } = get();
    if (status === "loading" || (!force && status === "ready" && Date.now() - loadedAt < STALE_MS)) return;
    set({ status: "loading" });
    try {
      const [transactions, status] = await Promise.all([emailApi.transactions(), emailApi.status()]);
      set({
        status: "ready",
        transactions,
        aiConsent: status.consent.aiProcessing,
        planningConsent: status.consent.emailPlanning,
        consentOutdated: Boolean(status.consent.emailImportOutdated),
        loadedAt: Date.now(),
      });
    } catch (e) {
      set({ status: e instanceof NotSignedIn ? "signed-out" : "error", transactions: [] });
    }
  },
}));

/** Counted spending only: not transfers/top-ups, not duplicates, not awaiting review, not hidden. */
export const isCountedSpend = (t: EmailTransaction) => t.type === "expense" && t.countsTowardSpending && !t.needsReview && !t.dismissed;

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
  count: number;
  byCategory: { category: EmailCategory; label: string; amount: number }[];
  spentForPocket: (icon: BudgetPocketIcon) => number;
};

function summarize(spends: EmailTransaction[]): SpendingTotals {
  const totals = new Map<EmailCategory, number>();
  for (const t of spends) totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  return {
    total: spends.reduce((sum, t) => sum + t.amount, 0),
    count: spends.length,
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
  /** counted receipts this month, the ones monthTotal adds up */
  monthCount: number;
  byCategory: SpendingTotals["byCategory"];
  /**
   * newest first, counted spending only, for transaction lists. Income from email is left
   * out for now: banks rarely email incoming transfers, so what arrives is mostly refunds
   * and misreads. Income comes from BNI.
   */
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
    monthCount: month.count,
    byCategory: month.byCategory,
    recent: spends,
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

export type BudgetLine = {
  category: EmailCategory;
  name: string;
  icon: BudgetPocketIcon;
  tone: BudgetPocketTone;
  monthlyAvg: number;
  /** 90% of the average, rounded to Rp10rb */
  budget: number;
  /** where most of it goes, for the one-line reason */
  topMerchants: string[];
  /**
   * mostly one or two big payments (a trip, tuition) rather than monthly spending: proposed
   * unticked, since a monthly budget built from it would be far too high most months
   */
  occasional: boolean;
  /** a pocket that already covers the category: its target is updated instead of creating one */
  pocket?: { id: string; name: string; target: number };
};

export type BudgetPlan = { lines: BudgetLine[]; months: number; total: number };

/**
 * A whole monthly budget from the last 90 days of receipts, for the "Pakai budget ini"
 * screen: one line per category the user regularly spends on (Rp50rb+ a month), each at
 * 90% of its average. Null until there are four weeks of history.
 */
export function planBudget(spends: EmailTransaction[], pockets: BudgetPocket[], now = new Date()): BudgetPlan | null {
  const since = now.getTime() - 90 * DAY;
  const recent = spends.filter((t) => Date.parse(t.occurredAt) >= since);
  if (recent.length === 0) return null;
  const spanDays = (now.getTime() - Math.min(...recent.map((t) => Date.parse(t.occurredAt)))) / DAY;
  if (spanDays < 28) return null;
  const months = Math.min(3, spanDays / 30.44);

  const byCat = new Map<EmailCategory, { total: number; largest: number; merchants: Map<string, number> }>();
  for (const t of recent) {
    const c = byCat.get(t.category) ?? { total: 0, largest: 0, merchants: new Map() };
    c.total += t.amount;
    c.largest = Math.max(c.largest, t.amount);
    c.merchants.set(t.merchant, (c.merchants.get(t.merchant) ?? 0) + t.amount);
    byCat.set(t.category, c);
  }

  const spending = pockets.filter((p) => p.kind === "spending");
  const lines: BudgetLine[] = [];
  for (const [category, c] of byCat) {
    const preset = NEW_POCKET[category];
    const monthlyAvg = c.total / months;
    if (!preset || monthlyAvg < 50_000) continue;
    const existing = spending.find((p) => POCKET_CATEGORIES[p.icon]?.includes(category));
    lines.push({
      category,
      ...preset,
      ...(existing && { name: existing.name, pocket: { id: existing.id, name: existing.name, target: existing.targetAmount } }),
      monthlyAvg,
      budget: roundTo(monthlyAvg * 0.9, 10_000),
      occasional: c.largest >= c.total * 0.4,
      topMerchants: [...c.merchants].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m]) => m),
    });
  }
  // regular spending first; one-off payments last
  lines.sort((a, b) => Number(a.occasional) - Number(b.occasional) || b.monthlyAvg - a.monthlyAvg);
  const regular = lines.filter((l) => !l.occasional);
  return lines.length ? { lines, months, total: regular.reduce((s, l) => s + l.budget, 0) } : null;
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
