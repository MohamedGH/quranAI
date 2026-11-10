import React, { useState, useRef } from "react";
import { ARABIC_LETTERS, HARAKATS } from "../../utils/arabicUtils.js";
import {
  DETAILED_ARABIC_LETTERS,
  GENERAL_MAKHAREJ,
  ANATOMICAL_ZONES,
  getLetterAnatomy,
  isHeavyLetter,
  isItbaqLetter,
  HEAVY_LETTERS_DATA,
} from "../../utils/makharijData.js";
import { MakharijAnatomyDiagram } from "../common/MakharijAnatomyDiagram.jsx";
import { HeavyLettersGuide } from "../common/HeavyLettersGuide.jsx";

export function PrononciationPage() {
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

  const sel = selected !== null && selected < ARABIC_LETTERS.length ? ARABIC_LETTERS[selected] : ARABIC_LETTERS[0];
  const selDetail = sel ? getLetterAnatomy(sel.letter) : null;
  const isSelectedHeavy = sel ? isHeavyLetter(sel.letter) : false;
  const isSelectedItbaq = sel ? isItbaqLetter(sel.letter) : false;

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
          مَخَارِجُ الحُرُوفِ وَالتَّجْوِيد
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--text3)", fontFamily: "'Cinzel', serif" }}>
          POINTS D'ARTICULATION · ANATOMIE · LETTRES GRAVES
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div style={{ padding: "0 28px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
        <div className="pronon-nav-tabs">
          {[
            ["lettres", "🔤 LETTRES & ANATOMIE"],
            ["graves", "⚖️ LETTRES GRAVES (TAFKHÎM)"],
            ["harakat", "◌ VOYELLES & SIGNES"],
            ["tajwid", "📚 RÈGLES DE TAJWID"],
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

      <div className="pronon-page">
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 1 : LETTRES & ANATOMIE DE LA BOUCHE ──                        */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {tab === "lettres" && (
          <div className="pronon-two-col">
            {/* Colonne gauche : Filtres anatomiques + Grille des 29 lettres */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="pronon-section-title">
                POINTS DE SORTIE DES 29 LETTRES (مَخَارِجُ الحُرُوف)
              </div>

              {/* Filtre par organe anatomique */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {[
                  { id: "all", label: `Toutes (${ARABIC_LETTERS.length})` },
                  { id: "lisan", label: "👅 Langue (18)" },
                  { id: "halq", label: "🔴 Gorge (6)" },
                  { id: "shafatayn", label: "👄 Lèvres (4)" },
                  { id: "jawf", label: "🟢 Cavité (1)" },
                  { id: "heavy", label: "⚖️ Graves (7)" },
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

                  return (
                    <div
                      key={l.letter}
                      className={`pronon-card${isSelected ? " selected" : ""}${isPlaying ? " playing" : ""}`}
                      onClick={() => {
                        setSelected(origIdx);
                        speak(l.letter, `letter-${origIdx}`);
                      }}
                      style={
                        isLtrHeavy
                          ? { borderColor: isSelected ? "#ffb703" : "rgba(255, 183, 3, 0.35)", background: isSelected ? "rgba(255, 183, 3, 0.14)" : "var(--surface2)" }
                          : {}
                      }
                    >
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
                💡 <strong>Règle d'or :</strong> Chaque lettre a un point de sortie précis (<em>Makhraj</em>) et des caractéristiques d'air et de voix (<em>Sifât</em>).
                Cliquez sur n'importe quelle lettre pour voir exactement où elle se forme dans la bouche, la langue ou la gorge sur le diagramme anatomique.
              </div>
            </div>

            {/* Colonne droite : Fiche détaillée + Schéma anatomique SVG interactif */}
            <div>
              {sel ? (
                <div className="pronon-detail-panel">
                  {/* En-tête : Makhraj + Statut Grave/Fin + Bouton Play */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <div className="pronon-makhraj-tag">
                        📍 {selDetail?.organTitle || sel.makhraj}
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
                          ⚖️ GRAVE (TAFKHÎM){isSelectedItbaq ? " · ITBÂQ" : ""}
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
                          ✨ FINE (TARQÎQ)
                        </span>
                      )}
                    </div>

                    <button
                      className={`pronon-play-btn${playingId === `letter-${selected}` ? " playing" : ""}`}
                      onClick={() =>
                        playingId === `letter-${selected}` ? stopSpeak() : speak(sel.letter, `letter-${selected}`)
                      }
                      style={{
                        padding: "8px 16px",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {playingId === `letter-${selected}` ? "⏹ STOP" : "▶ ÉCOUTER"}
                    </button>
                  </div>

                  {/* Lettre géante & Titre */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                    <div className="pronon-detail-letter" style={isSelectedHeavy ? { color: "#ffe082" } : {}}>
                      {sel.letter}
                    </div>
                    <div>
                      <div className="pronon-detail-name">
                        {sel.name.toUpperCase()} · /{sel.trans}/
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "center", marginTop: 2 }}>
                        {selDetail?.makhrajLabel || sel.makhraj}
                      </div>
                    </div>
                  </div>

                  {/* ── SCHÉMA ANATOMIQUE SVG INTERACTIF DE LA BOUCHE / GORGE / LANGUE ── */}
                  <div style={{ margin: "4px 0" }}>
                    <MakharijAnatomyDiagram
                      activeLetter={sel.letter}
                      isHeavyMode={isSelectedHeavy}
                      showLabels={true}
                    />
                  </div>

                  {/* Description d'articulation approfondie */}
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
                      {selDetail?.howToPronounce || sel.tip}
                    </div>
                    {selDetail?.anatomicalTip && (
                      <div style={{ fontSize: 10, color: "var(--teal2)", borderTop: "1px solid var(--border2)", paddingTop: 4, marginTop: 2 }}>
                        🔬 <em>Détail anatomique :</em> {selDetail.anatomicalTip}
                      </div>
                    )}
                  </div>

                  {/* Formes selon la position */}
                  <div>
                    <div className="pronon-section-title" style={{ marginBottom: 8 }}>
                      FORMES SELON LA POSITION DANS LE MOT
                    </div>
                    <div className="pronon-detail-forms">
                      {[
                        ["Isolée", sel.isolated],
                        ["Initiale", sel.initial],
                        ["Médiane", sel.medial],
                        ["Finale", sel.final],
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
                        const withH = sel.letter + h.sign;
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
          <HeavyLettersGuide speak={speak} playingId={playingId} />
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 3 : VOYELLES & SIGNES (حَرَكَات) ──                             */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {tab === "harakat" && (
          <>
            <div>
              <div className="pronon-section-title">VOYELLES COURTES (حَرَكَات)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                {HARAKATS.map((h, hi) => (
                  <div
                    key={hi}
                    className={`pronon-harakat-btn${playingId === `harak-${hi}` ? " playing" : ""}`}
                    onClick={() => speak(h.arabic, `harak-${hi}`)}
                  >
                    <div className="pronon-harakat-arabic" style={{ color: h.color }}>
                      {h.arabic}
                    </div>
                    <div className="pronon-harakat-name">{h.name.toUpperCase()}</div>
                    <div className="pronon-harakat-desc">{h.desc}</div>
                    {playingId === `harak-${hi}` && (
                      <div style={{ fontSize: 8, color: "var(--teal)", letterSpacing: 1, marginTop: 2 }}>
                        ▶ EN COURS
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="pronon-section-title">ENTRAÎNEMENT AVEC ب (Ba)</div>
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
              <div className="pronon-section-title">VOYELLES LONGUES (حُرُوف الْمَدّ)</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { arabic: "بَا", name: "Alif + Fatḥa", desc: "Son 'Â' long (ex: كَافِرُون)", color: "var(--gold2)", synth: "بَا" },
                  { arabic: "بِي", name: "Ya + Kasra", desc: "Son 'Î' long (ex: كِيلَ)", color: "var(--teal2)", synth: "بِي" },
                  { arabic: "بُو", name: "Waw + Ḍamma", desc: "Son 'Û' long (ex: نُوحٌ)", color: "var(--green2)", synth: "بُو" },
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
              <div className="pronon-section-title">RÈGLES DE BASE DU TAJWID (تجويد)</div>
              {[
                {
                  name: "NUN SAKIN & TANWÎN — Iẓhâr (إظهار)",
                  arabic: "أَنْعَمْتَ",
                  desc: "Prononciation claire du Nûn quand il est suivi de ء ه ع غ ح خ (lettres de la gorge). On entend le 'n' distinctement sans nasalisation prolongée.",
                  color: "var(--gold)",
                },
                {
                  name: "NUN SAKIN & TANWÎN — Idghâm (إدغام)",
                  arabic: "مَنْ يَعْمَلُ",
                  desc: "Fusion du Nûn dans la lettre suivante (ي ن م و ل ر). Le 'n' disparaît dans la consonne suivante.",
                  color: "var(--teal)",
                },
                {
                  name: "NUN SAKIN & TANWÎN — Iqlab (إقلاب)",
                  arabic: "أَنْبِيَاء",
                  desc: "Transformation du Nûn en Mîm nasale devant la lettre ب. 'nb' devient 'm' nasal avec lèvres douces.",
                  color: "var(--green)",
                },
                {
                  name: "NUN SAKIN & TANWÎN — Ikhfâ (إخفاء)",
                  arabic: "مَنْ كَانَ",
                  desc: "Dissimulation nasalisée du Nûn devant 15 lettres. Son intermédiaire entre Iẓhâr et Idghâm avec maintien de la Ghunnah.",
                  color: "var(--gold2)",
                },
                {
                  name: "MADD — Allongement naturel (مَدّ طَبِيعِي)",
                  arabic: "قَالَ",
                  desc: "Allongement de 2 temps sur ا و ي quand précédé de sa voyelle correspondante.",
                  color: "var(--teal2)",
                },
                {
                  name: "MADD — Allongement obligatoire (مَدّ وَاجِب)",
                  arabic: "جَاءَ",
                  desc: "Allongement de 4-5 temps quand les lettres de madd sont suivies d'une hamza dans le même mot.",
                  color: "var(--gold3)",
                },
                {
                  name: "QALQALAH (قَلْقَلَة) — Écho rebondissant",
                  arabic: "يَقْطَعُ",
                  desc: "Vibration explosive sur les lettres ق ط ب ج د portant un soukoun. Le son rebondit nettement.",
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
              🎓 <strong>Conseil :</strong> Pour écouter ces règles directement appliquées au texte sacré, visitez la page 📖 <strong>LECTURE</strong> et activez le bouton <strong>TAJWID</strong> pour visualiser les couleurs en temps réel sur les versets !
            </div>
          </>
        )}
      </div>
    </main>
  );
}
