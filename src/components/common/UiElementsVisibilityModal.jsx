import React, { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import {
  UI_CATEGORIES,
  UI_ELEMENTS,
  UI_PRESETS,
  isElementVisible,
  getVisibilityStats,
  searchUiElements,
} from "../../utils/uiVisibilityManager.js";

export function UiElementsVisibilityModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const visibilityMap = useSelector(sel.uiElementsVisibility);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const stats = useMemo(() => getVisibilityStats(visibilityMap), [visibilityMap]);

  const filteredElements = useMemo(() => {
    let list = UI_ELEMENTS;
    if (activeCategory !== "all") {
      list = list.filter((el) => el.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (el) =>
          el.label.toLowerCase().includes(q) ||
          el.desc.toLowerCase().includes(q) ||
          el.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ui-elements-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2700,
        background: "rgba(8, 10, 16, 0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
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
          maxWidth: 680,
          background: "linear-gradient(180deg, #171b28 0%, #10131d 100%)",
          border: "1px solid rgba(201, 168, 76, 0.4)",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(201, 168, 76, 0.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(92dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
          boxSizing: "border-box",
        }}
      >
        {/* ── Modal Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(201, 168, 76, 0.14)",
                border: "1px solid rgba(201, 168, 76, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              🎛️
            </div>
            <div>
              <h2
                id="ui-elements-modal-title"
                style={{
                  margin: 0,
                  fontFamily: "'Cinzel', serif",
                  fontSize: 13.5,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  color: "var(--gold2)",
                }}
              >
                PERSONNALISATION DE L'AFFICHAGE
              </h2>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
                Tous les éléments de l'interface peuvent être activés ou désactivés
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
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text2)",
              fontSize: 14,
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Presets & Stats Summary Bar ── */}
        <div
          style={{
            padding: "10px 18px",
            background: "rgba(201, 168, 76, 0.06)",
            borderBottom: "1px solid rgba(201, 168, 76, 0.15)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 10.5, color: "var(--text2)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>Éléments actifs :</span>
              <strong style={{ color: "var(--teal2)" }}>{stats.visible} / {stats.total}</strong>
              <span style={{ color: "var(--text3)" }}>({stats.percent}%)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                id="btn-ui-set-all-on"
                onClick={() => dispatch(uiActions.setAllUiElementsVisibility(true))}
                style={{
                  padding: "4px 9px",
                  borderRadius: 6,
                  border: "1px solid rgba(62, 184, 160, 0.4)",
                  background: "rgba(62, 184, 160, 0.12)",
                  color: "var(--teal2)",
                  fontSize: 9.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✓ Tout activer
              </button>
              <button
                type="button"
                id="btn-ui-reset-default"
                onClick={() => dispatch(uiActions.resetUiElementsVisibility())}
                style={{
                  padding: "4px 9px",
                  borderRadius: 6,
                  border: "1px solid rgba(201, 168, 76, 0.35)",
                  background: "rgba(201, 168, 76, 0.1)",
                  color: "var(--gold2)",
                  fontSize: 9.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ↺ Défaut
              </button>
            </div>
          </div>

          {/* Quick Presets Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
            <span style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 0.6, flexShrink: 0 }}>PRÉSÉLECTIONS :</span>
            {Object.values(UI_PRESETS).map((p) => (
              <button
                key={p.id}
                type="button"
                id={`btn-ui-preset-${p.id}`}
                onClick={() => dispatch(uiActions.applyUiVisibilityPreset(p.id))}
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "var(--text)",
                  fontSize: 9.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all .15s",
                }}
                title={p.description}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Search & Category Filter ── */}
        <div
          style={{
            padding: "8px 18px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 10, fontSize: 12, color: "var(--text3)" }}>🔎</span>
            <input
              type="text"
              id="input-search-ui-elements"
              placeholder="Rechercher un élément (logo, basmala, boutons, numéros, etc.)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 30px 7px 30px",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "var(--surface2)",
                color: "var(--text)",
                fontSize: 11,
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 10,
                  background: "none",
                  border: "none",
                  color: "var(--text3)",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div style={{ display: "flex", gap: 5, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
            <button
              type="button"
              id="filter-category-all"
              onClick={() => setActiveCategory("all")}
              style={{
                padding: "4px 9px",
                borderRadius: 7,
                border: activeCategory === "all" ? "1px solid var(--gold)" : "1px solid rgba(255, 255, 255, 0.08)",
                background: activeCategory === "all" ? "rgba(201, 168, 76, 0.18)" : "transparent",
                color: activeCategory === "all" ? "var(--gold2)" : "var(--text3)",
                fontSize: 9.5,
                fontWeight: activeCategory === "all" ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Tous ({UI_ELEMENTS.length})
            </button>
            {UI_CATEGORIES.map((cat) => {
              const count = UI_ELEMENTS.filter((e) => e.category === cat.id).length;
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  id={`filter-category-${cat.id}`}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: "4px 9px",
                    borderRadius: 7,
                    border: isSelected ? "1px solid var(--teal)" : "1px solid rgba(255, 255, 255, 0.08)",
                    background: isSelected ? "rgba(62, 184, 160, 0.18)" : "transparent",
                    color: isSelected ? "var(--teal2)" : "var(--text3)",
                    fontSize: 9.5,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {cat.icon} {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Elements List ── */}
        <div
          id="ui-elements-scroll-list"
          style={{
            padding: "12px 18px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {filteredElements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 12px", color: "var(--text3)", fontSize: 11 }}>
              Aucun élément ne correspond à votre recherche.
            </div>
          ) : (
            filteredElements.map((el) => {
              const isVisible = isElementVisible(visibilityMap, el.id);
              const catObj = UI_CATEGORIES.find((c) => c.id === el.category);
              return (
                <div
                  key={el.id}
                  id={`ui-element-row-${el.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: isVisible ? "var(--surface2)" : "rgba(255, 255, 255, 0.015)",
                    border: `1px solid ${isVisible ? "rgba(201, 168, 76, 0.25)" : "rgba(255, 255, 255, 0.05)"}`,
                    opacity: isVisible ? 1 : 0.65,
                    transition: "all .18s ease",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: isVisible ? "rgba(201, 168, 76, 0.14)" : "rgba(255, 255, 255, 0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      {el.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: isVisible ? "var(--text)" : "var(--text2)" }}>
                          {el.label}
                        </span>
                        {catObj && (
                          <span
                            style={{
                              fontSize: 8,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "rgba(255, 255, 255, 0.05)",
                              color: "var(--text3)",
                            }}
                          >
                            {catObj.name.split(" ")[0]}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 9.5, color: "var(--text3)", marginTop: 2, lineHeight: 1.35 }}>
                        {el.desc}
                      </div>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <button
                    type="button"
                    id={`toggle-ui-element-${el.id}`}
                    role="switch"
                    aria-checked={isVisible}
                    aria-label={`Activer ou masquer ${el.label}`}
                    onClick={() => dispatch(uiActions.toggleUiElementVisibility(el.id))}
                    style={{
                      width: 42,
                      height: 24,
                      borderRadius: 12,
                      border: "none",
                      padding: 0,
                      background: isVisible ? "var(--gold)" : "rgba(255, 255, 255, 0.14)",
                      position: "relative",
                      cursor: "pointer",
                      transition: "background .2s",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 3,
                        left: isVisible ? 21 : 3,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                        transition: "left .2s",
                      }}
                    />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ fontSize: 10.5, color: "var(--text3)" }}>
            Paramètres persistés localement
          </div>
          <button
            type="button"
            id="btn-close-ui-elements-modal"
            onClick={onClose}
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              background: "var(--gold)",
              border: "1px solid var(--gold2)",
              color: "#10131d",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Cinzel', serif",
              cursor: "pointer",
              letterSpacing: 0.6,
            }}
          >
            Valider & Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
