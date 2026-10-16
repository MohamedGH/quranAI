import { describe, it, expect } from "vitest";
import { parseQuranRoute, buildQuranRoute } from "../src/utils/routeManager.js";

describe("Route Manager - Audio Silence Parameters", () => {
  it("parses silenceRevise and silenceMode query parameters from URL", () => {
    const r1 = parseQuranRoute("/quran/2/255", "?silenceRevise=1&silenceMode=skip");
    expect(r1.activePage).toBe("quran");
    expect(r1.surahNum).toBe(2);
    expect(r1.ayatNum).toBe(255);
    expect(r1.silenceRevise).toBe(true);
    expect(r1.silenceMode).toBe("skip");

    const r2 = parseQuranRoute("/quran/18/10", "?silence=true&silenceMode=mute");
    expect(r2.silenceRevise).toBe(true);
    expect(r2.silenceMode).toBe("mute");

    const r3 = parseQuranRoute("/quran/1/1", "");
    expect(r3.silenceRevise).toBe(false);
    expect(r3.silenceMode).toBeNull();
  });

  it("builds canonical route URLs with silenceRevise and silenceMode", () => {
    const url1 = buildQuranRoute({
      activePage: "quran",
      surahNum: 2,
      ayatNum: 255,
      silenceRevise: true,
      silenceMode: "mute",
    });
    expect(url1).toBe("/quran/2/255?silenceRevise=1&silenceMode=mute");

    const url2 = buildQuranRoute({
      activePage: "quran",
      surahNum: 1,
      silenceRevise: true,
      silenceMode: "skip",
    });
    expect(url2).toBe("/quran/1?silenceRevise=1&silenceMode=skip");

    const url3 = buildQuranRoute({
      activePage: "quran",
      surahNum: 36,
      ayatNum: 1,
      silenceRevise: false,
    });
    expect(url3).toBe("/quran/36/1");
  });
});
