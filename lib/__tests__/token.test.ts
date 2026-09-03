import { describe, it, expect } from "vitest";
import { generateScreenToken, hashScreenToken, verifyScreenToken } from "@/lib/screen/token";

describe("screen token", () => {
  it("generates a high-entropy token each time", () => {
    const a = generateScreenToken();
    const b = generateScreenToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(30);
  });

  it("verifies a token against its own hash", () => {
    const token = generateScreenToken();
    const hash = hashScreenToken(token);
    expect(verifyScreenToken(token, hash)).toBe(true);
  });

  it("rejects a token that doesn't match the hash", () => {
    const token = generateScreenToken();
    const hash = hashScreenToken(generateScreenToken());
    expect(verifyScreenToken(token, hash)).toBe(false);
  });

  it("never stores the raw token — hash is a one-way digest", () => {
    const token = generateScreenToken();
    const hash = hashScreenToken(token);
    expect(hash).not.toEqual(token);
  });
});
