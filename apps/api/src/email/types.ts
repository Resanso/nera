export type EmailCategory =
  | "food"
  | "transport"
  | "shopping"
  | "bills"
  | "entertainment"
  | "education"
  | "travel"
  | "topup"
  | "transfer"
  | "investment"
  | "other";

/** Money moved between the user's own accounts or into investments: not spending. */
export const isOwnMoneyMove = (c: EmailCategory) => c === "topup" || c === "transfer" || c === "investment";

/** Merchant names as the user's category rules key them: "  Warteg  Arjuna " -> "warteg arjuna". */
export const merchantKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** Counted spending: not a money move, not a duplicate, not waiting for review, not dismissed. */
export const isCounted = (t: EmailTransaction) => t.type === "expense" && t.countsTowardSpending && !t.needsReview && !t.dismissed;

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
  /** Low confidence or unlisted sender: shown as "perlu dicek" and kept out of totals until confirmed. */
  needsReview: boolean;
  /** Top-ups, transfers and investments are not new spending. */
  countsTowardSpending: boolean;
  /** Same payment already counted from another email (e.g. a bank notification for a Traveloka receipt). */
  duplicateOf?: string;
  /** The user said Nera misread this email: hidden and never counted. */
  dismissed?: boolean;
  /** The user set the category or dismissed it; a re-import keeps that decision. */
  userEdited?: boolean;
  /** Gmail only: the message id, to show the user the original email on request. */
  gmailId?: string;
  /** Gmail only: the linked mailbox it came from (a user can link several). */
  account?: string;
  extractedBy: "rules" | "ai";
  createdAt: string;
}

export type ParsedEmail = {
  messageId: string;
  from: string;
  /** Display name of the sender ("Anthropic, PBC"), used to name unlisted senders. */
  fromName: string;
  fromDomain: string;
  subject: string;
  date: Date;
  text: string;
};

export type IngestResult =
  | { status: "imported"; transaction: EmailTransaction }
  | { status: "duplicate" }
  | { status: "ignored"; reason: "sender_not_allowed" | "not_a_transaction" };
