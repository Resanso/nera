import { Router, type NextFunction, type Request, type Response } from "express";
import { requireSession, sessionOf } from "../auth/session";
import { emailStore } from "../email/store";

export const adminRouter: Router = Router();

/** Comma-separated Google emails allowed into the admin dashboard. */
const admins = () =>
  new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!admins().has(sessionOf(req).email.toLowerCase())) return res.status(403).json({ success: false, error: "Bukan admin." });
  next();
}

adminRouter.use(requireSession, requireAdmin);

/**
 * Who has tried email import, and how far they got. Aggregates only: admins see usage,
 * not anyone's individual transactions.
 */
adminRouter.get("/overview", async (_req, res) => {
  const [known, links, withData] = await Promise.all([emailStore.listUsers(), emailStore.listGmail(), emailStore.listUserIdsWithData()]);
  const byId = new Map(known.map((u) => [u.id, u]));
  const users = [...new Set([...known.map((u) => u.id), ...withData])].map((id) => {
    // signed in before user tracking existed: show the Gmail address until they come back
    const fallback = links.find((l) => l.userId === id)?.googleEmail ?? id;
    return byId.get(id) ?? { id, email: fallback, createdAt: undefined, lastSeenAt: undefined, unverified: true };
  });
  const rows = await Promise.all(
    users.map(async (u) => {
      const [txs, alias, consents] = await Promise.all([
        emailStore.listTransactions(u.id),
        emailStore.getAliasForUser(u.id),
        emailStore.getConsents(u.id),
      ]);
      const gmail = links.find((l) => l.userId === u.id);
      const byChannel = { gmail: 0, forward: 0, demo: 0 };
      for (const t of txs) byChannel[t.channel]++;
      return {
        email: u.email,
        loginKnown: !("unverified" in u),
        firstSeenAt: u.createdAt,
        lastSeenAt: u.lastSeenAt,
        gmail: gmail ? { address: gmail.googleEmail, connectedAt: gmail.connectedAt, lastSyncAt: gmail.lastSyncAt } : null,
        forward: alias ? { status: alias.status, lastReceivedAt: alias.lastReceivedAt } : null,
        transactions: { total: txs.length, ...byChannel, needsReview: txs.filter((t) => t.needsReview).length },
        lastTransactionAt: txs[0]?.occurredAt,
        consent: { emailImport: Boolean(consents.email_import?.granted), aiProcessing: Boolean(consents.ai_processing?.granted) },
      };
    }),
  );
  res.json({
    success: true,
    data: {
      totals: {
        users: users.length,
        gmailConnected: links.length,
        forwardActive: rows.filter((r) => r.forward?.status === "active").length,
        transactions: rows.reduce((n, r) => n + r.transactions.total, 0),
      },
      users: rows,
    },
  });
});
