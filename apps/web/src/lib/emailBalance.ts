"use client";

import { useEffect, useRef } from "react";
import { useFinancialStore } from "../context/FinancialStore";
import { useEmailSpendingStore } from "./emailSpending";
import { refreshWallet } from "./wallet";

const DAY = 86_400_000;
/** how long a balance runs on receipts alone before Nera asks the user to check it */
const CHECK_AFTER_DAYS = 7;

/**
 * Kantong Utama follows email receipts (with the "email_planning" consent): the server takes
 * counted receipts after the anchor off the balance it stores (routes/wallet.ts). This only
 * reloads the wallet when the receipts change, e.g. one was hidden or recategorized here.
 */
export function useEmailBalanceSync() {
  const { status, transactions, planningConsent, load } = useEmailSpendingStore();
  const walletSynced = useFinancialStore((s) => s.walletSynced);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (status !== "ready" || !walletSynced) return;
    const key = `${planningConsent}|${transactions.map((t) => `${t.id}:${t.amount}:${t.category}:${t.dismissed ? 1 : 0}:${t.needsReview ? 1 : 0}`).join(",")}`;
    // the first load already came with the wallet; only later changes need a reload
    if (seen.current !== null && seen.current !== key) refreshWallet();
    seen.current = key;
  }, [status, transactions, planningConsent, walletSynced]);
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
  const { emailDeduction, balanceAnchorAt, dailyPocket } = useFinancialStore();
  const active = emailDeduction !== null;
  const stale = balanceAnchorAt !== null && Date.now() - Date.parse(balanceAnchorAt) >= CHECK_AFTER_DAYS * DAY;
  return {
    active,
    deducted: emailDeduction?.amount ?? 0,
    receipts: emailDeduction?.receipts ?? 0,
    since: balanceAnchorAt,
    needsCheck: active && (stale || dailyPocket < 0),
  };
}
