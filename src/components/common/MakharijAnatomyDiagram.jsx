import React, { useState } from "react";
import { ANATOMICAL_ZONES, getTonguePostureSpec } from "../../utils/makharijData.js";

/**
 * MakharijAnatomyDiagram
 * Diagramme anatomique vectoriel interactif de la coupe de la bouche, langue et gorge.
 * Illustre les points de sortie spécifiques et bascule automatiquement sur la posture de Tafkhîm
 * (langue bombée/relevée à l'arrière, creux en cuillère pour Itbâq, résonance palatine)
 * lorsqu'une lettre grave (خ ص ض غ ط ق ظ) est sélectionnée.
 */
export function MakharijAnatomyDiagram({
  activeZoneId = null,
  activeLetter = null,
  isHeavyMode = false,
  isChild = false,
  onSelectZone = () => {},
}) {
  const [hoveredZone, setHoveredZone] = useState(null);
  const [viewAngle, setViewAngle] = useState("auto"); // "auto" | "tafkhim_compare"

  const posture = getTonguePostureSpec(activeLetter, isHeavyMode);
  const showTafkhimComparison = viewAngle === "tafkhim_compare" || posture.isTafkhim;

  // Trouve la zone active
  const currentZone = Object.values(ANATOMICAL_ZONES).find(
    (z) => z.id === activeZoneId || (activeLetter && z.letters.includes(activeLetter))
  );

  const activeZone = hoveredZone ? ANATOMICAL_ZONES[hoveredZone] : currentZone;

  return (
    <div className="makharij-diagram-container" style={{ position: "relative", width: "100%", maxWidth: 520, margin: "0 auto" }}>
      {/* Barre d'outils du diagramme */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13 }}>{posture.isTafkhim ? "🦁" : isChild ? "🌟" : "🔬"}</span>
          <span style={{ fontSize: 11, fontFamily: "'Cinzel', serif", fontWeight: 700, color: posture.isTafkhim ? "#ffb703" : "var(--gold2)", letterSpacing: 0.8 }}>
            {posture.isTafkhim
              ? (isChild ? "SCHÉMA TAFKHÎM · LANGUE DE CHAMPION" : "SCHÉMA ANATOMIQUE · POSTURE TAFKHÎM")
              : (isChild ? "LA CARTE SECRÈTE DE TA BOUCHE" : "ANATOMIE DU TRACTUS VOCAL")}
          </span>
        </div>

        {/* Sélecteur de vue : Automatique (suit la lettre) vs Comparaison Tafkhim */}
        <div style={{ display: "inline-flex", background: "var(--surface3)", padding: 2, borderRadius: 6, border: "1px solid var(--border)" }}>
          <button
            type="button"
            id="btn-diagram-auto-view"
            onClick={() => setViewAngle("auto")}
            style={{
              padding: "4px 8px",
              fontSize: 9,
              fontFamily: "'Cinzel', serif",
              fontWeight: 700,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              background: viewAngle === "auto" ? (posture.isTafkhim ? "linear-gradient(135deg, #ffb703 0%, #d97706 100%)" : "var(--teal)") : "transparent",
              color: viewAngle === "auto" ? (posture.isTafkhim ? "#000" : "#fff") : "var(--text3)",
              transition: "all .15s",
            }}
          >
            {posture.isTafkhim ? "Posture Grave Active" : (isChild ? "Vue Découverte" : "Vue Lettre Active")}
          </button>
          <button
            type="button"
            id="btn-diagram-compare-tafkhim"
            onClick={() => setViewAngle("tafkhim_compare")}
            style={{
              padding: "4px 8px",
              fontSize: 9,
              fontFamily: "'Cinzel', serif",
              fontWeight: 700,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              background: viewAngle === "tafkhim_compare" ? "linear-gradient(135deg, #ffb703 0%, #fb8500 100%)" : "transparent",
              color: viewAngle === "tafkhim_compare" ? "#000" : "var(--text3)",
              transition: "all .15s",
            }}
          >
            {isChild ? "🦁 Comparer Grave vs Doux" : "⚖️ Comparer Fine vs Grave"}
          </button>
        </div>
      </div>

      {/* Bandeau d'état anatomique (Typographie épurée sans pilules) */}
      <div
        id="diagram-posture-status"
        data-posture={posture.category}
        style={{
          marginBottom: 8,
          padding: "7px 11px",
          borderRadius: 8,
          background: posture.isTafkhim ? "rgba(255, 183, 3, 0.10)" : "rgba(86, 212, 188, 0.08)",
          border: `1px solid ${posture.isTafkhim ? "rgba(255, 183, 3, 0.45)" : "rgba(86, 212, 188, 0.30)"}`,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontFamily: "'Cinzel', serif", fontWeight: 800, color: posture.isTafkhim ? "#ffd166" : "var(--teal2)" }}>
            {isChild ? posture.childPostureLabel : posture.postureLabel}
          </span>
          <span style={{ fontSize: 9, color: posture.isTafkhim ? "#fbbf24" : "var(--text3)", fontWeight: 600 }}>
            {posture.mechanisms.join(" · ")}
          </span>
        </div>
        <div style={{ fontSize: 9.5, color: "var(--text2)", lineHeight: 1.4 }}>
          {isChild ? posture.childPostureDetail : posture.postureDetail}
        </div>
      </div>

      {/* SVG Container */}
      <div
        style={{
          background: posture.isTafkhim
            ? "radial-gradient(ellipse at 45% 45%, #241d12 0%, #0d0f17 100%)"
            : "radial-gradient(ellipse at 45% 45%, #181d2c 0%, #0c0f17 100%)",
          border: posture.isTafkhim ? "1.5px solid rgba(255, 183, 3, 0.55)" : "1.5px solid rgba(201,168,76,0.3)",
          borderRadius: 14,
          padding: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <svg
          viewBox="0 0 420 370"
          className="makharij-svg"
          data-tafkhim={posture.isTafkhim ? "true" : "false"}
          data-itbaq={posture.isItbaq ? "true" : "false"}
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label="Schéma anatomique des points de sortie des lettres arabes (Makharij al-Huroof)"
        >
          <defs>
            {/* Dégradés pour les zones */}
            <radialGradient id="jawfGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#56d4bc" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#56d4bc" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pulseHighlight" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffb703" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#ffb703" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffb703" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="tongueGradNormal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e06d75" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#b83b4b" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="tongueGradHeavy" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd166" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#b45309" stopOpacity="0.98" />
            </linearGradient>
            <linearGradient id="palateGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#94a3b8" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.7" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grille de fond subtile */}
          <g opacity="0.08" stroke="#fff" strokeWidth="0.5">
            <line x1="50" y1="0" x2="50" y2="370" />
            <line x1="150" y1="0" x2="150" y2="370" />
            <line x1="250" y1="0" x2="250" y2="370" />
            <line x1="350" y1="0" x2="350" y2="370" />
            <line x1="0" y1="100" x2="420" y2="100" />
            <line x1="0" y1="200" x2="420" y2="200" />
            <line x1="0" y1="300" x2="420" y2="300" />
          </g>

          {/* Contour de la tête (Profil droit) */}
          <path
            d="M 120 360 C 100 320 90 260 90 190 C 90 90 160 30 260 30 C 330 30 380 70 385 120 C 388 150 370 170 372 195 C 374 208 395 212 395 220 C 395 228 375 235 372 242 C 370 252 388 262 382 278 C 375 295 345 305 330 312 C 290 330 250 345 220 360 Z"
            fill="rgba(30, 41, 59, 0.3)"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />

          {/* 1. Cavité nasale (Al-Khayshûm) */}
          <path
            d="M 230 140 C 230 100 270 85 330 95 C 360 100 365 140 335 150 C 290 155 240 155 230 140 Z"
            fill={activeZone?.area === "khayshum" ? "rgba(56, 189, 248, 0.28)" : "rgba(56, 189, 248, 0.08)"}
            stroke={activeZone?.area === "khayshum" ? "#38bdf8" : "rgba(56, 189, 248, 0.3)"}
            strokeWidth={activeZone?.area === "khayshum" ? "2.5" : "1.2"}
            style={{ cursor: "pointer", transition: "all .2s" }}
            onClick={() => onSelectZone("nasal_cavity")}
          />
          <text x="280" y="125" textAnchor="middle" fill="#38bdf8" fontSize="10" fontFamily="'Cinzel', serif" opacity="0.8">
            الخَيْشُوم (Nez)
          </text>

          {/* 2. Palais dur & Palais mou (Voile) + Luette */}
          {/* Os du palais dur */}
          <path
            d="M 220 185 C 250 170 290 168 332 178 C 336 179 336 186 332 188 C 290 178 250 180 220 195 Z"
            fill="url(#palateGrad)"
            stroke={showTafkhimComparison ? "#fbbf24" : "rgba(255,255,255,0.3)"}
            strokeWidth={showTafkhimComparison ? "1.4" : "1"}
          />
          {/* Voile du palais mou et luette qui pend */}
          <path
            d="M 220 185 C 195 190 182 205 180 222 C 178 228 184 230 186 225 C 190 210 200 198 220 195 Z"
            fill="#e2e8f0"
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
          <text x="175" y="240" fill="#94a3b8" fontSize="8.5" fontFamily="'Cinzel', serif" textAnchor="end">
            Luette (Uvule)
          </text>

          {/* 3. Incisives supérieures & inférieures */}
          <rect x="333" y="180" width="8" height="15" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
          <path d="M 326 175 C 335 173 345 174 350 185" fill="none" stroke="#e06d75" strokeWidth="2.5" />
          <rect x="330" y="235" width="8" height="15" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />

          {/* 4. Lèvres (Ash-Shafatayn) */}
          <path
            d="M 342 195 C 360 195 372 205 368 215 C 362 216 350 212 342 206 Z"
            fill="#e06d75"
            stroke={activeZone?.area === "shafatayn" ? "#a855f7" : "rgba(224, 109, 117, 0.5)"}
            strokeWidth={activeZone?.area === "shafatayn" ? "2.5" : "1.2"}
            filter={activeZone?.area === "shafatayn" ? "url(#glow)" : undefined}
          />
          <path
            d="M 340 236 C 352 232 366 232 368 242 C 365 252 350 255 338 250 Z"
            fill="#e06d75"
            stroke={activeZone?.area === "shafatayn" ? "#a855f7" : "rgba(224, 109, 117, 0.5)"}
            strokeWidth={activeZone?.area === "shafatayn" ? "2.5" : "1.2"}
            filter={activeZone?.area === "shafatayn" ? "url(#glow)" : undefined}
          />

          {/* 5. Pharynx & Gorge (Al-Halq) */}
          <path
            d="M 160 210 C 155 240 152 280 155 330"
            fill="none"
            stroke={showTafkhimComparison ? "#fbbf24" : "rgba(255, 126, 179, 0.5)"}
            strokeWidth={showTafkhimComparison ? "3.5" : "3"}
            strokeLinecap="round"
          />
          <path
            d="M 180 280 C 172 265 178 255 184 258 C 187 262 185 275 186 288"
            fill="#e06d75"
            stroke="#f43f5e"
            strokeWidth="1.2"
          />
          <text x="145" y="270" fill="#ff7eb3" fontSize="8" textAnchor="end">
            Épiglotte
          </text>
          <ellipse cx="170" cy="315" rx="10" ry="6" fill="rgba(255, 126, 179, 0.3)" stroke="#ff7eb3" strokeWidth="1.5" />
          <text x="145" y="320" fill="#ff7eb3" fontSize="8" textAnchor="end">
            Cordes vocales
          </text>

          {/* 6. LA LANGUE (Al-Lisân) - Posture dynamique Tafkhîm vs Tarqîq */}
          {showTafkhimComparison ? (
            <g className="tafkhim-posture-layer">
              {/* Silhouette de référence de la langue fine plate (Tarqîq) pour montrer l'élévation */}
              <path
                d={posture.ghostThinPath || "M 185 285 C 192 250 208 232 238 225 C 272 218 304 214 326 210 C 316 238 292 262 250 282 C 215 296 195 295 185 285 Z"}
                fill="rgba(86, 212, 188, 0.08)"
                stroke="#56d4bc"
                strokeWidth="1.8"
                strokeDasharray="4 3"
                opacity="0.85"
              />
              <text x="268" y="266" fill="#56d4bc" fontSize="8.5" fontWeight="700" textAnchor="middle">
                {viewAngle === "tafkhim_compare" ? "1. Fine (Tarqîq) : Langue plate" : "Réf. fine (plate)"}
              </text>

              {/* Langue active en posture Tafkhîm (Isti'lâ' / Itbâq) */}
              <path
                d={posture.isTafkhim ? posture.tonguePath : "M 174 290 C 170 242 184 200 212 188 C 236 212 268 216 298 202 C 314 194 324 188 330 190 C 318 234 292 265 246 288 C 208 302 186 300 174 290 Z"}
                fill="url(#tongueGradHeavy)"
                stroke="#ffb703"
                strokeWidth="2.5"
                filter="url(#glow)"
              />

              {/* Rétrécissement pharyngien (Tadyîq al-Halq) */}
              <path
                d="M 164 238 L 173 238 M 169 234 L 173 238 L 169 242"
                stroke="#fbbf24"
                strokeWidth="1.6"
                fill="none"
                opacity="0.85"
              />

              {/* Flèche d'élévation postérieure (Isti'lâ') */}
              <g className="istila-arrow">
                <path
                  d="M 204 222 L 204 190 M 199 197 L 204 190 L 209 197"
                  stroke="#fff3cd"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <line x1="175" y1="84" x2="202" y2="184" stroke="#ffe082" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
                <text x="175" y="76" fill="#ffe082" fontSize="9.5" fontWeight="800" fontFamily="'Cinzel', serif" textAnchor="middle">
                  {isChild ? "🦁 Arrière relevé (Tafkhîm)" : "⬆ TAFKHÎM · ISTI'LÂ'"}
                </text>
              </g>

              {/* Creux en cuillère central & chambre d'écho (Itbâq pour ط ض ص ظ ou comparaison) */}
              {(posture.showSpoonConcavity || viewAngle === "tafkhim_compare") && (
                <g className="itbaq-spoon-indicator">
                  <path
                    d="M 244 203 Q 260 194 276 203"
                    fill="none"
                    stroke="#ffd166"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                  <path
                    d="M 248 195 Q 260 187 272 195"
                    fill="none"
                    stroke="#ffe082"
                    strokeWidth="1.4"
                    opacity="0.9"
                  />
                  <path
                    d="M 260 202 L 260 216 M 256 211 L 260 216 L 264 211"
                    stroke="#fff3cd"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <line x1="292" y1="84" x2="262" y2="194" stroke="#ffd166" strokeWidth="1" strokeDasharray="3 2" opacity="0.55" />
                  <text x="292" y="76" fill="#ffd166" fontSize="8.5" fontWeight="700" textAnchor="middle">
                    {isChild ? "🥣 Cuillère d'écho" : "🥣 Creux (Itbâq)"}
                  </text>
                </g>
              )}

              {/* Ondes d'écho acoustique dans la voûte palatine pour les 3 non-Itbaq graves (ق غ خ) */}
              {!posture.showSpoonConcavity && posture.showPalatalResonance && (
                <g className="tafkhim-resonance-arcs" opacity="0.88">
                  <path d="M 218 196 Q 238 184 260 192" fill="none" stroke="#ffd166" strokeWidth="1.6" strokeDasharray="3 2" />
                  <path d="M 224 189 Q 244 178 266 186" fill="none" stroke="#ffe082" strokeWidth="1.3" />
                  <text x="292" y="76" fill="#ffd166" fontSize="8.5" fontWeight="700" textAnchor="middle">
                    🔊 Écho grave
                  </text>
                </g>
              )}
            </g>
          ) : (
            /* Mode Standard Tarqîq : Langue détendue et plate */
            <g className="tarqiq-posture-layer">
              <path
                d={posture.tonguePath}
                fill="url(#tongueGradNormal)"
                stroke="#f43f5e"
                strokeWidth="2"
                filter={activeZone?.area === "lisan" ? "url(#glow)" : undefined}
              />
              {/* Flux d'air horizontal doux (Tarqîq) */}
              <path
                d="M 220 205 Q 275 202 332 202 M 325 198 L 333 202 L 325 206"
                fill="none"
                stroke="#56d4bc"
                strokeWidth="1.4"
                strokeDasharray="3 2"
                opacity="0.7"
              />
            </g>
          )}

          {/* 7. Repères interactifs des zones spécifiques (Points d'articulation) */}
          {Object.values(ANATOMICAL_ZONES).map((z) => {
            const isTarget = currentZone?.id === z.id;
            const isHover = hoveredZone === z.id;
            const hasLetter = activeLetter && z.letters.includes(activeLetter);
            const isHighlighted = isTarget || isHover || hasLetter;

            return (
              <g
                key={z.id}
                className="makhraj-hotspot"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredZone(z.id)}
                onMouseLeave={() => setHoveredZone(null)}
                onClick={() => onSelectZone(z.id)}
              >
                {/* Halo d'aura si actif */}
                {isHighlighted && (
                  <circle
                    cx={z.cx}
                    cy={z.cy}
                    r={z.r + 8}
                    fill="url(#pulseHighlight)"
                    filter="url(#glow)"
                  >
                    <animate attributeName="r" values={`${z.r + 4};${z.r + 14};${z.r + 4}`} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Point d'articulation central */}
                <circle
                  cx={z.cx}
                  cy={z.cy}
                  r={isHighlighted ? 9 : 5.5}
                  fill={isHighlighted ? "#ffb703" : "rgba(255,255,255,0.7)"}
                  stroke={isHighlighted ? "#fff" : "rgba(0,0,0,0.6)"}
                  strokeWidth={isHighlighted ? 2.5 : 1}
                  style={{ transition: "all .2s ease" }}
                />

                {/* Lettres associées affichées sur les points chauds actifs */}
                {isHighlighted && (
                  <g>
                    <rect
                      x={z.cx - 28}
                      y={z.cy - 30}
                      width="56"
                      height="20"
                      rx="10"
                      fill="rgba(15, 23, 42, 0.92)"
                      stroke="#ffb703"
                      strokeWidth="1.2"
                    />
                    <text
                      x={z.cx}
                      y={z.cy - 16}
                      fill="#ffd166"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="'Amiri Quran', serif"
                      textAnchor="middle"
                      direction="rtl"
                    >
                      {z.letters.join(" ")}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Fiche flottante de zone active ou survolée */}
        {activeZone && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              right: 8,
              background: "rgba(11, 15, 25, 0.94)",
              backdropFilter: "blur(8px)",
              border: "1.5px solid #ffb703",
              borderRadius: 10,
              padding: "8px 12px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              zIndex: 10,
              animation: "fadeIn .2s ease",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#ffb703" }}>{isChild ? "⭐" : "📍"}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "'Cinzel', serif" }}>
                  {isChild ? (activeZone.childLabel || activeZone.label) : activeZone.label}
                </span>
                <span style={{ fontSize: 11, color: "#ffe082", fontFamily: "'Amiri Quran', serif", direction: "rtl" }}>
                  ({activeZone.arabic})
                </span>
              </div>
              <div style={{ fontSize: 9.5, color: "var(--text2)", lineHeight: 1.35 }}>
                {isChild ? (activeZone.childDescription || activeZone.description) : activeZone.description}
              </div>
            </div>

            {/* Lettres du point d'articulation */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {activeZone.letters.map((ltr) => (
                <span
                  key={ltr}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: ltr === activeLetter ? "linear-gradient(135deg, #ffb703 0%, #fb8500 100%)" : "rgba(255,255,255,0.08)",
                    border: ltr === activeLetter ? "1.5px solid #ffd166" : "1px solid rgba(255,255,255,0.15)",
                    color: ltr === activeLetter ? "#000" : "#fff",
                    fontFamily: "'Amiri Quran', serif",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {ltr}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Légende rapide des 5 grands organes */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, justifyContent: "center" }}>
        {[
          { key: "halq", icon: "🔴", label: isChild ? "Grotte de la Gorge" : "Gorge (الحلق)", color: "#ff7eb3" },
          { key: "lisan", icon: "👅", label: isChild ? "Langue Magicienne" : "Langue (اللسان)", color: "#ffb703" },
          { key: "shafatayn", icon: "👄", label: isChild ? "Deux Lèvres Douces" : "Lèvres (الشفتان)", color: "#a855f7" },
          { key: "jawf", icon: "🟢", label: isChild ? "Grand Toboggan" : "Cavité (الجوف)", color: "#56d4bc" },
          { key: "khayshum", icon: "👃", label: isChild ? "Clochette du Nez" : "Nez (الخيشوم)", color: "#38bdf8" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectZone(item.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 14,
              border: `1px solid ${activeZone?.area === item.key ? item.color : "rgba(255,255,255,0.12)"}`,
              background: activeZone?.area === item.key ? "rgba(255,255,255,0.08)" : "transparent",
              color: item.color,
              fontSize: 9,
              fontFamily: "'Cinzel', serif",
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
