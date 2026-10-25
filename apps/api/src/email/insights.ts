import { z } from "zod";
import { maiaClient } from "@nera/ai";
import { emailStore } from "./store";
import type { EmailCategory, EmailTransaction } from "./types";

const LABEL: Record<EmailCategory, string> = {
  food: "Makanan",
  transport: "Transportasi",
  shopping: "Belanja",
  bills: "Tagihan",
  entertainment: "Hiburan",
  education: "Pendidikan",
  topup: "Top up",
  travel: "Perjalanan",
  transfer: "Transfer",
  other: "Lainnya",
};

const SMALL_PURCHASE = 30_000;

const counted = (t: EmailTransaction) => t.type === "expense" && t.countsTowardSpending && !t.needsReview;
const sum = (txs: EmailTransaction[]) => txs.reduce((n, t) => n + t.amount, 0);
const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

export type MoneyInsights = {
  month: string;
  daysElapsed: number;
  daysInMonth: number;
  total: number;
  count: number;
  /** same days of last month, so a half-finished month compares fairly */
  lastMonthSamePeriod: number;
  projectedMonthEnd: number;
  byCategory: { category: EmailCategory; label: string; amount: number; share: number; lastMonth: number; count: number }[];
  topMerchants: { name: string; amount: number; count: number; category: EmailCategory }[];
  biggest: { merchant: string; amount: number; date: string; provider: string }[];
  smallPurchases: { count: number; total: number };
  notCounted: { transfersOut: number; topups: number; income: number; needsReview: number };
  narrative: { summary: string; insights: string[]; tips: string[] };
  generatedBy: "ai" | "rules";
};

/** Where did the money go this month: aggregates from imported email receipts. */
export async function moneyInsights(userId: string, now = new Date()): Promise<MoneyInsights> {
  const txs = await emailStore.listTransactions(userId);
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = new Date(y, m, 1);
  const lastStart = new Date(y, m - 1, 1);
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  // last month up to the same day of the month
  const lastCutoff = new Date(y, m - 1, Math.min(daysElapsed, new Date(y, m, 0).getDate()), 23, 59, 59);

  const inMonth = (t: EmailTransaction) => new Date(t.occurredAt) >= monthStart;
  const inLastPeriod = (t: EmailTransaction) => {
    const d = new Date(t.occurredAt);
    return d >= lastStart && d <= lastCutoff;
  };

  const month = txs.filter(inMonth);
  const spend = month.filter(counted);
  const lastSpend = txs.filter((t) => inLastPeriod(t) && counted(t));
  const total = sum(spend);

  const cats = new Map<EmailCategory, EmailTransaction[]>();
  for (const t of spend) cats.set(t.category, [...(cats.get(t.category) ?? []), t]);
  const byCategory = [...cats]
    .map(([category, list]) => ({
      category,
      label: LABEL[category],
      amount: sum(list),
      share: total ? sum(list) / total : 0,
      lastMonth: sum(lastSpend.filter((t) => t.category === category)),
      count: list.length,
    }))
    .sort((a, b) => b.amount - a.amount);

  const merchants = new Map<string, EmailTransaction[]>();
  for (const t of spend) {
    const key = t.merchant.trim().toUpperCase();
    merchants.set(key, [...(merchants.get(key) ?? []), t]);
  }
  const topMerchants = [...merchants.values()]
    .map((list) => ({ name: list[0].merchant, amount: sum(list), count: list.length, category: list[0].category }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const small = spend.filter((t) => t.amount < SMALL_PURCHASE);
  const stats = {
    month: monthStart.toISOString().slice(0, 7),
    daysElapsed,
    daysInMonth,
    total,
    count: spend.length,
    lastMonthSamePeriod: sum(lastSpend),
    projectedMonthEnd: daysElapsed ? (total / daysElapsed) * daysInMonth : total,
    byCategory,
    topMerchants,
    biggest: [...spend]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((t) => ({ merchant: t.merchant, amount: t.amount, date: t.occurredAt, provider: t.provider })),
    smallPurchases: { count: small.length, total: sum(small) },
    notCounted: {
      transfersOut: sum(month.filter((t) => t.type === "expense" && t.category === "transfer")),
      topups: sum(month.filter((t) => t.category === "topup")),
      income: sum(month.filter((t) => t.type === "income")),
      needsReview: month.filter((t) => t.needsReview).length,
    },
  };

  const ai = total > 0 ? await narrateWithAI(stats) : null;
  return { ...stats, narrative: ai ?? narrateWithRules(stats), generatedBy: ai ? "ai" : "rules" };
}

type Stats = Omit<MoneyInsights, "narrative" | "generatedBy">;

/** Deterministic narrative: always available, even without an AI key. */
export function narrateWithRules(s: Stats): MoneyInsights["narrative"] {
  if (s.total === 0) {
    return {
      summary: "Belum ada pengeluaran dari email bulan ini.",
      insights: ["Hubungkan Gmail atau teruskan struk ke Nera supaya Nera bisa melihat ke mana uangmu pergi."],
      tips: [],
    };
  }
  const diff = s.lastMonthSamePeriod ? (s.total - s.lastMonthSamePeriod) / s.lastMonthSamePeriod : null;
  const trend =
    diff === null
      ? ""
      : Math.abs(diff) < 0.05
        ? ", hampir sama dengan periode yang sama bulan lalu"
        : `, ${Math.round(Math.abs(diff) * 100)}% ${diff > 0 ? "lebih tinggi" : "lebih rendah"} dari periode yang sama bulan lalu`;
  const summary = `Dalam ${s.daysElapsed} hari, ${rp(s.total)} keluar lewat ${s.count} transaksi di luar BNI${trend}.`;

  const insights: string[] = [];
  const top = s.byCategory[0];
  const topPlace = s.topMerchants.find((m) => m.category === top.category);
  insights.push(
    `${top.label} paling besar: ${rp(top.amount)} (${Math.round(top.share * 100)}%)` +
      (topPlace ? `, terbanyak di ${topPlace.name} (${topPlace.count}x).` : "."),
  );
  const jump = s.byCategory
    .filter((c) => c.lastMonth > 0 && c.amount > c.lastMonth * 1.3 && c.amount - c.lastMonth > 50_000)
    .sort((a, b) => b.amount - b.lastMonth - (a.amount - a.lastMonth))[0];
  if (jump) insights.push(`${jump.label} naik dari ${rp(jump.lastMonth)} jadi ${rp(jump.amount)} dibanding periode yang sama bulan lalu.`);
  if (s.smallPurchases.count >= 5) {
    insights.push(`${s.smallPurchases.count} jajan kecil di bawah ${rp(SMALL_PURCHASE)} totalnya ${rp(s.smallPurchases.total)}. Kecil satu-satu, lumayan kalau dikumpulkan.`);
  }
  const biggest = s.biggest[0];
  if (biggest && biggest.amount > s.total * 0.25) insights.push(`Satu transaksi terbesar: ${biggest.merchant} ${rp(biggest.amount)}.`);
  insights.push(`Dengan ritme ini, akhir bulan pengeluaran di luar BNI sekitar ${rp(s.projectedMonthEnd)}.`);

  const tips: string[] = [];
  const weekly = (top.amount / Math.max(1, s.daysElapsed)) * 7;
  tips.push(`Coba batasi ${top.label.toLowerCase()} sekitar ${rp(Math.round((weekly * 0.8) / 1000) * 1000)} per minggu (20% di bawah ritme sekarang).`);
  if (s.smallPurchases.count >= 5) tips.push("Gabungkan jajan kecil: bawa minum dan camilan dari kos, atau tetapkan satu hari bebas jajan per minggu.");
  if (s.notCounted.needsReview > 0) tips.push(`Cek ${s.notCounted.needsReview} transaksi berlabel "Perlu dicek" supaya hitungannya lengkap.`);
  return { summary, insights: insights.slice(0, 4), tips: tips.slice(0, 3) };
}

const Narrative = z.object({
  summary: z.string().min(10).max(400),
  insights: z.array(z.string().min(5).max(300)).min(1).max(5),
  tips: z.array(z.string().min(5).max(300)).max(4),
});

const AI_INSTRUCTIONS = `Kamu Nera, teman konsultasi keuangan mahasiswa di wondr by BNI.
Dari RINGKASAN pengeluaran (JSON) di bawah, jelaskan ke mana uang pengguna pergi bulan ini.
Bahasa Indonesia santai, hangat, tanpa menghakimi. Pakai angka dari data, jangan mengarang angka.
Jangan memberi saran pinjaman, kredit, atau produk investasi tertentu.
Balas HANYA JSON: {"summary": string (1-2 kalimat), "insights": string[] (3-4 poin), "tips": string[] (2-3 langkah konkret)}.`;

/** AI narrative from aggregates only (no email content). Null when no model is configured or it fails. */
async function narrateWithAI(s: Stats): Promise<MoneyInsights["narrative"] | null> {
  const data = JSON.stringify({
    bulan: s.month,
    hariBerjalan: `${s.daysElapsed}/${s.daysInMonth}`,
    total: s.total,
    jumlahTransaksi: s.count,
    periodeSamaBulanLalu: s.lastMonthSamePeriod,
    proyeksiAkhirBulan: Math.round(s.projectedMonthEnd),
    kategori: s.byCategory.map((c) => ({ nama: c.label, total: c.amount, persen: Math.round(c.share * 100), bulanLalu: c.lastMonth, kali: c.count })),
    merchantTeratas: s.topMerchants.map((m) => ({ nama: m.name, total: m.amount, kali: m.count })),
    jajanKecil: s.smallPurchases,
    tidakDihitung: s.notCounted,
  });

  const raw = (await askGoogle(`${AI_INSTRUCTIONS}\n\nRINGKASAN:\n${data}`)) ?? (await maiaClient.extractJson(AI_INSTRUCTIONS, data));
  const parsed = Narrative.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Google AI Studio (Gemma/Gemini), same key as the web chatbot. Returns parsed JSON or null. */
async function askGoogle(prompt: string): Promise<unknown | null> {
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 800 } }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}
