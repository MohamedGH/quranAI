import React, { useMemo, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";
import { fixChars } from "../../utils/reciterAudio.js";
import {
  isQalqala,
  getMaddType,
  isIzhar,
  isIdgham,
  isIqlab,
  isIkhfa,
  isGhunnah,
  isTafkhim,
  isTarqiq,
  getTajweedStyleForChar,
  getActiveTajweedColors,
} from "../../utils/tajweedRules.js";

// ─── PlayingArabicHighlighted — zero-rerender highlight via DOM refs ─────────
// Renders chars once, then updates active/done classes via direct RAF + DOM refs only.
export const PlayingArabicHighlighted = React.memo(function PlayingArabicHighlighted({
  text, timestamps, mode, playingPart, ld, showQalqala, showMadd, showIzhar, showIdgham, showTajweedTone,
  palette, customColors, colors
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

  // Direct DOM highlight loop driven by RAF + events — zero React re-renders, zero Redux overhead
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

    const getCurMs = () => {
      if (mode === 'main') {
        const audio = window.__quranMainAudio;
        return audio ? audio.currentTime * 1000 : 0;
      } else if (mode === 'part') {
        const audio = window.__quranPartAudio;
        return audio ? audio.currentTime * 1000 : 0;
      } else {
        const audio = window.__quranLocalAudio;
        return audio ? audio.currentTime * 1000 : (window.__quranLocalMs ?? 0);
      }
    };

    const updateDomClasses = (curMs) => {
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
    };

    const tick = () => {
      const curMs = getCurMs();
      if (Math.abs(curMs - lastMs) >= 12) {
        lastMs = curMs;
        updateDomClasses(curMs);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    // Event-based immediate sync for mobile wake/focus/timeupdate
    const handleSync = () => {
      const curMs = getCurMs();
      lastMs = curMs;
      updateDomClasses(curMs);
    };

    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('pageshow', handleSync);
    window.addEventListener('focus', handleSync);

    const targetAudio = mode === 'main' ? window.__quranMainAudio : mode === 'part' ? window.__quranPartAudio : window.__quranLocalAudio;
    if (targetAudio) {
      targetAudio.addEventListener('timeupdate', handleSync);
      targetAudio.addEventListener('seeked', handleSync);
      targetAudio.addEventListener('play', handleSync);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('pageshow', handleSync);
      window.removeEventListener('focus', handleSync);
      if (targetAudio) {
        targetAudio.removeEventListener('timeupdate', handleSync);
        targetAudio.removeEventListener('seeked', handleSync);
        targetAudio.removeEventListener('play', handleSync);
      }
      if (containerRef.current) {
        const spans = containerRef.current.querySelectorAll('.char-span');
        spans.forEach(s => s.classList.remove('char-active', 'char-done'));
      }
    };
  }, [mode, timestamps, ld, playingPart]);

  // Render static chars (no active/done — DOM handles it)
  return (
    <ArabicHighlighted
      ref={containerRef}
      text={text}
      timestamps={timestamps}
      currentMs={-1}
      showQalqala={showQalqala}
      showMadd={showMadd}
      showIzhar={showIzhar}
      showIdgham={showIdgham}
      showTajweedTone={showTajweedTone}
      palette={palette}
      customColors={customColors}
      colors={colors}
    />
  );
});

export const ArabicHighlighted = React.memo(React.forwardRef(function ArabicHighlighted({
  text, timestamps, currentMs, rangeStartMs, showQalqala, showMadd, showIzhar, showIdgham, showTajweedTone,
  palette, customColors, colors
}, ref) {
  let storePalette = "classic";
  let storeCustomColors = {};
  try {
    storePalette = useSelector(sel.tajweedPalette) || "classic";
    storeCustomColors = useSelector(sel.tajweedCustomColors) || {};
  } catch {
    // Fallback if rendered outside Provider
  }

  const activePalette = palette || storePalette;
  const activeCustom = customColors || storeCustomColors;
  const activeColors = colors || getActiveTajweedColors(activePalette, activeCustom);

  const hasTajweed = showQalqala || showMadd || showIzhar || showIdgham || showTajweedTone;

  // Pre-compute tajweed styles and fixed chars once per text/timestamps+tajweed change
  // We reconstruct the full sequence across all words so cross-word rules (Idgham, Madd Munfasil) are accurately detected.
  const wordData = useMemo(() => {
    let wordsWithChars = [];

    if (timestamps?.words && timestamps.words.length > 0) {
      wordsWithChars = timestamps.words.map(w => fixChars(w.chars || []));
    } else if (text) {
      const rawWords = text.split(' ');
      wordsWithChars = rawWords.map(w => [...w].map(ch => ({ char: ch, start: 0, end: 0 })));
    } else {
      return [];
    }

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

    const tajweedOptions = {
      showQalqala,
      showMadd,
      showIzhar,
      showIdgham,
      showTajweedTone,
      colors: activeColors,
    };

    return wordsWithChars.map((chars, wi) => {
      return chars.map((c, ci) => {
        const fullIdx = wordCharMap[wi]?.[ci] ?? -1;
        if (fullIdx === -1) return { char: c.char, start: c.start, end: c.end, tajStyle: undefined };

        const tajStyle = hasTajweed ? getTajweedStyleForChar(fullChars, fullIdx, tajweedOptions) || undefined : undefined;

        return { char: c.char, start: c.start, end: c.end, tajStyle };
      });
    });
  }, [text, timestamps, showQalqala, showMadd, showIzhar, showIdgham, showTajweedTone, hasTajweed, activeColors]);

  if (!wordData || wordData.length === 0) {
    return <div className="ayat-arabic" ref={ref}>{text}</div>;
  }

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
}));
