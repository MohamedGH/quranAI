// ─── Specialized Functional Engine for CSS & 3D Mushaf Readers ───────────────
// Pure functional state/layout calculators, collision-free 3D coordinates,
// flip-sheet kinematics, software-WebGL detection, and bounded canvas LRU cache.

export const MUSHAF_TOTAL_PAGES = 604;
export const MUSHAF_DOUBLE_SPREADS = 302;

/**
 * Immutable physical dimensions & clearance constants for the 3D Mushaf + Rehal stand.
 * Every vertical clearance is strictly positive so meshes never interpenetrate.
 */
export const BOOK3D_SPEC = Object.freeze({
  wingOffsetX: 0.045,
  wingBaseY: -0.11,
  wingTilt: 0.14, // V-cradle upward tilt on both wings (left: -0.14, right: +0.14)
  coverWidth: 1.34,
  coverThickness: 0.036,
  coverDepth: 1.94,
  stackWidth: 1.27,
  stackHeight: 0.088,
  stackDepth: 1.88,
  pageWidth: 1.26,
  pageDepth: 1.86,
  pageInnerMarginX: 0.01,
  pageBaseLocalY: 0.095, // Strictly > stackHeight (0.088) -> >= 0.007 clearance
  spineRadius: 0.055,
  spineY: -0.135,
  flipPivotClearanceY: 0.022, // Strictly above static inner page surface
  flipMidFlightLiftY: 0.055,
  flipDurationSec: 0.65,
  rehal: Object.freeze({
    hingeY: -0.49,
    plankLength: 2.2,
    plankThickness: 0.045,
    plankDepth: 1.62,
    rotZ: 0.24,
    footX: 1.04,
    footY: -0.77,
  }),
});

/**
 * Computes responsive single-page & spread dimensions for the CSS Quran book.
 */
export const computeCssBookLayout = ({ vw = 1024, vh = 768 } = {}) => {
  const safeVw = Math.max(320, Number(vw) || 1024);
  const safeVh = Math.max(420, Number(vh) || 768);
  const isMobile = safeVw < 640;
  const maxH = Math.max(240, safeVh - (isMobile ? 175 : 160));
  const horizontalMargin = isMobile ? 28 : 48;
  const rawW = Math.min((safeVw - horizontalMargin) / 2, maxH * 0.68, 440);
  const pageWidth = Math.max(126, Math.round(rawW));
  const pageHeight = Math.round(pageWidth / 0.68);
  const spineWidth = Math.max(Math.round(pageWidth * 0.052), 18);
  const totalWidth = pageWidth * 2 + spineWidth;

  return Object.freeze({
    pageWidth,
    pageHeight,
    spineWidth,
    totalWidth,
    isMobile,
  });
};

export const OPEN_ANIM_DURATION_MS = 820;

export const BOOK3D_ZOOM = Object.freeze({
  minDist: 2.0,
  maxDist: 7.8,
  defaultDesktopDist: 4.8,
  defaultMobileDist: 5.6,
  buttonStep: 0.65,
  wheelSensitivity: 0.0032,
  min2DScale: 0.75,
  max2DScale: 2.2,
  default2DScale: 1.0,
});

/**
 * Pure presentation descriptor for the CSS Quran book.
 * Guarantees:
 * - Closed book (`!bookOpen`): closed volume is horizontally centered, left page & back
 *   half are completely hidden, only front cover + spine + right stack edge appear.
 * - Opening (`bookOpen && isOpening`): left page & back cover wait edge-on at the spine
 *   during the first half of the cover swing (0%..48%) then unfold smoothly onto the table
 *   (50%..100%) instead of popping in abruptly at t=0.
 * - Open book (`bookOpen`): front cover flips away and hides completely behind/off so it
 *   never obstructs reading pages; forward/backward flips always lift toward +Z (viewer).
 */
export const computeCssBookPresentation = ({
  bookOpen = false,
  isOpening = false,
  spread = 0,
  flipState = "idle",
  pageWidth = 440,
  spineWidth = 22,
} = {}) => {
  const isFwd = flipState === "fwd";
  const isBwd = flipState === "bwd";
  const isFlip = isFwd || isBwd;
  const isClosedAtRest = !bookOpen && spread === 0;
  const activeOpening = Boolean(bookOpen && isOpening);

  // Closed volume spans [pageWidth, 2 * pageWidth + spineWidth] (midpoint = 1.5*W + spineW/2).
  // Container midpoint is (W + spineW/2). Difference to center closed cover is -W / 2.
  const closedShiftX = -Math.round(pageWidth / 2);

  return Object.freeze({
    isFwd,
    isBwd,
    isFlip,
    isClosedAtRest,
    isOpening: activeOpening,
    bookTranslateX: bookOpen ? 0 : closedShiftX,
    showLeftHalf: Boolean(bookOpen),
    showLeftPageContent: Boolean(bookOpen && spread >= 1),
    leftWingClassName: activeOpening ? "qbook-opening-left" : "",
    frontCover: Object.freeze({
      transform: bookOpen ? "rotateY(-180deg)" : "rotateY(0deg)",
      zIndex: bookOpen ? 0 : 150,
      hidden: Boolean(bookOpen),
      pointerEvents: bookOpen ? "none" : "auto",
      cursor: bookOpen ? "default" : "pointer",
    }),
    boardLeftOffset: bookOpen ? 0 : pageWidth + spineWidth,
    stackLeftOffset: bookOpen ? 3 : pageWidth + spineWidth,
    stackWidth: bookOpen ? pageWidth * 2 + spineWidth - 6 : Math.max(40, pageWidth - 3),
    flipConfig: Object.freeze({
      left: isFwd ? 0 : pageWidth + spineWidth,
      transformOrigin: isFwd ? "right center" : "left center",
    }),
  });
};

/**
 * Computes Arabic RTL spread page numbers cleanly.
 */
export const computeSpreadPages = (spread, isSingleMode = false) => {
  const clamped = Math.max(
    1,
    Math.min(isSingleMode ? MUSHAF_TOTAL_PAGES : MUSHAF_DOUBLE_SPREADS, Number(spread) || 1)
  );
  if (isSingleMode) {
    return Object.freeze({ rPage: clamped, lPage: null, spread: clamped });
  }
  const rPage = 2 * clamped - 1;
  const lPage = Math.min(2 * clamped, MUSHAF_TOTAL_PAGES);
  return Object.freeze({ rPage, lPage, spread: clamped });
};

/**
 * Pure zoom calculators for 3D camera distance and 2D reader magnification.
 */
export const clamp3DZoomDist = (dist) => {
  const num = Number(dist);
  if (!Number.isFinite(num)) return BOOK3D_ZOOM.defaultDesktopDist;
  return Math.max(BOOK3D_ZOOM.minDist, Math.min(BOOK3D_ZOOM.maxDist, num));
};

export const computeWheelZoomDist = (currentDist, deltaY) => {
  const cur = clamp3DZoomDist(currentDist);
  const d = Number(deltaY) || 0;
  return clamp3DZoomDist(cur + d * BOOK3D_ZOOM.wheelSensitivity);
};

export const computePinchZoomDist = (startDist, startTouchDist, currentTouchDist) => {
  const base = clamp3DZoomDist(startDist);
  if (!Number.isFinite(startTouchDist) || !Number.isFinite(currentTouchDist) || startTouchDist <= 0 || currentTouchDist <= 0) {
    return base;
  }
  // Larger finger separation -> zoom in (smaller camera Z distance)
  return clamp3DZoomDist(base * (startTouchDist / currentTouchDist));
};

export const step3DZoomDist = (currentDist, direction) => {
  const cur = clamp3DZoomDist(currentDist);
  return clamp3DZoomDist(cur + (direction < 0 ? -BOOK3D_ZOOM.buttonStep : BOOK3D_ZOOM.buttonStep));
};

export const computeCameraPositionForZoom = (zoomDist, isSingleMode = false) => {
  const z = clamp3DZoomDist(zoomDist);
  const baseZ = isSingleMode ? BOOK3D_ZOOM.defaultMobileDist : BOOK3D_ZOOM.defaultDesktopDist;
  const y = Math.max(0.95, 2.25 * (z / baseZ));
  return Object.freeze({ y, z });
};

export const computeZoomPercent = (zoomDist, isSingleMode = false) => {
  const z = clamp3DZoomDist(zoomDist);
  const baseZ = isSingleMode ? BOOK3D_ZOOM.defaultMobileDist : BOOK3D_ZOOM.defaultDesktopDist;
  return Math.round((baseZ / z) * 100);
};

export const clamp2DZoomScale = (scale) => {
  const num = Number(scale);
  if (!Number.isFinite(num)) return BOOK3D_ZOOM.default2DScale;
  return Math.max(BOOK3D_ZOOM.min2DScale, Math.min(BOOK3D_ZOOM.max2DScale, Number(num.toFixed(2))));
};

/**
 * Builds an ordered list of visible ayahs across right (odd) then left (even) pages
 * following Arabic RTL reading order, and determines whether the next ayah stays on the
 * currently open spread (e.g., transitioning seamlessly from last ayah of right page to
 * first ayah of left page without turning the page) or requires turning the page.
 */
export const resolveSpreadPlaybackStep = ({
  currentAudioAyah,
  rPage,
  lPage,
  isSingleMode = false,
  pageCache = {},
  totalPages = MUSHAF_TOTAL_PAGES,
}) => {
  if (!currentAudioAyah) {
    return Object.freeze({
      action: "stop",
      needsTurnNext: false,
      targetNextPage: null,
      nextAyah: null,
    });
  }

  const normalizeEntry = (a, pageNum, side) => ({
    surahNum: a?.surah?.number ?? a?.surahNum,
    ayahNum: a?.numberInSurah ?? a?.ayahNum,
    surahName: a?.surah?.name ?? a?.surahName ?? "",
    surahEng: a?.surah?.englishName ?? a?.surahEng ?? "",
    text: a?.text ?? "",
    pageNum,
    side,
  });

  const rightList = Array.isArray(pageCache[rPage])
    ? pageCache[rPage].map((a) => normalizeEntry(a, rPage, "right"))
    : [];
  const leftList =
    !isSingleMode && lPage && lPage !== rPage && Array.isArray(pageCache[lPage])
      ? pageCache[lPage].map((a) => normalizeEntry(a, lPage, "left"))
      : [];

  const visibleAyahs = [...rightList, ...leftList];
  const currIdx = visibleAyahs.findIndex(
    (a) => a.surahNum === currentAudioAyah.surahNum && a.ayahNum === currentAudioAyah.ayahNum
  );

  if (currIdx >= 0 && currIdx < visibleAyahs.length - 1) {
    return Object.freeze({
      action: "play_ayah",
      needsTurnNext: false,
      targetNextPage: null,
      nextAyah: visibleAyahs[currIdx + 1],
    });
  }

  const lastVisiblePage = !isSingleMode && lPage ? Math.max(rPage, lPage) : rPage;
  if (!lastVisiblePage || lastVisiblePage >= totalPages) {
    return Object.freeze({
      action: "stop",
      needsTurnNext: false,
      targetNextPage: null,
      nextAyah: null,
    });
  }

  const targetNextPage = lastVisiblePage + 1;
  const nextPageList = Array.isArray(pageCache[targetNextPage]) ? pageCache[targetNextPage] : null;
  const nextAyah =
    nextPageList && nextPageList.length > 0
      ? normalizeEntry(nextPageList[0], targetNextPage, "right")
      : null;

  return Object.freeze({
    action: "turn_next_and_play",
    needsTurnNext: true,
    targetNextPage,
    nextAyah,
  });
};

/**
 * Resolves full selectedAyah metadata from rendered hitboxes or pageCache so both the
 * canvas highlight and the interactive verse study sheet update in lockstep with audio.
 */
export const findAyahMetadataOnSpread = ({
  surahNum,
  ayahNum,
  rPage,
  lPage,
  isSingleMode = false,
  pageCache = {},
  boxesRight = [],
  boxesLeft = [],
}) => {
  const boxHit = [...(boxesRight || []), ...(boxesLeft || [])].find(
    (b) => b.surahNum === surahNum && b.ayahNum === ayahNum
  );
  if (boxHit) return boxHit;

  const candidatePages = isSingleMode ? [rPage] : [rPage, lPage].filter(Boolean);
  for (const p of candidatePages) {
    const list = pageCache[p];
    if (!Array.isArray(list)) continue;
    const found = list.find(
      (a) => a?.surah?.number === surahNum && a?.numberInSurah === ayahNum
    );
    if (found) {
      return {
        key: `${surahNum}:${ayahNum}`,
        surahNum,
        ayahNum,
        surahName: found.surah?.name || "",
        surahEng: found.surah?.englishName || "",
        text: found.text || "",
        pageNum: p,
      };
    }
  }
  return null;
};

/**
 * Evaluates static Mushaf page local Y height inside its tilted wing group.
 * Strictly >= pageBaseLocalY > stackHeight at all u in [0, 1].
 */
export const evalStaticPageLocalY = (u) => {
  const clampedU = Math.max(0, Math.min(1, u));
  const arch =
    Math.sin(clampedU * Math.PI) * 0.044 +
    Math.sin(clampedU * Math.PI * 0.5) * 0.012;
  return BOOK3D_SPEC.pageBaseLocalY + arch;
};

/**
 * Evaluates world-space (x, y) for a static page vertex on either wing.
 */
export const evalStaticPageWorldPoint = (side, u) => {
  const clampedU = Math.max(0, Math.min(1, u));
  const { wingOffsetX, wingBaseY, wingTilt, pageInnerMarginX, pageWidth } = BOOK3D_SPEC;
  const localDist = pageInnerMarginX + clampedU * pageWidth;
  const localX = side === "right" ? localDist : -localDist;
  const localY = evalStaticPageLocalY(clampedU);
  const rotZ = side === "right" ? wingTilt : -wingTilt;
  const cosR = Math.cos(rotZ);
  const sinR = Math.sin(rotZ);

  const originX = side === "right" ? wingOffsetX : -wingOffsetX;
  return Object.freeze({
    x: originX + localX * cosR - localY * sinR,
    y: wingBaseY + localX * sinR + localY * cosR,
  });
};

/**
 * Evaluates world-space cover bottom & Rehal top heights for collision verification.
 */
export const evalRehalTopWorldYAtDistance = (distAlongArm) => {
  const { hingeY, plankThickness, rotZ } = BOOK3D_SPEC.rehal;
  const s = Math.max(0, Math.min(BOOK3D_SPEC.rehal.plankLength / 2, Math.abs(distAlongArm)));
  return hingeY + s * Math.sin(rotZ) + (plankThickness / 2) * Math.cos(rotZ);
};

export const evalCoverBottomWorldY = (side, distFromSpine) => {
  const { wingBaseY, wingTilt, coverThickness, coverWidth } = BOOK3D_SPEC;
  const d = Math.max(0, Math.min(coverWidth, distFromSpine));
  const localX = side === "right" ? d : -d;
  const localY = -coverThickness;
  const rotZ = side === "right" ? wingTilt : -wingTilt;
  return wingBaseY + localX * Math.sin(rotZ) + localY * Math.cos(rotZ);
};

/**
 * Evaluates full collision-free 3D flip-sheet kinematics for progress p in [0, 1].
 * Arabic RTL convention:
 * - direction = +1 (turnNext): Left page (PI - wingTilt) lifts and turns to Right (wingTilt).
 * - direction = -1 (turnPrev): Right page (wingTilt) lifts and turns to Left (PI - wingTilt).
 */
export const evalFlipPivotState = (progress, direction = 1) => {
  const p = Math.max(0, Math.min(1, progress));
  const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

  const { wingTilt, wingBaseY, pageBaseLocalY, flipPivotClearanceY, flipMidFlightLiftY } = BOOK3D_SPEC;
  const rightAngle = wingTilt;
  const leftAngle = Math.PI - wingTilt;

  // RTL Arabic: next lifts left page (leftAngle) to right (rightAngle); prev reverses
  const startAngle = direction > 0 ? leftAngle : rightAngle;
  const endAngle = direction > 0 ? rightAngle : leftAngle;
  const curAngle = startAngle + (endAngle - startAngle) * ease;

  const basePivotY = wingBaseY + pageBaseLocalY + flipPivotClearanceY;
  const pivotY = basePivotY + Math.sin(p * Math.PI) * flipMidFlightLiftY;

  return Object.freeze({ p, ease, curAngle, pivotY });
};

/**
 * Evaluates a point along the flipping sheet in local & world space.
 * Notice how multiplying the upward camber by cos(curAngle) ensures the arch
 * ALWAYS bows UPWARD away from the underlying static stack on both left and right sides!
 */
export const evalFlipSheetPoint = ({ progress, direction = 1, u = 0 }) => {
  const clampedU = Math.max(0, Math.min(1, u));
  const { curAngle, pivotY, p } = evalFlipPivotState(progress, direction);
  const { wingOffsetX, pageWidth } = BOOK3D_SPEC;

  const cosA = Math.cos(curAngle);
  const sinA = Math.sin(curAngle);

  // Match wing inner offset so sheet lands seamlessly over left/right static page
  const lx = wingOffsetX + clampedU * pageWidth;
  // Base upward paper camber matches static page arch and flips sign cleanly across PI/2
  const staticMatchArch =
    Math.sin(clampedU * Math.PI) * 0.044 +
    Math.sin(clampedU * Math.PI * 0.5) * 0.012 +
    0.004;
  // Soft aerodynamic trailing wave during mid-flight (vanishes at p=0 and p=1)
  const travelTrailSign = direction > 0 ? 1 : -1;
  const flightBow = Math.sin(p * Math.PI) * Math.sin(clampedU * Math.PI * 0.7) * 0.075 * travelTrailSign;

  const localY = staticMatchArch * cosA + flightBow;
  const worldX = lx * cosA - localY * sinA;
  const worldY = pivotY + lx * sinA + localY * cosA;

  return Object.freeze({ lx, localY, worldX, worldY, curAngle, pivotY });
};

/**
 * Detects headless / software WebGL renderers (SwiftShader, llvmpipe, etc.)
 * so we adapt shadow maps, DPR, texture size, and particle churn accordingly.
 */
export const detectSoftwareWebGL = (rendererOrGl) => {
  try {
    const gl =
      rendererOrGl && typeof rendererOrGl.getContext === "function"
        ? rendererOrGl.getContext()
        : rendererOrGl;
    if (!gl || typeof gl.getParameter !== "function") return false;

    let rendererStr = "";
    const debugInfo = typeof gl.getExtension === "function"
      ? gl.getExtension("WEBGL_debug_renderer_info")
      : null;
    if (debugInfo && debugInfo.UNMASKED_RENDERER_WEBGL) {
      rendererStr = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "");
    }
    if (!rendererStr && gl.RENDERER) {
      rendererStr = String(gl.getParameter(gl.RENDERER) || "");
    }
    return /swiftshader|llvmpipe|software|mesa offscreen|microsoft basic render/i.test(rendererStr);
  } catch {
    return false;
  }
};

/**
 * Pure cache-key generator for rendered Mushaf page canvases.
 */
export const buildPageRenderCacheKey = ({
  pageNum,
  tajweedOpts = {},
  activeAyahKey = null,
  resolutionTier = "hd",
  dataVersion = 0,
}) => {
  const tKey = [
    tajweedOpts.showTajweedTone ? 1 : 0,
    tajweedOpts.showQalqala ? 1 : 0,
    tajweedOpts.showMadd ? 1 : 0,
    tajweedOpts.showIzhar ? 1 : 0,
    tajweedOpts.showIdgham ? 1 : 0,
  ].join("");
  return `${pageNum || 0}|${resolutionTier}|${tKey}|${activeAyahKey || ""}|${dataVersion}`;
};

/**
 * Creates a bounded LRU cache for offscreen page canvases so flipping pages or
 * toggling UI drawers reuses rasterized pages in <1ms instead of redrawing 1M+ pixels.
 */
export const createPageCanvasCache = (maxEntries = 18) => {
  const store = new Map();
  return {
    get(key) {
      if (!store.has(key)) return null;
      const val = store.get(key);
      store.delete(key);
      store.set(key, val);
      return val;
    },
    set(key, value) {
      if (store.has(key)) store.delete(key);
      store.set(key, value);
      if (store.size > maxEntries) {
        const oldestKey = store.keys().next().value;
        store.delete(oldestKey);
      }
      return value;
    },
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
  };
};
