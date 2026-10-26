/**
 * Re-run the merchant category rules over stored transactions, without touching Gmail:
 * the payee name is stored, so a better rule can fix "Lainnya" rows in place.
 * Dry run by default; prints counts only.
 *
 *   docker compose -p nera-infra -f deploy/infra.yml run --rm worker \
 *     pnpm exec tsx scripts/recategorize-email.ts [--apply]
 *
 * Only rows the user never edited are touched: those still in "other", and travel agents'
 * receipts that body keywords put elsewhere.
 */
import "dotenv/config";
import { categorizeMerchant } from "../src/email/extract";
import { fixedCategory } from "../src/email/senders";
import { emailStore } from "../src/email/store";
import { isOwnMoneyMove } from "../src/email/types";

async function main() {
  const apply = process.argv.includes("--apply");
  const total = new Map<string, { rows: number; amount: number }>();
  for (const userId of await emailStore.listUserIdsWithData()) {
    let changed = 0;
    for (const t of await emailStore.listTransactions(userId)) {
      if (t.userEdited) continue;
      const fixed = t.type === "expense" ? fixedCategory(t.provider) : undefined;
      const category = fixed ?? (t.category === "other" ? categorizeMerchant(t.merchant) : null);
      if (!category || category === t.category) continue;
      const s = total.get(category) ?? { rows: 0, amount: 0 };
      total.set(category, { rows: s.rows + 1, amount: s.amount + (t.type === "expense" ? t.amount : 0) });
      changed++;
      if (apply)
        await emailStore.updateTransaction(userId, t.id, { category, countsTowardSpending: t.type === "expense" && !isOwnMoneyMove(category) });
    }
    if (changed) console.log(`${userId}: ${changed} rows`);
  }
  console.table(Object.fromEntries(total));
  console.log(apply ? "applied" : "dry run, pass --apply to write");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
