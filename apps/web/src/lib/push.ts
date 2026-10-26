"use client";

import { useEffect, useState } from "react";
import type { BudgetPocket } from "@nera/core";
import type { PocketActivity } from "../context/FinancialStore";
import { call } from "./emailImport";

/**
 * Reminders for Rencana dadakan pockets by Web Push. Works in Chrome/Edge/Firefox on Android
 * and desktop; on iPhone only once Nera is added to the Home Screen (iOS 16.4+).
 */

export type PushState =
  | "unsupported" // this browser can't receive push
  | "install" // iPhone/iPad in a Safari tab: add to Home Screen first
  | "denied" // the user blocked notifications for this site
  | "off"
  | "on";

type PushConfig = { enabled: boolean; publicKey: string | null; subscribed: boolean; showAmounts: boolean };

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const keyBytes = (base64url: string) => {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const registration = () => navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);

async function currentSubscription() {
  if (!supported()) return null;
  return (await registration()).pushManager.getSubscription();
}

export const pushApi = {
  config: (endpoint?: string) => call<PushConfig>(`/push/config${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`),
  setShowAmounts: (showAmounts: boolean) => call<null>("/push/prefs", { method: "PATCH", body: JSON.stringify({ showAmounts }) }),
  test: () => call<{ sent: number }>("/push/test", { method: "POST" }),
};

/** Asks for permission (must run from a tap) and registers this browser. */
export async function enablePush(showAmounts: boolean) {
  const cfg = await pushApi.config();
  if (!cfg.enabled || !cfg.publicKey) throw new Error("Pengingat belum aktif di server");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "Notifikasi diblokir di browser" : "Izin notifikasi belum diberikan");
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.publicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await call<null>("/push/subscribe", { method: "POST", body: JSON.stringify({ subscription: json, showAmounts }) });
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await call<null>("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
  await sub.unsubscribe();
}

/** Where this browser stands, and whether amounts may show on the lock screen. */
export function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supported()) return setState(isIos() && !isInstalled() ? "install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await currentSubscription();
      const cfg = await pushApi.config(sub?.endpoint).catch(() => null);
      if (!alive) return;
      if (!cfg?.enabled) return setState("unsupported");
      setShowAmounts(cfg.showAmounts);
      setState(sub && cfg.subscribed ? "on" : "off");
    })().catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, [version]);

  return { state, showAmounts, setShowAmounts, refresh: () => setVersion((v) => v + 1) };
}

/**
 * Copies what reminders need about each Rencana dadakan pocket to the server, whenever
 * they change and this browser has reminders on. Nothing else about the pockets leaves
 * the device.
 */
export function useReminderSync(pockets: BudgetPocket[], activity: PocketActivity[], on: boolean) {
  const key = JSON.stringify(
    pockets
      .filter((p) => p.profile)
      .map((p) => [p.id, p.name, p.targetAmount, p.balance, p.profile!.dueDate, activity.find((a) => a.pocketId === p.id && a.kind === "topup")?.at]),
  );
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(async () => {
      const sub = await currentSubscription().catch(() => null);
      if (!sub) return;
      const reminders = pockets
        .filter((p) => p.profile)
        .map((p) => ({
          pocketId: p.id,
          name: p.name.slice(0, 40),
          occasion: p.profile!.occasion.slice(0, 80),
          target: Math.round(p.targetAmount),
          saved: Math.round(p.balance),
          dueDate: p.profile!.dueDate,
          // pocketActivity is newest first
          lastTopupAt: activity.find((a) => a.pocketId === p.id && a.kind === "topup")?.at,
        }));
      await call("/push/reminders", { method: "PUT", body: JSON.stringify({ reminders }) }).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, on]);
}
