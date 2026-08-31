import React, { useState, useRef, useEffect, useMemo } from "react";

export function CreatePartFromAudio({ ayat, timestamps, audioUrl, existingWordIndices, initialSeekMs, onCreatePart }) {
  const audioRef    = useRef(null);
  const rafRef      = useRef(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying]     = useState(false);
  const [startMs, setStartMs]     = useState(null);
  const [endMs,   setEndMs]       = useState(null);

  const words = ayat.text ? ayat.text.split(" ").filter(Boolean) : [];

  const stopRaf = () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };

  const onPlay  = () => {
    const tick = () => {
      if (audioRef.current) setCurrentMs(audioRef.current.currentTime * 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    setPlaying(true);
  };
  const onPause = () => { stopRaf(); setPlaying(false); };
  const onEnded = () => { stopRaf(); setPlaying(false); };

  useEffect(() => () => stopRaf(), []);

  // Seek au bon endroit à l'ouverture et quand la position initiale change
  useEffect(() => {
    if (initialSeekMs == null || !audioRef.current) return;
    audioRef.current.currentTime = initialSeekMs / 1000;
    setCurrentMs(initialSeekMs);
  }, [initialSeekMs]);

  // Calcule les indices de mots couverts par [startMs, endMs]
  const coveredIndices = useMemo(() => {
    if (startMs == null || endMs == null || !timestamps?.words) return [];
    return timestamps.words
      .map((w, wi) => {
        const ws = w.chars?.[0]?.start ?? null;
        const we = w.chars?.[w.chars.length - 1]?.end ?? null;
        if (ws == null || we == null) return null;
        // Un mot est couvert s'il chevauche [startMs, endMs]
        if (we < startMs || ws > endMs) return null;
        return wi;
      })
      .filter(wi => wi !== null && !existingWordIndices.has(wi));
  }, [startMs, endMs, timestamps, existingWordIndices]);

  const fmtMs = (ms) => ms == null ? "--:--.---"
    : `${String(Math.floor(ms / 60000)).padStart(2,"0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2,"0")}.${String(Math.floor(ms % 1000)).padStart(3,"0")}`;

  const captureStart = () => setStartMs(Math.round((audioRef.current?.currentTime ?? 0) * 1000));
  const captureEnd   = () => setEndMs(Math.round((audioRef.current?.currentTime ?? 0) * 1000));

  const canCreate = coveredIndices.length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    const text = coveredIndices.map(wi => words[wi]).join(" ");
    const newStart = endMs ?? 0;
    onCreatePart({ wordIndices: coveredIndices, text });
    setStartMs(newStart);
    setEndMs(null);
    if (audioRef.current) {
      audioRef.current.currentTime = newStart / 1000;
      setCurrentMs(newStart);
    }
  };

  return (
    <div className="cpa-wrap">
      <div className="cpa-title">✂ CRÉER UNE PARTIE VIA L'AUDIO</div>

      {/* Lecteur audio */}
      <audio
        ref={audioRef} controls src={audioUrl}
        style={{ width:"100%", marginBottom:2 }}
        onPlay={onPlay} onPause={onPause} onEnded={onEnded}
      />

      {/* Marqueurs début / fin */}
      <div className="cpa-controls">
        <div className="cpa-marker">
          <div className="cpa-marker-label">DÉBUT</div>
          <div className={`cpa-marker-time${startMs != null ? " set" : ""}`}>{fmtMs(startMs)}</div>
          <button className="cpa-btn-capture" onClick={captureStart}>
            ⬤ MARQUER
          </button>
        </div>
        <div style={{ fontSize:18, color:"var(--border2)", alignSelf:"center" }}>→</div>
        <div className="cpa-marker">
          <div className="cpa-marker-label">FIN</div>
          <div className={`cpa-marker-time${endMs != null ? " set" : ""}`}>{fmtMs(endMs)}</div>
          <button className="cpa-btn-capture" onClick={captureEnd}>
            ⬤ MARQUER
          </button>
        </div>
        <button className="cpa-btn-capture"
          onClick={() => { setStartMs(null); setEndMs(null); }}
          style={{ borderColor:"var(--border2)", color:"var(--text3)", background:"transparent" }}>
          ↺ RESET
        </button>
      </div>

      {/* Prévisualisation mots couverts */}
      {timestamps?.words && (
        <div className="cpa-preview">
          {words.map((w, wi) => {
            const inRange   = coveredIndices.includes(wi);
            const isExist   = existingWordIndices.has(wi);
            return (
              <span key={wi} className={`cpa-preview-word${inRange ? " in-range" : ""}`}
                style={isExist ? { opacity:.35 } : {}}>
                {w}{" "}
              </span>
            );
          })}
        </div>
      )}
      {startMs != null && endMs != null && coveredIndices.length === 0 && timestamps?.words && (
        <div style={{ fontSize:9, color:"var(--red)", letterSpacing:1 }}>
          Aucun mot dans cet intervalle — ajustez les marqueurs
        </div>
      )}
      {!timestamps?.words && (
        <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1 }}>
          ⚠ Chargez d'abord un fichier de timestamps dans l'onglet ÉCOUTER
        </div>
      )}

      <button className="cpa-create-btn" onClick={handleCreate} disabled={!canCreate}>
        + CRÉER LA PARTIE ({coveredIndices.length} mot{coveredIndices.length !== 1 ? "s" : ""})
      </button>
    </div>
  );
}
