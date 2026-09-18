import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  MEMORISATION_STEPS,
  computeAyatMemorisationState,
  recordStepQuizResult,
  toggleWordLearnedStatus,
  setAllWordsLearned,
  getCleanVerseWords,
  generateTopicQuiz,
  generateNumberQuiz,
  generateFirstWordQuiz,
  generateLastWordQuiz,
  generateSpecificWordsQuiz,
  generateMetricsQuiz,
} from "../../utils/ayatMemorisationState.js";
import { fetchAyahMeta, getAudioBase } from "../../utils/reciterAudio.js";
import { normalizeArabic } from "../../utils/recitationDiff.js";
import { MasteryBar, masteryColor } from "../common/Mastery.jsx";

export function AyatMemorisationWorkflow({
  ayat,
  surahNum,
  surahInfo,
  ld = {},
  setLData,
  audioUrl,
  ayatTranslation = "",
  wbwWords = null,
  onClose,
}) {
  const [activeStepId, setActiveStepId] = useState("topic");
  const [quizMode, setQuizMode] = useState(false);
  const [quizState, setQuizState] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerGraded, setIsAnswerGraded] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  const [meta, setMeta] = useState(null);

  // Word-by-word practice state (Step 7)
  const [wbwPracticeMode, setWbwPracticeMode] = useState("overview"); // "overview" | "scramble" | "missing" | "reveal"
  const [scramblePicks, setScramblePicks] = useState([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [missingIndex, setMissingIndex] = useState(null);
  const [missingPickedOption, setMissingPickedOption] = useState(null);

  // Subject editing in Step 1
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [customSubjectText, setCustomSubjectText] = useState(ld?.subject || "");

  // Audio playing
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef(null);

  const verseWords = useMemo(() => {
    return getCleanVerseWords(ayat?.text || "");
  }, [ayat?.text]);

  // Load verse metadata (page, juz, hizb) if not already on ayat
  useEffect(() => {
    let active = true;
    if (surahNum && ayat?.numberInSurah) {
      fetchAyahMeta(surahNum, ayat.numberInSurah)
        .then(data => {
          if (active && data) setMeta(data);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [surahNum, ayat?.numberInSurah]);

  const effectiveAyat = useMemo(() => {
    return {
      ...ayat,
      page: meta?.page || ayat?.page,
      juz: meta?.juz || ayat?.juz,
      hizbQuarter: meta?.hizbQuarter || ayat?.hizbQuarter,
    };
  }, [ayat, meta]);

  const effectiveSurah = useMemo(() => {
    return surahInfo || {
      number: surahNum,
      englishName: `Sourate ${surahNum}`,
      name: "",
      numberOfAyahs: 1,
    };
  }, [surahInfo, surahNum]);

  const memState = useMemo(() => {
    return computeAyatMemorisationState(ld, effectiveAyat, effectiveSurah, verseWords);
  }, [ld, effectiveAyat, effectiveSurah, verseWords]);

  // Reset quiz when changing active step
  const handleSelectStep = (stepId) => {
    setActiveStepId(stepId);
    setQuizMode(false);
    setQuizState(null);
    setSelectedOption(null);
    setIsAnswerGraded(false);
  };

  // Start quiz for current active step
  const startStepQuiz = () => {
    let q = null;
    if (activeStepId === "topic") {
      q = generateTopicQuiz(effectiveAyat, effectiveSurah, ld, ayatTranslation);
    } else if (activeStepId === "number") {
      q = generateNumberQuiz(effectiveAyat, effectiveSurah);
    } else if (activeStepId === "firstWord") {
      q = generateFirstWordQuiz(effectiveAyat, verseWords);
    } else if (activeStepId === "lastWord") {
      q = generateLastWordQuiz(effectiveAyat, verseWords);
    } else if (activeStepId === "specificWords") {
      q = generateSpecificWordsQuiz(effectiveAyat, verseWords, ld);
    } else if (activeStepId === "metrics") {
      q = generateMetricsQuiz(effectiveAyat, effectiveSurah, verseWords, meta);
    } else if (activeStepId === "allWords") {
      // For all words step, launch interactive missing word or scramble quiz
      setWbwPracticeMode("scramble");
      setScramblePicks([]);
      setQuizMode(false);
      return;
    }

    setQuizState(q);
    setSelectedOption(null);
    setIsAnswerGraded(false);
    setIsCorrectAnswer(false);
    setQuizMode(true);
  };

  const handleAnswerQuiz = (option) => {
    if (isAnswerGraded || !quizState) return;
    setSelectedOption(option);
    setIsAnswerGraded(true);

    const isCorrect = normalizeArabic(String(option).trim()) === normalizeArabic(String(quizState.correctOption).trim());
    setIsCorrectAnswer(isCorrect);

    const score = isCorrect ? 100 : 0;
    if (setLData && surahNum && ayat?.numberInSurah) {
      setLData(surahNum, ayat.numberInSurah, prev =>
        recordStepQuizResult(prev, activeStepId, isCorrect, score)
      );
    }
  };

  // Save custom subject
  const saveCustomSubject = () => {
    if (setLData && surahNum && ayat?.numberInSurah) {
      setLData(surahNum, ayat.numberInSurah, prev => {
        const next = { ...prev, subject: customSubjectText.trim() || null };
        return recordStepQuizResult(next, "topic", Boolean(customSubjectText.trim()), 90, {
          customSubject: customSubjectText.trim() || null,
        });
      });
    }
    setIsEditingSubject(false);
  };

  // Toggle unknown word in Step 5
  const toggleUnknownWord = (wordIdx) => {
    if (!setLData || !surahNum || !ayat?.numberInSurah) return;
    setLData(surahNum, ayat.numberInSurah, prev => {
      const prevUnk = prev?.unknownWords || [];
      const nextUnk = prevUnk.includes(wordIdx)
        ? prevUnk.filter(i => i !== wordIdx)
        : [...prevUnk, wordIdx].sort((a, b) => a - b);
      return { ...prev, unknownWords: nextUnk };
    });
  };

  // Toggle word learned in Step 7
  const handleToggleWordLearned = (wordIdx) => {
    if (!setLData || !surahNum || !ayat?.numberInSurah) return;
    setLData(surahNum, ayat.numberInSurah, prev =>
      toggleWordLearnedStatus(prev, wordIdx, verseWords.length)
    );
  };

  // Mark all words learned in Step 7
  const handleMarkAllWords = (shouldLearn = true) => {
    if (!setLData || !surahNum || !ayat?.numberInSurah) return;
    setLData(surahNum, ayat.numberInSurah, prev =>
      setAllWordsLearned(prev, verseWords.length, shouldLearn)
    );
  };

  // Scrambled words for Step 7 scramble quiz
  const scrambledPool = useMemo(() => {
    return verseWords.map((w, i) => ({ word: w, originalIndex: i })).sort(() => Math.random() - 0.5);
  }, [verseWords]);

  const handlePickScrambleWord = (item) => {
    if (scramblePicks.includes(item.originalIndex)) return;
    const nextPicks = [...scramblePicks, item.originalIndex];
    setScramblePicks(nextPicks);

    // If all words placed, grade
    if (nextPicks.length === verseWords.length) {
      const isPerfect = nextPicks.every((idx, pos) => idx === pos);
      if (isPerfect && setLData) {
        setLData(surahNum, ayat.numberInSurah, prev =>
          recordStepQuizResult(prev, "allWords", true, 100, {
            learnedWordIndices: verseWords.map((_, i) => i),
          })
        );
      }
    }
  };

  // Missing word quiz setup
  const startMissingWordQuiz = () => {
    if (verseWords.length <= 1) return;
    const missingIdx = Math.floor(Math.random() * verseWords.length);
    setMissingIndex(missingIdx);
    setMissingPickedOption(null);
    setWbwPracticeMode("missing");
  };

  const missingWordOptions = useMemo(() => {
    if (missingIndex === null || !verseWords[missingIndex]) return [];
    const correct = verseWords[missingIndex];
    const pool = verseWords.filter((_, i) => i !== missingIndex);
    const distractors = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
    const genericFallback = ["اللَّهِ", "الرَّحْمَٰنِ", "الَّذِينَ", "عَلِيمٌ", "حَكِيمٌ"];
    for (const w of genericFallback) {
      if (distractors.length >= 3) break;
      if (w !== correct && !distractors.includes(w)) distractors.push(w);
    }
    return [correct, ...distractors].sort(() => Math.random() - 0.5);
  }, [missingIndex, verseWords]);

  const handlePickMissingWord = (opt) => {
    if (missingPickedOption !== null || missingIndex === null) return;
    setMissingPickedOption(opt);
    const isCorrect = normalizeArabic(opt) === normalizeArabic(verseWords[missingIndex]);
    if (isCorrect && setLData) {
      setLData(surahNum, ayat.numberInSurah, prev =>
        toggleWordLearnedStatus(prev, missingIndex, verseWords.length)
      );
    }
  };

  const activeStep = memState.stepsStatus[activeStepId];

  // Audio url fallback
  const directAudio = audioUrl || (ayat?.number ? `${getAudioBase()}/${ayat.number}.mp3` : null);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "16px 0",
        fontFamily: "'Cinzel', serif",
      }}
    >
      {/* ── Top Header & Ayat Card ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          borderBottom: "1px solid var(--border2)",
          paddingBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              padding: "4px 10px",
              background: "rgba(201,168,76,.12)",
              border: "1px solid var(--gold)",
              borderRadius: 6,
              color: "var(--gold2)",
              fontSize: 10,
              letterSpacing: 1.5,
              fontWeight: 600,
            }}
          >
            AYAT {ayat?.numberInSurah}
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: "var(--text)" }}>
              {effectiveSurah.englishName} ({surahNum})
            </div>
            <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 0.5, marginTop: 2 }}>
              Page {effectiveAyat.page ?? "—"} · Juz {effectiveAyat.juz ?? "—"} · {verseWords.length} mots
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {directAudio && (
            <>
              <audio
                ref={audioRef}
                src={directAudio}
                onEnded={() => setIsPlayingAudio(false)}
                onPause={() => setIsPlayingAudio(false)}
                onPlay={() => setIsPlayingAudio(true)}
              />
              <button
                onClick={toggleAudio}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 9,
                  letterSpacing: 1,
                  background: isPlayingAudio ? "rgba(62,184,160,.2)" : "rgba(201,168,76,.08)",
                  border: `1px solid ${isPlayingAudio ? "var(--teal)" : "var(--gold)"}`,
                  color: isPlayingAudio ? "var(--teal2)" : "var(--gold2)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{isPlayingAudio ? "⏸ PAUSE" : "▶ ÉCOUTER"}</span>
              </button>
            </>
          )}

          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 9,
                background: "transparent",
                border: "1px solid var(--border2)",
                color: "var(--text3)",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Arabic Text Preview ── */}
      <div
        style={{
          padding: "14px 18px",
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          direction: "rtl",
          textAlign: "right",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: "'Amiri Quran', serif",
            fontSize: 22,
            lineHeight: 2.2,
            color: "var(--text)",
          }}
        >
          {ayat?.text}
          <span style={{ fontSize: 16, color: "var(--gold)", marginRight: 8 }}>
            ﴿{ayat?.numberInSurah}﴾
          </span>
        </div>
        {ayatTranslation && (
          <div
            style={{
              direction: "ltr",
              textAlign: "left",
              fontSize: 10,
              color: "var(--text3)",
              lineHeight: 1.5,
              marginTop: 8,
              borderTop: "1px dashed var(--border2)",
              paddingTop: 8,
              fontFamily: "sans-serif",
            }}
          >
            <span style={{ color: "var(--gold)", fontWeight: 600, marginRight: 6 }}>Traduction:</span>
            {ayatTranslation}
          </div>
        )}
      </div>

      {/* ── Memorisation Overall State Gauge ── */}
      <div
        style={{
          background: "var(--surface2)",
          border: `1px solid ${masteryColor(memState.overallPercentage)}`,
          borderRadius: 12,
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: "var(--text3)" }}>
              ÉTAT DE MÉMORISATION DU VERSET
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: masteryColor(memState.overallPercentage),
                  lineHeight: 1,
                }}
              >
                {memState.completedCount} / {memState.totalSteps}
              </span>
              <span style={{ fontSize: 10, color: "var(--text2)", letterSpacing: 1 }}>
                ÉTAPES VALIDÉES ({memState.overallPercentage}%)
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 8,
                padding: "3px 8px",
                borderRadius: 12,
                border: `1px solid ${memState.isFullyMastered ? "var(--green)" : "var(--gold)"}`,
                color: memState.isFullyMastered ? "var(--green)" : "var(--gold)",
                background: memState.isFullyMastered ? "rgba(76,175,129,.1)" : "rgba(201,168,76,.1)",
                display: "inline-block",
                letterSpacing: 1,
              }}
            >
              {memState.isFullyMastered ? "✓ AYAT MAÎTRISÉ" : "EN APPRENTISSAGE"}
            </div>
            <div style={{ fontSize: 8, color: "var(--text3)", marginTop: 4 }}>
              {memState.learnedWordIndices.length}/{verseWords.length} mots appris
            </div>
          </div>
        </div>

        <MasteryBar pct={memState.overallPercentage} size="md" />

        {/* ── 7-Step Navigation Chips Track ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))",
            gap: 6,
            marginTop: 4,
          }}
        >
          {MEMORISATION_STEPS.map((s) => {
            const st = memState.stepsStatus[s.id];
            const isSelected = activeStepId === s.id;
            const isDone = st.isCompleted;

            return (
              <button
                key={s.id}
                onClick={() => handleSelectStep(s.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  textAlign: "left",
                  background: isSelected
                    ? "rgba(201,168,76,.12)"
                    : isDone
                    ? "rgba(76,175,129,.06)"
                    : "var(--surface3)",
                  border: `1px solid ${
                    isSelected
                      ? "var(--gold)"
                      : isDone
                      ? "rgba(76,175,129,.4)"
                      : "var(--border2)"
                  }`,
                  transition: "all .15s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <span style={{ fontSize: 12 }}>{s.icon}</span>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: isDone
                        ? "var(--green)"
                        : isSelected
                        ? "var(--gold)"
                        : "var(--text3)",
                    }}
                  >
                    {isDone ? "✓" : `Étape ${s.stepNumber}`}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 8,
                    letterSpacing: 0.5,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected
                      ? "var(--gold2)"
                      : isDone
                      ? "var(--text)"
                      : "var(--text2)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    width: "100%",
                  }}
                >
                  {s.shortLabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active Step Card & Details ── */}
      <div
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: activeStep.isCompleted ? "rgba(76,175,129,.15)" : "rgba(201,168,76,.1)",
                border: `1px solid ${activeStep.isCompleted ? "var(--green)" : "var(--gold)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              {activeStep.icon}
            </div>
            <div>
              <div style={{ fontSize: 8, letterSpacing: 1.5, color: "var(--gold)" }}>
                ÉTAPE {activeStep.stepNumber} SUR 7
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: 1 }}>
                {activeStep.title}
              </div>
              <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 2, fontFamily: "sans-serif" }}>
                {activeStep.description}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 8,
                padding: "3px 8px",
                borderRadius: 4,
                background: activeStep.isCompleted ? "rgba(76,175,129,.15)" : "rgba(224,90,90,.1)",
                border: `1px solid ${activeStep.isCompleted ? "var(--green)" : "var(--red)"}`,
                color: activeStep.isCompleted ? "var(--green)" : "var(--red)",
                letterSpacing: 1,
              }}
            >
              {activeStep.isCompleted ? "✓ MAÎTRISÉ" : "○ NON VALIDÉ"}
            </span>
          </div>
        </div>

        {/* ── STEP CONTENT VIEWER ── */}
        {!quizMode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Step 1: Topic */}
            {activeStepId === "topic" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1 }}>
                  THÈME DU VERSET (AIDE-MÉMOIRE & COMPRÉHENSION) :
                </div>

                {!isEditingSubject ? (
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "var(--surface3)",
                      borderRadius: 8,
                      border: "1px solid var(--border2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 11, color: ld?.subject ? "var(--text)" : "var(--text3)", fontStyle: ld?.subject ? "normal" : "italic" }}>
                      📌 {ld?.subject || "Aucun sujet défini manuellement. Cliquez sur modifier ou testez le quizz pour identifier le thème."}
                    </div>
                    <button
                      onClick={() => {
                        setCustomSubjectText(ld?.subject || "");
                        setIsEditingSubject(true);
                      }}
                      style={{
                        padding: "5px 10px",
                        fontSize: 8,
                        borderRadius: 6,
                        background: "transparent",
                        border: "1px solid var(--gold)",
                        color: "var(--gold2)",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      ✏ MODIFIER
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={customSubjectText}
                      onChange={(e) => setCustomSubjectText(e.target.value)}
                      placeholder="Ex: Invocation du droit chemin, Miséricorde divine..."
                      style={{
                        flex: 1,
                        background: "var(--surface3)",
                        border: "1px solid var(--gold)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        color: "var(--text)",
                        fontSize: 11,
                        outline: "none",
                        fontFamily: "sans-serif",
                      }}
                    />
                    <button
                      onClick={saveCustomSubject}
                      style={{
                        padding: "8px 14px",
                        background: "rgba(76,175,129,.15)",
                        border: "1px solid var(--green)",
                        color: "var(--green)",
                        borderRadius: 6,
                        fontSize: 9,
                        cursor: "pointer",
                      }}
                    >
                      ✓ ENREGISTRER
                    </button>
                    <button
                      onClick={() => setIsEditingSubject(false)}
                      style={{
                        padding: "8px 12px",
                        background: "transparent",
                        border: "1px solid var(--border2)",
                        color: "var(--text3)",
                        borderRadius: 6,
                        fontSize: 9,
                        cursor: "pointer",
                      }}
                    >
                      ANNULER
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Number of ayat */}
            {activeStepId === "number" && (
              <div
                style={{
                  padding: "16px",
                  background: "var(--surface3)",
                  borderRadius: 8,
                  border: "1px solid var(--border2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-around",
                  textAlign: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>NUMÉRO DANS LA SOURATE</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "var(--gold2)", marginTop: 4 }}>
                    {ayat?.numberInSurah}
                  </div>
                </div>
                <div style={{ width: 1, height: 40, background: "var(--border2)" }} />
                <div>
                  <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>TOTAL DANS LA SOURATE</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text2)", marginTop: 4 }}>
                    {effectiveSurah.numberOfAyahs}
                  </div>
                </div>
                <div style={{ width: 1, height: 40, background: "var(--border2)" }} />
                <div>
                  <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>NUMÉRO GLOBAL</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "var(--teal2)", marginTop: 4 }}>
                    {ayat?.number ?? "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: First Word */}
            {activeStepId === "firstWord" && (
              <div
                style={{
                  padding: "16px",
                  background: "var(--surface3)",
                  borderRadius: 8,
                  border: "1px solid var(--border2)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>
                  PREMIER MOT (DÉCLENCHEUR DE RÉCITATION)
                </div>
                <div
                  style={{
                    fontFamily: "'Amiri Quran', serif",
                    fontSize: 34,
                    color: "var(--gold2)",
                    direction: "rtl",
                    padding: "4px 16px",
                    background: "rgba(201,168,76,.1)",
                    borderRadius: 8,
                    border: "1px solid rgba(201,168,76,.3)",
                  }}
                >
                  {verseWords[0]}
                </div>
                <div style={{ fontSize: 9, color: "var(--text3)", direction: "rtl", fontFamily: "'Amiri Quran', serif" }}>
                  {verseWords.slice(1, 4).join(" ")} …
                </div>
              </div>
            )}

            {/* Step 4: Last Word */}
            {activeStepId === "lastWord" && (
              <div
                style={{
                  padding: "16px",
                  background: "var(--surface3)",
                  borderRadius: 8,
                  border: "1px solid var(--border2)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>
                  DERNIER MOT (FASILAH / RIME CORANIQUE)
                </div>
                <div
                  style={{
                    fontFamily: "'Amiri Quran', serif",
                    fontSize: 34,
                    color: "var(--teal2)",
                    direction: "rtl",
                    padding: "4px 16px",
                    background: "rgba(62,184,160,.1)",
                    borderRadius: 8,
                    border: "1px solid rgba(62,184,160,.3)",
                  }}
                >
                  {verseWords[verseWords.length - 1]}
                </div>
                <div style={{ fontSize: 9, color: "var(--text3)", direction: "rtl", fontFamily: "'Amiri Quran', serif" }}>
                  … {verseWords.slice(-4, -1).join(" ")}
                </div>
              </div>
            )}

            {/* Step 5: Specific Words */}
            {activeStepId === "specificWords" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1 }}>
                  MOTS SPÉCIFIQUES & VOCABULAIRE CIBLÉ (CLIQUEZ SUR UN MOT POUR LE MARQUER COMME INCONNU / CIBLE) :
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    direction: "rtl",
                    padding: "12px",
                    background: "var(--surface3)",
                    borderRadius: 8,
                    border: "1px solid var(--border2)",
                  }}
                >
                  {verseWords.map((word, idx) => {
                    const isUnk = (ld?.unknownWords || []).includes(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => toggleUnknownWord(idx)}
                        style={{
                          fontFamily: "'Amiri Quran', serif",
                          fontSize: 20,
                          padding: "6px 12px",
                          borderRadius: 6,
                          cursor: "pointer",
                          background: isUnk ? "rgba(255,126,179,.2)" : "rgba(255,255,255,.04)",
                          border: `1px solid ${isUnk ? "#ff7eb3" : "var(--border2)"}`,
                          color: isUnk ? "#ff7eb3" : "var(--text)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>{word}</span>
                        {isUnk && <span style={{ fontSize: 10 }}>⚠</span>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 0.5 }}>
                  {(ld?.unknownWords || []).length > 0
                    ? `${(ld?.unknownWords || []).length} mot(s) actuellement marqué(s) à réviser en priorité.`
                    : "Aucun mot marqué. Vous pouvez cliquer sur un mot pour le cibler dans vos révisions."}
                </div>
              </div>
            )}

            {/* Step 6: Metrics */}
            {activeStepId === "metrics" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                  gap: 10,
                }}
              >
                <div style={{ padding: "12px", background: "var(--surface3)", borderRadius: 8, border: "1px solid var(--border2)", textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>PAGE MUSHAF</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold2)", marginTop: 4 }}>
                    {effectiveAyat.page ?? "—"}
                  </div>
                </div>
                <div style={{ padding: "12px", background: "var(--surface3)", borderRadius: 8, border: "1px solid var(--border2)", textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>JUZ</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--teal2)", marginTop: 4 }}>
                    {effectiveAyat.juz ?? "—"}
                  </div>
                </div>
                <div style={{ padding: "12px", background: "var(--surface3)", borderRadius: 8, border: "1px solid var(--border2)", textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>HIZB (QUART)</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--green)", marginTop: 4 }}>
                    {effectiveAyat.hizbQuarter ? Math.ceil(effectiveAyat.hizbQuarter / 4) : "—"}
                  </div>
                </div>
                <div style={{ padding: "12px", background: "var(--surface3)", borderRadius: 8, border: "1px solid var(--border2)", textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>NOMBRE DE MOTS</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
                    {verseWords.length}
                  </div>
                </div>
              </div>
            )}

            {/* Step 7: Learn All Words (Goal is to learn all words of an ayat) */}
            {activeStepId === "allWords" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1 }}>
                    TABLEAU D'APPRENTISSAGE MOT À MOT ({memState.learnedWordIndices.length}/{verseWords.length} MAÎTRISÉS) :
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleMarkAllWords(true)}
                      style={{
                        padding: "5px 10px",
                        fontSize: 8,
                        borderRadius: 6,
                        background: "rgba(76,175,129,.12)",
                        border: "1px solid var(--green)",
                        color: "var(--green)",
                        cursor: "pointer",
                      }}
                    >
                      ✓ TOUT MARQUER APPRIS
                    </button>
                    <button
                      onClick={() => handleMarkAllWords(false)}
                      style={{
                        padding: "5px 10px",
                        fontSize: 8,
                        borderRadius: 6,
                        background: "transparent",
                        border: "1px solid var(--border2)",
                        color: "var(--text3)",
                        cursor: "pointer",
                      }}
                    >
                      RÉINITIALISER
                    </button>
                  </div>
                </div>

                {/* Sub-practice mode selector for Step 7 */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { id: "overview", label: "📋 VUE GRILLE" },
                    { id: "scramble", label: "🧩 RECONSTRUIRE L'AYAT" },
                    { id: "missing", label: "🔍 MOTS MANQUANTS" },
                    { id: "reveal", label: "👁 MASQUAGE PROGRESSIF" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setWbwPracticeMode(m.id);
                        if (m.id === "scramble") setScramblePicks([]);
                        if (m.id === "missing") startMissingWordQuiz();
                        if (m.id === "reveal") setRevealIndex(0);
                      }}
                      style={{
                        padding: "5px 12px",
                        fontSize: 8,
                        letterSpacing: 1,
                        borderRadius: 20,
                        cursor: "pointer",
                        background: wbwPracticeMode === m.id ? "rgba(201,168,76,.15)" : "transparent",
                        border: `1px solid ${wbwPracticeMode === m.id ? "var(--gold)" : "var(--border2)"}`,
                        color: wbwPracticeMode === m.id ? "var(--gold2)" : "var(--text3)",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Mode 1: Grid Overview */}
                {wbwPracticeMode === "overview" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                      gap: 8,
                      direction: "rtl",
                    }}
                  >
                    {verseWords.map((word, idx) => {
                      const isLearned = memState.learnedWordIndices.includes(idx);
                      const isUnk = (ld?.unknownWords || []).includes(idx);
                      return (
                        <div
                          key={idx}
                          onClick={() => handleToggleWordLearned(idx)}
                          style={{
                            padding: "10px",
                            borderRadius: 8,
                            background: isLearned
                              ? "rgba(76,175,129,.08)"
                              : isUnk
                              ? "rgba(255,126,179,.1)"
                              : "var(--surface3)",
                            border: `1px solid ${
                              isLearned
                                ? "var(--green)"
                                : isUnk
                                ? "#ff7eb3"
                                : "var(--border2)"
                            }`,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            transition: "all .15s",
                          }}
                        >
                          <div style={{ fontSize: 8, color: "var(--text3)", width: "100%", textAlign: "left", direction: "ltr" }}>
                            #{idx + 1}
                          </div>
                          <div
                            style={{
                              fontFamily: "'Amiri Quran', serif",
                              fontSize: 22,
                              color: isLearned ? "var(--green)" : isUnk ? "#ff7eb3" : "var(--text)",
                              lineHeight: 1.6,
                            }}
                          >
                            {word}
                          </div>
                          <div
                            style={{
                              fontSize: 7,
                              letterSpacing: 0.5,
                              color: isLearned ? "var(--green)" : "var(--text3)",
                              marginTop: 2,
                            }}
                          >
                            {isLearned ? "✓ APPRIS" : "CLIQUEZ POUR VALIDER"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Mode 2: Scramble Reconstruct */}
                {wbwPracticeMode === "scramble" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>
                      CLIQUEZ SUR LES MOTS DÉSHORDONNÉS DANS LE BON ORDRE POUR RECONSTITUER LE VERSET :
                    </div>

                    {/* Drop target / reconstructed line */}
                    <div
                      style={{
                        minHeight: 50,
                        padding: "12px",
                        background: "var(--surface3)",
                        border: "1px dashed var(--gold)",
                        borderRadius: 8,
                        direction: "rtl",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      {scramblePicks.length === 0 && (
                        <div style={{ fontSize: 9, color: "var(--text3)", width: "100%", textAlign: "center" }}>
                          Sélectionnez le 1er mot ci-dessous…
                        </div>
                      )}
                      {scramblePicks.map((idx, pos) => {
                        const isCorrectPos = idx === pos;
                        return (
                          <div
                            key={pos}
                            style={{
                              fontFamily: "'Amiri Quran', serif",
                              fontSize: 20,
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: isCorrectPos ? "rgba(76,175,129,.15)" : "rgba(224,90,90,.15)",
                              border: `1px solid ${isCorrectPos ? "var(--green)" : "var(--red)"}`,
                              color: isCorrectPos ? "var(--green)" : "var(--red)",
                            }}
                          >
                            {verseWords[idx]}
                          </div>
                        );
                      })}
                    </div>

                    {/* Pool */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, direction: "rtl" }}>
                      {scrambledPool.map((item, i) => {
                        const isPicked = scramblePicks.includes(item.originalIndex);
                        return (
                          <button
                            key={i}
                            disabled={isPicked}
                            onClick={() => handlePickScrambleWord(item)}
                            style={{
                              fontFamily: "'Amiri Quran', serif",
                              fontSize: 20,
                              padding: "6px 12px",
                              borderRadius: 6,
                              background: isPicked ? "transparent" : "var(--surface3)",
                              border: `1px solid ${isPicked ? "var(--border)" : "var(--border2)"}`,
                              color: isPicked ? "var(--text3)" : "var(--text)",
                              opacity: isPicked ? 0.3 : 1,
                              cursor: isPicked ? "default" : "pointer",
                            }}
                          >
                            {item.word}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setScramblePicks([])}
                      style={{
                        alignSelf: "flex-start",
                        padding: "6px 12px",
                        fontSize: 8,
                        borderRadius: 6,
                        background: "transparent",
                        border: "1px solid var(--border2)",
                        color: "var(--text3)",
                        cursor: "pointer",
                      }}
                    >
                      ↺ RECOMMENCER LA RECONSTRUCTION
                    </button>
                  </div>
                )}

                {/* Mode 3: Missing Word Quiz */}
                {wbwPracticeMode === "missing" && missingIndex !== null && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>
                      IDENTIFIEZ LE MOT MANQUANT DANS CE VERSET :
                    </div>

                    <div
                      style={{
                        padding: "14px 18px",
                        background: "var(--surface3)",
                        borderRadius: 8,
                        border: "1px solid var(--border2)",
                        direction: "rtl",
                        textAlign: "right",
                        fontFamily: "'Amiri Quran', serif",
                        fontSize: 22,
                        lineHeight: 2.2,
                      }}
                    >
                      {verseWords.map((w, i) => (
                        <span key={i} style={{ margin: "0 4px" }}>
                          {i === missingIndex ? (
                            <span
                              style={{
                                padding: "2px 10px",
                                background: "rgba(201,168,76,.2)",
                                border: "1px dashed var(--gold)",
                                borderRadius: 4,
                                color: "var(--gold2)",
                              }}
                            >
                              {missingPickedOption || "【 …… 】"}
                            </span>
                          ) : (
                            w
                          )}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, direction: "rtl" }}>
                      {missingWordOptions.map((opt, i) => {
                        const isPicked = missingPickedOption === opt;
                        const isCorrect = normalizeArabic(opt) === normalizeArabic(verseWords[missingIndex]);
                        let btnBg = "var(--surface3)";
                        let btnBorder = "var(--border2)";
                        let btnColor = "var(--text)";

                        if (missingPickedOption !== null) {
                          if (isCorrect) {
                            btnBg = "rgba(76,175,129,.2)";
                            btnBorder = "var(--green)";
                            btnColor = "var(--green)";
                          } else if (isPicked) {
                            btnBg = "rgba(224,90,90,.2)";
                            btnBorder = "var(--red)";
                            btnColor = "var(--red)";
                          }
                        }

                        return (
                          <button
                            key={i}
                            onClick={() => handlePickMissingWord(opt)}
                            style={{
                              padding: "10px",
                              borderRadius: 8,
                              background: btnBg,
                              border: `1px solid ${btnBorder}`,
                              color: btnColor,
                              fontFamily: "'Amiri Quran', serif",
                              fontSize: 20,
                              cursor: missingPickedOption ? "default" : "pointer",
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {missingPickedOption && (
                      <button
                        onClick={startMissingWordQuiz}
                        style={{
                          padding: "8px 16px",
                          fontSize: 9,
                          borderRadius: 6,
                          background: "rgba(201,168,76,.15)",
                          border: "1px solid var(--gold)",
                          color: "var(--gold2)",
                          cursor: "pointer",
                          alignSelf: "flex-start",
                        }}
                      >
                        → AUTRE MOT MANQUANT
                      </button>
                    )}
                  </div>
                )}

                {/* Mode 4: Progressive Reveal */}
                {wbwPracticeMode === "reveal" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>
                      MASQUAGE PROGRESSIF : RÉCITEZ DE TÊTE ET DÉVOILEZ LES MOTS UN À UN.
                    </div>

                    <div
                      style={{
                        padding: "14px 18px",
                        background: "var(--surface3)",
                        borderRadius: 8,
                        border: "1px solid var(--border2)",
                        direction: "rtl",
                        textAlign: "right",
                        fontFamily: "'Amiri Quran', serif",
                        fontSize: 22,
                        lineHeight: 2.2,
                      }}
                    >
                      {verseWords.map((w, i) => {
                        const isRevealed = i < revealIndex;
                        return (
                          <span
                            key={i}
                            style={{
                              margin: "0 4px",
                              color: isRevealed ? "var(--text)" : "transparent",
                              background: isRevealed ? "transparent" : "var(--surface2)",
                              borderRadius: 4,
                              padding: "2px 6px",
                              borderBottom: isRevealed ? "none" : "2px solid var(--border2)",
                              userSelect: "none",
                            }}
                          >
                            {isRevealed ? w : "••••••"}
                          </span>
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => setRevealIndex(i => Math.min(verseWords.length, i + 1))}
                        disabled={revealIndex >= verseWords.length}
                        style={{
                          padding: "8px 16px",
                          fontSize: 9,
                          borderRadius: 6,
                          background: "rgba(62,184,160,.15)",
                          border: "1px solid var(--teal)",
                          color: "var(--teal2)",
                          cursor: "pointer",
                        }}
                      >
                        👁 DÉVOILER LE MOT SUIVANT ({revealIndex}/{verseWords.length})
                      </button>
                      <button
                        onClick={() => setRevealIndex(verseWords.length)}
                        style={{
                          padding: "8px 16px",
                          fontSize: 9,
                          borderRadius: 6,
                          background: "rgba(201,168,76,.1)",
                          border: "1px solid var(--gold)",
                          color: "var(--gold2)",
                          cursor: "pointer",
                        }}
                      >
                        TOUT DÉVOILER
                      </button>
                      <button
                        onClick={() => setRevealIndex(0)}
                        style={{
                          padding: "8px 16px",
                          fontSize: 9,
                          borderRadius: 6,
                          background: "transparent",
                          border: "1px solid var(--border2)",
                          color: "var(--text3)",
                          cursor: "pointer",
                        }}
                      >
                        TOUT MASQUER
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Launch Quiz Button */}
            {activeStepId !== "allWords" && (
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  onClick={startStepQuiz}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    borderRadius: 8,
                    background: "rgba(201,168,76,.12)",
                    border: "1px solid var(--gold)",
                    color: "var(--gold2)",
                    fontSize: 9,
                    letterSpacing: 1.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span>⚡ LANCER LE QUIZZ : {activeStep.quizLabel}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── INTERACTIVE STEP QUIZ ── */}
        {quizMode && quizState && (
          <div
            style={{
              padding: "16px 18px",
              background: "var(--surface3)",
              border: "1px solid var(--gold)",
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 9, letterSpacing: 1.5, color: "var(--gold)" }}>
                QUIZZ ÉTAPE {activeStep.stepNumber} : {activeStep.title}
              </div>
              <button
                onClick={() => setQuizMode(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text3)",
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                ✕ QUITTER LE QUIZZ
              </button>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
              {quizState.title}
            </div>
            <div style={{ fontSize: 8, color: "var(--text3)" }}>
              {quizState.instruction}
            </div>

            {/* Quiz Context Display */}
            {quizState.maskedVerse && (
              <div
                style={{
                  fontFamily: "'Amiri Quran', serif",
                  fontSize: 22,
                  lineHeight: 2.2,
                  direction: "rtl",
                  textAlign: "right",
                  padding: "10px 14px",
                  background: "var(--surface2)",
                  borderRadius: 8,
                  border: "1px solid var(--border2)",
                }}
              >
                {quizState.maskedVerse}
              </div>
            )}

            {/* Options grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: quizState.options.some(o => o.length > 25) ? "1fr" : "1fr 1fr",
                gap: 8,
              }}
            >
              {quizState.options.map((option, idx) => {
                const isSelected = selectedOption === option;
                const isCorrect =
                  normalizeArabic(String(option).trim()) ===
                  normalizeArabic(String(quizState.correctOption).trim());

                let btnBg = "var(--surface2)";
                let btnBorder = "var(--border2)";
                let btnColor = "var(--text)";

                if (isAnswerGraded) {
                  if (isCorrect) {
                    btnBg = "rgba(76,175,129,.2)";
                    btnBorder = "var(--green)";
                    btnColor = "var(--green)";
                  } else if (isSelected) {
                    btnBg = "rgba(224,90,90,.2)";
                    btnBorder = "var(--red)";
                    btnColor = "var(--red)";
                  }
                } else if (isSelected) {
                  btnBg = "rgba(201,168,76,.15)";
                  btnBorder = "var(--gold)";
                  btnColor = "var(--gold2)";
                }

                const isArabicText = /[\u0600-\u06FF]/.test(option);

                return (
                  <button
                    key={idx}
                    disabled={isAnswerGraded}
                    onClick={() => handleAnswerQuiz(option)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      background: btnBg,
                      border: `1px solid ${btnBorder}`,
                      color: btnColor,
                      cursor: isAnswerGraded ? "default" : "pointer",
                      fontSize: isArabicText ? 18 : 10,
                      fontFamily: isArabicText ? "'Amiri Quran', serif" : "'Cinzel', serif",
                      textAlign: isArabicText ? "right" : "left",
                      direction: isArabicText ? "rtl" : "ltr",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all .15s",
                    }}
                  >
                    <span>{option}</span>
                    {isAnswerGraded && isCorrect && <span style={{ color: "var(--green)", fontSize: 12 }}>✓</span>}
                    {isAnswerGraded && isSelected && !isCorrect && <span style={{ color: "var(--red)", fontSize: 12 }}>✗</span>}
                  </button>
                );
              })}
            </div>

            {/* Feedback & Action */}
            {isAnswerGraded && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: isCorrectAnswer ? "rgba(76,175,129,.12)" : "rgba(224,90,90,.12)",
                  border: `1px solid ${isCorrectAnswer ? "var(--green)" : "var(--red)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: isCorrectAnswer ? "var(--green)" : "var(--red)",
                    }}
                  >
                    {isCorrectAnswer ? "✓ EXCELLENT ! ÉTAPE VALIDÉE" : "✗ RÉPONSE INCORRECTE"}
                  </div>
                  <div style={{ fontSize: 8, color: "var(--text3)", marginTop: 2 }}>
                    {isCorrectAnswer
                      ? "L'étape a été enregistrée dans l'état de mémorisation de ce verset."
                      : `Bonne réponse : ${quizState.correctOption}`}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={startStepQuiz}
                    style={{
                      padding: "6px 12px",
                      fontSize: 8,
                      borderRadius: 6,
                      background: "transparent",
                      border: "1px solid var(--border2)",
                      color: "var(--text3)",
                      cursor: "pointer",
                    }}
                  >
                    ↺ REFAIRE
                  </button>
                  <button
                    onClick={() => {
                      const currIdx = MEMORISATION_STEPS.findIndex(s => s.id === activeStepId);
                      if (currIdx < MEMORISATION_STEPS.length - 1) {
                        handleSelectStep(MEMORISATION_STEPS[currIdx + 1].id);
                      } else {
                        setQuizMode(false);
                      }
                    }}
                    style={{
                      padding: "6px 14px",
                      fontSize: 8,
                      borderRadius: 6,
                      background: "rgba(201,168,76,.15)",
                      border: "1px solid var(--gold)",
                      color: "var(--gold2)",
                      cursor: "pointer",
                    }}
                  >
                    ÉTAPE SUIVANTE →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
