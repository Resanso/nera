import type { EmailCategory } from "./types";

type Sender = {
  provider: string;
  /** Sender domains; subdomains match too (e.g. no-reply.gojek.com). */
  domains: string[];
  defaultCategory: EmailCategory;
  /** Bank notifications describe payments that merchants may also send a receipt for. */
  bank?: boolean;
  /** How this merchant appears as the payee in bank notifications ("TRAVELOKA INDONESIA"). */
  payeeNames?: string[];
};

/**
 * Only mail from these senders is ever read (Gmail query) or kept (forwarding).
 * Personal email never leaves the inbox. Verify the exact sender domains against
 * real receipts before launch; providers change them.
 */
export const ALLOWED_SENDERS: Sender[] = [
  { provider: "Gojek", domains: ["gojek.com", "gopay.co.id"], defaultCategory: "transport", payeeNames: ["gojek", "gopay"] },
  { provider: "Grab", domains: ["grab.com"], defaultCategory: "transport", payeeNames: ["grab"] },
  { provider: "OVO", domains: ["ovo.id"], defaultCategory: "topup" },
  { provider: "DANA", domains: ["dana.id"], defaultCategory: "topup" },
  { provider: "LinkAja", domains: ["linkaja.id"], defaultCategory: "topup" },
  { provider: "Shopee", domains: ["shopee.co.id"], defaultCategory: "shopping", payeeNames: ["shopee"] },
  { provider: "Tokopedia", domains: ["tokopedia.com"], defaultCategory: "shopping", payeeNames: ["tokopedia"] },
  { provider: "Lazada", domains: ["lazada.co.id"], defaultCategory: "shopping", payeeNames: ["lazada"] },
  { provider: "Blibli", domains: ["blibli.com"], defaultCategory: "shopping", payeeNames: ["blibli"] },
  { provider: "Traveloka", domains: ["traveloka.com"], defaultCategory: "transport", payeeNames: ["traveloka"] },
  { provider: "tiket.com", domains: ["tiket.com"], defaultCategory: "transport", payeeNames: ["tiket.com", "tiket com"] },
  { provider: "Flip", domains: ["flip.id"], defaultCategory: "transfer" },
  // other banks' payment notifications: spending that never touches the BNI account
  { provider: "Livin' by Mandiri", domains: ["bankmandiri.co.id"], defaultCategory: "other", bank: true },
  { provider: "Bank Jago", domains: ["jago.com"], defaultCategory: "other", bank: true },
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
