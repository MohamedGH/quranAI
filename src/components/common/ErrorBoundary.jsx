import React from "react";

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
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          padding: "16px 20px",
          margin: "10px 0",
          borderRadius: 8,
          background: "rgba(224, 90, 90, 0.08)",
          border: "1px solid rgba(224, 90, 90, 0.3)",
          color: "var(--text1, #fff)",
          fontFamily: "'Cinzel', serif",
          fontSize: 11,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          textAlign: "center"
        }}>
          <div style={{ color: "var(--red, #e05a5a)", fontWeight: 600, letterSpacing: 1 }}>
            Une erreur est survenue dans ce composant.
          </div>
          <button
            onClick={this.handleReset}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              background: "transparent",
              border: "1px solid var(--border2, #444)",
              color: "var(--text2, #ccc)",
              cursor: "pointer",
              fontSize: 9,
              letterSpacing: 1,
              fontFamily: "'Cinzel', serif"
            }}
          >
            ↺ RÉESSAYER
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
