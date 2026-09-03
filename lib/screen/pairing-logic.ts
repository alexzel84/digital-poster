export interface PairableScreen {
  id: string;
  pairingCode: string;
  pairingCodeExpiresAt: Date | null;
  screenTokenHash: string | null;
}

export type PairResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "already_paired" };

/**
 * Decides whether a given screen row is eligible to be paired against the
 * supplied code, at the given moment in time. Pure function — no I/O — so
 * it can be tested directly without a database.
 */
export function evaluatePairing(
  screen: PairableScreen | null,
  submittedCode: string,
  now: Date = new Date()
): PairResult {
  if (!screen || screen.pairingCode !== submittedCode) {
    return { ok: false, reason: "not_found" };
  }
  if (screen.screenTokenHash !== null) {
    return { ok: false, reason: "already_paired" };
  }
  if (!screen.pairingCodeExpiresAt || screen.pairingCodeExpiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}
