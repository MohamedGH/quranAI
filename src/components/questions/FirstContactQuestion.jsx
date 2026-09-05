import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getAudioBase } from '../../utils/reciterAudio.js';
import { splitArabicWords } from '../../utils/arabicUtils.js';

export function FirstContactQuestion({
  q,
  onAnswer,
  globalNums = {},
  timestamps = null,
  ayatTexts = {},
  inlineMode = false,
  onClose = null
}) {
  const sn = q.sn;
  const ayatNum = q.ayatNum;
  const globalNum = globalNums[`${sn}:${ayatNum}`];
  const audioUrl = globalNum ? `${getAudioBase()}/${globalNum}.mp3` : null;

  const rawText = q.text || ayatTexts[`${sn}:${ayatNum}`] || '';
  // Strip Bismillah if verse 1 of non-Fatihah/Tawbah
  const cleanText = useMemo(() => {
    if (ayatNum === 1 && sn !== 1 && sn !== 9 && rawText) {
      const ws = rawText.trim().split(' ');
      const stripD = s => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '');
      if (ws.length > 4 && stripD(ws[0]) === 'بسم') return ws.slice(4).join(' ');
    }
    return rawText;
  }, [ayatNum, sn, rawText]);

  const words = useMemo(() => {
    if (q.words && q.words.length > 0) return q.words;
    return splitArabicWords(cleanText).filter(Boolean);
  }, [cleanText, q.words]);

  // Step state: 1 = First word, 2 = Reconstruct, 3 = Missing word, 4 = Success/Completed
  const [step, setStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // ── Step 1: First Word Options ──────────────────────────────────────────────
  const firstWord = words[0] || '';
  const firstWordChoices = useMemo(() => {
    if (!firstWord) return [];
    // Pick 3 distractors from subsequent words or fallback list
    const otherWords = words.slice(1);
    const uniqueOthers = [...new Set(otherWords)].filter(w => w !== firstWord);
    let picked = uniqueOthers.sort(() => Math.random() - 0.5).slice(0, 3);
    if (picked.length < 3) {
      const fallbacks = ['اللهِ', 'الرَّحِيمِ', 'الَّذِينَ', 'آمَنُوا', 'عَلِيمٌ', 'حَكِيمٌ', 'إِنَّ', 'قَالَ'];
      for (const fb of fallbacks) {
        if (fb !== firstWord && !picked.includes(fb)) {
          picked.push(fb);
          if (picked.length === 3) break;
        }
      }
    }
    return [firstWord, ...picked].sort(() => Math.random() - 0.5);
  }, [firstWord, words]);

  const [selectedFirstWord, setSelectedFirstWord] = useState(null);
  const [firstWordError, setFirstWordError] = useState(false);

  const handleFirstWordSelect = (w) => {
    setSelectedFirstWord(w);
    if (w === firstWord) {
      setFirstWordError(false);
      setTimeout(() => {
        setStep(2);
      }, 700);
    } else {
      setFirstWordError(true);
      setTimeout(() => setFirstWordError(false), 1200);
    }
  };

  // ── Step 2: Reconstruct Puzzle ──────────────────────────────────────────────
  // For long verses (> 10 words), focus reconstruction on the first 8 words to keep first contact enjoyable
  const puzzleTargetWords = useMemo(() => {
    if (words.length <= 10) return words;
    return words.slice(0, 8);
  }, [words]);

  const [placedIndices, setPlacedIndices] = useState([]); // indices in puzzleTargetWords
  const [puzzlePool, setPuzzlePool] = useState([]);
  const [puzzleError, setPuzzleError] = useState(false);

  // Initialize shuffled pool
  useEffect(() => {
    const items = puzzleTargetWords.map((w, idx) => ({ id: `${idx}-${w}`, word: w, originalIndex: idx }));
    setPuzzlePool(items.sort(() => Math.random() - 0.5));
    setPlacedIndices([]);
  }, [puzzleTargetWords]);

  const handlePoolClick = (item) => {
    const expectedIndex = placedIndices.length;
    if (item.originalIndex === expectedIndex) {
      // Correct next word
      setPlacedIndices(prev => [...prev, item.originalIndex]);
      setPuzzlePool(prev => prev.filter(it => it.id !== item.id));
      setPuzzleError(false);
      if (expectedIndex + 1 === puzzleTargetWords.length) {
        setTimeout(() => {
          setStep(3);
        }, 800);
      }
    } else {
      setPuzzleError(true);
      setTimeout(() => setPuzzleError(false), 900);
    }
  };

  const handleUndoPuzzle = () => {
    if (placedIndices.length === 0) return;
    const lastIdx = placedIndices[placedIndices.length - 1];
    const restoredItem = { id: `${lastIdx}-${puzzleTargetWords[lastIdx]}`, word: puzzleTargetWords[lastIdx], originalIndex: lastIdx };
    setPlacedIndices(prev => prev.slice(0, -1));
    setPuzzlePool(prev => [...prev, restoredItem]);
  };

  const handleResetPuzzle = () => {
    const items = puzzleTargetWords.map((w, idx) => ({ id: `${idx}-${w}`, word: w, originalIndex: idx }));
    setPuzzlePool(items.sort(() => Math.random() - 0.5));
    setPlacedIndices([]);
  };

  // ── Step 3: Missing Word ───────────────────────────────────────────────────
  // Pick middle word for missing word question
  const missingIdx = useMemo(() => {
    if (words.length <= 2) return 0;
    return Math.min(Math.floor(words.length / 2), words.length - 1);
  }, [words]);

  const missingWord = words[missingIdx] || '';

  const missingWordChoices = useMemo(() => {
    if (!missingWord) return [];
    const others = [...new Set(words.filter((_, i) => i !== missingIdx))];
    let picked = others.sort(() => Math.random() - 0.5).slice(0, 3);
    if (picked.length < 3) {
      const fallbacks = ['عَلِيمٌ', 'حَكِيمٌ', 'سَمِيعٌ', 'غَفُورٌ', 'رَحِيمٌ', 'كَرِيمٌ'];
      for (const fb of fallbacks) {
        if (fb !== missingWord && !picked.includes(fb)) {
          picked.push(fb);
          if (picked.length === 3) break;
        }
      }
    }
    return [missingWord, ...picked].sort(() => Math.random() - 0.5);
  }, [missingWord, words, missingIdx]);

  const [selectedMissingWord, setSelectedMissingWord] = useState(null);
  const [missingWordError, setMissingWordError] = useState(false);

  const handleMissingWordSelect = (w) => {
    setSelectedMissingWord(w);
    if (w === missingWord) {
      setMissingWordError(false);
      setTimeout(() => {
        setStep(4);
      }, 700);
    } else {
      setMissingWordError(true);
      setTimeout(() => setMissingWordError(false), 1200);
    }
  };

  // ── Audio Toggle ───────────────────────────────────────────────────────────
  const toggleAudio = () => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      a.src = audioUrl;
      a.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: 620,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 18px',
      position: 'relative'
    }}>
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} style={{ display: 'none' }} />

      {/* Close button if inline mode */}
      {inlineMode && onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'transparent',
            border: 'none',
            color: 'var(--text3)',
            fontSize: 14,
            cursor: 'pointer'
          }}
        >✕</button>
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 9,
            letterSpacing: 1.5,
            padding: '3px 8px',
            borderRadius: 6,
            background: 'rgba(91,200,245,.15)',
            border: '1px solid rgba(91,200,245,.4)',
            color: '#5bc8f5',
            fontFamily: "'Cinzel',serif",
            fontWeight: 600
          }}>
            🌱 QUIZ PREMIER CONTACT
          </span>
          <span style={{ fontSize: 10, letterSpacing: 1, color: 'var(--text2)', fontFamily: "'Cinzel',serif" }}>
            VERSET {ayatNum}
          </span>
        </div>

        {/* Mini 3-step progress bubbles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[
            { s: 1, label: '1. Écoute' },
            { s: 2, label: '2. Ordre' },
            { s: 3, label: '3. Mot' }
          ].map(({ s, label }) => {
            const isDone = step > s || step === 4;
            const isCurrent = step === s;
            return (
              <div
                key={s}
                style={{
                  fontSize: 8,
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: 0.5,
                  padding: '2px 7px',
                  borderRadius: 12,
                  background: isDone ? 'rgba(76,175,129,.2)' : isCurrent ? 'rgba(91,200,245,.2)' : 'var(--surface3)',
                  border: `1px solid ${isDone ? 'var(--green)' : isCurrent ? '#5bc8f5' : 'var(--border2)'}`,
                  color: isDone ? 'var(--green)' : isCurrent ? '#5bc8f5' : 'var(--text3)',
                  transition: 'all .2s'
                }}
              >
                {isDone ? `✓ ${label}` : label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Audio listening bar */}
      {audioUrl && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--surface3)',
          borderRadius: 8,
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={toggleAudio}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                background: isPlaying ? 'rgba(91,200,245,.3)' : 'rgba(91,200,245,.12)',
                color: '#5bc8f5',
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all .2s'
              }}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 9, letterSpacing: 1, color: 'var(--text2)', fontFamily: "'Cinzel',serif" }}>
                {isPlaying ? 'Lecture en cours...' : 'Écouter la récitation'}
              </span>
              <span style={{ fontSize: 7, color: 'var(--text3)' }}>
                Aide auditive pour mémoriser la mélodie et le rythme
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: First Word */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--text3)', marginBottom: 4 }}>
              ÉTAPE 1 SUR 3
            </div>
            <div style={{ fontSize: 13, letterSpacing: 1, color: 'var(--gold2)', fontFamily: "'Cinzel',serif" }}>
              Quel est le premier mot de ce verset ?
            </div>
            <div style={{ fontSize: 8, color: 'var(--text3)', marginTop: 4 }}>
              Lance l'audio ci-dessus si besoin, puis sélectionne le mot qui commence l'ayat.
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
            direction: 'rtl',
            marginTop: 6
          }}>
            {firstWordChoices.map((w, idx) => {
              const isSelected = selectedFirstWord === w;
              const isCorrect = isSelected && w === firstWord;
              const isWrong = isSelected && w !== firstWord;
              return (
                <button
                  key={idx}
                  onClick={() => handleFirstWordSelect(w)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontFamily: "'Amiri Quran',serif",
                    fontSize: 22,
                    lineHeight: 1.8,
                    textAlign: 'center',
                    transition: 'all .2s',
                    background: isCorrect
                      ? 'rgba(76,175,129,.25)'
                      : isWrong
                      ? 'rgba(224,90,90,.25)'
                      : 'var(--surface3)',
                    border: `1px solid ${
                      isCorrect
                        ? 'var(--green)'
                        : isWrong
                        ? 'var(--red)'
                        : 'var(--border2)'
                    }`,
                    color: isCorrect
                      ? 'var(--green)'
                      : isWrong
                      ? 'var(--red)'
                      : 'var(--text1)',
                    boxShadow: isCorrect ? '0 0 10px rgba(76,175,129,.3)' : 'none'
                  }}
                >
                  {w}
                </button>
              );
            })}
          </div>

          {firstWordError && (
            <div style={{
              textAlign: 'center',
              fontSize: 8,
              color: 'var(--red)',
              letterSpacing: 1,
              fontFamily: "'Cinzel',serif"
            }}>
              ✗ Ce n'est pas le premier mot — réécoute attentivement l'audio !
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Reconstruct Puzzle */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--text3)', marginBottom: 4 }}>
              ÉTAPE 2 SUR 3
            </div>
            <div style={{ fontSize: 13, letterSpacing: 1, color: 'var(--gold2)', fontFamily: "'Cinzel',serif" }}>
              Reconstitue les mots dans le bon ordre
            </div>
            <div style={{ fontSize: 8, color: 'var(--text3)', marginTop: 4 }}>
              Clique sur chaque mot pour assembler le verset de droite à gauche.
            </div>
          </div>

          {/* Placed words box */}
          <div style={{
            minHeight: 64,
            padding: '12px 14px',
            background: 'var(--surface3)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            direction: 'rtl',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Amiri Quran',serif",
            fontSize: 22,
            lineHeight: 2
          }}>
            {placedIndices.length === 0 ? (
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'Cinzel',serif", direction: 'ltr' }}>
                Clique sur les mots ci-dessous dans l'ordre...
              </span>
            ) : (
              placedIndices.map((idx, i) => (
                <span
                  key={i}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(91,200,245,.15)',
                    border: '1px solid rgba(91,200,245,.3)',
                    color: 'var(--text1)'
                  }}
                >
                  {puzzleTargetWords[idx]}
                </span>
              ))
            )}
            {placedIndices.length < puzzleTargetWords.length && (
              <span style={{ color: 'var(--text3)', fontSize: 18 }}>...</span>
            )}
          </div>

          {/* Unplaced words pool */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            direction: 'rtl'
          }}>
            {puzzlePool.map((item) => (
              <button
                key={item.id}
                onClick={() => handlePoolClick(item)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: "'Amiri Quran',serif",
                  fontSize: 20,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  color: 'var(--text1)',
                  transition: 'all .15s'
                }}
              >
                {item.word}
              </button>
            ))}
          </div>

          {/* Action buttons (Undo / Reset) */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 4 }}>
            <button
              onClick={handleUndoPuzzle}
              disabled={placedIndices.length === 0}
              style={{
                fontSize: 8,
                letterSpacing: 1,
                fontFamily: "'Cinzel',serif",
                padding: '5px 12px',
                borderRadius: 6,
                background: 'transparent',
                border: '1px solid var(--border2)',
                color: placedIndices.length === 0 ? 'var(--text3)' : 'var(--text2)',
                cursor: placedIndices.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              ⌫ EFFACER LE DERNIER
            </button>
            <button
              onClick={handleResetPuzzle}
              style={{
                fontSize: 8,
                letterSpacing: 1,
                fontFamily: "'Cinzel',serif",
                padding: '5px 12px',
                borderRadius: 6,
                background: 'transparent',
                border: '1px solid var(--border2)',
                color: 'var(--text3)',
                cursor: 'pointer'
              }}
            >
              ↺ RÉINITIALISER
            </button>
          </div>

          {puzzleError && (
            <div style={{
              textAlign: 'center',
              fontSize: 8,
              color: 'var(--red)',
              letterSpacing: 1,
              fontFamily: "'Cinzel',serif"
            }}>
              ✗ Ce n'est pas le mot suivant dans l'ordre !
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Missing Word */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--text3)', marginBottom: 4 }}>
              ÉTAPE 3 SUR 3
            </div>
            <div style={{ fontSize: 13, letterSpacing: 1, color: 'var(--gold2)', fontFamily: "'Cinzel',serif" }}>
              Quel mot complète le verset ?
            </div>
            <div style={{ fontSize: 8, color: 'var(--text3)', marginTop: 4 }}>
              Repère l'espace manquant dans le verset et choisis le mot correct.
            </div>
          </div>

          {/* Verse with blank */}
          <div style={{
            padding: '14px 16px',
            background: 'var(--surface3)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            direction: 'rtl',
            textAlign: 'center',
            fontFamily: "'Amiri Quran',serif",
            fontSize: 22,
            lineHeight: 2.3
          }}>
            {words.map((w, idx) => {
              if (idx === missingIdx) {
                return (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-block',
                      margin: '0 6px',
                      padding: '2px 14px',
                      borderRadius: 6,
                      background: selectedMissingWord === missingWord
                        ? 'rgba(76,175,129,.2)'
                        : 'rgba(201,168,76,.15)',
                      border: `1px dashed ${selectedMissingWord === missingWord ? 'var(--green)' : 'var(--gold)'}`,
                      color: selectedMissingWord === missingWord ? 'var(--green)' : 'var(--gold2)'
                    }}
                  >
                    {selectedMissingWord === missingWord ? missingWord : '_____ ❓ _____'}
                  </span>
                );
              }
              return <span key={idx}> {w} </span>;
            })}
          </div>

          {/* Word choices */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
            direction: 'rtl',
            marginTop: 6
          }}>
            {missingWordChoices.map((w, idx) => {
              const isSelected = selectedMissingWord === w;
              const isCorrect = isSelected && w === missingWord;
              const isWrong = isSelected && w !== missingWord;
              return (
                <button
                  key={idx}
                  onClick={() => handleMissingWordSelect(w)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontFamily: "'Amiri Quran',serif",
                    fontSize: 22,
                    lineHeight: 1.8,
                    textAlign: 'center',
                    transition: 'all .2s',
                    background: isCorrect
                      ? 'rgba(76,175,129,.25)'
                      : isWrong
                      ? 'rgba(224,90,90,.25)'
                      : 'var(--surface3)',
                    border: `1px solid ${
                      isCorrect
                        ? 'var(--green)'
                        : isWrong
                        ? 'var(--red)'
                        : 'var(--border2)'
                    }`,
                    color: isCorrect
                      ? 'var(--green)'
                      : isWrong
                      ? 'var(--red)'
                      : 'var(--text1)'
                  }}
                >
                  {w}
                </button>
              );
            })}
          </div>

          {missingWordError && (
            <div style={{
              textAlign: 'center',
              fontSize: 8,
              color: 'var(--red)',
              letterSpacing: 1,
              fontFamily: "'Cinzel',serif"
            }}>
              ✗ Mot incorrect pour cet emplacement — réessaie !
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Success Celebration */}
      {step === 4 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '10px 0',
          textAlign: 'center'
        }}>
          <div style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: 'rgba(76,175,129,.18)',
            border: '2px solid var(--green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            color: 'var(--green)'
          }}>
            ✓
          </div>

          <div>
            <div style={{ fontSize: 13, letterSpacing: 2, color: 'var(--green)', fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
              PREMIER CONTACT RÉUSSI !
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>
              Tu as complété avec succès les 3 étapes de découverte pour ce verset.
            </div>
          </div>

          {/* Full verse displayed */}
          <div style={{
            padding: '14px 18px',
            background: 'var(--surface3)',
            borderRadius: 8,
            border: '1px solid rgba(76,175,129,.3)',
            direction: 'rtl',
            fontFamily: "'Amiri Quran',serif",
            fontSize: 23,
            lineHeight: 2.3,
            color: 'var(--text1)',
            width: '100%'
          }}>
            {cleanText}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {audioUrl && (
              <button
                onClick={toggleAudio}
                style={{
                  padding: '9px 16px',
                  fontSize: 8,
                  letterSpacing: 1,
                  fontFamily: "'Cinzel',serif",
                  background: 'transparent',
                  border: '1px solid var(--border2)',
                  color: 'var(--text2)',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                {isPlaying ? '⏸ PAUSE' : '▶ RÉÉCOUTER'}
              </button>
            )}

            <button
              onClick={() => {
                setStep(1);
                setSelectedFirstWord(null);
                setSelectedMissingWord(null);
                setPlacedIndices([]);
              }}
              style={{
                padding: '9px 16px',
                fontSize: 8,
                letterSpacing: 1,
                fontFamily: "'Cinzel',serif",
                background: 'transparent',
                border: '1px solid var(--border2)',
                color: 'var(--text3)',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              ↺ REFAIRE
            </button>

            <button
              onClick={() => onAnswer(true)}
              style={{
                padding: '10px 24px',
                fontSize: 9,
                letterSpacing: 2,
                fontFamily: "'Cinzel',serif",
                background: 'rgba(76,175,129,.2)',
                border: '1px solid var(--green)',
                color: 'var(--green)',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              VALIDER & CONTINUER →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
