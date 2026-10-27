/**
 * submenuConfig.js
 * Pure functional definitions and helpers for Ayat Submenu mode selector.
 * Provides structured categories, descriptions, keyboard cycling, and badge calculations.
 */

export const SUBMENU_CATEGORIES = [
  { id: "all", label: "Tous", icon: "❖" },
  { id: "recitation", label: "Récitation", icon: "📖" },
  { id: "memorisation", label: "Mémorisation", icon: "🎯" },
  { id: "tools", label: "Notes & Thèmes", icon: "🗂" },
];

export const SUBMENU_MODES = [
  // Récitation & Étude
  {
    id: "lecture",
    category: "recitation",
    label: "Lecture",
    shortLabel: "Lecture",
    icon: "📖",
    description: "Récitation audio, traduction française et mot-à-mot",
  },
  {
    id: "decouverte",
    category: "recitation",
    label: "Découverte",
    shortLabel: "Découverte",
    icon: "👁",
    description: "Analyse des règles de Tajweed, transcription phonétique et racines",
  },
  {
    id: "tajweed",
    category: "recitation",
    label: "Tajweed",
    shortLabel: "Tajweed",
    icon: "☪",
    description: "Exercices pratiques de prononciation et règles audio",
  },

  // Mémorisation & Révision
  {
    id: "progression",
    category: "memorisation",
    label: "Mémoriser",
    shortLabel: "Mémoriser",
    icon: "🎯",
    description: "Workflow guidé étape par étape avec masquage progressif",
  },
  {
    id: "apprentissage",
    category: "memorisation",
    label: "Découpage",
    shortLabel: "Découpage",
    icon: "✂",
    description: "Découpage en parties et mémorisation fractionnée",
  },
  {
    id: "reviser",
    category: "memorisation",
    label: "À Réviser",
    shortLabel: "Réviser",
    icon: "🔖",
    description: "Ciblage et répétition des mots difficiles du verset",
  },
  {
    id: "memoire",
    category: "memorisation",
    label: "Aide-Mémoire",
    shortLabel: "Repères",
    icon: "💡",
    description: "Indices visuels, mots-clés et repères de mémorisation",
  },

  // Outils & Organisation
  {
    id: "collections",
    category: "tools",
    label: "Collections",
    shortLabel: "Collections",
    icon: "🗂",
    description: "Classer ce verset dans des listes thématiques",
  },
  {
    id: "infos",
    category: "tools",
    label: "Infos & Notes",
    shortLabel: "Notes",
    icon: "ℹ",
    description: "Détails de révélation, mérites et notes personnelles",
  },
];

/**
 * Filter modes by selected category.
 *
 * @param {string} categoryId - 'all' | 'recitation' | 'memorisation' | 'tools'
 * @returns {Array} Array of matching modes
 */
export function getFilteredSubmenuModes(categoryId = "all") {
  if (!categoryId || categoryId === "all") {
    return SUBMENU_MODES;
  }
  return SUBMENU_MODES.filter((m) => m.category === categoryId);
}

/**
 * Retrieve metadata for a specific mode by ID.
 *
 * @param {string} modeId
 * @returns {Object} Mode metadata or fallback default
 */
export function getSubmenuModeMeta(modeId) {
  const found = SUBMENU_MODES.find((m) => m.id === modeId);
  return found || SUBMENU_MODES[0];
}

/**
 * Computes dynamic badges and highlight flags for each mode.
 *
 * @param {string} modeId
 * @param {Object} context
 * @param {number} [context.ayatTajweedCount=0]
 * @param {Object} [context.ld={}]
 * @param {Array} [context.ayatInCollections=[]]
 * @returns {Object} { badge: string|null, badgeTitle: string|null, highlight: boolean }
 */
export function computeSubmenuBadge(modeId, { ayatTajweedCount = 0, ld = {}, ayatInCollections = [] } = {}) {
  switch (modeId) {
    case "decouverte":
      return {
        badge: ayatTajweedCount > 0 ? `${ayatTajweedCount}` : null,
        badgeTitle: `${ayatTajweedCount} règle${ayatTajweedCount > 1 ? "s" : ""} de Tajwid sur ce verset`,
        highlight: ayatTajweedCount > 0,
      };
    case "progression":
      return {
        badge: ld?.memorisationState?.stepProgress ? "●" : null,
        badgeTitle: "Mémorisation en cours",
        highlight: Boolean(ld?.memorisationState?.stepProgress),
      };
    case "reviser":
      return {
        badge: ld?.toRevise ? "•" : null,
        badgeTitle: "Verset marqué à réviser",
        highlight: Boolean(ld?.toRevise),
      };
    case "collections":
      return {
        badge: ayatInCollections?.length > 0 ? `${ayatInCollections.length}` : null,
        badgeTitle: `Présent dans ${ayatInCollections?.length || 0} collection(s)`,
        highlight: Boolean(ayatInCollections?.length > 0),
      };
    default:
      return { badge: null, badgeTitle: null, highlight: false };
  }
}

/**
 * Computes the next or previous mode ID for keyboard navigation.
 *
 * @param {string} currentModeId
 * @param {'next'|'prev'} direction
 * @param {Array} modes
 * @returns {string} Next mode ID
 */
export function getCycleSubmenuMode(currentModeId, direction = "next", modes = SUBMENU_MODES) {
  if (!modes || modes.length === 0) return "lecture";
  const currentIndex = modes.findIndex((m) => m.id === currentModeId);
  if (currentIndex === -1) return modes[0].id;

  if (direction === "next") {
    const nextIdx = (currentIndex + 1) % modes.length;
    return modes[nextIdx].id;
  } else {
    const prevIdx = (currentIndex - 1 + modes.length) % modes.length;
    return modes[prevIdx].id;
  }
}
