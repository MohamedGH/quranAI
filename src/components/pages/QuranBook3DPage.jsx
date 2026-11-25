import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { sel, uiActions, learnActions } from "../../store.js";
import {
  fetchPageMeta,
  GLOBAL_RECITERS,
  fetchQuranPage,
  fetchSurahTranslation,
  stripBasmalaFromAyah,
} from "../../utils/reciterAudio.js";
import {
  isTafkhim,
  isQalqala,
  isIzhar,
  isIdgham,
  getMaddType,
} from "../../utils/tajweedRules.js";
import {
  MUSHAF_TOTAL_PAGES,
  MUSHAF_DOUBLE_SPREADS,
  BOOK3D_SPEC,
  BOOK3D_ZOOM,
  BOOK3D_PAN,
  BOOK3D_PARTICLES,
  evalBook3DOpenState,
  evalStaticPageLocalY,
  detectSoftwareWebGL,
  acquireSafeWebGLContext,
  createPacedRenderScheduler,
  buildPageRenderCacheKey,
  createPageCanvasCache,
  computeSpreadPages,
  computeWheelZoomDist,
  computePinchZoomDist,
  step3DZoomDist,
  computeZoomPercent,
  clamp2DZoomScale,
  clampCameraPan,
  clamp2DPan,
  stepCameraPan,
  computePanDeltaFromDrag,
  computeTwoFingerMetrics,
  computeCameraPose,
  generateParticleFieldData,
  resolveSpreadPlaybackStep,
  findAyahMetadataOnSpread,
} from "../../utils/quranBookEngine.js";
import { withErrorRecovery, ERROR_CODES } from "../../utils/errorManager.js";
import { EditableUiSlot } from "../common/EditableUiSlot.jsx";
import { isPriority3DProfile } from "../../utils/uxProfileManager.js";
import { resolveBook3DStepDownNavigation } from "../../utils/fullScreenNavigation.js";

const _MUSHAF_PAGES = MUSHAF_TOTAL_PAGES;

// Pre-allocated helpers so render loop and clicks cause zero GC allocations
const _cameraLookAtTarget = new THREE.Vector3(0, -0.1, 0);
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();
const _SINGLE_CENTER_X =
  BOOK3D_SPEC.wingOffsetX + BOOK3D_SPEC.pageInnerMarginX + BOOK3D_SPEC.pageWidth * 0.5;

// Bounded LRU cache for rasterized offscreen canvases across page flips & drawer toggles
const _pageCanvasCache = createPageCanvasCache(18);
let _cachedGlProfile = null;
export const resetBook3DWebGLCache = () => {
  _cachedGlProfile = null;
};

// Helper for authentic Eastern Arabic digits (e.g. ﴿١﴾)
function toArabicDigits(num) {
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(num).replace(/[0-9]/g, (d) => digits[d]);
}

function stripBismillahIfPresent(text, surahNum, ayahNum) {
  return stripBasmalaFromAyah(text, surahNum, ayahNum);
}

// ─── 2D Canvas Mushaf Page Texture Generator (LRU-cached & Tier-adaptive) ─────
function renderPageToCanvas(
  ayahs,
  pageNum,
  tajweedOpts,
  activeAyahKey,
  _isSingle = false,
  resolutionTier = "hd"
) {
  if (typeof document === "undefined") return { canvas: null, boxes: [] };

  const dataVersion = Array.isArray(ayahs) ? ayahs.length + 1 : 0;
  const cacheKey = buildPageRenderCacheKey({
    pageNum,
    tajweedOpts,
    activeAyahKey,
    resolutionTier,
    dataVersion,
  });

  const cached = _pageCanvasCache.get(cacheKey);
  if (cached) return cached;

  const scale = resolutionTier === "lite" ? 1 : 1.5;
  const w = Math.round(512 * scale);
  const h = Math.round(768 * scale);

  const cvs = document.createElement("canvas");
  cvs.width = w;
  cvs.height = h;

  const ctx = cvs.getContext("2d", { alpha: false });
  if (!ctx) return { canvas: null, boxes: [] };

  const boxes = [];

  // Background: Warm Ivory Medina Mushaf Paper
  ctx.fillStyle = "#faf7ee";
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "rgba(220, 195, 140, 0.2)");
  grad.addColorStop(0.08, "rgba(255, 255, 255, 0.0)");
  grad.addColorStop(0.92, "rgba(255, 255, 255, 0.0)");
  grad.addColorStop(1, "rgba(220, 195, 140, 0.2)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (!pageNum || pageNum < 1 || pageNum > _MUSHAF_PAGES) {
    return _pageCanvasCache.set(cacheKey, { canvas: cvs, boxes });
  }

  // Outer Ornate Golden Border Frame (tighter margin on lite/mobile so page fills screen cleanly)
  const isLite = resolutionTier === "lite";
  const margin = (isLite ? 30 : 48) * scale;
  const frameW = w - margin * 2;
  const frameH = h - margin * 2;

  ctx.strokeStyle = "rgba(195, 155, 60, 0.85)";
  ctx.lineWidth = (isLite ? 3.5 : 4) * scale;
  ctx.strokeRect(margin, margin, frameW, frameH);

  ctx.strokeStyle = "rgba(195, 155, 60, 0.35)";
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeRect(margin + 7 * scale, margin + 7 * scale, frameW - 14 * scale, frameH - 14 * scale);

  // Corner Rosettes
  const cRadius = (isLite ? 8 : 10) * scale;
  const corners = [
    [margin, margin],
    [margin + frameW, margin],
    [margin, margin + frameH],
    [margin + frameW, margin + frameH],
  ];
  for (let i = 0; i < corners.length; i++) {
    const [cx, cy] = corners[i];
    ctx.fillStyle = "#b89035";
    ctx.beginPath();
    ctx.arc(cx, cy, cRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, cRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  const topAyah = ayahs && ayahs.length ? ayahs[0] : null;
  const rawSurahName = topAyah?.surah?.name || "";
  const cleanSurahHeader = rawSurahName.replace(/^سُورَةُ\s*/, "");
  const juzNum = topAyah?.juz || Math.ceil(pageNum / 20);
  const hizbNum =
    topAyah?.hizb ??
    (topAyah?.hizbQuarter != null ? Math.ceil(topAyah.hizbQuarter / 4) : Math.ceil(pageNum / 10));

  ctx.fillStyle = "#8a6d25";
  ctx.font = `bold ${(isLite ? 13 : 14) * scale}px 'Cinzel', serif`;
  ctx.textAlign = "left";
  ctx.fillText(
    `JUZ ${juzNum} · HIZB ${hizbNum}`,
    margin + 14 * scale,
    margin - (isLite ? 9 : 12) * scale
  );

  if (cleanSurahHeader) {
    ctx.textAlign = "right";
    ctx.font = `bold ${(isLite ? 15 : 16) * scale}px 'Amiri Quran', serif`;
    ctx.fillText(
      `سُورَةُ ${cleanSurahHeader}`,
      margin + frameW - 14 * scale,
      margin - (isLite ? 9 : 12) * scale
    );
  }

  ctx.fillStyle = "#a17e2e";
  ctx.font = `bold ${(isLite ? 14 : 15) * scale}px 'Cinzel', serif`;
  ctx.textAlign = "center";
  ctx.fillText(`${pageNum}`, w / 2, h - margin + (isLite ? 20 : 26) * scale);

  if (!ayahs || !ayahs.length) {
    ctx.fillStyle = "#9c824c";
    ctx.font = `${22 * scale}px 'Amiri Quran', serif`;
    ctx.textAlign = "center";
    ctx.fillText("جَارِي التَّحْمِيلِ...", w / 2, h / 2);
    return _pageCanvasCache.set(cacheKey, { canvas: cvs, boxes });
  }

  let curY = margin + (isLite ? 28 : 34) * scale;
  const sidePad = (isLite ? 14 : 18) * scale;
  const contentW = frameW - sidePad * 2;
  const contentX = margin + sidePad;

  const surahGroups = [];
  for (let i = 0; i < ayahs.length; i++) {
    const a = ayahs[i];
    const last = surahGroups[surahGroups.length - 1];
    if (!last || last.surahNum !== a.surah.number) {
      surahGroups.push({ surahNum: a.surah.number, surah: a.surah, ayahs: [a] });
    } else {
      last.ayahs.push(a);
    }
  }

  const anyTajweed = Boolean(
    tajweedOpts?.showTajweedTone ||
      tajweedOpts?.showQalqala ||
      tajweedOpts?.showMadd ||
      tajweedOpts?.showIzhar ||
      tajweedOpts?.showIdgham
  );

  for (let gIdx = 0; gIdx < surahGroups.length; gIdx++) {
    const group = surahGroups[gIdx];
    const isSurahStart = group.ayahs.some((a) => a.numberInSurah === 1);

    if (isSurahStart) {
      const bannerH = 46 * scale;
      const bannerY = curY;

      ctx.fillStyle = "rgba(195, 155, 60, 0.16)";
      ctx.fillRect(contentX, bannerY, contentW, bannerH);
      ctx.strokeStyle = "rgba(195, 155, 60, 0.8)";
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(contentX, bannerY, contentW, bannerH);

      const cleanName = (group.surah.name || "").replace(/^سُورَةُ\s*/, "");
      ctx.fillStyle = "#4a320c";
      ctx.font = `bold ${22 * scale}px 'Amiri Quran', serif`;
      ctx.textAlign = "center";
      ctx.fillText(`سُورَةُ ${cleanName}`, contentX + contentW / 2, bannerY + bannerH * 0.68);
      curY += bannerH + 16 * scale;

      if (group.surahNum !== 9 && group.surahNum !== 1) {
        ctx.fillStyle = "#2c2010";
        ctx.font = `${18 * scale}px 'Amiri Quran', serif`;
        ctx.textAlign = "center";
        ctx.fillText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", contentX + contentW / 2, curY + 16 * scale);
        curY += 36 * scale;
      }
    }

    const isSpecialFirstPage = pageNum === 1;
    const baseFontSize = isSpecialFirstPage
      ? 24 * scale
      : Math.max(16 * scale, Math.min(22 * scale, (w / 31) * scale));
    const lineHeight = baseFontSize * 1.76;

    const wordFont = `${baseFontSize}px 'Amiri Quran', 'Scheherazade New', serif`;
    const endFont = `bold ${baseFontSize * 0.88}px 'Amiri Quran', serif`;

    const wordsStream = [];
    for (let aIdx = 0; aIdx < group.ayahs.length; aIdx++) {
      const ayah = group.ayahs[aIdx];
      const aKey = `${ayah.surah.number}:${ayah.numberInSurah}`;
      const rawText = stripBismillahIfPresent(ayah.text, group.surahNum, ayah.numberInSurah);
      const words = rawText.split(/\s+/).filter(Boolean);

      ctx.font = wordFont;
      for (let wIdx = 0; wIdx < words.length; wIdx++) {
        const wStr = words[wIdx];
        const measuredW = ctx.measureText(wStr).width;

        let wordColor = "#1a1610";
        if (anyTajweed) {
          const chars = Array.from(wStr);
          if (tajweedOpts.showTajweedTone) {
            wordColor = chars.some((_, idx) => isTafkhim(chars, idx)) ? "#0284c7" : "#db2777";
          } else if (tajweedOpts.showQalqala && chars.some((_, idx) => isQalqala(chars, idx))) {
            wordColor = "#0284c7";
          } else if (tajweedOpts.showMadd && chars.some((_, idx) => getMaddType(chars, idx))) {
            wordColor = "#ea580c";
          } else if (tajweedOpts.showIzhar && chars.some((_, idx) => isIzhar(chars, idx))) {
            wordColor = "#059669";
          } else if (tajweedOpts.showIdgham && chars.some((_, idx) => isIdgham(chars, idx))) {
            wordColor = "#d97706";
          }
        }

        wordsStream.push({
          word: wStr,
          wordW: measuredW,
          wordColor,
          isEnd: false,
          ayah,
          aKey,
        });
      }

      const endWord = `﴿${toArabicDigits(ayah.numberInSurah)}﴾`;
      ctx.font = endFont;
      wordsStream.push({
        word: endWord,
        wordW: ctx.measureText(endWord).width,
        wordColor: "#b88a24",
        isEnd: true,
        ayah,
        aKey,
      });
    }

    const boundsMap = {};
    let currentLineWords = [];
    let currentLineWidth = 0;
    ctx.textAlign = "left";
    let activeDrawFont = "";

    const flushLine = (isLast) => {
      if (!currentLineWords.length) return;

      const spaceCount = currentLineWords.length - 1;
      let totalWordsW = 0;
      for (let k = 0; k < currentLineWords.length; k++) {
        totalWordsW += currentLineWords[k].wordW;
      }

      let extraSpace = 8 * scale;
      let drawX = contentX + contentW;

      if (!isLast && spaceCount > 0 && !isSpecialFirstPage) {
        extraSpace = Math.max(4 * scale, (contentW - totalWordsW) / spaceCount);
      } else if (isSpecialFirstPage || isLast) {
        const lineTotalW = totalWordsW + spaceCount * (8 * scale);
        drawX = contentX + (contentW + lineTotalW) / 2;
        extraSpace = 8 * scale;
      }

      for (let k = 0; k < currentLineWords.length; k++) {
        const item = currentLineWords[k];
        drawX -= item.wordW;

        if (!boundsMap[item.aKey]) {
          boundsMap[item.aKey] = {
            ayah: item.ayah,
            yMin: curY - baseFontSize * 0.9,
            yMax: curY + lineHeight * 0.25,
          };
        } else {
          boundsMap[item.aKey].yMax = Math.max(boundsMap[item.aKey].yMax, curY + lineHeight * 0.25);
        }

        if (activeAyahKey === item.aKey) {
          ctx.fillStyle = "rgba(195, 155, 60, 0.35)";
          ctx.fillRect(drawX - 3 * scale, curY - baseFontSize * 0.85, item.wordW + 6 * scale, lineHeight);
        }

        const nextFont = item.isEnd ? endFont : wordFont;
        if (activeDrawFont !== nextFont) {
          ctx.font = nextFont;
          activeDrawFont = nextFont;
        }
        ctx.fillStyle = item.wordColor;
        ctx.fillText(item.word, drawX, curY);

        drawX -= extraSpace;
      }

      curY += lineHeight;
      currentLineWords = [];
      currentLineWidth = 0;
    };

    for (let sIdx = 0; sIdx < wordsStream.length; sIdx++) {
      const item = wordsStream[sIdx];
      const wWidth = item.wordW + 8 * scale;
      if (currentLineWidth + wWidth > contentW && currentLineWords.length > 0) {
        flushLine(false);
      }
      currentLineWords.push(item);
      currentLineWidth += wWidth;
    }

    flushLine(true);
    curY += 8 * scale;

    Object.entries(boundsMap).forEach(([aKey, bound]) => {
      boxes.push({
        key: aKey,
        surahNum: bound.ayah.surah.number,
        ayahNum: bound.ayah.numberInSurah,
        pageNum,
        uMin: contentX / w,
        uMax: (contentX + contentW) / w,
        vMin: Math.max(0, 1.0 - bound.yMax / h),
        vMax: Math.min(1.0, 1.0 - bound.yMin / h),
        text: bound.ayah.text,
        surahName: bound.ayah.surah.name,
        surahEng: bound.ayah.surah.englishName,
      });
    });
  }

  return _pageCanvasCache.set(cacheKey, { canvas: cvs, boxes });
}

// Crisp zero-reencode 2D canvas mirror for 2D mode
function CanvasMirror({ canvas, alt, fit = "contain" }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !canvas) return;
    if (el.width !== canvas.width) el.width = canvas.width;
    if (el.height !== canvas.height) el.height = canvas.height;
    const ctx = el.getContext("2d", { alpha: false });
    if (ctx) ctx.drawImage(canvas, 0, 0);
  }, [canvas]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={alt}
      style={{ width: "100%", height: "100%", objectFit: fit, display: "block" }}
    />
  );
}

// ─── 3D Procedural Leather Cover Texture Generator ───────────────────────────
function createCoverTexture() {
  if (typeof document === "undefined") return null;
  const cvs = document.createElement("canvas");
  cvs.width = 512;
  cvs.height = 768;
  const ctx = cvs.getContext("2d", { alpha: false });
  if (!ctx) return null;

  const bgGrad = ctx.createRadialGradient(256, 384, 25, 256, 384, 400);
  bgGrad.addColorStop(0, "#083321");
  bgGrad.addColorStop(0.6, "#041f13");
  bgGrad.addColorStop(1, "#02100a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 768);

  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, 452, 708);

  ctx.strokeStyle = "rgba(212, 175, 55, 0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(45, 45, 422, 678);

  const drawCornerLattice = (x, y, flipX, flipY) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flipX, flipY);
    ctx.fillStyle = "#d4af37";
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 0.5);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.strokeStyle = "#041f13";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 0.5);
    ctx.stroke();
    ctx.restore();
  };

  drawCornerLattice(30, 30, 1, 1);
  drawCornerLattice(482, 30, -1, 1);
  drawCornerLattice(30, 738, 1, -1);
  drawCornerLattice(482, 738, -1, -1);

  const cx = 256;
  const cy = 384;

  ctx.fillStyle = "rgba(212, 175, 55, 0.95)";
  ctx.beginPath();
  ctx.arc(cx, cy, 110, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#041f13";
  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(212, 175, 55, 0.85)";
  ctx.beginPath();
  ctx.arc(cx, cy, 85, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#03170e";
  ctx.beginPath();
  ctx.arc(cx, cy, 77, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 28px 'Amiri Quran', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("الْقُرْآنُ", cx, cy - 13);
  ctx.fillText("الْكَرِيمُ", cx, cy + 18);

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── Procedural Carved Wood Texture for the Rehal Stand ───────────────────────
function createWoodTexture() {
  if (typeof document === "undefined") return null;
  const cvs = document.createElement("canvas");
  cvs.width = 256;
  cvs.height = 256;
  const ctx = cvs.getContext("2d", { alpha: false });
  if (!ctx) return null;

  ctx.fillStyle = "#2c1508";
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = "#1e0e05";
  for (let i = 0; i < 256; i += 3) {
    const wave = Math.sin(i * 0.06) * 3;
    ctx.fillRect(i + wave, 0, 1.5, 256);
  }

  ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 236, 236);
  ctx.strokeRect(20, 20, 216, 216);

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── Procedural Soft-Glow Star/Orb Texture for Spiritual Dust Particles ──────
export function createParticleGlowTexture(size = 64) {
  if (typeof document === "undefined") return null;
  const s = Math.max(16, Number(size) || 64);
  const cvs = document.createElement("canvas");
  cvs.width = s;
  cvs.height = s;
  const ctx = cvs.getContext("2d");
  if (!ctx) return null;

  const cx = s * 0.5;
  const cy = s * 0.5;
  const r = s * 0.5;

  if (typeof ctx.createRadialGradient === "function") {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0.0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.34, "rgba(255, 246, 196, 0.98)");
    grad.addColorStop(0.62, "rgba(255, 214, 88, 0.72)");
    grad.addColorStop(0.86, "rgba(235, 175, 45, 0.28)");
    grad.addColorStop(1.0, "rgba(212, 175, 55, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  } else {
    ctx.fillStyle = "rgba(255, 232, 145, 0.92)";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp luminous 4-point celestial starflare core
  if (typeof ctx.ellipse === "function") {
    ctx.save();
    ctx.fillStyle = "rgba(255, 254, 238, 0.92)";
    const armLen = r * 0.72;
    const armThick = Math.max(1.2, s * 0.045);
    ctx.beginPath();
    ctx.ellipse(cx, cy, armLen, armThick, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, armThick, armLen, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ─── Procedural Volumetric Sacred Halo Texture behind the 3D Mushaf ──────────
export function createAuraGlowTexture(size = 128) {
  if (typeof document === "undefined") return null;
  const s = Math.max(32, Number(size) || 128);
  const cvs = document.createElement("canvas");
  cvs.width = s;
  cvs.height = s;
  const ctx = cvs.getContext("2d");
  if (!ctx) return null;

  const cx = s * 0.5;
  const cy = s * 0.5;
  const r = s * 0.5;

  if (typeof ctx.createRadialGradient === "function") {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0.0, "rgba(255, 228, 138, 0.78)");
    grad.addColorStop(0.35, "rgba(212, 175, 55, 0.34)");
    grad.addColorStop(0.7, "rgba(180, 120, 30, 0.1)");
    grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  } else {
    ctx.fillStyle = "rgba(212, 175, 55, 0.3)";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Helper to build collision-free static wing curved page in XZ plane
function createStaticCurvedPageGeo(side) {
  const { pageWidth, pageDepth, pageInnerMarginX } = BOOK3D_SPEC;
  const geo = new THREE.PlaneGeometry(pageWidth, pageDepth, 24, 10);
  // Lie flat in XZ plane with normal pointing UP (+Y) and -Z at top (v=1), +Z at bottom (v=0)
  geo.rotateX(-Math.PI / 2);
  const centerX = side === "right" ? pageInnerMarginX + pageWidth / 2 : -(pageInnerMarginX + pageWidth / 2);
  geo.translate(centerX, 0, 0);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const distFromSpine = Math.max(0, Math.abs(x) - pageInnerMarginX);
    const u = Math.max(0, Math.min(1, distFromSpine / pageWidth));
    pos.setY(i, evalStaticPageLocalY(u));
  }
  geo.computeVertexNormals();
  return geo;
}

// ─── Main 3D Quran Component ──────────────────────────────────────────────────
export function QuranBook3DPage({
  surahs: propSurahs,
  learnData: propLearnData,
  setLData: propSetLData,
  showQalqala: propShowQalqala,
  showMadd: propShowMadd,
  showIzhar: propShowIzhar,
  showIdgham: propShowIdgham,
  showTajweedTone: propShowTajweedTone,
  toggleQalqala: propToggleQalqala,
  toggleMadd: propToggleMadd,
  toggleIzhar: propToggleIzhar,
  toggleIdgham: propToggleIdgham,
  toggleTajweedTone: propToggleTajweedTone,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const reduxSurahs = useSelector(sel.surahs);
  const reduxLearnData = useSelector(sel.learnData);
  const reduxShowQalqala = useSelector(sel.showQalqala);
  const reduxShowMadd = useSelector(sel.showMadd);
  const reduxShowIzhar = useSelector(sel.showIzhar);
  const reduxShowIdgham = useSelector(sel.showIdgham);
  const reduxShowTajweedTone = useSelector(sel.showTajweedTone);
  const uiEditMode = useSelector(sel.uiEditMode);
  const uxMode = useSelector(sel.uxMode);
  const lastAyatBySurah = useSelector(sel.lastAyatBySurah);
  const isSimplifiedPriority = isPriority3DProfile(uxMode);

  const surahs = propSurahs || reduxSurahs || [];
  const learnData = propLearnData || reduxLearnData || {};

  const showQalqala = propShowQalqala ?? reduxShowQalqala;
  const showMadd = propShowMadd ?? reduxShowMadd;
  const showIzhar = propShowIzhar ?? reduxShowIzhar;
  const showIdgham = propShowIdgham ?? reduxShowIdgham;
  const showTajweedTone = propShowTajweedTone ?? reduxShowTajweedTone;

  const toggleQalqala = propToggleQalqala || (() => dispatch(uiActions.toggleQalqala()));
  const toggleMadd = propToggleMadd || (() => dispatch(uiActions.toggleMadd()));
  const toggleIzhar = propToggleIzhar || (() => dispatch(uiActions.toggleIzhar()));
  const toggleIdgham = propToggleIdgham || (() => dispatch(uiActions.toggleIdgham()));
  const toggleTajweedTone = propToggleTajweedTone || (() => dispatch(uiActions.toggleTajweedTone()));

  const [spread, setSpread] = useState(1);
  const [isSingleMode, setIsSingleMode] = useState(false);
  const [viewMode, setViewMode] = useState("3d");
  const [webglFailed, setWebglFailed] = useState(false);
  const [rightCanvas, setRightCanvas] = useState(null);
  const [leftCanvas, setLeftCanvas] = useState(null);
  const [pageCache, setPageCache] = useState({});
  const [selectedAyah, setSelectedAyah] = useState(null);
  const [ayahTranslation, setAyahTranslation] = useState("");
  const [transLang] = useState("fr");
  const [showSurahDrawer, setShowSurahDrawer] = useState(false);
  const [showTajweedDrawer, setShowTajweedDrawer] = useState(false);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showStand, setShowStand] = useState(true);
  const [showDust, setShowDust] = useState(true);
  const [showGlow, setShowGlow] = useState(true);
  const [bookOpen, setBookOpen] = useState(true);
  const [interactionMode, setInteractionMode] = useState("orbit"); // "orbit" | "pan"
  const [pan2d, setPan2d] = useState({ x: 0, y: 0 });
  const [bookmark, setBookmark] = useState(() => {
    try {
      return parseInt(localStorage.getItem("quran_bm_page"), 10) || null;
    } catch {
      return null;
    }
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [reciterKey, setReciterKey] = useState("alafasy");
  const [audioSpeed] = useState(1.0);
  const [currentAudioAyah, setCurrentAudioAyah] = useState(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [zoom2dScale, setZoom2dScale] = useState(BOOK3D_ZOOM.default2DScale);
  const lastZoomPercentRef = useRef(100);
  const commitZoomPercent = useCallback((nextPct) => {
    if (lastZoomPercentRef.current === nextPct) return;
    lastZoomPercentRef.current = nextPct;
    setZoomPercent(nextPct);
  }, []);
  const audioRef = useRef(null);
  const translationReqIdRef = useRef(0);
  const pendingAutoPlayRef = useRef(null);
  const isSingleModeRef = useRef(isSingleMode);
  isSingleModeRef.current = isSingleMode;
  const interactionModeRef = useRef(interactionMode);
  interactionModeRef.current = interactionMode;

  // Three.js Scene Refs
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const bookGroupRef = useRef(null);
  const standGroupRef = useRef(null);
  const rightPageMeshRef = useRef(null);
  const leftPageMeshRef = useRef(null);
  const rightWingRef = useRef(null);
  const leftWingRef = useRef(null);
  const flipPivotRef = useRef(null);
  const flipRightFaceMeshRef = useRef(null);
  const flipLeftFaceMeshRef = useRef(null);
  const dustParticlesRef = useRef(null);
  const auraSpriteRef = useRef(null);
  const showStandRef = useRef(showStand);
  const showDustRef = useRef(showDust);
  const showGlowRef = useRef(showGlow);
  const bookOpenRef = useRef(bookOpen);
  const openAnimRef = useRef({ progress: 0, particleTime: 0 });
  const isSoftwareGlRef = useRef(Boolean(_cachedGlProfile?.isSoftware));
  const retryWebGLRef = useRef(false);
  const requestRenderRef = useRef(() => {});

  // Texture & Hit-test Refs
  const rightTexRef = useRef(null);
  const leftTexRef = useRef(null);
  const flipRightTexRef = useRef(null);
  const flipLeftTexRef = useRef(null);
  const rightBoxesRef = useRef([]);
  const leftBoxesRef = useRef([]);
  const inFlightPagesRef = useRef(new Set());
  const pageCacheRef = useRef(pageCache);
  pageCacheRef.current = pageCache;

  // Animation, Orbit, Camera Pan & Zoom Interaction Refs
  const isDraggingRef = useRef(false);
  const panDragActiveRef = useRef(false);
  const dragDistRef = useRef(0);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const activePointersRef = useRef(new Map());
  const pinchStateRef = useRef({
    active: false,
    startTouchDist: 0,
    startZoomDist: BOOK3D_ZOOM.defaultDesktopDist,
    prevMidX: 0,
    prevMidY: 0,
  });
  const targetRotationRef = useRef({ x: 0.35, y: 0.0 });
  const currentRotationRef = useRef({ x: 0.35, y: 0.0 });
  const targetPanRef = useRef({ x: 0, y: 0 });
  const currentPanRef = useRef({ x: 0, y: 0 });
  const zoomDistRef = useRef(BOOK3D_ZOOM.defaultDesktopDist);
  const targetZoomRef = useRef(BOOK3D_ZOOM.defaultDesktopDist);
  const flipAnimRef = useRef({
    active: false,
    progress: 0,
    direction: 1, // +1 next (RTL left -> right), -1 prev (RTL right -> left)
    targetSpread: 1,
    nextRightCanvas: null,
    nextLeftCanvas: null,
  });

  const { rPage, lPage } = computeSpreadPages(spread, isSingleMode);

  // Responsive check (single page on mobile < 768px)
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      const isMobile = window.innerWidth < 768;
      setIsSingleMode(isMobile);
      isSingleModeRef.current = isMobile;
      const defaultDist = isMobile ? BOOK3D_ZOOM.defaultMobileDist : BOOK3D_ZOOM.defaultDesktopDist;
      zoomDistRef.current = defaultDist;
      targetZoomRef.current = defaultDist;
      commitZoomPercent(computeZoomPercent(defaultDist, isMobile));
      if (cameraRef.current && rendererRef.current && containerRef.current) {
        const w = containerRef.current.clientWidth || window.innerWidth;
        const h = containerRef.current.clientHeight || 460;
        const dpr = isSoftwareGlRef.current
          ? 1
          : Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2);
        rendererRef.current.setPixelRatio(dpr);
        const singleOffsetX = isMobile ? _SINGLE_CENTER_X : 0;
        if (leftWingRef.current) leftWingRef.current.visible = !isMobile;
        if (flipLeftFaceMeshRef.current) flipLeftFaceMeshRef.current.visible = !isMobile;
        if (standGroupRef.current) standGroupRef.current.position.x = singleOffsetX;
        if (dustParticlesRef.current) {
          dustParticlesRef.current.position.x = singleOffsetX;
          dustParticlesRef.current.scale.x = isMobile ? 0.52 : 1;
        }
        if (auraSpriteRef.current) auraSpriteRef.current.position.x = singleOffsetX;

        const pose = computeCameraPose({
          zoomDist: defaultDist,
          panX: currentPanRef.current.x,
          panY: currentPanRef.current.y,
          isSingleMode: isMobile,
        });
        cameraRef.current.aspect = w / h;
        cameraRef.current.position.set(pose.posX, pose.posY, pose.posZ);
        _cameraLookAtTarget.set(pose.targetX, pose.targetY, pose.targetZ);
        cameraRef.current.lookAt(_cameraLookAtTarget);
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h, false);
        requestRenderRef.current();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Safe async page loader (tracks in-flight pages without redundant React re-renders)
  const loadPage = useCallback(async (pNum) => {
    if (
      !pNum ||
      pNum < 1 ||
      pNum > _MUSHAF_PAGES ||
      pageCacheRef.current[pNum] !== undefined ||
      inFlightPagesRef.current.has(pNum)
    ) {
      return;
    }
    inFlightPagesRef.current.add(pNum);
    try {
      const data = await withErrorRecovery(() => fetchQuranPage(pNum), [], {
        code: ERROR_CODES.NETWORK_ERROR,
        message: `Chargement page ${pNum} échoué`,
        context: { pageNum: pNum },
      });
      setPageCache((c) => ({ ...c, [pNum]: data || [] }));
    } finally {
      inFlightPagesRef.current.delete(pNum);
    }
  }, []);

  // Preload active spread & immediate neighbors
  useEffect(() => {
    const targets = isSingleMode
      ? [spread, spread + 1, spread + 2, spread - 1]
      : [rPage, lPage, rPage + 2, lPage + 2, rPage - 2, lPage - 2];
    targets.filter((p) => p && p >= 1 && p <= _MUSHAF_PAGES).forEach(loadPage);
  }, [spread, isSingleMode, rPage, lPage, loadPage]);

  // Helper returning resolution tier ("lite" on mobile/software GL, "hd" on GPU desktop)
  const getResolutionTier = useCallback(() => {
    return isSoftwareGlRef.current || isSingleMode ? "lite" : "hd";
  }, [isSingleMode]);

  const rData = pageCache[rPage];
  const lData = !isSingleMode && lPage ? pageCache[lPage] : null;

  // Synchronize ONLY visible page canvases & WebGL textures (ignores background preloads)
  const updatePageTextures = useCallback(() => {
    const tier = getResolutionTier();
    const activeKey = selectedAyah ? `${selectedAyah.surahNum}:${selectedAyah.ayahNum}` : null;
    const tajweedOpts = { showQalqala, showMadd, showIzhar, showIdgham, showTajweedTone };

    const { canvas: rCanvas, boxes: rBoxes } = renderPageToCanvas(
      rData,
      rPage,
      tajweedOpts,
      activeKey,
      isSingleMode,
      tier
    );
    rightBoxesRef.current = rBoxes;
    setRightCanvas((prev) => (prev === rCanvas ? prev : rCanvas));

    if (!flipAnimRef.current.active && rCanvas && rightTexRef.current) {
      if (rightTexRef.current.image !== rCanvas) {
        rightTexRef.current.image = rCanvas;
        rightTexRef.current.needsUpdate = true;
      }
    }

    if (!isSingleMode && lPage) {
      const { canvas: lCanvas, boxes: lBoxes } = renderPageToCanvas(
        lData,
        lPage,
        tajweedOpts,
        activeKey,
        false,
        tier
      );
      leftBoxesRef.current = lBoxes;
      setLeftCanvas((prev) => (prev === lCanvas ? prev : lCanvas));
      if (!flipAnimRef.current.active && lCanvas && leftTexRef.current) {
        if (leftTexRef.current.image !== lCanvas) {
          leftTexRef.current.image = lCanvas;
          leftTexRef.current.needsUpdate = true;
        }
      }
    } else {
      leftBoxesRef.current = [];
      setLeftCanvas((prev) => (prev === null ? prev : null));
    }

    requestRenderRef.current();
  }, [
    rData,
    lData,
    rPage,
    lPage,
    selectedAyah,
    showQalqala,
    showMadd,
    showIzhar,
    showIdgham,
    showTajweedTone,
    isSingleMode,
    getResolutionTier,
  ]);

  const updatePageTexturesRef = useRef(updatePageTextures);
  updatePageTexturesRef.current = updatePageTextures;

  useEffect(() => {
    updatePageTextures();
  }, [updatePageTextures]);

  // ─── Initialize Full Three.js 3D Scene ONCE per [viewMode, webglFailed] ───
  useEffect(() => {
    if (viewMode !== "3d" || webglFailed) return;
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 920;
    const height = container.clientHeight || 600;
    const allowRetry = retryWebGLRef.current;
    retryWebGLRef.current = false;

    const acquired = acquireSafeWebGLContext({
      preferHardwareAntialias: true,
      alpha: true,
      cachedProfile: _cachedGlProfile,
      allowRetry,
      onProfileDetected: (profile) => {
        _cachedGlProfile = profile;
      },
    });

    if (acquired.status === "unavailable") {
      console.warn(
        "WebGL2 indisponible ou bloqué, bascule automatique en mode Mushaf 2D :",
        acquired.reason || "context unavailable"
      );
      setWebglFailed(true);
      setViewMode("2d");
      return;
    }

    // Renderer (reuses pre-acquired canvas/context when native WebGL2 was verified)
    let renderer;
    try {
      const rendererOpts =
        acquired.status === "ready"
          ? {
              canvas: acquired.canvas,
              context: acquired.context,
              antialias: !acquired.isSoftware,
              alpha: true,
              powerPreference: acquired.isSoftware ? "default" : "high-performance",
            }
          : {
              antialias: !isSoftwareGlRef.current,
              alpha: true,
              powerPreference: isSoftwareGlRef.current ? "default" : "high-performance",
            };
      renderer = new THREE.WebGLRenderer(rendererOpts);
      renderer.debug.checkShaderErrors = false;
    } catch (err) {
      console.warn("WebGL initialization failed, falling back to 2D view:", err);
      _cachedGlProfile = { supported: false, isSoftware: true, reason: err?.message || "init error" };
      setWebglFailed(true);
      setViewMode("2d");
      return;
    }

    const isSwGl = acquired.status === "ready" ? acquired.isSoftware : detectSoftwareWebGL(renderer);
    isSoftwareGlRef.current = isSwGl;

    renderer.setSize(width, height, false);
    renderer.setPixelRatio(
      isSwGl ? 1 : Math.min(window.devicePixelRatio || 1, isSingleModeRef.current ? 1.25 : 2)
    );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSwGl;
    if (!isSwGl) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false;
    }

    container.innerHTML = "";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Studio PBR Environment via PMREM + RoomEnvironment (zero external HDR fetch / 404)
    let envTarget = null;
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envTarget.texture;
      scene.environmentIntensity = 0.48;
      roomEnv.dispose();
      pmremGenerator.dispose();
    } catch {
      // Non-fatal if environment generation unsupported on mocked/minimal context
    }

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 60);
    const initialPose = computeCameraPose({
      zoomDist: zoomDistRef.current,
      panX: currentPanRef.current.x,
      panY: currentPanRef.current.y,
      isSingleMode: isSingleModeRef.current,
    });
    camera.position.set(initialPose.posX, initialPose.posY, initialPose.posZ);
    _cameraLookAtTarget.set(initialPose.targetX, initialPose.targetY, initialPose.targetZ);
    camera.lookAt(_cameraLookAtTarget);
    cameraRef.current = camera;

    // ── Studio Lighting ──
    const ambientLight = new THREE.AmbientLight(0xffeedb, 0.72);
    scene.add(ambientLight);

    const mainSun = new THREE.DirectionalLight(0xfff4e0, 1.35);
    mainSun.position.set(2.5, 5, 3.5);
    if (!isSwGl) {
      mainSun.castShadow = true;
      mainSun.shadow.mapSize.width = 512;
      mainSun.shadow.mapSize.height = 512;
      mainSun.shadow.bias = -0.0005;
    }
    scene.add(mainSun);

    const candleGlow = new THREE.PointLight(0xff9933, 0.9, 9);
    candleGlow.position.set(-1.5, 1.8, 1.2);
    scene.add(candleGlow);

    const rimLight = new THREE.DirectionalLight(0xc9a84c, 0.55);
    rimLight.position.set(-3, 2, -3);
    scene.add(rimLight);

    // ── Textured Glowing Spiritual Dust Particles (Small motes spawning as the 3D Quran opens) ──
    const dustCount = isSwGl ? BOOK3D_PARTICLES.softwareCount : BOOK3D_PARTICLES.hardwareCount;
    const particleField = generateParticleFieldData(dustCount);
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(particleField.positions, 3));
    dustGeo.setAttribute("aColor", new THREE.BufferAttribute(particleField.colors, 3));
    dustGeo.setAttribute("aScale", new THREE.BufferAttribute(particleField.scales, 1));
    dustGeo.setAttribute("aPhase", new THREE.BufferAttribute(particleField.phases, 1));
    dustGeo.setAttribute("aDelay", new THREE.BufferAttribute(particleField.delays, 1));
    dustGeo.setAttribute("aSpeed", new THREE.BufferAttribute(particleField.speeds, 1));

    openAnimRef.current = { progress: 0, particleTime: 0 };
    const initialOpenState = evalBook3DOpenState(0);

    const particleGlowTex = createParticleGlowTexture(64);
    const dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: particleGlowTex },
        uTime: { value: 0 },
        uParticleTime: { value: 0 },
        uEmitFactor: { value: initialOpenState.particleEmissionFactor },
        uMaxRise: { value: BOOK3D_PARTICLES.maxRise },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uBaseSize: { value: BOOK3D_PARTICLES.baseSize },
        uMaxSize: { value: BOOK3D_PARTICLES.maxSize },
        uGlowStrength: {
          value: showGlowRef.current ? BOOK3D_PARTICLES.defaultGlowStrength : 0.45,
        },
      },
      vertexShader: `
        attribute float aScale;
        attribute float aPhase;
        attribute float aDelay;
        attribute float aSpeed;
        attribute vec3 aColor;
        uniform float uTime;
        uniform float uParticleTime;
        uniform float uEmitFactor;
        uniform float uMaxRise;
        uniform float uPixelRatio;
        uniform float uBaseSize;
        uniform float uMaxSize;
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vAlpha;

        void main() {
          vColor = aColor;
          vTwinkle = 0.78 + 0.22 * sin(uTime * 2.4 + aPhase);
          float localT = uParticleTime - aDelay;
          float active = step(0.001, localT) * step(0.005, uEmitFactor);
          float life = fract(max(0.0, localT) * aSpeed * 0.52);
          float fadeEnv = smoothstep(0.0, 0.07, life) * (1.0 - smoothstep(0.76, 1.0, life));
          vAlpha = active * uEmitFactor * fadeEnv * (0.78 + 0.22 * vTwinkle);

          vec3 p = position;
          p.y += 0.14 + life * uMaxRise;
          p.x += sin(uTime * 0.65 + aPhase) * 0.14 * (0.25 + life);
          p.z += cos(uTime * 0.55 + aPhase * 1.3) * 0.14 * (0.25 + life);

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          float distScale = 5.4 / max(1.6, -mvPosition.z);
          float ptSize = max(
            3.6 * uPixelRatio,
            min(
              uMaxSize * uPixelRatio,
              uBaseSize * aScale * uPixelRatio * distScale * (0.85 + 0.15 * vTwinkle)
            )
          );
          gl_PointSize = ptSize * step(0.005, vAlpha);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uGlowStrength;
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vAlpha;

        void main() {
          if (vAlpha < 0.005) discard;
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.01) discard;
          vec3 glowColor = mix(vColor, vec3(1.0, 0.99, 0.9), tex.a * 0.52);
          float alpha = min(1.0, tex.a * vAlpha * 1.15);
          gl_FragColor = vec4(glowColor * (1.15 + uGlowStrength * 0.65) * vTwinkle, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const initSingleOffsetX = isSingleModeRef.current ? _SINGLE_CENTER_X : 0;
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    dustPoints.frustumCulled = false;
    dustPoints.renderOrder = 12;
    dustPoints.position.x = initSingleOffsetX;
    dustPoints.scale.x = isSingleModeRef.current ? 0.52 : 1;
    dustPoints.visible = showDustRef.current;
    scene.add(dustPoints);
    dustParticlesRef.current = dustPoints;

    // ── Volumetric Radial Golden Aura Sprite behind Sacred Mushaf ──
    const auraTex = createAuraGlowTexture(128);
    const auraMat = new THREE.SpriteMaterial({
      map: auraTex,
      color: 0xffd275,
      transparent: true,
      opacity: BOOK3D_PARTICLES.auraOpacity * initialOpenState.auraFactor,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const auraSprite = new THREE.Sprite(auraMat);
    auraSprite.renderOrder = 1;
    auraSprite.position.set(initSingleOffsetX, 0.12, -0.65);
    auraSprite.scale.set(5.4, 3.6, 1);
    auraSprite.visible = showGlowRef.current;
    scene.add(auraSprite);
    auraSpriteRef.current = auraSprite;

    // ── Main Book & Stand Root Group ──
    const bookGroup = new THREE.Group();
    bookGroup.rotation.set(currentRotationRef.current.x, currentRotationRef.current.y, 0);
    scene.add(bookGroup);
    bookGroupRef.current = bookGroup;

    // ── 3D Carved Wooden Rehal Stand (strict clearance below covers) ──
    const woodTex = createWoodTexture();
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x3d2010,
      map: woodTex,
      roughness: 0.58,
      metalness: 0.08,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.82,
      roughness: 0.28,
    });

    const standGroup = new THREE.Group();
    standGroup.name = "standGroup";
    standGroup.position.x = initSingleOffsetX;
    standGroup.visible = showStandRef.current;
    standGroupRef.current = standGroup;

    const { rehal } = BOOK3D_SPEC;
    const rehalPlankGeo = new THREE.BoxGeometry(rehal.plankLength, rehal.plankThickness, rehal.plankDepth);

    const rehalPlank1 = new THREE.Mesh(rehalPlankGeo, woodMat);
    rehalPlank1.position.set(0, rehal.hingeY, 0.024);
    rehalPlank1.rotation.z = -rehal.rotZ;
    rehalPlank1.receiveShadow = !isSwGl;
    standGroup.add(rehalPlank1);

    const rehalPlank2 = new THREE.Mesh(rehalPlankGeo, woodMat);
    rehalPlank2.position.set(0, rehal.hingeY, -0.024);
    rehalPlank2.rotation.z = rehal.rotZ;
    rehalPlank2.receiveShadow = !isSwGl;
    standGroup.add(rehalPlank2);

    const pivotGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.66, 12);
    const pivotMesh = new THREE.Mesh(pivotGeo, goldMat);
    pivotMesh.rotation.x = Math.PI / 2;
    pivotMesh.position.set(0, rehal.hingeY, 0);
    standGroup.add(pivotMesh);

    const footGeo = new THREE.BoxGeometry(0.14, 0.06, 1.64);
    const leftFoot = new THREE.Mesh(footGeo, goldMat);
    leftFoot.position.set(-rehal.footX, rehal.footY, 0);
    standGroup.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, goldMat);
    rightFoot.position.set(rehal.footX, rehal.footY, 0);
    standGroup.add(rightFoot);

    bookGroup.add(standGroup);

    // ── Shared Book Cover, Spine & Stack Materials ──
    const coverTex = createCoverTexture();
    const coverMat = new THREE.MeshStandardMaterial({
      map: coverTex,
      roughness: 0.38,
      metalness: 0.14,
    });
    const goldEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xc89d38,
      roughness: 0.32,
      metalness: 0.65,
    });

    const spineGeo = new THREE.CylinderGeometry(
      BOOK3D_SPEC.spineRadius,
      BOOK3D_SPEC.spineRadius,
      BOOK3D_SPEC.coverDepth,
      14,
      1
    );
    const spineMesh = new THREE.Mesh(spineGeo, coverMat);
    spineMesh.rotation.x = Math.PI / 2;
    spineMesh.position.set(0, BOOK3D_SPEC.spineY, 0);
    bookGroup.add(spineMesh);

    // ── V-Cradle Left & Right Wing Groups (zero overlap or penetration) ──
    const {
      wingOffsetX,
      wingBaseY,
      wingTilt,
      coverWidth,
      coverThickness,
      coverDepth,
      stackWidth,
      stackHeight,
      stackDepth,
    } = BOOK3D_SPEC;

    const coverBoardGeo = new THREE.BoxGeometry(coverWidth, coverThickness, coverDepth);
    const stackGeo = new THREE.BoxGeometry(stackWidth, stackHeight, stackDepth);

    const rightWing = new THREE.Group();
    rightWing.position.set(initialOpenState.wingOffsetX, wingBaseY, 0);
    rightWing.rotation.z = initialOpenState.rightWingRotZ;
    bookGroup.add(rightWing);
    rightWingRef.current = rightWing;

    const leftWing = new THREE.Group();
    leftWing.position.set(-initialOpenState.wingOffsetX, wingBaseY, 0);
    leftWing.rotation.z = initialOpenState.leftWingRotZ;
    leftWing.visible = !isSingleModeRef.current;
    bookGroup.add(leftWing);
    leftWingRef.current = leftWing;

    const rightCover = new THREE.Mesh(coverBoardGeo, coverMat);
    rightCover.position.set(coverWidth / 2, -coverThickness / 2, 0);
    rightCover.receiveShadow = !isSwGl;
    rightWing.add(rightCover);

    const leftCover = new THREE.Mesh(coverBoardGeo, coverMat);
    leftCover.position.set(-coverWidth / 2, -coverThickness / 2, 0);
    leftCover.receiveShadow = !isSwGl;
    leftWing.add(leftCover);

    const rightStack = new THREE.Mesh(stackGeo, goldEdgeMat);
    rightStack.position.set(BOOK3D_SPEC.pageInnerMarginX + stackWidth / 2, stackHeight / 2, 0);
    rightWing.add(rightStack);

    const leftStack = new THREE.Mesh(stackGeo, goldEdgeMat);
    leftStack.position.set(-(BOOK3D_SPEC.pageInnerMarginX + stackWidth / 2), stackHeight / 2, 0);
    leftWing.add(leftStack);

    // Placeholder 16x16 cream canvas so textures are valid until first renderPageToCanvas
    const dummyCvs = document.createElement("canvas");
    dummyCvs.width = 16;
    dummyCvs.height = 16;
    const dummyCtx = dummyCvs.getContext("2d", { alpha: false });
    dummyCtx.fillStyle = "#faf7ee";
    dummyCtx.fillRect(0, 0, 16, 16);

    const maxAniso = isSwGl ? 1 : Math.min(4, renderer.capabilities.getMaxAnisotropy() || 1);
    const makePageTexture = () => {
      const tex = new THREE.CanvasTexture(dummyCvs);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      return tex;
    };

    const rTex = makePageTexture();
    const lTex = makePageTexture();
    const fRightTex = makePageTexture();
    const fLeftTex = makePageTexture();

    rightTexRef.current = rTex;
    leftTexRef.current = lTex;
    flipRightTexRef.current = fRightTex;
    flipLeftTexRef.current = fLeftTex;

    const rightPageMat = new THREE.MeshStandardMaterial({
      map: rTex,
      roughness: 0.85,
      metalness: 0.03,
      side: THREE.FrontSide,
    });
    const leftPageMat = new THREE.MeshStandardMaterial({
      map: lTex,
      roughness: 0.85,
      metalness: 0.03,
      side: THREE.FrontSide,
    });

    const rightPageGeo = createStaticCurvedPageGeo("right");
    const leftPageGeo = createStaticCurvedPageGeo("left");

    const rightPageMesh = new THREE.Mesh(rightPageGeo, rightPageMat);
    rightPageMesh.name = "rightPage";
    rightPageMesh.receiveShadow = !isSwGl;
    rightWing.add(rightPageMesh);
    rightPageMeshRef.current = rightPageMesh;

    const leftPageMesh = new THREE.Mesh(leftPageGeo, leftPageMat);
    leftPageMesh.name = "leftPage";
    leftPageMesh.receiveShadow = !isSwGl;
    leftWing.add(leftPageMesh);
    leftPageMeshRef.current = leftPageMesh;

    // ── Dual-Face 3D Flipping Page Sheet (Never mirrors text, never dips into static pages) ──
    const flipPivot = new THREE.Group();
    flipPivot.name = "flipPivot";
    flipPivot.position.set(0, wingBaseY + BOOK3D_SPEC.pageBaseLocalY + BOOK3D_SPEC.flipPivotClearanceY, 0);
    flipPivot.visible = false;
    bookGroup.add(flipPivot);
    flipPivotRef.current = flipPivot;

    const flipSegW = 20;
    const flipSegH = 8;

    // Right-facing side (local normal +Y -> visible when curAngle < PI/2)
    const flipRightGeo = new THREE.PlaneGeometry(BOOK3D_SPEC.pageWidth, BOOK3D_SPEC.pageDepth, flipSegW, flipSegH);
    flipRightGeo.rotateX(-Math.PI / 2);
    flipRightGeo.translate(wingOffsetX + BOOK3D_SPEC.pageWidth / 2, 0, 0);

    // Left-facing side (local normal -Y -> rotated Y=PI before X=-PI/2 so UVs read LTR correctly when on Left!)
    const flipLeftGeo = new THREE.PlaneGeometry(BOOK3D_SPEC.pageWidth, BOOK3D_SPEC.pageDepth, flipSegW, flipSegH);
    flipLeftGeo.rotateY(Math.PI);
    flipLeftGeo.rotateX(-Math.PI / 2);
    flipLeftGeo.translate(wingOffsetX + BOOK3D_SPEC.pageWidth / 2, 0, 0);

    // Precompute normalized u [0..1] along spine -> outer tip once (zero GC per frame)
    const precomputeFlipU = (geo) => {
      const pos = geo.attributes.position;
      const uArr = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        uArr[i] = Math.max(0, Math.min(1, (pos.getX(i) - wingOffsetX) / BOOK3D_SPEC.pageWidth));
      }
      return uArr;
    };
    const flipRightU = precomputeFlipU(flipRightGeo);
    const flipLeftU = precomputeFlipU(flipLeftGeo);

    const flipRightMat = new THREE.MeshStandardMaterial({
      map: fRightTex,
      roughness: 0.85,
      metalness: 0.03,
      side: THREE.FrontSide,
    });
    const flipLeftMat = new THREE.MeshStandardMaterial({
      map: fLeftTex,
      roughness: 0.85,
      metalness: 0.03,
      side: THREE.FrontSide,
    });

    const flipRightFaceMesh = new THREE.Mesh(flipRightGeo, flipRightMat);
    flipRightFaceMesh.castShadow = !isSwGl;
    flipPivot.add(flipRightFaceMesh);
    flipRightFaceMeshRef.current = flipRightFaceMesh;

    const flipLeftFaceMesh = new THREE.Mesh(flipLeftGeo, flipLeftMat);
    flipLeftFaceMesh.castShadow = !isSwGl;
    flipLeftFaceMesh.visible = !isSingleModeRef.current;
    flipPivot.add(flipLeftFaceMesh);
    flipLeftFaceMeshRef.current = flipLeftFaceMesh;

    // ── Non-clipping Silk Ribbon Bookmark in Spine Gutter ──
    const ribbonPoints = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const rz = -0.88 + t * 1.98;
      // Gutter level cleanly below flipPivotY while staying above spine; drapes gracefully outside bottom edge
      const ry = t <= 0.85 ? -0.022 : -0.022 - Math.pow((t - 0.85) / 0.15, 2) * 0.22;
      const rx = t <= 0.85 ? 0 : Math.sin((t - 0.85) * 8) * 0.06;
      ribbonPoints.push(new THREE.Vector3(rx, ry, rz));
    }
    const ribbonCurve = new THREE.CatmullRomCurve3(ribbonPoints);
    const ribbonGeo = new THREE.TubeGeometry(ribbonCurve, 18, 0.015, 6, false);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0x8b0000,
      roughness: 0.4,
      metalness: 0.15,
    });
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    bookGroup.add(ribbonMesh);

    // Pre-compile shaders only on hardware GPU (software GL stalls during eager shader compile)
    if (!isSwGl) {
      try {
        renderer.compile(scene, camera);
      } catch {}
    }

    // ResizeObserver updates aspect & canvas smoothly
    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
            dustMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
            requestRenderRef.current();
          }
        }
      });
      resizeObserver.observe(container);
    }

    // Populate initial page textures cleanly
    updatePageTexturesRef.current();

    // ── Delta-timed & Software-WebGL-Paced Render Loop ──
    let isDisposed = false;
    let isContextLost = false;
    let shadowDirty = !isSwGl;
    let wasOpenMoving = false;
    let lastTimeMs = performance.now();
    const scheduler = createPacedRenderScheduler({
      renderer,
      isSoftwareGl: isSwGl,
      softwareCooldownMs: 48,
      isHidden: () => typeof document !== "undefined" && Boolean(document.hidden),
    });

    const handleContextLost = (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      if (isContextLost) return;
      isContextLost = true;
      scheduler.cancelAll();
      console.warn("WebGL context lost — bascule automatique vers le mode Mushaf 2D");
      _cachedGlProfile = { supported: false, isSoftware: true, reason: "webglcontextlost" };
      setWebglFailed(true);
      setViewMode("2d");
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost, false);

    // Pre-allocated scratch cache for zero-GC flip sheet vertex updates
    const flipColCache = new Map();
    const applyFlipGeometryFrame = (progress, direction) => {
      const p = Math.max(0, Math.min(1, progress));
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const rightAngle = BOOK3D_SPEC.wingTilt;
      const leftAngle = Math.PI - BOOK3D_SPEC.wingTilt;
      const startAngle = direction > 0 ? leftAngle : rightAngle;
      const endAngle = direction > 0 ? rightAngle : leftAngle;
      const curAngle = startAngle + (endAngle - startAngle) * ease;
      const basePivotY =
        BOOK3D_SPEC.wingBaseY + BOOK3D_SPEC.pageBaseLocalY + BOOK3D_SPEC.flipPivotClearanceY;
      const pivotY = basePivotY + Math.sin(p * Math.PI) * BOOK3D_SPEC.flipMidFlightLiftY;

      flipPivot.position.y = pivotY;
      flipPivot.rotation.z = curAngle;

      const cosA = Math.cos(curAngle);
      const travelTrailSign = direction > 0 ? 1 : -1;
      const sinPPi = Math.sin(p * Math.PI);

      const rPos = flipRightGeo.attributes.position;
      const lPos = flipLeftGeo.attributes.position;
      flipColCache.clear();
      const getLocalYForU = (uVal) => {
        const key = Math.round(uVal * 1000);
        const cachedY = flipColCache.get(key);
        if (cachedY !== undefined) return cachedY;
        const clampedU = Math.max(0, Math.min(1, uVal));
        const staticMatchArch =
          Math.sin(clampedU * Math.PI) * 0.044 +
          Math.sin(clampedU * Math.PI * 0.5) * 0.012 +
          0.004;
        const flightBow =
          sinPPi * Math.sin(clampedU * Math.PI * 0.7) * 0.075 * travelTrailSign;
        const y = staticMatchArch * cosA + flightBow;
        flipColCache.set(key, y);
        return y;
      };

      for (let i = 0; i < rPos.count; i++) {
        rPos.setY(i, getLocalYForU(flipRightU[i]) + 0.0006);
      }
      for (let i = 0; i < lPos.count; i++) {
        lPos.setY(i, getLocalYForU(flipLeftU[i]) - 0.0006);
      }
      rPos.needsUpdate = true;
      lPos.needsUpdate = true;
    };

    const renderFrame = (nowMs) => {
      if (isDisposed || isContextLost) return false;
      const glCtx = renderer.getContext?.();
      if (glCtx?.isContextLost?.()) {
        handleContextLost();
        return false;
      }

      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTimeMs) / 1000));
      lastTimeMs = nowMs;

      const rotDx = targetRotationRef.current.x - currentRotationRef.current.x;
      const rotDy = targetRotationRef.current.y - currentRotationRef.current.y;
      const orbitMoving = Math.abs(rotDx) > 0.0004 || Math.abs(rotDy) > 0.0004 || isDraggingRef.current;

      if (orbitMoving) {
        const blend = Math.min(1, dt * 8.5);
        currentRotationRef.current.x += rotDx * blend;
        currentRotationRef.current.y += rotDy * blend;
        bookGroup.rotation.x = currentRotationRef.current.x;
        bookGroup.rotation.y = currentRotationRef.current.y;
      }

      const zoomDiff = targetZoomRef.current - zoomDistRef.current;
      const zoomMoving = Math.abs(zoomDiff) > 0.002;
      const panDx = targetPanRef.current.x - currentPanRef.current.x;
      const panDy = targetPanRef.current.y - currentPanRef.current.y;
      const panMoving = Math.abs(panDx) > 0.0008 || Math.abs(panDy) > 0.0008;

      if (zoomMoving || panMoving) {
        const zBlend = Math.min(1, dt * 10);
        if (zoomMoving) zoomDistRef.current += zoomDiff * zBlend;
        if (panMoving) {
          currentPanRef.current.x += panDx * zBlend;
          currentPanRef.current.y += panDy * zBlend;
        }
        const pose = computeCameraPose({
          zoomDist: zoomDistRef.current,
          panX: currentPanRef.current.x,
          panY: currentPanRef.current.y,
          isSingleMode: isSingleModeRef.current,
        });
        camera.position.set(pose.posX, pose.posY, pose.posZ);
        _cameraLookAtTarget.set(pose.targetX, pose.targetY, pose.targetZ);
        camera.lookAt(_cameraLookAtTarget);
      }

      // Smooth 3D Mushaf open/close transition (particles start only as the Quran opens)
      const targetOpen = bookOpenRef.current ? 1 : 0;
      const openAnim = openAnimRef.current;
      const openDiff = targetOpen - openAnim.progress;
      const openMoving = Math.abs(openDiff) > 0.001;
      if (openMoving) {
        const step = dt / BOOK3D_PARTICLES.openDurationSec;
        openAnim.progress =
          openDiff > 0
            ? Math.min(1, openAnim.progress + step)
            : Math.max(0, openAnim.progress - step);
        wasOpenMoving = true;
      } else {
        openAnim.progress = targetOpen;
        if (wasOpenMoving) {
          wasOpenMoving = false;
          shadowDirty = !isSwGl;
        }
      }
      const openState = evalBook3DOpenState(openAnim.progress);
      rightWing.position.x = openState.wingOffsetX;
      rightWing.rotation.z = openState.rightWingRotZ;
      leftWing.position.x = -openState.wingOffsetX;
      leftWing.rotation.z = openState.leftWingRotZ;

      const isSingleNow = isSingleModeRef.current;
      const singleOffsetX = isSingleNow ? _SINGLE_CENTER_X : 0;
      if (leftWing.visible !== !isSingleNow) {
        leftWing.visible = !isSingleNow;
        shadowDirty = !isSwGl;
      }
      if (flipLeftFaceMesh.visible !== !isSingleNow) {
        flipLeftFaceMesh.visible = !isSingleNow;
      }
      standGroup.position.x = singleOffsetX;
      dustPoints.position.x = singleOffsetX;
      dustPoints.scale.x = isSingleNow ? 0.52 : 1;
      auraSprite.position.x = singleOffsetX;

      // Sync stand, dust & glow halo visibility cleanly (never gated out by software GL)
      if (standGroup.visible !== showStandRef.current) {
        standGroup.visible = showStandRef.current;
        shadowDirty = !isSwGl;
      }
      const dustActive = showDustRef.current;
      if (dustPoints.visible !== dustActive) {
        dustPoints.visible = dustActive;
      }
      const glowActive = showGlowRef.current;
      if (auraSprite.visible !== glowActive) {
        auraSprite.visible = glowActive;
      }

      // Particles only emit & advance once the 3D Quran opens; closing resets them to 0
      if (openState.particleEmissionFactor <= 0.001 && !bookOpenRef.current) {
        openAnim.particleTime = 0;
      } else if (dustActive && openState.particleEmissionFactor > 0.001) {
        openAnim.particleTime += dt;
        dustMat.uniforms.uTime.value += dt;
      }
      dustMat.uniforms.uParticleTime.value = openAnim.particleTime;
      dustMat.uniforms.uEmitFactor.value = openState.particleEmissionFactor;
      dustMat.uniforms.uGlowStrength.value = showGlowRef.current
        ? BOOK3D_PARTICLES.defaultGlowStrength
        : 0.45;

      if (glowActive) {
        auraMat.opacity = BOOK3D_PARTICLES.auraOpacity * openState.auraFactor;
        const pulse = 1 + Math.sin(dustMat.uniforms.uTime.value * 1.1) * 0.04;
        auraSprite.scale.set(5.4 * pulse, 3.6 * pulse, 1);
      }

      // Delta-timed 3D Page Flip Physics
      const fAnim = flipAnimRef.current;
      if (fAnim.active && openAnim.progress >= 0.98) {
        fAnim.progress += dt / BOOK3D_SPEC.flipDurationSec;
        const p = Math.min(1.0, fAnim.progress);

        flipPivot.visible = true;
        applyFlipGeometryFrame(p, fAnim.direction);
        shadowDirty = !isSwGl;

        if (p >= 1.0) {
          fAnim.active = false;
          flipPivot.visible = false;

          // Promote landed face texture to static page underneath cleanly before React spread state commits
          if (fAnim.direction > 0 && fAnim.nextRightCanvas && rightTexRef.current) {
            if (rightTexRef.current.image !== fAnim.nextRightCanvas) {
              rightTexRef.current.image = fAnim.nextRightCanvas;
              rightTexRef.current.needsUpdate = true;
            }
          } else if (
            fAnim.direction < 0 &&
            !isSingleNow &&
            fAnim.nextLeftCanvas &&
            leftTexRef.current
          ) {
            if (leftTexRef.current.image !== fAnim.nextLeftCanvas) {
              leftTexRef.current.image = fAnim.nextLeftCanvas;
              leftTexRef.current.needsUpdate = true;
            }
          } else if (fAnim.direction < 0 && isSingleNow && fAnim.nextRightCanvas && rightTexRef.current) {
            if (rightTexRef.current.image !== fAnim.nextRightCanvas) {
              rightTexRef.current.image = fAnim.nextRightCanvas;
              rightTexRef.current.needsUpdate = true;
            }
          }
          setSpread(fAnim.targetSpread);
        }
      }

      if (!isSwGl && shadowDirty) {
        renderer.shadowMap.needsUpdate = true;
        shadowDirty = false;
      }

      try {
        renderer.render(scene, camera);
      } catch (renderErr) {
        console.warn("Render loop error:", renderErr);
        handleContextLost();
        return false;
      }

      // Continue ticking while opening, flipping, orbiting, zooming, panning, or dust active on GPU
      const emittingParticles = dustActive && openState.particleEmissionFactor > 0.001;
      return (
        openMoving ||
        fAnim.active ||
        orbitMoving ||
        zoomMoving ||
        panMoving ||
        emittingParticles ||
        (glowActive && openState.auraFactor > 0.001)
      );
    };

    const scheduleFrame = () => {
      if (isDisposed || isContextLost) return;
      if (!scheduler.hasPendingWork()) {
        lastTimeMs = performance.now();
      }
      scheduler.schedule(renderFrame);
    };
    requestRenderRef.current = scheduleFrame;

    const onVisibilityChange = () => {
      if (!document.hidden && !isDisposed && !isContextLost) {
        scheduleFrame();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange, false);

    // Non-passive wheel zoom over WebGL canvas so scroll zooms the Mushaf smoothly
    const onWheel = (e) => {
      e.preventDefault();
      const nextZ = computeWheelZoomDist(targetZoomRef.current, e.deltaY);
      targetZoomRef.current = nextZ;
      commitZoomPercent(computeZoomPercent(nextZ, isSingleModeRef.current));
      scheduleFrame();
    };
    container.addEventListener("wheel", onWheel, { passive: false });

    // Draw initial frame cleanly
    scheduleFrame();

    return () => {
      isDisposed = true;
      requestRenderRef.current = () => {};
      scheduler.dispose();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (resizeObserver) resizeObserver.disconnect();
      container.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);

      // Explicit GPU disposal
      dustGeo.dispose();
      dustMat.dispose();
      particleGlowTex?.dispose();
      auraMat.dispose();
      auraTex?.dispose();
      rehalPlankGeo.dispose();
      pivotGeo.dispose();
      footGeo.dispose();
      woodMat.dispose();
      woodTex?.dispose();
      goldMat.dispose();
      spineGeo.dispose();
      coverBoardGeo.dispose();
      stackGeo.dispose();
      coverMat.dispose();
      coverTex?.dispose();
      goldEdgeMat.dispose();
      rightPageGeo.dispose();
      leftPageGeo.dispose();
      rightPageMat.dispose();
      leftPageMat.dispose();
      rTex.dispose();
      lTex.dispose();
      fRightTex.dispose();
      fLeftTex.dispose();
      flipRightGeo.dispose();
      flipLeftGeo.dispose();
      flipRightMat.dispose();
      flipLeftMat.dispose();
      ribbonGeo.dispose();
      ribbonMat.dispose();
      envTarget?.dispose();
      renderer.dispose();
      if (renderer.domElement?.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, [viewMode, webglFailed]);

  // Toggle Stand, Dust & Glow visibility & wake render loop
  useEffect(() => {
    showStandRef.current = showStand;
    if (standGroupRef.current) {
      standGroupRef.current.visible = showStand;
      standGroupRef.current.traverse((child) => {
        child.visible = showStand;
      });
    }
    requestRenderRef.current();
  }, [showStand]);

  useEffect(() => {
    showDustRef.current = showDust;
    if (dustParticlesRef.current) {
      dustParticlesRef.current.visible = showDust;
    }
    requestRenderRef.current();
  }, [showDust]);

  useEffect(() => {
    showGlowRef.current = showGlow;
    if (auraSpriteRef.current) {
      auraSpriteRef.current.visible = showGlow;
    }
    requestRenderRef.current();
  }, [showGlow]);

  useEffect(() => {
    bookOpenRef.current = bookOpen;
    if (bookOpen && openAnimRef.current.progress <= 0.18) {
      openAnimRef.current.particleTime = 0;
    }
    requestRenderRef.current();
  }, [bookOpen]);

  // ── 3D & 2D Page Turns (RTL Arabic: Next lifts Left -> Right; Prev lifts Right -> Left) ──
  const turnNext = useCallback(() => {
    const maxSp = isSingleMode ? _MUSHAF_PAGES : MUSHAF_DOUBLE_SPREADS;
    if (spread >= maxSp) return;

    if (viewMode === "2d" || webglFailed) {
      setSpread((s) => Math.min(maxSp, s + 1));
      return;
    }

    if (flipAnimRef.current.active) return;

    const targetSpread = spread + 1;
    const { rPage: nextRPage, lPage: nextLPage } = computeSpreadPages(targetSpread, isSingleMode);
    const tier = getResolutionTier();
    const tajOpts = { showQalqala, showMadd, showIzhar, showIdgham, showTajweedTone };

    // Ensure next spread pages are fetched if missing
    loadPage(nextRPage);
    if (nextLPage) loadPage(nextLPage);

    const { canvas: nextRCanvas } = renderPageToCanvas(
      pageCacheRef.current[nextRPage],
      nextRPage,
      tajOpts,
      null,
      isSingleMode,
      tier
    );
    const nextLCanvas = isSingleMode
      ? null
      : renderPageToCanvas(pageCacheRef.current[nextLPage], nextLPage, tajOpts, null, false, tier).canvas;

    if (!isSingleMode) {
      const outgoingLeft = leftCanvas;
      if (flipLeftTexRef.current && outgoingLeft) {
        flipLeftTexRef.current.image = outgoingLeft;
        flipLeftTexRef.current.needsUpdate = true;
      }
      if (leftTexRef.current && nextLCanvas) {
        leftTexRef.current.image = nextLCanvas;
        leftTexRef.current.needsUpdate = true;
      }
    }
    if (flipLeftFaceMeshRef.current) {
      flipLeftFaceMeshRef.current.visible = !isSingleMode;
    }
    // Right-facing back of turning sheet reveals incoming next right page
    if (flipRightTexRef.current && nextRCanvas) {
      flipRightTexRef.current.image = nextRCanvas;
      flipRightTexRef.current.needsUpdate = true;
    }

    flipAnimRef.current = {
      active: true,
      progress: 0,
      direction: 1,
      targetSpread,
      nextRightCanvas: nextRCanvas,
      nextLeftCanvas: nextLCanvas,
    };
    requestRenderRef.current();
  }, [
    spread,
    isSingleMode,
    viewMode,
    webglFailed,
    leftCanvas,
    loadPage,
    getResolutionTier,
    showQalqala,
    showMadd,
    showIzhar,
    showIdgham,
    showTajweedTone,
  ]);

  const turnPrev = useCallback(() => {
    if (spread <= 1) return;
    pendingAutoPlayRef.current = null;

    if (viewMode === "2d" || webglFailed) {
      setSpread((s) => Math.max(1, s - 1));
      return;
    }

    if (flipAnimRef.current.active) return;

    const targetSpread = spread - 1;
    const { rPage: prevRPage, lPage: prevLPage } = computeSpreadPages(targetSpread, isSingleMode);
    const tier = getResolutionTier();
    const tajOpts = { showQalqala, showMadd, showIzhar, showIdgham, showTajweedTone };

    loadPage(prevRPage);
    if (prevLPage) loadPage(prevLPage);

    const { canvas: prevRCanvas } = renderPageToCanvas(
      pageCacheRef.current[prevRPage],
      prevRPage,
      tajOpts,
      null,
      isSingleMode,
      tier
    );
    const prevLCanvas = isSingleMode
      ? null
      : renderPageToCanvas(pageCacheRef.current[prevLPage], prevLPage, tajOpts, null, false, tier).canvas;

    // Outgoing Right side shows current Right canvas
    if (flipRightTexRef.current && rightCanvas) {
      flipRightTexRef.current.image = rightCanvas;
      flipRightTexRef.current.needsUpdate = true;
    }
    if (!isSingleMode) {
      // Left-facing back of turning sheet reveals incoming previous left page
      if (flipLeftTexRef.current && prevLCanvas) {
        flipLeftTexRef.current.image = prevLCanvas;
        flipLeftTexRef.current.needsUpdate = true;
      }
    }
    if (flipLeftFaceMeshRef.current) {
      flipLeftFaceMeshRef.current.visible = !isSingleMode;
    }
    // Reveal incoming previous right page underneath on Right static wing
    if (rightTexRef.current && prevRCanvas) {
      rightTexRef.current.image = prevRCanvas;
      rightTexRef.current.needsUpdate = true;
    }

    flipAnimRef.current = {
      active: true,
      progress: 0,
      direction: -1,
      targetSpread,
      nextRightCanvas: prevRCanvas,
      nextLeftCanvas: prevLCanvas,
    };
    requestRenderRef.current();
  }, [
    spread,
    isSingleMode,
    viewMode,
    webglFailed,
    rightCanvas,
    loadPage,
    getResolutionTier,
    showQalqala,
    showMadd,
    showIzhar,
    showIdgham,
    showTajweedTone,
  ]);

  const jumpToPage = useCallback(
    (targetPage) => {
      pendingAutoPlayRef.current = null;
      const p = Math.max(1, Math.min(_MUSHAF_PAGES, parseInt(targetPage, 10) || 1));
      const targetSp = isSingleMode ? p : Math.floor((p - 1) / 2) + 1;
      setSpread(targetSp);
    },
    [isSingleMode]
  );

  const jumpToSurah = useCallback(
    async (sNum) => {
      setShowSurahDrawer(false);
      const meta = await withErrorRecovery(() => fetchPageMeta(sNum), null, {
        code: ERROR_CODES.NETWORK_ERROR,
        context: { surahNum: sNum },
      });
      jumpToPage(meta?.page || 1);
    },
    [jumpToPage]
  );

  // ── Zoom Helpers (3D camera + 2D scale) ──
  const handleZoomStep = useCallback(
    (direction) => {
      if (viewMode === "3d" && !webglFailed) {
        const nextZ = step3DZoomDist(targetZoomRef.current, direction);
        targetZoomRef.current = nextZ;
        commitZoomPercent(computeZoomPercent(nextZ, isSingleModeRef.current));
        requestRenderRef.current();
      } else {
        setZoom2dScale((s) => {
          const nextScale = clamp2DZoomScale(s + (direction < 0 ? 0.15 : -0.15));
          commitZoomPercent(Math.round(nextScale * 100));
          return nextScale;
        });
      }
    },
    [viewMode, webglFailed, commitZoomPercent]
  );

  // ── Camera Pan Helpers (3D & 2D translation) ──
  const handlePanStep = useCallback(
    (dirX, dirY) => {
      if (viewMode === "3d" && !webglFailed) {
        targetPanRef.current = stepCameraPan(targetPanRef.current, dirX, dirY);
        requestRenderRef.current();
      } else {
        setPan2d((p) =>
          clamp2DPan({
            x: p.x - (Number(dirX) || 0) * BOOK3D_PAN.step2D,
            y: p.y + (Number(dirY) || 0) * BOOK3D_PAN.step2D,
          })
        );
      }
    },
    [viewMode, webglFailed]
  );

  // ── 3D Orbit Drag, Camera Translation (Pan), Two-Finger Pinch/Pan & Raycast Ayah Selection ──
  const handlePointerDown = (e) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 2) {
      const [p1, p2] = Array.from(activePointersRef.current.values());
      const metrics = computeTwoFingerMetrics(p1, p2);
      pinchStateRef.current = {
        active: true,
        startTouchDist: metrics.dist,
        startZoomDist: targetZoomRef.current,
        prevMidX: metrics.midX,
        prevMidY: metrics.midY,
      };
      isDraggingRef.current = false;
      panDragActiveRef.current = false;
      dragDistRef.current = 100;
      return;
    }
    pinchStateRef.current.active = false;
    isDraggingRef.current = true;
    panDragActiveRef.current =
      interactionModeRef.current === "pan" ||
      e.button === 2 ||
      e.button === 1 ||
      (e.buttons & 2) !== 0 ||
      (e.buttons & 4) !== 0 ||
      Boolean(e.shiftKey || e.altKey);
    dragDistRef.current = 0;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    requestRenderRef.current();
  };

  const handlePointerMove = (e) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (activePointersRef.current.size === 2 && pinchStateRef.current.active) {
      const [p1, p2] = Array.from(activePointersRef.current.values());
      const metrics = computeTwoFingerMetrics(p1, p2);
      const nextZ = computePinchZoomDist(
        pinchStateRef.current.startZoomDist,
        pinchStateRef.current.startTouchDist,
        metrics.dist
      );
      targetZoomRef.current = nextZ;
      commitZoomPercent(computeZoomPercent(nextZ, isSingleModeRef.current));

      // Simultaneous two-finger parallel camera translation
      const midDx = metrics.midX - pinchStateRef.current.prevMidX;
      const midDy = metrics.midY - pinchStateRef.current.prevMidY;
      pinchStateRef.current.prevMidX = metrics.midX;
      pinchStateRef.current.prevMidY = metrics.midY;
      if (Math.abs(midDx) > 0.2 || Math.abs(midDy) > 0.2) {
        const panDelta = computePanDeltaFromDrag(
          midDx,
          midDy,
          targetZoomRef.current,
          isSingleModeRef.current
        );
        targetPanRef.current = clampCameraPan({
          x: targetPanRef.current.x + panDelta.dx,
          y: targetPanRef.current.y + panDelta.dy,
        });
      }

      dragDistRef.current = 100;
      requestRenderRef.current();
      return;
    }

    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMousePosRef.current.x;
    const dy = e.clientY - prevMousePosRef.current.y;
    dragDistRef.current += Math.abs(dx) + Math.abs(dy);
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };

    const isPanningNow =
      panDragActiveRef.current ||
      interactionModeRef.current === "pan" ||
      (e.buttons & 2) !== 0 ||
      (e.buttons & 4) !== 0 ||
      Boolean(e.shiftKey || e.altKey);

    if (isPanningNow) {
      const panDelta = computePanDeltaFromDrag(
        dx,
        dy,
        targetZoomRef.current,
        isSingleModeRef.current
      );
      targetPanRef.current = clampCameraPan({
        x: targetPanRef.current.x + panDelta.dx,
        y: targetPanRef.current.y + panDelta.dy,
      });
    } else {
      targetRotationRef.current.y += dx * 0.005;
      targetRotationRef.current.x += dy * 0.005;
      targetRotationRef.current.x = Math.max(0.05, Math.min(0.75, targetRotationRef.current.x));
      targetRotationRef.current.y = Math.max(-0.6, Math.min(0.6, targetRotationRef.current.y));
    }
    requestRenderRef.current();
  };

  const handlePointerUp = (e) => {
    if (e?.pointerId !== undefined) {
      activePointersRef.current.delete(e.pointerId);
    } else {
      activePointersRef.current.clear();
    }
    if (activePointersRef.current.size < 2) {
      pinchStateRef.current.active = false;
    }
    if (activePointersRef.current.size === 0) {
      isDraggingRef.current = false;
      panDragActiveRef.current = false;
    }
  };

  const selectAyahWithTranslation = useCallback(
    (ayahMeta) => {
      if (!ayahMeta) return;
      setSelectedAyah(ayahMeta);
      const reqId = ++translationReqIdRef.current;
      fetchSurahTranslation(ayahMeta.surahNum, transLang).then((list) => {
        if (translationReqIdRef.current !== reqId) return;
        const item = (list || []).find((t) => t.numberInSurah === ayahMeta.ayahNum);
        setAyahTranslation(item?.text || "Traduction indisponible.");
      });
    },
    [transLang]
  );

  const handleClickOnCanvas = (e) => {
    // Ignore drags or pinch gestures so orbiting/zooming/panning never accidentally triggers verse sheet
    if (dragDistRef.current > 8) return;
    if (!bookOpenRef.current) {
      setBookOpen(true);
      return;
    }
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    _pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    _raycaster.setFromCamera(_pointerNdc, cameraRef.current);

    const intersects = _raycaster.intersectObjects(
      [
        rightPageMeshRef.current,
        !isSingleModeRef.current ? leftPageMeshRef.current : null,
      ].filter(Boolean),
      false
    );

    if (intersects.length > 0) {
      const hit = intersects[0];
      const uv = hit.uv;
      const isRight = hit.object.name === "rightPage";
      const boxes = isRight ? rightBoxesRef.current : leftBoxesRef.current;

      if (uv && boxes && boxes.length) {
        const matched = boxes.find(
          (b) => uv.x >= b.uMin && uv.x <= b.uMax && uv.y >= b.vMin && uv.y <= b.vMax
        );
        if (matched) {
          selectAyahWithTranslation(matched);
        }
      }
    }
  };

  const reset3DView = () => {
    const defaultDist = isSingleModeRef.current
      ? BOOK3D_ZOOM.defaultMobileDist
      : BOOK3D_ZOOM.defaultDesktopDist;
    targetRotationRef.current = { x: 0.35, y: 0.0 };
    targetPanRef.current = { x: 0, y: 0 };
    currentPanRef.current = { x: 0, y: 0 };
    targetZoomRef.current = defaultDist;
    zoomDistRef.current = defaultDist;
    setPan2d({ x: 0, y: 0 });
    setZoom2dScale(BOOK3D_ZOOM.default2DScale);
    commitZoomPercent(100);
    if (cameraRef.current) {
      const pose = computeCameraPose({
        zoomDist: defaultDist,
        panX: 0,
        panY: 0,
        isSingleMode: isSingleModeRef.current,
      });
      cameraRef.current.position.set(pose.posX, pose.posY, pose.posZ);
      _cameraLookAtTarget.set(pose.targetX, pose.targetY, pose.targetZ);
      cameraRef.current.lookAt(_cameraLookAtTarget);
    }
    requestRenderRef.current();
  };

  const handle2DCanvasClick = (e, isRight) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const u = (e.clientX - rect.left) / rect.width;
    const v = (e.clientY - rect.top) / rect.height;
    const v3d = 1.0 - v;
    const boxes = isRight ? rightBoxesRef.current : leftBoxesRef.current;

    if (boxes && boxes.length) {
      const matched = boxes.find(
        (b) => u >= b.uMin && u <= b.uMax && v3d >= b.vMin && v3d <= b.vMax
      );
      if (matched) {
        selectAyahWithTranslation(matched);
      }
    }
  };

  const togglePlayRef = useRef(() => {});

  // ── Keyboard Shortcuts (Arrows turn pages, Alt+Arrows or WASD translate camera) ──
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.altKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          handlePanStep(-1, 0);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          handlePanStep(1, 0);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          handlePanStep(0, 1);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          handlePanStep(0, -1);
          return;
        }
      }
      const lower = String(e.key || "").toLowerCase();
      if (lower === "q" || lower === "a") handlePanStep(-1, 0);
      if (lower === "d") handlePanStep(1, 0);
      if (lower === "z" || lower === "w") handlePanStep(0, 1);
      if (lower === "s") handlePanStep(0, -1);

      if (e.key === "ArrowLeft") turnNext();
      if (e.key === "ArrowRight") turnPrev();
      if (e.key === "+" || e.key === "=") handleZoomStep(-1);
      if (e.key === "-") handleZoomStep(1);
      if (e.key === "Escape") {
        setSelectedAyah(null);
        setShowSurahDrawer(false);
        setShowTajweedDrawer(false);
        setShowViewSettings(false);
      }
      if (e.key === " ") {
        e.preventDefault();
        togglePlayRef.current();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [turnNext, turnPrev, handleZoomStep, handlePanStep]);

  // ── Audio Handling (Synced selectedAyah + continuous RTL spread -> next spread playback) ──
  const handlePlayAyah = useCallback(
    (surahNum, ayahNum, explicitAyahMeta = null) => {
      const reciterObj = GLOBAL_RECITERS.find((r) => r.key === reciterKey) || GLOBAL_RECITERS[0];
      const sPadded = String(surahNum).padStart(3, "0");
      const aPadded = String(ayahNum).padStart(3, "0");
      const audioUrl = `${reciterObj.url}/${sPadded}${aPadded}.mp3`;

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.playbackRate = audioSpeed;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
        setCurrentAudioAyah({ surahNum, ayahNum });
      }

      const resolvedMeta =
        (explicitAyahMeta && explicitAyahMeta.surahName && explicitAyahMeta.text
          ? explicitAyahMeta
          : null) ||
        findAyahMetadataOnSpread({
          surahNum,
          ayahNum,
          rPage,
          lPage,
          isSingleMode,
          pageCache: pageCacheRef.current,
          boxesRight: rightBoxesRef.current,
          boxesLeft: leftBoxesRef.current,
        }) ||
        explicitAyahMeta;

      if (resolvedMeta) {
        selectAyahWithTranslation(resolvedMeta);
      }
    },
    [reciterKey, audioSpeed, rPage, lPage, isSingleMode, selectAyahWithTranslation]
  );

  // Resume pending continuous playback seamlessly once the flipped spread lands & page loads
  useEffect(() => {
    const pending = pendingAutoPlayRef.current;
    if (!pending) return;
    if (spread !== pending.expectedSpread || flipAnimRef.current.active) return;

    const firstPageList = pageCache[rPage];
    if (Array.isArray(firstPageList) && firstPageList.length > 0) {
      pendingAutoPlayRef.current = null;
      const firstAyah = firstPageList[0];
      handlePlayAyah(firstAyah.surah.number, firstAyah.numberInSurah, {
        key: `${firstAyah.surah.number}:${firstAyah.numberInSurah}`,
        surahNum: firstAyah.surah.number,
        ayahNum: firstAyah.numberInSurah,
        surahName: firstAyah.surah?.name || "",
        surahEng: firstAyah.surah?.englishName || "",
        text: firstAyah.text || "",
      });
    }
  }, [spread, pageCache, rPage, handlePlayAyah]);

  const togglePlayCurrentPage = () => {
    if (isPlaying) {
      pendingAutoPlayRef.current = null;
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const target =
        selectedAyah &&
        findAyahMetadataOnSpread({
          surahNum: selectedAyah.surahNum,
          ayahNum: selectedAyah.ayahNum,
          rPage,
          lPage,
          isSingleMode,
          pageCache: pageCacheRef.current,
        })
          ? selectedAyah
          : null;

      if (target) {
        handlePlayAyah(target.surahNum, target.ayahNum, target);
        return;
      }

      const ayahs = pageCache[rPage];
      if (ayahs && ayahs.length) {
        handlePlayAyah(ayahs[0].surah.number, ayahs[0].numberInSurah);
      }
    }
  };
  togglePlayRef.current = togglePlayCurrentPage;

  const handleAudioEnded = () => {
    if (!currentAudioAyah) return;
    const step = resolveSpreadPlaybackStep({
      currentAudioAyah,
      rPage,
      lPage,
      isSingleMode,
      pageCache: pageCacheRef.current,
      totalPages: _MUSHAF_PAGES,
    });

    if (step.action === "play_ayah" && step.nextAyah) {
      handlePlayAyah(step.nextAyah.surahNum, step.nextAyah.ayahNum, step.nextAyah);
      return;
    }

    if (step.action === "turn_next_and_play" && step.needsTurnNext) {
      pendingAutoPlayRef.current = {
        expectedSpread: spread + 1,
        expectedPage: step.targetNextPage,
      };
      turnNext();
      return;
    }

    pendingAutoPlayRef.current = null;
    setIsPlaying(false);
  };

  // ── Bookmark ──
  const toggleBookmark = () => {
    const cur = rPage;
    if (bookmark === cur) {
      setBookmark(null);
      localStorage.removeItem("quran_bm_page");
    } else {
      setBookmark(cur);
      localStorage.setItem("quran_bm_page", String(cur));
    }
  };

  // ── Learning Status ──
  const lkey = selectedAyah ? `${selectedAyah.surahNum}:${selectedAyah.ayahNum}` : "";
  const currentLData = learnData[lkey] || {};
  const isLearned = currentLData.learned === true;
  const isRevise = currentLData.toRevise === true;

  const handleToggleLearned = () => {
    if (!selectedAyah) return;
    const nextVal = !isLearned;
    if (propSetLData) {
      propSetLData(selectedAyah.surahNum, selectedAyah.ayahNum, (prev) => ({
        ...prev,
        learned: nextVal,
        toRevise: false,
      }));
    } else {
      dispatch(
        learnActions.setLearnEntry({
          key: lkey,
          value: { learned: nextVal, toRevise: false },
        })
      );
    }
  };

  const handleToggleRevise = () => {
    if (!selectedAyah) return;
    const nextVal = !isRevise;
    if (propSetLData) {
      propSetLData(selectedAyah.surahNum, selectedAyah.ayahNum, (prev) => ({
        ...prev,
        toRevise: nextVal,
        learned: false,
      }));
    } else {
      dispatch(
        learnActions.setLearnEntry({
          key: lkey,
          value: { toRevise: nextVal, learned: false },
        })
      );
    }
  };

  const activeTajweedCount = [
    showQalqala,
    showMadd,
    showIzhar,
    showIdgham,
    showTajweedTone,
  ].filter(Boolean).length;

  return (
    <div
      data-testid="q3d-root"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        background: "radial-gradient(circle at center, #180e05 0%, #080402 100%)",
        color: "#ebd8b0",
        fontFamily: "'Amiri Quran', serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isSingleMode ? "4px" : "10px 12px 14px",
        boxSizing: "border-box",
        position: "relative",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      <audio data-testid="q3d-audio-el" ref={audioRef} onEnded={handleAudioEnded} />

      {/* ── Top Header Navigation Bar ───────────────────────────────── */}
      <header
        style={{
          width: "100%",
          maxWidth: 1080,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: isSingleMode ? 3 : 8,
          padding: isSingleMode ? "4px 6px" : "8px 14px",
          background: "rgba(18, 10, 4, 0.95)",
          border: "1px solid rgba(212, 175, 55, 0.35)",
          borderRadius: isSingleMode ? 8 : 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          boxSizing: "border-box",
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: isSingleMode ? 5 : 8 }}>
          <button
            data-testid="q3d-back-btn"
            onClick={() => {
              const step = resolveBook3DStepDownNavigation({
                uxMode,
                selectedAyah,
                lastAyatBySurah,
              });
              dispatch(uiActions.setQuranReadingTier(step.nextTier));
              dispatch(uiActions.setFullScreenSelectedAyat(step.enableFullscreen));
              dispatch(uiActions.setActivePage("quran"));
              navigate(step.targetRoute);
            }}
            title={
              isSimplifiedPriority
                ? "Passer au mode Plein Écran du verset (Priorité 2)"
                : "Revenir à la liste des sourates"
            }
            style={{
              background: "rgba(212, 175, 55, 0.12)",
              border: "1px solid rgba(212, 175, 55, 0.4)",
              color: "#d4af37",
              borderRadius: 8,
              padding: isSingleMode ? "4px 8px" : "6px 12px",
              cursor: "pointer",
              fontSize: isSingleMode ? 10 : 12,
              fontFamily: "'Cinzel', serif",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>{isSimplifiedPriority ? "⛶" : "←"}</span>
            <span>{isSimplifiedPriority ? "PLEIN ÉCRAN" : "SOURATES"}</span>
          </button>

          <EditableUiSlot elementId="quran3dIndexBtn" inline={true}>
            <button
              data-testid="q3d-index-btn"
              onClick={() => setShowSurahDrawer(true)}
              style={{
                background: "linear-gradient(135deg, rgba(212,175,55,0.22) 0%, rgba(138,107,35,0.22) 100%)",
                border: "1px solid rgba(212, 175, 55, 0.6)",
                color: "#ebd8b0",
                borderRadius: 8,
                padding: isSingleMode ? "4px 8px" : "6px 14px",
                cursor: "pointer",
                fontSize: isSingleMode ? 10.5 : 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>📖</span>
              <span>{isSingleMode ? "INDEX" : "INDEX DU MUSHAF"}</span>
            </button>
          </EditableUiSlot>
        </div>

        {/* Page / Juz Information */}
        <EditableUiSlot elementId="quran3dPageInfo" inline={true}>
          <div data-testid="q3d-page-info" style={{ display: "flex", alignItems: "center", gap: isSingleMode ? 6 : 10 }}>
            <span style={{ fontSize: isSingleMode ? 11 : 13, fontFamily: "'Cinzel', serif", color: "#d4af37", letterSpacing: 0.5 }}>
              {isSingleMode ? `P.${rPage}/604` : `PAGES ${rPage}–${lPage} / 604`}
            </span>

            <button
              onClick={toggleBookmark}
              title={bookmark === rPage ? "Retirer marque-page" : "Poser marque-page"}
              style={{
                background: bookmark === rPage ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${bookmark === rPage ? "#ffd700" : "rgba(255,255,255,0.15)"}`,
                color: bookmark === rPage ? "#ffd700" : "#a89060",
                borderRadius: 8,
                padding: isSingleMode ? "4px 7px" : "6px 10px",
                cursor: "pointer",
                fontSize: isSingleMode ? 12 : 14,
              }}
            >
              🔖
            </button>
          </div>
        </EditableUiSlot>

        {/* Tajweed, 3D & Modular UI Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: isSingleMode ? 4 : 6, flexWrap: "wrap" }}>
          <EditableUiSlot elementId="quran3dViewModeBtn" inline={true}>
            <button
              data-testid="q3d-view-toggle"
              onClick={() => {
                if (webglFailed || viewMode === "2d") {
                  retryWebGLRef.current = true;
                  setWebglFailed(false);
                  setViewMode("3d");
                } else {
                  setViewMode("2d");
                }
              }}
              style={{
                background: viewMode === "3d" && !webglFailed ? "rgba(212,175,55,0.25)" : "rgba(56,189,248,0.2)",
                border: `1px solid ${viewMode === "3d" && !webglFailed ? "#d4af37" : "#38bdf8"}`,
                color: viewMode === "3d" && !webglFailed ? "#ffd700" : "#38bdf8",
                borderRadius: 8,
                padding: isSingleMode ? "4px 8px" : "6px 12px",
                cursor: "pointer",
                fontSize: isSingleMode ? 10 : 12,
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              title={
                viewMode === "3d" && !webglFailed
                  ? "Passer en vue 2D directe"
                  : "Passer en vue 3D interactive"
              }
            >
              <span>{viewMode === "3d" && !webglFailed ? "🧊 MODE 3D" : "📖 MODE 2D"}</span>
            </button>
          </EditableUiSlot>

          <EditableUiSlot elementId="quran3dTajweedBtn" inline={true}>
            <button
              data-testid="q3d-tajweed-btn"
              onClick={() => setShowTajweedDrawer((v) => !v)}
              style={{
                background: activeTajweedCount > 0 ? "rgba(6,182,212,0.25)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${activeTajweedCount > 0 ? "#06b6d4" : "rgba(255,255,255,0.15)"}`,
                color: activeTajweedCount > 0 ? "#22d3ee" : "#a89060",
                borderRadius: 8,
                padding: isSingleMode ? "4px 8px" : "6px 12px",
                cursor: "pointer",
                fontSize: isSingleMode ? 10 : 12,
                fontFamily: "'Cinzel', serif",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>🎨</span>
              <span>TAJWEED</span>
              {activeTajweedCount > 0 && <span>({activeTajweedCount})</span>}
            </button>
          </EditableUiSlot>

          {/* Zoom Controls (3D camera & 2D magnification) */}
          <EditableUiSlot elementId="quran3dZoomControls" inline={true}>
            <div
              data-testid="q3d-zoom-controls"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(212,175,55,0.28)",
                borderRadius: 8,
                padding: isSingleMode ? "1px 3px" : "2px 4px",
              }}
            >
              <button
                data-testid="q3d-zoom-out"
                onClick={() => handleZoomStep(1)}
                title="Dézoomer (-)"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#d4af37",
                  cursor: "pointer",
                  fontSize: isSingleMode ? 12 : 14,
                  fontWeight: 800,
                  padding: isSingleMode ? "2px 5px" : "3px 7px",
                }}
              >
                −
              </button>
              <span
                data-testid="q3d-zoom-badge"
                style={{
                  fontSize: isSingleMode ? 10 : 11,
                  fontFamily: "'Cinzel', serif",
                  color: "#ebd8b0",
                  minWidth: isSingleMode ? 32 : 38,
                  textAlign: "center",
                }}
              >
                {zoomPercent}%
              </span>
              <button
                data-testid="q3d-zoom-in"
                onClick={() => handleZoomStep(-1)}
                title="Zoomer (+)"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#d4af37",
                  cursor: "pointer",
                  fontSize: isSingleMode ? 12 : 14,
                  fontWeight: 800,
                  padding: isSingleMode ? "2px 5px" : "3px 7px",
                }}
              >
                +
              </button>
            </div>
          </EditableUiSlot>

          <EditableUiSlot
            elementId="quran3dSceneControls"
            condition={viewMode === "3d" && !webglFailed}
            inline={true}
          >
            <div data-testid="q3d-scene-controls" style={{ display: "flex", alignItems: "center", gap: isSingleMode ? 4 : 6, flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="q3d-pan-toggle"
                aria-pressed={interactionMode === "pan"}
                onClick={() => setInteractionMode((m) => (m === "orbit" ? "pan" : "orbit"))}
                title="Basculer entre Rotation Orbite et Translation de Caméra"
                style={{
                  background: interactionMode === "pan" ? "rgba(56,189,248,0.22)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${interactionMode === "pan" ? "#38bdf8" : "rgba(255,255,255,0.15)"}`,
                  color: interactionMode === "pan" ? "#7dd3fc" : "#a89060",
                  borderRadius: 8,
                  padding: isSingleMode ? "4px 7px" : "6px 10px",
                  cursor: "pointer",
                  fontSize: isSingleMode ? 10 : 11,
                  fontWeight: 700,
                  fontFamily: "'Cinzel', serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>{interactionMode === "pan" ? "✋" : "🔄"}</span>
                <span>{interactionMode === "pan" ? "CAMÉRA" : "ORBITE"}</span>
              </button>

              <button
                onClick={() => setShowStand((s) => !s)}
                title={showStand ? "Masquer le support en bois" : "Afficher le support en bois"}
                style={{
                  background: showStand ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${showStand ? "#d4af37" : "rgba(255,255,255,0.15)"}`,
                  color: showStand ? "#ffd700" : "#a89060",
                  borderRadius: 8,
                  padding: isSingleMode ? "4px 7px" : "6px 10px",
                  cursor: "pointer",
                  fontSize: isSingleMode ? 10 : 12,
                  fontFamily: "'Cinzel', serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>🪵</span>
                <span>{isSingleMode ? (showStand ? "BOIS" : "OFF") : showStand ? "BOIS" : "SANS BOIS"}</span>
              </button>

              <button
                onClick={() => setShowViewSettings((v) => !v)}
                title="Options de rendu 3D"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#a89060",
                  borderRadius: 8,
                  padding: isSingleMode ? "4px 7px" : "6px 10px",
                  cursor: "pointer",
                  fontSize: isSingleMode ? 11 : 13,
                }}
              >
                ⚙️ 3D
              </button>

              <button
                data-testid="q3d-reset-view"
                onClick={reset3DView}
                title="Réinitialiser l'angle, la translation et le zoom"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#a89060",
                  borderRadius: 8,
                  padding: isSingleMode ? "4px 7px" : "6px 10px",
                  cursor: "pointer",
                  fontSize: isSingleMode ? 10 : 11,
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {isSingleMode ? "RESET" : "RESET VUE"}
              </button>
            </div>
          </EditableUiSlot>

          {/* Direct UI Edit & Visibility List Triggers inside Coran 3D */}
          <button
            type="button"
            data-testid="q3d-ui-edit-btn"
            aria-pressed={uiEditMode}
            onClick={() => dispatch(uiActions.toggleUiEditMode())}
            title={uiEditMode ? "Terminer l'édition UI" : "Ajouter / enlever des éléments directement dans le Coran 3D"}
            style={{
              background: uiEditMode ? "rgba(62, 184, 160, 0.24)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${uiEditMode ? "#3eb8a0" : "rgba(212,175,55,0.3)"}`,
              color: uiEditMode ? "#56d4bc" : "#d4af37",
              borderRadius: 8,
              padding: isSingleMode ? "4px 7px" : "6px 10px",
              cursor: "pointer",
              fontSize: isSingleMode ? 10 : 11,
              fontWeight: 700,
              fontFamily: "'Cinzel', serif",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>{uiEditMode ? "✓ FIN UI" : "✏️ UI ±"}</span>
          </button>

          <button
            type="button"
            data-testid="q3d-ui-modal-btn"
            onClick={() => dispatch(uiActions.setShowUiVisibilityModal(true))}
            title="Activer ou désactiver chaque élément de l'interface"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(212,175,55,0.3)",
              color: "#ebd8b0",
              borderRadius: 8,
              padding: isSingleMode ? "4px 7px" : "6px 9px",
              cursor: "pointer",
              fontSize: isSingleMode ? 11 : 12,
            }}
          >
            🎛️
          </button>
        </div>
      </header>

      {/* ── Main Book Canvas Container ───────────────────────────────── */}
      <main
        data-testid="q3d-main-stage"
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 1080,
          minHeight: 0,
          position: "relative",
          margin: isSingleMode ? "2px 0" : "8px 0",
          borderRadius: isSingleMode ? 0 : 16,
          overflow: "hidden",
          boxShadow: isSingleMode
            ? "none"
            : "0 25px 70px rgba(0,0,0,0.85), 0 0 0 1px rgba(212,175,55,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isSingleMode
            ? "transparent"
            : "radial-gradient(circle at center, #1b1007 0%, #0d0703 100%)",
        }}
      >
        {/* 3D WebGL Canvas Mode */}
        {viewMode === "3d" && !webglFailed ? (
          <div
            key="q3d-webgl-host"
            ref={containerRef}
            data-testid="q3d-webgl-container"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={handleClickOnCanvas}
            style={{
              width: "100%",
              height: "100%",
              minHeight: 0,
              cursor: interactionMode === "pan" ? "move" : "grab",
              touchAction: "none",
            }}
          />
        ) : (
          /* 2D Medina Mushaf Page Reader Mode (High-DPI sharp layout with 2D zoom & pan) */
          <div
            key="q3d-2d-host"
            data-testid="q3d-2d-host"
            style={{
              width: "100%",
              height: "100%",
              minHeight: 0,
              containerType: isSingleMode ? "size" : "normal",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: isSingleMode ? 0 : 16,
              padding: isSingleMode ? 0 : "16px 12px",
              boxSizing: "border-box",
              overflow:
                zoom2dScale > 1 || pan2d.x !== 0 || pan2d.y !== 0 ? "auto" : "hidden",
            }}
          >
            <div
              data-testid="q3d-2d-spread-stage"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: isSingleMode ? 0 : 16,
                width: "100%",
                height: isSingleMode ? "100%" : "auto",
                transform:
                  pan2d.x === 0 && pan2d.y === 0
                    ? `scale(${zoom2dScale})`
                    : `translate3d(${pan2d.x}px, ${pan2d.y}px, 0) scale(${zoom2dScale})`,
                transformOrigin: isSingleMode ? "center center" : "center top",
                transition: "transform 0.18s ease",
              }}
            >
              {/* Left Page (Double page view) */}
              {!isSingleMode && leftCanvas && (
                <div
                  data-testid="q3d-2d-left-page"
                  style={{
                    flex: "1 1 0",
                    maxWidth: 480,
                    maxHeight: "calc(100vh - 220px)",
                    aspectRatio: "1024/1536",
                    boxShadow: "0 15px 45px rgba(0,0,0,0.85), 0 0 0 1px rgba(212,175,55,0.35)",
                    borderRadius: 10,
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "transform 0.2s ease",
                  }}
                  onClick={(e) => handle2DCanvasClick(e, false)}
                  title="Page Gauche — Touchez un verset"
                >
                  <CanvasMirror canvas={leftCanvas} alt={`Page ${lPage}`} />
                </div>
              )}

              {/* Right Page */}
              {rightCanvas && (
                <div
                  data-testid="q3d-2d-right-page"
                  style={
                    isSingleMode
                      ? {
                          width: "min(100cqw, calc(100cqh * 1024 / 1536))",
                          height: "auto",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          aspectRatio: "1024 / 1536",
                          boxShadow: "none",
                          borderRadius: 6,
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "transform 0.2s ease",
                        }
                      : {
                          flex: "1 1 0",
                          maxWidth: 480,
                          maxHeight: "calc(100vh - 220px)",
                          aspectRatio: "1024/1536",
                          boxShadow: "0 15px 45px rgba(0,0,0,0.85), 0 0 0 1px rgba(212,175,55,0.35)",
                          borderRadius: 10,
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "transform 0.2s ease",
                        }
                  }
                  onClick={(e) => handle2DCanvasClick(e, true)}
                  title="Page Droite — Touchez un verset"
                >
                  <CanvasMirror
                    canvas={rightCanvas}
                    alt={`Page ${rPage}`}
                    fit={isSingleMode ? "fill" : "contain"}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3D / 2D Page Turn Floating Buttons */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: isSingleMode ? 4 : 16,
            right: isSingleMode ? 4 : 16,
            transform: "translateY(-50%)",
            zIndex: 20,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <EditableUiSlot
            elementId="quran3dPageArrows"
            inline={false}
            style={{ width: "100%" }}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                pointerEvents: "none",
              }}
            >
              <button
                data-testid="q3d-next-btn"
                onClick={turnNext}
                disabled={rPage >= _MUSHAF_PAGES}
                style={{
                  width: isSingleMode ? 34 : 46,
                  height: isSingleMode ? 52 : 68,
                  borderRadius: "0 14px 14px 0",
                  background: "rgba(22, 13, 6, 0.85)",
                  border: "1px solid rgba(212, 175, 55, 0.4)",
                  color: rPage >= _MUSHAF_PAGES ? "rgba(255,255,255,0.2)" : "#ffd700",
                  fontSize: isSingleMode ? 16 : 22,
                  cursor: rPage >= _MUSHAF_PAGES ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
                  pointerEvents: "auto",
                }}
                title="Page Suivante (Gauche)"
              >
                ◀
              </button>

              <button
                data-testid="q3d-prev-btn"
                onClick={turnPrev}
                disabled={spread <= 1}
                style={{
                  width: isSingleMode ? 34 : 46,
                  height: isSingleMode ? 52 : 68,
                  borderRadius: "14px 0 0 14px",
                  background: "rgba(22, 13, 6, 0.85)",
                  border: "1px solid rgba(212, 175, 55, 0.4)",
                  color: spread <= 1 ? "rgba(255,255,255,0.2)" : "#ffd700",
                  fontSize: isSingleMode ? 16 : 22,
                  cursor: spread <= 1 ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
                  pointerEvents: "auto",
                }}
                title="Page Précédente (Droite)"
              >
                ▶
              </button>
            </div>
          </EditableUiSlot>
        </div>

        {/* Directional Camera Translation Mini-Pad (active in Caméra / Pan mode) */}
        {interactionMode === "pan" && (
          <div
            data-testid="q3d-pan-pad"
            style={{
              position: "absolute",
              bottom: 50,
              right: 16,
              zIndex: 25,
              display: "grid",
              gridTemplateColumns: "repeat(3, 30px)",
              gridTemplateRows: "repeat(3, 30px)",
              gap: 3,
              padding: 6,
              borderRadius: 12,
              background: "rgba(12, 7, 3, 0.88)",
              border: "1px solid rgba(56, 189, 248, 0.45)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
            }}
          >
            <span />
            <button
              type="button"
              data-testid="q3d-pan-up"
              onClick={() => handlePanStep(0, 1)}
              title="Monter la caméra"
              style={{
                background: "rgba(56,189,248,0.18)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "#7dd3fc",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ▲
            </button>
            <span />
            <button
              type="button"
              data-testid="q3d-pan-left"
              onClick={() => handlePanStep(-1, 0)}
              title="Déplacer la caméra à gauche"
              style={{
                background: "rgba(56,189,248,0.18)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "#7dd3fc",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ◀
            </button>
            <button
              type="button"
              data-testid="q3d-pan-center"
              onClick={reset3DView}
              title="Recentrer la caméra"
              style={{
                background: "rgba(212,175,55,0.22)",
                border: "1px solid rgba(212,175,55,0.5)",
                color: "#ffd700",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ⌖
            </button>
            <button
              type="button"
              data-testid="q3d-pan-right"
              onClick={() => handlePanStep(1, 0)}
              title="Déplacer la caméra à droite"
              style={{
                background: "rgba(56,189,248,0.18)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "#7dd3fc",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ▶
            </button>
            <span />
            <button
              type="button"
              data-testid="q3d-pan-down"
              onClick={() => handlePanStep(0, -1)}
              title="Descendre la caméra"
              style={{
                background: "rgba(56,189,248,0.18)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "#7dd3fc",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ▼
            </button>
            <span />
          </div>
        )}

        {/* Interaction Hint Bar */}
        <div
          style={{
            position: "absolute",
            bottom: isSingleMode ? 6 : 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 22,
            pointerEvents: "none",
            maxWidth: "92%",
          }}
        >
          <EditableUiSlot elementId="quran3dHintBar" inline={true}>
            <div
              data-testid="q3d-hint-bar"
              style={{
                background: "rgba(12, 7, 3, 0.88)",
                border: "1px solid rgba(212, 175, 55, 0.28)",
                borderRadius: 20,
                padding: isSingleMode ? "3px 10px" : "5px 18px",
                fontSize: isSingleMode ? 9.5 : 11,
                color: "#c9a84c",
                pointerEvents: "none",
                letterSpacing: 0.5,
                whiteSpace: "nowrap",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {viewMode === "3d" && !webglFailed
                ? "🖐️ Glissez pour incliner • Clic droit / mode ✋ pour déplacer la caméra • Molette/Pincement pour zoomer"
                : "📖 Mushaf de Médine • Touchez un verset pour l'écouter et voir sa traduction"}
            </div>
          </EditableUiSlot>
        </div>
      </main>

      {/* ── Bottom Audio & Scrubber Bar ─────────────────────────────── */}
      <EditableUiSlot
        elementId="quran3dAudioFooter"
        inline={false}
        style={{ width: "100%", maxWidth: 1080, flexShrink: 0 }}
      >
        <footer
          data-testid="q3d-audio-footer"
          style={{
            width: "100%",
            maxWidth: 1080,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: isSingleMode ? 4 : 10,
            padding: isSingleMode ? "4px 8px" : "8px 16px",
            background: "rgba(18, 10, 4, 0.95)",
            border: "1px solid rgba(212, 175, 55, 0.35)",
            borderRadius: isSingleMode ? 8 : 14,
            boxSizing: "border-box",
            zIndex: 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: isSingleMode ? 6 : 10 }}>
            <button
              data-testid="q3d-play-btn"
              onClick={togglePlayCurrentPage}
              style={{
                width: isSingleMode ? 34 : 40,
                height: isSingleMode ? 34 : 40,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #d4af37 0%, #8b6d28 100%)",
                border: "none",
                color: "#0a0603",
                fontSize: isSingleMode ? 15 : 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                boxShadow: "0 4px 14px rgba(212,175,55,0.45)",
              }}
              title={isPlaying ? "Mettre en pause" : "Écouter la page"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            <select
              value={reciterKey}
              onChange={(e) => setReciterKey(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(212,175,55,0.35)",
                borderRadius: 8,
                color: "#ebd8b0",
                padding: isSingleMode ? "4px 6px" : "6px 8px",
                fontSize: isSingleMode ? 11 : 12,
                maxWidth: isSingleMode ? 130 : undefined,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {GLOBAL_RECITERS.map((r) => (
                <option key={r.key} value={r.key} style={{ background: "#1a1208", color: "#ebd8b0" }}>
                  🎙️ {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Page Scrubber */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: isSingleMode ? 90 : 220, maxWidth: 420 }}>
            <span style={{ fontSize: 10, color: "#a89060" }}>1</span>
            <input
              type="range"
              min={1}
              max={604}
              value={rPage}
              onChange={(e) => jumpToPage(e.target.value)}
              style={{
                flex: 1,
                accentColor: "#d4af37",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: 10, color: "#a89060" }}>604</span>
          </div>

          {/* Direct Page Input */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: isSingleMode ? 11 : 12, color: "#d4af37" }}>P.</span>
            <input
              type="number"
              min={1}
              max={604}
              value={rPage}
              onChange={(e) => jumpToPage(e.target.value)}
              style={{
                width: isSingleMode ? 48 : 58,
                padding: "3px 5px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(212,175,55,0.35)",
                borderRadius: 6,
                color: "#ffd700",
                textAlign: "center",
                fontSize: isSingleMode ? 12 : 13,
                fontWeight: "bold",
              }}
            />
          </div>
        </footer>
      </EditableUiSlot>

      {/* ── Selected Ayah Interactive Sheet ─────────────────────────── */}
      {selectedAyah && (
        <div
          data-testid="q3d-selected-sheet"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: "linear-gradient(180deg, rgba(24,14,7,0.98) 0%, rgba(12,7,3,0.99) 100%)",
            borderTop: "2px solid rgba(212, 175, 55, 0.6)",
            boxShadow: "0 -16px 48px rgba(0,0,0,0.9)",
            padding: "16px 20px 22px",
            maxHeight: "45vh",
            overflowY: "auto",
            animation: "slideUp 0.25s ease-out",
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#ffd700" }}>
                  سُورَةُ {selectedAyah.surahName}
                </span>
                <span style={{ fontSize: 13, color: "#c9a84c" }}>
                  ({selectedAyah.surahEng}) — Verset {selectedAyah.ayahNum}
                </span>
              </div>
              <button
                onClick={() => setSelectedAyah(null)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#ebd8b0",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Arabic Text */}
            <div
              style={{
                fontSize: 22,
                lineHeight: 1.8,
                textAlign: "right",
                color: "#faf5ea",
                direction: "rtl",
                marginBottom: 12,
              }}
            >
              {selectedAyah.text}
            </div>

            {/* Translation */}
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "#c9b896",
                fontFamily: "system-ui, sans-serif",
                marginBottom: 16,
              }}
            >
              {ayahTranslation}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => handlePlayAyah(selectedAyah.surahNum, selectedAyah.ayahNum)}
                style={{
                  background: "linear-gradient(135deg, #d4af37 0%, #997520 100%)",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  color: "#0a0603",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>▶</span>
                <span>Écouter</span>
              </button>

              <button
                onClick={handleToggleLearned}
                style={{
                  background: isLearned ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${isLearned ? "#22c55e" : "rgba(255,255,255,0.2)"}`,
                  color: isLearned ? "#4ade80" : "#ebd8b0",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {isLearned ? "✅ Appris" : "Marquer appris"}
              </button>

              <button
                onClick={handleToggleRevise}
                style={{
                  background: isRevise ? "rgba(234,179,8,0.3)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${isRevise ? "#eab308" : "rgba(255,255,255,0.2)"}`,
                  color: isRevise ? "#facc15" : "#ebd8b0",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {isRevise ? "🔄 À réviser" : "À réviser"}
              </button>

              <button
                data-testid="q3d-open-verse-btn"
                onClick={() => {
                  const step = resolveBook3DStepDownNavigation({
                    uxMode,
                    selectedAyah,
                    lastAyatBySurah,
                  });
                  dispatch(uiActions.setQuranReadingTier(step.nextTier));
                  dispatch(uiActions.setFullScreenSelectedAyat(step.enableFullscreen));
                  dispatch(uiActions.setActivePage("quran"));
                  navigate(step.targetRoute);
                }}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(212,175,55,0.4)",
                  color: "#d4af37",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {isSimplifiedPriority ? "Ouvrir en Plein Écran ➔" : "Ouvrir dans le Coran ➔"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Surah Index Drawer ──────────────────────────────────────── */}
      {showSurahDrawer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(0,0,0,0.84)",
            display: "flex",
            justifyContent: "flex-start",
          }}
          onClick={() => setShowSurahDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              height: "100%",
              background: "linear-gradient(180deg, #180e05 0%, #0d0702 100%)",
              borderRight: "1px solid rgba(212, 175, 55, 0.4)",
              display: "flex",
              flexDirection: "column",
              padding: 16,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, color: "#ffd700", margin: 0 }}>Index du Noble Coran</h2>
              <button
                onClick={() => setShowSurahDrawer(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Rechercher une sourate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(212,175,55,0.3)",
                borderRadius: 8,
                color: "#ebd8b0",
                fontSize: 14,
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {surahs
                .filter(
                  (s) =>
                    !searchQuery ||
                    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    s.englishName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    String(s.number).includes(searchQuery)
                )
                .map((s) => (
                  <div
                    key={s.number}
                    onClick={() => jumpToSurah(s.number)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(212,175,55,0.15)",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <span style={{ color: "#d4af37", fontWeight: 700, marginRight: 8 }}>
                        {s.number}.
                      </span>
                      <span style={{ color: "#faf5ea" }}>{s.englishName}</span>
                    </div>
                    <span style={{ fontSize: 18, color: "#ffd700", direction: "rtl" }}>{s.name}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tajweed Settings Drawer ─────────────────────────────────── */}
      {showTajweedDrawer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(0,0,0,0.84)",
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setShowTajweedDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 380,
              height: "100%",
              background: "linear-gradient(180deg, #180e05 0%, #0d0702 100%)",
              borderLeft: "1px solid rgba(212, 175, 55, 0.4)",
              display: "flex",
              flexDirection: "column",
              padding: 20,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, color: "#ffd700", margin: 0 }}>🎨 Règles de Tajwid 3D</h2>
              <button
                onClick={() => setShowTajweedDrawer(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ color: "#38bdf8", fontWeight: 700 }}>Graves & Aiguës (Tafkhim / Tarqiq)</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Cyan = Emphase, Rose = Abaissement</div>
                </div>
                <input type="checkbox" checked={showTajweedTone} onChange={toggleTajweedTone} />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ color: "#38bdf8", fontWeight: 700 }}>Qalqala (Rebond)</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>ق ط ب ج د avec Soukoun</div>
                </div>
                <input type="checkbox" checked={showQalqala} onChange={toggleQalqala} />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ color: "#fb923c", fontWeight: 700 }}>Madd (Prolongations)</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>2, 4, 5 ou 6 harakats</div>
                </div>
                <input type="checkbox" checked={showMadd} onChange={toggleMadd} />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ color: "#34d399", fontWeight: 700 }}>Izhar (Clarté)</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Noun sakin ou tanwin + lettres de gorge</div>
                </div>
                <input type="checkbox" checked={showIzhar} onChange={toggleIzhar} />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ color: "#fbbf24", fontWeight: 700 }}>Idgham (Fusion)</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Lettres ي ر م ل و ن</div>
                </div>
                <input type="checkbox" checked={showIdgham} onChange={toggleIdgham} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D View Settings Drawer ─────────────────────────────────── */}
      {showViewSettings && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(0,0,0,0.84)",
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setShowViewSettings(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              height: "100%",
              background: "linear-gradient(180deg, #180e05 0%, #0d0702 100%)",
              borderLeft: "1px solid rgba(212, 175, 55, 0.4)",
              display: "flex",
              flexDirection: "column",
              padding: 20,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, color: "#ffd700", margin: 0 }}>Options de Rendu 3D</h2>
              <button
                onClick={() => setShowViewSettings(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "#ebd8b0" }}>🪵 Support en Bois (Rehal)</span>
                <input
                  type="checkbox"
                  checked={showStand}
                  onChange={(e) => setShowStand(e.target.checked)}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "#ebd8b0" }}>✨ Particules Dorées Texturées</span>
                <input
                  data-testid="q3d-toggle-dust"
                  type="checkbox"
                  checked={showDust}
                  onChange={(e) => setShowDust(e.target.checked)}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "#ebd8b0" }}>🌟 Lueur &amp; Halo Sacré (Glow)</span>
                <input
                  data-testid="q3d-toggle-glow"
                  type="checkbox"
                  checked={showGlow}
                  onChange={(e) => setShowGlow(e.target.checked)}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "#ebd8b0" }}>📖 Coran 3D Ouvert</span>
                <input
                  data-testid="q3d-toggle-book-open"
                  type="checkbox"
                  checked={bookOpen}
                  onChange={(e) => setBookOpen(e.target.checked)}
                />
              </label>

              <button
                onClick={reset3DView}
                style={{
                  marginTop: 12,
                  background: "linear-gradient(135deg, #d4af37 0%, #8b6d28 100%)",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px",
                  color: "#0a0603",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🔄 Réinitialiser Angle, Caméra &amp; Zoom
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
