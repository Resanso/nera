import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import express, { Router, type Request, type Response } from "express";
import { z } from "zod";
import { maiaClient } from "@nera/ai";
import { requireSession, sessionOf, setSession } from "../auth/session";
import { verifyState } from "../email/crypto";
import { getOrCreateAlias, handleInbound, removeAlias } from "../email/forward";
import {
  GmailAccessRevoked,
  completeGmailConnect,
  completeLogin,
  disconnectGmail,
  gmailAuthUrl,
  handleGmailPush,
  isGmailConfigured,
  requestBackfill,
  syncGmail,
} from "../email/gmail";
import { ingestEmail, summarize } from "../email/ingest";
import { ALLOWED_SENDERS } from "../email/senders";
import { moneyInsights } from "../email/insights";
import { reconcile } from "../email/reconcile";
import { CONSENT_VERSION, ConsentRequired, hasConsent, requireConsent } from "../email/consent";
import { emailStore, type GmailBackfill } from "../email/store";
import { isOwnMoneyMove, merchantKey } from "../email/types";

export const emailRouter: Router = Router();

const WEB_APP_URL = () => process.env.WEB_APP_URL ?? "http://localhost:3000";
const FIXTURES = path.resolve(__dirname, "../../fixtures/email");

// Everything is per signed-in user, except endpoints called by Google or the mail relay.
const PUBLIC_PATHS = new Set(["/gmail/callback", "/gmail/push", "/inbound"]);
emailRouter.use((req, res, next) => (PUBLIC_PATHS.has(req.path) ? next() : requireSession(req, res, next)));
// remember who has used the feature (admin dashboard)
emailRouter.use((req, _res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  const { userId, email } = sessionOf(req);
  emailStore.touchUser(userId, email).then(() => next(), next);
});

/** The user always comes from the session cookie, never from the request. */
const userIdOf = (req: Request): string => sessionOf(req).userId;

/** One progress figure for a history import that runs per mailbox. */
function combineBackfills(list: (GmailBackfill | undefined)[]): GmailBackfill | undefined {
  const all = list.filter((b): b is GmailBackfill => Boolean(b));
  if (!all.length) return undefined;
  const order = ["running", "pending", "error", "done"] as const;
  return {
    days: Math.max(...all.map((b) => b.days)),
    status: order.find((st) => all.some((b) => b.status === st))!,
    scanned: all.reduce((n, b) => n + b.scanned, 0),
    imported: all.reduce((n, b) => n + b.imported, 0),
    updatedAt: all.map((b) => b.updatedAt).sort().at(-1)!,
    error: all.find((b) => b.error)?.error,
  };
}

const fail = (res: Response, e: unknown, status = 500) =>
  res
    .status(e instanceof GmailAccessRevoked ? 409 : e instanceof ConsentRequired ? 403 : status)
    .json({ success: false, error: (e as Error).message, ...(e instanceof ConsentRequired && { consentRequired: e.kind }) });

emailRouter.get("/status", async (req, res) => {
  const userId = userIdOf(req);
  const [gmail, alias, consents] = await Promise.all([
    emailStore.listGmailFor(userId),
    emailStore.getAliasForUser(userId),
    emailStore.getConsents(userId),
  ]);
  // a grant only counts for the current wording
  const current = (k: "email_import" | "ai_processing") => Boolean(consents[k]?.granted && consents[k]?.version === CONSENT_VERSION);
  res.json({
    success: true,
    data: {
      gmail: {
        configured: isGmailConfigured(),
        connected: gmail.length > 0,
        accounts: gmail.map((g) => ({ account: g.account, googleEmail: g.googleEmail, lastSyncAt: g.lastSyncAt, backfill: g.backfill })),
        // summary over all mailboxes, for the existing UI
        googleEmail: gmail[0]?.googleEmail,
        lastSyncAt: gmail.map((g) => g.lastSyncAt).filter(Boolean).sort().at(-1),
        backfill: combineBackfills(gmail.map((g) => g.backfill)),
      },
      forward: alias
        ? { address: alias.alias, status: alias.status, confirmationCode: alias.confirmationCode, lastReceivedAt: alias.lastReceivedAt }
        : null,
      senders: ALLOWED_SENDERS.map((s) => ({ provider: s.provider, domains: s.domains })),
      aiExtraction: maiaClient.isConfigured,
      consent: {
        version: CONSENT_VERSION,
        emailImport: current("email_import"),
        aiProcessing: current("ai_processing"),
        emailImportAt: consents.email_import?.at,
        aiProcessingAt: consents.ai_processing?.at,
      },
    },
  });
});

// "Ke mana uangku?": this month's spending explained (aggregates + AI or rule-based narrative)
emailRouter.get("/insights", async (req, res) => {
  const userId = userIdOf(req);
  const allowAI = await hasConsent(userId, "ai_processing");
  // optional period: ?from=2026-01-01&to=2026-04-01 (to exclusive) &label=3 bulan terakhir
  const q = req.query as Record<string, string | undefined>;
  const from = q.from ? new Date(q.from) : undefined;
  const to = q.to ? new Date(q.to) : undefined;
  const valid = from && to && !isNaN(+from) && !isNaN(+to) && from < to;
  const label = q.label?.slice(0, 40);
  res.json({
    success: true,
    data: { ...(await moneyInsights(userId, { allowAI, ...(valid && { from, to, label }) })), aiAllowed: allowAI },
  });
});

const ConsentBody = z.object({ kind: z.enum(["email_import", "ai_processing"]), granted: z.boolean() });

/**
 * Record a consent decision (kept as an event for audit). Withdrawing "email_import"
 * stops all processing: Gmail is disconnected (token revoked), the forwarding address
 * removed, and data imported through them deleted.
 */
emailRouter.post("/consent", async (req, res) => {
  const body = ConsentBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Body tidak valid" });
  const userId = userIdOf(req);
  const { kind, granted } = body.data;
  await emailStore.recordConsent(userId, kind, granted, CONSENT_VERSION);
  if (kind === "email_import" && !granted) {
    await disconnectGmail(userId);
    await removeAlias(userId);
  }
  res.json({ success: true });
});

emailRouter.get("/transactions", async (req, res) => {
  res.json({ success: true, data: await emailStore.listTransactions(userIdOf(req)) });
});

const ReviewBody = z.object({
  category: z.enum(["food", "transport", "shopping", "bills", "entertainment", "education", "travel", "topup", "transfer", "investment", "other"]).optional(),
  confirm: z.literal(true).optional(),
  /** with `category`: also every other transaction from this merchant, now and later */
  applyToMerchant: z.literal(true).optional(),
  /** "Nera salah baca": hide it; false brings it back */
  dismissed: z.boolean().optional(),
});

// user confirms, recategorizes or dismisses an extraction
emailRouter.patch("/transactions/:id", async (req, res) => {
  const body = ReviewBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Body tidak valid" });
  const { category, confirm, applyToMerchant, dismissed } = body.data;
  const userId = userIdOf(req);
  const current = (await emailStore.listTransactions(userId)).find((t) => t.id === req.params.id);
  if (!current) return res.status(404).json({ success: false, error: "Transaksi tidak ditemukan" });
  const tx = await emailStore.updateTransaction(userId, current.id, {
    ...(category && { category, countsTowardSpending: current.type === "expense" && !isOwnMoneyMove(category) }),
    ...(confirm && { needsReview: false }),
    ...(dismissed !== undefined && { dismissed }),
    ...((category || dismissed !== undefined) && { userEdited: true }),
  });
  const alsoChanged = category && applyToMerchant ? (await emailStore.setMerchantRule(userId, merchantKey(current.merchant), category)) - 1 : 0;
  // counted receipts changed, so bank notifications may pair differently
  if (confirm || category || dismissed !== undefined) await reconcile(userId);
  res.json({ success: true, data: { transaction: tx, alsoChanged: Math.max(0, alsoChanged) } });
});

// demo: run the real pipeline over sample receipts in fixtures/email
emailRouter.post("/demo/import", async (req, res) => {
  try {
    const userId = userIdOf(req);
    const files = (await readdir(FIXTURES)).filter((f) => f.endsWith(".eml")).sort();
    const results = [];
    for (const f of files) results.push(await ingestEmail(await readFile(path.join(FIXTURES, f)), { userId, channel: "demo" }));
    await reconcile(userId);
    res.json({ success: true, data: { scanned: files.length, ...summarize(results) } });
  } catch (e) {
    fail(res, e);
  }
});

// ---- Option A: Gmail API (read-only) ----

emailRouter.get("/gmail/connect", async (req, res) => {
  if (!isGmailConfigured()) return res.status(503).json({ success: false, error: "Gmail OAuth belum dikonfigurasi di server" });
  if (!(await hasConsent(userIdOf(req), "email_import"))) return res.redirect(`${WEB_APP_URL()}/email?gmail=consent`);
  res.redirect(gmailAuthUrl(userIdOf(req)));
});

/** Only same-site paths, so the login redirect can't be turned into an open redirect. */
const safeReturnTo = (r: string | undefined) => (r && r.startsWith("/") && !r.startsWith("//") ? r : "/");

/**
 * The one registered OAuth redirect URI, shared by "Masuk dengan Google" (state.p = login)
 * and "Hubungkan Gmail" (state.p = gmail).
 */
emailRouter.get("/gmail/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const parsed = state ? verifyState(state) : null;
  const back = (status: string) => res.redirect(`${WEB_APP_URL()}/email?gmail=${status}`);

  if (parsed?.p === "login") {
    const to = safeReturnTo(parsed.r);
    if (error || !code) return res.redirect(`${WEB_APP_URL()}${to}`);
    try {
      const { sub, email } = await completeLogin(code);
      setSession(res, { userId: `g_${sub}`, email });
      await emailStore.touchUser(`g_${sub}`, email);
      return res.redirect(`${WEB_APP_URL()}${to}`);
    } catch {
      return res.redirect(`${WEB_APP_URL()}${to}${to.includes("?") ? "&" : "?"}login=error`);
    }
  }

  if (error) return back("denied");
  if (!code || parsed?.p !== "gmail") return back("invalid");
  try {
    await completeGmailConnect(parsed.u, code);
    back("connected");
  } catch {
    back("error");
  }
});

emailRouter.post("/gmail/sync", async (req, res) => {
  try {
    res.json({ success: true, data: await syncGmail(userIdOf(req)) });
  } catch (e) {
    fail(res, e);
  }
});

const sameSecret = (given: string | undefined, expected: string | undefined) => {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Cloud Pub/Sub push endpoint for Gmail watch notifications. The subscription's push
 * URL carries ?token=GMAIL_PUSH_TOKEN. Ack fast; the sync runs in the background.
 */
emailRouter.post("/gmail/push", (req, res) => {
  if (!sameSecret(req.query.token as string | undefined, process.env.GMAIL_PUSH_TOKEN)) return res.status(401).end();
  try {
    const data = (req.body as { message?: { data?: string } })?.message?.data;
    const { emailAddress } = JSON.parse(Buffer.from(data ?? "", "base64").toString("utf8")) as { emailAddress?: string };
    if (emailAddress) handleGmailPush(emailAddress).catch((e) => console.error(`[gmail] push: ${(e as Error).message}`));
  } catch {
    // malformed message: ack anyway so Pub/Sub doesn't redeliver it forever
  }
  res.status(204).end();
});

const BackfillBody = z.object({ days: z.union([z.literal(180), z.literal(365), z.literal(3650)]) });

// "Ambil riwayat lebih lama": the worker pulls older receipts in the background
emailRouter.post("/gmail/backfill", async (req, res) => {
  const body = BackfillBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Pilih 180, 365 atau 3650 hari" });
  await requestBackfill(userIdOf(req), body.data.days);
  res.json({ success: true });
});

// ?account=<address> disconnects one mailbox; without it, all of them
emailRouter.delete("/gmail", async (req, res) => {
  const account = typeof req.query.account === "string" ? req.query.account.toLowerCase() : undefined;
  await disconnectGmail(userIdOf(req), account);
  res.json({ success: true });
});

// ---- Option B: unique forwarding address ----

emailRouter.post("/forward/alias", async (req, res) => {
  await requireConsent(userIdOf(req), "email_import");
  const a = await getOrCreateAlias(userIdOf(req));
  res.json({ success: true, data: { address: a.alias, status: a.status, confirmationCode: a.confirmationCode } });
});

emailRouter.delete("/forward", async (req, res) => {
  await removeAlias(userIdOf(req));
  res.json({ success: true });
});

const inboundAuthorized = (req: Request) => sameSecret(req.header("x-inbound-secret"), process.env.INBOUND_WEBHOOK_SECRET);

/**
 * Webhook for the inbound mail service (see inbound-worker/). Body is the raw MIME,
 * the envelope recipient comes in `x-envelope-to`.
 */
emailRouter.post("/inbound", express.raw({ type: "*/*", limit: "15mb" }), async (req, res) => {
  if (!inboundAuthorized(req)) return res.status(401).json({ success: false });
  const to = req.header("x-envelope-to");
  if (!to || !Buffer.isBuffer(req.body)) return res.status(400).json({ success: false, error: "Butuh x-envelope-to dan body MIME" });
  try {
    const outcome = await handleInbound(to, req.body);
    if (outcome.status === "unknown_alias") return res.status(404).json({ success: false, status: outcome.status });
    res.json({ success: true, status: outcome.status });
  } catch (e) {
    fail(res, e);
  }
});

// "Putuskan & hapus data": revoke everything and drop all imported transactions
emailRouter.delete("/all", async (req, res) => {
  const userId = userIdOf(req);
  await disconnectGmail(userId);
  await removeAlias(userId);
  await emailStore.deleteTransactions(userId);
  res.json({ success: true });
});
