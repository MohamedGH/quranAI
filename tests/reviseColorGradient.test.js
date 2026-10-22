import { describe, it, expect } from "vitest";
import {
  getDaysElapsed,
  getElapsedRatio,
  getReviseTimeColor,
  getWordReviseDate,
} from "../src/utils/reviseColorGradient.js";

describe("reviseColorGradient", () => {
  it("calculates days elapsed correctly", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    const twoDaysAgo = new Date("2026-10-20T12:00:00Z").toISOString();
    expect(getDaysElapsed(twoDaysAgo, now)).toBeCloseTo(2, 1);

    expect(getDaysElapsed(null, now)).toBe(0);
    expect(getDaysElapsed("invalid-date", now)).toBe(0);
  });

  it("produces blanc for freshly marked items (0 days)", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    const justNow = "2026-10-22T12:00:00Z";
    const res = getReviseTimeColor(justNow, { now });

    expect(res.days).toBe(0);
    expect(res.ratio).toBe(0);
    expect(res.hex.toLowerCase()).toBe("#ffffff");
    expect(res.rgb).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("transitions smoothly towards jaune for ~2 to 4 days", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    const threeDaysAgo = "2026-10-19T12:00:00Z";
    const res = getReviseTimeColor(threeDaysAgo, { now });

    expect(res.days).toBeCloseTo(3, 1);
    // Should be yellow-ish: high Red (~254), high Green (~240), low/medium Blue (<200)
    expect(res.rgb.r).toBeGreaterThan(250);
    expect(res.rgb.g).toBeGreaterThan(230);
    expect(res.rgb.b).toBeLessThan(200);
  });

  it("transitions into orange for ~7 days", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    const sevenDaysAgo = "2026-10-15T12:00:00Z";
    const res = getReviseTimeColor(sevenDaysAgo, { now });

    expect(res.days).toBeCloseTo(7, 1);
    // Orange: high Red, moderate Green (~146), low Blue (~60)
    expect(res.rgb.r).toBeGreaterThan(245);
    expect(res.rgb.g).toBeLessThan(200);
    expect(res.rgb.g).toBeGreaterThan(120);
    expect(res.rgb.b).toBeLessThan(100);
  });

  it("reaches rouge for 14+ days", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    const fifteenDaysAgo = "2026-10-07T12:00:00Z";
    const res = getReviseTimeColor(fifteenDaysAgo, { now });

    expect(res.days).toBeGreaterThanOrEqual(14);
    expect(res.ratio).toBe(1);
    // Red: #ef4444 -> r: 239, g: 68, b: 68
    expect(res.hex.toLowerCase()).toBe("#ef4444");
    expect(res.rgb.r).toBe(239);
    expect(res.rgb.g).toBe(68);
    expect(res.rgb.b).toBe(68);
  });

  it("retrieves the specific date for a word from ld data", () => {
    const ld = {
      toRevise: { words: [0, 2] },
      wordsReviseDates: {
        "0": "2026-10-10T00:00:00Z",
        "2": "2026-10-20T00:00:00Z",
      },
      lastRevisedAt: "2026-10-20T00:00:00Z",
    };

    expect(getWordReviseDate(ld, 0)).toBe("2026-10-10T00:00:00Z");
    expect(getWordReviseDate(ld, 2)).toBe("2026-10-20T00:00:00Z");
    expect(getWordReviseDate(ld, 5)).toBe("2026-10-20T00:00:00Z"); // fallback
    expect(getWordReviseDate({ toRevise: null }, 0)).toBeNull();
  });
});
