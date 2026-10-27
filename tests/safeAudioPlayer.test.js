import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isAudioAbortError,
  isAutoplayBlockedError,
  safePlayAudio,
  safePauseAudio,
  safeLoadAudio,
  safeSeekAudio,
  playWhenAudioReady,
} from "../src/utils/safeAudioPlayer.js";
import { ERROR_CODES } from "../src/utils/errorManager.js";

describe("safeAudioPlayer - Functional and resilient HTML5 audio handling", () => {
  describe("isAudioAbortError", () => {
    it("detects DOMException: The play() request was interrupted by a new load request", () => {
      const err = new Error("The play() request was interrupted by a new load request. https://goo.gl/LdLk22");
      expect(isAudioAbortError(err)).toBe(true);
    });

    it("detects DOMException: The play() request was interrupted by a call to pause()", () => {
      const err = new Error("The play() request was interrupted by a call to pause().");
      expect(isAudioAbortError(err)).toBe(true);
    });

    it("detects AbortError by name", () => {
      const domException = { name: "AbortError", message: "Fetching was aborted" };
      expect(isAudioAbortError(domException)).toBe(true);
    });

    it("detects error message passed as plain string", () => {
      expect(isAudioAbortError("The play() request was interrupted by a new load request.")).toBe(true);
    });

    it("returns false for non-abort errors (e.g. 404, network failure)", () => {
      expect(isAudioAbortError(new Error("Failed to load resource: net::ERR_FILE_NOT_FOUND"))).toBe(false);
      expect(isAudioAbortError(new Error("Format not supported"))).toBe(false);
      expect(isAudioAbortError(null)).toBe(false);
      expect(isAudioAbortError(undefined)).toBe(false);
    });
  });

  describe("isAutoplayBlockedError", () => {
    it("detects browser policy NotAllowedError", () => {
      const err = { name: "NotAllowedError", message: "play() failed because the user didn't interact but tried to autoplay" };
      expect(isAutoplayBlockedError(err)).toBe(true);
    });

    it("returns false for standard errors", () => {
      expect(isAutoplayBlockedError(new Error("NetworkError"))).toBe(false);
      expect(isAutoplayBlockedError(null)).toBe(false);
    });
  });

  describe("safePlayAudio", () => {
    it("returns ok: true and invokes onSuccess when playback resolves successfully", async () => {
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
      };
      const onSuccess = vi.fn();
      const res = await safePlayAudio(mockAudio, onSuccess);

      expect(mockAudio.play).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(res.ok).toBe(true);
      expect(res.aborted).toBe(false);
      expect(res.error).toBeNull();
    });

    it("safely catches 'interrupted by a new load request' without throwing or reporting error", async () => {
      const abortError = new Error("The play() request was interrupted by a new load request. https://goo.gl/LdLk22");
      abortError.name = "AbortError";
      const mockAudio = {
        play: vi.fn().mockRejectedValue(abortError),
      };
      const onSuccess = vi.fn();
      const onError = vi.fn();

      const res = await safePlayAudio(mockAudio, onSuccess, onError);

      expect(res.ok).toBe(false);
      expect(res.aborted).toBe(true);
      expect(onError).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("catches NotAllowedError and invokes onError with benign handling", async () => {
      const policyError = { name: "NotAllowedError", message: "play() blocked" };
      const mockAudio = {
        play: vi.fn().mockRejectedValue(policyError),
      };
      const onError = vi.fn();

      const res = await safePlayAudio(mockAudio, null, onError);

      expect(res.ok).toBe(false);
      expect(res.aborted).toBe(false);
      expect(onError).toHaveBeenCalledWith(policyError);
    });

    it("normalizes unexpected audio errors with errorManager AUDIO_PLAYBACK_ERROR code", async () => {
      const fatalErr = new Error("Decode audio failed");
      const mockAudio = {
        src: "https://example.com/audio.mp3",
        play: vi.fn().mockRejectedValue(fatalErr),
      };
      const onError = vi.fn();

      const res = await safePlayAudio(mockAudio, null, onError);

      expect(res.ok).toBe(false);
      expect(res.error.code).toBe(ERROR_CODES.AUDIO_PLAYBACK_ERROR);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it("handles null or undefined audio element gracefully", async () => {
      const res = await safePlayAudio(null);
      expect(res.ok).toBe(false);
      expect(res.aborted).toBe(false);
    });
  });

  describe("safePauseAudio", () => {
    it("pauses without throwing on valid element", () => {
      const mockAudio = { pause: vi.fn() };
      expect(safePauseAudio(mockAudio)).toBe(true);
      expect(mockAudio.pause).toHaveBeenCalledTimes(1);
    });

    it("returns false gracefully on null or missing pause method", () => {
      expect(safePauseAudio(null)).toBe(false);
      expect(safePauseAudio({})).toBe(false);
    });

    it("silently swallows exceptions thrown during pause", () => {
      const mockAudio = {
        pause: vi.fn().mockImplementation(() => {
          throw new Error("InvalidStateError");
        }),
      };
      expect(safePauseAudio(mockAudio)).toBe(false);
    });
  });

  describe("safeLoadAudio", () => {
    it("calls load() safely on valid element", () => {
      const mockAudio = { load: vi.fn() };
      expect(safeLoadAudio(mockAudio)).toBe(true);
      expect(mockAudio.load).toHaveBeenCalledTimes(1);
    });

    it("returns false gracefully on null or missing load method", () => {
      expect(safeLoadAudio(null)).toBe(false);
      expect(safeLoadAudio({})).toBe(false);
    });
  });

  describe("safeSeekAudio", () => {
    it("clamps seek time within [0, duration]", () => {
      const mockAudio = { duration: 120, currentTime: 0 };

      expect(safeSeekAudio(mockAudio, -10)).toBe(0);
      expect(mockAudio.currentTime).toBe(0);

      expect(safeSeekAudio(mockAudio, 45)).toBe(45);
      expect(mockAudio.currentTime).toBe(45);

      expect(safeSeekAudio(mockAudio, 200)).toBe(120);
      expect(mockAudio.currentTime).toBe(120);
    });

    it("handles NaN and null gracefully", () => {
      const mockAudio = { duration: 60, currentTime: 10 };
      expect(safeSeekAudio(mockAudio, NaN)).toBe(0);
      expect(safeSeekAudio(null, 10)).toBe(0);
    });
  });

  describe("playWhenAudioReady", () => {
    it("plays immediately if readyState >= 2 (HAVE_CURRENT_DATA)", () => {
      const mockAudio = {
        readyState: 4, // HAVE_ENOUGH_DATA
        play: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const cleanup = playWhenAudioReady(mockAudio);
      expect(mockAudio.play).toHaveBeenCalledTimes(1);
      expect(mockAudio.addEventListener).not.toHaveBeenCalled();
      cleanup();
    });

    it("registers canplay listener if readyState < 2 and plays upon event", async () => {
      let canPlayHandler = null;
      const mockAudio = {
        readyState: 0, // HAVE_NOTHING
        play: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn((event, cb) => {
          if (event === "canplay") canPlayHandler = cb;
        }),
        removeEventListener: vi.fn(),
      };

      const cleanup = playWhenAudioReady(mockAudio);
      expect(mockAudio.play).toHaveBeenCalledTimes(1);
      expect(mockAudio.addEventListener).toHaveBeenCalledWith("canplay", expect.any(Function), { once: true });

      // Simulate browser firing canplay
      mockAudio.readyState = 3;
      if (canPlayHandler) canPlayHandler();

      expect(mockAudio.play).toHaveBeenCalledTimes(2);
      cleanup();
      expect(mockAudio.removeEventListener).toHaveBeenCalledWith("canplay", expect.any(Function));
    });

    it("returns noop cleanup for null audio element", () => {
      const cleanup = playWhenAudioReady(null);
      expect(typeof cleanup).toBe("function");
      expect(() => cleanup()).not.toThrow();
    });
  });
});
