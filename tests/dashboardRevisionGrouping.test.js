import { describe, it, expect } from "vitest";
import {
  REVISION_GROUP_MODES,
  GROUP_MODE_LABELS,
  getRelativeDateBucket,
  getUrgencyRevisionBucket,
  groupBySurah,
  groupByDateRevised,
  groupByFirstReadDate,
  groupByLastReadDate,
  groupByHizb,
  groupByLearningStatus,
  groupRevisionQueue,
  toggleGroupCollapse,
  isGroupCollapsed,
  collapseAllGroups,
  expandAllGroups,
  safeParseDateMs,
  formatShortDateFr,
} from "../src/utils/dashboardRevisionGrouping.js";

describe("Dashboard Revision Grouping Engine", () => {
  const refDate = new Date("2026-10-27T12:00:00Z");

  const mockSurahs = [
    { number: 1, englishName: "Al-Fatihah", name: "الفاتحة", englishNameTranslation: "The Opening", numberOfAyahs: 7, revelationType: "Meccan" },
    { number: 2, englishName: "Al-Baqarah", name: "البقرة", englishNameTranslation: "The Cow", numberOfAyahs: 286, revelationType: "Medinan" },
    { number: 112, englishName: "Al-Ikhlas", name: "الإخلاص", englishNameTranslation: "The Sincerity", numberOfAyahs: 4, revelationType: "Meccan" },
  ];

  const mockQueue = [
    {
      key: "2:255",
      surahNum: 2,
      ayatNum: 255,
      surahNameEn: "Al-Baqarah",
      surahNameAr: "البقرة",
      hizb: 5,
      juz: 3,
      isLearned: true,
      firstReadAt: "2026-09-01T10:00:00Z", // > 30 days ago
      lastReadAt: "2026-10-27T10:00:00Z",  // Today
      reviseDate: "2026-10-22T10:00:00Z",  // 5 days ago (1 week)
      readCount: 15,
      reviseWordList: ["اللَّهُ"],
      reviseScope: "partial",
    },
    {
      key: "1:1",
      surahNum: 1,
      ayatNum: 1,
      surahNameEn: "Al-Fatihah",
      surahNameAr: "الفاتحة",
      hizb: 1,
      juz: 1,
      isLearned: true,
      firstReadAt: "2026-10-26T12:00:00Z", // Yesterday
      lastReadAt: "2026-10-26T14:00:00Z",  // Yesterday
      reviseDate: "2026-10-27T11:00:00Z",  // < 24h (Recent)
      readCount: 5,
      reviseWordList: [],
      reviseScope: "all",
    },
    {
      key: "1:2",
      surahNum: 1,
      ayatNum: 2,
      surahNameEn: "Al-Fatihah",
      surahNameAr: "الفاتحة",
      hizb: 1,
      juz: 1,
      isLearned: false,
      firstReadAt: "2026-10-24T12:00:00Z", // 3 days ago (This week)
      lastReadAt: "2026-10-25T12:00:00Z",  // 2 days ago (This week)
      reviseDate: "2026-10-10T12:00:00Z",  // 17 days ago (> 14 days Critical)
      readCount: 3,
      reviseWordList: ["الْحَمْدُ"],
      reviseScope: "partial",
    },
    {
      key: "112:1",
      surahNum: 112,
      ayatNum: 1,
      surahNameEn: "Al-Ikhlas",
      surahNameAr: "الإخلاص",
      hizb: 60,
      juz: 30,
      isLearned: true,
      firstReadAt: null, // undated
      lastReadAt: null,  // undated
      reviseDate: "2026-10-15T12:00:00Z",  // 12 days ago (8-14 days Urgent)
      readCount: 1,
      reviseWordList: [],
      reviseScope: "all",
    },
  ];

  describe("Date bucket utilities", () => {
    it("safely parses timestamps and formats dates in French", () => {
      expect(safeParseDateMs("2026-10-27T12:00:00Z")).toBe(new Date("2026-10-27T12:00:00Z").getTime());
      expect(safeParseDateMs(null)).toBeNull();
      expect(safeParseDateMs("invalid")).toBeNull();

      expect(formatShortDateFr("2026-10-27T12:00:00Z")).toContain("2026");
      expect(formatShortDateFr(null, "Non spécifié")).toBe("Non spécifié");
    });

    it("accurately categorizes relative date buckets", () => {
      // Today (<1 day)
      const bToday = getRelativeDateBucket("2026-10-27T10:00:00Z", refDate);
      expect(bToday.id).toBe("bucket_today");

      // Yesterday (<2 days)
      const bYest = getRelativeDateBucket("2026-10-26T10:00:00Z", refDate);
      expect(bYest.id).toBe("bucket_yesterday");

      // This week (2..7 days)
      const bWeek = getRelativeDateBucket("2026-10-23T10:00:00Z", refDate);
      expect(bWeek.id).toBe("bucket_this_week");

      // This month (8..30 days)
      const bMonth = getRelativeDateBucket("2026-10-05T10:00:00Z", refDate);
      expect(bMonth.id).toBe("bucket_this_month");

      // Older (>30 days)
      const bOld = getRelativeDateBucket("2026-08-01T10:00:00Z", refDate);
      expect(bOld.id).toBe("bucket_older");

      // Undated
      const bNone = getRelativeDateBucket(null, refDate);
      expect(bNone.id).toBe("bucket_undated");
    });

    it("accurately categorizes urgency buckets for revision requests", () => {
      // Recent (<24h)
      const bRecent = getUrgencyRevisionBucket("2026-10-27T08:00:00Z", refDate);
      expect(bRecent.id).toBe("rev_recent");

      // Few days (1..3 days)
      const bFew = getUrgencyRevisionBucket("2026-10-25T12:00:00Z", refDate);
      expect(bFew.id).toBe("rev_few_days");

      // One week (4..7 days)
      const bWeek = getUrgencyRevisionBucket("2026-10-21T12:00:00Z", refDate);
      expect(bWeek.id).toBe("rev_week");

      // Urgent (8..14 days)
      const bUrg = getUrgencyRevisionBucket("2026-10-15T12:00:00Z", refDate);
      expect(bUrg.id).toBe("rev_urgent");

      // Critical (>14 days)
      const bCrit = getUrgencyRevisionBucket("2026-10-01T12:00:00Z", refDate);
      expect(bCrit.id).toBe("rev_critical");
    });
  });

  describe("Grouping by Surah (groupBySurah)", () => {
    it("groups revision items by Surah in ascending order and attaches metadata", () => {
      const groups = groupBySurah(mockQueue, mockSurahs);
      expect(groups.length).toBe(3); // Surah 1, Surah 2, Surah 112

      // Check Surah 1
      const g1 = groups[0];
      expect(g1.id).toBe("surah-1");
      expect(g1.title).toContain("Sourate 1");
      expect(g1.arabicTitle).toBe("الفاتحة");
      expect(g1.count).toBe(2); // 1:1 and 1:2
      expect(g1.items[0].key).toBe("1:1");
      expect(g1.items[1].key).toBe("1:2");

      // Check Surah 2
      const g2 = groups[1];
      expect(g2.id).toBe("surah-2");
      expect(g2.count).toBe(1);
      expect(g2.items[0].key).toBe("2:255");

      // Check Surah 112
      const g112 = groups[2];
      expect(g112.id).toBe("surah-112");
      expect(g112.count).toBe(1);
    });

    it("returns empty array safely when queue is empty or invalid", () => {
      expect(groupBySurah([], mockSurahs)).toEqual([]);
      expect(groupBySurah(null, mockSurahs)).toEqual([]);
    });
  });

  describe("Grouping by Date Revised (groupByDateRevised)", () => {
    it("groups items into urgency buckets and sorts by priority", () => {
      const groups = groupByDateRevised(mockQueue, refDate);
      expect(groups.length).toBe(4); // Recent, Week, Urgent, Critical

      const ids = groups.map((g) => g.id);
      expect(ids).toContain("rev_recent");
      expect(ids).toContain("rev_week");
      expect(ids).toContain("rev_urgent");
      expect(ids).toContain("rev_critical");

      const recentGroup = groups.find((g) => g.id === "rev_recent");
      expect(recentGroup.count).toBe(1);
      expect(recentGroup.items[0].key).toBe("1:1");

      const criticalGroup = groups.find((g) => g.id === "rev_critical");
      expect(criticalGroup.count).toBe(1);
      expect(criticalGroup.items[0].key).toBe("1:2");
    });
  });

  describe("Grouping by First Read Date (groupByFirstReadDate)", () => {
    it("groups items by first reading milestone", () => {
      const groups = groupByFirstReadDate(mockQueue, refDate);
      expect(groups.length).toBeGreaterThanOrEqual(3);

      const yesterdayGroup = groups.find((g) => g.id === "first_read_bucket_yesterday");
      expect(yesterdayGroup).toBeDefined();
      expect(yesterdayGroup.items[0].key).toBe("1:1");

      const undatedGroup = groups.find((g) => g.id === "first_read_bucket_undated");
      expect(undatedGroup).toBeDefined();
      expect(undatedGroup.items[0].key).toBe("112:1");
    });
  });

  describe("Grouping by Last Read Date (groupByLastReadDate)", () => {
    it("groups items by last reading milestone with most recent items first", () => {
      const groups = groupByLastReadDate(mockQueue, refDate);
      expect(groups.length).toBeGreaterThanOrEqual(2);

      const todayGroup = groups.find((g) => g.id === "last_read_bucket_today");
      expect(todayGroup).toBeDefined();
      expect(todayGroup.items[0].key).toBe("2:255");
    });
  });

  describe("Grouping by Hizb (groupByHizb)", () => {
    it("groups items into Hizb sections", () => {
      const groups = groupByHizb(mockQueue);
      expect(groups.length).toBe(3); // Hizb 1, Hizb 5, Hizb 60

      expect(groups[0].id).toBe("hizb-1");
      expect(groups[0].count).toBe(2);

      expect(groups[1].id).toBe("hizb-5");
      expect(groups[1].count).toBe(1);

      expect(groups[2].id).toBe("hizb-60");
      expect(groups[2].count).toBe(1);
    });
  });

  describe("Grouping by Learning Status (groupByLearningStatus)", () => {
    it("groups items into Learned (retention) vs In progress", () => {
      const groups = groupByLearningStatus(mockQueue);
      expect(groups.length).toBe(2);

      const learnedGroup = groups.find((g) => g.id === "status-learned");
      expect(learnedGroup.count).toBe(3); // 2:255, 1:1, 112:1

      const progressGroup = groups.find((g) => g.id === "status-in-progress");
      expect(progressGroup.count).toBe(1); // 1:2
    });
  });

  describe("groupRevisionQueue master dispatcher", () => {
    it("properly dispatches to the requested mode", () => {
      const bySurah = groupRevisionQueue(mockQueue, REVISION_GROUP_MODES.SURAH, { surahs: mockSurahs });
      expect(bySurah[0].type).toBe(REVISION_GROUP_MODES.SURAH);

      const byRevDate = groupRevisionQueue(mockQueue, REVISION_GROUP_MODES.DATE_REVISED, { referenceDate: refDate });
      expect(byRevDate[0].type).toBe(REVISION_GROUP_MODES.DATE_REVISED);

      const byHizb = groupRevisionQueue(mockQueue, REVISION_GROUP_MODES.HIZB);
      expect(byHizb[0].type).toBe(REVISION_GROUP_MODES.HIZB);
    });
  });

  describe("Toggleable Collapse & Expansion state helpers", () => {
    it("toggles group collapse state immutably", () => {
      const initial = {};
      const s1 = toggleGroupCollapse(initial, "surah-1");
      expect(s1["surah-1"]).toBe(true);
      expect(isGroupCollapsed(s1, "surah-1")).toBe(true);

      const s2 = toggleGroupCollapse(s1, "surah-1");
      expect(s2["surah-1"]).toBe(false);
      expect(isGroupCollapsed(s2, "surah-1")).toBe(false);
    });

    it("collapses all groups and expands all groups immutably", () => {
      const mockGroups = [{ id: "g1" }, { id: "g2" }, { id: "g3" }];
      const collapsedAll = collapseAllGroups(mockGroups);

      expect(collapsedAll).toEqual({ g1: true, g2: true, g3: true });
      expect(isGroupCollapsed(collapsedAll, "g1")).toBe(true);
      expect(isGroupCollapsed(collapsedAll, "g2")).toBe(true);

      const expandedAll = expandAllGroups();
      expect(expandedAll).toEqual({});
      expect(isGroupCollapsed(expandedAll, "g1")).toBe(false);
    });
  });
});
