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
  { provider: "Gojek", domains: ["gojek.com", "go-jek.com", "gopay.co.id"], defaultCategory: "transport", payeeNames: ["gojek", "gopay"] },
  { provider: "Grab", domains: ["grab.com"], defaultCategory: "transport", payeeNames: ["grab"] },
  { provider: "OVO", domains: ["ovo.id"], defaultCategory: "topup" },
  { provider: "DANA", domains: ["dana.id"], defaultCategory: "topup" },
  { provider: "LinkAja", domains: ["linkaja.id"], defaultCategory: "topup" },
  { provider: "Shopee", domains: ["shopee.co.id"], defaultCategory: "shopping", payeeNames: ["shopee"] },
  { provider: "Tokopedia", domains: ["tokopedia.com"], defaultCategory: "shopping", payeeNames: ["tokopedia"] },
  { provider: "Lazada", domains: ["lazada.co.id"], defaultCategory: "shopping", payeeNames: ["lazada"] },
  { provider: "Blibli", domains: ["blibli.com"], defaultCategory: "shopping", payeeNames: ["blibli"] },
  { provider: "Traveloka", domains: ["traveloka.com"], defaultCategory: "travel", payeeNames: ["traveloka"] },
  { provider: "tiket.com", domains: ["tiket.com"], defaultCategory: "travel", payeeNames: ["tiket.com", "tiket com"] },
  { provider: "Flip", domains: ["flip.id"], defaultCategory: "transfer" },
  // other banks' payment notifications: spending that never touches the BNI account
  { provider: "Livin' by Mandiri", domains: ["bankmandiri.co.id"], defaultCategory: "other", bank: true },
  { provider: "Bank Jago", domains: ["jago.com"], defaultCategory: "other", bank: true },
  { provider: "blu", domains: ["blubybcadigital.id", "bcadigital.co.id"], defaultCategory: "other", bank: true },
  // wondr receipts: real BNI spending; Nera's own BNI figures are still demo data
  { provider: "BNI", domains: ["bni.co.id"], defaultCategory: "other", bank: true },
];

/**
 * Brokers and crypto exchanges. Not in the Gmail query (they arrive through the Purchases
 * category); their buys, sells and asset values are investments, never pocket spending.
 */
/**
 * Stores whose receipts arrive through Gmail's Purchases category and read reliably, so
 * they don't wait for review like other unlisted senders. Not added to the Gmail query:
 * google.com and apple.com send far more than receipts.
 */
const TRUSTED_RECEIPT_DOMAINS = ["apple.com", "google.com", "steampowered.com", "alfagift.id"];

export const isTrustedReceiptDomain = (fromDomain: string) => {
  const d = fromDomain.toLowerCase();
  return TRUSTED_RECEIPT_DOMAINS.some((x) => d === x || d.endsWith(`.${x}`));
};

const INVESTMENT_DOMAINS = ["pintu.co.id", "bibit.id", "stockbit.com", "ajaib.co.id", "bareksa.com", "indodax.com", "tokocrypto.com", "pluang.com"];

export const isInvestmentDomain = (fromDomain: string) => {
  const d = fromDomain.toLowerCase();
  return INVESTMENT_DOMAINS.some((x) => d === x || d.endsWith(`.${x}`));
};

/**
 * Travel agents sell flights, trains, hotels and attractions; every one of those is a trip,
 * whatever words ("kereta", "tiket masuk") the receipt uses. Their receipts keep the sender's category.
 */
export function fixedCategory(provider: string): EmailCategory | undefined {
  const s = ALLOWED_SENDERS.find((x) => x.provider === provider);
  return s?.defaultCategory === "travel" ? "travel" : undefined;
}

export function findSender(fromDomain: string): Sender | undefined {
  const d = fromDomain.toLowerCase();
  return ALLOWED_SENDERS.find((s) => s.domains.some((x) => d === x || d.endsWith(`.${x}`)));
}

/**
 * Gmail search query: the allowed senders, plus whatever Gmail itself files under
 * Purchases (receipts from merchants we don't list yet). Unlisted senders are imported
 * as "perlu dicek" only; see ingestEmail.
 */
export function gmailSenderQuery(days: number): string {
  const domains = ALLOWED_SENDERS.flatMap((s) => s.domains);
  return `(from:(${domains.join(" OR ")}) OR category:purchases) newer_than:${days}d`;
}

/** "Anthropic, PBC" / "no-reply@mail.foo.co.id" -> a short provider name for unlisted senders. */
export function providerFromSender(fromName: string, fromDomain: string): string {
  const name = fromName.replace(/^(no[-_ ]?reply|noreply)\b/i, "").split(/[,|<]/)[0].trim();
  if (name.length >= 2 && name.length <= 40) return name;
  const parts = fromDomain.split(".").filter((p) => !["mail", "email", "e", "info", "noreply", "no-reply", "co", "com", "id", "net", "org"].includes(p));
  return parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : fromDomain;
}
