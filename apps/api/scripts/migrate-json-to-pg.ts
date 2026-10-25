/**
 * One-off: copy the old JSON file store (EMAIL_STORE_FILE) into Postgres (DATABASE_URL).
 * Idempotent; existing rows are kept.
 *   pnpm exec tsx scripts/migrate-json-to-pg.ts /data/email-store.json
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { reconcile } from "../src/email/reconcile";
import { emailStore, type ForwardAlias, type GmailConnection } from "../src/email/store";
import type { EmailTransaction } from "../src/email/types";

type OldGmail = GmailConnection & { syncedIds?: string[] };
type Snapshot = { transactions: [string, EmailTransaction[]][]; gmail: [string, OldGmail][]; aliases: [string, ForwardAlias][] };

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diset");
  const snap = JSON.parse(readFileSync(process.argv[2], "utf8")) as Snapshot;
  for (const [, { syncedIds = [], ...conn }] of snap.gmail) {
    await emailStore.setGmail(conn);
    for (const id of syncedIds) await emailStore.markGmailSeen(conn.userId, id);
  }
  for (const [, a] of snap.aliases) await emailStore.setAlias(a);
  let n = 0;
  for (const [userId, list] of snap.transactions) {
    for (const tx of list) if (await emailStore.addTransaction(tx)) n++;
    await reconcile(userId);
  }
  console.log(`gmail ${snap.gmail.length}, aliases ${snap.aliases.length}, transactions ${n}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
