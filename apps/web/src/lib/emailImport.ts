// Client for the API's /api/email endpoints (transaction history from email receipts).

// Empty string in deploys means same origin: nginx serves /api next to the web app.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type EmailCategory =
  | "food"
  | "transport"
  | "shopping"
  | "bills"
  | "entertainment"
  | "education"
  | "topup"
  | "transfer"
  | "other";

export type EmailTransaction = {
  id: string;
  channel: "gmail" | "forward" | "demo";
  provider: string;
  merchant: string;
  amount: number;
  type: "expense" | "income";
  category: EmailCategory;
  occurredAt: string;
  externalRef?: string;
  confidence: number;
  needsReview: boolean;
  countsTowardSpending: boolean;
  /** id of the receipt that already counts this payment */
  duplicateOf?: string;
  extractedBy: "rules" | "ai";
};

export type EmailStatus = {
  gmail: { configured: boolean; connected: boolean; googleEmail?: string; lastSyncAt?: string };
  forward: { address: string; status: "waiting" | "confirm" | "active"; confirmationCode?: string; lastReceivedAt?: string } | null;
  senders: { provider: string; domains: string[] }[];
  aiExtraction: boolean;
};

export type SyncSummary = { scanned: number; imported: number; duplicates: number; ignored: number };

/** Thrown when the session cookie is missing or expired. */
export class NotSignedIn extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    // the session is an HttpOnly cookie set by the API
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401) throw new NotSignedIn("Silakan masuk dulu.");
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.error ?? `Server membalas ${res.status}`);
  return body.data as T;
}

export const authApi = {
  me: () => call<{ email: string; isAdmin: boolean }>("/auth/me"),
  logout: () => call<void>("/auth/logout", { method: "POST" }),
  /** Full-page redirect to Google, back to `returnTo` afterwards. */
  loginUrl: (returnTo: string) => `${API_URL}/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`,
};

export const emailApi = {
  status: () => call<EmailStatus>("/email/status"),
  transactions: () => call<EmailTransaction[]>("/email/transactions"),
  importDemo: () => call<SyncSummary>("/email/demo/import", { method: "POST" }),
  syncGmail: () => call<SyncSummary>("/email/gmail/sync", { method: "POST" }),
  disconnectGmail: () => call<void>("/email/gmail", { method: "DELETE" }),
  createAlias: () => call<NonNullable<EmailStatus["forward"]>>("/email/forward/alias", { method: "POST" }),
  removeAlias: () => call<void>("/email/forward", { method: "DELETE" }),
  confirm: (id: string) => call<EmailTransaction>(`/email/transactions/${id}`, { method: "PATCH", body: JSON.stringify({ confirm: true }) }),
  deleteAll: () => call<void>("/email/all", { method: "DELETE" }),
  /** Full-page redirect; the session cookie identifies the user. */
  gmailConnectUrl: () => `${API_URL}/api/email/gmail/connect`,
};

export const CATEGORY_LABEL: Record<EmailCategory, string> = {
  food: "Makanan",
  transport: "Transportasi",
  shopping: "Belanja",
  bills: "Tagihan",
  entertainment: "Hiburan",
  education: "Pendidikan",
  topup: "Top up",
  transfer: "Transfer",
  other: "Lainnya",
};

export type AdminOverview = {
  totals: { users: number; gmailConnected: number; forwardActive: number; transactions: number };
  users: {
    email: string;
    firstSeenAt: string;
    lastSeenAt: string;
    gmail: { address?: string; connectedAt: string; lastSyncAt?: string } | null;
    forward: { status: "waiting" | "confirm" | "active"; lastReceivedAt?: string } | null;
    transactions: { total: number; gmail: number; forward: number; demo: number; needsReview: number };
    lastTransactionAt?: string;
  }[];
};

/** 403 from the admin API: signed in, but not on the ADMIN_EMAILS whitelist. */
export class NotAdmin extends Error {}

export const adminApi = {
  overview: () =>
    call<AdminOverview>("/admin/overview").catch((e: Error) => {
      throw e.message === "Bukan admin." ? new NotAdmin(e.message) : e;
    }),
};
