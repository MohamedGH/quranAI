import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, playerActions } from "../../store.js";
import {
  AUDIO_PLAYBACK_RATES,
  MIN_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  DEFAULT_PLAYBACK_RATE,
  clampPlaybackRate,
  formatPlaybackRate,
} from "../../utils/safeAudioPlayer.js";

/**
 * Reusable audio playback speed selector.
 * - `variant="select"`: compact dropdown for player bars, 3D footer, Lecture mode, Fullscreen footer.
 * - `variant="panel"`: full preset pills + fine slider + reset control for Options & Audio modals.
 */
export function PlaybackSpeedControl({
  variant = "select",
  compact = false,
  className = "",
  style = undefined,
  testId = "playback-speed-control",
  sliderTestId = "playback-speed-slider",
  presets = AUDIO_PLAYBACK_RATES,
}) {
  const dispatch = useDispatch();
  const playbackRate = clampPlaybackRate(useSelector(sel.playbackRate));

  const optionsList = React.useMemo(() => {
    const list = [...presets];
    if (!list.some((r) => Math.abs(r - playbackRate) < 0.001)) {
      list.push(playbackRate);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [presets, playbackRate]);

  if (variant === "select") {
    const isModified = Math.abs(playbackRate - DEFAULT_PLAYBACK_RATE) > 0.01;
    return (
      <select
        data-testid={testId}
        className={className}
        value={playbackRate}
        aria-label="Vitesse de lecture audio"
        title={`Vitesse de lecture audio : ${formatPlaybackRate(playbackRate)}`}
        onChange={(e) => dispatch(playerActions.setPlaybackRate(Number(e.target.value)))}
        style={{
          background: isModified ? "rgba(201, 168, 76, 0.2)" : "rgba(255, 255, 255, 0.06)",
          border: `1px solid ${isModified ? "var(--gold, #c9a84c)" : "rgba(212, 175, 55, 0.35)"}`,
          borderRadius: compact ? 8 : 8,
          color: isModified ? "var(--gold2, #ffd700)" : "#ebd8b0",
          padding: compact ? "4px 6px" : "6px 8px",
          fontSize: compact ? 11 : 12,
          fontWeight: 700,
          fontFamily: "'Cinzel', serif",
          cursor: "pointer",
          flexShrink: 0,
          minHeight: compact ? 30 : 34,
          boxSizing: "border-box",
          ...style,
        }}
      >
        {optionsList.map((r) => (
          <option key={r} value={r} style={{ background: "#141824", color: "#ebd8b0" }}>
            {formatPlaybackRate(r)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      data-testid={testId}
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: compact ? "10px 12px" : "12px 14px",
        borderRadius: 10,
        background: "var(--surface2, rgba(255,255,255,0.03))",
        border: "1px solid rgba(201, 168, 76, 0.28)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: 1.2, color: "var(--text, #f5efe0)", fontWeight: 700, fontFamily: "'Cinzel', serif" }}>
            ⏱️ VITESSE DE LECTURE AUDIO
          </div>
          <div style={{ fontSize: 9, color: "var(--text3, #9ca3af)", marginTop: 2 }}>
            Ralentir pour mémoriser ou accélérer la révision ({formatPlaybackRate(playbackRate)})
          </div>
        </div>

        <button
          type="button"
          data-testid={`${testId}-reset`}
          onClick={() => dispatch(playerActions.resetPlaybackRate())}
          title="Réinitialiser la vitesse à 1×"
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: Math.abs(playbackRate - DEFAULT_PLAYBACK_RATE) > 0.01 ? "1px solid var(--gold, #c9a84c)" : "1px solid var(--border2, rgba(255,255,255,0.14))",
            background: Math.abs(playbackRate - DEFAULT_PLAYBACK_RATE) > 0.01 ? "rgba(201, 168, 76, 0.16)" : "var(--surface3, rgba(255,255,255,0.05))",
            color: "var(--gold2, #ffd700)",
            fontFamily: "'Cinzel', serif",
            fontSize: 10.5,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {formatPlaybackRate(playbackRate)}
        </button>
      </div>

      {/* Preset buttons */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {presets.map((r) => {
          const isSelected = Math.abs(playbackRate - r) < 0.01;
          return (
            <button
              key={r}
              type="button"
              data-testid={`${testId}-preset-${String(r).replace(".", "_")}`}
              aria-pressed={isSelected}
              onClick={() => dispatch(playerActions.setPlaybackRate(r))}
              style={{
                padding: compact ? "4px 8px" : "5px 10px",
                borderRadius: 6,
                fontSize: 10,
                fontWeight: isSelected ? 700 : 500,
                fontFamily: "'Cinzel', serif",
                border: isSelected ? "1.5px solid var(--gold, #c9a84c)" : "1px solid var(--border2, rgba(255,255,255,0.12))",
                background: isSelected ? "rgba(201, 168, 76, 0.22)" : "rgba(255, 255, 255, 0.03)",
                color: isSelected ? "var(--gold2, #ffd700)" : "var(--text2, #d1d5db)",
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              {formatPlaybackRate(r)}
            </button>
          );
        })}
      </div>

      {/* Fine slider */}
      <input
        data-testid={sliderTestId}
        type="range"
        min={MIN_PLAYBACK_RATE}
        max={MAX_PLAYBACK_RATE}
        step={0.05}
        value={playbackRate}
        onChange={(e) => dispatch(playerActions.setPlaybackRate(Number(e.target.value)))}
        aria-label="Vitesse de lecture audio"
        style={{ width: "100%", accentColor: "var(--gold, #c9a84c)", cursor: "pointer" }}
      />
    </div>
  );
}
