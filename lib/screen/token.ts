import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** Raw, high-entropy token. Given to the TV once, at pairing time, and never again. */
export function generateScreenToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Deterministic hash stored in the database. The raw token is never persisted server-side. */
export function hashScreenToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison to avoid leaking hash equality via response timing. */
export function verifyScreenToken(token: string, hash: string): boolean {
  const candidate = hashScreenToken(token);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
