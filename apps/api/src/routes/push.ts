import { Router, type Request } from "express";
import { z } from "zod";
import { requireSession, sessionOf } from "../auth/session";
import { pushStore } from "../push/store";
import { isPushConfigured, sendToUser } from "../push/reminders";

/** Web Push reminders: turning them on per browser, and the pocket fields they need. */
export const pushRouter: Router = Router();
pushRouter.use(requireSession);

const userIdOf = (req: Request) => sessionOf(req).userId;

const Subscription = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

pushRouter.get("/config", async (req, res) => {
  const userId = userIdOf(req);
  const endpoint = typeof req.query.endpoint === "string" ? req.query.endpoint : undefined;
  const subs = await pushStore.subscriptionsFor(userId);
  const prefs = await pushStore.getPrefs(userId);
  res.json({
    success: true,
    data: {
      enabled: isPushConfigured(),
      publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
      // this browser, when it says which one it is
      subscribed: endpoint ? subs.some((s) => s.endpoint === endpoint) : subs.length > 0,
      showAmounts: prefs.showAmounts,
    },
  });
});

pushRouter.post("/subscribe", async (req, res) => {
  if (!isPushConfigured()) return res.status(503).json({ success: false, error: "Pengingat belum aktif di server" });
  const body = z.object({ subscription: Subscription, showAmounts: z.boolean().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Langganan notifikasi tidak valid" });
  const userId = userIdOf(req);
  await pushStore.addSubscription({ userId, ...body.data.subscription, createdAt: new Date().toISOString() });
  if (body.data.showAmounts !== undefined) await pushStore.setPrefs({ ...(await pushStore.getPrefs(userId)), showAmounts: body.data.showAmounts });
  res.json({ success: true, data: null });
});

pushRouter.post("/unsubscribe", async (req, res) => {
  const body = z.object({ endpoint: z.string().max(1000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Endpoint tidak valid" });
  const userId = userIdOf(req);
  const mine = (await pushStore.subscriptionsFor(userId)).some((s) => s.endpoint === body.data.endpoint);
  if (mine) await pushStore.removeSubscription(body.data.endpoint);
  // no browser left to remind: nothing about the user's pockets stays on the server
  if (!(await pushStore.subscriptionsFor(userId)).length) await pushStore.deleteUser(userId);
  res.json({ success: true, data: null });
});

pushRouter.patch("/prefs", async (req, res) => {
  const body = z.object({ showAmounts: z.boolean() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Pengaturan tidak valid" });
  const userId = userIdOf(req);
  await pushStore.setPrefs({ ...(await pushStore.getPrefs(userId)), showAmounts: body.data.showAmounts });
  res.json({ success: true, data: null });
});

const ReminderInput = z.object({
  pocketId: z.string().min(1).max(80),
  name: z.string().min(1).max(40),
  occasion: z.string().min(1).max(80),
  target: z.number().int().min(0).max(1_000_000_000),
  saved: z.number().int().min(0).max(1_000_000_000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lastTopupAt: z.string().datetime().optional(),
});

pushRouter.put("/reminders", async (req, res) => {
  const body = z.object({ reminders: z.array(ReminderInput).max(30) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Data pengingat tidak valid" });
  const userId = userIdOf(req);
  // kept only while some browser has reminders on
  if (!(await pushStore.subscriptionsFor(userId)).length) return res.json({ success: true, data: { stored: false } });
  await pushStore.setReminders(userId, body.data.reminders);
  res.json({ success: true, data: { stored: true } });
});

pushRouter.post("/test", async (req, res) => {
  const sent = await sendToUser(userIdOf(req), {
    title: "Pengingat Nera aktif",
    body: "Nera akan mengingatkanmu menyisihkan uang untuk rencana dadakan, paling banyak sekali sehari.",
    url: "/pockets",
    tag: "test",
  });
  if (!sent) return res.status(409).json({ success: false, error: "Belum ada browser yang menyalakan pengingat" });
  res.json({ success: true, data: { sent } });
});
