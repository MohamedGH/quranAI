import React, { useState } from "react";

export function ArchitecturePdfModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("patterns");

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(10, 15, 29, 0.85)",
        backdropFilter: "blur(6px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          background: "var(--surface, #1e293b)",
          color: "var(--text, #f8fafc)",
          borderRadius: 16,
          maxWidth: 960,
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(15, 23, 42, 0.75)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(45, 212, 191, 0.15)",
                border: "1px solid rgba(45, 212, 191, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18
              }}
            >
              📐
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>
                DOSSIER D'ARCHITECTURE & DESIGN PATTERNS
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text3, #94a3b8)" }}>
                Documentation technique, patrons de conception et flux de données (PDF 8 pages)
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Download PDF button */}
            <a
              href="/architecture_design_patterns.pdf"
              download="architecture_design_patterns.pdf"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#2dd4bf",
                color: "#0f172a",
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 2px 10px rgba(45, 212, 191, 0.3)"
              }}
            >
              <span>📥</span>
              <span>Télécharger le PDF</span>
            </a>

            {/* Print button */}
            <button
              onClick={handlePrint}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "var(--text, #f8fafc)",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span>🖨️</span>
              <span>Imprimer</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text3, #94a3b8)",
                fontSize: 20,
                cursor: "pointer",
                padding: "4px 8px",
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 24px",
            background: "rgba(15, 23, 42, 0.4)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
          }}
        >
          {[
            { id: "patterns", label: "💎 10 Design Patterns", badge: "10" },
            { id: "diagrams", label: "📊 Diagrammes de Flux & Processus", badge: "4" },
            { id: "layers", label: "🏛️ Clean Architecture en Couches" },
            { id: "matrix", label: "📑 Matrice de Traçabilité" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: activeTab === tab.id ? "rgba(45, 212, 191, 0.15)" : "transparent",
                color: activeTab === tab.id ? "#2dd4bf" : "var(--text3, #94a3b8)",
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  style={{
                    background: activeTab === tab.id ? "#2dd4bf" : "rgba(255, 255, 255, 0.1)",
                    color: activeTab === tab.id ? "#0f172a" : "var(--text2, #cbd5e1)",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 10
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* TAB 1: DESIGN PATTERNS */}
          {activeTab === "patterns" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "rgba(45, 212, 191, 0.08)",
                  border: "1px solid rgba(45, 212, 191, 0.25)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  lineHeight: 1.5
                }}
              >
                <strong>Synthèse des 10 Design Patterns :</strong> L'application met en œuvre une combinaison
                rigoureuse de patrons architecturaux, comportementaux et structurels pour garantir une synchronisation audio
                sans latence (60 FPS), une résilience totale en mode hors-ligne et une extensibilité maximale.
              </div>

              {[
                {
                  id: 1,
                  name: "Redux / Flux Pattern",
                  category: "Gestion d'État Centralisée",
                  files: "src/store.js, src/App.jsx",
                  desc: "Maintient un flux de données strictement unidirectionnel. Toutes les mutations (audio, apprentissage, UI, erreurs) transitent par des actions et reducers immuables.",
                  benefits: "État prévisible, zéro effet de bord inattendu, sélecteurs mémoïsés à haute performance."
                },
                {
                  id: 2,
                  name: "Repository & Cache-Aside",
                  category: "Persistance & Mode Hors-Ligne",
                  files: "src/utils/persistenceRepository.js, src/utils/audioCaching.js",
                  desc: "Abstrait les couches de persistance physiques (IndexedDB pour les gros blobs audio MP3, LocalStorage pour les préférences légères, Firestore pour le cloud).",
                  benefits: "Économie de bande passante, lecture instantanée sans buffering réseau, fonctionnement offline."
                },
                {
                  id: 3,
                  name: "Strategy Pattern",
                  category: "Traitement Phonétique & Modes Audio",
                  files: "src/utils/tajweedRules.js, src/utils/audioSilenceManager.js",
                  desc: "Chaque règle de Tajwid (Qalqala, Iqlâb, Ikhfâ, Iẓhâr, Idghâm, Madd, Tafkhîm) possède son algorithme d'analyse dédié. Le mode de silence bascule dynamiquement entre 'mute' et 'skip'.",
                  benefits: "Extensibilité sans impacter le moteur d'exécution (Respect strict du principe Open/Closed)."
                },
                {
                  id: 4,
                  name: "Observer & Pub/Sub",
                  category: "Synchronisation Événementielle",
                  files: "src/store.js (subscribe), MediaSession, Audio Listeners",
                  desc: "Souscription réactive permettant aux composants passifs et aux sous-systèmes média d'être notifiés immédiatement des changements d'état.",
                  benefits: "Découplage des composants, synchronisation instantanée des commandes lock-screen OS."
                },
                {
                  id: 5,
                  name: "Facade Pattern",
                  category: "Abstraction d'APIs Complexes",
                  files: "src/utils/tajweedAudioCoach.js",
                  desc: "Encapsule les APIs natives du navigateur (Web Audio Context, Oscillators, SpeechSynthesis) derrière une interface simple et asynchrone.",
                  benefits: "Code client épuré, isolation des spécificités navigateurs (Chrome, Safari, Firefox)."
                },
                {
                  id: 6,
                  name: "Game Loop / RequestAnimationFrame",
                  category: "Performance Temps Réel 60 FPS",
                  files: "src/App.jsx, src/components/common/ArabicHighlighted.jsx",
                  desc: "Boucle de rendu calée sur le rafraîchissement d'écran qui met à jour le surlignage mot à mot directement dans le DOM sans re-render React.",
                  benefits: "Fluidité totale (60 FPS), zéro freeze, élimination de la surcharge du Virtual DOM."
                },
                {
                  id: 7,
                  name: "Finite State Machine (FSM)",
                  category: "Orchestration Déterministe",
                  files: "src/App.jsx (Player & Tajweed Coach)",
                  desc: "Modélise les transitions d'états formelles : Surveillance ➔ Pause prédictive (-420ms) ➔ Annonce vocale ➔ Décompte ➔ Reprise.",
                  benefits: "Élimination des bugs de concurrence et des chevauchements audio entre la voix et la récitation."
                },
                {
                  id: 8,
                  name: "Composite Pattern",
                  category: "Modélisation du Texte Sacré",
                  files: "src/utils/quranDomain.js, src/utils/hizbUtils.js",
                  desc: "Structure le Coran en arbre homogène : Coran ➔ Sourates ➔ Versets ➔ Mots ➔ Caractères, avec facettes canoniques (Juz, Hizb, Rub).",
                  benefits: "Navigation uniforme à toute échelle, calculs statistiques et progression aisés."
                },
                {
                  id: 9,
                  name: "Decorator / Pipeline",
                  category: "Enrichissement Visuel du Texte",
                  files: "src/components/common/StyleTag.jsx, tajweedRules.js",
                  desc: "Traite le texte arabe par couches successives : Texte brut ➔ Normalisation ➔ Tagging Tajwid ➔ Timestamps ➔ Classes CSS décoratives.",
                  benefits: "Préservation intégrale du texte Uthmani original sans altération de la graphie."
                },
                {
                  id: 10,
                  name: "Error Boundary & Graceful Degradation",
                  category: "Résilience & Tolérance aux Pannes",
                  files: "src/components/common/ErrorBoundary.jsx, src/store.js",
                  desc: "Interception des exceptions runtime React, timeouts de garde (watchdogs) et solutions de repli automatiques.",
                  benefits: "Zéro crash brutal ni écran blanc pour l'utilisateur final."
                }
              ].map(pat => (
                <div
                  key={pat.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    padding: "16px 20px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          background: "rgba(45, 212, 191, 0.15)",
                          color: "#2dd4bf",
                          fontWeight: 800,
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 6
                        }}
                      >
                        PATTERN #{pat.id}
                      </span>
                      <strong style={{ fontSize: 14 }}>{pat.name}</strong>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--gold, #d4af37)", fontWeight: 600 }}>
                      {pat.category}
                    </span>
                  </div>

                  <p style={{ margin: "4px 0 8px", fontSize: 12.5, color: "var(--text2, #cbd5e1)", lineHeight: 1.45 }}>
                    {pat.desc}
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 11.5, color: "var(--text3, #94a3b8)", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: 8 }}>
                    <div>
                      <strong style={{ color: "var(--text, #f8fafc)" }}>Fichiers :</strong> <code>{pat.files}</code>
                    </div>
                    <div>
                      <strong style={{ color: "#2dd4bf" }}>Bénéfices :</strong> {pat.benefits}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: DIAGRAMS */}
          {activeTab === "diagrams" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Diagram 1: Karaoke RAF Loop */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: "18px 20px"
                }}
              >
                <h3 style={{ margin: "0 0 4px", fontSize: 14, color: "#2dd4bf" }}>
                  1. Flux de Synchronisation Karaoke à 60 FPS (Game Loop RAF)
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text3, #94a3b8)" }}>
                  Découplage complet entre l'horloge audio et React pour éviter toute chute de framerate.
                </p>

                {/* Flow visual */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: 8, border: "1px solid rgba(45, 212, 191, 0.3)" }}>
                    <div style={{ fontSize: 10, color: "#2dd4bf", fontWeight: 700 }}>SOURCE AUDIO</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>HTMLAudioElement</div>
                    <div style={{ fontSize: 11, color: "var(--text3, #94a3b8)", marginTop: 2 }}>currentTime en ms</div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: 8, border: "1px solid rgba(212, 175, 55, 0.4)" }}>
                    <div style={{ fontSize: 10, color: "var(--gold, #d4af37)", fontWeight: 700 }}>BOUCLE 60 FPS</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>startRaf / tick()</div>
                    <div style={{ fontSize: 11, color: "var(--text3, #94a3b8)", marginTop: 2 }}>requestAnimationFrame</div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: 8, border: "1px solid rgba(59, 130, 246, 0.4)" }}>
                    <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700 }}>CALCUL D'INTERVALLE</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>flatCharData Lookup</div>
                    <div style={{ fontSize: 11, color: "var(--text3, #94a3b8)", marginTop: 2 }}>start &lt;= ms &lt;= end</div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: 8, border: "1px solid rgba(34, 197, 94, 0.4)" }}>
                    <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>INJECTION DIRECTE</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>classList.add()</div>
                    <div style={{ fontSize: 11, color: "var(--text3, #94a3b8)", marginTop: 2 }}>0 render React déclenché</div>
                  </div>
                </div>
              </div>

              {/* Diagram 2: Coach Vocal Tajweed */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: "18px 20px"
                }}
              >
                <h3 style={{ margin: "0 0 4px", fontSize: 14, color: "#2dd4bf" }}>
                  2. Flux du Coach Vocal Tajweed (Pause Prédictive & Annonce Audio)
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text3, #94a3b8)" }}>
                  Garantit que la pause de la récitation dure jusqu'à la fin complète de l'annonce audio de la règle.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: 8, border: "1px solid rgba(45, 212, 191, 0.3)" }}>
                    <div style={{ fontSize: 10, color: "#2dd4bf", fontWeight: 700 }}>ÉTAPE 1</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Détection Prédictive</div>
                    <div style={{ fontSize: 11, color: "var(--text3, #94a3b8)", marginTop: 2 }}>diff &lt;= 420ms avant règle</div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.4)" }}>
                    <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700 }}>ÉTAPE 2</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Pause & Carillon</div>
                    <div style={{ fontSize: 11, color: "var(--text3, #94a3b8)", marginTop: 2 }}>AudioContext WebAudio</div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: 8, border: "1px solid rgba(212, 175, 55, 0.4)" }}>
                    <div style={{ fontSize: 10, color: "var(--gold, #d4af37)", fontWeight: 700 }}>ÉTAPE 3</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Synthèse Vocale</div>
                    <div style={{ fontSize: 11, color: "var(--text3, #94a3b8)", marginTop: 2 }}>SpeechSynthesis + Keep-Alive</div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: 8, border: "1px solid rgba(34, 197, 94, 0.4)" }}>
                    <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>ÉTAPE 4</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Reprise Sécurisée</div>
                    <div style={{ fontSize: 11, color: "var(--text3, #94a3b8)", marginTop: 2 }}>onend + speaking=false</div>
                  </div>
                </div>
              </div>

              {/* Diagram 3: Cache & Offline */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: "18px 20px"
                }}
              >
                <h3 style={{ margin: "0 0 4px", fontSize: 14, color: "#2dd4bf" }}>
                  3. Flux du Cache Hiérarchique Offline-First
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text3, #94a3b8)" }}>
                  Mécanisme Stale-While-Revalidate avec priorité locale IndexedDB.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(15, 23, 42, 0.5)", padding: "10px 14px", borderRadius: 8 }}>
                    <span style={{ fontWeight: 700, color: "#2dd4bf" }}>1. Requête Audio :</span>
                    <span style={{ fontSize: 12, color: "var(--text2, #cbd5e1)" }}>Vérification immédiate dans IndexedDB (quran_audio_cache) via clé de verset.</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(15, 23, 42, 0.5)", padding: "10px 14px", borderRadius: 8 }}>
                    <span style={{ fontWeight: 700, color: "#4ade80" }}>2. Cache HIT :</span>
                    <span style={{ fontSize: 12, color: "var(--text2, #cbd5e1)" }}>Conversion du Blob local en ObjectURL ➔ Lecture instantanée (0ms de latence).</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(15, 23, 42, 0.5)", padding: "10px 14px", borderRadius: 8 }}>
                    <span style={{ fontWeight: 700, color: "#f87171" }}>3. Cache MISS :</span>
                    <span style={{ fontSize: 12, color: "var(--text2, #cbd5e1)" }}>Téléchargement réseau via CDN EveryAyah ➔ Sauvegarde asynchrone dans IndexedDB.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLEAN ARCHITECTURE LAYERS */}
          {activeTab === "layers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "rgba(45, 212, 191, 0.1)", border: "1px solid rgba(45, 212, 191, 0.3)", borderRadius: 10, padding: "14px 16px" }}>
                <h4 style={{ margin: "0 0 6px", color: "#2dd4bf", fontSize: 14 }}>Couche 1 : Présentation (UI Components & Hooks)</h4>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text2, #cbd5e1)" }}>
                  Composants React fonctionnels purs, modaux plein écran, tiroirs de réglages et écouteurs d'événements.
                </p>
              </div>

              <div style={{ background: "rgba(212, 175, 55, 0.1)", border: "1px solid rgba(212, 175, 55, 0.3)", borderRadius: 10, padding: "14px 16px" }}>
                <h4 style={{ margin: "0 0 6px", color: "var(--gold, #d4af37)", fontSize: 14 }}>Couche 2 : Application & State (Redux Toolkit)</h4>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text2, #cbd5e1)" }}>
                  Slices Redux (player, learn, quran, ui, error, goals), sélecteurs mémoïsés createSelector et middleware de persistance.
                </p>
              </div>

              <div style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: 10, padding: "14px 16px" }}>
                <h4 style={{ margin: "0 0 6px", color: "#60a5fa", fontSize: 14 }}>Couche 3 : Domaine Métier (Tajweed & Quran Domain)</h4>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text2, #cbd5e1)" }}>
                  Moteur phonétique autonome de Tajwid, gestionnaire de silences, algorithmes de normalisation arabe et de découpage canonique.
                </p>
              </div>

              <div style={{ background: "rgba(148, 163, 184, 0.1)", border: "1px solid rgba(148, 163, 184, 0.3)", borderRadius: 10, padding: "14px 16px" }}>
                <h4 style={{ margin: "0 0 6px", color: "var(--text, #f8fafc)", fontSize: 14 }}>Couche 4 : Infrastructure & Périphériques</h4>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text2, #cbd5e1)" }}>
                  IndexedDB, Web Audio API, Web Speech API, Service Worker PWA, HTMLAudioElement et SDK Firebase.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: MATRIX */}
          {activeTab === "matrix" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(15, 23, 42, 0.8)", borderBottom: "2px solid rgba(45, 212, 191, 0.4)" }}>
                    <th style={{ padding: "10px", textAlign: "left", color: "#2dd4bf" }}>Pattern</th>
                    <th style={{ padding: "10px", textAlign: "left", color: "#2dd4bf" }}>Module Source</th>
                    <th style={{ padding: "10px", textAlign: "left", color: "#2dd4bf" }}>Responsabilité Principale</th>
                    <th style={{ padding: "10px", textAlign: "center", color: "#2dd4bf" }}>Conformité</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { p: "Redux / Flux", f: "src/store.js", r: "Single Source of Truth, immutabilité d'état" },
                    { p: "Repository", f: "src/utils/persistenceRepository.js", r: "Abstrait IndexedDB, LocalStorage et Cloud" },
                    { p: "Strategy (Tajweed)", f: "src/utils/tajweedRules.js", r: "Algorithmes de détection phonétique interchangeables" },
                    { p: "Strategy (Silence)", f: "src/utils/audioSilenceManager.js", r: "Modes d'occultation audio mute vs skip" },
                    { p: "Facade", f: "src/utils/tajweedAudioCoach.js", r: "Simplification Web Audio & SpeechSynthesis" },
                    { p: "Game Loop (RAF)", f: "src/components/common/ArabicHighlighted.jsx", r: "Boucle de rendu DOM synchrone à 60 FPS" },
                    { p: "State Machine", f: "src/App.jsx", r: "Transitions d'états audio et pause prédictive" },
                    { p: "Composite", f: "src/utils/quranDomain.js", r: "Structure hiérarchique Coran / Sourates / Ayats" },
                    { p: "Decorator", f: "src/components/common/StyleTag.jsx", r: "Enrichissement visuel dynamique des lettres" },
                    { p: "Error Boundary", f: "src/components/common/ErrorBoundary.jsx", r: "Isolation des exceptions et reprise automatique" }
                  ].map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        background: idx % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)"
                      }}
                    >
                      <td style={{ padding: "10px", fontWeight: 700 }}>{row.p}</td>
                      <td style={{ padding: "10px", color: "var(--text3, #94a3b8)", fontFamily: "monospace" }}>{row.f}</td>
                      <td style={{ padding: "10px", color: "var(--text2, #cbd5e1)" }}>{row.r}</td>
                      <td style={{ padding: "10px", textAlign: "center", color: "#4ade80", fontWeight: 800 }}>✓ CONFORME</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(15, 23, 42, 0.7)"
          }}
        >
          <div style={{ fontSize: 11.5, color: "var(--text3, #94a3b8)" }}>
            Fichier physique généré : <code style={{ color: "var(--gold, #d4af37)" }}>/public/architecture_design_patterns.pdf</code> (8 pages, A4)
          </div>

          <button
            onClick={onClose}
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(255, 255, 255, 0.05)",
              color: "var(--text, #f8fafc)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
