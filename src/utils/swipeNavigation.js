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

/**
 * Pure calculation of Euclidean distance between two Touch points.
 */
export const calculateTouchDistance = (touchA, touchB) => {
  if (!touchA || !touchB) return 0;
  const dx = (Number(touchB.clientX) || 0) - (Number(touchA.clientX) || 0);
  const dy = (Number(touchB.clientY) || 0) - (Number(touchA.clientY) || 0);
  return Math.hypot(dx, dy);
};

/**
 * Pure calculation to detect pinch-to-zoom scaling for mobile and tablet reading text.
 */
export const detectPinchGesture = ({
  initialDistance = 0,
  currentDistance = 0,
  initialFontSize = 26,
  minFontSize = 16,
  maxFontSize = 48,
} = {}) =>
  trySync(
    () => {
      const initDist = Number(initialDistance) || 0;
      const currDist = Number(currentDistance) || 0;
      const initSize = Math.max(minFontSize, Math.min(maxFontSize, Number(initialFontSize) || 26));

      if (initDist <= 10 || currDist <= 10) {
        return Object.freeze({
          isPinching: false,
          scaleRatio: 1,
          newFontSize: initSize,
          deltaFontSize: 0,
        });
      }

      const scaleRatio = currDist / initDist;
      // Linear proportional font size calculation
      const calculatedSize = Math.round(initSize * scaleRatio);
      const newFontSize = Math.max(minFontSize, Math.min(maxFontSize, calculatedSize));
      const deltaFontSize = newFontSize - initSize;
      const isPinching = Math.abs(currDist - initDist) > 12;

      return Object.freeze({
        isPinching,
        scaleRatio,
        newFontSize,
        deltaFontSize,
      });
    },
    Object.freeze({
      isPinching: false,
      scaleRatio: 1,
      newFontSize: 26,
      deltaFontSize: 0,
    }),
    { code: ERROR_CODES.GESTURE_ERROR, initialDistance, currentDistance }
  ).value;

/**
 * Pure calculation to detect mobile/tablet player gestures:
 * - Double tap -> toggle play/pause
 * - Swipe left -> next verse
 * - Swipe right -> previous verse
 * - Swipe up -> open audio options modal
 */
export const detectPlayerGesture = ({
  startX = 0,
  startY = 0,
  endX = 0,
  endY = 0,
  startTime = 0,
  endTime = 0,
  lastTapTime = 0,
  doubleTapWindow = 350,
} = {}) =>
  trySync(
    () => {
      const deltaX = Number(endX) - Number(startX);
      const deltaY = Number(endY) - Number(startY);
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const duration = Math.max(1, (Number(endTime) || 0) - (Number(startTime) || 0));
      const now = Number(endTime) || Date.now();
      const timeSinceLastTap = now - (Number(lastTapTime) || 0);

      // Check if tap (minimal movement)
      const isTap = absX <= 14 && absY <= 14 && duration <= 300;

      if (isTap) {
        if (timeSinceLastTap > 0 && timeSinceLastTap <= doubleTapWindow) {
          return Object.freeze({
            action: "toggle_play",
            deltaX,
            deltaY,
            isTap: true,
            isDoubleTap: true,
            duration,
          });
        }
        return Object.freeze({
          action: "tap",
          deltaX,
          deltaY,
          isTap: true,
          isDoubleTap: false,
          duration,
        });
      }

      // Swipe up on player (Apple/Spotify style bottom sheet expansion)
      if (deltaY < -35 && absY >= absX * 1.15 && duration <= 600) {
        return Object.freeze({
          action: "open_options",
          deltaX,
          deltaY,
          isTap: false,
          isDoubleTap: false,
          duration,
        });
      }

      // Horizontal swipe on player to skip verse
      if (absX >= 40 && absX >= absY * 1.15 && duration <= 600) {
        return Object.freeze({
          action: deltaX < 0 ? "next" : "prev",
          deltaX,
          deltaY,
          isTap: false,
          isDoubleTap: false,
          duration,
        });
      }

      return Object.freeze({
        action: null,
        deltaX,
        deltaY,
        isTap: false,
        isDoubleTap: false,
        duration,
      });
    },
    Object.freeze({
      action: null,
      deltaX: 0,
      deltaY: 0,
      isTap: false,
      isDoubleTap: false,
      duration: 0,
    }),
    { code: ERROR_CODES.GESTURE_ERROR, startX, startY, endX, endY }
  ).value;

/**
 * Pure calculation to detect pull-down dismiss gesture on modal bottom sheets.
 */
export const detectSheetDismissGesture = ({
  startY = 0,
  endY = 0,
  startX = 0,
  endX = 0,
  minDismissDistance = 55,
  verticalRatio = 1.2,
} = {}) =>
  trySync(
    () => {
      const deltaY = Number(endY) - Number(startY);
      const deltaX = Number(endX) - Number(startX);
      const absX = Math.abs(deltaX);

      // Downward displacement exceeding threshold and dominating horizontal movement
      const shouldDismiss = deltaY >= minDismissDistance && deltaY >= absX * verticalRatio;

      return Object.freeze({
        shouldDismiss,
        deltaY,
        deltaX,
      });
    },
    Object.freeze({
      shouldDismiss: false,
      deltaY: 0,
      deltaX: 0,
    }),
    { code: ERROR_CODES.GESTURE_ERROR, startY, endY }
  ).value;

/**
 * Pure calculation to detect edge swipe for opening drawer/sidebar or closing open drawer.
 */
export const detectEdgeSwipeGesture = ({
  startX = 0,
  endX = 0,
  startY = 0,
  endY = 0,
  edgeThreshold = 35,
  minSwipeDistance = 50,
  isOpen = false,
} = {}) =>
  trySync(
    () => {
      const deltaX = Number(endX) - Number(startX);
      const deltaY = Number(endY) - Number(startY);
      const absY = Math.abs(deltaY);

      // Must be horizontally dominant
      if (Math.abs(deltaX) < absY * 1.2) {
        return Object.freeze({ action: null, deltaX, deltaY });
      }

      // When closed: user swipes right from near the left edge
      if (!isOpen && Number(startX) <= edgeThreshold && deltaX >= minSwipeDistance) {
        return Object.freeze({ action: "open_drawer", deltaX, deltaY });
      }

      // When open: user swipes left to close
      if (isOpen && deltaX <= -minSwipeDistance) {
        return Object.freeze({ action: "close_drawer", deltaX, deltaY });
      }

      return Object.freeze({ action: null, deltaX, deltaY });
    },
    Object.freeze({ action: null, deltaX: 0, deltaY: 0 }),
    { code: ERROR_CODES.GESTURE_ERROR, startX, endX, isOpen }
  ).value;

/**
 * Pure calculation to detect horizontal tab swiping inside modals.
 */
export const detectTabSwipeGesture = ({
  startX = 0,
  endX = 0,
  startY = 0,
  endY = 0,
  currentTab,
  tabs = [],
  minDistance = 40,
} = {}) =>
  trySync(
    () => {
      const deltaX = Number(endX) - Number(startX);
      const deltaY = Number(endY) - Number(startY);
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX < minDistance || absX < absY * 1.3 || !Array.isArray(tabs) || tabs.length <= 1) {
        return Object.freeze({ shouldChange: false, targetTab: null, direction: null });
      }

      const currentIndex = tabs.indexOf(currentTab);
      if (currentIndex === -1) {
        return Object.freeze({ shouldChange: false, targetTab: null, direction: null });
      }

      if (deltaX < 0) {
        // Swipe left -> advance to next tab
        const nextIndex = Math.min(tabs.length - 1, currentIndex + 1);
        if (nextIndex !== currentIndex) {
          return Object.freeze({
            shouldChange: true,
            targetTab: tabs[nextIndex],
            direction: "next",
          });
        }
      } else {
        // Swipe right -> return to previous tab
        const prevIndex = Math.max(0, currentIndex - 1);
        if (prevIndex !== currentIndex) {
          return Object.freeze({
            shouldChange: true,
            targetTab: tabs[prevIndex],
            direction: "prev",
          });
        }
      }

      return Object.freeze({ shouldChange: false, targetTab: null, direction: null });
    },
    Object.freeze({ shouldChange: false, targetTab: null, direction: null }),
    { code: ERROR_CODES.GESTURE_ERROR, startX, endX, currentTab }
  ).value;

