import { Pool } from "pg";

/** Web Push: the browsers a user turned reminders on in, and how they want them. */

export type PushSubscriptionRow = { userId: string; endpoint: string; keys: { p256dh: string; auth: string }; createdAt: string };

export type PushPrefs = { userId: string; showAmounts: boolean; lastSentOn?: string };

export interface PushStore {
  addSubscription(s: PushSubscriptionRow): Promise<void>;
  removeSubscription(endpoint: string): Promise<void>;
  subscriptionsFor(userId: string): Promise<PushSubscriptionRow[]>;
  /** users with at least one subscription */
  subscribedUserIds(): Promise<string[]>;
  getPrefs(userId: string): Promise<PushPrefs>;
  setPrefs(p: PushPrefs): Promise<void>;
  /** everything about the user: the last browser turned reminders off */
  deleteUser(userId: string): Promise<void>;
}

class MemoryPushStore implements PushStore {
  private subs = new Map<string, PushSubscriptionRow>();
  private prefs = new Map<string, PushPrefs>();

  async addSubscription(s: PushSubscriptionRow) {
    this.subs.set(s.endpoint, s);
  }
  async removeSubscription(endpoint: string) {
    this.subs.delete(endpoint);
  }
  async subscriptionsFor(userId: string) {
    return [...this.subs.values()].filter((s) => s.userId === userId);
  }
  async subscribedUserIds() {
    return [...new Set([...this.subs.values()].map((s) => s.userId))];
  }
  async getPrefs(userId: string) {
    return this.prefs.get(userId) ?? { userId, showAmounts: false };
  }
  async setPrefs(p: PushPrefs) {
    this.prefs.set(p.userId, p);
  }
  async deleteUser(userId: string) {
    for (const [k, s] of this.subs) if (s.userId === userId) this.subs.delete(k);
    this.prefs.delete(userId);
  }
}

const SCHEMA = `
create table if not exists nera_push_subscriptions (
  endpoint text primary key,
  user_id text not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists nera_push_subscriptions_user on nera_push_subscriptions (user_id);
-- reminders read the pockets themselves now (nera_pockets)
drop table if exists nera_reminders;
create table if not exists nera_push_prefs (
  user_id text primary key,
  show_amounts boolean not null default false,
  last_sent_on date
);
`;

const day = (d: Date | string | null) => (d ? (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10)) : undefined);

class PgPushStore implements PushStore {
  private pool: Pool;
  private ready: Promise<unknown>;

  constructor(url: string) {
    this.pool = new Pool({ connectionString: url, max: 3 });
    this.ready = this.pool.query(SCHEMA);
  }

  private async q<R extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    await this.ready;
    return (await this.pool.query<R>(sql, params)).rows;
  }

  async addSubscription(s: PushSubscriptionRow) {
    await this.q(
      `insert into nera_push_subscriptions (endpoint, user_id, keys) values ($1, $2, $3)
       on conflict (endpoint) do update set user_id = excluded.user_id, keys = excluded.keys`,
      [s.endpoint, s.userId, JSON.stringify(s.keys)],
    );
  }
  async removeSubscription(endpoint: string) {
    await this.q("delete from nera_push_subscriptions where endpoint = $1", [endpoint]);
  }
  async subscriptionsFor(userId: string) {
    const rows = await this.q<{ endpoint: string; user_id: string; keys: PushSubscriptionRow["keys"]; created_at: Date }>(
      "select * from nera_push_subscriptions where user_id = $1",
      [userId],
    );
    return rows.map((r) => ({ endpoint: r.endpoint, userId: r.user_id, keys: r.keys, createdAt: r.created_at.toISOString() }));
  }
  async subscribedUserIds() {
    return (await this.q<{ user_id: string }>("select distinct user_id from nera_push_subscriptions")).map((r) => r.user_id);
  }
  async getPrefs(userId: string) {
    const rows = await this.q<{ show_amounts: boolean; last_sent_on: string | null }>(
      "select show_amounts, to_char(last_sent_on, 'YYYY-MM-DD') as last_sent_on from nera_push_prefs where user_id = $1",
      [userId],
    );
    return { userId, showAmounts: rows[0]?.show_amounts ?? false, lastSentOn: day(rows[0]?.last_sent_on ?? null) };
  }
  async setPrefs(p: PushPrefs) {
    await this.q(
      `insert into nera_push_prefs (user_id, show_amounts, last_sent_on) values ($1, $2, $3)
       on conflict (user_id) do update set show_amounts = excluded.show_amounts, last_sent_on = excluded.last_sent_on`,
      [p.userId, p.showAmounts, p.lastSentOn ?? null],
    );
  }
  async deleteUser(userId: string) {
    await this.q("delete from nera_push_subscriptions where user_id = $1", [userId]);
    await this.q("delete from nera_push_prefs where user_id = $1", [userId]);
  }
}

export const pushStore: PushStore = process.env.DATABASE_URL ? new PgPushStore(process.env.DATABASE_URL) : new MemoryPushStore();
