import React from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.js";
import { sel } from "../../store.js";

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const downloadTask = useSelector(sel.downloadTask);

  // If online and no active background download, don't display floating indicator
  if (isOnline && !downloadTask?.active) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 14px",
        borderRadius: 24,
        background: "rgba(14, 20, 32, 0.94)",
        border: downloadTask?.active ? "1px solid var(--teal)" : "1px solid #ffd166",
        color: downloadTask?.active ? "var(--teal2)" : "#ffd166",
        boxShadow: "0 8px 24px rgba(0,0,0,0.65)",
        fontFamily: "'Cinzel', serif",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.8,
        backdropFilter: "blur(8px)",
      }}
      role="status"
      aria-live="polite"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: downloadTask?.active ? "var(--teal)" : "#ffd166",
          display: "inline-block",
          animation: "pulse 1.8s infinite",
        }}
      />
      <span>
        {downloadTask?.active
          ? `TÉLÉCHARGEMENT ${downloadTask.surahNum ? `S.${downloadTask.surahNum}` : ""} · ${Math.round(
              (downloadTask.done / (downloadTask.total || 1)) * 100
            )}%`
          : "MODE HORS-LIGNE · DONNÉES EN CACHE"}
      </span>
      <button
        onClick={() => navigate("/offline")}
        style={{
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "inherit",
          borderRadius: 12,
          padding: "2px 8px",
          fontSize: 9,
          cursor: "pointer",
          fontWeight: 700,
          marginLeft: 4,
        }}
        title="Gérer les données hors-ligne"
      >
        GÉRER
      </button>
    </div>
  );
};
