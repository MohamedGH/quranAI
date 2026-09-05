import React, { useMemo, useRef, useEffect } from "react";
import { fixChars } from "../../utils/reciterAudio.js";
import { isQalqala, getMaddType, isIzhar, isIdgham, isIqlab, isIkhfa, isGhunnah } from "../../utils/tajweedRules.js";

// ─── PlayingArabicHighlighted — zero-rerender highlight via DOM refs ─────────
// Renders chars once, then updates active/done classes via direct RAF + DOM refs only.
export const PlayingArabicHighlighted = React.memo(function PlayingArabicHighlighted({
  text, timestamps, mode, playingPart, ld, showQalqala, showMadd, showIzhar, showIdgham
}) {
  const containerRef  = useRef(null);
  const charDataRef   = useRef(null); // flat array of {start,end,el}

  // Build flat char metadata once per timestamps change
  const charData = useMemo(() => {
    if (!timestamps?.words) return null;
    const flat = [];
    timestamps.words.forEach(word => {
      const chars = fixChars(word.chars || []);
      chars.forEach(c => flat.push({ start: c.start, end: c.end }));
    });
    return flat;
  }, [timestamps]);

  charDataRef.current = charData;

  // Direct DOM highlight loop driven by RAF — zero React re-renders, zero Redux overhead
  useEffect(() => {
    const flat = charDataRef.current;
    if (!flat || !containerRef.current) return;

    let rangeStartMs = null;
    if (mode === 'part') {
      const activePart = (ld?.parts || []).find(p => p.id === playingPart?.partId);
      const firstWordIdx = activePart?.wordIndices?.[0];
      rangeStartMs = firstWordIdx != null ? timestamps?.words?.[firstWordIdx]?.chars?.[0]?.start : null;
    }

    let rafId = null;
    let lastMs = -1;

    const tick = () => {
      let curMs = 0;
      if (mode === 'main') {
        const audio = window.__quranMainAudio;
        curMs = audio ? audio.currentTime * 1000 : 0;
      } else if (mode === 'part') {
        const audio = window.__quranPartAudio;
        curMs = audio ? audio.currentTime * 1000 : 0;
      } else {
        const audio = window.__quranLocalAudio;
        curMs = audio ? audio.currentTime * 1000 : (window.__quranLocalMs ?? 0);
      }

      // Only perform DOM class updates if playback time moved significantly
      if (Math.abs(curMs - lastMs) >= 12) {
        lastMs = curMs;
        const spans = containerRef.current ? containerRef.current.querySelectorAll('.char-span') : null;
        if (spans && spans.length === flat.length) {
          for (let i = 0; i < flat.length; i++) {
            const { start, end } = flat[i];
            const active = curMs >= start && curMs <= end;
            const done   = curMs > end && curMs > 0 && (rangeStartMs == null || end > rangeStartMs);
            const el = spans[i];
            if (active) {
              if (!el.classList.contains('char-active')) {
                el.classList.add('char-active');
                el.classList.remove('char-done');
              }
            } else if (done) {
              if (!el.classList.contains('char-done')) {
                el.classList.add('char-done');
                el.classList.remove('char-active');
              }
            } else {
              if (el.classList.contains('char-active') || el.classList.contains('char-done')) {
                el.classList.remove('char-active', 'char-done');
              }
            }
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (containerRef.current) {
        const spans = containerRef.current.querySelectorAll('.char-span');
        spans.forEach(s => s.classList.remove('char-active', 'char-done'));
      }
    };
  }, [mode, timestamps, ld, playingPart]);

  // Render static chars (no active/done — DOM handles it)
  return <ArabicHighlighted ref={containerRef} text={text} timestamps={timestamps}
    currentMs={-1} showQalqala={showQalqala} showMadd={showMadd}
    showIzhar={showIzhar} showIdgham={showIdgham} />;
}, (prev, next) =>
  prev.text === next.text &&
  prev.timestamps === next.timestamps &&
  prev.mode === next.mode &&
  prev.showQalqala === next.showQalqala &&
  prev.showMadd === next.showMadd &&
  prev.showIzhar === next.showIzhar &&
  prev.showIdgham === next.showIdgham);

export const ArabicHighlighted = React.memo(React.forwardRef(function ArabicHighlighted({
  text, timestamps, currentMs, rangeStartMs, showQalqala, showMadd, showIzhar, showIdgham
}, ref) {
  if (!timestamps?.words) return <div className="ayat-arabic">{text}</div>;

  // Pre-compute tajweed styles and fixed chars once per timestamps+tajweed change
  // We reconstruct the full sequence across all words so cross-word rules (Idgham, Madd Munfasil) are accurately detected.
  const wordData = useMemo(() => {
    if (!timestamps?.words) return [];

    const wordsWithChars = timestamps.words.map(w => fixChars(w.chars || []));
    const fullChars = [];
    const wordCharMap = []; // [wordIdx][charIdx] => index in fullChars

    wordsWithChars.forEach((chars, wi) => {
      wordCharMap[wi] = [];
      chars.forEach((c, ci) => {
        wordCharMap[wi][ci] = fullChars.length;
        fullChars.push(c.char);
      });
      if (wi < wordsWithChars.length - 1) {
        fullChars.push(' ');
      }
    });

    return wordsWithChars.map((chars, wi) => {
      return chars.map((c, ci) => {
        const fullIdx = wordCharMap[wi]?.[ci] ?? -1;
        if (fullIdx === -1) return { char: c.char, start: c.start, end: c.end };

        const isQalqalaOn = showQalqala && isQalqala(fullChars, fullIdx);
        const maddType    = showMadd ? getMaddType(fullChars, fullIdx) : null;
        const izharOn     = showIzhar && isIzhar(fullChars, fullIdx);
        const idghamOn    = showIdgham && isIdgham(fullChars, fullIdx);
        const iqlabOn     = (showIzhar || showIdgham) && isIqlab(fullChars, fullIdx);
        const ikhfaOn     = (showIzhar || showIdgham) && isIkhfa(fullChars, fullIdx);
        const ghunnahOn   = isGhunnah(fullChars, fullIdx);

        let tajStyle = undefined;
        if (isQalqalaOn) {
          tajStyle = { color: '#38bdf8', textShadow: '0 0 6px rgba(56,189,248,.55)', fontWeight: 600 };
        } else if (maddType === 'madd_lazim') {
          tajStyle = { color: '#e11d48', textShadow: '0 0 8px rgba(225,29,72,.6)', fontWeight: 700 };
        } else if (maddType === 'madd_muttasil') {
          tajStyle = { color: '#f43f5e', textShadow: '0 0 8px rgba(244,63,94,.6)', fontWeight: 600 };
        } else if (maddType === 'madd_munfasil') {
          tajStyle = { color: '#fb923c', textShadow: '0 0 6px rgba(251,146,60,.5)', fontWeight: 600 };
        } else if (maddType === 'madd' || maddType === 'normal') {
          tajStyle = { color: '#eab308', textShadow: '0 0 6px rgba(234,179,8,.5)' };
        } else if (izharOn) {
          tajStyle = { color: '#34d399', textShadow: '0 0 6px rgba(52,211,153,.55)', fontWeight: 600 };
        } else if (idghamOn) {
          tajStyle = { color: '#fbbf24', textShadow: '0 0 6px rgba(251,191,36,.55)', fontWeight: 600 };
        } else if (iqlabOn) {
          tajStyle = { color: '#2dd4bf', textShadow: '0 0 6px rgba(45,212,191,.55)', fontWeight: 600 };
        } else if (ikhfaOn) {
          tajStyle = { color: '#c084fc', textShadow: '0 0 6px rgba(192,132,252,.55)', fontWeight: 600 };
        } else if (ghunnahOn && (showIzhar || showIdgham)) {
          tajStyle = { color: '#10b981', textShadow: '0 0 6px rgba(16,185,129,.55)' };
        }

        return { char: c.char, start: c.start, end: c.end, tajStyle };
      });
    });
  }, [timestamps, showQalqala, showMadd, showIzhar, showIdgham]);

  // Static render — no active/done classes here (DOM updates them for playing mode)
  return (
    <div className="ayat-arabic" ref={ref}>
      {wordData.map((chars, wi) => (
        <span key={wi}>
          {chars.map((c, ci) => (
            <span key={ci} className="char-span" style={c.tajStyle}>{c.char}</span>
          ))}
          {wi < wordData.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );
}), (prev, next) =>
  prev.text === next.text &&
  prev.timestamps === next.timestamps &&
  prev.currentMs === next.currentMs &&
  prev.showQalqala === next.showQalqala &&
  prev.showMadd === next.showMadd &&
  prev.showIzhar === next.showIzhar &&
  prev.showIdgham === next.showIdgham);
