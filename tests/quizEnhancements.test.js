import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateQuizPoints,
  getStreakCelebration,
  formatQuizTimer,
  computeSessionSummary,
  filterQuestionsForReview,
  playQuizSound,
  triggerQuizHaptic,
  generateMultipleChoiceOptions,
  QUIZ_PRESETS,
  formatStreakMultiplier,
  getTajweedToggleLabel,
  getFontSizeStyle,
  computeMistakesSummaryByCategory,
  createMistakesCollectionPayload,
} from "../src/utils/quizUtils.js";
import { store, sel, quizActions, collectionsActions } from "../src/store.js";
import { buildQuizRoute, parseQuizRoute } from "../src/utils/routeManager.js";
import { ERROR_CODES, createAppError } from "../src/utils/errorManager.js";

describe("Quiz Enhancements & Pure Functions", () => {
  describe("quizUtils - calculateQuizPoints", () => {
    it("awards base 100 points for a correct answer with 0 streak and no time bonus", () => {
      const pts = calculateQuizPoints(0, 100, 0);
      expect(pts).toBe(100);
    });

    it("calculates streak bonuses and caps streak bonus at 100 points", () => {
      const ptsStreak2 = calculateQuizPoints(2, 100, 0);
      expect(ptsStreak2).toBe(130); // 100 base + 2*15

      const ptsStreak10 = calculateQuizPoints(10, 100, 0);
      expect(ptsStreak10).toBe(200); // 100 base + min(100, 10*15=150) = 200
    });

    it("adds time bonus when provided", () => {
      const pts = calculateQuizPoints(3, 100, 25);
      // 100 base + 3*15 (45) + 25 = 170
      expect(pts).toBe(170);
    });
  });

  describe("quizUtils - getStreakCelebration", () => {
    it("returns null for streaks under 3", () => {
      expect(getStreakCelebration(0)).toBeNull();
      expect(getStreakCelebration(1)).toBeNull();
      expect(getStreakCelebration(2)).toBeNull();
    });

    it("returns appropriate celebrations for milestones 3, 5, 10, and 15+", () => {
      const c3 = getStreakCelebration(3);
      expect(c3).toBeDefined();
      expect(c3.label).toContain("3 d'affilée");

      const c5 = getStreakCelebration(5);
      expect(c5).toBeDefined();
      expect(c5.label).toContain("5 d'affilée");

      const c10 = getStreakCelebration(10);
      expect(c10).toBeDefined();
      expect(c10.label).toContain("10 !");

      const c15 = getStreakCelebration(15);
      expect(c15).toBeDefined();
      expect(c15.label).toContain("15 !");

      const c20 = getStreakCelebration(20);
      expect(c20).toBeDefined();
      expect(c20.label).toContain("20 !");
    });
  });

  describe("quizUtils - formatQuizTimer", () => {
    it("formats zero and small numbers as MM:SS", () => {
      expect(formatQuizTimer(0)).toBe("00:00");
      expect(formatQuizTimer(9)).toBe("00:09");
      expect(formatQuizTimer(15)).toBe("00:15");
      expect(formatQuizTimer(59)).toBe("00:59");
    });

    it("formats minutes and seconds accurately", () => {
      expect(formatQuizTimer(60)).toBe("01:00");
      expect(formatQuizTimer(75)).toBe("01:15");
      expect(formatQuizTimer(615)).toBe("10:15");
    });

    it("handles negative or non-finite numbers safely", () => {
      expect(formatQuizTimer(-5)).toBe("00:00");
      expect(formatQuizTimer(null)).toBe("00:00");
      expect(formatQuizTimer(undefined)).toBe("00:00");
    });
  });

  describe("quizUtils - computeSessionSummary", () => {
    it("computes accurate percentage and stats for full success session", () => {
      const results = Array.from({ length: 10 }, () => ({ correct: true }));
      const summary = computeSessionSummary(results, 120, 10, 1800);

      expect(summary.accuracyPct).toBe(100);
      expect(summary.evaluation).toContain("Parfait");
      expect(summary.total).toBe(10);
      expect(summary.correct).toBe(10);
      expect(summary.incorrect).toBe(0);
      expect(summary.formattedDuration).toBe("02:00");
    });

    it("computes accurate percentage and encouragement for partial success", () => {
      const results = [
        { correct: true },
        { correct: true },
        { correct: true },
        { correct: false },
      ];
      const summary = computeSessionSummary(results, 45, 3, 350);

      expect(summary.accuracyPct).toBe(75);
      expect(summary.evaluation).toContain("Bon travail");
      expect(summary.incorrect).toBe(1);
      expect(summary.correct).toBe(3);
    });

    it("handles zero total questions gracefully", () => {
      const summary = computeSessionSummary([], 0, 0, 0);
      expect(summary.accuracyPct).toBe(0);
      expect(summary.evaluation).toBe("Continue tes efforts !");
    });
  });

  describe("quizUtils - filterQuestionsForReview", () => {
    it("filters an array of questions to only those matching mistakes", () => {
      const allQuestions = [
        { id: "q1", sn: 1, an: 1, text: "Verset 1" },
        { id: "q2", sn: 1, an: 2, text: "Verset 2" },
        { id: "q3", sn: 1, an: 3, text: "Verset 3" },
        { id: "q4", sn: 112, an: 1, text: "Sourate 112:1" },
      ];

      const mistakes = [
        { qId: "q2", sn: 1, ayatNum: 2 },
        { qId: "q4", sn: 112, ayatNum: 1 },
      ];

      const reviewSet = filterQuestionsForReview(allQuestions, mistakes);
      expect(reviewSet).toHaveLength(2);
      expect(reviewSet.map(q => q.id)).toEqual(["q2", "q4"]);
    });

    it("returns empty array if mistakes list is empty", () => {
      const allQuestions = [{ id: "q1", sn: 1, an: 1 }];
      expect(filterQuestionsForReview(allQuestions, [])).toEqual([]);
    });
  });

  describe("quizUtils - playQuizSound & triggerQuizHaptic", () => {
    it("executes sounds safely even without Web Audio API in test environment", () => {
      expect(() => playQuizSound("correct", true)).not.toThrow();
      expect(() => playQuizSound("streak", true)).not.toThrow();
      expect(() => playQuizSound("incorrect", true)).not.toThrow();
      expect(() => playQuizSound("tick", false)).not.toThrow();
    });

    it("executes haptic vibrations safely", () => {
      expect(() => triggerQuizHaptic("success", true)).not.toThrow();
      expect(() => triggerQuizHaptic("error", true)).not.toThrow();
      expect(() => triggerQuizHaptic("streak", false)).not.toThrow();
    });
  });

  describe("quizUtils - generateMultipleChoiceOptions & QUIZ_PRESETS", () => {
    it("defines standard quiz presets", () => {
      expect(QUIZ_PRESETS).toBeDefined();
      expect(QUIZ_PRESETS.length).toBeGreaterThanOrEqual(4);
      expect(QUIZ_PRESETS.some(p => p.id === "express")).toBe(true);
      expect(QUIZ_PRESETS.some(p => p.id === "starts_ends")).toBe(true);
    });

    it("generates 4 multiple choice options with exactly 1 correct option", () => {
      const question = {
        id: "q_112_1",
        sn: 112,
        ayatNum: 1,
        type: "first_word",
        answer: "قُلْ",
      };
      const allAyatTexts = {
        "112:1": "قُلْ هُوَ اللَّهُ أَحَدٌ",
        "112:2": "اللَّهُ الصَّمَدُ",
        "112:3": "لَمْ يَلِدْ وَلَمْ يُولَدْ",
      };

      const options = generateMultipleChoiceOptions({
        question,
        allAyatTexts,
        count: 4,
      });

      expect(options).toHaveLength(4);
      const correctOpts = options.filter(o => o.isCorrect);
      expect(correctOpts).toHaveLength(1);
      expect(correctOpts[0].text).toBe("قُلْ");
    });

    it("generates plausible numbers for verse_number questions", () => {
      const question = {
        id: "q_vn_7",
        sn: 1,
        ayatNum: 7,
        type: "verse_number",
        answer: "7",
      };
      const options = generateMultipleChoiceOptions({ question, count: 4 });
      expect(options).toHaveLength(4);
      expect(options.some(o => o.text === "7" && o.isCorrect)).toBe(true);
      expect(options.every(o => Number(o.text) >= 1)).toBe(true);
    });

    it("handles missing or empty questions gracefully", () => {
      expect(generateMultipleChoiceOptions({ question: null })).toEqual([]);
      expect(generateMultipleChoiceOptions({ question: { answer: "" } })).toEqual([]);
    });
  });
});

describe("Quiz Redux State Manager (quizSlice)", () => {
  beforeEach(() => {
    store.dispatch(quizActions.resetQuizSession());
    store.dispatch(quizActions.clearQuizMistakes());
  });

  it("has valid initial quiz state and selectors", () => {
    const s = store.getState();
    expect(sel.quizStreak(s)).toBe(0);
    expect(sel.quizScore(s)).toBe(0);
    expect(sel.quizTimerMode(s)).toBeDefined();
    expect(sel.quizSoundEffects(s)).toBe(true);
    expect(sel.quizAnswerMode(s)).toBeDefined();
    expect(sel.quizHapticFeedback(s)).toBe(true);
    expect(sel.quizMistakes(s)).toEqual([]);
  });

  it("updates streak, bestStreak, and score on correct answers", () => {
    store.dispatch(
      quizActions.recordQuizAnswer({
        isCorrect: true,
        sn: 1,
        ayatNum: 1,
        timeBonus: 10,
      })
    );

    let state = store.getState();
    expect(sel.quizStreak(state)).toBe(1);
    expect(sel.quizBestStreak(state)).toBe(1);
    expect(sel.quizScore(state)).toBe(125); // 100 + 15 (streak) + 10 (bonus)

    // Record second correct answer
    store.dispatch(
      quizActions.recordQuizAnswer({
        isCorrect: true,
        sn: 1,
        ayatNum: 2,
        timeBonus: 0,
      })
    );

    state = store.getState();
    expect(sel.quizStreak(state)).toBe(2);
    expect(sel.quizBestStreak(state)).toBe(2);
    // 125 + (100 + 30) = 255
    expect(sel.quizScore(state)).toBe(255);
  });

  it("resets current streak and logs mistakes on incorrect answers without resetting bestStreak", () => {
    store.dispatch(quizActions.recordQuizAnswer({ isCorrect: true }));
    store.dispatch(quizActions.recordQuizAnswer({ isCorrect: true }));
    expect(sel.quizStreak(store.getState())).toBe(2);
    expect(sel.quizBestStreak(store.getState())).toBe(2);

    store.dispatch(
      quizActions.recordQuizAnswer({
        isCorrect: false,
        sn: 112,
        ayatNum: 2,
        qId: "q_112_2",
        type: "first_word",
        question: "Premier mot de Al-Ikhlas:2 ?",
        answer: "اللَّهُ",
        userAnswer: "قُلْ",
      })
    );

    const state = store.getState();
    expect(sel.quizStreak(state)).toBe(0);
    expect(sel.quizBestStreak(state)).toBe(2);
    const mistakes = sel.quizMistakes(state);
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0].sn).toBe(112);
    expect(mistakes[0].ayatNum).toBe(2);
    expect(mistakes[0].userAnswer).toBe("قُلْ");
  });

  it("manages answerMode, haptics, and presets", () => {
    store.dispatch(quizActions.setQuizAnswerMode("free"));
    expect(sel.quizAnswerMode(store.getState())).toBe("free");

    store.dispatch(quizActions.setQuizAnswerMode("choice"));
    expect(sel.quizAnswerMode(store.getState())).toBe("choice");

    const hapticInit = sel.quizHapticFeedback(store.getState());
    store.dispatch(quizActions.toggleQuizHaptic());
    expect(sel.quizHapticFeedback(store.getState())).toBe(!hapticInit);

    store.dispatch(quizActions.setQuizPreset("express"));
    expect(sel.quizSelectedPreset(store.getState())).toBe("express");
  });

  it("configures timer mode and sets corresponding timeRemaining", () => {
    store.dispatch(quizActions.setQuizTimerMode("15s"));
    let state = store.getState();
    expect(sel.quizTimerMode(state)).toBe("15s");
    expect(sel.quizTimeRemaining(state)).toBe(15);

    store.dispatch(quizActions.decrementTimeRemaining());
    expect(sel.quizTimeRemaining(store.getState())).toBe(14);

    store.dispatch(quizActions.setQuizTimerMode("off"));
    state = store.getState();
    expect(sel.quizTimerMode(state)).toBe("off");
    expect(sel.quizTimeRemaining(state)).toBe(0);
  });

  it("toggles sound effects", () => {
    const initial = sel.quizSoundEffects(store.getState());
    store.dispatch(quizActions.toggleQuizSound());
    expect(sel.quizSoundEffects(store.getState())).toBe(!initial);
    store.dispatch(quizActions.toggleQuizSound());
    expect(sel.quizSoundEffects(store.getState())).toBe(initial);
  });

  it("saves and retrieves quiz session summaries", () => {
    const summaryData = {
      score: 450,
      accuracy: 85,
      total: 10,
      timestamp: new Date().toISOString(),
    };
    store.dispatch(quizActions.saveQuizSummary(summaryData));
    expect(sel.quizLastSummary(store.getState())).toEqual(summaryData);
  });
});

describe("Quiz Route Manager Integration", () => {
  it("builds clean multi-surah quiz routes with query params including mode", () => {
    const route = buildQuizRoute({ timer: "30s", preset: "first_contact", mode: "choice" });
    expect(route).toBe("/revision/questions?preset=first_contact&timer=30s&mode=choice");
  });

  it("builds mono-surah quiz routes with path segments, timer and mode query", () => {
    const route = buildQuizRoute({
      sn: 114,
      rf: 1,
      rt: 6,
      qi: 3,
      timer: "15s",
      mode: "free",
    });
    expect(route).toBe("/revision/questions/114/1/6/3?timer=15s&mode=free");
  });

  it("parses quiz routes accurately with params, timer and mode", () => {
    const parsed = parseQuizRoute(
      "/revision/questions/112/1/4/2",
      "?timer=60s&preset=first_contact&mode=choice"
    );
    expect(parsed.isQuiz).toBe(true);
    expect(parsed.surahNum).toBe(112);
    expect(parsed.rangeFrom).toBe(1);
    expect(parsed.rangeTo).toBe(4);
    expect(parsed.qIdx).toBe(2);
    expect(parsed.timer).toBe("60s");
    expect(parsed.preset).toBe("first_contact");
    expect(parsed.mode).toBe("choice");
  });

  it("handles non-quiz routes safely", () => {
    const parsed = parseQuizRoute("/dashboard", "");
    expect(parsed.isQuiz).toBe(false);
    expect(parsed.surahNum).toBeNull();
  });
});

describe("Quiz Error Manager Integration", () => {
  it("defines QUIZ_ERROR code in ERROR_CODES", () => {
    expect(ERROR_CODES.QUIZ_ERROR).toBe("QUIZ_ERROR");
  });

  it("creates standard app error for quiz events", () => {
    const err = createAppError(ERROR_CODES.QUIZ_ERROR, "Échec de génération des questions de révision", {
      surahNum: 1,
      range: "1-7",
    });
    expect(err.code).toBe("QUIZ_ERROR");
    expect(err.message).toContain("Échec de génération");
    expect(err.context.surahNum).toBe(1);
  });
});

describe("Quiz UI/UX Utilities - Tajweed, Font Sizing & Multipliers", () => {
  describe("formatStreakMultiplier", () => {
    it("returns x1.0 for streaks under 3", () => {
      expect(formatStreakMultiplier(0)).toBe("x1.0");
      expect(formatStreakMultiplier(1)).toBe("x1.0");
      expect(formatStreakMultiplier(2)).toBe("x1.0");
    });

    it("returns milestone multipliers (x1.2, x1.5, x2.0, x2.5)", () => {
      expect(formatStreakMultiplier(3)).toBe("x1.2");
      expect(formatStreakMultiplier(4)).toBe("x1.2");
      expect(formatStreakMultiplier(5)).toBe("x1.5");
      expect(formatStreakMultiplier(9)).toBe("x1.5");
      expect(formatStreakMultiplier(10)).toBe("x2.0");
      expect(formatStreakMultiplier(14)).toBe("x2.0");
      expect(formatStreakMultiplier(15)).toBe("x2.5");
    });
  });

  describe("getTajweedToggleLabel", () => {
    it("returns proper label according to active status", () => {
      expect(getTajweedToggleLabel(true)).toContain("Tajwîd actif");
      expect(getTajweedToggleLabel(false)).toContain("Tajwîd masqué");
    });
  });

  describe("getFontSizeStyle", () => {
    it("returns proper fontSize and lineHeight for each level", () => {
      const sm = getFontSizeStyle("sm");
      expect(sm.fontSize).toBe("1.25rem");

      const md = getFontSizeStyle("md");
      expect(md.fontSize).toBe("1.55rem");

      const lg = getFontSizeStyle("lg");
      expect(lg.fontSize).toBe("1.9rem");

      const xl = getFontSizeStyle("xl");
      expect(xl.fontSize).toBe("2.3rem");

      // Default fallback
      const def = getFontSizeStyle("unknown");
      expect(def.fontSize).toBe("1.55rem");
    });
  });

  describe("computeMistakesSummaryByCategory", () => {
    it("returns empty array when no mistakes", () => {
      expect(computeMistakesSummaryByCategory([])).toEqual([]);
      expect(computeMistakesSummaryByCategory(null)).toEqual([]);
    });

    it("groups and sorts mistakes by question type", () => {
      const mistakes = [
        { type: "next_verse", sn: 1, ayatNum: 2 },
        { type: "next_verse", sn: 1, ayatNum: 3 },
        { type: "first_word", sn: 1, ayatNum: 4 },
        { type: "first_word", sn: 1, ayatNum: 5 },
        { type: "first_word", sn: 1, ayatNum: 6 },
        { type: "missing_word", sn: 1, ayatNum: 7 },
      ];

      const summary = computeMistakesSummaryByCategory(mistakes);
      expect(summary.length).toBe(3);
      expect(summary[0].type).toBe("first_word");
      expect(summary[0].label).toBe("Premier mot");
      expect(summary[0].count).toBe(3);

      expect(summary[1].type).toBe("next_verse");
      expect(summary[1].label).toBe("Verset suivant");
      expect(summary[1].count).toBe(2);

      expect(summary[2].type).toBe("missing_word");
      expect(summary[2].count).toBe(1);
    });
  });

  describe("createMistakesCollectionPayload", () => {
    it("returns null for empty mistakes list", () => {
      expect(createMistakesCollectionPayload([])).toBeNull();
      expect(createMistakesCollectionPayload(null)).toBeNull();
    });

    it("creates deduplicated collection payload with timestamps and context name", () => {
      const mistakes = [
        { sn: 112, ayatNum: 2 },
        { sn: 112, ayatNum: 2 }, // duplicate
        { sn: 112, ayatNum: 3 },
      ];

      const payload = createMistakesCollectionPayload(mistakes, "Al-Ikhlas");
      expect(payload).toBeDefined();
      expect(payload.name).toContain("Erreurs Quiz (Al-Ikhlas)");
      expect(payload.ayats.length).toBe(2);
      expect(payload.totalAyats).toBe(2);
      expect(payload.ayats).toEqual([
        { sn: 112, ayatNum: 2 },
        { sn: 112, ayatNum: 3 },
      ]);
    });
  });
});

describe("Quiz Store Extensions - Collections & UI Settings", () => {
  it("creates collection with multiple ayats via createCollectionWithMultipleAyats", () => {
    const payload = {
      name: "Révision Versets 1-3",
      ayats: [
        { sn: 1, ayatNum: 1 },
        { sn: 1, ayatNum: 2 },
        { sn: 1, ayatNum: 3 },
      ],
    };

    store.dispatch(collectionsActions.createCollectionWithMultipleAyats(payload));
    const collections = sel.collections(store.getState());
    const created = collections.find((c) => c.name === "Révision Versets 1-3");
    expect(created).toBeDefined();
    expect(created.ayats.length).toBe(3);
  });

  it("sets and persists quiz Arabic font size", () => {
    store.dispatch(quizActions.setQuizArabicFontSize("xl"));
    expect(sel.quizArabicFontSize(store.getState())).toBe("xl");

    store.dispatch(quizActions.setQuizArabicFontSize("sm"));
    expect(sel.quizArabicFontSize(store.getState())).toBe("sm");
  });

  it("toggles quiz Tajweed display preference", () => {
    const initial = sel.quizShowTajweed(store.getState());
    store.dispatch(quizActions.toggleQuizTajweed());
    expect(sel.quizShowTajweed(store.getState())).toBe(!initial);

    store.dispatch(quizActions.toggleQuizTajweed());
    expect(sel.quizShowTajweed(store.getState())).toBe(initial);
  });
});

