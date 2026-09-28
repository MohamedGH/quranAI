import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import {
  TAJWEED_PALETTES,
  DEFAULT_TAJWEED_COLORS,
  getActiveTajweedColors,
  getTajweedStyleForChar,
} from "../../utils/tajweedRules.js";

const TAJWEED_RULE_DEFINITIONS = [
  {
    id: "qalqala",
    label: "Qalqala (Rebond)",
    labelAr: "قلقلة",
    sub: "Lettres ق ط ب ج د avec Soukoun ou à l'arrêt",
    example: "قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ",
  },
  {
    id: "madd_lazim",
    label: "Madd Lazim (6 temps)",
    labelAr: "مد لازم",
    sub: "Allongement maximal causé par un Soukoun originel ou Chaddah",
    example: "ٱلصَّآخَّةُ · الضَّآلِّينَ",
  },
  {
    id: "madd_muttasil",
    label: "Madd Muttasil (4-5 temps)",
    labelAr: "مد متصل",
    sub: "Lettre de Madd + Hamza dans le même mot",
    example: "جَآءَ · السَّمَآءِ",
  },
  {
    id: "madd_munfasil",
    label: "Madd Munfasil (2, 4, 5 temps)",
    labelAr: "مد منفصل",
    sub: "Lettre de Madd en fin de mot + Hamza au mot suivant",
    example: "يَـٰٓأَيُّهَا · إِنَّآ أَعْطَيْنَـٰكَ",
  },
  {
    id: "madd",
    label: "Madd Tabii / Asli (2 temps)",
    labelAr: "مد طبيعي",
    sub: "Voyelles longues naturelles (ا، و، ي)",
    example: "قَالَ · يَقُولُ · قِيلَ",
  },
  {
    id: "izhar",
    label: "Idh-har (Clarté)",
    labelAr: "إظهار",
    sub: "Noun Sakin ou Tanwin devant ء هـ ع غ ح خ",
    example: "مَنْ ءَامَنَ · أَنْعَمْتَ",
  },
  {
    id: "idgham",
    label: "Idgham (Assimilation)",
    labelAr: "إدغام",
    sub: "Fusion du Noun/Tanwin devant يرملون",
    example: "مَن يَقُولُ · مِّن رَّبِّهِمْ",
  },
  {
    id: "iqlab",
    label: "Iqlab (Transformation)",
    labelAr: "إقلاب",
    sub: "Transformation du Noun/Tanwin en Mim devant Ba (ب)",
    example: "مِنۢ بَعْدِ · عَلِيمٌۢ بِذَاتِ",
  },
  {
    id: "ikhfa",
    label: "Ikhfa (Dissimulation)",
    labelAr: "إخفاء",
    sub: "Dissimulation voilée avec Ghunnah devant les 15 lettres",
    example: "مِن قَبْلِ · أَنفُسَهُمْ",
  },
  {
    id: "ghunnah",
    label: "Ghunnah Mushaddadah",
    labelAr: "غنة مشددة",
    sub: "Résonance nasale de 2 temps sur Noun et Mim avec Chaddah",
    example: "إِنَّ · ثُمَّ · عَمَّ",
  },
  {
    id: "tafkhim",
    label: "Tafkhīm (Lettres Graves)",
    labelAr: "تفخيم",
    sub: "Lettres emphatiques (خص ضغط قظ), Raa avec fatha/damma, Allah",
    example: "صِرَاطَ · خَلَقَ · ٱللَّهُ",
  },
  {
    id: "tarqiq",
    label: "Tarqīq (Lettres Aiguës)",
    labelAr: "ترقيق",
    sub: "Lettres fines et claires sans résonance grave",
    example: "بِسْمِ · الْحَمْدُ",
  },
];

const PRESET_SWATCHES = [
  "#38bdf8", "#00f0ff", "#0284c7", "#06b6d4", "#2dd4bf", "#10b981",
  "#34d399", "#22c55e", "#84cc16", "#eab308", "#ffd700", "#fbbf24",
  "#f59e0b", "#fb923c", "#f97316", "#f43f5e", "#e11d48", "#dc2626",
  "#c084fc", "#a855f7", "#7e22ce", "#f472b6", "#ec4899", "#db2777"
];

const SAMPLE_PREVIEW_TEXT = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ ۝١ ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ ۝٢ صِرَاطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ ۝٧";

export function TajweedColorPickerModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const tajweedPalette = useSelector(sel.tajweedPalette) || "classic";
  const tajweedCustomColors = useSelector(sel.tajweedCustomColors) || {};

  const [activeTab, setActiveTab] = useState("presets"); // "presets" | "custom"
  const [selectedRuleId, setSelectedRuleId] = useState("qalqala");

  if (!isOpen) return null;

  const currentActiveColors = getActiveTajweedColors(tajweedPalette, tajweedCustomColors);

  const handleSelectPalette = (paletteKey) => {
    dispatch(uiActions.setTajweedPalette(paletteKey));
  };

  const handleColorChange = (ruleId, newColor) => {
    dispatch(uiActions.setTajweedCustomColor({ ruleId, color: newColor }));
  };

  const handleResetColors = () => {
    dispatch(uiActions.resetTajweedColors());
  };

  // Preview character rendering
  const renderSamplePreview = () => {
    const chars = [...SAMPLE_PREVIEW_TEXT];
    const previewOptions = {
      showQalqala: true,
      showMadd: true,
      showIzhar: true,
      showIdgham: true,
      showTajweedTone: true,
      colors: currentActiveColors,
    };

    return chars.map((ch, idx) => {
      const style = getTajweedStyleForChar(chars, idx, previewOptions);
      return (
        <span key={idx} style={style || undefined}>
          {ch}
        </span>
      );
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          background: "linear-gradient(180deg, #181008 0%, #0d0804 100%)",
          border: "1px solid rgba(212, 175, 55, 0.45)",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(212,175,55,0.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(212, 175, 55, 0.25)",
            background: "rgba(255, 255, 255, 0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🎨</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, color: "#ffd700", fontFamily: "'Cinzel', serif" }}>
                Couleurs de Tajweed
              </h2>
              <div style={{ fontSize: 11, color: "#a89060" }}>
                Personnalisez les thèmes et nuances des règles de récitation
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              color: "#fff",
              borderRadius: "50%",
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(212, 175, 55, 0.15)",
            background: "rgba(0, 0, 0, 0.3)",
          }}
        >
          <button
            onClick={() => setActiveTab("presets")}
            style={{
              flex: 1,
              padding: "12px 16px",
              background: activeTab === "presets" ? "rgba(212, 175, 55, 0.18)" : "transparent",
              border: "none",
              borderBottom: activeTab === "presets" ? "2px solid #ffd700" : "2px solid transparent",
              color: activeTab === "presets" ? "#ffd700" : "#a89060",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span>💎</span>
            <span>Thèmes & Palettes Prédéfinies</span>
          </button>

          <button
            onClick={() => setActiveTab("custom")}
            style={{
              flex: 1,
              padding: "12px 16px",
              background: activeTab === "custom" ? "rgba(212, 175, 55, 0.18)" : "transparent",
              border: "none",
              borderBottom: activeTab === "custom" ? "2px solid #ffd700" : "2px solid transparent",
              color: activeTab === "custom" ? "#ffd700" : "#a89060",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span>🖌️</span>
            <span>Personnaliser Règle par Règle</span>
          </button>
        </div>

        {/* Live Verse Preview Box */}
        <div
          style={{
            padding: "14px 18px",
            background: "rgba(10, 6, 2, 0.8)",
            borderBottom: "1px solid rgba(212, 175, 55, 0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#d4af37", fontWeight: 700, letterSpacing: 0.5 }}>
              👁️ APERÇU EN TEMPS RÉEL (AL-FATIHA)
            </span>
            <span style={{ fontSize: 11, color: "#888" }}>
              Palette : {TAJWEED_PALETTES[tajweedPalette]?.name || "Personnalisée"}
            </span>
          </div>

          <div
            dir="rtl"
            style={{
              fontSize: 19,
              lineHeight: 1.8,
              fontFamily: "'Amiri Quran', serif",
              color: "#ebd8b0",
              textAlign: "center",
              padding: "8px 12px",
              background: "rgba(255, 255, 255, 0.03)",
              borderRadius: 8,
              border: "1px solid rgba(212, 175, 55, 0.15)",
            }}
          >
            {renderSamplePreview()}
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {activeTab === "presets" ? (
            /* Presets List */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.values(TAJWEED_PALETTES).map((pal) => {
                const isSelected = tajweedPalette === pal.id;
                const sampleDots = [
                  pal.colors.qalqala,
                  pal.colors.madd_lazim,
                  pal.colors.madd_munfasil,
                  pal.colors.izhar,
                  pal.colors.idgham,
                  pal.colors.ikhfa,
                  pal.colors.iqlab,
                  pal.colors.tafkhim,
                ];

                return (
                  <div
                    key={pal.id}
                    onClick={() => handleSelectPalette(pal.id)}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      background: isSelected ? "rgba(212, 175, 55, 0.15)" : "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${isSelected ? "#ffd700" : "rgba(255, 255, 255, 0.1)"}`,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: isSelected ? "#ffd700" : "#ebd8b0", fontWeight: 700, fontSize: 14 }}>
                          {pal.name} {isSelected && "✓"}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{pal.desc}</div>
                      </div>

                      {/* Swatch dots preview */}
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        {sampleDots.map((c, i) => (
                          <span
                            key={i}
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              background: c,
                              boxShadow: `0 0 6px ${c}66`,
                              display: "inline-block",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Custom Rule by Rule Editor */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: "#a89060", marginBottom: 4 }}>
                Sélectionnez une règle pour ajuster sa couleur exacte à l'aide de la palette ou de la pipette :
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {TAJWEED_RULE_DEFINITIONS.map((r) => {
                  const currentColor = currentActiveColors[r.id] || DEFAULT_TAJWEED_COLORS[r.id] || "#fbbf24";
                  const isRuleActive = selectedRuleId === r.id;

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRuleId(r.id)}
                      style={{
                        padding: "10px 12px",
                        background: isRuleActive ? "rgba(212, 175, 55, 0.12)" : "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${isRuleActive ? currentColor : "rgba(255, 255, 255, 0.1)"}`,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        <label
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: currentColor,
                            boxShadow: `0 0 8px ${currentColor}88`,
                            cursor: "pointer",
                            display: "inline-block",
                            flexShrink: 0,
                            position: "relative",
                            overflow: "hidden",
                            border: "2px solid rgba(255,255,255,0.6)",
                          }}
                          title="Cliquer pour choisir la couleur"
                        >
                          <input
                            type="color"
                            value={currentColor}
                            onChange={(e) => handleColorChange(r.id, e.target.value)}
                            style={{
                              opacity: 0,
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              cursor: "pointer",
                            }}
                          />
                        </label>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, color: currentColor, fontWeight: 700 }}>{r.label}</span>
                            <span style={{ fontSize: 13, color: currentColor, fontFamily: "'Amiri Quran', serif" }}>
                              ({r.labelAr})
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#888",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {r.sub}
                          </div>
                        </div>
                      </div>

                      {/* Hex Badge */}
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "monospace",
                          color: currentColor,
                          background: "rgba(0,0,0,0.4)",
                          padding: "3px 6px",
                          borderRadius: 4,
                          border: `1px solid ${currentColor}44`,
                        }}
                      >
                        {currentColor.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Quick Swatches Palette for Currently Selected Rule */}
              {selectedRuleId && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "12px 14px",
                    background: "rgba(0, 0, 0, 0.4)",
                    borderRadius: 10,
                    border: "1px solid rgba(212, 175, 55, 0.2)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#ffd700", fontWeight: 700, marginBottom: 8 }}>
                    🎨 Nuances rapides pour{" "}
                    <span style={{ color: currentActiveColors[selectedRuleId] }}>
                      {TAJWEED_RULE_DEFINITIONS.find((r) => r.id === selectedRuleId)?.label}
                    </span>{" "}
                    :
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {PRESET_SWATCHES.map((swatch) => (
                      <button
                        key={swatch}
                        onClick={() => handleColorChange(selectedRuleId, swatch)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: swatch,
                          border:
                            currentActiveColors[selectedRuleId]?.toLowerCase() === swatch.toLowerCase()
                              ? "2px solid #fff"
                              : "1px solid rgba(255,255,255,0.2)",
                          boxShadow:
                            currentActiveColors[selectedRuleId]?.toLowerCase() === swatch.toLowerCase()
                              ? `0 0 10px ${swatch}`
                              : "none",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderTop: "1px solid rgba(212, 175, 55, 0.25)",
            background: "rgba(10, 6, 2, 0.9)",
          }}
        >
          <button
            onClick={handleResetColors}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#a89060",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ↺ Réinitialiser par Défaut
          </button>

          <button
            onClick={onClose}
            style={{
              background: "linear-gradient(135deg, #d4af37 0%, #8b6d28 100%)",
              border: "none",
              color: "#0a0603",
              borderRadius: 8,
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(212,175,55,0.35)",
            }}
          >
            ✓ Valider & Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
