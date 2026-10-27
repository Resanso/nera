import { z } from "zod";

/**
 * The user's own money as Nera tracks it: "Bisa dipakai" (main), the pockets, and what moved
 * between them. Every change is an op applied here, on the server, so balances can never go
 * below zero and the total always equals main plus every pocket.
 *
 * Two kinds of pocket with one rule each:
 * - spending ("pos budget"): a monthly limit, no money of its own. What counts against it is
 *   read from email receipts or logged here; a logged spend leaves main.
 * - saving (goals, Rencana dadakan): money actually set aside, moved in and out of main.
 */

const ICONS = ["food", "transport", "education", "fun", "shopping", "health", "travel", "gadget", "gift", "home", "utility"] as const;
const TONES = ["yellow", "sand", "peach", "cream", "brown", "mint", "teal", "sky", "pink", "cyan"] as const;

export type PocketProfile = { occasion: string; dueDate: string; note?: string };

export type PocketRow = {
  id: string;
  name: string;
  kind: "spending" | "saving";
  icon: (typeof ICONS)[number];
  tone: (typeof TONES)[number];
  balance: number;
  /** spending: monthly budget; saving: goal */
  target: number;
  profile?: PocketProfile;
  /** the target a "terkumpul" reminder went out for */
  reachedTarget?: number;
  createdAt: string;
};

export type WalletState = {
  main: number;
  assetsSet: boolean;
  monthlyIncome: number | null;
  /** day of the month the income usually arrives (1-31); null when not set */
  incomeDay: number | null;
  /** when the user last entered or confirmed their total; email receipts after it lower Kantong Utama */
  anchorAt: string | null;
  pockets: PocketRow[];
};

export type ActivityRow = {
  id: string;
  pocketId: string;
  kind: "topup" | "spend" | "withdraw";
  amount: number;
  title?: string;
  at: string;
};

export class OpError extends Error {}

const money = z.number().int().min(0).max(10_000_000_000);
const incomeDay = z.number().int().min(1).max(31);
const pocketId = z.string().regex(/^[\w-]{1,80}$/);
const name = z.string().trim().min(1).max(40);
const profile = z.object({
  occasion: z.string().trim().min(1).max(80),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(200).optional(),
});

export const Op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("setAssets"), total: money }),
  /** incomeDay left out keeps the saved day */
  z.object({ op: z.literal("setIncome"), monthlyIncome: money.nullable(), incomeDay: incomeDay.nullable().optional() }),
  /** the balance Nera shows is right: it becomes the new anchor */
  z.object({ op: z.literal("confirmBalance") }),
  z.object({
    op: z.literal("createPocket"),
    id: pocketId,
    name,
    kind: z.enum(["spending", "saving"]),
    icon: z.enum(ICONS),
    tone: z.enum(TONES),
    target: money,
    initial: money.default(0),
  }),
  z.object({
    op: z.literal("createProfilePocket"),
    id: pocketId,
    name,
    icon: z.enum(ICONS),
    tone: z.enum(TONES),
    target: money,
    profile,
    from: z.array(z.object({ pocketId, amount: money })).max(10),
    fromMain: money,
  }),
  z.object({ op: z.literal("move"), pocketId, amount: money }),
  z.object({ op: z.literal("withdraw"), pocketId, amount: money }),
  z.object({ op: z.literal("spend"), pocketId, amount: money, title: z.string().trim().max(80) }),
  z.object({ op: z.literal("delete"), pocketId }),
  z.object({ op: z.literal("setTarget"), pocketId, target: money }),
]);
export type Op = z.infer<typeof Op>;

const newId = () => `pa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Applies one op. Returns the new state, the activity it produced and the pockets it removed. */
export function applyOp(s: WalletState, op: Op, now = new Date()): { state: WalletState; activity: ActivityRow[]; deleted: string[] } {
  const at = now.toISOString();
  const pockets = s.pockets.map((p) => ({ ...p }));
  const find = (id: string) => {
    const p = pockets.find((x) => x.id === id);
    if (!p) throw new OpError("Kantong tidak ditemukan");
    return p;
  };
  const act = (pocketId: string, kind: ActivityRow["kind"], amount: number, title?: string): ActivityRow => ({
    id: newId(),
    pocketId,
    kind,
    amount,
    ...(title && { title }),
    at,
  });
  const positive = (n: number) => {
    if (n <= 0) throw new OpError("Nominal harus lebih dari 0");
  };
  let main = s.main;
  const activity: ActivityRow[] = [];

  switch (op.op) {
    case "setAssets": {
      const inPockets = pockets.reduce((sum, p) => sum + p.balance, 0);
      if (op.total < inPockets) throw new OpError(`Total aset tidak boleh kurang dari isi kantong (Rp${inPockets.toLocaleString("id-ID")})`);
      // the total already reflects everything spent so far: receipts count from here on
      return { state: { ...s, pockets, main: op.total - inPockets, assetsSet: true, anchorAt: at }, activity, deleted: [] };
    }
    case "confirmBalance":
      return { state: { ...s, pockets, anchorAt: at }, activity, deleted: [] };
    case "setIncome":
      return {
        state: { ...s, pockets, monthlyIncome: op.monthlyIncome, incomeDay: op.incomeDay === undefined ? s.incomeDay : op.incomeDay },
        activity,
        deleted: [],
      };
    case "createPocket": {
      if (pockets.some((p) => p.id === op.id)) throw new OpError("Kantong sudah ada");
      // a budget holds no money; only a goal starts with some
      const amount = op.kind === "saving" ? Math.min(op.initial, main) : 0;
      pockets.push({ id: op.id, name: op.name, kind: op.kind, icon: op.icon, tone: op.tone, balance: amount, target: op.target, createdAt: at });
      main -= amount;
      if (amount > 0) activity.push(act(op.id, "topup", amount));
      break;
    }
    case "createProfilePocket": {
      if (pockets.some((p) => p.id === op.id)) throw new OpError("Kantong sudah ada");
      let balance = 0;
      for (const f of op.from) {
        const src = find(f.pocketId);
        // never more than a source holds, so a stale plan can't push a balance below zero
        const amount = Math.min(f.amount, src.balance);
        if (amount <= 0) continue;
        src.balance -= amount;
        balance += amount;
        activity.push(act(src.id, "withdraw", amount, `Ke kantong ${op.name}`));
      }
      const fromMain = Math.min(op.fromMain, main);
      main -= fromMain;
      balance += fromMain;
      pockets.push({ id: op.id, name: op.name, kind: "saving", icon: op.icon, tone: op.tone, balance, target: op.target, profile: op.profile, createdAt: at });
      if (balance > 0) activity.unshift(act(op.id, "topup", balance));
      break;
    }
    case "move": {
      positive(op.amount);
      if (op.amount > main) throw new OpError("Saldo yang bisa dipakai tidak cukup");
      const p = find(op.pocketId);
      if (p.kind === "spending") throw new OpError("Pos budget tidak menyimpan uang");
      p.balance += op.amount;
      main -= op.amount;
      activity.push(act(op.pocketId, "topup", op.amount));
      break;
    }
    case "withdraw": {
      positive(op.amount);
      const p = find(op.pocketId);
      if (p.kind === "spending") throw new OpError("Pos budget tidak menyimpan uang");
      if (op.amount > p.balance) throw new OpError("Saldo kantong tidak cukup");
      p.balance -= op.amount;
      main += op.amount;
      activity.push(act(p.id, "withdraw", op.amount));
      break;
    }
    case "spend": {
      positive(op.amount);
      const p = find(op.pocketId);
      if (p.kind === "spending") {
        // logged against the budget, paid from what's spendable
        if (op.amount > main) throw new OpError("Saldo yang bisa dipakai tidak cukup");
        main -= op.amount;
      } else {
        // a Rencana dadakan pays for its occasion from what was set aside
        if (!p.profile) throw new OpError("Tabungan tidak dipakai untuk belanja; tarik dulu ke saldo");
        if (op.amount > p.balance) throw new OpError("Saldo kantong tidak cukup");
        p.balance -= op.amount;
      }
      activity.push(act(p.id, "spend", op.amount, op.title || "Pengeluaran"));
      break;
    }
    case "delete": {
      const p = find(op.pocketId);
      main += p.balance;
      return { state: { ...s, main, pockets: pockets.filter((x) => x.id !== p.id) }, activity, deleted: [p.id] };
    }
    case "setTarget":
      find(op.pocketId).target = op.target;
      break;
  }
  return { state: { ...s, main, pockets }, activity, deleted: [] };
}

/** The first month day in WIB, as an ISO instant: "spent this month" counts from here. */
export function monthStartWib(now = new Date()) {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(now);
  return new Date(`${d}-01T00:00:00+07:00`).toISOString();
}

export const ImportInput = z.object({
  main: money,
  assetsSet: z.boolean(),
  monthlyIncome: money.nullable(),
  incomeDay: incomeDay.nullable().optional(),
  pockets: z
    .array(
      z.object({
        id: pocketId,
        name,
        kind: z.enum(["spending", "saving"]),
        icon: z.enum(ICONS),
        tone: z.enum(TONES),
        balance: money,
        target: money,
        profile: profile.optional(),
        createdAt: z.string().datetime(),
      }),
    )
    .max(60),
  activity: z
    .array(
      z.object({
        id: z.string().regex(/^[\w-]{1,80}$/),
        pocketId,
        kind: z.enum(["topup", "spend", "withdraw"]),
        amount: money,
        title: z.string().max(80).optional(),
        at: z.string().datetime(),
      }),
    )
    .max(2000),
});
export type ImportInput = z.infer<typeof ImportInput>;
