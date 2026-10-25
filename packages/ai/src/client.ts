import { NERA_SYSTEM_PROMPT } from "./prompts";

export interface MaiaClientOptions {
  apiKey?: string;
  baseUrl?: string;
}

export class MaiaAIClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options?: MaiaClientOptions) {
    this.apiKey = options?.apiKey || process.env.MAIA_API_KEY || "";
    this.baseUrl = options?.baseUrl || process.env.MAIA_BASE_URL || "https://router.maia.id/v1";
  }

  async generateChatResponse(messages: { role: "system" | "user" | "assistant"; content: string }[]): Promise<string> {
    if (!this.apiKey) {
      return this.getFallbackResponse(messages[messages.length - 1]?.content || "");
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: NERA_SYSTEM_PROMPT },
            ...messages,
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        return this.getFallbackResponse(messages[messages.length - 1]?.content || "");
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content || this.getFallbackResponse("");
    } catch {
      return this.getFallbackResponse(messages[messages.length - 1]?.content || "");
    }
  }

  /** Whether a real model is configured (fallback responses are used otherwise). */
  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * One-shot structured extraction: no Nera persona, deterministic, JSON only.
   * Returns null when no model is configured or the call fails, so callers keep their own fallback.
   */
  async extractJson(system: string, user: string): Promise<unknown | null> {
    if (!this.apiKey) return null;
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      return typeof content === "string" ? JSON.parse(content) : null;
    } catch {
      return null;
    }
  }

  private getFallbackResponse(userMessage: string): string {
    const lower = userMessage.toLowerCase();
    if (lower.includes("uang saku") || lower.includes("allowance") || lower.includes("budget")) {
      return "Hai! Dengan Smart Allowance Splitter di Nera, uang saku kamu otomatis dialokasikan: 80% untuk Kebutuhan Harian dan 20% langsung diamankan ke BNI Life Goals. Ini memastikan runway harianmu tetap sehat!";
    }
    if (lower.includes("pinjam") || lower.includes("cicilan") || lower.includes("simulasi")) {
      return "Sebelum mengambil komitmen cicilan baru, yuk hitung beban DTI dan defisit bulanan di menu Simulasi Risiko. Kami juga menyediakan alternatif aman kampus seperti Kopma atau Dana Darurat 0% bunga!";
    }
    if (lower.includes("investasi") || lower.includes("reksa dana") || lower.includes("sbn")) {
      return "Keren! Untuk mulai berinvestasi di Reksa Dana wondr atau SBN, pastikan Dana Darurat (Tier 1) di BNI Life Goals sudah terpenuhi 100% dan skor finansialmu dalam status AMAN ya!";
    }
    return "Halo! Saya NerAI, asisten keamanan finansialmu di wondr by BNI. Ada pos pengeluaran atau perencanaan tabungan yang ingin kita diskusikan hari ini?";
  }
}

export const maiaClient = new MaiaAIClient();

export interface NeraGoogleAIClientOptions {
  apiKey?: string;
  model?: string;
}

export class NeraGoogleAIClient {
  private apiKey: string;
  private model: string;

  constructor(options?: NeraGoogleAIClientOptions) {
    this.apiKey =
      options?.apiKey ||
      process.env.GOOGLE_AI_STUDIO_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";
    this.model = options?.model || process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";
  }

  async generateChatResponse(messages: { role: "system" | "user" | "assistant"; content: string }[]): Promise<string> {
    if (!this.apiKey) {
      return this.getFallbackResponse(messages[messages.length - 1]?.content || "");
    }

    try {
      const formattedContents = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: formattedContents,
          systemInstruction: {
            parts: [{ text: NERA_SYSTEM_PROMPT }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        return this.getFallbackResponse(messages[messages.length - 1]?.content || "");
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text || this.getFallbackResponse(messages[messages.length - 1]?.content || "");
    } catch {
      return this.getFallbackResponse(messages[messages.length - 1]?.content || "");
    }
  }

  private getFallbackResponse(userMessage: string): string {
    const lower = userMessage.toLowerCase();
    if (lower.includes("pinjol") || lower.includes("pinjam") || lower.includes("cicilan") || lower.includes("utang")) {
      return "Pinjaman online atau cicilan konsumtif dapat mengganggu cashflow harianmu. Nera menyarankan periksa izin resmi OJK, batasi rasio cicilan maksimal 20-30% dari uang saku, dan gunakan metode Debt Snowball untuk melunasi satu per satu.";
    }
    return "Halo! Saya Nera, AI Recovery Consultant di wondr by BNI. Ada hal terkait cicilan, simulasi risiko, atau rencana pemulihan keuangan yang ingin kamu konsultasikan?";
  }
}

export const neraGoogleAIClient = new NeraGoogleAIClient();
