// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();

  class MockWebGLRenderer {
    constructor() {
      this.domElement = document.createElement("canvas");
      this.debug = { checkShaderErrors: false };
      this.capabilities = { getMaxAnisotropy: () => 4 };
      this.shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: actual.PCFSoftShadowMap };
      this.toneMapping = actual.ACESFilmicToneMapping;
      this.toneMappingExposure = 1;
      this.outputColorSpace = actual.SRGBColorSpace;
      this._pixelRatio = 1;
    }
    setSize() {}
    setPixelRatio(r) { this._pixelRatio = r; }
    getPixelRatio() { return this._pixelRatio; }
    getContext() {
      return {
        RENDERER: 0x1f01,
        getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 0x9246 }),
        getParameter: () => "Mock WebGL Renderer",
      };
    }
    compile() {}
    render() {}
    dispose() {}
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

import { store, playerActions, sel } from "../src/store.js";
import {
  MIN_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  DEFAULT_PLAYBACK_RATE,
  AUDIO_PLAYBACK_RATES,
  clampPlaybackRate,
  formatPlaybackRate,
  getNextPlaybackRate,
  applyAudioPlaybackRate,
  safeLoadAudio,
} from "../src/utils/safeAudioPlayer.js";
import { PlaybackSpeedControl } from "../src/components/audio/PlaybackSpeedControl.jsx";
import { OptionsModal } from "../src/components/sync/OptionsModal.jsx";
import { PlayerAudioOptionsModal } from "../src/components/common/PlayerAudioOptionsModal.jsx";
import { LectureMode } from "../src/components/modes/LectureMode.jsx";
import { AyatFullScreenModal } from "../src/components/common/AyatFullScreenModal.jsx";
import { QuranBook3DPage, resetBook3DWebGLCache } from "../src/components/pages/QuranBook3DPage.jsx";
import * as reciterAudio from "../src/utils/reciterAudio.js";

describe("Audio Playback Speed Selection & Global Synchronization", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    store.dispatch(playerActions.resetPlaybackRate());
    resetBook3DWebGLCache();

    const gradStub = { addColorStop: vi.fn() };
    const ctxStub = {
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
      translate: vi.fn(),
      scale: vi.fn(),
      createLinearGradient: vi.fn(() => gradStub),
      createRadialGradient: vi.fn(() => gradStub),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ctxStub);

    vi.spyOn(reciterAudio, "fetchQuranPage").mockResolvedValue([
      {
        number: 1,
        numberInSurah: 1,
        text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
        page: 1,
        surah: { number: 1, name: "الفاتحة", englishName: "Al-Fatiha" },
      },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("1. Pure Playback Rate Helpers", () => {
    it("clamps rates into [0.5, 2.0] in 0.05 steps and handles invalid input safely", () => {
      expect(clampPlaybackRate(0.1)).toBe(MIN_PLAYBACK_RATE);
      expect(clampPlaybackRate(3.5)).toBe(MAX_PLAYBACK_RATE);
      expect(clampPlaybackRate(-1)).toBe(DEFAULT_PLAYBACK_RATE);
      expect(clampPlaybackRate("invalid")).toBe(DEFAULT_PLAYBACK_RATE);
      expect(clampPlaybackRate(1.23)).toBe(1.25);
      expect(clampPlaybackRate(0.75)).toBe(0.75);
    });

    it("formats concise playback speed labels", () => {
      expect(formatPlaybackRate(1)).toBe("1×");
      expect(formatPlaybackRate(0.75)).toBe("0.75×");
      expect(formatPlaybackRate(1.5)).toBe("1.5×");
      expect(formatPlaybackRate(2)).toBe("2×");
    });

    it("cycles across standard playback speeds and wraps from 2× back to 0.5×", () => {
      expect(getNextPlaybackRate(1.0)).toBe(1.25);
      expect(getNextPlaybackRate(1.5)).toBe(2.0);
      expect(getNextPlaybackRate(2.0)).toBe(0.5);
    });

    it("applies defaultPlaybackRate and playbackRate and preserves speed across safeLoadAudio()", () => {
      const mockAudio = {
        defaultPlaybackRate: 1,
        playbackRate: 1,
        load: vi.fn(function () {
          // Simulate HTMLMediaElement resetting playbackRate to 1 on load()
          this.playbackRate = 1;
        }),
      };

      applyAudioPlaybackRate(mockAudio, 0.75);
      expect(mockAudio.defaultPlaybackRate).toBe(0.75);
      expect(mockAudio.playbackRate).toBe(0.75);

      // Even if something briefly bumped playbackRate back to 1 before load(), defaultPlaybackRate is 0.75
      expect(safeLoadAudio(mockAudio)).toBe(true);
      expect(mockAudio.load).toHaveBeenCalledTimes(1);
      expect(mockAudio.playbackRate).toBe(0.75);
      expect(mockAudio.defaultPlaybackRate).toBe(0.75);
    });
  });

  describe("2. Redux State & Persistence", () => {
    it("updates, cycles, resets, clamps, and persists playbackRate under quran_playbackRate", () => {
      expect(sel.playbackRate(store.getState())).toBe(1);

      store.dispatch(playerActions.setPlaybackRate(1.5));
      expect(sel.playbackRate(store.getState())).toBe(1.5);
      expect(JSON.parse(localStorage.getItem("quran_playbackRate"))).toBe(1.5);

      store.dispatch(playerActions.cyclePlaybackRate());
      expect(sel.playbackRate(store.getState())).toBe(2);

      store.dispatch(playerActions.setPlaybackRate(99));
      expect(sel.playbackRate(store.getState())).toBe(2);

      store.dispatch(playerActions.resetPlaybackRate());
      expect(sel.playbackRate(store.getState())).toBe(1);
      expect(JSON.parse(localStorage.getItem("quran_playbackRate"))).toBe(1);
    });
  });

  describe("3. Reusable PlaybackSpeedControl Variants", () => {
    it("renders compact select and updates Redux store on change, including custom slider rates", () => {
      const { container } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(PlaybackSpeedControl, { variant: "select", testId: "unit-speed-select" })
        )
      );

      const selectEl = container.querySelector('[data-testid="unit-speed-select"]');
      expect(selectEl).toBeTruthy();
      expect(Number(selectEl.value)).toBe(1);
      expect(selectEl.querySelectorAll("option").length).toBe(AUDIO_PLAYBACK_RATES.length);

      fireEvent.change(selectEl, { target: { value: "0.75" } });
      expect(sel.playbackRate(store.getState())).toBe(0.75);
      expect(Number(selectEl.value)).toBe(0.75);

      // Non-preset rate (e.g. from slider 1.15) should appear cleanly as a selectable option
      act(() => {
        store.dispatch(playerActions.setPlaybackRate(1.15));
      });
      expect(Number(selectEl.value)).toBe(1.15);
      expect(selectEl.textContent).toContain("1.15×");
    });

    it("renders panel with preset buttons, fine range slider, and reset action", () => {
      const { container } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(PlaybackSpeedControl, {
            variant: "panel",
            testId: "unit-speed-panel",
            sliderTestId: "unit-speed-slider",
          })
        )
      );

      const preset075 = container.querySelector('[data-testid="unit-speed-panel-preset-0_75"]');
      const slider = container.querySelector('[data-testid="unit-speed-slider"]');
      const resetBtn = container.querySelector('[data-testid="unit-speed-panel-reset"]');

      expect(preset075).toBeTruthy();
      expect(slider).toBeTruthy();
      expect(resetBtn).toBeTruthy();

      fireEvent.click(preset075);
      expect(sel.playbackRate(store.getState())).toBe(0.75);
      expect(Number(slider.value)).toBe(0.75);

      fireEvent.change(slider, { target: { value: "1.35" } });
      expect(sel.playbackRate(store.getState())).toBe(1.35);

      fireEvent.click(resetBtn);
      expect(sel.playbackRate(store.getState())).toBe(1);
    });
  });

  describe("4. Integration Across Modals & Players", () => {
    it("exposes audio playback speed panel inside OptionsModal settings tab", () => {
      const { unmount } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(OptionsModal, { onClose: () => {} })
        )
      );

      fireEvent.click(document.getElementById("options-tab-settings"));
      const panel = document.querySelector('[data-testid="options-playback-rate-panel"]');
      const slider = document.querySelector('[data-testid="options-playback-rate-slider"]');
      expect(panel).toBeTruthy();
      expect(slider).toBeTruthy();

      fireEvent.change(slider, { target: { value: "0.85" } });
      expect(sel.playbackRate(store.getState())).toBe(0.85);
      unmount();
    });

    it("exposes audio playback speed panel inside PlayerAudioOptionsModal", () => {
      const { unmount } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(PlayerAudioOptionsModal, {
            isOpen: true,
            onClose: () => {},
            currentMainAyat: { numberInSurah: 1, number: 1, text: "بِسْمِ ٱللَّهِ" },
            selectedSurah: { number: 1, englishName: "Al-Fatiha", name: "الفاتحة" },
            recitatorId: "ar.alafasy",
            totalAyahs: 7,
          })
        )
      );

      const panel = document.querySelector('[data-testid="player-modal-playback-rate-panel"]');
      const slider = document.querySelector('[data-testid="player-modal-playback-rate-slider"]');
      expect(panel).toBeTruthy();
      expect(slider).toBeTruthy();

      fireEvent.change(slider, { target: { value: "1.25" } });
      expect(sel.playbackRate(store.getState())).toBe(1.25);
      unmount();
    });

    it("syncs LectureMode speed selector onto its local <audio> element", () => {
      const { container, unmount } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(LectureMode, {
            ayat: { number: 1, numberInSurah: 1, text: "بِسْمِ ٱللَّهِ" },
            surahNum: 1,
            audioUrl: "https://cdn.example.com/1.mp3",
            isMainPlaying: false,
          })
        )
      );

      const selectEl = container.querySelector('[data-testid="lecture-playback-rate-select"]');
      const audioEl = container.querySelector("audio");
      expect(selectEl).toBeTruthy();
      expect(audioEl).toBeTruthy();

      fireEvent.change(selectEl, { target: { value: "0.75" } });
      expect(sel.playbackRate(store.getState())).toBe(0.75);
      expect(audioEl.playbackRate).toBe(0.75);
      expect(audioEl.defaultPlaybackRate).toBe(0.75);

      fireEvent(audioEl, new Event("loadedmetadata"));
      expect(audioEl.playbackRate).toBe(0.75);
      unmount();
    });

    it("exposes fs-playback-rate-select in AyatFullScreenModal footer and syncs with global rate", () => {
      const { unmount } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(AyatFullScreenModal, {
            isOpen: true,
            onClose: () => {},
            ayat: { number: 1, numberInSurah: 1, text: "بِسْمِ ٱللَّهِ" },
            selectedSurah: { number: 1, englishName: "Al-Fatiha", name: "الفاتحة" },
            ayats: [{ number: 1, numberInSurah: 1, text: "بِسْمِ ٱللَّهِ" }],
          })
        )
      );

      const fsSelect = document.querySelector('[data-testid="fs-playback-rate-select"]');
      expect(fsSelect).toBeTruthy();
      fireEvent.change(fsSelect, { target: { value: "1.5" } });
      expect(sel.playbackRate(store.getState())).toBe(1.5);
      unmount();
    });

    it("renders q3d-playback-rate-select in QuranBook3DPage footer and syncs q3d-audio-el.playbackRate", async () => {
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
      vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

      const { unmount } = render(
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
        expect(document.querySelector('[data-testid="q3d-playback-rate-select"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="q3d-audio-el"]')).toBeTruthy();
      });

      const speedSelect = document.querySelector('[data-testid="q3d-playback-rate-select"]');
      const audioEl = document.querySelector('[data-testid="q3d-audio-el"]');

      fireEvent.change(speedSelect, { target: { value: "0.75" } });
      expect(sel.playbackRate(store.getState())).toBe(0.75);
      expect(audioEl.playbackRate).toBe(0.75);
      expect(audioEl.defaultPlaybackRate).toBe(0.75);

      // Re-apply after browser media load / play
      fireEvent(audioEl, new Event("loadedmetadata"));
      expect(audioEl.playbackRate).toBe(0.75);
      unmount();
    });
  });
});
