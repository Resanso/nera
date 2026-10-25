// Client for the API's /api/email endpoints (transaction history from email receipts).

// Empty string in deploys means same origin: nginx serves /api next to the web app.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
// No auth in the prototype yet; the API falls back to the same demo user.
export const DEMO_USER = "demo-student";

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
  extractedBy: "rules" | "ai";
};

export type EmailStatus = {
  gmail: { configured: boolean; connected: boolean; googleEmail?: string; lastSyncAt?: string };
  forward: { address: string; status: "waiting" | "confirm" | "active"; confirmationCode?: string; lastReceivedAt?: string } | null;
  senders: { provider: string; domains: string[] }[];
  aiExtraction: boolean;
};

export type SyncSummary = { scanned: number; imported: number; duplicates: number; ignored: number };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/email${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-nera-user": DEMO_USER, ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.error ?? `Server membalas ${res.status}`);
  return body.data as T;
}

export const emailApi = {
  status: () => call<EmailStatus>("/status"),
  transactions: () => call<EmailTransaction[]>("/transactions"),
  importDemo: () => call<SyncSummary>("/demo/import", { method: "POST" }),
  syncGmail: () => call<SyncSummary>("/gmail/sync", { method: "POST" }),
  disconnectGmail: () => call<void>("/gmail", { method: "DELETE" }),
  createAlias: () => call<NonNullable<EmailStatus["forward"]>>("/forward/alias", { method: "POST" }),
  removeAlias: () => call<void>("/forward", { method: "DELETE" }),
  confirm: (id: string) => call<EmailTransaction>(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify({ confirm: true }) }),
  deleteAll: () => call<void>("/all", { method: "DELETE" }),
  /** Full-page redirect: OAuth can't carry our header, so the user id goes in the query. */
  gmailConnectUrl: () => `${API_URL}/api/email/gmail/connect?user=${DEMO_USER}`,
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
