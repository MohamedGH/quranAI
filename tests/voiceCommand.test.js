import { describe, it, expect } from "vitest";
import { SURAH_NAMES, parseVoiceCommand } from "../src/utils/voiceCommand.js";

describe("Voice Command Parser & Surah Mapping", () => {
  it("SURAH_NAMES contains mappings for surahs", () => {
    expect(Object.keys(SURAH_NAMES).length).toBeGreaterThan(100);
    expect(SURAH_NAMES["fatiha"]).toBe(1);
    expect(SURAH_NAMES["nas"]).toBe(114);
  });

  it("parses navigation voice commands to surah", () => {
    const cmd1 = parseVoiceCommand("sourate 1");
    expect(cmd1).toBeDefined();
    expect(cmd1?.action).toBe("surah");
    expect(cmd1?.number).toBe(1);

    const cmd2 = parseVoiceCommand("sourate baqara");
    expect(cmd2).toBeDefined();
    expect(cmd2?.action).toBe("surah");
    expect(cmd2?.number).toBe(2);
  });

  it("parses ayat jump commands", () => {
    const cmd = parseVoiceCommand("verset 5");
    expect(cmd).toBeDefined();
    expect(cmd?.action).toBe("ayat");
    expect(cmd?.number).toBe(5);
  });

  it("handles playback and mode voice commands", () => {
    const cmdPlay = parseVoiceCommand("lecture");
    expect(cmdPlay?.action).toBe("play");

    const cmdPause = parseVoiceCommand("pause");
    expect(cmdPause?.action).toBe("pause");

    const cmdNext = parseVoiceCommand("suivant");
    expect(cmdNext?.action).toBe("next");

    const cmdPrev = parseVoiceCommand("précédent");
    expect(cmdPrev?.action).toBe("prev");
  });
});
