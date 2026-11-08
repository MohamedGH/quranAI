import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions, playerActions } from "../../store.js";
import { getActiveTajweedColors } from "../../utils/tajweedRules.js";

export function SurahAllOptionsModal({
  isOpen,
  onClose,
  selectedSurah,
  ayats = [],
  jumpToAyatNumber,
  // Tajweed handlers
  tjToggleTajweedTone,
  tjTajweedTone,
  tjToggleQalqala,
  tjQalqala,
  tjToggleMadd,
  tjMadd,
  tjToggleIzhar,
  tjIzhar,
  tjToggleIdgham,
  tjIdgham,
  tjToggleIkhfa,
  tjIkhfa,
  tjToggleIqlab,
  tjIqlab,
  tjToggleGhunnah,
  tjGhunnah,
  onOpenColorPicker,
  // Options
  pageMode,
  setPageMode,
  hizbMode,
  setHizbMode,
  juzMode,
  setJuzMode,
  fullScreenSelectedAyat,
  toggleFullScreen,
  announceNum,
  toggleAnnounceNum,
  spellCheck,
  toggleSpellCheck,
  showParts,
  toggleShowParts,
  // Translation
  translationLang,
  setTranslationLang,
  TRANS_LABELS = {},
  // Initial tab
  initialTab = "tajweed",
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchAyatText, setSearchAyatText] = useState("");
  const dispatch = useDispatch();

  const ayatFontSize = useSelector(sel.ayatFontSize) || 26;
  const tajweedPalette = useSelector(sel.tajweedPalette) || "classic";
  const tajweedCustomColors = useSelector(sel.tajweedCustomColors) || {};
  const activeTjColors = getActiveTajweedColors(tajweedPalette, tajweedCustomColors);
  const isCoachEnabled = useSelector(sel.tajweedCoachEnabled);
  const uxMode = useSelector(sel.uxMode);
  const isChild = uxMode === "child";

  const masteryFilterRange = useSelector(sel.masteryFilterRange);
  const masteryFilterActive = useSelector(sel.masteryFilterActive);
  const ayatFilterRange = useSelector(sel.ayatFilterRange);
  const ayatFilterActive = useSelector(sel.ayatFilterActive);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalAyas = selectedSurah?.numberOfAyahs || ayats?.length || 1;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="surah-all-options-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2600,
        background: "rgba(8, 10, 16, 0.78)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
        animation: "fadeIn .2s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 580,
          background: "linear-gradient(180deg, #171b28 0%, #10131d 100%)",
          border: "1px solid rgba(201, 168, 76, 0.35)",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(201, 168, 76, 0.15)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(92dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
          boxSizing: "border-box",
        }}
      >
        {/* ── Modal Header ────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            <div>
              <h2
                id="surah-all-options-modal-title"
                style={{
                  margin: 0,
                  fontFamily: "'Cinzel', serif",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: "var(--gold2)",
                }}
              >
                {isChild ? "OPTIONS DE LECTURE & TAJWID" : "OPTIONS COMPLÈTES DE LA SOURATE"}
              </h2>
              <div style={{ fontSize: 9.5, color: "var(--text3)", marginTop: 2 }}>
                {selectedSurah?.name} · {selectedSurah?.englishName} ({totalAyas} versets)
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "50%",
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text2)",
              fontSize: 13,
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Tabs Selector ────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            padding: "8px 14px",
            gap: 6,
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
            flexWrap: "wrap",
          }}
        >
          {[
            { id: "tajweed", icon: "🎨", label: "TAJWEED" },
            { id: "display", icon: "⚙️", label: "AFFICHAGE" },
            { id: "jump", icon: "🔎", label: "ALLER AU VERSET" },
            { id: "filters", icon: "🎯", label: "FILTRES" },
            { id: "lang", icon: "🌐", label: "TRADUCTION" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: "1 1 auto",
                  padding: "7px 10px",
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9.5,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: 0.8,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: isActive ? "1.5px solid var(--gold)" : "1px solid rgba(255, 255, 255, 0.08)",
                  background: isActive ? "rgba(201, 168, 76, 0.2)" : "rgba(255, 255, 255, 0.03)",
                  color: isActive ? "var(--gold2)" : "var(--text2)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  whiteSpace: "nowrap",
                  transition: "all .15s",
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Modal Body Content ────────────────────────────────────────── */}
        <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* TAB 1: TAJWEED */}
          {activeTab === "tajweed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.5 }}>
                Activez ou désactivez les règles de prononciation Tajweed sur le texte arabe :
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
                {[
                  { toggle: tjToggleTajweedTone, on: tjTajweedTone, label: "تفخيم / ترقيق", sub: "Tafkhīm / Tarqīq (Graves/Aiguës)", color: activeTjColors.tafkhim || "#06b6d4" },
                  { toggle: tjToggleQalqala, on: tjQalqala, label: "قلقلة", sub: "Qalqala (Rebond)", color: activeTjColors.qalqala || "#38bdf8" },
                  { toggle: tjToggleMadd, on: tjMadd, label: "مَدّ", sub: "Madd (Prolongation)", color: activeTjColors.madd_munfasil || "#fb923c" },
                  { toggle: tjToggleIzhar, on: tjIzhar, label: "إظهار", sub: "Idh-har (Clarté)", color: activeTjColors.izhar || "#34d399" },
                  { toggle: tjToggleIdgham, on: tjIdgham, label: "إدغام", sub: "Idgham (Assimilation)", color: activeTjColors.idgham || "#fbbf24" },
                  { toggle: tjToggleIkhfa, on: tjIkhfa, label: "إخفاء", sub: "Ikhfâ (Dissimulation)", color: activeTjColors.ikhfa || "#c084fc" },
                  { toggle: tjToggleIqlab, on: tjIqlab, label: "إقلاب", sub: "Iqlâb (Transformation)", color: activeTjColors.iqlab || "#2dd4bf" },
                  { toggle: tjToggleGhunnah, on: tjGhunnah, label: "غنة", sub: "Ghunnah (Nasalisation)", color: activeTjColors.ghunnah || "#10b981" },
                ].map(({ toggle, on, label, sub, color }) => (
                  <button
                    key={label}
                    onClick={toggle}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: on ? `1.5px solid ${color}` : "1px solid rgba(255,255,255,0.08)",
                      background: on ? `${color}18` : "var(--surface2)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all .15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? color : "var(--text3)" }} />
                      <div>
                        <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 14, color: on ? color : "var(--text)" }}>{label}</div>
                        <div style={{ fontSize: 9, color: "var(--text3)" }}>{sub}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: on ? color : "var(--text3)" }}>
                      {on ? "OUI" : "NON"}
                    </span>
                  </button>
                ))}
              </div>

              {/* Coach Vocal Tajwid */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: isCoachEnabled ? "rgba(45, 212, 191, 0.12)" : "var(--surface2)",
                  border: `1px solid ${isCoachEnabled ? "var(--teal)" : "rgba(255, 255, 255, 0.08)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🎙️</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", fontFamily: "'Cinzel', serif" }}>
                      Coach Vocal Tajwid Audio
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 2 }}>
                      Pause prédictive et rappel audio des règles lors de l'écoute
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => dispatch(playerActions.setTajweedCoachEnabled(!isCoachEnabled))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: 9.5,
                    border: isCoachEnabled ? "1.5px solid var(--teal)" : "1px solid var(--border)",
                    background: isCoachEnabled ? "var(--teal)" : "rgba(255,255,255,0.06)",
                    color: isCoachEnabled ? "#10131d" : "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  {isCoachEnabled ? "ACTIF ✓" : "ACTIVER"}
                </button>
              </div>

              {/* Color Picker Modal Button */}
              {onOpenColorPicker && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenColorPicker();
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(201,168,76,0.12)",
                    border: "1px solid var(--gold)",
                    color: "var(--gold2)",
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "'Cinzel', serif",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>🎨 PERSONNALISER LES COULEURS TAJWEED</span>
                  <span>➜</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 2: AFFICHAGE & POLICE */}
          {activeTab === "display" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Text Size */}
              <div style={{ padding: "12px 14px", background: "var(--surface2)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold2)", fontFamily: "'Cinzel', serif" }}>
                    TAILLE DU TEXTE ARABE ({ayatFontSize} px)
                  </div>
                  {ayatFontSize !== 26 && (
                    <button
                      type="button"
                      onClick={() => dispatch(uiActions.resetAyatFontSize())}
                      style={{ fontSize: 8.5, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "var(--text2)", cursor: "pointer" }}
                    >
                      DÉFAUT (26px)
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => dispatch(uiActions.decreaseAyatFontSize())}
                    disabled={ayatFontSize <= 16}
                    style={{ width: 34, height: 30, borderRadius: 6, background: "var(--surface3)", border: "1px solid var(--border2)", color: "var(--text)", cursor: "pointer", fontWeight: 700 }}
                  >
                    A-
                  </button>
                  <input
                    type="range"
                    min={16}
                    max={48}
                    step={2}
                    value={ayatFontSize}
                    onChange={(e) => dispatch(uiActions.setAyatFontSize(Number(e.target.value)))}
                    style={{ flex: 1, accentColor: "var(--gold)", cursor: "pointer" }}
                  />
                  <button
                    type="button"
                    onClick={() => dispatch(uiActions.increaseAyatFontSize())}
                    disabled={ayatFontSize >= 48}
                    style={{ width: 34, height: 30, borderRadius: 6, background: "var(--surface3)", border: "1px solid var(--border2)", color: "var(--text)", cursor: "pointer", fontWeight: 700 }}
                  >
                    A+
                  </button>
                </div>
              </div>

              {/* Reading Modes (Page / Hizb / Juz) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setPageMode(!pageMode);
                    if (!pageMode) { setHizbMode(false); setJuzMode(false); }
                  }}
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    textAlign: "center",
                    border: pageMode ? "1.5px solid var(--gold)" : "1px solid rgba(255,255,255,0.08)",
                    background: pageMode ? "rgba(201,168,76,0.18)" : "var(--surface2)",
                    color: pageMode ? "var(--gold2)" : "var(--text2)",
                    fontFamily: "'Cinzel', serif",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  📖 MODE PAGE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHizbMode(!hizbMode);
                    if (!hizbMode) { setPageMode(false); setJuzMode(false); }
                  }}
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    textAlign: "center",
                    border: hizbMode ? "1.5px solid var(--teal)" : "1px solid rgba(255,255,255,0.08)",
                    background: hizbMode ? "rgba(46,196,182,0.18)" : "var(--surface2)",
                    color: hizbMode ? "var(--teal2)" : "var(--text2)",
                    fontFamily: "'Cinzel', serif",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ⚡ MODE HIZB
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJuzMode(!juzMode);
                    if (!juzMode) { setPageMode(false); setHizbMode(false); }
                  }}
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    textAlign: "center",
                    border: juzMode ? "1.5px solid #c878ff" : "1px solid rgba(255,255,255,0.08)",
                    background: juzMode ? "rgba(200,120,255,0.18)" : "var(--surface2)",
                    color: juzMode ? "#c878ff" : "var(--text2)",
                    fontFamily: "'Cinzel', serif",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  📚 MODE JUZ
                </button>
              </div>

              {/* Toggles */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Plein écran focus sur le verset sélectionné", on: fullScreenSelectedAyat, toggle: toggleFullScreen },
                  { label: "Vérification orthographique (aide à l'apprentissage)", on: spellCheck, toggle: toggleSpellCheck },
                  { label: "Afficher le découpage par parties d'apprentissage", on: showParts, toggle: toggleShowParts },
                  { label: "Annoncer les numéros d'ayat à la voix", on: announceNum, toggle: toggleAnnounceNum },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "var(--surface2)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span style={{ fontSize: 10, color: "var(--text)" }}>{item.label}</span>
                    <button
                      type="button"
                      onClick={item.toggle}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        border: item.on ? "1px solid var(--gold)" : "1px solid var(--border2)",
                        background: item.on ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.04)",
                        color: item.on ? "var(--gold2)" : "var(--text3)",
                        cursor: "pointer",
                      }}
                    >
                      {item.on ? "ACTIF ✓" : "DÉSACTIVÉ"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ALLER AU VERSET */}
          {activeTab === "jump" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="text"
                placeholder={`Numéro de verset (1 à ${totalAyas}) ou mot clé...`}
                value={searchAyatText}
                onChange={(e) => setSearchAyatText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--surface2)",
                  border: "1px solid var(--gold)",
                  color: "var(--text)",
                  fontSize: 11,
                  boxSizing: "border-box",
                }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))", gap: 6, maxHeight: 220, overflowY: "auto", padding: 4 }}>
                {Array.from({ length: totalAyas }, (_, i) => i + 1)
                  .filter((num) => {
                    if (!searchAyatText) return true;
                    return String(num).includes(searchAyatText);
                  })
                  .map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        jumpToAyatNumber(num);
                        onClose();
                      }}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 6,
                        background: "var(--surface2)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "var(--gold2)",
                        fontWeight: 700,
                        fontSize: 11,
                        cursor: "pointer",
                        fontFamily: "'Cinzel', serif",
                      }}
                    >
                      v.{num}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 4: FILTRES */}
          {activeTab === "filters" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: (ayatFilterActive || masteryFilterActive) ? "rgba(46,196,182,0.12)" : "var(--surface2)",
                  border: `1px solid ${(ayatFilterActive || masteryFilterActive) ? "var(--teal)" : "rgba(255,255,255,0.08)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", fontFamily: "'Cinzel', serif" }}>
                    Filtre actif : {ayatFilterActive ? `Versets ${ayatFilterRange?.[0]}–${ayatFilterRange?.[1]}` : "Tous les versets"}
                    {masteryFilterActive ? ` · Maîtrise ${masteryFilterRange?.[0]}–${masteryFilterRange?.[1]}%` : ""}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 2 }}>
                    Ciblez précisément une portion de la sourate pour vos révisions
                  </div>
                </div>

                {(ayatFilterActive || masteryFilterActive) && (
                  <button
                    type="button"
                    onClick={() => dispatch(uiActions.resetAllFilters())}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(224,90,90,0.15)",
                      border: "1px solid var(--red)",
                      color: "var(--red)",
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    RÉINITIALISER
                  </button>
                )}
              </div>

              {/* Quick Presets */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { label: "Tous", action: () => dispatch(uiActions.resetAllFilters()) },
                  { label: "À réviser (0–50%)", action: () => { dispatch(uiActions.setMasteryFilterPreset("to_revise")); dispatch(uiActions.setMasteryFilterActive(true)); } },
                  { label: "En cours (50–80%)", action: () => { dispatch(uiActions.setMasteryFilterPreset("learning")); dispatch(uiActions.setMasteryFilterActive(true)); } },
                  { label: "Maîtrisés (80–100%)", action: () => { dispatch(uiActions.setMasteryFilterPreset("mastered")); dispatch(uiActions.setMasteryFilterActive(true)); } },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={btn.action}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 9.5,
                      fontWeight: 600,
                      background: "var(--surface2)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--text2)",
                      cursor: "pointer",
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: TRADUCTION */}
          {activeTab === "lang" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, color: "var(--text3)" }}>
                Choisissez la langue de traduction affichée sous chaque verset arabe :
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {[
                  { code: null, label: "Aucune (Arabe seul)" },
                  { code: "fr", label: "Français (Hamidullah)" },
                  { code: "en", label: "English (Sahih Int.)" },
                  { code: "translit", label: "Phonétique (Translittération)" },
                  { code: "es", label: "Español (Cortes)" },
                  { code: "de", label: "Deutsch (Bubenheim)" },
                  { code: "tr", label: "Türkçe (Diyanet)" },
                  { code: "id", label: "Bahasa Indonesia" },
                ].map((item) => {
                  const isCur = translationLang === item.code;
                  return (
                    <button
                      key={String(item.code)}
                      type="button"
                      onClick={() => setTranslationLang(item.code)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        textAlign: "left",
                        border: isCur ? "1.5px solid var(--teal)" : "1px solid rgba(255,255,255,0.08)",
                        background: isCur ? "rgba(46,196,182,0.18)" : "var(--surface2)",
                        color: isCur ? "var(--teal2)" : "var(--text2)",
                        fontSize: 10,
                        fontWeight: isCur ? 700 : 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{item.label}</span>
                      {isCur && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer ────────────────────────────────────────────── */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              background: "var(--gold)",
              border: "1px solid var(--gold2)",
              color: "#10131d",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Cinzel', serif",
              letterSpacing: 0.8,
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
