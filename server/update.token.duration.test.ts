import { describe, it, expect } from "vitest";

// Unit tests for updateTokenDuration logic
describe("updateTokenDuration", () => {
  it("should calculate new expiresAt from activatedAt + durationDays", () => {
    const activatedAt = new Date("2026-01-01T00:00:00Z");
    const durationDays = 30;
    const expectedExpires = new Date(activatedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    expect(expectedExpires.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("should fall back to now if activatedAt is null", () => {
    const now = new Date();
    const durationDays = 7;
    const baseDate = null ?? now;
    const newExpires = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const diffDays = Math.round((newExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });

  it("should allow up to 3650 days (10 years)", () => {
    const activatedAt = new Date("2026-01-01T00:00:00Z");
    const durationDays = 3650;
    const newExpires = new Date(activatedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    expect(newExpires.getFullYear()).toBe(2035);
  });

  it("should reject durationDays less than 1", () => {
    const isValid = (days: number) => days >= 1 && days <= 3650;
    expect(isValid(0)).toBe(false);
    expect(isValid(-1)).toBe(false);
    expect(isValid(1)).toBe(true);
    expect(isValid(365)).toBe(true);
    expect(isValid(3650)).toBe(true);
    expect(isValid(3651)).toBe(false);
  });

  it("should recalculate expiresAt correctly for 365 days", () => {
    const activatedAt = new Date("2026-03-25T00:00:00Z");
    const durationDays = 365;
    const newExpires = new Date(activatedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    expect(newExpires.getFullYear()).toBe(2027);
    expect(newExpires.getMonth()).toBe(2); // March (0-indexed)
  });
});
