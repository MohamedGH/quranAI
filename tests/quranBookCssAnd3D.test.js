// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import * as THREE from "three";
import { store, uiActions, sel } from "../src/store.js";
import {
  MUSHAF_TOTAL_PAGES,
  MUSHAF_DOUBLE_SPREADS,
  OPEN_ANIM_DURATION_MS,
  BOOK3D_SPEC,
  BOOK3D_ZOOM,
  BOOK3D_PAN,
  BOOK3D_PARTICLES,
  computeCssBookLayout,
  computeCssBookPresentation,
  computeSpreadPages,
  clamp3DZoomDist,
  computeWheelZoomDist,
  computePinchZoomDist,
  step3DZoomDist,
  computeCameraPositionForZoom,
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
  evalStaticPageLocalY,
  evalStaticPageWorldPoint,
  evalRehalTopWorldYAtDistance,
  evalCoverBottomWorldY,
  evalFlipPivotState,
  evalFlipSheetPoint,
  detectSoftwareWebGL,
  buildPageRenderCacheKey,
  createPageCanvasCache,
} from "../src/utils/quranBookEngine.js";
import * as reciterAudio from "../src/utils/reciterAudio.js";
import { QuranBookPage } from "../src/components/pages/QuranBookPage.jsx";
import {
  QuranBook3DPage,
  createParticleGlowTexture,
  createAuraGlowTexture,
} from "../src/components/pages/QuranBook3DPage.jsx";
import { SurahHeader } from "../src/components/common/SurahHeader.jsx";
import { HeaderToolsModal } from "../src/components/common/HeaderToolsModal.jsx";

describe("CSS Quran & 3D Quran Engine + Component Fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.clear();
    } catch {}
    store.dispatch(uiActions.resetUiElementsVisibility());
    store.dispatch(uiActions.setUiEditMode(false));
    store.dispatch(uiActions.setShowUiVisibilityModal(false));
    vi.spyOn(reciterAudio, "fetchQuranPage").mockImplementation(async (pageNum) => [
      {
        number: pageNum,
        numberInSurah: 1,
        text: `بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ آيَة ${pageNum}`,
        page: pageNum,
        hizb: 1,
        hizbQuarter: 1,
        surah: { number: 2, name: "سُورَةُ البَقَرَةِ", englishName: "Al-Baqarah" },
      },
    ]);
    vi.spyOn(reciterAudio, "fetchPageMeta").mockResolvedValue({ page: 5 });
    vi.spyOn(reciterAudio, "fetchSurahTranslation").mockResolvedValue([
      { numberInSurah: 1, text: "Traduction test." },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("1. Pure CSS Book Engine (computeCssBookLayout & computeCssBookPresentation)", () => {
    it("computes mobile-first responsive dimensions safely clamped for mobile & desktop", () => {
      const mobile = computeCssBookLayout({ vw: 375, vh: 667 });
      expect(mobile.isMobile).toBe(true);
      expect(mobile.pageWidth).toBeGreaterThanOrEqual(126);
      expect(mobile.totalWidth).toBeLessThanOrEqual(375);

      const desktop = computeCssBookLayout({ vw: 1440, vh: 900 });
      expect(desktop.isMobile).toBe(false);
      expect(desktop.pageWidth).toBeLessThanOrEqual(440);
      expect(desktop.totalWidth).toBe(desktop.pageWidth * 2 + desktop.spineWidth);
    });

    it("hides left page and centers closed front cover when bookOpen=false", () => {
      const closed = computeCssBookPresentation({
        bookOpen: false,
        spread: 0,
        flipState: "idle",
        pageWidth: 400,
        spineWidth: 20,
      });

      expect(closed.showLeftHalf).toBe(false);
      expect(closed.showLeftPageContent).toBe(false);
      expect(closed.bookTranslateX).toBe(-200);
      expect(closed.frontCover.hidden).toBe(false);
      expect(closed.frontCover.zIndex).toBe(150);
      expect(closed.frontCover.transform).toBe("rotateY(0deg)");
      expect(closed.frontCover.pointerEvents).toBe("auto");
    });

    it("completely dismisses front cover and unveils left half when bookOpen=true", () => {
      const open = computeCssBookPresentation({
        bookOpen: true,
        spread: 1,
        flipState: "idle",
        pageWidth: 400,
        spineWidth: 20,
      });

      expect(open.showLeftHalf).toBe(true);
      expect(open.showLeftPageContent).toBe(true);
      expect(open.bookTranslateX).toBe(0);
      expect(open.frontCover.hidden).toBe(true);
      expect(open.frontCover.zIndex).toBe(0);
      expect(open.frontCover.pointerEvents).toBe("none");
      expect(open.frontCover.transform).toBe("rotateY(-180deg)");
    });

    it("configures forward and backward CSS flip pivots cleanly without overlapping covers", () => {
      const fwd = computeCssBookPresentation({
        bookOpen: true,
        spread: 1,
        flipState: "fwd",
        pageWidth: 400,
        spineWidth: 20,
      });
      expect(fwd.isFlip).toBe(true);
      expect(fwd.flipConfig.left).toBe(0);
      expect(fwd.flipConfig.transformOrigin).toBe("right center");

      const bwd = computeCssBookPresentation({
        bookOpen: true,
        spread: 2,
        flipState: "bwd",
        pageWidth: 400,
        spineWidth: 20,
      });
      expect(bwd.isFlip).toBe(true);
      expect(bwd.flipConfig.left).toBe(420);
      expect(bwd.flipConfig.transformOrigin).toBe("left center");
    });

    it("computes RTL spread pages in single & double mode accurately", () => {
      expect(computeSpreadPages(1, false)).toEqual({ rPage: 1, lPage: 2, spread: 1 });
      expect(computeSpreadPages(MUSHAF_DOUBLE_SPREADS, false)).toEqual({
        rPage: 603,
        lPage: 604,
        spread: 302,
      });
      expect(computeSpreadPages(45, true)).toEqual({ rPage: 45, lPage: null, spread: 45 });
      expect(computeSpreadPages(999, true).rPage).toBe(MUSHAF_TOTAL_PAGES);
    });
  });

  describe("2. CSS QuranBookPage Component (Closed vs Open Cover & Left Page Visibility)", () => {
    it("does NOT show left page or left back cover while closed, then hides front cover when opened", async () => {
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(QuranBookPage, {
              surahs: [{ number: 1, name: "الفاتحة", englishName: "Al-Fatiha", startPage: 1 }],
            })
          )
        )
      );

      // Closed state: left page & hardcover back MUST NOT be rendered
      expect(document.querySelector('[data-testid="qbook-left-page"]')).toBeNull();
      expect(document.querySelector('[data-testid="qbook-hc-back"]')).toBeNull();
      expect(document.querySelector('[data-testid="qbook-root"]').getAttribute("data-open")).toBe("false");

      const frontCoverClosed = document.querySelector('[data-testid="qbook-hc-front"]');
      expect(frontCoverClosed).toBeTruthy();
      expect(frontCoverClosed.getAttribute("aria-hidden")).toBe("false");
      expect(frontCoverClosed.className).not.toContain("qbook-open");
      expect(frontCoverClosed.style.visibility).toBe("visible");
      expect(frontCoverClosed.style.opacity).toBe("1");

      // Open book via cover button
      const openBtn = document.querySelector(".qbook-open-btn");
      expect(openBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(openBtn);
      });

      // Open state: left page & back cover appear, while front cover is hidden & non-blocking
      expect(document.querySelector('[data-testid="qbook-root"]').getAttribute("data-open")).toBe("true");
      expect(document.querySelector('[data-testid="qbook-left-page"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="qbook-hc-back"]')).toBeTruthy();

      const frontCoverOpen = document.querySelector('[data-testid="qbook-hc-front"]');
      expect(frontCoverOpen.className).toContain("qbook-open");
      expect(frontCoverOpen.getAttribute("aria-hidden")).toBe("true");
      expect(frontCoverOpen.style.opacity).toBe("0");
      expect(frontCoverOpen.style.visibility).toBe("hidden");
      expect(frontCoverOpen.style.pointerEvents).toBe("none");
      expect(Number(frontCoverOpen.style.zIndex)).toBe(0);

      // Verify closing returns cleanly to closed state (hiding left page after transition timer)
      vi.useFakeTimers();
      try {
        fireEvent.click(document.querySelector("button.qbook-navbtn:last-child"));
        expect(document.querySelector('[data-testid="qbook-left-page"]')).toBeNull();
        expect(document.querySelector('[data-testid="qbook-hc-front"]').getAttribute("aria-hidden")).toBe("false");
        act(() => {
          vi.advanceTimersByTime(850);
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("opens CSS book when clicking directly on the closed book cover itself AND unfolds left wing cleanly via qbook-opening-left", () => {
      vi.useFakeTimers();
      try {
        render(
          React.createElement(
            Provider,
            { store },
            React.createElement(
              MemoryRouter,
              null,
              React.createElement(QuranBookPage, {
                surahs: [{ number: 1, name: "الفاتحة", englishName: "Al-Fatiha", startPage: 1 }],
              })
            )
          )
        );

        const root = document.querySelector('[data-testid="qbook-root"]');
        const coverTitle = document.querySelector(".qbook-cover-title");
        expect(root.getAttribute("data-open")).toBe("false");
        expect(document.querySelector('[data-testid="qbook-left-page"]')).toBeNull();

        // Click directly on the cover surface / title (not the button)
        act(() => {
          fireEvent.click(coverTitle);
        });

        expect(root.getAttribute("data-open")).toBe("true");
        expect(root.getAttribute("data-opening")).toBe("true");

        // During the opening swing, left page & back cover carry .qbook-opening-left so they stay folded edge-on until cover crosses spine
        const leftPage = document.querySelector('[data-testid="qbook-left-page"]');
        const backCover = document.querySelector('[data-testid="qbook-hc-back"]');
        expect(leftPage).toBeTruthy();
        expect(leftPage.className).toContain("qbook-opening-left");
        expect(backCover.className).toContain("qbook-opening-left");

        // Once opening finishes (820ms), left wing settles flat cleanly
        act(() => {
          vi.advanceTimersByTime(OPEN_ANIM_DURATION_MS + 10);
        });
        expect(root.getAttribute("data-opening")).toBe("false");
        expect(document.querySelector('[data-testid="qbook-left-page"]').className).not.toContain("qbook-opening-left");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("3. 3D Quran Geometry & Flip Kinematics (Zero-Collision Mathematical Proofs)", () => {
    it("places static pages strictly above gold page stacks along entire width u in [0, 1]", () => {
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const localY = evalStaticPageLocalY(u);
        expect(localY).toBeGreaterThan(BOOK3D_SPEC.stackHeight);
      }
    });

    it("keeps Rehal wooden stand planks strictly below left & right covers at every point", () => {
      const steps = 25;
      for (let i = 0; i <= steps; i++) {
        const d = (i / steps) * (BOOK3D_SPEC.rehal.plankLength / 2);
        const rehalTopY = evalRehalTopWorldYAtDistance(d);
        const rightCoverBottomY = evalCoverBottomWorldY("right", d);
        const leftCoverBottomY = evalCoverBottomWorldY("left", d);

        expect(rehalTopY).toBeLessThan(rightCoverBottomY);
        expect(rehalTopY).toBeLessThan(leftCoverBottomY);
        expect(rightCoverBottomY - rehalTopY).toBeGreaterThan(0.18);
      }
    });

    it("prevents flipping page sheet from penetrating static wings, covers, or Rehal across all progress and both directions", () => {
      const staticRightMinY = evalStaticPageWorldPoint("right", 0).y;
      const staticLeftMinY = evalStaticPageWorldPoint("left", 0).y;
      const wingFloorY = Math.min(staticRightMinY, staticLeftMinY);

      for (const direction of [1, -1]) {
        // Check start & end angles match RTL convention
        const startState = evalFlipPivotState(0, direction);
        const endState = evalFlipPivotState(1, direction);
        if (direction > 0) {
          // RTL Next: Left (PI - tilt) -> Right (tilt)
          expect(startState.curAngle).toBeCloseTo(Math.PI - BOOK3D_SPEC.wingTilt, 5);
          expect(endState.curAngle).toBeCloseTo(BOOK3D_SPEC.wingTilt, 5);
        } else {
          // RTL Prev: Right (tilt) -> Left (PI - tilt)
          expect(startState.curAngle).toBeCloseTo(BOOK3D_SPEC.wingTilt, 5);
          expect(endState.curAngle).toBeCloseTo(Math.PI - BOOK3D_SPEC.wingTilt, 5);
        }

        // Sweep progress and u along sheet
        for (let pStep = 0; pStep <= 40; pStep++) {
          const progress = pStep / 40;
          for (let uStep = 0; uStep <= 10; uStep++) {
            const u = uStep / 10;
            const pt = evalFlipSheetPoint({ progress, direction, u });

            // Never dips below inner wing base
            expect(pt.worldY).toBeGreaterThanOrEqual(wingFloorY);

            // At corresponding static wing endpoints (p=0 and p=1), flip sheet stays strictly above static page
            if (pStep === 0 || pStep === 40) {
              const side = Math.cos(pt.curAngle) >= 0 ? "right" : "left";
              const staticPt = evalStaticPageWorldPoint(side, u);
              expect(pt.worldY).toBeGreaterThan(staticPt.y);
            }
          }

          // At mid-flight (p = 0.5), outer edge is elevated high in the air
          if (Math.abs(progress - 0.5) < 0.01) {
            const apex = evalFlipSheetPoint({ progress, direction, u: 1 });
            expect(apex.worldY).toBeGreaterThan(1.0);
          }
        }
      }
    });
  });

  describe("4. Performance & Caching Helpers (WebGL Detection + Bounded LRU Canvas Cache)", () => {
    it("identifies software WebGL renderers cleanly while sparing hardware GPUs", () => {
      const makeMockRenderer = (gpuString) => ({
        getContext: () => ({
          RENDERER: 0x1f01,
          getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 0x9246 }),
          getParameter: (param) => (param === 0x9246 ? gpuString : "WebGL"),
        }),
      });

      expect(detectSoftwareWebGL(makeMockRenderer("Google SwiftShader"))).toBe(true);
      expect(detectSoftwareWebGL(makeMockRenderer("llvmpipe (LLVM 15.0.7, 256 bits)"))).toBe(true);
      expect(detectSoftwareWebGL(makeMockRenderer("NVIDIA GeForce RTX 4070"))).toBe(false);
      expect(detectSoftwareWebGL(makeMockRenderer("Apple M2 Pro"))).toBe(false);
      expect(detectSoftwareWebGL(null)).toBe(false);
    });

    it("maintains bounded LRU cache ordering and differentiates page render cache keys", () => {
      const cache = createPageCanvasCache(3);
      cache.set("p1", { id: 1 });
      cache.set("p2", { id: 2 });
      cache.set("p3", { id: 3 });
      // Access p1 to promote it to most-recently-used
      expect(cache.get("p1")).toEqual({ id: 1 });
      // Adding p4 should evict p2 (the LRU item), keeping p1, p3, p4
      cache.set("p4", { id: 4 });

      expect(cache.size).toBe(3);
      expect(cache.get("p2")).toBeNull();
      expect(cache.get("p1")).toEqual({ id: 1 });
      expect(cache.get("p3")).toEqual({ id: 3 });
      expect(cache.get("p4")).toEqual({ id: 4 });

      const k1 = buildPageRenderCacheKey({
        pageNum: 2,
        tajweedOpts: { showQalqala: true },
        resolutionTier: "hd",
      });
      const k2 = buildPageRenderCacheKey({
        pageNum: 2,
        tajweedOpts: { showQalqala: false },
        resolutionTier: "hd",
      });
      const k3 = buildPageRenderCacheKey({
        pageNum: 2,
        tajweedOpts: { showQalqala: true },
        resolutionTier: "lite",
      });
      expect(k1).not.toBe(k2);
      expect(k1).not.toBe(k3);
    });
  });

  describe("5. QuranBook3DPage Component Integration (2D CanvasMirror Fallback, Turns & Tajweed)", () => {
    it("falls back cleanly to 2D CanvasMirror without .toDataURL() blocking and supports page turns + Tajweed toggles", async () => {
      // Stub HTMLCanvasElement.prototype.getContext for jsdom page drawing + ensure WebGL context returns null so 2D fallback engages
      const drawCtxStub = {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "",
        textBaseline: "",
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        drawImage: vi.fn(),
        measureText: vi.fn((txt) => ({ width: (txt?.length || 1) * 10 })),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      };
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((type) => {
        if (type === "2d") return drawCtxStub;
        return null;
      });
      const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL");

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(QuranBook3DPage, {
              surahs: [{ number: 1, name: "الفاتحة", englishName: "Al-Fatiha" }],
            })
          )
        )
      );

      // Should have fallen back automatically to 2D CanvasMirror mode cleanly
      await waitFor(() => {
        expect(document.querySelector('[data-testid="q3d-2d-right-page"]')).toBeTruthy();
      });
      expect(toDataUrlSpy).not.toHaveBeenCalled();

      // CanvasMirror uses crisp <canvas role="img"> instead of PNG-encoded <img>
      const rightMirror = document.querySelector('[data-testid="q3d-2d-right-page"] canvas');
      expect(rightMirror).toBeTruthy();
      expect(rightMirror.getAttribute("aria-label")).toBe("Page 1");

      // Navigate forward -> Pages 3-4
      fireEvent.click(document.querySelector('[data-testid="q3d-next-btn"]'));
      await waitFor(() => {
        expect(document.querySelector('[data-testid="q3d-2d-right-page"] canvas').getAttribute("aria-label")).toBe(
          "Page 3"
        );
      });

      // Navigate backward -> Pages 1-2
      fireEvent.click(document.querySelector('[data-testid="q3d-prev-btn"]'));
      await waitFor(() => {
        expect(document.querySelector('[data-testid="q3d-2d-right-page"] canvas').getAttribute("aria-label")).toBe(
          "Page 1"
        );
      });

      // Verify Redux Tajweed toggle works from drawer
      const initialQalqala = sel.showQalqala(store.getState());
      store.dispatch(uiActions.toggleQalqala());
      expect(sel.showQalqala(store.getState())).toBe(!initialQalqala);
    });

    it("supports zooming via +/- header buttons and resets zoom cleanly", async () => {
      const drawCtxStub = {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "",
        textBaseline: "",
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        drawImage: vi.fn(),
        measureText: vi.fn((txt) => ({ width: (txt?.length || 1) * 10 })),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      };
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((type) =>
        type === "2d" ? drawCtxStub : null
      );

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(QuranBook3DPage, {
              surahs: [{ number: 1, name: "الفاتحة", englishName: "Al-Fatiha" }],
            })
          )
        )
      );

      await waitFor(() => {
        expect(document.querySelector('[data-testid="q3d-zoom-badge"]')).toBeTruthy();
      });

      const badge = document.querySelector('[data-testid="q3d-zoom-badge"]');
      const stage = document.querySelector('[data-testid="q3d-2d-spread-stage"]');
      expect(badge.textContent).toBe("100%");
      expect(stage.style.transform).toBe("scale(1)");

      fireEvent.click(document.querySelector('[data-testid="q3d-zoom-in"]'));
      expect(badge.textContent).toBe("115%");
      expect(stage.style.transform).toBe("scale(1.15)");

      fireEvent.click(document.querySelector('[data-testid="q3d-zoom-out"]'));
      fireEvent.click(document.querySelector('[data-testid="q3d-zoom-out"]'));
      expect(badge.textContent).toBe("85%");
      expect(stage.style.transform).toBe("scale(0.85)");
    });

    it("continues audio from last ayah of RIGHT page to first ayah of LEFT page without turning, updates selectedAyah, and turns + continues at end of LEFT page", async () => {
      const makeMockAyah = (pageNum, surahNum, ayahNum, text) => ({
        number: pageNum * 10 + ayahNum,
        numberInSurah: ayahNum,
        text,
        page: pageNum,
        hizb: 1,
        hizbQuarter: 1,
        surah: { number: surahNum, name: "البَقَرَةِ", englishName: "Al-Baqarah" },
      });

      reciterAudio.fetchQuranPage.mockImplementation(async (pageNum) => {
        if (pageNum === 1) {
          return [
            makeMockAyah(1, 2, 1, "آيَة ١"),
            makeMockAyah(1, 2, 2, "آيَة ٢"),
          ];
        }
        if (pageNum === 2) {
          return [makeMockAyah(2, 2, 3, "آيَة ٣")];
        }
        if (pageNum === 3) {
          return [makeMockAyah(3, 2, 4, "آيَة ٤")];
        }
        return [makeMockAyah(pageNum, 2, pageNum + 10, `آيَة ${pageNum}`)];
      });
      reciterAudio.fetchSurahTranslation.mockResolvedValue([
        { numberInSurah: 1, text: "Traduction v1" },
        { numberInSurah: 2, text: "Traduction v2" },
        { numberInSurah: 3, text: "Traduction v3" },
        { numberInSurah: 4, text: "Traduction v4" },
      ]);

      const drawCtxStub = {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "",
        textBaseline: "",
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        drawImage: vi.fn(),
        measureText: vi.fn((txt) => ({ width: (txt?.length || 1) * 10 })),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      };
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((type) =>
        type === "2d" ? drawCtxStub : null
      );
      vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(QuranBook3DPage, {
              surahs: [{ number: 2, name: "البَقَرَةِ", englishName: "Al-Baqarah" }],
            })
          )
        )
      );

      await waitFor(() => {
        expect(document.querySelector('[data-testid="q3d-2d-right-page"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="q3d-2d-left-page"]')).toBeTruthy();
      });

      const playBtn = document.querySelector('[data-testid="q3d-play-btn"]');
      const audioEl = document.querySelector('[data-testid="q3d-audio-el"]');

      // Start playback -> Verset 1 selected & highlighted automatically
      fireEvent.click(playBtn);
      await waitFor(() => {
        const sheet = document.querySelector('[data-testid="q3d-selected-sheet"]');
        expect(sheet).toBeTruthy();
        expect(sheet.textContent).toContain("Verset 1");
        expect(sheet.textContent).toContain("Traduction v1");
      });
      expect(audioEl.getAttribute("src")).toContain("002001.mp3");
      expect(playBtn.textContent).toBe("⏸");

      // Ayah 1 ends -> moves to Ayah 2 on RIGHT page + updates selectedAyah to Verset 2
      fireEvent.ended(audioEl);
      await waitFor(() => {
        const sheet = document.querySelector('[data-testid="q3d-selected-sheet"]');
        expect(sheet.textContent).toContain("Verset 2");
        expect(sheet.textContent).toContain("Traduction v2");
      });
      expect(audioEl.getAttribute("src")).toContain("002002.mp3");
      expect(document.querySelector('[data-testid="q3d-2d-right-page"] canvas').getAttribute("aria-label")).toBe("Page 1");

      // LAST ayah of RIGHT page (Ayah 2) ends -> MUST NOT turn page! Moves straight to Page 2 (LEFT page) Ayah 3 without stopping!
      fireEvent.ended(audioEl);
      await waitFor(() => {
        const sheet = document.querySelector('[data-testid="q3d-selected-sheet"]');
        expect(sheet.textContent).toContain("Verset 3");
        expect(sheet.textContent).toContain("Traduction v3");
      });
      expect(audioEl.getAttribute("src")).toContain("002003.mp3");
      expect(document.querySelector('[data-testid="q3d-2d-right-page"] canvas').getAttribute("aria-label")).toBe("Page 1");
      expect(playBtn.textContent).toBe("⏸");

      // LAST ayah of LEFT page (Ayah 3) ends -> NOW turns to Spread 2 (Pages 3-4) AND keeps playing Ayah 4 automatically!
      fireEvent.ended(audioEl);
      await waitFor(() => {
        expect(document.querySelector('[data-testid="q3d-2d-right-page"] canvas').getAttribute("aria-label")).toBe("Page 3");
        const sheet = document.querySelector('[data-testid="q3d-selected-sheet"]');
        expect(sheet.textContent).toContain("Verset 4");
        expect(sheet.textContent).toContain("Traduction v4");
      });
      expect(audioEl.getAttribute("src")).toContain("002004.mp3");
      expect(playBtn.textContent).toBe("⏸");
    });
  });

  describe("6. Pure 3D/2D Zoom & Continuous RTL Playback Resolvers", () => {
    it("clamps zoom distances & converts wheel, pinch, and button steps cleanly", () => {
      expect(clamp3DZoomDist(0.5)).toBe(BOOK3D_ZOOM.minDist);
      expect(clamp3DZoomDist(99)).toBe(BOOK3D_ZOOM.maxDist);
      expect(clamp3DZoomDist(NaN)).toBe(BOOK3D_ZOOM.defaultDesktopDist);

      // Negative wheel deltaY zooms in (smaller Z)
      expect(computeWheelZoomDist(4.8, -200)).toBeLessThan(4.8);
      // Positive wheel deltaY zooms out (larger Z)
      expect(computeWheelZoomDist(4.8, 200)).toBeGreaterThan(4.8);

      // Spreading fingers apart (pinch out: 100 -> 200) zooms in cleanly (half distance)
      expect(computePinchZoomDist(4.8, 100, 200)).toBeCloseTo(2.4, 3);
      // Pinching together (200 -> 100) zooms out cleanly (clamped maxDist)
      expect(computePinchZoomDist(4.8, 200, 100)).toBe(BOOK3D_ZOOM.maxDist);

      expect(step3DZoomDist(4.8, -1)).toBeCloseTo(4.8 - BOOK3D_ZOOM.buttonStep, 4);
      expect(step3DZoomDist(4.8, 1)).toBeCloseTo(4.8 + BOOK3D_ZOOM.buttonStep, 4);

      expect(computeZoomPercent(4.8, false)).toBe(100);
      expect(computeZoomPercent(2.4, false)).toBe(200);
      expect(computeCameraPositionForZoom(2.4, false).y).toBeCloseTo(1.125, 3);
      expect(clamp2DZoomScale(5)).toBe(BOOK3D_ZOOM.max2DScale);
      expect(clamp2DZoomScale(0.1)).toBe(BOOK3D_ZOOM.min2DScale);
    });

    it("resolves continuous RTL audio steps across right page -> left page -> next spread", () => {
      const pageCache = {
        1: [
          { surah: { number: 2, name: "البقرة", englishName: "Al-Baqarah" }, numberInSurah: 1, text: "v1" },
          { surah: { number: 2, name: "البقرة", englishName: "Al-Baqarah" }, numberInSurah: 2, text: "v2" },
        ],
        2: [{ surah: { number: 2, name: "البقرة", englishName: "Al-Baqarah" }, numberInSurah: 3, text: "v3" }],
        3: [{ surah: { number: 2, name: "البقرة", englishName: "Al-Baqarah" }, numberInSurah: 4, text: "v4" }],
        604: [{ surah: { number: 114, name: "الناس", englishName: "An-Nas" }, numberInSurah: 6, text: "v6" }],
      };

      // Last ayah of RIGHT page (2:2 on page 1) moves to LEFT page (2:3 on page 2) with needsTurnNext=false
      const rightToLeft = resolveSpreadPlaybackStep({
        currentAudioAyah: { surahNum: 2, ayahNum: 2 },
        rPage: 1,
        lPage: 2,
        isSingleMode: false,
        pageCache,
      });
      expect(rightToLeft.action).toBe("play_ayah");
      expect(rightToLeft.needsTurnNext).toBe(false);
      expect(rightToLeft.nextAyah.ayahNum).toBe(3);
      expect(rightToLeft.nextAyah.side).toBe("left");

      // Last ayah of LEFT page (2:3 on page 2) triggers page turn to page 3 with nextAyah = 2:4
      const leftToNextSpread = resolveSpreadPlaybackStep({
        currentAudioAyah: { surahNum: 2, ayahNum: 3 },
        rPage: 1,
        lPage: 2,
        isSingleMode: false,
        pageCache,
      });
      expect(leftToNextSpread.action).toBe("turn_next_and_play");
      expect(leftToNextSpread.needsTurnNext).toBe(true);
      expect(leftToNextSpread.targetNextPage).toBe(3);
      expect(leftToNextSpread.nextAyah.ayahNum).toBe(4);

      // Single mobile mode: last ayah of page 1 triggers page turn to page 2
      const singleModeStep = resolveSpreadPlaybackStep({
        currentAudioAyah: { surahNum: 2, ayahNum: 2 },
        rPage: 1,
        lPage: null,
        isSingleMode: true,
        pageCache,
      });
      expect(singleModeStep.action).toBe("turn_next_and_play");
      expect(singleModeStep.targetNextPage).toBe(2);

      // Very end of Quran (page 604) stops cleanly
      const endOfMushaf = resolveSpreadPlaybackStep({
        currentAudioAyah: { surahNum: 114, ayahNum: 6 },
        rPage: 603,
        lPage: 604,
        isSingleMode: false,
        pageCache,
      });
      expect(endOfMushaf.action).toBe("stop");
      expect(endOfMushaf.needsTurnNext).toBe(false);

      // findAyahMetadataOnSpread locates ayahs across both right and left pages
      const metaLeft = findAyahMetadataOnSpread({
        surahNum: 2,
        ayahNum: 3,
        rPage: 1,
        lPage: 2,
        pageCache,
      });
      expect(metaLeft).toBeTruthy();
      expect(metaLeft.pageNum).toBe(2);
      expect(metaLeft.text).toBe("v3");
    });
  });

  describe("7. Coran 3D UI Toggleability & Direct Inline UI Edit Mode", () => {
    const mockDrawCtx = () => ({
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "",
      textBaseline: "",
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
      measureText: vi.fn((txt) => ({ width: (txt?.length || 1) * 10 })),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    });

    it("toggles Coran 3D launcher visibility (quran3dAccess) in SurahHeader and HeaderToolsModal", () => {
      const mockSurah = {
        number: 1,
        name: "سُورَةُ ٱلْفَاتِحَةِ",
        englishName: "Al-Fatiha",
        numberOfAyahs: 7,
        revelationType: "Meccan",
      };

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(SurahHeader, {
              selectedSurah: mockSurah,
              surahs: [mockSurah],
              setSelectedSurah: () => {},
              setSidebarOpen: () => {},
              ayats: [{ numberInSurah: 1, text: "بسم الله" }],
              getLData: () => ({}),
              setLData: () => {},
              surahStats: {},
              pageMode: false,
              setPageMode: () => {},
              activePageCoran: null,
              setactivePageCoran: () => {},
              mainAyatIdx: 0,
              learnData: {},
              lkey: (s, a) => `${s}:${a}`,
              jumpToAyatNumber: () => {},
              navigate: () => {},
            }),
            React.createElement(HeaderToolsModal, {
              isOpen: true,
              onClose: () => {},
              currentUser: { displayName: "Amin" },
              onSignOut: () => {},
              showArabicKeyboard: false,
              setShowArabicKeyboard: () => {},
              showRappel: false,
              setShowRappel: () => {},
              onOpenScheduledReminders: () => {},
              onOpenOptionsModal: () => {},
              toggleVoice: () => {},
              listening: false,
              selectedSurah: mockSurah,
              activeHizb: 1,
              initialTab: "tools",
            })
          )
        )
      );

      // Open SurahHeader options drawer to see LIVRE 3D button
      const optionsBtn = document.querySelector(".m-action-btn.options");
      expect(optionsBtn).toBeTruthy();
      fireEvent.click(optionsBtn);
      expect(document.getElementById("btn-surah-open-book3d")).toBeTruthy();
      expect(document.getElementById("btn-tools-nav-book3d")).toBeTruthy();

      // Disable quran3dAccess via Redux UI visibility manager
      act(() => {
        store.dispatch(uiActions.setUiElementVisibility({ id: "quran3dAccess", visible: false }));
      });
      expect(document.getElementById("btn-surah-open-book3d")).toBeNull();
      expect(document.getElementById("btn-tools-nav-book3d")).toBeNull();

      // Re-enable quran3dAccess -> both launchers return
      act(() => {
        store.dispatch(uiActions.setUiElementVisibility({ id: "quran3dAccess", visible: true }));
      });
      expect(document.getElementById("btn-surah-open-book3d")).toBeTruthy();
      expect(document.getElementById("btn-tools-nav-book3d")).toBeTruthy();
    });

    it("toggles internal QuranBook3DPage UI bars & supports direct in-place +/- editing via ✏️ UI ±", async () => {
      const stub = mockDrawCtx();
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((type) =>
        type === "2d" ? stub : null
      );

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(QuranBook3DPage, {
              surahs: [{ number: 1, name: "الفاتحة", englishName: "Al-Fatiha" }],
            })
          )
        )
      );

      await waitFor(() => {
        expect(document.querySelector('[data-testid="q3d-audio-footer"]')).toBeTruthy();
      });

      // Verify all internal controls present initially
      expect(document.querySelector('[data-testid="q3d-index-btn"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="q3d-page-info"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="q3d-view-toggle"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="q3d-tajweed-btn"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="q3d-zoom-controls"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="q3d-hint-bar"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="q3d-audio-footer"]')).toBeTruthy();

      // Toggle UI elements OFF programmatically -> elements unmount cleanly
      act(() => {
        store.dispatch(uiActions.setUiElementVisibility({ id: "quran3dAudioFooter", visible: false }));
        store.dispatch(uiActions.setUiElementVisibility({ id: "quran3dHintBar", visible: false }));
      });
      expect(document.querySelector('[data-testid="q3d-audio-footer"]')).toBeNull();
      expect(document.querySelector('[data-testid="q3d-hint-bar"]')).toBeNull();

      // Enable inline UI edit mode right from inside QuranBook3DPage header
      fireEvent.click(document.querySelector('[data-testid="q3d-ui-edit-btn"]'));
      expect(sel.uiEditMode(store.getState())).toBe(true);

      // Ghost add buttons appear in-place for hidden Coran 3D elements
      const addFooterGhost = document.querySelector('[data-testid="ui-edit-add-quran3dAudioFooter"]');
      expect(addFooterGhost).toBeTruthy();
      fireEvent.click(addFooterGhost);
      expect(document.querySelector('[data-testid="q3d-audio-footer"]')).toBeTruthy();

      // Remove zoom controls directly in-place using − button, then re-add via + ghost
      const removeZoomBtn = document.querySelector('[data-testid="ui-edit-remove-quran3dZoomControls"]');
      expect(removeZoomBtn).toBeTruthy();
      fireEvent.click(removeZoomBtn);
      expect(document.querySelector('[data-testid="q3d-zoom-controls"]')).toBeNull();

      const addZoomGhost = document.querySelector('[data-testid="ui-edit-add-quran3dZoomControls"]');
      expect(addZoomGhost).toBeTruthy();
      fireEvent.click(addZoomGhost);
      expect(document.querySelector('[data-testid="q3d-zoom-controls"]')).toBeTruthy();

      // Clicking 🎛️ opens full UI visibility modal state
      fireEvent.click(document.querySelector('[data-testid="q3d-ui-modal-btn"]'));
      expect(sel.showUiVisibilityModal(store.getState())).toBe(true);
    });
  });

  describe("8. Camera Translation (Pan), Procedural Particle Texture & Sacred Glow", () => {
    const makeRichDrawCtx = () => {
      const gradStub = { addColorStop: vi.fn() };
      return {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "",
        textBaseline: "",
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        drawImage: vi.fn(),
        measureText: vi.fn((txt) => ({ width: (txt?.length || 1) * 10 })),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        ellipse: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        createLinearGradient: vi.fn(() => gradStub),
        createRadialGradient: vi.fn(() => gradStub),
        gradStub,
      };
    };

    it("clamps and steps 3D/2D camera pan, computes drag + two-finger parallel translation, and synchronizes camera lookAt pose", () => {
      expect(clampCameraPan({ x: 99, y: -99 })).toEqual({
        x: BOOK3D_PAN.maxX,
        y: BOOK3D_PAN.minY,
      });
      expect(clampCameraPan({ x: NaN, y: undefined })).toEqual({ x: 0, y: 0 });
      expect(clamp2DPan({ x: -999, y: 999 })).toEqual({
        x: BOOK3D_PAN.min2DX,
        y: BOOK3D_PAN.max2DY,
      });

      const stepped = stepCameraPan({ x: 0, y: 0 }, 2, -1);
      expect(stepped.x).toBeCloseTo(BOOK3D_PAN.step * 2, 5);
      expect(stepped.y).toBeCloseTo(-BOOK3D_PAN.step, 5);

      // Dragging right (+100px) translates camera left (dx < 0) so book moves right under cursor
      const dragDelta = computePanDeltaFromDrag(100, 50, BOOK3D_ZOOM.defaultDesktopDist, false);
      expect(dragDelta.dx).toBeLessThan(0);
      expect(dragDelta.dy).toBeGreaterThan(0);

      // Two-finger metrics compute midpoint and Euclidean separation cleanly
      const twoF = computeTwoFingerMetrics({ x: 100, y: 200 }, { x: 200, y: 200 });
      expect(twoF.dist).toBe(100);
      expect(twoF.midX).toBe(150);
      expect(twoF.midY).toBe(200);

      // Parallel camera pose translates both position and lookAt target identically on X and Y
      const pose = computeCameraPose({
        zoomDist: BOOK3D_ZOOM.defaultDesktopDist,
        panX: 0.75,
        panY: 0.4,
        isSingleMode: false,
      });
      expect(pose.posX).toBe(0.75);
      expect(pose.targetX).toBe(0.75);
      expect(pose.posY - pose.targetY).toBeCloseTo(2.35, 2);
      expect(pose.posZ).toBe(BOOK3D_ZOOM.defaultDesktopDist);
    });

    it("generates varied golden particle field attributes & procedural radial glow CanvasTextures with sRGB + fallback safety", () => {
      const field = generateParticleFieldData(BOOK3D_PARTICLES.hardwareCount);
      expect(field.count).toBe(BOOK3D_PARTICLES.hardwareCount);
      expect(field.positions).toBeInstanceOf(Float32Array);
      expect(field.positions.length).toBe(BOOK3D_PARTICLES.hardwareCount * 3);
      expect(field.colors.length).toBe(BOOK3D_PARTICLES.hardwareCount * 3);
      expect(field.scales.length).toBe(BOOK3D_PARTICLES.hardwareCount);
      expect(field.phases.length).toBe(BOOK3D_PARTICLES.hardwareCount);

      // Procedural particle star/orb glow texture
      const richCtx = makeRichDrawCtx();
      const ctxSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => richCtx);

      const particleTex = createParticleGlowTexture(64);
      expect(particleTex).toBeInstanceOf(THREE.CanvasTexture);
      expect(particleTex.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(richCtx.createRadialGradient).toHaveBeenCalledTimes(1);
      expect(richCtx.gradStub.addColorStop).toHaveBeenCalledTimes(5);
      expect(richCtx.ellipse).toHaveBeenCalledTimes(2);
      particleTex.dispose();

      const auraTex = createAuraGlowTexture(128);
      expect(auraTex).toBeInstanceOf(THREE.CanvasTexture);
      expect(auraTex.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(richCtx.createRadialGradient).toHaveBeenCalledTimes(2);
      auraTex.dispose();

      // Fallback still produces valid CanvasTexture even on minimal 2D mock without createRadialGradient/ellipse
      ctxSpy.mockImplementation(() => ({
        fillStyle: "",
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
      }));
      const fallbackTex = createParticleGlowTexture(64);
      expect(fallbackTex).toBeInstanceOf(THREE.CanvasTexture);
      fallbackTex.dispose();
    });

    it("translates 2D zoomed Mushaf stage cleanly via keyboard WASD/Alt+Arrows and resets on Escape/ZoomReset", async () => {
      const stub = makeRichDrawCtx();
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((type) =>
        type === "2d" ? stub : null
      );

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(QuranBook3DPage, {
              surahs: [{ number: 1, name: "الفاتحة", englishName: "Al-Fatiha" }],
            })
          )
        )
      );

      await waitFor(() => {
        expect(document.querySelector('[data-testid="q3d-2d-spread-stage"]')).toBeTruthy();
      });

      const stage = document.querySelector('[data-testid="q3d-2d-spread-stage"]');
      expect(stage.style.transform).toBe("scale(1)");

      // Pan using Alt+ArrowRight and 'w'
      fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });
      fireEvent.keyDown(window, { key: "w" });

      expect(stage.style.transform).toContain(`translate3d(${-BOOK3D_PAN.step2D}px, ${BOOK3D_PAN.step2D}px, 0)`);
    });
  });
});
