import React, { useState, useMemo, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, playerActions } from "../../store.js";
import {
  hasAyatTimestamps,
  extractWordTimings,
  resolveSilencedWordIndices,
  computeSilenceIntervals,
  formatSilenceStatus,
  findActiveSilenceInterval,
} from "../../utils/audioSilenceManager.js";

/**
 * SilenceReviseControl
 * Clean, non-intrusive audio silence & masking control.
 *
 * Designed to never hinder or disrupt the audio player:
 * - 1-tap toggle button matching standard circular player controls (.ctrl-btn)
 * - Zero intrusive floating popups over player transport buttons
 * - Non-modal options popover that keeps the audio player fully visible & interactive
 * - Instant visual state (glowing ring when active, pulse when actively muting)
 */
export function SilenceReviseControl({
  timestamps = null,
  ld = null,
  ayatText = "",
  surahNum = null,
  ayatNum = null,
  currentMs = 0,
  isPlaying = false,
  compact = true,
  buttonSize = null, // e.g. 32 or 36
  onLoadTimestamps = null,
}) {
  const dispatch = useDispatch();
  const [showOptions, setShowOptions] = useState(false);
  const [showTsTip, setShowTsTip] = useState(false);
  const containerRef = useRef(null);
  const tipTimeoutRef = useRef(null);

  // Redux state
  const isSilenceEnabled = useSelector(sel.silenceWordsToRevise);
  const silenceMode = useSelector(sel.silenceMode);
  const customMap = useSelector(sel.customSilencedWordsMap);

  const ayatKey = surahNum != null && ayatNum != null ? `${surahNum}:${ayatNum}` : "current";
  const customSilenced = customMap[ayatKey] || [];

  // Timestamp and word calculations
  const hasTs = useMemo(() => hasAyatTimestamps(timestamps), [timestamps]);
  const wordTimings = useMemo(() => (hasTs ? extractWordTimings(timestamps) : []), [hasTs, timestamps]);

  const rawWords = useMemo(() => {
    if (wordTimings.length > 0) return wordTimings.map((w) => w.text);
    return ayatText ? ayatText.trim().split(/\s+/).filter(Boolean) : [];
  }, [wordTimings, ayatText]);

  const totalWords = rawWords.length;

  const silencedIndices = useMemo(() => {
    return resolveSilencedWordIndices({
      ld,
      customIndices: customSilenced,
      totalWords,
    });
  }, [ld, customSilenced, totalWords]);

  const intervals = useMemo(() => {
    return hasTs ? computeSilenceIntervals(timestamps, silencedIndices) : [];
  }, [hasTs, timestamps, silencedIndices]);

  // Current active silence during playback
  const activeInterval = useMemo(() => {
    if (!isPlaying || !isSilenceEnabled || !hasTs) return null;
    return findActiveSilenceInterval(currentMs, intervals);
  }, [isPlaying, isSilenceEnabled, hasTs, currentMs, intervals]);

  const status = useMemo(() => {
    return formatSilenceStatus({
      hasTimestamps: hasTs,
      totalWords,
      silencedCount: silencedIndices.length,
      mode: silenceMode,
      isCurrentlySilenced: !!activeInterval,
      activeWordText: activeInterval?.text || "",
    });
  }, [hasTs, totalWords, silencedIndices.length, silenceMode, activeInterval]);

  // Close popover when clicking outside (non-blocking, doesn't prevent player interaction)
  useEffect(() => {
    if (!showOptions) return;
    const handlePointerDownOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowOptions(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside);
  }, [showOptions]);

  useEffect(() => {
    return () => {
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
    };
  }, []);

  // 1-Click Fast Toggle
  const handleMainButtonClick = () => {
    if (!hasTs) {
      // If timestamps not provided, show discreet non-blocking hint for 3 seconds
      setShowTsTip(true);
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
      tipTimeoutRef.current = setTimeout(() => setShowTsTip(false), 3000);
      if (onLoadTimestamps) {
        onLoadTimestamps();
      }
      return;
    }
    // Instant toggle on / off
    dispatch(playerActions.setSilenceWordsToRevise(!isSilenceEnabled));
  };

  const handleToggleMode = (mode) => {
    dispatch(playerActions.setSilenceMode(mode));
  };

  const handleToggleWord = (index) => {
    dispatch(playerActions.toggleCustomSilencedWord({ key: ayatKey, wordIndex: index }));
  };

  const handleClearCustom = () => {
    dispatch(playerActions.clearCustomSilencedWords(ayatKey));
  };

  const handleSelectAllWords = () => {
    const all = Array.from({ length: totalWords }, (_, i) => i);
    dispatch(playerActions.setCustomSilencedWords({ key: ayatKey, wordIndices: all }));
  };

  const btnDimension = buttonSize || 32;

  return (
    <div
      ref={containerRef}
      className="silence-control-container"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      {/* ─── Compact Circular Button matching standard .ctrl-btn ─── */}
      <button
        type="button"
        id="btn-silence-revise"
        className={`ctrl-btn silence-trigger-btn ${isSilenceEnabled ? "active-silence loop-on" : ""}`}
        onClick={handleMainButtonClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowOptions((v) => !v);
        }}
        title={
          !hasTs
            ? "Silence mots à réviser (Timestamps requis — Clic pour charger)"
            : isSilenceEnabled
            ? `Silence révision ACTIF (${silencedIndices.length} mot${silencedIndices.length > 1 ? "s" : ""}, mode ${silenceMode === "skip" ? "Sauter" : "Muet"}). Clic pour désactiver, clic-droit pour options.`
            : `Silence révision INACTIF (${silencedIndices.length} mot${silencedIndices.length > 1 ? "s" : ""} ciblés). Clic pour activer.`
        }
        aria-label="Silence révision"
        aria-pressed={isSilenceEnabled}
        style={{
          width: btnDimension,
          height: btnDimension,
          minWidth: btnDimension,
          minHeight: btnDimension,
          borderRadius: "50%",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          cursor: "pointer",
          border: isSilenceEnabled
            ? "1px solid #ff7eb3"
            : !hasTs
            ? "1px solid rgba(245, 158, 11, 0.35)"
            : "1px solid var(--border2)",
          background: isSilenceEnabled
            ? "rgba(255, 126, 179, 0.18)"
            : !hasTs
            ? "rgba(245, 158, 11, 0.05)"
            : "transparent",
          color: isSilenceEnabled ? "#ff7eb3" : !hasTs ? "var(--text3)" : "var(--text2)",
          boxShadow: activeInterval
            ? "0 0 12px rgba(255, 126, 179, 0.6)"
            : isSilenceEnabled
            ? "0 0 6px rgba(255, 126, 179, 0.25)"
            : "none",
          transition: "all 0.15s ease",
          position: "relative",
        }}
      >
        <span>{isSilenceEnabled ? "🤫" : "🔇"}</span>

        {/* Small badge count if active */}
        {isSilenceEnabled && hasTs && silencedIndices.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              fontSize: 8,
              minWidth: 12,
              height: 12,
              lineHeight: "12px",
              borderRadius: 6,
              background: "#ff7eb3",
              color: "#13161f",
              fontWeight: 800,
              padding: "0 2px",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {silencedIndices.length}
          </span>
        )}

        {/* Non-intrusive warning dot if timestamps missing */}
        {!hasTs && (
          <span
            style={{
              position: "absolute",
              bottom: 1,
              right: 1,
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#f59e0b",
              pointerEvents: "none",
            }}
          />
        )}
      </button>

      {/* Discreet mini-gear / options trigger (shown only when hover or focus, or if active) */}
      {hasTs && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowOptions((v) => !v);
          }}
          title="Réglages du masquage audio (Muet / Sauter)"
          aria-label="Réglages du silence audio"
          aria-expanded={showOptions}
          style={{
            position: "absolute",
            top: -4,
            left: -4,
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: "1px solid var(--border2)",
            background: "var(--surface, #13161f)",
            color: showOptions ? "var(--gold)" : "var(--text3)",
            fontSize: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
            zIndex: 2,
          }}
        >
          ⚙
        </button>
      )}

      {/* ─── Non-blocking Toast / Hint when timestamps missing ─── */}
      {showTsTip && !hasTs && (
        <div
          role="status"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(20, 24, 33, 0.96)",
            border: "1px solid #f59e0b",
            color: "#fbd38d",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 10.5,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            zIndex: 250,
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>⚠️ Timestamps requis</span>
          {onLoadTimestamps && (
            <button
              type="button"
              onClick={() => {
                onLoadTimestamps();
                setShowTsTip(false);
              }}
              style={{
                background: "rgba(245, 158, 11, 0.2)",
                border: "1px solid #f59e0b",
                color: "#fbd38d",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 9.5,
                cursor: "pointer",
              }}
            >
              Charger
            </button>
          )}
        </div>
      )}

      {/* ─── Non-blocking Popover Card (Leaves Audio Player fully accessible) ─── */}
      {showOptions && (
        <div
          role="region"
          aria-label="Options du silence audio"
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            right: 0,
            width: 290,
            maxWidth: "calc(100vw - 24px)",
            background: "var(--surface, #13161f)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 1px rgba(255,126,179,0.3)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            zIndex: 260,
            color: "var(--text, #e2e8f0)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>🤫</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", letterSpacing: 0.5 }}>
                SILENCE SUR RÉVISION
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowOptions(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text3)",
                fontSize: 16,
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Quick toggle switch inside popover */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 8px",
              borderRadius: 6,
              background: "var(--surface2, #1a1e2b)",
            }}
          >
            <span style={{ fontSize: 11 }}>Silence actif</span>
            <button
              type="button"
              onClick={handleMainButtonClick}
              style={{
                padding: "3px 10px",
                borderRadius: 12,
                border: "none",
                background: isSilenceEnabled ? "#ff7eb3" : "rgba(255,255,255,0.15)",
                color: isSilenceEnabled ? "#13161f" : "var(--text3)",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {isSilenceEnabled ? "OUI (ON)" : "NON (OFF)"}
            </button>
          </div>

          {/* Mode switch: Mute vs Skip */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 9.5, color: "var(--text3)", letterSpacing: 0.5 }}>MODE DE MASQUAGE</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button
                type="button"
                onClick={() => handleToggleMode("mute")}
                style={{
                  padding: "5px 6px",
                  borderRadius: 6,
                  border: silenceMode === "mute" ? "1px solid #ff7eb3" : "1px solid var(--border)",
                  background: silenceMode === "mute" ? "rgba(255, 126, 179, 0.16)" : "transparent",
                  color: silenceMode === "mute" ? "#ff7eb3" : "var(--text2)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🤫 Muet
              </button>
              <button
                type="button"
                onClick={() => handleToggleMode("skip")}
                style={{
                  padding: "5px 6px",
                  borderRadius: 6,
                  border: silenceMode === "skip" ? "1px solid #3eb8a0" : "1px solid var(--border)",
                  background: silenceMode === "skip" ? "rgba(62, 184, 160, 0.16)" : "transparent",
                  color: silenceMode === "skip" ? "#3eb8a0" : "var(--text2)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ⏭️ Sauter
              </button>
            </div>
          </div>

          {/* Word count summary */}
          <div
            style={{
              fontSize: 10,
              color: "var(--text3)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid var(--border)",
              paddingTop: 6,
            }}
          >
            <span>
              {silencedIndices.length} mot{silencedIndices.length > 1 ? "s" : ""} ciblé{silencedIndices.length > 1 ? "s" : ""}
            </span>
            <span style={{ color: hasTs ? "var(--teal)" : "#f59e0b" }}>
              {hasTs ? "✓ Timestamps OK" : "⚠️ Sans timestamps"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
