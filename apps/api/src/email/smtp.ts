import { readFileSync } from "node:fs";
import { SMTPServer } from "smtp-server";
import { dkimVerify } from "mailauth/lib/dkim/verify";
import { handleInbound } from "./forward";
import { emailStore } from "./store";

const MAX_BYTES = 15 * 1024 * 1024;

const smtpError = (message: string, responseCode: number) => Object.assign(new Error(message), { responseCode });

/** Let's Encrypt files for STARTTLS; mail is still accepted without TLS if they're missing. */
function tlsFiles() {
  const dir = process.env.SMTP_TLS_DIR;
  if (!dir) return null;
  try {
    return { key: readFileSync(`${dir}/privkey.pem`), cert: readFileSync(`${dir}/fullchain.pem`) };
  } catch {
    return null;
  }
}

/**
 * Inbound-only SMTP for forwarding addresses (option B, self-hosted).
 * Accepts mail only for existing aliases and never relays. Receipts must carry a
 * passing DKIM signature aligned with the From domain, so a forged "From: gojek"
 * sent straight to an alias can't inject transactions. Gmail forwarding keeps the
 * original DKIM signature intact.
 */
export function startSmtpServer() {
  const port = Number(process.env.SMTP_PORT ?? 0);
  if (!port) return;
  const tls = tlsFiles();

  const server = new SMTPServer({
    name: process.env.SMTP_HOSTNAME ?? "localhost",
    banner: "Nera inbound",
    authOptional: true,
    disabledCommands: ["AUTH"],
    size: MAX_BYTES,
    maxClients: 50,
    ...(tls ?? { hideSTARTTLS: true }),
    onRcptTo(address, _session, callback) {
      if (!emailStore.getAlias(address.address)) return callback(smtpError("Alamat tidak dikenal", 550));
      callback();
    },
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", async () => {
        if (stream.sizeExceeded) return callback(smtpError("Email terlalu besar", 552));
        const raw = Buffer.concat(chunks);
        try {
          const dkim = await dkimVerify(raw);
          const dkimDomains = dkim.results.filter((r) => r.status.result === "pass").map((r) => r.signingDomain.toLowerCase());
          for (const rcpt of session.envelope.rcptTo) {
            const outcome = await handleInbound(rcpt.address, raw, { dkimDomains });
            console.log(`[NERA SMTP] ${rcpt.address.replace(/^(.{4}).*@/, "$1…@")} -> ${outcome.status}`);
          }
          callback();
        } catch (e) {
          console.error("[NERA SMTP]", (e as Error).message);
          // temporary failure: the sending server retries later
          callback(smtpError("Coba lagi nanti", 451));
        }
      });
    },
  });

  server.on("error", (e) => console.error("[NERA SMTP]", e.message));
  server.listen(port, () => console.log(`[NERA SMTP] listening on ${port}${tls ? " with STARTTLS" : ""}`));

  // certbot renews the certificate in place; pick it up without a restart
  if (tls) {
    setInterval(() => {
      const next = tlsFiles();
      if (next) server.updateSecureContext(next);
    }, 12 * 60 * 60 * 1000).unref();
  }
}
