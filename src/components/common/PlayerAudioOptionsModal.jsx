import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, playerActions } from "../../store.js";
import { TajweedAudioCoachControl } from "../audio/TajweedAudioCoachControl.jsx";
import { SilenceReviseControl } from "../audio/SilenceReviseControl.jsx";
import { detectSheetDismissGesture, detectTabSwipeGesture } from "../../utils/swipeNavigation.js";

export function PlayerAudioOptionsModal({
  isOpen,
  onClose,
  currentMainAyat,
  selectedSurah,
  timestampsMap,
  learnData,
  mainCurrentMs,
  isPlaying,
  onLoadTimestamps,
  loopActive,
  setLoopActive,
  loopStart,
  setLoopStart,
  loopEnd,
  setLoopEnd,
  loopMax,
  setLoopMax,
  loopCount,
  setLoopCount,
  activeRecitator,
  recitatorId,
  onOpenReciterPicker,
  totalAyahs = 1,
}) {
  const [activeTab, setActiveTab] = useState("tajweed"); // "tajweed" | "silence" | "loop" | "reciter"
  const dispatch = useDispatch();
  const touchStartRef = useRef(null);
  const MODAL_TABS = ["tajweed", "silence", "loop", "reciter"];

  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches?.[0];
    if (!t) {
      touchStartRef.current = null;
      return;
    }
    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;
    const endX = t.clientX;
    const endY = t.clientY;
    touchStartRef.current = null;

    // 1. Pull down to dismiss
    const dismissRes = detectSheetDismissGesture({
      startY,
      endY,
      startX,
      endX,
      minDismissDistance: 60,
    });
    if (dismissRes.shouldDismiss) {
      onClose();
      return;
    }

    // 2. Horizontal swipe across modal tabs
    const tabRes = detectTabSwipeGesture({
      startX,
      endX,
      startY,
      endY,
      currentTab: activeTab,
      tabs: MODAL_TABS,
      minDistance: 45,
    });
    if (tabRes.shouldChange && tabRes.targetTab) {
      setActiveTab(tabRes.targetTab);
    }
  };

  const isCoachEnabled = useSelector(sel.tajweedCoachEnabled);
  const silenceWordsToRevise = useSelector(sel.silenceWordsToRevise);
  const silenceMode = useSelector(sel.silenceMode);
  const uxMode = useSelector(sel.uxMode);
  const isChild = uxMode === "child";

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentAyatNum = currentMainAyat?.numberInSurah || 1;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-options-modal-title"
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "linear-gradient(180deg, #171b28 0%, #10131d 100%)",
          border: "1px solid rgba(201, 168, 76, 0.35)",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(201, 168, 76, 0.15)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(90dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
          boxSizing: "border-box",
        }}
      >
        {/* Visual drag handle for swipe-to-dismiss */}
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: "rgba(255, 255, 255, 0.28)",
            margin: "8px auto 2px",
            cursor: "grab",
          }}
        />

        {/* ── Modal Header ────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🎨</span>
            <div>
              <h2
                id="player-options-modal-title"
                style={{
                  margin: 0,
                  fontFamily: "'Cinzel', serif",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: "var(--gold2)",
                }}
              >
                {isChild ? "OPTIONS AUDIO & TAJWID" : "RÉGLAGES AUDIO & TAJWEED"}
              </h2>
              <div style={{ fontSize: 9.5, color: "var(--text3)", marginTop: 2 }}>
                Sourate {selectedSurah?.number} · Ayat {currentAyatNum}
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
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text2)",
              fontSize: 13,
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Tabs Selector ────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            padding: "8px 14px",
            gap: 6,
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
            flexWrap: "wrap",
          }}
        >
          {[
            { id: "tajweed", icon: "🎙️", label: "COACH TAJWID" },
            { id: "silence", icon: "🔇", label: "SILENCES / MOTS" },
            { id: "loop", icon: "↺", label: "BOUCLE" },
            { id: "reciter", icon: "👤", label: "RÉCITATEUR" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: "1 1 auto",
                  padding: "7px 10px",
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9.5,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: 0.8,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: isActive ? "1.5px solid var(--gold)" : "1px solid rgba(255, 255, 255, 0.08)",
                  background: isActive ? "rgba(201, 168, 76, 0.2)" : "rgba(255, 255, 255, 0.03)",
                  color: isActive ? "var(--gold2)" : "var(--text2)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  whiteSpace: "nowrap",
                  transition: "all .15s",
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Modal Body Content ────────────────────────────────────────── */}
        <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* TAB 1: COACH TAJWEED */}
          {activeTab === "tajweed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: isCoachEnabled ? "rgba(45, 212, 191, 0.12)" : "var(--surface2)",
                  border: `1px solid ${isCoachEnabled ? "var(--teal)" : "rgba(255, 255, 255, 0.08)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🎙️</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontFamily: "'Cinzel', serif" }}>
                      Coach Vocal Tajwid
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--text3)", marginTop: 2 }}>
                      Pause prédictive et annonce audio des règles de récitation
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => dispatch(playerActions.setTajweedCoachEnabled(!isCoachEnabled))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 10,
                    fontFamily: "'Cinzel', serif",
                    cursor: "pointer",
                    border: isCoachEnabled ? "1.5px solid var(--teal)" : "1px solid var(--border)",
                    background: isCoachEnabled ? "var(--teal)" : "rgba(255,255,255,0.06)",
                    color: isCoachEnabled ? "#10131d" : "var(--text)",
                    transition: "all .15s",
                  }}
                >
                  {isCoachEnabled ? "ACTIF ✓" : "ACTIVER"}
                </button>
              </div>

              {/* Inline Coach Control Component */}
              <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                <TajweedAudioCoachControl
                  compact={false}
                  timestamps={timestampsMap}
                  ayatText={currentMainAyat?.text || ""}
                  surahNum={selectedSurah?.number}
                  ayatNum={currentAyatNum}
                  onLoadTimestamps={onLoadTimestamps}
                />
              </div>
            </div>
          )}

          {/* TAB 2: SILENCES & MOTS À RÉVISER */}
          {activeTab === "silence" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: silenceWordsToRevise ? "rgba(201, 168, 76, 0.12)" : "var(--surface2)",
                  border: `1px solid ${silenceWordsToRevise ? "var(--gold)" : "rgba(255, 255, 255, 0.08)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🔇</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontFamily: "'Cinzel', serif" }}>
                      Masquage Audio pour Mémorisation
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--text3)", marginTop: 2 }}>
                      Coupe le son sur les mots cibles pour tester votre récitation
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => dispatch(playerActions.setSilenceWordsToRevise(!silenceWordsToRevise))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 10,
                    fontFamily: "'Cinzel', serif",
                    cursor: "pointer",
                    border: silenceWordsToRevise ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                    background: silenceWordsToRevise ? "var(--gold)" : "rgba(255,255,255,0.06)",
                    color: silenceWordsToRevise ? "#10131d" : "var(--text)",
                    transition: "all .15s",
                  }}
                >
                  {silenceWordsToRevise ? "ACTIF ✓" : "ACTIVER"}
                </button>
              </div>

              {/* Mode Mute vs Skip */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => dispatch(playerActions.setSilenceMode("mute"))}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 10,
                    fontWeight: silenceMode === "mute" ? 700 : 500,
                    fontFamily: "'Cinzel', serif",
                    border: silenceMode === "mute" ? "1px solid var(--gold)" : "1px solid var(--border2)",
                    background: silenceMode === "mute" ? "rgba(201,168,76,0.18)" : "var(--surface2)",
                    color: silenceMode === "mute" ? "var(--gold2)" : "var(--text2)",
                    cursor: "pointer",
                  }}
                >
                  🔇 Mode Silencieux (Garde le tempo)
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(playerActions.setSilenceMode("skip"))}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 10,
                    fontWeight: silenceMode === "skip" ? 700 : 500,
                    fontFamily: "'Cinzel', serif",
                    border: silenceMode === "skip" ? "1px solid var(--teal)" : "1px solid var(--border2)",
                    background: silenceMode === "skip" ? "rgba(46,196,182,0.18)" : "var(--surface2)",
                    color: silenceMode === "skip" ? "var(--teal2)" : "var(--text2)",
                    cursor: "pointer",
                  }}
                >
                  ⏭ Mode Saut (Passe immédiatement)
                </button>
              </div>

              {/* SilenceReviseControl detailed widget */}
              <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                <SilenceReviseControl
                  compact={false}
                  timestamps={timestampsMap}
                  ld={learnData ? learnData[`${selectedSurah?.number}:${currentAyatNum}`] : null}
                  ayatText={currentMainAyat?.text || ""}
                  surahNum={selectedSurah?.number}
                  ayatNum={currentAyatNum}
                  currentMs={mainCurrentMs}
                  isPlaying={isPlaying}
                  onLoadTimestamps={onLoadTimestamps}
                />
              </div>
            </div>
          )}

          {/* TAB 3: BOUCLE DE RÉPÉTITION */}
          {activeTab === "loop" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: loopActive ? "rgba(201, 168, 76, 0.12)" : "var(--surface2)",
                  border: `1px solid ${loopActive ? "var(--gold)" : "rgba(255, 255, 255, 0.08)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>↺</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontFamily: "'Cinzel', serif" }}>
                      Répétition en boucle
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--text3)", marginTop: 2 }}>
                      Répéter le verset actuel ou une plage de versets
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!loopActive) {
                      setLoopActive(true);
                      setLoopStart(currentAyatNum - 1);
                      setLoopEnd(currentAyatNum - 1);
                      if (setLoopCount) setLoopCount(0);
                    } else {
                      setLoopActive(false);
                    }
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 10,
                    fontFamily: "'Cinzel', serif",
                    cursor: "pointer",
                    border: loopActive ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                    background: loopActive ? "var(--gold)" : "rgba(255,255,255,0.06)",
                    color: loopActive ? "#10131d" : "var(--text)",
                    transition: "all .15s",
                  }}
                >
                  {loopActive ? "BOUCLE ACTIVE ✓" : "ACTIVER LA BOUCLE"}
                </button>
              </div>

              {/* Range Selector */}
              <div style={{ padding: 12, background: "var(--surface2)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold2)", fontFamily: "'Cinzel', serif" }}>
                  PLAGE DE VERSETS À BOUCLER
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 9.5, color: "var(--text2)", display: "flex", alignItems: "center", gap: 6 }}>
                    Du verset :
                    <input
                      type="number"
                      min={1}
                      max={totalAyahs}
                      value={loopStart + 1}
                      onChange={(e) => setLoopStart(Math.max(0, Math.min(totalAyahs - 1, Number(e.target.value) - 1)))}
                      style={{
                        width: 50,
                        padding: "4px 6px",
                        background: "var(--surface3)",
                        border: "1px solid var(--border2)",
                        borderRadius: 6,
                        color: "var(--text)",
                        textAlign: "center",
                      }}
                    />
                  </label>
                  <label style={{ fontSize: 9.5, color: "var(--text2)", display: "flex", alignItems: "center", gap: 6 }}>
                    Au verset :
                    <input
                      type="number"
                      min={1}
                      max={totalAyahs}
                      value={loopEnd + 1}
                      onChange={(e) => setLoopEnd(Math.max(loopStart, Math.min(totalAyahs - 1, Number(e.target.value) - 1)))}
                      style={{
                        width: 50,
                        padding: "4px 6px",
                        background: "var(--surface3)",
                        border: "1px solid var(--border2)",
                        borderRadius: 6,
                        color: "var(--text)",
                        textAlign: "center",
                      }}
                    />
                  </label>
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold2)", fontFamily: "'Cinzel', serif", marginTop: 4 }}>
                  NOMBRE DE RÉPÉTITIONS
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { label: "Infini (∞)", value: 0 },
                    { label: "3 fois", value: 3 },
                    { label: "5 fois", value: 5 },
                    { label: "10 fois", value: 10 },
                    { label: "20 fois", value: 20 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLoopMax(opt.value)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 9.5,
                        fontWeight: loopMax === opt.value ? 700 : 500,
                        border: loopMax === opt.value ? "1px solid var(--gold)" : "1px solid var(--border2)",
                        background: loopMax === opt.value ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.03)",
                        color: loopMax === opt.value ? "var(--gold2)" : "var(--text2)",
                        cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHOIX DU RÉCITATEUR */}
          {activeTab === "reciter" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "var(--surface2)",
                  border: "1px solid rgba(201, 168, 76, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{activeRecitator?.flag || "🎙️"}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold2)", fontFamily: "'Cinzel', serif" }}>
                      {activeRecitator?.label || recitatorId}
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--text3)", marginTop: 2 }}>
                      Récitateur actuellement sélectionné
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReciterPicker();
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 10,
                    fontFamily: "'Cinzel', serif",
                    background: "rgba(201,168,76,0.18)",
                    border: "1px solid var(--gold)",
                    color: "var(--gold2)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  CHANGER DE RÉCITATEUR →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer ────────────────────────────────────────────── */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              background: "var(--gold)",
              border: "1px solid var(--gold2)",
              color: "#10131d",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Cinzel', serif",
              letterSpacing: 0.8,
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
