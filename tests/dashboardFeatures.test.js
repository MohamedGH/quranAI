import { describe, it, expect } from "vitest";
import {
  computeDashboardKpis,
  computeActivityStreak,
  computeWeeklyActivity,
  computeDonutChartParams,
  computeCalendarGrid,
  computeSurahLearningStats,
} from "../src/utils/dashboardAnalytics.js";

describe("Dashboard Charts, Widgets & Analytics Test Suite", () => {
  describe("KPI Computations (computeDashboardKpis)", () => {
    it("accurately aggregates learned ayats, readings, parts, and memorized words", () => {
      const mockLearnData = {
        "1:1": { learned: true, readCount: 10, parts: [{ learned: true }, { learned: false }], wordsLearned: { 0: true, 1: true } },
        "1:2": { learned: true, readCount: 5, parts: [{ learned: true }], wordsLearned: { 0: true } },
        "1:3": { learned: false, readCount: 3, parts: [], wordsLearned: {} },
        "2:255": { learned: true, readCount: 20, parts: [{ learned: true }, { learned: true }], wordsLearned: { 0: true, 1: true, 2: true } },
      };

      const kpis = computeDashboardKpis(mockLearnData);

      expect(kpis.totalLearned).toBe(3); // 1:1, 1:2, 2:255
      expect(kpis.totalRead).toBe(38); // 10 + 5 + 3 + 20
      expect(kpis.totalParts).toBe(5); // 2 + 1 + 0 + 2
      expect(kpis.learnedParts).toBe(4); // 1 + 1 + 0 + 2
      expect(kpis.totalWords).toBe(6); // 2 + 1 + 0 + 3
      expect(kpis.pctAyats).toBeCloseTo(3 / 6236, 5);
    });

    it("identifies 100% completed surahs", () => {
      // Surah 112 (Al-Ikhlas) has 4 ayats. If all 4 are learned:
      const mockLearnData = {
        "112:1": { learned: true, readCount: 4 },
        "112:2": { learned: true, readCount: 4 },
        "112:3": { learned: true, readCount: 4 },
        "112:4": { learned: true, readCount: 4 },
        "113:1": { learned: true, readCount: 2 },
        "113:2": { learned: false, readCount: 1 },
      };

      const kpis = computeDashboardKpis(mockLearnData);
      expect(kpis.learnedSurahs).toBe(1); // Surah 112 is 100% (4/4)
      expect(kpis.surahProgress[112].learned).toBe(4);
      expect(kpis.surahProgress[113].learned).toBe(1);
    });
  });

  describe("Daily Streak Engine (computeActivityStreak)", () => {
    it("computes active consecutive day streaks", () => {
      const today = new Date("2026-08-29T12:00:00Z");
      const activity = {
        "2026-08-29": { ayatsRead: 5, ayatsLearned: 2 },
        "2026-08-28": { ayatsRead: 3, ayatsLearned: 1 },
        "2026-08-27": { ayatsRead: 10, ayatsLearned: 0 },
        "2026-08-26": { ayatsRead: 0, ayatsLearned: 0 }, // Break
        "2026-08-25": { ayatsRead: 8, ayatsLearned: 2 },
      };

      const streak = computeActivityStreak(activity, today);
      expect(streak).toBe(3); // 29th, 28th, 27th
    });

    it("preserves streak if today has not been started yet but yesterday was active", () => {
      const today = new Date("2026-08-29T12:00:00Z");
      const activity = {
        "2026-08-28": { ayatsRead: 4, ayatsLearned: 1 },
        "2026-08-27": { ayatsRead: 2, ayatsLearned: 0 },
      };

      const streak = computeActivityStreak(activity, today);
      expect(streak).toBe(2); // 28th and 27th preserved
    });

    it("returns 0 if yesterday was inactive and today is inactive", () => {
      const today = new Date("2026-08-29T12:00:00Z");
      const activity = {
        "2026-08-26": { ayatsRead: 10, ayatsLearned: 2 },
      };

      const streak = computeActivityStreak(activity, today);
      expect(streak).toBe(0);
    });
  });

  describe("Weekly Progress & Goals (computeWeeklyActivity)", () => {
    it("calculates 7-day rolling totals and goal percentages", () => {
      const refDate = new Date("2026-08-29T12:00:00Z");
      const activity = {
        "2026-08-29": { ayatsRead: 5, ayatsLearned: 1 },
        "2026-08-28": { ayatsRead: 5, ayatsLearned: 1 },
        "2026-08-27": { ayatsRead: 10, ayatsLearned: 2 },
      };

      const weekly = computeWeeklyActivity(activity, 40, refDate);
      expect(weekly.last7Days).toHaveLength(7);
      expect(weekly.totalRead).toBe(20);
      expect(weekly.totalLearned).toBe(4);
      expect(weekly.weeklyPct).toBe(0.5); // 20 / 40
    });
  });

  describe("Donut Chart SVG Parameters (computeDonutChartParams)", () => {
    it("computes SVG stroke-dasharray and radius mathematically", () => {
      const size = 80;
      const stroke = 8;
      const pct = 0.75; // 75%

      const params = computeDonutChartParams(pct, size, stroke);
      expect(params.radius).toBe(36); // (80 - 8) / 2
      expect(params.circumference).toBeCloseTo(2 * Math.PI * 36, 4);
      expect(params.dashLength).toBeCloseTo(params.circumference * 0.75, 4);
    });

    it("clamps strokeDasharray between 0% and 100%", () => {
      const over = computeDonutChartParams(1.5, 100, 10);
      expect(over.dashLength).toBeCloseTo(over.circumference, 4);

      const under = computeDonutChartParams(-0.5, 100, 10);
      expect(under.dashLength).toBe(0);
    });
  });

  describe("Activity Calendar Grid Math (computeCalendarGrid)", () => {
    it("calculates correct Monday-first offsets and day counts for August 2026", () => {
      // August 2026 has 31 days. Aug 1, 2026 is a Saturday (offset = 5)
      const grid = computeCalendarGrid(2026, 7); // Month index 7 = August

      expect(grid.daysInMonth).toBe(31);
      expect(grid.startOffset).toBe(5); // 5 days from previous month (July 27-31)
      expect(grid.cells.filter((c) => c.currentMonth)).toHaveLength(31);
      expect(grid.cells.length % 7).toBe(0); // Perfect complete week rows
    });
  });

  describe("Learning Map Surah Stats (computeSurahLearningStats)", () => {
    it("computes breakdown per Surah with perfect and quiz questioned counts", () => {
      const mockSurahs = [
        { number: 1, name: "الفاتحة", englishName: "Al-Fatiha", numberOfAyahs: 7, revelationType: "Meccan" },
        { number: 112, name: "الإخلاص", englishName: "Al-Ikhlas", numberOfAyahs: 4, revelationType: "Meccan" },
      ];

      const mockLearnData = {
        "1:1": { learned: true, questionScores: { first_word: 100 } },
        "1:2": { learned: true, writingAttempts: [{ score: 100 }] },
        "112:1": { learned: true },
        "112:2": { learned: true },
        "112:3": { learned: true },
        "112:4": { learned: true },
      };

      const stats = computeSurahLearningStats(mockSurahs, mockLearnData);
      expect(stats).toHaveLength(2);

      // Surah 1: 2/7 learned (in_progress)
      expect(stats[0].learned).toBe(2);
      expect(stats[0].pct).toBe(29);
      expect(stats[0].status).toBe("in_progress");
      expect(stats[0].perfect).toBe(1); // 1:2 has score 100
      expect(stats[0].questioned).toBe(1); // 1:1 has question score

      // Surah 112: 4/4 learned (completed)
      expect(stats[1].learned).toBe(4);
      expect(stats[1].pct).toBe(100);
      expect(stats[1].status).toBe("completed");
    });
  });
});
