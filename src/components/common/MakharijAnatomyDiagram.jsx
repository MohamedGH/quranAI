import React, { useState } from "react";
import { ANATOMICAL_ZONES, GENERAL_MAKHAREJ } from "../../utils/makharijData.js";

/**
 * MakharijAnatomyDiagram
 * Diagramme anatomique vectoriel interactif de la coupe de la bouche, langue et gorge.
 * Illustre les 17 points de sortie spécifiques et l'état des organes (langue plate vs bombée pour Tafkhîm).
 */
export function MakharijAnatomyDiagram({
  activeZoneId = null,
  activeLetter = null,
  isHeavyMode = false,
  isChild = false,
  onSelectZone = () => {},
  showLabels = true,
  interactive = true,
}) {
  const [hoveredZone, setHoveredZone] = useState(null);
  const [viewAngle, setViewAngle] = useState("sagittal"); // "sagittal" | "tafkhim_compare"

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
          <span style={{ fontSize: 13 }}>{isChild ? "🌟" : "🔬"}</span>
          <span style={{ fontSize: 11, fontFamily: "'Cinzel', serif", fontWeight: 700, color: "var(--gold2)", letterSpacing: 0.8 }}>
            {isChild ? "LA CARTE SECRÈTE DE TA BOUCHE" : "ANATOMIE DU TRACTUS VOCAL"}
          </span>
        </div>

        {/* Sélecteur de vue : Coupe normale vs Comparaison Tafkhim */}
        <div style={{ display: "inline-flex", background: "var(--surface3)", padding: 2, borderRadius: 6, border: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => setViewAngle("sagittal")}
            style={{
              padding: "4px 8px",
              fontSize: 9,
              fontFamily: "'Cinzel', serif",
              fontWeight: 700,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              background: viewAngle === "sagittal" ? "var(--teal)" : "transparent",
              color: viewAngle === "sagittal" ? "#fff" : "var(--text3)",
              transition: "all .15s",
            }}
          >
            {isChild ? "Vue Découverte" : "Vue Coupe Standard"}
          </button>
          <button
            type="button"
            onClick={() => setViewAngle("tafkhim_compare")}
            style={{
              padding: "4px 8px",
              fontSize: 9,
              fontFamily: "'Cinzel', serif",
              fontWeight: 700,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              background: viewAngle === "tafkhim_compare" ? "linear-gradient(135deg, #ffb703 0%, #fb8500 100%)" : "transparent",
              color: viewAngle === "tafkhim_compare" ? "#000" : "var(--text3)",
              transition: "all .15s",
            }}
          >
            {isChild ? "🦁 Mode Champion (Grave vs Doux)" : "⚖️ Vue Emphase (Grave vs Fine)"}
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div
        style={{
          background: "radial-gradient(ellipse at 45% 45%, #181d2c 0%, #0c0f17 100%)",
          border: "1.5px solid rgba(201,168,76,0.3)",
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
              <stop offset="0%" stopColor="#ffb703" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.95" />
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
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
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
          {/* Incisives supérieures */}
          <rect x="333" y="180" width="8" height="15" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
          {/* Gencive supérieure */}
          <path d="M 326 175 C 335 173 345 174 350 185" fill="none" stroke="#e06d75" strokeWidth="2.5" />
          {/* Incisives inférieures */}
          <rect x="330" y="235" width="8" height="15" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />

          {/* 4. Lèvres (Ash-Shafatayn) */}
          {/* Lèvre supérieure */}
          <path
            d="M 342 195 C 360 195 372 205 368 215 C 362 216 350 212 342 206 Z"
            fill="#e06d75"
            stroke={activeZone?.area === "shafatayn" ? "#a855f7" : "rgba(224, 109, 117, 0.5)"}
            strokeWidth={activeZone?.area === "shafatayn" ? "2.5" : "1.2"}
            filter={activeZone?.area === "shafatayn" ? "url(#glow)" : undefined}
          />
          {/* Lèvre inférieure */}
          <path
            d="M 340 236 C 352 232 366 232 368 242 C 365 252 350 255 338 250 Z"
            fill="#e06d75"
            stroke={activeZone?.area === "shafatayn" ? "#a855f7" : "rgba(224, 109, 117, 0.5)"}
            strokeWidth={activeZone?.area === "shafatayn" ? "2.5" : "1.2"}
            filter={activeZone?.area === "shafatayn" ? "url(#glow)" : undefined}
          />

          {/* 5. Pharynx & Gorge (Al-Halq) */}
          {/* Paroi postérieure du pharynx */}
          <path
            d="M 160 210 C 155 240 152 280 155 330"
            fill="none"
            stroke="rgba(255, 126, 179, 0.5)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Épiglotte */}
          <path
            d="M 180 280 C 172 265 178 255 184 258 C 187 262 185 275 186 288"
            fill="#e06d75"
            stroke="#f43f5e"
            strokeWidth="1.2"
          />
          <text x="145" y="270" fill="#ff7eb3" fontSize="8" textAnchor="end">
            Épiglotte
          </text>
          {/* Larynx / Cordes vocales */}
          <ellipse cx="170" cy="315" rx="10" ry="6" fill="rgba(255, 126, 179, 0.3)" stroke="#ff7eb3" strokeWidth="1.5" />
          <text x="145" y="320" fill="#ff7eb3" fontSize="8" textAnchor="end">
            Cordes vocales
          </text>

          {/* 6. LA LANGUE (Al-Lisân) - Affichage dynamique selon vue standard vs Tafkhim */}
          {viewAngle === "tafkhim_compare" ? (
            /* Mode Comparatif Tafkhim (Grave vs Fine) */
            <g>
              {/* Silhouette fantôme de la langue fine (Tarqiq - plate) */}
              <path
                d="M 185 285 C 190 250 205 235 235 230 C 270 225 305 220 326 215 C 315 235 295 260 250 280 C 215 295 195 295 185 285 Z"
                fill="none"
                stroke="#56d4bc"
                strokeWidth="2"
                strokeDasharray="4 3"
                opacity="0.8"
              />
              <text x="260" y="250" fill="#56d4bc" fontSize="9" fontWeight="700">
                1. Fine (Tarqiq) : Langue plate
              </text>

              {/* Langue active bombée et creusée (Tafkhim - grave) */}
              <path
                d="M 180 290 C 178 245 190 205 215 192 C 240 215 275 220 305 215 C 322 210 326 200 326 195 C 315 235 290 265 245 288 C 210 300 190 300 180 290 Z"
                fill="url(#tongueGradHeavy)"
                stroke="#ffb703"
                strokeWidth="2.5"
                filter="url(#glow)"
              />
              <text x="210" y="175" fill="#ffe082" fontSize="9" fontWeight="700">
                2. Grave (Tafkhim) : Arrière surélevé ⬆
              </text>
              {/* Flèche d'élévation postérieure */}
              <path d="M 205 210 L 205 185 M 200 192 L 205 185 L 210 192" stroke="#ffb703" strokeWidth="2" fill="none" />
              {/* Flèche de creusement central (cuillère) */}
              <path d="M 255 205 L 255 222 M 250 215 L 255 222 L 260 215" stroke="#ffe082" strokeWidth="1.8" fill="none" />
            </g>
          ) : (
            /* Mode Standard : Langue complète avec ses zones */
            <path
              d="M 185 285 C 190 240 205 215 235 205 C 270 200 305 195 328 190 C 318 225 295 255 250 280 C 215 295 195 295 185 285 Z"
              fill={isHeavyMode ? "url(#tongueGradHeavy)" : "url(#tongueGradNormal)"}
              stroke={isHeavyMode ? "#ffb703" : "#f43f5e"}
              strokeWidth="2"
              filter={activeZone?.area === "lisan" ? "url(#glow)" : undefined}
            />
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
                  transition="all .2s ease"
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
