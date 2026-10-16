import { describe, it, expect } from "vitest";
import { formatSilenceStatus, resolveSilencedWordIndices, computeSilenceIntervals } from "../src/utils/audioSilenceManager.js";
import { parseQuranRoute, buildQuranRoute } from "../src/utils/routeManager.js";
import { store, playerActions, sel } from "../src/store.js";

describe("Silence Revision UI & Audio Player Non-Interference", () => {
  it("keeps audio player transport free of blocking status overlays", () => {
    // Verify status formatting returns clean text without creating DOM obstruction
    const statusWithTs = formatSilenceStatus({
      hasTimestamps: true,
      totalWords: 5,
      silencedCount: 2,
      mode: "mute",
      isCurrentlySilenced: false,
      activeWordText: "",
    });
    expect(statusWithTs.badgeText).toBe("2 mots sous silence (Muet)");
    expect(statusWithTs.canSilence).toBe(true);
    expect(statusWithTs.badgeColor).toBe("#ff7eb3");

    const statusWithoutTs = formatSilenceStatus({
      hasTimestamps: false,
      totalWords: 5,
      silencedCount: 2,
      mode: "mute",
      isCurrentlySilenced: false,
      activeWordText: "",
    });
    expect(statusWithoutTs.badgeText).toBe("Timestamps requis");
    expect(statusWithoutTs.canSilence).toBe(false);
    expect(statusWithoutTs.badgeColor).toBe("#f59e0b");
  });

  it("handles instant 1-tap toggling in state manager without blocking dialogs", () => {
    // Initial state
    store.dispatch(playerActions.setSilenceWordsToRevise(false));
    expect(sel.silenceWordsToRevise(store.getState())).toBe(false);

    // 1-tap enable
    store.dispatch(playerActions.setSilenceWordsToRevise(true));
    expect(sel.silenceWordsToRevise(store.getState())).toBe(true);

    // 1-tap disable
    store.dispatch(playerActions.setSilenceWordsToRevise(false));
    expect(sel.silenceWordsToRevise(store.getState())).toBe(false);
  });

  it("switches silence mode between mute and skip seamlessly in state manager", () => {
    store.dispatch(playerActions.setSilenceMode("skip"));
    expect(sel.silenceMode(store.getState())).toBe("skip");

    store.dispatch(playerActions.setSilenceMode("mute"));
    expect(sel.silenceMode(store.getState())).toBe("mute");
  });

  it("preserves route integrity with silence query parameters", () => {
    const route = buildQuranRoute({
      activePage: "quran",
      surahNum: 1,
      ayatNum: 3,
      silenceRevise: true,
      silenceMode: "skip",
    });
    expect(route).toBe("/quran/1/3?silenceRevise=1&silenceMode=skip");

    const [pathname, search] = route.split("?");
    const parsed = parseQuranRoute(pathname, "?" + search);
    expect(parsed.silenceRevise).toBe(true);
    expect(parsed.silenceMode).toBe("skip");
  });

  it("resolves words to silence correctly for audio masking without throwing", () => {
    const ld = {
      toRevise: {
        words: [0, 2],
      },
    };
    const words = resolveSilencedWordIndices({
      ld,
      customIndices: [],
      totalWords: 4,
    });
    expect(words).toEqual([0, 2]);

    const mockTs = {
      words: [
        { text: "word0", start: 0, end: 500 },
        { text: "word1", start: 500, end: 1000 },
        { text: "word2", start: 1000, end: 1500 },
        { text: "word3", start: 1500, end: 2000 },
      ],
    };

    const intervals = computeSilenceIntervals(mockTs, words);
    expect(intervals).toHaveLength(2);
    expect(intervals[0]).toEqual({ startMs: 0, endMs: 500, wordIndex: 0, text: "word0" });
    expect(intervals[1]).toEqual({ startMs: 1000, endMs: 1500, wordIndex: 2, text: "word2" });
  });
});
