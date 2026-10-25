import { decrypt, encrypt, signState } from "./crypto";
import { ingestEmail, summarize } from "./ingest";
import { reconcile } from "./reconcile";
import { gmailSenderQuery } from "./senders";
import { emailStore } from "./store";
import type { IngestResult } from "./types";

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailAccessRevoked extends Error {}

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:4000/api/email/gmail/callback";
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET belum diset");
  return { clientId, clientSecret, redirectUri };
}

export const isGmailConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.EMAIL_TOKEN_KEY);

export function gmailAuthUrl(userId: string): string {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // force the consent screen so Google always returns a refresh token
    prompt: "consent",
    state: signState({ p: "gmail", u: userId }),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * "Masuk dengan Google": identity only (openid email), no Gmail access.
 * Shares the registered redirect URI with the Gmail flow; `state.p` tells them apart.
 */
export function loginAuthUrl(returnTo: string): string {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    prompt: "select_account",
    state: signState({ p: "login", r: returnTo }),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Exchange the login code for the Google account id (`sub`) and verified email. */
export async function completeLogin(code: string): Promise<{ sub: string; email: string }> {
  const { clientId, clientSecret, redirectUri } = config();
  const tokens = (await tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  })) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Google tidak mengembalikan id_token");
  // received directly from Google's token endpoint over TLS, so the payload can be trusted as is
  const claims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8")) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    aud: string;
  };
  if (claims.aud !== clientId || !claims.email || !claims.email_verified) throw new Error("Akun Google tidak valid");
  return { sub: claims.sub, email: claims.email };
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; error?: string };
  if (!res.ok) {
    if (data.error === "invalid_grant") throw new GmailAccessRevoked("Akses Gmail dicabut atau kedaluwarsa");
    throw new Error(`Token Google gagal: ${data.error ?? res.status}`);
  }
  return data;
}

export async function completeGmailConnect(userId: string, code: string) {
  const { clientId, clientSecret, redirectUri } = config();
  const tokens = await tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (!tokens.refresh_token || !tokens.access_token) throw new Error("Google tidak mengembalikan refresh token");

  const profile = await gmailGet<{ emailAddress: string }>(tokens.access_token, "/profile");
  await emailStore.setGmail({
    userId,
    refreshTokenEnc: encrypt(tokens.refresh_token),
    googleEmail: profile.emailAddress,
    connectedAt: new Date().toISOString(),
  });
  await startGmailWatch(userId).catch((e) => console.error(`[gmail] ${(e as Error).message}`));
}

async function accessToken(userId: string): Promise<string> {
  const conn = await emailStore.getGmail(userId);
  if (!conn) throw new Error("Gmail belum terhubung");
  const { clientId, clientSecret } = config();
  try {
    const t = await tokenRequest({
      refresh_token: decrypt(conn.refreshTokenEnc),
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });
    return t.access_token!;
  } catch (e) {
    // user revoked access in their Google account (or test-mode token expired after 7 days)
    if (e instanceof GmailAccessRevoked) await emailStore.deleteGmail(userId);
    throw e;
  }
}

const RETRYABLE = new Set(["rateLimitExceeded", "userRateLimitExceeded", "backendError"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with exponential backoff on Gmail's per-user rate limits (403/429). */
async function gmailGet<T>(token: string, path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[] } } | null;
    const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.message ?? "unknown";
    if ((res.status === 429 || res.status >= 500 || RETRYABLE.has(reason)) && attempt < 5) {
      await sleep(1000 * 2 ** attempt + Math.random() * 500);
      return gmailGet<T>(token, path, attempt + 1);
    }
    console.error(`[gmail] ${res.status} ${path.split("?")[0].replace(/\/messages\/\w+/, "/messages/:id")}: ${reason}`);
    throw new Error(`Gmail API ${res.status} (${reason})`);
  }
  return res.json() as Promise<T>;
}

type SyncSummary = { scanned: number; imported: number; duplicates: number; ignored: number };
const running = new Map<string, Promise<SyncSummary>>();

/**
 * Pull receipts from allowed senders only, newest first, skipping messages already seen.
 * Concurrent triggers (button, push, scheduler) for the same user share one run.
 */
export function syncGmail(userId: string, opts?: { days?: number; max?: number }): Promise<SyncSummary> {
  const inFlight = running.get(userId);
  // same default window: share the run. A custom window (backfill) waits, then runs its own.
  if (inFlight) return opts ? inFlight.catch(() => undefined).then(() => syncGmail(userId, opts)) : inFlight;
  const run = runSync(userId, opts).finally(() => running.delete(userId));
  running.set(userId, run);
  return run;
}

async function runSync(userId: string, { days = 90, max = 100 } = {}): Promise<SyncSummary> {
  const token = await accessToken(userId);
  const seen = await emailStore.seenGmailIds(userId);

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({ q: gmailSenderQuery(days), maxResults: "100" });
    if (pageToken) q.set("pageToken", pageToken);
    const page = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string }>(token, `/messages?${q}`);
    for (const m of page.messages ?? []) if (!seen.has(m.id)) ids.push(m.id);
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < max);

  const results: IngestResult[] = [];
  const todo = ids.slice(0, max);
  try {
    // one at a time: Gmail rate-limits concurrent requests per user
    for (const id of todo) {
      const m = await gmailGet<{ raw: string }>(token, `/messages/${id}?format=raw`);
      results.push(await ingestEmail(Buffer.from(m.raw, "base64url"), { userId, channel: "gmail" }));
      // recorded per message, so a failed sync resumes where it stopped
      await emailStore.markGmailSeen(userId, id);
    }
  } finally {
    // re-read the connection so a disconnect during the run isn't undone
    const latest = await emailStore.getGmail(userId);
    if (latest) await emailStore.setGmail({ ...latest, lastSyncAt: new Date().toISOString() });
    if (results.length) await reconcile(userId);
  }
  return { scanned: todo.length, ...summarize(results) };
}

// ---- "Ambil riwayat lebih lama": backfill beyond the regular 90-day window ----

/** Ask the worker to pull older receipts. Progress is stored, so it survives restarts. */
export async function requestBackfill(userId: string, days: number) {
  if (!(await emailStore.getGmail(userId))) throw new Error("Gmail belum terhubung");
  await emailStore.setBackfill(userId, { days, status: "pending", scanned: 0, imported: 0, updatedAt: new Date().toISOString() });
}

/** Process requested backfills, one batch of up to 200 emails at a time, saving progress after each. */
export async function runBackfills() {
  for (const conn of await emailStore.listGmail()) {
    const b = conn.backfill;
    if (!b || b.status === "done" || b.status === "error") continue;
    let progress = { ...b, status: "running" as const };
    try {
      for (;;) {
        const r = await syncGmail(conn.userId, { days: b.days, max: 200 });
        progress = { ...progress, scanned: progress.scanned + r.scanned, imported: progress.imported + r.imported, updatedAt: new Date().toISOString() };
        // a disconnect or a new request while running ends this run
        const latest = (await emailStore.getGmail(conn.userId))?.backfill;
        if (!latest || latest.days !== b.days) return;
        if (r.scanned === 0) {
          await emailStore.setBackfill(conn.userId, { ...progress, status: "done" });
          break;
        }
        await emailStore.setBackfill(conn.userId, progress);
      }
    } catch (e) {
      await emailStore.setBackfill(conn.userId, { ...progress, status: "error", error: (e as Error).message, updatedAt: new Date().toISOString() });
    }
  }
}

// ---- Real-time updates: Gmail push via Cloud Pub/Sub, with a polling fallback ----

const pushTopic = () => process.env.GMAIL_PUBSUB_TOPIC;

/** Ask Gmail to publish to our Pub/Sub topic whenever the inbox changes. Lasts 7 days. */
export async function startGmailWatch(userId: string) {
  const topicName = pushTopic();
  if (!topicName) return;
  const token = await accessToken(userId);
  const res = await fetch(`${GMAIL}/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" }),
  });
  const body = (await res.json().catch(() => ({}))) as { expiration?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(`Gmail watch gagal: ${body.error?.message ?? res.status}`);
  const conn = await emailStore.getGmail(userId);
  if (conn) await emailStore.setGmail({ ...conn, watchExpiresAt: new Date(Number(body.expiration)).toISOString() });
}

/** Pub/Sub tells us which mailbox changed; sync the user(s) linked to it. */
export async function handleGmailPush(emailAddress: string) {
  for (const conn of await emailStore.listGmail()) {
    if (conn.googleEmail?.toLowerCase() !== emailAddress.toLowerCase()) continue;
    syncGmail(conn.userId).catch((e) => console.error(`[gmail] push sync: ${(e as Error).message}`));
  }
}

/**
 * Every GMAIL_POLL_MINUTES (default 10): sync each linked mailbox in case a push was
 * missed, and renew watches that expire within a day.
 */
export function startGmailScheduler() {
  const minutes = Number(process.env.GMAIL_POLL_MINUTES ?? 10);
  if (!minutes || !isGmailConfigured()) return;
  const tick = async () => {
    for (const conn of await emailStore.listGmail()) {
      try {
        const renewBy = Date.now() + 24 * 60 * 60 * 1000;
        if (pushTopic() && (!conn.watchExpiresAt || Date.parse(conn.watchExpiresAt) < renewBy)) {
          await startGmailWatch(conn.userId);
        }
        await syncGmail(conn.userId);
      } catch (e) {
        console.error(`[gmail] scheduled sync: ${(e as Error).message}`);
      }
    }
  };
  setInterval(tick, minutes * 60 * 1000).unref();
  setTimeout(tick, 15_000).unref();

  // backfill requests are picked up within ~20s; one pass at a time
  let backfilling = false;
  setInterval(() => {
    if (backfilling) return;
    backfilling = true;
    runBackfills()
      .catch((e) => console.error(`[gmail] backfill: ${(e as Error).message}`))
      .finally(() => (backfilling = false));
  }, 20_000).unref();
  console.log(`[NERA] Gmail sync every ${minutes} min${pushTopic() ? " + Pub/Sub push" : ""}`);
}

/** Revoke at Google, then forget the token and everything imported through it. */
export async function disconnectGmail(userId: string) {
  const conn = await emailStore.getGmail(userId);
  if (conn) {
    // stop push notifications for this mailbox before the token goes away
    await accessToken(userId)
      .then((t) => fetch(`${GMAIL}/stop`, { method: "POST", headers: { Authorization: `Bearer ${t}` } }))
      .catch(() => undefined);
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(conn.refreshTokenEnc))}`, {
      method: "POST",
    }).catch(() => undefined);
  }
  await emailStore.deleteGmail(userId);
  await emailStore.deleteTransactions(userId, "gmail");
}
