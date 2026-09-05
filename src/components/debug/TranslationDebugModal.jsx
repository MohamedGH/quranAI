import React, { useState, useMemo } from "react";
import { debugAnalyzeSegmentation, segmentAllPartsTranslations } from "../../utils/translationUtils.js";

const PART_COLORS = [
  { border: "rgba(91, 200, 245, 0.6)", bg: "rgba(91, 200, 245, 0.12)", text: "#5bc8f5", label: "Partie 1" },
  { border: "rgba(255, 209, 102, 0.6)", bg: "rgba(255, 209, 102, 0.12)", text: "#ffd166", label: "Partie 2" },
  { border: "rgba(200, 120, 255, 0.6)", bg: "rgba(200, 120, 255, 0.12)", text: "#c878ff", label: "Partie 3" },
  { border: "rgba(100, 230, 160, 0.6)", bg: "rgba(100, 230, 160, 0.12)", text: "#64e6a0", label: "Partie 4" },
  { border: "rgba(255, 140, 100, 0.6)", bg: "rgba(255, 140, 100, 0.12)", text: "#ff8c64", label: "Partie 5" },
  { border: "rgba(240, 100, 150, 0.6)", bg: "rgba(240, 100, 150, 0.12)", text: "#f06496", label: "Partie 6" },
];

export function TranslationDebugModal({
  isOpen,
  onClose,
  ayat,
  surahNum,
  parts = [],
  translationLang = "fr",
  ayatTranslation = "",
  wbwWords = null,
  translations = {},
}) {
  const [selectedLang, setSelectedLang] = useState(translationLang || "fr");
  const [activeTab, setActiveTab] = useState("analysis"); // 'analysis' | 'simulator'
  const [customText, setCustomText] = useState("");
  const [isEditingCustom, setIsEditingCustom] = useState(false);

  // Available languages
  const LANGS = [
    { code: "fr", label: "Français (Hamidullah)" },
    { code: "en", label: "English (Sahih)" },
    { code: "de", label: "Deutsch (Abu Rida)" },
    { code: "es", label: "Español (Asad)" },
    { code: "ru", label: "Русский (Kuliev)" },
    { code: "tr", label: "Türkçe (Diyanet)" },
    { code: "ur", label: "اردو (Jalandhry)" },
    { code: "id", label: "Bahasa Indonesia" },
  ];

  const arabicWords = useMemo(() => {
    return ayat?.text ? ayat.text.split(" ").filter(Boolean) : [];
  }, [ayat?.text]);

  // Current translation string for selected language
  const currentTranslation = useMemo(() => {
    if (isEditingCustom && customText !== "") return customText;
    if (selectedLang === translationLang && ayatTranslation) return ayatTranslation;
    const cacheKey = `${selectedLang}:${surahNum}`;
    const surahTrans = translations?.[cacheKey];
    if (surahTrans) {
      const found = surahTrans.find(t => t.numberInSurah === ayat?.numberInSurah);
      if (found?.text) return found.text;
    }
    return ayatTranslation || "";
  }, [selectedLang, translationLang, ayatTranslation, surahNum, ayat?.numberInSurah, translations, isEditingCustom, customText]);

  // Run debug analysis
  const debugData = useMemo(() => {
    return debugAnalyzeSegmentation({
      parts: parts.length > 0 ? parts : [{ id: 1, wordIndices: arabicWords.map((_, i) => i), text: ayat?.text }],
      totalWords: arabicWords.length,
      ayatTranslation: currentTranslation,
      translationLang: selectedLang,
      wbwWords,
      arabicWords,
    });
  }, [parts, arabicWords, currentTranslation, selectedLang, wbwWords, ayat?.text]);

  // Map each token index to part index for color highlighting
  const tokenToPartMap = useMemo(() => {
    const map = {};
    if (!debugData?.step2Data) return map;
    debugData.step2Data.forEach((s2, pIndex) => {
      for (let k = s2.startTokenIdx; k <= s2.endTokenIdx; k++) {
        map[k] = pIndex;
      }
    });
    return map;
  }, [debugData]);

  if (!isOpen) return null;

  return (
    <div
      id="translation-debug-modal"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "880px",
          maxHeight: "90vh",
          backgroundColor: "var(--bg, #12151c)",
          border: "1px solid var(--border, rgba(255, 209, 102, 0.25))",
          borderRadius: "14px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--text, #e6ecf2)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>🔬</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "0.5px", color: "var(--gold2, #ffd166)" }}>
                DEBUG & DIAGNOSTIC DE TRADUCTION DES PARTIES
              </div>
              <div style={{ fontSize: "11px", color: "var(--text3, #8a99a8)" }}>
                Sourate {surahNum} • Verset {ayat?.numberInSurah} • {arabicWords.length} mots arabes • {parts.length} partie(s)
              </div>
            </div>
          </div>
          <button
            id="debug-close-btn"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
              color: "var(--text3, #8a99a8)",
              cursor: "pointer",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "13px",
            }}
          >
            ✕ FERMER
          </button>
        </div>

        {/* Modal Controls Bar */}
        <div
          style={{
            padding: "10px 20px",
            background: "rgba(0, 0, 0, 0.25)",
            borderBottom: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Language Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--text3, #8a99a8)", letterSpacing: "1px" }}>LANGUE :</span>
            <select
              id="debug-lang-select"
              value={selectedLang}
              onChange={e => {
                setSelectedLang(e.target.value);
                setIsEditingCustom(false);
              }}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.2))",
                color: "var(--text, #e6ecf2)",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                outline: "none",
              }}
            >
              {LANGS.map(l => (
                <option key={l.code} value={l.code} style={{ background: "#1b202c", color: "#fff" }}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Validation Metrics Pills */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "12px",
                background: debugData.coverageMetrics.isFullCoverage ? "rgba(100, 230, 160, 0.15)" : "rgba(255, 100, 100, 0.15)",
                color: debugData.coverageMetrics.isFullCoverage ? "#64e6a0" : "#ff7070",
                border: `1px solid ${debugData.coverageMetrics.isFullCoverage ? "rgba(100, 230, 160, 0.3)" : "rgba(255, 100, 100, 0.3)"}`,
              }}
            >
              {debugData.coverageMetrics.isFullCoverage ? "✓ 100% Mots Traduits Couverts" : "⚠ Couverture Partielle"}
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "12px",
                background: !debugData.coverageMetrics.hasGaps ? "rgba(91, 200, 245, 0.15)" : "rgba(255, 100, 100, 0.15)",
                color: !debugData.coverageMetrics.hasGaps ? "#5bc8f5" : "#ff7070",
                border: `1px solid ${!debugData.coverageMetrics.hasGaps ? "rgba(91, 200, 245, 0.3)" : "rgba(255, 100, 100, 0.3)"}`,
              }}
            >
              {!debugData.coverageMetrics.hasGaps ? "✓ 0 Mot Sauté" : "⚠ Trou Détecté"}
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "12px",
                background: "rgba(255, 209, 102, 0.15)",
                color: "#ffd166",
                border: "1px solid rgba(255, 209, 102, 0.3)",
              }}
            >
              {debugData.numTrans} tokens dans la traduction
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Section 1: Verse text & Visual Colored Token Ribbon */}
          <div
            style={{
              padding: "14px",
              background: "rgba(255, 255, 255, 0.03)",
              borderRadius: "10px",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--text3, #8a99a8)" }}>
                TEXTE COMPLET TRADUIT & SEGMENTATION VISUELLE DES TOKENS
              </div>
              <button
                id="debug-toggle-edit-btn"
                onClick={() => {
                  if (!isEditingCustom) setCustomText(currentTranslation);
                  setIsEditingCustom(!isEditingCustom);
                }}
                style={{
                  fontSize: "10px",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: isEditingCustom ? "rgba(255, 209, 102, 0.2)" : "transparent",
                  color: isEditingCustom ? "#ffd166" : "var(--text3, #8a99a8)",
                  border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
                  cursor: "pointer",
                }}
              >
                {isEditingCustom ? "✓ APPLIQUER TEXTE PERSONNALISÉ" : "✎ TESTER UN AUTRE TEXTE"}
              </button>
            </div>

            {isEditingCustom ? (
              <textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "60px",
                  background: "#0d1017",
                  border: "1px solid #ffd166",
                  color: "#fff",
                  padding: "8px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
                placeholder="Entrez une phrase de traduction personnalisée pour tester..."
              />
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", lineHeight: "1.8" }}>
                {debugData.transTokens.map((tok, tIdx) => {
                  const pIdx = tokenToPartMap[tIdx];
                  const colorConf = pIdx !== undefined ? PART_COLORS[pIdx % PART_COLORS.length] : null;
                  return (
                    <span
                      key={tIdx}
                      title={`Token #${tIdx}${pIdx !== undefined ? ` • Partie ${pIdx + 1}` : ""}`}
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "13px",
                        backgroundColor: colorConf ? colorConf.bg : "rgba(255,255,255,0.05)",
                        border: colorConf ? `1px solid ${colorConf.border}` : "1px solid rgba(255,255,255,0.1)",
                        color: colorConf ? colorConf.text : "var(--text, #fff)",
                        fontWeight: colorConf ? 600 : 400,
                        cursor: "default",
                      }}
                    >
                      <span style={{ fontSize: "9px", opacity: 0.5, marginRight: "3px" }}>{tIdx}</span>
                      {tok}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Arabic words index bar */}
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "10px",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--text3, #8a99a8)", marginBottom: "8px" }}>
              MOTS ARABES DU VERSET ({arabicWords.length} MOTS)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", direction: "rtl" }}>
              {arabicWords.map((arW, arIdx) => {
                // Find which part contains this Arabic word
                const foundPartIdx = parts.findIndex(p => p.wordIndices?.includes(arIdx));
                const col = foundPartIdx >= 0 ? PART_COLORS[foundPartIdx % PART_COLORS.length] : null;
                return (
                  <div
                    key={arIdx}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: col ? col.bg : "rgba(255, 255, 255, 0.04)",
                      border: col ? `1px solid ${col.border}` : "1px solid rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <span style={{ fontFamily: "'Scheherazade New', 'Amiri', serif", fontSize: "17px", color: col ? col.text : "#fff" }}>
                      {arW}
                    </span>
                    <span style={{ fontSize: "9px", color: "var(--text3, #8a99a8)", direction: "ltr" }}>
                      #{arIdx} {foundPartIdx >= 0 ? `(P${foundPartIdx + 1})` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Step-by-Step Breakdown for Each Part */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "1px", color: "var(--gold2, #ffd166)" }}>
              DÉCOMPOSITION DU FONCTIONNEMENT PAR PARTIE
            </div>

            {debugData.step1Data.map((s1, idx) => {
              const s2 = debugData.step2Data[idx];
              const colorConf = PART_COLORS[idx % PART_COLORS.length];

              return (
                <div
                  key={s1.partId || idx}
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${colorConf.border}`,
                    borderRadius: "10px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {/* Part Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: colorConf.bg,
                          color: colorConf.text,
                          fontWeight: 700,
                          fontSize: "12px",
                          border: `1px solid ${colorConf.border}`,
                        }}
                      >
                        Partie {idx + 1}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--text2, #b8c4d0)" }}>
                        Mots arabes #{s1.arabicRange[0]} à #{s1.arabicRange[1]}
                      </span>
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--text3, #8a99a8)" }}>
                      Tokens traduction : <strong>[{s2?.startTokenIdx} à {s2?.endTokenIdx}]</strong> ({s2?.tokenCount} mots)
                    </div>
                  </div>

                  {/* Arabic text snippet of this part */}
                  <div
                    style={{
                      fontFamily: "'Scheherazade New', 'Amiri', serif",
                      fontSize: "18px",
                      textAlign: "right",
                      direction: "rtl",
                      color: colorConf.text,
                      padding: "4px 8px",
                      background: "rgba(0, 0, 0, 0.2)",
                      borderRadius: "6px",
                    }}
                  >
                    {s2?.rawPartText || "Texte arabe de la partie"}
                  </div>

                  {/* Telemetry Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "10px",
                      fontSize: "11px",
                    }}
                  >
                    {/* Étape 1 : Détection du dernier mot arabe */}
                    <div
                      style={{
                        padding: "8px 10px",
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: "6px",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#5bc8f5", marginBottom: "4px" }}>
                        1. DÉLIMITATION ARABE & POINT DE COUPURE
                      </div>
                      <div style={{ color: "var(--text2, #b8c4d0)" }}>
                        • 1er mot arabe de cette partie : <strong>{s1.firstArabicWord || "—"}</strong> (#{s1.firstArabicIdx >= 0 ? s1.firstArabicIdx : s1.arabicRange[0]})
                      </div>
                      <div style={{ color: "var(--text2, #b8c4d0)" }}>
                        • Dernier mot arabe (lettres) : <strong>{s1.lastArabicWord}</strong> (#{s1.lastArabicIdx >= 0 ? s1.lastArabicIdx : s1.arabicRange[1]})
                        {s1.skippedSymbols?.length > 0 && (
                          <span style={{ color: "var(--gold2, #ffd166)", marginLeft: "4px", fontSize: "10px" }}>
                            (symbole {s1.skippedSymbols.join(", ")} ignoré)
                          </span>
                        )}
                      </div>
                      {s1.nextArabicWord && (
                        <div style={{ color: "var(--text2, #b8c4d0)" }}>
                          • 1er mot arabe suivant : <strong>{s1.nextArabicWord}</strong> (#{s1.nextArabicIdx})
                        </div>
                      )}
                      <div style={{ color: "var(--text2, #b8c4d0)" }}>
                        • Méthode : <span style={{ color: "#ffd166" }}>{s1.matchedMethod}</span>
                      </div>
                      <div style={{ color: "var(--text2, #b8c4d0)" }}>
                        • Index de coupure calculé : Token #{s1.cutIndex} (<em>"{s1.cutWord}"</em>)
                        {s1.nextPartStartWord && (
                          <span style={{ color: "#64e6a0", marginLeft: "6px", fontSize: "10px" }}>
                            → début suivant : Token #{s1.cutIndex + 1} (<em>"{s1.nextPartStartWord}"</em>)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Étape 2 : Chaînage séquentiel & Correction */}
                    <div
                      style={{
                        padding: "8px 10px",
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: "6px",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#64e6a0", marginBottom: "4px" }}>
                        2. CHAÎNAGE & CORRECTION MOTS DÉBUT/FIN
                      </div>
                      <div style={{ color: "var(--text2, #b8c4d0)" }}>
                        • Début de cette partie : Token #{s2?.startTokenIdx} (<em>"{debugData.transTokens[s2?.startTokenIdx]}"</em>)
                      </div>
                      <div style={{ color: "var(--text2, #b8c4d0)" }}>
                        • Fin de cette partie : Token #{s2?.endTokenIdx} (<em>"{debugData.transTokens[s2?.endTokenIdx]}"</em>)
                      </div>
                      <div style={{ color: "var(--text2, #b8c4d0)" }}>
                        • Prochaine partie commencera au Token : #{s2?.nextPartStartsAt}
                        {debugData.transTokens[s2?.nextPartStartsAt] && (
                          <span style={{ color: "#64e6a0", marginLeft: "4px" }}>
                            (<em>"{debugData.transTokens[s2?.nextPartStartsAt]}"</em>)
                          </span>
                        )}
                      </div>
                      <div style={{ color: s2?.connectorShifted ? "#ffd166" : "var(--text3, #8a99a8)" }}>
                        • Règle de liaison : {s2?.connectorShifted
                          ? `✓ Mot introductif "${s2.shiftedWord}" transféré au début de la partie suivante`
                          : "✓ Aucun mot de liaison orphelin"}
                      </div>
                    </div>
                  </div>

                  {/* Final Segment Output */}
                  <div
                    style={{
                      padding: "8px 12px",
                      background: colorConf.bg,
                      borderRadius: "6px",
                      border: `1px solid ${colorConf.border}`,
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--text3, #8a99a8)", letterSpacing: "1px", display: "block" }}>
                      TRADUCTION GÉNÉRÉE POUR CETTE PARTIE :
                    </span>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginTop: "2px" }}>
                      « {s2?.finalSegment} »
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.02)",
            fontSize: "11px",
            color: "var(--text3, #8a99a8)",
          }}
        >
          <span>L'algorithme analyse en temps réel les changements de découpage ou de langue.</span>
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              background: "var(--gold2, #ffd166)",
              color: "#000",
              fontWeight: 700,
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Fermer le Diagnostic
          </button>
        </div>
      </div>
    </div>
  );
}
