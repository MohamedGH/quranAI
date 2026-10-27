import React, { useState, useEffect } from "react";
import { SUBMENU_MODES, SUBMENU_CATEGORIES, getFilteredSubmenuModes, computeSubmenuBadge } from "../../utils/submenuConfig.js";

export function SubmenuSelectorModal({
  isOpen,
  onClose,
  currentModeId,
  onSelectMode,
  ayat,
  surahNum,
  ld,
  ayatInCollections = [],
  ayatLoopActive = false,
  onSetLoop,
  onCopyVerse,
  onFullScreen,
}) {
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredModes = getFilteredSubmenuModes(activeCategory);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2600,
        background: "rgba(8, 10, 16, 0.8)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn .2s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 580,
          background: "linear-gradient(180deg, #181c28 0%, #11141e 100%)",
          border: "1px solid rgba(201, 168, 76, 0.35)",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.85), 0 0 30px rgba(201,168,76,0.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90dvh",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, color: "var(--gold)" }}>📖</span>
            <div>
              <div
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: "var(--gold2)",
                }}
              >
                SÉLECTEUR DE MODE D'ÉTUDE
              </div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
                Sourate {surahNum} · Verset {ayat?.numberInSurah}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
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

        {/* Category Tabs Bar */}
        <div
          style={{
            display: "flex",
            padding: "10px 20px 0",
            gap: 8,
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {SUBMENU_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: "8px 14px",
                  fontFamily: "'Cinzel', serif",
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: 1,
                  background: isActive ? "rgba(201, 168, 76, 0.15)" : "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                  borderRadius: "6px 6px 0 0",
                  color: isActive ? "var(--gold2)" : "var(--text3)",
                  cursor: "pointer",
                  transition: "all .15s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mode Cards Grid */}
        <div
          style={{
            padding: "16px 20px",
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: 10,
            maxHeight: "50vh",
          }}
        >
          {filteredModes.map((mode) => {
            const isActive = currentModeId === mode.id;
            const badgeInfo = computeSubmenuBadge(mode.id, {
              ayatTajweedCount: 3, // placeholder or dynamic
              ld,
              ayatInCollections,
            });

            return (
              <button
                key={mode.id}
                onClick={() => {
                  onSelectMode(mode.id);
                  onClose();
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 6,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: isActive
                    ? "linear-gradient(135deg, rgba(201,168,76,0.2) 0%, rgba(201,168,76,0.08) 100%)"
                    : "rgba(255, 255, 255, 0.03)",
                  border: `1px solid ${isActive ? "var(--gold)" : "rgba(255, 255, 255, 0.08)"}`,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  position: "relative",
                  boxShadow: isActive ? "0 4px 20px rgba(201,168,76,0.2)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{mode.icon}</span>
                    <span
                      style={{
                        fontFamily: "'Cinzel', serif",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.8,
                        color: isActive ? "var(--gold2)" : "var(--text)",
                      }}
                    >
                      {mode.label}
                    </span>
                  </div>
                  {badgeInfo.badge && (
                    <span
                      title={badgeInfo.badgeTitle}
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 10,
                        background: "rgba(251, 191, 36, 0.22)",
                        border: "1px solid rgba(251, 191, 36, 0.4)",
                        color: "#fbbf24",
                        fontWeight: 700,
                      }}
                    >
                      {badgeInfo.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.4 }}>
                  {mode.description}
                </div>
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 12,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--gold)",
                      boxShadow: "0 0 8px var(--gold)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Footer Quick Actions */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--text3)" }}>
            💡 Astuce : Vous pouvez aussi naviguer entre les modes directement.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onSetLoop && (
              <button
                onClick={() => {
                  onSetLoop();
                  onClose();
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: `1px solid ${ayatLoopActive ? "var(--teal)" : "rgba(255,255,255,0.12)"}`,
                  background: ayatLoopActive ? "rgba(62,184,160,0.2)" : "rgba(255,255,255,0.04)",
                  color: ayatLoopActive ? "var(--teal2)" : "var(--text2)",
                  fontSize: 10,
                  fontFamily: "'Cinzel', serif",
                  cursor: "pointer",
                }}
              >
                {ayatLoopActive ? "↺ Boucle active" : "↺ Boucler"}
              </button>
            )}
            {onFullScreen && (
              <button
                onClick={() => {
                  onFullScreen();
                  onClose();
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(201,168,76,0.35)",
                  background: "rgba(201,168,76,0.1)",
                  color: "var(--gold2)",
                  fontSize: 10,
                  fontFamily: "'Cinzel', serif",
                  cursor: "pointer",
                }}
              >
                ⛶ Vue Focus
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
