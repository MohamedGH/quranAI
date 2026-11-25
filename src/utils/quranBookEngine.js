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
  defaultMobileDist: 3.55,
  buttonStep: 0.65,
  wheelSensitivity: 0.0032,
  min2DScale: 0.75,
  max2DScale: 2.2,
  default2DScale: 1.0,
});

export const BOOK3D_PAN = Object.freeze({
  minX: -2.2,
  maxX: 2.2,
  minY: -1.4,
  maxY: 1.6,
  step: 0.24,
  dragSensitivity: 0.0042,
  min2DX: -360,
  max2DX: 360,
  min2DY: -300,
  max2DY: 300,
  step2D: 36,
});

export const BOOK3D_PARTICLES = Object.freeze({
  hardwareCount: 92,
  softwareCount: 44,
  baseSize: 8.0,
  maxSize: 19.5,
  minScale: 0.95,
  maxScale: 1.75,
  defaultGlowStrength: 1.65,
  auraOpacity: 0.24,
  openDurationSec: 0.95,
  spawnWindowSec: 0.65,
  maxRise: 2.35,
});

/**
 * Pure 3D Mushaf open/close wing kinematics and particle emission envelope.
 * - At openProgress = 0 (closed): wings fold cleanly upward around spine with zero overlap
 *   and particleEmissionFactor = 0 (particles do not start until the Quran opens).
 * - At openProgress = 1 (open): wings settle onto exact BOOK3D_SPEC V-cradle angles and
 *   particleEmissionFactor = 1.
 */
export const evalBook3DOpenState = (openProgress = 1) => {
  const raw = Number(openProgress);
  const p = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 1;
  const ease = 1 - Math.pow(1 - p, 3);

  const closedRotZ = Math.PI / 2 - 0.06;
  const rightWingRotZ = closedRotZ * (1 - ease) + BOOK3D_SPEC.wingTilt * ease;
  const leftWingRotZ = -rightWingRotZ;
  const wingOffsetX = BOOK3D_SPEC.wingOffsetX + (1 - ease) * 0.115;

  const smoothRange = (edge0, edge1, x) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  const particleEmissionFactor = smoothRange(0.18, 0.88, p);
  const auraFactor = smoothRange(0.12, 0.92, p);

  return Object.freeze({
    progress: p,
    ease,
    wingOffsetX,
    rightWingRotZ,
    leftWingRotZ,
    particleEmissionFactor,
    auraFactor,
  });
};

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
 * Pure camera translation (panning) calculators for 3D & 2D Mushaf views.
 */
export const clampCameraPan = (pan = {}) => {
  const rawX = Number(pan?.x);
  const rawY = Number(pan?.y);
  const x = Number.isFinite(rawX)
    ? Math.max(BOOK3D_PAN.minX, Math.min(BOOK3D_PAN.maxX, rawX))
    : 0;
  const y = Number.isFinite(rawY)
    ? Math.max(BOOK3D_PAN.minY, Math.min(BOOK3D_PAN.maxY, rawY))
    : 0;
  return Object.freeze({ x, y });
};

export const clamp2DPan = (pan = {}) => {
  const rawX = Number(pan?.x);
  const rawY = Number(pan?.y);
  const x = Number.isFinite(rawX)
    ? Math.max(BOOK3D_PAN.min2DX, Math.min(BOOK3D_PAN.max2DX, Math.round(rawX)))
    : 0;
  const y = Number.isFinite(rawY)
    ? Math.max(BOOK3D_PAN.min2DY, Math.min(BOOK3D_PAN.max2DY, Math.round(rawY)))
    : 0;
  return Object.freeze({ x, y });
};

export const stepCameraPan = (currentPan = { x: 0, y: 0 }, dirX = 0, dirY = 0) => {
  const safe = clampCameraPan(currentPan);
  const dx = Number(dirX) || 0;
  const dy = Number(dirY) || 0;
  return clampCameraPan({
    x: safe.x + dx * BOOK3D_PAN.step,
    y: safe.y + dy * BOOK3D_PAN.step,
  });
};

export const computePanDeltaFromDrag = (dxPx, dyPx, zoomDist, isSingleMode = false) => {
  const z = clamp3DZoomDist(zoomDist);
  const baseZ = isSingleMode ? BOOK3D_ZOOM.defaultMobileDist : BOOK3D_ZOOM.defaultDesktopDist;
  const zoomRatio = z / baseZ;
  const dx = Number(dxPx) || 0;
  const dy = Number(dyPx) || 0;
  // Dragging canvas right pulls book right -> camera translates left (-dx); dragging down translates camera up (+dy)
  return Object.freeze({
    dx: -dx * BOOK3D_PAN.dragSensitivity * zoomRatio,
    dy: dy * BOOK3D_PAN.dragSensitivity * zoomRatio,
  });
};

export const computeTwoFingerMetrics = (p1, p2) => {
  if (!p1 || !p2) {
    return Object.freeze({ dist: 10, midX: 0, midY: 0 });
  }
  const dist = Math.max(10, Math.hypot((p2.x || 0) - (p1.x || 0), (p2.y || 0) - (p1.y || 0)));
  const midX = ((p1.x || 0) + (p2.x || 0)) * 0.5;
  const midY = ((p1.y || 0) + (p2.y || 0)) * 0.5;
  return Object.freeze({ dist, midX, midY });
};

export const computeCameraPose = ({
  zoomDist,
  panX = 0,
  panY = 0,
  isSingleMode = false,
} = {}) => {
  const { y: baseY, z } = computeCameraPositionForZoom(zoomDist, isSingleMode);
  const pan = clampCameraPan({ x: panX, y: panY });
  const centerOffsetX = isSingleMode
    ? BOOK3D_SPEC.wingOffsetX + BOOK3D_SPEC.pageInnerMarginX + BOOK3D_SPEC.pageWidth * 0.5
    : 0;
  return Object.freeze({
    posX: centerOffsetX + pan.x,
    posY: baseY + pan.y,
    posZ: z,
    targetX: centerOffsetX + pan.x,
    targetY: -0.1 + pan.y,
    targetZ: 0,
  });
};

/**
 * Pure deterministic/varied particle field builder for glowing spiritual dust.
 * Particles originate right above the opened Mushaf pages with staggered spawn
 * delays so they start emerging cleanly when the 3D Quran opens.
 */
export const generateParticleFieldData = (count = BOOK3D_PARTICLES.hardwareCount) => {
  const n = Math.max(1, Math.min(256, Math.round(Number(count) || BOOK3D_PARTICLES.hardwareCount)));
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const scales = new Float32Array(n);
  const phases = new Float32Array(n);
  const delays = new Float32Array(n);
  const speeds = new Float32Array(n);

  const palette = [
    [1.0, 0.87, 0.35], // radiant gold
    [1.0, 0.96, 0.78], // warm pearl cream
    [0.98, 0.72, 0.24], // amber lantern
    [0.83, 0.69, 0.22], // antique bronze-gold
  ];

  const scaleSpan = BOOK3D_PARTICLES.maxScale - BOOK3D_PARTICLES.minScale;
  const phi = 1.61803398875;
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const h1 = (i * phi) % 1;
    const h2 = (i * 0.7548776662 + 0.37) % 1;
    const h3 = (i * 0.5698402909 + 0.19) % 1;

    // Originate directly above the open Mushaf spread pages
    positions[i * 3] = (h1 - 0.5) * 2.55;
    positions[i * 3 + 1] = 0.05 + h3 * 0.16;
    positions[i * 3 + 2] = (h2 - 0.5) * 1.76;

    const col = palette[i % palette.length];
    colors[i * 3] = col[0];
    colors[i * 3 + 1] = col[1];
    colors[i * 3 + 2] = col[2];

    scales[i] = BOOK3D_PARTICLES.minScale + h3 * scaleSpan;
    phases[i] = (h1 + h2) * Math.PI * 2;
    delays[i] = t * BOOK3D_PARTICLES.spawnWindowSec;
    speeds[i] = 0.24 + h3 * 0.2;
  }

  return Object.freeze({ count: n, positions, colors, scales, phases, delays, speeds });
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
    return /swiftshader|llvmpipe|softpipe|software|mesa offscreen|microsoft basic render|vmware|virtualbox/i.test(
      rendererStr
    );
  } catch {
    return false;
  }
};

/**
 * Safely acquires a WebGL2 canvas & context BEFORE instantiating THREE.WebGLRenderer,
 * preventing uncaught Three.js `console.error` logs when WebGL is blocked or lost.
 * In mocked test environments where native WebGL2RenderingContext is absent,
 * returns status "unverified" so mocked THREE.WebGLRenderer paths continue working.
 */
export const acquireSafeWebGLContext = ({
  createCanvas = null,
  preferHardwareAntialias = true,
  alpha = true,
  cachedProfile = null,
  onProfileDetected = null,
  allowRetry = false,
  hasNativeWebGL = typeof WebGL2RenderingContext !== "undefined",
} = {}) => {
  const makeCanvas =
    typeof createCanvas === "function"
      ? createCanvas
      : () => (typeof document !== "undefined" ? document.createElement("canvas") : null);

  if (!hasNativeWebGL && typeof createCanvas !== "function") {
    return {
      status: "unverified",
      canvas: null,
      context: null,
      isSoftware: Boolean(cachedProfile?.isSoftware),
      reason: null,
    };
  }

  if (cachedProfile && cachedProfile.supported === false && !allowRetry) {
    return {
      status: "unavailable",
      canvas: null,
      context: null,
      isSoftware: true,
      reason: cachedProfile.reason || "WebGL2 context blocked",
    };
  }

  const tryOpenOnCanvas = (attrs) => {
    const cvs = makeCanvas();
    if (!cvs || typeof cvs.getContext !== "function") {
      return { canvas: null, gl: null, reason: "Canvas unavailable" };
    }
    let reason = null;
    const onErr = (ev) => {
      if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
      if (ev && ev.statusMessage) reason = String(ev.statusMessage);
    };
    cvs.addEventListener?.("webglcontextcreationerror", onErr, false);
    let gl = null;
    try {
      gl = cvs.getContext("webgl2", attrs);
    } catch (err) {
      reason = reason || err?.message || "WebGL2 context exception";
      gl = null;
    } finally {
      cvs.removeEventListener?.("webglcontextcreationerror", onErr, false);
    }
    if (!gl || typeof gl.getParameter !== "function") {
      return { canvas: null, gl: null, reason: reason || "WebGL2 context unavailable" };
    }
    return { canvas: cvs, gl, reason: null };
  };

  // First-time probe: open lightweight non-MSAA context once, detect software GL,
  // and reuse it directly on software WebGL (zero duplicate contexts or MSAA waste).
  if (!cachedProfile) {
    const probe = tryOpenOnCanvas({
      alpha,
      antialias: false,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: false,
    });
    if (!probe.gl) {
      onProfileDetected?.({ supported: false, isSoftware: true, reason: probe.reason });
      return {
        status: "unavailable",
        canvas: null,
        context: null,
        isSoftware: true,
        reason: probe.reason,
      };
    }

    const isSw = detectSoftwareWebGL(probe.gl);
    onProfileDetected?.({ supported: true, isSoftware: isSw, reason: null });

    if (isSw || !preferHardwareAntialias) {
      return {
        status: "ready",
        canvas: probe.canvas,
        context: probe.gl,
        isSoftware: isSw,
        reason: null,
      };
    }

    // Hardware GPU: release lightweight probe once and open MSAA context
    try {
      probe.gl.getExtension?.("WEBGL_lose_context")?.loseContext?.();
    } catch {}

    const hwAttempt = tryOpenOnCanvas({
      alpha,
      antialias: true,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    if (hwAttempt.gl) {
      return {
        status: "ready",
        canvas: hwAttempt.canvas,
        context: hwAttempt.gl,
        isSoftware: false,
        reason: null,
      };
    }

    const hwFallback = tryOpenOnCanvas({
      alpha,
      antialias: false,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: false,
    });
    if (hwFallback.gl) {
      return {
        status: "ready",
        canvas: hwFallback.canvas,
        context: hwFallback.gl,
        isSoftware: false,
        reason: null,
      };
    }

    return {
      status: "unavailable",
      canvas: null,
      context: null,
      isSoftware: true,
      reason: hwFallback.reason || hwAttempt.reason,
    };
  }

  // Subsequent mounts use cached GPU tier
  const useSoftwareDefaults = Boolean(cachedProfile.isSoftware) || !preferHardwareAntialias;
  const primary = tryOpenOnCanvas({
    alpha,
    antialias: !useSoftwareDefaults,
    powerPreference: useSoftwareDefaults ? "default" : "high-performance",
    failIfMajorPerformanceCaveat: false,
  });
  if (primary.gl) {
    return {
      status: "ready",
      canvas: primary.canvas,
      context: primary.gl,
      isSoftware: detectSoftwareWebGL(primary.gl) || Boolean(cachedProfile.isSoftware),
      reason: null,
    };
  }

  if (!useSoftwareDefaults) {
    const conservative = tryOpenOnCanvas({
      alpha,
      antialias: false,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: false,
    });
    if (conservative.gl) {
      return {
        status: "ready",
        canvas: conservative.canvas,
        context: conservative.gl,
        isSoftware: detectSoftwareWebGL(conservative.gl),
        reason: null,
      };
    }
    return {
      status: "unavailable",
      canvas: null,
      context: null,
      isSoftware: true,
      reason: conservative.reason || primary.reason,
    };
  }

  return {
    status: "unavailable",
    canvas: null,
    context: null,
    isSoftware: true,
    reason: primary.reason,
  };
};

/**
 * Coordinates hardware rAF rendering vs software WebGL `fenceSync` + cooldown pacing
 * so SwiftShader/CPU rasterization never starves Chromium's GPU watchdog.
 */
export const createPacedRenderScheduler = ({
  renderer,
  isSoftwareGl = false,
  isHidden = () => (typeof document !== "undefined" ? Boolean(document.hidden) : false),
  requestAnimationFrameFn = (cb) =>
    (typeof window !== "undefined" ? window.requestAnimationFrame : globalThis.requestAnimationFrame)(cb),
  cancelAnimationFrameFn = (id) =>
    (typeof window !== "undefined" ? window.cancelAnimationFrame : globalThis.cancelAnimationFrame)(id),
  setTimeoutFn = (cb, ms) => globalThis.setTimeout(cb, ms),
  clearTimeoutFn = (id) => globalThis.clearTimeout(id),
  nowFn = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  softwareCooldownMs = 80,
  pollIntervalMs = 5,
  maxSyncWaitMs = 1500,
} = {}) => {
  let rafId = 0;
  let timerId = 0;
  let disposed = false;
  let busy = false;
  let dirty = false;

  const cancelTimers = () => {
    if (rafId) {
      cancelAnimationFrameFn(rafId);
      rafId = 0;
    }
    if (timerId) {
      clearTimeoutFn(timerId);
      timerId = 0;
    }
    busy = false;
    dirty = false;
  };

  const afterDraw = (done) => {
    if (disposed) return;
    if (!isSoftwareGl) {
      done();
      return;
    }

    const gl = renderer?.getContext?.();
    if (gl && typeof gl.fenceSync === "function" && typeof gl.getSyncParameter === "function") {
      let sync = null;
      try {
        sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush?.();
      } catch {
        sync = null;
      }

      if (sync) {
        const startMs = nowFn();
        const poll = () => {
          timerId = 0;
          if (disposed) {
            try {
              gl.deleteSync?.(sync);
            } catch {}
            return;
          }
          let signaled = true;
          try {
            const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
            signaled = state !== gl.UNSIGNALED;
          } catch {
            signaled = true;
          }
          if (!signaled && nowFn() - startMs < maxSyncWaitMs) {
            timerId = setTimeoutFn(poll, pollIntervalMs);
          } else {
            try {
              gl.deleteSync?.(sync);
            } catch {}
            timerId = setTimeoutFn(() => {
              timerId = 0;
              if (!disposed) done();
            }, softwareCooldownMs);
          }
        };
        timerId = setTimeoutFn(poll, pollIntervalMs);
        return;
      }
    }

    timerId = setTimeoutFn(() => {
      timerId = 0;
      if (!disposed) done();
    }, softwareCooldownMs);
  };

  const schedule = (renderTick) => {
    if (disposed || typeof renderTick !== "function") return;
    if (isHidden()) {
      dirty = true;
      return;
    }
    if (busy || rafId) {
      dirty = true;
      return;
    }
    rafId = requestAnimationFrameFn((ts) => {
      rafId = 0;
      if (disposed || isHidden()) {
        if (!disposed) dirty = true;
        return;
      }
      busy = true;
      dirty = false;
      const shouldContinue = Boolean(renderTick(ts));
      afterDraw(() => {
        busy = false;
        if (disposed) return;
        if (shouldContinue || dirty) {
          schedule(renderTick);
        }
      });
    });
  };

  return {
    schedule,
    cancelAll: cancelTimers,
    dispose() {
      disposed = true;
      cancelTimers();
    },
    isDisposed: () => disposed,
    hasPendingWork: () => Boolean(rafId || timerId || busy || dirty),
  };
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
