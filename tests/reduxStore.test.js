import { describe, it, expect, beforeEach } from "vitest";
import {
  store,
  sel,
  uiActions,
  quranActions,
  playerActions,
  learnActions,
  collectionsActions,
  voiceActions,
  goalsActions,
  setLDataThunk,
} from "../src/store.js";

describe("Redux Store & Production Slice Integration", () => {
  describe("UI Slice State & Toggles", () => {
    it("handles page switching across Quran, Prononciation, Revision, and Collections", () => {
      store.dispatch(uiActions.setActivePage("prononciation"));
      expect(sel.activePage(store.getState())).toBe("prononciation");

      store.dispatch(uiActions.setActivePage("revision"));
      expect(sel.activePage(store.getState())).toBe("revision");

      store.dispatch(uiActions.setActivePage("quran"));
      expect(sel.activePage(store.getState())).toBe("quran");
    });

    it("toggles sidebar visibility", () => {
      const initial = sel.sidebarOpen(store.getState());
      store.dispatch(uiActions.toggleSidebar());
      expect(sel.sidebarOpen(store.getState())).toBe(!initial);
    });

    it("toggles Tajweed rules (Qalqala, Madd, Izhar, Idgham)", () => {
      const qInit = sel.showQalqala(store.getState());
      store.dispatch(uiActions.toggleQalqala());
      expect(sel.showQalqala(store.getState())).toBe(!qInit);

      const mInit = sel.showMadd(store.getState());
      store.dispatch(uiActions.toggleMadd());
      expect(sel.showMadd(store.getState())).toBe(!mInit);

      const izInit = sel.showIzhar(store.getState());
      store.dispatch(uiActions.toggleIzhar());
      expect(sel.showIzhar(store.getState())).toBe(!izInit);

      const idInit = sel.showIdgham(store.getState());
      store.dispatch(uiActions.toggleIdgham());
      expect(sel.showIdgham(store.getState())).toBe(!idInit);
    });

    it("toggles performance and display settings", () => {
      const tsInit = sel.enableTimestamps(store.getState());
      store.dispatch(uiActions.toggleEnableTimestamps());
      expect(sel.enableTimestamps(store.getState())).toBe(!tsInit);

      const lblInit = sel.enableLetterByLetter(store.getState());
      store.dispatch(uiActions.toggleEnableLetterByLetter());
      expect(sel.enableLetterByLetter(store.getState())).toBe(!lblInit);
    });
  });

  describe("Quran Slice & Navigation", () => {
    it("sets surah list and manages surah selection", () => {
      const dummySurahs = [
        { number: 1, name: "الفاتحة", englishName: "Al-Fatiha", numberOfAyahs: 7 },
        { number: 2, name: "البقرة", englishName: "Al-Baqara", numberOfAyahs: 286 },
      ];
      store.dispatch(quranActions.setSurahs(dummySurahs));
      expect(sel.surahs(store.getState())).toHaveLength(2);

      store.dispatch(quranActions.setSelectedSurah(dummySurahs[0]));
      expect(sel.selectedSurah(store.getState())).toEqual(dummySurahs[0]);
    });

    it("tracks search queries and open ayat index", () => {
      store.dispatch(quranActions.setSearch("Al-Baqara"));
      expect(sel.search(store.getState())).toBe("Al-Baqara");

      store.dispatch(quranActions.setOpenAyatNum(5));
      expect(sel.openAyatNum(store.getState())).toBe(5);
    });

    it("persists last read ayat per surah", () => {
      store.dispatch(quranActions.setLastAyatForSurah({ surahNum: 1, ayatNum: 4 }));
      expect(sel.lastAyatBySurah(store.getState())[1]).toBe(4);
    });
  });

  describe("Player Slice & Audio Loop Engine", () => {
    it("handles main playback state, track indices, and progress milliseconds", () => {
      store.dispatch(playerActions.setIsMainPlaying(true));
      expect(sel.isMainPlaying(store.getState())).toBe(true);

      store.dispatch(playerActions.setMainAyatIdx(3));
      expect(sel.mainAyatIdx(store.getState())).toBe(3);

      store.dispatch(playerActions.setMainCurrentMs(2500));
      expect(sel.mainCurrentMs(store.getState())).toBe(2500);
    });

    it("manages loop configurations and repetition counts", () => {
      store.dispatch(playerActions.setLoopActive(true));
      expect(sel.loopActive(store.getState())).toBe(true);

      store.dispatch(playerActions.setLoopStart(1));
      store.dispatch(playerActions.setLoopEnd(5));
      store.dispatch(playerActions.setLoopMax(3));
      store.dispatch(playerActions.setLoopCount(1));

      expect(sel.loopStart(store.getState())).toBe(1);
      expect(sel.loopEnd(store.getState())).toBe(5);
      expect(sel.loopMax(store.getState())).toBe(3);
      expect(sel.loopCount(store.getState())).toBe(1);

      store.dispatch(playerActions.resetLoop());
      expect(sel.loopActive(store.getState())).toBe(false);
      expect(sel.loopCount(store.getState())).toBe(0);
    });
  });

  describe("Learn Slice & setLDataThunk", () => {
    it("records and updates memorization entries for ayats and sub-parts", () => {
      store.dispatch(
        setLDataThunk(1, 1, (prev) => ({
          ...prev,
          learned: true,
          readCount: (prev.readCount || 0) + 1,
          parts: [{ id: 101, text: "بسم الله", learned: true }],
        }))
      );

      const learnData = sel.learnData(store.getState());
      expect(learnData["1:1"]).toBeDefined();
      expect(learnData["1:1"].learned).toBe(true);
      expect(learnData["1:1"].parts[0].learned).toBe(true);
      expect(learnData["1:1"].updatedAt).toBeDefined();
    });

    it("manages sub-part selection state", () => {
      store.dispatch(learnActions.setPartSelectAyat(2));
      store.dispatch(learnActions.setPartSelectStep("start"));
      store.dispatch(learnActions.setPartSelectStart(0));

      expect(sel.partSelectAyat(store.getState())).toBe(2);
      expect(sel.partSelectStep(store.getState())).toBe("start");
      expect(sel.partSelectStart(store.getState())).toBe(0);

      store.dispatch(learnActions.clearPartSelect());
      expect(sel.partSelectAyat(store.getState())).toBeNull();
    });
  });

  describe("Collections Slice", () => {
    it("creates collections and toggles ayat inclusions", () => {
      store.dispatch(collectionsActions.createCollection("Mes Ayats Préférées"));
      const collections = sel.collections(store.getState());
      const myColl = collections.find((c) => c.name === "Mes Ayats Préférées");
      expect(myColl).toBeDefined();

      const ayatEntry = { surahNum: 1, ayatNum: 1, text: "بِسْمِ اللَّهِ" };
      store.dispatch(
        collectionsActions.toggleAyatInCollection({
          collId: myColl.id,
          ayatEntry,
        })
      );

      const updated = sel.collections(store.getState()).find((c) => c.id === myColl.id);
      expect(updated.ayats).toHaveLength(1);
      expect(updated.ayats[0].surahNum).toBe(1);

      // Toggle again to remove
      store.dispatch(
        collectionsActions.toggleAyatInCollection({
          collId: myColl.id,
          ayatEntry,
        })
      );
      const afterRemoval = sel.collections(store.getState()).find((c) => c.id === myColl.id);
      expect(afterRemoval.ayats).toHaveLength(0);

      // Clean up
      store.dispatch(collectionsActions.deleteCollection(myColl.id));
      expect(sel.collections(store.getState()).find((c) => c.id === myColl.id)).toBeUndefined();
    });
  });

  describe("Voice Slice", () => {
    it("updates voice recognition listening, modal, and toast states", () => {
      store.dispatch(voiceActions.setListening(true));
      expect(sel.listening(store.getState())).toBe(true);

      store.dispatch(voiceActions.setVoiceToast({ text: "Verset 1 reconnu", type: "success" }));
      expect(sel.voiceToast(store.getState())).toEqual({ text: "Verset 1 reconnu", type: "success" });

      store.dispatch(voiceActions.clearVoiceToast());
      expect(sel.voiceToast(store.getState())).toBeNull();

      store.dispatch(voiceActions.setShowVoiceInput(true));
      store.dispatch(voiceActions.setVoiceInputText("sourate 1"));
      expect(sel.showVoiceInput(store.getState())).toBe(true);
      expect(sel.voiceInputText(store.getState())).toBe("sourate 1");
    });
  });

  describe("Goals Slice & Activity Logging", () => {
    it("updates configurable user goals", () => {
      store.dispatch(goalsActions.setGoal({ key: "dailyAyats", value: 10 }));
      store.dispatch(goalsActions.setGoal({ key: "weeklyAyats", value: 50 }));

      expect(sel.goals(store.getState()).dailyAyats).toBe(10);
      expect(sel.goals(store.getState()).weeklyAyats).toBe(50);
    });

    it("records daily progress activities and computes mastery percentages", () => {
      const testDay = "2026-08-30";
      store.dispatch(
        goalsActions.setActivityDay({
          date: testDay,
          data: { ayatsRead: 0, partsLearned: 0, ayatsLearned: 0 },
        })
      );
      store.dispatch(
        goalsActions.recordActivity({
          date: testDay,
          ayatsRead: 5,
          partsLearned: 2,
          ayatsLearned: 1,
        })
      );

      const activity = sel.activity(store.getState())[testDay];
      expect(activity.ayatsRead).toBe(5);
      expect(activity.partsLearned).toBe(2);
      expect(activity.ayatsLearned).toBe(1);
    });
  });
});
