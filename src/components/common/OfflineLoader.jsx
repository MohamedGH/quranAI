import React, { useState, useEffect, useRef } from "react";
import {
  fetchSurahs,
  fetchAyats,
  fetchSurahSimple,
  fetchSurahDefault,
  fetchSurahMeta,
  loadTimestampsForSurah,
  getGlobalRecitator,
  getAudioBase,
} from "../../utils/reciterAudio.js";
import {
  downloadSurahOffline,
  downloadHizbOffline,
  getSurahOfflineStatus,
  removeSurahOfflineAudio,
} from "../../utils/offlineManager.js";
import { clearAudioCache } from "../../utils/audioCache.js";

export function OfflineLoader({ currentSurah = null, currentHizb = null, onDownloadDone = () => {} }) {
  const [status, setStatus] = useState(null); // null | 'running' | 'done' | 'error'
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [activeTask, setActiveTask] = useState(null); // 'surah' | 'hizb' | 'all'
  const [surahStatus, setSurahStatus] = useState(null);
  const [cacheMsg, setCacheMsg] = useState("");
  const abortControllerRef = useRef(null);

  // Check current surah offline status on mount and when surah changes
  useEffect(() => {
    let active = true;
    if (currentSurah?.number) {
      getSurahOfflineStatus(currentSurah.number, currentSurah.numberOfAyahs).then((st) => {
        if (active) setSurahStatus(st);
      });
    }
    return () => {
      active = false;
    };
  }, [currentSurah]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus(null);
    setActiveTask(null);
    setProgress({ done: 0, total: 0, current: "Arrêté" });
  };

  // Download single surah
  const handleDownloadSurah = async () => {
    if (!currentSurah?.number) return;
    abortControllerRef.current = new AbortController();
    setStatus("running");
    setActiveTask("surah");
    setProgress({ done: 0, total: currentSurah.numberOfAyahs || 1, current: "Initialisation..." });

    try {
      await downloadSurahOffline(
        currentSurah.number,
        (p) => {
          setProgress({ done: p.done, total: p.total, current: p.message });
        },
        abortControllerRef.current.signal
      );
      setStatus("done");
      setActiveTask(null);
      const updated = await getSurahOfflineStatus(currentSurah.number, currentSurah.numberOfAyahs);
      setSurahStatus(updated);
      onDownloadDone();
    } catch (e) {
      if (abortControllerRef.current?.signal.aborted) {
        setStatus(null);
      } else {
        setStatus("error");
        setProgress((p) => ({ ...p, current: "Erreur : " + (e.message || String(e)) }));
      }
      setActiveTask(null);
    }
  };

  // Download current Hizb
  const handleDownloadHizb = async () => {
    if (!currentHizb) return;
    abortControllerRef.current = new AbortController();
    setStatus("running");
    setActiveTask("hizb");
    setProgress({ done: 0, total: 1, current: `Préparation du Hizb ${currentHizb}...` });

    try {
      await downloadHizbOffline(
        currentHizb,
        (p) => {
          setProgress({ done: p.done, total: p.total, current: p.message });
        },
        abortControllerRef.current.signal
      );
      setStatus("done");
      setActiveTask(null);
      if (currentSurah?.number) {
        const updated = await getSurahOfflineStatus(currentSurah.number, currentSurah.numberOfAyahs);
        setSurahStatus(updated);
      }
      onDownloadDone();
    } catch (e) {
      if (abortControllerRef.current?.signal.aborted) {
        setStatus(null);
      } else {
        setStatus("error");
        setProgress((p) => ({ ...p, current: "Erreur : " + (e.message || String(e)) }));
      }
      setActiveTask(null);
    }
  };

  // Download all 114 surahs (text + timestamps)
  const handleDownloadAll = async () => {
    abortControllerRef.current = new AbortController();
    setStatus("running");
    setActiveTask("all");
    setProgress({ done: 0, total: 114 * 3 + 1, current: "Démarrage..." });

    const TOTAL_SURAHS = 114;
    const total = 1 + TOTAL_SURAHS * 3;
    let done = 0;

    const tick = (label) => {
      done++;
      setProgress({ done, total, current: label });
    };

    try {
      tick("Liste des sourates…");
      await fetchSurahs();
      if (abortControllerRef.current.signal.aborted) return;

      const reciter = getGlobalRecitator();
      for (let n = 1; n <= TOTAL_SURAHS; n++) {
        if (abortControllerRef.current.signal.aborted) return;
        const name = `Sourate ${n}`;

        tick(`${name} — texte`);
        try {
          await fetchAyats(n);
          await fetchSurahSimple(n);
          await fetchSurahDefault(n);
          await fetchSurahMeta(n);
        } catch {}

        if (abortControllerRef.current.signal.aborted) return;

        tick(`${name} — timestamps`);
        try {
          await loadTimestampsForSurah(n, reciter);
        } catch {}

        if (abortControllerRef.current.signal.aborted) return;

        tick(`${name} — mise en cache IDB`);
      }

      setStatus("done");
      setActiveTask(null);
      setProgress((p) => ({ ...p, current: "Les 114 sourates et textes sont enregistrés hors-ligne ✓" }));
      onDownloadDone();
    } catch (e) {
      if (abortControllerRef.current?.signal.aborted) {
        setStatus(null);
      } else {
        setStatus("error");
        setProgress((p) => ({ ...p, current: "Erreur : " + (e.message || String(e)) }));
      }
      setActiveTask(null);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm("Voulez-vous libérer le cache audio hors-ligne ?")) return;
    try {
      await clearAudioCache();
      setCacheMsg("Cache audio vidé avec succès.");
      if (currentSurah?.number) {
        const updated = await getSurahOfflineStatus(currentSurah.number, currentSurah.numberOfAyahs);
        setSurahStatus(updated);
      }
      setTimeout(() => setCacheMsg(""), 3500);
    } catch {
      setCacheMsg("Erreur lors du nettoyage.");
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const running = status === "running";

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginTop: 8 }}>
      <div style={{ padding: "14px 16px", background: "var(--surface2)", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--gold2)", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
              📥 GESTIONNAIRE HORS-LIGNE
            </div>
            <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 3 }}>
              Téléchargez les sourates, versets et audios pour étudier sans connexion internet
            </div>
          </div>
          {running && (
            <button
              onClick={handleStop}
              style={{
                padding: "6px 12px",
                fontSize: 9,
                letterSpacing: 1.2,
                fontFamily: "'Cinzel',serif",
                background: "rgba(224,90,90,.15)",
                border: "1px solid var(--red)",
                color: "var(--red)",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ✕ ARRÊTER
            </button>
          )}
        </div>

        {/* Action Buttons Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          {/* Current Surah download */}
          {currentSurah && (
            <button
              onClick={handleDownloadSurah}
              disabled={running}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "8px 12px",
                borderRadius: 8,
                background: surahStatus?.isComplete ? "rgba(62,184,160,0.12)" : "rgba(201,168,76,0.08)",
                border: `1px solid ${surahStatus?.isComplete ? "var(--teal)" : "rgba(201,168,76,0.3)"}`,
                color: surahStatus?.isComplete ? "var(--teal2)" : "var(--gold2)",
                cursor: running ? "default" : "pointer",
                textAlign: "left",
                opacity: running && activeTask !== "surah" ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
                {surahStatus?.isComplete ? "✓ SOURATE DISPONIBLE" : "⬇ TÉLÉCHARGER SOURATE"}
              </span>
              <span style={{ fontSize: 8, opacity: 0.85, marginTop: 2 }}>
                S.{currentSurah.number} ({currentSurah.numberOfAyahs}v) {surahStatus ? `· ${surahStatus.audioCount}/${surahStatus.totalCount} audio` : ""}
              </span>
            </button>
          )}

          {/* Current Hizb download */}
          {currentHizb && (
            <button
              onClick={handleDownloadHizb}
              disabled={running}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255,209,102,0.08)",
                border: "1px solid rgba(255,209,102,0.35)",
                color: "#ffd166",
                cursor: running ? "default" : "pointer",
                textAlign: "left",
                opacity: running && activeTask !== "hizb" ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
                ⬇ TÉLÉCHARGER HIZB {currentHizb}
              </span>
              <span style={{ fontSize: 8, opacity: 0.85, marginTop: 2 }}>
                Toutes les sourates du Hizb
              </span>
            </button>
          )}

          {/* All 114 surahs text & metadata */}
          <button
            onClick={handleDownloadAll}
            disabled={running}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              color: "var(--text2)",
              cursor: running ? "default" : "pointer",
              textAlign: "left",
              opacity: running && activeTask !== "all" ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
              📖 114 SOURATES (TEXTES)
            </span>
            <span style={{ fontSize: 8, opacity: 0.7, marginTop: 2 }}>
              Textes, sourates et métadonnées
            </span>
          </button>
        </div>

        {/* Progress Bar when running, done, or error */}
        {(running || status === "done" || status === "error") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            <div style={{ height: 5, background: "var(--surface3)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 3,
                  transition: "width .3s",
                  width: pct + "%",
                  background: status === "error" ? "var(--red)" : status === "done" ? "var(--green)" : "var(--teal)",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 8.5, color: status === "error" ? "var(--red)" : "var(--text2)" }}>
                {progress.current}
              </div>
              <div style={{ fontSize: 8.5, color: status === "done" ? "var(--green)" : "var(--teal2)", fontFamily: "monospace", fontWeight: 700 }}>
                {pct}%
              </div>
            </div>
          </div>
        )}

        {/* Clear cache option & feedback */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginTop: 4 }}>
          <span style={{ fontSize: 8, color: cacheMsg ? "var(--teal2)" : "var(--text3)" }}>
            {cacheMsg || "IndexedDB & Service Worker actif"}
          </span>
          <button
            onClick={handleClearCache}
            disabled={running}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text3)",
              fontSize: 8,
              cursor: "pointer",
              textDecoration: "underline",
              padding: "2px 4px",
            }}
          >
            Vider le cache audio
          </button>
        </div>
      </div>
    </div>
  );
}
