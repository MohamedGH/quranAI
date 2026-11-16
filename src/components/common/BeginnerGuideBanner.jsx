import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import { getBeginnerTip, getUxProfile, getSimplifiedLayoutConfig } from "../../utils/uxProfileManager.js";

export function BeginnerGuideBanner({ context = "general" }) {
  const dispatch = useDispatch();
  const uxMode = useSelector(sel.uxMode);
  const showBeginnerGuides = useSelector(sel.showBeginnerGuides);
  const layoutCfg = getSimplifiedLayoutConfig(uxMode);

  if (!layoutCfg.isSimplified || !showBeginnerGuides) {
    return null;
  }

  const profile = getUxProfile(uxMode);
  const tipText = getBeginnerTip(context, uxMode);
  const isChild = layoutCfg.isChild;

  return (
    <div
      role="region"
      aria-label="Guide débutant"
      data-simplified-banner="true"
      style={{
        display: "flex",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
        padding: "7px 12px",
        margin: "6px 10px 2px",
        borderRadius: 10,
        background: isChild
          ? "linear-gradient(90deg, rgba(255, 183, 3, 0.14) 0%, rgba(251, 133, 0, 0.08) 100%)"
          : "linear-gradient(90deg, rgba(245, 158, 11, 0.14) 0%, rgba(217, 119, 6, 0.07) 100%)",
        border: isChild
          ? "1px solid rgba(255, 183, 3, 0.35)"
          : "1px solid rgba(245, 158, 11, 0.35)",
        boxSizing: "border-box",
        animation: "fadeIn .2s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 220px", minWidth: 0 }}>
        <span style={{ fontSize: 17, flexShrink: 0 }}>{profile.icon}</span>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text)",
            lineHeight: 1.35,
            minWidth: 0,
          }}
        >
          {tipText}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          id="btn-open-wizard-banner"
          onClick={() => dispatch(uiActions.setShowUxWizard(true))}
          style={{
            minHeight: 36,
            padding: "5px 11px",
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 7,
            background: isChild ? "rgba(255, 183, 3, 0.22)" : "rgba(245, 158, 11, 0.22)",
            border: isChild ? "1px solid rgba(255, 183, 3, 0.5)" : "1px solid rgba(245, 158, 11, 0.5)",
            color: isChild ? "#ffd166" : "#fbbf24",
            cursor: "pointer",
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          title="Ouvrir le guide pas-à-pas interactif"
        >
          <span>✨</span>
          <span>{isChild ? "Guide" : "Aide"}</span>
        </button>

        <button
          type="button"
          onClick={() => dispatch(uiActions.toggleBeginnerGuides())}
          aria-label="Masquer cette aide"
          title="Masquer les conseils"
          style={{
            minWidth: 34,
            minHeight: 34,
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "var(--text2)",
            fontSize: 13,
            cursor: "pointer",
            padding: "4px",
            lineHeight: 1,
            borderRadius: 7,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
