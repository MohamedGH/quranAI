import { describe, it, expect, vi } from 'vitest';
import {
  QUARTER_HIZB_START_REFS,
  clampQuarterHizbNumber,
  getQuarterFractionMeta,
  getQuarterHizbForSurahAyah,
  getQuarterHizbBounds,
  getQuarterHizbSegments,
  getSurahsForQuarterHizb,
  isCrossSurahQuarterHizb,
  getOtherSurahsInQuarterHizb,
  getQuarterHizbsForSurah,
  buildCrossSurahQuarterHizbAyats,
  fetchCrossSurahQuarterHizbAyats,
} from '../src/utils/quarterHizbUtils.js';
import { getGlobalAyahNumber } from '../src/utils/hizbUtils.js';
import { SURAH_INFO } from '../src/utils/arabicUtils.js';
import { parseQuranRoute, buildQuranRoute, resolveQuarterHizbRouteTarget } from '../src/utils/routeManager.js';
import { store, uiActions, sel } from '../src/store.js';

describe('quarterHizbUtils - Engine (240 Rub al-Hizb)', () => {
  it('contains 240 valid, strictly ascending start references across the entire Quran', () => {
    expect(QUARTER_HIZB_START_REFS.length).toBe(240);
    let prevGlobal = 0;
    let prevPage = 0;
    QUARTER_HIZB_START_REFS.forEach((ref, idx) => {
      const q = idx + 1;
      expect(ref.quarter).toBe(q);
      expect(ref.hizb).toBe(Math.ceil(q / 4));
      expect(ref.quarterInHizb).toBe(((q - 1) % 4) + 1);
      const info = SURAH_INFO[ref.surah - 1];
      expect(info).toBeTruthy();
      expect(ref.ayah).toBeGreaterThanOrEqual(1);
      expect(ref.ayah).toBeLessThanOrEqual(info.count);
      const globalAyah = getGlobalAyahNumber(ref.surah, ref.ayah);
      expect(globalAyah).toBeGreaterThan(prevGlobal);
      expect(ref.startPage).toBeGreaterThanOrEqual(prevPage);
      prevGlobal = globalAyah;
      prevPage = ref.startPage;
    });
  });

  it('clamps quarter numbers safely between 1 and 240', () => {
    expect(clampQuarterHizbNumber(0)).toBe(1);
    expect(clampQuarterHizbNumber(-5)).toBe(1);
    expect(clampQuarterHizbNumber(241)).toBe(240);
    expect(clampQuarterHizbNumber('120')).toBe(120);
    expect(clampQuarterHizbNumber(null, 12)).toBe(12);
  });

  it('produces accurate fraction metadata (1/4, 2/4, 3/4, 4/4) and Hizb indices', () => {
    const q1 = getQuarterFractionMeta(1);
    expect(q1.hizb).toBe(1);
    expect(q1.quarterInHizb).toBe(1);
    expect(q1.symbol).toBe('¼');
    expect(q1.fractionLabel).toBe('1/4');

    const q2 = getQuarterFractionMeta(2);
    expect(q2.hizb).toBe(1);
    expect(q2.quarterInHizb).toBe(2);
    expect(q2.symbol).toBe('½');

    const q3 = getQuarterFractionMeta(3);
    expect(q3.hizb).toBe(1);
    expect(q3.quarterInHizb).toBe(3);
    expect(q3.symbol).toBe('¾');

    const q4 = getQuarterFractionMeta(4);
    expect(q4.hizb).toBe(1);
    expect(q4.quarterInHizb).toBe(4);
    expect(q4.symbol).toBe('4/4');

    const q240 = getQuarterFractionMeta(240);
    expect(q240.hizb).toBe(60);
    expect(q240.quarterInHizb).toBe(4);
  });

  it('maps (surah, ayah) to exact Quarter-of-Hizb boundaries', () => {
    expect(getQuarterHizbForSurahAyah(1, 1)).toBe(1);
    expect(getQuarterHizbForSurahAyah(1, 7)).toBe(1);
    expect(getQuarterHizbForSurahAyah(2, 1)).toBe(1);
    expect(getQuarterHizbForSurahAyah(2, 25)).toBe(1);
    expect(getQuarterHizbForSurahAyah(2, 26)).toBe(2);
    expect(getQuarterHizbForSurahAyah(2, 44)).toBe(3);
    expect(getQuarterHizbForSurahAyah(2, 60)).toBe(4);
    expect(getQuarterHizbForSurahAyah(2, 75)).toBe(5);
    expect(getQuarterHizbForSurahAyah(114, 6)).toBe(240);
  });

  it('handles cross-surah quarters (Q1 S.1–S.2 and Q240 S.100–S.114)', () => {
    expect(isCrossSurahQuarterHizb(1)).toBe(true);
    const b1 = getQuarterHizbBounds(1);
    expect(b1.startSurah).toBe(1);
    expect(b1.startAyah).toBe(1);
    expect(b1.endSurah).toBe(2);
    expect(b1.endAyah).toBe(25);
    expect(getSurahsForQuarterHizb(1)).toEqual([1, 2]);
    expect(getOtherSurahsInQuarterHizb(1, 1)).toEqual([2]);

    const segs1 = getQuarterHizbSegments(1);
    expect(segs1.length).toBe(2);
    expect(segs1[0]).toMatchObject({ surahNum: 1, fromAyah: 1, toAyah: 7 });
    expect(segs1[1]).toMatchObject({ surahNum: 2, fromAyah: 1, toAyah: 25 });

    expect(isCrossSurahQuarterHizb(2)).toBe(false);
    expect(isCrossSurahQuarterHizb(240)).toBe(true);
    const b240 = getQuarterHizbBounds(240);
    expect(b240.startSurah).toBe(100);
    expect(b240.endSurah).toBe(114);
    expect(b240.endAyah).toBe(6);
  });

  it('returns all quarters spanned by a Surah', () => {
    expect(getQuarterHizbsForSurah(1)).toEqual([1]);
    expect(getQuarterHizbsForSurah(114)).toEqual([240]);
    const baqarahQuarters = getQuarterHizbsForSurah(2);
    expect(baqarahQuarters[0]).toBe(1);
    expect(baqarahQuarters[baqarahQuarters.length - 1]).toBe(20);
  });

  it('builds and deduplicates cross-surah ayats for a Quarter-of-Hizb', () => {
    const map = {
      1: [
        { number: 1, numberInSurah: 1, text: 'بسم الله', surah: { number: 1 } },
        { number: 7, numberInSurah: 7, text: 'صراط', surah: { number: 1 } },
        { number: 7, numberInSurah: 7, text: 'duplicate', surah: { number: 1 } },
      ],
      2: [
        { number: 8, numberInSurah: 1, text: 'الم', surah: { number: 2 } },
        { number: 32, numberInSurah: 25, text: 'وبشر', surah: { number: 2 } },
        { number: 33, numberInSurah: 26, text: 'outside Q1', surah: { number: 2 } },
      ],
    };

    const combined = buildCrossSurahQuarterHizbAyats(1, map, 1);
    expect(combined.length).toBe(4);
    expect(combined.map((a) => `${a.surahNumber}:${a.numberInSurah}`)).toEqual(['1:1', '1:7', '2:1', '2:25']);
    expect(combined[0].isCrossSurahQuarterHizb).toBe(true);
    expect(combined[0].hizbQuarter).toBe(1);
  });

  it('fetches missing cross-surah data asynchronously with fetchCrossSurahQuarterHizbAyats', async () => {
    const fetchSurahFn = vi.fn(async (sn) => ({
      ayahs: sn === 2
        ? [{ number: 8, numberInSurah: 1, text: 'الم' }, { number: 32, numberInSurah: 25, text: 'وبشر' }]
        : [],
    }));

    const result = await fetchCrossSurahQuarterHizbAyats(1, {
      primarySurahNum: 1,
      primaryAyats: [{ number: 1, numberInSurah: 1, text: 'الحمد لله' }],
      existingMap: {},
      fetchSurahFn,
    });

    expect(fetchSurahFn).toHaveBeenCalledTimes(1);
    expect(fetchSurahFn).toHaveBeenCalledWith(2);
    expect(result.ayats.length).toBe(3);
    expect(result.surahMap[2].length).toBe(2);
  });

  it('parses and builds Quarter-of-Hizb routes and resolves target Surah/Ayah', () => {
    const built = buildQuranRoute({ surahNum: 2, ayatNum: 26, mode: 'quarter', quarter: 2 });
    expect(built).toBe('/quran/2/26?mode=quarter&quarter=2');

    const parsed = parseQuranRoute('/quran/2/26', '?mode=quarter&quarter=2');
    expect(parsed.mode).toBe('quarter');
    expect(parsed.quarter).toBe(2);
    expect(parsed.quarterHizb).toBe(2);

    const resolved = resolveQuarterHizbRouteTarget(240);
    expect(resolved.surahNum).toBe(100);
    expect(resolved.ayatNum).toBe(9);
    expect(resolved.quarter).toBe(240);
  });

  it('enforces mutual exclusivity between quarterHizbMode and pageMode/hizbMode/juzMode in Redux store', () => {
    store.dispatch(uiActions.setPageMode(true));
    expect(sel.pageMode(store.getState())).toBe(true);

    store.dispatch(uiActions.setQuarterHizbMode(true));
    store.dispatch(uiActions.setActiveQuarterHizbCoran(12));
    expect(sel.quarterHizbMode(store.getState())).toBe(true);
    expect(sel.activeQuarterHizbCoran(store.getState())).toBe(12);
    expect(sel.pageMode(store.getState())).toBe(false);
    expect(sel.hizbMode(store.getState())).toBe(false);
    expect(sel.juzMode(store.getState())).toBe(false);

    store.dispatch(uiActions.setHizbMode(true));
    expect(sel.hizbMode(store.getState())).toBe(true);
    expect(sel.quarterHizbMode(store.getState())).toBe(false);
    expect(sel.activeQuarterHizbCoran(store.getState())).toBeNull();
  });
});
