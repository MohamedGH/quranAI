import React, { useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { sel, uiActions } from "../../store.js";
import { ARABIC_LETTERS, HARAKATS } from "../../utils/arabicUtils.js";
import {
  DETAILED_ARABIC_LETTERS,
  GENERAL_MAKHAREJ,
  ANATOMICAL_ZONES,
  getLetterAnatomy,
  getLetterChildTip,
  isHeavyLetter,
  isItbaqLetter,
  HEAVY_LETTERS_DATA,
} from "../../utils/makharijData.js";
import { MakharijAnatomyDiagram } from "../common/MakharijAnatomyDiagram.jsx";
import { HeavyLettersGuide } from "../common/HeavyLettersGuide.jsx";
import { ChildUnlockQuranCelebrationModal } from "../common/ChildUnlockQuranCelebrationModal.jsx";

export function PrononciationPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isChild = useSelector((state) => (state?.ui?.uxMode || "standard") === "child");
  const validatedLetters = useSelector(sel.validatedLetters);
  const validatedCount = useSelector(sel.validatedLettersCount);
  const allLettersValidated = useSelector(sel.allLettersValidated);
  const [tab, setTab] = useState("lettres"); // lettres | graves | harakat | tajwid
  const [selected, setSelected] = useState(0); // Default to letter 0 (Ba)
  const [organFilter, setOrganFilter] = useState("all"); // all | lisan | halq | shafatayn | jawf | heavy
  const [playingId, setPlayingId] = useState(null);
  const synthRef = useRef(null);

  const speak = (text, id, lang = "ar-SA") => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 0.65;
    utt.pitch = 1;
    setPlayingId(id);
    utt.onend = () => setPlayingId(null);
    utt.onerror = () => setPlayingId(null);
    synthRef.current = utt;
    window.speechSynthesis.speak(utt);
  };

  const stopSpeak = () => {
    window.speechSynthesis?.cancel();
    setPlayingId(null);
  };

  // Filtrage des lettres selon l'organe sélectionné
  const filteredLetters = ARABIC_LETTERS.filter((l) => {
    if (organFilter === "all") return true;
    if (organFilter === "heavy") return isHeavyLetter(l.letter);
    const detail = getLetterAnatomy(l.letter);
    if (!detail) return true;
    return detail.makhrajGeneral === organFilter;
  });

  const selectedLetter = selected !== null && selected < ARABIC_LETTERS.length ? ARABIC_LETTERS[selected] : ARABIC_LETTERS[0];
  const selDetail = selectedLetter ? getLetterAnatomy(selectedLetter.letter) : null;
  const isSelectedHeavy = selectedLetter ? isHeavyLetter(selectedLetter.letter) : false;
  const isSelectedItbaq = selectedLetter ? isItbaqLetter(selectedLetter.letter) : false;

  return (
    <main className="main" style={{ background: "var(--bg)" }}>
      {/* ── TOP HEADER TITLE ── */}
      <div
        style={{
          padding: "14px 28px 0",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "linear-gradient(180deg, var(--surface), var(--bg))",
        }}
      >
        <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 22, color: "var(--gold)", direction: "rtl", opacity: 0.9 }}>
          {isChild ? "🌟 مَخَارِجُ الحُرُوفِ لِلأَطْفَالِ" : "مَخَارِجُ الحُرُوفِ وَالتَّجْوِيد"}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--text3)", fontFamily: "'Cinzel', serif" }}>
          {isChild ? "LE CHÂTEAU MAGIQUE DES LETTRES · SECRETS DU PETIT CHAMPION" : "POINTS D'ARTICULATION · ANATOMIE · LETTRES GRAVES"}
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div style={{ padding: "0 28px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
        <div className="pronon-nav-tabs">
          {[
            ["lettres", isChild ? "🌟 MON CHÂTEAU DES LETTRES" : "🔤 LETTRES & ANATOMIE"],
            ["graves", isChild ? "🦁 LES LETTRES CHAMPIONNES (GRAVES)" : "⚖️ LETTRES GRAVES (TAFKHÎM)"],
            ["harakat", isChild ? "🎨 VOYELLES & SONS MAGIQUES" : "◌ VOYELLES & SIGNES"],
            ["tajwid", isChild ? "✨ SECRETS DE RÉCITATION" : "📚 RÈGLES DE TAJWID"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`pronon-nav-tab${tab === k ? " active" : ""}`}
              onClick={() => {
                setTab(k);
                stopSpeak();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CHILD LETTERS QUEST BANNER ── */}
      {isChild && (
        <div
          id="child-letters-quest-banner"
          style={{
            margin: "14px 28px 0",
            padding: "12px 18px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(255, 209, 102, 0.15) 0%, rgba(224, 159, 62, 0.08) 100%)",
            border: "1.5px solid rgba(255, 209, 102, 0.45)",
            boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 26 }}>🏰</span>
              <div>
                <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 800, fontSize: 13, color: "#ffd166", letterSpacing: 1 }}>
                  DÉFI DU PETIT CHAMPION : LES 28 LETTRES DU SAINT CORAN
                </div>
                <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                  {allLettersValidated
                    ? "🎉 BRAVO ! Toutes les lettres sont validées ! Le menu CORAN est maintenant débloqué !"
                    : `Valide toutes les lettres pour faire apparaître le menu LECTURE DU CORAN ! (encore ${Math.max(0, 28 - validatedCount)} à faire)`}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {allLettersValidated ? (
                <button
                  id="btn-quest-go-quran"
                  onClick={() => {
                    dispatch(uiActions.setActivePage("quran"));
                    navigate("/quran");
                  }}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 8,
                    border: "1px solid #ffd166",
                    background: "linear-gradient(135deg, #ffd166 0%, #e09f3e 100%)",
                    color: "#121624",
                    fontWeight: 800,
                    fontSize: 11,
                    fontFamily: "'Cinzel', serif",
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(255, 209, 102, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>📖</span>
                  <span>OUVRIR LE CORAN DÉBLOQUÉ</span>
                  <span>🚀</span>
                </button>
              ) : (
                <div
                  style={{
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255, 209, 102, 0.3)",
                    color: "#ffd166",
                    fontWeight: 700,
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>🔒 Coran verrouillé</span>
                  <span>·</span>
                  <span>{validatedCount} / 28 ⭐</span>
                </div>
              )}

              <button
                id="btn-quest-validate-all"
                onClick={() => dispatch(uiActions.validateAllLetters())}
                title="Valider toutes les lettres d'un coup (Aide parent / testeur)"
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--text3)",
                  fontSize: 9.5,
                  cursor: "pointer",
                }}
              >
                ⚡ Valider tout
              </button>
              {validatedCount > 0 && (
                <button
                  id="btn-quest-reset-all"
                  onClick={() => dispatch(uiActions.resetValidatedLetters())}
                  title="Réinitialiser les lettres pour recommencer le défi"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--text3)",
                    fontSize: 9.5,
                    cursor: "pointer",
                  }}
                >
                  🔄 Réinitialiser
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ width: "100%", height: 8, background: "rgba(0,0,0,0.35)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
            <div
              style={{
                width: `${Math.min(100, (validatedCount / 28) * 100)}%`,
                height: "100%",
                background: allLettersValidated
                  ? "linear-gradient(90deg, #56d4bc, #ffd166)"
                  : "linear-gradient(90deg, #ffd166, #ffb703)",
                borderRadius: 4,
                transition: "width .3s ease",
                boxShadow: "0 0 10px rgba(255, 209, 102, 0.5)",
              }}
            />
          </div>
        </div>
      )}

      <div className="pronon-page">
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 1 : LETTRES & ANATOMIE DE LA BOUCHE ──                        */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {tab === "lettres" && (
          <div className="pronon-two-col">
            {/* Colonne gauche : Filtres anatomiques + Grille des 29 lettres */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="pronon-section-title">
                {isChild ? "🌟 LES 29 LETTRES ET LEURS MAISONS SECRÈTES" : "POINTS DE SORTIE DES 29 LETTRES (مَخَارِجُ الحُرُوف)"}
              </div>

              {/* Filtre par organe anatomique */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {[
                  { id: "all", label: isChild ? `Toutes (${ARABIC_LETTERS.length})` : `Toutes (${ARABIC_LETTERS.length})` },
                  { id: "lisan", label: isChild ? "👅 Langue Magicienne (18)" : "👅 Langue (18)" },
                  { id: "halq", label: isChild ? "🔴 Grotte de la Gorge (6)" : "🔴 Gorge (6)" },
                  { id: "shafatayn", label: isChild ? "👄 Deux Lèvres (4)" : "👄 Lèvres (4)" },
                  { id: "jawf", label: isChild ? "🟢 Grand Toboggan (1)" : "🟢 Cavité (1)" },
                  { id: "heavy", label: isChild ? "🦁 Lettres Championnes (7)" : "⚖️ Graves (7)" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrganFilter(f.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 16,
                      fontSize: 9.5,
                      fontFamily: "'Cinzel', serif",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: organFilter === f.id ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                      background: organFilter === f.id ? "rgba(255, 183, 3, 0.18)" : "var(--surface2)",
                      color: organFilter === f.id ? "var(--gold2)" : "var(--text3)",
                      transition: "all .15s",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Grille des lettres filtrées */}
              <div className="pronon-grid">
                {filteredLetters.map((l) => {
                  const origIdx = ARABIC_LETTERS.findIndex((x) => x.letter === l.letter);
                  const isSelected = selected === origIdx;
                  const isPlaying = playingId === `letter-${origIdx}`;
                  const isLtrHeavy = isHeavyLetter(l.letter);
                  const isValidated = validatedLetters.includes(l.letter);

                  return (
                    <div
                      key={l.letter}
                      className={`pronon-card${isSelected ? " selected" : ""}${isPlaying ? " playing" : ""}${isValidated ? " validated-card" : ""}`}
                      onClick={() => {
                        setSelected(origIdx);
                        speak(l.letter, `letter-${origIdx}`);
                      }}
                      style={{
                        position: "relative",
                        ...(isLtrHeavy
                          ? { borderColor: isSelected ? "#ffb703" : "rgba(255, 183, 3, 0.35)", background: isSelected ? "rgba(255, 183, 3, 0.14)" : "var(--surface2)" }
                          : {}),
                        ...(isValidated && !isSelected
                          ? { borderColor: "rgba(86, 212, 188, 0.4)", boxShadow: "0 0 10px rgba(86, 212, 188, 0.12)" }
                          : {}),
                      }}
                    >
                      {/* Validation Star Badge */}
                      {isValidated ? (
                        <div
                          title="Lettre validée ! ⭐"
                          style={{
                            position: "absolute",
                            top: 5,
                            left: 5,
                            fontSize: 9,
                            fontWeight: 800,
                            color: "#ffd166",
                            display: "flex",
                            alignItems: "center",
                            background: "rgba(0, 0, 0, 0.5)",
                            padding: "1px 4px",
                            borderRadius: 6,
                            border: "1px solid rgba(255, 209, 102, 0.5)",
                          }}
                        >
                          ⭐
                        </div>
                      ) : (
                        isChild && (
                          <div
                            title="Lettre à valider"
                            style={{
                              position: "absolute",
                              top: 5,
                              left: 5,
                              fontSize: 8,
                              color: "var(--text3)",
                              opacity: 0.5,
                            }}
                          >
                            ⚪
                          </div>
                        )
                      )}

                      <div className="pronon-letter" style={isLtrHeavy ? { color: "#ffd166" } : {}}>
                        {l.letter}
                      </div>
                      <div className="pronon-letter-name">{l.name.toUpperCase()}</div>
                      <div className="pronon-letter-trans">/{l.trans}/</div>

                      {/* Indicateur lettre grave */}
                      {isLtrHeavy && (
                        <div
                          style={{
                            fontSize: 7,
                            fontFamily: "'Cinzel', serif",
                            fontWeight: 800,
                            letterSpacing: 0.5,
                            color: "#ffb703",
                            background: "rgba(255, 183, 3, 0.2)",
                            padding: "1px 5px",
                            borderRadius: 6,
                            marginTop: 2,
                          }}
                        >
                          GRAVE
                        </div>
                      )}

                      {isPlaying && (
                        <div
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--teal)",
                            animation: "pulse-dot 1s infinite",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Conseil de récitation */}
              <div className="pronon-tip-box" style={{ marginTop: 8 }}>
                {isChild ? (
                  <span>
                    🌟 <strong>Secret d'Apprenti :</strong> Chaque lettre a sa propre maison secrète dans ta bouche ! Clique sur une lettre pour voir où elle habite et écoute son secret magique !
                  </span>
                ) : (
                  <span>
                    💡 <strong>Règle d'or :</strong> Chaque lettre a un point de sortie précis (<em>Makhraj</em>) et des caractéristiques d'air et de voix (<em>Sifât</em>).
                    Cliquez sur n'importe quelle lettre pour voir exactement où elle se forme dans la bouche, la langue ou la gorge sur le diagramme anatomique.
                  </span>
                )}
              </div>
            </div>

            {/* Colonne droite : Fiche détaillée + Schéma anatomique SVG interactif */}
            <div>
              {selectedLetter ? (
                <div className="pronon-detail-panel">
                  {/* En-tête : Makhraj + Statut Grave/Fin + Bouton Play */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <div className="pronon-makhraj-tag">
                        📍 {isChild ? (selDetail?.childOrgan || selDetail?.organTitle || selectedLetter.makhraj) : (selDetail?.organTitle || selectedLetter.makhraj)}
                      </div>

                      {isSelectedHeavy ? (
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 10,
                            background: "rgba(255, 183, 3, 0.18)",
                            border: "1px solid rgba(255, 183, 3, 0.5)",
                            color: "#ffb703",
                            fontSize: 8.5,
                            fontFamily: "'Cinzel', serif",
                            fontWeight: 700,
                          }}
                        >
                          {isChild ? "🦁 LETTRE CHAMPIONNE (GRAVE)" : `⚖️ GRAVE (TAFKHÎM)${isSelectedItbaq ? " · ITBÂQ" : ""}`}
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 10,
                            background: "rgba(86, 212, 188, 0.12)",
                            border: "1px solid rgba(86, 212, 188, 0.4)",
                            color: "var(--teal2)",
                            fontSize: 8.5,
                            fontFamily: "'Cinzel', serif",
                            fontWeight: 700,
                          }}
                        >
                          {isChild ? "✨ LETTRE DOUCE" : "✨ FINE (TARQÎQ)"}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className={`pronon-play-btn${playingId === `letter-${selected}` ? " playing" : ""}`}
                        onClick={() =>
                          playingId === `letter-${selected}` ? stopSpeak() : speak(selectedLetter.letter, `letter-${selected}`)
                        }
                        style={{
                          padding: "8px 16px",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {playingId === `letter-${selected}` ? "⏹ STOP" : isChild ? "▶ ÉCOUTER LE SON" : "▶ ÉCOUTER"}
                      </button>

                      <button
                        id="btn-validate-current-letter"
                        onClick={() => dispatch(uiActions.toggleValidateLetter(selectedLetter.letter))}
                        title={validatedLetters.includes(selectedLetter.letter) ? "Cliquer pour retirer la validation" : "Valider cette lettre pour gagner une étoile"}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          fontSize: 10,
                          fontFamily: "'Cinzel', serif",
                          fontWeight: 700,
                          cursor: "pointer",
                          border: validatedLetters.includes(selectedLetter.letter)
                            ? "1.5px solid #56d4bc"
                            : "1.5px solid #ffd166",
                          background: validatedLetters.includes(selectedLetter.letter)
                            ? "linear-gradient(135deg, rgba(86, 212, 188, 0.22) 0%, rgba(86, 212, 188, 0.1) 100%)"
                            : "linear-gradient(135deg, rgba(255, 209, 102, 0.22) 0%, rgba(255, 209, 102, 0.1) 100%)",
                          color: validatedLetters.includes(selectedLetter.letter) ? "var(--teal2)" : "#ffd166",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          transition: "all .15s",
                        }}
                      >
                        <span>{validatedLetters.includes(selectedLetter.letter) ? "✅ LETTRE VALIDÉE !" : "⭐ VALIDER CETTE LETTRE"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Lettre géante & Titre */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                    <div className="pronon-detail-letter" style={isSelectedHeavy ? { color: "#ffe082" } : {}}>
                      {selectedLetter.letter}
                    </div>
                    <div>
                      <div className="pronon-detail-name">
                        {selectedLetter.name.toUpperCase()} · /{selectedLetter.trans}/
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "center", marginTop: 2 }}>
                        {isChild ? (selDetail?.childOrgan || selDetail?.makhrajLabel || selectedLetter.makhraj) : (selDetail?.makhrajLabel || selectedLetter.makhraj)}
                      </div>
                    </div>
                  </div>

                  {/* ── SCHÉMA ANATOMIQUE SVG INTERACTIF DE LA BOUCHE / GORGE / LANGUE ── */}
                  <div style={{ margin: "4px 0" }}>
                    <MakharijAnatomyDiagram
                      activeLetter={selectedLetter.letter}
                      isHeavyMode={isSelectedHeavy}
                      isChild={isChild}
                      showLabels={true}
                    />
                  </div>

                  {/* Description d'articulation adaptée */}
                  {isChild ? (
                    <div
                      style={{
                        background: "rgba(255, 183, 3, 0.08)",
                        border: "1.5px solid rgba(255, 183, 3, 0.35)",
                        borderRadius: 12,
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: 10.5, letterSpacing: 1.2, color: "#ffe082", fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
                        🌟 ASTUCE MAGIQUE DU PETIT CHAMPION :
                      </div>
                      <div style={{ fontSize: 12, color: "#fff", lineHeight: 1.6, fontWeight: 500 }}>
                        {selDetail?.childTip || selDetail?.howToPronounce || selectedLetter.tip}
                      </div>
                      {selDetail?.howToPronounceChild && (
                        <div style={{ fontSize: 10.5, color: "var(--teal2)", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 5, marginTop: 2 }}>
                          👉 <strong>Comment faire :</strong> {selDetail.howToPronounceChild}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: "10px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: 1.5, color: "var(--gold2)", fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
                        POSITION ANATOMIQUE DES ORGANES (LANGUE, GORGE, LÈVRES) :
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.6 }}>
                        {selDetail?.howToPronounce || selectedLetter.tip}
                      </div>
                      {selDetail?.anatomicalTip && (
                        <div style={{ fontSize: 10, color: "var(--teal2)", borderTop: "1px solid var(--border2)", paddingTop: 4, marginTop: 2 }}>
                          🔬 <em>Détail anatomique :</em> {selDetail.anatomicalTip}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Formes selon la position */}
                  <div>
                    <div className="pronon-section-title" style={{ marginBottom: 8 }}>
                      FORMES SELON LA POSITION DANS LE MOT
                    </div>
                    <div className="pronon-detail-forms">
                      {[
                        ["Isolée", selectedLetter.isolated],
                        ["Initiale", selectedLetter.initial],
                        ["Médiane", selectedLetter.medial],
                        ["Finale", selectedLetter.final],
                      ].map(([pos, form]) => (
                        <div
                          key={pos}
                          className="pronon-form-item"
                          onClick={() => speak(form, `form-${pos}`)}
                          style={{ cursor: "pointer" }}
                          title="Cliquer pour écouter la prononciation"
                        >
                          <div className="pronon-form-arabic">{form}</div>
                          <div className="pronon-form-label">{pos.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Entraînement avec voyelles courtes */}
                  <div>
                    <div className="pronon-section-title" style={{ marginBottom: 8 }}>
                      PRONONCIATION AVEC LES VOYELLES
                    </div>
                    <div className="pronon-detail-harakats">
                      {HARAKATS.slice(0, 4).map((h, hi) => {
                        const withH = selectedLetter.letter + h.sign;
                        const pid = `detail-h-${selected}-${hi}`;
                        return (
                          <div
                            key={hi}
                            className={`pronon-detail-hbtn${playingId === pid ? " playing" : ""}`}
                            onClick={() => speak(withH, pid)}
                          >
                            <div className="pronon-detail-hbtn-arabic">{withH}</div>
                            <div className="pronon-detail-hbtn-name">{h.name.toUpperCase()}</div>
                            <div className="pronon-detail-hbtn-desc">{h.desc}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Exemples coraniques avec écoute audio */}
                  {selDetail?.exampleWords && (
                    <div>
                      <div className="pronon-section-title" style={{ marginBottom: 8 }}>
                        EXEMPLES DE MOTS CORANIQUES
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {selDetail.exampleWords.map((ex, exi) => (
                          <div
                            key={exi}
                            style={{
                              flex: "1 1 120px",
                              padding: "8px 12px",
                              background: "var(--surface3)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              cursor: "pointer",
                            }}
                            onClick={() => speak(ex.arabic, `ex-word-${exi}`)}
                            title="Cliquer pour écouter ce mot"
                          >
                            <div>
                              <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 20, color: "var(--gold2)", direction: "rtl" }}>
                                {ex.arabic}
                              </div>
                              <div style={{ fontSize: 9, color: "var(--text3)" }}>{ex.meaning}</div>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--teal2)" }}>🔊</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: 16, color: "var(--text3)" }}>
                  <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 48, opacity: 0.3, direction: "rtl" }}>ب ت ث</div>
                  <div style={{ fontSize: 10, letterSpacing: 2 }}>CLIQUEZ SUR UNE LETTRE</div>
                  <div style={{ fontSize: 9, letterSpacing: 1, color: "var(--text3)", opacity: 0.7 }}>
                    POUR AFFICHER L'ANATOMIE ET LES DÉTAILS
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 2 : LETTRES GRAVES (TAFKHÎM - خُصَّ ضَغْطٍ قِظْ) ──             */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {tab === "graves" && (
          <HeavyLettersGuide speak={speak} playingId={playingId} isChild={isChild} />
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 3 : VOYELLES & SIGNES (حَرَكَات) ──                             */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {tab === "harakat" && (
          <>
            <div>
              <div className="pronon-section-title">
                {isChild ? "🎨 LES 4 PETITS SONS MAGIQUES (حَرَكَات)" : "VOYELLES COURTES (حَرَكَات)"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                {HARAKATS.map((h, hi) => {
                  let childDesc = h.desc;
                  if (isChild) {
                    if (h.name.toLowerCase().includes("fath")) childDesc = "😊 Ouvre grand la bouche avec le sourire : A !";
                    else if (h.name.toLowerCase().includes("kasr")) childDesc = "😄 Fais un grand sourire malicieux : I !";
                    else if (h.name.toLowerCase().includes("damm")) childDesc = "😗 Fais un petit rond avec tes lèvres comme un bisou : Ou !";
                    else if (h.name.toLowerCase().includes("suk") || h.name.toLowerCase().includes("souk")) childDesc = "🤫 Chut ! Une petite pause toute douce sans voyelle !";
                    else if (h.name.toLowerCase().includes("shadd")) childDesc = "💪 La lettre championne musclée qui double sa force !";
                    else if (h.name.toLowerCase().includes("tanwin")) childDesc = "🔔 Fais chanter la petite clochette du nez : 'An', 'In' ou 'Oun' !";
                  }

                  return (
                    <div
                      key={hi}
                      className={`pronon-harakat-btn${playingId === `harak-${hi}` ? " playing" : ""}`}
                      onClick={() => speak(h.arabic, `harak-${hi}`)}
                    >
                      <div className="pronon-harakat-arabic" style={{ color: h.color }}>
                        {h.arabic}
                      </div>
                      <div className="pronon-harakat-name">{h.name.toUpperCase()}</div>
                      <div className="pronon-harakat-desc">{childDesc}</div>
                      {playingId === `harak-${hi}` && (
                        <div style={{ fontSize: 8, color: "var(--teal)", letterSpacing: 1, marginTop: 2 }}>
                          ▶ EN COURS
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="pronon-section-title">
                {isChild ? "🎯 ENTRAÎNE-TOI AVEC LA LETTRE ب (Ba)" : "ENTRAÎNEMENT AVEC ب (Ba)"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {HARAKATS.map((h, hi) => {
                  const pid = `train-${hi}`;
                  return (
                    <div
                      key={hi}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        padding: "14px 18px",
                        background: playingId === pid ? "rgba(62,184,160,.08)" : "var(--surface2)",
                        border: `1px solid ${playingId === pid ? "var(--teal)" : "var(--border)"}`,
                        borderRadius: 10,
                        cursor: "pointer",
                        transition: "all .2s",
                        minWidth: 90,
                      }}
                      onClick={() => speak("ب" + h.sign, "train-" + hi)}
                    >
                      <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 34, color: h.color, direction: "rtl" }}>
                        {"ب" + h.sign}
                      </div>
                      <div style={{ fontSize: 8, letterSpacing: 1, color: "var(--text3)", fontFamily: "'Cinzel', serif" }}>
                        {h.name.toUpperCase()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="pronon-section-title">
                {isChild ? "🚂 LES VOYELLES LONGUES ENCHANTÉES (حُرُوف الْمَدّ)" : "VOYELLES LONGUES (حُرُوف الْمَدّ)"}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  {
                    arabic: "بَا",
                    name: isChild ? "Le Grand Â" : "Alif + Fatḥa",
                    desc: isChild ? "Chante un grand 'Âaa' qui s'étire vers le ciel !" : "Son 'Â' long (ex: كَافِرُون)",
                    color: "var(--gold2)",
                    synth: "بَا",
                  },
                  {
                    arabic: "بِي",
                    name: isChild ? "Le Grand Î" : "Ya + Kasra",
                    desc: isChild ? "Chante un grand 'Îii' tout joyeux avec le sourire !" : "Son 'Î' long (ex: كِيلَ)",
                    color: "var(--teal2)",
                    synth: "بِي",
                  },
                  {
                    arabic: "بُو",
                    name: isChild ? "Le Grand Oû" : "Waw + Ḍamma",
                    desc: isChild ? "Chante un grand 'Oûuu' comme un bisou magique !" : "Son 'Û' long (ex: نُوحٌ)",
                    color: "var(--green2)",
                    synth: "بُو",
                  },
                ].map((v, vi) => (
                  <div
                    key={vi}
                    style={{
                      flex: "1 1 140px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      padding: "18px",
                      background: "var(--surface2)",
                      border: `1px solid ${playingId === `long-${vi}` ? "var(--teal)" : "var(--border)"}`,
                      borderRadius: 10,
                      cursor: "pointer",
                      transition: "all .2s",
                    }}
                    onClick={() => speak(v.synth, `long-${vi}`)}
                  >
                    <div style={{ fontFamily: "'Amiri Quran', serif", fontSize: 36, color: v.color, direction: "rtl" }}>
                      {v.arabic}
                    </div>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: "var(--text2)", fontFamily: "'Cinzel', serif" }}>
                      {v.name.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text3)", textAlign: "center" }}>{v.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 4 : RÈGLES DE BASE DU TAJWID (تجويد) ──                         */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {tab === "tajwid" && (
          <>
            <div>
              <div className="pronon-section-title">
                {isChild ? "✨ LES 7 SECRETS MAGIQUES DE RÉCITATION (تجويد)" : "RÈGLES DE BASE DU TAJWID (تجويد)"}
              </div>
              {[
                {
                  name: isChild ? "☀️ LE SOLEIL CLAIR (Iẓhâr)" : "NUN SAKIN & TANWÎN — Iẓhâr (إظهار)",
                  arabic: "أَنْعَمْتَ",
                  desc: isChild
                    ? "Le son 'N' brille et se prononce tout clair et propre comme le soleil ! On ne le cache pas."
                    : "Prononciation claire du Nûn quand il est suivi de ء ه ع غ ح خ (lettres de la gorge). On entend le 'n' distinctement sans nasalisation prolongée.",
                  color: "var(--gold)",
                },
                {
                  name: isChild ? "🧲 L'AIMANT MAGIQUE (Idghâm)" : "NUN SAKIN & TANWÎN — Idghâm (إدغام)",
                  arabic: "مَنْ يَعْمَلُ",
                  desc: isChild
                    ? "Comme par magie, le son 'N' disparaît et se colle directement dans la lettre suivante !"
                    : "Fusion du Nûn dans la lettre suivante (ي ن م و ل ر). Le 'n' disparaît dans la consonne suivante.",
                  color: "var(--teal)",
                },
                {
                  name: isChild ? "🔄 LE CAMÉLÉON RIGOLO (Iqlâb)" : "NUN SAKIN & TANWÎN — Iqlab (إقلاب)",
                  arabic: "أَنْبِيَاء",
                  desc: isChild
                    ? "Dès que le 'N' rencontre la lettre Ba (ب), il se déguise en 'M' tout doux avec un bisou des lèvres !"
                    : "Transformation du Nûn en Mîm nasale devant la lettre ب. 'nb' devient 'm' nasal avec lèvres douces.",
                  color: "var(--green)",
                },
                {
                  name: isChild ? "🥷 LE NINJA SECRET (Ikhfâ)" : "NUN SAKIN & TANWÎN — Ikhfâ (إخفاء)",
                  arabic: "مَنْ كَانَ",
                  desc: isChild
                    ? "Le son 'N' se cache dans le nez comme un petit ninja avec un doux bourdonnement magique !"
                    : "Dissimulation nasalisée du Nûn devant 15 lettres. Son intermédiaire entre Iẓhâr et Idghâm avec maintien de la Ghunnah.",
                  color: "var(--gold2)",
                },
                {
                  name: isChild ? "🚂 LE TRAIN ENCHANTÉ (Madd Naturel)" : "MADD — Allongement naturel (مَدّ طَبِيعِي)",
                  arabic: "قَالَ",
                  desc: isChild
                    ? "On étire la voix pendant 2 temps comme le wagon d'un train enchanté : 'Âaa', 'Îii', 'Oûuu' !"
                    : "Allongement de 2 temps sur ا و ي quand précédé de sa voyelle correspondante.",
                  color: "var(--teal2)",
                },
                {
                  name: isChild ? "🚀 LE GRAND VOYAGE DE LA VOIX (Madd Long)" : "MADD — Allongement obligatoire (مَدّ وَاجِب)",
                  arabic: "جَاءَ",
                  desc: isChild
                    ? "Quand une Hamza arrive, la voix s'envole encore plus loin pendant 4 à 5 temps !"
                    : "Allongement de 4-5 temps quand les lettres de madd sont suivies d'une hamza dans le même mot.",
                  color: "var(--gold3)",
                },
                {
                  name: isChild ? "🏀 LE BALLON QUI REBONDIT (Qalqalah)" : "QALQALAH (قَلْقَلَة) — Écho rebondissant",
                  arabic: "يَقْطَعُ",
                  desc: isChild
                    ? "Sur les 5 lettres championnes (ق ط ب ج د), quand il y a un stop, la voix rebondit comme une balle magique : 'BOING' !"
                    : "Vibration explosive sur les lettres ق ط ب ج د portant un soukoun. Le son rebondit nettement.",
                  color: "var(--red)",
                },
              ].map((rule, ri) => (
                <div
                  key={ri}
                  style={{
                    marginBottom: 12,
                    padding: "14px 18px",
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    borderLeft: `3px solid ${rule.color}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9.5, letterSpacing: 1.5, color: rule.color, flex: 1, fontWeight: 700 }}>
                      {rule.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Amiri Quran', serif",
                        fontSize: 22,
                        color: "var(--gold2)",
                        direction: "rtl",
                        cursor: "pointer",
                        padding: "4px 10px",
                        background: playingId === `tajwid-${ri}` ? "rgba(62,184,160,.1)" : "var(--surface3)",
                        borderRadius: 6,
                        border: `1px solid ${playingId === `tajwid-${ri}` ? "var(--teal)" : "var(--border2)"}`,
                      }}
                      onClick={() => speak(rule.arabic, `tajwid-${ri}`)}
                      title="Cliquer pour écouter l'exemple"
                    >
                      {rule.arabic}
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text2)", lineHeight: 1.6 }}>{rule.desc}</div>
                </div>
              ))}
            </div>

            <div className="pronon-tip-box" style={{ marginTop: 4 }}>
              {isChild ? (
                <span>
                  🌟 <strong>Bravo Petit Récitateur :</strong> Va maintenant sur la page 📖 <strong>LECTURE</strong> pour voir briller toutes ces couleurs magiques directement sur les versets du Coran !
                </span>
              ) : (
                <span>
                  🎓 <strong>Conseil :</strong> Pour écouter ces règles directement appliquées au texte sacré, visitez la page 📖 <strong>LECTURE</strong> et activez le bouton <strong>TAJWID</strong> pour visualiser les couleurs en temps réel sur les versets !
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── CHILD UNLOCK CELEBRATION MODAL ── */}
      <ChildUnlockQuranCelebrationModal />
    </main>
  );
}
