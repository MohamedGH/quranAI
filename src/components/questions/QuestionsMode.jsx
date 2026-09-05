import { MasteryBadge } from "../common/Mastery.jsx";
import { fetchAyats, fetchSurahDefault } from "../../utils/reciterAudio.js";
import { masteryColor, computeMastery } from "../common/Mastery.jsx";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { normalizeArabic } from "../../utils/recitationDiff.js";
import { fetchAyatMeta, fetchQuranPage, fetchSurahSimple, loadTimestampsForSurah, getAudioBase, getGlobalRecitator } from "../../utils/reciterAudio.js";
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

export function QuestionsMode({ selectedSn, ayatList, surahs, learnData, setLData, ayatTexts, randomize, selectedQTypes, initialQIdx, onQIdxChange, onDone, multiItems, skipCorrect }) {
  // ── Session persistence ──────────────────────────────────────────────────────
  const _items = multiItems || (ayatList||[]).map(n => ({ sn: selectedSn, ayatNum: n }));
  const Q_KEY = multiItems ? `quran_questions_multi_${_items.length}` : `quran_questions_${selectedSn}_${ayatList[0]}_${ayatList[ayatList.length-1]}`;
  const loadQSession  = () => { try { return JSON.parse(localStorage.getItem(Q_KEY)) || null; } catch { return null; } };
  const saveQSession  = (data) => { try { localStorage.setItem(Q_KEY, JSON.stringify(data)); } catch {} };
  const clearQSession = () => { try { localStorage.removeItem(Q_KEY); } catch {} };

  const saved = React.useMemo(() => loadQSession(), []);

  const [results,   setResults]   = React.useState(() => saved?.results ?? []);
  const [revealed,  setRevealed]  = React.useState(false);
  const [lastAutoGrade, setLastAutoGrade] = React.useState(null);
  const [done,      setDone]      = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [emptyTimeout, setEmptyTimeout] = React.useState(false);
  const [globalNums, setGlobalNums] = React.useState({}); // numberInSurah -> globalNumber
  const [timestamps, setTimestamps] = React.useState(null); // {ayatNum: tsData}
  const [pageAyatData, setPageAyatData] = React.useState({}); // { sn: [{numberInSurah, page, hizbQuarter}] }
  // Persist the shuffled question order so resume gives same sequence
  const [savedOrder, setSavedOrder] = React.useState(() => saved?.questionOrder ?? null);
  const [currentQId, setCurrentQId] = React.useState(() => saved?.currentQId ?? null);
  const audioRef = React.useRef(null);

  // Load global ayat numbers + timestamps once (mono + multi)
  React.useEffect(() => {
    const sns = multiItems ? [...new Set(multiItems.map(i => i.sn))] : (selectedSn ? [selectedSn] : []);
    sns.forEach(sn => {
      fetchAyats(sn).then(data => {
        const m = {};
        (data?.ayahs || []).forEach(a => { m[`${sn}:${a.numberInSurah}`] = a.number; });
        setGlobalNums(p => ({ ...p, ...m }));
      }).catch(() => {});
      loadTimestampsForSurah(sn, getGlobalRecitator()).then(ts => { if (ts) setTimestamps(p => ({ ...p, [sn]: ts })); }).catch(() => {});
      fetchSurahDefault(sn).then(ayahs => {
        setPageAyatData(p => ({ ...p, [sn]: ayahs.map(a => ({ numberInSurah: a.numberInSurah, page: a.page, hizbQuarter: a.hizbQuarter, juz: a.juz })) }));
      }).catch(() => {});
    });
  }, [selectedSn, multiItems?.length]);

  React.useEffect(() => {
    setRevealed(false);
    setLastAutoGrade(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setIsPlaying(false);
  }, [currentQId]);

  // Cleanup on unmount
  React.useEffect(() => () => { audioRef.current?.pause(); }, []);

  const surahInfo  = surahs.find(s => s.number === selectedSn);
  const maxAyat    = surahInfo?.numberOfAyahs ?? 1;

  // Build question list: 2 questions per ayat
    const questions = React.useMemo(() => {        const qs = [];

        _items.forEach(({ sn: itemSn, ayatNum }) => {
            const effectiveSn = itemSn ?? selectedSn;
            const rawText = ayatTexts[`${effectiveSn}:${ayatNum}`] || "";
            const text = (() => {
              if (ayatNum === 1 && effectiveSn !== 1 && effectiveSn !== 9 && rawText) {
                const ws = rawText.trim().split(' ');
                const stripD = s => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '');
                if (ws.length > 4 && stripD(ws[0]) === 'بسم') return ws.slice(4).join(' ');
              }
              return rawText;
            })();
            const words = text.split(/\s+/).filter(Boolean);
            const surahObj  = surahs.find(s => s.number === effectiveSn);
            const surahLabel = surahObj ? `${surahObj.englishName} · ${surahObj.name}` : `S.${effectiveSn}`;
            const vLabel = `verset ${ayatNum} · ${surahLabel}`;

            // 0. Premier contact
            if (words.length > 0) {
                qs.push({
                    id: `${effectiveSn}:${ayatNum}:first_contact`,
                    sn: effectiveSn, type: "first_contact",
                    ayatNum,
                    question: `Quiz Premier Contact · ${vLabel}`,
                    answer: text,
                    text,
                    words,
                    surahName: surahLabel
                });
            }

            // 1. Premier mot
            if (words.length > 0) {
                qs.push({
                    id: `${effectiveSn}:${ayatNum}:first_word`,
                    sn: effectiveSn, type: "first_word",
                    ayatNum,
                    question: `Quel est le premier mot du ${vLabel} ?`,
                    answer: words[0],
                    hint:
                        words.length > 1
                            ? words.slice(1, 4).join(" ") + (words.length > 4 ? "..." : "")
                            : ""
                });
            }

            // 2. Dernier mot
            if (words.length > 1) {
                qs.push({
                    id: `${effectiveSn}:${ayatNum}:last_word`,
                    sn: effectiveSn, type: "last_word",
                    ayatNum,
                    question: `Quel est le dernier mot du ${vLabel} ?`,
                    answer: words[words.length - 1],
                    hint: words.slice(Math.max(0, words.length - 4), -1).join(" ")
                });
            }

            // 3. Mot manquant
            if (words.length >= 4) {
                const idx = Math.floor(words.length / 2);

                qs.push({
                    id: `${effectiveSn}:${ayatNum}:missing_word`,
                    sn: effectiveSn, type: "missing_word",
                    ayatNum,
                    question: `Quel mot manque dans le ${vLabel} ?`,
                    answer: words[idx],
                    questionData: words
                        .map((w, i) => (i === idx ? "____" : w))
                        .join(" "),
                    hint: words
                        .map((w, i) => (i === idx ? "____" : w))
                        .join(" ")
                });
            }

            // 4. Verset suivant
            if (ayatNum < maxAyat) {
                const nextText = ayatTexts[`${effectiveSn}:${ayatNum + 1}`] || "";
                const nextWords = nextText.split(/\s+/).filter(Boolean);

                if (nextWords.length) {
                    qs.push({
                        id: `${effectiveSn}:${ayatNum}:next_verse`,
                        sn: effectiveSn, type: "next_verse",
                        ayatNum,
                        question: `Quel verset suit le ${vLabel} ?`,
                        answer: String(ayatNum + 1),
                        hint:
                            nextWords.slice(0, 5).join(" ") +
                            (nextWords.length > 5 ? "..." : "")
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
                        sn: effectiveSn, type: "previous_verse",
                        ayatNum,
                        question: `Quel verset précède le ${vLabel} ?`,
                        answer: String(ayatNum - 1),
                        hint:
                            prevWords.slice(0, 5).join(" ") +
                            (prevWords.length > 5 ? "..." : "")
                    });
                }
            }

            // 6. Numéro du verset
            if (words.length) {
                qs.push({
                    id: `${effectiveSn}:${ayatNum}:verse_number`,
                    sn: effectiveSn, type: "verse_number",
                    ayatNum,
                    question: `Quel est le numéro du ${vLabel.replace(`verset ${ayatNum}`, "verset ci-dessous")} ?`,
                    answer: String(ayatNum),
                    hint: words.slice(0, 6).join(" ")
                });
            }

            // 7. Reconstituer le verset
            if (words.length >= 3) {
                const splitWords = splitArabicWords(text);
                const reconAnswer = splitWords.join(' ');
                qs.push({
                    id: `${effectiveSn}:${ayatNum}:reconstruct`,
                    sn: effectiveSn, type: "reconstruct",
                    ayatNum,
                    question: `Reconstitue le ${vLabel} dans le bon ordre`,
                    answer: reconAnswer,
                    words: splitWords,
                });
            }

            // 8. Trouver le numéro du verset (extrait du milieu)
            if (words.length >= 3) {
                const start = Math.max(1, Math.floor(words.length / 3));
                const end   = Math.min(start + 5, words.length);
                const excerpt = words.slice(start, end).join(' ');
                qs.push({
                    id: `${effectiveSn}:${ayatNum}:find_ayat`,
                    sn: effectiveSn, type: 'find_ayat',
                    ayatNum,
                    question: `Quel est le numéro du verset contenant cet extrait ?`,
                    answer: String(ayatNum),
                    questionData: excerpt,
                    hint: text,
                });
            }

          // unknown_word
          const ldItem = learnData[`${effectiveSn}:${ayatNum}`] || {};
          const unkIndices = (ldItem.unknownWords || []);
          if (unkIndices.length > 0 && words.length > 0) {
            unkIndices.forEach(wi => {
              if (wi >= words.length) return;
              const unkWord = words[wi];
              const masked  = words.map((w, i) => i === wi ? '▢▢▢' : w).join(' ');
              qs.push({ id:`${effectiveSn}:${ayatNum}:unknown_word:${wi}`, sn:effectiveSn, type:'unknown_word', ayatNum,
                question:`Complète le mot inconnu dans le ${vLabel} :`, answer:unkWord, questionData:masked,
                hint:`Position ${wi+1} sur ${words.length}`, wordIndex:wi });
            });
            const unkWords  = unkIndices.filter(i=>i<words.length).map(i=>words[i]);
            const knownWords = words.filter((_,i)=>!unkIndices.includes(i));
            const decoys = knownWords.sort(()=>Math.random()-.5).slice(0,Math.max(2,4-unkWords.length));
            const allOpts = [...unkWords,...decoys].sort(()=>Math.random()-.5);
            qs.push({ id:`${effectiveSn}:${ayatNum}:unknown_pick`, sn:effectiveSn, type:'unknown_pick', ayatNum,
              question:`Quels mots ne connais-tu pas encore dans le ${vLabel} ?`,
              answer:unkWords.join('|'), options:allOpts, questionData:text,
              hint:`${unkWords.length} mot${unkWords.length>1?'s':''} inconnu${unkWords.length>1?'s':''}` });
          }

          // ── À RÉVISER questions ──────────────────────────────────────────────
          const toRevise = ldItem.toRevise;
          if (toRevise && words.length > 0) {
            const revWords = (typeof toRevise==='object' && toRevise.words) || [];
            const revParts = (typeof toRevise==='object' && toRevise.parts) || [];
            const revAll   = toRevise === true;
            if (revWords.length > 0) {
              const validIdx = [...new Set(revWords)].filter(wi => wi < words.length).sort((a,b)=>a-b);
              if (validIdx.length > 0) {
                const masked = words.map((w,i)=>validIdx.includes(i)?'▢▢▢':w).join(' ');
                const answerWords = validIdx.map(wi => words[wi]);
                qs.push({ id:`${effectiveSn}:${ayatNum}:revise_word`, sn:effectiveSn, type:'revise_word', ayatNum,
                  question: validIdx.length > 1
                    ? `🔖 Trouve les ${validIdx.length} mots marqués à réviser dans le ${vLabel} :`
                    : `🔖 Trouve le mot marqué à réviser dans le ${vLabel} :`,
                  answer:answerWords.join('|'), questionData:masked,
                  hint:`${validIdx.length} mot${validIdx.length>1?'s':''} marqué${validIdx.length>1?'s':''} sur ${words.length}`,
                  wordIndices:validIdx, toRevise:true });
              }
            }
            if (revParts.length > 0) {
              (ldItem.parts||[]).forEach(part => {
                if (!revParts.includes(part.id)||!part.text) return;
                const pi = (ldItem.parts||[]).indexOf(part);
                qs.push({ id:`${effectiveSn}:${ayatNum}:revise_part:${part.id}`, sn:effectiveSn, type:'revise_part', ayatNum,
                  question:`🔖 Récite la partie ${pi+1} marquée à réviser dans le ${vLabel} :`,
                  answer:part.text, questionData:text, hint:`${part.wordIndices?.length||'?'} mots`,
                  partText:part.text, partIdx:pi, toRevise:true });
              });
            }
            if (revAll && words.length >= 3) {
              const wi = Math.floor(Math.random()*words.length);
              const masked = words.map((w,i)=>i===wi?'▢▢▢':w).join(' ');
              qs.push({ id:`${effectiveSn}:${ayatNum}:revise_all`, sn:effectiveSn, type:'revise_word', ayatNum,
                question:`🔖 Cet ayat est marqué à réviser — complète le mot manquant :`,
                answer:words[wi], questionData:masked, hint:`Position ${wi+1}/${words.length}`, wordIndex:wi, toRevise:true });
            }
          }
        });

        // ── Multi-sourate: group ayats with same number across surahs ──
        if (multiItems && multiItems.length > 0) {
          const byAyatNum = {};
          multiItems.forEach(({ sn: s, ayatNum: an }) => {
            if (!byAyatNum[an]) byAyatNum[an] = [];
            byAyatNum[an].push(s);
          });
          Object.entries(byAyatNum).forEach(([anStr, sns]) => {
            if (sns.length < 2) return;
            const an = parseInt(anStr);
            // Only create compare question if all surahs have text loaded
            const entries = sns.map(sn => {
              const rawT = ayatTexts[`${sn}:${an}`] || '';
              const text = (() => {
                if (an === 1 && sn !== 1 && sn !== 9 && rawT) {
                  const ws = rawT.trim().split(' ');
                  const stripD = s => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '');
                  if (ws.length > 4 && stripD(ws[0]) === 'بسم') return ws.slice(4).join(' ');
                }
                return rawT;
              })();
              const name = surahs.find(s2 => s2.number === sn)?.englishName ?? `S.${sn}`;
              return { sn, text, name };
            }).filter(e => e.text);
            if (entries.length < 2) return;
            qs.push({
              id: `compare:${an}:${sns.sort().join(',')}`,
              type: 'compare_verse',
              ayatNum: an,
              sn: sns[0],
              multiSns: sns,
              question: `Verset ${an} — associe chaque texte à sa sourate`,
              entries,
              answer: sns.map(sn => `${sn}`).join(','),
            });
          });
        }

        // ── find_surah: excerpt → identify surah (multi-sourate only) ──
        if (multiItems && multiItems.length > 0) {
          const allMultiSns = [...new Set(multiItems.map(i => i.sn))];
          multiItems.forEach(({ sn: s, ayatNum: an }) => {
            const rawT = ayatTexts[`${s}:${an}`] || '';
            if (!rawT) return;
            const ws = rawT.trim().split(/\s+/).filter(Boolean);
            if (ws.length < 3) return;
            const start = Math.max(1, Math.floor(ws.length / 3));
            const end   = Math.min(start + 5, ws.length);
            qs.push({ id:`find_surah:${s}:${an}`, type:'find_surah', sn:s, ayatNum:an,
              question:`À quelle sourate appartient cet extrait ?`, answer:String(s),
              questionData:ws.slice(start,end).join(' '), hint:rawT, options:allMultiSns });
          });
        }

        // ── PAGE STRUCTURE questions ─────────────────────────────────────────
        // Group ayats by page using pageAyatData, generate structural questions per page
        const snSet = [...new Set(_items.map(i => i.sn ?? selectedSn))];
        snSet.forEach(sn => {
          const ayahsMeta = pageAyatData[sn];
          if (!ayahsMeta || ayahsMeta.length === 0) return;
          // restrict to ayats in the session range
          const sessionNums = new Set(_items.filter(i => (i.sn ?? selectedSn) === sn).map(i => i.ayatNum));
          const sessionMeta = ayahsMeta.filter(a => sessionNums.has(a.numberInSurah));
          // group by page
          const byPage = {};
          sessionMeta.forEach(a => {
            if (!a.page) return;
            if (!byPage[a.page]) byPage[a.page] = [];
            byPage[a.page].push(a);
          });
          const surahLabel = surahs.find(s2 => s2.number === sn)?.englishName ?? `S.${sn}`;
          Object.entries(byPage).forEach(([pageStr, pageAyats]) => {
            const page = parseInt(pageStr);
            pageAyats.sort((a,b) => a.numberInSurah - b.numberInSurah);
            const first = pageAyats[0].numberInSurah;
            const last  = pageAyats[pageAyats.length-1].numberInSurah;
            const count = pageAyats.length;
            const hizb  = pageAyats[0].hizbQuarter != null ? Math.ceil(pageAyats[0].hizbQuarter / 4) : null;
            const juz   = pageAyats[0].juz ?? null;
            const multi5  = pageAyats.filter(a => a.numberInSurah % 5 === 0).map(a => a.numberInSurah);
            const multi10 = pageAyats.filter(a => a.numberInSurah % 10 === 0).map(a => a.numberInSurah);
            const base = { sn, page, first, last, count, hizb, juz, multi5, multi10, surahLabel };

            // Q1: premier verset de la page
            qs.push({ id:`ps:${sn}:${page}:first`, type:'page_structure', subtype:'first',
              question:`Quel est le 1er verset de la page ${page} (${surahLabel}) ?`,
              answer: String(first), ...base });

            // Q2: dernier verset de la page
            qs.push({ id:`ps:${sn}:${page}:last`, type:'page_structure', subtype:'last',
              question:`Quel est le dernier verset de la page ${page} (${surahLabel}) ?`,
              answer: String(last), ...base });

            // Q3: nombre d'ayats sur la page
            qs.push({ id:`ps:${sn}:${page}:count`, type:'page_structure', subtype:'count',
              question:`Combien d'ayats sur la page ${page} (${surahLabel}) ?`,
              answer: String(count), ...base });

            // Q4: hizb de la page
            if (hizb != null) qs.push({ id:`ps:${sn}:${page}:hizb`, type:'page_structure', subtype:'hizb',
              question:`À quel hizb appartient la page ${page} (${surahLabel}) ?`,
              answer: String(hizb), ...base });

            // Q5: versets multiples de 10 sur la page
            if (multi10.length > 0) qs.push({ id:`ps:${sn}:${page}:multi10`, type:'page_structure', subtype:'multi10',
              question:`Quels versets multiples de 10 se trouvent sur la page ${page} (${surahLabel}) ?`,
              answer: multi10.join(', '), ...base });

            // Q6: versets multiples de 5 (non-10) sur la page
            const multi5only = multi5.filter(n => n % 10 !== 0);
            if (multi5only.length > 0) qs.push({ id:`ps:${sn}:${page}:multi5`, type:'page_structure', subtype:'multi5',
              question:`Quels versets multiples de 5 (non-10) se trouvent sur la page ${page} (${surahLabel}) ?`,
              answer: multi5only.join(', '), ...base });

            // Q7: sur quelle page se trouve un verset dizaine aléatoire
            if (multi10.length > 0) {
              const pick = multi10[Math.floor(Math.random() * multi10.length)];
              qs.push({ id:`ps:${sn}:${page}:findpage:${pick}`, type:'page_structure', subtype:'findpage',
                question:`Sur quelle page se trouve le verset ${pick} de ${surahLabel} ?`,
                answer: String(page), ...base });
            }
          });
        });

        // Filter by selected types
        const activeTypes = selectedQTypes || null;
        let filtered = activeTypes ? qs.filter(q => activeTypes.has(q.type)) : qs;
        qs.length = 0; filtered.forEach(q => qs.push(q));

        const TYPE_ORDER = ["first_contact","first_word","last_word","missing_word","next_verse","previous_verse","verse_number","find_ayat","reconstruct","compare_verse","find_surah","unknown_word","unknown_pick","page_structure","revise_word","revise_part"];

        if (randomize) {
          // Restore saved shuffle order only if IDs match exactly
          if (savedOrder && savedOrder.length === qs.length) {
            const savedSet = new Set(savedOrder);
            const qsSet = new Set(qs.map(q => q.id));
            const match = savedSet.size === qsSet.size && [...savedSet].every(id => qsSet.has(id));
            if (match) {
              const byId = {}; qs.forEach(q => { byId[q.id] = q; });
              const reordered = savedOrder.map(id => byId[id]).filter(Boolean);
              qs.length = 0; reordered.forEach(q => qs.push(q));
            } else {
              // Reshuffle
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
          // Sequential: sort by ayatNum ascending, then by type order
          qs.sort((a, b) => {
            const anDiff = (a.ayatNum ?? 0) - (b.ayatNum ?? 0);
            if (anDiff !== 0) return anDiff;
            return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
          });
        }

        return qs;
    }, [_items, selectedSn, ayatTexts, maxAyat, randomize, selectedQTypes, multiItems, surahs, learnData, pageAyatData]);

  // Persist session whenever qIdx or results change
  React.useEffect(() => {
    if (!questions.length) return;
    const questionOrder = questions.map(q => q.id);
    if (!savedOrder) setSavedOrder(questionOrder);
    saveQSession({ currentQId, results, questionOrder });
  }, [currentQId, results, questions]);


  // Apply skipCorrect filter at render-time so it stays fresh with learnData
  const activeQuestions = React.useMemo(() => {
    if (!skipCorrect) return questions;
    return questions.filter(q => {
      const ld = learnData[`${q.sn ?? selectedSn}:${q.ayatNum}`] || {};
      const scores = ld.questionScores?.[q.id];
      if (!scores || scores.length < 2) return true; // keep if fewer than 2 attempts
      // Skip only if the last 2 answers were both correct
      return !(scores[scores.length - 1] === 1 && scores[scores.length - 2] === 1);
    });
  }, [questions, skipCorrect, learnData, selectedSn]);

  // Track current question by ID (stable across activeQuestions recomputations)
  // Sync currentQId to first question once questions are built (if no saved session)
  React.useEffect(() => {
    if (!currentQId && questions.length > 0) {
      setCurrentQId(questions[initialQIdx ?? 0]?.id ?? questions[0].id);
    }
  }, [questions.length]);

  // Derive qIdx from currentQId within activeQuestions
  const qIdx = React.useMemo(() => {
    if (!currentQId) return 0;
    const idx = activeQuestions.findIndex(q => q.id === currentQId);
    return idx >= 0 ? idx : 0;
  }, [activeQuestions, currentQId]);

  const q = activeQuestions[qIdx] ?? null;

  const answer = (correct, removeRevise = false) => {
    if (!q) return;
    setRevealed(false);
    setLastAutoGrade(null);
    const r = { sn: q.sn ?? selectedSn, ayatNum: q.ayatNum, qId: q.id, correct };
    setResults(prev => [...prev, r]);
    setLData(q.sn ?? selectedSn, q.ayatNum, d => {
      const qs2 = { ...(d.questionScores || {}) };
      delete qs2['undefined'];
      qs2[q.id] = [...(qs2[q.id] || []).slice(-4), correct ? 1 : 0];
      const patch = { ...d, questionScores: qs2 };
      if (q.type === 'first_contact' && correct) {
        patch.firstContact = true;
        patch.firstContactDate = new Date().toISOString();
        if (!patch.readCount || patch.readCount < 1) {
          patch.readCount = 1;
        }
      }
      if (removeRevise) {
        patch.toRevise = false;
        const hist = [...(d.reviseHistory || [])];
        const openIdx = hist.findIndex(e => !e.endDate);
        if (openIdx !== -1) {
          hist[openIdx] = { ...hist[openIdx], endDate: new Date().toISOString() };
          patch.reviseHistory = hist;
        }
      }
      return patch;
    });
    // Find next question
    const nextInActive = activeQuestions[qIdx + 1];
    if (nextInActive) {
      setCurrentQId(nextInActive.id);
      onQIdxChange?.(qIdx + 1);
    } else {
      // Check if there are remaining questions in `questions` excluding just-answered correctly
      const remaining = questions.filter(qq => {
        if (qq.id === q.id && correct) return false; // just answered correctly
        const ld = learnData[`${qq.sn ?? selectedSn}:${qq.ayatNum}`] || {};
        const scores = ld.questionScores?.[qq.id];
        if (!scores || !scores.length) return true;
        return scores[scores.length - 1] !== 1;
      });
      if (remaining.length === 0 || !skipCorrect) {
        setDone(true); clearQSession();
      } else {
        // Still some remaining but none after current index — done
        setDone(true); clearQSession();
      }
    }
  };

  // Delay showing empty state to allow async text loading to complete
  React.useEffect(() => {
    if (activeQuestions.length === 0 && _items.length > 0) {
      const t = setTimeout(() => setEmptyTimeout(true), 3000);
      return () => clearTimeout(t);
    } else {
      setEmptyTimeout(false);
    }
  }, [activeQuestions.length, _items.length]);

  // Are texts still loading? (multi: check if any sn has no texts yet)
  const textsLoading = _items.length > 0 && !_items.some(({ sn: s, ayatNum }) => !!(ayatTexts[`${s ?? selectedSn}:${ayatNum}`]));
  const textsLoaded  = _items.some(({ sn: s, ayatNum }) => !!(ayatTexts[`${s ?? selectedSn}:${ayatNum}`]));

  if (activeQuestions.length === 0) {
    if (_items.length === 0) return (
      <div style={{ padding:'20px', textAlign:'center', fontSize:9, color:'var(--text3)', letterSpacing:1 }}>
        AUCUN AYAT CORRESPONDANT DANS LA PLAGE SÉLECTIONNÉE
        <button onClick={onDone} style={{ display:'block', margin:'16px auto 0', fontSize:9, letterSpacing:2,
          fontFamily:"'Cinzel',serif", padding:'7px 18px', border:'1px solid var(--border2)',
          background:'transparent', color:'var(--text3)', borderRadius:6, cursor:'pointer' }}>← RETOUR</button>
      </div>
    );
    if (!emptyTimeout) return (
      <div style={{ padding:'30px', textAlign:'center', fontSize:9, color:'var(--text3)', letterSpacing:2, fontFamily:"'Cinzel',serif" }}>
        ⏳ CHARGEMENT DES TEXTES… ({_items.length} ayats, {Object.keys(ayatTexts).filter(k=>k.includes(':')).length} textes)
      </div>
    );
    // Diagnose why activeQuestions is empty
    const isMonoMode = !multiItems || multiItems.length === 0;
    const multiOnlyTypes = ['find_surah','compare_verse'];
    const hasOnlyMultiTypes = selectedQTypes instanceof Set
      && [...selectedQTypes].every(t => multiOnlyTypes.includes(t));
    const allSkipped = textsLoaded && questions.length > 0 && activeQuestions.length === 0;

    return (
      <div style={{ padding:'24px 20px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
        {/* Case 1: types incompatibles avec le mode mono */}
        {isMonoMode && hasOnlyMultiTypes ? (
          <>
            <div style={{ fontSize:11, color:'var(--gold2)', fontFamily:"'Cinzel',serif", letterSpacing:1 }}>
              TYPE INCOMPATIBLE
            </div>
            <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:.5, maxWidth:280, lineHeight:1.7 }}>
              Les types <strong style={{color:'var(--gold2)'}}>Trouver la sourate</strong> et <strong style={{color:'var(--gold2)'}}>Comparer sourates</strong> nécessitent le mode <strong style={{color:'var(--teal2)'}}>multi-sourates</strong>.
              <br/>Sélectionne d'autres types ou active plusieurs sourates.
            </div>
            <button onClick={onDone} style={{ fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              padding:'7px 18px', border:'1px solid var(--teal)', background:'rgba(62,184,160,.08)',
              color:'var(--teal2)', borderRadius:6, cursor:'pointer' }}>← CHANGER LES TYPES</button>
          </>
        ) : allSkipped ? (
          <>
            {/* Case 2: all questions already correct (skipCorrect filtered them all) */}
            <div style={{ fontSize:22 }}>✓</div>
            <div style={{ fontSize:11, color:'var(--green)', fontFamily:"'Cinzel',serif", letterSpacing:1 }}>
              TOUTES LES QUESTIONS MAÎTRISÉES
            </div>
            <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:.5, maxWidth:260, lineHeight:1.7 }}>
              Les {questions.length} questions de cette plage ont été répondues correctement au moins 2 fois.
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
              <button onClick={() => {
                // reset all questionScores for these items
                _items.forEach(({sn: s, ayatNum: an}) => {
                  setLData(s ?? selectedSn, an, d => ({ ...d, questionScores: {} }));
                });
              }} style={{ fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                padding:'7px 16px', border:'1px solid var(--gold)', background:'rgba(201,168,76,.08)',
                color:'var(--gold2)', borderRadius:6, cursor:'pointer' }}>
                🔄 RÉINITIALISER LES SCORES
              </button>
              <button onClick={onDone} style={{ fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
                padding:'7px 16px', border:'1px solid var(--border2)', background:'transparent',
                color:'var(--text3)', borderRadius:6, cursor:'pointer' }}>← RETOUR</button>
            </div>
          </>
        ) : (
          <>
            {/* Case 3: texts not loaded or unknown */}
            <div style={{ fontSize:9, color:'var(--text3)', letterSpacing:1 }}>
              {textsLoaded ? 'Aucune question générée pour cette sélection.' : 'Textes non chargés — réessaie dans un instant.'}
            </div>
            <button onClick={onDone} style={{ fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              padding:'7px 18px', border:'1px solid var(--border2)', background:'transparent',
              color:'var(--text3)', borderRadius:6, cursor:'pointer' }}>← RETOUR</button>
          </>
        )}
      </div>
    );
  }

  if (done) {
    const correct = results.filter(r => r.correct).length;
    const pct = Math.round(correct / results.length * 100);
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18, padding:'30px 20px' }}>
        <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:24, color:'var(--gold)', direction:'rtl' }}>{multiItems ? `${[...new Set(multiItems.map(i=>i.sn))].length} sourates` : surahInfo?.name}</div>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:48, color:masteryColor(pct), letterSpacing:-2 }}>{pct}%</div>
        <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)' }}>{correct}/{results.length} CORRECTES</div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'center', marginTop:4 }}>
          {results.map((r,i) => (
            <div key={i} style={{ width:24, height:24, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center',
              border:'1px solid '+(r.correct?'var(--green)':'var(--red)'),
              color:r.correct?'var(--green)':'var(--red)', fontSize:9, fontFamily:"'Cinzel',serif" }}>{multiItems ? `${r.sn??''}:${r.ayatNum}` : r.ayatNum}</div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button onClick={() => { clearQSession(); setSavedOrder(null); setCurrentQId(questions[0]?.id ?? null); setResults([]); setRevealed(false); setDone(false); }}
            style={{ padding:'8px 18px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:'transparent', border:'1px solid var(--gold)', color:'var(--gold)', borderRadius:6, cursor:'pointer' }}>↺ REFAIRE</button>
          <button onClick={onDone}
            style={{ padding:'8px 18px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:'transparent', border:'1px solid var(--border2)', color:'var(--text3)', borderRadius:6, cursor:'pointer' }}>✓ TERMINER</button>
        </div>
      </div>
    );
  }

  const progress = activeQuestions.length > 0 ? Math.round(qIdx / activeQuestions.length * 100) : 0;
  const qSn = q?.sn ?? selectedSn;
  const ayatText = ayatTexts[`${qSn}:${q.ayatNum}`] || '';
  const ldQ      = learnData[`${qSn}:${q.ayatNum}`] || {};
  const prevScore = ldQ.questionScores?.[q.id];
  const lastCorrect = prevScore ? prevScore[prevScore.length-1] : null;
  const qAudioUrl = globalNums[`${qSn}:${q.ayatNum}`] ? `${getAudioBase()}/${globalNums[`${qSn}:${q.ayatNum}`]}.mp3` : null;
  const toggleAudio = () => {
    const a = audioRef.current;
    if (!a || !qAudioUrl) return;
    if (isPlaying) { a.pause(); setIsPlaying(false); }
    else { a.src = qAudioUrl; a.play().then(() => setIsPlaying(true)).catch(() => {}); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, padding:'16px 0' }}>
      {/* Hidden audio element */}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} style={{ display:'none' }} />
      {/* Resume banner — shown when restoring a saved session */}
      {saved && qIdx > 0 && !done && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px',
          background:'rgba(62,184,160,.08)', border:'1px solid var(--teal)',
          borderRadius:8, fontSize:8, letterSpacing:1, color:'var(--teal2)' }}>
          <span style={{ flex:1 }}>▶ SESSION REPRISE — QUESTION {qIdx + 1}/{activeQuestions.length}</span>
          <button onClick={() => { clearQSession(); setSavedOrder(null); setCurrentQId(questions[0]?.id ?? null); setResults([]); setRevealed(false); setDone(false); }}
            style={{ fontSize:8, letterSpacing:1, padding:'3px 10px', borderRadius:6, cursor:'pointer',
              fontFamily:"'Cinzel',serif", border:'1px solid var(--border2)',
              background:'transparent', color:'var(--text3)' }}>RECOMMENCER</button>
        </div>
      )}

      {/* Progress */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={onDone} style={{ fontSize:9, letterSpacing:1, padding:'4px 10px', fontFamily:"'Cinzel',serif",
          background:'transparent', border:'1px solid var(--border2)', color:'var(--text3)', borderRadius:6, cursor:'pointer' }}>←</button>
        <div style={{ flex:1, height:4, background:'var(--surface3)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:progress+'%', background:'var(--teal)', borderRadius:2, transition:'width .3s' }} />
        </div>
        <div style={{ fontSize:9, color:'var(--text3)', letterSpacing:1, flexShrink:0 }}>{qIdx+1}/{activeQuestions.length}</div>
      </div>
      {/* Card */}
      <div key={qIdx} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'24px 18px',
        background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12 }}>
        {/* Ayat number + mastery + audio */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:38, fontWeight:700, color:'var(--teal2)', lineHeight:1 }}>{q.ayatNum}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:9, color:'var(--text3)', letterSpacing:1, fontFamily:"'Cinzel',serif" }}>
                {(surahs.find(s => s.number === qSn)?.englishName || surahInfo?.englishName || '').toUpperCase()}
              </span>
              {surahs.find(s => s.number === qSn)?.name && (
                <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:14, color:'var(--gold)' }}>
                  {surahs.find(s => s.number === qSn)?.name}
                </span>
              )}
            </div>
            <MasteryBadge pct={computeMastery(ldQ)} />
          </div>
          {qAudioUrl && (
            <button onClick={toggleAudio}
              style={{ width:42, height:42, borderRadius:'50%', border:'none',
                background: isPlaying ? 'rgba(62,184,160,.25)' : 'rgba(62,184,160,.1)',
                color:'var(--teal2)', fontSize:18, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow: isPlaying ? '0 0 0 3px rgba(62,184,160,.3)' : 'none',
                transition:'all .2s' }}>
              {isPlaying ? '⏸' : '▶'}
            </button>
          )}
        </div>
        {/* Question */}
        <div style={{ textAlign:'center', width:'100%' }}>
          <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)', marginBottom:6 }}>QUESTION</div>
          <div style={{ fontSize:12, letterSpacing:1, color:'var(--gold2)', fontFamily:"'Cinzel',serif", lineHeight:1.5 }}>{q.question}</div>
        </div>
        {/* Arabic excerpt for find_ayat only — find_surah renders it internally */}
        {q.questionData && q.type !== 'find_surah' && q.type !== 'unknown_word' && q.type !== 'unknown_pick' && q.type !== 'revise_word' && q.type !== 'revise_part' && (
          <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:22, direction:'rtl',
            textAlign:'center', color:'var(--text1)', padding:'12px 16px',
            background:'var(--surface3)', borderRadius:9,
            border:'1px solid var(--border)', lineHeight:2.2, width:'100%' }}>
            {q.questionData}
          </div>
        )}
        {/* Previous result hint */}
        {lastCorrect !== null && (
          <div style={{ fontSize:8, color:lastCorrect?'var(--green)':'var(--red)', letterSpacing:1 }}>
            {lastCorrect ? '✓ Réussi la dernière fois' : '✗ Erreur la dernière fois'}
          </div>
        )}
        {/* Question type dispatch */}
        {q.type === 'first_contact' ? (
          <FirstContactQuestion
            key={q.id}
            q={q}
            onAnswer={answer}
            globalNums={globalNums}
            timestamps={timestamps}
            ayatTexts={ayatTexts}
          />
        ) : q.type === 'compare_verse' ? (
          <CompareVerseQuestion q={q} onAnswer={answer} globalNums={globalNums} />
        ) : q.type === 'find_surah' ? (
          <FindSurahQuestion q={q} surahs={surahs} onAnswer={answer} />
        ) : q.type === 'reconstruct' ? (
          <ReconstructQuestion
            q={q}
            ayatTexts={ayatTexts}
            selectedSn={qSn}
            onAnswer={answer}
          />
        ) : q.type === 'unknown_word' || q.type === 'revise_word' ? (
          <UnknownWordQuestion key={q.id} q={q} onAnswer={answer} />
        ) : q.type === 'unknown_pick' ? (
          <UnknownPickQuestion key={q.id} q={q} onAnswer={answer} />
        ) : q.type === 'revise_part' ? (
          <RevisePartQuestion key={q.id} q={q} onAnswer={answer} ayatTexts={ayatTexts} globalNums={globalNums} timestamps={timestamps} sn={qSn} />
        ) : q.type === 'page_structure' ? (
          <PageStructureQuestion key={q.id} q={q} onAnswer={answer}
            ayatTexts={ayatTexts} globalNums={globalNums}
            timestamps={timestamps} sn={qSn} />
        ) : !revealed ? (
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
        ) : (
          <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:12 }}>
            {/* Arabic text with parts + timestamps + word/part click audio */}
            <QAyatPlayer
              ayatText={ayatText}
              timestamps={timestamps?.[qSn]?.[q.ayatNum]}
              parts={ldQ?.parts}
              audioUrl={qAudioUrl}
              learnData={ldQ}
            />
            {/* Answer highlight */}
            <div style={{ padding:'12px 14px', background:'rgba(201,168,76,.07)', borderRadius:9,
              border:'1px solid var(--gold)', textAlign:'center' }}>
              <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:1.5, marginBottom:4 }}>RÉPONSE ATTENDUE</div>
              <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, color:'var(--gold2)', direction:'rtl', lineHeight:1.8 }}>{q.answer}</div>
              {q.hint && <div style={{ fontSize:9, color:'var(--text3)', marginTop:6, direction:'rtl', fontFamily:"'Amiri Quran',serif" }}>{q.hint}</div>}
            </div>

            {/* Post-reveal decision buttons */}
            {lastAutoGrade !== null ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
                <button onClick={() => answer(lastAutoGrade)}
                  style={{ width:'100%', padding:'11px', fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif",
                    background: lastAutoGrade ? 'rgba(76,175,129,.18)' : 'rgba(224,90,90,.15)',
                    border:'1px solid ' + (lastAutoGrade ? 'var(--green)' : 'var(--red)'),
                    color: lastAutoGrade ? 'var(--green)' : 'var(--red)',
                    borderRadius:8, cursor:'pointer' }}>
                  {lastAutoGrade ? '✓ ENREGISTRER COMME EXACT — SUIVANT →' : '✗ ENREGISTRER COMME INCORRECT — SUIVANT →'}
                </button>
                <div style={{ display:'flex', justifyContent:'center' }}>
                  <button onClick={() => answer(!lastAutoGrade)}
                    style={{ padding:'5px 12px', fontSize:8, letterSpacing:1, fontFamily:"'Cinzel',serif",
                      background:'transparent', border:'1px solid var(--border2)', color:'var(--text3)',
                      borderRadius:6, cursor:'pointer' }}>
                    {lastAutoGrade ? 'Changer pour : ✗ Incorrect' : 'Changer pour : ✓ Correct'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:4 }}>
                <button onClick={() => answer(false)}
                  style={{ flex:1, padding:'10px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
                    background:'rgba(224,90,90,.08)', border:'1px solid var(--red)', color:'var(--red)',
                    borderRadius:8, cursor:'pointer' }}>✗ INCORRECT</button>
                <button onClick={() => answer(true)}
                  style={{ flex:1, padding:'10px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
                    background:'rgba(76,175,129,.12)', border:'1px solid var(--green)', color:'var(--green)',
                    borderRadius:8, cursor:'pointer' }}>✓ CORRECT</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
