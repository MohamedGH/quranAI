/**
 * fullScreenNavigation.js
 * Pure functional helpers for Ayat FullScreen (Focus) Mode navigation,
 * layout responsiveness calculations, and transitioning back to normal reading mode.
 */

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
    message: "Fermeture du plein écran",
  };
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
