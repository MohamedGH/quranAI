import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import { getElementSlotState } from "../../utils/uiVisibilityManager.js";

/**
 * EditableUiSlot
 * Modular wrapper enabling direct inline add (+) and remove (−) UI customization.
 *
 * CRITICAL ZERO-REGRESSION GUARANTEE:
 * When `uiEditMode` is false, this component returns `children` directly (or `null`
 * if hidden) with ZERO wrapper DOM elements, preserving all existing layouts and CSS selectors.
 */
export function EditableUiSlot({
  elementId,
  condition = true,
  inline = true,
  showPlaceholder = true,
  showRemove = true,
  className = "",
  style = undefined,
  children,
}) {
  const dispatch = useDispatch();
  const visibilityMap = useSelector(sel.uiElementsVisibility);
  const uiEditMode = useSelector(sel.uiEditMode);

  if (!condition) {
    return null;
  }

  const slot = getElementSlotState(
    visibilityMap,
    elementId,
    uiEditMode,
    showPlaceholder
  );

  // Standard viewing mode: zero wrapper overhead
  if (!slot.isEditMode) {
    return slot.shouldRenderContent ? <>{children}</> : null;
  }

  const labelText = slot.meta?.label || slot.shortLabel;

  const handleHide = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(uiActions.setUiElementVisibility({ id: elementId, visible: false }));
  };

  const handleShow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(uiActions.setUiElementVisibility({ id: elementId, visible: true }));
  };

  // Hidden element in Edit Mode -> render lightweight "+ Ajouter" ghost trigger
  if (slot.shouldRenderGhost) {
    return (
      <button
        type="button"
        className={`ui-edit-add-ghost ${inline ? "is-inline" : "is-block"}${className ? ` ${className}` : ""}`}
        data-testid={`ui-edit-add-${elementId}`}
        data-element-id={elementId}
        aria-label={`Afficher ${labelText}`}
        title={`Ajouter dans l'interface : ${labelText}`}
        onClick={handleShow}
        style={style}
      >
        <span className="ui-edit-add-plus" aria-hidden="true">+</span>
        <span className="ui-edit-add-label">{slot.shortLabel}</span>
      </button>
    );
  }

  if (!slot.shouldRenderContent) {
    return null;
  }

  const ContainerTag = inline ? "span" : "div";

  return (
    <ContainerTag
      className={`ui-edit-slot ${inline ? "is-inline" : "is-block"}${className ? ` ${className}` : ""}`}
      data-testid={`ui-edit-slot-${elementId}`}
      data-element-id={elementId}
      style={style}
    >
      {children}
      {slot.showRemoveControl && showRemove && (
        <button
          type="button"
          className="ui-edit-remove-btn"
          data-testid={`ui-edit-remove-${elementId}`}
          aria-label={`Masquer ${labelText}`}
          title={`Enlever de l'interface : ${labelText}`}
          onClick={handleHide}
        >
          −
        </button>
      )}
    </ContainerTag>
  );
}
