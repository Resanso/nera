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

/**
 * The payee name is the most precise signal ("MIE AYAM BAKSO JABRIG", "YOGYA BOJONGSOANG"),
 * so it is checked before the email body. Order matters: first match wins.
 */
const MERCHANT_RULES: [EmailCategory, RegExp][] = [
  ["investment", /^(?:triv|pintu|bibit|ajaib|indodax|tokocrypto|pluang|stockbit|bareksa)\b|reku\.id/i],
  ["travel", /traveloka|tiket\.com|\btiket com\b|pegipegi|agoda|booking\.com|airbnb|\bhotel\b|\bmotel\b|\bvilla\b|hostel|resort|garuda|lion air|citilink|batik air|air ?asia|pelita air/i],
  // "kampus" alone is too broad ("Warung Kopi Kampus"); match institutions and fees instead
  ["education", /universit|institut|politeknik|telkom univ|\bukt\b|\bkursus\b|course|udemy|coursera|sekolah|\bbimbel\b/i],
  ["bills", /biznet|indihome|first ?media|\bmyrepublic\b|telkomsel|indosat|\bxl\b|smartfren|\bpln\b|pdam|bpjs|\blistrik\b|laundry/i],
  ["food", /warung|waroeng|warkop|warteg|warnas|\bwarmindo\b|\brm\b|rumah makan|kantin|canteen|nasgor|nasi goreng|kitchen|dapur|\bgrill|bakmi|\bpecel|\bpenyet|\blalapan|\bseafood|\bsteak|\bramen|sushi|\bkedai\b|\bdepot\b|\bbistro|\beatery|\bboga\b|\bkopi\b|coffee|\bcafe\b|\bkafe\b|resto|restaurant|\bbakso\b|\bmie\b|\bmi ayam\b|\bayam\b|geprek|\bnasi\b|\bsate\b|\bsoto\b|martabak|\broti\b|bakery|seblak|crisbar|\bkfc\b|mcdonald|\bmcd\b|subway|\bsbux\b|starbucks|chatime|mixue|janji jiwa|kenangan|hokben|pizza|burger|kebab|kabobs|dbesto|dimsum|\bboba\b|\bjuice\b|kuliner|\bfood\b|gofood|grabfood|shopeefood/i],
  ["shopping", /\w*mart\b|azko|ace hardware|informa|miniso|uniqlo|h&m|watsons|guardian|\bapotek|kimia farma|century|\bshop\b|yogya|indomaret|\bidm\b|alfamart|alfamidi|superindo|hypermart|transmart|lotte ?mart|\bgiant\b|sembako|minimarket|\bmarket\b|\btoko\b|\bstore\b|\bkios\b|oleh|tokopedia|shopee|lazada|blibli|\bmall\b/i],
  ["transport", /shuttle|tiketux|daytrans|cititrans|baraya|\btravel\b|\bdamri\b|\bbluebird|\btol\b|\be-?toll|\bgrab\b|gojek|bluebird|\bkrl\b|\bkai\b|\bmrt\b|\blrt\b|parkir|\bspbu\b|pertamina|\bshell\b|transjakarta/i],
  ["entertainment", /gokart|go kart|\brink\b|bowling|timezone|\bfuntastic|playground|billiard|bioskop|cinema|\bxxi\b|\bcgv\b|netflix|spotify|\bsteam\b|karaoke|\bsurf\b|\bgame/i],
];

/** Category from the payee name alone; null when nothing matches. */
export function categorizeMerchant(name: string): EmailCategory | null {
  return MERCHANT_RULES.find(([, re]) => re.test(name))?.[0] ?? null;
}

const CATEGORY_RULES: [EmailCategory, RegExp][] = [
  ["topup", /\btop[\s-]?up\b|isi saldo/i],
  ["food", /gofood|grabfood|shopeefood|makanan|restoran|resto\b|kopi|coffee|warung/i],
  ["transport", /goride|gocar|grabbike|grabcar|perjalanan|\btrip\b|krl|kereta|pesawat|bus\b/i],
  ["bills", /pulsa|paket data|token listrik|\bpln\b|bpjs|tagihan|internet|wifi|telkomsel|indosat|\bxl\b|smartfren|\bim3\b/i],
  ["entertainment", /netflix|spotify|bioskop|\bgame\b|youtube premium/i],
  ["education", /kursus|\bbuku\b|\bukt\b|course|kelas online/i],
  ["shopping", /pesanan|belanja|checkout|keranjang/i],
];

const INCOME = /dana masuk|penerimaan dana|kamu menerima|anda menerima|uang masuk|transfer masuk|refund|pengembalian dana|cashback (?:diterima|masuk)/i;
/**
 * In the body only phrases that state money arrived count. Store footers mention
 * "Pengembalian Barang/Dana" and refund policies on every order email (Shopee).
 */
const INCOME_BODY = /dana masuk|uang masuk|transfer masuk|dana (?:telah|sudah) (?:dikembalikan|masuk)/i;
/** Follow-ups to an order that was already paid (shipping, "did you receive it?", returns, refund notices); never a new payment. */
export const SHIPPING = /telah dikirim|sedang dikirim|telah tiba|sudah tiba|dalam perjalanan|siap diambil|has shipped|\bshipped\b|\bdelivered\b|out for delivery|pesanan selesai|sudahkah kamu menerima|sudah menerima pesanan|permintaan pengembalian|informasi terkait refund/i;
/** Failed or cancelled payments: the money never moved. */
/** Invoices waiting to be paid: the payment, if it happens, sends its own receipt. */
export const UNPAID = /menunggu pembayaran|segera (?:selesaikan )?pembayaran|batas (?:waktu )?pembayaran|belum dibayar|waiting for payment|awaiting payment/i;
export const FAILED = /tidak berhasil|\bgagal\b|dibatalkan|ditolak|\bfailed\b|unsuccessful|declined/i;
/** Money sent to a person or account: not a purchase, kept out of spending totals. */
const TRANSFER = /\btransfer\b|kirim uang|mengirim(?:kan)? uang ke|send money/i;
const TOPUP = /\btop[\s-]?up\b|isi saldo/i;

/**
 * The subject says what kind of notification this is far more reliably than the body,
 * which mixes labels like "Penerima" into payments and transfers alike.
 */
function kindFromSubject(subject: string): EmailCategory | "income" | null {
  if (INCOME.test(subject)) return "income";
  if (TOPUP.test(subject)) return "topup";
  if (TRANSFER.test(subject)) return "transfer";
  return null;
}
const PROMO = /promo|diskon|voucher|flash sale|penawaran|newsletter|cashback hingga|\bsale\b|wishlist|recommended deals|hadiah|undian|giveaway|berkesempatan|perayaan|ulang tahun|kuis/i;

/** "Rp 25.000" / "Rp25,000" / "IDR 25.000,00" -> 25000 */
export function parseRupiah(raw: string): number {
  const noDecimals = raw.replace(/[.,]\d{2}$/, "");
  return Number(noDecimals.replace(/\D/g, ""));
}

function findTotal(text: string): { amount: number; keyword: boolean } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  for (const kw of TOTAL_KEYWORDS) {
    for (let i = 0; i < lines.length; i++) {
      // a label, not prose: at the start of a line or a table cell ("hadiah dengan total
      // Rp5.000.000" in a promo is not a receipt total)
      const m = new RegExp(`(?:^|\\s{2,}|[|:])\\s*${kw}`, "i").exec(lines[i]);
      if (!m) continue;
      const at = m.index + m[0].length - kw.length;
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
  // whole words only: "penerima" must not match inside "penerimaan dana"
  // a label: at the start of a line, or followed by ":"/"-". Prose like "dana diteruskan ke
  // Penjual secara otomatis" or "penjual dapat menagih pajak" is not a merchant field.
  const m = text.match(
    /(?:^|\n)[ \t]*(?:merchant|restoran|penjual|penerima|dibayar ke|pembayaran ke|toko(?=[ \t]*:))\b[ \t]*[:-]?\s*([^\n]{2,60})|\b(?:merchant|restoran|penjual|penerima|dibayar ke|pembayaran ke)[ \t]*[:-][ \t]*([^\n]{2,60})/i,
  );
  // stop at the next label or column gap ("Ayam Geprek  Order ID: ...")
  const name = (m?.[1] ?? m?.[2])?.split(/\s{2,}|\b(?:order id|no\.|invoice|booking)\b/i)[0].trim();
  return name && !/^(?:secara|akan|dapat|yang|untuk|dan|atau|di|ke|dari)\b/i.test(name) ? name : undefined;
}

/**
 * Two-column receipts (wondr by BNI): a header row "Recipient  Source of funds" and the
 * values on the next row. The payee is the first cell under the label.
 */
function merchantFromTable(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  for (let i = 0; i < lines.length - 1; i++) {
    const cells = lines[i].split(/\s{2,}/);
    if (cells.length < 2 || !/^(?:recipient|penerima|merchant)$/i.test(cells[0])) continue;
    const next = lines.slice(i + 1).find(Boolean)?.split(/\s{2,}/)[0];
    if (next && !/^[\d\s*•.-]+$/.test(next)) return next;
  }
  return undefined;
}

/** blu: the payee is the line under the payer's "bluAccount". */
function merchantAfterAccount(text: string): string | undefined {
  const m = text.match(/(?:^|\n)[ \t]*bluAccount[ \t]*\n\s*([^\n]{2,60})/);
  const name = m?.[1].trim();
  return name && !/^[\d\s]+$/.test(name) ? name : undefined;
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
/**
 * `subjectOnly`: bank notifications carry long footers (products, "tagihan", "internet
 * banking") and marketplace receipts list "Total Tagihan" and product names, so only the
 * payee and the subject decide their category, never the body.
 */
export function extractWithRules(email: ParsedEmail, provider: string, fallback: EmailCategory, subjectOnly = false): Extraction | null {
  const haystack = `${email.subject}\n${email.text}`;
  const total = findTotal(haystack);
  if (!total || total.amount <= 0) return null;
  // promo blasts mention prices but have no "total" line
  if (!total.keyword && PROMO.test(haystack)) return null;

  const merchant =
    merchantFromSubject(email.subject) ?? merchantFromTable(email.text) ?? findMerchant(email.text) ?? merchantAfterAccount(email.text);
  const externalRef = findRef(haystack);
  const confidence = 0.5 + (total.keyword ? 0.3 : 0) + (merchant ? 0.1 : 0) + (externalRef ? 0.1 : 0);

  const kind = kindFromSubject(email.subject);
  return {
    amount: total.amount,
    type: kind === "income" || INCOME_BODY.test(email.text) ? "income" : "expense",
    merchant: merchant ?? provider,
    category: kind && kind !== "income" ? kind : ((merchant ? categorizeMerchant(merchant) : null) ?? categorize(subjectOnly ? email.subject : haystack, fallback)),
    externalRef,
    confidence: Math.min(1, confidence),
    extractedBy: "rules",
  };
}

const CATEGORIES = ["food", "transport", "shopping", "bills", "entertainment", "education", "travel", "topup", "transfer", "investment", "other"] as const;

// Models vary: null for missing fields, "49000" as a string, "Food" capitalized. Accept all of that.
const AiResult = z.object({
  isTransaction: z.boolean(),
  amount: z.coerce.number().nonnegative().nullish(),
  type: z.enum(["expense", "income"]).nullish().catch(null),
  merchant: z.string().max(80).nullish().catch(null),
  category: z.preprocess((v) => (typeof v === "string" ? v.toLowerCase() : v), z.enum(CATEGORIES).nullish().catch(null)),
  externalRef: z.string().max(40).nullish().catch(null),
});

const AI_SYSTEM = `Kamu mengekstrak transaksi dari email struk/notifikasi pembayaran berbahasa Indonesia atau Inggris.
Balas HANYA JSON: {"isTransaction": boolean, "amount": number (rupiah, tanpa desimal), "type": "expense"|"income",
"merchant": string, "category": "food"|"transport"|"shopping"|"bills"|"entertainment"|"education"|"travel"|"topup"|"transfer"|"investment"|"other",
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
    externalRef: d.externalRef || undefined,
    // the model is a second opinion; keep it out of totals until the user confirms
    confidence: 0.65,
    extractedBy: "ai",
  };
}
