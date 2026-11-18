// ─── UI Element Visibility Manager ──────────────────────────────────────────
// Pure functional management of modular UI element visibility, presets, and categories.
import { ERROR_CODES, createAppError, trySync } from "./errorManager.js";

export const UI_CATEGORIES = Object.freeze([
  Object.freeze({
    id: "header",
    name: "Barre Supérieure (En-tête)",
    icon: "📌",
    description: "Logo, navigation principale, raccourcis et contrôles d'en-tête",
  }),
  Object.freeze({
    id: "surahHeader",
    name: "En-tête de Sourate",
    icon: "📖",
    description: "Titre de sourate, navigation ‹ ›, métadonnées, maîtrise et Bismillah",
  }),
  Object.freeze({
    id: "ayat",
    name: "Lecture & Versets (Ayats)",
    icon: "📜",
    description: "Numéros, boutons audio par verset, traduction, maîtrise et démarcations",
  }),
  Object.freeze({
    id: "player",
    name: "Lecteur Audio Inférieur",
    icon: "🎧",
    description: "Commandes de lecture audio, boucle, choix du récitateur et options",
  }),
  Object.freeze({
    id: "sidebar",
    name: "Barre Latérale des Sourates",
    icon: "☰",
    description: "Recherche, numéros, noms arabes, métadonnées et jauges de maîtrise",
  }),
  Object.freeze({
    id: "guides",
    name: "Bannières & Aides Pédagogiques",
    icon: "🌟",
    description: "Bannière guide débutant et défi des 28 lettres pour apprentis",
  }),
]);

export const UI_ELEMENTS = Object.freeze([
  // ── HEADER ──
  Object.freeze({
    id: "headerLogo",
    category: "header",
    label: "Logo & Titre Coran",
    desc: "Affiche le logo QUR'ÂN STUDY en haut à gauche",
    icon: "✨",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "headerNav",
    category: "header",
    label: "Onglets de Navigation",
    desc: "Onglets principaux (Coran, Prononciation, Progression, Révision)",
    icon: "🧭",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "headerVoice",
    category: "header",
    label: "Commande Vocale (Micro)",
    desc: "Bouton d'activation vocale 🎤 dans la barre supérieure",
    icon: "🎤",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "headerCompact",
    category: "header",
    label: "Bouton Mode Compact",
    desc: "Bouton de bascule ⊟ pour condenser toute l'interface",
    icon: "⊟",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "headerUxBadge",
    category: "header",
    label: "Badge Profil UX",
    desc: "Indicateur de profil actif (Novice, Enfant, Équilibré, Expert)",
    icon: "🏷️",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "headerToolsBtn",
    category: "header",
    label: "Bouton Outils & Aides",
    desc: "Bouton ⚡ OUTILS donnant accès aux options et claviers",
    icon: "⚡",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "headerAccount",
    category: "header",
    label: "Profil & Compte Utilisateur",
    desc: "Avatar et bouton de compte personnel en haut à droite",
    icon: "👤",
    defaultVisible: true,
  }),

  // ── SURAH HEADER ──
  Object.freeze({
    id: "surahNavigation",
    category: "surahHeader",
    label: "Flèches Sourate Précédente / Suivante",
    desc: "Boutons ‹ et › pour passer d'une sourate à l'autre",
    icon: "↔️",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "surahTitle",
    category: "surahHeader",
    label: "Titre & Nom Arabe de Sourate",
    desc: "Numéro №, nom arabe et nom français dans l'en-tête de lecture",
    icon: "🏷️",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "surahMeta",
    category: "surahHeader",
    label: "Métadonnées de Sourate",
    desc: "Nombre de versets, Mecquoise / Médinoise, Page, Hizb et Juz",
    icon: "📊",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "surahMastery",
    category: "surahHeader",
    label: "Pilule de Maîtrise de Sourate",
    desc: "Pourcentage global de mémorisation de la sourate ou de la division",
    icon: "🎯",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "surahBismillah",
    category: "surahHeader",
    label: "Ligne Calligraphique de la Basmala",
    desc: "Texte sacré بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ en tête de sourate",
    icon: "❖",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "surahActionsBar",
    category: "surahHeader",
    label: "Barre d'Actions de Sourate",
    desc: "Boutons Verset, Tajwid, Traduction, Options de lecture et Filtres",
    icon: "🎛️",
    defaultVisible: true,
  }),

  // ── AYATS / READING ──
  Object.freeze({
    id: "ayatNumber",
    category: "ayat",
    label: "Numéro de Verset (Badge)",
    desc: "Pastille circulaire avec le numéro de verset dans la sourate",
    icon: "🔢",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "ayatPageBadge",
    category: "ayat",
    label: "Badge Page Mushaf (P.xx)",
    desc: "Indicateur de page du Mushaf de Médine sous le numéro de verset",
    icon: "📄",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "ayatPlayBtn",
    category: "ayat",
    label: "Bouton Lecture Audio du Verset",
    desc: "Bouton ▶ / ⏸ individuel pour lancer l'audio depuis ce verset",
    icon: "▶️",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "ayatMastery",
    category: "ayat",
    label: "Colonne de Maîtrise du Verset",
    desc: "Jauge de mémorisation, badge de maîtrise % et coche appris",
    icon: "📈",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "ayatTranslation",
    category: "ayat",
    label: "Traduction du Verset",
    desc: "Bloc de traduction française ou multilingue sous le texte arabe",
    icon: "🌐",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "ayatDividers",
    category: "ayat",
    label: "Démarcations Page, Hizb & Juz",
    desc: "Bannières et lignes séparatrices canoniques (◆ PAGE / ◆ HIZB / ◆ JUZ)",
    icon: "📏",
    defaultVisible: true,
  }),

  // ── AUDIO PLAYER ──
  Object.freeze({
    id: "playerSurahTitle",
    category: "player",
    label: "Informations Sourate & Verset",
    desc: "Titre de sourate et compteur de verset dans le lecteur audio",
    icon: "ℹ️",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "playerControls",
    category: "player",
    label: "Commandes Audio (Play, Précédent, Suivant)",
    desc: "Boutons de contrôle principal de lecture audio",
    icon: "⏯️",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "playerLoop",
    category: "player",
    label: "Bouton Répétition en Boucle",
    desc: "Bouton de répétition ↺ pour la mémorisation audio ciblée",
    icon: "🔁",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "playerTajweedModal",
    category: "player",
    label: "Bouton Options Tajwid & Récitateur",
    desc: "Bouton circulaire 🎨 pour ouvrir les options audio et coach vocal",
    icon: "🎨",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "playerReciter",
    category: "player",
    label: "Bouton Sélecteur de Récitateur",
    desc: "Accès rapide au changement de récitateur dans la barre audio",
    icon: "🎙️",
    defaultVisible: true,
  }),

  // ── SIDEBAR ──
  Object.freeze({
    id: "sidebarSearch",
    category: "sidebar",
    label: "Recherche de Sourates",
    desc: "Champ de saisie pour filtrer les 114 sourates",
    icon: "🔎",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "sidebarSurahNumbers",
    category: "sidebar",
    label: "Numéros de Sourates",
    desc: "Numéros de 1 à 114 (ou étoiles) dans la liste latérale",
    icon: "№",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "sidebarArabicNames",
    category: "sidebar",
    label: "Noms des Sourates en Arabe",
    desc: "Calligraphie arabe de chaque sourate dans la liste",
    icon: "ع",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "sidebarSurahMeta",
    category: "sidebar",
    label: "Métadonnées de Révélation",
    desc: "Mention Mecquoise / Médinoise et décompte de versets",
    icon: "ℹ️",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "sidebarMasteryBars",
    category: "sidebar",
    label: "Barres de Progression de Maîtrise",
    desc: "Jauges vertes/dorées sous chaque sourate dans le menu",
    icon: "📊",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "sidebarArchitectureDoc",
    category: "sidebar",
    label: "Bouton Documentation Technique",
    desc: "Bouton d'accès au dossier d'architecture en bas de la barre latérale",
    icon: "📑",
    defaultVisible: true,
  }),

  // ── GUIDES & BANNERS ──
  Object.freeze({
    id: "beginnerBanner",
    category: "guides",
    label: "Bannière Guide Débutant",
    desc: "Conseils et astuces pas-à-pas sous la barre supérieure",
    icon: "💡",
    defaultVisible: true,
  }),
  Object.freeze({
    id: "childLettersQuest",
    category: "guides",
    label: "Bannière Défi des 28 Lettres (Enfant)",
    desc: "Progression vers les 28 étoiles pour débloquer le Coran",
    icon: "🏰",
    defaultVisible: true,
  }),
]);

/**
 * Pure generator returning the default visibility map (all true).
 */
export const getDefaultUiVisibility = () => {
  const map = {};
  UI_ELEMENTS.forEach((item) => {
    map[item.id] = item.defaultVisible;
  });
  return Object.freeze(map);
};

export const UI_PRESETS = Object.freeze({
  all: Object.freeze({
    id: "all",
    name: "Tout Afficher (Complet)",
    description: "Active l'ensemble des 32 éléments de l'interface sans restriction",
    icon: "👁️",
    config: getDefaultUiVisibility(),
  }),
  zen: Object.freeze({
    id: "zen",
    name: "Mode Zen (Lecture Épurée)",
    description: "Masque les boutons secondaires, jauges et bannières pour une immersion totale",
    icon: "🧘",
    config: Object.freeze({
      headerLogo: true,
      headerNav: true,
      headerVoice: false,
      headerCompact: false,
      headerUxBadge: true,
      headerToolsBtn: true,
      headerAccount: false,
      surahNavigation: true,
      surahTitle: true,
      surahMeta: false,
      surahMastery: false,
      surahBismillah: true,
      surahActionsBar: false,
      ayatNumber: true,
      ayatPageBadge: false,
      ayatPlayBtn: false,
      ayatMastery: false,
      ayatTranslation: true,
      ayatDividers: false,
      playerSurahTitle: true,
      playerControls: true,
      playerLoop: false,
      playerTajweedModal: false,
      playerReciter: false,
      sidebarSearch: true,
      sidebarSurahNumbers: true,
      sidebarArabicNames: true,
      sidebarSurahMeta: false,
      sidebarMasteryBars: false,
      sidebarArchitectureDoc: false,
      beginnerBanner: false,
      childLettersQuest: false,
    }),
  }),
  minimal: Object.freeze({
    id: "minimal",
    name: "Mode Minimaliste",
    description: "Conserve uniquement le texte arabe sacré, la navigation et la traduction",
    icon: "🌿",
    config: Object.freeze({
      headerLogo: false,
      headerNav: true,
      headerVoice: false,
      headerCompact: false,
      headerUxBadge: false,
      headerToolsBtn: true,
      headerAccount: false,
      surahNavigation: true,
      surahTitle: true,
      surahMeta: false,
      surahMastery: false,
      surahBismillah: true,
      surahActionsBar: false,
      ayatNumber: true,
      ayatPageBadge: false,
      ayatPlayBtn: false,
      ayatMastery: false,
      ayatTranslation: true,
      ayatDividers: false,
      playerSurahTitle: false,
      playerControls: true,
      playerLoop: false,
      playerTajweedModal: false,
      playerReciter: false,
      sidebarSearch: true,
      sidebarSurahNumbers: true,
      sidebarArabicNames: true,
      sidebarSurahMeta: false,
      sidebarMasteryBars: false,
      sidebarArchitectureDoc: false,
      beginnerBanner: false,
      childLettersQuest: false,
    }),
  }),
  audioFocus: Object.freeze({
    id: "audioFocus",
    name: "Focus Audio & Récitation",
    description: "Priorise les commandes d'écoute, le récitateur, la répétition et le coach vocal",
    icon: "🎧",
    config: Object.freeze({
      headerLogo: true,
      headerNav: true,
      headerVoice: true,
      headerCompact: true,
      headerUxBadge: true,
      headerToolsBtn: true,
      headerAccount: true,
      surahNavigation: true,
      surahTitle: true,
      surahMeta: true,
      surahMastery: false,
      surahBismillah: true,
      surahActionsBar: true,
      ayatNumber: true,
      ayatPageBadge: true,
      ayatPlayBtn: true,
      ayatMastery: false,
      ayatTranslation: true,
      ayatDividers: true,
      playerSurahTitle: true,
      playerControls: true,
      playerLoop: true,
      playerTajweedModal: true,
      playerReciter: true,
      sidebarSearch: true,
      sidebarSurahNumbers: true,
      sidebarArabicNames: true,
      sidebarSurahMeta: true,
      sidebarMasteryBars: false,
      sidebarArchitectureDoc: false,
      beginnerBanner: false,
      childLettersQuest: false,
    }),
  }),
});

/**
 * Pure predicate checking whether a given element is visible in the visibility map.
 * Defaults to true if the element is not explicitly set to false.
 */
export const isElementVisible = (visibilityMap, elementId) => {
  if (!visibilityMap || typeof visibilityMap !== "object") return true;
  return visibilityMap[elementId] !== false;
};

/**
 * Pure function toggling a single element's visibility.
 */
export const toggleElement = (visibilityMap = {}, elementId) =>
  trySync(
    () => {
      const current = isElementVisible(visibilityMap, elementId);
      return Object.freeze({
        ...visibilityMap,
        [elementId]: !current,
      });
    },
    visibilityMap,
    { code: ERROR_CODES.UI_VISIBILITY_ERROR, elementId }
  ).value;

/**
 * Pure function setting an element's visibility explicitly.
 */
export const setElement = (visibilityMap = {}, elementId, visible = true) =>
  trySync(
    () =>
      Object.freeze({
        ...visibilityMap,
        [elementId]: Boolean(visible),
      }),
    visibilityMap,
    { code: ERROR_CODES.UI_VISIBILITY_ERROR, elementId, visible }
  ).value;

/**
 * Pure function setting all elements in a category to visible or hidden.
 */
export const setCategoryVisibility = (visibilityMap = {}, categoryId, visible = true) =>
  trySync(
    () => {
      const next = { ...visibilityMap };
      UI_ELEMENTS.filter((el) => el.category === categoryId).forEach((el) => {
        next[el.id] = Boolean(visible);
      });
      return Object.freeze(next);
    },
    visibilityMap,
    { code: ERROR_CODES.UI_VISIBILITY_ERROR, categoryId, visible }
  ).value;

/**
 * Pure function setting all elements to visible or hidden.
 * Accepts either (visible) or (visibilityMap, visible).
 */
export const setAllElementsVisibility = (visibleOrMap = true, maybeVisible) => {
  const targetVisible =
    maybeVisible !== undefined ? Boolean(maybeVisible) : Boolean(visibleOrMap);
  const next = {};
  UI_ELEMENTS.forEach((el) => {
    next[el.id] = targetVisible;
  });
  return Object.freeze(next);
};

/**
 * Pure function applying a predefined preset.
 */
export const applyPreset = (presetId = "all") => {
  const preset = UI_PRESETS[presetId];
  if (preset && preset.config) {
    return preset.config;
  }
  return getDefaultUiVisibility();
};

/**
 * Pure calculation of statistics about active visibility.
 */
export const getVisibilityStats = (visibilityMap = {}) => {
  const total = UI_ELEMENTS.length;
  const visible = UI_ELEMENTS.filter((el) => isElementVisible(visibilityMap, el.id)).length;
  const hidden = total - visible;
  const percent = Math.round((visible / total) * 100);
  return Object.freeze({
    total,
    visible,
    hidden,
    percent,
    pct: percent,
  });
};

/**
 * Pure function returning elements for a specific category.
 */
export const getElementsByCategory = (categoryId) =>
  Object.freeze(UI_ELEMENTS.filter((el) => el.category === categoryId));

/**
 * Pure search over UI elements by query string (matches label, desc, category, or id).
 * Accepts either (query) or (elementsList, query).
 */
export const searchUiElements = (queryOrList = "", maybeQuery) => {
  const list = Array.isArray(queryOrList) ? queryOrList : UI_ELEMENTS;
  const rawQuery = Array.isArray(queryOrList) ? maybeQuery : queryOrList;
  const q = String(rawQuery || "").trim().toLowerCase();
  if (!q) return Object.freeze([...list]);
  return Object.freeze(
    list.filter(
      (el) =>
        el.label.toLowerCase().includes(q) ||
        el.desc.toLowerCase().includes(q) ||
        el.category.toLowerCase().includes(q) ||
        el.id.toLowerCase().includes(q)
    )
  );
};

/**
 * Frozen O(1) lookup table mapping elementId -> metadata object.
 */
export const UI_ELEMENTS_BY_ID = Object.freeze(
  UI_ELEMENTS.reduce((acc, el) => {
    acc[el.id] = el;
    return acc;
  }, {})
);

const SHORT_ELEMENT_LABELS = Object.freeze({
  headerLogo: "Logo",
  headerNav: "Navigation",
  headerVoice: "Micro",
  headerCompact: "Compact",
  headerUxBadge: "Profil UX",
  headerToolsBtn: "Outils",
  headerAccount: "Compte",
  surahNavigation: "Nav. Sourate",
  surahTitle: "Titre Sourate",
  surahMeta: "Métadonnées",
  surahMastery: "Maîtrise",
  surahBismillah: "Basmala",
  surahActionsBar: "Barre Actions",
  ayatNumber: "№ Verset",
  ayatPageBadge: "Page P.xx",
  ayatPlayBtn: "Audio Verset",
  ayatMastery: "Maîtrise Verset",
  ayatTranslation: "Traduction",
  ayatDividers: "Démarcations",
  playerSurahTitle: "Infos Lecteur",
  playerControls: "Commandes Audio",
  playerLoop: "Répétition",
  playerTajweedModal: "Options Tajwid",
  playerReciter: "Récitateur",
  sidebarSearch: "Recherche",
  sidebarSurahNumbers: "№ Sourates",
  sidebarArabicNames: "Noms Arabes",
  sidebarSurahMeta: "Méta Sourate",
  sidebarMasteryBars: "Barres Maîtrise",
  sidebarArchitectureDoc: "Doc Technique",
  beginnerBanner: "Guide Débutant",
  childLettersQuest: "Défi 28 Lettres",
});

/**
 * Pure getter for element metadata by ID. Returns null if unknown.
 */
export const getElementMeta = (elementId) => {
  if (!elementId || typeof elementId !== "string") return null;
  return UI_ELEMENTS_BY_ID[elementId] || null;
};

/**
 * Pure getter returning a compact, mobile-friendly label for inline + / - controls.
 */
export const getShortElementLabel = (elementId) => {
  if (!elementId || typeof elementId !== "string") return "";
  if (SHORT_ELEMENT_LABELS[elementId]) return SHORT_ELEMENT_LABELS[elementId];
  const meta = getElementMeta(elementId);
  return meta ? meta.label : elementId;
};

/**
 * Pure state resolver for inline UI editing slots.
 * Guarantees deterministic rendering booleans for normal mode vs direct edit mode.
 */
export const getElementSlotState = (
  visibilityMap,
  elementId,
  uiEditMode = false,
  allowPlaceholder = true
) => {
  const fallback = Object.freeze({
    elementId: String(elementId || ""),
    meta: null,
    shortLabel: String(elementId || ""),
    isVisible: true,
    isEditMode: Boolean(uiEditMode),
    shouldRenderContent: true,
    shouldRenderGhost: false,
    showRemoveControl: Boolean(uiEditMode),
  });

  return trySync(
    () => {
      if (!elementId || typeof elementId !== "string") {
        throw createAppError(
          ERROR_CODES.UI_VISIBILITY_ERROR,
          "Identifiant d'élément UI invalide",
          { elementId }
        );
      }
      const visible = isElementVisible(visibilityMap, elementId);
      const editActive = Boolean(uiEditMode);
      const meta = getElementMeta(elementId);
      const shortLabel = getShortElementLabel(elementId);

      return Object.freeze({
        elementId,
        meta,
        shortLabel,
        isVisible: visible,
        isEditMode: editActive,
        shouldRenderContent: visible,
        shouldRenderGhost: editActive && !visible && Boolean(allowPlaceholder),
        showRemoveControl: editActive && visible,
      });
    },
    fallback,
    { code: ERROR_CODES.UI_VISIBILITY_ERROR, elementId, uiEditMode }
  ).value;
};

