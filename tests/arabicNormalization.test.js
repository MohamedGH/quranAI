import { describe, it, expect } from "vitest";
import {
  cleanDiacritics,
  stripAllHarakat,
  normalizeArabicSearch,
  fuzzyMatchArabic,
  matchesArabicSearch,
  isLatinOnly,
  detectSearchType,
  normalizeVoiceText,
  diffWords,
} from "../src/utils/quranCore.js";

describe("Arabic Text Normalization & Search Utilities", () => {
  describe("cleanDiacritics", () => {
    it("removes basic tashkeel (fatha, damma, kasra, sukun, tanween)", () => {
      const text = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
      const cleaned = cleanDiacritics(text);
      expect(cleaned).toBe("بسم الله الرحمن الرحيم");
    });

    it("handles empty or falsy input", () => {
      expect(cleanDiacritics("")).toBe("");
      expect(cleanDiacritics(null)).toBe("");
    });
  });

  describe("stripAllHarakat", () => {
    it("normalizes alef variants and taa marbuta to standard forms", () => {
      const input = "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا";
      const stripped = stripAllHarakat(input);
      expect(stripped).toContain("ان"); // إِنَّ -> ان
      expect(stripped).toContain("الصلاه"); // الصَّلَاةَ -> الصلاه
      expect(stripped).toContain("علي"); // عَلَى -> علي
    });
  });

  describe("normalizeArabicSearch", () => {
    it("normalizes hamzas, ya/alef maksura, and ta marbuta", () => {
      expect(normalizeArabicSearch("قُرْآن")).toBe("قران");
      expect(normalizeArabicSearch("مُؤْمِن")).toBe("مومن");
      expect(normalizeArabicSearch("شَيْءٍ")).toBe("شيء");
      expect(normalizeArabicSearch("سُورَة")).toBe("سوره");
    });
  });

  describe("fuzzyMatchArabic & matchesArabicSearch", () => {
    it("matches exact normalized words", () => {
      expect(fuzzyMatchArabic("الفاتحة", "سورة الفاتحة")).toBe(true);
      expect(matchesArabicSearch("الفاتحه", "الْفَاتِحَةِ")).toBe(true);
    });

    it("matches multi-word search queries in arbitrary order", () => {
      expect(fuzzyMatchArabic("الله الرحمن", "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ")).toBe(true);
      expect(fuzzyMatchArabic("الرحيم الحمد", "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ الْحَمْدُ لِلَّهِ")).toBe(true);
    });

    it("returns false for non-matching text", () => {
      expect(fuzzyMatchArabic("البقرة", "سورة الإخلاص")).toBe(false);
    });
  });

  describe("isLatinOnly & detectSearchType", () => {
    it("correctly identifies latin queries", () => {
      expect(isLatinOnly("Fatiha")).toBe(true);
      expect(isLatinOnly("al-baqarah")).toBe(true);
      expect(isLatinOnly("الفاتحة")).toBe(false);
    });

    it("detects number search queries", () => {
      expect(detectSearchType("1")).toBe("number");
      expect(detectSearchType("114")).toBe("number");
    });

    it("detects verse reference queries (e.g. 2:255)", () => {
      expect(detectSearchType("2:255")).toBe("verse_ref");
      expect(detectSearchType("112:1")).toBe("verse_ref");
    });

    it("detects empty queries", () => {
      expect(detectSearchType("")).toBe("empty");
      expect(detectSearchType("   ")).toBe("empty");
    });

    it("detects latin phonetic queries vs arabic queries", () => {
      expect(detectSearchType("yasin")).toBe("phonetic_or_translation");
      expect(detectSearchType("يس")).toBe("arabic");
    });
  });

  describe("Voice / Speech Word-level Diffing", () => {
    describe("normalizeVoiceText", () => {
      it("cleans vocalized text for speech matching", () => {
        expect(normalizeVoiceText("قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ")).toBe("قل اعوذ برب الفلق");
      });
    });

    describe("diffWords", () => {
      it("correctly marks correct words", () => {
        const target = ["قل", "هو", "الله", "أحد"];
        const spoken = ["قل", "هو", "الله", "احد"];
        const diff = diffWords(target, spoken);

        expect(diff).toHaveLength(4);
        expect(diff.every((d) => d.status === "correct")).toBe(true);
      });

      it("identifies missing words", () => {
        const target = ["قل", "هو", "الله", "أحد"];
        const spoken = ["قل", "الله"];
        const diff = diffWords(target, spoken);

        expect(diff[0].status).toBe("correct"); // قل
        expect(diff[1].status).toBe("incorrect"); // هو vs الله
        expect(diff[2].status).toBe("missing"); // الله
        expect(diff[3].status).toBe("missing"); // أحد
      });

      it("identifies extra spoken words", () => {
        const target = ["قل", "هو"];
        const spoken = ["قل", "هو", "الله", "أحد"];
        const diff = diffWords(target, spoken);

        expect(diff[0].status).toBe("correct");
        expect(diff[1].status).toBe("correct");
        expect(diff[2].status).toBe("extra");
        expect(diff[3].status).toBe("extra");
      });
    });
  });
});
