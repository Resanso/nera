import type { BudgetPocketIcon } from "@nera/core";
import type { ProfileDraft } from "./pocketProfile";

/**
 * Reads an occasion, an amount and a day out of what the user typed ("diajak AYCE 200rb hari
 * Sabtu"). The server uses it when no model is configured or the model's answer is unusable,
 * and to fill a field the model left out.
 */

const OCCASIONS: { re: RegExp; name: string; icon: BudgetPocketIcon }[] = [
  { re: /\b(ayce|all you can eat)\b/i, name: "AYCE", icon: "food" },
  { re: /\b(buka ?bersama|bukber)\b/i, name: "Bukber", icon: "food" },
  { re: /\b(makan|nongkrong|ngopi|hangout|traktir)\w*/i, name: "Makan bareng", icon: "food" },
  { re: /\b(konser|festival|fest)\b/i, name: "Konser", icon: "fun" },
  { re: /\b(nonton|bioskop|film)\b/i, name: "Nonton", icon: "fun" },
  { re: /\b(karaoke|bowling|main|game|timezone)\b/i, name: "Main bareng", icon: "fun" },
  { re: /\b(kado|hadiah|ulang tahun|ultah|birthday|wisuda)\b/i, name: "Kado", icon: "gift" },
  { re: /\b(liburan|trip|staycation|healing|mudik|pulang kampung|tiket)\b/i, name: "Trip", icon: "travel" },
  { re: /\b(baju|sepatu|outfit|belanja)\b/i, name: "Belanja", icon: "shopping" },
  { re: /\b(seminar|workshop|kursus|buku)\b/i, name: "Kuliah", icon: "education" },
];

const DAYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const MONTHS = ["jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (today: string, n: number) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

export function extractAmount(text: string): number | null {
  const t = text.toLowerCase();
  const short = t.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)\b/);
  if (short) {
    const n = Number(short[1].replace(",", "."));
    return Math.round(n * (/^(jt|juta)$/.test(short[2]) ? 1_000_000 : 1_000));
  }
  const full = t.match(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d{4,})/);
  return full ? Number(full[1].replace(/\./g, "")) : null;
}

/** The day mentioned, as YYYY-MM-DD, counting from `today` (also YYYY-MM-DD, WIB). */
export function extractDate(text: string, today: string): string | null {
  const t = text.toLowerCase();
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();

  if (/\b(hari ini|nanti malam|malam ini|sekarang)\b/.test(t)) return today;
  if (/\blusa\b/.test(t)) return addDays(today, 2);
  if (/\bbesok\b/.test(t)) return addDays(today, 1);
  if (/\bminggu depan\b/.test(t) && !/\b(senin|selasa|rabu|kamis|jumat|sabtu)\b/.test(t)) return addDays(today, 7);
  if (/\bbulan depan\b/.test(t)) return addDays(today, 30);

  const dm = t.match(/\b(\d{1,2})\s*(?:\/|-|\s)\s*(\d{1,2}|[a-z]{3,})/);
  if (dm) {
    const day = Number(dm[1]);
    const m = /^\d+$/.test(dm[2]) ? Number(dm[2]) - 1 : MONTHS.findIndex((x) => dm[2].startsWith(x));
    if (m >= 0 && m < 12 && day >= 1 && day <= 31) {
      const year = Number(today.slice(0, 4));
      const date = iso(new Date(Date.UTC(year, m, day)));
      return date >= today ? date : iso(new Date(Date.UTC(year + 1, m, day)));
    }
  }
  const tgl = t.match(/\b(?:tanggal|tgl)\s*(\d{1,2})\b/);
  if (tgl) {
    const day = Number(tgl[1]);
    const d = new Date(`${today}T00:00:00Z`);
    const date = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day)));
    return date >= today ? date : iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, day)));
  }

  // "sabtu", "jumat depan"; "minggu" alone is Sunday only when it reads like a day
  for (let i = 0; i < 7; i++) {
    const name = DAYS[i];
    const re = i === 0 ? /\b(hari minggu|minggu ini|minggu nanti)\b/ : new RegExp(`\\b${name}\\b`);
    if (!re.test(t)) continue;
    let ahead = (i - weekday + 7) % 7;
    if (new RegExp(`\\b${i === 0 ? "minggu" : name} depan\\b`).test(t)) ahead += ahead === 0 ? 7 : 7;
    return addDays(today, ahead);
  }
  return null;
}

export function extractOccasion(text: string): { occasion: string; name: string; icon: BudgetPocketIcon } | null {
  const hit = OCCASIONS.find((o) => o.re.test(text));
  return hit ? { occasion: hit.name, name: hit.name, icon: hit.icon } : null;
}

/** Everything the user said so far, later messages winning. */
export function extractDraft(userMessages: string[], today: string): Partial<ProfileDraft> {
  const out: Partial<ProfileDraft> = {};
  for (const m of userMessages) {
    const occ = extractOccasion(m);
    if (occ) Object.assign(out, occ);
    const amount = extractAmount(m);
    if (amount) out.amount = amount;
    const date = extractDate(m, today);
    if (date) out.dueDate = date;
  }
  return out;
}
