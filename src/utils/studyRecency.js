// ─── Pure Functional Study Recency & Color-Coding Engine ─────────────────────
// Computes elapsed time since a verse (ayat) was last studied across all learning
// activities (lecture, mémorisation, récitation, écriture, découpage, révision)
// and maps it to a clear, semantic 6-tier color scale with explicit text labels.

const MS_PER_HOUR = 3600 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export const STUDY_RECENCY_TIERS = Object.freeze({
  never: Object.freeze({
    id: "never",
    order: 5,
    label: "Jamais étudié",
    shortLabel: "Jamais",
    rangeLabel: "Non étudié",
    hex: "#94a3b8",
    textColor: "#cbd5e1",
    rgbaBg: "rgba(148, 163, 184, 0.10)",
    rgbaBorder: "rgba(148, 163, 184, 0.34)",
  }),
  fresh: Object.freeze({
    id: "fresh",
    order: 0,
    label: "Aujourd'hui (< 24h)",
    shortLabel: "Aujourd'hui",
    rangeLabel: "< 24h",
    hex: "#4caf81",
    textColor: "#6fcf97",
    rgbaBg: "rgba(76, 175, 129, 0.16)",
    rgbaBorder: "rgba(76, 175, 129, 0.48)",
  }),
  recent: Object.freeze({
    id: "recent",
    order: 1,
    label: "Récent (1 à 3 jours)",
    shortLabel: "1–3 j",
    rangeLabel: "1–3j",
    hex: "#2dd4bf",
    textColor: "#5eead4",
    rgbaBg: "rgba(45, 212, 191, 0.14)",
    rgbaBorder: "rgba(45, 212, 191, 0.45)",
  }),
  refresh: Object.freeze({
    id: "refresh",
    order: 2,
    label: "À rafraîchir (4 à 7 jours)",
    shortLabel: "4–7 j",
    rangeLabel: "4–7j",
    hex: "#fbbf24",
    textColor: "#fcd34d",
    rgbaBg: "rgba(251, 191, 36, 0.15)",
    rgbaBorder: "rgba(251, 191, 36, 0.48)",
  }),
  aging: Object.freeze({
    id: "aging",
    order: 3,
    label: "Ancien (8 à 14 jours)",
    shortLabel: "8–14 j",
    rangeLabel: "8–14j",
    hex: "#fb923c",
    textColor: "#fdba74",
    rgbaBg: "rgba(251, 146, 60, 0.16)",
    rgbaBorder: "rgba(251, 146, 60, 0.50)",
  }),
  overdue: Object.freeze({
    id: "overdue",
    order: 4,
    label: "Urgent (> 14 jours)",
    shortLabel: "> 14 j",
    rangeLabel: "> 14j",
    hex: "#f87171",
    textColor: "#fca5a5",
    rgbaBg: "rgba(248, 113, 113, 0.16)",
    rgbaBorder: "rgba(248, 113, 113, 0.52)",
  }),
});

export const STUDY_RECENCY_TIER_LIST = Object.freeze([
  STUDY_RECENCY_TIERS.fresh,
  STUDY_RECENCY_TIERS.recent,
  STUDY_RECENCY_TIERS.refresh,
  STUDY_RECENCY_TIERS.aging,
  STUDY_RECENCY_TIERS.overdue,
  STUDY_RECENCY_TIERS.never,
]);

export const STUDY_RECENCY_FILTERS = Object.freeze([
  { id: "all", label: "Tous", shortLabel: "Tous" },
  { id: "toReview", label: "À revoir (≥ 4j ou jamais)", shortLabel: "À revoir" },
  { id: "fresh", label: "Aujourd'hui (< 24h)", shortLabel: "< 24h" },
  { id: "recent", label: "1–3 jours", shortLabel: "1–3j" },
  { id: "refresh", label: "4–7 jours", shortLabel: "4–7j" },
  { id: "aging", label: "8–14 jours", shortLabel: "8–14j" },
  { id: "overdue", label: "> 14 jours", shortLabel: "> 14j" },
  { id: "never", label: "Jamais étudié", shortLabel: "Jamais" },
]);

const toTimestampMs = (val) => {
  if (val == null || val === "") return null;
  const ms = typeof val === "number" ? val : new Date(val).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
};

/**
 * Pure predicate returning true if `ld` reflects at least one real study action.
 */
export const hasAnyStudyRecord = (ld) => {
  if (!ld || typeof ld !== "object") return false;
  if ((ld.readCount || 0) > 0) return true;
  if (ld.learned) return true;
  if (Array.isArray(ld.parts) && ld.parts.length > 0) return true;
  if (ld.wordsLearned && Object.values(ld.wordsLearned).some(Boolean)) return true;
  if (Array.isArray(ld.recitAttempts) && ld.recitAttempts.length > 0) return true;
  if (Array.isArray(ld.writingAttempts) && ld.writingAttempts.length > 0) return true;
  if (Array.isArray(ld.memScores) && ld.memScores.length > 0) return true;
  if (ld.toRevise) return true;
  if (
    ld.lastStudiedAt ||
    ld.lastReadAt ||
    ld.firstReadAt ||
    (Array.isArray(ld.readDates) && ld.readDates.length > 0) ||
    ld.lastLearnedAt ||
    ld.firstLearnedAt ||
    ld.learnedAt ||
    ld.lastCutAt ||
    ld.lastWordLearnedAt ||
    ld.lastRevisedAt
  ) {
    return true;
  }
  return false;
};

/**
 * Resolves the latest study timestamp across all study signals inside `ld`.
 */
export const resolveAyatStudyInfo = (ld) => {
  if (!hasAnyStudyRecord(ld)) {
    return { lastStudiedAt: null, timestampMs: null, sourceType: null, sourceLabel: null };
  }

  const candidates = [];
  const push = (rawDate, sourceType, sourceLabel) => {
    const ms = toTimestampMs(rawDate);
    if (ms != null) candidates.push({ ms, iso: new Date(ms).toISOString(), sourceType, sourceLabel });
  };

  push(ld.lastStudiedAt, "study", "Étude");
  push(ld.lastReadAt, "read", "Lecture");
  push(ld.firstReadAt, "read", "Lecture");
  if (Array.isArray(ld.readDates)) {
    ld.readDates.forEach((d) => push(d, "read", "Lecture"));
  }
  push(ld.lastLearnedAt, "learn", "Mémorisation");
  push(ld.firstLearnedAt, "learn", "Mémorisation");
  push(ld.learnedAt, "learn", "Mémorisation");
  push(ld.lastCutAt, "parts", "Découpage");
  push(ld.lastWordLearnedAt, "words", "Mots");
  push(ld.lastRevisedAt, "revise", "Révision");

  if (Array.isArray(ld.parts)) {
    ld.parts.forEach((p) => push(p?.createdAt, "parts", "Découpage"));
  }
  if (Array.isArray(ld.recitAttempts)) {
    ld.recitAttempts.forEach((a) => push(a?.date || a?.at, "recit", "Récitation"));
  }
  if (Array.isArray(ld.writingAttempts)) {
    ld.writingAttempts.forEach((a) => push(a?.date || a?.at, "writing", "Écriture"));
  }
  if (Array.isArray(ld.memScores)) {
    ld.memScores.forEach((a) => push(a?.date || a?.at, "mem", "Mémorisation"));
  }

  // Fallback to updatedAt / createdAt ONLY when a real study action exists
  if (candidates.length === 0) {
    push(ld.updatedAt, "study", "Étude");
    push(ld.createdAt, "study", "Étude");
  }

  if (candidates.length === 0) {
    return { lastStudiedAt: null, timestampMs: null, sourceType: null, sourceLabel: null };
  }

  candidates.sort((a, b) => b.ms - a.ms);
  const latest = candidates[0];
  return {
    lastStudiedAt: latest.iso,
    timestampMs: latest.ms,
    sourceType: latest.sourceType,
    sourceLabel: latest.sourceLabel,
  };
};

/**
 * Formats an elapsed duration in milliseconds into concise & full French labels.
 */
export const formatElapsedFrench = (diffMs) => {
  const safeMs = Math.max(0, Number(diffMs) || 0);
  const totalMinutes = Math.floor(safeMs / (60 * 1000));
  const totalHours = Math.floor(safeMs / MS_PER_HOUR);
  const totalDays = Math.floor(safeMs / MS_PER_DAY);

  if (totalMinutes < 5) {
    return { shortLabel: "À l'instant", fullLabel: "À l'instant (< 5 min)", hours: 0, days: 0 };
  }
  if (totalMinutes < 60) {
    return { shortLabel: `${totalMinutes} min`, fullLabel: `Il y a ${totalMinutes} min`, hours: 0, days: 0 };
  }
  if (totalHours < 24) {
    return {
      shortLabel: `${totalHours}h`,
      fullLabel: `Aujourd'hui · il y a ${totalHours}h`,
      hours: totalHours,
      days: 0,
    };
  }
  if (totalDays < 60) {
    return {
      shortLabel: `${totalDays}j`,
      fullLabel: `Il y a ${totalDays} jour${totalDays > 1 ? "s" : ""}`,
      hours: totalHours,
      days: totalDays,
    };
  }
  if (totalDays < 365) {
    const months = Math.max(2, Math.floor(totalDays / 30));
    return {
      shortLabel: `${months} mois`,
      fullLabel: `Il y a ${months} mois (${totalDays}j)`,
      hours: totalHours,
      days: totalDays,
    };
  }
  const years = Math.floor(totalDays / 365);
  return {
    shortLabel: `${years} an${years > 1 ? "s" : ""}`,
    fullLabel: `Il y a ${years} an${years > 1 ? "s" : ""} (${totalDays}j)`,
    hours: totalHours,
    days: totalDays,
  };
};

/**
 * Resolves the semantic color tier from an elapsed duration (ms).
 */
export const getStudyRecencyTierFromDiff = (diffMs) => {
  if (diffMs == null || !Number.isFinite(diffMs)) return STUDY_RECENCY_TIERS.never;
  const safeMs = Math.max(0, diffMs);
  const hours = safeMs / MS_PER_HOUR;
  if (hours < 24) return STUDY_RECENCY_TIERS.fresh;
  const days = Math.floor(safeMs / MS_PER_DAY);
  if (days <= 3) return STUDY_RECENCY_TIERS.recent;
  if (days <= 7) return STUDY_RECENCY_TIERS.refresh;
  if (days <= 14) return STUDY_RECENCY_TIERS.aging;
  return STUDY_RECENCY_TIERS.overdue;
};

/**
 * Computes full recency metadata + color coding for a verse's `learnData` entry.
 */
export const getStudyRecencyInfo = (ld, now = new Date()) => {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const { lastStudiedAt, timestampMs, sourceType, sourceLabel } = resolveAyatStudyInfo(ld);

  if (timestampMs == null) {
    const tier = STUDY_RECENCY_TIERS.never;
    return {
      studied: false,
      lastStudiedAt: null,
      tierId: tier.id,
      tier,
      tierLabel: tier.label,
      shortLabel: tier.shortLabel,
      fullLabel: "Jamais étudié",
      dateLabel: null,
      sourceType: null,
      sourceLabel: null,
      days: null,
      hours: null,
      diffMs: null,
      hex: tier.hex,
      textColor: tier.textColor,
      rgbaBg: tier.rgbaBg,
      rgbaBorder: tier.rgbaBorder,
      tooltip: "Verset jamais étudié pour le moment",
    };
  }

  const diffMs = Math.max(0, nowMs - timestampMs);
  const tier = getStudyRecencyTierFromDiff(diffMs);
  const elapsed = formatElapsedFrench(diffMs);

  let dateLabel = "";
  try {
    dateLabel = new Date(timestampMs).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    dateLabel = new Date(timestampMs).toISOString().slice(0, 10);
  }

  const sourcePart = sourceLabel ? ` (${sourceLabel})` : "";
  const tooltip = `Dernière étude : ${elapsed.fullLabel}${sourcePart} · le ${dateLabel} · Statut : ${tier.label}`;

  return {
    studied: true,
    lastStudiedAt,
    tierId: tier.id,
    tier,
    tierLabel: tier.label,
    shortLabel: elapsed.shortLabel,
    fullLabel: elapsed.fullLabel,
    dateLabel,
    sourceType,
    sourceLabel,
    days: elapsed.days,
    hours: elapsed.hours,
    diffMs,
    hex: tier.hex,
    textColor: tier.textColor,
    rgbaBg: tier.rgbaBg,
    rgbaBorder: tier.rgbaBorder,
    tooltip,
  };
};

/**
 * Pure filter predicate checking if `recencyInfo` matches a selected `filterId`.
 */
export const matchesStudyRecencyFilter = (recencyInfo, filterId = "all") => {
  if (!filterId || filterId === "all") return true;
  if (!recencyInfo) return false;
  if (filterId === "toReview") {
    return ["never", "refresh", "aging", "overdue"].includes(recencyInfo.tierId);
  }
  return recencyInfo.tierId === filterId;
};

/**
 * Computes summary counts across all 6 study recency tiers for a list of ayats.
 */
export const computeStudyRecencySummary = (
  ayats = [],
  learnData = {},
  fallbackSurahNum = 1,
  now = new Date()
) => {
  const counts = {
    fresh: 0,
    recent: 0,
    refresh: 0,
    aging: 0,
    overdue: 0,
    never: 0,
    studiedCount: 0,
    toReviewCount: 0,
    total: 0,
  };
  if (!Array.isArray(ayats) || ayats.length === 0) return counts;

  ayats.forEach((a) => {
    if (!a) return;
    const sn = a.surahNumber ?? a.surah?.number ?? fallbackSurahNum;
    const key = `${sn}:${a.numberInSurah}`;
    const info = getStudyRecencyInfo(learnData?.[key], now);
    counts[info.tierId] = (counts[info.tierId] || 0) + 1;
    counts.total += 1;
    if (info.studied) counts.studiedCount += 1;
    if (["never", "refresh", "aging", "overdue"].includes(info.tierId)) {
      counts.toReviewCount += 1;
    }
  });

  return counts;
};
