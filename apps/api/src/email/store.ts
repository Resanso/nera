import { Pool } from "pg";
import type { EmailTransaction } from "./types";

export type GmailConnection = {
  userId: string;
  /** AES-256-GCM encrypted refresh token (see crypto.ts). Never returned to the client. */
  refreshTokenEnc: string;
  googleEmail?: string;
  connectedAt: string;
  lastSyncAt?: string;
  /** Pub/Sub push watch; Gmail expires it after 7 days, the scheduler renews it. */
  watchExpiresAt?: string;
  /** "Ambil riwayat lebih lama": requested by the user, run by the worker. */
  backfill?: GmailBackfill;
};

export type GmailBackfill = {
  days: number;
  status: "pending" | "running" | "done" | "error";
  /** emails examined / transactions imported so far */
  scanned: number;
  imported: number;
  updatedAt: string;
  error?: string;
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

export type NeraUser = { id: string; email: string; createdAt: string; lastSeenAt: string };

export type ConsentKind = "email_import" | "ai_processing";
/** Latest decision per kind; every grant/revoke is kept as an event for audit. */
export type ConsentState = { granted: boolean; version: string; at: string };

export type TransactionPatch = Partial<Pick<EmailTransaction, "category" | "needsReview" | "countsTowardSpending" | "duplicateOf">>;

export interface EmailStore {
  touchUser(id: string, email: string): Promise<void>;
  recordConsent(userId: string, kind: ConsentKind, granted: boolean, version: string): Promise<void>;
  getConsents(userId: string): Promise<Partial<Record<ConsentKind, ConsentState>>>;
  listUsers(): Promise<NeraUser[]>;
  /** Every user with a Gmail link, alias or imported transaction (including ones not in listUsers). */
  listUserIdsWithData(): Promise<string[]>;

  listTransactions(userId: string): Promise<EmailTransaction[]>;
  hasMessage(userId: string, messageHash: string): Promise<boolean>;
  /** false when (user, messageHash) already exists, e.g. two syncs racing on the same email */
  addTransaction(tx: EmailTransaction): Promise<boolean>;
  updateTransaction(userId: string, id: string, patch: TransactionPatch): Promise<EmailTransaction | undefined>;
  deleteTransactions(userId: string, channel?: EmailTransaction["channel"]): Promise<void>;

  getGmail(userId: string): Promise<GmailConnection | undefined>;
  listGmail(): Promise<GmailConnection[]>;
  /** Upserts the link; never touches `backfill` (see setBackfill). */
  setGmail(conn: GmailConnection): Promise<void>;
  /** Only the backfill column, so progress updates and syncs can't overwrite each other. */
  setBackfill(userId: string, backfill: GmailBackfill | undefined): Promise<void>;
  /** Also forgets which Gmail messages were processed. */
  deleteGmail(userId: string): Promise<void>;
  /** Gmail message ids already processed, so a re-sync skips them without downloading. */
  seenGmailIds(userId: string): Promise<Set<string>>;
  markGmailSeen(userId: string, gmailId: string): Promise<void>;
  clearGmailSeen(userId: string): Promise<void>;

  getAlias(alias: string): Promise<ForwardAlias | undefined>;
  getAliasForUser(userId: string): Promise<ForwardAlias | undefined>;
  setAlias(a: ForwardAlias): Promise<void>;
  deleteAliasForUser(userId: string): Promise<void>;
}

/** Local development and tests: nothing survives a restart. */
class MemoryStore implements EmailStore {
  private users = new Map<string, NeraUser>();
  private consents = new Map<string, Partial<Record<ConsentKind, ConsentState>>>();
  private transactions = new Map<string, EmailTransaction[]>();
  private gmail = new Map<string, GmailConnection>();
  private seen = new Map<string, Set<string>>();
  private aliases = new Map<string, ForwardAlias>();

  async touchUser(id: string, email: string) {
    const now = new Date().toISOString();
    const u = this.users.get(id);
    this.users.set(id, { id, email, createdAt: u?.createdAt ?? now, lastSeenAt: now });
  }
  async listUsers() {
    return [...this.users.values()];
  }
  async recordConsent(userId: string, kind: ConsentKind, granted: boolean, version: string) {
    this.consents.set(userId, { ...this.consents.get(userId), [kind]: { granted, version, at: new Date().toISOString() } });
  }
  async getConsents(userId: string) {
    return { ...this.consents.get(userId) };
  }
  async listUserIdsWithData() {
    return [...new Set([...this.transactions.keys(), ...this.gmail.keys(), ...[...this.aliases.values()].map((a) => a.userId)])];
  }

  async listTransactions(userId: string) {
    return [...(this.transactions.get(userId) ?? [])].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
  async hasMessage(userId: string, messageHash: string) {
    return (this.transactions.get(userId) ?? []).some((t) => t.messageHash === messageHash);
  }
  async addTransaction(tx: EmailTransaction) {
    if (await this.hasMessage(tx.userId, tx.messageHash)) return false;
    this.transactions.set(tx.userId, [...(this.transactions.get(tx.userId) ?? []), tx]);
    return true;
  }
  async updateTransaction(userId: string, id: string, patch: TransactionPatch) {
    const tx = (this.transactions.get(userId) ?? []).find((t) => t.id === id);
    if (tx) Object.assign(tx, patch);
    return tx;
  }
  async deleteTransactions(userId: string, channel?: EmailTransaction["channel"]) {
    if (!channel) return void this.transactions.delete(userId);
    this.transactions.set(userId, (this.transactions.get(userId) ?? []).filter((t) => t.channel !== channel));
  }

  async getGmail(userId: string) {
    return this.gmail.get(userId);
  }
  async listGmail() {
    return [...this.gmail.values()];
  }
  async setGmail(conn: GmailConnection) {
    this.gmail.set(conn.userId, { ...conn, backfill: this.gmail.get(conn.userId)?.backfill });
  }
  async setBackfill(userId: string, backfill: GmailBackfill | undefined) {
    const c = this.gmail.get(userId);
    if (c) this.gmail.set(userId, { ...c, backfill });
  }
  async deleteGmail(userId: string) {
    this.gmail.delete(userId);
    this.seen.delete(userId);
  }
  async seenGmailIds(userId: string) {
    return new Set(this.seen.get(userId));
  }
  async markGmailSeen(userId: string, gmailId: string) {
    this.seen.set(userId, (this.seen.get(userId) ?? new Set()).add(gmailId));
  }
  async clearGmailSeen(userId: string) {
    this.seen.delete(userId);
  }

  async getAlias(alias: string) {
    return this.aliases.get(alias.toLowerCase());
  }
  async getAliasForUser(userId: string) {
    return [...this.aliases.values()].find((a) => a.userId === userId);
  }
  async setAlias(a: ForwardAlias) {
    this.aliases.set(a.alias.toLowerCase(), a);
  }
  async deleteAliasForUser(userId: string) {
    const a = await this.getAliasForUser(userId);
    if (a) this.aliases.delete(a.alias.toLowerCase());
  }
}

const SCHEMA = `
create table if not exists nera_users (
  id text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create table if not exists nera_gmail_links (
  user_id text primary key,
  google_email text,
  refresh_token_enc text not null,
  connected_at timestamptz not null,
  last_sync_at timestamptz,
  watch_expires_at timestamptz
);
create table if not exists nera_gmail_seen (
  user_id text not null,
  gmail_id text not null,
  primary key (user_id, gmail_id)
);
create table if not exists nera_aliases (
  alias text primary key,
  user_id text not null unique,
  status text not null,
  confirmation_code text,
  created_at timestamptz not null,
  last_received_at timestamptz
);
create table if not exists nera_email_transactions (
  id text primary key,
  user_id text not null,
  message_hash text not null,
  occurred_at timestamptz not null,
  data jsonb not null,
  unique (user_id, message_hash)
);
create index if not exists nera_email_transactions_user on nera_email_transactions (user_id, occurred_at desc);
alter table nera_gmail_links add column if not exists backfill jsonb;
create table if not exists nera_consent_events (
  id bigserial primary key,
  user_id text not null,
  kind text not null,
  granted boolean not null,
  version text not null,
  at timestamptz not null default now()
);
create index if not exists nera_consent_events_user on nera_consent_events (user_id, kind, at desc);
`;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);

/**
 * Postgres: shared by every process (blue/green web+api, the mail/scheduler worker),
 * so deploys can run two versions side by side. Tables are created on first use.
 */
class PgStore implements EmailStore {
  private pool: Pool;
  private ready: Promise<unknown>;

  constructor(url: string) {
    this.pool = new Pool({ connectionString: url, max: 5 });
    this.ready = this.pool.query(SCHEMA);
  }

  private async q<R extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    await this.ready;
    return (await this.pool.query<R>(sql, params)).rows;
  }

  async touchUser(id: string, email: string) {
    await this.q(
      `insert into nera_users (id, email) values ($1, $2)
       on conflict (id) do update set email = excluded.email, last_seen_at = now()`,
      [id, email],
    );
  }
  async recordConsent(userId: string, kind: ConsentKind, granted: boolean, version: string) {
    await this.q("insert into nera_consent_events (user_id, kind, granted, version) values ($1, $2, $3, $4)", [userId, kind, granted, version]);
  }
  async getConsents(userId: string) {
    const rows = await this.q<{ kind: ConsentKind; granted: boolean; version: string; at: Date }>(
      `select distinct on (kind) kind, granted, version, at from nera_consent_events
       where user_id = $1 order by kind, at desc, id desc`,
      [userId],
    );
    return Object.fromEntries(rows.map((r) => [r.kind, { granted: r.granted, version: r.version, at: iso(r.at)! }])) as Partial<
      Record<ConsentKind, ConsentState>
    >;
  }

  async listUsers() {
    const rows = await this.q<{ id: string; email: string; created_at: Date; last_seen_at: Date }>(
      "select * from nera_users order by last_seen_at desc",
    );
    return rows.map((r) => ({ id: r.id, email: r.email, createdAt: iso(r.created_at)!, lastSeenAt: iso(r.last_seen_at)! }));
  }

  async listUserIdsWithData() {
    const rows = await this.q<{ user_id: string }>(
      `select user_id from nera_email_transactions union select user_id from nera_gmail_links
       union select user_id from nera_aliases`,
    );
    return rows.map((r) => r.user_id);
  }

  async listTransactions(userId: string) {
    const rows = await this.q<{ data: EmailTransaction }>(
      "select data from nera_email_transactions where user_id = $1 order by occurred_at desc",
      [userId],
    );
    return rows.map((r) => r.data);
  }
  async hasMessage(userId: string, messageHash: string) {
    const rows = await this.q("select 1 from nera_email_transactions where user_id = $1 and message_hash = $2", [userId, messageHash]);
    return rows.length > 0;
  }
  async addTransaction(tx: EmailTransaction) {
    const rows = await this.q(
      `insert into nera_email_transactions (id, user_id, message_hash, occurred_at, data)
       values ($1, $2, $3, $4, $5) on conflict (user_id, message_hash) do nothing returning id`,
      [tx.id, tx.userId, tx.messageHash, tx.occurredAt, tx],
    );
    return rows.length > 0;
  }
  async updateTransaction(userId: string, id: string, patch: TransactionPatch) {
    const rows = await this.q<{ data: EmailTransaction }>(
      "update nera_email_transactions set data = data || $3::jsonb where user_id = $1 and id = $2 returning data",
      [userId, id, JSON.stringify(patch)],
    );
    return rows[0]?.data;
  }
  async deleteTransactions(userId: string, channel?: EmailTransaction["channel"]) {
    if (channel) await this.q("delete from nera_email_transactions where user_id = $1 and data->>'channel' = $2", [userId, channel]);
    else await this.q("delete from nera_email_transactions where user_id = $1", [userId]);
  }

  private toGmail(r: {
    user_id: string;
    google_email: string | null;
    refresh_token_enc: string;
    connected_at: Date;
    last_sync_at: Date | null;
    watch_expires_at: Date | null;
    backfill: GmailBackfill | null;
  }): GmailConnection {
    return {
      userId: r.user_id,
      googleEmail: r.google_email ?? undefined,
      refreshTokenEnc: r.refresh_token_enc,
      connectedAt: iso(r.connected_at)!,
      lastSyncAt: iso(r.last_sync_at),
      watchExpiresAt: iso(r.watch_expires_at),
      backfill: r.backfill ?? undefined,
    };
  }
  async getGmail(userId: string) {
    const rows = await this.q<Parameters<PgStore["toGmail"]>[0]>("select * from nera_gmail_links where user_id = $1", [userId]);
    return rows[0] && this.toGmail(rows[0]);
  }
  async listGmail() {
    const rows = await this.q<Parameters<PgStore["toGmail"]>[0]>("select * from nera_gmail_links");
    return rows.map((r) => this.toGmail(r));
  }
  async setGmail(c: GmailConnection) {
    await this.q(
      `insert into nera_gmail_links (user_id, google_email, refresh_token_enc, connected_at, last_sync_at, watch_expires_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id) do update set google_email = excluded.google_email, refresh_token_enc = excluded.refresh_token_enc,
         connected_at = excluded.connected_at, last_sync_at = excluded.last_sync_at, watch_expires_at = excluded.watch_expires_at`,
      [c.userId, c.googleEmail ?? null, c.refreshTokenEnc, c.connectedAt, c.lastSyncAt ?? null, c.watchExpiresAt ?? null],
    );
  }
  async setBackfill(userId: string, backfill: GmailBackfill | undefined) {
    await this.q("update nera_gmail_links set backfill = $2 where user_id = $1", [userId, backfill ? JSON.stringify(backfill) : null]);
  }
  async deleteGmail(userId: string) {
    await this.q("delete from nera_gmail_links where user_id = $1", [userId]);
    await this.clearGmailSeen(userId);
  }
  async seenGmailIds(userId: string) {
    const rows = await this.q<{ gmail_id: string }>("select gmail_id from nera_gmail_seen where user_id = $1", [userId]);
    return new Set(rows.map((r) => r.gmail_id));
  }
  async markGmailSeen(userId: string, gmailId: string) {
    await this.q("insert into nera_gmail_seen (user_id, gmail_id) values ($1, $2) on conflict do nothing", [userId, gmailId]);
  }
  async clearGmailSeen(userId: string) {
    await this.q("delete from nera_gmail_seen where user_id = $1", [userId]);
  }

  private toAlias(r: {
    alias: string;
    user_id: string;
    status: ForwardAlias["status"];
    confirmation_code: string | null;
    created_at: Date;
    last_received_at: Date | null;
  }): ForwardAlias {
    return {
      alias: r.alias,
      userId: r.user_id,
      status: r.status,
      confirmationCode: r.confirmation_code ?? undefined,
      createdAt: iso(r.created_at)!,
      lastReceivedAt: iso(r.last_received_at),
    };
  }
  async getAlias(alias: string) {
    const rows = await this.q<Parameters<PgStore["toAlias"]>[0]>("select * from nera_aliases where alias = $1", [alias.toLowerCase()]);
    return rows[0] && this.toAlias(rows[0]);
  }
  async getAliasForUser(userId: string) {
    const rows = await this.q<Parameters<PgStore["toAlias"]>[0]>("select * from nera_aliases where user_id = $1", [userId]);
    return rows[0] && this.toAlias(rows[0]);
  }
  async setAlias(a: ForwardAlias) {
    await this.q(
      `insert into nera_aliases (alias, user_id, status, confirmation_code, created_at, last_received_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (alias) do update set status = excluded.status, confirmation_code = excluded.confirmation_code,
         last_received_at = excluded.last_received_at`,
      [a.alias.toLowerCase(), a.userId, a.status, a.confirmationCode ?? null, a.createdAt, a.lastReceivedAt ?? null],
    );
  }
  async deleteAliasForUser(userId: string) {
    await this.q("delete from nera_aliases where user_id = $1", [userId]);
  }
}

export const emailStore: EmailStore = process.env.DATABASE_URL ? new PgStore(process.env.DATABASE_URL) : new MemoryStore();
