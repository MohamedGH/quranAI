import { normalizeArabic } from "../../utils/recitationDiff.js";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { fixChars } from "../../utils/reciterAudio.js";

export function QAyatPlayer({ ayatText, timestamps, parts, audioUrl, learnData }) {
  const [currentMs,  setCurrentMs]  = React.useState(0);
  const [isPlaying,  setIsPlaying]  = React.useState(false);
  const [rangeEnd,   setRangeEnd]   = React.useState(null);  // ms — null = play to end
  const [rangeStart, setRangeStart] = React.useState(null);
  const audioRef = React.useRef(null);
  const rafRef   = React.useRef(null);
  const containerRef = React.useRef(null);

  const PART_COLORS  = ["rgba(201,168,76,.22)","rgba(62,184,160,.18)","rgba(111,207,154,.18)","rgba(224,90,90,.15)","rgba(200,120,255,.15)"];
  const PART_BORDERS = ["var(--gold)","var(--teal)","var(--green)","var(--red)","#c878ff"];

  // RAF loop — updates char highlight via DOM
  const startRaf = () => {
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      const ms = a.currentTime * 1000;
      setCurrentMs(ms);
      // Apply highlight via DOM
      if (containerRef.current && timestamps?.words) {
        const spans = containerRef.current.querySelectorAll('.char-span');
        let si = 0;
        timestamps.words.forEach(word => {
          const chars = fixChars(word.chars || []);
          chars.forEach(c => {
            if (si < spans.length) {
              const active = ms >= c.start && ms <= c.end;
              const done   = ms > c.end && ms > 0 && (rangeStart == null || c.end > rangeStart);
              const el = spans[si];
              if (active) { el.classList.add('char-active'); el.classList.remove('char-done'); }
              else if (done) { el.classList.add('char-done'); el.classList.remove('char-active'); }
              else { el.classList.remove('char-active','char-done'); }
              si++;
            }
          });
        });
      }
      // Stop at range end
      if (rangeEnd !== null && ms >= rangeEnd) {
        a.pause();
        setIsPlaying(false);
        setRangeEnd(null);
        setRangeStart(null);
        cancelAnimationFrame(rafRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  const stopRaf = () => { cancelAnimationFrame(rafRef.current); };

  // Clear highlight
  const clearHighlight = () => {
    if (containerRef.current) {
      containerRef.current.querySelectorAll('.char-span').forEach(el => {
        el.classList.remove('char-active','char-done');
      });
    }
  };

  React.useEffect(() => () => { stopRaf(); audioRef.current?.pause(); }, []);

  // Play from a specific time, with optional end time
  const playFrom = (startMs, endMs = null) => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    if (a.src !== audioUrl) a.src = audioUrl;
    a.currentTime = startMs / 1000;
    setRangeEnd(endMs);
    setRangeStart(startMs);
    a.play().then(() => { setIsPlaying(true); startRaf(); }).catch(() => {});
  };

  const toggleFull = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause(); setIsPlaying(false); stopRaf();
    } else {
      playFrom(0, null);
    }
  };

  // Click a word → play from that word's start to word's end
  const onWordClick = (wi) => {
    if (!timestamps?.words?.[wi]) return;
    const word = timestamps.words[wi];
    const chars = fixChars(word.chars || []);
    if (!chars.length) return;
    const startMs = chars[0].start;
    const endMs   = chars[chars.length - 1].end;
    playFrom(startMs, endMs);
  };

  // Click a part → play its word range
  const onPartClick = (part) => {
    if (!timestamps?.words || !part.wordIndices?.length) return;
    const firstW = timestamps.words[part.wordIndices[0]];
    const lastW  = timestamps.words[part.wordIndices[part.wordIndices.length - 1]];
    if (!firstW || !lastW) return;
    const firstChars = fixChars(firstW.chars || []);
    const lastChars  = fixChars(lastW.chars || []);
    if (!firstChars.length || !lastChars.length) return;
    playFrom(firstChars[0].start, lastChars[lastChars.length - 1].end);
  };

  // Build word-to-part map
  const wordPartMap = {};
  (parts || []).forEach((p, pi) => p.wordIndices?.forEach(wi => { wordPartMap[wi] = pi; }));

  const hasTs = !!timestamps?.words;
  const hasParts = (parts || []).length > 0;

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
      <audio ref={audioRef} style={{ display:'none' }}
        onEnded={() => { setIsPlaying(false); setRangeEnd(null); setRangeStart(null); stopRaf(); clearHighlight(); }}
        onPause={() => { if (!audioRef.current?.ended) { setIsPlaying(false); stopRaf(); } }}
      />

      {/* Arabic text + optional play button */}
      <div style={{ padding:'12px 14px', background:'var(--surface3)', borderRadius:10,
        border:'1px solid var(--border2)', direction:'rtl', textAlign:'right',
        position:'relative' }}>
        {/* Play/pause full ayat */}
        {audioUrl && (
          <button onClick={toggleFull}
            style={{ position:'absolute', top:8, left:8, width:30, height:30, borderRadius:'50%',
              border:'none', background: isPlaying && rangeEnd === null ? 'rgba(62,184,160,.3)' : 'rgba(62,184,160,.1)',
              color:'var(--teal2)', fontSize:13, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow: isPlaying && rangeEnd === null ? '0 0 0 2px rgba(62,184,160,.4)' : 'none',
              transition:'all .2s', zIndex:1 }}>
            {isPlaying && rangeEnd === null ? '⏸' : '▶'}
          </button>
        )}
        {/* Clickable words or plain text */}
        {hasTs ? (
          <div className="ayat-arabic" ref={containerRef}>
            {timestamps.words.map((word, wi) => {
              const pi = wordPartMap[wi];
              const part = pi !== undefined ? (parts || [])[pi] : null;
              const chars = fixChars(word.chars || []);
              const isActivePart = isPlaying && rangeStart !== null && part &&
                chars.length > 0 && rangeStart <= chars[0].start;
              const bg     = part ? PART_COLORS[pi % PART_COLORS.length]  : 'transparent';
              const border = part ? `1px solid ${PART_BORDERS[pi % PART_BORDERS.length]}` : 'none';
              return (
                <span key={wi}
                  onClick={() => audioUrl && onWordClick(wi)}
                  style={{
                    background: isActivePart ? 'rgba(62,184,160,.28)' : bg,
                    border, borderRadius: part ? 5 : 0,
                    padding: part ? '1px 4px' : 0,
                    margin: part ? '1px' : 0,
                    cursor: audioUrl ? 'pointer' : 'default',
                    display:'inline',
                    transition:'background .15s',
                  }}>
                  {chars.map((c, ci) => (
                    <span key={ci} className="char-span">{c.char}</span>
                  ))}
                  {wi < timestamps.words.length - 1 ? ' ' : ''}
                </span>
              );
            })}
          </div>
        ) : (
          <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, color:'var(--text)', lineHeight:2 }}>
            {ayatText}
          </span>
        )}
      </div>

      {/* Parts as clickable chips */}
      {hasParts && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, direction:'rtl' }}>
          {(parts || []).map((part, pi) => (
            <button key={part.id ?? pi}
              onClick={() => audioUrl ? onPartClick(part) : null}
              style={{ fontFamily:"'Amiri Quran',serif", fontSize:15,
                padding:'4px 10px', borderRadius:7,
                background: PART_COLORS[pi % PART_COLORS.length],
                border:`1px solid ${PART_BORDERS[pi % PART_BORDERS.length]}`,
                color:'var(--text)', cursor: audioUrl ? 'pointer' : 'default',
                direction:'rtl', transition:'all .15s',
                boxShadow: isPlaying && rangeStart !== null ? '0 0 0 2px rgba(62,184,160,.3)' : 'none',
              }}>
              {part.text || (part.wordIndices?.map(i => timestamps?.words?.[i]?.chars?.map(c=>c.char).join('')).join(' '))}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Split Arabic text into words, separating attached prefix particles (و ف ب ل)
// so وَٱللَّهُ → ['وَ', 'ٱللَّهُ'] matching the space-split form from quran-simple
function splitArabicWords(text) {
  if (!text) return [];

  const PREFIXES = [
    { p: 'و', alefOnly: false },
    { p: 'ف', alefOnly: false },
    { p: 'ل', alefOnly: false },
    { p: 'ب', alefOnly: true  },
  ];
  const ALEF_VARIANTS = new Set(['ا','أ','إ','آ','ٱ','\u0671','\u0622','\u0623','\u0625']);

  // Zero-width / invisible joiners that should NOT cause word breaks
  const ZW_RE = /[\u2060\uFEFF\u200B\u200C\u200D]/;
  const ZW_STRIP = /[\u2060\uFEFF\u200B\u200C\u200D]/g;

  // Step 1: split on whitespace, then merge tokens around ZW chars
  const rawTokens = text.trim().split(/[ \t\n\r\u00A0\u202F\u2009]+/).filter(t => t.length > 0);

  const merged = [];
  let i = 0;
  while (i < rawTokens.length) {
    const raw = rawTokens[i];
    const tok = raw.replace(ZW_STRIP, '');
    if (!tok) {
      // Purely ZW token → merge previous and next
      if (merged.length > 0 && i + 1 < rawTokens.length) {
        merged[merged.length - 1] += rawTokens[i + 1].replace(ZW_STRIP, '');
        i += 2; continue;
      }
    } else if (ZW_RE.test(raw)) {
      // Token contains ZW (at start, end, or middle)
      // If ZW is at the end, merge with next token
      if (/[\u2060\uFEFF\u200B\u200C\u200D]$/.test(raw) && i + 1 < rawTokens.length) {
        merged.push(tok + rawTokens[i + 1].replace(ZW_STRIP, ''));
        i += 2; continue;
      }
      // If ZW is at the start, merge into previous token
      if (/^[\u2060\uFEFF\u200B\u200C\u200D]/.test(raw) && merged.length > 0) {
        merged[merged.length - 1] += tok;
      } else {
        merged.push(tok);
      }
    } else {
      merged.push(tok);
    }
    i++;
  }

  // Also merge any token that is purely diacritics/starts with dagger alif into the previous token,
  // AND merge any token with only 1 Arabic consonant (incomplete word, e.g. فَ split by newline) with the next
  const COMBINING = /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0870-\u08FF]+$/;
  const STARTS_COMBINING = /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/; // starts with diacritic/dagger alif
  const ARABIC_CONS = /[\u0600-\u063F\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06D5\u06EE-\u06EF\u06FA-\u06FC\u06FF]/g;
  const isSingleConsonant = (tok) => (tok.match(ARABIC_CONS) || []).length === 1;

  const cleaned = [];
  for (let j = 0; j < merged.length; j++) {
    const tok = merged[j];
    if (cleaned.length > 0 && (COMBINING.test(tok) || STARTS_COMBINING.test(tok))) {
      // Token is purely diacritics OR starts with dagger alif — belongs to previous word
      cleaned[cleaned.length - 1] += tok;
    } else if (isSingleConsonant(tok) && j + 1 < merged.length) {
      // Single consonant token (e.g. فَ from فَضۡلِ split by newline): merge with next
      merged[j + 1] = tok + merged[j + 1];
    } else {
      cleaned.push(tok);
    }
  }

  // Step 3: prefix splitting
  const result = [];
  cleaned.forEach(token => {
    const norm = normalizeArabic(token);
    let split = false;
    for (const { p, alefOnly } of PREFIXES) {
      const rest = norm.slice(p.length);
      if (norm.startsWith(p) && norm.length > 2 && (!alefOnly || ALEF_VARIANTS.has(rest[0]))) {
        let i = 0;
        const originalChars = [...token];
        let letterCount = 0;
        while (i < originalChars.length) {
          const cp = originalChars[i].codePointAt(0);
          const isDiacritic = (cp >= 0x064B && cp <= 0x065F) || cp === 0x0670 || (cp >= 0x0610 && cp <= 0x061A) ||
                              (cp >= 0x06D6 && cp <= 0x06ED) || (cp >= 0x0870 && cp <= 0x08FF);
          if (!isDiacritic) letterCount++;
          i++;
          if (letterCount === 1) {
            while (i < originalChars.length) {
              const cp2 = originalChars[i].codePointAt(0);
              const isDia2 = (cp2 >= 0x064B && cp2 <= 0x065F) || cp2 === 0x0670 || (cp2 >= 0x0610 && cp2 <= 0x061A) ||
                             (cp2 >= 0x06D6 && cp2 <= 0x06ED) || (cp2 >= 0x0870 && cp2 <= 0x08FF);
              if (!isDia2) break;
              i++;
            }
            break;
          }
        }
        if (i < originalChars.length) {
          result.push(originalChars.slice(0, i).join(''));
          result.push(originalChars.slice(i).join(''));
          split = true;
          break;
        }
      }
    }
    if (!split) result.push(token);
  });
  return result;
}
