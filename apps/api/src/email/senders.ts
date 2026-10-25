import type { EmailCategory } from "./types";

type Sender = {
  provider: string;
  /** Sender domains; subdomains match too (e.g. no-reply.gojek.com). */
  domains: string[];
  defaultCategory: EmailCategory;
};

/**
 * Only mail from these senders is ever read (Gmail query) or kept (forwarding).
 * Personal email never leaves the inbox. Verify the exact sender domains against
 * real receipts before launch; providers change them.
 */
export const ALLOWED_SENDERS: Sender[] = [
  { provider: "Gojek", domains: ["gojek.com", "gopay.co.id"], defaultCategory: "transport" },
  { provider: "Grab", domains: ["grab.com"], defaultCategory: "transport" },
  { provider: "OVO", domains: ["ovo.id"], defaultCategory: "topup" },
  { provider: "DANA", domains: ["dana.id"], defaultCategory: "topup" },
  { provider: "LinkAja", domains: ["linkaja.id"], defaultCategory: "topup" },
  { provider: "Shopee", domains: ["shopee.co.id"], defaultCategory: "shopping" },
  { provider: "Tokopedia", domains: ["tokopedia.com"], defaultCategory: "shopping" },
  { provider: "Lazada", domains: ["lazada.co.id"], defaultCategory: "shopping" },
  { provider: "Blibli", domains: ["blibli.com"], defaultCategory: "shopping" },
  { provider: "Traveloka", domains: ["traveloka.com"], defaultCategory: "transport" },
  { provider: "tiket.com", domains: ["tiket.com"], defaultCategory: "transport" },
  { provider: "Flip", domains: ["flip.id"], defaultCategory: "transfer" },
  // other banks' payment notifications: spending that never touches the BNI account
  { provider: "Livin' by Mandiri", domains: ["bankmandiri.co.id"], defaultCategory: "other" },
  { provider: "Bank Jago", domains: ["jago.com"], defaultCategory: "other" },
];

export function findSender(fromDomain: string): Sender | undefined {
  const d = fromDomain.toLowerCase();
  return ALLOWED_SENDERS.find((s) => s.domains.some((x) => d === x || d.endsWith(`.${x}`)));
}

/** Gmail search query restricted to allowed senders. */
export function gmailSenderQuery(days: number): string {
  const domains = ALLOWED_SENDERS.flatMap((s) => s.domains);
  return `from:(${domains.join(" OR ")}) newer_than:${days}d`;
}
