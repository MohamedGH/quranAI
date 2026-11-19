// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { store, uiActions, sel } from "../src/store.js";
import {
  MUSHAF_TOTAL_PAGES,
  MUSHAF_DOUBLE_SPREADS,
  BOOK3D_SPEC,
  computeCssBookLayout,
  computeCssBookPresentation,
  computeSpreadPages,
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
import { QuranBook3DPage } from "../src/components/pages/QuranBook3DPage.jsx";

describe("CSS Quran & 3D Quran Engine + Component Fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.clear();
    } catch {}
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
  });
});
