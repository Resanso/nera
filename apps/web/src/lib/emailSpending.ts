"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { BudgetPocketIcon } from "@nera/core";
import { CATEGORY_LABEL, NotSignedIn, emailApi, type EmailCategory, type EmailTransaction } from "./emailImport";

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

const thisMonth = (iso: string) => iso.slice(0, 7) === new Date().toISOString().slice(0, 7);

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

export type EmailSpending = {
  ready: boolean;
  aiConsent: boolean;
  monthTotal: number;
  byCategory: { category: EmailCategory; label: string; amount: number }[];
  /** newest first, counted spending and income, for transaction lists */
  recent: EmailTransaction[];
  spentForPocket: (icon: BudgetPocketIcon) => number;
};

export function useEmailSpending(): EmailSpending {
  const { status, transactions, aiConsent, load } = useEmailSpendingStore();
  useEffect(() => {
    load();
  }, [load]);

  const month = transactions.filter((t) => isCountedSpend(t) && thisMonth(t.occurredAt));
  const totals = new Map<EmailCategory, number>();
  for (const t of month) totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);

  return {
    ready: status === "ready",
    aiConsent,
    monthTotal: month.reduce((sum, t) => sum + t.amount, 0),
    byCategory: [...totals]
      .map(([category, amount]) => ({ category, label: CATEGORY_LABEL[category], amount }))
      .sort((a, b) => b.amount - a.amount),
    recent: transactions.filter((t) => isCountedSpend(t) || t.type === "income"),
    spentForPocket: (icon) => (POCKET_CATEGORIES[icon] ?? []).reduce((sum, c) => sum + (totals.get(c) ?? 0), 0),
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
