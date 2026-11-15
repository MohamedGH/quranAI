import React, { useState, useRef, useEffect, useContext, useId } from "react";
import { createPortal } from "react-dom";
import { ReactReduxContext } from "react-redux";
import { useInRouterContext, UNSAFE_NavigationContext } from "react-router-dom";
import { glossaryActions } from "../../store.js";
import { getGlossaryTerm, getGlossaryCategoryMeta, TAJWEED_GLOSSARY } from "../../utils/tajweedGlossary.js";
import { buildGlossaryRoute } from "../../utils/routeManager.js";
import { ERROR_CODES, createAppError, trySync } from "../../utils/errorManager.js";

/**
 * Helper to safely invoke Web Speech API for glossary examples with errorManager protection.
 */
const speakGlossarySample = (text, reduxStore) => {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  const res = trySync(() => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(String(text));
    utt.lang = "ar-SA";
    utt.rate = 0.68;
    window.speechSynthesis.speak(utt);
  }, null, { text });

  if (!res.ok && reduxStore?.dispatch) {
    reduxStore.dispatch({
      type: "errors/reportError",
      payload: createAppError(
        ERROR_CODES.AUDIO_PLAYBACK_ERROR,
        "Lecture audio indisponible pour cet exemple du glossaire.",
        { text }
      ),
    });
  }
};

/**
 * Router-safe navigation hook that never calls hooks conditionally.
 */
function useSafeGlossaryNavigate() {
  const inRouter = useInRouterContext();
  const navCtx = useContext(UNSAFE_NavigationContext);
  return (path) => {
    if (inRouter && navCtx?.navigator?.push) {
      navCtx.navigator.push(path);
      return;
    }
    if (typeof window !== "undefined") {
      window.location.hash = `#${path}`;
    }
  };
}

/**
 * GlossaryTermTooltip
 * Accessible, mobile-first inline term trigger displaying a rich floating infobulle on hover, focus, or tap,
 * with a direct link to the dedicated /glossaire/:termId page.
 */
export function GlossaryTermTooltip({
  termId,
  term,
  children,
  isChild: isChildProp = null,
  onOpenGlossary = null,
  className = "",
}) {
  const reduxCtx = useContext(ReactReduxContext);
  const reduxStore = reduxCtx?.store || null;
  const navigate = useSafeGlossaryNavigate();
  const tooltipDomId = useId();

  const resolvedTerm = getGlossaryTerm(termId || term || (typeof children === "string" ? children : ""));
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placeAbove: false });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const closeTimerRef = useRef(null);

  const stateUxMode = reduxStore?.getState?.()?.ui?.uxMode || "standard";
  const isChild = isChildProp !== null ? Boolean(isChildProp) : stateUxMode === "child";

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const updatePosition = () => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth || 375;
    const vh = window.innerHeight || 667;
    const popW = Math.min(340, vw - 24);
    const placeAbove = rect.bottom + 240 > vh && rect.top > 240;
    const rawLeft = rect.left + rect.width / 2 - popW / 2;
    const left = Math.max(12, Math.min(vw - popW - 12, rawLeft));
    const top = placeAbove ? Math.max(12, rect.top - 8) : Math.min(vh - 20, rect.bottom + 8);
    setCoords({ top, left, placeAbove, width: popW });
  };

  const handleOpen = () => {
    clearCloseTimer();
    updatePosition();
    setOpen(true);
    if (resolvedTerm && reduxStore?.dispatch) {
      reduxStore.dispatch(glossaryActions.setActiveTermId(resolvedTerm.id));
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, 140);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        popoverRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => () => clearCloseTimer(), []);

  if (!resolvedTerm) {
    return <span>{children || term || termId}</span>;
  }

  const catMeta = getGlossaryCategoryMeta(resolvedTerm.category);

  const handleGoToGlossary = (e) => {
    e.stopPropagation();
    setOpen(false);
    if (reduxStore?.dispatch) {
      reduxStore.dispatch(glossaryActions.setActiveTermId(resolvedTerm.id));
      reduxStore.dispatch(glossaryActions.setCategory(resolvedTerm.category));
    }
    if (typeof onOpenGlossary === "function") {
      onOpenGlossary(resolvedTerm.id);
      return;
    }
    navigate(buildGlossaryRoute(resolvedTerm.id));
  };

  const popoverNode = open ? (
    <div
      ref={popoverRef}
      id={`glossary-tooltip-${resolvedTerm.id}`}
      role="dialog"
      aria-label={`Définition de ${resolvedTerm.term}`}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleClose}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        width: coords.width || 320,
        transform: coords.placeAbove ? "translateY(-100%)" : "none",
        zIndex: 3500,
        background: "linear-gradient(180deg, #161c2e 0%, #0e1320 100%)",
        border: "1.5px solid rgba(255, 209, 102, 0.55)",
        borderRadius: 12,
        padding: 14,
        boxShadow: "0 18px 42px rgba(0, 0, 0, 0.65)",
        color: "#f1f5f9",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        textAlign: "left",
        lineHeight: 1.45,
      }}
    >
      {/* En-tête de l'infobulle */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 800, fontSize: 13, color: "#ffd166" }}>
              {resolvedTerm.term}
            </span>
            {resolvedTerm.arabic && (
              <span style={{ fontFamily: "'Amiri Quran', serif", fontSize: 16, color: "#56d4bc", direction: "rtl" }}>
                {resolvedTerm.arabic}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>
            <span>{isChild ? catMeta.childLabel : catMeta.label}</span>
            {resolvedTerm.letters.length > 0 && (
              <>
                <span aria-hidden="true"> · </span>
                <span style={{ fontFamily: "'Amiri Quran', serif", color: "#e2e8f0", fontSize: 12 }}>
                  {resolvedTerm.letters.slice(0, 7).join(" ")}
                  {resolvedTerm.letters.length > 7 ? " …" : ""}
                </span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          aria-label="Fermer l'infobulle"
          style={{
            minWidth: 28,
            minHeight: 28,
            borderRadius: 6,
            border: "1px solid rgba(148, 163, 184, 0.25)",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#cbd5e1",
            cursor: "pointer",
            fontSize: 12,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Définition courte adaptée */}
      <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.5 }}>
        {isChild ? resolvedTerm.childDef : resolvedTerm.shortDef}
      </div>

      {/* Exemple coranique */}
      {resolvedTerm.example?.arabic && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 15, color: "#ffd166", direction: "rtl", textAlign: "right" }}>
            {resolvedTerm.example.arabic}
          </div>
          <div style={{ fontSize: 10.5, color: "#cbd5e1" }}>
            {resolvedTerm.example.translit} — {resolvedTerm.example.meaning}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 2 }}>
        {resolvedTerm.example?.arabic && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              speakGlossarySample(resolvedTerm.example.arabic, reduxStore);
            }}
            style={{
              minHeight: 36,
              padding: "6px 10px",
              borderRadius: 7,
              border: "1px solid rgba(86, 212, 188, 0.45)",
              background: "rgba(86, 212, 188, 0.12)",
              color: "#56d4bc",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            🔊 Écouter
          </button>
        )}

        <button
          type="button"
          className="btn-open-glossary-from-tooltip"
          onClick={handleGoToGlossary}
          style={{
            flex: 1,
            minHeight: 36,
            padding: "6px 12px",
            borderRadius: 7,
            border: "1px solid rgba(255, 209, 102, 0.5)",
            background: "rgba(255, 209, 102, 0.14)",
            color: "#ffd166",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Voir dans le Glossaire →
        </button>
      </div>
    </div>
  ) : null;

  return (
    <span style={{ position: "relative", display: "inline" }}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? tooltipDomId : undefined}
        data-glossary-term={resolvedTerm.id}
        className={`glossary-term-trigger ${className}`.trim()}
        onMouseEnter={handleOpen}
        onMouseLeave={scheduleClose}
        onFocus={handleOpen}
        onBlur={scheduleClose}
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else handleOpen();
        }}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          borderBottom: "1.5px dotted rgba(255, 209, 102, 0.78)",
          color: "inherit",
          font: "inherit",
          fontWeight: 700,
          padding: "0 1px",
          margin: 0,
          cursor: "help",
          display: "inline",
          lineHeight: "inherit",
        }}
      >
        {children || resolvedTerm.term}
      </button>
      {popoverNode && (typeof document !== "undefined" ? createPortal(popoverNode, document.body) : popoverNode)}
    </span>
  );
}

// Build sorted keyword matcher once (longest terms first to avoid partial match collisions)
const AUTO_TERM_PAIRS = Object.freeze(
  TAJWEED_GLOSSARY.flatMap((entry) => [
    { label: entry.term, id: entry.id },
    ...(entry.translit ? [{ label: entry.translit, id: entry.id }] : []),
    ...["Tafkhîm", "Tarqîq", "Isti‘lâ’", "Istifâl", "Itbâq", "Infitâḥ", "Makhraj", "Makhârij", "Qalqalah", "Ṣafîr", "Ghunnah", "Iẓhâr", "Idghâm", "Iqlâb", "Ikhfâ’", "Sifât", "Sukûn", "Shaddah", "Tanwîn", "Madd", "Muqaṭṭa‘ât", "Jawf", "Khayshûm", "Shafatân", "Ḥalq", "Lisân", "Tawassuṭ", "Rakhâwah", "Shiddah", "Hams", "Jahr", "Takrîr", "Inḥirâf", "Istiṭâlah", "Tafash-shî", "Lîn", "Waqf", "Abjad", "Shamsiyyah", "Qamariyyah"]
      .filter((kw) => getGlossaryTerm(kw)?.id === entry.id)
      .map((kw) => ({ label: kw, id: entry.id })),
  ])
    .filter((p, idx, arr) => arr.findIndex((x) => x.label === p.label) === idx)
    .sort((a, b) => b.label.length - a.label.length)
);

const ESCAPE_REGEX = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const AUTO_TERM_REGEX = new RegExp(
  `(${AUTO_TERM_PAIRS.map((p) => ESCAPE_REGEX(p.label)).join("|")})`,
  "g"
);
const LABEL_TO_ID = new Map(AUTO_TERM_PAIRS.map((p) => [p.label, p.id]));

/**
 * GlossaryAutoText
 * Purely wraps recognized technical Tajweed terms inside any string with interactive <GlossaryTermTooltip> triggers.
 */
export function GlossaryAutoText({ text, isChild = null, onOpenGlossary = null }) {
  if (!text || typeof text !== "string") return text || null;
  const parts = text.split(AUTO_TERM_REGEX);
  return (
    <>
      {parts.map((part, idx) => {
        const matchedId = LABEL_TO_ID.get(part);
        if (matchedId) {
          return (
            <GlossaryTermTooltip
              key={`${matchedId}-${idx}`}
              termId={matchedId}
              isChild={isChild}
              onOpenGlossary={onOpenGlossary}
            >
              {part}
            </GlossaryTermTooltip>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
}
