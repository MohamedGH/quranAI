import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { sel, offlineActions, quranActions, errorActions } from "../../store.js";
import { SURAH_INFO } from "../../utils/arabicUtils.js";
import {
  getStorageUsage,
  getSurahOfflineStatus,
  getAllSurahsOfflineStatus,
  downloadSurahOffline,
  downloadHizbOffline,
  removeSurahOfflineAudio,
  removeSurahAllData,
  formatBytes,
  calcProgressPercent,
} from "../../utils/offlineManager.js";
import { clearAudioCache } from "../../utils/audioCache.js";
import { fetchSurahs, fetchAyats, fetchSurahSimple, fetchSurahDefault, fetchSurahMeta, loadTimestampsForSurah, getGlobalRecitator } from "../../utils/reciterAudio.js";
import { ERROR_CODES, createAppError } from "../../utils/errorManager.js";
import { buildQuranRoute } from "../../utils/routeManager.js";

export function OfflinePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isOnline = useSelector(sel.isOnline);
  const cachedSurahsMap = useSelector(sel.cachedSurahsMap);
  const downloadTask = useSelector(sel.downloadTask);
  const storageEstimate = useSelector(sel.storageEstimate);
  const surahs = useSelector(sel.surahs);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // 'all' | 'downloaded' | 'partial' | 'not_downloaded'
  const [isScanning, setIsScanning] = useState(false);
  const [activeActionSurah, setActiveActionSurah] = useState(null);
  const [infoMessage, setInfoMessage] = useState("");

  const abortControllerRef = useRef(null);

  // Load storage usage and initial scan on mount
  const refreshStorageAndScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const usage = await getStorageUsage();
      dispatch(offlineActions.setStorageEstimate(usage));

      const { surahsMap } = await getAllSurahsOfflineStatus();
      dispatch(offlineActions.setCachedSurahsMap(surahsMap));
    } catch (err) {
      dispatch(errorActions.reportError(createAppError(ERROR_CODES.STORAGE_ERROR, "Erreur scan stockage", { err })));
    } finally {
      setIsScanning(false);
    }
  }, [dispatch]);

  useEffect(() => {
    refreshStorageAndScan();
  }, [refreshStorageAndScan]);

  // Cancel any ongoing download task
  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    dispatch(offlineActions.resetDownloadTask());
    setActiveActionSurah(null);
    setInfoMessage("Téléchargement annulé.");
    setTimeout(() => setInfoMessage(""), 3000);
  };

  // Download a single surah
  const handleDownloadSurah = async (surahNum, totalCount) => {
    if (downloadTask.active) return;
    abortControllerRef.current = new AbortController();
    setActiveActionSurah(surahNum);

    dispatch(
      offlineActions.setDownloadTask({
        active: true,
        surahNum,
        phase: "init",
        done: 0,
        total: totalCount || 1,
        message: `Initialisation de la Sourate ${surahNum}...`,
      })
    );

    try {
      await downloadSurahOffline(
        surahNum,
        (p) => {
          dispatch(
            offlineActions.setDownloadTask({
              active: true,
              surahNum,
              phase: p.phase,
              done: p.done,
              total: p.total,
              message: p.message,
            })
          );
        },
        abortControllerRef.current.signal
      );

      // Refresh single surah status
      const updated = await getSurahOfflineStatus(surahNum, totalCount);
      dispatch(offlineActions.updateCachedSurah({ surahNum, status: updated }));

      // Refresh storage estimate
      const usage = await getStorageUsage();
      dispatch(offlineActions.setStorageEstimate(usage));

      setInfoMessage(`Sourate ${surahNum} enregistrée hors-ligne avec succès.`);
      setTimeout(() => setInfoMessage(""), 4000);
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        dispatch(errorActions.reportError(createAppError(ERROR_CODES.DOWNLOAD_ERROR, `Échec téléchargement S.${surahNum}`, { err })));
        setInfoMessage(`Erreur : ${err.message || String(err)}`);
      }
    } finally {
      dispatch(offlineActions.resetDownloadTask());
      setActiveActionSurah(null);
    }
  };

  // Delete audio for a single surah
  const handleDeleteSurahAudio = async (surahNum, totalCount) => {
    if (!window.confirm(`Supprimer l'audio hors-ligne de la Sourate ${surahNum} ?`)) return;
    try {
      await removeSurahOfflineAudio(surahNum);
      const updated = await getSurahOfflineStatus(surahNum, totalCount);
      dispatch(offlineActions.updateCachedSurah({ surahNum, status: updated }));

      const usage = await getStorageUsage();
      dispatch(offlineActions.setStorageEstimate(usage));

      setInfoMessage(`Audio de la Sourate ${surahNum} supprimé.`);
      setTimeout(() => setInfoMessage(""), 3000);
    } catch (err) {
      dispatch(errorActions.reportError(createAppError(ERROR_CODES.STORAGE_ERROR, "Erreur suppression audio", { err })));
    }
  };

  // Download all 114 surahs texts and metadata
  const handleDownloadAllTexts = async () => {
    if (downloadTask.active) return;
    abortControllerRef.current = new AbortController();
    const TOTAL_SURAHS = 114;
    const totalSteps = 1 + TOTAL_SURAHS * 3;

    dispatch(
      offlineActions.setDownloadTask({
        active: true,
        surahNum: null,
        phase: "all_texts",
        done: 0,
        total: totalSteps,
        message: "Démarrage du téléchargement des 114 sourates...",
      })
    );

    let done = 0;
    const tick = (msg) => {
      done++;
      dispatch(
        offlineActions.setDownloadTask({
          active: true,
          surahNum: null,
          phase: "all_texts",
          done,
          total: totalSteps,
          message: msg,
        })
      );
    };

    try {
      tick("Chargement de la liste des sourates...");
      await fetchSurahs();
      if (abortControllerRef.current.signal.aborted) return;

      const reciter = getGlobalRecitator();
      for (let n = 1; n <= TOTAL_SURAHS; n++) {
        if (abortControllerRef.current.signal.aborted) return;
        tick(`S.${n} — Texte coranique...`);
        try {
          await fetchAyats(n);
          await fetchSurahSimple(n);
          await fetchSurahDefault(n);
          await fetchSurahMeta(n);
        } catch {}

        if (abortControllerRef.current.signal.aborted) return;
        tick(`S.${n} — Timestamps audio...`);
        try {
          await loadTimestampsForSurah(n, reciter);
        } catch {}

        tick(`S.${n} — Sauvegarde locale...`);
      }

      setInfoMessage("Les 114 sourates (textes et métadonnées) sont maintenant enregistrées ✓");
      setTimeout(() => setInfoMessage(""), 5000);
      refreshStorageAndScan();
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        dispatch(errorActions.reportError(createAppError(ERROR_CODES.DOWNLOAD_ERROR, "Erreur téléchargement global", { err })));
      }
    } finally {
      dispatch(offlineActions.resetDownloadTask());
    }
  };

  // Clear all audio cache
  const handleClearAllAudioCache = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir vider tout le cache audio hors-ligne ?")) return;
    try {
      await clearAudioCache();
      setInfoMessage("Cache audio entièrement libéré.");
      setTimeout(() => setInfoMessage(""), 3500);
      refreshStorageAndScan();
    } catch (err) {
      dispatch(errorActions.reportError(createAppError(ERROR_CODES.STORAGE_ERROR, "Erreur vidage cache audio", { err })));
    }
  };

  // Combined surah list with cached metadata
  const surahList = useMemo(() => {
    return SURAH_INFO.map((info) => {
      const match = surahs.find((s) => s.number === info.n);
      const cached = cachedSurahsMap[info.n] || {
        hasText: false,
        audioCount: 0,
        totalCount: info.count,
        isComplete: false,
        percent: 0,
      };

      return {
        number: info.n,
        arabicName: info.ar,
        englishName: info.en,
        frenchName: match?.englishNameTranslation || info.en,
        numberOfAyahs: info.count,
        rev: info.rev,
        ...cached,
      };
    });
  }, [surahs, cachedSurahsMap]);

  // Filtered surahs based on search & filter
  const filteredSurahs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return surahList.filter((s) => {
      const matchQuery =
        !q ||
        s.number.toString().includes(q) ||
        s.englishName.toLowerCase().includes(q) ||
        s.arabicName.includes(q);

      if (!matchQuery) return false;

      if (filter === "downloaded") return s.isComplete;
      if (filter === "partial") return !s.isComplete && s.audioCount > 0;
      if (filter === "not_downloaded") return s.audioCount === 0;
      return true;
    });
  }, [surahList, search, filter]);

  // Total downloaded count
  const totalFullyDownloaded = useMemo(() => {
    return surahList.filter((s) => s.isComplete).length;
  }, [surahList]);

  const taskPct = calcProgressPercent(downloadTask.done, downloadTask.total);

  return (
    <div className="offline-page" style={{ padding: "16px", maxWidth: 1040, margin: "0 auto", color: "var(--text)" }}>
      {/* Page Title & Status Banner */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontFamily: "'Cinzel', serif", color: "var(--gold2)", letterSpacing: 1.5 }}>
              💾 GESTIONNAIRE HORS-LIGNE
            </h1>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 12,
                background: isOnline ? "rgba(46,204,113,0.15)" : "rgba(241,196,15,0.15)",
                color: isOnline ? "#2ecc71" : "#f1c40f",
                border: `1px solid ${isOnline ? "rgba(46,204,113,0.4)" : "rgba(241,196,15,0.4)"}`,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: isOnline ? "#2ecc71" : "#f1c40f" }} />
              {isOnline ? "EN LIGNE" : "HORS-LIGNE"}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text3)" }}>
            Téléchargez les sourates, textes, traductions et récitations audio pour étudier sans connexion internet.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={refreshStorageAndScan}
            disabled={isScanning || downloadTask.active}
            style={{
              padding: "7px 12px",
              fontSize: 11,
              fontFamily: "'Cinzel', serif",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              color: "var(--text2)",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {isScanning ? "🔄 Analyse..." : "🔄 Actualiser"}
          </button>
        </div>
      </div>

      {/* Info Feedback Toast */}
      {infoMessage && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(62,184,160,0.15)",
            border: "1px solid var(--teal)",
            borderRadius: 8,
            color: "var(--teal2)",
            fontSize: 12,
            marginBottom: 16,
            fontWeight: 600,
          }}
        >
          {infoMessage}
        </div>
      )}

      {/* Storage and Global Status Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {/* Storage Usage Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Cinzel', serif", color: "var(--gold2)" }}>
              📊 UTILISATION DU STOCKAGE
            </span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              {storageEstimate.formattedUsed} / {storageEstimate.formattedQuota}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ width: "100%", height: 7, background: "var(--surface3)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, storageEstimate.percentUsed || 1)}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--teal), var(--gold2))",
                borderRadius: 4,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--text2)" }}>
            <span>Espace IndexedDB & Cache</span>
            <span style={{ fontWeight: 700 }}>{storageEstimate.percentUsed}% utilisé</span>
          </div>
        </div>

        {/* Global Progress & Quick Actions Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Cinzel', serif", color: "var(--gold2)" }}>
              📖 ÉTAT DES SOURATES
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: totalFullyDownloaded === 114 ? "var(--green)" : "var(--teal2)" }}>
              {totalFullyDownloaded} / 114 Complètes
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <button
              onClick={handleDownloadAllTexts}
              disabled={downloadTask.active}
              style={{
                flex: "1 1 auto",
                padding: "8px 12px",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                background: "rgba(201,168,76,0.12)",
                border: "1px solid rgba(201,168,76,0.4)",
                color: "var(--gold2)",
                borderRadius: 8,
                cursor: downloadTask.active ? "default" : "pointer",
              }}
            >
              📥 114 SOURATES (TEXTES)
            </button>
            <button
              onClick={handleClearAllAudioCache}
              disabled={downloadTask.active}
              style={{
                padding: "8px 12px",
                fontSize: 10,
                fontFamily: "'Cinzel', serif",
                background: "rgba(224,90,90,0.1)",
                border: "1px solid rgba(224,90,90,0.3)",
                color: "var(--red)",
                borderRadius: 8,
                cursor: downloadTask.active ? "default" : "pointer",
              }}
            >
              🗑 VIDER L'AUDIO
            </button>
          </div>
        </div>
      </div>

      {/* Active Download Progress Card */}
      {downloadTask.active && (
        <div
          style={{
            background: "rgba(17,29,46,0.9)",
            border: "1px solid var(--gold2)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold2)", fontFamily: "'Cinzel', serif" }}>
              ⏳ TÉLÉCHARGEMENT EN COURS...
            </span>
            <button
              onClick={handleCancelDownload}
              style={{
                padding: "4px 10px",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                background: "rgba(224,90,90,0.15)",
                border: "1px solid var(--red)",
                color: "var(--red)",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              ✕ ANNULER
            </button>
          </div>

          <div style={{ height: 6, background: "var(--surface3)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
            <div
              style={{
                width: `${taskPct}%`,
                height: "100%",
                background: "var(--teal)",
                borderRadius: 3,
                transition: "width 0.25s ease",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text2)" }}>
            <span>{downloadTask.message}</span>
            <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--teal2)" }}>{taskPct}%</span>
          </div>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          background: "var(--surface)",
          padding: 12,
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ flex: "1 1 240px", position: "relative" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou numéro..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 12px",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              fontSize: 12,
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: `Toutes (${surahList.length})` },
            { id: "downloaded", label: `Disponibles (${totalFullyDownloaded})` },
            { id: "partial", label: "Partielles" },
            { id: "not_downloaded", label: "Non téléchargées" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "6px 12px",
                fontSize: 11,
                fontFamily: "'Cinzel', serif",
                borderRadius: 20,
                border: filter === f.id ? "1px solid var(--gold2)" : "1px solid var(--border)",
                background: filter === f.id ? "rgba(201,168,76,0.18)" : "transparent",
                color: filter === f.id ? "var(--gold2)" : "var(--text3)",
                cursor: "pointer",
                fontWeight: filter === f.id ? 700 : 500,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Surahs Grid / Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
          gap: 12,
        }}
      >
        {filteredSurahs.map((surah) => {
          const isDownloadingThis = downloadTask.active && downloadTask.surahNum === surah.number;
          return (
            <div
              key={surah.number}
              style={{
                background: "var(--surface)",
                border: surah.isComplete ? "1px solid rgba(62,184,160,0.35)" : "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transition: "border-color 0.2s ease",
              }}
            >
              {/* Header: Number, Names & Badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(201,168,76,0.12)",
                      border: "1px solid rgba(201,168,76,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--gold2)",
                    }}
                  >
                    {surah.number}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                      {surah.englishName}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>
                      {surah.numberOfAyahs} versets · {surah.rev === "med" ? "Médinoise" : "Mecquoise"}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Scheherazade New', serif", fontSize: 18, color: "var(--gold2)" }}>
                    {surah.arabicName}
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 2,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 10,
                      background: surah.isComplete
                        ? "rgba(46,204,113,0.15)"
                        : surah.audioCount > 0
                        ? "rgba(241,196,15,0.15)"
                        : "rgba(255,255,255,0.05)",
                      color: surah.isComplete
                        ? "#2ecc71"
                        : surah.audioCount > 0
                        ? "#f1c40f"
                        : "var(--text3)",
                      border: `1px solid ${
                        surah.isComplete
                          ? "rgba(46,204,113,0.35)"
                          : surah.audioCount > 0
                          ? "rgba(241,196,15,0.35)"
                          : "var(--border)"
                      }`,
                    }}
                  >
                    {surah.isComplete
                      ? "✓ 100% Hors-ligne"
                      : surah.audioCount > 0
                      ? `Partiel ${surah.audioCount}/${surah.totalCount}`
                      : "Non téléchargé"}
                  </span>
                </div>
              </div>

              {/* Progress bar for audio ratio */}
              <div style={{ height: 4, background: "var(--surface3)", borderRadius: 2, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${surah.percent}%`,
                    background: surah.isComplete ? "var(--teal)" : "var(--gold2)",
                    borderRadius: 2,
                  }}
                />
              </div>

              {/* Card Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <button
                  onClick={() => {
                    const target = buildQuranRoute({ surahNum: surah.number });
                    navigate(target);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--gold2)",
                    fontSize: 10,
                    cursor: "pointer",
                    padding: "4px 0",
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  }}
                >
                  📖 Ouvrir dans le lecteur →
                </button>

                <div style={{ display: "flex", gap: 6 }}>
                  {surah.audioCount > 0 && (
                    <button
                      onClick={() => handleDeleteSurahAudio(surah.number, surah.numberOfAyahs)}
                      disabled={downloadTask.active}
                      title="Supprimer l'audio pour libérer de la mémoire"
                      style={{
                        padding: "4px 8px",
                        fontSize: 9,
                        background: "rgba(224,90,90,0.1)",
                        border: "1px solid rgba(224,90,90,0.3)",
                        color: "var(--red)",
                        borderRadius: 6,
                        cursor: downloadTask.active ? "default" : "pointer",
                      }}
                    >
                      Suppr. audio
                    </button>
                  )}

                  {!surah.isComplete && (
                    <button
                      onClick={() => handleDownloadSurah(surah.number, surah.numberOfAyahs)}
                      disabled={downloadTask.active}
                      style={{
                        padding: "5px 12px",
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: "'Cinzel', serif",
                        background: "rgba(62,184,160,0.15)",
                        border: "1px solid var(--teal)",
                        color: "var(--teal2)",
                        borderRadius: 6,
                        cursor: downloadTask.active ? "default" : "pointer",
                      }}
                    >
                      {isDownloadingThis ? "Téléchargement..." : "⬇ Télécharger"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
