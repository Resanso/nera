/**
 * Re-read linked Gmail inboxes with the current parser (raw emails are never stored, so
 * this re-downloads them). Users keep seeing their old data until the new import is
 * complete, then it is swapped in at once. Safe to run while the app is up (Postgres store):
 *
 *   docker compose -p nera-infra -f deploy/infra.yml run --rm worker \
 *     pnpm exec tsx scripts/reprocess-gmail.ts [--user <userId>] \
 *       [--query 'from:(shopee.co.id)' --providers 'Shopee'] [--drop-user <userId>]...
 *
 * First check whether the stored fields are enough to fix the rows in SQL; that needs no
 * Gmail access at all. When the email itself is needed, scope the re-import with --query
 * and --providers: only those providers' rows are replaced.
 *
 * --drop-user removes a user's Gmail links and email data locally. It deliberately does
 * NOT revoke at Google: revoking kills the whole grant, including other links to the
 * same Gmail account through this OAuth client.
 */
import "dotenv/config";
import { reimportGmail } from "../src/email/gmail";
import { emailStore } from "../src/email/store";
import { hasConsent } from "../src/email/consent";

const arg = (args: string[], name: string) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));

async function main() {
  const args = process.argv.slice(2);
  const only = arg(args, "--user");
  const [query] = arg(args, "--query");
  const providers = arg(args, "--providers")[0]?.split(",").map((p) => p.trim());
  if (Boolean(query) !== Boolean(providers)) throw new Error("--query and --providers go together");

  for (const userId of arg(args, "--drop-user")) {
    await emailStore.deleteGmail(userId);
    await emailStore.deleteTransactions(userId);
    await emailStore.deleteAliasForUser(userId);
    console.log(`dropped ${userId}`);
  }

  const links = await emailStore.listGmail();
  for (const userId of new Set(links.map((c) => c.userId))) {
    if (only.length && !only.includes(userId)) continue;
    const conns = links.filter((c) => c.userId === userId);
    if (!(await hasConsent(userId, "email_import"))) {
      console.log(`${userId}: skipped, no email import consent`);
      continue;
    }
    // a history import in progress would be overwritten by the swap; run again once it is done
    if (conns.some((c) => c.backfill?.status === "pending" || c.backfill?.status === "running")) {
      console.log(`${userId}: skipped, history import still running`);
      continue;
    }
    // as far back as the user's history import went, not just the default 90 days
    const days = Math.max(90, ...conns.map((c) => c.backfill?.days ?? 0));
    const before = (await emailStore.listTransactions(userId)).length;
    const r = await reimportGmail(userId, days, query && providers ? { query, providers } : undefined);
    console.log(`${userId}:`, r, `| transactions ${before} -> ${(await emailStore.listTransactions(userId)).length}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
