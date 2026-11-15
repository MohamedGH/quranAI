import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { sel, glossaryActions, errorActions } from "../../store.js";
import {
  GLOSSARY_CATEGORIES,
  TAJWEED_GLOSSARY,
  getGlossaryTerm,
  searchGlossaryTerms,
  getRelatedGlossaryTerms,
  getGlossaryCategoryMeta,
} from "../../utils/tajweedGlossary.js";
import { buildGlossaryRoute, buildQuranRoute } from "../../utils/routeManager.js";
import { ERROR_CODES, createAppError, trySync } from "../../utils/errorManager.js";

/**
 * GlossairePage
 * Dedicated exhaustive glossary page for Tajweed, Makhârij al-Ḥurûf, Ṣifât, and Quranic sciences.
 * Mobile-first responsive split layout with Redux filter persistence, URL deep-linking, and audio synthesis.
 */
export function GlossairePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { termId: routeTermId } = useParams();
  const [searchParams] = useSearchParams();

  const isChild = useSelector(sel.isChildUx);
  const query = useSelector(sel.glossaryQuery);
  const category = useSelector(sel.glossaryCategory);
  const activeTermId = useSelector(sel.glossaryActiveTermId);
  const recentIds = useSelector(sel.glossaryRecentIds);

  const [playingTermKey, setPlayingTermKey] = useState(null);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 960 : true
  );
  const detailDeckRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setIsDesktop(window.innerWidth >= 960);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Sync URL params -> Redux state on deep link (/glossaire/tafkhim?cat=tafkhim)
  useEffect(() => {
    const paramTerm = routeTermId || searchParams.get("term");
    const paramCat = searchParams.get("cat");
    const paramQ = searchParams.get("q");

    if (paramCat && GLOSSARY_CATEGORIES.some((c) => c.id === paramCat)) {
      dispatch(glossaryActions.setCategory(paramCat));
    }
    if (paramQ !== null) {
      dispatch(glossaryActions.setSearchQuery(paramQ));
    }
    if (paramTerm) {
      const found = getGlossaryTerm(paramTerm);
      if (found) {
        dispatch(glossaryActions.setActiveTermId(found.id));
        if (paramCat === null && !paramQ) {
          // Ensure term is visible even if category filter was set elsewhere
          dispatch(glossaryActions.setCategory("all"));
        }
      }
    }
  }, [routeTermId, searchParams, dispatch]);

  const filteredTerms = searchGlossaryTerms(query, category);

  const activeEntry =
    getGlossaryTerm(routeTermId || activeTermId) ||
    filteredTerms[0] ||
    TAJWEED_GLOSSARY[0];

  const relatedTerms = getRelatedGlossaryTerms(activeEntry);
  const recentEntries = (recentIds || [])
    .map((id) => getGlossaryTerm(id))
    .filter(Boolean)
    .slice(0, 6);

  const speakArabic = (text, playKey) => {
    if (!text) return;
    if (playingTermKey === playKey) {
      trySync(() => window?.speechSynthesis?.cancel());
      setPlayingTermKey(null);
      return;
    }
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const res = trySync(() => {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(String(text));
      utt.lang = "ar-SA";
      utt.rate = 0.65;
      setPlayingTermKey(playKey);
      utt.onend = () => setPlayingTermKey(null);
      utt.onerror = () => setPlayingTermKey(null);
      window.speechSynthesis.speak(utt);
    }, null, { text, playKey });

    if (!res.ok) {
      setPlayingTermKey(null);
      dispatch(
        errorActions.reportError(
          createAppError(
            ERROR_CODES.AUDIO_PLAYBACK_ERROR,
            "Impossible de lire l'exemple audio dans le glossaire.",
            { text, playKey }
          )
        )
      );
    }
  };

  const handleSelectTerm = (entry, scrollIntoViewOnMobile = false) => {
    if (!entry) return;
    dispatch(glossaryActions.setActiveTermId(entry.id));
    navigate(buildGlossaryRoute(entry.id, { category: category !== "all" ? category : null }));
    if (scrollIntoViewOnMobile && !isDesktop && detailDeckRef.current?.scrollIntoView) {
      detailDeckRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  return (
    <main
      id="glossaire-page"
      className="main"
      style={{
        background: "var(--bg)",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* En-tête éditorial sobre */}
      <header
        style={{
          padding: isDesktop ? "18px 28px 14px" : "14px 16px 12px",
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                fontFamily: "'Amiri Quran', serif",
                fontSize: 22,
                color: "var(--gold)",
                direction: "rtl",
                textAlign: "left",
                lineHeight: 1.2,
              }}
            >
              مُعْجَمُ مُصْطَلَحَاتِ التَّجْوِيدِ وَالمَخَارِج
            </div>
            <h1
              style={{
                margin: 0,
                fontFamily: "'Cinzel', serif",
                fontSize: isDesktop ? 22 : 17,
                fontWeight: 800,
                color: "var(--text)",
                letterSpacing: 0.4,
                textWrap: "balance",
              }}
            >
              {isChild
                ? "Dictionnaire Magique des Lettres & du Tajweed"
                : "Glossaire Exhaustif du Tajweed & de la Phonétique Arabe"}
            </h1>
            <div style={{ fontSize: 11, color: "var(--text2)", fontVariantNumeric: "tabular-nums" }}>
              <span>{TAJWEED_GLOSSARY.length} définitions techniques</span>
              <span aria-hidden="true"> · </span>
              <span>{GLOSSARY_CATEGORIES.length - 1} domaines clés</span>
              <span aria-hidden="true"> · </span>
              <span>Infobulles interactives actives dans tout le site</span>
            </div>
          </div>

          <button
            type="button"
            id="btn-glossary-go-prononciation"
            onClick={() => navigate(buildQuranRoute({ activePage: "prononciation" }))}
            style={{
              minHeight: 40,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(86, 212, 188, 0.45)",
              background: "rgba(86, 212, 188, 0.12)",
              color: "var(--teal2)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            🔤 Ouvrir Lettres & Anatomie →
          </button>
        </div>

        {/* Barre de recherche & filtres par catégorie (mobile-first) */}
        <div
          style={{
            display: "flex",
            flexDirection: isDesktop ? "row" : "column",
            gap: 10,
            alignItems: isDesktop ? "center" : "stretch",
            marginTop: 4,
          }}
        >
          <div style={{ position: "relative", flex: "1 1 280px", display: "flex", gap: 6 }}>
            <input
              id="glossary-search-input"
              type="search"
              value={query}
              onChange={(e) => dispatch(glossaryActions.setSearchQuery(e.target.value))}
              placeholder="Rechercher un terme (Tafkhîm, Qalqalah, Itbâq, غ, ض...)"
              aria-label="Rechercher un terme dans le glossaire"
              style={{
                flex: 1,
                minHeight: 42,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--border2)",
                background: "var(--surface2)",
                color: "var(--text)",
                fontSize: 13,
                outline: "none",
              }}
            />
            {(query || category !== "all") && (
              <button
                type="button"
                id="btn-glossary-clear-filters"
                onClick={() => dispatch(glossaryActions.clearFilters())}
                style={{
                  minHeight: 42,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border2)",
                  background: "var(--surface3)",
                  color: "var(--text2)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Réinitialiser
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Catégories du glossaire"
            style={{
              display: "flex",
              gap: 4,
              overflowX: "auto",
              padding: 4,
              borderRadius: 8,
              background: "var(--surface3)",
              border: "1px solid var(--border)",
            }}
          >
            {GLOSSARY_CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  id={`btn-glossary-cat-${cat.id}`}
                  onClick={() => dispatch(glossaryActions.setCategory(cat.id))}
                  style={{
                    minHeight: 36,
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: active ? "rgba(255, 183, 3, 0.22)" : "transparent",
                    color: active ? "#ffd166" : "var(--text3)",
                    transition: "background .15s, color .15s",
                  }}
                >
                  {isChild ? cat.childLabel : cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Récemment consultés */}
        {recentEntries.length > 0 && (
          <div
            id="glossary-recent-bar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              fontSize: 10.5,
              color: "var(--text3)",
            }}
          >
            <span>Récemment consultés :</span>
            {recentEntries.map((rec) => (
              <button
                key={rec.id}
                type="button"
                onClick={() => handleSelectTerm(rec, true)}
                style={{
                  minHeight: 30,
                  padding: "4px 9px",
                  borderRadius: 6,
                  border:
                    activeEntry?.id === rec.id
                      ? "1px solid rgba(255, 209, 102, 0.55)"
                      : "1px solid var(--border)",
                  background: "var(--surface2)",
                  color: activeEntry?.id === rec.id ? "#ffd166" : "var(--text2)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {rec.term}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Corps principal : Grille + Fiche détaillée (Split 2 zones sur desktop, empilé sur mobile) */}
      <div
        style={{
          padding: isDesktop ? "20px 28px 36px" : "16px 16px 32px",
          display: "grid",
          gridTemplateColumns: isDesktop ? "minmax(0, 1.35fr) minmax(330px, 0.9fr)" : "1fr",
          gap: 18,
          alignItems: "start",
          maxWidth: 1400,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* Zone 1 : Liste / Grille des termes */}
        <section aria-label="Liste des termes du glossaire" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontVariantNumeric: "tabular-nums" }}>
            {filteredTerms.length} terme{filteredTerms.length > 1 ? "s" : ""} affiché
            {filteredTerms.length > 1 ? "s" : ""}
          </div>

          {filteredTerms.length === 0 ? (
            <div
              id="glossary-empty-state"
              style={{
                padding: 24,
                borderRadius: 12,
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Aucun terme trouvé pour « {query} »
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>
                Essayez un autre mot-clé (ex. Tafkhîm, Qalqalah, Makhraj, Ghunnah) ou réinitialisez les filtres.
              </div>
              <button
                type="button"
                onClick={() => dispatch(glossaryActions.clearFilters())}
                style={{
                  minHeight: 40,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 209, 102, 0.5)",
                  background: "rgba(255, 209, 102, 0.14)",
                  color: "#ffd166",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Tout afficher
              </button>
            </div>
          ) : (
            <div
              id="glossary-terms-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(255px, 1fr))",
                gap: 12,
              }}
            >
              {filteredTerms.map((entry) => {
                const isSelected = activeEntry?.id === entry.id;
                const catMeta = getGlossaryCategoryMeta(entry.category);
                const isPlaying = playingTermKey === `card-${entry.id}`;

                return (
                  <article
                    key={entry.id}
                    className="glossary-term-card"
                    data-term-id={entry.id}
                    onClick={() => handleSelectTerm(entry, true)}
                    style={{
                      background: "var(--surface2)",
                      border: isSelected
                        ? "1.5px solid rgba(255, 209, 102, 0.72)"
                        : "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 14,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      transition: "border-color .15s, transform .15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                      <h2
                        style={{
                          margin: 0,
                          fontFamily: "'Cinzel', serif",
                          fontSize: 14,
                          fontWeight: 700,
                          color: isSelected ? "#ffd166" : "var(--text)",
                        }}
                      >
                        {entry.term}
                      </h2>
                      <span
                        style={{
                          fontFamily: "'Amiri Quran', serif",
                          fontSize: 17,
                          color: "var(--teal2)",
                          direction: "rtl",
                          flexShrink: 0,
                        }}
                      >
                        {entry.arabic}
                      </span>
                    </div>

                    {/* Métadonnée sobre sans pilules */}
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>
                      <span>{isChild ? catMeta.childLabel : catMeta.label}</span>
                      {entry.letters.length > 0 && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span style={{ fontFamily: "'Amiri Quran', serif", fontSize: 12.5, color: "var(--gold2)" }}>
                            {entry.letters.slice(0, 8).join(" ")}
                            {entry.letters.length > 8 ? "…" : ""}
                          </span>
                        </>
                      )}
                    </div>

                    <p style={{ margin: 0, fontSize: 12, color: "var(--text2)", lineHeight: 1.5, flex: 1 }}>
                      {isChild ? entry.childDef : entry.shortDef}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTerm(entry, true);
                        }}
                        style={{
                          flex: 1,
                          minHeight: 38,
                          padding: "6px 10px",
                          borderRadius: 7,
                          border: "1px solid var(--border2)",
                          background: isSelected ? "rgba(255, 209, 102, 0.14)" : "var(--surface3)",
                          color: isSelected ? "#ffd166" : "var(--text)",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isSelected ? "Fiche ouverte" : "Détails →"}
                      </button>

                      {entry.example?.arabic && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            speakArabic(entry.example.arabic, `card-${entry.id}`);
                          }}
                          style={{
                            minHeight: 38,
                            padding: "6px 10px",
                            borderRadius: 7,
                            border: `1px solid ${isPlaying ? "var(--teal)" : "rgba(86, 212, 188, 0.4)"}`,
                            background: isPlaying ? "rgba(86, 212, 188, 0.2)" : "rgba(86, 212, 188, 0.08)",
                            color: "var(--teal2)",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                          aria-label={`Écouter l'exemple de ${entry.term}`}
                        >
                          {isPlaying ? "⏹ Stop" : "🔊 Écouter"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Zone 2 : Fiche d'inspection détaillée du terme sélectionné */}
        {activeEntry && (
          <aside
            ref={detailDeckRef}
            id="glossary-detail-panel"
            aria-label={`Fiche détaillée de ${activeEntry.term}`}
            style={{
              background: "var(--surface)",
              border: "1.5px solid rgba(255, 209, 102, 0.45)",
              borderRadius: 14,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              position: isDesktop ? "sticky" : "static",
              top: isDesktop ? 16 : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: 0.6 }}>
                  {isChild
                    ? getGlossaryCategoryMeta(activeEntry.category).childLabel
                    : getGlossaryCategoryMeta(activeEntry.category).label}
                </div>
                <h2
                  id="glossary-detail-title"
                  style={{
                    margin: "2px 0 0",
                    fontFamily: "'Cinzel', serif",
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#ffd166",
                  }}
                >
                  {activeEntry.term}
                </h2>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                  Translittération : {activeEntry.translit}
                </div>
              </div>

              <div
                style={{
                  fontFamily: "'Amiri Quran', serif",
                  fontSize: 28,
                  color: "var(--teal2)",
                  direction: "rtl",
                  lineHeight: 1.1,
                }}
              >
                {activeEntry.arabic}
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 12,
                fontSize: 13,
                color: "var(--text)",
                lineHeight: 1.65,
              }}
            >
              {isChild ? activeEntry.childDef : activeEntry.fullDef}
            </div>

            {isChild && (
              <div style={{ fontSize: 11.5, color: "var(--text2)", lineHeight: 1.5 }}>
                <strong>Pour aller plus loin :</strong> {activeEntry.shortDef}
              </div>
            )}

            {/* Lettres concernées (cliquables pour écouter) */}
            {activeEntry.letters.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--gold2)", letterSpacing: 0.6 }}>
                  Lettres concernées ({activeEntry.letters.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {activeEntry.letters.map((ltr) => (
                    <button
                      key={ltr}
                      type="button"
                      onClick={() => speakArabic(ltr, `ltr-${activeEntry.id}-${ltr}`)}
                      title={`Écouter la lettre ${ltr}`}
                      style={{
                        minWidth: 40,
                        minHeight: 40,
                        padding: "4px 8px",
                        borderRadius: 8,
                        border: "1px solid var(--border2)",
                        background: "var(--surface2)",
                        color: "var(--text)",
                        fontFamily: "'Amiri Quran', serif",
                        fontSize: 20,
                        cursor: "pointer",
                      }}
                    >
                      {ltr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Exemple coranique / phonétique */}
            {activeEntry.example?.arabic && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--teal2)" }}>
                    Exemple illustré
                  </span>
                  <button
                    type="button"
                    id="btn-glossary-detail-speak"
                    onClick={() => speakArabic(activeEntry.example.arabic, `detail-${activeEntry.id}`)}
                    style={{
                      minHeight: 34,
                      padding: "4px 10px",
                      borderRadius: 7,
                      border: "1px solid rgba(86, 212, 188, 0.45)",
                      background: "rgba(86, 212, 188, 0.14)",
                      color: "var(--teal2)",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {playingTermKey === `detail-${activeEntry.id}` ? "⏹ Stop" : "🔊 Écouter"}
                  </button>
                </div>
                <div
                  style={{
                    fontFamily: "'Amiri Quran', serif",
                    fontSize: 22,
                    color: "#ffd166",
                    direction: "rtl",
                    textAlign: "right",
                    lineHeight: 1.5,
                  }}
                >
                  {activeEntry.example.arabic}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 600 }}>
                  {activeEntry.example.translit}
                </div>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>
                  {activeEntry.example.meaning}
                </div>
              </div>
            )}

            {/* Astuce pratique */}
            {activeEntry.tip && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255, 209, 102, 0.08)",
                  border: "1px solid rgba(255, 209, 102, 0.3)",
                  fontSize: 11.5,
                  color: "var(--text)",
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: "#ffd166" }}>Astuce pratique :</strong> {activeEntry.tip}
              </div>
            )}

            {/* Termes associés */}
            {relatedTerms.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text3)" }}>
                  Termes associés
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {relatedTerms.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => handleSelectTerm(rel, false)}
                      style={{
                        minHeight: 36,
                        padding: "6px 10px",
                        borderRadius: 7,
                        border: "1px solid var(--border2)",
                        background: "var(--surface2)",
                        color: "var(--gold2)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rel.term} →
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
