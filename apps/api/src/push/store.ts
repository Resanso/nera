import { Pool } from "pg";

/**
 * Web Push: the browsers a user turned reminders on in, and the little the server needs to
 * remind them about their Rencana dadakan pockets. Pockets themselves live on the device;
 * the device copies only these fields here, and only while reminders are on.
 */

export type PushSubscriptionRow = { userId: string; endpoint: string; keys: { p256dh: string; auth: string }; createdAt: string };

export type Reminder = {
  userId: string;
  pocketId: string;
  name: string;
  occasion: string;
  target: number;
  saved: number;
  /** YYYY-MM-DD (WIB) */
  dueDate: string;
  /** last time money went into the pocket, so a day already set aside isn't nagged about */
  lastTopupAt?: string;
  /** the "terkumpul" notice went out */
  reachedNotified: boolean;
};

export type PushPrefs = { userId: string; showAmounts: boolean; lastSentOn?: string };

export interface PushStore {
  addSubscription(s: PushSubscriptionRow): Promise<void>;
  removeSubscription(endpoint: string): Promise<void>;
  subscriptionsFor(userId: string): Promise<PushSubscriptionRow[]>;
  /** users with at least one subscription */
  subscribedUserIds(): Promise<string[]>;
  /** replaces the user's reminders; reachedNotified carries over for pockets that stay */
  setReminders(userId: string, reminders: Omit<Reminder, "userId" | "reachedNotified">[]): Promise<void>;
  remindersFor(userId: string): Promise<Reminder[]>;
  markReached(userId: string, pocketId: string): Promise<void>;
  getPrefs(userId: string): Promise<PushPrefs>;
  setPrefs(p: PushPrefs): Promise<void>;
  /** everything about the user: the last browser turned reminders off */
  deleteUser(userId: string): Promise<void>;
}

class MemoryPushStore implements PushStore {
  private subs = new Map<string, PushSubscriptionRow>();
  private reminders = new Map<string, Reminder[]>();
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
  async setReminders(userId: string, list: Omit<Reminder, "userId" | "reachedNotified">[]) {
    const before = this.reminders.get(userId) ?? [];
    this.reminders.set(
      userId,
      list.map((r) => ({ ...r, userId, reachedNotified: before.some((b) => b.pocketId === r.pocketId && b.reachedNotified) })),
    );
  }
  async remindersFor(userId: string) {
    return this.reminders.get(userId) ?? [];
  }
  async markReached(userId: string, pocketId: string) {
    for (const r of this.reminders.get(userId) ?? []) if (r.pocketId === pocketId) r.reachedNotified = true;
  }
  async getPrefs(userId: string) {
    return this.prefs.get(userId) ?? { userId, showAmounts: false };
  }
  async setPrefs(p: PushPrefs) {
    this.prefs.set(p.userId, p);
  }
  async deleteUser(userId: string) {
    for (const [k, s] of this.subs) if (s.userId === userId) this.subs.delete(k);
    this.reminders.delete(userId);
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
create table if not exists nera_reminders (
  user_id text not null,
  pocket_id text not null,
  name text not null,
  occasion text not null,
  target bigint not null,
  saved bigint not null,
  due_date date not null,
  last_topup_at timestamptz,
  reached_notified boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, pocket_id)
);
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
  async setReminders(userId: string, list: Omit<Reminder, "userId" | "reachedNotified">[]) {
    await this.ready;
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from nera_reminders where user_id = $1 and not (pocket_id = any($2))", [userId, list.map((r) => r.pocketId)]);
      for (const r of list) {
        await client.query(
          `insert into nera_reminders (user_id, pocket_id, name, occasion, target, saved, due_date, last_topup_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (user_id, pocket_id) do update set name = excluded.name, occasion = excluded.occasion,
             target = excluded.target, saved = excluded.saved, due_date = excluded.due_date,
             last_topup_at = excluded.last_topup_at, updated_at = now(),
             -- a raised target is a new goal to reach
             reached_notified = nera_reminders.reached_notified and excluded.target <= nera_reminders.target`,
          [userId, r.pocketId, r.name, r.occasion, r.target, r.saved, r.dueDate, r.lastTopupAt ?? null],
        );
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  }
  async remindersFor(userId: string) {
    const rows = await this.q<{
      pocket_id: string;
      name: string;
      occasion: string;
      target: string;
      saved: string;
      due_date: Date;
      last_topup_at: Date | null;
      reached_notified: boolean;
    }>("select * from nera_reminders where user_id = $1 order by due_date", [userId]);
    return rows.map((r) => ({
      userId,
      pocketId: r.pocket_id,
      name: r.name,
      occasion: r.occasion,
      target: Number(r.target),
      saved: Number(r.saved),
      // a date column comes back as local midnight; format it in local time, not UTC
      dueDate: `${r.due_date.getFullYear()}-${String(r.due_date.getMonth() + 1).padStart(2, "0")}-${String(r.due_date.getDate()).padStart(2, "0")}`,
      lastTopupAt: r.last_topup_at?.toISOString(),
      reachedNotified: r.reached_notified,
    }));
  }
  async markReached(userId: string, pocketId: string) {
    await this.q("update nera_reminders set reached_notified = true where user_id = $1 and pocket_id = $2", [userId, pocketId]);
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
    await this.q("delete from nera_reminders where user_id = $1", [userId]);
    await this.q("delete from nera_push_prefs where user_id = $1", [userId]);
  }
}

export const pushStore: PushStore = process.env.DATABASE_URL ? new PgPushStore(process.env.DATABASE_URL) : new MemoryPushStore();
