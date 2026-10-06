import { describe, it, expect } from 'vitest';
import {
  clampHizbNumber,
  getHizbForSurahAyah,
  getHizbBounds,
  getHizbSegments,
  getSurahsForHizb,
  isCrossSurahHizb,
  getHizbsForSurah,
  buildCrossSurahHizbAyats,
  HIZB_STARTS
} from '../src/utils/hizbUtils.js';

describe('hizbUtils - Cross-Surah Hizb Engine', () => {
  it('clamps hizb numbers between 1 and 60', () => {
    expect(clampHizbNumber(0)).toBe(1);
    expect(clampHizbNumber(61)).toBe(60);
    expect(clampHizbNumber(30)).toBe(30);
    expect(clampHizbNumber('45')).toBe(45);
    expect(clampHizbNumber(null, 5)).toBe(5);
  });

  it('correctly determines Hizb 1 which spans Surah 1 (Al-Fatiha) and Surah 2 (Al-Baqarah)', () => {
    expect(isCrossSurahHizb(1)).toBe(true);
    const bounds = getHizbBounds(1);
    expect(bounds.startSurah).toBe(1);
    expect(bounds.startAyah).toBe(1);
    expect(bounds.endSurah).toBe(2);
    expect(bounds.endAyah).toBe(74);

    const surahs = getSurahsForHizb(1);
    expect(surahs).toEqual([1, 2]);

    const segments = getHizbSegments(1);
    expect(segments.length).toBe(2);
    expect(segments[0].surahNum).toBe(1);
    expect(segments[0].fromAyah).toBe(1);
    expect(segments[0].toAyah).toBe(7);
    expect(segments[1].surahNum).toBe(2);
    expect(segments[1].fromAyah).toBe(1);
    expect(segments[1].toAyah).toBe(74);
  });

  it('correctly maps getHizbForSurahAyah for cross-surah boundaries', () => {
    // Surah 1 Ayah 1 -> Hizb 1
    expect(getHizbForSurahAyah(1, 1)).toBe(1);
    expect(getHizbForSurahAyah(1, 7)).toBe(1);
    // Surah 2 Ayah 1 -> Hizb 1
    expect(getHizbForSurahAyah(2, 1)).toBe(1);
    expect(getHizbForSurahAyah(2, 74)).toBe(1);
    // Surah 2 Ayah 75 -> Hizb 2
    expect(getHizbForSurahAyah(2, 75)).toBe(2);
    expect(getHizbForSurahAyah(2, 141)).toBe(2);
    // Surah 2 Ayah 142 -> Hizb 3
    expect(getHizbForSurahAyah(2, 142)).toBe(3);
  });

  it('identifies all Surahs within a Hizb in Juz 30 (Hizb 59 and 60)', () => {
    const surahsHizb60 = getSurahsForHizb(60);
    // Hizb 60 starts at Surah 87 (Al-A'la) v.1 and goes through 114 (An-Nas)
    expect(surahsHizb60.length).toBeGreaterThan(15);
    expect(surahsHizb60).toContain(87);
    expect(surahsHizb60).toContain(112);
    expect(surahsHizb60).toContain(114);
    expect(isCrossSurahHizb(60)).toBe(true);
  });

  it('finds all Hizbs for a given Surah', () => {
    // Al-Baqarah spans Hizbs 1 to 5
    const baqarahHizbs = getHizbsForSurah(2);
    expect(baqarahHizbs).toEqual([1, 2, 3, 4, 5]);

    // Al-Fatiha is only in Hizb 1
    expect(getHizbsForSurah(1)).toEqual([1]);
  });

  it('buildCrossSurahHizbAyats produces a seamless ordered ayat list from multiple surahs', () => {
    const mockFatiha = [
      { number: 1, numberInSurah: 1, text: "بسم الله", surah: { number: 1 } },
      { number: 7, numberInSurah: 7, text: "ولا الضالين", surah: { number: 1 } }
    ];
    const mockBaqarah = [
      { number: 8, numberInSurah: 1, text: "الم", surah: { number: 2 } },
      { number: 81, numberInSurah: 74, text: "وما الله بغافل", surah: { number: 2 } }
    ];

    const ayatsBySurah = { 1: mockFatiha, 2: mockBaqarah };
    const combined = buildCrossSurahHizbAyats(1, ayatsBySurah);

    expect(combined.length).toBe(4);
    expect(combined[0].surahNumber).toBe(1);
    expect(combined[0].numberInSurah).toBe(1);
    expect(combined[0].isCrossSurahHizb).toBe(true);
    expect(combined[2].surahNumber).toBe(2);
    expect(combined[2].numberInSurah).toBe(1);
  });
});
