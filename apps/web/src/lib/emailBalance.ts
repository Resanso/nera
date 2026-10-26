"use client";

import { useEffect } from "react";
import { useFinancialStore } from "../context/FinancialStore";
import { isCountedSpend, useEmailSpendingStore } from "./emailSpending";

const DAY = 86_400_000;
/** how long a balance runs on receipts alone before Nera asks the user to check it */
const CHECK_AFTER_DAYS = 7;

/**
 * Lowers Kantong Utama by what the user spends, read from email receipts, so the balance
 * they entered once stays close to the real one. Only with the "email_planning" consent,
 * and only on a fresh load (a failed one must not give every receipt back). Income from
 * email is left out like everywhere else (mostly refunds and misreads); the periodic check
 * catches it.
 */
export function useEmailBalanceSync() {
  const { status, transactions, planningConsent, load } = useEmailSpendingStore();
  const assetsSet = useFinancialStore((s) => s.assetsSet);
  const applyEmailSpending = useFinancialStore((s) => s.applyEmailSpending);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (status !== "ready" || !planningConsent || !assetsSet || !useFinancialStore.persist.hasHydrated()) return;
    applyEmailSpending(transactions.filter(isCountedSpend));
  }, [status, transactions, planningConsent, assetsSet, applyEmailSpending]);
}

export type EmailBalance = {
  /** the balance follows receipts */
  active: boolean;
  /** taken off since the anchor */
  deducted: number;
  receipts: number;
  since: string | null;
  /** ask the user to confirm: a week since the last check, or Kantong Utama went below 0 */
  needsCheck: boolean;
};

export function useEmailBalance(): EmailBalance {
  const planningConsent = useEmailSpendingStore((s) => s.planningConsent);
  const { assetsSet, balanceAnchorAt, emailDeductions, dailyPocket } = useFinancialStore();
  const active = assetsSet && planningConsent;
  const amounts = Object.values(emailDeductions);
  const stale = balanceAnchorAt !== null && Date.now() - Date.parse(balanceAnchorAt) >= CHECK_AFTER_DAYS * DAY;
  return {
    active,
    deducted: amounts.reduce((a, b) => a + b, 0),
    receipts: amounts.length,
    since: balanceAnchorAt,
    needsCheck: active && (stale || dailyPocket < 0),
  };
}
