import { randomBytes } from "node:crypto";
import { ingestEmail, parseRaw } from "./ingest";
import { reconcile } from "./reconcile";
import { hasConsent } from "./consent";
import { emailStore, type ForwardAlias } from "./store";
import type { IngestResult } from "./types";

const domain = () => process.env.INBOUND_EMAIL_DOMAIN ?? "inbox.nera.id";

// lowercase letters + digits without look-alikes (0/o, 1/l), easy to read aloud
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export async function getOrCreateAlias(userId: string): Promise<ForwardAlias> {
  const existing = await emailStore.getAliasForUser(userId);
  if (existing) return existing;
  const id = [...randomBytes(10)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  const alias: ForwardAlias = { alias: `u-${id}@${domain()}`, userId, status: "waiting", createdAt: new Date().toISOString() };
  await emailStore.setAlias(alias);
  return alias;
}

export async function removeAlias(userId: string) {
  await emailStore.deleteAliasForUser(userId);
  await emailStore.deleteTransactions(userId, "forward");
}

/**
 * Gmail verifies a forwarding address by mailing it a code. We catch that mail and
 * show the code in the app so the user can paste it back into Gmail.
 */
function gmailConfirmationCode(from: string, subject: string, text: string): string | null {
  if (from !== "forwarding-noreply@google.com") return null;
  const m = subject.match(/\(#(\d{6,})\)/) ?? text.match(/(?:confirmation code|kode konfirmasi)\s*:?\s*(\d{6,})/i);
  return m?.[1] ?? null;
}

export type InboundOutcome =
  | { status: "unknown_alias" }
  | { status: "no_consent" }
  | { status: "confirmation" }
  | { status: "unverified_sender" }
  | IngestResult;

/** Relaxed DMARC-style alignment: mail.gojek.com and gojek.com align both ways. */
const aligned = (from: string, signer: string) => from === signer || from.endsWith(`.${signer}`) || signer.endsWith(`.${from}`);

/**
 * @param opts.dkimDomains domains with a passing DKIM signature. When given (our own
 *   SMTP server), mail whose From domain isn't backed by one of them is dropped.
 *   The Cloudflare webhook path leaves it undefined, so that path is not DKIM-checked here.
 */
export async function handleInbound(
  recipient: string,
  raw: Buffer,
  opts: { dkimDomains?: string[] } = {},
): Promise<InboundOutcome> {
  const alias = await emailStore.getAlias(recipient.trim());
  if (!alias) return { status: "unknown_alias" };
  // consent withdrawn: drop the mail unread
  if (!(await hasConsent(alias.userId, "email_import"))) return { status: "no_consent" };

  const email = await parseRaw(raw);
  if (opts.dkimDomains && !opts.dkimDomains.some((d) => aligned(email.fromDomain, d))) {
    return { status: "unverified_sender" };
  }
  const code = gmailConfirmationCode(email.from, email.subject, email.text);
  if (code) {
    await emailStore.setAlias({ ...alias, status: "confirm", confirmationCode: code });
    return { status: "confirmation" };
  }

  const allowAI = await hasConsent(alias.userId, "ai_processing");
  const result = await ingestEmail(raw, { userId: alias.userId, channel: "forward", allowAI });
  // any mail from the user's filter proves forwarding works, even if it wasn't a receipt
  await emailStore.setAlias({ ...alias, status: "active", confirmationCode: undefined, lastReceivedAt: new Date().toISOString() });
  if (result.status === "imported") await reconcile(alias.userId);
  return result;
}
