/**
 * Cloudflare Email Worker for option B (forwarding address).
 *
 * Setup:
 * 1. Cloudflare Email Routing on INBOUND_EMAIL_DOMAIN (e.g. inbox.nera.id),
 *    catch-all rule -> "Send to a Worker" -> this worker.
 * 2. Worker vars: NERA_INBOUND_URL = https://<api>/api/email/inbound
 *    Worker secret: INBOUND_WEBHOOK_SECRET (same value as the API's env).
 *
 * The worker only relays the raw MIME; parsing and the sender allowlist live in the API.
 */
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).arrayBuffer();
    const res = await fetch(env.NERA_INBOUND_URL, {
      method: "POST",
      headers: {
        "content-type": "message/rfc822",
        "x-inbound-secret": env.INBOUND_WEBHOOK_SECRET,
        "x-envelope-to": message.to,
      },
      body: raw,
    });
    if (res.status === 404) {
      message.setReject("Alamat tidak dikenal");
      return;
    }
    // any other failure: throw so the delivery is retried instead of silently dropped
    if (!res.ok) throw new Error(`Nera inbound gagal: ${res.status}`);
  },
};
