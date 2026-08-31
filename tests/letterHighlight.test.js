import { describe, it, expect } from "vitest";
import {
  alignCharacters,
  computeLetterHighlight,
  normalizeCharForSpeech,
  SILENT_WORD_MAP,
} from "../src/utils/quranCore.js";

describe("Letter-by-Letter Alignment and Highlighting Engine", () => {
  describe("normalizeCharForSpeech", () => {
    it("normalizes various forms of Alef (أ, إ, آ, ٱ) to bare Alef (ا)", () => {
      expect(normalizeCharForSpeech("أ")).toBe("ا");
      expect(normalizeCharForSpeech("إ")).toBe("ا");
      expect(normalizeCharForSpeech("آ")).toBe("ا");
      expect(normalizeCharForSpeech("ٱ")).toBe("ا");
    });

    it("normalizes Taa Marbuta (ة) to Haa (ه)", () => {
      expect(normalizeCharForSpeech("ة")).toBe("ه");
    });

    it("normalizes Alef Maksura (ى) to Yaa (ي)", () => {
      expect(normalizeCharForSpeech("ى")).toBe("ي");
    });

    it("strips diacritics before normalization", () => {
      expect(normalizeCharForSpeech("بَ")).toBe("ب");
      expect(normalizeCharForSpeech("إِ")).toBe("ا");
    });

    it("handles empty or falsy characters gracefully", () => {
      expect(normalizeCharForSpeech("")).toBe("");
      expect(normalizeCharForSpeech(null)).toBe("");
      expect(normalizeCharForSpeech(undefined)).toBe("");
    });
  });

  describe("alignCharacters (Needleman-Wunsch algorithm)", () => {
    it("handles empty strings", () => {
      expect(alignCharacters("", "")).toEqual([]);
    });

    it("handles extra characters when reference is empty", () => {
      const res = alignCharacters("", "قل");
      expect(res).toEqual([
        { refChar: "", gotChar: "ق", status: "extra" },
        { refChar: "", gotChar: "ل", status: "extra" },
      ]);
    });

    it("handles missing characters when input is empty", () => {
      const res = alignCharacters("قل", "");
      expect(res).toEqual([
        { refChar: "ق", gotChar: "", status: "missing" },
        { refChar: "ل", gotChar: "", status: "missing" },
      ]);
    });

    it("accurately aligns exact matches", () => {
      const ref = "بسم";
      const got = "بسم";
      const res = alignCharacters(ref, got);
      expect(res).toHaveLength(3);
      expect(res.every((item) => item.status === "correct")).toBe(true);
      expect(res[0]).toEqual({ refChar: "ب", gotChar: "ب", status: "correct" });
      expect(res[1]).toEqual({ refChar: "س", gotChar: "س", status: "correct" });
      expect(res[2]).toEqual({ refChar: "م", gotChar: "م", status: "correct" });
    });

    it("detects single letter mistakes (incorrect substitutions)", () => {
      const ref = "كتب";
      const got = "كذب";
      const res = alignCharacters(ref, got);
      expect(res[0].status).toBe("correct"); // ك
      expect(res[1].status).toBe("incorrect"); // ت vs ذ
      expect(res[1].refChar).toBe("ت");
      expect(res[1].gotChar).toBe("ذ");
      expect(res[2].status).toBe("correct"); // ب
    });

    it("handles inserted / extra letters in the middle", () => {
      const ref = "قل";
      const got = "قال";
      const res = alignCharacters(ref, got);
      const correctChars = res.filter((r) => r.status === "correct");
      expect(correctChars.map((r) => r.refChar)).toContain("ق");
      expect(correctChars.map((r) => r.refChar)).toContain("ل");
      expect(res.some((r) => r.status === "extra" || r.status === "incorrect")).toBe(true);
    });

    it("matches normalized variants correctly (e.g. أ vs ا)", () => {
      const ref = "الله";
      const got = "ألله";
      const res = alignCharacters(ref, got);
      expect(res[0].status).toBe("correct"); // 'ا' matches 'أ'
    });
  });

  describe("computeLetterHighlight", () => {
    it("returns zero progress for empty inputs", () => {
      const res = computeLetterHighlight("", "");
      expect(res.accuracy).toBe(0);
      expect(res.isComplete).toBe(false);
      expect(res.aligned).toEqual([]);
    });

    it("computes 100% accuracy and isComplete on perfect recitation", () => {
      const verse = "قُلْ هُوَ اللَّهُ أَحَدٌ";
      const spoken = "قل هو الله احد";
      const res = computeLetterHighlight(verse, spoken);

      expect(res.accuracy).toBe(100);
      expect(res.isComplete).toBe(true);
      expect(res.correctCount).toBe(res.totalRef);
    });

    it("computes partial accuracy on partial recitation", () => {
      const verse = "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ";
      const spoken = "الحمد لله";
      const res = computeLetterHighlight(verse, spoken);

      expect(res.accuracy).toBeGreaterThan(0);
      expect(res.accuracy).toBeLessThan(100);
      expect(res.isComplete).toBe(false);
    });

    it("tolerates minor speech inaccuracies if above threshold", () => {
      const verse = "قُلْ أَعُوذُ بِرَبِّ النَّاسِ";
      const spoken = "قل اعوذ برب الناس";
      const res = computeLetterHighlight(verse, spoken);
      expect(res.accuracy).toBe(100);
      expect(res.isComplete).toBe(true);
    });
  });

  describe("SILENT_WORD_MAP", () => {
    it("contains mapping for Quranic silent words", () => {
      expect(SILENT_WORD_MAP["أُولَئِكَ"]).toBe("أُلَئِكَ");
      expect(SILENT_WORD_MAP["أُولُوا"]).toBe("أُلُوا");
      expect(SILENT_WORD_MAP["مِاْئَةَ"]).toBe("مِئَةَ");
    });
  });
});
