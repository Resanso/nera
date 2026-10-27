import { Router, type Request } from "express";
import { requireSession, sessionOf } from "../auth/session";
import { hasConsent } from "../email/consent";
import { emailStore } from "../email/store";
import { isCounted } from "../email/types";
import { ImportInput, Op, OpError, applyOp, monthStartWib, type WalletState } from "../wallet/ops";
import { walletStore } from "../wallet/store";

/**
 * Aset Saya, Kantong Utama, pockets and their history, kept per signed-in user. The web app
 * caches it, but every change goes through POST /op and the reply is the new truth.
 *
 * With the "email_planning" consent, Kantong Utama also follows email receipts: what is
 * stored is the balance at the anchor (when the user last entered or confirmed it), and every
 * counted receipt after the anchor is taken off when it is read. Receipts the user later
 * hides or recategorizes give their amount back by themselves. Email income is left out
 * (mostly refunds and misreads); a weekly check asks the user to confirm instead.
 */
export const walletRouter: Router = Router();
walletRouter.use(requireSession);

const userIdOf = (req: Request) => sessionOf(req).userId;

/** Counted receipts since the anchor, while the balance follows email. */
async function emailDeduction(userId: string, s: WalletState) {
  if (!s.assetsSet || !s.anchorAt || !(await hasConsent(userId, "email_planning"))) return null;
  const since = s.anchorAt;
  const spends = (await emailStore.listTransactions(userId)).filter((t) => isCounted(t) && t.occurredAt > since);
  return { amount: spends.reduce((sum, t) => sum + t.amount, 0), receipts: spends.length, since };
}

/** What the app shows: pockets with this month's spending, and recent history (for runway too). */
async function view(userId: string, s: WalletState) {
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const [activity, deduction] = await Promise.all([walletStore.activitySince(userId, since), emailDeduction(userId, s)]);
  const monthStart = monthStartWib();
  const spent = new Map<string, number>();
  for (const a of activity) if (a.kind === "spend" && a.at >= monthStart) spent.set(a.pocketId, (spent.get(a.pocketId) ?? 0) + a.amount);
  return {
    // not clamped at 0: below 0 means money came in that Nera can't see, and Kantong asks for the balance
    main: s.main - (deduction?.amount ?? 0),
    assetsSet: s.assetsSet,
    monthlyIncome: s.monthlyIncome,
    incomeDay: s.incomeDay,
    anchorAt: s.anchorAt,
    emailDeduction: deduction,
    pockets: s.pockets.map(({ reachedTarget: _r, ...p }) => ({ ...p, spentThisMonth: spent.get(p.id) ?? 0 })),
    activity,
  };
}

walletRouter.get("/", async (req, res) => {
  const userId = userIdOf(req);
  const s = await walletStore.get(userId);
  res.json({ success: true, data: s ? await view(userId, s) : null });
});

/** First connection: the device's pockets become the account's. Ignored once a wallet exists. */
walletRouter.post("/import", async (req, res) => {
  const body = ImportInput.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Data kantong tidak valid" });
  const userId = userIdOf(req);
  const d = body.data;
  const ids = new Set(d.pockets.map((p) => p.id));
  // balances only count once the user entered their own total; before that they were demo money.
  // The device's Kantong Utama already has its receipts taken off, so receipts count from now.
  const state: WalletState = {
    main: d.assetsSet ? d.main : 0,
    assetsSet: d.assetsSet,
    monthlyIncome: d.monthlyIncome,
    incomeDay: d.incomeDay ?? null,
    anchorAt: d.assetsSet ? new Date().toISOString() : null,
    pockets: d.pockets.map((p) => ({ ...p, balance: d.assetsSet ? p.balance : 0 })),
  };
  await walletStore.create(
    userId,
    state,
    d.activity.filter((a) => ids.has(a.pocketId)),
  );
  const s = (await walletStore.get(userId))!;
  res.json({ success: true, data: await view(userId, s) });
});

walletRouter.post("/op", async (req, res) => {
  const op = Op.safeParse(req.body);
  if (!op.success) return res.status(400).json({ success: false, error: "Perintah tidak valid" });
  const userId = userIdOf(req);
  const current = await walletStore.get(userId);
  if (!current) return res.status(409).json({ success: false, error: "Kantong belum tersambung, muat ulang halaman" });
  // ops see the balance the user sees (receipts taken off); what is stored stays the anchored one
  const taken = (await emailDeduction(userId, current))?.amount ?? 0;
  try {
    const s = await walletStore.mutate(userId, (cur) => {
      const r = applyOp({ ...cur, main: cur.main - taken }, op.data);
      // a new anchor starts from the balance as shown; otherwise the receipts stay derived
      const reanchored = r.state.anchorAt !== cur.anchorAt;
      return { ...r, state: { ...r.state, main: reanchored ? r.state.main : r.state.main + taken } };
    });
    res.json({ success: true, data: await view(userId, s) });
  } catch (e) {
    if (e instanceof OpError) return res.status(409).json({ success: false, error: e.message });
    throw e;
  }
});
