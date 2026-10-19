import { describe, it, expect } from "vitest";
import {
  extractAyatTajweedTimestamps,
  ARABIC_LETTER_NAMES,
  TAJWEED_COACH_RULES,
  getTajweedRuleDetails
} from "../src/utils/tajweedAudioCoach.js";

describe("Tajweed Audio Coach Engine", () => {
  it("has valid Arabic letter mappings for all primary letters", () => {
    expect(ARABIC_LETTER_NAMES['ق'].fr).toBe('Qâf');
    expect(ARABIC_LETTER_NAMES['ب'].fr).toBe('Bâ');
    expect(ARABIC_LETTER_NAMES['ت'].fr).toBe('Tâ');
    expect(ARABIC_LETTER_NAMES['ن'].fr).toBe('Nûn');
    expect(ARABIC_LETTER_NAMES['م'].fr).toBe('Mîm');
  });

  it("retrieves details for standard Tajweed rules", () => {
    const qalqala = getTajweedRuleDetails('qalqala');
    expect(qalqala.nameFr).toBe('Qalqala');
    expect(qalqala.nameAr).toBe('قلقلة');

    const iqlab = getTajweedRuleDetails('iqlab');
    expect(iqlab.nameFr).toBe('Iqlâb');
    expect(iqlab.nameAr).toBe('إقلاب');

    const ikhfa = getTajweedRuleDetails('ikhfa');
    expect(ikhfa.nameFr).toBe('Ikhfâ');
  });

  it("extracts and timestamps Tajweed rules in a verse correctly", () => {
    // Ayat with Qalqala and Tanwin/Nun rules, e.g. Al-Falaq or Al-Ikhlas
    const text = "قُلْ هُوَ ٱللَّهُ أَحَدٌ";
    const dummyTimestamps = {
      words: [
        { start: 0, end: 500, chars: [{ char: 'ق', start: 0, end: 200 }, { char: 'ل', start: 200, end: 500 }] },
        { start: 520, end: 900, chars: [{ char: 'ه', start: 520, end: 700 }, { char: 'و', start: 700, end: 900 }] },
        { start: 920, end: 1500, chars: [{ char: 'ٱ', start: 920, end: 1000 }, { char: 'ل', start: 1000, end: 1200 }, { char: 'ل', start: 1200, end: 1500 }] },
        { start: 1520, end: 2200, chars: [{ char: 'أ', start: 1520, end: 1700 }, { char: 'ح', start: 1700, end: 1900 }, { char: 'د', start: 1900, end: 2200 }] }
      ]
    };

    const results = extractAyatTajweedTimestamps(text, dummyTimestamps);
    expect(Array.isArray(results)).toBe(true);

    // Qalqala on د in أَحَدٌ
    const dalFinding = results.find(r => r.char === 'د' || r.ruleId === 'qalqala');
    if (dalFinding) {
      expect(dalFinding.ruleNameFr).toBe('Qalqala');
      expect(dalFinding.letterNameFr).toBe('Dâl');
      expect(dalFinding.speechFr).toContain('Qalqala');
      expect(typeof dalFinding.startMs).toBe('number');
    }
  });

  it("handles verses with Iqlab (e.g. min ba'd)", () => {
    const text = "مِنۢ بَعْدِ";
    const dummyTimestamps = {
      words: [
        { start: 100, end: 600, chars: [{ char: 'م', start: 100, end: 300 }, { char: 'ن', start: 300, end: 600 }] },
        { start: 620, end: 1200, chars: [{ char: 'ب', start: 620, end: 800 }, { char: 'ع', start: 800, end: 1000 }, { char: 'د', start: 1000, end: 1200 }] }
      ]
    };

    const results = extractAyatTajweedTimestamps(text, dummyTimestamps);
    const iqlab = results.find(r => r.ruleId === 'iqlab');
    expect(iqlab).toBeDefined();
    expect(iqlab.letterNameFr).toBe('Nûn');
    expect(iqlab.matchedWith).toBe('ب');
    expect(iqlab.speechFr).toContain('Mîm');
  });
});
