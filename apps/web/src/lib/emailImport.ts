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
  | "travel"
  | "topup"
  | "transfer"
  | "investment"
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
  /** hidden by the user: Nera misread the email */
  dismissed?: boolean;
  userEdited?: boolean;
  extractedBy: "rules" | "ai";
};

export type TransactionUpdate = { transaction: EmailTransaction; alsoChanged: number };

export type GmailBackfill = {
  days: number;
  status: "pending" | "running" | "done" | "error";
  scanned: number;
  imported: number;
  updatedAt: string;
  error?: string;
};

export type EmailStatus = {
  gmail: {
    configured: boolean;
    connected: boolean;
    /** every linked mailbox; the fields below summarize them */
    accounts: { account: string; googleEmail?: string; lastSyncAt?: string; backfill?: GmailBackfill }[];
    googleEmail?: string;
    lastSyncAt?: string;
    backfill?: GmailBackfill;
  };
  forward: { address: string; status: "waiting" | "confirm" | "active"; confirmationCode?: string; lastReceivedAt?: string } | null;
  senders: { provider: string; domains: string[] }[];
  aiExtraction: boolean;
  consent: { version: string; emailImport: boolean; aiProcessing: boolean; emailImportAt?: string; aiProcessingAt?: string };
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

export type MoneyInsights = {
  month: string;
  label: string;
  isCurrentMonth: boolean;
  daysElapsed: number;
  daysInMonth: number;
  total: number;
  count: number;
  lastMonthSamePeriod: number;
  projectedMonthEnd: number;
  byCategory: { category: EmailCategory; label: string; amount: number; share: number; lastMonth: number; count: number }[];
  topMerchants: { name: string; amount: number; count: number; category: EmailCategory }[];
  biggest: { merchant: string; amount: number; date: string; provider: string }[];
  smallPurchases: { count: number; total: number };
  notCounted: { transfersOut: number; topups: number; income: number; needsReview: number };
  narrative: { summary: string; insights: string[]; tips: string[] };
  generatedBy: "ai" | "rules";
  aiAllowed: boolean;
};

/** Insights as plain text, for the chatbot's context. */
export function insightsAsContext(i: MoneyInsights): string {
  const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
  return [
    `Pengeluaran di luar BNI bulan ini (${i.daysElapsed}/${i.daysInMonth} hari): ${rp(i.total)} dari ${i.count} transaksi; periode sama bulan lalu ${rp(i.lastMonthSamePeriod)}; proyeksi akhir bulan ${rp(i.projectedMonthEnd)}.`,
    `Per kategori: ${i.byCategory.map((c) => `${c.label} ${rp(c.amount)} (${Math.round(c.share * 100)}%)`).join(", ")}.`,
    `Merchant teratas: ${i.topMerchants.map((m) => `${m.name} ${rp(m.amount)} (${m.count}x)`).join(", ")}.`,
    `Jajan kecil <Rp30.000: ${i.smallPurchases.count}x, ${rp(i.smallPurchases.total)}. Transfer keluar (tidak dihitung): ${rp(i.notCounted.transfersOut)}.`,
  ].join("\n");
}

export const emailApi = {
  /** No period: the current month. Otherwise compared with the previous period of the same length. */
  insights: (period?: { from: Date; to: Date; label: string }) =>
    call<MoneyInsights>(
      period
        ? `/email/insights?${new URLSearchParams({ from: period.from.toISOString(), to: period.to.toISOString(), label: period.label })}`
        : "/email/insights",
    ),
  status: () => call<EmailStatus>("/email/status"),
  transactions: () => call<EmailTransaction[]>("/email/transactions"),
  importDemo: () => call<SyncSummary>("/email/demo/import", { method: "POST" }),
  syncGmail: () => call<SyncSummary>("/email/gmail/sync", { method: "POST" }),
  setConsent: (kind: "email_import" | "ai_processing", granted: boolean) =>
    call<void>("/email/consent", { method: "POST", body: JSON.stringify({ kind, granted }) }),
  backfillGmail: (days: 180 | 365 | 3650) => call<void>("/email/gmail/backfill", { method: "POST", body: JSON.stringify({ days }) }),
  /** one mailbox, or all of them without `account` */
  disconnectGmail: (account?: string) =>
    call<void>(`/email/gmail${account ? `?account=${encodeURIComponent(account)}` : ""}`, { method: "DELETE" }),
  createAlias: () => call<NonNullable<EmailStatus["forward"]>>("/email/forward/alias", { method: "POST" }),
  removeAlias: () => call<void>("/email/forward", { method: "DELETE" }),
  confirm: (id: string) => call<TransactionUpdate>(`/email/transactions/${id}`, { method: "PATCH", body: JSON.stringify({ confirm: true }) }),
  /** recategorize (optionally every receipt from the merchant, remembered) or hide/unhide */
  editTransaction: (
    id: string,
    edit: { category: EmailCategory; applyToMerchant?: boolean } | { dismissed: boolean },
  ) =>
    call<TransactionUpdate>(`/email/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify("category" in edit ? { category: edit.category, ...(edit.applyToMerchant && { applyToMerchant: true }) } : edit),
    }),
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
  travel: "Perjalanan",
  transfer: "Transfer",
  investment: "Investasi",
  other: "Lainnya",
};

export type AdminOverview = {
  totals: { users: number; gmailConnected: number; forwardActive: number; transactions: number };
  users: {
    email: string;
    /** false: signed in before login tracking; `email` is their Gmail address */
    loginKnown: boolean;
    firstSeenAt?: string;
    lastSeenAt?: string;
    gmail: { address?: string; connectedAt: string; lastSyncAt?: string } | null;
    forward: { status: "waiting" | "confirm" | "active"; lastReceivedAt?: string } | null;
    transactions: { total: number; gmail: number; forward: number; demo: number; needsReview: number };
    lastTransactionAt?: string;
    consent: { emailImport: boolean; aiProcessing: boolean };
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
