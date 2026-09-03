// Excludes visually ambiguous characters: 0/O, 1/I/L, and vowels that could
// spell something awkward. Kept short and dictated-over-the-phone friendly.
const CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const PAIRING_CODE_TTL_MINUTES = 15;

function randomChar(): string {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return CHARSET[bytes[0]! % CHARSET.length]!;
}

/** Generates a code like "K7P4-X9" (4 chars, dash, 2 chars). */
export function generatePairingCode(): string {
  const part1 = Array.from({ length: 4 }, randomChar).join("");
  const part2 = Array.from({ length: 2 }, randomChar).join("");
  return `${part1}-${part2}`;
}

export function pairingCodeExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + PAIRING_CODE_TTL_MINUTES * 60 * 1000);
}

/** Normalizes user-entered codes: uppercase, strips whitespace, tolerates a missing dash. */
export function normalizePairingCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (cleaned.includes("-")) return cleaned;
  if (cleaned.length === 6) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  return cleaned;
}
