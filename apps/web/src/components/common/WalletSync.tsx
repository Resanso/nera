"use client";

import { useWalletSync } from "../../lib/wallet";

/** Loads the signed-in user's pockets from the DB and keeps them there (lib/wallet.ts). */
export function WalletSync() {
  useWalletSync();
  return null;
}
