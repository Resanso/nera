import "dotenv/config";
import { startGmailScheduler } from "./email/gmail";
import { startSmtpServer } from "./email/smtp";
import { startReminderScheduler } from "./push/reminders";

/**
 * Background work that must run exactly once per deployment, independent of the
 * blue/green web+api swap: the inbound SMTP server (owns host port 25) and the Gmail
 * sync scheduler, and the pocket reminders (Web Push). Enable each with SMTP_PORT,
 * GMAIL_POLL_MINUTES and VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY.
 */
startSmtpServer();
startGmailScheduler();
startReminderScheduler();
// the scheduler's timers are unref'd; keep the process alive even without SMTP
setInterval(() => undefined, 1 << 30);
console.log("[NERA worker] started");
