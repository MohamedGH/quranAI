import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import * as THREE from "three";
import { sel, uiActions, learnActions, setLDataThunk } from "../../store.js";
import {
  fetchSurahs,
  fetchPageMeta,
  GLOBAL_RECITERS,
  fetchQuranPage,
  fetchSurahTranslation,
  TRANS_LABELS,
  TRANS_EDITIONS,
} from "../../utils/reciterAudio.js";
import {
  isTafkhim,
  isTarqiq,
  isQalqala,
  isIzhar,
  isIdgham,
  getMaddType,
} from "../../utils/tajweedRules.js";

const _MUSHAF_PAGES = 604;

// ─── 2D Canvas Mushaf Page Texture Generator ─────────────────────────────────
function renderPageToCanvas(ayahs, pageNum, tajweedOpts, activeAyahKey, isSingle = false) {
  if (typeof document === "undefined") return { canvas: null, boxes: [] };

  const cvs = document.createElement("canvas");
  const scale = 2; // High-DPI Sharpness
  const w = 1024;
  const h = 1536;
  cvs.width = w;
  cvs.height = h;

  const ctx = cvs.getContext("2d", { alpha: false });
  if (!ctx) return { canvas: null, boxes: [] };

  const boxes = [];

  // Background: Warm Ivory Medina Mushaf Paper
  ctx.fillStyle = "#faf7ee";
  ctx.fillRect(0, 0, w, h);

  // Subtle paper grain & warm border tint
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "rgba(220, 195, 140, 0.2)");
  grad.addColorStop(0.08, "rgba(255, 255, 255, 0.0)");
  grad.addColorStop(0.92, "rgba(255, 255, 255, 0.0)");
  grad.addColorStop(1, "rgba(220, 195, 140, 0.2)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (!pageNum || pageNum < 1 || pageNum > _MUSHAF_PAGES) {
    return { canvas: cvs, boxes };
  }

  // Outer Ornate Golden Border Frame
  const margin = 48 * scale;
  const frameW = w - margin * 2;
  const frameH = h - margin * 2;

  // Double gold frame
  ctx.strokeStyle = "rgba(195, 155, 60, 0.85)";
  ctx.lineWidth = 4 * scale;
  ctx.strokeRect(margin, margin, frameW, frameH);

  ctx.strokeStyle = "rgba(195, 155, 60, 0.35)";
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeRect(margin + 8 * scale, margin + 8 * scale, frameW - 16 * scale, frameH - 16 * scale);

  // Corner Rosettes
  const cRadius = 10 * scale;
  const corners = [
    [margin, margin],
    [margin + frameW, margin],
    [margin, margin + frameH],
    [margin + frameW, margin + frameH],
  ];
  corners.forEach(([cx, cy]) => {
    ctx.fillStyle = "#b89035";
    ctx.beginPath();
    ctx.arc(cx, cy, cRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, cRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });

  const topAyah = ayahs && ayahs.length ? ayahs[0] : null;
  const surahName = topAyah?.surah?.name || "";
  const juzNum = topAyah?.juz || Math.ceil(pageNum / 20);

  // Top Header text
  ctx.fillStyle = "#8a6d25";
  ctx.font = `bold ${14 * scale}px 'Cinzel', serif`;
  ctx.textAlign = "left";
  ctx.fillText(`JUZ ${juzNum}`, margin + 18 * scale, margin - 12 * scale);

  if (surahName) {
    ctx.textAlign = "right";
    ctx.font = `bold ${16 * scale}px 'Amiri Quran', serif`;
    ctx.fillText(`سُورَةُ ${surahName}`, margin + frameW - 18 * scale, margin - 12 * scale);
  }

  // Bottom Page Number
  ctx.fillStyle = "#a17e2e";
  ctx.font = `bold ${15 * scale}px 'Cinzel', serif`;
  ctx.textAlign = "center";
  ctx.fillText(`${pageNum}`, w / 2, h - margin + 26 * scale);

  if (!ayahs || !ayahs.length) {
    ctx.fillStyle = "#9c824c";
    ctx.font = `${22 * scale}px 'Amiri Quran', serif`;
    ctx.textAlign = "center";
    ctx.fillText("جَارِي التَّحْمِيلِ...", w / 2, h / 2);
    return { canvas: cvs, boxes };
  }

  // Render Ayahs Content
  let curY = margin + 34 * scale;
  const contentW = frameW - 36 * scale;
  const contentX = margin + 18 * scale;

  // Group by Surah
  const surahGroups = [];
  ayahs.forEach((a) => {
    const last = surahGroups[surahGroups.length - 1];
    if (!last || last.surahNum !== a.surah.number) {
      surahGroups.push({ surahNum: a.surah.number, surah: a.surah, ayahs: [] });
    }
    surahGroups[surahGroups.length - 1].ayahs.push(a);
  });

  surahGroups.forEach((group) => {
    // If Surah starts on this page (ayah 1)
    if (group.ayahs.some((a) => a.numberInSurah === 1)) {
      const bannerH = 46 * scale;
      const bannerY = curY;

      // Golden Header Box
      ctx.fillStyle = "rgba(195, 155, 60, 0.16)";
      ctx.fillRect(contentX, bannerY, contentW, bannerH);
      ctx.strokeStyle = "rgba(195, 155, 60, 0.8)";
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(contentX, bannerY, contentW, bannerH);

      ctx.fillStyle = "#4a320c";
      ctx.font = `bold ${22 * scale}px 'Amiri Quran', serif`;
      ctx.textAlign = "center";
      ctx.fillText(`سُورَةُ ${group.surah.name}`, contentX + contentW / 2, bannerY + bannerH * 0.68);
      curY += bannerH + 16 * scale;

      // Bismillah banner (unless Surah At-Tawbah 9 or Al-Fatihah 1)
      if (group.surahNum !== 9 && group.surahNum !== 1) {
        ctx.fillStyle = "#2c2010";
        ctx.font = `${18 * scale}px 'Amiri Quran', serif`;
        ctx.textAlign = "center";
        ctx.fillText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", contentX + contentW / 2, curY + 16 * scale);
        curY += 36 * scale;
      }
    }

    // Dynamic Ayah typography sizing
    const baseFontSize = Math.max(16 * scale, Math.min(23 * scale, (w / 30) * scale));
    const lineHeight = baseFontSize * 1.72;

    group.ayahs.forEach((ayah) => {
      const aKey = `${ayah.surah.number}:${ayah.numberInSurah}`;
      const isSelected = activeAyahKey === aKey;
      const ayahStartY = curY;

      let text = ayah.text;
      if (ayah.numberInSurah === 1 && group.surahNum !== 1 && group.surahNum !== 9) {
        text = text.replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*/, "");
      }

      const words = text.split(/\s+/).filter(Boolean);
      const endMarker = ` ﴿${ayah.numberInSurah}﴾ `;
      words.push(endMarker);

      ctx.font = `${baseFontSize}px 'Amiri Quran', 'Scheherazade New', serif`;

      let currentLineWords = [];
      let currentLineWidth = 0;

      const flushLine = (isLast) => {
        if (!currentLineWords.length) return;
        let drawX = contentX + contentW;
        const totalWordsW = currentLineWords.reduce((s, wItem) => s + ctx.measureText(wItem.word).width, 0);
        const spaceCount = currentLineWords.length - 1;
        const extraSpace =
          !isLast && spaceCount > 0 ? Math.max(0, (contentW - totalWordsW) / spaceCount) : 8 * scale;

        currentLineWords.forEach(({ word, isEnd }) => {
          const wordW = ctx.measureText(word).width;
          drawX -= wordW;

          // Highlight background if selected
          if (isSelected) {
            ctx.fillStyle = "rgba(195, 155, 60, 0.35)";
            ctx.fillRect(drawX - 3 * scale, curY - baseFontSize * 0.85, wordW + 6 * scale, lineHeight);
          }

          if (isEnd) {
            ctx.fillStyle = "#b88a24";
            ctx.font = `bold ${baseFontSize * 0.92}px 'Amiri Quran', serif`;
            ctx.textAlign = "left";
            ctx.fillText(word, drawX, curY);
          } else {
            // Apply Tajweed coloring
            let wordColor = "#1a1610";
            if (tajweedOpts?.showTajweedTone) {
              const chars = Array.from(word);
              const hasTafkhim = chars.some((_, idx) => isTafkhim(chars, idx));
              wordColor = hasTafkhim ? "#0284c7" : "#db2777";
            } else if (tajweedOpts?.showQalqala && Array.from(word).some((_, i, arr) => isQalqala(arr, i))) {
              wordColor = "#0284c7";
            } else if (tajweedOpts?.showMadd && Array.from(word).some((_, i, arr) => getMaddType(arr, i))) {
              wordColor = "#ea580c";
            } else if (tajweedOpts?.showIzhar && Array.from(word).some((_, i, arr) => isIzhar(arr, i))) {
              wordColor = "#059669";
            } else if (tajweedOpts?.showIdgham && Array.from(word).some((_, i, arr) => isIdgham(arr, i))) {
              wordColor = "#d97706";
            }

            ctx.fillStyle = wordColor;
            ctx.font = `${baseFontSize}px 'Amiri Quran', 'Scheherazade New', serif`;
            ctx.textAlign = "left";
            ctx.fillText(word, drawX, curY);
          }

          drawX -= extraSpace;
        });

        curY += lineHeight;
        currentLineWords = [];
        currentLineWidth = 0;
      };

      words.forEach((wStr, wIdx) => {
        const isEnd = wIdx === words.length - 1;
        const wWidth = ctx.measureText(wStr).width + 8 * scale;
        if (currentLineWidth + wWidth > contentW && currentLineWords.length > 0) {
          flushLine(false);
        }
        currentLineWords.push({ word: wStr, isEnd });
        currentLineWidth += wWidth;
      });

      flushLine(true);

      // Record normalized 0..1 bounding box for 3D UV raycasting
      boxes.push({
        key: aKey,
        surahNum: ayah.surah.number,
        ayahNum: ayah.numberInSurah,
        pageNum,
        uMin: contentX / w,
        uMax: (contentX + contentW) / w,
        // In 3D texture mapping, V=0 is at bottom, V=1 is at top
        vMin: 1.0 - curY / h,
        vMax: 1.0 - ayahStartY / h,
        text: ayah.text,
        surahName: ayah.surah.name,
        surahEng: ayah.surah.englishName,
      });
    });
  });

  return { canvas: cvs, boxes };
}

// ─── 3D Procedural Leather Cover Texture Generator ───────────────────────────
function createCoverTexture() {
  if (typeof document === "undefined") return null;
  const cvs = document.createElement("canvas");
  cvs.width = 1024;
  cvs.height = 1536;
  const ctx = cvs.getContext("2d");
  if (!ctx) return null;

  // Deep Emerald / Moroccan Royal Green
  const bgGrad = ctx.createRadialGradient(512, 768, 50, 512, 768, 800);
  bgGrad.addColorStop(0, "#083321");
  bgGrad.addColorStop(0.6, "#041f13");
  bgGrad.addColorStop(1, "#02100a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 1536);

  // Outer Gilded Arabesque Border
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 12;
  ctx.strokeRect(60, 60, 904, 1416);

  ctx.strokeStyle = "rgba(212, 175, 55, 0.6)";
  ctx.lineWidth = 4;
  ctx.strokeRect(90, 90, 844, 1356);

  // Gilded Corner Filigrees
  const drawCornerLattice = (x, y, flipX, flipY) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flipX, flipY);
    ctx.fillStyle = "#d4af37";
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, Math.PI * 0.5);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.strokeStyle = "#041f13";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 0.5);
    ctx.stroke();
    ctx.restore();
  };

  drawCornerLattice(60, 60, 1, 1);
  drawCornerLattice(964, 60, -1, 1);
  drawCornerLattice(60, 1476, 1, -1);
  drawCornerLattice(964, 1476, -1, -1);

  // Central Elaborate Medallion (Shamsiyya)
  const cx = 512;
  const cy = 768;

  ctx.fillStyle = "rgba(212, 175, 55, 0.95)";
  ctx.beginPath();
  ctx.arc(cx, cy, 220, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#041f13";
  ctx.beginPath();
  ctx.arc(cx, cy, 200, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(212, 175, 55, 0.85)";
  ctx.beginPath();
  ctx.arc(cx, cy, 170, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#03170e";
  ctx.beginPath();
  ctx.arc(cx, cy, 155, 0, Math.PI * 2);
  ctx.fill();

  // Arabic Calligraphy in Center
  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 56px 'Amiri Quran', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("الْقُرْآنُ", cx, cy - 25);
  ctx.fillText("الْكَرِيمُ", cx, cy + 35);

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── Procedural Carved Wood Texture for the Rehal Stand ───────────────────────
function createWoodTexture() {
  if (typeof document === "undefined") return null;
  const cvs = document.createElement("canvas");
  cvs.width = 512;
  cvs.height = 512;
  const ctx = cvs.getContext("2d");
  if (!ctx) return null;

  // Dark Walnut Wood Grain
  ctx.fillStyle = "#2c1508";
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = "#1e0e05";
  for (let i = 0; i < 512; i += 4) {
    const wave = Math.sin(i * 0.05) * 6;
    ctx.fillRect(i + wave, 0, 2, 512);
  }

  // Golden Inlay Lines
  ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 472, 472);
  ctx.strokeRect(40, 40, 432, 432);

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── Main 3D Quran Component ──────────────────────────────────────────────────
export function QuranBook3DPage({
  surahs: propSurahs,
  learnData: propLearnData,
  setLData: propSetLData,
  collections: propCollections,
  onToggleAyat: propToggleAyat,
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

  // Redux Selectors
  const reduxSurahs = useSelector(sel.surahs);
  const reduxLearnData = useSelector(sel.learnData);
  const reduxShowQalqala = useSelector(sel.showQalqala);
  const reduxShowMadd = useSelector(sel.showMadd);
  const reduxShowIzhar = useSelector(sel.showIzhar);
  const reduxShowIdgham = useSelector(sel.showIdgham);
  const reduxShowTajweedTone = useSelector(sel.showTajweedTone);

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

  // State
  const [spread, setSpread] = useState(1); // 1..302
  const [isSingleMode, setIsSingleMode] = useState(false);
  const [pageCache, setPageCache] = useState({});
  const [selectedAyah, setSelectedAyah] = useState(null);
  const [ayahTranslation, setAyahTranslation] = useState("");
  const [transLang, setTransLang] = useState("fr");
  const [showSurahDrawer, setShowSurahDrawer] = useState(false);
  const [showTajweedDrawer, setShowTajweedDrawer] = useState(false);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showStand, setShowStand] = useState(true);
  const [showDust, setShowDust] = useState(true);
  const [bookmark, setBookmark] = useState(() => {
    try {
      return parseInt(localStorage.getItem("quran_bm_page"), 10) || null;
    } catch {
      return null;
    }
  });

  // Audio Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [reciterKey, setReciterKey] = useState("alafasy");
  const [audioSpeed, setAudioSpeed] = useState(1.0);
  const [currentAudioAyah, setCurrentAudioAyah] = useState(null);
  const audioRef = useRef(null);

  // Three.js Mount Container & Refs
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const bookGroupRef = useRef(null);
  const rightPageMeshRef = useRef(null);
  const leftPageMeshRef = useRef(null);
  const flippingPageMeshRef = useRef(null);
  const ribbonMeshRef = useRef(null);
  const dustParticlesRef = useRef(null);

  // Textures and Ayah Bounding Boxes
  const rightTexRef = useRef(null);
  const leftTexRef = useRef(null);
  const flipTexRef = useRef(null);
  const rightBoxesRef = useRef([]);
  const leftBoxesRef = useRef([]);

  // Animation & Interaction tracking
  const isDraggingRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0.35, y: 0.0 });
  const currentRotationRef = useRef({ x: 0.35, y: 0.0 });
  const zoomDistRef = useRef(4.8);
  const flipAnimRef = useRef({
    active: false,
    progress: 0,
    direction: 1, // +1 forward, -1 backward
    targetSpread: 1,
  });

  // Calculate Page numbers
  const rPage = isSingleMode ? spread : 2 * spread - 1;
  const lPage = isSingleMode ? null : Math.min(2 * spread, _MUSHAF_PAGES);

  // Check Responsive Screen Mode
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      const isMobile = window.innerWidth < 768;
      setIsSingleMode(isMobile);
      if (cameraRef.current && rendererRef.current && containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch Page Content
  const loadPage = useCallback(
    async (pNum) => {
      if (!pNum || pNum < 1 || pNum > _MUSHAF_PAGES || pageCache[pNum] !== undefined) return;
      setPageCache((c) => ({ ...c, [pNum]: null }));
      try {
        const data = await fetchQuranPage(pNum);
        setPageCache((c) => ({ ...c, [pNum]: data || [] }));
      } catch {
        setPageCache((c) => ({ ...c, [pNum]: [] }));
      }
    },
    [pageCache]
  );

  // Preload pages
  useEffect(() => {
    const targets = isSingleMode
      ? [spread, spread + 1, spread + 2, spread - 1, spread - 2]
      : [rPage, lPage, rPage + 2, lPage + 2, rPage - 2, lPage - 2];
    targets.filter((p) => p && p >= 1 && p <= _MUSHAF_PAGES).forEach(loadPage);
  }, [spread, isSingleMode, rPage, lPage, loadPage]);

  // Update Page Textures onto Three.js Meshes
  const updatePageTextures = useCallback(() => {
    const activeKey = selectedAyah ? `${selectedAyah.surahNum}:${selectedAyah.ayahNum}` : null;
    const tajweedOpts = { showQalqala, showMadd, showIzhar, showIdgham, showTajweedTone };

    // Right Page
    const rData = pageCache[rPage];
    const { canvas: rCanvas, boxes: rBoxes } = renderPageToCanvas(
      rData,
      rPage,
      tajweedOpts,
      activeKey,
      isSingleMode
    );
    rightBoxesRef.current = rBoxes;
    if (rCanvas && rightTexRef.current) {
      rightTexRef.current.image = rCanvas;
      rightTexRef.current.needsUpdate = true;
    }

    // Left Page (in double-page mode)
    if (!isSingleMode && lPage) {
      const lData = pageCache[lPage];
      const { canvas: lCanvas, boxes: lBoxes } = renderPageToCanvas(
        lData,
        lPage,
        tajweedOpts,
        activeKey,
        false
      );
      leftBoxesRef.current = lBoxes;
      if (lCanvas && leftTexRef.current) {
        leftTexRef.current.image = lCanvas;
        leftTexRef.current.needsUpdate = true;
      }
    }
  }, [pageCache, rPage, lPage, selectedAyah, showQalqala, showMadd, showIzhar, showIdgham, showTajweedTone, isSingleMode]);

  useEffect(() => {
    updatePageTextures();
  }, [updatePageTextures]);

  // ─── Initialize Full Three.js 3D Scene ─────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 920;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 2.2, zoomDistRef.current);
    camera.lookAt(0, -0.1, 0);
    cameraRef.current = camera;

    // Renderer
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Lighting ──
    const ambientLight = new THREE.AmbientLight(0xffeedb, 0.75);
    scene.add(ambientLight);

    const mainSun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    mainSun.position.set(2.5, 5, 3.5);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.width = 1024;
    mainSun.shadow.mapSize.height = 1024;
    scene.add(mainSun);

    const candleGlow = new THREE.PointLight(0xff9933, 1.2, 10);
    candleGlow.position.set(-1.5, 1.8, 1.2);
    scene.add(candleGlow);

    const rimLight = new THREE.DirectionalLight(0xc9a84c, 0.6);
    rimLight.position.set(-3, 2, -3);
    scene.add(rimLight);

    // ── Floating Spiritual Dust Particles ──
    const dustCount = 80;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPos[i] = (Math.random() - 0.5) * 8;
      dustPos[i + 1] = Math.random() * 5 - 1;
      dustPos[i + 2] = (Math.random() - 0.5) * 6;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.04,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);
    dustParticlesRef.current = dustPoints;

    // ── Main Book & Stand Root Group ──
    const bookGroup = new THREE.Group();
    bookGroup.position.set(0, 0, 0);
    scene.add(bookGroup);
    bookGroupRef.current = bookGroup;

    // ── 3D Carved Wooden Rehal Stand (حامل المصحف) ──
    const woodTex = createWoodTexture();
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x3d2010,
      map: woodTex,
      roughness: 0.45,
      metalness: 0.1,
    });

    const standGroup = new THREE.Group();
    standGroup.name = "standGroup";

    // Crossed Rehal Planks
    const plankGeo = new THREE.BoxGeometry(2.8, 0.08, 1.8);
    const leftPlank = new THREE.Mesh(plankGeo, woodMat);
    leftPlank.position.set(-0.65, -0.45, 0);
    leftPlank.rotation.z = 0.28;
    leftPlank.receiveShadow = true;
    standGroup.add(leftPlank);

    const rightPlank = new THREE.Mesh(plankGeo, woodMat);
    rightPlank.position.set(0.65, -0.45, 0);
    rightPlank.rotation.z = -0.28;
    rightPlank.receiveShadow = true;
    standGroup.add(rightPlank);

    // Stand base feet & decorative knobs
    const knobGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 16);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.25,
    });
    const knob1 = new THREE.Mesh(knobGeo, goldMat);
    knob1.position.set(-1.4, -0.85, 0.7);
    standGroup.add(knob1);
    const knob2 = new THREE.Mesh(knobGeo, goldMat);
    knob2.position.set(1.4, -0.85, 0.7);
    standGroup.add(knob2);

    bookGroup.add(standGroup);

    // ── 3D Quran Cover & Spine ──
    const coverTex = createCoverTexture();
    const coverMat = new THREE.MeshStandardMaterial({
      map: coverTex,
      roughness: 0.35,
      metalness: 0.15,
    });

    const spineGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.9, 16, 1, false, 0, Math.PI);
    const spineMesh = new THREE.Mesh(spineGeo, coverMat);
    spineMesh.rotation.x = Math.PI / 2;
    spineMesh.position.set(0, -0.1, 0);
    bookGroup.add(spineMesh);

    // Left Cover Backing
    const coverBoardGeo = new THREE.BoxGeometry(1.35, 0.04, 1.95);
    const leftCover = new THREE.Mesh(coverBoardGeo, coverMat);
    leftCover.position.set(-0.7, -0.12, 0);
    leftCover.rotation.z = 0.15;
    leftCover.receiveShadow = true;
    bookGroup.add(leftCover);

    // Right Cover Backing
    const rightCover = new THREE.Mesh(coverBoardGeo, coverMat);
    rightCover.position.set(0.7, -0.12, 0);
    rightCover.rotation.z = -0.15;
    rightCover.receiveShadow = true;
    bookGroup.add(rightCover);

    // ── Stack of Pages Thickness (Gilded Edges) ──
    const stackGeo = new THREE.BoxGeometry(1.28, 0.1, 1.88);
    const goldEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xc89d38,
      roughness: 0.3,
      metalness: 0.7,
    });

    const leftStack = new THREE.Mesh(stackGeo, goldEdgeMat);
    leftStack.position.set(-0.66, -0.06, 0);
    leftStack.rotation.z = 0.14;
    bookGroup.add(leftStack);

    const rightStack = new THREE.Mesh(stackGeo, goldEdgeMat);
    rightStack.position.set(0.66, -0.06, 0);
    rightStack.rotation.z = -0.14;
    bookGroup.add(rightStack);

    // ── Open Curved Pages (Left & Right) ──
    const makeCurvedPageGeo = (isRight) => {
      const geo = new THREE.PlaneGeometry(1.26, 1.86, 32, 16);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        // Realistic Medina Mushaf page curvature opening towards spine
        const curve = Math.sin((x + 0.63) / 1.26 * Math.PI * 0.5) * 0.05;
        pos.setZ(i, curve);
      }
      geo.computeVertexNormals();
      return geo;
    };

    // Textures for active page rendering
    const dummyCvs = document.createElement("canvas");
    dummyCvs.width = 16;
    dummyCvs.height = 16;
    const dummyCtx = dummyCvs.getContext("2d");
    dummyCtx.fillStyle = "#faf7ee";
    dummyCtx.fillRect(0, 0, 16, 16);

    const rTex = new THREE.CanvasTexture(dummyCvs);
    rTex.colorSpace = THREE.SRGBColorSpace;
    rightTexRef.current = rTex;

    const lTex = new THREE.CanvasTexture(dummyCvs);
    lTex.colorSpace = THREE.SRGBColorSpace;
    leftTexRef.current = lTex;

    const fTex = new THREE.CanvasTexture(dummyCvs);
    fTex.colorSpace = THREE.SRGBColorSpace;
    flipTexRef.current = fTex;

    const rightPageMat = new THREE.MeshStandardMaterial({
      map: rTex,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.FrontSide,
    });
    const leftPageMat = new THREE.MeshStandardMaterial({
      map: lTex,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.FrontSide,
    });

    const rightPageMesh = new THREE.Mesh(makeCurvedPageGeo(true), rightPageMat);
    rightPageMesh.name = "rightPage";
    rightPageMesh.rotation.x = -Math.PI / 2;
    rightPageMesh.rotation.y = -0.14;
    rightPageMesh.position.set(0.66, 0.01, 0);
    rightPageMesh.castShadow = true;
    bookGroup.add(rightPageMesh);
    rightPageMeshRef.current = rightPageMesh;

    const leftPageMesh = new THREE.Mesh(makeCurvedPageGeo(false), leftPageMat);
    leftPageMesh.name = "leftPage";
    leftPageMesh.rotation.x = -Math.PI / 2;
    leftPageMesh.rotation.y = 0.14;
    leftPageMesh.position.set(-0.66, 0.01, 0);
    leftPageMesh.castShadow = true;
    bookGroup.add(leftPageMesh);
    leftPageMeshRef.current = leftPageMesh;

    // ── 3D Flipping Page (Hidden when not turning) ──
    const flipGeo = new THREE.PlaneGeometry(1.26, 1.86, 32, 16);
    const flipMat = new THREE.MeshStandardMaterial({
      map: fTex,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const flipMesh = new THREE.Mesh(flipGeo, flipMat);
    flipMesh.position.set(0, 0.05, 0);
    flipMesh.rotation.x = -Math.PI / 2;
    flipMesh.visible = false;
    bookGroup.add(flipMesh);
    flippingPageMeshRef.current = flipMesh;

    // ── Gilded Silk Ribbon Bookmark ──
    const ribbonPoints = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const rx = 0.1 + Math.sin(t * Math.PI) * 0.25;
      const ry = 0.05 - t * 0.12;
      const rz = -0.8 + t * 1.7;
      ribbonPoints.push(new THREE.Vector3(rx, ry, rz));
    }
    const ribbonCurve = new THREE.CatmullRomCurve3(ribbonPoints);
    const ribbonGeo = new THREE.TubeGeometry(ribbonCurve, 24, 0.02, 8, false);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0x8b0000,
      roughness: 0.35,
      metalness: 0.2,
    });
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    bookGroup.add(ribbonMesh);
    ribbonMeshRef.current = ribbonMesh;

    // ── Render Loop ──
    let rafId;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Smooth Rotation Lerp
      currentRotationRef.current.x +=
        (targetRotationRef.current.x - currentRotationRef.current.x) * 0.08;
      currentRotationRef.current.y +=
        (targetRotationRef.current.y - currentRotationRef.current.y) * 0.08;

      bookGroup.rotation.x = currentRotationRef.current.x;
      bookGroup.rotation.y = currentRotationRef.current.y;

      // Gentle Floating Breathing motion
      bookGroup.position.y = Math.sin(elapsedTime * 0.8) * 0.03;

      // Subtle Ribbon Swirl
      if (ribbonMeshRef.current) {
        ribbonMeshRef.current.position.y = Math.sin(elapsedTime * 1.5) * 0.006;
      }

      // Floating Dust Particles
      if (dustParticlesRef.current && dustParticlesRef.current.visible) {
        const positions = dustParticlesRef.current.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] += 0.003;
          if (positions[i] > 3) positions[i] = -1;
        }
        dustParticlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // 3D Page Flip Physics Interpolation
      const fAnim = flipAnimRef.current;
      if (fAnim.active && flippingPageMeshRef.current) {
        fAnim.progress += 0.045;
        const p = Math.min(1.0, fAnim.progress);

        flippingPageMeshRef.current.visible = true;
        flippingPageMeshRef.current.material.opacity = 1.0;

        // Angle from Right (-0.14 rad) to Left (+Math.PI - 0.14 rad)
        const startAngle = fAnim.direction > 0 ? -0.14 : Math.PI - 0.14;
        const endAngle = fAnim.direction > 0 ? Math.PI - 0.14 : -0.14;
        const curAngle = startAngle + (endAngle - startAngle) * p;

        flippingPageMeshRef.current.rotation.y = curAngle;
        flippingPageMeshRef.current.position.y = 0.04 + Math.sin(p * Math.PI) * 0.22;

        if (p >= 1.0) {
          fAnim.active = false;
          flippingPageMeshRef.current.visible = false;
          setSpread(fAnim.targetSpread);
        }
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
    };
  }, []);

  // Toggle Stand and Dust visibility
  useEffect(() => {
    if (sceneRef.current) {
      const stand = sceneRef.current.getObjectByName("standGroup");
      if (stand) stand.visible = showStand;
    }
  }, [showStand]);

  useEffect(() => {
    if (dustParticlesRef.current) {
      dustParticlesRef.current.visible = showDust;
    }
  }, [showDust]);

  // ── Page Turn in 3D ──
  const turnNext = useCallback(() => {
    const maxSp = isSingleMode ? _MUSHAF_PAGES : 302;
    if (spread >= maxSp || flipAnimRef.current.active) return;

    flipAnimRef.current = {
      active: true,
      progress: 0,
      direction: 1,
      targetSpread: spread + 1,
    };
  }, [spread, isSingleMode]);

  const turnPrev = useCallback(() => {
    if (spread <= 1 || flipAnimRef.current.active) return;

    flipAnimRef.current = {
      active: true,
      progress: 0,
      direction: -1,
      targetSpread: spread - 1,
    };
  }, [spread]);

  const jumpToPage = useCallback(
    (targetPage) => {
      const p = Math.max(1, Math.min(_MUSHAF_PAGES, parseInt(targetPage, 10) || 1));
      const targetSp = isSingleMode ? p : Math.floor((p - 1) / 2) + 1;
      setSpread(targetSp);
    },
    [isSingleMode]
  );

  const jumpToSurah = useCallback(
    async (sNum) => {
      setShowSurahDrawer(false);
      try {
        const meta = await fetchPageMeta(sNum);
        const p = meta?.page || 1;
        jumpToPage(p);
      } catch {
        jumpToPage(1);
      }
    },
    [jumpToPage]
  );

  // ── 3D Interaction: Mouse / Touch Raycasting to Ayah Selection ──
  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMousePosRef.current.x;
    const dy = e.clientY - prevMousePosRef.current.y;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };

    // Gentle orbit limits
    targetRotationRef.current.y += dx * 0.005;
    targetRotationRef.current.x += dy * 0.005;
    targetRotationRef.current.x = Math.max(0.05, Math.min(0.75, targetRotationRef.current.x));
    targetRotationRef.current.y = Math.max(-0.6, Math.min(0.6, targetRotationRef.current.y));
  };

  const handlePointerUp = (e) => {
    isDraggingRef.current = false;
  };

  const handleClickOnCanvas = (e) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(
      [rightPageMeshRef.current, leftPageMeshRef.current].filter(Boolean),
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
          setSelectedAyah(matched);
          fetchSurahTranslation(matched.surahNum, transLang).then((list) => {
            const item = list.find((t) => t.numberInSurah === matched.ayahNum);
            setAyahTranslation(item?.text || "Traduction indisponible.");
          });
        }
      }
    }
  };

  // Reset 3D View Angle
  const reset3DView = () => {
    targetRotationRef.current = { x: 0.35, y: 0.0 };
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 2.2, 4.8);
      cameraRef.current.lookAt(0, -0.1, 0);
    }
  };

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") turnNext();
      if (e.key === "ArrowRight") turnPrev();
      if (e.key === "Escape") {
        setSelectedAyah(null);
        setShowSurahDrawer(false);
        setShowTajweedDrawer(false);
        setShowViewSettings(false);
      }
      if (e.key === " ") {
        e.preventDefault();
        togglePlayCurrentPage();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  // ── Audio Handling ──
  const handlePlayAyah = (surahNum, ayahNum) => {
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
  };

  const togglePlayCurrentPage = () => {
    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const activePage = rPage;
      const ayahs = pageCache[activePage];
      if (ayahs && ayahs.length) {
        handlePlayAyah(ayahs[0].surah.number, ayahs[0].numberInSurah);
      }
    }
  };

  const handleAudioEnded = () => {
    if (!currentAudioAyah) return;
    const activeAyahs = pageCache[rPage] || [];
    const currIdx = activeAyahs.findIndex(
      (a) =>
        a.surah.number === currentAudioAyah.surahNum &&
        a.numberInSurah === currentAudioAyah.ayahNum
    );

    if (currIdx >= 0 && currIdx < activeAyahs.length - 1) {
      const nextA = activeAyahs[currIdx + 1];
      handlePlayAyah(nextA.surah.number, nextA.numberInSurah);
    } else {
      turnNext();
      setIsPlaying(false);
    }
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
      style={{
        width: "100%",
        height: "100vh",
        background: "radial-gradient(circle at center, #180e05 0%, #080402 100%)",
        color: "#ebd8b0",
        fontFamily: "'Amiri Quran', serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px 14px",
        boxSizing: "border-box",
        position: "relative",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      <audio ref={audioRef} onEnded={handleAudioEnded} />

      {/* ── Top Header Navigation Bar ───────────────────────────────── */}
      <header
        style={{
          width: "100%",
          maxWidth: 1080,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          padding: "8px 14px",
          background: "rgba(22, 13, 6, 0.9)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(212, 175, 55, 0.35)",
          borderRadius: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => navigate("/quran")}
            style={{
              background: "rgba(212, 175, 55, 0.12)",
              border: "1px solid rgba(212, 175, 55, 0.4)",
              color: "#d4af37",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "'Cinzel', serif",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>←</span>
            <span>SOURATES</span>
          </button>

          <button
            onClick={() => setShowSurahDrawer(true)}
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.22) 0%, rgba(138,107,35,0.22) 100%)",
              border: "1px solid rgba(212, 175, 55, 0.6)",
              color: "#ebd8b0",
              borderRadius: 8,
              padding: "6px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>📖</span>
            <span>INDEX DU MUSHAF</span>
          </button>
        </div>

        {/* Page / Juz Information */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontFamily: "'Cinzel', serif", color: "#d4af37", letterSpacing: 0.5 }}>
            {isSingleMode ? `PAGE ${rPage} / 604` : `PAGES ${rPage}–${lPage} / 604`}
          </span>

          <button
            onClick={toggleBookmark}
            title={bookmark === rPage ? "Retirer marque-page" : "Poser marque-page"}
            style={{
              background: bookmark === rPage ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${bookmark === rPage ? "#ffd700" : "rgba(255,255,255,0.15)"}`,
              color: bookmark === rPage ? "#ffd700" : "#a89060",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            🔖
          </button>
        </div>

        {/* Tajweed & 3D Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setShowTajweedDrawer((v) => !v)}
            style={{
              background: activeTajweedCount > 0 ? "rgba(6,182,212,0.25)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${activeTajweedCount > 0 ? "#06b6d4" : "rgba(255,255,255,0.15)"}`,
              color: activeTajweedCount > 0 ? "#22d3ee" : "#a89060",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "'Cinzel', serif",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>🎨</span>
            <span>TAJWEED</span>
            {activeTajweedCount > 0 && <span>({activeTajweedCount})</span>}
          </button>

          <button
            onClick={() => setShowViewSettings((v) => !v)}
            title="Options de rendu 3D"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#a89060",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ⚙️ 3D
          </button>

          <button
            onClick={reset3DView}
            title="Réinitialiser l'angle de vue"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#a89060",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "'Cinzel', serif",
            }}
          >
            RESET VUE
          </button>
        </div>
      </header>

      {/* ── 3D WebGL Canvas Container ───────────────────────────────── */}
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 1080,
          position: "relative",
          margin: "8px 0",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 25px 70px rgba(0,0,0,0.85), 0 0 0 1px rgba(212,175,55,0.25)",
        }}
      >
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleClickOnCanvas}
          style={{
            width: "100%",
            height: "100%",
            cursor: "grab",
          }}
        />

        {/* 3D Page Turn Floating Buttons */}
        <button
          onClick={turnPrev}
          disabled={spread <= 1}
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            width: 46,
            height: 68,
            borderRadius: "14px 0 0 14px",
            background: "rgba(22, 13, 6, 0.85)",
            border: "1px solid rgba(212, 175, 55, 0.4)",
            color: spread <= 1 ? "rgba(255,255,255,0.2)" : "#ffd700",
            fontSize: 22,
            cursor: spread <= 1 ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
            zIndex: 20,
          }}
          title="Page Précédente (Droite)"
        >
          ▶
        </button>

        <button
          onClick={turnNext}
          disabled={rPage >= _MUSHAF_PAGES}
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            width: 46,
            height: 68,
            borderRadius: "0 14px 14px 0",
            background: "rgba(22, 13, 6, 0.85)",
            border: "1px solid rgba(212, 175, 55, 0.4)",
            color: rPage >= _MUSHAF_PAGES ? "rgba(255,255,255,0.2)" : "#ffd700",
            fontSize: 22,
            cursor: rPage >= _MUSHAF_PAGES ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
            zIndex: 20,
          }}
          title="Page Suivante (Gauche)"
        >
          ◀
        </button>

        {/* 3D Interaction Hint */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(212, 175, 55, 0.25)",
            borderRadius: 20,
            padding: "4px 16px",
            fontSize: 11,
            color: "#c9a84c",
            pointerEvents: "none",
            letterSpacing: 0.5,
          }}
        >
          🖐️ Glissez pour incliner le Mushaf 3D • Touchez un verset pour l&apos;étudier
        </div>
      </main>

      {/* ── Bottom Audio & Scrubber Bar ─────────────────────────────── */}
      <footer
        style={{
          width: "100%",
          maxWidth: 1080,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          padding: "8px 16px",
          background: "rgba(22, 13, 6, 0.92)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(212, 175, 55, 0.35)",
          borderRadius: 14,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={togglePlayCurrentPage}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #d4af37 0%, #8b6d28 100%)",
              border: "none",
              color: "#0a0603",
              fontSize: 18,
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
              padding: "6px 8px",
              fontSize: 12,
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 220, maxWidth: 420 }}>
          <span style={{ fontSize: 11, color: "#a89060" }}>1</span>
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
          <span style={{ fontSize: 11, color: "#a89060" }}>604</span>
        </div>

        {/* Direct Page Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#d4af37" }}>Page :</span>
          <input
            type="number"
            min={1}
            max={604}
            value={rPage}
            onChange={(e) => jumpToPage(e.target.value)}
            style={{
              width: 58,
              padding: "4px 6px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(212,175,55,0.35)",
              borderRadius: 6,
              color: "#ffd700",
              textAlign: "center",
              fontSize: 13,
              fontWeight: "bold",
            }}
          />
        </div>
      </footer>

      {/* ── Selected Ayah Interactive Sheet ─────────────────────────── */}
      {selectedAyah && (
        <div
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
                onClick={() => navigate(`/quran/${selectedAyah.surahNum}/${selectedAyah.ayahNum}`)}
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
                Ouvrir dans le Coran ➔
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
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
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
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
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
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
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
                <span style={{ color: "#ebd8b0" }}>✨ Particules Dorées & Ambiance</span>
                <input
                  type="checkbox"
                  checked={showDust}
                  onChange={(e) => setShowDust(e.target.checked)}
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
                🔄 Réinitialiser l&apos;Angle & la Vue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
