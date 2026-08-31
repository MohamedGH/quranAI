import { getAudioBase } from "../../utils/reciterAudio.js";
import React, { useState, useRef } from "react";
import {
  API,
  fetchSurahs,
  fetchAyats,
  fetchSurahSimple,
  loadTimestampsForSurah,
  idbSetQuran,
  getGlobalRecitator
} from "../../utils/reciterAudio.js";

export function OfflineLoader() {
  const [status,   setStatus]   = React.useState(null); // null | 'running' | 'done' | 'error'
  const [progress, setProgress] = React.useState({ done: 0, total: 0, current: '' });
  const abortRef = React.useRef(false);

  const handleLoad = async () => {
    abortRef.current = false;
    setStatus('running');
    setProgress({ done: 0, total: 0, current: '' });

    const TOTAL_SURAHS = 114;
    // Step counts: surahs list(1) + ayats per surah(114) + text per surah(114) + timestamps(114) = 343
    const total = 1 + TOTAL_SURAHS * 3;
    let done = 0;

    const tick = (label) => {
      done++;
      setProgress({ done, total, current: label });
    };

    try {
      // 1. Surahs list
      tick('Liste des sourates…');
      await fetchSurahs();
      if (abortRef.current) { setStatus(null); return; }

      for (let n = 1; n <= TOTAL_SURAHS; n++) {
        if (abortRef.current) { setStatus(null); return; }
        const name = `Sourate ${n}`;

        // 2. Ayats (text + audio numbers)
        tick(`${name} — ayats`);
        try { await fetchAyats(n); } catch {}

        if (abortRef.current) { setStatus(null); return; }

        // 3. Text (concordance)
        tick(`${name} — texte`);
        try { await fetchSurahSimple(n); } catch {}

        if (abortRef.current) { setStatus(null); return; }

        // 4. Timestamps
        tick(`${name} — timestamps`);
        try { await loadTimestampsForSurah(n, getGlobalRecitator()); } catch {}

        if (abortRef.current) { setStatus(null); return; }

        // 5. Audio pre-cache via Service Worker
        tick(`${name} — audio`);
        try {
          const ayatData = await fetchAyats(n);
          const ayahs = ayatData?.ayahs || [];
          const sw = navigator.serviceWorker?.controller;
          if (sw && ayahs.length) {
            sw.postMessage({ type: 'PRECACHE_AUDIO', urls: ayahs.map(a => `${getAudioBase()}/${a.number}.mp3`) });
          }
        } catch {}
      }

      setStatus('done');
      setProgress(p => ({ ...p, current: 'Toutes les ressources chargées ✓' }));
    } catch (e) {
      setStatus('error');
      setProgress(p => ({ ...p, current: 'Erreur : ' + (e.message || String(e)) }));
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const running = status === 'running';

  return (
    <div style={{ border:"1px solid var(--border)", borderRadius:10, overflow:"hidden", marginTop:8 }}>
      <div style={{ padding:"12px 14px", background:"var(--surface2)", display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:9, letterSpacing:2, color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>📥 MODE HORS LIGNE</div>
            <div style={{ fontSize:8, color:"var(--text3)", marginTop:3, letterSpacing:.5 }}>
              Pré-charge les 114 sourates, textes et timestamps en IDB
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {running && (
              <button onClick={() => { abortRef.current = true; }} style={{
                padding:"7px 14px", fontSize:8, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                background:"rgba(224,90,90,.1)", border:"1px solid var(--red)", color:"var(--red)",
                borderRadius:8, cursor:"pointer",
              }}>✕ STOP</button>
            )}
            <button onClick={handleLoad} disabled={running} style={{
              padding:"7px 18px", fontSize:8, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background: running ? "rgba(62,184,160,.05)" : "rgba(62,184,160,.1)",
              border:"1px solid var(--teal)", color:"var(--teal2)",
              borderRadius:8, cursor: running ? "default" : "pointer",
              opacity: running ? .7 : 1,
            }}>{running ? "…" : status === 'done' ? "↺ RECHARGER" : "⬇ CHARGER"}</button>
          </div>
        </div>

        {(running || status === 'done' || status === 'error') && (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ height:4, background:"var(--surface3)", borderRadius:2, overflow:"hidden" }}>
              <div style={{
                height:"100%", borderRadius:2, transition:"width .3s",
                width: pct + "%",
                background: status === 'error' ? "var(--red)" : status === 'done' ? "var(--green)" : "var(--teal)",
              }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <div style={{ fontSize:8, color:"var(--text3)", letterSpacing:.5 }}>{progress.current}</div>
              <div style={{ fontSize:8, color: status === 'done' ? "var(--green)" : "var(--text3)", fontFamily:"monospace" }}>
                {progress.done}/{progress.total}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
