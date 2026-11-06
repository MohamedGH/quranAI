import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import {
  UX_MODES,
  getAvailableUxProfiles,
  getBeginnerTip,
  isValidUxMode,
} from "../../utils/uxProfileManager.js";
import { triggerQuizHaptic } from "../../utils/quizUtils.js";

export function UxModeSelectorModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const currentUxMode = useSelector(sel.uxMode);
  const showBeginnerGuides = useSelector(sel.showBeginnerGuides);
  const hapticFeedback = useSelector(sel.quizHapticFeedback);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const profiles = getAvailableUxProfiles();

  const handleSelectMode = (modeId) => {
    if (!isValidUxMode(modeId)) return;
    dispatch(uiActions.setUxMode(modeId));
    triggerQuizHaptic("success", hapticFeedback);
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ux-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2600,
        background: "rgba(8, 10, 16, 0.78)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
        animation: "fadeIn .2s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 620,
          background: "linear-gradient(180deg, #171b28 0%, #10131d 100%)",
          border: "1px solid rgba(201, 168, 76, 0.35)",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(201, 168, 76, 0.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(92dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
          boxSizing: "border-box",
        }}
      >
        {/* ── Modal Header ────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(201, 168, 76, 0.14)",
                border: "1px solid rgba(201, 168, 76, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              🧭
            </div>
            <div>
              <h2
                id="ux-modal-title"
                style={{
                  margin: 0,
                  fontFamily: "'Cinzel', serif",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: "var(--gold2)",
                }}
              >
                EXPÉRIENCE & PROFIL UTILISATEUR
              </h2>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                Choisissez l'interface la plus confortable pour vous
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text2)",
              fontSize: 14,
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Guidance Banner ─────────────────────────────────────────── */}
        <div
          style={{
            padding: "10px 22px",
            background: "rgba(201, 168, 76, 0.06)",
            borderBottom: "1px solid rgba(201, 168, 76, 0.15)",
            fontSize: 11,
            color: "var(--text2)",
            lineHeight: 1.5,
          }}
        >
          {getBeginnerTip("general")}
        </div>

        {/* ── Profiles Grid / List ────────────────────────────────────── */}
        <div
          style={{
            padding: "18px 22px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {profiles.map((p) => {
            const isSelected = currentUxMode === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectMode(p.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "14px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  transition: "all .2s ease",
                  border: isSelected
                    ? "2px solid var(--gold)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  background: isSelected
                    ? "rgba(201, 168, 76, 0.10)"
                    : "rgba(255, 255, 255, 0.02)",
                  boxShadow: isSelected
                    ? "0 4px 16px rgba(201, 168, 76, 0.15)"
                    : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        fontSize: 24,
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: isSelected
                          ? "rgba(201, 168, 76, 0.22)"
                          : "rgba(255, 255, 255, 0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {p.icon}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: isSelected ? "var(--gold2)" : "var(--text)",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontFamily: "'Cinzel', serif",
                        }}
                      >
                        {p.name}
                        {isSelected && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              letterSpacing: 0.8,
                              color: "var(--gold)",
                            }}
                          >
                            · ACTIF
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text3)",
                          marginTop: 2,
                        }}
                      >
                        {p.targetAudience}
                      </div>
                    </div>
                  </div>

                  {/* Radio / Selection Indicator */}
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: isSelected
                        ? "2px solid var(--gold)"
                        : "2px solid rgba(255, 255, 255, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      background: isSelected ? "var(--gold)" : "transparent",
                      transition: "all .15s",
                    }}
                  >
                    {isSelected && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#10131d",
                        }}
                      />
                    )}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text2)",
                    lineHeight: 1.5,
                    paddingTop: 2,
                  }}
                >
                  {p.description}
                </div>

                {/* Features List */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    paddingTop: 6,
                    borderTop: "1px dashed rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {p.features.map((feat, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        fontSize: 11,
                        color: isSelected ? "var(--text)" : "var(--text3)",
                        lineHeight: 1.4,
                      }}
                    >
                      <span
                        style={{
                          color: isSelected ? "var(--gold)" : "var(--teal2)",
                          fontSize: 12,
                          lineHeight: 1,
                        }}
                      >
                        ✓
                      </span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* ── Beginner Guides Toggle ─────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              marginTop: 4,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                Aides et infobulles pas-à-pas
              </div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
                Affiche des conseils d'aide contextuels pour guider la lecture
              </div>
            </div>
            <button
              onClick={() => dispatch(uiActions.toggleBeginnerGuides())}
              role="switch"
              aria-checked={showBeginnerGuides}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                cursor: "pointer",
                background: showBeginnerGuides ? "var(--gold)" : "rgba(255, 255, 255, 0.15)",
                border: "none",
                position: "relative",
                transition: "background .2s",
                padding: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: showBeginnerGuides ? 22 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  transition: "left .2s",
                }}
              />
            </button>
          </div>
        </div>

        {/* ── Modal Footer ────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 22px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text3)" }}>
            Actuel : <strong style={{ color: "var(--gold2)" }}>{getAvailableUxProfiles().find(p => p.id === currentUxMode)?.name || "Standard"}</strong>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              background: "var(--gold)",
              border: "1px solid var(--gold2)",
              color: "#10131d",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Cinzel', serif",
              letterSpacing: 0.8,
              transition: "transform .15s, opacity .15s",
            }}
          >
            Valider & Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
