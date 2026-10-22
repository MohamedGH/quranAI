import { fixChars } from "../../utils/reciterAudio.js";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";
import { splitArabicWords, splitArabicChars } from "../../utils/arabicUtils.js";
import { useToRevise } from "../../utils/toRevise.js";
import { ToRevisePanel } from "../revision/ToRevisePanel.jsx";
import { MasteryBadge } from "../common/Mastery.jsx";
import { FirstContactQuestion } from "../questions/FirstContactQuestion.jsx";
import {
  extractAyatTajweedTimestamps,
  speakTajweedAnnouncement,
  stopTajweedSpeech
} from "../../utils/tajweedAudioCoach.js";
import { getReviseTimeColor, getWordReviseDate } from "../../utils/reviseColorGradient.js";

export function DecouverteMode({ ayat, surahNum, ld, setLData, audioUrl, timestamps }) {
  const words = ayat.text ? ayat.text.split(' ').filter(Boolean) : [];
  const [revealedUpTo, setRevealedUpTo] = React.useState(-1); // index of last revealed word
  const [markMode, setMarkMode]         = React.useState(false); // toggles 🔖 marking UI
  const [expandedWord, setExpandedWord] = React.useState(null);  // letter drill-down
  const [playingWord, setPlayingWord]   = React.useState(null);  // index currently playing
  const [showQuiz, setShowQuiz]         = React.useState(false); // inline first contact quiz
  const audioRef = React.useRef(null);
  const seqTokenRef = React.useRef(0); // cancels a stale sequential playback when superseded

  // Extract all Tajweed rules present in this ayat
  const tajweedRules = React.useMemo(() => {
    return extractAyatTajweedTimestamps(ayat?.text || "", timestamps);
  }, [ayat?.text, timestamps]);

  const [showTajweedRules, setShowTajweedRules] = React.useState(true);
  const [activeTajweedId, setActiveTajweedId]   = React.useState(null);

  // Group rules by word index for inline word badges
  const wordTajweedMap = React.useMemo(() => {
    const map = {};
    tajweedRules.forEach(r => {
      if (r.wordIdx != null) {
        if (!map[r.wordIdx]) map[r.wordIdx] = [];
        map[r.wordIdx].push(r);
      }
    });
    return map;
  }, [tajweedRules]);

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

  React.useEffect(() => () => { seqTokenRef.current += 1; audioRef.current?.pause(); stopTajweedSpeech(); }, []);

  // In RTL the first word rendered (index 0) is the rightmost → that's the first word read
  // words[0] = first word in reading order, so displayed number = i + 1
  const displayNum = (i) => i + 1;
  const isRevealed = (i) => i <= revealedUpTo;

  const revealNext = () => {
    const nextIdx = Math.min(revealedUpTo + 1, words.length - 1);
    setRevealedUpTo(nextIdx);
    if (wordTajweedMap[nextIdx]?.length > 0) {
      setActiveTajweedId(wordTajweedMap[nextIdx][0].id);
    }
    if (hasTs && audioUrl) {
      playWordsSequential(nextIdx, nextIdx);
    }
  };
  const reset      = () => {
    setRevealedUpTo(-1);
    setActiveTajweedId(null);
  };
  const revealAll  = () => setRevealedUpTo(words.length - 1);

  // Render word with authentic Tajweed styling on the concerned letters
  const renderWordWithTajweed = (wordText, wordIdx) => {
    const rules = wordTajweedMap[wordIdx];
    if (!rules || rules.length === 0) return wordText;

    const chars = [...wordText];
    return chars.map((ch, cIdx) => {
      const match = rules.find(r => {
        const targetBare = r.char ? r.char.replace(/[ً-ّْٟ]/g, "") : "";
        const matchedBare = r.matchedWith ? r.matchedWith.replace(/[ً-ّْٟ]/g, "") : "";
        return (targetBare && ch === targetBare) || (matchedBare && ch === matchedBare) || (r.ruleId === 'iqlab' && ch === "ۢ");
      });

      if (match) {
        const color = match.color || '#fbbf24';
        const isThisRuleActive = activeTajweedId === match.id;
        return (
          <span
            key={cIdx}
            title={`${match.ruleNameFr} (${match.char}${match.matchedWith ? ` ➔ ${match.matchedWith}` : ''})`}
            style={{
              color: color,
              fontWeight: 800,
              textShadow: isThisRuleActive ? `0 0 8px ${color}` : `0 0 3px ${color}66`,
              borderBottom: `2px solid ${color}`,
              borderRadius: 2,
              padding: '0 1px',
              backgroundColor: isThisRuleActive ? `${color}33` : 'transparent',
              transition: 'all .2s'
            }}
          >
            {ch}
          </span>
        );
      }
      return <span key={cIdx}>{ch}</span>;
    });
  };

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

      {/* Tajweed Rules Summary Banner in Découverte Mode (if any) */}
      {tajweedRules.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          background: 'rgba(251, 191, 36, 0.05)',
          border: '1px solid rgba(251, 191, 36, 0.22)',
          borderRadius: 8,
          padding: '8px 12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, letterSpacing: 1.2, color: '#fbbf24', fontFamily: "'Cinzel',serif", fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span>☪</span>
              <span>TAJWID ({tajweedRules.length}) :</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              {tajweedRules.map(r => {
                const isSelected = activeTajweedId === r.id;
                const rColor = r.color || '#fbbf24';
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setActiveTajweedId(r.id);
                      setShowTajweedRules(true);
                      if (r.wordIdx != null) {
                        setRevealedUpTo(Math.max(revealedUpTo, r.wordIdx));
                        if (hasTs && audioUrl) playWordsSequential(r.wordIdx, r.wordIdx);
                      }
                      stopTajweedSpeech();
                      speakTajweedAnnouncement(r, 'fr', true);
                    }}
                    style={{
                      fontSize: 8,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: isSelected ? `${rColor}35` : `${rColor}15`,
                      border: `1px solid ${isSelected ? rColor : `${rColor}55`}`,
                      color: rColor,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: isSelected ? `0 0 8px ${rColor}55` : 'none',
                      transition: 'all .2s'
                    }}
                    title={`Cliquer pour écouter la règle et le mot : ${r.ruleNameFr} (${r.char}${r.matchedWith ? ` ➔ ${r.matchedWith}` : ''})`}
                  >
                    <span style={{ fontFamily: "'Amiri Quran',serif", fontSize: 13, lineHeight: 1 }}>{r.char}{r.matchedWith ? ` ➔ ${r.matchedWith}` : ''}</span>
                    <span>·</span>
                    <span>{r.ruleNameFr}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTajweedRules(v => !v)}
            style={{
              fontSize: 7.5,
              letterSpacing: 1,
              padding: '3px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Cinzel',serif",
              background: showTajweedRules ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
              border: '1px solid rgba(251, 191, 36, 0.35)',
              color: '#fbbf24',
              whiteSpace: 'nowrap'
            }}
          >
            {showTajweedRules ? '▲ MASQUER DÉTAILS' : '▼ VOIR DÉTAILS TAJWID'}
          </button>
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
          const isWordTajweedActive = wordTajweedMap[i]?.some(r => r.id === activeTajweedId);

          const handleClick = () => {
            if (markMode) {
              if (!rev) setRevealedUpTo(Math.max(revealedUpTo, i));
              toggleWord(i);
              return;
            }
            if (!rev) {
              const fromIdx = revealedUpTo + 1; // first word newly revealed by this click
              setRevealedUpTo(i);
              if (wordTajweedMap[i]?.length > 0) {
                setActiveTajweedId(wordTajweedMap[i][0].id);
              }
              if (hasTs && audioUrl) playWordsSequential(fromIdx, i);
            } else if (hasTs && audioUrl) {
              if (wordTajweedMap[i]?.length > 0) {
                setActiveTajweedId(wordTajweedMap[i][0].id);
              }
              playWordsSequential(i, i);
            }
          };

          const wDate = marked ? getWordReviseDate(ld, i) : null;
          const timeColor = marked ? getReviseTimeColor(wDate) : null;
          const markedColor = timeColor ? timeColor.hex : gold2;
          const markedBg = timeColor ? timeColor.rgbaBg : 'rgba(201,168,76,.18)';
          const markedBorder = timeColor ? timeColor.rgbaBorder : gold;
          const markedGlow = timeColor ? timeColor.rgbaGlow : '0 0 8px rgba(201,168,76,.35)';

          return (
            <span key={i}
              onClick={handleClick}
              title={marked ? `À réviser depuis : ${timeColor?.timeLabel || 'récent'} (${timeColor?.days || 0}j)` : undefined}
              style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, cursor: markMode ? 'pointer' : (hasTs && audioUrl) || !rev ? 'pointer' : 'default', userSelect: 'none' }}>
              <span style={{
                display: 'inline-block', padding: '3px 9px', borderRadius: 6,
                fontFamily: "'Amiri Quran',serif", fontSize: rev ? 22 : 20,
                color: rev ? (marked ? markedColor : playing ? 'var(--teal2)' : 'var(--text1)') : (markMode && marked ? markedColor : 'transparent'),
                background: rev
                  ? (marked ? markedBg : playing ? 'rgba(62,184,160,.15)' : isWordTajweedActive ? 'rgba(251,191,36,.12)' : 'rgba(255,255,255,.03)')
                  : (markMode && marked ? markedBg : 'rgba(255,255,255,.07)'),
                border: rev
                  ? isWordTajweedActive
                    ? `2px solid ${wordTajweedMap[i][0].color || '#fbbf24'}`
                    : marked
                    ? `1px solid ${markedBorder}`
                    : `1px solid ${playing ? 'var(--teal)' : 'rgba(255,255,255,.06)'}`
                  : (marked ? `1px solid ${markedBorder}` : '1px solid rgba(255,255,255,.18)'),
                minWidth: rev ? 0 : 34, textAlign: 'center',
                boxShadow: isWordTajweedActive
                  ? `0 0 10px ${wordTajweedMap[i][0].color || '#fbbf24'}88`
                  : marked
                  ? markedGlow
                  : playing
                  ? '0 0 6px rgba(62,184,160,.35)'
                  : 'none',
                transition: 'all .25s',
              }}>
                {rev ? renderWordWithTajweed(w, i) : (markMode && marked ? renderWordWithTajweed(w, i) : '▪▪▪')}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ fontSize: 7, letterSpacing: .5, lineHeight: 1,
                  color: marked ? gold2 : rev ? 'rgba(255,255,255,.18)' : 'var(--teal2)',
                  fontFamily: "'Cinzel',serif" }}>{num}</span>
                {marked && (
                  <span style={{ fontSize: 8, color: gold2 }} title="Marqué à réviser">🔖</span>
                )}
                {/* Tajweed rule badge if present on this word */}
                {wordTajweedMap[i] && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTajweedRules(true);
                      const rule = wordTajweedMap[i][0];
                      setActiveTajweedId(rule.id);
                      if (!rev) setRevealedUpTo(Math.max(revealedUpTo, i));
                      if (hasTs && audioUrl) playWordsSequential(i, i);
                      stopTajweedSpeech();
                      speakTajweedAnnouncement(rule, 'fr', true);
                    }}
                    title={`Règle de Tajwid : ${wordTajweedMap[i].map(r => `${r.ruleNameFr} (${r.char}${r.matchedWith ? ` ➔ ${r.matchedWith}` : ''})`).join(', ')} — Cliquer pour écouter l'explication et le mot`}
                    style={{
                      fontSize: 7.5,
                      padding: '2px 5px',
                      borderRadius: 4,
                      background: isWordTajweedActive
                        ? `${wordTajweedMap[i][0].color || '#fbbf24'}35`
                        : `${wordTajweedMap[i][0].color || '#fbbf24'}20`,
                      color: wordTajweedMap[i][0].color || '#fbbf24',
                      border: `1px solid ${isWordTajweedActive ? (wordTajweedMap[i][0].color || '#fbbf24') : `${wordTajweedMap[i][0].color || '#fbbf24'}66`}`,
                      fontWeight: 700,
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      boxShadow: isWordTajweedActive ? `0 0 8px ${wordTajweedMap[i][0].color || '#fbbf24'}66` : 'none',
                      transition: 'all .2s'
                    }}
                  >
                    <span>☪</span>
                    <span>{wordTajweedMap[i].map(r => r.ruleNameFr).join(', ')}</span>
                  </span>
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
                {wordTajweedMap[wi] && (
                  <span style={{ marginRight: 8, fontSize: 9, color: wordTajweedMap[wi][0].color || '#fbbf24', fontWeight: 700 }}>
                    · ☪ {wordTajweedMap[wi].map(r => `${r.ruleNameFr} (${r.char})`).join(', ')}
                  </span>
                )}
              </div>
            </div>
            {clusters.map((c, ci) => {
              const cSel = charSel.includes(ci);
              const tajweedMatch = wordTajweedMap[wi]?.find(r => {
                const targetBare = r.char ? r.char.replace(/[ً-ّْٟ]/g, "") : "";
                const matchedBare = r.matchedWith ? r.matchedWith.replace(/[ً-ّْٟ]/g, "") : "";
                return (targetBare && c.includes(targetBare)) || (matchedBare && c.includes(matchedBare)) || c.includes("ۢ");
              });
              const tColor = tajweedMatch?.color || '#fbbf24';

              return (
                <div key={ci} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <button onClick={() => toggleChar(wi, ci)} style={{
                    fontFamily: "'Amiri Quran',serif", fontSize: 22,
                    padding: '4px 10px', minWidth: 36, borderRadius: 6, cursor: 'pointer',
                    background: cSel ? 'rgba(91,200,245,.25)' : tajweedMatch ? `${tColor}18` : 'rgba(255,255,255,.05)',
                    border: `1px solid ${cSel ? '#5bc8f5' : tajweedMatch ? tColor : 'rgba(255,255,255,.12)'}`,
                    color: cSel ? '#5bc8f5' : tajweedMatch ? tColor : 'var(--text1)',
                    boxShadow: cSel ? '0 0 6px rgba(91,200,245,.35)' : tajweedMatch ? `0 0 6px ${tColor}44` : 'none',
                    fontWeight: tajweedMatch ? 700 : 400,
                    transition: 'all .12s' }}>{c}</button>
                  {tajweedMatch && (
                    <span style={{ fontSize: 6.5, color: tColor, fontWeight: 700, lineHeight: 1 }} title={tajweedMatch.ruleNameFr}>
                      ☪ {tajweedMatch.ruleNameFr}
                    </span>
                  )}
                </div>
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

      {/* Tajweed Rules Section in Découverte Mode */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        marginTop: 2
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#fbbf24' }}>☪</span>
            <span style={{ fontSize: 9, letterSpacing: 1.5, color: '#fbbf24', fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
              RÈGLES DE TAJWID DU VERSET
            </span>
            <span style={{
              fontSize: 8,
              padding: '2px 8px',
              borderRadius: 12,
              background: tajweedRules.length > 0 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.06)',
              color: tajweedRules.length > 0 ? '#fbbf24' : 'var(--text3)',
              fontWeight: 700
            }}>
              {tajweedRules.length > 0 ? `${tajweedRules.length} règle${tajweedRules.length > 1 ? 's' : ''}` : '0 règle'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowTajweedRules(v => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text3)',
              fontSize: 10,
              cursor: 'pointer',
              padding: '2px 6px',
              fontWeight: 600
            }}
          >
            {showTajweedRules ? '▲ MASQUER' : '▼ AFFICHER'}
          </button>
        </div>

        {showTajweedRules && (
          tajweedRules.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
              {tajweedRules.map((rule) => {
                const isSelected = activeTajweedId === rule.id;
                const color = rule.color || '#fbbf24';
                return (
                  <div
                    key={rule.id}
                    style={{
                      background: isSelected ? `${color}18` : 'rgba(15, 23, 42, 0.6)',
                      border: `1px solid ${isSelected ? color : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      transition: 'all .2s'
                    }}
                  >
                    {/* Header: Letter Badge + Rule Name */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            minWidth: 26,
                            height: 26,
                            borderRadius: 6,
                            background: `${color}25`,
                            color: color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: "'Amiri Quran', serif",
                            fontSize: 16,
                            fontWeight: 700,
                            border: `1px solid ${color}66`,
                            padding: '0 4px'
                          }}
                        >
                          {rule.char}{rule.matchedWith ? ` ➔ ${rule.matchedWith}` : ''}
                        </span>
                        <div>
                          <strong style={{ fontSize: 12, color: 'var(--text, #f8fafc)' }}>
                            {rule.ruleNameFr}
                          </strong>
                          <span style={{ fontSize: 11, color: color, fontFamily: "'Amiri Quran', serif", marginRight: 4, marginLeft: 4 }}>
                            ({rule.ruleNameAr})
                          </span>
                        </div>
                      </div>

                      {rule.wordIdx != null && (
                        <span style={{ fontSize: 8.5, color: 'var(--text3, #94a3b8)', fontFamily: "'Cinzel', serif" }}>
                          Mot #{rule.wordIdx + 1}
                        </span>
                      )}
                    </div>

                    {/* Letter info */}
                    <div style={{ fontSize: 11, color: 'var(--text2, #cbd5e1)' }}>
                      Lettre : <strong style={{ color: color }}>{rule.letterNameFr}</strong> ({rule.char})
                      {rule.matchedWith && (
                        <span> devant <strong style={{ color: color }}>{rule.matchedLetterNameFr || rule.matchedWith}</strong></span>
                      )}
                    </div>

                    {/* Word in Arabic with letter highlighted */}
                    {rule.wordText && (
                      <div style={{
                        direction: 'rtl',
                        fontFamily: "'Amiri Quran', serif",
                        fontSize: 17,
                        color: 'var(--text, #f8fafc)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        padding: '2px 8px',
                        borderRadius: 6,
                        textAlign: 'center',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                      }}>
                        {[...rule.wordText].map((ch, idx) => {
                          const targetBare = rule.char ? rule.char.replace(/[ً-ّْٟ]/g, "") : "";
                          const matchedBare = rule.matchedWith ? rule.matchedWith.replace(/[ً-ّْٟ]/g, "") : "";
                          const isMatch = (targetBare && ch === targetBare) || (matchedBare && ch === matchedBare) || ch === "ۢ";
                          return (
                            <span
                              key={idx}
                              style={{
                                color: isMatch ? color : 'inherit',
                                fontWeight: isMatch ? 800 : 400,
                                backgroundColor: isMatch ? `${color}33` : 'transparent',
                                borderRadius: isMatch ? 3 : 0,
                                padding: isMatch ? '0 2px' : 0
                              }}
                            >
                              {ch}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Description */}
                    {(rule.ruleDescFr || rule.descFr) && (
                      <div style={{ fontSize: 10, color: 'var(--text3, #94a3b8)', lineHeight: 1.35 }}>
                        {rule.ruleDescFr || rule.descFr}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      {rule.wordIdx != null && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTajweedId(rule.id);
                            setRevealedUpTo(Math.max(revealedUpTo, rule.wordIdx));
                            if (hasTs && audioUrl) playWordsSequential(rule.wordIdx, rule.wordIdx);
                          }}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: 'var(--text2, #cbd5e1)',
                            fontSize: 9,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4
                          }}
                          title="Révéler et écouter le mot"
                        >
                          <span>▶</span>
                          <span>Écouter le mot</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTajweedId(rule.id);
                          stopTajweedSpeech();
                          speakTajweedAnnouncement(rule, 'fr', true);
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: `${color}25`,
                          border: `1px solid ${color}88`,
                          color: color,
                          fontSize: 9,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title="Écouter l'explication vocale de la règle"
                      >
                        <span>🎙</span>
                        <span>Énoncé</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text3, #94a3b8)', padding: '6px 4px' }}>
              Aucune règle majeure de Tajwid particulière détectée sur ce verset (récitation standard fluide).
            </div>
          )
        )}
      </div>

      {/* Quiz Premier Contact Button & Drawer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        <button
          onClick={() => setShowQuiz(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 8,
            border: showQuiz ? '1px solid #5bc8f5' : '1px solid rgba(91,200,245,.35)',
            background: showQuiz ? 'rgba(91,200,245,.18)' : 'rgba(91,200,245,.08)',
            color: '#5bc8f5',
            fontFamily: "'Cinzel',serif",
            fontSize: 9,
            letterSpacing: 1.5,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all .2s'
          }}
        >
          <span>🌱 {showQuiz ? 'MASQUER LE QUIZ PREMIER CONTACT' : 'TESTER AVEC LE QUIZ PREMIER CONTACT'}</span>
          <span style={{ fontSize: 11 }}>{showQuiz ? '▲' : '▼'}</span>
        </button>

        {showQuiz && (
          <div style={{ marginTop: 6 }}>
            <FirstContactQuestion
              q={{
                sn: surahNum,
                ayatNum: ayat.numberInSurah,
                text: ayat.text,
                words
              }}
              globalNums={{ [`${surahNum}:${ayat.numberInSurah}`]: ayat.number }}
              ayatTexts={{ [`${surahNum}:${ayat.numberInSurah}`]: ayat.text }}
              inlineMode={true}
              onClose={() => setShowQuiz(false)}
              onAnswer={(correct) => {
                if (correct && setLData) {
                  setLData(surahNum, ayat.numberInSurah, {
                    firstContact: true,
                    firstContactDate: new Date().toISOString(),
                    readCount: Math.max(1, (ld?.readCount || 0) + 1)
                  });
                }
                setShowQuiz(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
