import { describe, it, expect } from 'vitest';
import {
  STUDY_RECENCY_TIERS,
  STUDY_RECENCY_TIER_LIST,
  hasAnyStudyRecord,
  resolveAyatStudyInfo,
  formatElapsedFrench,
  getStudyRecencyTierFromDiff,
  getStudyRecencyInfo,
  matchesStudyRecencyFilter,
  computeStudyRecencySummary,
} from '../src/utils/studyRecency.js';
import { store, uiActions, learnActions, sel } from '../src/store.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

describe('studyRecency - Elapsed Study Time & Semantic Color Coding', () => {
  const fixedNow = new Date('2026-06-15T12:00:00.000Z').getTime();

  it('exposes 6 ordered semantic tiers with valid colors and French labels', () => {
    expect(STUDY_RECENCY_TIER_LIST.length).toBe(6);
    expect(STUDY_RECENCY_TIER_LIST.map((t) => t.id)).toEqual([
      'fresh',
      'recent',
      'refresh',
      'aging',
      'overdue',
      'never',
    ]);
    STUDY_RECENCY_TIER_LIST.forEach((tier) => {
      expect(tier.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(tier.rangeLabel).toBeTruthy();
      expect(tier.label).toBeTruthy();
    });
  });

  it('detects empty vs real study activity accurately via hasAnyStudyRecord', () => {
    expect(hasAnyStudyRecord(null)).toBe(false);
    expect(hasAnyStudyRecord({})).toBe(false);
    expect(hasAnyStudyRecord({ learned: false, readCount: 0, parts: [], wordsLearned: {} })).toBe(false);
    expect(hasAnyStudyRecord({ readCount: 1 })).toBe(true);
    expect(hasAnyStudyRecord({ learned: true })).toBe(true);
    expect(hasAnyStudyRecord({ parts: [{ id: 1 }] })).toBe(true);
    expect(hasAnyStudyRecord({ wordsLearned: { 0: true } })).toBe(true);
    expect(hasAnyStudyRecord({ toRevise: true })).toBe(true);
    expect(hasAnyStudyRecord({ recitAttempts: [{ date: '2026-06-01T10:00:00.000Z' }] })).toBe(true);
  });

  it('resolves the latest timestamp across all study signals', () => {
    const ld = {
      readCount: 3,
      firstReadAt: '2026-06-01T10:00:00.000Z',
      lastReadAt: '2026-06-10T10:00:00.000Z',
      lastLearnedAt: '2026-06-14T15:00:00.000Z',
      recitAttempts: [{ date: '2026-06-12T08:00:00.000Z' }],
    };
    const info = resolveAyatStudyInfo(ld);
    expect(info.lastStudiedAt).toBe('2026-06-14T15:00:00.000Z');
    expect(info.sourceType).toBe('learn');
  });

  it('maps elapsed durations into all 6 semantic color tiers', () => {
    expect(getStudyRecencyTierFromDiff(null).id).toBe('never');
    expect(getStudyRecencyTierFromDiff(2 * HOUR).id).toBe('fresh');
    expect(getStudyRecencyTierFromDiff(2 * DAY).id).toBe('recent');
    expect(getStudyRecencyTierFromDiff(5 * DAY).id).toBe('refresh');
    expect(getStudyRecencyTierFromDiff(10 * DAY).id).toBe('aging');
    expect(getStudyRecencyTierFromDiff(21 * DAY).id).toBe('overdue');
  });

  it('formats elapsed French durations cleanly across minutes, hours, days, months, years', () => {
    expect(formatElapsedFrench(60 * 1000).shortLabel).toBe("À l'instant");
    expect(formatElapsedFrench(25 * 60 * 1000).shortLabel).toBe('25 min');
    expect(formatElapsedFrench(6 * HOUR).shortLabel).toBe('6h');
    expect(formatElapsedFrench(4 * DAY).shortLabel).toBe('4j');
    expect(formatElapsedFrench(95 * DAY).shortLabel).toBe('3 mois');
    expect(formatElapsedFrench(400 * DAY).shortLabel).toBe('1 an');
  });

  it('computes complete getStudyRecencyInfo for studied and never-studied verses', () => {
    const neverInfo = getStudyRecencyInfo({ readCount: 0, learned: false }, fixedNow);
    expect(neverInfo.studied).toBe(false);
    expect(neverInfo.tierId).toBe('never');
    expect(neverInfo.shortLabel).toBe('Jamais');
    expect(neverInfo.hex).toBe(STUDY_RECENCY_TIERS.never.hex);

    const freshInfo = getStudyRecencyInfo(
      { readCount: 2, lastStudiedAt: new Date(fixedNow - 3 * HOUR).toISOString() },
      fixedNow
    );
    expect(freshInfo.studied).toBe(true);
    expect(freshInfo.tierId).toBe('fresh');
    expect(freshInfo.shortLabel).toBe('3h');
    expect(freshInfo.hex).toBe(STUDY_RECENCY_TIERS.fresh.hex);
    expect(freshInfo.tooltip).toContain('Aujourd\'hui');

    const overdueInfo = getStudyRecencyInfo(
      { learned: true, lastLearnedAt: new Date(fixedNow - 20 * DAY).toISOString() },
      fixedNow
    );
    expect(overdueInfo.tierId).toBe('overdue');
    expect(overdueInfo.shortLabel).toBe('20j');
    expect(overdueInfo.hex).toBe(STUDY_RECENCY_TIERS.overdue.hex);
  });

  it('filters correctly with matchesStudyRecencyFilter including "toReview"', () => {
    const fresh = getStudyRecencyInfo({ readCount: 1, lastStudiedAt: new Date(fixedNow - 2 * HOUR).toISOString() }, fixedNow);
    const recent = getStudyRecencyInfo({ readCount: 1, lastStudiedAt: new Date(fixedNow - 2 * DAY).toISOString() }, fixedNow);
    const refresh = getStudyRecencyInfo({ readCount: 1, lastStudiedAt: new Date(fixedNow - 5 * DAY).toISOString() }, fixedNow);
    const aging = getStudyRecencyInfo({ readCount: 1, lastStudiedAt: new Date(fixedNow - 10 * DAY).toISOString() }, fixedNow);
    const overdue = getStudyRecencyInfo({ readCount: 1, lastStudiedAt: new Date(fixedNow - 18 * DAY).toISOString() }, fixedNow);
    const never = getStudyRecencyInfo({}, fixedNow);

    expect(matchesStudyRecencyFilter(fresh, 'all')).toBe(true);
    expect(matchesStudyRecencyFilter(fresh, 'toReview')).toBe(false);
    expect(matchesStudyRecencyFilter(recent, 'toReview')).toBe(false);
    expect(matchesStudyRecencyFilter(refresh, 'toReview')).toBe(true);
    expect(matchesStudyRecencyFilter(aging, 'toReview')).toBe(true);
    expect(matchesStudyRecencyFilter(overdue, 'toReview')).toBe(true);
    expect(matchesStudyRecencyFilter(never, 'toReview')).toBe(true);
    expect(matchesStudyRecencyFilter(aging, 'aging')).toBe(true);
    expect(matchesStudyRecencyFilter(aging, 'fresh')).toBe(false);
  });

  it('computes summary counts per tier across a verse list', () => {
    const ayats = [
      { surahNumber: 1, numberInSurah: 1 },
      { surahNumber: 1, numberInSurah: 2 },
      { surahNumber: 1, numberInSurah: 3 },
      { surahNumber: 1, numberInSurah: 4 },
    ];
    const learnData = {
      '1:1': { readCount: 1, lastStudiedAt: new Date(fixedNow - 1 * HOUR).toISOString() },
      '1:2': { readCount: 1, lastStudiedAt: new Date(fixedNow - 6 * DAY).toISOString() },
      '1:3': { learned: true, lastLearnedAt: new Date(fixedNow - 30 * DAY).toISOString() },
    };
    const summary = computeStudyRecencySummary(ayats, learnData, 1, fixedNow);
    expect(summary).toEqual({
      fresh: 1,
      recent: 0,
      refresh: 1,
      aging: 0,
      overdue: 1,
      never: 1,
      studiedCount: 3,
      toReviewCount: 3,
      total: 4,
    });
  });

  it('persists lastStudiedAt in Redux learnSlice and controls showStudyRecency/studyRecencyFilter in uiSlice', () => {
    store.dispatch(learnActions.setLearnEntry({
      key: '112:1',
      value: { readCount: 1, learned: false, parts: [], wordsLearned: {} },
    }));
    const entry = store.getState().learn.data['112:1'];
    expect(entry.lastStudiedAt).toBeTruthy();

    expect(sel.showStudyRecency(store.getState())).toBe(true);
    store.dispatch(uiActions.toggleShowStudyRecency());
    expect(sel.showStudyRecency(store.getState())).toBe(false);
    store.dispatch(uiActions.setShowStudyRecency(true));
    expect(sel.showStudyRecency(store.getState())).toBe(true);

    store.dispatch(uiActions.setStudyRecencyFilter('overdue'));
    expect(sel.studyRecencyFilter(store.getState())).toBe('overdue');
    expect(sel.isAnyFilterActive(store.getState())).toBe(true);

    store.dispatch(uiActions.resetAllFilters());
    expect(sel.studyRecencyFilter(store.getState())).toBe('all');
    expect(sel.isAnyFilterActive(store.getState())).toBe(false);
  });
});
