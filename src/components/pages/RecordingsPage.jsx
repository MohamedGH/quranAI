import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions, errorActions } from "../../store.js";
import { ERROR_CODES, normalizeError } from "../../utils/errorManager.js";
import { buildQuranRoute } from "../../utils/routeManager.js";
import {
  getAllRecordings,
  deleteRecording,
  downloadRecordingFile,
  requestPersistentStorage,
  getStoragePersistenceInfo,
} from "../../utils/recordingsDb.js";
import { formatFileSize } from "../../utils/audioRecorder.js";
import {
  canSyncRecordingsToCloud,
  uploadRecordingToCloud,
  deleteRecordingFromCloud,
  fetchCloudRecordingsMeta,
  restoreCloudRecordingToLocal,
} from "../../utils/recordingsCloudSync.js";
import { SURAH_NAMES } from "../../utils/voiceCommand.js";
import { safePlayAudio, safePauseAudio } from "../../utils/safeAudioPlayer.js";

const formatDuration = (durationMs) => {
  const totalSec = Math.max(0, Math.round((Number(durationMs) || 0) / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
};

export function RecordingsPage({ onNavigate }) {
  const dispatch = useDispatch();
  const storagePersisted = useSelector(sel.storagePersisted);

  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [playingId, setPlayingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);

  const audioRefs = useRef({});
  const blobUrlCacheRef = useRef(new Map());
  const cloudAvailable = canSyncRecordingsToCloud();

  const refreshStorageStats = useCallback(async () => {
    const info = await getStoragePersistenceInfo();
    setStorageInfo(info);
    dispatch(uiActions.setStoragePersisted(info.persisted));
  }, [dispatch]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const all = await getAllRecordings();
      all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecordings(all);
      await refreshStorageStats();
    } catch (e) {
      const appErr = normalizeError(e, ERROR_CODES.STORAGE_ERROR, "Erreur lors du chargement des enregistrements");
      setErrorMessage(appErr.message);
      dispatch(errorActions.reportError(appErr));
    } finally {
      setLoading(false);
    }
  }, [dispatch, refreshStorageStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const cache = blobUrlCacheRef.current;
    return () => {
      cache.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      cache.clear();
    };
  }, []);

  const getAudioSrc = useCallback((rec) => {
    if (!rec?.blob) return rec?.cloudUrl || "";
    const existing = blobUrlCacheRef.current.get(rec.id);
    if (existing) return existing;
    const url = URL.createObjectURL(rec.blob);
    blobUrlCacheRef.current.set(rec.id, url);
    return url;
  }, []);

  const handleRequestPersistence = async () => {
    const res = await requestPersistentStorage();
    dispatch(uiActions.setStoragePersisted(res.persisted));
    await refreshStorageStats();
    if (res.persisted) {
      setStatusMessage("Stockage local protégé contre l'effacement automatique.");
    } else if (!res.supported) {
      setStatusMessage("Ce navigateur ne supporte pas navigator.storage.persist().");
    } else {
      setStatusMessage("Le navigateur gère déjà le quota dynamiquement.");
    }
  };

  const handleSyncSingleToCloud = async (rec) => {
    setSyncingId(rec.id);
    setErrorMessage(null);
    const res = await uploadRecordingToCloud(rec);
    setSyncingId(null);
    if (!res.ok) {
      setErrorMessage(res.error?.message || "Sauvegarde cloud échouée");
      if (res.error) dispatch(errorActions.reportError(res.error));
      return;
    }
    setStatusMessage("Enregistrement sauvegardé sur Firebase Storage.");
    await loadAll();
  };

  const handleSyncAllWithCloud = async () => {
    if (!cloudAvailable) return;
    setSyncingAll(true);
    setErrorMessage(null);
    let uploaded = 0;
    let restored = 0;
    try {
      for (const rec of recordings) {
        if (!rec.cloudUrl && rec.blob) {
          const up = await uploadRecordingToCloud(rec);
          if (up.ok) uploaded++;
        }
      }
      const cloudList = await fetchCloudRecordingsMeta();
      if (cloudList.ok) {
        const localIds = new Set(recordings.map((r) => String(r.id)));
        for (const meta of cloudList.items) {
          if (!localIds.has(String(meta.id)) && meta.cloudUrl) {
            const dl = await restoreCloudRecordingToLocal(meta);
            if (dl.ok) restored++;
          }
        }
      }
      setStatusMessage(
        `Synchronisation terminée : ${uploaded} envoyé${uploaded > 1 ? "s" : ""}, ${restored} restauré${restored > 1 ? "s" : ""}.`
      );
      await loadAll();
    } catch (err) {
      const appErr = normalizeError(err, ERROR_CODES.CLOUD_STORAGE_ERROR, "Erreur lors de la synchronisation cloud");
      setErrorMessage(appErr.message);
      dispatch(errorActions.reportError(appErr));
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDelete = async (rec) => {
    try {
      await deleteRecording(rec.id);
      if (rec.storagePath || rec.cloudUrl) {
        await deleteRecordingFromCloud(rec);
      }
      const cached = blobUrlCacheRef.current.get(rec.id);
      if (cached) {
        try {
          URL.revokeObjectURL(cached);
        } catch {}
        blobUrlCacheRef.current.delete(rec.id);
      }
      setRecordings((prev) => prev.filter((r) => r.id !== rec.id));
      if (playingId === rec.id) setPlayingId(null);
      setConfirmDeleteId(null);
      await refreshStorageStats();
    } catch (e) {
      const appErr = normalizeError(e, ERROR_CODES.STORAGE_ERROR, "Erreur lors de la suppression");
      setErrorMessage(appErr.message);
      dispatch(errorActions.reportError(appErr));
    }
  };

  const togglePlay = (id) => {
    const audio = audioRefs.current[id];
    if (!audio) return;
    if (playingId === id) {
      safePauseAudio(audio);
      setPlayingId(null);
    } else {
      Object.entries(audioRefs.current).forEach(([k, el]) => {
        if (el && k !== String(id)) safePauseAudio(el);
      });
      safePlayAudio(audio, () => {
        setPlayingId(id);
      });
    }
  };

  const filtered = recordings.filter((rec) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const surahName = (SURAH_NAMES[rec.surahNum] || "").toLowerCase();
    const surahNumStr = String(rec.surahNum || "");
    const ayatNumStr = String(rec.ayatNum || "");
    const textStr = (rec.text || "").toLowerCase();
    return surahName.includes(q) || surahNumStr.includes(q) || ayatNumStr.includes(q) || textStr.includes(q);
  });

  const navigateToQuran = (surahNum, ayatNum) => {
    if (onNavigate) {
      onNavigate("quran", surahNum && ayatNum ? { surah: surahNum, ayat: ayatNum } : undefined);
      return;
    }
    const route = buildQuranRoute({ activePage: "quran", surahNum, ayatNum });
    if (typeof window !== "undefined") {
      window.location.hash = `#${route}`;
    }
  };

  return (
    <div className="recordings-page" style={{ padding: "16px 14px", maxWidth: 920, margin: "0 auto", color: "var(--text, #e8e4d8)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--gold2, #e8c96e)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🎙</span> Enregistrements Vocaux
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text2, #a89f8c)", marginTop: 4 }}>
            Stockés localement dans IndexedDB (Opus mono compressé) avec export fichier et sauvegarde Firebase Storage.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", width: "100%", maxWidth: 360 }}>
          <input
            type="text"
            placeholder="Filtrer par sourate, verset..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              flex: 1,
              minWidth: 160,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border, #2a2f40)",
              background: "var(--surface2, #1a1e2a)",
              color: "var(--text, #e8e4d8)",
              fontSize: "0.85rem",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={loadAll}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border2, #363c52)",
              background: "var(--surface2, #1a1e2a)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
              color: "var(--text, #e8e4d8)",
            }}
          >
            Actualiser
          </button>
        </div>
      </div>

      {/* Persistence & Storage Banner */}
      <div
        style={{
          background: "var(--surface2, #1a1e2a)",
          border: "1px solid var(--border, #2a2f40)",
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text, #e8e4d8)" }}>
            {storagePersisted ? "🔒 Stockage persistant activé" : "💾 Stockage IndexedDB local"}
            {storageInfo && (
              <span style={{ color: "var(--teal2, #56d4bc)", marginLeft: 8, fontWeight: 500 }}>
                {formatFileSize(storageInfo.recordingsBytes)} utilisés ({storageInfo.recordingsCount} audio{storageInfo.recordingsCount > 1 ? "s" : ""})
              </span>
            )}
          </div>
          {storageInfo?.quota > 0 && (
            <div style={{ fontSize: "0.75rem", color: "var(--text2, #a89f8c)" }}>
              Quota navigateur disponible : {formatFileSize(storageInfo.quota)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!storagePersisted && (
            <button
              type="button"
              onClick={handleRequestPersistence}
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                border: "1px solid var(--teal, #3eb8a0)",
                background: "rgba(62,184,160,.14)",
                color: "var(--teal2, #56d4bc)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🔒 Protéger le stockage
            </button>
          )}
          {cloudAvailable && (
            <button
              type="button"
              onClick={handleSyncAllWithCloud}
              disabled={syncingAll}
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                border: "1px solid var(--gold, #c9a84c)",
                background: "rgba(201,168,76,.14)",
                color: "var(--gold2, #e8c96e)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: syncingAll ? "wait" : "pointer",
              }}
            >
              {syncingAll ? "⏳ Synchronisation..." : "☁ Synchroniser Firebase"}
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(62,184,160,.12)",
            border: "1px solid rgba(62,184,160,.3)",
            color: "var(--teal2, #56d4bc)",
            fontSize: "0.82rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage("")}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(224,90,90,.12)",
            border: "1px solid rgba(224,90,90,.35)",
            color: "var(--red, #e05a5a)",
            fontSize: "0.82rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚠ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text2, #a89f8c)" }}>
          Chargement de vos enregistrements...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            background: "var(--surface2, #1a1e2a)",
            borderRadius: 12,
            border: "1px dashed var(--border2, #363c52)",
          }}
        >
          <div style={{ fontSize: "2.2rem", marginBottom: 12 }}>🎙️</div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 6, color: "var(--text, #e8e4d8)" }}>
            Aucun enregistrement vocal trouvé
          </h3>
          <p style={{ fontSize: "0.88rem", color: "var(--text2, #a89f8c)", maxWidth: 450, margin: "0 auto 16px" }}>
            {recordings.length === 0
              ? "Vous n'avez pas encore effectué d'enregistrements. Rendez-vous dans le mode Lecture d'un verset pour enregistrer votre récitation."
              : "Aucun enregistrement ne correspond à votre recherche."}
          </p>
          {recordings.length === 0 && (
            <button
              type="button"
              onClick={() => navigateToQuran(1, 1)}
              style={{
                padding: "10px 20px",
                background: "var(--gold, #c9a84c)",
                color: "#0c0e14",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Aller au Coran
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text2, #a89f8c)" }}>
            {filtered.length} enregistrement{filtered.length > 1 ? "s" : ""} trouvé{filtered.length > 1 ? "s" : ""}
          </div>
          {filtered.map((rec) => {
            const dateStr = rec.timestamp
              ? new Date(rec.timestamp).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
              : "";
            const surahName = SURAH_NAMES[rec.surahNum] || `Sourate ${rec.surahNum}`;
            const isPlaying = playingId === rec.id;
            const isConfirming = confirmDeleteId === rec.id;
            const srcUrl = getAudioSrc(rec);

            return (
              <div
                key={rec.id}
                style={{
                  background: "var(--surface2, #1a1e2a)",
                  borderRadius: 12,
                  padding: "14px",
                  border: "1px solid var(--border, #2a2f40)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span
                        style={{
                          color: "var(--gold2, #e8c96e)",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                        }}
                      >
                        S. {rec.surahNum} • V. {rec.ayatNum}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "0.98rem", color: "var(--text, #e8e4d8)" }}>
                        {surahName}
                      </span>
                      {rec.cloudUrl && (
                        <span style={{ fontSize: "0.75rem", color: "var(--teal2, #56d4bc)", fontWeight: 600 }}>
                          ☁ Sauvegardé
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text2, #a89f8c)" }}>
                      {dateStr ? `${dateStr} • ` : ""}
                      Durée : {formatDuration(rec.durationMs ?? rec.duration)}
                      {rec.sizeBytes ? ` • ${formatFileSize(rec.sizeBytes)}` : ""}
                      {rec.bitrateKbps ? ` • Opus mono ${rec.bitrateKbps} kbps` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => navigateToQuran(rec.surahNum, rec.ayatNum)}
                      title="Voir le verset dans le Coran"
                      style={{
                        padding: "6px 10px",
                        background: "var(--surface3, #222736)",
                        border: "1px solid var(--border2, #363c52)",
                        borderRadius: 6,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontWeight: 500,
                        color: "var(--text, #e8e4d8)",
                      }}
                    >
                      📖 Voir
                    </button>
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDelete(rec)}
                          style={{
                            padding: "6px 10px",
                            background: "rgba(224,90,90,.2)",
                            color: "var(--red, #e05a5a)",
                            border: "1px solid var(--red, #e05a5a)",
                            borderRadius: 6,
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            padding: "6px 10px",
                            background: "var(--surface3, #222736)",
                            color: "var(--text2, #a89f8c)",
                            border: "1px solid var(--border2, #363c52)",
                            borderRadius: 6,
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(rec.id)}
                        title="Supprimer l'enregistrement"
                        style={{
                          padding: "6px 10px",
                          background: "rgba(224, 90, 90, 0.12)",
                          color: "var(--red, #e05a5a)",
                          border: "1px solid rgba(224, 90, 90, 0.3)",
                          borderRadius: 6,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        🗑 Supprimer
                      </button>
                    )}
                  </div>
                </div>

                {rec.text && (
                  <div
                    style={{
                      fontFamily: "'Amiri Quran', 'Amiri', serif",
                      fontSize: "1.2rem",
                      direction: "rtl",
                      textAlign: "right",
                      color: "var(--text, #e8e4d8)",
                      background: "var(--surface, #13161f)",
                      padding: "10px 14px",
                      borderRadius: 8,
                    }}
                  >
                    {rec.text}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => togglePlay(rec.id)}
                    style={{
                      padding: "8px 16px",
                      background: isPlaying ? "var(--red, #e05a5a)" : "var(--gold, #c9a84c)",
                      color: isPlaying ? "#ffffff" : "#0c0e14",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{isPlaying ? "⏸" : "▶"}</span>
                    <span>{isPlaying ? "Pause" : "Écouter"}</span>
                  </button>

                  {rec.blob && (
                    <button
                      type="button"
                      onClick={() => downloadRecordingFile(rec)}
                      style={{
                        padding: "8px 14px",
                        background: "var(--surface3, #222736)",
                        color: "var(--teal2, #56d4bc)",
                        border: "1px solid rgba(62,184,160,.35)",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      ⬇ Télécharger
                    </button>
                  )}

                  {cloudAvailable && !rec.cloudUrl && (
                    <button
                      type="button"
                      onClick={() => handleSyncSingleToCloud(rec)}
                      disabled={syncingId === rec.id}
                      style={{
                        padding: "8px 14px",
                        background: "rgba(201,168,76,.12)",
                        color: "var(--gold2, #e8c96e)",
                        border: "1px solid rgba(201,168,76,.35)",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      {syncingId === rec.id ? "⏳ Envoi..." : "☁ Sauver"}
                    </button>
                  )}

                  {srcUrl && (
                    <audio
                      ref={(el) => {
                        if (el) audioRefs.current[rec.id] = el;
                      }}
                      src={srcUrl}
                      onEnded={() => setPlayingId(null)}
                      onPause={() => {
                        if (playingId === rec.id) setPlayingId(null);
                      }}
                      style={{ display: "none" }}
                    />
                  )}

                  {rec.score !== undefined && (
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text2, #a89f8c)" }}>
                      Score de récitation : <span style={{ color: "var(--gold2, #e8c96e)" }}>{Math.round(rec.score)}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
