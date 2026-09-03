import { describe, it, expect } from "vitest";
import { generateInviteToken, hashInviteToken, inviteExpiresAt } from "@/lib/screen/invite-token";

describe("invite token", () => {
  it("generates a different token each time", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it("hashes deterministically — same token always hashes the same", () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).toEqual(hashInviteToken(token));
  });

  it("different tokens hash differently", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(hashInviteToken(a)).not.toEqual(hashInviteToken(b));
  });

  it("the hash is never equal to the raw token", () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).not.toEqual(token);
  });

  it("expires 7 days from the given moment", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const expires = inviteExpiresAt(from);
    const diffDays = (expires.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(7, 5);
  });
});
