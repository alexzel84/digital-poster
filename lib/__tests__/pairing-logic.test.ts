import { describe, it, expect } from "vitest";
import { evaluatePairing, type PairableScreen } from "@/lib/screen/pairing-logic";

function makeScreen(overrides: Partial<PairableScreen> = {}): PairableScreen {
  return {
    id: "screen_1",
    pairingCode: "K7P4-X9",
    pairingCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    screenTokenHash: null,
    ...overrides,
  };
}

describe("evaluatePairing", () => {
  it("accepts a valid, unexpired, unpaired code", () => {
    const result = evaluatePairing(makeScreen(), "K7P4-X9");
    expect(result.ok).toBe(true);
  });

  it("rejects when no screen matches the code", () => {
    const result = evaluatePairing(null, "K7P4-X9");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects a code that doesn't match the screen's code", () => {
    const result = evaluatePairing(makeScreen({ pairingCode: "AAAA-11" }), "K7P4-X9");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects an already-paired screen (token already issued)", () => {
    const result = evaluatePairing(
      makeScreen({ screenTokenHash: "somehash" }),
      "K7P4-X9"
    );
    expect(result).toEqual({ ok: false, reason: "already_paired" });
  });

  it("rejects an expired pairing code", () => {
    const result = evaluatePairing(
      makeScreen({ pairingCodeExpiresAt: new Date(Date.now() - 1000) }),
      "K7P4-X9"
    );
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects when pairingCodeExpiresAt is null", () => {
    const result = evaluatePairing(
      makeScreen({ pairingCodeExpiresAt: null }),
      "K7P4-X9"
    );
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("treats the exact expiry instant as expired (boundary)", () => {
    const now = new Date();
    const result = evaluatePairing(
      makeScreen({ pairingCodeExpiresAt: now }),
      "K7P4-X9",
      now
    );
    expect(result).toEqual({ ok: false, reason: "expired" });
  });
});
