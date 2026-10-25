import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function key(): Buffer {
  const raw = process.env.EMAIL_TOKEN_KEY;
  if (!raw) throw new Error("EMAIL_TOKEN_KEY belum diset (32 byte, base64). Buat dengan: openssl rand -base64 32");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("EMAIL_TOKEN_KEY harus 32 byte (base64)");
  return k;
}

/** AES-256-GCM. Output: iv.tag.ciphertext (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export type OAuthState =
  | { p: "gmail"; u: string }
  | { p: "login"; r: string };

/** Signed, expiring OAuth `state`: the callback can't be replayed or pointed at another user. */
export function signState(state: OAuthState, ttlMs = 10 * 60_000): string {
  const body = Buffer.from(JSON.stringify({ ...state, e: Date.now() + ttlMs, n: randomBytes(8).toString("hex") })).toString("base64url");
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): OAuthState | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const { e, ...rest } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState & { e: number };
  return Date.now() < e ? rest : null;
}
