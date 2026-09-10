import { fixChars } from "../../utils/reciterAudio.js";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { safeGetItem, safeSetItem } from "../../utils/safeStorage.js";

export function PartAudioPlayer({
  part,
  pi = 0,
  allParts = [],
  words = [],
  timestamps,
  audioUrl,
  autoPlay,
  hideText,
  chainMode: propChainMode,
  onSetChainMode,
}) {
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(true);
  const [currentMs, setCurrentMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);

  // Boosted word state: index of word in ayat (wi)
  const [boostedWordIndex, setBoostedWordIndex] = useState(null);
  const boostedWordRef = useRef(null);
  useEffect(() => {
    boostedWordRef.current = boostedWordIndex;
  }, [boostedWordIndex]);

  // Chain mode: "none" | "prev" | "all"
  const [internalChainMode, setInternalChainMode] = useState(() => safeGetItem("quran_part_chain_mode", "none"));
  const chainMode = propChainMode !== undefined ? propChainMode : internalChainMode;
  const updateChainMode = (mode) => {
    if (onSetChainMode) onSetChainMode(mode);
    setInternalChainMode(mode);
    safeSetItem("quran_part_chain_mode", mode);
  };

  // Currently playing segment in queue
  const [activeSegment, setActiveSegment] = useState(null);
  const queueRef = useRef([]);
  const segIndexRef = useRef(0);
  const loopingRef = useRef(looping);
  useEffect(() => {
    loopingRef.current = looping;
  }, [looping]);

  // Update audio duration when metadata loads
  const handleLoadedMetadata = useCallback((e) => {
    const dur = e.currentTarget.duration;
    if (dur && !isNaN(dur) && dur > 0) {
      setAudioDurationMs(Math.round(dur * 1000));
    }
  }, []);

  // Compute word indices for this part
  const partWordIndices = useMemo(() => {
    if (Array.isArray(part?.wordIndices) && part.wordIndices.length > 0) {
      return [...part.wordIndices].sort((a, b) => a - b);
    }
    if (part?.text && words?.length) {
      const pWords = part.text.trim().split(/\s+/).filter(Boolean);
      const sIdx = words.findIndex((w, i) =>
        pWords.every((pw, off) => words[i + off] && (words[i + off] === pw || words[i + off].includes(pw) || pw.includes(words[i + off])))
      );
      if (sIdx !== -1) {
        return pWords.map((_, off) => sIdx + off);
      }
    }
    return words.map((_, i) => i);
  }, [part, words]);

  // Proportional Arabic letter weight calculator (stripping diacritics)
  const getProportionalRange = useCallback((firstIdx, lastIdx, durMs) => {
    if (!words || !words.length || !durMs) return null;
    const cleanLen = (w) => (w || "").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").length || 1;
    const weights = words.map(cleanLen);
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

    const clampedFirst = Math.max(0, Math.min(words.length - 1, firstIdx));
    const clampedLast = Math.max(clampedFirst, Math.min(words.length - 1, lastIdx));

    const startWeight = weights.slice(0, clampedFirst).reduce((a, b) => a + b, 0);
    const endWeight = weights.slice(0, clampedLast + 1).reduce((a, b) => a + b, 0);

    const startMs = Math.round((startWeight / totalWeight) * durMs);
    const endMs = Math.min(durMs, Math.round((endWeight / totalWeight) * durMs));
    return { startMs, endMs: Math.max(startMs + 150, endMs) };
  }, [words]);

  // Calculate startMs and endMs for ANY part
  const getPartRange = useCallback((p, fallbackDurationMs) => {
    if (!p) return null;

    // 1. Explicit startMs / endMs on the part
    if (typeof p.startMs === 'number' && typeof p.endMs === 'number' && p.endMs > p.startMs) {
      return { startMs: Math.round(p.startMs), endMs: Math.round(p.endMs) };
    }

    // Determine word indices
    let idxs = Array.isArray(p.wordIndices) ? p.wordIndices : [];
    if (!idxs.length && p.text && words?.length) {
      const pWords = p.text.trim().split(/\s+/).filter(Boolean);
      const sIdx = words.findIndex((w, i) =>
        pWords.every((pw, off) => words[i + off] && (words[i + off] === pw || words[i + off].includes(pw) || pw.includes(words[i + off])))
      );
      if (sIdx !== -1) {
        idxs = pWords.map((_, off) => sIdx + off);
      }
    }
    if (!idxs.length) {
      idxs = words.map((_, i) => i);
    }

    const sorted = [...idxs].sort((a, b) => a - b);
    const firstIdx = Math.max(0, Math.min((words?.length || 1) - 1, sorted[0]));
    const lastIdx = Math.max(firstIdx, Math.min((words?.length || 1) - 1, sorted[sorted.length - 1]));

    // 2. Exact alignment timestamps if available
    if (timestamps?.words?.length) {
      const tsWords = timestamps.words;
      const firstW = tsWords[firstIdx];
      const lastW = tsWords[lastIdx];
      if (firstW && lastW) {
        const sMs = firstW.chars?.[0]?.start ?? firstW.start ?? null;
        const eMs = lastW.chars?.[lastW.chars.length - 1]?.end ?? lastW.end ?? null;
        if (sMs != null && eMs != null && eMs > sMs) {
          return { startMs: Math.round(sMs), endMs: Math.round(eMs) };
        }
      }
    }

    // 3. Proportional timing based on Arabic character weights and audio duration
    const totalMs = fallbackDurationMs || audioDurationMs || (audioRef.current?.duration ? Math.round(audioRef.current.duration * 1000) : 0) || ((words?.length || 4) * 600);
    return getProportionalRange(firstIdx, lastIdx, totalMs);
  }, [timestamps, words, audioDurationMs, getProportionalRange]);

  // Calculate timing for a specific word
  const getWordRange = useCallback((wi, fallbackDurationMs) => {
    if (timestamps?.words?.[wi]) {
      const tw = timestamps.words[wi];
      const s = tw.chars?.[0]?.start ?? tw.start ?? null;
      const e = tw.chars?.[tw.chars.length - 1]?.end ?? tw.end ?? null;
      if (s != null && e != null && e > s) {
        return { startMs: Math.round(s), endMs: Math.round(e) };
      }
    }
    const totalMs = fallbackDurationMs || audioDurationMs || (audioRef.current?.duration ? Math.round(audioRef.current.duration * 1000) : 0) || ((words?.length || 4) * 600);
    return getProportionalRange(wi, wi, totalMs);
  }, [timestamps, audioDurationMs, words, getProportionalRange]);

  const timeRange = useMemo(() => {
    return getPartRange(part);
  }, [getPartRange, part]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.volume = 1.0;
    }
    setPlaying(false);
    setActiveSegment(null);
    stopRaf();
  }, [stopRaf]);

  // Build segments to play based on chainMode
  const buildSegments = useCallback((mode, fallbackDurationMs) => {
    const tRange = getPartRange(part, fallbackDurationMs);
    if (!tRange) return [];

    const targetSegment = {
      type: "target",
      index: pi,
      label: `Partie ${pi + 1}`,
      part,
      range: tRange,
    };

    if (pi === 0 || !allParts?.length || mode === "none") {
      return [targetSegment];
    }

    if (mode === "prev") {
      const prevP = allParts[pi - 1];
      const prevRange = prevP ? getPartRange(prevP, fallbackDurationMs) : null;
      if (prevRange) {
        return [
          { type: "prev", index: pi - 1, label: `Partie ${pi} (précédente)`, part: prevP, range: prevRange },
          targetSegment,
        ];
      }
      return [targetSegment];
    }

    if (mode === "all") {
      const segs = [];
      for (let i = 0; i < pi; i++) {
        const p = allParts[i];
        const r = p ? getPartRange(p, fallbackDurationMs) : null;
        if (r) {
          segs.push({
            type: "prev",
            index: i,
            label: `Partie ${i + 1}`,
            part: p,
            range: r,
          });
        }
      }
      return [...segs, targetSegment];
    }

    return [targetSegment];
  }, [part, pi, allParts, getPartRange]);

  // Master play function
  const play = useCallback((isLoop = looping, fromMs = null) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Determine current audio duration
    let durMs = audioDurationMs;
    if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
      durMs = Math.round(audio.duration * 1000);
      setAudioDurationMs(durMs);
    } else if (!durMs) {
      durMs = (words?.length || 4) * 600;
    }

    const segments = buildSegments(chainMode, durMs);
    if (!segments || !segments.length) return;

    queueRef.current = segments;

    let initialSegIdx = 0;
    let startAtMs = segments[0].range.startMs;
    if (fromMs != null) {
      const foundIdx = segments.findIndex(s => fromMs >= s.range.startMs && fromMs <= s.range.endMs);
      if (foundIdx !== -1) {
        initialSegIdx = foundIdx;
        startAtMs = fromMs;
      }
    }

    segIndexRef.current = initialSegIdx;
    const curSeg = segments[initialSegIdx];
    setActiveSegment(curSeg);

    audio.currentTime = Math.max(0, startAtMs / 1000);
    audio.volume = 1.0;
    audio.play().catch(() => {});
    setPlaying(true);
    stopRaf();

    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      const ms = a.currentTime * 1000;
      setCurrentMs(ms);

      const q = queueRef.current;
      const curIdx = segIndexRef.current;
      const seg = q[curIdx];
      if (!seg) {
        stop();
        return;
      }

      // ─── Sound Volume Modulation ───
      // When playing target part: if a word is boosted, amplify its volume
      const bIdx = boostedWordRef.current;
      if (seg.type === "target" && bIdx != null) {
        const wRange = getWordRange(bIdx, durMs);
        if (wRange) {
          const isInside = (ms >= wRange.startMs && ms <= wRange.endMs);
          const targetVol = isInside ? 1.0 : 0.35;
          a.volume += (targetVol - a.volume) * 0.45;
        }
      } else {
        a.volume += (1.0 - a.volume) * 0.45;
      }

      // ─── Strict Segment Boundary Check ───
      if (ms >= seg.range.endMs - 15) {
        const nextIdx = curIdx + 1;
        if (nextIdx < q.length) {
          // Advance to next segment (e.g. from previous part to current part)
          segIndexRef.current = nextIdx;
          const nextSeg = q[nextIdx];
          setActiveSegment(nextSeg);
          a.currentTime = Math.max(0, nextSeg.range.startMs / 1000);
          rafRef.current = requestAnimationFrame(tick);
        } else {
          // Reached end of the entire chain!
          if (loopingRef.current) {
            segIndexRef.current = 0;
            const firstSeg = q[0];
            setActiveSegment(firstSeg);
            a.currentTime = Math.max(0, firstSeg.range.startMs / 1000);
            rafRef.current = requestAnimationFrame(tick);
          } else {
            stop();
          }
        }
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [buildSegments, chainMode, looping, audioDurationMs, words, getWordRange, stop, stopRaf]);

  // Click on a word: play it solo and toggle amplification (+ volume)
  const handleWordClick = useCallback((wi) => {
    const audio = audioRef.current;
    if (!audio) return;

    let durMs = audioDurationMs;
    if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
      durMs = Math.round(audio.duration * 1000);
      setAudioDurationMs(durMs);
    } else if (!durMs) {
      durMs = (words?.length || 4) * 600;
    }

    const wRange = getWordRange(wi, durMs);
    if (!wRange) return;

    const isAlreadyBoosted = (boostedWordIndex === wi);
    const newBoosted = isAlreadyBoosted ? null : wi;
    setBoostedWordIndex(newBoosted);
    boostedWordRef.current = newBoosted;

    // Play word solo
    stopRaf();
    audio.pause();
    audio.volume = 1.0;
    audio.currentTime = Math.max(0, wRange.startMs / 1000);

    const soloSeg = {
      type: "solo-word",
      label: `Mot : « ${words[wi] || ""} »`,
      range: wRange,
    };
    queueRef.current = [soloSeg];
    segIndexRef.current = 0;
    setActiveSegment(soloSeg);
    setPlaying(true);
    audio.play().catch(() => {});

    const tickSolo = () => {
      const a = audioRef.current;
      if (!a) return;
      const ms = a.currentTime * 1000;
      setCurrentMs(ms);

      if (ms >= wRange.endMs - 15) {
        stop();
      } else {
        rafRef.current = requestAnimationFrame(tickSolo);
      }
    };
    rafRef.current = requestAnimationFrame(tickSolo);
  }, [audioDurationMs, words, getWordRange, boostedWordIndex, stop, stopRaf]);

  // Restart or rebuild chain if chainMode changes while playing
  useEffect(() => {
    if (playing) {
      stop();
      const t = setTimeout(() => {
        play(looping);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [chainMode]);

  // Auto-play trigger
  useEffect(() => {
    if (autoPlay) {
      const t = setTimeout(() => play(true), 200);
      return () => clearTimeout(t);
    }
  }, [autoPlay]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRaf();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [stopRaf]);

  const durationMs = timeRange ? Math.max(100, timeRange.endMs - timeRange.startMs) : (audioDurationMs || 3000);
  const progress = (durationMs > 0 && timeRange)
    ? Math.min(1, Math.max(0, (currentMs - timeRange.startMs) / durationMs))
    : (audioDurationMs > 0 ? Math.min(1, Math.max(0, currentMs / audioDurationMs)) : 0);

  const hasPreviousParts = allParts?.length > 1 && pi > 0;

  return (
    <div>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        style={{ display: "none" }}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => { if (!looping) stop(); }}
      />

      <div className="part-player-card">
        {/* Row 1: Controls & Enchaînement */}
        <div className="part-player-controls">
          <div className="part-player-controls-left">
            {/* Play/Stop */}
            <button
              type="button"
              className={`part-player-btn ${playing ? "stop" : "play"}`}
              onClick={() => playing ? stop() : play(looping)}
              title={playing ? "Arrêter la lecture" : "Lire cette partie"}
            >
              {playing ? "⏹" : "▶"}
            </button>

            {/* Loop */}
            <button
              type="button"
              className={`part-player-btn ${looping ? "loop-on" : "loop-off"}`}
              onClick={() => {
                const nl = !looping;
                setLooping(nl);
                loopingRef.current = nl;
                if (playing) { stop(); setTimeout(() => play(nl), 40); }
              }}
              title={looping ? "Boucle activée" : "Activer la boucle"}
            >
              🔁
            </button>

            {/* Duration badge */}
            <span className="part-player-dur">
              {timeRange
                ? `${((timeRange.endMs - timeRange.startMs) / 1000).toFixed(1)}s`
                : `${(durationMs / 1000).toFixed(1)}s`}
            </span>
          </div>

          {/* Enchaînement toggles */}
          {hasPreviousParts && (
            <div className="part-player-chain-group">
              <button
                type="button"
                className={`part-chain-btn ${chainMode === "none" ? "active-none" : ""}`}
                onClick={() => updateChainMode("none")}
                title="Lire uniquement cette partie sans pré-écoute"
              >
                SEULE
              </button>
              <button
                type="button"
                className={`part-chain-btn ${chainMode === "prev" ? "active-prev" : ""}`}
                onClick={() => updateChainMode(chainMode === "prev" ? "none" : "prev")}
                title="Jouer la partie précédente puis cette partie"
              >
                ⏮ {chainMode === "prev" ? "✓ + PRÉC." : "+ PRÉC."}
              </button>
              <button
                type="button"
                className={`part-chain-btn ${chainMode === "all" ? "active-all" : ""}`}
                onClick={() => updateChainMode(chainMode === "all" ? "none" : "all")}
                title="Jouer toutes les parties précédentes puis cette partie"
              >
                ⏮ {chainMode === "all" ? "✓ + TOUTES" : "+ TOUTES"}
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Arabic text with full responsive width */}
        <div
          className="part-player-chars"
          style={hideText ? { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', opacity: 0.35 } : {}}
        >
          {partWordIndices.map((wi, ii) => {
            const wordStr = words[wi] || (timestamps?.words?.[wi]?.chars ? timestamps.words[wi].chars.map(c => c.char).join('') : '');
            const isBoosted = boostedWordIndex === wi;
            const wRange = getWordRange(wi);
            const isWordActive = (activeSegment?.type === "target" || activeSegment?.type === "solo-word")
              && playing && wRange && currentMs >= wRange.startMs && currentMs <= wRange.endMs;
            const isWordDone = playing && wRange && currentMs > wRange.endMs;

            return (
              <span
                key={wi}
                onClick={() => handleWordClick(wi)}
                className={`part-word-span${isBoosted ? " word-boosted" : ""}${isWordActive ? " word-active" : ""}${isWordDone ? " word-done" : ""}`}
                title={
                  isBoosted
                    ? "🔊 Son amplifié actif pour ce mot (cliquez pour retirer)"
                    : "🔊 Cliquez pour écouter ce mot et l'amplifier (+ de son) lors de la lecture de la partie"
                }
              >
                {isBoosted && <span className="word-boost-icon">🔊</span>}
                {wordStr}
                {ii < partWordIndices.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>

        {/* Row 3: Progress bar */}
        {playing && (
          <div className="part-player-progress">
            <div className="part-player-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        {/* Row 4: Status banner */}
        {(activeSegment?.type === "prev" || boostedWordIndex != null) && (
          <div className="part-player-banner" style={{
            background: activeSegment?.type === "prev" ? "rgba(62,184,160,0.12)" : "rgba(255,209,102,0.1)",
            border: `1px solid ${activeSegment?.type === "prev" ? "rgba(62,184,160,0.35)" : "rgba(255,209,102,0.3)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {activeSegment?.type === "prev" && (
                <span style={{ color: "var(--teal2)" }}>
                  ⏮ PRÉ-ÉCOUTE : {activeSegment.label} en cours → puis Partie {pi + 1}
                </span>
              )}
              {boostedWordIndex != null && (
                <span style={{ color: "var(--gold2)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  🔊 MOT ACCENTUÉ (+ VOLUME) : « {words[boostedWordIndex]} »
                </span>
              )}
            </div>
            {boostedWordIndex != null && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setBoostedWordIndex(null); }}
                title="Retirer l'amplification de ce mot"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text3)",
                  cursor: "pointer",
                  fontSize: 11,
                  padding: "2px 6px",
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
