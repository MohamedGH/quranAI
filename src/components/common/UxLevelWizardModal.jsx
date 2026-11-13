import React, { useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import { getUxWizardConfig, getUxProfile } from "../../utils/uxProfileManager.js";

/**
 * Pure Functional Onboarding Wizard component tailored to each user level / UX mode.
 * Explains clearly how the app works, with dedicated steps, animations, warm styling,
 * keyboard accessibility, and level-adapted terminology.
 */
export function UxLevelWizardModal() {
  const dispatch = useDispatch();
  const isOpen = useSelector(sel.showUxWizard);
  const currentStep = useSelector(sel.uxWizardStep);
  const uxMode = useSelector(sel.uxMode);

  const wizardConfig = getUxWizardConfig(uxMode);
  const profile = getUxProfile(uxMode);
  const { steps, theme, badge, title, subtitle } = wizardConfig;
  const totalSteps = steps.length;
  const activeStepData = steps[Math.min(currentStep, totalSteps - 1)] || steps[0];

  const handleClose = useCallback(() => {
    dispatch(uiActions.setShowUxWizard(false));
  }, [dispatch]);

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      dispatch(uiActions.setUxWizardStep(currentStep + 1));
    } else {
      handleClose();
      if (uxMode === "child") {
        dispatch(uiActions.setChildWizardSeen(true));
        dispatch(uiActions.setActivePage("prononciation"));
        if (typeof window !== "undefined") {
          window.history.pushState({}, "", "/prononciation");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      }
    }
  }, [currentStep, totalSteps, dispatch, handleClose, uxMode]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      dispatch(uiActions.setUxWizardStep(currentStep - 1));
    }
  }, [currentStep, dispatch]);

  const handleSelectStep = useCallback((idx) => {
    dispatch(uiActions.setUxWizardStep(idx));
  }, [dispatch]);

  // Keyboard navigation: Escape to close, Left/Right arrows to step through
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose, handleNext, handlePrev]);

  if (!isOpen) return null;

  return (
    <div
      id="ux-level-wizard-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ux-wizard-title"
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2600,
        background: "rgba(8, 10, 16, 0.82)",
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
        id="ux-level-wizard-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "linear-gradient(180deg, #161925 0%, #0e111a 100%)",
          border: `1.5px solid ${theme.badgeBorder || "rgba(201,168,76,0.4)"}`,
          borderRadius: "16px",
          boxShadow: `0 16px 48px rgba(0, 0, 0, 0.65), 0 0 24px ${theme.headerGlow || "rgba(201,168,76,0.2)"}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxHeight: "90vh",
          position: "relative",
        }}
      >
        {/* ── Wizard Header ────────────────────────────────────────── */}
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(0, 0, 0, 0.25)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                background: theme.badgeBg || "rgba(201,168,76,0.14)",
                border: `1px solid ${theme.badgeBorder || "rgba(201,168,76,0.4)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {profile.icon}
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 1.2,
                  fontWeight: 700,
                  color: theme.accent || "var(--gold2)",
                  textTransform: "uppercase",
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {badge}
              </div>
              <h2
                id="ux-wizard-title"
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#fff",
                  margin: "3px 0 0 0",
                  fontFamily: "'Cinzel', serif",
                  lineHeight: 1.25,
                }}
              >
                {title}
              </h2>
              <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: 3 }}>
                {subtitle}
              </div>
            </div>
          </div>

          <button
            id="btn-close-ux-wizard"
            onClick={handleClose}
            aria-label="Fermer le guide"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "var(--text2)",
              width: 32,
              height: 32,
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 16,
              transition: "all .15s",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Progress Indicator Tabs / Dots ───────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 20px",
            background: "rgba(0, 0, 0, 0.15)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            {steps.map((st, idx) => {
              const isCurrent = idx === currentStep;
              const isPast = idx < currentStep;
              return (
                <button
                  key={st.step}
                  onClick={() => handleSelectStep(idx)}
                  title={`Étape ${st.step} : ${st.title}`}
                  aria-label={`Aller à l'étape ${st.step} : ${st.title}`}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: isCurrent
                      ? theme.accent
                      : isPast
                      ? "rgba(255, 255, 255, 0.35)"
                      : "rgba(255, 255, 255, 0.10)",
                    border: "none",
                    cursor: "pointer",
                    transition: "all .2s ease",
                    padding: 0,
                  }}
                />
              );
            })}
          </div>

          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: theme.accent || "var(--gold2)",
              fontFamily: "'Cinzel', serif",
              whiteSpace: "nowrap",
              marginLeft: 8,
            }}
          >
            {currentStep + 1} / {totalSteps}
          </span>
        </div>

        {/* ── Step Body Content ────────────────────────────────────── */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "14px",
                background: theme.badgeBg || "rgba(201,168,76,0.15)",
                border: `1.5px solid ${theme.badgeBorder || "rgba(201,168,76,0.5)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                boxShadow: `0 4px 14px ${theme.headerGlow || "rgba(0,0,0,0.2)"}`,
                flexShrink: 0,
              }}
            >
              {activeStepData.icon}
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: theme.accent || "var(--gold2)",
                  letterSpacing: 1,
                  fontFamily: "'Cinzel', serif",
                }}
              >
                ÉTAPE {activeStepData.step} SUR {totalSteps}
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: "2px 0 0 0",
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {activeStepData.title}
              </h3>
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: theme.accentHover || "var(--gold)",
              lineHeight: 1.4,
            }}
          >
            {activeStepData.shortDesc}
          </div>

          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "var(--text)",
              background: "rgba(255, 255, 255, 0.03)",
              padding: "14px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            {activeStepData.body}
          </div>

          {/* Key Tip / Highlight box */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              borderRadius: "10px",
              background: theme.cardBg || "rgba(201,168,76,0.08)",
              border: `1px solid ${theme.cardBorder || "rgba(201,168,76,0.25)"}`,
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💡</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: theme.accent,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  fontFamily: "'Cinzel', serif",
                }}
              >
                Astuce pratique
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text)", lineHeight: 1.45 }}>
                {activeStepData.highlightTip}
              </span>
            </div>
          </div>

          {/* Action indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              color: "var(--text3)",
              fontStyle: "italic",
            }}
          >
            <span>👉</span>
            <span>{activeStepData.keyAction}</span>
          </div>
        </div>

        {/* ── Wizard Footer Controls ───────────────────────────────── */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(0, 0, 0, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <button
            id="btn-prev-ux-wizard"
            onClick={handlePrev}
            disabled={currentStep === 0}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              background: "rgba(255, 255, 255, 0.05)",
              color: currentStep === 0 ? "rgba(255,255,255,0.25)" : "var(--text)",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'Cinzel', serif",
              cursor: currentStep === 0 ? "not-allowed" : "pointer",
              transition: "all .15s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>←</span>
            <span>PRÉCÉDENT</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              id="btn-skip-ux-wizard"
              onClick={handleClose}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                color: "var(--text3)",
                fontSize: 10.5,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              Passer
            </button>

            <button
              id="btn-next-ux-wizard"
              onClick={handleNext}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: `1px solid ${theme.accentHover || "var(--gold)"}`,
                background: theme.accentGradient || "linear-gradient(135deg, #c9a84c 0%, #a68434 100%)",
                color: "#ffffff",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                letterSpacing: 0.8,
                cursor: "pointer",
                boxShadow: `0 4px 14px ${theme.headerGlow || "rgba(0,0,0,0.3)"}`,
                transition: "all .15s",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>
                {currentStep === totalSteps - 1
                  ? uxMode === "child"
                    ? "ALLER AUX LETTRES 🌟"
                    : "COMMENCER"
                  : "SUIVANT"}
              </span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
