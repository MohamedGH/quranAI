import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import { useNavigate } from "react-router-dom";

export function ChildUnlockQuranCelebrationModal() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isOpen = useSelector(sel.showChildCelebrationModal);
  const validatedCount = useSelector(sel.validatedLettersCount);

  if (!isOpen) return null;

  const handleClose = () => {
    dispatch(uiActions.setShowChildCelebrationModal(false));
  };

  const handleOpenQuran = () => {
    dispatch(uiActions.setShowChildCelebrationModal(false));
    dispatch(uiActions.setActivePage("quran"));
    navigate("/quran");
  };

  return (
    <div
      id="child-unlock-quran-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="child-unlock-modal-title"
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2800,
        background: "rgba(8, 12, 22, 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn .25s ease-out",
      }}
    >
      <div
        id="child-unlock-quran-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "linear-gradient(180deg, #1f2538 0%, #121624 100%)",
          border: "2px solid #ffd166",
          borderRadius: "22px",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.75), 0 0 40px rgba(255, 209, 102, 0.35)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "32px 24px 26px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top glowing ambient beam */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "80%",
            height: "4px",
            background: "linear-gradient(90deg, transparent, #ffd166, transparent)",
          }}
        />

        {/* Big icon celebration */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1,
              filter: "drop-shadow(0 0 20px rgba(255, 209, 102, 0.6))",
              animation: "bounce 1.4s ease infinite",
            }}
          >
            👑 📖 ⭐
          </div>
        </div>

        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255, 209, 102, 0.18)",
            border: "1px solid rgba(255, 209, 102, 0.5)",
            borderRadius: 20,
            padding: "4px 14px",
            fontSize: 10,
            fontWeight: 800,
            fontFamily: "'Cinzel', serif",
            color: "#ffd166",
            letterSpacing: 1.5,
            marginBottom: 14,
          }}
        >
          <span>🏆 GRAND EXPLOIT DU PETIT CHAMPION</span>
        </div>

        <h2
          id="child-unlock-modal-title"
          style={{
            margin: "0 0 10px",
            fontSize: 22,
            fontWeight: 800,
            fontFamily: "'Cinzel', serif",
            color: "#ffd166",
            letterSpacing: 1,
            lineHeight: 1.25,
          }}
        >
          ALLAHOU AKBAR ! 🎉<br />
          LE SAINT CORAN EST DÉBLOQUÉ !
        </h2>

        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text1)",
            maxWidth: 420,
          }}
        >
          Félicitations petit champion ! Tu as appris et validé les <strong>{validatedCount} lettres</strong> de l'alphabet arabe.
          Le menu <strong>LECTURE DU CORAN</strong> est maintenant accessible dans ta barre en haut !
        </p>

        {/* Visual unlocked certificate */}
        <div
          style={{
            width: "100%",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px dashed rgba(255, 209, 102, 0.4)",
            borderRadius: 14,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
          }}
        >
          <div>
            <div style={{ fontSize: 18, color: "#ffd166" }}>⭐⭐⭐</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>28/28 LETTRES</div>
          </div>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.1)" }} />
          <div>
            <div style={{ fontSize: 18 }}>🔓 📖</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teal2)" }}>CORAN OUVERT</div>
          </div>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.1)" }} />
          <div>
            <div style={{ fontSize: 18 }}>🌟 🚀</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#a68434" }}>NIVEAU RÉUSSITE</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          <button
            id="btn-celebration-open-quran"
            onClick={handleOpenQuran}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: "12px",
              border: "1px solid #ffd166",
              background: "linear-gradient(135deg, #ffd166 0%, #e09f3e 100%)",
              color: "#121624",
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "'Cinzel', serif",
              letterSpacing: 1,
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(255, 209, 102, 0.4)",
              transition: "transform .15s, box-shadow .15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <span>📖</span>
            <span>OUVRIR LE SAINT CORAN MAINTENANT !</span>
            <span>🚀</span>
          </button>

          <button
            id="btn-celebration-stay-letters"
            onClick={handleClose}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "10px",
              border: "none",
              background: "transparent",
              color: "var(--text3)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Continuer à m'entraîner sur les lettres 🌟
          </button>
        </div>
      </div>
    </div>
  );
}
