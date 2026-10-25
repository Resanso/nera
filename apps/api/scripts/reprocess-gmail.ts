/**
 * Re-import every linked Gmail inbox with the current parser (raw emails are never
 * stored, so this re-downloads them). Safe to run while the app is up (Postgres store):
 *
 *   docker compose -p nera-infra -f deploy/infra.yml run --rm worker \
 *     pnpm exec tsx scripts/reprocess-gmail.ts [--drop-user <userId>]...
 *
 * --drop-user removes a user's Gmail link and email data locally. It deliberately does
 * NOT revoke at Google: revoking kills the whole grant, including other links to the
 * same Gmail account through this OAuth client.
 */
import "dotenv/config";
import { syncGmail } from "../src/email/gmail";
import { reconcile } from "../src/email/reconcile";
import { emailStore } from "../src/email/store";
import { hasConsent } from "../src/email/consent";

async function main() {
  const args = process.argv.slice(2);
  const drop = args.flatMap((a, i) => (a === "--drop-user" && args[i + 1] ? [args[i + 1]] : []));

  for (const userId of drop) {
    await emailStore.deleteGmail(userId);
    await emailStore.deleteTransactions(userId);
    await emailStore.deleteAliasForUser(userId);
    console.log(`dropped ${userId}`);
  }

  const links = await emailStore.listGmail();
  // per user: one sync covers all of their linked mailboxes
  for (const userId of new Set(links.map((c) => c.userId))) {
    const conns = links.filter((c) => c.userId === userId);
    // never wipe data we are not allowed to re-import
    if (!(await hasConsent(userId, "email_import"))) {
      console.log(`${userId}: skipped, no email import consent`);
      continue;
    }
    // a history import in progress would race the wipe below; run again once it is done
    if (conns.some((c) => c.backfill?.status === "pending" || c.backfill?.status === "running")) {
      console.log(`${userId}: skipped, history import still running`);
      continue;
    }
    await emailStore.deleteTransactions(userId, "gmail");
    await emailStore.clearGmailSeen(userId);
    const total = { scanned: 0, imported: 0, duplicates: 0, ignored: 0 };
    // re-read as far back as the user's history import went, not just the default 90 days
    const days = Math.max(90, ...conns.map((c) => c.backfill?.days ?? 0));
    for (;;) {
      const r = await syncGmail(userId, { days, max: 200 });
      for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += r[k];
      if (r.scanned === 0) break;
    }
    console.log(`${userId}:`, total, "| cross-provider duplicates:", await reconcile(userId));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
