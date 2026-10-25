/**
 * Re-derive categories for stored email transactions from their merchant names, after
 * the category rules change. No email is re-downloaded. Only touches expenses that are
 * not transfers or top-ups; re-runs cross-provider dedupe per user.
 *   pnpm exec tsx scripts/recategorize.ts
 */
import "dotenv/config";
import { categorizeMerchant } from "../src/email/extract";
import { reconcile } from "../src/email/reconcile";
import { emailStore } from "../src/email/store";

async function main() {
  let changed = 0;
  for (const userId of await emailStore.listUserIdsWithData()) {
    for (const tx of await emailStore.listTransactions(userId)) {
      if (tx.type !== "expense" || tx.category === "transfer" || tx.category === "topup") continue;
      const next = categorizeMerchant(tx.merchant);
      if (!next || next === tx.category) continue;
      await emailStore.updateTransaction(userId, tx.id, { category: next });
      changed++;
    }
    await reconcile(userId);
  }
  console.log(`recategorized ${changed} transactions`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
