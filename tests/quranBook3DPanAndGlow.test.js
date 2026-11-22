// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";

const { mockRendererState } = vi.hoisted(() => ({
  mockRendererState: {
    renderSpy: vi.fn(),
    disposeSpy: vi.fn(),
    setSizeSpy: vi.fn(),
    shaderMaterials: [],
    sprites: [],
    cameras: [],
  },
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();

  class MockWebGLRenderer {
    constructor() {
      this.domElement = document.createElement("canvas");
      this.debug = { checkShaderErrors: false };
      this.capabilities = { getMaxAnisotropy: () => 4 };
      this.shadowMap = { enabled: false, type: actual.PCFSoftShadowMap };
      this.toneMapping = actual.ACESFilmicToneMapping;
      this.toneMappingExposure = 1;
      this.outputColorSpace = actual.SRGBColorSpace;
      this._pixelRatio = 1;
    }
    setSize(w, h, updateStyle) {
      mockRendererState.setSizeSpy(w, h, updateStyle);
    }
    setPixelRatio(r) {
      this._pixelRatio = r;
    }
    getPixelRatio() {
      return this._pixelRatio;
    }
    getContext() {
      return {
        RENDERER: 0x1f01,
        getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 0x9246 }),
        getParameter: () => "NVIDIA GeForce RTX 4070",
      };
    }
    compile() {}
    render(scene, camera) {
      mockRendererState.renderSpy(scene, camera);
    }
    dispose() {
      mockRendererState.disposeSpy();
    }
  }

  class TrackedShaderMaterial extends actual.ShaderMaterial {
    constructor(params) {
      super(params);
      this.disposeCount = 0;
      mockRendererState.shaderMaterials.push(this);
    }
    dispose() {
      this.disposeCount += 1;
      super.dispose();
    }
  }

  class TrackedSprite extends actual.Sprite {
    constructor(material) {
      super(material);
      mockRendererState.sprites.push(this);
    }
  }

  class TrackedPerspectiveCamera extends actual.PerspectiveCamera {
    constructor(...args) {
      super(...args);
      mockRendererState.cameras.push(this);
    }
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
    ShaderMaterial: TrackedShaderMaterial,
    Sprite: TrackedSprite,
    PerspectiveCamera: TrackedPerspectiveCamera,
  };
});

import * as THREE from "three";
import { store, uiActions } from "../src/store.js";
import * as reciterAudio from "../src/utils/reciterAudio.js";
import { BOOK3D_ZOOM, BOOK3D_PARTICLES } from "../src/utils/quranBookEngine.js";
import { QuranBook3DPage } from "../src/components/pages/QuranBook3DPage.jsx";

describe("3D Quran Mode: Camera Translation, Particle Glow Texture & Volumetric Aura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRendererState.shaderMaterials.length = 0;
    mockRendererState.sprites.length = 0;
    mockRendererState.cameras.length = 0;
    store.dispatch(uiActions.resetUiElementsVisibility());

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

  it("mounts 3D scene with textured particle glow ShaderMaterial + aura Sprite, supports camera pan via UI & gestures, toggles Glow, and disposes cleanly", async () => {
    const rafQueue = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
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
      expect(document.querySelector('[data-testid="q3d-webgl-container"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="q3d-pan-toggle"]')).toBeTruthy();
    });

    // Verify procedural particle glow texture + shader + aura sprite were constructed
    expect(mockRendererState.shaderMaterials.length).toBe(1);
    const dustShader = mockRendererState.shaderMaterials[0];
    expect(dustShader.blending).toBe(THREE.AdditiveBlending);
    expect(dustShader.depthWrite).toBe(false);
    expect(dustShader.transparent).toBe(true);
    expect(dustShader.uniforms.uMap.value).toBeInstanceOf(THREE.CanvasTexture);
    expect(dustShader.uniforms.uMap.value.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(dustShader.uniforms.uBaseSize.value).toBe(BOOK3D_PARTICLES.baseSize);
    expect(dustShader.uniforms.uBaseSize.value).toBeLessThanOrEqual(8);
    expect(dustShader.uniforms.uEmitFactor.value).toBe(0);
    expect(dustShader.uniforms.uParticleTime.value).toBe(0);

    expect(mockRendererState.sprites.length).toBe(1);
    const auraSprite = mockRendererState.sprites[0];
    expect(auraSprite.visible).toBe(true);
    expect(auraSprite.material.blending).toBe(THREE.AdditiveBlending);
    expect(auraSprite.material.map).toBeInstanceOf(THREE.CanvasTexture);
    expect(auraSprite.material.map.colorSpace).toBe(THREE.SRGBColorSpace);

    const camera = mockRendererState.cameras[0];
    expect(camera).toBeTruthy();

    // Flush initial animation frame -> still early in opening, so particles remain un-emitted at first
    let simNow = performance.now() + 16;
    act(() => {
      const pending = rafQueue.splice(0, rafQueue.length);
      for (const fn of pending) {
        fn(simNow);
      }
    });
    expect(mockRendererState.renderSpy).toHaveBeenCalled();
    expect(dustShader.uniforms.uEmitFactor.value).toBe(0);
    expect(dustShader.uniforms.uParticleTime.value).toBe(0);

    // Advance 3D Quran opening across ~14 frames (+50ms each) -> particles start emitting as cover unfolds
    act(() => {
      for (let i = 0; i < 14 && rafQueue.length > 0; i++) {
        simNow += 50;
        const fn = rafQueue.shift();
        fn(simNow);
      }
    });
    expect(dustShader.uniforms.uEmitFactor.value).toBeGreaterThan(0.5);
    expect(dustShader.uniforms.uParticleTime.value).toBeGreaterThan(0);

    // Toggle to Camera Translation mode (✋ CAMÉRA) -> cursor switches & directional pad renders
    const panToggle = document.querySelector('[data-testid="q3d-pan-toggle"]');
    expect(panToggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(panToggle);
    expect(panToggle.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-testid="q3d-pan-pad"]')).toBeTruthy();

    const canvasHost = document.querySelector('[data-testid="q3d-webgl-container"]');
    expect(canvasHost.style.cursor).toBe("move");

    // Pan camera right & up via mini-pad and step rAF frames -> camera.position translates smoothly
    fireEvent.click(document.querySelector('[data-testid="q3d-pan-right"]'));
    fireEvent.click(document.querySelector('[data-testid="q3d-pan-up"]'));
    act(() => {
      for (let i = 0; i < 6 && rafQueue.length > 0; i++) {
        const fn = rafQueue.shift();
        fn(performance.now() + (i + 2) * 32);
      }
    });
    expect(camera.position.x).toBeGreaterThan(0.05);

    // Reset view returns pan & zoom cleanly back to center
    fireEvent.click(document.querySelector('[data-testid="q3d-reset-view"]'));
    expect(camera.position.x).toBe(0);
    expect(camera.position.z).toBe(BOOK3D_ZOOM.defaultDesktopDist);

    // Switch back to Orbit mode -> right-click drag (button 2) still translates camera directly
    fireEvent.click(panToggle);
    expect(document.querySelector('[data-testid="q3d-pan-pad"]')).toBeNull();

    fireEvent.pointerDown(canvasHost, { pointerId: 1, clientX: 300, clientY: 300, button: 2, buttons: 2 });
    fireEvent.pointerMove(canvasHost, { pointerId: 1, clientX: 200, clientY: 260, buttons: 2 });
    fireEvent.pointerUp(canvasHost, { pointerId: 1 });

    act(() => {
      for (let i = 0; i < 6 && rafQueue.length > 0; i++) {
        simNow += 32;
        const fn = rafQueue.shift();
        fn(simNow);
      }
    });
    expect(camera.position.x).toBeGreaterThan(0.05);

    // Open ⚙️ 3D settings drawer and toggle Glow off -> auraSprite hides
    const settingsBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent.includes("⚙️ 3D")
    );
    expect(settingsBtn).toBeTruthy();
    fireEvent.click(settingsBtn);

    const glowCheckbox = document.querySelector('[data-testid="q3d-toggle-glow"]');
    expect(glowCheckbox.checked).toBe(true);
    fireEvent.click(glowCheckbox);
    expect(glowCheckbox.checked).toBe(false);
    expect(auraSprite.visible).toBe(false);

    // Toggle 3D Quran closed -> particles reset to 0; reopen -> particles restart emitting
    const openCheckbox = document.querySelector('[data-testid="q3d-toggle-book-open"]');
    expect(openCheckbox.checked).toBe(true);
    fireEvent.click(openCheckbox);
    expect(openCheckbox.checked).toBe(false);

    act(() => {
      for (let i = 0; i < 24 && rafQueue.length > 0; i++) {
        simNow += 50;
        const fn = rafQueue.shift();
        fn(simNow);
      }
    });
    expect(dustShader.uniforms.uEmitFactor.value).toBe(0);
    expect(dustShader.uniforms.uParticleTime.value).toBe(0);

    // Reopen 3D Quran -> particles start emerging again
    fireEvent.click(openCheckbox);
    expect(openCheckbox.checked).toBe(true);
    act(() => {
      for (let i = 0; i < 16 && rafQueue.length > 0; i++) {
        simNow += 50;
        const fn = rafQueue.shift();
        fn(simNow);
      }
    });
    expect(dustShader.uniforms.uEmitFactor.value).toBeGreaterThan(0.5);
    expect(dustShader.uniforms.uParticleTime.value).toBeGreaterThan(0);

    // Unmount -> verifies full shader & renderer disposal with zero leaks
    unmount();
    expect(dustShader.disposeCount).toBe(1);
    expect(mockRendererState.disposeSpy).toHaveBeenCalledTimes(1);
  });
});
