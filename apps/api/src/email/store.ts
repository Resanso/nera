import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
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
  /** Pub/Sub push watch; Gmail expires it after 7 days, the scheduler renews it. */
  watchExpiresAt?: string;
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

type Snapshot = {
  transactions: [string, EmailTransaction[]][];
  gmail: [string, GmailConnection][];
  aliases: [string, ForwardAlias][];
};

/**
 * Prototype store: in memory, optionally mirrored to a JSON file (EMAIL_STORE_FILE)
 * so forwarding aliases and Gmail links survive a redeploy. Refresh tokens stay
 * encrypted in the file. Swap for Postgres (Prisma) before production.
 */
class EmailStore {
  private transactions = new Map<string, EmailTransaction[]>();
  private gmail = new Map<string, GmailConnection>();
  private aliases = new Map<string, ForwardAlias>();
  private file = process.env.EMAIL_STORE_FILE;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (!this.file) return;
    try {
      const snap = JSON.parse(readFileSync(this.file, "utf8")) as Snapshot;
      this.transactions = new Map(snap.transactions);
      this.gmail = new Map(snap.gmail);
      this.aliases = new Map(snap.aliases);
    } catch {
      // first run: no file yet
    }
  }

  /** Debounced atomic write (temp file + rename) so a crash never leaves half a file. */
  private persist() {
    const file = this.file;
    if (!file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const snap: Snapshot = {
        transactions: [...this.transactions],
        gmail: [...this.gmail],
        aliases: [...this.aliases],
      };
      try {
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(`${file}.tmp`, JSON.stringify(snap), { mode: 0o600 });
        renameSync(`${file}.tmp`, file);
      } catch (e) {
        console.error("[email store] gagal menyimpan:", (e as Error).message);
      }
    }, 200);
  }

  listTransactions(userId: string): EmailTransaction[] {
    return [...(this.transactions.get(userId) ?? [])].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  hasMessage(userId: string, messageHash: string): boolean {
    return (this.transactions.get(userId) ?? []).some((t) => t.messageHash === messageHash);
  }

  addTransaction(tx: EmailTransaction) {
    this.persist();
    const list = this.transactions.get(tx.userId) ?? [];
    list.push(tx);
    this.transactions.set(tx.userId, list);
  }

  updateTransaction(userId: string, id: string, patch: Partial<Pick<EmailTransaction, "category" | "needsReview" | "countsTowardSpending">>) {
    const tx = (this.transactions.get(userId) ?? []).find((t) => t.id === id);
    if (tx) Object.assign(tx, patch);
    this.persist();
    return tx;
  }

  deleteTransactions(userId: string, channel?: EmailTransaction["channel"]) {
    this.persist();
    if (!channel) return void this.transactions.delete(userId);
    this.transactions.set(userId, (this.transactions.get(userId) ?? []).filter((t) => t.channel !== channel));
  }

  getGmail(userId: string) {
    return this.gmail.get(userId);
  }

  listGmail(): GmailConnection[] {
    return [...this.gmail.values()];
  }

  setGmail(conn: GmailConnection) {
    this.persist();
    this.gmail.set(conn.userId, conn);
  }

  deleteGmail(userId: string) {
    this.persist();
    this.gmail.delete(userId);
  }

  getAlias(alias: string) {
    return this.aliases.get(alias.toLowerCase());
  }

  getAliasForUser(userId: string) {
    return [...this.aliases.values()].find((a) => a.userId === userId);
  }

  setAlias(a: ForwardAlias) {
    this.persist();
    this.aliases.set(a.alias.toLowerCase(), a);
  }

  deleteAliasForUser(userId: string) {
    this.persist();
    const a = this.getAliasForUser(userId);
    if (a) this.aliases.delete(a.alias.toLowerCase());
  }
}

export const emailStore = new EmailStore();
