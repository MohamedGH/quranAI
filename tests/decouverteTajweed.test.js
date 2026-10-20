import { describe, it, expect } from "vitest";
import { extractAyatTajweedTimestamps } from "../src/utils/tajweedAudioCoach.js";
import { scanAyatTajweed } from "../src/utils/tajweedRules.js";

describe("DecouverteMode Tajweed Rule Integration", () => {
  it("detects Tajweed rules for an ayat in decouverte mode", () => {
    // Ayat 3 of Al-Ikhlas: "لَمْ يَلِدْ وَلَمْ يُولَدْ" (Qalqala on Dal)
    const ayatText = "لَمْ يَلِدْ وَلَمْ يُولَدْ";
    const rules = extractAyatTajweedTimestamps(ayatText, null);
    expect(Array.isArray(rules)).toBe(true);

    // Should find Qalqala on Dal in يَلِدْ and يُولَدْ
    const dalQalqala = rules.find(r => r.char === 'د' || r.ruleId === 'qalqala');
    expect(dalQalqala).toBeDefined();
    expect(dalQalqala.ruleNameFr).toBe("Qalqala");
  });

  it("correctly groups Tajweed rules by word index for inline discovery badges", () => {
    const ayatText = "مِنۢ بَعْدِ مَآ أَصَابَهُم";
    const rules = extractAyatTajweedTimestamps(ayatText, null);

    const wordMap = {};
    rules.forEach(r => {
      if (r.wordIdx != null) {
        if (!wordMap[r.wordIdx]) wordMap[r.wordIdx] = [];
        wordMap[r.wordIdx].push(r);
      }
    });

    // Word 0 "مِنۢ" should have Iqlab rule
    expect(wordMap[0]).toBeDefined();
    expect(wordMap[0][0].ruleId).toBe("iqlab");
    expect(wordMap[0][0].matchedWith).toBe("ب");
  });

  it("handles verses with no major rules gracefully", () => {
    const plainText = "وَكَتَبْنَا";
    const rules = extractAyatTajweedTimestamps(plainText, null);
    expect(Array.isArray(rules)).toBe(true);
  });

  it("includes rule description (ruleDescFr) and formatted speech for each rule", () => {
    const ayatText = "لَمْ يَلِدْ وَلَمْ يُولَدْ";
    const rules = extractAyatTajweedTimestamps(ayatText, null);
    expect(rules.length).toBeGreaterThan(0);
    rules.forEach(rule => {
      expect(rule.ruleDescFr).toBeDefined();
      expect(typeof rule.ruleDescFr).toBe("string");
      expect(rule.ruleDescFr.length).toBeGreaterThan(0);
      expect(rule.speechFr).toBeDefined();
      expect(rule.color).toBeDefined();
    });
  });

  it("accurately detects Tajweed rules for Submenu mode badges", () => {
    const ayatWithRules = "لَمْ يَلِدْ وَلَمْ يُولَدْ";
    const count = scanAyatTajweed(ayatWithRules).length;
    expect(count).toBeGreaterThan(0);

    const ayatWithoutMajorRules = "كَتَبَ";
    const countNone = scanAyatTajweed(ayatWithoutMajorRules).length;
    expect(countNone).toBe(0);
  });
});
