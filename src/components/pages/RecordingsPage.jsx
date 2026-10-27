import React, { useState, useEffect } from "react";
import { getAllRecordings, deleteRecording } from "../../utils/recordingsDb.js";
import { SURAH_NAMES } from "../../utils/voiceCommand.js";
import { safePlayAudio, safePauseAudio } from "../../utils/safeAudioPlayer.js";

export function RecordingsPage({ onNavigate, showQalqala, showMadd, showIzhar, showIdgham }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [playingId, setPlayingId] = useState(null);
  const audioRefs = React.useRef({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const all = await getAllRecordings();
      // Sort newest first
      all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecordings(all);
    } catch (e) {
      console.error("Error loading recordings:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cet enregistrement vocal ?")) return;
    try {
      await deleteRecording(id);
      setRecordings(prev => prev.filter(r => r.id !== id));
      if (playingId === id) {
        setPlayingId(null);
      }
    } catch (e) {
      console.error("Error deleting recording:", e);
    }
  };

  const togglePlay = (id, blob) => {
    const audio = audioRefs.current[id];
    if (!audio) return;
    if (playingId === id) {
      safePauseAudio(audio);
      setPlayingId(null);
    } else {
      // Pause any currently playing
      Object.entries(audioRefs.current).forEach(([k, el]) => {
        if (el && k !== id) safePauseAudio(el);
      });
      safePlayAudio(audio, () => {
        setPlayingId(id);
      });
    }
  };

  const filtered = recordings.filter(rec => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const surahName = (SURAH_NAMES[rec.surahNum] || "").toLowerCase();
    const surahNumStr = String(rec.surahNum || "");
    const ayatNumStr = String(rec.ayatNum || "");
    const textStr = (rec.text || "").toLowerCase();
    return surahName.includes(q) || surahNumStr.includes(q) || ayatNumStr.includes(q) || textStr.includes(q);
  });

  return (
    <div className="recordings-page" style={{ padding: "20px 16px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-main, #1e293b)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🎙</span> Enregistrements Vocaux
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted, #64748b)", marginTop: 4 }}>
            Retrouvez tous vos enregistrements de récitation et entraînements vocaux.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Filtrer par sourate, verset..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--bg-card, #ffffff)",
              color: "var(--text-main, #1e293b)",
              fontSize: "0.9rem",
              outline: "none",
              width: 220
            }}
          />
          <button
            type="button"
            onClick={loadAll}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--bg-card, #ffffff)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
              color: "var(--text-main, #1e293b)"
            }}
          >
            Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted, #64748b)" }}>
          Chargement de vos enregistrements...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          background: "var(--bg-card, #ffffff)",
          borderRadius: 12,
          border: "1px dashed var(--border-color, #cbd5e1)"
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🎙️</div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 6, color: "var(--text-main, #1e293b)" }}>
            Aucun enregistrement vocal trouvé
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted, #64748b)", maxWidth: 450, margin: "0 auto 16px" }}>
            {recordings.length === 0
              ? "Vous n'avez pas encore effectué d'enregistrements. Rendez-vous dans le mode Lecture d'un verset pour enregistrer votre récitation."
              : "Aucun enregistrement ne correspond à votre recherche."}
          </p>
          {recordings.length === 0 && (
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("quran")}
              style={{
                padding: "10px 20px",
                background: "var(--gold1, #d97706)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Aller au Coran
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)", marginBottom: 4 }}>
            {filtered.length} enregistrement{filtered.length > 1 ? "s" : ""} trouvé{filtered.length > 1 ? "s" : ""}
          </div>
          {filtered.map(rec => {
            const dateStr = rec.timestamp ? new Date(rec.timestamp).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "";
            const surahName = SURAH_NAMES[rec.surahNum] || `Sourate ${rec.surahNum}`;
            const isPlaying = playingId === rec.id;

            return (
              <div
                key={rec.id}
                style={{
                  background: "var(--bg-card, #ffffff)",
                  borderRadius: 12,
                  padding: "16px",
                  border: "1px solid var(--border-color, #e2e8f0)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        background: "var(--gold-light, #fef3c7)",
                        color: "var(--gold-dark, #b45309)",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: 700
                      }}>
                        S. {rec.surahNum} • V. {rec.ayatNum}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main, #1e293b)" }}>
                        {surahName}
                      </span>
                    </div>
                    {dateStr && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)" }}>
                        {dateStr} {rec.duration ? `• Durée : ${Math.round(rec.duration)}s` : ""}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate("quran", { surah: rec.surahNum, ayat: rec.ayatNum })}
                        title="Voir le verset dans le Coran"
                        style={{
                          padding: "6px 10px",
                          background: "var(--bg-hover, #f1f5f9)",
                          border: "1px solid var(--border-color, #cbd5e1)",
                          borderRadius: 6,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          fontWeight: 500,
                          color: "var(--text-main, #1e293b)"
                        }}
                      >
                        📖 Voir
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(rec.id)}
                      title="Supprimer l'enregistrement"
                      style={{
                        padding: "6px 10px",
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "#dc2626",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        borderRadius: 6,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontWeight: 500
                      }}
                    >
                      🗑 Supprimer
                    </button>
                  </div>
                </div>

                {rec.text && (
                  <div style={{
                    fontFamily: "var(--font-arabic, 'Amiri', serif)",
                    fontSize: "1.2rem",
                    direction: "rtl",
                    textAlign: "right",
                    color: "var(--text-arabic, #0f172a)",
                    background: "var(--bg-arabic, #f8fafc)",
                    padding: "10px 14px",
                    borderRadius: 8
                  }}>
                    {rec.text}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => togglePlay(rec.id, rec.blob)}
                    style={{
                      padding: "8px 16px",
                      background: isPlaying ? "#ef4444" : "var(--gold1, #d97706)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <span>{isPlaying ? "⏸" : "▶"}</span>
                    <span>{isPlaying ? "Pause" : "Écouter"}</span>
                  </button>

                  {rec.blob && (
                    <audio
                      ref={el => { if (el) audioRefs.current[rec.id] = el; }}
                      src={URL.createObjectURL(rec.blob)}
                      onEnded={() => setPlayingId(null)}
                      onPause={() => { if (playingId === rec.id) setPlayingId(null); }}
                      style={{ display: "none" }}
                    />
                  )}

                  {rec.score !== undefined && (
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted, #64748b)" }}>
                      Score de récitation : <span style={{ color: "var(--gold1, #d97706)" }}>{Math.round(rec.score)}%</span>
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
