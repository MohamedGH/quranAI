import React from "react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.js";

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 20,
        background: "rgba(17,29,46,0.95)",
        border: "1px solid #ffd166",
        color: "#ffd166",
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        fontFamily: "'Cinzel',serif",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        backdropFilter: "blur(6px)",
      }}
      role="status"
      aria-live="polite"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#ffd166",
          display: "inline-block",
          animation: "pulse 1.8s infinite",
        }}
      />
      <span>MODE HORS-LIGNE · DONNÉES EN CACHE</span>
    </div>
  );
};
