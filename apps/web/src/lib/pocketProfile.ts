import type { BudgetPocket, BudgetPocketIcon, BudgetPocketTone } from "@nera/core";

/** What Nera understood from the chat: the occasion, how much and by when. */
export type ProfileDraft = {
  occasion: string;
  /** pocket name, short enough for a card ("AYCE Sabtu") */
  name: string;
  amount: number;
  /** YYYY-MM-DD */
  dueDate: string;
  icon: BudgetPocketIcon;
};

export type ProfileSource = { pocket: BudgetPocket; amount: number };

export type ProfilePlan = {
  draft: ProfileDraft;
  tone: BudgetPocketTone;
  /** whole days left before the due date; 0 when it is today */
  daysLeft: number;
  /** moved in right away from related spending pockets */
  fromPockets: ProfileSource[];
  /** moved in right away from Kantong Utama (only when there are no days to spread it over) */
  fromMainNow: number;
  /** to set aside from Kantong Utama every day until the due date */
  perDay: number;
  /** the daily spending allowance perDay is compared with */
  dailyAllowance: number;
  /** what the plan cannot cover from the money there is */
  shortfall: number;
  verdict: "ringan" | "pas" | "berat";
};

const TONE_FOR: Partial<Record<BudgetPocketIcon, BudgetPocketTone>> = {
  food: "peach",
  fun: "pink",
  gift: "yellow",
  travel: "mint",
  shopping: "sand",
  education: "cream",
  transport: "sky",
};

const roundUp = (n: number, step = 1000) => Math.ceil(n / step) * step;
const roundDown = (n: number, step = 1000) => Math.floor(n / step) * step;

/** Today in WIB as YYYY-MM-DD; the due date is a calendar day in Indonesia. */
export const todayWib = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);

const dayDiff = (dueDate: string, now: Date) => Math.round((Date.parse(dueDate) - Date.parse(todayWib(now))) / 86_400_000);

export const daysUntil = (dueDate: string, now = new Date()) => Math.max(0, dayDiff(dueDate, now));

/**
 * How to have the money by the due date. Nera's model only reads the request; the sums are
 * done here so they always add up. Part comes now from pockets that would have paid for a
 * similar outing (half of Fun, a quarter of a pocket of the same kind), the rest is spread
 * over the days left as a daily set-aside from Kantong Utama.
 */
export function planProfile(
  draft: ProfileDraft,
  money: { main: number; pockets: BudgetPocket[]; dailyBudgetSafe: number; monthlyAllowance: number; balancesKnown: boolean },
  now = new Date(),
): ProfilePlan {
  const daysLeft = daysUntil(draft.dueDate, now);
  let rest = draft.amount;

  const fromPockets: ProfileSource[] = [];
  if (money.balancesKnown) {
    const related = money.pockets
      .filter((p) => p.kind === "spending" && !p.profile && p.balance > 0)
      .filter((p) => p.icon === "fun" || p.icon === draft.icon)
      .sort((a, b) => (a.icon === "fun" ? -1 : 0) - (b.icon === "fun" ? -1 : 0));
    for (const p of related) {
      if (rest <= 0) break;
      const amount = Math.min(rest, roundDown(p.balance * (p.icon === "fun" ? 0.5 : 0.25)));
      if (amount <= 0) continue;
      fromPockets.push({ pocket: p, amount });
      rest -= amount;
    }
  }

  const main = money.balancesKnown ? money.main : Infinity;
  let fromMainNow = 0;
  let perDay = 0;
  if (daysLeft === 0) fromMainNow = Math.min(rest, main);
  else perDay = roundUp(rest / daysLeft);
  const covered = fromMainNow + Math.min(perDay * daysLeft, main);
  const shortfall = Math.max(0, rest - covered);

  const dailyAllowance = money.dailyBudgetSafe > 0 ? money.dailyBudgetSafe : Math.round(money.monthlyAllowance / 30);
  // without an income or a balance there is nothing to weigh it against
  const share = dailyAllowance > 0 ? (daysLeft === 0 ? fromMainNow / (dailyAllowance * 7) : perDay / dailyAllowance) : 0.3;
  const verdict = shortfall > 0 || share > 0.4 ? "berat" : share > 0.2 ? "pas" : "ringan";

  return { draft, tone: TONE_FOR[draft.icon] ?? "pink", daysLeft, fromPockets, fromMainNow, perDay, dailyAllowance, shortfall, verdict };
}

/** What is still to set aside per day for a profile pocket, from where it stands now. */
export function perDayNow(pocket: BudgetPocket, now = new Date()) {
  if (!pocket.profile) return 0;
  const left = Math.max(0, pocket.targetAmount - pocket.balance);
  const days = daysUntil(pocket.profile.dueDate, now);
  return left === 0 ? 0 : days === 0 ? left : roundUp(left / days);
}

export const dueLabel = (dueDate: string, now = new Date()) => {
  const days = dayDiff(dueDate, now);
  const date = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${dueDate}T00:00:00Z`),
  );
  return { date, days, relative: days < 0 ? "sudah lewat" : days === 0 ? "hari ini" : days === 1 ? "besok" : `${days} hari lagi` };
};
