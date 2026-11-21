import React, { useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import { getVisibilityStats } from "../../utils/uiVisibilityManager.js";

/**
 * Floating thumb-zone toolbar rendered only when `uiEditMode` is active.
 * Gives users live active count, instant presets, modal list access, and Escape / Terminer exit.
 */
export function UiEditToolbar() {
  const dispatch = useDispatch();
  const uiEditMode = useSelector(sel.uiEditMode);
  const visibilityMap = useSelector(sel.uiElementsVisibility);

  const stats = useMemo(
    () => getVisibilityStats(visibilityMap),
    [visibilityMap]
  );

  useEffect(() => {
    if (!uiEditMode) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        dispatch(uiActions.setUiEditMode(false));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [uiEditMode, dispatch]);

  if (!uiEditMode) {
    return null;
  }

  return (
    <div
      id="ui-edit-floating-toolbar"
      data-testid="ui-edit-toolbar"
      role="region"
      aria-label="Barre d'édition directe de l'interface"
      className="ui-edit-toolbar"
    >
      <div className="ui-edit-toolbar-info">
        <span className="ui-edit-toolbar-title">✏️ ÉDITION UI</span>
        <span className="ui-edit-toolbar-count" data-testid="ui-edit-active-count">
          {stats.visible}/{stats.total} actifs
        </span>
      </div>

      <div className="ui-edit-toolbar-actions">
        <button
          type="button"
          id="btn-ui-edit-preset-zen"
          className="ui-edit-tb-btn"
          onClick={() => dispatch(uiActions.applyUiVisibilityPreset("zen"))}
          title="Appliquer le mode Zen"
        >
          🧘 Zen
        </button>
        <button
          type="button"
          id="btn-ui-edit-preset-minimal"
          className="ui-edit-tb-btn"
          onClick={() => dispatch(uiActions.applyUiVisibilityPreset("minimal"))}
          title="Appliquer le mode Minimaliste"
        >
          🌿 Minimal
        </button>
        <button
          type="button"
          id="btn-ui-edit-show-all"
          className="ui-edit-tb-btn is-teal"
          onClick={() => dispatch(uiActions.setAllUiElementsVisibility(true))}
          title="Réafficher tous les éléments"
        >
          + Tout ({stats.total})
        </button>
        <button
          type="button"
          id="btn-ui-edit-open-modal"
          className="ui-edit-tb-btn"
          onClick={() => dispatch(uiActions.setShowUiVisibilityModal(true))}
          title={`Ouvrir la liste complète des ${stats.total} éléments`}
        >
          🎛️ Liste
        </button>
        <button
          type="button"
          id="btn-ui-edit-done"
          className="ui-edit-tb-done"
          onClick={() => dispatch(uiActions.setUiEditMode(false))}
          aria-label="Terminer l'édition de l'interface"
        >
          ✓ Terminer
        </button>
      </div>
    </div>
  );
}
