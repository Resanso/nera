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
  syncGmail,
} from "../email/gmail";
import { ingestEmail, summarize } from "../email/ingest";
import { ALLOWED_SENDERS } from "../email/senders";
import { emailStore } from "../email/store";

export const emailRouter: Router = Router();

const WEB_APP_URL = () => process.env.WEB_APP_URL ?? "http://localhost:3000";
const FIXTURES = path.resolve(__dirname, "../../fixtures/email");

// Everything is per signed-in user, except endpoints called by Google or the mail relay.
const PUBLIC_PATHS = new Set(["/gmail/callback", "/gmail/push", "/inbound"]);
emailRouter.use((req, res, next) => (PUBLIC_PATHS.has(req.path) ? next() : requireSession(req, res, next)));

/** The user always comes from the session cookie, never from the request. */
const userIdOf = (req: Request): string => sessionOf(req).userId;

const fail = (res: Response, e: unknown, status = 500) =>
  res.status(e instanceof GmailAccessRevoked ? 409 : status).json({ success: false, error: (e as Error).message });

emailRouter.get("/status", (req, res) => {
  const userId = userIdOf(req);
  const gmail = emailStore.getGmail(userId);
  const alias = emailStore.getAliasForUser(userId);
  res.json({
    success: true,
    data: {
      gmail: {
        configured: isGmailConfigured(),
        connected: Boolean(gmail),
        googleEmail: gmail?.googleEmail,
        lastSyncAt: gmail?.lastSyncAt,
      },
      forward: alias
        ? { address: alias.alias, status: alias.status, confirmationCode: alias.confirmationCode, lastReceivedAt: alias.lastReceivedAt }
        : null,
      senders: ALLOWED_SENDERS.map((s) => ({ provider: s.provider, domains: s.domains })),
      aiExtraction: maiaClient.isConfigured,
    },
  });
});

emailRouter.get("/transactions", (req, res) => {
  res.json({ success: true, data: emailStore.listTransactions(userIdOf(req)) });
});

const ReviewBody = z.object({
  category: z.enum(["food", "transport", "shopping", "bills", "entertainment", "education", "topup", "transfer", "other"]).optional(),
  confirm: z.literal(true).optional(),
});

// user confirms or corrects a low-confidence extraction
emailRouter.patch("/transactions/:id", (req, res) => {
  const body = ReviewBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Body tidak valid" });
  const { category, confirm } = body.data;
  const tx = emailStore.updateTransaction(userIdOf(req), req.params.id, {
    ...(category && { category, countsTowardSpending: category !== "topup" && category !== "transfer" }),
    ...(confirm && { needsReview: false }),
  });
  if (!tx) return res.status(404).json({ success: false, error: "Transaksi tidak ditemukan" });
  res.json({ success: true, data: tx });
});

// demo: run the real pipeline over sample receipts in fixtures/email
emailRouter.post("/demo/import", async (req, res) => {
  try {
    const userId = userIdOf(req);
    const files = (await readdir(FIXTURES)).filter((f) => f.endsWith(".eml")).sort();
    const results = [];
    for (const f of files) results.push(await ingestEmail(await readFile(path.join(FIXTURES, f)), { userId, channel: "demo" }));
    res.json({ success: true, data: { scanned: files.length, ...summarize(results) } });
  } catch (e) {
    fail(res, e);
  }
});

// ---- Option A: Gmail API (read-only) ----

emailRouter.get("/gmail/connect", (req, res) => {
  if (!isGmailConfigured()) return res.status(503).json({ success: false, error: "Gmail OAuth belum dikonfigurasi di server" });
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
    if (emailAddress) handleGmailPush(emailAddress);
  } catch {
    // malformed message: ack anyway so Pub/Sub doesn't redeliver it forever
  }
  res.status(204).end();
});

emailRouter.delete("/gmail", async (req, res) => {
  await disconnectGmail(userIdOf(req));
  res.json({ success: true });
});

// ---- Option B: unique forwarding address ----

emailRouter.post("/forward/alias", (req, res) => {
  const a = getOrCreateAlias(userIdOf(req));
  res.json({ success: true, data: { address: a.alias, status: a.status, confirmationCode: a.confirmationCode } });
});

emailRouter.delete("/forward", (req, res) => {
  removeAlias(userIdOf(req));
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
  removeAlias(userId);
  emailStore.deleteTransactions(userId);
  res.json({ success: true });
});
