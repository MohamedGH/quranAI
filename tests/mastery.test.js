import { describe, it, expect } from "vitest";
import { computeMastery, masteryColor } from "../src/components/common/Mastery.jsx";

describe("Mastery Engine", () => {
  it("computes 100% mastery when no toRevise is set", () => {
    const res = computeMastery(null, "بِسْمِ ٱللَّهِ");
    expect(res).toBe(100);
  });

  it("computes 0% mastery when toRevise is true", () => {
    const res = computeMastery({ toRevise: true }, "بِسْمِ ٱللَّهِ");
    expect(res).toBe(0);
  });

  it("computes correct mastery color based on score", () => {
    expect(masteryColor(0)).toBe("var(--border2)");
    expect(masteryColor(20)).toBe("var(--teal2)");
    expect(masteryColor(50)).toBe("var(--gold)");
    expect(masteryColor(90)).toBe("var(--green)");
  });
});
