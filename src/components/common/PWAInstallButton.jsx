import React, { useState } from "react";
import { usePWAInstall } from "../../hooks/usePWAInstall.js";

export const PWAInstallButton = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="pwa-install-btn"
        title="Installer l'application pour une utilisation hors-ligne"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderRadius: 20,
          background: "rgba(62,184,160,0.15)",
          border: "1px solid var(--teal)",
          color: "var(--teal2)",
          fontFamily: "'Cinzel',serif",
          fontSize: 9,
          letterSpacing: 1.2,
          fontWeight: 700,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <span>📲</span>
        <span>INSTALLER L'APP</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="pwa-install-btn"
          title="Installer sur iPhone / iPad"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 20,
            background: "rgba(201,168,76,0.12)",
            border: "1px solid var(--gold)",
            color: "var(--gold2)",
            fontFamily: "'Cinzel',serif",
            fontSize: 9,
            letterSpacing: 1.2,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <span>📲</span>
          <span>INSTALLER (iOS)</span>
        </button>

        {showIOSGuide && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.75)",
              padding: 16,
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 360,
                background: "var(--surface)",
                border: "1px solid var(--gold)",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
                color: "var(--text)",
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--gold)", fontFamily: "'Cinzel',serif" }}>
                Installer sur iPhone / iPad
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text2)", margin: "0 0 16px" }}>
                1. Appuyez sur le bouton <strong>Partager</strong> <span style={{ fontSize: 16 }}>⎋</span> dans la barre Safari.<br />
                2. Faites défiler et touchez <strong>Sur l'écran d'accueil</strong> ⊕.<br />
                3. Touchez <strong>Ajouter</strong> en haut à droite.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 8,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontFamily: "'Cinzel',serif",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                FERMER
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
