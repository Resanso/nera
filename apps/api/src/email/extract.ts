import { z } from "zod";
import { maiaClient } from "@nera/ai";
import { redact } from "./redact";
import type { EmailCategory, ParsedEmail } from "./types";

export type Extraction = {
  amount: number;
  type: "expense" | "income";
  merchant: string;
  category: EmailCategory;
  externalRef?: string;
  confidence: number;
  extractedBy: "rules" | "ai";
};

const TOTAL_KEYWORDS = [
  "total transaksi",
  "total pembayaran",
  "total bayar",
  "total tagihan",
  "total belanja",
  "grand total",
  "total dibayar",
  "jumlah pembayaran",
  "nominal transaksi",
  "total",
  "jumlah",
  "nominal",
  "amount",
];

const AMOUNT = /(?:Rp|IDR)\s?\.?\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/i;

const CATEGORY_RULES: [EmailCategory, RegExp][] = [
  ["topup", /\btop[\s-]?up\b|isi saldo/i],
  ["food", /gofood|grabfood|shopeefood|makanan|restoran|resto\b|kopi|coffee|warung/i],
  ["transport", /goride|gocar|grabbike|grabcar|perjalanan|\btrip\b|krl|kereta|pesawat|bus\b/i],
  ["bills", /pulsa|paket data|token listrik|\bpln\b|bpjs|tagihan|internet|wifi|telkomsel|indosat|\bxl\b|smartfren|\bim3\b/i],
  ["entertainment", /netflix|spotify|bioskop|\bgame\b|youtube premium/i],
  ["education", /kursus|\bbuku\b|\bukt\b|course|kelas online/i],
  ["shopping", /pesanan|belanja|checkout|keranjang/i],
];

const INCOME = /dana masuk|kamu menerima|anda menerima|uang masuk|refund|pengembalian dana|cashback (?:diterima|masuk)/i;
const PROMO = /promo|diskon|voucher|flash sale|penawaran|newsletter|cashback hingga/i;

/** "Rp 25.000" / "Rp25,000" / "IDR 25.000,00" -> 25000 */
export function parseRupiah(raw: string): number {
  const noDecimals = raw.replace(/[.,]\d{2}$/, "");
  return Number(noDecimals.replace(/\D/g, ""));
}

function findTotal(text: string): { amount: number; keyword: boolean } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  for (const kw of TOTAL_KEYWORDS) {
    for (let i = 0; i < lines.length; i++) {
      const at = lines[i].toLowerCase().indexOf(kw);
      if (at < 0) continue;
      // amount after the keyword on the same line, or on the next lines (table layouts)
      const sameLine = lines[i].slice(at + kw.length).match(AMOUNT);
      const next = lines.slice(i + 1, i + 3).join(" ").match(AMOUNT);
      const hit = sameLine ?? next;
      if (hit) return { amount: parseRupiah(hit[1]), keyword: true };
    }
  }
  const any = text.match(AMOUNT);
  return any ? { amount: parseRupiah(any[1]), keyword: false } : null;
}

function findMerchant(text: string): string | undefined {
  const m = text.match(/(?:merchant|restoran|penjual|penerima|dibayar ke|pembayaran ke)\s*[:-]?\s*([^\n]{2,60})/i);
  // stop at the next label or column gap ("Ayam Geprek  Order ID: ...")
  return m?.[1].split(/\s{2,}|\b(?:order id|no\.|invoice|booking)\b/i)[0].trim() || undefined;
}

/** "Kamu telah membayar ke MyTelkomsel Apps💸" -> "MyTelkomsel Apps" (bank payment notifications). */
function merchantFromSubject(subject: string): string | undefined {
  const m = subject.match(/(?:membayar ke|bayar ke|pembayaran ke|pembayaran di|transaksi di)\s+(.+)$/i);
  return m?.[1].replace(/[^\p{L}\p{N})]+$/u, "").trim() || undefined;
}

function findRef(text: string): string | undefined {
  const m = text.match(
    /(?:order id|id pesanan|no\.? pesanan|nomor pesanan|invoice|booking id|no\.? transaksi|id transaksi)\s*[:#-]?\s*([A-Z0-9-]{5,30})/i,
  );
  return m?.[1];
}

function categorize(text: string, fallback: EmailCategory): EmailCategory {
  return CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] ?? fallback;
}

/** Fast path: regex rules over the email text. Returns null when it is clearly not a receipt. */
export function extractWithRules(email: ParsedEmail, provider: string, fallback: EmailCategory): Extraction | null {
  const haystack = `${email.subject}\n${email.text}`;
  const total = findTotal(haystack);
  if (!total || total.amount <= 0) return null;
  // promo blasts mention prices but have no "total" line
  if (!total.keyword && PROMO.test(haystack)) return null;

  const merchant = merchantFromSubject(email.subject) ?? findMerchant(email.text);
  const externalRef = findRef(haystack);
  const confidence = 0.5 + (total.keyword ? 0.3 : 0) + (merchant ? 0.1 : 0) + (externalRef ? 0.1 : 0);

  return {
    amount: total.amount,
    type: INCOME.test(haystack) ? "income" : "expense",
    merchant: merchant ?? provider,
    category: categorize(haystack, fallback),
    externalRef,
    confidence: Math.min(1, confidence),
    extractedBy: "rules",
  };
}

const AiResult = z.object({
  isTransaction: z.boolean(),
  amount: z.number().nonnegative().optional(),
  type: z.enum(["expense", "income"]).optional(),
  merchant: z.string().max(80).optional(),
  category: z
    .enum(["food", "transport", "shopping", "bills", "entertainment", "education", "topup", "transfer", "other"])
    .optional(),
  externalRef: z.string().max(40).optional(),
});

const AI_SYSTEM = `Kamu mengekstrak transaksi dari email struk/notifikasi pembayaran berbahasa Indonesia atau Inggris.
Balas HANYA JSON: {"isTransaction": boolean, "amount": number (rupiah, tanpa desimal), "type": "expense"|"income",
"merchant": string, "category": "food"|"transport"|"shopping"|"bills"|"entertainment"|"education"|"topup"|"transfer"|"other",
"externalRef": string opsional}. Email promo, newsletter, OTP, atau info akun bukan transaksi (isTransaction false).
Ambil jumlah TOTAL yang dibayar, bukan harga item atau diskon.`;

/** Slow path for receipts the rules can't read. Personal data is redacted first. */
export async function extractWithAI(email: ParsedEmail, provider: string): Promise<Extraction | null> {
  const body = redact(`Pengirim: ${provider}\nSubjek: ${email.subject}\n\n${email.text}`).slice(0, 6000);
  const raw = await maiaClient.extractJson(AI_SYSTEM, body);
  const parsed = AiResult.safeParse(raw);
  if (!parsed.success || !parsed.data.isTransaction || !parsed.data.amount) return null;
  const d = parsed.data;
  return {
    amount: Math.round(d.amount!),
    type: d.type ?? "expense",
    merchant: d.merchant || provider,
    category: d.category ?? "other",
    externalRef: d.externalRef,
    // the model is a second opinion; keep it out of totals until the user confirms
    confidence: 0.65,
    extractedBy: "ai",
  };
}
