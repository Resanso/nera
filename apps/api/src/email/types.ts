export type EmailCategory =
  | "food"
  | "transport"
  | "shopping"
  | "bills"
  | "entertainment"
  | "education"
  | "topup"
  | "transfer"
  | "other";

/**
 * A transaction extracted from an email receipt.
 *
 * Google's Limited Use policy (restricted Gmail scope) forbids using this data for
 * credit-worthiness, lending decisions or advertising. It only powers user-facing
 * insights (history, budgets, coach), so it is tagged with `origin: "EMAIL"` and must
 * never be read by risk scoring, loan simulation or the Privileges offer engine.
 */
export interface EmailTransaction {
  id: string;
  userId: string;
  origin: "EMAIL";
  channel: "gmail" | "forward" | "demo";
  provider: string;
  merchant: string;
  amount: number;
  currency: "IDR";
  type: "expense" | "income";
  category: EmailCategory;
  occurredAt: string;
  /** Order / invoice number when the receipt shows one. */
  externalRef?: string;
  /** sha256 of the Message-ID; used for dedupe, the raw email is never stored. */
  messageHash: string;
  confidence: number;
  /** Low confidence: shown as "perlu dicek" and kept out of totals until confirmed. */
  needsReview: boolean;
  /** Top-ups and transfers from the user's own BNI account are not new spending. */
  countsTowardSpending: boolean;
  /** Same payment already counted from another email (e.g. a bank notification for a Traveloka receipt). */
  duplicateOf?: string;
  extractedBy: "rules" | "ai";
  createdAt: string;
}

export type ParsedEmail = {
  messageId: string;
  from: string;
  fromDomain: string;
  subject: string;
  date: Date;
  text: string;
};

export type IngestResult =
  | { status: "imported"; transaction: EmailTransaction }
  | { status: "duplicate" }
  | { status: "ignored"; reason: "sender_not_allowed" | "not_a_transaction" };
