import { createHash, randomUUID } from "node:crypto";
import { simpleParser } from "mailparser";
import { FAILED, SHIPPING, extractWithAI, extractWithRules } from "./extract";
import { findSender, providerFromSender } from "./senders";
import { emailStore } from "./store";
import type { EmailTransaction, IngestResult, ParsedEmail } from "./types";

/**
 * Receipts are mostly HTML tables. mailparser's own conversion joins table rows into
 * wrapped paragraphs, which mixes item prices with the total; keep one row per line.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(tr|p|div|li|h\d|table)>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseRaw(raw: Buffer | string): Promise<ParsedEmail> {
  const mail = await simpleParser(raw);
  const from = mail.from?.value[0]?.address?.toLowerCase() ?? "";
  return {
    messageId: mail.messageId ?? "",
    from,
    fromName: mail.from?.value[0]?.name ?? "",
    fromDomain: from.split("@")[1] ?? "",
    subject: mail.subject ?? "",
    date: mail.date ?? new Date(),
    text: typeof mail.html === "string" ? htmlToText(mail.html) : (mail.text ?? ""),
  };
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Raw MIME in, at most one transaction out. Only the extracted fields are kept;
 * the email body is dropped as soon as this returns.
 */
export async function ingestEmail(
  raw: Buffer | string,
  opts: { userId: string; channel: EmailTransaction["channel"] },
): Promise<IngestResult> {
  const email = await parseRaw(raw);
  const listed = findSender(email.fromDomain);
  // Unlisted senders only come from Gmail's own Purchases category (the Gmail query);
  // forwarded mail is held to the allowlist.
  if (!listed && opts.channel !== "gmail") return { status: "ignored", reason: "sender_not_allowed" };
  const sender = listed ?? { provider: providerFromSender(email.fromName, email.fromDomain), defaultCategory: "other" as const };

  // "Pembayaran Tidak Berhasil" still shows an amount; nothing was paid.
  // Shipping updates repeat an order that was already paid.
  if (FAILED.test(email.subject) || SHIPPING.test(email.subject)) return { status: "ignored", reason: "not_a_transaction" };

  const messageHash = hash(email.messageId || `${email.from}|${email.subject}|${email.date.toISOString()}`);
  if (await emailStore.hasMessage(opts.userId, messageHash)) return { status: "duplicate" };

  let x = extractWithRules(email, sender.provider, sender.defaultCategory);
  // unlisted senders need an explicit "Total ..." line; a bare "Rp 50.000" in a chatty
  // email isn't a receipt. Without one, only the AI may still recognize it.
  if (x && !listed && x.confidence < 0.8) x = null;
  if (!x || x.confidence < 0.7) x = (await extractWithAI(email, sender.provider)) ?? x;
  if (!x) return { status: "ignored", reason: "not_a_transaction" };

  const isOwnMoneyMove = x.category === "topup" || x.category === "transfer";
  const transaction: EmailTransaction = {
    id: randomUUID(),
    userId: opts.userId,
    origin: "EMAIL",
    channel: opts.channel,
    provider: sender.provider,
    merchant: x.merchant,
    amount: x.amount,
    currency: "IDR",
    type: x.type,
    category: x.category,
    occurredAt: email.date.toISOString(),
    externalRef: x.externalRef,
    messageHash,
    confidence: x.confidence,
    // unlisted senders: our rules weren't written for their receipts, so the user confirms first
    needsReview: x.confidence < 0.7 || !listed,
    // a GoPay/OVO top-up is usually already a BNI debit; counting it again would double the spend
    countsTowardSpending: x.type === "expense" && !isOwnMoneyMove,
    extractedBy: x.extractedBy,
    createdAt: new Date().toISOString(),
  };
  // a concurrent sync may have stored the same email in the meantime
  if (!(await emailStore.addTransaction(transaction))) return { status: "duplicate" };
  return { status: "imported", transaction };
}

export function summarize(results: IngestResult[]) {
  return {
    imported: results.filter((r) => r.status === "imported").length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    ignored: results.filter((r) => r.status === "ignored").length,
  };
}
