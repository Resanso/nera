import { emailStore, type ConsentKind } from "./store";

/**
 * Version of the consent texts shown in the app (and /privacy). Bump it when what we
 * do with the data changes; an older grant then no longer counts and users are asked again.
 */
export const CONSENT_VERSION = "2026-10-27";

export class ConsentRequired extends Error {
  constructor(public kind: ConsentKind) {
    super(
      kind === "email_import"
        ? "Setujui dulu impor email di halaman Impor dari Email."
        : kind === "email_planning"
          ? "Estimasi dari struk email belum disetujui."
          : "Bantuan AI belum disetujui.",
    );
  }
}

export async function hasConsent(userId: string, kind: ConsentKind): Promise<boolean> {
  const c = (await emailStore.getConsents(userId))[kind];
  return Boolean(c?.granted && c.version === CONSENT_VERSION);
}

export async function requireConsent(userId: string, kind: ConsentKind) {
  if (!(await hasConsent(userId, kind))) throw new ConsentRequired(kind);
}
