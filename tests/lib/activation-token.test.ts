import { describe, it, expect } from "vitest";
import { generateActivationToken, isTokenExpired } from "@/lib/activation-token";

describe("generateActivationToken", () => {
  it("returns a token + expiration roughly 7 days in the future", () => {
    const before = Date.now();
    const { token, expiresAt } = generateActivationToken();
    expect(token).toBeTypeOf("string");
    expect(token.length).toBeGreaterThanOrEqual(32);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const delta = expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(sevenDays - 5000);
    expect(delta).toBeLessThan(sevenDays + 5000);
  });

  it("returns different tokens on subsequent calls", () => {
    const a = generateActivationToken();
    const b = generateActivationToken();
    expect(a.token).not.toBe(b.token);
  });
});

describe("isTokenExpired", () => {
  it("returns false when expiration is in the future", () => {
    const future = new Date(Date.now() + 60_000);
    expect(isTokenExpired(future)).toBe(false);
  });
  it("returns true when expiration is in the past", () => {
    const past = new Date(Date.now() - 60_000);
    expect(isTokenExpired(past)).toBe(true);
  });
  it("returns true when expiresAt is null", () => {
    expect(isTokenExpired(null)).toBe(true);
  });
});
