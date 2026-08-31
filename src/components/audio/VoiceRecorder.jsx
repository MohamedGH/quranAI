import React, { useState, useRef, useEffect } from "react";
import { openRecDB, saveRecording, loadRecordings, deleteRecording } from "../../utils/recordingsDb.js";
import { createAudioRecorder, IS_ANDROID } from "../../utils/audioRecorder.js";
import { MiniAudioPlayer } from "./MiniAudioPlayer.jsx";
import { ComparePlayer } from "./ComparePlayer.jsx";

export function VoiceRecorder({ ayat, surahNum, originalAudioUrl, localAudioRef }) {
  const ayatKey = `${surahNum}:${ayat.numberInSurah}`;
  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording]     = useState(false);
  const [elapsed, setElapsed]             = useState(0);
  const [expandedId, setExpandedId]       = useState(null);
  const [compareId, setCompareId]         = useState(null);
  const [micGain, setMicGain]             = useState(4.0); // amplification micro
  const audioRecRef   = useRef(null);
  const timerRef      = useRef(null);
  const startTimeRef  = useRef(0);

  useEffect(() => {
    loadRecordings(ayatKey).then(setRecordings).catch(() => {});
  }, [ayatKey]);

  useEffect(() => () => { audioRecRef.current?.release(); }, []);

  const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const startRec = async () => {
    try {
      // Sur Android, pauser le player HTML avant de prendre le micro (conflit hardware)
      if (IS_ANDROID) { try { localAudioRef?.current?.pause(); } catch {} }
      const arec = createAudioRecorder();
      audioRecRef.current = arec;
      await arec.start(micGain);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 200);
    } catch (err) {
      console.error("[VoiceRecorder] startRec:", err);
      alert("Impossible d'accéder au microphone : " + (err.message || err));
    }
  };

  const stopRec = async () => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    try {
      const url = await audioRecRef.current?.stop();
      audioRecRef.current = null;
      if (!url) return;

      // createAudioRecorder retourne toujours une URL lisible par la WebView
      // (convertFileSrc sur Android, blob: URL sur web)
      let blob;
      try { const r = await fetch(url); blob = await r.blob(); }
      catch { return; }
      if (!blob || blob.size === 0) return;

      const duration = Date.now() - startTimeRef.current;
      const id = Date.now();
      const rec = { id, ayatKey, date: new Date().toISOString(), duration, mimeType: blob.type, blob };
      await saveRecording(rec);
      const updated = await loadRecordings(ayatKey);
      setRecordings(updated);
      setExpandedId(id);
    } catch (err) {
      console.error("[VoiceRecorder] stopRec:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet enregistrement ?")) return;
    await deleteRecording(id);
    setRecordings(r => r.filter(x => x.id !== id));
    if (expandedId === id) setExpandedId(null);
    if (compareId  === id) setCompareId(null);
  };

  const getBlobUrl = (rec) => {
    if (!rec._blobUrl) rec._blobUrl = URL.createObjectURL(rec.blob);
    return rec._blobUrl;
  };

  return (
    <div className="rec-wrap">
      {/* Gain slider */}
      {!isRecording && (
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"4px 0"}}>
          <span style={{fontSize:8,letterSpacing:1,color:"var(--text3)",fontFamily:"'Cinzel',serif",flexShrink:0}}>🎤 GAIN</span>
          <input type="range" min="1" max="8" step="0.5" value={micGain}
            onChange={e=>setMicGain(Number(e.target.value))}
            style={{flex:1,accentColor:"var(--teal)"}} />
          <span style={{fontSize:9,color:"var(--teal2)",fontFamily:"'Cinzel',serif",width:28,textAlign:"right"}}>{micGain}×</span>
        </div>
      )}

      {/* Record button */}
      <button
        className={`rec-btn ${isRecording ? "recording" : "idle"}`}
        onClick={isRecording ? stopRec : startRec}
      >
        <div className="rec-dot" />
        {isRecording
          ? <><span className="rec-timer">{fmtTime(elapsed)}</span><span>ARRÊTER L'ENREGISTREMENT</span></>
          : "🎙 ENREGISTRER MA RÉCITATION"
        }
      </button>

      {recordings.length === 0 && !isRecording && (
        <div style={{ textAlign:"center", fontSize:9, letterSpacing:1.5, color:"var(--text3)", padding:"12px 0" }}>
          Aucun enregistrement — appuyez sur le bouton pour commencer
        </div>
      )}

      {/* Recordings list */}
      {recordings.length > 0 && (
        <div className="rec-list">
          <div style={{ fontSize:9, letterSpacing:2, color:"var(--text3)" }}>
            {recordings.length} ENREGISTREMENT{recordings.length > 1 ? "S" : ""}
          </div>
          {[...recordings].reverse().map((rec, i) => {
            const isExpanded = expandedId === rec.id;
            const isCompare  = compareId  === rec.id;
            return (
              <div key={rec.id} className="rec-item">
                <div className="rec-item-header">
                  <div className="rec-item-icon">🎙</div>
                  <div className="rec-item-info">
                    <div className="rec-item-date">
                      {new Date(rec.date).toLocaleDateString("fr-FR", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                    </div>
                    <div className="rec-item-dur">{fmtTime(rec.duration)}</div>
                  </div>
                  <div className="rec-item-actions">
                    <button className="btn-small"
                      onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                      style={isExpanded ? { borderColor:"var(--teal)", color:"var(--teal2)" } : {}}>
                      {isExpanded ? "▲" : "▶ ÉCOUTER"}
                    </button>
                    <button className="btn-small"
                      onClick={() => setCompareId(isCompare ? null : rec.id)}
                      style={isCompare ? { borderColor:"var(--gold)", color:"var(--gold2)" } : {}}>
                      ⇌ COMPARER
                    </button>
                    <button className="btn-small"
                      onClick={() => handleDelete(rec.id)}
                      style={{ borderColor:"var(--red)", color:"var(--red)" }}>✕</button>
                  </div>
                </div>

                {/* Player */}
                {isExpanded && <MiniAudioPlayer src={getBlobUrl(rec)} color="var(--teal2)" />}

                {/* Compare side-by-side */}
                {isCompare && (
                  <ComparePlayer userSrc={getBlobUrl(rec)} refSrc={originalAudioUrl} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DecouverteMode ────────────────────────────────────────────────────────────
// Words hidden with RTL order numbers; clicking word N reveals all words 1→N
// A word can also be marked (or drilled down to letter level) as "à réviser".
