import React, { useEffect, useState } from "react";

export function TajweedCoachAnnouncementHUD({
  announcement,
  onManualResume,
  autoResume = true,
  delaySec = 1.5,
  isSpeaking = false
}) {
  const [countdown, setCountdown] = useState(delaySec);

  useEffect(() => {
    if (isSpeaking) {
      setCountdown(delaySec);
      return;
    }
    if (!autoResume) return;

    setCountdown(delaySec);
    const start = Date.now();
    const durationMs = delaySec * 1000;

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, (durationMs - elapsed) / 1000);
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onManualResume?.();
      }
    }, 100);

    return () => clearInterval(timer);
  }, [isSpeaking, autoResume, delaySec, onManualResume]);

  if (!announcement) return null;

  const color = announcement.color || 'var(--gold, #d97706)';

  return (
    <div
      className="tajweed-coach-hud-backdrop"
      style={{
        position: "fixed",
        bottom: 90,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        maxWidth: "92vw",
        width: 440,
        animation: "slideUpFade 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      <div
        className="tajweed-coach-hud-card"
        style={{
          background: "var(--surface, #1e293b)",
          border: `2px solid ${color}`,
          borderRadius: 16,
          boxShadow: `0 12px 36px rgba(0, 0, 0, 0.45), 0 0 20px ${color}44`,
          padding: "16px 20px",
          color: "var(--text, #f8fafc)",
          backdropFilter: "blur(12px)",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}
      >
        {/* Top bar: Category badge + dismiss */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                background: `${color}28`,
                color: color,
                border: `1px solid ${color}66`,
                borderRadius: 20,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: "uppercase"
              }}
            >
              ☪ Règle de Tajweed à venir
            </span>
            {isSpeaking && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text3, #94a3b8)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: color,
                    animation: "pulseDot 1s infinite"
                  }}
                />
                Annonce vocale...
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onManualResume}
            title="Ignorer et reprendre la récitation"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text3, #94a3b8)",
              cursor: "pointer",
              fontSize: 16,
              padding: "2px 6px",
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Middle row: Big Letter, Arabic Rule Name, and Context */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Big Letter avatar — prominently highlighted */}
          <div
            style={{
              minWidth: announcement.matchedWith ? 68 : 56,
              height: 56,
              padding: "0 8px",
              borderRadius: 14,
              background: `${color}22`,
              border: `2px solid ${color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              fontFamily: "'Amiri Quran', 'Amiri', serif",
              fontSize: announcement.matchedWith ? 24 : 32,
              color: color,
              flexShrink: 0,
              boxShadow: `0 0 16px ${color}44, inset 0 0 12px ${color}22`
            }}
          >
            <span style={{ backgroundColor: `${color}33`, padding: "0 4px", borderRadius: 6 }}>
              {announcement.char}
            </span>
            {announcement.matchedWith && (
              <>
                <span style={{ fontSize: 14, opacity: 0.7 }}>➔</span>
                <span style={{ backgroundColor: `${color}33`, padding: "0 4px", borderRadius: 6 }}>
                  {announcement.matchedWith}
                </span>
              </>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text, #f8fafc)" }}>
                {announcement.ruleNameFr}
              </span>
              <span
                style={{
                  fontFamily: "'Amiri Quran', serif",
                  fontSize: 16,
                  color: color,
                  direction: "rtl"
                }}
              >
                ({announcement.ruleNameAr})
              </span>
            </div>

            <div style={{ fontSize: 13, color: "var(--text2, #cbd5e1)", marginTop: 3 }}>
              Lettre concernée :{" "}
              <strong
                style={{
                  color: color,
                  backgroundColor: `${color}28`,
                  padding: "1px 6px",
                  borderRadius: 4,
                  border: `1px solid ${color}55`
                }}
              >
                {announcement.letterNameFr} ({announcement.char})
              </strong>
              {announcement.matchedWith && (
                <span>
                  {" "}devant{" "}
                  <strong
                    style={{
                      color: color,
                      backgroundColor: `${color}28`,
                      padding: "1px 6px",
                      borderRadius: 4,
                      border: `1px solid ${color}55`
                    }}
                  >
                    {announcement.matchedLetterNameFr || announcement.matchedWith} ({announcement.matchedWith})
                  </strong>
                </span>
              )}
            </div>

            {announcement.wordText && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text3, #94a3b8)",
                  marginTop: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <span>Mot :</span>
                <span
                  style={{
                    fontFamily: "'Amiri Quran', serif",
                    fontSize: 18,
                    direction: "rtl",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    padding: "3px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255, 255, 255, 0.12)"
                  }}
                >
                  {[...announcement.wordText].map((ch, idx) => {
                    const targetBare = announcement.char ? announcement.char.replace(/[ً-ّْٟ]/g, "") : "";
                    const matchedBare = announcement.matchedWith ? announcement.matchedWith.replace(/[ً-ّْٟ]/g, "") : "";
                    const isMatch = (targetBare && ch === targetBare) || (matchedBare && ch === matchedBare) || ch === "ۢ";
                    if (isMatch) {
                      return (
                        <span
                          key={idx}
                          style={{
                            backgroundColor: `${color}44`,
                            color: color,
                            borderBottom: `2.5px solid ${color}`,
                            borderRadius: 4,
                            padding: "0 3px",
                            fontWeight: 800,
                            boxShadow: `0 0 10px ${color}66`
                          }}
                        >
                          {ch}
                        </span>
                      );
                    }
                    return (
                      <span key={idx} style={{ color: "var(--text, #f8fafc)" }}>
                        {ch}
                      </span>
                    );
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions: Auto-resume progress or manual resume */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 8,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)"
          }}
        >
          <div style={{ fontSize: 12, color: isSpeaking ? color : "var(--text3, #94a3b8)", fontWeight: isSpeaking ? 600 : 400 }}>
            {isSpeaking
              ? "🎙️ Annonce audio de la règle en cours... Le verset reste en pause."
              : autoResume
              ? `Reprise du verset dans ${countdown.toFixed(1)}s`
              : "Annonce terminée — prêt à réciter"}
          </div>

          <button
            type="button"
            onClick={onManualResume}
            style={{
              padding: "6px 14px",
              background: color,
              color: "#0f172a",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: `0 2px 8px ${color}66`,
              transition: "transform 0.1s"
            }}
          >
            <span>▶</span>
            <span>Reprendre</span>
          </button>
        </div>
      </div>
    </div>
  );
}
