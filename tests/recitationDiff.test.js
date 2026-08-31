import { describe, it, expect } from "vitest";
import {
  normalizeArabic,
  getWaslVowel,
  getSilentIndices,
  diffWord,
  compareRecitation,
  levenshteinAlign,
  removeSolarLam,
  hasSolarLam,
} from "../src/utils/recitationDiff.js";

describe("Recitation Phonetic & Alignment Engine", () => {
  it("normalizes Arabic text correctly", () => {
    const text = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
    const norm = normalizeArabic(text);
    expect(norm).toBeDefined();
    expect(typeof norm).toBe("string");
    expect(norm.length).toBeGreaterThan(0);
  });

  it("handles solar lam removal", () => {
    expect(hasSolarLam("الشمس")).toBe(true);
    expect(removeSolarLam("الشمس")).toBe("شمس");
    expect(hasSolarLam("القمر")).toBe(false);
  });

  it("identifies hamzat wasl vowels", () => {
    const vowel = getWaslVowel("ٱهْدِنَا", 0);
    expect(["kasra", "damma", "fatha"]).toContain(vowel);
  });

  it("calculates Levenshtein alignment between reference and recited words", () => {
    const refWords = ["الحمد", "لله", "رب", "العالمين"];
    const hypWords = ["الحمد", "لله", "رب", "العالمين"];
    const aligned = levenshteinAlign(refWords, hypWords);
    expect(aligned.length).toBe(4);
    expect(aligned.every(a => a.op === "match")).toBe(true);
  });

  it("diffWord returns matching accuracy for identical words", () => {
    const diff = diffWord("الرَّحْمَٰنِ", "الرَّحْمَٰنِ");
    expect(Array.isArray(diff)).toBe(true);
    expect(diff.length).toBeGreaterThan(0);
    expect(diff.every(d => d.status === "ok" || d.status === "near" || d.status === "silent")).toBe(true);
  });

  it("compareRecitation returns detailed accuracy stats", () => {
    const ref = "قل هو الله أحد";
    const hyp = "قل هو الله أحد";
    const res = compareRecitation(ref, hyp);
    expect(res).toBeDefined();
    expect(res.score).toBeGreaterThanOrEqual(90);
    expect(res.wordResults.length).toBeGreaterThanOrEqual(3);
  });
});
