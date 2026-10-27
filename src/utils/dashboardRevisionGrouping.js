// ─── Pure Functional Dashboard Revision Grouping Engine ─────────────────────
// Handles flexible, toggleable grouping of revision items by:
// 1. Sourate (Surah)
// 2. Date de mise à réviser (Urgency & chronology)
// 3. Date de première lecture (First reading)
// 4. Date de dernière lecture (Last reading)
// 5. Hizb
// 6. Statut d'apprentissage (Learned vs In progress)

import { SURAH_INFO } from "./arabicUtils.js";
import { ERROR_CODES, trySync } from "./errorManager.js";

export const REVISION_GROUP_MODES = Object.freeze({
  SURAH: "surah",
  DATE_REVISED: "date_revised",
  FIRST_READ: "first_read",
  LAST_READ: "last_read",
  HIZB: "hizb",
  STATUS: "status",
});

export const GROUP_MODE_LABELS = Object.freeze({
  [REVISION_GROUP_MODES.SURAH]: {
    id: REVISION_GROUP_MODES.SURAH,
    label: "Par Sourate",
    icon: "📖",
    description: "Regrouper les versets par sourate",
  },
  [REVISION_GROUP_MODES.DATE_REVISED]: {
    id: REVISION_GROUP_MODES.DATE_REVISED,
    label: "Date mise à réviser",
    icon: "🔖",
    description: "Regrouper par ancienneté de la mise à réviser",
  },
  [REVISION_GROUP_MODES.FIRST_READ]: {
    id: REVISION_GROUP_MODES.FIRST_READ,
    label: "Date 1ère lecture",
    icon: "🌱",
    description: "Regrouper par date de première découverte",
  },
  [REVISION_GROUP_MODES.LAST_READ]: {
    id: REVISION_GROUP_MODES.LAST_READ,
    label: "Dernière lecture",
    icon: "🕒",
    description: "Regrouper par date de lecture la plus récente",
  },
  [REVISION_GROUP_MODES.HIZB]: {
    id: REVISION_GROUP_MODES.HIZB,
    label: "Par Hizb",
    icon: "📜",
    description: "Regrouper par section Hizb (1 à 60)",
  },
  [REVISION_GROUP_MODES.STATUS]: {
    id: REVISION_GROUP_MODES.STATUS,
    label: "Statut d'apprentissage",
    icon: "✓",
    description: "Regrouper par statut appris ou en cours",
  },
});

/**
 * Pure helper to parse date safely into a timestamp number or null.
 */
export const safeParseDateMs = (dateVal) => {
  if (!dateVal) return null;
  const time = new Date(dateVal).getTime();
  return Number.isFinite(time) ? time : null;
};

/**
 * Pure helper to format a date nicely in French.
 */
export const formatShortDateFr = (dateVal, fallback = "Non daté") => {
  if (!dateVal) return fallback;
  try {
    const dt = new Date(dateVal);
    if (!Number.isFinite(dt.getTime())) return fallback;
    return dt.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return fallback;
  }
};

/**
 * Classifies a date into a chronological relative bucket.
 */
export const getRelativeDateBucket = (isoDateStr, referenceDate = new Date()) => {
  const time = safeParseDateMs(isoDateStr);
  if (!time) {
    return Object.freeze({
      id: "bucket_undated",
      label: "Date non renseignée",
      order: 99,
      icon: "⏳",
      color: "var(--text3)",
      badgeBg: "rgba(128,128,128,0.15)",
    });
  }

  const nowMs = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
  const diffDays = Math.max(0, (nowMs - time) / (1000 * 60 * 60 * 24));

  if (diffDays < 1) {
    return Object.freeze({
      id: "bucket_today",
      label: "Aujourd'hui",
      order: 1,
      icon: "✨",
      color: "var(--teal2)",
      badgeBg: "rgba(62,184,160,0.15)",
    });
  }
  if (diffDays < 2) {
    return Object.freeze({
      id: "bucket_yesterday",
      label: "Hier",
      order: 2,
      icon: "🕒",
      color: "var(--teal)",
      badgeBg: "rgba(62,184,160,0.12)",
    });
  }
  if (diffDays <= 7) {
    return Object.freeze({
      id: "bucket_this_week",
      label: "Cette semaine (2 à 7 jours)",
      order: 3,
      icon: "📅",
      color: "var(--gold2)",
      badgeBg: "rgba(201,168,76,0.15)",
    });
  }
  if (diffDays <= 30) {
    return Object.freeze({
      id: "bucket_this_month",
      label: "Ce mois-ci (8 à 30 jours)",
      order: 4,
      icon: "🗓",
      color: "var(--gold)",
      badgeBg: "rgba(201,168,76,0.12)",
    });
  }
  return Object.freeze({
    id: "bucket_older",
    label: "Plus ancien (> 30 jours)",
    order: 5,
    icon: "📜",
    color: "var(--text2)",
    badgeBg: "rgba(255,255,255,0.08)",
  });
};

/**
 * Classifies a date marked for revision according to urgency gradient.
 */
export const getUrgencyRevisionBucket = (isoDateStr, referenceDate = new Date()) => {
  const time = safeParseDateMs(isoDateStr);
  if (!time) {
    return Object.freeze({
      id: "rev_undated",
      label: "Sans date spécifique",
      order: 99,
      icon: "⏳",
      color: "var(--text3)",
      badgeBg: "rgba(128,128,128,0.15)",
    });
  }

  const nowMs = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
  const diffDays = Math.max(0, (nowMs - time) / (1000 * 60 * 60 * 24));

  if (diffDays < 1) {
    return Object.freeze({
      id: "rev_recent",
      label: "Ajout récent (< 24h)",
      order: 1,
      icon: "⚪",
      color: "#ffffff",
      badgeBg: "rgba(255,255,255,0.12)",
    });
  }
  if (diffDays <= 3) {
    return Object.freeze({
      id: "rev_few_days",
      label: "Récent (1 à 3 jours)",
      order: 2,
      icon: "🟡",
      color: "#fef08a",
      badgeBg: "rgba(254,240,138,0.15)",
    });
  }
  if (diffDays <= 7) {
    return Object.freeze({
      id: "rev_week",
      label: "À réviser (~1 semaine)",
      order: 3,
      icon: "🟠",
      color: "#fb923c",
      badgeBg: "rgba(251,146,60,0.15)",
    });
  }
  if (diffDays <= 14) {
    return Object.freeze({
      id: "rev_urgent",
      label: "Prioritaire (8 à 14 jours)",
      order: 4,
      icon: "🔴",
      color: "#f87171",
      badgeBg: "rgba(248,113,113,0.18)",
    });
  }
  return Object.freeze({
    id: "rev_critical",
    label: "Urgent (> 14 jours de retard)",
    order: 5,
    icon: "🔥",
    color: "#ef4444",
    badgeBg: "rgba(239,68,68,0.22)",
  });
};

/**
 * Pure function: Groups revision queue items by Surah.
 */
export const groupBySurah = (queue = [], surahs = []) =>
  trySync(
    () => {
      if (!Array.isArray(queue) || queue.length === 0) return Object.freeze([]);

      const surahMap = new Map();

      queue.forEach((item) => {
        const sNum = Number(item.surahNum) || 1;
        if (!surahMap.has(sNum)) {
          const info = SURAH_INFO[sNum - 1] || { n: sNum, en: `Surah ${sNum}`, ar: `${sNum}`, count: 1 };
          const meta = (surahs || []).find((s) => s.number === sNum);
          surahMap.set(sNum, {
            id: `surah-${sNum}`,
            groupKey: sNum,
            type: REVISION_GROUP_MODES.SURAH,
            title: `Sourate ${sNum} · ${meta?.englishName || info.en}`,
            arabicTitle: meta?.name || info.ar,
            subtitle: `${meta?.englishNameTranslation || ""} · ${meta?.numberOfAyahs || info.count} versets`,
            icon: "📖",
            color: "var(--gold2)",
            items: [],
            meta: {
              surahNum: sNum,
              revelationType: meta?.revelationType || (sNum <= 5 ? "Medinan" : "Meccan"),
            },
          });
        }
        surahMap.get(sNum).items.push(item);
      });

      return Object.freeze(
        Array.from(surahMap.values())
          .sort((a, b) => a.groupKey - b.groupKey)
          .map((g) =>
            Object.freeze({
              ...g,
              count: g.items.length,
              items: Object.freeze(
                [...g.items].sort((a, b) => (Number(a.ayatNum) || 0) - (Number(b.ayatNum) || 0))
              ),
            })
          )
      );
    },
    Object.freeze([]),
    { code: ERROR_CODES.UNKNOWN_ERROR, feature: "groupBySurah" }
  ).value;

/**
 * Pure function: Groups revision queue items by Date marked for revision.
 */
export const groupByDateRevised = (queue = [], referenceDate = new Date()) =>
  trySync(
    () => {
      if (!Array.isArray(queue) || queue.length === 0) return Object.freeze([]);

      const bucketMap = new Map();

      queue.forEach((item) => {
        const bucket = getUrgencyRevisionBucket(item.reviseDate, referenceDate);
        if (!bucketMap.has(bucket.id)) {
          bucketMap.set(bucket.id, {
            id: bucket.id,
            groupKey: bucket.order,
            type: REVISION_GROUP_MODES.DATE_REVISED,
            title: bucket.label,
            icon: bucket.icon,
            color: bucket.color,
            badgeBg: bucket.badgeBg,
            items: [],
            meta: { bucketId: bucket.id, order: bucket.order },
          });
        }
        bucketMap.get(bucket.id).items.push(item);
      });

      return Object.freeze(
        Array.from(bucketMap.values())
          .sort((a, b) => a.groupKey - b.groupKey)
          .map((g) =>
            Object.freeze({
              ...g,
              count: g.items.length,
              // Sort items chronologically (oldest revision date first for priority)
              items: Object.freeze(
                [...g.items].sort((a, b) => {
                  const ta = safeParseDateMs(a.reviseDate) || 0;
                  const tb = safeParseDateMs(b.reviseDate) || 0;
                  return ta - tb;
                })
              ),
            })
          )
      );
    },
    Object.freeze([]),
    { code: ERROR_CODES.UNKNOWN_ERROR, feature: "groupByDateRevised" }
  ).value;

/**
 * Pure function: Groups revision queue items by First Read Date.
 */
export const groupByFirstReadDate = (queue = [], referenceDate = new Date()) =>
  trySync(
    () => {
      if (!Array.isArray(queue) || queue.length === 0) return Object.freeze([]);

      const bucketMap = new Map();

      queue.forEach((item) => {
        const bucket = getRelativeDateBucket(item.firstReadAt, referenceDate);
        if (!bucketMap.has(bucket.id)) {
          bucketMap.set(bucket.id, {
            id: `first_read_${bucket.id}`,
            groupKey: bucket.order,
            type: REVISION_GROUP_MODES.FIRST_READ,
            title: `1ère lecture : ${bucket.label}`,
            icon: bucket.icon,
            color: bucket.color,
            badgeBg: bucket.badgeBg,
            items: [],
            meta: { bucketId: bucket.id, order: bucket.order },
          });
        }
        bucketMap.get(bucket.id).items.push(item);
      });

      return Object.freeze(
        Array.from(bucketMap.values())
          .sort((a, b) => a.groupKey - b.groupKey)
          .map((g) =>
            Object.freeze({
              ...g,
              count: g.items.length,
              items: Object.freeze(
                [...g.items].sort((a, b) => {
                  const ta = safeParseDateMs(a.firstReadAt) || 0;
                  const tb = safeParseDateMs(b.firstReadAt) || 0;
                  return ta - tb;
                })
              ),
            })
          )
      );
    },
    Object.freeze([]),
    { code: ERROR_CODES.UNKNOWN_ERROR, feature: "groupByFirstReadDate" }
  ).value;

/**
 * Pure function: Groups revision queue items by Last Read Date.
 */
export const groupByLastReadDate = (queue = [], referenceDate = new Date()) =>
  trySync(
    () => {
      if (!Array.isArray(queue) || queue.length === 0) return Object.freeze([]);

      const bucketMap = new Map();

      queue.forEach((item) => {
        const bucket = getRelativeDateBucket(item.lastReadAt, referenceDate);
        if (!bucketMap.has(bucket.id)) {
          bucketMap.set(bucket.id, {
            id: `last_read_${bucket.id}`,
            groupKey: bucket.order,
            type: REVISION_GROUP_MODES.LAST_READ,
            title: `Dernière lecture : ${bucket.label}`,
            icon: bucket.icon,
            color: bucket.color,
            badgeBg: bucket.badgeBg,
            items: [],
            meta: { bucketId: bucket.id, order: bucket.order },
          });
        }
        bucketMap.get(bucket.id).items.push(item);
      });

      return Object.freeze(
        Array.from(bucketMap.values())
          .sort((a, b) => a.groupKey - b.groupKey)
          .map((g) =>
            Object.freeze({
              ...g,
              count: g.items.length,
              items: Object.freeze(
                [...g.items].sort((a, b) => {
                  const ta = safeParseDateMs(a.lastReadAt) || 0;
                  const tb = safeParseDateMs(b.lastReadAt) || 0;
                  // Most recent last read first within group
                  return tb - ta;
                })
              ),
            })
          )
      );
    },
    Object.freeze([]),
    { code: ERROR_CODES.UNKNOWN_ERROR, feature: "groupByLastReadDate" }
  ).value;

/**
 * Pure function: Groups revision queue items by Hizb.
 */
export const groupByHizb = (queue = []) =>
  trySync(
    () => {
      if (!Array.isArray(queue) || queue.length === 0) return Object.freeze([]);

      const hizbMap = new Map();

      queue.forEach((item) => {
        const hizbNum = Number(item.hizb) || 1;
        if (!hizbMap.has(hizbNum)) {
          hizbMap.set(hizbNum, {
            id: `hizb-${hizbNum}`,
            groupKey: hizbNum,
            type: REVISION_GROUP_MODES.HIZB,
            title: `Hizb ${hizbNum}`,
            subtitle: `Juz ${item.juz || Math.ceil(hizbNum / 2)}`,
            icon: "📜",
            color: "var(--teal2)",
            items: [],
            meta: { hizb: hizbNum, juz: item.juz || Math.ceil(hizbNum / 2) },
          });
        }
        hizbMap.get(hizbNum).items.push(item);
      });

      return Object.freeze(
        Array.from(hizbMap.values())
          .sort((a, b) => a.groupKey - b.groupKey)
          .map((g) =>
            Object.freeze({
              ...g,
              count: g.items.length,
              items: Object.freeze(
                [...g.items].sort((a, b) => {
                  const sa = Number(a.surahNum) || 0;
                  const sb = Number(b.surahNum) || 0;
                  if (sa !== sb) return sa - sb;
                  return (Number(a.ayatNum) || 0) - (Number(b.ayatNum) || 0);
                })
              ),
            })
          )
      );
    },
    Object.freeze([]),
    { code: ERROR_CODES.UNKNOWN_ERROR, feature: "groupByHizb" }
  ).value;

/**
 * Pure function: Groups revision queue items by learning status (learned vs in progress).
 */
export const groupByLearningStatus = (queue = []) =>
  trySync(
    () => {
      if (!Array.isArray(queue) || queue.length === 0) return Object.freeze([]);

      const statusMap = {
        learned: {
          id: "status-learned",
          groupKey: 1,
          type: REVISION_GROUP_MODES.STATUS,
          title: "Versets déjà appris (En entretien / révision)",
          icon: "✓",
          color: "var(--green2)",
          items: [],
        },
        in_progress: {
          id: "status-in-progress",
          groupKey: 2,
          type: REVISION_GROUP_MODES.STATUS,
          title: "Versets en cours d'apprentissage",
          icon: "🌱",
          color: "var(--gold2)",
          items: [],
        },
      };

      queue.forEach((item) => {
        if (item.isLearned) {
          statusMap.learned.items.push(item);
        } else {
          statusMap.in_progress.items.push(item);
        }
      });

      return Object.freeze(
        Object.values(statusMap)
          .filter((g) => g.items.length > 0)
          .map((g) =>
            Object.freeze({
              ...g,
              count: g.items.length,
              items: Object.freeze([...g.items]),
            })
          )
      );
    },
    Object.freeze([]),
    { code: ERROR_CODES.UNKNOWN_ERROR, feature: "groupByLearningStatus" }
  ).value;

/**
 * Master dispatcher: Purely groups revision queue according to specified mode.
 */
export const groupRevisionQueue = (
  queue = [],
  mode = REVISION_GROUP_MODES.SURAH,
  { surahs = [], referenceDate = new Date() } = {}
) => {
  switch (mode) {
    case REVISION_GROUP_MODES.DATE_REVISED:
      return groupByDateRevised(queue, referenceDate);
    case REVISION_GROUP_MODES.FIRST_READ:
      return groupByFirstReadDate(queue, referenceDate);
    case REVISION_GROUP_MODES.LAST_READ:
      return groupByLastReadDate(queue, referenceDate);
    case REVISION_GROUP_MODES.HIZB:
      return groupByHizb(queue);
    case REVISION_GROUP_MODES.STATUS:
      return groupByLearningStatus(queue);
    case REVISION_GROUP_MODES.SURAH:
    default:
      return groupBySurah(queue, surahs);
  }
};

/**
 * Pure state manager helper: Toggles collapsed state for a single group ID.
 */
export const toggleGroupCollapse = (collapsedMap = {}, groupId) => {
  if (!groupId) return collapsedMap;
  const isCurrentlyCollapsed = Boolean(collapsedMap[groupId]);
  return Object.freeze({
    ...collapsedMap,
    [groupId]: !isCurrentlyCollapsed,
  });
};

/**
 * Pure state manager helper: Determines if a group is collapsed.
 */
export const isGroupCollapsed = (collapsedMap = {}, groupId, defaultCollapsed = false) => {
  if (!groupId) return defaultCollapsed;
  const val = collapsedMap[groupId];
  return typeof val === "boolean" ? val : defaultCollapsed;
};

/**
 * Pure state manager helper: Collapses all provided groups.
 */
export const collapseAllGroups = (groups = []) => {
  const result = {};
  (groups || []).forEach((g) => {
    if (g?.id) result[g.id] = true;
  });
  return Object.freeze(result);
};

/**
 * Pure state manager helper: Expands all groups (clears collapsed map).
 */
export const expandAllGroups = () => Object.freeze({});
