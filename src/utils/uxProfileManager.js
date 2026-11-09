// ─── Pure Functional UX Profile Manager ───────────────────────────────────────
import { ERROR_CODES, createAppError, trySync } from "./errorManager.js";

export const UX_MODES = Object.freeze({
  BEGINNER: "beginner",
  STANDARD: "standard",
  EXPERT: "expert",
  CHILD: "child",
});

export const UX_PROFILES = Object.freeze({
  [UX_MODES.BEGINNER]: Object.freeze({
    id: UX_MODES.BEGINNER,
    name: "Novice / Débutant",
    shortLabel: "Novice",
    badge: "Novice",
    icon: "🌱",
    targetAudience: "Débutants, personnes souhaitant une interface chaleureuse, épurée et sans surcharge de boutons",
    description: "Interface chaleureuse aux teintes ambrées douces avec très grands caractères, 4 onglets essentiels et seulement les boutons indispensables.",
    featureFlags: Object.freeze({
      simplifiedAudioPlayer: true,
      simplifiedSurahHeader: true,
      showBeginnerTooltips: true,
      hideAdvancedMetrics: true,
    }),
    features: Object.freeze([
      "Palette ambrée et chaleureuse, très douce pour les yeux",
      "Texte arabe agrandi (32px) et traduction française mise en valeur",
      "Interface épurée avec seulement 4 onglets et commandes essentielles",
      "Boutons grand format explicites sans boutons superflus",
      "Bannière d'aide et conseils contextuels pas-à-pas"
    ]),
    defaultSettings: Object.freeze({
      ayatFontSize: 32,
      showParts: true,
      enableAnimations: false, // moins de distractions
      enableTimestamps: true,
      enableLetterByLetter: true,
      showBeginnerGuides: true,
      announceNum: false,
      spellCheck: true,
      fullScreenSelectedAyat: true,
    }),
  }),

  [UX_MODES.STANDARD]: Object.freeze({
    id: UX_MODES.STANDARD,
    name: "Standard / Équilibré",
    shortLabel: "Standard",
    badge: "Équilibré",
    icon: "⚖️",
    targetAudience: "Pratique quotidienne pour la majorité des lecteurs et étudiants du Coran",
    description: "L'expérience complète et équilibrée avec lecture, audio synchronisé, quiz, règles de Tajweed et suivi de révision.",
    featureFlags: Object.freeze({
      simplifiedAudioPlayer: false,
      simplifiedSurahHeader: false,
      showBeginnerTooltips: false,
      hideAdvancedMetrics: false,
    }),
    features: Object.freeze([
      "Équilibre optimal entre lisibilité et richesse d'outils",
      "Accès aux modes Coran, Quiz, Prononciation, Concordance et Révision",
      "Coloration Tajweed paramétrable et répétition audio en boucle",
      "Suivi de progression et mémorisation par sourate"
    ]),
    defaultSettings: Object.freeze({
      ayatFontSize: 26,
      showParts: true,
      enableAnimations: true,
      enableTimestamps: true,
      enableLetterByLetter: true,
      showBeginnerGuides: false,
      announceNum: false,
      spellCheck: true,
      fullScreenSelectedAyat: false,
    }),
  }),

  [UX_MODES.EXPERT]: Object.freeze({
    id: UX_MODES.EXPERT,
    name: "Avancé / Hafiz & Pro",
    shortLabel: "Expert",
    badge: "Avancé",
    icon: "⚡",
    targetAudience: "Mémorisateurs (Hafiz), imams, étudiants avancés et utilisateurs technophiles",
    description: "Outils de précision : synchronisation mot à mot, réglages fins des silences, raccourcis clavier pro et métadonnées complètes.",
    featureFlags: Object.freeze({
      simplifiedAudioPlayer: false,
      simplifiedSurahHeader: false,
      showBeginnerTooltips: false,
      hideAdvancedMetrics: false,
    }),
    features: Object.freeze([
      "Raccourcis clavier (Espace, 1-4 pour quiz, R pour indice, T pour verset complet)",
      "Gestion au millième de seconde des pauses et silences de révision",
      "Affichage complet des métadonnées (Hizb, Juz, Ruku, Manzil)",
      "Recherche par concordance avancée et analyse mot-à-mot détaillée",
      "Exportation des statistiques d'apprentissage"
    ]),
    defaultSettings: Object.freeze({
      ayatFontSize: 24,
      showParts: true,
      enableAnimations: true,
      enableTimestamps: true,
      enableLetterByLetter: true,
      enableHeavyCompute: true,
      showBeginnerGuides: false,
      announceNum: true,
      spellCheck: true,
      fullScreenSelectedAyat: false,
    }),
  }),

  [UX_MODES.CHILD]: Object.freeze({
    id: UX_MODES.CHILD,
    name: "Enfant / Apprenti",
    shortLabel: "Enfant",
    badge: "Apprenti",
    icon: "🌟",
    targetAudience: "Enfants et jeunes apprenants découvrant le Coran",
    description: "Affichage chaleureux et stimulant avec textes très grands, encouragements visuels et mode quiz motivant.",
    featureFlags: Object.freeze({
      simplifiedAudioPlayer: true,
      simplifiedSurahHeader: true,
      showBeginnerTooltips: true,
      hideAdvancedMetrics: true,
    }),
    features: Object.freeze([
      "Très grands caractères arabes (34px) aérés",
      "Surlignage dynamique lettre par lettre captivant",
      "Quiz avec félicitations sonores et visuelles valorisantes",
      "Parcours guidé adapté au rythme des plus jeunes"
    ]),
    defaultSettings: Object.freeze({
      ayatFontSize: 34,
      showParts: true,
      enableAnimations: true,
      enableTimestamps: true,
      enableLetterByLetter: true,
      showBeginnerGuides: true,
      announceNum: false,
      spellCheck: true,
      fullScreenSelectedAyat: true,
    }),
  }),
});

/**
 * Pure predicate checking whether a mode is valid.
 */
export const isValidUxMode = (mode) =>
  typeof mode === "string" && Object.values(UX_MODES).includes(mode);

/**
 * Pure helper sanitizing any input mode into a valid UX mode (fallback to STANDARD).
 */
export const sanitizeUxMode = (mode) =>
  isValidUxMode(mode) ? mode : UX_MODES.STANDARD;

/**
 * Pure getter retrieving UX profile metadata with fallback to STANDARD.
 */
export const getUxProfile = (mode) => {
  if (isValidUxMode(mode)) {
    return UX_PROFILES[mode];
  }
  return UX_PROFILES[UX_MODES.STANDARD];
};

/**
 * Returns all available UX profiles as an immutable list.
 */
export const getAvailableUxProfiles = () => Object.freeze(Object.values(UX_PROFILES));

/**
 * Pure functional transformer merging target UX mode settings with existing state.
 */
export const applyUxProfileToSettings = (currentSettings = {}, targetMode = UX_MODES.STANDARD) =>
  trySync(
    () => {
      const profile = getUxProfile(targetMode);
      return Object.freeze({
        ...currentSettings,
        ...profile.defaultSettings,
        uxMode: profile.id,
      });
    },
    Object.freeze({ ...currentSettings, uxMode: UX_MODES.STANDARD }),
    { code: ERROR_CODES.UX_PROFILE_ERROR, targetMode }
  ).value;

/**
 * Pure predicate checking whether a mode is a simplified UX (beginner or child).
 */
export const isSimplifiedUxMode = (mode) =>
  mode === UX_MODES.BEGINNER || mode === UX_MODES.CHILD;

/**
 * Pure helper providing contextual guidance tips for beginner and child modes.
 * Accurately references real UI elements (the ▶ button, the top badge, etc.).
 */
export const getBeginnerTip = (context = "general", uxMode = "beginner") => {
  if (uxMode === UX_MODES.CHILD) {
    const childTips = {
      general: "🌟 Clique sur un verset ou sur le bouton de lecture ▶ pour écouter la belle voix du récitateur !",
      quran: "🌟 Fais défiler vers le bas pour lire la suite. Clique sur le bouton de lecture ▶ (en bas ou devant un verset) pour écouter !",
      audio: "🎧 Les mots en arabe se colorent au fur et à mesure que le récitateur lit. Répète après lui !",
      quiz: "🌟 Choisis la bonne réponse parmi les choix proposés. Prends tout ton temps !",
      prononciation: "🎤 Écoute bien chaque lettre pour bien prononcer avec les couleurs du Tajweed !",
      revision: "🔁 Retrouve ici tes versets favoris pour les réviser et les garder dans ton cœur !",
    };
    return childTips[context] || childTips.general;
  }

  const tips = {
    general: "💡 Astuce : Cliquez sur un verset ou sur le bouton de lecture ▶ en bas pour lancer la récitation. Changez de mode via le badge en haut.",
    quran: "📖 Pour lire : Faites défiler vers le bas pour continuer votre lecture. Cliquez sur le bouton de lecture ▶ (en bas ou devant un verset) pour écouter la récitation.",
    audio: "🎧 Écoute audio : Le texte arabe se colore mot à mot avec la récitation pour vous repérer facilement.",
    quiz: "🎯 Quiz d'apprentissage : Choisissez la bonne réponse parmi les options. Prenez votre temps, sans limite de temps.",
    prononciation: "🎤 Prononciation : Écoutez attentivement chaque lettre pour apprendre la bonne articulation avec les règles de Tajweed.",
    revision: "🔁 Révision : Vos versets à réviser sont regroupés ici pour vous aider à les mémoriser pas à pas.",
  };
  return tips[context] || tips.general;
};

/**
 * Pure helper returning CSS class name reflecting the active UX mode.
 */
export const getUxModeClassName = (mode) => {
  const safeMode = isValidUxMode(mode) ? mode : UX_MODES.STANDARD;
  return `ux-profile-${safeMode}`;
};

/**
 * Transforms any error into a reassuring, plain-language message for beginner users.
 */
export const formatFriendlyErrorMessage = (error, uxMode = UX_MODES.STANDARD) => {
  if (uxMode !== UX_MODES.BEGINNER && uxMode !== UX_MODES.CHILD) {
    return error?.message || "Une erreur est survenue";
  }
  const msg = String(error?.message || "");
  if (msg.includes("fetch") || msg.includes("Network") || msg.includes("offline")) {
    return "Connexion internet momentanément indisponible. Vous pouvez continuer à lire les textes déjà enregistrés.";
  }
  if (msg.includes("audio") || msg.includes("play")) {
    return "Impossible de démarrer la lecture audio. Vérifiez que le volume de votre appareil est activé.";
  }
  return "Une petite difficulté technique est survenue. Tout va bien, vous pouvez continuer votre lecture tranquillement.";
};

/**
 * Pure getter returning navigation tabs tailored to the user profile.
 */
export const getNavigationTabs = (uxMode = UX_MODES.STANDARD) => {
  const mode = sanitizeUxMode(uxMode);

  if (mode === UX_MODES.CHILD) {
    return Object.freeze([
      { id: "quran",         icon: "📖", label: "LECTURE",        title: "Lire et écouter les belles sourates" },
      { id: "prononciation", icon: "🌟", label: "LETTRES",        title: "Apprendre à bien prononcer les lettres" },
      { id: "dashboard",     icon: "🏆", label: "PROGRÈS",        title: "Mes étoiles et récompenses" },
      { id: "revision",      icon: "⭐", label: "FAVORIS",        title: "Mes versets préférés à réviser" },
      { id: "recordings",    icon: "🎙️", label: "MA VOIX",        title: "Écouter mes enregistrements" },
      { id: "offline",       icon: "💾", label: "SANS INTERNET",  title: "Lire même sans connexion" },
    ]);
  }

  if (mode === UX_MODES.BEGINNER) {
    return Object.freeze([
      { id: "quran",         icon: "📖", label: "CORAN",          title: "Lecture du Saint Coran" },
      { id: "prononciation", icon: "🔤", label: "PRONONCIATION",  title: "Guide de prononciation pas-à-pas" },
      { id: "dashboard",     icon: "📊", label: "PROGRESSION",    title: "Suivi de votre apprentissage" },
      { id: "revision",      icon: "🔁", label: "RÉVISION",       title: "Réviser vos versets mémorisés" },
    ]);
  }

  if (mode === UX_MODES.EXPERT) {
    return Object.freeze([
      { id: "quran",         icon: "📖", label: "CORAN",   title: "Coran (Texte, Audio, Synchronisation mot à mot)" },
      { id: "prononciation", icon: "🔤", label: "TAJWEED", title: "Analyse acoustique et règles de Tajweed" },
      { id: "dashboard",     icon: "📊", label: "MÉTRIQUES",title: "Analytique détaillée de mémorisation" },
      { id: "collections",   icon: "🗂", label: "COLL.",   title: "Collections et concordances thématiques" },
      { id: "revision",      icon: "⚡", label: "RÉVISION",title: "Révision active avec silences paramétrables" },
      { id: "recordings",    icon: "🎙", label: "ENREG.",  title: "Studio d'enregistrement et spectrogramme" },
      { id: "offline",       icon: "💾", label: "OFFLINE", title: "Gestion avancée du cache et stockage hors-ligne" },
    ]);
  }

  // Standard / Balanced
  return Object.freeze([
    { id: "quran",         icon: "📖", label: "CORAN",    title: "Lecture du Saint Coran" },
    { id: "prononciation", icon: "🔤", label: "PRONON.",  title: "Prononciation et Tajweed" },
    { id: "dashboard",     icon: "📊", label: "DASH",     title: "Tableau de bord" },
    { id: "collections",   icon: "🗂", label: "COLL.",    title: "Collections de versets" },
    { id: "revision",      icon: "✏",  label: "RÉVISION", title: "Révision et mémorisation" },
    { id: "recordings",    icon: "🎙",  label: "ENREG.",   title: "Enregistrements audio" },
    { id: "offline",       icon: "💾", label: "OFFLINE",  title: "Mode hors-ligne" },
  ]);
};

/**
 * Pure getter returning player UI configuration tailored to the user profile.
 */
export const getPlayerConfig = (uxMode = UX_MODES.STANDARD) => {
  const mode = sanitizeUxMode(uxMode);

  return Object.freeze({
    isChild: mode === UX_MODES.CHILD,
    isBeginner: mode === UX_MODES.BEGINNER,
    isExpert: mode === UX_MODES.EXPERT,
    isSimplified: isSimplifiedUxMode(mode),
    playBtnText: (isPlaying) => {
      if (mode === UX_MODES.CHILD) return isPlaying ? "⏸ PAUSE" : "▶ ÉCOUTER";
      if (mode === UX_MODES.BEGINNER) return isPlaying ? "⏸ Pause" : "▶ Écouter";
      return isPlaying ? "⏸" : "▶";
    },
    prevBtnText: () => {
      if (mode === UX_MODES.CHILD) return "⏮ PRÉC.";
      if (mode === UX_MODES.BEGINNER) return "⏮ Préc.";
      return "⏮";
    },
    nextBtnText: () => {
      if (mode === UX_MODES.CHILD) return "SUIV. ⏭";
      if (mode === UX_MODES.BEGINNER) return "Suiv. ⏭";
      return "⏭";
    },
    loopBtnText: () => {
      if (mode === UX_MODES.CHILD) return "🔁 RÉPÉTER";
      if (mode === UX_MODES.BEGINNER) return "🔁 Répéter";
      return "↺";
    },
    showFastBackward: mode !== UX_MODES.CHILD && mode !== UX_MODES.BEGINNER,
    showLoopButton: mode !== UX_MODES.CHILD && mode !== UX_MODES.BEGINNER,
    showStandaloneReciter: mode !== UX_MODES.CHILD && mode !== UX_MODES.BEGINNER,
    tajweedBtnLabel: mode === UX_MODES.CHILD ? "🎨 TAJWID & AUDIO" : mode === UX_MODES.BEGINNER ? "🎨 OPTIONS & TAJWID" : "TAJWID",
    surahTitleFormat: (surah) => {
      if (!surah) return "";
      if (mode === UX_MODES.CHILD) return `🌟 ${surah.englishName}`;
      if (mode === UX_MODES.BEGINNER) return `${surah.englishName}`;
      return surah.englishName.toUpperCase();
    },
    verseCounterFormat: (currentAyatNum, totalAyats, loopDetails = "") => {
      if (mode === UX_MODES.CHILD) {
        return `Verset ${currentAyatNum} sur ${totalAyats}${loopDetails ? ` · 🔁 ${loopDetails}` : ""}`;
      }
      if (mode === UX_MODES.BEGINNER) {
        return `Verset ${currentAyatNum} / ${totalAyats}${loopDetails ? ` (${loopDetails})` : ""}`;
      }
      return `AYAT ${currentAyatNum} / ${totalAyats}`;
    },
  });
};

/**
 * Pure getter returning sidebar configuration tailored to the user profile.
 */
export const getSidebarConfig = (uxMode = UX_MODES.STANDARD) => {
  const mode = sanitizeUxMode(uxMode);

  return Object.freeze({
    searchPlaceholder:
      mode === UX_MODES.CHILD
        ? "🌟 Chercher une sourate..."
        : mode === UX_MODES.BEGINNER
        ? "Rechercher une sourate (nom ou n°)..."
        : mode === UX_MODES.EXPERT
        ? "Rechercher (nom, n°, thème, Juz)..."
        : "RECHERCHER (NOM, N°)...",
    revelationLabel: (type) => {
      if (mode === UX_MODES.CHILD || mode === UX_MODES.BEGINNER) {
        return type === "Meccan" ? "Mecquoise" : "Médinoise";
      }
      return type;
    },
    versesLabel: (count) => {
      if (mode === UX_MODES.CHILD || mode === UX_MODES.BEGINNER) return `${count} versets`;
      return `${count} AYATS`;
    },
    showArchitectureDoc: mode === UX_MODES.EXPERT || mode === UX_MODES.STANDARD,
    showStars: mode === UX_MODES.CHILD,
  });
};

