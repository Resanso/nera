import "dotenv/config";
import { startGmailScheduler } from "./email/gmail";
import { startSmtpServer } from "./email/smtp";

/**
 * Background work that must run exactly once per deployment, independent of the
 * blue/green web+api swap: the inbound SMTP server (owns host port 25) and the Gmail
 * sync scheduler. Enable each with SMTP_PORT and GMAIL_POLL_MINUTES.
 */
startSmtpServer();
startGmailScheduler();
// the scheduler's timers are unref'd; keep the process alive even without SMTP
setInterval(() => undefined, 1 << 30);
console.log("[NERA worker] started");
