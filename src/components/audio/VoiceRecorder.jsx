import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions, errorActions } from "../../store.js";
import { ERROR_CODES, normalizeError } from "../../utils/errorManager.js";
import {
  saveRecording,
  loadRecordings,
  deleteRecording,
  downloadRecordingFile,
  requestPersistentStorage,
} from "../../utils/recordingsDb.js";
import {
  AUDIO_COMPRESSION_PRESETS,
  createAudioRecorder,
  formatFileSize,
  getCompressionPresetConfig,
  IS_ANDROID,
} from "../../utils/audioRecorder.js";
import {
  canSyncRecordingsToCloud,
  uploadRecordingToCloud,
  deleteRecordingFromCloud,
} from "../../utils/recordingsCloudSync.js";
import { MiniAudioPlayer } from "./MiniAudioPlayer.jsx";
import { ComparePlayer } from "./ComparePlayer.jsx";

const PRESET_LIST = Object.values(AUDIO_COMPRESSION_PRESETS);

export function VoiceRecorder({ ayat, surahNum, originalAudioUrl, localAudioRef }) {
  const ayatNum = ayat?.numberInSurah ?? 1;
  const ayatKey = `${surahNum}:${ayatNum}`;
  const dispatch = useDispatch();
  const compressionPreset = useSelector(sel.voiceCompressionPreset);
  const storagePersisted = useSelector(sel.storagePersisted);

  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [compareId, setCompareId] = useState(null);
  const [micGain, setMicGain] = useState(4.0);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [localError, setLocalError] = useState(null);

  const audioRecRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const blobUrlCacheRef = useRef(new Map());

  const cloudAvailable = canSyncRecordingsToCloud();
  const activePresetCfg = getCompressionPresetConfig(compressionPreset);

  const refreshRecordings = useCallback(async () => {
    try {
      const list = await loadRecordings(ayatKey);
      setRecordings(list);
    } catch (err) {
      const appErr = normalizeError(err, ERROR_CODES.STORAGE_ERROR, "Erreur de lecture des enregistrements");
      setLocalError(appErr.message);
      dispatch(errorActions.reportError(appErr));
    }
  }, [ayatKey, dispatch]);

  useEffect(() => {
    refreshRecordings();
  }, [refreshRecordings]);

  useEffect(() => {
    const cache = blobUrlCacheRef.current;
    return () => {
      clearInterval(timerRef.current);
      audioRecRef.current?.release();
      cache.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      cache.clear();
    };
  }, []);

  const fmtTime = (ms) => {
    const s = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const getBlobUrl = useCallback((rec) => {
    if (!rec?.blob) return rec?.cloudUrl || "";
    const cached = blobUrlCacheRef.current.get(rec.id);
    if (cached) return cached;
    const url = URL.createObjectURL(rec.blob);
    blobUrlCacheRef.current.set(rec.id, url);
    return url;
  }, []);

  const handleCloudUpload = useCallback(
    async (rec) => {
      setUploadingId(rec.id);
      setLocalError(null);
      const result = await uploadRecordingToCloud(rec);
      setUploadingId(null);
      if (!result.ok) {
        setLocalError(result.error?.message || "Sauvegarde cloud échouée");
        if (result.error) dispatch(errorActions.reportError(result.error));
        return false;
      }
      await refreshRecordings();
      return true;
    },
    [dispatch, refreshRecordings]
  );

  const startRec = async () => {
    setLocalError(null);
    try {
      if (IS_ANDROID) {
        try {
          localAudioRef?.current?.pause();
        } catch {}
      }
      const arec = createAudioRecorder({ preset: compressionPreset });
      audioRecRef.current = arec;
      await arec.start(micGain, { preset: compressionPreset });
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 200);
    } catch (err) {
      const appErr = normalizeError(
        err,
        ERROR_CODES.RECORDING_ERROR,
        "Impossible d'accéder au microphone"
      );
      setLocalError(appErr.message);
      dispatch(errorActions.reportError(appErr));
    }
  };

  const stopRec = async () => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    try {
      const activeCfg = audioRecRef.current?.getCompressionConfig?.() || activePresetCfg;
      const url = await audioRecRef.current?.stop();
      audioRecRef.current = null;
      if (!url) return;

      let blob;
      try {
        const r = await fetch(url);
        blob = await r.blob();
      } catch (err) {
        const appErr = normalizeError(err, ERROR_CODES.RECORDING_ERROR, "Lecture du flux audio échouée");
        setLocalError(appErr.message);
        dispatch(errorActions.reportError(appErr));
        return;
      } finally {
        if (String(url).startsWith("blob:")) {
          try {
            URL.revokeObjectURL(url);
          } catch {}
        }
      }
      if (!blob || blob.size === 0) return;

      const duration = Date.now() - startTimeRef.current;
      const id = Date.now();
      const rec = {
        id,
        ayatKey,
        surahNum: Number(surahNum) || 1,
        ayatNum: Number(ayatNum) || 1,
        text: ayat?.text || "",
        date: new Date(id).toISOString(),
        timestamp: id,
        duration,
        durationMs: duration,
        mimeType: blob.type || "audio/webm",
        sizeBytes: blob.size,
        compressionPreset: activeCfg.id,
        bitrateKbps: activeCfg.bitrateKbps,
        blob,
      };
      const saved = await saveRecording(rec);

      if (!storagePersisted) {
        const persistRes = await requestPersistentStorage();
        if (persistRes.persisted) {
          dispatch(uiActions.setStoragePersisted(true));
        }
      }

      await refreshRecordings();
      setExpandedId(id);

      if (cloudAvailable) {
        handleCloudUpload(saved);
      }
    } catch (err) {
      const appErr = normalizeError(err, ERROR_CODES.RECORDING_ERROR, "Erreur lors de l'arrêt de l'enregistrement");
      setLocalError(appErr.message);
      dispatch(errorActions.reportError(appErr));
    }
  };

  const handleDelete = async (rec) => {
    try {
      await deleteRecording(rec.id);
      if (rec.storagePath || rec.cloudUrl) {
        await deleteRecordingFromCloud(rec);
      }
      const cachedUrl = blobUrlCacheRef.current.get(rec.id);
      if (cachedUrl) {
        try {
          URL.revokeObjectURL(cachedUrl);
        } catch {}
        blobUrlCacheRef.current.delete(rec.id);
      }
      setRecordings((prev) => prev.filter((x) => x.id !== rec.id));
      if (expandedId === rec.id) setExpandedId(null);
      if (compareId === rec.id) setCompareId(null);
      setConfirmDeleteId(null);
    } catch (err) {
      const appErr = normalizeError(err, ERROR_CODES.STORAGE_ERROR, "Suppression impossible");
      setLocalError(appErr.message);
      dispatch(errorActions.reportError(appErr));
    }
  };

  return (
    <div className="rec-wrap" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {localError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(224,90,90,.12)",
            border: "1px solid rgba(224,90,90,.35)",
            color: "var(--red, #e05a5a)",
            fontSize: 11,
          }}
        >
          <span>⚠ {localError}</span>
          <button
            type="button"
            onClick={() => setLocalError(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 700,
            }}
            aria-label="Fermer l'alerte"
          >
            ✕
          </button>
        </div>
      )}

      {/* Gain + Compression Controls */}
      {!isRecording && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 10,
            background: "var(--surface2, #1a1e2a)",
            border: "1px solid var(--border, #2a2f40)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--text3, #6e6659)", fontFamily: "'Cinzel',serif", flexShrink: 0 }}>
              🎤 GAIN
            </span>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              value={micGain}
              onChange={(e) => setMicGain(Number(e.target.value))}
              aria-label="Gain du microphone"
              style={{ flex: 1, accentColor: "var(--teal, #3eb8a0)" }}
            />
            <span style={{ fontSize: 10, color: "var(--teal2, #56d4bc)", fontFamily: "'Cinzel',serif", width: 28, textAlign: "right" }}>
              {micGain}×
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--text3, #6e6659)", fontFamily: "'Cinzel',serif" }}>
              🎧 OPUS MONO
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {PRESET_LIST.map((preset) => {
                const active = activePresetCfg.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => dispatch(uiActions.setVoiceCompressionPreset(preset.id))}
                    title={preset.description}
                    aria-pressed={active}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: `1px solid ${active ? "var(--teal, #3eb8a0)" : "var(--border, #2a2f40)"}`,
                      background: active ? "rgba(62,184,160,.16)" : "transparent",
                      color: active ? "var(--teal2, #56d4bc)" : "var(--text2, #a89f8c)",
                      fontSize: 10,
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      minHeight: 28,
                    }}
                  >
                    {preset.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: 10, color: "var(--text3, #6e6659)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
            <span>{activePresetCfg.description}</span>
            <span>{storagePersisted ? "🔒 Stockage protégé" : "💾 IndexedDB local"}</span>
          </div>
        </div>
      )}

      {/* Record button */}
      <button
        type="button"
        className={`rec-btn ${isRecording ? "recording" : "idle"}`}
        onClick={isRecording ? stopRec : startRec}
      >
        <div className="rec-dot" />
        {isRecording ? (
          <>
            <span className="rec-timer">{fmtTime(elapsed)}</span>
            <span>ARRÊTER L&apos;ENREGISTREMENT</span>
          </>
        ) : (
          "🎙 ENREGISTRER MA RÉCITATION"
        )}
      </button>

      {recordings.length === 0 && !isRecording && (
        <div style={{ textAlign: "center", fontSize: 10, letterSpacing: 1.2, color: "var(--text3, #6e6659)", padding: "10px 0" }}>
          Aucun enregistrement — appuyez sur le bouton pour commencer
        </div>
      )}

      {/* Recordings list */}
      {recordings.length > 0 && (
        <div className="rec-list">
          <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--text3, #6e6659)" }}>
            {recordings.length} ENREGISTREMENT{recordings.length > 1 ? "S" : ""}
          </div>
          {[...recordings].reverse().map((rec) => {
            const isExpanded = expandedId === rec.id;
            const isCompare = compareId === rec.id;
            const isConfirming = confirmDeleteId === rec.id;
            const isUploading = uploadingId === rec.id;
            const url = getBlobUrl(rec);
            const sizeLabel = rec.sizeBytes ? formatFileSize(rec.sizeBytes) : "";

            return (
              <div key={rec.id} className="rec-item">
                <div className="rec-item-header" style={{ flexWrap: "wrap" }}>
                  <div className="rec-item-icon">🎙</div>
                  <div className="rec-item-info">
                    <div className="rec-item-date">
                      {new Date(rec.date || rec.timestamp).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="rec-item-dur" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{fmtTime(rec.durationMs ?? rec.duration)}</span>
                      {sizeLabel && (
                        <span style={{ fontSize: 10, color: "var(--text2, #a89f8c)", fontFamily: "sans-serif" }}>
                          {sizeLabel} · {rec.bitrateKbps || 32} kbps
                        </span>
                      )}
                      {rec.cloudUrl && (
                        <span style={{ fontSize: 10, color: "var(--teal2, #56d4bc)", fontFamily: "sans-serif" }}>
                          ☁ Cloud
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rec-item-actions" style={{ flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                      style={isExpanded ? { borderColor: "var(--teal)", color: "var(--teal2)" } : {}}
                    >
                      {isExpanded ? "▲" : "▶ ÉCOUTER"}
                    </button>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => setCompareId(isCompare ? null : rec.id)}
                      style={isCompare ? { borderColor: "var(--gold)", color: "var(--gold2)" } : {}}
                    >
                      ⇌ COMPARER
                    </button>
                    {rec.blob && (
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => downloadRecordingFile(rec)}
                        title="Télécharger le fichier audio"
                        aria-label="Télécharger l'enregistrement"
                      >
                        ⬇
                      </button>
                    )}
                    {cloudAvailable && !rec.cloudUrl && (
                      <button
                        type="button"
                        className="btn-small"
                        disabled={isUploading}
                        onClick={() => handleCloudUpload(rec)}
                        title="Sauvegarder dans Firebase Storage"
                      >
                        {isUploading ? "⏳" : "☁"}
                      </button>
                    )}
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          className="btn-small"
                          onClick={() => handleDelete(rec)}
                          style={{ borderColor: "var(--red)", color: "var(--red)", fontWeight: 700 }}
                        >
                          Oui
                        </button>
                        <button
                          type="button"
                          className="btn-small"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Non
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => setConfirmDeleteId(rec.id)}
                        aria-label="Supprimer l'enregistrement"
                        style={{ borderColor: "var(--red)", color: "var(--red)" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && url && <MiniAudioPlayer src={url} color="var(--teal2)" />}

                {isCompare && url && (
                  <ComparePlayer userSrc={url} refSrc={originalAudioUrl} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
