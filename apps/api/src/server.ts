import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { riskRouter } from "./routes/risk";
import { simulationRouter } from "./routes/simulation";
import { coachRouter } from "./routes/coach";
import { bniMockRouter } from "./routes/bni-mock";
import { emailRouter } from "./routes/email";
import { authRouter } from "./routes/auth";
import { startSmtpServer } from "./email/smtp";
import { startGmailScheduler } from "./email/gmail";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// the web app sends the session cookie; only its own origin may make credentialed calls
app.use(cors({ origin: process.env.WEB_APP_URL ?? "http://localhost:3000", credentials: true }));
app.use(express.json());

// API Routes
app.use("/api/risk", riskRouter);
app.use("/api/simulation", simulationRouter);
app.use("/api/coach", coachRouter);
app.use("/api/bni", bniMockRouter);
app.use("/api/email", emailRouter);
app.use("/api/auth", authRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "NERA Financial Safety Engine",
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`[NERA API] Server running on http://localhost:${port}`);
});

// inbound mail for forwarding addresses; off unless SMTP_PORT is set
startSmtpServer();
// keep linked Gmail inboxes in sync (push + polling fallback)
startGmailScheduler();
