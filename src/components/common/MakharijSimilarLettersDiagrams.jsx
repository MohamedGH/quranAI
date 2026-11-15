import React, { useId } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import { getRelatedArticulationLetters } from "../../utils/makharijData.js";

/**
 * SingleVocalTractCardSvg
 * Renders a self-contained anatomical SVG diagram tailored for one individual letter,
 * displaying its own tongue posture (Tarqîq / Tafkhîm / Itbâq), exact Makhraj hotspot,
 * and optional dashed shift indicator relative to the primary reference letter.
 */
function SingleVocalTractCardSvg({
  letter,
  zone,
  posture,
  referenceZone = null,
  isReference = false,
  relationType = "same",
}) {
  const uid = useId().replace(/:/g, "");
  const tongueGradId = `tg_${uid}`;
  const glowId = `gl_${uid}`;
  const pulseId = `pl_${uid}`;
  const isTafkhim = Boolean(posture?.isTafkhim);
  const isItbaq = Boolean(posture?.isItbaq);

  const showShiftVector =
    !isReference &&
    relationType === "nearby" &&
    referenceZone &&
    zone &&
    referenceZone.id !== zone.id;

  return (
    <svg
      viewBox="0 0 420 370"
      className="mini-makhraj-svg"
      data-letter={letter}
      data-relation={isReference ? "reference" : relationType}
      data-tafkhim={isTafkhim ? "true" : "false"}
      data-itbaq={isItbaq ? "true" : "false"}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        borderRadius: 10,
        background: isTafkhim
          ? "radial-gradient(ellipse at 45% 45%, #241d12 0%, #0d0f17 100%)"
          : "radial-gradient(ellipse at 45% 45%, #161b29 0%, #0c0f17 100%)",
        border: isReference
          ? "1.5px solid rgba(255, 209, 102, 0.7)"
          : isTafkhim
          ? "1px solid rgba(255, 183, 3, 0.4)"
          : "1px solid rgba(86, 212, 188, 0.3)",
      }}
      role="img"
      aria-label={`Schéma anatomique de la lettre ${letter}`}
    >
      <defs>
        <linearGradient id={tongueGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          {isTafkhim ? (
            <>
              <stop offset="0%" stopColor="#ffd166" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#b45309" stopOpacity="0.98" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#e06d75" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#b83b4b" stopOpacity="0.95" />
            </>
          )}
        </linearGradient>
        <radialGradient id={pulseId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={isTafkhim ? "#ffb703" : "#56d4bc"} stopOpacity="0.85" />
          <stop offset="65%" stopColor={isTafkhim ? "#ffb703" : "#56d4bc"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isTafkhim ? "#ffb703" : "#56d4bc"} stopOpacity="0" />
        </radialGradient>
        <filter id={glowId}>
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Contour anatomique simplifié à haute lisibilité */}
      <path
        d="M 120 360 C 100 320 90 260 90 190 C 90 90 160 30 260 30 C 330 30 380 70 385 120 C 388 150 370 170 372 195 C 374 208 395 212 395 220 C 395 228 375 235 372 242 C 370 252 388 262 382 278 C 375 295 345 305 330 312 C 290 330 250 345 220 360 Z"
        fill="rgba(30, 41, 59, 0.32)"
        stroke="rgba(255, 255, 255, 0.16)"
        strokeWidth="1.5"
        strokeDasharray="4 2"
      />

      {/* Cavité nasale (Al-Khayshûm) */}
      <path
        d="M 230 140 C 230 100 270 85 330 95 C 360 100 365 140 335 150 C 290 155 240 155 230 140 Z"
        fill={zone?.area === "khayshum" || letter === "ن" || letter === "م" ? "rgba(56, 189, 248, 0.22)" : "rgba(56, 189, 248, 0.06)"}
        stroke={zone?.area === "khayshum" || letter === "ن" || letter === "م" ? "#38bdf8" : "rgba(56, 189, 248, 0.28)"}
        strokeWidth={zone?.area === "khayshum" ? "2" : "1"}
      />

      {/* Palais dur / mou + luette */}
      <path
        d="M 220 185 C 250 170 290 168 332 178 C 336 179 336 186 332 188 C 290 178 250 180 220 195 Z"
        fill="rgba(148, 163, 184, 0.52)"
        stroke={isTafkhim ? "#fbbf24" : "rgba(255,255,255,0.28)"}
        strokeWidth="1.2"
      />
      <path
        d="M 220 185 C 195 190 182 205 180 222 C 178 228 184 230 186 225 C 190 210 200 198 220 195 Z"
        fill="#cbd5e1"
      />

      {/* Incisives supérieures & inférieures */}
      <rect x="333" y="180" width="8" height="15" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
      <rect x="330" y="235" width="8" height="15" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />

      {/* Lèvres */}
      <path
        d="M 342 195 C 360 195 372 205 368 215 C 362 216 350 212 342 206 Z"
        fill="#e06d75"
        stroke={zone?.area === "shafatayn" ? "#a855f7" : "rgba(224, 109, 117, 0.5)"}
        strokeWidth={zone?.area === "shafatayn" ? "2.4" : "1"}
      />
      <path
        d="M 340 236 C 352 232 366 232 368 242 C 365 252 350 255 338 250 Z"
        fill="#e06d75"
        stroke={zone?.area === "shafatayn" ? "#a855f7" : "rgba(224, 109, 117, 0.5)"}
        strokeWidth={zone?.area === "shafatayn" ? "2.4" : "1"}
      />

      {/* Pharynx / Gorge */}
      <path
        d="M 160 210 C 155 240 152 280 155 330"
        fill="none"
        stroke={zone?.area === "halq" ? "#ff7eb3" : isTafkhim ? "#fbbf24" : "rgba(255, 126, 179, 0.45)"}
        strokeWidth={zone?.area === "halq" ? "3.5" : "2.5"}
        strokeLinecap="round"
      />
      <ellipse cx="170" cy="315" rx="9" ry="5.5" fill="rgba(255, 126, 179, 0.25)" stroke="#ff7eb3" strokeWidth="1.2" />

      {/* Silhouette fantôme de langue plate si Tafkhîm */}
      {isTafkhim && posture?.ghostThinPath && (
        <path
          d={posture.ghostThinPath}
          fill="rgba(86, 212, 188, 0.06)"
          stroke="#56d4bc"
          strokeWidth="1.3"
          strokeDasharray="4 3"
          opacity="0.7"
        />
      )}

      {/* Langue active de cette lettre */}
      <path
        d={posture?.tonguePath}
        fill={`url(#${tongueGradId})`}
        stroke={isTafkhim ? "#ffb703" : "#f43f5e"}
        strokeWidth="2.2"
        filter={`url(#${glowId})`}
      />

      {/* Indicateurs visuels spécifiques Tafkhîm / Itbâq */}
      {isTafkhim && (
        <g>
          <path
            d="M 204 222 L 204 190 M 199 197 L 204 190 L 209 197"
            stroke="#fff3cd"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <text
            x="176"
            y="64"
            fill="#ffe082"
            fontSize="11"
            fontWeight="800"
            fontFamily="'Cinzel', serif"
            textAnchor="middle"
          >
            {isItbaq ? "TAFKHÎM + ITBÂQ" : "TAFKHÎM"}
          </text>
          {isItbaq && (
            <path
              d="M 244 203 Q 260 194 276 203"
              fill="none"
              stroke="#ffd166"
              strokeWidth="1.8"
              strokeDasharray="2 2"
            />
          )}
        </g>
      )}

      {!isTafkhim && (
        <text
          x="176"
          y="64"
          fill="#56d4bc"
          fontSize="11"
          fontWeight="700"
          fontFamily="'Cinzel', serif"
          textAnchor="middle"
        >
          TARQÎQ (FINE)
        </text>
      )}

      {/* Repère fantôme + vecteur de décalage depuis la lettre de référence (pour points proches) */}
      {showShiftVector && (
        <g>
          <circle
            cx={referenceZone.cx}
            cy={referenceZone.cy}
            r="6"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
          <line
            x1={referenceZone.cx}
            y1={referenceZone.cy}
            x2={zone.cx}
            y2={zone.cy}
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
        </g>
      )}

      {/* Point chaud exact du Makhraj de cette lettre */}
      {zone && (
        <g>
          <circle cx={zone.cx} cy={zone.cy} r={zone.r + 10} fill={`url(#${pulseId})`} />
          <circle
            cx={zone.cx}
            cy={zone.cy}
            r="10"
            fill={isTafkhim ? "#ffb703" : "#56d4bc"}
            stroke="#ffffff"
            strokeWidth="2.5"
          />
          {/* Badge de la lettre dans le schéma */}
          <rect
            x="312"
            y="38"
            width="64"
            height="42"
            rx="10"
            fill="rgba(11, 15, 25, 0.9)"
            stroke={isTafkhim ? "#ffb703" : "#56d4bc"}
            strokeWidth="1.5"
          />
          <text
            x="344"
            y="67"
            textAnchor="middle"
            fill={isTafkhim ? "#ffd166" : "#56d4bc"}
            fontSize="26"
            fontWeight="700"
            fontFamily="'Amiri Quran', serif"
          >
            {letter}
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * MakharijSimilarLettersDiagrams
 * Displays one dedicated anatomical SVG diagram per letter for the active letter,
 * all letters sharing the exact same Makhraj, and adjacent/nearby Makhraj letters.
 */
export function MakharijSimilarLettersDiagrams({
  activeLetter,
  isChild = false,
  onSpeak = () => {},
  onSelectLetter = () => {},
  playingId = null,
}) {
  const dispatch = useDispatch();
  const filterMode = useSelector(sel.similarLettersFilter);

  const related = getRelatedArticulationLetters(activeLetter, { maxNearby: 6, isChild });

  const filteredComparisons = related.items.filter((item) => {
    if (filterMode === "same") return item.relationType === "same";
    if (filterMode === "nearby") return item.relationType === "nearby";
    return true;
  });

  const referenceCard = {
    letter: related.targetLetter,
    name: related.targetDetail.name,
    trans: related.targetDetail.trans,
    relationType: "reference",
    relationLabel: isChild ? "Lettre étudiée" : "Référence sélectionnée",
    zone: related.targetZone,
    posture: related.targetPosture,
    anatomy: related.targetDetail,
    diffNote: isChild
      ? `Voici comment ta bouche se place pour ${related.targetDetail.name}. Compare avec chaque schéma voisin !`
      : `Point de référence : ${related.targetDetail.makhrajLabel}. Comparez sa posture avec chaque schéma ci-dessous.`,
  };

  const cardsToRender = [referenceCard, ...filteredComparisons];

  return (
    <section
      id="similar-letters-diagrams-section"
      aria-label="Comparaison multi-schémas des lettres au makhraj identique ou proche"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        paddingTop: 12,
        borderTop: "1px solid var(--border)",
      }}
    >
      {/* En-tête & contrôles de filtre */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h3
            style={{
              fontSize: 11.5,
              fontFamily: "'Cinzel', serif",
              fontWeight: 700,
              color: "var(--gold2)",
              letterSpacing: 1,
              margin: 0,
            }}
          >
            {isChild
              ? "🔀 SCHÉMAS COMPARATIFS : LETTRES JUMELLES ET VOISINES"
              : "🔀 COMPARAISON MULTI-SCHÉMAS · MÊME MAKHRAJ & POINTS PROCHES"}
          </h3>
          <div style={{ fontSize: 10, color: "var(--text2)" }}>
            <span>Un schéma individuel par lettre</span>
            <span aria-hidden="true"> · </span>
            <span>{related.sameZone.length} au même point</span>
            <span aria-hidden="true"> · </span>
            <span>{related.nearbyZones.length} en zone proche</span>
          </div>
        </div>

        {/* Boutons filtres (single-line) */}
        <div
          role="group"
          aria-label="Filtrer les schémas par proximité"
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            gap: 4,
            padding: 3,
            borderRadius: 8,
            background: "var(--surface3)",
            border: "1px solid var(--border)",
          }}
        >
          {[
            { id: "all", label: `Tout (${related.items.length})` },
            { id: "same", label: `Même point (${related.sameZone.length})` },
            { id: "nearby", label: `Points proches (${related.nearbyZones.length})` },
          ].map((btn) => {
            const active = filterMode === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                id={`btn-similar-filter-${btn.id}`}
                aria-pressed={active}
                onClick={() => dispatch(uiActions.setSimilarLettersFilter(btn.id))}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  minHeight: 32,
                  fontSize: 9.5,
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 700,
                  background: active ? "rgba(255, 183, 3, 0.22)" : "transparent",
                  color: active ? "#ffd166" : "var(--text3)",
                  transition: "all .15s",
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Note si aucune lettre au même point exact */}
      {filterMode === "same" && related.sameZone.length === 0 && (
        <div
          id="no-exact-same-makhraj-note"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            fontSize: 10.5,
            color: "var(--text2)",
          }}
        >
          {related.targetDetail.letter} possède un point d&apos;articulation unique ({related.targetDetail.makhrajLabel}). Basculez sur{" "}
          <strong>Points proches</strong> pour comparer les lettres voisines.
        </div>
      )}

      {/* Grille multi-schémas responsive (Mobile-first : 1 colonne puis 2-3 colonnes) */}
      <div
        id="similar-letters-diagrams-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 12,
        }}
      >
        {cardsToRender.map((item) => {
          const isRef = item.relationType === "reference";
          const isPlaying = playingId === `sim-${item.letter}`;
          const isTafkhim = Boolean(item.posture?.isTafkhim);

          return (
            <article
              key={`${item.relationType}-${item.letter}`}
              className="similar-letter-diagram-card"
              data-letter={item.letter}
              data-relation={item.relationType}
              style={{
                background: "var(--surface2)",
                border: isRef
                  ? "1.5px solid rgba(255, 209, 102, 0.65)"
                  : "1px solid var(--border)",
                borderRadius: 12,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* En-tête éditorial sobre (sans pilules statiques) */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: "'Amiri Quran', serif",
                      fontSize: 26,
                      fontWeight: 700,
                      color: isTafkhim ? "#ffd166" : "var(--teal2)",
                      lineHeight: 1,
                    }}
                  >
                    {item.letter}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", fontFamily: "'Cinzel', serif" }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text3)" }}>/{item.trans}/</span>
                </div>

                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: isRef ? "#ffd166" : item.relationType === "same" ? "var(--teal2)" : "#38bdf8",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.relationLabel}
                </span>
              </div>

              {/* Métadonnée textuelle sobre */}
              <div style={{ fontSize: 9.5, color: "var(--text2)", lineHeight: 1.35 }}>
                <span>{isTafkhim ? (item.posture?.isItbaq ? "Tafkhîm + Itbâq (Grave)" : "Tafkhîm (Grave)") : "Tarqîq (Fine)"}</span>
                <span aria-hidden="true"> · </span>
                <span>{item.zone?.label || item.anatomy?.makhrajLabel}</span>
              </div>

              {/* Schéma SVG individuel dédié à cette lettre */}
              <SingleVocalTractCardSvg
                letter={item.letter}
                zone={item.zone}
                posture={item.posture}
                referenceZone={related.targetZone}
                isReference={isRef}
                relationType={item.relationType}
              />

              {/* Explication comparative */}
              <div style={{ fontSize: 9.5, color: "var(--text2)", lineHeight: 1.45, flex: 1 }}>
                {item.diffNote}
              </div>

              {/* Actions fonctionnelles (taille tactile mobile >= 40px) */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => onSpeak(item.letter, `sim-${item.letter}`)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid ${isPlaying ? "var(--teal)" : "var(--border2)"}`,
                    background: isPlaying ? "rgba(86, 212, 188, 0.16)" : "var(--surface3)",
                    color: isPlaying ? "var(--teal2)" : "var(--text)",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isPlaying ? "⏹ Stop" : "🔊 Écouter"}
                </button>

                {!isRef && (
                  <button
                    type="button"
                    onClick={() => onSelectLetter(item.letter)}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255, 183, 3, 0.4)",
                      background: "rgba(255, 183, 3, 0.1)",
                      color: "#ffd166",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Voir fiche →
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
