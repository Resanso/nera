import { decrypt, encrypt, signState } from "./crypto";
import { ingestEmail, summarize } from "./ingest";
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
    state: signState(userId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
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
  emailStore.setGmail({
    userId,
    refreshTokenEnc: encrypt(tokens.refresh_token),
    googleEmail: profile.emailAddress,
    connectedAt: new Date().toISOString(),
    syncedIds: [],
  });
}

async function accessToken(userId: string): Promise<string> {
  const conn = emailStore.getGmail(userId);
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
    if (e instanceof GmailAccessRevoked) emailStore.deleteGmail(userId);
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

/** Pull receipts from allowed senders only, newest first, skipping messages already seen. */
export async function syncGmail(userId: string, { days = 90, max = 100 } = {}) {
  const token = await accessToken(userId);
  const conn = emailStore.getGmail(userId)!;
  const seen = new Set(conn.syncedIds);

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
      seen.add(id);
    }
  } finally {
    // keep progress even if a later message fails, so the next sync resumes
    emailStore.setGmail({ ...conn, syncedIds: [...seen], lastSyncAt: new Date().toISOString() });
  }
  return { scanned: todo.length, ...summarize(results) };
}

/** Revoke at Google, then forget the token and everything imported through it. */
export async function disconnectGmail(userId: string) {
  const conn = emailStore.getGmail(userId);
  if (conn) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(conn.refreshTokenEnc))}`, {
      method: "POST",
    }).catch(() => undefined);
  }
  emailStore.deleteGmail(userId);
  emailStore.deleteTransactions(userId, "gmail");
}
