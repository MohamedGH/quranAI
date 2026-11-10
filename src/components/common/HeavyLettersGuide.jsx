import React, { useState } from "react";
import { HEAVY_LETTERS_DATA, DETAILED_ARABIC_LETTERS } from "../../utils/makharijData.js";
import { MakharijAnatomyDiagram } from "./MakharijAnatomyDiagram.jsx";

/**
 * HeavyLettersGuide
 * Module complet d'apprentissage des Lettres Graves (التفخيم والاستعلاء)
 * - Explication de la formule خُصَّ ضَغْطٍ قِظْ
 * - Les 4 lettres d'Itbâq
 * - Comparateur audio Fin vs Grave
 * - Les 5 degrés de Tafkhîm
 * - Visualisations anatomiques de la bouche et de la langue
 */
export function HeavyLettersGuide({ speak = () => {}, playingId = null }) {
  const [selectedHeavyLetter, setSelectedHeavyLetter] = useState("ط");
  const [activeContrastPair, setActiveContrastPair] = useState("ta_ta");

  const letterInfo = HEAVY_LETTERS_DATA.letters.find((l) => l.letter === selectedHeavyLetter) || HEAVY_LETTERS_DATA.letters[0];

  return (
    <div className="heavy-letters-guide" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── BANNIÈRE D'INTRODUCTION AU TAFKHÎM ── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255, 183, 3, 0.16) 0%, rgba(251, 133, 0, 0.08) 100%)",
          border: "1.5px solid rgba(255, 183, 3, 0.45)",
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚖️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ffe082", fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>
                LES LETTRES GRAVES & EMPHATIQUES (حُرُوفُ التَّفْخِيمِ وَالإِسْتِعْلَاءِ)
              </div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                La formule mnémotechnique sacrée : <strong style={{ color: "#ffd166", fontFamily: "'Amiri Quran', serif", fontSize: 18, direction: "rtl" }}>خُصَّ ضَغْطٍ قِظْ</strong>
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              background: "rgba(255, 183, 3, 0.2)",
              border: "1px solid rgba(255, 183, 3, 0.5)",
              color: "#ffb703",
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "'Cinzel', serif",
            }}
          >
            7 LETTRES ESSENTIELLES
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.6, margin: 0 }}>
          En langue arabe et en Tajweed, le <strong>Tafkhîm (تَفْخِيم)</strong> signifie « rendre le son gras, lourd et profond ».
          La bouche s'emplit de la résonance du son grâce à l'élévation de l'arrière de la langue (<em>Istilâ'</em>) vers le voile du palais.
          À l'inverse, les autres lettres de l'alphabet sont fines (<em>Tarqîq</em>) et se prononcent avec la bouche plate comme un léger sourire.
        </p>

        {/* 4 Piliers physiologiques */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 4 }}>
          {HEAVY_LETTERS_DATA.pronunciationSteps.map((s) => (
            <div
              key={s.step}
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 183, 3, 0.2)",
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#ffe082", fontFamily: "'Cinzel', serif" }}>
                  Règle {s.step}
                </span>
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#fff" }}>{s.title}</div>
              <div style={{ fontSize: 9.5, color: "var(--text3)", lineHeight: 1.4 }}>{s.explanation}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── LES 7 LETTRES D'ISTILA' : EXPLORATION INTERACTIVE ── */}
      <div>
        <div className="pronon-section-title" style={{ marginBottom: 12 }}>
          LES 7 LETTRES GRAVES DE LA FORMULE (خُصَّ ضَغْطٍ قِظْ)
        </div>

        {/* Grille de sélection des 7 lettres */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 16 }}>
          {HEAVY_LETTERS_DATA.letters.map((l) => {
            const isSelected = selectedHeavyLetter === l.letter;
            return (
              <button
                key={l.letter}
                type="button"
                onClick={() => {
                  setSelectedHeavyLetter(l.letter);
                  speak(l.letter, `heavy-btn-${l.letter}`);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "12px 6px",
                  borderRadius: 12,
                  border: isSelected ? "2px solid #ffb703" : "1px solid rgba(255,255,255,0.12)",
                  background: isSelected
                    ? "linear-gradient(180deg, rgba(255,183,3,0.25) 0%, rgba(251,133,0,0.15) 100%)"
                    : "var(--surface2)",
                  cursor: "pointer",
                  transition: "all .15s",
                  boxShadow: isSelected ? "0 4px 16px rgba(255,183,3,0.3)" : "none",
                }}
              >
                <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 28, color: isSelected ? "#fff8db" : "#ffd166", lineHeight: 1 }}>
                  {l.letter}
                </div>
                <div style={{ fontSize: 10, fontFamily: "'Cinzel', serif", fontWeight: 700, color: isSelected ? "#ffb703" : "var(--text3)" }}>
                  {l.name}
                </div>
                {l.itbaq && (
                  <span
                    style={{
                      fontSize: 7.5,
                      padding: "1px 4px",
                      borderRadius: 4,
                      background: "rgba(239, 68, 68, 0.25)",
                      color: "#fca5a5",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      fontWeight: 700,
                    }}
                  >
                    ITBÂQ
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Détail de la lettre grave sélectionnée avec schéma anatomique côte à côte */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }} className="heavy-detail-grid">
          {/* Fiche d'articulation de la lettre */}
          <div
            style={{
              background: "var(--surface2)",
              border: "1.5px solid rgba(255, 183, 3, 0.35)",
              borderRadius: 14,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'Amiri Quran', serif", fontSize: 44, color: "#ffe082", lineHeight: 1 }}>
                  {letterInfo.letter}
                </span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Cinzel', serif" }}>
                    Lettre {letterInfo.name} ({letterInfo.trans})
                  </div>
                  <div style={{ fontSize: 10, color: "#ffb703", fontWeight: 600 }}>{letterInfo.rankLabel}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => speak(letterInfo.letter, `heavy-play-${letterInfo.letter}`)}
                className={`pronon-play-btn${playingId === `heavy-play-${letterInfo.letter}` ? " playing" : ""}`}
                style={{
                  background: "linear-gradient(135deg, #ffb703 0%, #fb8500 100%)",
                  border: "1px solid #ffd166",
                  color: "#000",
                  fontWeight: 800,
                  padding: "8px 14px",
                  borderRadius: 20,
                  fontSize: 10,
                }}
              >
                {playingId === `heavy-play-${letterInfo.letter}` ? "⏹ STOP" : "▶ ÉCOUTER"}
              </button>
            </div>

            {/* Itbaq vs Istila' Badge */}
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: letterInfo.itbaq ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 183, 3, 0.12)",
                border: `1px solid ${letterInfo.itbaq ? "rgba(239, 68, 68, 0.4)" : "rgba(255, 183, 3, 0.4)"}`,
                fontSize: 11,
                color: letterInfo.itbaq ? "#fca5a5" : "#ffe082",
                lineHeight: 1.45,
              }}
            >
              <strong>{letterInfo.itbaq ? "⭐ Double Puissance (Itbâq + Istilâ')" : "🌟 Istilâ' (Élévation de la langue)"} :</strong>{" "}
              {letterInfo.description}
            </div>

            {/* Conseils d'articulation */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "var(--gold2)", fontFamily: "'Cinzel', serif", marginBottom: 4 }}>
                COMMENT LA PRONONCER PRÉCISÉMENT :
              </div>
              <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.6 }}>{letterInfo.soundTip}</div>
            </div>

            {/* Entraînement avec les 4 voyelles */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "var(--gold2)", fontFamily: "'Cinzel', serif", marginBottom: 8 }}>
                ENTRAÎNEMENT AVEC LES VOYELLES :
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {[
                  { sign: "َ", name: "Fatḥa (A)", sound: letterInfo.letter + "َ" },
                  { sign: "ِ", name: "Kasra (I)", sound: letterInfo.letter + "ِ" },
                  { sign: "ُ", name: "Ḍamma (OU)", sound: letterInfo.letter + "ُ" },
                  { sign: "ْ", name: "Soukoun (Sec)", sound: letterInfo.letter + "ْ" },
                ].map((v, vi) => {
                  const pid = `heavy-vow-${letterInfo.letter}-${vi}`;
                  return (
                    <button
                      key={vi}
                      type="button"
                      onClick={() => speak(v.sound, pid)}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 8,
                        background: playingId === pid ? "rgba(62,184,160,0.2)" : "var(--surface3)",
                        border: `1px solid ${playingId === pid ? "var(--teal)" : "var(--border)"}`,
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <span style={{ fontFamily: "'Amiri Quran', serif", fontSize: 24, color: "#ffd166" }}>{v.sound}</span>
                      <span style={{ fontSize: 8, color: "var(--text3)" }}>{v.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Exemple de mot de contraste */}
            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                borderRadius: 8,
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--text2)" }}>
                Exemple coranique : <strong style={{ color: "#ffd166" }}>{letterInfo.contrastPair.heavyWord}</strong>
              </div>
              <button
                type="button"
                onClick={() => speak(letterInfo.contrastPair.heavyWord, `contrast-ex-${letterInfo.letter}`)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--teal2)",
                  fontSize: 10,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                🔊 Écouter
              </button>
            </div>
          </div>

          {/* Schéma anatomique dynamique montrant la langue bombée */}
          <div>
            <MakharijAnatomyDiagram
              activeLetter={selectedHeavyLetter}
              isHeavyMode={true}
              showLabels={true}
            />
          </div>
        </div>
      </div>

      {/* ── ATELIER COMPARATIF : PAIRES DE CONTRASTE FINE VS GRAVE ── */}
      <div
        style={{
          background: "var(--surface2)",
          border: "1.5px solid rgba(86, 212, 188, 0.35)",
          borderRadius: 14,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>⚔️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal2)", fontFamily: "'Cinzel', serif" }}>
              ATELIER D'ÉCOUTE COMPARATIVE : FINE (TARQÎQ) VS GRAVE (TAFKHÎM)
            </div>
            <div style={{ fontSize: 10, color: "var(--text3)" }}>
              Cliquez pour entendre la différence qui évite de changer le sens des versets du Coran.
            </div>
          </div>
        </div>

        {/* Sélecteur de paire de contraste */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {HEAVY_LETTERS_DATA.contrastPairs.map((pair) => (
            <button
              key={pair.id}
              type="button"
              onClick={() => setActiveContrastPair(pair.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: activeContrastPair === pair.id ? "1.5px solid var(--teal)" : "1px solid var(--border)",
                background: activeContrastPair === pair.id ? "rgba(86, 212, 188, 0.18)" : "var(--surface3)",
                color: activeContrastPair === pair.id ? "var(--teal2)" : "var(--text2)",
                fontSize: 11,
                fontFamily: "'Cinzel', serif",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              {pair.title}
            </button>
          ))}
        </div>

        {/* Carte de comparaison côte à côte */}
        {(() => {
          const pair = HEAVY_LETTERS_DATA.contrastPairs.find((p) => p.id === activeContrastPair) || HEAVY_LETTERS_DATA.contrastPairs[0];
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="contrast-cards-grid">
                {/* Côté Fin (Tarqîq) */}
                <div
                  style={{
                    background: "rgba(86, 212, 188, 0.06)",
                    border: "1.5px solid rgba(86, 212, 188, 0.4)",
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 10, color: "var(--teal2)", fontWeight: 700, letterSpacing: 1, fontFamily: "'Cinzel', serif" }}>
                    LETTRE FINE (تَرْقِيق - SOURIRE PLAT)
                  </div>
                  <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 48, color: "var(--teal2)", lineHeight: 1 }}>
                    {pair.thin.letter}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{pair.thin.name}</div>
                  <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 26, color: "var(--gold2)", direction: "rtl", marginTop: 4 }}>
                    {pair.thin.example}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>{pair.thin.meaning}</div>

                  <button
                    type="button"
                    onClick={() => speak(pair.thin.audio, `contrast-thin-${pair.id}`)}
                    style={{
                      marginTop: 6,
                      padding: "6px 14px",
                      borderRadius: 16,
                      background: "rgba(86, 212, 188, 0.2)",
                      border: "1px solid var(--teal)",
                      color: "var(--teal2)",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>▶ Écouter</span>
                    <span style={{ fontFamily: "'Amiri Quran', serif" }}>{pair.thin.example}</span>
                  </button>
                </div>

                {/* Côté Grave (Tafkhîm) */}
                <div
                  style={{
                    background: "rgba(255, 183, 3, 0.08)",
                    border: "1.5px solid rgba(255, 183, 3, 0.5)",
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 10, color: "#ffe082", fontWeight: 700, letterSpacing: 1, fontFamily: "'Cinzel', serif" }}>
                    LETTRE GRAVE (تَفْخِيم - CAVITÉ BOMBÉE)
                  </div>
                  <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 48, color: "#ffd166", lineHeight: 1 }}>
                    {pair.heavy.letter}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{pair.heavy.name}</div>
                  <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 26, color: "#ffe082", direction: "rtl", marginTop: 4 }}>
                    {pair.heavy.example}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>{pair.heavy.meaning}</div>

                  <button
                    type="button"
                    onClick={() => speak(pair.heavy.audio, `contrast-heavy-${pair.id}`)}
                    style={{
                      marginTop: 6,
                      padding: "6px 14px",
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #ffb703 0%, #fb8500 100%)",
                      border: "1px solid #ffd166",
                      color: "#000",
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>▶ Écouter</span>
                    <span style={{ fontFamily: "'Amiri Quran', serif" }}>{pair.heavy.example}</span>
                  </button>
                </div>
              </div>

              {/* Avertissement de sens */}
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 10.5,
                  color: "#fca5a5",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>⚠️</span>
                <span>{pair.warning}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── LES 5 DEGRÉS DE GRAVITÉ (MARÂTIB AT-TAFKHÎM) ── */}
      <div>
        <div className="pronon-section-title" style={{ marginBottom: 12 }}>
          LES 5 DEGRÉS DE GRAVITÉ (مَرَاتِبُ التَّفْخِيمِ) SELON IBN AL-JAZARI
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
          {HEAVY_LETTERS_DATA.degrees.map((d) => (
            <div
              key={d.level}
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                borderTop: `3px solid ${d.level === 1 ? "#ffb703" : d.level === 2 ? "#fbbf24" : d.level === 3 ? "#f59e0b" : d.level === 4 ? "#d97706" : "#b45309"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#ffe082", fontFamily: "'Cinzel', serif" }}>
                  {d.title}
                </span>
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "var(--text3)" }}>
                  Niveau {d.level}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{d.condition}</div>
              <div
                style={{
                  fontFamily: "'Amiri Quran', serif",
                  fontSize: 18,
                  color: "#ffd166",
                  direction: "rtl",
                  padding: "6px 8px",
                  background: "var(--surface3)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
                onClick={() => speak(d.arabicExample, `deg-${d.level}`)}
                title="Cliquer pour écouter les exemples"
              >
                {d.arabicExample}
              </div>
              <div style={{ fontSize: 9.5, color: "var(--text2)", lineHeight: 1.4 }}>{d.ruleDesc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
