"use client";

import { useEffect } from "react";
import { setWalletRemote, useFinancialStore, type WalletOp, type WalletView } from "../context/FinancialStore";
import { NotSignedIn, call } from "./emailImport";

/**
 * Keeps Aset Saya, Kantong Utama and the pockets in the DB for a signed-in user. The store
 * changes at once (it feels instant), the same op goes to the server, and the server's reply
 * replaces the store, so both always end on the DB's numbers. Ops are sent one at a time,
 * in order. Signed out, nothing is sent and the store stays a demo on this device.
 */

const walletApi = {
  get: () => call<WalletView | null>("/wallet"),
  import: (body: unknown) => call<WalletView>("/wallet/import", { method: "POST", body: JSON.stringify(body) }),
  op: (op: WalletOp) => call<WalletView>("/wallet/op", { method: "POST", body: JSON.stringify(op) }),
};

let queue: Promise<unknown> = Promise.resolve();
let pending = 0;
const listeners = new Set<(msg: string) => void>();

/** A rejected op (e.g. a balance changed on another device): say why, then show the DB's numbers. */
export const onWalletError = (fn: (msg: string) => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

const hydrate = (v: WalletView) => useFinancialStore.getState().hydrateWallet(v);

function enqueue(task: () => Promise<WalletView | null | void>) {
  pending++;
  queue = queue
    .then(task)
    .then((v) => {
      // a reply only lands once nothing newer is waiting, so it can't undo a newer local change
      if (v && pending === 1) hydrate(v);
    })
    .catch(async (e) => {
      for (const fn of listeners) fn((e as Error).message);
      const v = await walletApi.get().catch(() => null);
      if (v) hydrate(v);
    })
    .finally(() => pending--);
  return queue;
}

/** First connection on this account: what this device has becomes the account's. */
function importLocal() {
  const s = useFinancialStore.getState();
  return walletApi.import({
    main: Math.max(0, Math.round(s.dailyPocket)),
    assetsSet: s.assetsSet,
    monthlyIncome: s.monthlyIncome,
    incomeDay: s.incomeDay,
    pockets: s.budgetPockets.map((p) => ({
      id: p.id,
      name: p.name.slice(0, 40),
      kind: p.kind,
      icon: p.icon,
      tone: p.tone,
      balance: Math.max(0, Math.round(p.balance)),
      target: Math.max(0, Math.round(p.targetAmount)),
      ...(p.profile && { profile: p.profile }),
      createdAt: new Date(p.createdAt).toISOString(),
    })),
    activity: s.pocketActivity.slice(0, 2000).map((a) => ({
      id: a.id,
      pocketId: a.pocketId,
      kind: a.kind,
      amount: Math.round(a.amount),
      ...(a.title && { title: a.title.slice(0, 80) }),
      at: a.at,
    })),
  });
}

/** Loads the wallet (importing this device's on the first time) and plugs the server in. */
export function refreshWallet() {
  return enqueue(async () => {
    try {
      const v = (await walletApi.get()) ?? (await importLocal());
      setWalletRemote((op) => void enqueue(() => walletApi.op(op)));
      return v;
    } catch (e) {
      if (e instanceof NotSignedIn) {
        setWalletRemote(null);
        useFinancialStore.setState({ walletSynced: false });
      }
      // offline or the API is down: keep what the device has; the next open tries again
      return;
    }
  });
}

/** Mounted once for the student app: loads on open and whenever the app comes back to the front. */
export function useWalletSync() {
  useEffect(() => {
    useFinancialStore.persist.hasHydrated() ? refreshWallet() : useFinancialStore.persist.onFinishHydration(() => refreshWallet());
    const onVisible = () => document.visibilityState === "visible" && refreshWallet();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}
