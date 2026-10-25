import { Router } from "express";
import { clearSession, getSession } from "../auth/session";
import { isGmailConfigured, loginAuthUrl } from "../email/gmail";

export const authRouter: Router = Router();

const safeReturnTo = (r: unknown) => (typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : "/");

// "Masuk dengan Google"; the callback lives at /api/email/gmail/callback (the registered URI)
authRouter.get("/google", (req, res) => {
  if (!isGmailConfigured()) return res.status(503).json({ success: false, error: "Login Google belum dikonfigurasi" });
  res.redirect(loginAuthUrl(safeReturnTo(req.query.returnTo)));
});

authRouter.get("/me", (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ success: false });
  res.json({ success: true, data: { email: s.email } });
});

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ success: true });
});
