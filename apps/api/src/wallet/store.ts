import { Pool, type PoolClient } from "pg";
import type { ActivityRow, PocketRow, WalletState } from "./ops";

type Change = { state: WalletState; activity: ActivityRow[]; deleted: string[] };

export interface WalletStore {
  get(userId: string): Promise<WalletState | null>;
  /** Creates the wallet unless one exists; false when it already did. */
  create(userId: string, state: WalletState, activity: ActivityRow[]): Promise<boolean>;
  /** Runs `fn` on the current state and saves the result, one change per user at a time. */
  mutate(userId: string, fn: (s: WalletState) => Change): Promise<WalletState>;
  activitySince(userId: string, since: string): Promise<ActivityRow[]>;
  markReached(userId: string, pocketId: string, target: number): Promise<void>;
}

class MemoryWalletStore implements WalletStore {
  private wallets = new Map<string, WalletState>();
  private activity = new Map<string, ActivityRow[]>();
  async get(userId: string) {
    const s = this.wallets.get(userId);
    return s ? structuredClone(s) : null;
  }
  async create(userId: string, state: WalletState, activity: ActivityRow[]) {
    if (this.wallets.has(userId)) return false;
    this.wallets.set(userId, structuredClone(state));
    this.activity.set(userId, [...activity]);
    return true;
  }
  async mutate(userId: string, fn: (s: WalletState) => Change) {
    const cur = this.wallets.get(userId);
    if (!cur) throw new Error("Dompet belum dibuat");
    const r = fn(structuredClone(cur));
    this.wallets.set(userId, r.state);
    const kept = (this.activity.get(userId) ?? []).filter((a) => !r.deleted.includes(a.pocketId));
    this.activity.set(userId, [...kept, ...r.activity]);
    return structuredClone(r.state);
  }
  async activitySince(userId: string, since: string) {
    return (this.activity.get(userId) ?? []).filter((a) => a.at >= since).sort((a, b) => b.at.localeCompare(a.at));
  }
  async markReached(userId: string, pocketId: string, target: number) {
    const p = this.wallets.get(userId)?.pockets.find((x) => x.id === pocketId);
    if (p) p.reachedTarget = target;
  }
}

const SCHEMA = `
create table if not exists nera_wallets (
  user_id text primary key,
  main_balance bigint not null default 0,
  assets_set boolean not null default false,
  monthly_income bigint,
  updated_at timestamptz not null default now()
);
alter table nera_wallets add column if not exists balance_anchor_at timestamptz;
alter table nera_wallets add column if not exists income_day smallint;
create table if not exists nera_pockets (
  user_id text not null,
  id text not null,
  name text not null,
  kind text not null,
  icon text not null,
  tone text not null,
  balance bigint not null check (balance >= 0),
  target bigint not null,
  profile jsonb,
  reached_target bigint,
  created_at timestamptz not null,
  primary key (user_id, id)
);
create table if not exists nera_pocket_activity (
  user_id text not null,
  id text not null,
  pocket_id text not null,
  kind text not null,
  amount bigint not null,
  title text,
  at timestamptz not null,
  primary key (user_id, id)
);
create index if not exists nera_pocket_activity_user on nera_pocket_activity (user_id, at desc);
-- spending pockets became budgets without money of their own: what they held goes back to main.
-- Safe to run on every start: once moved, their balances are 0 and nothing changes. The lock
-- keeps the api and the worker from both moving the same money when they start together
-- (the statements run as one transaction; each takes a fresh snapshot after the lock).
select pg_advisory_xact_lock(4242001);
update nera_wallets w set main_balance = w.main_balance + s.held, updated_at = now()
  from (select user_id, sum(balance) as held from nera_pockets where kind = 'spending' and balance > 0 group by user_id) s
  where w.user_id = s.user_id;
update nera_pockets set balance = 0 where kind = 'spending' and balance > 0;
`;

type PocketDb = {
  id: string;
  name: string;
  kind: PocketRow["kind"];
  icon: PocketRow["icon"];
  tone: PocketRow["tone"];
  balance: string;
  target: string;
  profile: PocketRow["profile"] | null;
  reached_target: string | null;
  created_at: Date;
};

class PgWalletStore implements WalletStore {
  private pool: Pool;
  private ready: Promise<unknown>;

  constructor(url: string) {
    this.pool = new Pool({ connectionString: url, max: 3 });
    this.ready = this.pool.query(SCHEMA);
  }

  private async tx<T>(fn: (c: PoolClient) => Promise<T>) {
    await this.ready;
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      const r = await fn(c);
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }

  private async load(c: PoolClient | Pool, userId: string, lock: boolean): Promise<WalletState | null> {
    const w = await c.query<{ main_balance: string; assets_set: boolean; monthly_income: string | null; income_day: number | null; balance_anchor_at: Date | null }>(
      `select * from nera_wallets where user_id = $1${lock ? " for update" : ""}`,
      [userId],
    );
    if (!w.rows[0]) return null;
    const p = await c.query<PocketDb>("select * from nera_pockets where user_id = $1 order by created_at, id", [userId]);
    return {
      main: Number(w.rows[0].main_balance),
      assetsSet: w.rows[0].assets_set,
      monthlyIncome: w.rows[0].monthly_income === null ? null : Number(w.rows[0].monthly_income),
      incomeDay: w.rows[0].income_day,
      anchorAt: w.rows[0].balance_anchor_at?.toISOString() ?? null,
      pockets: p.rows.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        icon: r.icon,
        tone: r.tone,
        balance: Number(r.balance),
        target: Number(r.target),
        ...(r.profile && { profile: r.profile }),
        ...(r.reached_target !== null && { reachedTarget: Number(r.reached_target) }),
        createdAt: r.created_at.toISOString(),
      })),
    };
  }

  private async save(c: PoolClient, userId: string, s: WalletState, activity: ActivityRow[], deleted: string[]) {
    await c.query(
      `insert into nera_wallets (user_id, main_balance, assets_set, monthly_income, income_day, balance_anchor_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (user_id) do update set main_balance = excluded.main_balance, assets_set = excluded.assets_set,
         monthly_income = excluded.monthly_income, income_day = excluded.income_day, balance_anchor_at = excluded.balance_anchor_at, updated_at = now()`,
      [userId, s.main, s.assetsSet, s.monthlyIncome, s.incomeDay, s.anchorAt],
    );
    if (deleted.length) {
      await c.query("delete from nera_pockets where user_id = $1 and id = any($2)", [userId, deleted]);
      await c.query("delete from nera_pocket_activity where user_id = $1 and pocket_id = any($2)", [userId, deleted]);
    }
    for (const p of s.pockets) {
      await c.query(
        `insert into nera_pockets (user_id, id, name, kind, icon, tone, balance, target, profile, reached_target, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (user_id, id) do update set name = excluded.name, kind = excluded.kind, icon = excluded.icon,
           tone = excluded.tone, balance = excluded.balance, target = excluded.target, profile = excluded.profile,
           reached_target = excluded.reached_target`,
        [userId, p.id, p.name, p.kind, p.icon, p.tone, p.balance, p.target, p.profile ? JSON.stringify(p.profile) : null, p.reachedTarget ?? null, p.createdAt],
      );
    }
    for (const a of activity) {
      await c.query(
        `insert into nera_pocket_activity (user_id, id, pocket_id, kind, amount, title, at) values ($1, $2, $3, $4, $5, $6, $7)
         on conflict do nothing`,
        [userId, a.id, a.pocketId, a.kind, a.amount, a.title ?? null, a.at],
      );
    }
  }

  async get(userId: string) {
    await this.ready;
    return this.load(this.pool, userId, false);
  }

  async create(userId: string, state: WalletState, activity: ActivityRow[]) {
    return this.tx(async (c) => {
      const ins = await c.query("insert into nera_wallets (user_id) values ($1) on conflict do nothing", [userId]);
      if (!ins.rowCount) return false;
      await this.save(c, userId, state, activity, []);
      return true;
    });
  }

  async mutate(userId: string, fn: (s: WalletState) => Change) {
    return this.tx(async (c) => {
      const cur = await this.load(c, userId, true);
      if (!cur) throw new Error("Dompet belum dibuat");
      const r = fn(cur);
      await this.save(c, userId, r.state, r.activity, r.deleted);
      return r.state;
    });
  }

  async activitySince(userId: string, since: string) {
    await this.ready;
    const rows = await this.pool.query<{ id: string; pocket_id: string; kind: ActivityRow["kind"]; amount: string; title: string | null; at: Date }>(
      "select * from nera_pocket_activity where user_id = $1 and at >= $2 order by at desc, id desc",
      [userId, since],
    );
    return rows.rows.map((r) => ({
      id: r.id,
      pocketId: r.pocket_id,
      kind: r.kind,
      amount: Number(r.amount),
      ...(r.title && { title: r.title }),
      at: r.at.toISOString(),
    }));
  }

  async markReached(userId: string, pocketId: string, target: number) {
    await this.ready;
    await this.pool.query("update nera_pockets set reached_target = $3 where user_id = $1 and id = $2", [userId, pocketId, target]);
  }
}

export const walletStore: WalletStore = process.env.DATABASE_URL ? new PgWalletStore(process.env.DATABASE_URL) : new MemoryWalletStore();
