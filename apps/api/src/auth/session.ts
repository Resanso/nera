import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export type Session = { userId: string; email: string };

const COOKIE = "nera_session";
const MAX_AGE_S = 30 * 24 * 60 * 60;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET belum diset (min. 32 karakter). Buat dengan: openssl rand -hex 32");
  return s;
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
}

/** HttpOnly, signed, 30 days. SameSite=Lax still sends it on the OAuth redirect back to us. */
export function setSession(res: Response, s: Session) {
  const body = Buffer.from(JSON.stringify({ u: s.userId, e: s.email, x: Date.now() + MAX_AGE_S * 1000 })).toString("base64url");
  const secure = (process.env.WEB_APP_URL ?? "").startsWith("https") ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${body}.${sign(body)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure}`);
}

export function clearSession(res: Response) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function getSession(req: Request): Session | null {
  const raw = readCookie(req, COOKIE);
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const { u, e, x } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { u: string; e: string; x: number };
  return Date.now() < x ? { userId: u, email: e } : null;
}

const sessions = new WeakMap<Request, Session>();

/** Session of a request that passed requireSession. */
export function sessionOf(req: Request): Session {
  const s = sessions.get(req);
  if (!s) throw new Error("requireSession tidak dipasang untuk rute ini");
  return s;
}

export function requireSession(req: Request, res: Response, next: NextFunction) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ success: false, error: "Silakan masuk dulu." });
  sessions.set(req, s);
  next();
}
