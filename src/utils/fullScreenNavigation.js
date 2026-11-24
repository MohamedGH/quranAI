/**
 * fullScreenNavigation.js
 * Pure functional helpers for Ayat FullScreen (Focus) Mode navigation,
 * layout responsiveness calculations, and transitioning back to normal reading mode.
 */

import { buildQuranRoute } from "./routeManager.js";
import { isPriority3DProfile, QURAN_READING_TIERS } from "./uxProfileManager.js";

/**
 * Resolves the state transition when exiting FullScreen mode to normal reading mode.
 * Disables the automatic fullScreenSelectedAyat option if active so the user is not
 * trapped in full screen, while preserving the currently focused verse in normal view.
 *
 * @param {Object} params
 * @param {boolean} params.fullScreenSelectedAyat - Redux UI option for automatic full screen
 * @param {boolean} params.explicitFullScreen - Local component state for explicit full screen
 * @param {number|null} params.openAyatNum - Currently open ayat number
 * @returns {Object} nextState
 */
export function resolveExitToNormalModeState({
  fullScreenSelectedAyat = false,
  explicitFullScreen = false,
  openAyatNum = null,
} = {}) {
  return {
    nextFullScreenSelectedAyat: false,
    shouldUpdateReduxOption: Boolean(fullScreenSelectedAyat),
    nextExplicitFullScreen: false,
    nextOpenAyatNum: openAyatNum, // Kept so normal reading mode focuses this verse
    nextTier: QURAN_READING_TIERS.LIST,
    message: "Mode normal rétabli",
  };
}

/**
 * Resolves the state transition when completely closing full screen view (deselecting).
 *
 * @param {Object} params
 * @returns {Object} nextState
 */
export function resolveCloseFullScreenState({
  fullScreenSelectedAyat = false,
  explicitFullScreen = false,
} = {}) {
  return {
    nextFullScreenSelectedAyat: false,
    shouldUpdateReduxOption: Boolean(fullScreenSelectedAyat),
    nextExplicitFullScreen: false,
    nextOpenAyatNum: null,
    nextTier: QURAN_READING_TIERS.LIST,
    message: "Fermeture du plein écran",
  };
}

/**
 * Purely resolves the step-down transition when exiting the 3D Quran view.
 * For Child & Novice (beginner), stepping out of 3D prioritizes Fullscreen verse view (Tier 2).
 * For Standard & Expert, stepping out of 3D returns to normal Surah/Ayat list view.
 *
 * @param {Object} params
 * @param {string} params.uxMode
 * @param {Object|null} params.selectedAyah
 * @param {Object} params.lastAyatBySurah
 * @returns {Object} stepDownTarget
 */
export function resolveBook3DStepDownNavigation({
  uxMode = "standard",
  selectedAyah = null,
  lastAyatBySurah = {},
} = {}) {
  const isSimplifiedPriority = isPriority3DProfile(uxMode);
  const rawSurah = Number(selectedAyah?.surahNum);
  const hasExplicitSurah = Number.isFinite(rawSurah) && rawSurah >= 1 && rawSurah <= 114;
  const surahNum = hasExplicitSurah ? rawSurah : 1;
  const rawAyat = Number(selectedAyah?.ayahNum);
  const fallbackAyat = Number(lastAyatBySurah?.[surahNum]) || 1;
  const ayatNum = Number.isFinite(rawAyat) && rawAyat >= 1 ? rawAyat : fallbackAyat;

  if (isSimplifiedPriority) {
    return Object.freeze({
      nextTier: QURAN_READING_TIERS.FULLSCREEN,
      enableFullscreen: true,
      surahNum,
      ayatNum,
      targetRoute: buildQuranRoute({
        activePage: "quran",
        surahNum,
        ayatNum,
        view: "fullscreen",
      }),
    });
  }

  return Object.freeze({
    nextTier: QURAN_READING_TIERS.LIST,
    enableFullscreen: false,
    surahNum: hasExplicitSurah ? surahNum : null,
    ayatNum: hasExplicitSurah ? ayatNum : null,
    targetRoute: hasExplicitSurah
      ? buildQuranRoute({ activePage: "quran", surahNum, ayatNum })
      : "/quran",
  });
}

/**
 * Computes responsive layout flags and dimensions for Ayat FullScreen Modal
 * based on screen width.
 *
 * @param {number} screenWidth - Viewport width in pixels
 * @returns {Object} layout
 */
export function computeFullScreenLayout(screenWidth = 1024) {
  const isMobile = screenWidth <= 640;
  const isSmallMobile = screenWidth <= 380;
  const isTablet = screenWidth > 640 && screenWidth <= 1024;
  const isDesktop = screenWidth > 1024;

  return {
    isMobile,
    isSmallMobile,
    isTablet,
    isDesktop,
    headerRowCount: isMobile ? 2 : 1,
    headerPadding: isMobile
      ? "max(env(safe-area-inset-top, 0px), 8px) 10px 8px"
      : "10px 16px",
    footerPadding: isMobile
      ? "8px 10px calc(8px + env(safe-area-inset-bottom, 0px))"
      : "12px 24px calc(12px + env(safe-area-inset-bottom, 0px))",
    maxAyatSelectWidth: isSmallMobile ? 70 : isMobile ? 86 : 115,
    titleMaxWidth: isSmallMobile ? 120 : isMobile ? 160 : 260,
    audioButtonSize: isSmallMobile ? 34 : isMobile ? 38 : 36,
    playButtonSize: isSmallMobile ? 44 : isMobile ? 48 : 52,
    fontSizeClamped: (size) => Math.max(16, Math.min(isMobile ? 36 : 54, Number(size) || 30)),
  };
}

/**
 * Formats surah and ayat badge text cleanly for compact mobile display.
 *
 * @param {Object} surah
 * @param {number} ayatNum
 * @param {number} totalAyahs
 * @returns {Object} { shortLabel, fullLabel, stepperLabel }
 */
export function formatFullScreenHeaderLabels(surah, ayatNum, totalAyahs) {
  if (!surah) {
    return { shortLabel: "", fullLabel: "", stepperLabel: "" };
  }

  const sNum = surah.number;
  const sName = surah.englishName || surah.name || "";
  const vNum = ayatNum ?? 1;
  const total = totalAyahs || surah.numberOfAyahs || 1;

  return {
    shortLabel: `${sNum}. ${sName} · V.${vNum}`,
    fullLabel: `${sNum}. ${sName} (${vNum}/${total})`,
    stepperLabel: `V.${vNum} / ${total}`,
  };
}

/**
 * Checks if the given navigation action is valid in full screen mode.
 *
 * @param {Object} params
 * @param {number} params.currentAyatNum
 * @param {number} params.totalAyats
 * @param {'prev'|'next'} params.direction
 * @returns {boolean}
 */
export function canNavigateFullScreenAyat({ currentAyatNum, totalAyats, direction }) {
  if (!currentAyatNum || !totalAyats) return false;
  if (direction === "prev") return currentAyatNum > 1;
  if (direction === "next") return currentAyatNum < totalAyats;
  return false;
}

/**
 * Purely resolves the state & route transition when selecting a surah from
 * Menu Sourates while in 3D/2D book view or Fullscreen reading mode.
 */
export function resolveMenuSurahSelection({
  surah = null,
  isBookRoute = false,
  isFullscreenActive = false,
  uxMode = "standard",
  lastAyatBySurah = {},
  currentRouteParams = {},
} = {}) {
  const sn = Number(surah?.number ?? surah);
  const surahNum = Number.isFinite(sn) && sn >= 1 && sn <= 114 ? sn : 1;
  const maxAyat = Number(surah?.numberOfAyahs) || 286;
  const savedAyat = Number(lastAyatBySurah?.[surahNum]);
  const targetAyat =
    Number.isFinite(savedAyat) && savedAyat >= 1 && savedAyat <= maxAyat
      ? savedAyat
      : 1;

  const shouldEnterFullscreen = Boolean(
    isBookRoute ||
      isFullscreenActive ||
      currentRouteParams?.view === QURAN_READING_TIERS.FULLSCREEN
  );

  const view = shouldEnterFullscreen
    ? QURAN_READING_TIERS.FULLSCREEN
    : currentRouteParams?.view === QURAN_READING_TIERS.LIST
    ? QURAN_READING_TIERS.LIST
    : null;

  const targetPath = shouldEnterFullscreen
    ? `/quran/${surahNum}/${targetAyat}`
    : `/quran/${surahNum}`;

  const targetRoute = buildQuranRoute({
    activePage: "quran",
    surahNum,
    ayatNum: shouldEnterFullscreen ? targetAyat : null,
    uxMode: currentRouteParams?.uxMode || null,
    compactMode: currentRouteParams?.compactMode ?? null,
    uiPreset: currentRouteParams?.uiPreset || null,
    uiEditMode: currentRouteParams?.uiEditMode ?? null,
    view,
  });

  return Object.freeze({
    surahNum,
    targetAyat: shouldEnterFullscreen ? targetAyat : null,
    shouldEnterFullscreen,
    nextTier: shouldEnterFullscreen
      ? QURAN_READING_TIERS.FULLSCREEN
      : QURAN_READING_TIERS.LIST,
    targetPath,
    targetRoute,
  });
}

/**
 * Purely resolves the clamped ayat number and canonical route when stepping
 * between verses inside AyatFullScreenModal.
 */
export function resolveFullScreenAyatSelection({
  surah = null,
  nextAyatNum = 1,
  totalAyats = 0,
  currentRouteParams = {},
  uxMode = "standard",
  isFullscreenActive = true,
} = {}) {
  const sn = Number(surah?.number ?? surah);
  if (!Number.isFinite(sn) || sn < 1 || sn > 114) {
    return null;
  }
  const maxAyat = Number(surah?.numberOfAyahs) || Number(totalAyats) || 286;
  const rawNext = Number(nextAyatNum);
  const ayatNum = Math.max(
    1,
    Math.min(maxAyat, Number.isFinite(rawNext) ? Math.trunc(rawNext) : 1)
  );
  const nextView =
    currentRouteParams?.view ||
    (isFullscreenActive && isPriority3DProfile(uxMode)
      ? QURAN_READING_TIERS.FULLSCREEN
      : null);

  const targetPath = `/quran/${sn}/${ayatNum}`;
  const targetRoute = buildQuranRoute({
    activePage: "quran",
    surahNum: sn,
    ayatNum,
    mode: currentRouteParams?.mode || null,
    hizb: currentRouteParams?.hizb || null,
    isCrossSurah: Boolean(currentRouteParams?.isCrossSurah),
    juz: currentRouteParams?.juz || null,
    page: currentRouteParams?.page || null,
    silenceRevise: Boolean(currentRouteParams?.silenceRevise),
    silenceMode: currentRouteParams?.silenceMode || null,
    uxMode: currentRouteParams?.uxMode || null,
    compactMode: currentRouteParams?.compactMode ?? null,
    uiPreset: currentRouteParams?.uiPreset || null,
    uiEditMode: currentRouteParams?.uiEditMode ?? null,
    view: nextView,
  });

  return Object.freeze({
    surahNum: sn,
    ayatNum,
    targetPath,
    targetRoute,
  });
}

/**
 * Pure guard preventing bidirectional URL <-> Redux ping-pong loops
 * when React Router updates location asynchronously after an in-app navigate().
 */
export function evaluateUrlToReduxSync({
  locationPath = "",
  pendingNavTarget = null,
  now = Date.now(),
} = {}) {
  if (!pendingNavTarget || !pendingNavTarget.path) {
    return Object.freeze({ skip: false, clearPending: false });
  }
  if (locationPath === pendingNavTarget.path) {
    return Object.freeze({ skip: true, clearPending: true });
  }
  if (now < (pendingNavTarget.expiresAt || 0)) {
    return Object.freeze({ skip: true, clearPending: false });
  }
  return Object.freeze({ skip: false, clearPending: true });
}

/**
 * Purely computes the canonical URL target when Redux (selectedSurah / openAyatNum)
 * needs to sync to the browser route, avoiding prefix-matching bugs (e.g. /quran/1 vs /quran/10).
 */
export function resolveReduxToUrlSync({
  activePage = "quran",
  isBookRoute = false,
  selectedSurah = null,
  openAyatNum = null,
  uxMode = "standard",
  quranReadingTier = QURAN_READING_TIERS.LIST,
  isQuranUnlocked = true,
  allow3D = true,
  urlSurahNum = NaN,
  urlAyatNum = NaN,
  pendingNavTarget = null,
  now = Date.now(),
  currentRouteParams = {},
} = {}) {
  if (activePage !== "quran" || isBookRoute || !selectedSurah) {
    return null;
  }
  if (
    isPriority3DProfile(uxMode) &&
    quranReadingTier === QURAN_READING_TIERS.BOOK3D &&
    isQuranUnlocked &&
    allow3D &&
    Number.isNaN(urlSurahNum)
  ) {
    return null;
  }

  const sn = Number(selectedSurah.number);
  if (!Number.isFinite(sn) || sn < 1 || sn > 114) return null;

  const maxAyat = Number(selectedSurah.numberOfAyahs) || 286;
  const hasValidAyat =
    openAyatNum != null &&
    Number.isFinite(Number(openAyatNum)) &&
    Number(openAyatNum) >= 1 &&
    Number(openAyatNum) <= maxAyat;

  const targetAyat = hasValidAyat ? Number(openAyatNum) : null;
  const surahDiffers = urlSurahNum !== sn;
  const ayatDiffers = targetAyat != null && urlAyatNum !== targetAyat;

  if (!surahDiffers && !ayatDiffers) {
    return null;
  }

  const targetPath = targetAyat != null ? `/quran/${sn}/${targetAyat}` : `/quran/${sn}`;
  if (
    pendingNavTarget &&
    pendingNavTarget.path === targetPath &&
    now < (pendingNavTarget.expiresAt || 0)
  ) {
    return null;
  }

  const targetRoute = buildQuranRoute({
    activePage: "quran",
    surahNum: sn,
    ayatNum: targetAyat,
    mode: currentRouteParams?.mode || null,
    hizb: currentRouteParams?.hizb || null,
    isCrossSurah: Boolean(currentRouteParams?.isCrossSurah),
    juz: currentRouteParams?.juz || null,
    page: currentRouteParams?.page || null,
    silenceRevise: Boolean(currentRouteParams?.silenceRevise),
    silenceMode: currentRouteParams?.silenceMode || null,
    uxMode: currentRouteParams?.uxMode || null,
    compactMode: currentRouteParams?.compactMode ?? null,
    uiPreset: currentRouteParams?.uiPreset || null,
    uiEditMode: currentRouteParams?.uiEditMode ?? null,
    view: currentRouteParams?.view || null,
  });

  return Object.freeze({
    targetPath,
    targetRoute,
  });
}

