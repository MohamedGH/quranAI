import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import { getBeginnerTip, getUxProfile } from "../../utils/uxProfileManager.js";

export function BeginnerGuideBanner({ context = "general" }) {
  const dispatch = useDispatch();
  const uxMode = useSelector(sel.uxMode);
  const showBeginnerGuides = useSelector(sel.showBeginnerGuides);
  const isBeginner = useSelector(sel.isBeginnerUx);
  const isChild = useSelector(sel.isChildUx);

  if ((!isBeginner && !isChild) || !showBeginnerGuides) {
    return null;
  }

  const profile = getUxProfile(uxMode);
  const tipText = getBeginnerTip(context);

  return (
    <div
      role="region"
      aria-label="Guide débutant"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 16px",
        margin: "8px 12px",
        borderRadius: 10,
        background: isChild
          ? "linear-gradient(90deg, rgba(255, 183, 3, 0.14) 0%, rgba(251, 133, 0, 0.08) 100%)"
          : "linear-gradient(90deg, rgba(46, 196, 182, 0.12) 0%, rgba(201, 168, 76, 0.10) 100%)",
        border: isChild
          ? "1px solid rgba(255, 183, 3, 0.35)"
          : "1px solid rgba(46, 196, 182, 0.3)",
        boxSizing: "border-box",
        animation: "fadeIn .2s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{profile.icon}</span>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: isChild ? "#ffb703" : "var(--teal2)",
              letterSpacing: 0.5,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>Mode {profile.name}</span>
            <span style={{ color: "var(--text3)", fontWeight: 400 }}>·</span>
            <span style={{ color: "var(--text3)", fontWeight: 400, textTransform: "none" }}>
              Interface adaptée
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text)",
              marginTop: 2,
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {tipText}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => dispatch(uiActions.setShowUxModeModal(true))}
          style={{
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "var(--text)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all .15s",
          }}
          title="Changer de mode d'interface"
        >
          Changer de mode
        </button>

        <button
          onClick={() => dispatch(uiActions.toggleBeginnerGuides())}
          aria-label="Masquer cette aide"
          title="Masquer les conseils"
          style={{
            background: "none",
            border: "none",
            color: "var(--text3)",
            fontSize: 16,
            cursor: "pointer",
            padding: "4px",
            lineHeight: 1,
            borderRadius: 4,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
