import { fixChars } from "../../utils/reciterAudio.js";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";
import { splitArabicWords, splitArabicChars } from "../../utils/arabicUtils.js";
import { useToRevise } from "../../utils/toRevise.js";
import { ToRevisePanel } from "../revision/ToRevisePanel.jsx";
import { MasteryBadge } from "../common/Mastery.jsx";

export function DecouverteMode({ ayat, surahNum, ld, setLData, audioUrl, timestamps }) {
  const words = ayat.text ? ayat.text.split(' ').filter(Boolean) : [];
  const [revealedUpTo, setRevealedUpTo] = React.useState(-1); // index of last revealed word
  const [markMode, setMarkMode]         = React.useState(false); // toggles 🔖 marking UI
  const [expandedWord, setExpandedWord] = React.useState(null);  // letter drill-down
  const [playingWord, setPlayingWord]   = React.useState(null);  // index currently playing
  const audioRef = React.useRef(null);
  const seqTokenRef = React.useRef(0); // cancels a stale sequential playback when superseded

  const hasToRevise = !!setLData;
  const { revise, isActive, selWords, selParts, selChars, toggleAll, toggleWord: toggleWordBase, toggleChar, togglePart } =
    useToRevise(ld, surahNum, ayat.numberInSurah, setLData);

  const parts = ld?.parts || [];

  const toggleWord = (i) => {
    const wasSelected = toggleWordBase(i);
    if (wasSelected && expandedWord === i) setExpandedWord(null);
  };

  // Play the audio segment for a single word, using forced-alignment timestamps.
  // Resolves once the word's segment has finished (or immediately if it can't play).
  const hasTs = !!timestamps?.words;
  const playWordAsync = (i, myToken) => {
    return new Promise(resolve => {
      const a = audioRef.current;
      const word = timestamps?.words?.[i];
      if (!a || !audioUrl || !word) { resolve(); return; }
      const chars = fixChars(word.chars || []);
      if (!chars.length) { resolve(); return; }
      const startMs = chars[0].start;
      const endMs   = chars[chars.length - 1].end;
      if (a.src !== audioUrl) a.src = audioUrl;
      a.currentTime = startMs / 1000;
      setPlayingWord(i);
      a.play().then(() => {
        const checkEnd = () => {
          if (!audioRef.current || seqTokenRef.current !== myToken) { resolve(); return; }
          if (audioRef.current.currentTime * 1000 >= endMs) {
            audioRef.current.pause();
            resolve();
            return;
          }
          requestAnimationFrame(checkEnd);
        };
        requestAnimationFrame(checkEnd);
      }).catch(() => resolve());
    });
  };

  // Play words fromIdx..toIdx in reading order, one after another.
  // A newer call cancels any sequence still in flight.
  const playWordsSequential = async (fromIdx, toIdx) => {
    seqTokenRef.current += 1;
    const myToken = seqTokenRef.current;
    for (let i = fromIdx; i <= toIdx; i++) {
      if (seqTokenRef.current !== myToken) return;
      await playWordAsync(i, myToken);
      if (seqTokenRef.current !== myToken) return;
    }
    setPlayingWord(null);
  };

  React.useEffect(() => () => { seqTokenRef.current += 1; audioRef.current?.pause(); }, []);

  // In RTL the first word rendered (index 0) is the rightmost → that's the first word read
  // words[0] = first word in reading order, so displayed number = i + 1
  const displayNum = (i) => i + 1;
  const isRevealed = (i) => i <= revealedUpTo;

  const revealNext = () => setRevealedUpTo(v => Math.min(v + 1, words.length - 1));
  const reset      = () => setRevealedUpTo(-1);
  const revealAll  = () => setRevealedUpTo(words.length - 1);

  const revealed   = revealedUpTo + 1;
  const hidden     = words.length - revealed;
  const allShown   = revealedUpTo >= words.length - 1;

  const gold = 'var(--gold)'; const gold2 = 'var(--gold2)';

  const summaryText = isActive
    ? typeof revise === 'object'
      ? [
          selWords.length > 0 && `${selWords.length} mot${selWords.length > 1 ? 's' : ''}`,
          Object.keys(selChars).length > 0 && `${Object.values(selChars).reduce((s, a) => s + a.length, 0)} lettre${Object.values(selChars).reduce((s, a) => s + a.length, 0) > 1 ? 's' : ''}`,
          selParts.length > 0 && `${selParts.length} partie${selParts.length > 1 ? 's' : ''}`,
        ].filter(Boolean).join(' · ') || "Tout l'ayat"
      : "Tout l'ayat"
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 16px' }}>
      <audio ref={audioRef} style={{ display: 'none' }}
        onEnded={() => setPlayingWord(null)}
        onPause={() => setPlayingWord(p => audioRef.current?.ended ? null : p)}
      />

      {/* Revision Toolbar & Controls */}
      {hasToRevise && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,.02)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, letterSpacing: 1.5, color: isActive ? gold2 : 'var(--text3)', fontFamily: "'Cinzel',serif", fontWeight: 600 }}>
                🔖 À RÉVISER
              </span>
              {isActive && (
                <span style={{ fontSize: 8, padding: '2px 8px', borderRadius: 4, background: 'rgba(201,168,76,.15)', border: `1px solid ${gold}`, color: gold2, fontFamily: "'Cinzel',serif" }}>
                  {summaryText}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Global toggle: entire ayat */}
              <button
                onClick={toggleAll}
                style={{
                  fontSize: 8, letterSpacing: 1.2, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                  fontFamily: "'Cinzel',serif", transition: 'all .2s',
                  background: isActive ? 'rgba(201,168,76,.18)' : 'transparent',
                  border: `1px solid ${isActive ? gold : 'rgba(255,255,255,.15)'}`,
                  color: isActive ? gold2 : 'var(--text3)',
                  whiteSpace: 'nowrap'
                }}
              >
                {isActive ? "✓ MARQUÉ — RETIRER" : "MARQUER TOUT L'AYAT"}
              </button>

              {/* Toggle granular word/letter mode */}
              <button
                onClick={() => { setMarkMode(v => !v); if (markMode) setExpandedWord(null); }}
                style={{
                  fontSize: 8, letterSpacing: 1.2, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                  fontFamily: "'Cinzel',serif", transition: 'all .2s',
                  background: markMode ? 'rgba(91,200,245,.18)' : 'transparent',
                  border: `1px solid ${markMode ? '#5bc8f5' : 'rgba(255,255,255,.15)'}`,
                  color: markMode ? '#5bc8f5' : 'var(--text2)',
                  whiteSpace: 'nowrap'
                }}
              >
                {markMode ? '✕ FERMER MARQUAGE' : '✏ MARQUER MOTS / LETTRES'}
              </button>
            </div>
          </div>

          {markMode && (
            <div style={{ fontSize: 8, color: 'var(--teal2)', letterSpacing: 0.5, padding: '6px 8px', background: 'rgba(62,184,160,.08)', borderRadius: 6, border: '1px solid rgba(62,184,160,.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>👆 Cliquez sur un mot pour le marquer à réviser, ou sur ▾ pour sélectionner des lettres/harakat spécifiques.</span>
            </div>
          )}
        </div>
      )}

      {/* Word display */}
      <div style={{ direction: 'rtl', fontFamily: "'Amiri Quran',serif",
        lineHeight: 2.4, textAlign: 'center', padding: '14px 12px',
        background: 'var(--surface3)', borderRadius: 10, border: '1px solid var(--border)',
        display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'flex-end' }}>
        {words.map((w, i) => {
          const rev     = isRevealed(i);
          const num     = displayNum(i);
          const marked  = selWords.includes(i);
          const charSel = selChars[i] || [];
          const hasChar = charSel.length > 0;
          const expanded= expandedWord === i;
          const playing = playingWord === i;

          const handleClick = () => {
            if (markMode) {
              if (!rev) setRevealedUpTo(Math.max(revealedUpTo, i));
              toggleWord(i);
              return;
            }
            if (!rev) {
              const fromIdx = revealedUpTo + 1; // first word newly revealed by this click
              setRevealedUpTo(i);
              if (hasTs && audioUrl) playWordsSequential(fromIdx, i);
            } else if (hasTs && audioUrl) {
              playWordsSequential(i, i);
            }
          };

          return (
            <span key={i}
              onClick={handleClick}
              style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, cursor: markMode ? 'pointer' : (hasTs && audioUrl) || !rev ? 'pointer' : 'default', userSelect: 'none' }}>
              <span style={{
                display: 'inline-block', padding: '3px 9px', borderRadius: 6,
                fontFamily: "'Amiri Quran',serif", fontSize: rev ? 22 : 20,
                color: rev ? (marked ? gold2 : playing ? 'var(--teal2)' : 'var(--text1)') : (markMode && marked ? gold2 : 'transparent'),
                background: rev ? (marked ? 'rgba(201,168,76,.18)' : playing ? 'rgba(62,184,160,.15)' : 'rgba(255,255,255,.03)') : (markMode && marked ? 'rgba(201,168,76,.1)' : 'rgba(255,255,255,.07)'),
                border: rev ? `1px solid ${marked ? gold : playing ? 'var(--teal)' : 'rgba(255,255,255,.06)'}` : (marked ? `1px solid ${gold}` : '1px solid rgba(255,255,255,.18)'),
                minWidth: rev ? 0 : 34, textAlign: 'center',
                boxShadow: marked ? '0 0 8px rgba(201,168,76,.35)' : playing ? '0 0 6px rgba(62,184,160,.35)' : 'none',
                transition: 'all .25s',
              }}>
                {rev ? w : (markMode && marked ? w : '▪▪▪')}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 7, letterSpacing: .5, lineHeight: 1,
                  color: marked ? gold2 : rev ? 'rgba(255,255,255,.18)' : 'var(--teal2)',
                  fontFamily: "'Cinzel',serif" }}>{num}</span>
                {marked && (
                  <span style={{ fontSize: 8, color: gold2 }} title="Marqué à réviser">🔖</span>
                )}
                {/* Letter drill-down toggle trigger */}
                <button
                  onClick={e => { e.stopPropagation(); if (!rev) setRevealedUpTo(Math.max(revealedUpTo, i)); setExpandedWord(expanded ? null : i); }}
                  title="Sélectionner des lettres / harakat précises"
                  style={{
                    fontSize: 7, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: 'none',
                    background: expanded ? 'rgba(91,200,245,.2)' : hasChar ? 'rgba(91,200,245,.15)' : 'rgba(255,255,255,.05)',
                    color: expanded || hasChar ? '#5bc8f5' : 'var(--text3)',
                    display: 'flex', alignItems: 'center', gap: 1
                  }}
                >
                  {hasChar ? `${charSel.length}` : ''}{expanded ? '▲' : '▾'}
                </button>
              </span>
            </span>
          );
        })}
      </div>

      {/* Inline letter picker for the expanded word */}
      {expandedWord !== null && (() => {
        const wi       = expandedWord;
        const w        = words[wi] || '';
        const clusters = splitArabicChars(w);
        const charSel  = selChars[wi] || [];
        return (
          <div style={{ direction: 'rtl', display: 'flex', flexWrap: 'wrap', gap: 4,
            padding: '10px 12px', background: 'rgba(91,200,245,.06)',
            border: '1px solid rgba(91,200,245,.25)', borderRadius: 8 }}>
            <div style={{ width: '100%', fontSize: 8, letterSpacing: 1.5, color: '#5bc8f5',
              fontFamily: "'Cinzel',serif", marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setExpandedWord(null)}
                style={{ fontSize: 7, padding: '3px 8px', borderRadius: 4,
                  background: 'transparent', border: '1px solid rgba(255,255,255,.15)',
                  color: 'var(--text3)', cursor: 'pointer', fontFamily: "'Cinzel',serif",
                  letterSpacing: 1 }}
              >
                ✕ FERMER
              </button>
              <div style={{ textAlign: 'right' }}>
                LETTRES & HARAKAT DE : <span style={{ fontFamily: "'Amiri Quran',serif", fontSize: 16, color: '#fff' }}>{w}</span>
              </div>
            </div>
            {clusters.map((c, ci) => {
              const cSel = charSel.includes(ci);
              return (
                <button key={ci} onClick={() => toggleChar(wi, ci)} style={{
                  fontFamily: "'Amiri Quran',serif", fontSize: 22,
                  padding: '4px 10px', minWidth: 36, borderRadius: 6, cursor: 'pointer',
                  background: cSel ? 'rgba(91,200,245,.25)' : 'rgba(255,255,255,.05)',
                  border: `1px solid ${cSel ? '#5bc8f5' : 'rgba(255,255,255,.12)'}`,
                  color: cSel ? '#5bc8f5' : 'var(--text1)',
                  boxShadow: cSel ? '0 0 6px rgba(91,200,245,.35)' : 'none',
                  transition: 'all .12s' }}>{c}</button>
              );
            })}
          </div>
        );
      })()}

      {/* Specific parts section (if parts exist) */}
      {parts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'rgba(200,120,255,.04)', border: '1px solid rgba(200,120,255,.15)', borderRadius: 8 }}>
          <div style={{ fontSize: 8, letterSpacing: 1.5, color: '#c878ff', fontFamily: "'Cinzel',serif" }}>
            PARTIES SPÉCIFIQUES À RÉVISER
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {parts.map((p, pi) => {
              const sel = selParts.includes(p.id);
              return (
                <button key={p.id} onClick={() => togglePart(p.id)} style={{
                  fontSize: 8, letterSpacing: 1.5, padding: '5px 12px', borderRadius: 6,
                  cursor: 'pointer', transition: 'all .15s', fontFamily: "'Cinzel',serif",
                  background: sel ? 'rgba(200,120,255,.2)' : 'rgba(255,255,255,.03)',
                  border: `1px solid ${sel ? '#c878ff' : 'rgba(255,255,255,.1)'}`,
                  color: sel ? '#c878ff' : 'var(--text2)',
                }}>
                  PARTIE {pi + 1}{sel && <span style={{ marginRight: 4 }}> ✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
          <div style={{ width: `${(revealed / words.length) * 100}%`, height: '100%',
            background: 'var(--teal)', transition: 'width .3s', borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 8, letterSpacing: 1, color: 'var(--text3)', flexShrink: 0,
          fontFamily: "'Cinzel',serif" }}>{revealed}/{words.length}</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8 }}>
        {!allShown ? (
          <button onClick={revealNext}
            style={{ flex: 1, padding: '10px', background: 'var(--teal)', border: 'none',
              borderRadius: 8, color: '#fff', fontSize: 9, letterSpacing: 2,
              fontFamily: "'Cinzel',serif", cursor: 'pointer' }}>
            ▶ SUIVANT · {hidden} MOT{hidden > 1 ? 'S' : ''}
          </button>
        ) : (
          <div style={{ flex: 1, textAlign: 'center', fontSize: 9, letterSpacing: 2,
            color: 'var(--green)', fontFamily: "'Cinzel',serif", padding: '10px' }}>✓ COMPLET</div>
        )}
        <button onClick={reset}
          style={{ padding: '10px 14px', background: 'transparent',
            border: '1px solid var(--border2)', borderRadius: 8,
            color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>↺</button>
        {!allShown && (
          <button onClick={revealAll}
            style={{ padding: '10px 14px', background: 'transparent',
              border: '1px solid var(--border2)', borderRadius: 8,
              color: 'var(--text3)', fontSize: 9, letterSpacing: 1,
              fontFamily: "'Cinzel',serif", cursor: 'pointer' }}>TOUT</button>
        )}
      </div>
    </div>
  );
}
