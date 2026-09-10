import React from "react";
import { sanitizeLocalStorage } from "../../utils/safeStorage.js";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    sanitizeLocalStorage();
    this.setState({ hasError: false, error: null });
  };

  handleCleanAndReload = () => {
    sanitizeLocalStorage();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          padding: "20px 24px",
          margin: "20px auto",
          maxWidth: 480,
          borderRadius: 12,
          background: "rgba(224, 90, 90, 0.08)",
          border: "1px solid rgba(224, 90, 90, 0.3)",
          color: "var(--text1, #fff)",
          fontFamily: "'Cinzel', serif",
          fontSize: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
          textAlign: "center"
        }}>
          <div style={{ color: "var(--red, #e05a5a)", fontWeight: 600, letterSpacing: 1, fontSize: 13 }}>
            Une erreur est survenue lors de l'affichage.
          </div>
          {this.state.error?.message && (
            <div style={{ fontSize: 10, color: "var(--text3, #888)", fontFamily: "monospace", maxWidth: "100%", overflowWrap: "break-word" }}>
              {this.state.error.message}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                background: "transparent",
                border: "1px solid var(--border2, #444)",
                color: "var(--text2, #ccc)",
                cursor: "pointer",
                fontSize: 10,
                letterSpacing: 1,
                fontFamily: "'Cinzel', serif"
              }}
            >
              ↺ RÉESSAYER
            </button>
            <button
              onClick={this.handleCleanAndReload}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                background: "var(--gold-dim, rgba(200, 160, 60, 0.15))",
                border: "1px solid var(--gold, #d4af37)",
                color: "var(--gold, #d4af37)",
                cursor: "pointer",
                fontSize: 10,
                letterSpacing: 1,
                fontFamily: "'Cinzel', serif"
              }}
            >
              🧹 RÉINITIALISER LE CACHE & RECHARGER
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
