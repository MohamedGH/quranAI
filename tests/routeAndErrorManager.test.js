import { describe, it, expect } from 'vitest';
import { parseQuranRoute, buildQuranRoute } from '../src/utils/routeManager.js';
import {
  createAppError,
  ERROR_CODES,
  normalizeError,
  safeSync,
  safeAsync,
  withErrorRecovery,
  retryWithBackoff
} from '../src/utils/errorManager.js';

describe('routeManager - Pure functional routing', () => {
  it('parses standard Quran routes', () => {
    const r1 = parseQuranRoute('/quran/2/255');
    expect(r1.activePage).toBe('quran');
    expect(r1.surahNum).toBe(2);
    expect(r1.ayatNum).toBe(255);

    const r2 = parseQuranRoute('/collections');
    expect(r2.activePage).toBe('collections');
    expect(r2.surahNum).toBeNull();
  });

  it('parses query parameters for hizb, page, juz, and crossSurah', () => {
    const parsed = parseQuranRoute('/quran/2', '?hizb=1&cross=1');
    expect(parsed.hizbNum).toBe(1);
    expect(parsed.isCrossSurah).toBe(true);
    expect(parsed.surahNum).toBe(2);
  });

  it('builds canonical Quran routes', () => {
    expect(buildQuranRoute({ activePage: 'quran', surahNum: 18, ayatNum: 10 })).toBe('/quran/18/10');
    expect(buildQuranRoute({ activePage: 'quran', surahNum: 2, hizbNum: 1, isCrossSurah: true })).toBe('/quran/2?hizb=1&cross=1');
    expect(buildQuranRoute({ activePage: 'collections' })).toBe('/collections');
  });
});

describe('errorManager - Resilient error handling', () => {
  it('creates typed app errors', () => {
    const err = createAppError(ERROR_CODES.HIZB_FETCH_FAILED, 'Failed to fetch hizb', { hizb: 1 });
    expect(err.code).toBe(ERROR_CODES.HIZB_FETCH_FAILED);
    expect(err.message).toBe('Failed to fetch hizb');
    expect(err.context.hizb).toBe(1);
  });

  it('normalizes arbitrary errors', () => {
    const norm = normalizeError(new Error('Network drop'));
    expect(norm.message).toBe('Network drop');
    expect(norm.timestamp).toBeDefined();

    const strNorm = normalizeError('String error message');
    expect(strNorm.message).toBe('String error message');
  });

  it('safeSync catches sync errors without throwing', () => {
    const [err, res] = safeSync(() => {
      throw new Error('Boom');
    });
    expect(err).toBeInstanceOf(Error);
    expect(res).toBeNull();

    const [okErr, okRes] = safeSync(() => 42);
    expect(okErr).toBeNull();
    expect(okRes).toBe(42);
  });

  it('safeAsync catches async errors cleanly', async () => {
    const [err, res] = await safeAsync(async () => {
      throw new Error('Async explosion');
    });
    expect(err).toBeInstanceOf(Error);
    expect(res).toBeNull();

    const [okErr, okRes] = await safeAsync(async () => 'success');
    expect(okErr).toBeNull();
    expect(okRes).toBe('success');
  });

  it('withErrorRecovery provides fallback on failure', async () => {
    const fallbackVal = { fallback: true };
    const res = await withErrorRecovery(
      async () => { throw new Error('Failed'); },
      fallbackVal
    );
    expect(res).toBe(fallbackVal);
  });
});
