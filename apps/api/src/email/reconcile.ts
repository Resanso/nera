import { ALLOWED_SENDERS } from "./senders";
import { emailStore } from "./store";
import type { EmailTransaction } from "./types";

const BANKS = new Set(ALLOWED_SENDERS.filter((s) => s.bank).map((s) => s.provider));
const PAYEE_NAMES = new Map(ALLOWED_SENDERS.map((s) => [s.provider, s.payeeNames ?? []]));
const WINDOW_MS = 36 * 60 * 60 * 1000;

const counted = (t: EmailTransaction) => t.type === "expense" && t.countsTowardSpending && !t.duplicateOf;

/** Bank payment to "TRAVELOKA INDONESIA" ~ Traveloka receipt: same money, small fee difference. */
function samePayment(bank: EmailTransaction, receipt: EmailTransaction) {
  const payee = bank.merchant.toLowerCase();
  return (
    (PAYEE_NAMES.get(receipt.provider) ?? []).some((name) => payee.includes(name)) &&
    Math.abs(bank.amount - receipt.amount) <= Math.max(5000, receipt.amount * 0.02) &&
    Math.abs(Date.parse(bank.occurredAt) - Date.parse(receipt.occurredAt)) < WINDOW_MS
  );
}

/**
 * One payment often produces two emails: the bank's notification and the merchant's
 * receipt. Keep the receipt (it has the details) and mark the bank one as a duplicate,
 * so spending totals count it once. Idempotent; each receipt pairs with one bank email.
 */
export async function reconcile(userId: string) {
  const txs = await emailStore.listTransactions(userId);
  const paired = new Set(txs.map((t) => t.duplicateOf).filter(Boolean));
  const banks = txs.filter((t) => counted(t) && BANKS.has(t.provider));
  const gap = (a: EmailTransaction, b: EmailTransaction) => Math.abs(Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  let marked = 0;
  for (const receipt of txs.filter((t) => counted(t) && !BANKS.has(t.provider) && !paired.has(t.id))) {
    // the bank notification closest in time is the one for this receipt
    const bank = banks.filter((b) => samePayment(b, receipt)).sort((x, y) => gap(x, receipt) - gap(y, receipt))[0];
    if (!bank) continue;
    banks.splice(banks.indexOf(bank), 1);
    await emailStore.updateTransaction(userId, bank.id, { duplicateOf: receipt.id, countsTowardSpending: false });
    marked++;
  }
  return marked;
}
