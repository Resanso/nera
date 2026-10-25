import type { EmailTransaction } from "./types";

export type GmailConnection = {
  userId: string;
  /** AES-256-GCM encrypted refresh token (see crypto.ts). Never returned to the client. */
  refreshTokenEnc: string;
  googleEmail?: string;
  connectedAt: string;
  lastSyncAt?: string;
  /** Gmail message ids already processed, so a re-sync skips them without downloading. */
  syncedIds: string[];
};

export type ForwardAlias = {
  alias: string;
  userId: string;
  /** waiting: no mail yet; confirm: Gmail sent a verification code; active: receipts are arriving. */
  status: "waiting" | "confirm" | "active";
  confirmationCode?: string;
  createdAt: string;
  lastReceivedAt?: string;
};

/**
 * In-memory store for the prototype: data is lost on restart.
 * Swap for Postgres (Prisma) before production; keep the same shape and keep
 * refresh tokens encrypted at rest.
 */
class EmailStore {
  private transactions = new Map<string, EmailTransaction[]>();
  private gmail = new Map<string, GmailConnection>();
  private aliases = new Map<string, ForwardAlias>();

  listTransactions(userId: string): EmailTransaction[] {
    return [...(this.transactions.get(userId) ?? [])].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  hasMessage(userId: string, messageHash: string): boolean {
    return (this.transactions.get(userId) ?? []).some((t) => t.messageHash === messageHash);
  }

  addTransaction(tx: EmailTransaction) {
    const list = this.transactions.get(tx.userId) ?? [];
    list.push(tx);
    this.transactions.set(tx.userId, list);
  }

  updateTransaction(userId: string, id: string, patch: Partial<Pick<EmailTransaction, "category" | "needsReview" | "countsTowardSpending">>) {
    const tx = (this.transactions.get(userId) ?? []).find((t) => t.id === id);
    if (tx) Object.assign(tx, patch);
    return tx;
  }

  deleteTransactions(userId: string, channel?: EmailTransaction["channel"]) {
    if (!channel) return void this.transactions.delete(userId);
    this.transactions.set(userId, (this.transactions.get(userId) ?? []).filter((t) => t.channel !== channel));
  }

  getGmail(userId: string) {
    return this.gmail.get(userId);
  }

  setGmail(conn: GmailConnection) {
    this.gmail.set(conn.userId, conn);
  }

  deleteGmail(userId: string) {
    this.gmail.delete(userId);
  }

  getAlias(alias: string) {
    return this.aliases.get(alias.toLowerCase());
  }

  getAliasForUser(userId: string) {
    return [...this.aliases.values()].find((a) => a.userId === userId);
  }

  setAlias(a: ForwardAlias) {
    this.aliases.set(a.alias.toLowerCase(), a);
  }

  deleteAliasForUser(userId: string) {
    const a = this.getAliasForUser(userId);
    if (a) this.aliases.delete(a.alias.toLowerCase());
  }
}

export const emailStore = new EmailStore();
