import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
// Express 4 ignores rejected promises from async handlers; this routes them to the error handler
import "express-async-errors";
import cors from "cors";
import { riskRouter } from "./routes/risk";
import { simulationRouter } from "./routes/simulation";
import { bniMockRouter } from "./routes/bni-mock";
import { emailRouter } from "./routes/email";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { pushRouter } from "./routes/push";
import { walletRouter } from "./routes/wallet";
import { startSmtpServer } from "./email/smtp";
import { startGmailScheduler } from "./email/gmail";
import { ConsentRequired } from "./email/consent";

const app = express();
const port = process.env.PORT || 4000;

// the web app sends the session cookie; only its own origin may make credentialed calls
app.use(cors({ origin: process.env.WEB_APP_URL ?? "http://localhost:3000", credentials: true }));
app.use(express.json());

// API Routes
app.use("/api/risk", riskRouter);
app.use("/api/simulation", simulationRouter);
app.use("/api/bni", bniMockRouter);
app.use("/api/email", emailRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/push", pushRouter);
app.use("/api/wallet", walletRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "NERA Financial Safety Engine",
    timestamp: new Date().toISOString(),
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // a missing consent is the user's decision, not a server fault
  if (err instanceof ConsentRequired) return res.status(403).json({ success: false, error: err.message, consentRequired: err.kind });
  console.error("[NERA API]", err.message);
  res.status(500).json({ success: false, error: "Terjadi kesalahan di server." });
});

app.listen(port, () => {
  console.log(`[NERA API] Server running on http://localhost:${port}`);
});

// inbound mail for forwarding addresses; off unless SMTP_PORT is set
startSmtpServer();
// keep linked Gmail inboxes in sync (push + polling fallback)
startGmailScheduler();
