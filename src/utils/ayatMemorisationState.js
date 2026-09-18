import { splitArabicWords } from "./arabicUtils.js";
import { normalizeArabic } from "./recitationDiff.js";

/**
 * Ayat Memorisation Steps Definition
 * Step 1: Topic of ayat (Thème / Sujet / Sens)
 * Step 2: Number of ayat (Numéro du verset)
 * Step 3: First word of ayat (Premier mot)
 * Step 4: Last word of ayat (Dernier mot / Rime / Fasilah)
 * Step 5: Specific words (Mots spécifiques, marqués ou inconnus)
 * Step 6: Metrics of ayat (Métriques: Page, Juz, Hizb, Nombre de mots)
 * Step 7: Learn all words of an ayat (Apprentissage et maîtrise de tous les mots)
 */

export const MEMORISATION_STEPS = [
  {
    id: "topic",
    stepNumber: 1,
    title: "Thème de l'ayat",
    shortLabel: "Thème",
    icon: "📌",
    description: "Comprendre et mémoriser le sujet principal ou le sens général du verset.",
    quizLabel: "Quizz Thème & Sens",
  },
  {
    id: "number",
    stepNumber: 2,
    title: "Numéro de l'ayat",
    shortLabel: "Numéro",
    icon: "🔢",
    description: "Identifier et situer précisément le numéro du verset dans sa sourate.",
    quizLabel: "Quizz Numéro de verset",
  },
  {
    id: "firstWord",
    stepNumber: 3,
    title: "Premier mot",
    shortLabel: "1er Mot",
    icon: "🏁",
    description: "Mémoriser le premier mot (ou phrase d'ouverture) de l'ayat pour déclencher la récitation.",
    quizLabel: "Quizz Premier mot",
  },
  {
    id: "lastWord",
    stepNumber: 4,
    title: "Dernier mot",
    shortLabel: "Dernier Mot",
    icon: "🎯",
    description: "Mémoriser la fin de l'ayat (la rime coranique / fassilah) pour enchaîner fluidement.",
    quizLabel: "Quizz Dernier mot",
  },
  {
    id: "specificWords",
    stepNumber: 5,
    title: "Mots spécifiques",
    shortLabel: "Mots Clés",
    icon: "🏷",
    description: "Maîtriser les mots marqués, le vocabulaire difficile ou les mots méconnus.",
    quizLabel: "Quizz Mots spécifiques",
  },
  {
    id: "metrics",
    stepNumber: 6,
    title: "Métriques de l'ayat",
    shortLabel: "Métriques",
    icon: "📊",
    description: "Situer l'ayat dans le Mushaf : numéro de page, Juz, Hizb et longueur en mots.",
    quizLabel: "Quizz Métriques & Page",
  },
  {
    id: "allWords",
    stepNumber: 7,
    title: "Tous les mots de l'ayat",
    shortLabel: "Tous les Mots",
    icon: "🔤",
    description: "Objectif ultime : mémoriser et enchaîner chaque mot de l'ayat avec exactitude.",
    quizLabel: "Quizz Maîtrise mot à mot",
  },
];

/**
 * Standard topics list used for distractors or default subject categorization
 */
export const THEMATIC_CATEGORIES = [
  "Louange, Tawhid et attributs d'Allah",
  "Prière, invocation et demande de guidance",
  "Récits des prophètes et peuples anciens",
  "Prescriptions, lois et moralité",
  "Signes dans l'univers et la création",
  "Rappel du Jour dernier, Paradis et Enfer",
  "Patience, confiance en Allah et endurance",
  "Combat spirituel, sincérité et foi",
];

/**
 * Extracts and cleans words from Arabic verse text
 */
export function getCleanVerseWords(text) {
  if (!text) return [];
  return splitArabicWords(text).filter(w => Boolean(w && w.trim()));
}

/**
 * Computes the complete memorisation state of an ayat
 */
export function computeAyatMemorisationState(ld = {}, ayat = {}, surahInfo = {}, words = null) {
  const verseText = ayat?.text || "";
  const verseWords = words || getCleanVerseWords(verseText);
  const totalWords = verseWords.length || 1;

  const memState = ld?.memorisationState || {};
  const stepProgress = memState.stepProgress || {};

  // Learned words tracking
  const learnedWordIndices = Array.isArray(memState.learnedWordIndices)
    ? [...memState.learnedWordIndices]
    : [];
  
  // Specific / unknown words
  const unknownIndices = Array.isArray(ld?.unknownWords) ? ld.unknownWords : [];
  const markedHighlight = Boolean(ld?.highlight);
  const hasSpecificWords = unknownIndices.length > 0 || markedHighlight || Boolean(ld?.toRevise);

  // 1. Topic
  const hasSubject = Boolean(ld?.subject && ld.subject.trim());
  const topicData = stepProgress.topic || {};
  const isTopicMastered = Boolean(topicData.mastered || (hasSubject && topicData.score >= 80));

  // 2. Number
  const numberData = stepProgress.number || {};
  const isNumberMastered = Boolean(numberData.mastered || numberData.score >= 80);

  // 3. First Word
  const firstWordData = stepProgress.firstWord || {};
  const isFirstWordMastered = Boolean(firstWordData.mastered || firstWordData.score >= 80);

  // 4. Last Word
  const lastWordData = stepProgress.lastWord || {};
  const isLastWordMastered = Boolean(lastWordData.mastered || lastWordData.score >= 80);

  // 5. Specific Words
  const specificWordsData = stepProgress.specificWords || {};
  const isSpecificWordsMastered = Boolean(
    specificWordsData.mastered ||
    (specificWordsData.score >= 80) ||
    (hasSpecificWords && specificWordsData.tested)
  );

  // 6. Metrics
  const metricsData = stepProgress.metrics || {};
  const isMetricsMastered = Boolean(metricsData.mastered || metricsData.score >= 80);

  // 7. All Words
  const allWordsData = stepProgress.allWords || {};
  const percentWordsLearned = Math.min(100, Math.round((learnedWordIndices.length / Math.max(1, totalWords)) * 100));
  const isAllWordsMastered = Boolean(
    allWordsData.mastered ||
    percentWordsLearned === 100 ||
    allWordsData.score >= 90 ||
    ld?.learned === true
  );

  const stepsStatus = {
    topic: {
      ...MEMORISATION_STEPS[0],
      isCompleted: isTopicMastered,
      score: topicData.score ?? (isTopicMastered ? 100 : hasSubject ? 70 : 0),
      attempts: topicData.attempts || 0,
      lastTestedAt: topicData.lastTestedAt || null,
      customSubject: ld?.subject || null,
      summary: ld?.subject ? `Sujet : ${ld.subject}` : "Thème général à valider",
    },
    number: {
      ...MEMORISATION_STEPS[1],
      isCompleted: isNumberMastered,
      score: numberData.score ?? (isNumberMastered ? 100 : 0),
      attempts: numberData.attempts || 0,
      lastTestedAt: numberData.lastTestedAt || null,
      ayatNum: ayat?.numberInSurah,
      totalAyahs: surahInfo?.numberOfAyahs || 0,
      summary: `Verset ${ayat?.numberInSurah || 1} sur ${surahInfo?.numberOfAyahs || 0}`,
    },
    firstWord: {
      ...MEMORISATION_STEPS[2],
      isCompleted: isFirstWordMastered,
      score: firstWordData.score ?? (isFirstWordMastered ? 100 : 0),
      attempts: firstWordData.attempts || 0,
      lastTestedAt: firstWordData.lastTestedAt || null,
      firstWord: verseWords[0] || "",
      summary: verseWords[0] ? `Début : « ${verseWords[0]} »` : "Premier mot",
    },
    lastWord: {
      ...MEMORISATION_STEPS[3],
      isCompleted: isLastWordMastered,
      score: lastWordData.score ?? (isLastWordMastered ? 100 : 0),
      attempts: lastWordData.attempts || 0,
      lastTestedAt: lastWordData.lastTestedAt || null,
      lastWord: verseWords[verseWords.length - 1] || "",
      summary: verseWords[verseWords.length - 1] ? `Fin : « ${verseWords[verseWords.length - 1]} »` : "Dernier mot",
    },
    specificWords: {
      ...MEMORISATION_STEPS[4],
      isCompleted: isSpecificWordsMastered,
      score: specificWordsData.score ?? (isSpecificWordsMastered ? 100 : 0),
      attempts: specificWordsData.attempts || 0,
      lastTestedAt: specificWordsData.lastTestedAt || null,
      unknownCount: unknownIndices.length,
      hasHighlight: markedHighlight,
      summary: unknownIndices.length > 0
        ? `${unknownIndices.length} mot(s) inconnu(s) ciblé(s)`
        : markedHighlight
        ? `Mot clé : ${ld.highlight}`
        : "Mots cibles et vocabulaire",
    },
    metrics: {
      ...MEMORISATION_STEPS[5],
      isCompleted: isMetricsMastered,
      score: metricsData.score ?? (isMetricsMastered ? 100 : 0),
      attempts: metricsData.attempts || 0,
      lastTestedAt: metricsData.lastTestedAt || null,
      page: ayat?.page || null,
      juz: ayat?.juz || null,
      wordsCount: totalWords,
      summary: `Page ${ayat?.page ?? "—"} · Juz ${ayat?.juz ?? "—"} · ${totalWords} mots`,
    },
    allWords: {
      ...MEMORISATION_STEPS[6],
      isCompleted: isAllWordsMastered,
      score: allWordsData.score ?? percentWordsLearned,
      attempts: allWordsData.attempts || 0,
      lastTestedAt: allWordsData.lastTestedAt || null,
      learnedCount: learnedWordIndices.length,
      totalWords,
      percentLearned: percentWordsLearned,
      summary: `${learnedWordIndices.length}/${totalWords} mots appris (${percentWordsLearned}%)`,
    },
  };

  const completedCount = Object.values(stepsStatus).filter(s => s.isCompleted).length;
  const overallPercentage = Math.round((completedCount / MEMORISATION_STEPS.length) * 100);

  return {
    stepsStatus,
    completedCount,
    totalSteps: MEMORISATION_STEPS.length,
    overallPercentage,
    overallLevel: completedCount,
    learnedWordIndices,
    totalWords,
    isFullyMastered: completedCount === MEMORISATION_STEPS.length,
    updatedAt: memState.updatedAt || null,
  };
}

/**
 * Updates learnData with step test results immutably
 */
export function recordStepQuizResult(currentLd = {}, stepId, passed, score = 100, details = {}) {
  const prevMemState = currentLd.memorisationState || {};
  const prevStepProgress = prevMemState.stepProgress || {};
  const prevStep = prevStepProgress[stepId] || {};

  const attempts = (prevStep.attempts || 0) + 1;
  const wasMastered = prevStep.mastered || false;
  const mastered = passed || (score >= 80) || wasMastered;

  const updatedStepProgress = {
    ...prevStepProgress,
    [stepId]: {
      ...prevStep,
      mastered,
      score: Math.max(prevStep.score || 0, score),
      attempts,
      lastScore: score,
      lastPassed: passed,
      lastTestedAt: new Date().toISOString(),
      ...details,
    },
  };

  let updatedLearnedWords = prevMemState.learnedWordIndices
    ? [...prevMemState.learnedWordIndices]
    : [];

  if (stepId === "allWords" && details.learnedWordIndices) {
    updatedLearnedWords = details.learnedWordIndices;
  }

  const updatedMemState = {
    ...prevMemState,
    stepProgress: updatedStepProgress,
    learnedWordIndices: updatedLearnedWords,
    updatedAt: new Date().toISOString(),
  };

  // Also sync to root learnData fields where beneficial
  const updatedLd = {
    ...currentLd,
    memorisationState: updatedMemState,
  };

  if (details.customSubject) {
    updatedLd.subject = details.customSubject;
  }

  // If all steps passed or step 7 passed with 100%, mark as learned
  const allMastered = MEMORISATION_STEPS.every(s =>
    s.id === stepId ? mastered : updatedStepProgress[s.id]?.mastered
  );
  if (allMastered) {
    updatedLd.learned = true;
  }

  return updatedLd;
}

/**
 * Toggles a word learned status inside learnData
 */
export function toggleWordLearnedStatus(currentLd = {}, wordIndex, totalWords = 1) {
  const prevMemState = currentLd.memorisationState || {};
  const prevLearned = new Set(prevMemState.learnedWordIndices || []);

  if (prevLearned.has(wordIndex)) {
    prevLearned.delete(wordIndex);
  } else {
    prevLearned.add(wordIndex);
  }

  const learnedWordIndices = Array.from(prevLearned).sort((a, b) => a - b);
  const isAllLearned = learnedWordIndices.length >= totalWords;

  return {
    ...currentLd,
    memorisationState: {
      ...prevMemState,
      learnedWordIndices,
      stepProgress: {
        ...(prevMemState.stepProgress || {}),
        allWords: {
          ...(prevMemState.stepProgress?.allWords || {}),
          mastered: isAllLearned,
          score: Math.round((learnedWordIndices.length / totalWords) * 100),
          lastTestedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Marks all words as learned or resets them
 */
export function setAllWordsLearned(currentLd = {}, totalWords, shouldLearnAll = true) {
  const prevMemState = currentLd.memorisationState || {};
  const learnedWordIndices = shouldLearnAll
    ? Array.from({ length: totalWords }, (_, i) => i)
    : [];

  return {
    ...currentLd,
    memorisationState: {
      ...prevMemState,
      learnedWordIndices,
      stepProgress: {
        ...(prevMemState.stepProgress || {}),
        allWords: {
          ...(prevMemState.stepProgress?.allWords || {}),
          mastered: shouldLearnAll,
          score: shouldLearnAll ? 100 : 0,
          lastTestedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ GENERATORS FOR EACH STEP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quiz 1: Topic / Thème of Ayat
 */
export function generateTopicQuiz(ayat, surah, ld = {}, translation = "") {
  const subject = ld?.subject?.trim();
  const correctTopic = subject || (
    translation
      ? translation.length > 90 ? translation.slice(0, 85) + "…" : translation
      : `Enseignement spirituel et guidance (Verset ${ayat.numberInSurah})`
  );

  // Distractors
  const pool = THEMATIC_CATEGORIES.filter(c => c.toLowerCase() !== correctTopic.toLowerCase());
  const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
  const distractors = shuffledPool.slice(0, 3);

  const options = [correctTopic, ...distractors].sort(() => Math.random() - 0.5);

  return {
    stepId: "topic",
    title: "Quel est le thème principal de cet ayat ?",
    instruction: "Choisissez l'explication ou le sens qui correspond le mieux au verset :",
    correctOption: correctTopic,
    options,
    verseText: ayat.text,
    ayatNum: ayat.numberInSurah,
    hasCustomSubject: Boolean(subject),
  };
}

/**
 * Quiz 2: Number of Ayat
 */
export function generateNumberQuiz(ayat, surah) {
  const correctNum = ayat.numberInSurah;
  const maxAyahs = surah?.numberOfAyahs || 7;

  const candidateNums = new Set([correctNum]);
  const offsets = [-2, -1, 1, 2, 3, -3, 4, 5];
  for (const off of offsets) {
    const candidate = correctNum + off;
    if (candidate >= 1 && candidate <= maxAyahs && candidate !== correctNum) {
      candidateNums.add(candidate);
    }
    if (candidateNums.size >= 4) break;
  }

  // Fallback if small surah
  let fallback = 1;
  while (candidateNums.size < 4 && fallback <= Math.max(10, maxAyahs)) {
    if (fallback !== correctNum) candidateNums.add(fallback);
    fallback++;
  }

  const options = Array.from(candidateNums)
    .map(n => `Verset ${n}`)
    .sort(() => Math.random() - 0.5);

  return {
    stepId: "number",
    title: `Quel est le numéro de cet ayat dans la sourate ${surah?.englishName || "ciblée"} ?`,
    instruction: "Identifiez le numéro exact du verset affiché :",
    correctOption: `Verset ${correctNum}`,
    options,
    verseText: ayat.text,
    ayatNum: correctNum,
    surahName: surah?.englishName,
    surahArabic: surah?.name,
  };
}

/**
 * Quiz 3: First Word of Ayat
 */
export function generateFirstWordQuiz(ayat, words, otherAyatsTexts = []) {
  const verseWords = words?.length ? words : getCleanVerseWords(ayat.text);
  const firstWord = verseWords[0] || "";

  const distractorsSet = new Set();

  // Pick other words from the same ayat
  for (let i = 1; i < verseWords.length; i++) {
    if (verseWords[i] && normalizeArabic(verseWords[i]) !== normalizeArabic(firstWord)) {
      distractorsSet.add(verseWords[i]);
    }
  }

  // Pick first words from adjacent verses if available
  if (otherAyatsTexts && otherAyatsTexts.length > 0) {
    otherAyatsTexts.forEach(txt => {
      const otherWords = getCleanVerseWords(txt);
      if (otherWords[0] && normalizeArabic(otherWords[0]) !== normalizeArabic(firstWord)) {
        distractorsSet.add(otherWords[0]);
      }
    });
  }

  // Fallback Arabic words if needed
  const genericArabic = ["بِسْمِ", "الْحَمْدُ", "قُلْ", "إِنَّ", "الَّذِينَ", "يَا أَيُّهَا", "وَإِذْ", "اللَّهُ"];
  for (const w of genericArabic) {
    if (distractorsSet.size >= 3) break;
    if (normalizeArabic(w) !== normalizeArabic(firstWord)) {
      distractorsSet.add(w);
    }
  }

  const selectedDistractors = Array.from(distractorsSet)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const options = [firstWord, ...selectedDistractors].sort(() => Math.random() - 0.5);

  return {
    stepId: "firstWord",
    title: "Quel est le premier mot de cet ayat ?",
    instruction: "Sélectionnez le mot par lequel commence la récitation de ce verset :",
    correctOption: firstWord,
    options,
    verseSnippet: verseWords.slice(1).join(" "),
    ayatNum: ayat.numberInSurah,
  };
}

/**
 * Quiz 4: Last Word of Ayat
 */
export function generateLastWordQuiz(ayat, words, otherAyatsTexts = []) {
  const verseWords = words?.length ? words : getCleanVerseWords(ayat.text);
  const lastWord = verseWords[verseWords.length - 1] || "";

  const distractorsSet = new Set();

  // Pick other words from verse
  for (let i = 0; i < verseWords.length - 1; i++) {
    if (verseWords[i] && normalizeArabic(verseWords[i]) !== normalizeArabic(lastWord)) {
      distractorsSet.add(verseWords[i]);
    }
  }

  // Pick rhymes from other verses
  if (otherAyatsTexts && otherAyatsTexts.length > 0) {
    otherAyatsTexts.forEach(txt => {
      const otherWords = getCleanVerseWords(txt);
      const otherLast = otherWords[otherWords.length - 1];
      if (otherLast && normalizeArabic(otherLast) !== normalizeArabic(lastWord)) {
        distractorsSet.add(otherLast);
      }
    });
  }

  const genericEndings = ["الرَّحِيمِ", "الْعَالَمِينَ", "نَسْتَعِينُ", "الْمُسْتَقِيمَ", "الضَّالِّينَ", "عَظِيمٌ", "حَكِيمٌ"];
  for (const w of genericEndings) {
    if (distractorsSet.size >= 3) break;
    if (normalizeArabic(w) !== normalizeArabic(lastWord)) {
      distractorsSet.add(w);
    }
  }

  const selectedDistractors = Array.from(distractorsSet)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const options = [lastWord, ...selectedDistractors].sort(() => Math.random() - 0.5);

  return {
    stepId: "lastWord",
    title: "Quel est le dernier mot (rime / fassilah) de cet ayat ?",
    instruction: "Sélectionnez le mot qui clôture ce verset :",
    correctOption: lastWord,
    options,
    verseSnippet: verseWords.slice(0, -1).join(" "),
    ayatNum: ayat.numberInSurah,
  };
}

/**
 * Quiz 5: Specific / Marked / Unknown Words
 */
export function generateSpecificWordsQuiz(ayat, words, ld = {}) {
  const verseWords = words?.length ? words : getCleanVerseWords(ayat.text);
  const unknownIndices = ld?.unknownWords || [];

  // Determine target words
  let targetIndex = null;
  if (unknownIndices.length > 0) {
    targetIndex = unknownIndices[Math.floor(Math.random() * unknownIndices.length)];
  } else if (ld?.highlight) {
    // Try to find highlight
    const foundIdx = verseWords.findIndex(w => w.includes(ld.highlight) || ld.highlight.includes(w));
    targetIndex = foundIdx >= 0 ? foundIdx : Math.floor(verseWords.length / 2);
  } else {
    // Default to a central interesting word
    targetIndex = Math.min(verseWords.length - 1, Math.max(1, Math.floor(verseWords.length / 2)));
  }

  const targetWord = verseWords[targetIndex] || verseWords[0];

  // Distractors from other positions
  const otherWords = verseWords.filter((_, i) => i !== targetIndex);
  const selectedDistractors = [...otherWords].sort(() => Math.random() - 0.5).slice(0, 3);

  const options = [targetWord, ...selectedDistractors].sort(() => Math.random() - 0.5);

  // Verse masked at target index
  const maskedVerse = verseWords
    .map((w, i) => (i === targetIndex ? "【 …… 】" : w))
    .join(" ");

  return {
    stepId: "specificWords",
    title: "Retrouvez le mot spécifique manquant dans l'ayat",
    instruction: "Identifiez le mot qui s'insère à l'emplacement 【 …… 】 :",
    correctOption: targetWord,
    targetIndex,
    options,
    maskedVerse,
    targetWord,
    ayatNum: ayat.numberInSurah,
    isMarkedUnknown: unknownIndices.includes(targetIndex),
  };
}

/**
 * Quiz 6: Metrics of Ayat (Page, Juz, Word Count)
 */
export function generateMetricsQuiz(ayat, surah, words, meta = null) {
  const page = meta?.page || ayat?.page || 1;
  const juz = meta?.juz || ayat?.juz || 1;
  const wordCount = (words && words.length) || getCleanVerseWords(ayat?.text).length || 1;

  // Choose a metric dimension: page (50%), juz (25%), wordCount (25%)
  const types = ["page", "wordCount", "juz"];
  const selectedType = types[Math.floor(Math.random() * types.length)];

  if (selectedType === "page") {
    const candidates = new Set([page]);
    [-2, -1, 1, 2, 3].forEach(off => {
      const p = page + off;
      if (p >= 1 && p <= 604 && p !== page) candidates.add(p);
    });
    while (candidates.size < 4) {
      candidates.add(Math.max(1, Math.min(604, Math.floor(Math.random() * 604) + 1)));
    }
    const options = Array.from(candidates)
      .map(p => `Page ${p}`)
      .sort(() => Math.random() - 0.5);

    return {
      stepId: "metrics",
      title: "Sur quelle page du Mushaf se trouve ce verset ?",
      instruction: `Indiquez le numéro de page pour le verset ${ayat.numberInSurah} :`,
      correctOption: `Page ${page}`,
      options,
      metricType: "page",
      verseText: ayat.text,
      details: { page, juz, wordCount },
    };
  } else if (selectedType === "wordCount") {
    const candidates = new Set([wordCount]);
    [-3, -2, -1, 1, 2, 3, 4].forEach(off => {
      const c = wordCount + off;
      if (c >= 1 && c !== wordCount) candidates.add(c);
    });
    while (candidates.size < 4) candidates.add(candidates.size + wordCount);
    const options = Array.from(candidates)
      .map(c => `${c} mots`)
      .sort(() => Math.random() - 0.5);

    return {
      stepId: "metrics",
      title: "Combien de mots composent cet ayat ?",
      instruction: "Sélectionnez le nombre exact de mots dans ce verset :",
      correctOption: `${wordCount} mots`,
      options,
      metricType: "wordCount",
      verseText: ayat.text,
      details: { page, juz, wordCount },
    };
  } else {
    const candidates = new Set([juz]);
    [-2, -1, 1, 2, 3].forEach(off => {
      const j = juz + off;
      if (j >= 1 && j <= 30 && j !== juz) candidates.add(j);
    });
    while (candidates.size < 4) candidates.add(Math.floor(Math.random() * 30) + 1);
    const options = Array.from(candidates)
      .map(j => `Juz ${j}`)
      .sort(() => Math.random() - 0.5);

    return {
      stepId: "metrics",
      title: "Dans quel Juz (partie) se situe ce verset ?",
      instruction: `Sélectionnez le Juz correspondant à l'ayat ${ayat.numberInSurah} :`,
      correctOption: `Juz ${juz}`,
      options,
      metricType: "juz",
      verseText: ayat.text,
      details: { page, juz, wordCount },
    };
  }
}
