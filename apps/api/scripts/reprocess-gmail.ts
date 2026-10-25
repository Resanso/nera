/**
 * Re-import every linked Gmail inbox with the current parser (raw emails are never
 * stored, so this re-downloads them). Run with the API stopped, since both write the
 * same EMAIL_STORE_FILE:
 *
 *   docker compose -p nera -f docker-compose.deploy.yml stop api
 *   docker compose -p nera -f docker-compose.deploy.yml run --rm --no-deps api \
 *     pnpm exec tsx scripts/reprocess-gmail.ts [--drop-user <userId>]...
 *   docker compose -p nera -f docker-compose.deploy.yml up -d api
 *
 * --drop-user removes a user's Gmail link and email data locally. It deliberately does
 * NOT revoke at Google: revoking kills the whole grant, including other links to the
 * same Gmail account through this OAuth client.
 */
import { syncGmail } from "../src/email/gmail";
import { emailStore } from "../src/email/store";

async function main() {
  const args = process.argv.slice(2);
  const drop = args.flatMap((a, i) => (a === "--drop-user" && args[i + 1] ? [args[i + 1]] : []));

  for (const userId of drop) {
    emailStore.deleteGmail(userId);
    emailStore.deleteTransactions(userId);
    emailStore.deleteAliasForUser(userId);
    console.log(`dropped ${userId}`);
  }

  for (const conn of emailStore.listGmail()) {
    emailStore.deleteTransactions(conn.userId, "gmail");
    emailStore.setGmail({ ...conn, syncedIds: [] });
    let total = { scanned: 0, imported: 0, duplicates: 0, ignored: 0 };
    for (;;) {
      const r = await syncGmail(conn.userId);
      total = { scanned: total.scanned + r.scanned, imported: total.imported + r.imported, duplicates: total.duplicates + r.duplicates, ignored: total.ignored + r.ignored };
      if (r.scanned === 0) break;
    }
    console.log(`${conn.userId}:`, total);
  }

  // let the store's debounced write land before exiting
  await new Promise((r) => setTimeout(r, 1000));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
