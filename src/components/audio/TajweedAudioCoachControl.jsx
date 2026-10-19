import React, { useState, useMemo, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, playerActions } from "../../store.js";
import {
  extractAyatTajweedTimestamps,
  speakTajweedAnnouncement,
  stopTajweedSpeech,
  playTajweedAlertSound
} from "../../utils/tajweedAudioCoach.js";

export function TajweedAudioCoachControl({
  timestamps = null,
  ayatText = "",
  surahNum = null,
  ayatNum = null,
  compact = true,
  onLoadTimestamps = null,
}) {
  const dispatch = useDispatch();
  const [showOptions, setShowOptions] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const containerRef = useRef(null);

  // Redux state
  const isCoachEnabled = useSelector(sel.tajweedCoachEnabled);
  const coachLang = useSelector(sel.tajweedCoachLang);
  const autoResume = useSelector(sel.tajweedCoachAutoResume);
  const delaySec = useSelector(sel.tajweedCoachDelay);
  const playSound = useSelector(sel.tajweedCoachSound);
  const ruleMap = useSelector(sel.tajweedCoachRulesEnabled) || {};

  // Calculate timestamped Tajweed rules for the current ayat
  const tajweedItems = useMemo(() => {
    return extractAyatTajweedTimestamps(ayatText, timestamps);
  }, [ayatText, timestamps]);

  // Close options popover when clicking outside
  useEffect(() => {
    if (!showOptions) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowOptions(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showOptions]);

  const toggleEnabled = (e) => {
    e?.stopPropagation();
    dispatch(playerActions.setTajweedCoachEnabled(!isCoachEnabled));
  };

  const handleTestRule = async (item) => {
    if (testingId === item.id) {
      stopTajweedSpeech();
      setTestingId(null);
      return;
    }
    setTestingId(item.id);
    await speakTajweedAnnouncement(item, coachLang, playSound);
    setTestingId(null);
  };

  return (
    <div
      ref={containerRef}
      className="tajweed-coach-control"
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      {/* Trigger Button */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        <button
          type="button"
          className={`ctrl-btn tajweed-coach-trigger${isCoachEnabled ? " loop-on" : ""}`}
          onClick={toggleEnabled}
          title={
            isCoachEnabled
              ? "Coach Vocal Tajwid ACTIF (Pause & annonce vocale avant chaque règle)"
              : "Activer le Coach Vocal Tajwid (Pause & annonce vocale à chaque règle)"
          }
          style={{
            position: "relative",
            background: isCoachEnabled ? "rgba(45, 212, 191, 0.22)" : "rgba(255, 255, 255, 0.05)",
            border: isCoachEnabled ? "1.5px solid #2dd4bf" : "1px solid rgba(255, 255, 255, 0.12)",
            color: isCoachEnabled ? "#2dd4bf" : "var(--text2, #94a3b8)",
            fontSize: 13,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isCoachEnabled ? "0 0 10px rgba(45, 212, 191, 0.35)" : "none",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        >
          <span style={{ fontSize: 13, marginRight: 2 }}>☪</span>
          <span style={{ fontSize: 10, letterSpacing: -0.5 }}>🎙</span>

          {tajweedItems.length > 0 && (
            <span
              style={{
                position: "absolute",
                top: -3,
                right: -4,
                background: isCoachEnabled ? "#2dd4bf" : "var(--text3, #64748b)",
                color: "#0f172a",
                borderRadius: "50%",
                fontSize: 9,
                fontWeight: 800,
                width: 14,
                height: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1
              }}
            >
              {tajweedItems.length}
            </span>
          )}
        </button>

        {/* Small settings gear button to open configuration */}
        <button
          type="button"
          onClick={() => setShowOptions(v => !v)}
          title="Paramètres du Coach Vocal Tajwid"
          style={{
            background: "transparent",
            border: "none",
            color: showOptions ? "#2dd4bf" : "var(--text3, #64748b)",
            cursor: "pointer",
            fontSize: 11,
            padding: "2px 4px",
            lineHeight: 1,
            opacity: 0.8
          }}
        >
          ⚙
        </button>
      </div>

      {/* Popover / Options Sheet */}
      {showOptions && (
        <div
          className="tajweed-coach-popover"
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            right: 0,
            width: 320,
            maxHeight: "75vh",
            overflowY: "auto",
            background: "var(--surface, #1e293b)",
            border: "1.5px solid var(--border, #334155)",
            borderRadius: 14,
            padding: "16px",
            boxShadow: "0 16px 36px rgba(0,0,0,0.5)",
            zIndex: 9999,
            color: "var(--text, #f8fafc)",
            display: "flex",
            flexDirection: "column",
            gap: 14
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#2dd4bf", fontSize: 16 }}>☪🎙</span>
              <strong style={{ fontSize: 13, letterSpacing: 0.5 }}>COACH VOCAL TAJWID</strong>
            </div>
            <button
              type="button"
              onClick={() => setShowOptions(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text3, #94a3b8)",
                cursor: "pointer",
                fontSize: 14
              }}
            >
              ✕
            </button>
          </div>

          <p style={{ fontSize: 11.5, color: "var(--text3, #94a3b8)", lineHeight: 1.45, margin: 0 }}>
            Met automatiquement la récitation en pause juste avant chaque règle de Tajwid et annonce vocalement la règle et la lettre à venir en utilisant les timestamps.
          </p>

          {/* Master Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(255, 255, 255, 0.04)",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255, 255, 255, 0.08)"
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600 }}>Activer le coach vocal</span>
            <button
              type="button"
              onClick={toggleEnabled}
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                border: "none",
                background: isCoachEnabled ? "#2dd4bf" : "var(--surface2, #334155)",
                color: isCoachEnabled ? "#0f172a" : "var(--text3, #94a3b8)",
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              {isCoachEnabled ? "ACTIF" : "INACTIF"}
            </button>
          </div>

          {/* Rules Pause Configuration */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3, #94a3b8)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Règles avec pause & annonce vocale
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { id: "qalqala", label: "Qalqala (Rebond)" },
                { id: "iqlab", label: "Iqlâb (Mîm)" },
                { id: "ikhfa", label: "Ikhfâ (Dissimulation)" },
                { id: "izhar", label: "Iẓhâr (Clarté)" },
                { id: "idgham", label: "Idghâm (Fusion)" },
                { id: "ghunnah", label: "Ghunnah (Nasal)" },
                { id: "madd", label: "Madd (Allongement)" }
              ].map(rule => {
                const isOn = ruleMap[rule.id] ?? true;
                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => dispatch(playerActions.toggleTajweedCoachRule(rule.id))}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 8,
                      fontSize: 11,
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: isOn ? "rgba(45, 212, 191, 0.15)" : "rgba(255, 255, 255, 0.03)",
                      border: isOn ? "1px solid #2dd4bf" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: isOn ? "#2dd4bf" : "var(--text3, #94a3b8)",
                      cursor: "pointer"
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rule.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700 }}>{isOn ? "✓" : "×"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language Selection */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3, #94a3b8)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Langue de l'annonce vocale
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[
                { id: "fr", label: "Français" },
                { id: "ar", label: "العربية" },
                { id: "both", label: "Bilingue" }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => dispatch(playerActions.setTajweedCoachLang(opt.id))}
                  style={{
                    padding: "6px 4px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: coachLang === opt.id ? 700 : 500,
                    background: coachLang === opt.id ? "rgba(45, 212, 191, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: coachLang === opt.id ? "1px solid #2dd4bf" : "1px solid rgba(255, 255, 255, 0.08)",
                    color: coachLang === opt.id ? "#2dd4bf" : "var(--text2, #cbd5e1)",
                    cursor: "pointer"
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-resume & delay */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11.5, color: "var(--text2, #cbd5e1)" }}>Reprise automatique</span>
              <button
                type="button"
                onClick={() => dispatch(playerActions.setTajweedCoachAutoResume(!autoResume))}
                style={{
                  padding: "3px 10px",
                  borderRadius: 14,
                  fontSize: 10.5,
                  fontWeight: 600,
                  border: "none",
                  background: autoResume ? "#10b981" : "var(--surface2, #334155)",
                  color: autoResume ? "#ffffff" : "var(--text3, #94a3b8)",
                  cursor: "pointer"
                }}
              >
                {autoResume ? "OUI" : "MANUELLE"}
              </button>
            </div>

            {autoResume && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--text3, #94a3b8)" }}>Délai de pause</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 1.5, 2, 3].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => dispatch(playerActions.setTajweedCoachDelay(sec))}
                      style={{
                        padding: "3px 6px",
                        borderRadius: 6,
                        fontSize: 10.5,
                        background: delaySec === sec ? "rgba(45, 212, 191, 0.25)" : "rgba(255, 255, 255, 0.04)",
                        border: delaySec === sec ? "1px solid #2dd4bf" : "1px solid transparent",
                        color: delaySec === sec ? "#2dd4bf" : "var(--text3, #94a3b8)",
                        cursor: "pointer"
                      }}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chime toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11.5, color: "var(--text2, #cbd5e1)" }}>Carillon sonore d'alerte</span>
              <button
                type="button"
                onClick={() => {
                  dispatch(playerActions.setTajweedCoachSound(!playSound));
                  if (!playSound) playTajweedAlertSound();
                }}
                style={{
                  padding: "3px 10px",
                  borderRadius: 14,
                  fontSize: 10.5,
                  fontWeight: 600,
                  border: "none",
                  background: playSound ? "rgba(251, 191, 36, 0.25)" : "var(--surface2, #334155)",
                  color: playSound ? "#fbbf24" : "var(--text3, #94a3b8)",
                  cursor: "pointer"
                }}
              >
                {playSound ? "🔔 ACTIF" : "SILENCIEUX"}
              </button>
            </div>
          </div>

          {/* List of Tajweed occurrences in this verse */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3, #94a3b8)", textTransform: "uppercase" }}>
                Règles dans ce verset ({tajweedItems.length})
              </span>
              {timestamps == null && onLoadTimestamps && (
                <button
                  type="button"
                  onClick={onLoadTimestamps}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--gold2, #f59e0b)",
                    fontSize: 10.5,
                    cursor: "pointer"
                  }}
                >
                  Charger timestamps
                </button>
              )}
            </div>

            {tajweedItems.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--text3, #94a3b8)", fontStyle: "italic", padding: "6px 0" }}>
                Aucune règle de Tajweed spécifique détectée dans ce verset.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 150, overflowY: "auto" }}>
                {tajweedItems.map(item => {
                  const isTesting = testingId === item.id;
                  const secStr = item.startMs != null ? `${(item.startMs / 1000).toFixed(1)}s` : "estimé";
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        background: "rgba(255, 255, 255, 0.03)",
                        borderRadius: 8,
                        borderLeft: `3px solid ${item.color}`
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              fontFamily: "'Amiri Quran', serif",
                              fontSize: 15,
                              color: item.color
                            }}
                          >
                            {item.char}
                          </span>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text, #f8fafc)" }}>
                            {item.ruleNameFr}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text3, #94a3b8)" }}>
                          Lettre : {item.letterNameFr} {item.matchedWith ? `devant ${item.matchedLetterNameFr || item.matchedWith}` : ""} • {secStr}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTestRule(item)}
                        title="Tester l'annonce audio de cette règle"
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 600,
                          background: isTesting ? "#ef4444" : "rgba(255, 255, 255, 0.08)",
                          color: isTesting ? "#ffffff" : "var(--text2, #cbd5e1)",
                          border: "none",
                          cursor: "pointer",
                          flexShrink: 0
                        }}
                      >
                        {isTesting ? "Arrêter" : "Tester 🔊"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
