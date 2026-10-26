import { decrypt, encrypt, signState } from "./crypto";
import { hash, ingestEmail, parseRaw, summarize } from "./ingest";
import { reconcile } from "./reconcile";
import { ConsentRequired, hasConsent, requireConsent } from "./consent";
import { gmailSenderQuery } from "./senders";
import { emailStore, type GmailConnection } from "./store";
import type { EmailTransaction, IngestResult, ParsedEmail } from "./types";

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
    // consent: Google always returns a refresh token; select_account: linking a second
    // mailbox must not silently reuse the account the browser is signed in to
    prompt: "consent select_account",
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
  // linking the same mailbox again replaces its token; another mailbox is added next to it
  const account = profile.emailAddress.toLowerCase();
  await emailStore.setGmail({
    userId,
    account,
    refreshTokenEnc: encrypt(tokens.refresh_token),
    googleEmail: profile.emailAddress,
    connectedAt: (await emailStore.getGmail(userId, account))?.connectedAt ?? new Date().toISOString(),
  });
  await startGmailWatch(userId, account).catch((e) => console.error(`[gmail] ${(e as Error).message}`));
  // a mailbox added later gets the same history depth the user already imported elsewhere
  const others = (await emailStore.listGmailFor(userId)).filter((c) => c.account !== account);
  const days = Math.max(0, ...others.map((c) => c.backfill?.days ?? 0));
  if (days > 0 && !(await emailStore.getGmail(userId, account))?.backfill) {
    await emailStore.setBackfill(userId, account, { days, status: "pending", scanned: 0, imported: 0, updatedAt: new Date().toISOString() });
  }
  return account;
}

async function accessToken(conn: GmailConnection): Promise<string> {
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
    if (e instanceof GmailAccessRevoked) await emailStore.deleteGmail(conn.userId, conn.account);
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
 * Pull receipts from allowed senders only, newest first, skipping messages already seen,
 * from every mailbox the user linked (or one, with `account`).
 * Concurrent triggers (button, push, scheduler) for the same user share one run.
 */
type SyncOpts = { days?: number; max?: number; account?: string; onProgress?: (done: SyncSummary) => void };

export function syncGmail(userId: string, opts?: SyncOpts): Promise<SyncSummary> {
  const inFlight = running.get(userId);
  // same default window: share the run. A custom window (backfill) waits, then runs its own.
  if (inFlight) return opts ? inFlight.catch(() => undefined).then(() => syncGmail(userId, opts)) : inFlight;
  const run = runSync(userId, opts).finally(() => running.delete(userId));
  running.set(userId, run);
  return run;
}

async function runSync(userId: string, { days = 90, max = 100, account, onProgress }: SyncOpts = {}): Promise<SyncSummary> {
  await requireConsent(userId, "email_import");
  const conns = (await emailStore.listGmailFor(userId)).filter((c) => account === undefined || c.account === account);
  if (!conns.length) throw new Error("Gmail belum terhubung");
  const allowAI = await hasConsent(userId, "ai_processing");
  const seen = await emailStore.seenGmailIds(userId);

  const results: IngestResult[] = [];
  let scanned = 0;
  const errors: unknown[] = [];
  try {
    for (const conn of conns) {
      try {
        scanned += await syncMailbox(conn, { days, max, seen, allowAI, results, onProgress });
      } catch (e) {
        // one revoked or failing mailbox must not block the others
        errors.push(e);
        console.error(`[gmail] ${conn.userId}/${conn.account}: ${(e as Error).message}`);
      }
    }
  } finally {
    if (results.length) await reconcile(userId);
  }
  if (errors.length === conns.length) throw errors[0];
  return { scanned, ...summarize(results) };
}

async function syncMailbox(
  conn: GmailConnection,
  o: {
    days: number;
    max: number;
    seen: Set<string>;
    allowAI: boolean;
    results: IngestResult[];
    onProgress?: (done: SyncSummary) => void;
    /** re-import: write under this id instead of the user's, and leave "seen" alone */
    into?: string;
    /** Gmail search instead of all allowed senders (targeted re-import) */
    query?: string;
  },
): Promise<number> {
  const token = await accessToken(conn);
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({ q: o.query ? `(${o.query}) newer_than:${o.days}d` : gmailSenderQuery(o.days), maxResults: "100" });
    if (pageToken) q.set("pageToken", pageToken);
    const page = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string }>(token, `/messages?${q}`);
    for (const m of page.messages ?? []) if (!o.seen.has(m.id)) ids.push(m.id);
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < o.max);

  const todo = ids.slice(0, o.max);
  try {
    // one at a time: Gmail rate-limits concurrent requests per user
    for (const id of todo) {
      const m = await gmailGet<{ raw: string }>(token, `/messages/${id}?format=raw`);
      o.results.push(
        await ingestEmail(Buffer.from(m.raw, "base64url"), {
          userId: o.into ?? conn.userId,
          channel: "gmail",
          account: conn.account,
          gmailId: id,
          allowAI: o.allowAI,
        }),
      );
      // recorded per message, so a failed sync resumes where it stopped
      if (!o.into) await emailStore.markGmailSeen(conn.userId, id);
      o.seen.add(id);
      o.onProgress?.({ scanned: o.results.length, ...summarize(o.results) });
    }
  } finally {
    // re-read the connection so a disconnect during the run isn't undone
    const latest = o.into ? undefined : await emailStore.getGmail(conn.userId, conn.account);
    if (latest) await emailStore.setGmail({ ...latest, lastSyncAt: new Date().toISOString() });
  }
  return todo.length;
}

/**
 * Re-read linked mailboxes with the current parser without the user seeing an empty
 * history: emails are imported under a staging id, then swapped in at once.
 *
 * Prefer fixing rows in the database when the stored fields are enough to tell what is
 * wrong. Re-import only what needs the email itself, scoped with `target`: a Gmail
 * search (`query`) plus the providers whose rows it replaces. Corrections the user made
 * by hand on replaced rows are lost (raw emails are never stored).
 */
export async function reimportGmail(
  userId: string,
  days: number,
  target?: { query: string; providers: string[] },
  onProgress?: (done: SyncSummary) => void,
): Promise<SyncSummary> {
  await requireConsent(userId, "email_import");
  const conns = await emailStore.listGmailFor(userId);
  if (!conns.length) throw new Error("Gmail belum terhubung");
  const allowAI = await hasConsent(userId, "ai_processing");
  const staging = `${userId}~reimport`;
  // a staging set left by an interrupted run starts over
  await emailStore.deleteTransactions(staging);
  const startedAt = new Date().toISOString();

  const results: IngestResult[] = [];
  let scanned = 0;
  for (const conn of conns) {
    scanned += await syncMailbox(conn, {
      days,
      max: Number.MAX_SAFE_INTEGER,
      seen: new Set(),
      allowAI,
      results,
      onProgress,
      into: staging,
      query: target?.query,
    });
  }
  await reconcile(staging);
  await emailStore.adoptTransactions(staging, userId, "gmail", startedAt, target?.providers);
  await reconcile(userId);
  return { scanned, ...summarize(results) };
}

// ---- "Ambil riwayat lebih lama": backfill beyond the regular 90-day window ----

/** Ask the worker to pull older receipts. Progress is stored, so it survives restarts. */
/**
 * The original email behind a Gmail transaction, read live for its owner and never stored.
 * Older rows only keep a hash of the Message-ID, so they are found by searching the hour
 * around the receipt and matching that hash; the Gmail id is kept for the next time.
 */
export async function transactionEmail(tx: EmailTransaction): Promise<ParsedEmail | null> {
  const conns = (await emailStore.listGmailFor(tx.userId)).filter((c) => !tx.account || c.account === tx.account);
  for (const conn of conns) {
    const token = await accessToken(conn);
    let id = tx.gmailId;
    if (!id) {
      const t = Math.floor(Date.parse(tx.occurredAt) / 1000);
      const q = encodeURIComponent(`after:${t - 3600} before:${t + 3600}`);
      const page = await gmailGet<{ messages?: { id: string }[] }>(token, `/messages?maxResults=100&q=${q}`);
      for (const m of page.messages ?? []) {
        const meta = await gmailGet<{ payload?: { headers?: { name: string; value: string }[] } }>(
          token,
          `/messages/${m.id}?format=metadata&metadataHeaders=Message-ID`,
        );
        const messageId = meta.payload?.headers?.find((h) => h.name.toLowerCase() === "message-id")?.value.trim();
        if (messageId && hash(messageId) === tx.messageHash) {
          id = m.id;
          await emailStore.updateTransaction(tx.userId, tx.id, { gmailId: id });
          break;
        }
      }
    }
    if (!id) continue;
    const m = await gmailGet<{ raw: string }>(token, `/messages/${id}?format=raw`);
    return parseRaw(Buffer.from(m.raw, "base64url"));
  }
  return null;
}

export async function requestBackfill(userId: string, days: number) {
  await requireConsent(userId, "email_import");
  const conns = await emailStore.listGmailFor(userId);
  if (!conns.length) throw new Error("Gmail belum terhubung");
  // every linked mailbox; the status endpoint adds their progress up
  for (const c of conns) {
    await emailStore.setBackfill(userId, c.account, { days, status: "pending", scanned: 0, imported: 0, updatedAt: new Date().toISOString() });
  }
}

/** Process requested backfills, one batch of up to 200 emails at a time, saving progress after each. */
export async function runBackfills() {
  for (const conn of await emailStore.listGmail()) {
    const b = conn.backfill;
    if (!b || b.status === "done" || b.status === "error") continue;
    let progress = { ...b, status: "running" as const, updatedAt: new Date().toISOString() };
    await emailStore.setBackfill(conn.userId, conn.account, progress);
    try {
      for (;;) {
        // live progress for the UI, at most every 3s
        let lastWrite = 0;
        let pendingWrite: Promise<unknown> = Promise.resolve();
        const base = { scanned: progress.scanned, imported: progress.imported };
        const onProgress = (done: SyncSummary) => {
          if (Date.now() - lastWrite < 3000) return;
          lastWrite = Date.now();
          pendingWrite = emailStore
            .setBackfill(conn.userId, conn.account, { ...progress, scanned: base.scanned + done.scanned, imported: base.imported + done.imported, updatedAt: new Date().toISOString() })
            .catch(() => undefined);
        };
        const r = await syncGmail(conn.userId, { days: b.days, max: 200, account: conn.account, onProgress }).finally(() => pendingWrite);
        // a late progress write must not land after the final status below
        await pendingWrite;
        progress = { ...progress, scanned: base.scanned + r.scanned, imported: base.imported + r.imported, updatedAt: new Date().toISOString() };
        // a disconnect or a new request while running ends this run
        const latest = (await emailStore.getGmail(conn.userId, conn.account))?.backfill;
        if (!latest || latest.days !== b.days) return;
        if (r.scanned === 0) {
          await emailStore.setBackfill(conn.userId, conn.account, { ...progress, status: "done" });
          break;
        }
        await emailStore.setBackfill(conn.userId, conn.account, progress);
      }
    } catch (e) {
      await emailStore.setBackfill(conn.userId, conn.account, { ...progress, status: "error", error: (e as Error).message, updatedAt: new Date().toISOString() });
    }
  }
}

// ---- Real-time updates: Gmail push via Cloud Pub/Sub, with a polling fallback ----

const pushTopic = () => process.env.GMAIL_PUBSUB_TOPIC;

/** Ask Gmail to publish to our Pub/Sub topic whenever the inbox changes. Lasts 7 days. */
export async function startGmailWatch(userId: string, account: string) {
  const topicName = pushTopic();
  if (!topicName) return;
  const conn = await emailStore.getGmail(userId, account);
  if (!conn) return;
  const token = await accessToken(conn);
  const res = await fetch(`${GMAIL}/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" }),
  });
  const body = (await res.json().catch(() => ({}))) as { expiration?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(`Gmail watch gagal: ${body.error?.message ?? res.status}`);
  const latest = await emailStore.getGmail(userId, account);
  if (latest) await emailStore.setGmail({ ...latest, watchExpiresAt: new Date(Number(body.expiration)).toISOString() });
}

/** Pub/Sub tells us which mailbox changed; sync the user(s) linked to it. */
export async function handleGmailPush(emailAddress: string) {
  for (const conn of await emailStore.listGmail()) {
    if (conn.googleEmail?.toLowerCase() !== emailAddress.toLowerCase()) continue;
    syncGmail(conn.userId, { account: conn.account }).catch((e) => e instanceof ConsentRequired || console.error(`[gmail] push sync: ${(e as Error).message}`));
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
    const conns = await emailStore.listGmail();
    const renewBy = Date.now() + 24 * 60 * 60 * 1000;
    for (const conn of conns) {
      if (pushTopic() && (!conn.watchExpiresAt || Date.parse(conn.watchExpiresAt) < renewBy)) {
        await startGmailWatch(conn.userId, conn.account).catch((e) => console.error(`[gmail] watch: ${(e as Error).message}`));
      }
    }
    // one sync per user covers all of their mailboxes
    for (const userId of new Set(conns.map((c) => c.userId))) {
      try {
        await syncGmail(userId);
      } catch (e) {
        // no consent (yet, or withdrawn): nothing to do for this user
        if (!(e instanceof ConsentRequired)) console.error(`[gmail] scheduled sync: ${(e as Error).message}`);
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

/**
 * Revoke at Google, then forget the token and everything imported through it:
 * one mailbox, or all of the user's when `account` is left out.
 */
export async function disconnectGmail(userId: string, account?: string) {
  const conns = (await emailStore.listGmailFor(userId)).filter((c) => account === undefined || c.account === account);
  for (const conn of conns) {
    // stop push notifications for this mailbox before the token goes away
    await accessToken(conn)
      .then((t) => fetch(`${GMAIL}/stop`, { method: "POST", headers: { Authorization: `Bearer ${t}` } }))
      .catch(() => undefined);
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(conn.refreshTokenEnc))}`, {
      method: "POST",
    }).catch(() => undefined);
  }
  await emailStore.deleteGmail(userId, account);
  await emailStore.deleteTransactions(userId, "gmail", account);
  // seen ids are kept per user; relinking this mailbox later must read its emails again
  if (account !== undefined) await emailStore.clearGmailSeen(userId);
}
