import { MasteryBadge } from "../common/Mastery.jsx";
import { fetchAyats, fetchSurahDefault } from "../../utils/reciterAudio.js";
import { masteryColor, computeMastery } from "../common/Mastery.jsx";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { normalizeArabic } from "../../utils/recitationDiff.js";
import {
  fetchAyatMeta,
  fetchQuranPage,
  fetchSurahSimple,
  loadTimestampsForSurah,
  getAudioBase,
  getGlobalRecitator,
} from "../../utils/reciterAudio.js";
import { splitArabicWords, splitArabicClusters } from "../../utils/arabicUtils.js";
import { ReconstructQuestion } from "./ReconstructQuestion.jsx";
import { CompareVerseQuestion } from "./CompareVerseQuestion.jsx";
import { FindSurahQuestion } from "./FindSurahQuestion.jsx";
import { UnknownWordQuestion } from "./UnknownWordQuestion.jsx";
import { UnknownPickQuestion } from "./UnknownPickQuestion.jsx";
import { RevisePartQuestion } from "./RevisePartQuestion.jsx";
import { PageStructureQuestion } from "./PageStructureQuestion.jsx";
import { FirstContactQuestion } from "./FirstContactQuestion.jsx";
import { QAyatPlayer } from "../audio/QAyatPlayer.jsx";
import { TextAnswerInput } from "../common/TextAnswerInput.jsx";
import { ArabicHighlighted } from "../common/ArabicHighlighted.jsx";
import { safeGetItem, safeSetItem, safeRemoveItem } from "../../utils/safeStorage.js";
import { store, sel, quizActions, collectionsActions, errorActions } from "../../store.js";
import {
  calculateQuizPoints,
  getStreakCelebration,
  formatQuizTimer,
  computeSessionSummary,
  playQuizSound,
  triggerQuizHaptic,
  generateMultipleChoiceOptions,
  getFontSizeStyle,
  getTajweedToggleLabel,
  formatStreakMultiplier,
  computeMistakesSummaryByCategory,
  createMistakesCollectionPayload,
} from "../../utils/quizUtils.js";
import { getPlayableAudioUrl } from "../../utils/offlineManager.js";
import { ERROR_CODES, createAppError } from "../../utils/errorManager.js";

export function QuestionsMode({
  selectedSn,
  ayatList,
  surahs,
  learnData,
  setLData,
  ayatTexts,
  randomize,
  selectedQTypes,
  initialQIdx,
  onQIdxChange,
  onDone,
  multiItems,
  skipCorrect,
}) {
  const dispatch = useDispatch();

  // ── Redux Quiz State & Actions ────────────────────────────────────────────────
  const streak = useSelector(sel.quizStreak);
  const bestStreak = useSelector(sel.quizBestStreak);
  const score = useSelector(sel.quizScore);
  const timerMode = useSelector(sel.quizTimerMode);
  const timeRemaining = useSelector(sel.quizTimeRemaining);
  const soundEffects = useSelector(sel.quizSoundEffects);
  const quizMistakes = useSelector(sel.quizMistakes);
  const answerMode = useSelector(sel.quizAnswerMode);
  const hapticFeedback = useSelector(sel.quizHapticFeedback);
  const arabicFontSize = useSelector(sel.quizArabicFontSize);
  const showTajweedInQuiz = useSelector(sel.quizShowTajweed);

  // ── Session persistence ──────────────────────────────────────────────────────
  const _items = multiItems || (ayatList || []).map((n) => ({ sn: selectedSn, ayatNum: n }));
  const Q_KEY = multiItems
    ? `quran_questions_multi_${_items.length}`
    : `quran_questions_${selectedSn}_${ayatList[0]}_${ayatList[ayatList.length - 1]}`;

  const loadQSession = () => safeGetItem(Q_KEY, null);
  const saveQSession = (data) => safeSetItem(Q_KEY, data);
  const clearQSession = () => safeRemoveItem(Q_KEY);

  const saved = React.useMemo(() => loadQSession(), []);

  const [results, setResults] = React.useState(() => saved?.results ?? []);
  const [revealed, setRevealed] = React.useState(false);
  const [lastAutoGrade, setLastAutoGrade] = React.useState(null);
  const [selectedChoiceId, setSelectedChoiceId] = React.useState(null);
  const [choiceEvaluation, setChoiceEvaluation] = React.useState(null);
  const [done, setDone] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [emptyTimeout, setEmptyTimeout] = React.useState(false);
  const [globalNums, setGlobalNums] = React.useState({});
  const [timestamps, setTimestamps] = React.useState(null);
  const [pageAyatData, setPageAyatData] = React.useState({});
  const [savedOrder, setSavedOrder] = React.useState(() => saved?.questionOrder ?? null);
  const [currentQId, setCurrentQId] = React.useState(() => saved?.currentQId ?? null);

  // Review-only mode for mistakes
  const [reviewMistakesMode, setReviewMistakesMode] = React.useState(false);
  const [mistakesQueue, setMistakesQueue] = React.useState([]);
  const [collectionCreatedNotice, setCollectionCreatedNotice] = React.useState(null);
  const [showDetailedReview, setShowDetailedReview] = React.useState(false);
  const [reviewAudioPlayingAyat, setReviewAudioPlayingAyat] = React.useState(null);

  // Session start timestamp for duration
  const [sessionStartTime] = React.useState(() => Date.now());

  const audioRef = React.useRef(null);
  const timerIntervalRef = useRef(null);

  // Load global ayat numbers + timestamps once
  React.useEffect(() => {
    const sns = multiItems ? [...new Set(multiItems.map((i) => i.sn))] : selectedSn ? [selectedSn] : [];
    sns.forEach((sn) => {
      fetchAyats(sn)
        .then((data) => {
          const m = {};
          (data?.ayahs || []).forEach((a) => {
            m[`${sn}:${a.numberInSurah}`] = a.number;
          });
          setGlobalNums((p) => ({ ...p, ...m }));
        })
        .catch(() => {});
      loadTimestampsForSurah(sn, getGlobalRecitator())
        .then((ts) => {
          if (ts) setTimestamps((p) => ({ ...p, [sn]: ts }));
        })
        .catch(() => {});
      fetchSurahDefault(sn)
        .then((ayahs) => {
          setPageAyatData((p) => ({
            ...p,
            [sn]: ayahs.map((a) => ({
              numberInSurah: a.numberInSurah,
              page: a.page,
              hizbQuarter: a.hizbQuarter,
              juz: a.juz,
            })),
          }));
        })
        .catch(() => {});
    });
  }, [selectedSn, multiItems?.length]);

  React.useEffect(() => {
    setRevealed(false);
    setLastAutoGrade(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, [currentQId]);

  // Cleanup on unmount
  React.useEffect(
    () => () => {
      audioRef.current?.pause();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    },
    []
  );

  const surahInfo = surahs.find((s) => s.number === selectedSn);
  const maxAyat = surahInfo?.numberOfAyahs ?? 1;

  // Build question list
  const questions = React.useMemo(() => {
    const qs = [];

    _items.forEach(({ sn: itemSn, ayatNum }) => {
      const effectiveSn = itemSn ?? selectedSn;
      const rawText = ayatTexts[`${effectiveSn}:${ayatNum}`] || "";
      const text = (() => {
        if (ayatNum === 1 && effectiveSn !== 1 && effectiveSn !== 9 && rawText) {
          const ws = rawText
            .replace(/^[\ufeff\u200B-\u200F\u061C\s]+/, "")
            .trim()
            .split(/\s+/);
          const stripD = (s) =>
            s.replace(/[\u0610-\u061A\u0640\u064B-\u065F\u0670\u06D6-\u06ED\ufeff\u200B-\u200F]/g, "");
          if (ws.length > 4 && stripD(ws[0]).startsWith("بسم")) return ws.slice(4).join(" ");
        }
        return rawText;
      })();
      const words = text.split(/\s+/).filter(Boolean);
      const surahObj = surahs.find((s) => s.number === effectiveSn);
      const surahLabel = surahObj ? `${surahObj.englishName} · ${surahObj.name}` : `S.${effectiveSn}`;
      const vLabel = `verset ${ayatNum} · ${surahLabel}`;

      // 0. Premier contact
      if (words.length > 0) {
        qs.push({
          id: `${effectiveSn}:${ayatNum}:first_contact`,
          sn: effectiveSn,
          type: "first_contact",
          ayatNum,
          question: `Quiz Premier Contact · ${vLabel}`,
          answer: text,
          text,
          words,
          surahName: surahLabel,
        });
      }

      // 1. Premier mot
      if (words.length > 0) {
        qs.push({
          id: `${effectiveSn}:${ayatNum}:first_word`,
          sn: effectiveSn,
          type: "first_word",
          ayatNum,
          question: `Quel est le premier mot du ${vLabel} ?`,
          answer: words[0],
          hint: words.length > 1 ? words.slice(1, 4).join(" ") + (words.length > 4 ? "..." : "") : "",
        });
      }

      // 2. Dernier mot
      if (words.length > 1) {
        qs.push({
          id: `${effectiveSn}:${ayatNum}:last_word`,
          sn: effectiveSn,
          type: "last_word",
          ayatNum,
          question: `Quel est le dernier mot du ${vLabel} ?`,
          answer: words[words.length - 1],
          hint: words.slice(Math.max(0, words.length - 4), -1).join(" "),
        });
      }

      // 3. Mot manquant
      if (words.length >= 4) {
        const idx = Math.floor(words.length / 2);
        qs.push({
          id: `${effectiveSn}:${ayatNum}:missing_word`,
          sn: effectiveSn,
          type: "missing_word",
          ayatNum,
          question: `Quel mot manque dans le ${vLabel} ?`,
          answer: words[idx],
          questionData: words.map((w, i) => (i === idx ? "____" : w)).join(" "),
          hint: words.map((w, i) => (i === idx ? "____" : w)).join(" "),
        });
      }

      // 4. Verset suivant
      if (ayatNum < maxAyat) {
        const nextText = ayatTexts[`${effectiveSn}:${ayatNum + 1}`] || "";
        const nextWords = nextText.split(/\s+/).filter(Boolean);
        if (nextWords.length) {
          qs.push({
            id: `${effectiveSn}:${ayatNum}:next_verse`,
            sn: effectiveSn,
            type: "next_verse",
            ayatNum,
            question: `Quel verset suit le ${vLabel} ?`,
            answer: String(ayatNum + 1),
            hint: nextWords.slice(0, 5).join(" ") + (nextWords.length > 5 ? "..." : ""),
          });
        }
      }

      // 5. Verset précédent
      if (ayatNum > 1) {
        const prevText = ayatTexts[`${effectiveSn}:${ayatNum - 1}`] || "";
        const prevWords = prevText.split(/\s+/).filter(Boolean);
        if (prevWords.length) {
          qs.push({
            id: `${effectiveSn}:${ayatNum}:previous_verse`,
            sn: effectiveSn,
            type: "previous_verse",
            ayatNum,
            question: `Quel verset précède le ${vLabel} ?`,
            answer: String(ayatNum - 1),
            hint: prevWords.slice(0, 5).join(" ") + (prevWords.length > 5 ? "..." : ""),
          });
        }
      }

      // 6. Numéro du verset
      if (words.length) {
        qs.push({
          id: `${effectiveSn}:${ayatNum}:verse_number`,
          sn: effectiveSn,
          type: "verse_number",
          ayatNum,
          question: `Quel est le numéro du ${vLabel.replace(`verset ${ayatNum}`, "verset ci-dessous")} ?`,
          answer: String(ayatNum),
          hint: words.slice(0, 6).join(" "),
        });
      }

      // 7. Reconstituer le verset
      if (words.length >= 3) {
        const splitWords = splitArabicWords(text);
        const reconAnswer = splitWords.join(" ");
        qs.push({
          id: `${effectiveSn}:${ayatNum}:reconstruct`,
          sn: effectiveSn,
          type: "reconstruct",
          ayatNum,
          question: `Reconstitue le ${vLabel} dans le bon ordre`,
          answer: reconAnswer,
          words: splitWords,
        });
      }

      // 8. Trouver l'ayat
      if (words.length >= 3) {
        const start = Math.max(1, Math.floor(words.length / 3));
        const end = Math.min(start + 5, words.length);
        const excerpt = words.slice(start, end).join(" ");
        qs.push({
          id: `${effectiveSn}:${ayatNum}:find_ayat`,
          sn: effectiveSn,
          type: "find_ayat",
          ayatNum,
          question: `Quel est le numéro du verset contenant cet extrait ?`,
          answer: String(ayatNum),
          questionData: excerpt,
          hint: text,
        });
      }

      // Unknown words
      const ldItem = learnData[`${effectiveSn}:${ayatNum}`] || {};
      const unkIndices = ldItem.unknownWords || [];
      if (unkIndices.length > 0 && words.length > 0) {
        unkIndices.forEach((wi) => {
          if (wi >= words.length) return;
          const unkWord = words[wi];
          const masked = words.map((w, i) => (i === wi ? "▢▢▢" : w)).join(" ");
          qs.push({
            id: `${effectiveSn}:${ayatNum}:unknown_word:${wi}`,
            sn: effectiveSn,
            type: "unknown_word",
            ayatNum,
            question: `Complète le mot inconnu dans le ${vLabel} :`,
            answer: unkWord,
            questionData: masked,
            hint: `Position ${wi + 1} sur ${words.length}`,
            wordIndex: wi,
          });
        });
        const unkWords = unkIndices.filter((i) => i < words.length).map((i) => words[i]);
        const knownWords = words.filter((_, i) => !unkIndices.includes(i));
        const decoys = knownWords.sort(() => Math.random() - 0.5).slice(0, Math.max(2, 4 - unkWords.length));
        const allOpts = [...unkWords, ...decoys].sort(() => Math.random() - 0.5);
        qs.push({
          id: `${effectiveSn}:${ayatNum}:unknown_pick`,
          sn: effectiveSn,
          type: "unknown_pick",
          ayatNum,
          question: `Quels mots ne connais-tu pas encore dans le ${vLabel} ?`,
          answer: unkWords.join("|"),
          options: allOpts,
          questionData: text,
          hint: `${unkWords.length} mot${unkWords.length > 1 ? "s" : ""} inconnu${unkWords.length > 1 ? "s" : ""}`,
        });
      }

      // To revise questions
      const toRevise = ldItem.toRevise;
      if (toRevise && words.length > 0) {
        const revWords = (typeof toRevise === "object" && toRevise.words) || [];
        const revParts = (typeof toRevise === "object" && toRevise.parts) || [];
        const revAll = toRevise === true;

        if (revWords.length > 0) {
          const validIdx = [...new Set(revWords)].filter((wi) => wi < words.length).sort((a, b) => a - b);
          if (validIdx.length > 0) {
            const masked = words.map((w, i) => (validIdx.includes(i) ? "▢▢▢" : w)).join(" ");
            const answerWords = validIdx.map((wi) => words[wi]);
            qs.push({
              id: `${effectiveSn}:${ayatNum}:revise_word`,
              sn: effectiveSn,
              type: "revise_word",
              ayatNum,
              question:
                validIdx.length > 1
                  ? `🔖 Trouve les ${validIdx.length} mots marqués à réviser dans le ${vLabel} :`
                  : `🔖 Trouve le mot marqué à réviser dans le ${vLabel} :`,
              answer: answerWords.join("|"),
              questionData: masked,
              hint: `${validIdx.length} mot${validIdx.length > 1 ? "s" : ""} marqué${validIdx.length > 1 ? "s" : ""} sur ${words.length}`,
              wordIndices: validIdx,
              toRevise: true,
            });
          }
        }
        if (revParts.length > 0) {
          (ldItem.parts || []).forEach((part) => {
            if (!revParts.includes(part.id) || !part.text) return;
            const pi = (ldItem.parts || []).indexOf(part);
            qs.push({
              id: `${effectiveSn}:${ayatNum}:revise_part:${part.id}`,
              sn: effectiveSn,
              type: "revise_part",
              ayatNum,
              question: `🔖 Récite la partie ${pi + 1} marquée à réviser dans le ${vLabel} :`,
              answer: part.text,
              questionData: text,
              hint: `${part.wordIndices?.length || "?"} mots`,
              partText: part.text,
              partIdx: pi,
              toRevise: true,
            });
          });
        }
        if (revAll && words.length >= 3) {
          const wi = Math.floor(Math.random() * words.length);
          const masked = words.map((w, i) => (i === wi ? "▢▢▢" : w)).join(" ");
          qs.push({
            id: `${effectiveSn}:${ayatNum}:revise_all`,
            sn: effectiveSn,
            type: "revise_word",
            ayatNum,
            question: `🔖 Cet ayat est marqué à réviser — complète le mot manquant :`,
            answer: words[wi],
            questionData: masked,
            hint: `Position ${wi + 1}/${words.length}`,
            wordIndex: wi,
            toRevise: true,
          });
        }
      }
    });

    // Multi-surah compare
    if (multiItems && multiItems.length > 0) {
      const byAyatNum = {};
      multiItems.forEach(({ sn: s, ayatNum: an }) => {
        if (!byAyatNum[an]) byAyatNum[an] = [];
        byAyatNum[an].push(s);
      });
      Object.entries(byAyatNum).forEach(([anStr, sns]) => {
        if (sns.length < 2) return;
        const an = parseInt(anStr);
        const entries = sns
          .map((sn) => {
            const rawT = ayatTexts[`${sn}:${an}`] || "";
            const text = (() => {
              if (an === 1 && sn !== 1 && sn !== 9 && rawT) {
                const ws = rawT.trim().split(" ");
                const stripD = (s) => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, "");
                if (ws.length > 4 && stripD(ws[0]) === "بسم") return ws.slice(4).join(" ");
              }
              return rawT;
            })();
            const name = surahs.find((s2) => s2.number === sn)?.englishName ?? `S.${sn}`;
            return { sn, text, name };
          })
          .filter((e) => e.text);
        if (entries.length < 2) return;
        qs.push({
          id: `compare:${an}:${sns.sort().join(",")}`,
          type: "compare_verse",
          ayatNum: an,
          sn: sns[0],
          multiSns: sns,
          question: `Verset ${an} — associe chaque texte à sa sourate`,
          entries,
          answer: sns.map((sn) => `${sn}`).join(","),
        });
      });
    }

    // Filter by selected types
    const activeTypes = selectedQTypes || null;
    let filtered = activeTypes ? qs.filter((q) => activeTypes.has(q.type)) : qs;
    qs.length = 0;
    filtered.forEach((q) => qs.push(q));

    const TYPE_ORDER = [
      "first_contact",
      "first_word",
      "last_word",
      "missing_word",
      "next_verse",
      "previous_verse",
      "verse_number",
      "find_ayat",
      "reconstruct",
      "compare_verse",
      "find_surah",
      "unknown_word",
      "unknown_pick",
      "page_structure",
      "revise_word",
      "revise_part",
    ];

    if (randomize) {
      if (savedOrder && savedOrder.length === qs.length) {
        const savedSet = new Set(savedOrder);
        const qsSet = new Set(qs.map((q) => q.id));
        const match = savedSet.size === qsSet.size && [...savedSet].every((id) => qsSet.has(id));
        if (match) {
          const byId = {};
          qs.forEach((q) => {
            byId[q.id] = q;
          });
          const reordered = savedOrder.map((id) => byId[id]).filter(Boolean);
          qs.length = 0;
          reordered.forEach((q) => qs.push(q));
        } else {
          for (let i = qs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [qs[i], qs[j]] = [qs[j], qs[i]];
          }
        }
      } else {
        for (let i = qs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [qs[i], qs[j]] = [qs[j], qs[i]];
        }
      }
    } else {
      qs.sort((a, b) => {
        const anDiff = (a.ayatNum ?? 0) - (b.ayatNum ?? 0);
        if (anDiff !== 0) return anDiff;
        return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
      });
    }

    return qs;
  }, [_items, selectedSn, ayatTexts, maxAyat, randomize, selectedQTypes, multiItems, surahs, learnData]);

  // Persist session whenever qIdx or results change
  React.useEffect(() => {
    if (!questions.length) return;
    const questionOrder = questions.map((q) => q.id);
    if (!savedOrder) setSavedOrder(questionOrder);
    saveQSession({ currentQId, results, questionOrder });
  }, [currentQId, results, questions]);

  // Apply skipCorrect filter or reviewMistakesMode
  const activeQuestions = React.useMemo(() => {
    if (reviewMistakesMode && mistakesQueue.length > 0) {
      const qIds = new Set(mistakesQueue.map((m) => m.qId));
      return questions.filter((q) => qIds.has(q.id));
    }
    if (!skipCorrect) return questions;
    return questions.filter((q) => {
      const ld = learnData[`${q.sn ?? selectedSn}:${q.ayatNum}`] || {};
      const scores = ld.questionScores?.[q.id];
      if (!scores || scores.length < 2) return true;
      return !(scores[scores.length - 1] === 1 && scores[scores.length - 2] === 1);
    });
  }, [questions, skipCorrect, learnData, selectedSn, reviewMistakesMode, mistakesQueue]);

  // Track current question by ID
  React.useEffect(() => {
    if (!currentQId && activeQuestions.length > 0) {
      setCurrentQId(activeQuestions[initialQIdx ?? 0]?.id ?? activeQuestions[0].id);
    }
  }, [activeQuestions.length]);

  const qIdx = React.useMemo(() => {
    if (!currentQId) return 0;
    const idx = activeQuestions.findIndex((q) => q.id === currentQId);
    return idx >= 0 ? idx : 0;
  }, [activeQuestions, currentQId]);

  const q = activeQuestions[qIdx] ?? null;

  // ── Smart Multiple Choice Options Generation ─────────────────────────────────
  const multipleChoiceOptions = React.useMemo(() => {
    if (answerMode !== "choice" || !q) return [];
    const choiceCompatible = [
      "first_word",
      "last_word",
      "missing_word",
      "next_verse",
      "previous_verse",
      "verse_number",
      "find_ayat",
      "find_surah",
    ];
    if (!choiceCompatible.includes(q.type)) return [];
    return generateMultipleChoiceOptions({
      question: q,
      allAyatTexts: ayatTexts,
      surahs,
      count: 4,
    });
  }, [q?.id, answerMode, ayatTexts, surahs]);

  // Reset choice selection when question changes
  React.useEffect(() => {
    setSelectedChoiceId(null);
    setChoiceEvaluation(null);
  }, [currentQId]);

  const handleSelectChoice = (opt) => {
    if (selectedChoiceId || revealed || !q) return;
    setSelectedChoiceId(opt.id);
    const isCorrect = Boolean(opt.isCorrect);
    setChoiceEvaluation({ isCorrect });
    triggerQuizHaptic(isCorrect ? "success" : "error", hapticFeedback);

    if (isCorrect) {
      const isStreakBonus = streak + 1 >= 3;
      playQuizSound(isStreakBonus ? "streak" : "correct", soundEffects);
    } else {
      playQuizSound("incorrect", soundEffects);
    }

    // Auto-advance after 650ms for satisfying game-like rhythm
    setTimeout(() => {
      answer(isCorrect);
      setSelectedChoiceId(null);
      setChoiceEvaluation(null);
    }, 650);
  };

  // Keyboard accessibility: 1, 2, 3, 4 for choices; Space to reveal
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target?.tagName)) return;
      if (answerMode === "choice" && multipleChoiceOptions.length > 0 && !selectedChoiceId && !revealed) {
        if (e.key === "1" && multipleChoiceOptions[0]) handleSelectChoice(multipleChoiceOptions[0]);
        else if (e.key === "2" && multipleChoiceOptions[1]) handleSelectChoice(multipleChoiceOptions[1]);
        else if (e.key === "3" && multipleChoiceOptions[2]) handleSelectChoice(multipleChoiceOptions[2]);
        else if (e.key === "4" && multipleChoiceOptions[3]) handleSelectChoice(multipleChoiceOptions[3]);
      } else if (e.code === "Space" && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        toggleAudio();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [answerMode, multipleChoiceOptions, selectedChoiceId, revealed, isPlaying, rawAudioUrl]);

  // ── Timer Countdown Logic ───────────────────────────────────────────────────
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (timerMode === "off" || revealed || done || !q) {
      return;
    }

    // Initialize timer for current question
    const defaultSecs = timerMode === "15s" ? 15 : timerMode === "30s" ? 30 : 60;
    dispatch(quizActions.setTimeRemaining(defaultSecs));

    timerIntervalRef.current = setInterval(() => {
      const curRemaining = sel.quizTimeRemaining(store.getState());
      if (curRemaining <= 1) {
        clearInterval(timerIntervalRef.current);
        dispatch(quizActions.setTimeRemaining(0));
        playQuizSound("incorrect", soundEffects);
        setRevealed(true);
        setLastAutoGrade(false);
      } else {
        dispatch(quizActions.decrementTimeRemaining());
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [currentQId, timerMode, revealed, done]);

  // ── Answer Handler ──────────────────────────────────────────────────────────
  const answer = (correct, removeRevise = false) => {
    if (!q) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const timeBonus = timerMode !== "off" && timeRemaining > 0 ? timeRemaining * 4 : 0;

    // Record into Redux store
    dispatch(
      quizActions.recordQuizAnswer({
        isCorrect: correct,
        sn: q.sn ?? selectedSn,
        ayatNum: q.ayatNum,
        qId: q.id,
        type: q.type,
        question: q.question,
        answer: q.answer,
        userAnswer: lastAutoGrade ? q.answer : "",
        timeBonus,
      })
    );

    // Audio feedback
    if (correct) {
      const isStreakBonus = streak + 1 >= 3;
      playQuizSound(isStreakBonus ? "streak" : "correct", soundEffects);
    } else {
      playQuizSound("incorrect", soundEffects);
    }

    setRevealed(false);
    setLastAutoGrade(null);

    const r = { sn: q.sn ?? selectedSn, ayatNum: q.ayatNum, qId: q.id, correct, type: q.type };
    setResults((prev) => [...prev, r]);

    setLData(q.sn ?? selectedSn, q.ayatNum, (d) => {
      const qs2 = { ...(d.questionScores || {}) };
      delete qs2["undefined"];
      qs2[q.id] = [...(qs2[q.id] || []).slice(-4), correct ? 1 : 0];
      const patch = { ...d, questionScores: qs2 };

      if (q.type === "first_contact" && correct) {
        patch.firstContact = true;
        patch.firstContactDate = new Date().toISOString();
        if (!patch.readCount || patch.readCount < 1) {
          patch.readCount = 1;
        }
      }
      if (removeRevise) {
        patch.toRevise = false;
        const hist = [...(d.reviseHistory || [])];
        const openIdx = hist.findIndex((e) => !e.endDate);
        if (openIdx !== -1) {
          hist[openIdx] = { ...hist[openIdx], endDate: new Date().toISOString() };
          patch.reviseHistory = hist;
        }
      }
      return patch;
    });

    // Advance to next question
    const nextInActive = activeQuestions[qIdx + 1];
    if (nextInActive) {
      setCurrentQId(nextInActive.id);
      onQIdxChange?.(qIdx + 1);
    } else {
      setDone(true);
      clearQSession();

      // Compute and record session summary
      const elapsedSec = Math.round((Date.now() - sessionStartTime) / 1000);
      const summary = computeSessionSummary([...results, r], elapsedSec, bestStreak, score);
      dispatch(quizActions.saveQuizSummary(summary));
    }
  };

  // Launch Mistakes Review Mode
  const handleLaunchMistakesReview = () => {
    const failedList = results.filter((r) => !r.correct);
    if (failedList.length === 0) return;
    setMistakesQueue(failedList);
    setReviewMistakesMode(true);
    setResults([]);
    setDone(false);
    setRevealed(false);
    setCurrentQId(failedList[0].qId);
  };

  // Delay showing empty state to allow async text loading
  React.useEffect(() => {
    if (activeQuestions.length === 0 && _items.length > 0) {
      const t = setTimeout(() => setEmptyTimeout(true), 3000);
      return () => clearTimeout(t);
    } else {
      setEmptyTimeout(false);
    }
  }, [activeQuestions.length, _items.length]);

  const textsLoaded = _items.some(({ sn: s, ayatNum }) => !!ayatTexts[`${s ?? selectedSn}:${ayatNum}`]);

  // Audio Playback
  const qSn = q?.sn ?? selectedSn;
  const qAyatNum = q?.ayatNum;
  const ayatText = (qSn && qAyatNum && ayatTexts[`${qSn}:${qAyatNum}`]) || "";
  const ldQ = (qSn && qAyatNum && learnData[`${qSn}:${qAyatNum}`]) || {};
  const prevScore = q ? ldQ.questionScores?.[q.id] : null;
  const lastCorrect = prevScore ? prevScore[prevScore.length - 1] : null;
  const rawAudioUrl =
    qSn && qAyatNum && globalNums[`${qSn}:${qAyatNum}`]
      ? `${getAudioBase()}/${globalNums[`${qSn}:${qAyatNum}`]}.mp3`
      : null;

  const toggleAudio = async () => {
    const a = audioRef.current;
    if (!a || !rawAudioUrl) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      try {
        const playable = await getPlayableAudioUrl(rawAudioUrl);
        a.src = playable;
        await a.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  // Quick toggle ToRevise bookmark for current verse
  const handleToggleCurrentRevise = () => {
    if (!qSn || !qAyatNum) return;
    setLData(qSn, qAyatNum, (d) => {
      const nextRev = !d.toRevise;
      const hist = [...(d.reviseHistory || [])];
      if (nextRev) {
        hist.push({ startDate: new Date().toISOString() });
      } else {
        const openIdx = hist.findIndex((e) => !e.endDate);
        if (openIdx !== -1) hist[openIdx] = { ...hist[openIdx], endDate: new Date().toISOString() };
      }
      return { ...d, toRevise: nextRev, reviseHistory: hist };
    });
  };

  // Export mistakes into a new Revision Collection
  const handleCreateMistakesCollection = () => {
    const failedList = results.filter((r) => !r.correct);
    if (failedList.length === 0) return;
    const sName = surahInfo?.englishName || (multiItems ? "Multi-sourates" : `S.${selectedSn}`);
    const payload = createMistakesCollectionPayload(failedList, sName);
    if (!payload) return;
    dispatch(collectionsActions.createCollectionWithMultipleAyats(payload));
    setCollectionCreatedNotice(payload.name);
    triggerQuizHaptic("success", hapticFeedback);
    playQuizSound("correct", soundEffects);
  };

  // Play audio for a specific verse in review breakdown
  const playReviewAudio = async (sn, ayatNum) => {
    const key = `${sn}:${ayatNum}`;
    const a = audioRef.current;
    if (!a) return;
    if (reviewAudioPlayingAyat === key) {
      a.pause();
      setReviewAudioPlayingAyat(null);
      return;
    }
    const gNum = globalNums[key];
    if (!gNum) return;
    try {
      const url = `${getAudioBase()}/${gNum}.mp3`;
      const playable = await getPlayableAudioUrl(url);
      a.src = playable;
      await a.play();
      setReviewAudioPlayingAyat(key);
      a.onended = () => setReviewAudioPlayingAyat(null);
    } catch {
      setReviewAudioPlayingAyat(null);
    }
  };

  // Empty state handling
  if (activeQuestions.length === 0) {
    if (_items.length === 0) {
      return (
        <div style={{ padding: "20px", textAlign: "center", fontSize: 9, color: "var(--text3)", letterSpacing: 1 }}>
          AUCUN AYAT CORRESPONDANT DANS LA PLAGE SÉLECTIONNÉE
          <button
            onClick={onDone}
            style={{
              display: "block",
              margin: "16px auto 0",
              fontSize: 9,
              letterSpacing: 2,
              fontFamily: "'Cinzel', serif",
              padding: "7px 18px",
              border: "1px solid var(--border2)",
              background: "transparent",
              color: "var(--text3)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ← RETOUR
          </button>
        </div>
      );
    }

    if (!emptyTimeout) {
      return (
        <div
          style={{
            padding: "30px",
            textAlign: "center",
            fontSize: 9,
            color: "var(--text3)",
            letterSpacing: 2,
            fontFamily: "'Cinzel', serif",
          }}
        >
          ⏳ CHARGEMENT DU QUIZ ({_items.length} versets)...
        </div>
      );
    }

    return (
      <div style={{ padding: "24px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 24 }}>✓</div>
        <div style={{ fontSize: 12, color: "var(--green)", fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>
          TOUTES LES QUESTIONS MAÎTRISÉES
        </div>
        <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 0.5, maxWidth: 300, lineHeight: 1.7 }}>
          Toutes les questions sélectionnées ont été réussies au moins 2 fois d'affilée !
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => {
              _items.forEach(({ sn: s, ayatNum: an }) => {
                setLData(s ?? selectedSn, an, (d) => ({ ...d, questionScores: {} }));
              });
            }}
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              fontFamily: "'Cinzel', serif",
              padding: "7px 16px",
              border: "1px solid var(--gold)",
              background: "rgba(201,168,76,.08)",
              color: "var(--gold2)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            🔄 RÉINITIALISER LES SCORES
          </button>
          <button
            onClick={onDone}
            style={{
              fontSize: 9,
              letterSpacing: 2,
              fontFamily: "'Cinzel', serif",
              padding: "7px 16px",
              border: "1px solid var(--border2)",
              background: "transparent",
              color: "var(--text3)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ← RETOUR
          </button>
        </div>
      </div>
    );
  }

  // ── Session Finished / Results Screen ───────────────────────────────────────
  if (done) {
    const correctCount = results.filter((r) => r.correct).length;
    const incorrectCount = results.length - correctCount;
    const pct = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
    const elapsedSec = Math.round((Date.now() - sessionStartTime) / 1000);
    const summary = computeSessionSummary(results, elapsedSec, bestStreak, score);

    return (
      <div
        className="quiz-completed-screen"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          padding: "24px 16px",
          maxWidth: 620,
          margin: "0 auto",
        }}
      >
        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "var(--gold2)", fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
            🎉 SESSION TERMINÉE
          </div>
          <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 24, color: "var(--gold)", direction: "rtl", marginTop: 4 }}>
            {multiItems ? `${[...new Set(multiItems.map((i) => i.sn))].length} sourates` : surahInfo?.name}
          </div>
        </div>

        {/* Big Score Card */}
        <div
          style={{
            width: "100%",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 52, color: masteryColor(pct), letterSpacing: -2, lineHeight: 1 }}>
            {pct}%
          </div>
          <div style={{ fontSize: 11, color: "var(--text2)", letterSpacing: 1, fontWeight: 600 }}>
            {summary.evaluation}
          </div>

          {/* Stats Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              width: "100%",
              marginTop: 6,
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>SCORE</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold2)", fontFamily: "'Cinzel', serif" }}>
                ⭐ {score}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>MEILLEURE SÉRIE</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f39c12", fontFamily: "'Cinzel', serif" }}>
                🔥 {bestStreak}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>TEMPS ÉCOULÉ</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--teal2)", fontFamily: "monospace" }}>
                ⏱ {summary.formattedDuration}
              </div>
            </div>
          </div>
        </div>

        {/* Verses results chips */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: "var(--text3)", textAlign: "center" }}>
            DÉTAIL DES RÉPONSES ({correctCount}/{results.length})
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${r.correct ? "var(--green)" : "var(--red)"}`,
                  color: r.correct ? "var(--green)" : "var(--red)",
                  fontSize: 10,
                  fontFamily: "'Cinzel', serif",
                  background: r.correct ? "rgba(46,204,113,0.08)" : "rgba(224,90,90,0.08)",
                }}
              >
                {multiItems ? `S.${r.sn}:${r.ayatNum}` : `v.${r.ayatNum}`} {r.correct ? "✓" : "✗"}
              </div>
            ))}
          </div>
        </div>

        {/* Mistakes categories breakdown */}
        {incorrectCount > 0 && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            <div style={{ fontSize: 8, letterSpacing: 1.5, color: "var(--text3)", textAlign: "center", fontFamily: "'Cinzel', serif" }}>
              ANALYSE DES ERREURS PAR TYPE
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {computeMistakesSummaryByCategory(results.filter((r) => !r.correct)).map((cat) => (
                <span
                  key={cat.type}
                  style={{
                    fontSize: 9,
                    padding: "3px 8px",
                    borderRadius: 12,
                    background: "rgba(231,76,60,0.12)",
                    border: "1px solid rgba(231,76,60,0.3)",
                    color: "var(--red)",
                    fontFamily: "'Cinzel', serif",
                    fontWeight: 600,
                  }}
                >
                  {cat.label} : <strong>{cat.count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Collection creation feedback banner */}
        {collectionCreatedNotice && (
          <div
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(46,204,113,0.15)",
              border: "1px solid var(--green)",
              color: "var(--green)",
              fontSize: 10,
              fontFamily: "'Cinzel', serif",
              textAlign: "center",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            ✓ Collection enregistrée : "{collectionCreatedNotice}"
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 6 }}>
          {incorrectCount > 0 && (
            <button
              onClick={handleLaunchMistakesReview}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: 11,
                letterSpacing: 1.5,
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                background: "rgba(201,168,76,0.18)",
                border: "1px solid var(--gold2)",
                color: "var(--gold2)",
                borderRadius: 8,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
              }}
            >
              🔄 REVOIR UNIQUEMENT MES ERREURS ({incorrectCount})
            </button>
          )}

          {incorrectCount > 0 && !collectionCreatedNotice && (
            <button
              onClick={handleCreateMistakesCollection}
              style={{
                width: "100%",
                padding: "11px",
                fontSize: 10,
                letterSpacing: 1.5,
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                background: "rgba(62,184,160,0.16)",
                border: "1px solid var(--teal2)",
                color: "var(--teal2)",
                borderRadius: 8,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
              }}
            >
              📁 CRÉER UNE COLLECTION DE RÉVISION ({incorrectCount} versets)
            </button>
          )}

          {/* Toggle Question-by-Question Detailed Review */}
          <button
            onClick={() => setShowDetailedReview(!showDetailedReview)}
            style={{
              background: "transparent",
              border: "1px dashed var(--border2)",
              color: "var(--text3)",
              fontSize: 9,
              padding: "7px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "'Cinzel', serif",
              letterSpacing: 1,
              width: "100%",
            }}
          >
            {showDetailedReview ? "▲ MASQUER LE DÉTAIL" : `▼ VOIR LE DÉTAIL DES ${results.length} QUESTIONS`}
          </button>

          {showDetailedReview && (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 280,
                overflowY: "auto",
                padding: "8px",
                background: "var(--surface3)",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              {results.map((r, i) => {
                const qObj = questions.find((item) => item.id === r.qId) || {};
                const key = `${r.sn}:${r.ayatNum}`;
                const isAudioActive = reviewAudioPlayingAyat === key;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: r.correct ? "rgba(46,204,113,0.06)" : "rgba(224,90,90,0.06)",
                      borderLeft: `3px solid ${r.correct ? "var(--green)" : "var(--red)"}`,
                      fontSize: 10,
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                      <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, color: "var(--text1)" }}>
                        #{i + 1} · {multiItems ? `S.${r.sn}:${r.ayatNum}` : `v.${r.ayatNum}`} — {qObj.question || r.type}
                      </span>
                      {qObj.answer && (
                        <span style={{ fontSize: 9.5, color: "var(--gold2)", direction: "rtl", fontFamily: "'Amiri Quran', serif" }}>
                          Réponse : {qObj.answer}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ color: r.correct ? "var(--green)" : "var(--red)", fontWeight: 700, fontSize: 12 }}>
                        {r.correct ? "✓" : "✗"}
                      </span>
                      {globalNums[key] && (
                        <button
                          onClick={() => playReviewAudio(r.sn, r.ayatNum)}
                          style={{
                            background: isAudioActive ? "rgba(62,184,160,0.3)" : "transparent",
                            border: "1px solid var(--border2)",
                            color: "var(--teal2)",
                            fontSize: 10,
                            borderRadius: 4,
                            padding: "3px 7px",
                            cursor: "pointer",
                          }}
                          title="Écouter la récitation du verset"
                        >
                          {isAudioActive ? "⏸" : "▶"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                clearQSession();
                setSavedOrder(null);
                setResults([]);
                setRevealed(false);
                setDone(false);
                setReviewMistakesMode(false);
                dispatch(quizActions.resetQuizSession());
                if (questions[0]) setCurrentQId(questions[0].id);
              }}
              style={{
                flex: 1,
                padding: "10px",
                fontSize: 10,
                letterSpacing: 1.5,
                fontFamily: "'Cinzel', serif",
                background: "transparent",
                border: "1px solid var(--border2)",
                color: "var(--text2)",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              ↺ RECOMMENCER TOUT
            </button>

            <button
              onClick={onDone}
              style={{
                flex: 1,
                padding: "10px",
                fontSize: 10,
                letterSpacing: 2,
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                background: "rgba(62,184,160,0.15)",
                border: "1px solid var(--teal)",
                color: "var(--teal2)",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              ✓ TERMINER
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active Question Screen ──────────────────────────────────────────────────
  const progressPct = activeQuestions.length > 0 ? Math.round(((qIdx + 1) / activeQuestions.length) * 100) : 0;
  const streakInfo = getStreakCelebration(streak);
  const isCurrentToRevise = !!ldQ?.toRevise;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 0", maxWidth: 680, margin: "0 auto" }}>
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} style={{ display: "none" }} />

      {/* Top HUD: Progress, Points, Streak & Controls */}
      <div
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        }}
      >
        {/* Row 1: Back, Ticker & Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <button
            onClick={onDone}
            style={{
              fontSize: 10,
              padding: "4px 8px",
              fontFamily: "'Cinzel', serif",
              background: "transparent",
              border: "1px solid var(--border2)",
              color: "var(--text3)",
              borderRadius: 6,
              cursor: "pointer",
            }}
            title="Quitter le quiz"
          >
            ✕
          </button>

          {/* Points & Streak Ticker */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                color: "var(--gold2)",
              }}
            >
              ⭐ {score} pts
            </span>

            {streak >= 2 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: streakInfo ? `${streakInfo.color}25` : "rgba(243,156,18,0.2)",
                  color: streakInfo ? streakInfo.color : "#f39c12",
                  border: `1px solid ${streakInfo ? streakInfo.color : "#f39c12"}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  animation: streak >= 3 ? "pulse 1.8s infinite" : "none",
                }}
              >
                🔥 {streak}
              </span>
            )}
          </div>

          {/* Quick Controls: Answer Mode, Timer, Sound, Haptic, Bookmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* Mode QCM / Libre switcher */}
            <button
              onClick={() => {
                const nextMode = answerMode === "choice" ? "free" : "choice";
                dispatch(quizActions.setQuizAnswerMode(nextMode));
              }}
              style={{
                fontSize: 8.5,
                padding: "3px 8px",
                fontFamily: "'Cinzel', serif",
                background: answerMode === "choice" ? "rgba(201,168,76,0.15)" : "var(--surface3)",
                border: `1px solid ${answerMode === "choice" ? "var(--gold)" : "var(--border2)"}`,
                color: answerMode === "choice" ? "var(--gold2)" : "var(--text3)",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
              title="Basculer entre Mode QCM (Choix instantanés) et Mode Libre (Saisie / Récitation)"
            >
              {answerMode === "choice" ? "⚡ QCM" : "✍️ LIBRE"}
            </button>

            {/* Tajweed colored rules toggle */}
            <button
              onClick={() => dispatch(quizActions.toggleQuizTajweed())}
              style={{
                fontSize: 8.5,
                padding: "3px 7px",
                fontFamily: "'Cinzel', serif",
                background: showTajweedInQuiz ? "rgba(251,191,36,0.15)" : "transparent",
                border: `1px solid ${showTajweedInQuiz ? "#fbbf24" : "var(--border2)"}`,
                color: showTajweedInQuiz ? "#fbbf24" : "var(--text3)",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
              title="Afficher ou masquer les couleurs de Tajwîd sur les versets"
            >
              {showTajweedInQuiz ? "🎨 TAJWÎD" : "🎨 SIMPLE"}
            </button>

            {/* Arabic font size adjuster */}
            <button
              onClick={() => {
                const sizes = ["sm", "md", "lg", "xl"];
                const nextIdx = (sizes.indexOf(arabicFontSize) + 1) % sizes.length;
                dispatch(quizActions.setQuizArabicFontSize(sizes[nextIdx]));
              }}
              style={{
                fontSize: 8.5,
                padding: "3px 7px",
                fontFamily: "'Cinzel', serif",
                background: "var(--surface3)",
                border: "1px solid var(--border2)",
                color: "var(--gold2)",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 700,
              }}
              title={`Taille du texte arabe (${arabicFontSize.toUpperCase()}) — Cliquez pour agrandir`}
            >
              A± {arabicFontSize.toUpperCase()}
            </button>

            {/* Timer mode pill */}
            <button
              onClick={() => {
                const nextMode = timerMode === "off" ? "30s" : timerMode === "30s" ? "15s" : timerMode === "15s" ? "60s" : "off";
                dispatch(quizActions.setQuizTimerMode(nextMode));
              }}
              style={{
                fontSize: 8.5,
                padding: "3px 7px",
                fontFamily: "'Cinzel', serif",
                background: timerMode !== "off" ? (timeRemaining <= 5 ? "rgba(231,76,60,0.18)" : "rgba(62,184,160,0.15)") : "transparent",
                border: `1px solid ${timerMode !== "off" ? (timeRemaining <= 5 ? "var(--red)" : "var(--teal)") : "var(--border2)"}`,
                color: timerMode !== "off" ? (timeRemaining <= 5 ? "var(--red)" : "var(--teal2)") : "var(--text3)",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
              title="Changer le mode chronomètre (15s, 30s, 60s, OFF)"
            >
              ⏱ {timerMode !== "off" ? `${timeRemaining}s` : "OFF"}
            </button>

            {/* Sound toggle */}
            <button
              onClick={() => dispatch(quizActions.toggleQuizSound())}
              style={{
                fontSize: 11,
                background: "transparent",
                border: "none",
                color: soundEffects ? "var(--gold2)" : "var(--text3)",
                cursor: "pointer",
                padding: "2px 4px",
              }}
              title={soundEffects ? "Sons activés (Web Audio API)" : "Sons coupés"}
            >
              {soundEffects ? "🔊" : "🔇"}
            </button>

            {/* Haptic feedback toggle */}
            <button
              onClick={() => dispatch(quizActions.toggleQuizHaptic())}
              style={{
                fontSize: 11,
                background: "transparent",
                border: "none",
                color: hapticFeedback ? "var(--teal2)" : "var(--text3)",
                cursor: "pointer",
                padding: "2px 4px",
              }}
              title={hapticFeedback ? "Vibrations haptiques activées" : "Vibrations haptiques désactivées"}
            >
              {hapticFeedback ? "📳" : "📵"}
            </button>

            {/* Verse Bookmark to Revise */}
            <button
              onClick={handleToggleCurrentRevise}
              style={{
                fontSize: 11,
                background: "transparent",
                border: "none",
                color: isCurrentToRevise ? "#ff7eb3" : "var(--text3)",
                cursor: "pointer",
                padding: "2px 4px",
              }}
              title={isCurrentToRevise ? "Marqué à réviser (clique pour retirer)" : "Marquer cet ayat à réviser"}
            >
              {isCurrentToRevise ? "🔖" : "🏷"}
            </button>
          </div>
        </div>

        {/* Row 2: Progress Bar & Question Counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 4, background: "var(--surface3)", borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, var(--teal), var(--gold2))",
                borderRadius: 2,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span style={{ fontSize: 9, color: "var(--text3)", fontFamily: "monospace", flexShrink: 0 }}>
            {qIdx + 1}/{activeQuestions.length}
          </span>
        </div>
      </div>

      {/* Streak milestone toast banner if active */}
      {streakInfo && (
        <div
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            background: `${streakInfo.color}18`,
            border: `1px solid ${streakInfo.color}`,
            color: streakInfo.color,
            fontSize: 10,
            fontFamily: "'Cinzel', serif",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            {streakInfo.badge} {streakInfo.label} — {streakInfo.sub}
          </span>
          <span style={{ fontSize: 9, opacity: 0.9 }}>Points x{streakInfo.multiplier}</span>
        </div>
      )}

      {/* Main Question Card */}
      <div
        key={q.id}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          padding: "20px 16px",
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header: Verse Number, Surah Name, Mastery & Audio Reciter Preview */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 34,
                fontWeight: 700,
                color: "var(--teal2)",
                lineHeight: 1,
              }}
            >
              {q.ayatNum}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: "var(--text3)", letterSpacing: 1, fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
                  {(surahs.find((s) => s.number === qSn)?.englishName || surahInfo?.englishName || "").toUpperCase()}
                </span>
                {surahs.find((s) => s.number === qSn)?.name && (
                  <span style={{ fontFamily: "'Amiri Quran', serif", fontSize: 15, color: "var(--gold)" }}>
                    {surahs.find((s) => s.number === qSn)?.name}
                  </span>
                )}
              </div>
              <MasteryBadge pct={computeMastery(ldQ)} />
            </div>
          </div>

          {/* Offline-resilient audio listening clue button */}
          {rawAudioUrl && (
            <button
              onClick={toggleAudio}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                border: "none",
                background: isPlaying ? "rgba(62,184,160,.25)" : "rgba(62,184,160,.12)",
                color: "var(--teal2)",
                fontSize: 11,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: isPlaying ? "0 0 0 3px rgba(62,184,160,.3)" : "none",
                transition: "all .2s",
                fontFamily: "'Cinzel', serif",
                fontWeight: 600,
              }}
              title="Écouter le verset comme indice (Raccourci: Touche R)"
            >
              <span>{isPlaying ? "⏸ Pause" : "🎧 Indice (R)"}</span>
            </button>
          )}
        </div>

        {/* Question Title */}
        <div style={{ textAlign: "center", width: "100%" }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: "var(--text3)", marginBottom: 4 }}>QUESTION</div>
          <div style={{ fontSize: 13, letterSpacing: 0.8, color: "var(--gold2)", fontFamily: "'Cinzel', serif", lineHeight: 1.5, fontWeight: 600 }}>
            {q.question}
          </div>
        </div>

        {/* Arabic excerpt if applicable */}
        {q.questionData &&
          q.type !== "find_surah" &&
          q.type !== "unknown_word" &&
          q.type !== "unknown_pick" &&
          q.type !== "revise_word" &&
          q.type !== "revise_part" && (
            <div
              style={{
                fontFamily: "'Amiri Quran', serif",
                direction: "rtl",
                textAlign: "center",
                color: "var(--text1)",
                padding: "14px 18px",
                background: "var(--surface3)",
                borderRadius: 9,
                border: "1px solid var(--border)",
                width: "100%",
                boxSizing: "border-box",
                ...getFontSizeStyle(arabicFontSize),
              }}
            >
              {showTajweedInQuiz ? (
                <ArabicHighlighted
                  text={q.questionData}
                  showQalqala={true}
                  showMadd={true}
                  showIzhar={true}
                  showIdgham={true}
                  showIkhfa={true}
                  showIqlab={true}
                  showGhunnah={true}
                />
              ) : (
                q.questionData
              )}
            </div>
          )}

        {/* Previous try feedback */}
        {lastCorrect !== null && (
          <div style={{ fontSize: 8.5, color: lastCorrect ? "var(--green)" : "var(--red)", letterSpacing: 0.8 }}>
            {lastCorrect ? "✓ Réussi la dernière fois" : "✗ Erreur la dernière fois"}
          </div>
        )}

        {/* Specific Question Type Renderers */}
        {q.type === "first_contact" ? (
          <FirstContactQuestion
            key={q.id}
            q={q}
            onAnswer={answer}
            globalNums={globalNums}
            timestamps={timestamps}
            ayatTexts={ayatTexts}
          />
        ) : q.type === "compare_verse" ? (
          <CompareVerseQuestion q={q} onAnswer={answer} globalNums={globalNums} />
        ) : q.type === "find_surah" ? (
          <FindSurahQuestion q={q} surahs={surahs} onAnswer={answer} />
        ) : q.type === "reconstruct" ? (
          <ReconstructQuestion q={q} ayatTexts={ayatTexts} selectedSn={qSn} onAnswer={answer} />
        ) : q.type === "unknown_word" || q.type === "revise_word" ? (
          <UnknownWordQuestion key={q.id} q={q} onAnswer={answer} />
        ) : q.type === "unknown_pick" ? (
          <UnknownPickQuestion key={q.id} q={q} onAnswer={answer} />
        ) : q.type === "revise_part" ? (
          <RevisePartQuestion
            key={q.id}
            q={q}
            onAnswer={answer}
            ayatTexts={ayatTexts}
            globalNums={globalNums}
            timestamps={timestamps}
            sn={qSn}
          />
        ) : q.type === "page_structure" ? (
          <PageStructureQuestion
            key={q.id}
            q={q}
            onAnswer={answer}
            ayatTexts={ayatTexts}
            globalNums={globalNums}
            timestamps={timestamps}
            sn={qSn}
          />
        ) : !revealed ? (
          answerMode === "choice" && multipleChoiceOptions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px" }}>
                <span style={{ fontSize: 8, letterSpacing: 1.5, color: "var(--text3)", fontFamily: "'Cinzel', serif" }}>
                  CHOISIS LA BONNE RÉPONSE (1 - {multipleChoiceOptions.length})
                </span>
                <button
                  type="button"
                  onClick={() => dispatch(quizActions.setQuizAnswerMode("free"))}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--teal2)",
                    fontSize: 8.5,
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontFamily: "'Cinzel', serif",
                    letterSpacing: 0.5,
                  }}
                >
                  ✍️ Saisie libre
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, width: "100%" }}>
                {multipleChoiceOptions.map((opt, idx) => {
                  const isSelected = selectedChoiceId === opt.id;
                  const showResult = selectedChoiceId !== null;
                  let bg = "var(--surface3)";
                  let border = "1px solid var(--border2)";
                  let color = "var(--text1)";

                  if (showResult) {
                    if (opt.isCorrect) {
                      bg = "rgba(46, 204, 113, 0.18)";
                      border = "1px solid var(--green)";
                      color = "var(--green)";
                    } else if (isSelected && !opt.isCorrect) {
                      bg = "rgba(231, 76, 60, 0.18)";
                      border = "1px solid var(--red)";
                      color = "var(--red)";
                    } else {
                      bg = "var(--surface3)";
                      border = "1px solid var(--border)";
                      color = "var(--text3)";
                    }
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={showResult}
                      onClick={() => handleSelectChoice(opt)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        minHeight: 48,
                        borderRadius: 10,
                        background: bg,
                        border,
                        color,
                        cursor: showResult ? "default" : "pointer",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? "0 0 12px rgba(201,168,76,0.3)" : "none",
                        textAlign: q.type === "verse_number" || q.type === "find_surah" ? "left" : "right",
                        direction: q.type === "verse_number" || q.type === "find_surah" ? "ltr" : "rtl",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          width: "100%",
                          justifyContent: "space-between",
                          direction: "ltr",
                        }}
                      >
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: isSelected ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.06)",
                            border: `1px solid ${isSelected ? "var(--gold)" : "var(--border2)"}`,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "'Cinzel', serif",
                            fontSize: 10,
                            fontWeight: 700,
                            color: isSelected ? "var(--gold2)" : "var(--text3)",
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </span>

                        <span
                          style={{
                            flex: 1,
                            padding: "0 8px",
                            fontFamily: q.type === "verse_number" ? "'Cinzel', serif" : "'Amiri Quran', serif",
                            fontSize: q.type === "verse_number" ? 16 : (getFontSizeStyle(arabicFontSize).fontSize || "1.45rem"),
                            lineHeight: 1.8,
                            textAlign: q.type === "verse_number" || q.type === "find_surah" ? "left" : "right",
                            direction: q.type === "verse_number" || q.type === "find_surah" ? "ltr" : "rtl",
                          }}
                        >
                          {showTajweedInQuiz && q.type !== "verse_number" && q.type !== "find_surah" ? (
                            <ArabicHighlighted
                              text={opt.text}
                              showQalqala={true}
                              showMadd={true}
                              showIzhar={true}
                              showIdgham={true}
                              showIkhfa={true}
                              showIqlab={true}
                              showGhunnah={true}
                            />
                          ) : (
                            opt.text
                          )}
                        </span>

                        {showResult && (
                          <span style={{ fontSize: 16, flexShrink: 0, fontWeight: 700 }}>
                            {opt.isCorrect ? "✓" : isSelected ? "✗" : ""}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Reveal answer button in QCM if learner is stuck */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setRevealed(true);
                    setLastAutoGrade(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text3)",
                    fontSize: 8,
                    cursor: "pointer",
                    fontFamily: "'Cinzel', serif",
                    letterSpacing: 1,
                  }}
                >
                  💡 Voir la réponse (ou appuyer sur Espace)
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              {multipleChoiceOptions.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => dispatch(quizActions.setQuizAnswerMode("choice"))}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--gold2)",
                      fontSize: 8.5,
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontFamily: "'Cinzel', serif",
                      letterSpacing: 0.5,
                    }}
                  >
                    ⚡ Passer en mode QCM (Choix)
                  </button>
                </div>
              )}
              <TextAnswerInput
                q={q}
                onInspect={(grade) => {
                  setLastAutoGrade(grade);
                  setRevealed(true);
                }}
                onReveal={(autoCorrect) => {
                  if (autoCorrect !== null) {
                    answer(autoCorrect);
                  } else {
                    setLastAutoGrade(null);
                    setRevealed(true);
                  }
                }}
              />
            </div>
          )
        ) : (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Arabic audio player with timestamps */}
            <QAyatPlayer
              ayatText={ayatText}
              timestamps={timestamps?.[qSn]?.[q.ayatNum]}
              parts={ldQ?.parts}
              audioUrl={rawAudioUrl}
              learnData={ldQ}
            />

            {/* Answer highlight */}
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(201,168,76,.07)",
                borderRadius: 9,
                border: "1px solid var(--gold)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 4 }}>
                RÉPONSE ATTENDUE
              </div>
              <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 20, color: "var(--gold2)", direction: "rtl", lineHeight: 1.8 }}>
                {q.answer}
              </div>
              {q.hint && (
                <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 6, direction: "rtl", fontFamily: "'Amiri Quran', serif" }}>
                  {q.hint}
                </div>
              )}
            </div>

            {/* Post-reveal grade buttons */}
            {lastAutoGrade !== null ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                <button
                  onClick={() => answer(lastAutoGrade)}
                  style={{
                    width: "100%",
                    padding: "11px",
                    fontSize: 10,
                    letterSpacing: 1.5,
                    fontFamily: "'Cinzel', serif",
                    background: lastAutoGrade ? "rgba(76,175,129,.18)" : "rgba(224,90,90,.15)",
                    border: "1px solid " + (lastAutoGrade ? "var(--green)" : "var(--red)"),
                    color: lastAutoGrade ? "var(--green)" : "var(--red)",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {lastAutoGrade ? "✓ ENREGISTRER COMME EXACT — SUIVANT →" : "✗ ENREGISTRER COMME INCORRECT — SUIVANT →"}
                </button>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    onClick={() => answer(!lastAutoGrade)}
                    style={{
                      padding: "5px 12px",
                      fontSize: 8.5,
                      letterSpacing: 1,
                      fontFamily: "'Cinzel', serif",
                      background: "transparent",
                      border: "1px solid var(--border2)",
                      color: "var(--text3)",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    {lastAutoGrade ? "Changer pour : ✗ Incorrect" : "Changer pour : ✓ Correct"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 4 }}>
                <button
                  onClick={() => answer(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    fontSize: 9,
                    letterSpacing: 2,
                    fontFamily: "'Cinzel', serif",
                    fontWeight: 700,
                    background: "rgba(224,90,90,.08)",
                    border: "1px solid var(--red)",
                    color: "var(--red)",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  ✗ INCORRECT
                </button>
                <button
                  onClick={() => answer(true)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    fontSize: 9,
                    letterSpacing: 2,
                    fontFamily: "'Cinzel', serif",
                    fontWeight: 700,
                    background: "rgba(76,175,129,.12)",
                    border: "1px solid var(--green)",
                    color: "var(--green)",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  ✓ CORRECT
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
