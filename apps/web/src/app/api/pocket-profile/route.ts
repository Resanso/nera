import { NextRequest } from "next/server";
import type { BudgetPocketIcon } from "@nera/core";
import { extractDraft } from "../../../lib/profileExtract";
import { todayWib, type ProfileDraft } from "../../../lib/pocketProfile";

export const runtime = "nodejs";

/**
 * "Rencana dadakan": the user describes something coming up (a friend's AYCE invite) and
 * Nera works out what it is, how much and by when. The model only understands the request
 * and talks; the pocket and the daily set-aside are computed by the app (planProfile), so
 * the numbers always add up. Only the chat itself is sent: no balances, no email data.
 */

const ICONS: BudgetPocketIcon[] = ["food", "fun", "gift", "travel", "shopping", "education", "transport", "health", "gadget", "home", "utility"];

type Msg = { role: "user" | "assistant"; content: string };
type Answer = { reply: string; draft: ProfileDraft | null };

const system = (today: string) => {
  const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" }).format(new Date(`${today}T00:00:00Z`));
  return `
Kamu Nera, teman finansial mahasiswa di wondr by BNI. User cerita ada rencana mendadak (diajak AYCE, nonton, kado teman, trip) dan ingin menyisihkan uang untuk itu. Hari ini ${weekday}, ${today}.

Tugasmu: pahami acaranya, berapa uang yang dibutuhkan, dan tanggal acaranya. Aplikasi yang akan menghitung berapa yang disisihkan per hari dan dari kantong mana, jadi JANGAN menghitung atau menyebut angka per hari.

Balas HANYA dengan JSON:
{"reply": string, "draft": null | {"occasion": string, "name": string, "amount": number, "dueDate": "YYYY-MM-DD", "icon": string}}

Aturan:
- reply: 1-2 kalimat, bahasa Indonesia santai, hangat, tanpa menghakimi. Boleh satu tips singkat yang relevan (misal AYCE sering belum termasuk minuman atau pajak). Jangan sarankan pinjaman atau paylater.
- Kalau nominal atau tanggal belum jelas, draft = null dan reply berisi SATU pertanyaan untuk melengkapinya.
- amount dalam rupiah penuh (200rb = 200000). Pakai angka dari user; kalau user minta ditambah cadangan, masukkan ke amount.
- dueDate: hitung dari hari ini; "Sabtu" = Sabtu terdekat yang belum lewat.
- name: maksimal 18 karakter, untuk kartu kantong (misal "AYCE Sabtu").
- occasion: acaranya dengan kata-kata user (misal "AYCE bareng teman").
- icon salah satu: ${ICONS.join(", ")}.
`.trim();
};

/** Keeps only a draft that makes sense; anything off becomes a gap the rules may fill. */
function clean(d: unknown, today: string): Partial<ProfileDraft> {
  if (!d || typeof d !== "object") return {};
  const o = d as Record<string, unknown>;
  const out: Partial<ProfileDraft> = {};
  if (typeof o.amount === "number" && o.amount >= 1_000 && o.amount <= 50_000_000) out.amount = Math.round(o.amount);
  if (typeof o.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.dueDate) && o.dueDate >= today && o.dueDate <= `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`)
    out.dueDate = o.dueDate;
  if (typeof o.icon === "string" && ICONS.includes(o.icon as BudgetPocketIcon)) out.icon = o.icon as BudgetPocketIcon;
  if (typeof o.name === "string" && o.name.trim()) out.name = o.name.trim().slice(0, 24);
  if (typeof o.occasion === "string" && o.occasion.trim()) out.occasion = o.occasion.trim().slice(0, 60);
  return out;
}

const parseJson = (text: string): { reply?: unknown; draft?: unknown } | null => {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
};

async function askMaia(messages: Msg[], sys: string): Promise<string | null> {
  const key = process.env.MAIA_API_KEY;
  if (!key) return null;
  const base = process.env.MAIA_BASE_URL || "https://api.maiarouter.ai/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.MAIA_MODEL || "xai/grok-4-1-fast-non-reasoning",
      temperature: 0.4,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sys }, ...messages],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? null;
}

async function askGemini(messages: Msg[], sys: string): Promise<string | null> {
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const model = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      systemInstruction: { parts: [{ text: sys }] },
      generationConfig: { temperature: 0.4, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  return body.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? null;
}

/** Without a model: the rules read the request, and the reply asks for whatever is missing. */
function ruleReply(d: Partial<ProfileDraft>): string {
  if (!d.amount && !d.dueDate) return "Seru! Kira-kira butuh berapa, dan acaranya kapan?";
  if (!d.amount) return "Oke, kira-kira butuh berapa untuk acaranya?";
  if (!d.dueDate) return "Siap. Acaranya hari apa atau tanggal berapa?";
  if (d.icon === "food") return "Asik! Nera sudah siapkan kantongnya. Tips: AYCE sering belum termasuk minuman atau pajak, jadi lebihkan sedikit kalau bisa.";
  return "Siap, Nera sudah siapkan kantongnya. Cek dulu rinciannya di bawah ya.";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const messages: Msg[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m: Msg) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m: Msg) => ({ role: m.role, content: m.content.slice(0, 600) }));
  if (!messages.some((m) => m.role === "user")) return Response.json({ error: "Ceritakan dulu rencanamu" }, { status: 400 });

  const today = todayWib();
  const rules = extractDraft(
    messages.filter((m) => m.role === "user").map((m) => m.content),
    today,
  );

  const sys = system(today);
  const raw = await askMaia(messages, sys)
    .catch(() => null)
    .then((r) => r ?? askGemini(messages, sys).catch(() => null));
  const ai = raw ? parseJson(raw) : null;

  // the model's reading wins; the rules fill what it left out
  const merged: Partial<ProfileDraft> = { ...rules, ...clean(ai?.draft, today) };
  // a model that answered with a question means something is still unclear
  const complete = merged.amount && merged.dueDate && !(ai && ai.draft === null);
  const draft: ProfileDraft | null = complete
    ? {
        amount: merged.amount!,
        dueDate: merged.dueDate!,
        icon: merged.icon ?? "fun",
        occasion: merged.occasion ?? merged.name ?? "Rencana dadakan",
        name: merged.name ?? merged.occasion ?? "Rencana dadakan",
      }
    : null;
  const reply = typeof ai?.reply === "string" && ai.reply.trim() ? ai.reply.trim() : ruleReply(merged);

  return Response.json({ reply, draft } satisfies Answer);
}
