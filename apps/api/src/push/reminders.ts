import webpush from "web-push";
import { pushStore } from "./store";
import { walletStore } from "../wallet/store";

/** A Rencana dadakan pocket as the reminders see it. */
export type Reminder = {
  pocketId: string;
  name: string;
  occasion: string;
  target: number;
  saved: number;
  /** YYYY-MM-DD (WIB) */
  dueDate: string;
  toppedUpToday: boolean;
  reachedNotified: boolean;
};

/**
 * Reminders for Rencana dadakan pockets, sent by Web Push from the worker:
 * - "terkumpul" once, as soon as a pocket reaches its target (07:00–21:00 WIB);
 * - otherwise one evening nudge (from 19:00 WIB) for the most urgent pocket that is still
 *   short and wasn't topped up today; on the day itself already from 07:00, before the outing.
 * At most one notification per user per day, nothing between 21:00 and 07:00.
 */

export type PushPayload = { title: string; body: string; url: string; tag: string };

let configured: boolean | null = null;
export function isPushConfigured() {
  if (configured === null) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    configured = Boolean(pub && priv);
    if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:nera@mentio.space", pub!, priv!);
  }
  return configured;
}

/** Sends to every browser of the user; endpoints the push service says are gone are dropped. */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!isPushConfigured()) return 0;
  let sent = 0;
  for (const s of await pushStore.subscriptionsFor(userId)) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 6 * 60 * 60 });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await pushStore.removeSubscription(s.endpoint);
      else console.error(`[push] ${userId}: ${status ?? (e as Error).message}`);
    }
  }
  return sent;
}

const wib = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
};

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const roundUp = (n: number) => Math.ceil(n / 1000) * 1000;

/** What one evening nudge says about a pocket. Amounts only when the user allowed them on the lock screen. */
export function nudgeFor(r: Reminder, today: string, showAmounts: boolean): Pick<PushPayload, "title" | "body"> {
  const left = Math.max(0, r.target - r.saved);
  const days = daysBetween(today, r.dueDate);
  const perDay = days <= 0 ? left : roundUp(left / days);
  const amount = showAmounts ? ` ${rp(perDay)}` : "";
  if (days <= 0) return { title: `Hari ini: ${r.name}`, body: showAmounts ? `Kantongnya masih kurang ${rp(left)}.` : "Kantongnya belum penuh. Cek sebelum berangkat." };
  if (days === 1) return { title: `Besok: ${r.name}`, body: `Sisihkan${amount} malam ini supaya pas.` };
  return { title: r.name, body: `Sisihkan${amount} hari ini. ${days} hari lagi menuju ${r.occasion}.` };
}

/** One pass over every subscribed user. Exported for the test endpoint and scripts. */
export async function runReminders(now = new Date()) {
  if (!isPushConfigured()) return;
  const { date: today, hour } = wib(now);
  if (hour < 7 || hour >= 21) return;

  for (const userId of await pushStore.subscribedUserIds()) {
    const prefs = await pushStore.getPrefs(userId);
    if (prefs.lastSentOn === today) continue;
    const wallet = await walletStore.get(userId);
    if (!wallet) continue;
    const topups = await walletStore.activitySince(userId, new Date(`${today}T00:00:00+07:00`).toISOString());
    const reminders: Reminder[] = wallet.pockets
      .filter((p) => p.profile && daysBetween(today, p.profile.dueDate) >= 0)
      .map((p) => ({
        pocketId: p.id,
        name: p.name,
        occasion: p.profile!.occasion,
        target: p.target,
        saved: p.balance,
        dueDate: p.profile!.dueDate,
        toppedUpToday: topups.some((a) => a.pocketId === p.id && a.kind === "topup"),
        reachedNotified: p.reachedTarget !== undefined && p.reachedTarget >= p.target,
      }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const reached = reminders.find((r) => r.saved >= r.target && !r.reachedNotified);
    let payload: PushPayload | null = null;
    if (reached) {
      payload = { title: `${reached.name} sudah terkumpul`, body: `Uang untuk ${reached.occasion} siap dipakai. Mantap!`, url: "/pockets", tag: `reached-${reached.pocketId}` };
    } else {
      const due = (r: Reminder) => hour >= 19 || r.dueDate === today;
      const short = reminders.filter((r) => r.saved < r.target && !r.toppedUpToday && due(r));
      if (short.length) {
        const r = short[0]; // the most urgent first
        const n = nudgeFor(r, today, prefs.showAmounts);
        payload = { ...n, body: short.length > 1 ? `${n.body} (+${short.length - 1} rencana lain)` : n.body, url: "/pockets", tag: "nudge" };
      }
    }
    if (!payload) continue;

    const sent = await sendToUser(userId, payload);
    if (sent > 0) {
      if (reached) await walletStore.markReached(userId, reached.pocketId, reached.target);
      await pushStore.setPrefs({ ...prefs, lastSentOn: today });
    }
  }
}

/** Every 10 minutes in the worker (exactly one instance, so nobody gets a reminder twice). */
export function startReminderScheduler() {
  if (!isPushConfigured()) return;
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    runReminders()
      .catch((e) => console.error(`[push] reminders: ${(e as Error).message}`))
      .finally(() => (running = false));
  };
  setInterval(tick, 10 * 60 * 1000).unref();
  setTimeout(tick, 30_000).unref();
  console.log("[NERA] Reminders every 10 min");
}
