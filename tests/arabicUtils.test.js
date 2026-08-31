import { describe, it, expect } from "vitest";
import {
  splitArabicWords,
  splitArabicChars,
  splitArabicClusters,
  stripDiacritics,
  wordTranslit,
  calcDifficulty,
  calcPhase,
} from "../src/utils/arabicUtils.js";

describe("Arabic Utils & Text Processing", () => {
  it("splits arabic words properly handling prefixes and whitespaces", () => {
    const text = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
    const words = splitArabicWords(text);
    expect(Array.isArray(words)).toBe(true);
    expect(words.length).toBeGreaterThanOrEqual(4);
  });

  it("splits arabic characters with attached harakat", () => {
    const word = "كتب";
    const chars = splitArabicChars(word);
    expect(chars.length).toBe(3);
    expect(chars[0]).toBe("ك");
    expect(chars[1]).toBe("ت");
    expect(chars[2]).toBe("ب");
  });

  it("splits arabic grapheme clusters", () => {
    const text = "قل";
    const clusters = splitArabicClusters(text);
    expect(clusters.length).toBe(2);
    expect(clusters[0]).toBe("ق");
    expect(clusters[1]).toBe("ل");
  });

  it("strips diacritics cleanly", () => {
    const withDia = "ٱلرَّحْمَٰنِ";
    const clean = stripDiacritics(withDia);
    expect(clean).toBe("ٱلرحمن");
  });

  it("calculates difficulty score for ayat", () => {
    const diff = calcDifficulty("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", null);
    expect(diff).toBeDefined();
    expect(typeof diff.level).toBe("number");
    expect(diff.level).toBeGreaterThan(0);
    expect(diff.label).toBeDefined();
  });

  it("calculates learning phase based on learn data", () => {
    expect(calcPhase(null).label).toBe("NON COMMENCÉ");
    expect(calcPhase({ learned: true }).label).toBe("MAÎTRISÉ ✓");
  });

  it("extracts arabic roots properly", async () => {
    const { arabicRoot } = await import("../src/utils/arabicUtils.js");
    expect(arabicRoot("ٱلحمد")).toBe("حمد");
    expect(arabicRoot("")).toBe("");
  });
});
