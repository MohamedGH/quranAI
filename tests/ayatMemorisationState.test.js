import { describe, it, expect } from "vitest";
import {
  MEMORISATION_STEPS,
  computeAyatMemorisationState,
  recordStepQuizResult,
  toggleWordLearnedStatus,
  setAllWordsLearned,
  generateTopicQuiz,
  generateNumberQuiz,
  generateFirstWordQuiz,
  generateLastWordQuiz,
  generateSpecificWordsQuiz,
  generateMetricsQuiz,
} from "../src/utils/ayatMemorisationState.js";

describe("ayatMemorisationState", () => {
  const sampleAyat = {
    number: 1,
    numberInSurah: 1,
    text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    page: 1,
    juz: 1,
  };

  const sampleSurah = {
    number: 1,
    name: "الفاتحة",
    englishName: "Al-Faatiha",
    numberOfAyahs: 7,
  };

  it("should have all 7 defined steps in correct order", () => {
    expect(MEMORISATION_STEPS).toHaveLength(7);
    expect(MEMORISATION_STEPS[0].id).toBe("topic");
    expect(MEMORISATION_STEPS[1].id).toBe("number");
    expect(MEMORISATION_STEPS[2].id).toBe("firstWord");
    expect(MEMORISATION_STEPS[3].id).toBe("lastWord");
    expect(MEMORISATION_STEPS[4].id).toBe("specificWords");
    expect(MEMORISATION_STEPS[5].id).toBe("metrics");
    expect(MEMORISATION_STEPS[6].id).toBe("allWords");
  });

  it("should compute initial unlearned memorisation state correctly", () => {
    const state = computeAyatMemorisationState({}, sampleAyat, sampleSurah);
    expect(state.totalSteps).toBe(7);
    expect(state.completedCount).toBe(0);
    expect(state.overallPercentage).toBe(0);
    expect(state.isFullyMastered).toBe(false);
    expect(state.stepsStatus.topic.isCompleted).toBe(false);
    expect(state.stepsStatus.number.isCompleted).toBe(false);
    expect(state.stepsStatus.firstWord.firstWord).toBe("بِسْمِ");
    expect(state.stepsStatus.lastWord.lastWord).toBe("الرَّحِيمِ");
  });

  it("should record quiz results and update step status", () => {
    let ld = {};
    ld = recordStepQuizResult(ld, "topic", true, 100);
    ld = recordStepQuizResult(ld, "number", true, 100);
    
    const state = computeAyatMemorisationState(ld, sampleAyat, sampleSurah);
    expect(state.completedCount).toBe(2);
    expect(state.overallPercentage).toBe(Math.round((2 / 7) * 100));
    expect(state.stepsStatus.topic.isCompleted).toBe(true);
    expect(state.stepsStatus.number.isCompleted).toBe(true);
  });

  it("should toggle word learned status and handle all words", () => {
    let ld = {};
    ld = toggleWordLearnedStatus(ld, 0, 4);
    ld = toggleWordLearnedStatus(ld, 1, 4);

    let state = computeAyatMemorisationState(ld, sampleAyat, sampleSurah);
    expect(state.learnedWordIndices).toEqual([0, 1]);
    expect(state.stepsStatus.allWords.percentLearned).toBe(50);
    expect(state.stepsStatus.allWords.isCompleted).toBe(false);

    // Learn all remaining words
    ld = setAllWordsLearned(ld, 4, true);
    state = computeAyatMemorisationState(ld, sampleAyat, sampleSurah);
    expect(state.stepsStatus.allWords.isCompleted).toBe(true);
    expect(state.stepsStatus.allWords.percentLearned).toBe(100);
  });

  it("should generate valid quizzes for each of the 6 step types", () => {
    const topicQuiz = generateTopicQuiz(sampleAyat, sampleSurah, { subject: "Tawhid et miséricorde" });
    expect(topicQuiz.options).toContain("Tawhid et miséricorde");
    expect(topicQuiz.correctOption).toBe("Tawhid et miséricorde");
    expect(topicQuiz.options.length).toBeGreaterThanOrEqual(4);

    const numberQuiz = generateNumberQuiz(sampleAyat, sampleSurah);
    expect(numberQuiz.correctOption).toBe("Verset 1");
    expect(numberQuiz.options).toContain("Verset 1");
    expect(numberQuiz.options.length).toBeGreaterThanOrEqual(4);

    const firstWordQuiz = generateFirstWordQuiz(sampleAyat);
    expect(firstWordQuiz.correctOption).toBe("بِسْمِ");
    expect(firstWordQuiz.options).toContain("بِسْمِ");

    const lastWordQuiz = generateLastWordQuiz(sampleAyat);
    expect(lastWordQuiz.correctOption).toBe("الرَّحِيمِ");
    expect(lastWordQuiz.options).toContain("الرَّحِيمِ");

    const specificQuiz = generateSpecificWordsQuiz(sampleAyat, null, { unknownWords: [1] });
    expect(specificQuiz.targetWord).toBe("اللَّهِ");
    expect(specificQuiz.options).toContain("اللَّهِ");

    const metricsQuiz = generateMetricsQuiz(sampleAyat, sampleSurah, null, { page: 1, juz: 1 });
    expect(metricsQuiz.options).toContain(metricsQuiz.correctOption);
    expect(metricsQuiz.options.length).toBeGreaterThanOrEqual(4);
  });
});
