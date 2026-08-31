import { fixChars } from "../../utils/reciterAudio.js";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ArabicHighlighted } from "../common/ArabicHighlighted.jsx";

export function PartAudioPlayer({ part, words, timestamps, audioUrl, autoPlay, hideText }) {
  const audioRef   = useRef(null);
  const rafRef     = useRef(null);
  const [playing, setPlaying]     = useState(false);
  const [looping, setLooping]     = useState(true);
  const [currentMs, setCurrentMs] = useState(0);

  const timeRange = useMemo(() => {
    if (!timestamps?.words || !part.wordIndices?.length) return null;
    const tsWords = timestamps.words;
    const idx     = part.wordIndices;
    const first   = tsWords[idx[0]];
    const last    = tsWords[idx[idx.length - 1]];
    if (!first || !last) return null;
    const startMs = first.chars?.[0]?.start ?? null;
    const endMs   = last.chars?.[last.chars.length - 1]?.end ?? null;
    if (startMs == null || endMs == null) return null;
    return { startMs, endMs };
  }, [timestamps, part.wordIndices]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setCurrentMs(0);
    stopRaf();
  }, [stopRaf]);

  const play = useCallback((loop, fromMs) => {
    const audio = audioRef.current;
    if (!audio || !timeRange) return;
    const startAt = fromMs ?? timeRange.startMs;
    audio.currentTime = startAt / 1000;
    audio.play().catch(() => {});
    setPlaying(true);
    stopRaf();
    const tick = () => {
      if (!audioRef.current) return;
      const ms = audioRef.current.currentTime * 1000;
      setCurrentMs(ms);
      if (ms >= timeRange.endMs) {
        if (loop) {
          audioRef.current.currentTime = timeRange.startMs / 1000;
          audioRef.current.play().catch(() => {});
          rafRef.current = requestAnimationFrame(tick);
        } else {
          stop();
        }
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [timeRange, stop, stopRaf]);

  const playFromWord = useCallback((wi) => {
    if (!timestamps?.words) return;
    const tsWord = timestamps.words[wi];
    const fromMs = tsWord?.chars?.[0]?.start ?? null;
    if (fromMs == null) return;
    stop();
    setTimeout(() => play(looping, fromMs), 20);
  }, [timestamps, play, stop, looping]);

  useEffect(() => () => { stopRaf(); audioRef.current?.pause(); }, [stopRaf]);

  // auto-start when mounted with autoPlay prop
  useEffect(() => { if (autoPlay && timeRange) { setTimeout(() => play(true), 80); } }, [autoPlay, !!timeRange]);

  if (!timeRange) return (
    <div style={{ fontSize:8, color:"var(--text3)", letterSpacing:1, padding:"4px 0" }}>
      Aucun timestamp — chargez un fichier JSON dans l'onglet ÉCOUTER
    </div>
  );

  const durationMs = timeRange.endMs - timeRange.startMs;
  const progress   = durationMs > 0 ? Math.min(1, Math.max(0, (currentMs - timeRange.startMs) / durationMs)) : 0;

  return (
    <div>
      <audio ref={audioRef} src={audioUrl} style={{ display:"none" }}
        onEnded={() => { if (!looping) stop(); }} />
      <div className="part-player-inline">
        {/* Play/Stop */}
        <button
          className={`part-player-btn ${playing ? "stop" : "play"}`}
          onClick={() => playing ? stop() : play(looping)}
          title={playing ? "Arrêter" : "Lire cette partie"}>
          {playing ? "⏹" : "▶"}
        </button>
        {/* Loop */}
        <button
          className={`part-player-btn ${looping ? "loop-on" : "loop-off"}`}
          onClick={() => {
            const nl = !looping;
            setLooping(nl);
            if (playing) { stop(); setTimeout(() => play(nl), 40); }
          }}
          title={looping ? "Boucle activée" : "Activer la boucle"}>
          🔁
        </button>
        {/* Char highlight */}
        <div className="part-player-chars" style={ hideText ? { filter:'blur(6px)', userSelect:'none', pointerEvents:'none', opacity:.4 } : {} }>
          {timestamps?.words
            ? part.wordIndices.map((wi, ii) => {
                const tsWord = timestamps.words[wi];
                return (
                  <span key={ii} onClick={() => playFromWord(wi)} style={{ cursor:"pointer" }}>
                    {fixChars(tsWord?.chars || [{ char: words[wi] || "", start:0, end:0 }]).map((c, ci) => {
                      const active = playing && currentMs >= c.start && currentMs <= c.end;
                      const done   = playing && currentMs > c.end;
                      return <span key={ci} className={`char-span${active?" char-active":done?" char-done":""}`}>{c.char}</span>;
                    })}
                    {ii < part.wordIndices.length - 1 ? " " : ""}
                  </span>
                );
              })
            : <span>{part.text}</span>
          }
        </div>
        {/* Duration */}
        <span className="part-player-dur">{(durationMs / 1000).toFixed(1)}s</span>
      </div>
      {/* Progress bar */}
      {playing && (
        <div className="part-player-progress">
          <div className="part-player-progress-fill" style={{ width:`${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}

// ─── CreatePartFromAudio — crée une partie en marquant début/fin sur l'audio ──
// Affiche le lecteur audio + les mots de l'ayat avec la zone sélectionnée.
// Quand startMs et endMs sont définis, calcule les mots couverts via timestamps
// et crée la partie automatiquement.
