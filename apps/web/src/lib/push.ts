"use client";

import { useEffect, useState } from "react";
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
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.publicKey) }).catch((e: Error) => {
      // "Registration failed - push service error": the browser couldn't reach its own push
      // service (Google's for Chrome). A VPN, firewall or blocker, or a browser with push off.
      if (/push service/i.test(e.message))
        throw new Error(
          "Browser ini belum bisa terhubung ke layanan notifikasi. Matikan VPN atau pemblokir iklan lalu coba lagi. Di Brave: Settings, Privacy, nyalakan \"Use Google services for push messaging\". Atau coba dari Chrome di HP.",
        );
      throw e;
    }));
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
