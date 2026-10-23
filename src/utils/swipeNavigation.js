// ─── Pure Functional Swipe Navigation Utility ──────────────────────────────
import { ERROR_CODES, trySync } from "./errorManager.js";

export const DEFAULT_SWIPE_CONFIG = Object.freeze({
  minDistance: 70, // Min horizontal displacement in px
  horizRatio: 1.5, // Horizontal movement must be >= vertical * horizRatio
  minVelocity: 0.22, // px/ms threshold for flick gestures
  maxDuration: 850, // Max ms for a swipe gesture
  largeDistance: 120, // Distance that counts as strong swipe even if dragged slower
  minSurah: 1,
  maxSurah: 114,
});

/**
 * Checks whether an event target or its parent is an interactive UI element
 * where touch gestures should NOT trigger surah navigation.
 */
export const isInteractiveElement = (target) => {
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, audio, video, [role="button"], [role="slider"], [role="menuitem"], .no-swipe, .audio-scrubber, .slider-range, .btn, .modal-backdrop, .tajweed-rule-item'
    )
  );
};

/**
 * Pure calculation to determine if a touch gesture qualifies as a "swipe fort" (strong swipe).
 * Differentiates horizontal swipe from natural vertical scrolling.
 */
export const detectSwipeGesture = ({
  startX = 0,
  startY = 0,
  endX = 0,
  endY = 0,
  startTime = 0,
  endTime = 0,
  config = DEFAULT_SWIPE_CONFIG,
} = {}) => {
  const cfg = { ...DEFAULT_SWIPE_CONFIG, ...config };
  const deltaX = Number(endX) - Number(startX);
  const deltaY = Number(endY) - Number(startY);
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  const duration = Math.max(1, (Number(endTime) || 0) - (Number(startTime) || 0));
  const velocity = absX / duration;

  const isDistanceValid = absX >= cfg.minDistance;
  const isHorizDominant = absX >= absY * cfg.horizRatio;
  const isFastEnough = velocity >= cfg.minVelocity && duration <= cfg.maxDuration;
  const isLargeEnough = absX >= cfg.largeDistance;

  const isStrongSwipe = isDistanceValid && isHorizDominant && (isFastEnough || isLargeEnough);
  const direction = !isStrongSwipe ? null : deltaX < 0 ? "left" : "right";

  return Object.freeze({
    isStrongSwipe,
    direction, // 'left' = towards left (next), 'right' = towards right (prev)
    deltaX,
    deltaY,
    absX,
    absY,
    velocity,
    duration,
  });
};

/**
 * Clamps target verse number between 1 and the surah's total ayahs count.
 */
export const clampVerseNumber = (verseNumber, numberOfAyahs) => {
  const parsed = parseInt(verseNumber, 10);
  const maxAyahs = Math.max(1, parseInt(numberOfAyahs, 10) || 1);
  if (isNaN(parsed) || parsed < 1) return 1;
  return Math.min(parsed, maxAyahs);
};

/**
 * Resolves target surah number according to swipe direction.
 * Swipe left = Next surah (current + 1)
 * Swipe right = Previous surah (current - 1)
 */
export const resolveTargetSurahNumber = ({
  currentSurahNum,
  direction,
  minSurah = DEFAULT_SWIPE_CONFIG.minSurah,
  maxSurah = DEFAULT_SWIPE_CONFIG.maxSurah,
}) => {
  const cur = parseInt(currentSurahNum, 10);
  if (isNaN(cur)) return null;

  if (direction === "left") {
    const next = cur + 1;
    return next <= maxSurah ? next : null;
  }
  if (direction === "right") {
    const prev = cur - 1;
    return prev >= minSurah ? prev : null;
  }
  return null;
};

/**
 * Resolves current active verse number in the UI prior to swiping.
 * Inspects openAyatNum -> playingAyatNum -> visible element in viewport -> mainAyatIdx -> fallback 1.
 */
export const resolveActiveAyatNumber = ({
  openAyatNum = null,
  playingAyatNum = null,
  mainAyatIdx = 0,
  ayats = [],
  scrollContainerEl = null,
  ayatRefs = {},
} = {}) => {
  if (openAyatNum != null && Number(openAyatNum) > 0) {
    return Number(openAyatNum);
  }

  if (playingAyatNum != null && Number(playingAyatNum) > 0) {
    return Number(playingAyatNum);
  }

  // If container is scrolled, find first visible ayat element in container view
  if (scrollContainerEl && ayatRefs && Array.isArray(ayats) && ayats.length > 0) {
    try {
      const containerRect = scrollContainerEl.getBoundingClientRect();
      const containerTop = containerRect.top;
      const containerBottom = containerRect.bottom;

      for (let i = 0; i < ayats.length; i++) {
        const a = ayats[i];
        const el = ayatRefs[a.numberInSurah];
        if (el && typeof el.getBoundingClientRect === "function") {
          const rect = el.getBoundingClientRect();
          // First element that overlaps visible container area
          if (rect.bottom >= containerTop + 30 && rect.top <= containerBottom) {
            return Number(a.numberInSurah);
          }
        }
      }
    } catch {
      // Fall through to index fallback
    }
  }

  if (Array.isArray(ayats) && ayats.length > 0) {
    const safeIdx = Math.max(0, Math.min(Number(mainAyatIdx) || 0, ayats.length - 1));
    const targetAyat = ayats[safeIdx];
    if (targetAyat?.numberInSurah) {
      return Number(targetAyat.numberInSurah);
    }
  }

  return 1;
};

/**
 * Purely formats a friendly user toast message describing the surah change and verse synchronization.
 */
export const formatSwipeToastMessage = ({
  direction,
  targetSurah,
  targetAyatNum,
  wasClamped,
  originalAyatNum,
}) => {
  if (!targetSurah) return "";
  const dirIcon = direction === "left" ? "➡️" : "⬅️";
  const surahName = targetSurah.englishName || targetSurah.name || `Sourate ${targetSurah.number}`;
  const clampedNote = wasClamped ? ` (ajusté de v.${originalAyatNum})` : "";
  return `${dirIcon} ${surahName} (${targetSurah.number}) · Verset ${targetAyatNum}${clampedNote}`;
};

/**
 * Purely computes navigation outcome given an explicit direction ('left'/'next' or 'right'/'prev')
 * and preserves/clamps the current verse number.
 * Can be called by button clicks or swipe gestures alike.
 */
export const computeSurahNavigationByDirection = ({
  direction, // 'left' | 'right' | 'next' | 'prev'
  currentSurah,
  currentAyatNum,
  surahs = [],
  config = DEFAULT_SWIPE_CONFIG,
} = {}) =>
  trySync(
    () => {
      const normalizedDir =
        direction === "next" || direction === "left"
          ? "left"
          : direction === "prev" || direction === "right"
          ? "right"
          : null;

      if (!normalizedDir) {
        return Object.freeze({
          canNavigate: false,
          reason: "INVALID_DIRECTION",
          direction: null,
          targetSurah: null,
          targetSurahNum: null,
          targetAyatNum: null,
          wasClamped: false,
          originalAyatNum: currentAyatNum ?? 1,
          feedbackMessage: "",
        });
      }

      const curSurahNum = currentSurah?.number ?? 1;
      const cfg = { ...DEFAULT_SWIPE_CONFIG, ...config };
      const targetSurahNum = resolveTargetSurahNumber({
        currentSurahNum: curSurahNum,
        direction: normalizedDir,
        minSurah: cfg.minSurah,
        maxSurah: cfg.maxSurah,
      });

      if (targetSurahNum == null) {
        const isMin = normalizedDir === "right" && curSurahNum <= cfg.minSurah;
        const reason = isMin ? "AT_FIRST_SURAH" : "AT_LAST_SURAH";
        const boundaryMsg = isMin
          ? "Première sourate atteinte (Al-Fatiha)"
          : "Dernière sourate atteinte (An-Nas)";
        return Object.freeze({
          canNavigate: false,
          reason,
          direction: normalizedDir,
          targetSurah: null,
          targetSurahNum: null,
          targetAyatNum: null,
          wasClamped: false,
          originalAyatNum: currentAyatNum ?? 1,
          feedbackMessage: boundaryMsg,
        });
      }

      const targetSurah = surahs.find((s) => s.number === targetSurahNum);
      if (!targetSurah) {
        return Object.freeze({
          canNavigate: false,
          reason: "TARGET_SURAH_NOT_FOUND",
          direction: normalizedDir,
          targetSurah: null,
          targetSurahNum,
          targetAyatNum: null,
          wasClamped: false,
          originalAyatNum: currentAyatNum ?? 1,
          feedbackMessage: "",
        });
      }

      const requestedAyat = Math.max(1, Number(currentAyatNum) || 1);
      const clampedAyat = clampVerseNumber(requestedAyat, targetSurah.numberOfAyahs);
      const wasClamped = clampedAyat !== requestedAyat;

      const feedbackMessage = formatSwipeToastMessage({
        direction: normalizedDir,
        targetSurah,
        targetAyatNum: clampedAyat,
        wasClamped,
        originalAyatNum: requestedAyat,
      });

      return Object.freeze({
        canNavigate: true,
        reason: "OK",
        direction: normalizedDir,
        targetSurah,
        targetSurahNum,
        targetAyatNum: clampedAyat,
        wasClamped,
        originalAyatNum: requestedAyat,
        feedbackMessage,
      });
    },
    Object.freeze({
      canNavigate: false,
      reason: "ERROR",
      direction: null,
      targetSurah: null,
      targetSurahNum: null,
      targetAyatNum: null,
      wasClamped: false,
      originalAyatNum: currentAyatNum ?? 1,
      feedbackMessage: "",
    }),
    { code: ERROR_CODES.SWIPE_NAV_ERROR, currentSurah, currentAyatNum, direction }
  ).value;

/**
 * Purely computes the full navigation outcome of a swipe gesture on the main Quran page.
 */
export const computeSurahSwipeNavigation = ({
  gesture,
  currentSurah,
  currentAyatNum,
  surahs = [],
  config = DEFAULT_SWIPE_CONFIG,
} = {}) => {
  if (!gesture || !gesture.isStrongSwipe || !gesture.direction) {
    return Object.freeze({
      canNavigate: false,
      reason: "NOT_A_SWIPE",
      direction: null,
      targetSurah: null,
      targetSurahNum: null,
      targetAyatNum: null,
      wasClamped: false,
      originalAyatNum: currentAyatNum ?? 1,
      feedbackMessage: "",
    });
  }

  return computeSurahNavigationByDirection({
    direction: gesture.direction,
    currentSurah,
    currentAyatNum,
    surahs,
    config,
  });
};
