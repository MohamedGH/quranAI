// ─── Dashboard Analytics & Chart Utilities ────────────────────────────────────

/**
 * Computes primary KPI numbers from learnData dictionary
 */
export function computeDashboardKpis(learnData, surahs = []) {
  const entries = Object.entries(learnData || {});
  
  const totalLearned = entries.filter(([, v]) => v.learned).length;
  const totalRead = entries.reduce((s, [, v]) => s + (v.readCount || 0), 0);
  const totalParts = entries.reduce((s, [, v]) => s + (v.parts?.length || 0), 0);
  const learnedParts = entries.reduce(
    (s, [, v]) => s + (v.parts?.filter((p) => p.learned).length || 0),
    0
  );
  const totalWords = entries.reduce(
    (s, [, v]) =>
      s + Object.keys(v.wordsLearned || {}).filter((k) => v.wordsLearned[k]).length,
    0
  );

  const surahProgress = {};
  entries.forEach(([key, v]) => {
    const [sNum] = key.split(":").map(Number);
    if (!surahProgress[sNum]) surahProgress[sNum] = { learned: 0, total: 0, read: 0 };
    surahProgress[sNum].total++;
    if (v.learned) surahProgress[sNum].learned++;
    surahProgress[sNum].read += v.readCount || 0;
  });

  const learnedSurahs = Object.entries(surahProgress).filter(
    ([, d]) => d.learned > 0 && d.learned === d.total
  ).length;

  const totalAyats = 6236;
  const pctAyats = totalAyats > 0 ? totalLearned / totalAyats : 0;

  return {
    totalLearned,
    totalRead,
    totalParts,
    learnedParts,
    totalWords,
    learnedSurahs,
    surahProgress,
    pctAyats,
  };
}

/**
 * Calculates current daily streak from activity logs
 */
export function computeActivityStreak(activity, referenceDate = new Date()) {
  let streak = 0;
  const d = new Date(referenceDate);

  while (true) {
    const key = d.toISOString().slice(0, 10);
    const act = activity[key];
    const hasActivity = act && ((act.ayatsRead || 0) + (act.ayatsLearned || 0) > 0);

    if (!hasActivity) {
      if (streak === 0) {
        // If today has no activity yet, check yesterday before breaking streak
        d.setDate(d.getDate() - 1);
        const yKey = d.toISOString().slice(0, 10);
        const yAct = activity[yKey];
        if (!yAct || ((yAct.ayatsRead || 0) + (yAct.ayatsLearned || 0) === 0)) {
          break;
        }
      } else {
        break;
      }
    } else {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    if (streak > 365) break;
  }

  return streak;
}

/**
 * Computes weekly activity sums and goal percentages
 */
export function computeWeeklyActivity(activity, weeklyGoal = 35, referenceDate = new Date()) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const act = activity[key] || {};
    return {
      date: key,
      ayatsRead: act.ayatsRead || 0,
      ayatsLearned: act.ayatsLearned || 0,
      partsLearned: act.partsLearned || 0,
    };
  });

  const totalRead = last7Days.reduce((s, day) => s + day.ayatsRead, 0);
  const totalLearned = last7Days.reduce((s, day) => s + day.ayatsLearned, 0);
  const weeklyPct = weeklyGoal > 0 ? Math.min(1, totalRead / weeklyGoal) : 0;

  return {
    last7Days,
    totalRead,
    totalLearned,
    weeklyPct,
  };
}

/**
 * Computes SVG Donut Chart strokeDasharray parameters
 */
export function computeDonutChartParams(pct, size = 80, stroke = 8) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashLength = circumference * Math.min(Math.max(pct, 0), 1);
  return {
    radius,
    circumference,
    dashLength,
    strokeDasharray: `${dashLength} ${circumference}`,
  };
}

/**
 * Generates month grid calendar cells with offsets
 */
export function computeCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = [];
  const startOffset = (firstDay + 6) % 7; // Monday-first offset

  // Trailing previous month days
  for (let i = 0; i < startOffset; i++) {
    cells.push({
      day: prevMonthDays - startOffset + i + 1,
      currentMonth: false,
      monthOffset: -1,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      currentMonth: true,
      monthOffset: 0,
    });
  }

  // Leading next month days to complete 35 or 42 grid
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    cells.push({
      day: d,
      currentMonth: false,
      monthOffset: 1,
    });
  }

  return {
    daysInMonth,
    startOffset,
    cells,
  };
}

/**
 * Computes per-Surah statistics for Learning Map dashboard view
 */
export function computeSurahLearningStats(surahs, learnData) {
  return (surahs || []).map((s) => {
    const total = s.numberOfAyahs || 0;
    const learned = Object.keys(learnData || {}).filter((k) => {
      const [sn] = k.split(":").map(Number);
      return sn === s.number && learnData[k]?.learned;
    }).length;

    const perfect = Object.keys(learnData || {}).filter((k) => {
      const [sn] = k.split(":").map(Number);
      if (sn !== s.number || !learnData[k]?.learned) return false;
      const attempts = learnData[k]?.writingAttempts || [];
      return attempts.some((a) => a.score === 100);
    }).length;

    const questioned = Object.keys(learnData || {}).filter((k) => {
      const [sn] = k.split(":").map(Number);
      return (
        sn === s.number &&
        learnData[k]?.questionScores &&
        Object.keys(learnData[k].questionScores).length > 0
      );
    }).length;

    const pct = total > 0 ? Math.round((learned / total) * 100) : 0;
    const status =
      learned === 0
        ? "not_started"
        : learned === total
        ? "completed"
        : "in_progress";

    return {
      number: s.number,
      name: s.name,
      englishName: s.englishName,
      numberOfAyahs: total,
      revelationType: s.revelationType,
      learned,
      perfect,
      questioned,
      pct,
      status,
    };
  });
}
