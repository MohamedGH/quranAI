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
    colorTheme: Object.freeze({
      name: "Ambre Chaleureux",
      accent: "#f59e0b",
      accentHover: "#fbbf24",
      accentRgb: "245, 158, 11",
      accentGradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      badgeBg: "rgba(245, 158, 11, 0.18)",
      badgeBorder: "rgba(245, 158, 11, 0.6)",
      cardBg: "linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, rgba(20, 24, 33, 0.85) 100%)",
      cardBorder: "rgba(245, 158, 11, 0.22)",
      headerGlow: "rgba(245, 158, 11, 0.35)",
      navActiveBg: "linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(245, 158, 11, 0.10))",
      navActiveBorder: "rgba(245, 158, 11, 0.40)",
    }),
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
    colorTheme: Object.freeze({
      name: "Or Classique",
      accent: "#c9a84c",
      accentHover: "#e8c96e",
      accentRgb: "201, 168, 76",
      accentGradient: "linear-gradient(135deg, #c9a84c 0%, #a68434 100%)",
      badgeBg: "rgba(201, 168, 76, 0.12)",
      badgeBorder: "rgba(201, 168, 76, 0.45)",
      cardBg: "rgba(255, 255, 255, 0.015)",
      cardBorder: "rgba(42, 47, 64, 0.5)",
      headerGlow: "rgba(201, 168, 76, 0.35)",
      navActiveBg: "linear-gradient(135deg, rgba(201, 168, 76, 0.22), rgba(201, 168, 76, 0.10))",
      navActiveBorder: "rgba(201, 168, 76, 0.30)",
    }),
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
    colorTheme: Object.freeze({
      name: "Violet Royal & Indigo",
      accent: "#c878ff",
      accentHover: "#d99aff",
      accentRgb: "200, 120, 255",
      accentGradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
      badgeBg: "rgba(200, 120, 255, 0.18)",
      badgeBorder: "rgba(200, 120, 255, 0.6)",
      cardBg: "rgba(20, 18, 30, 0.75)",
      cardBorder: "rgba(200, 120, 255, 0.25)",
      headerGlow: "rgba(200, 120, 255, 0.35)",
      navActiveBg: "linear-gradient(135deg, rgba(200, 120, 255, 0.22), rgba(200, 120, 255, 0.10))",
      navActiveBorder: "rgba(200, 120, 255, 0.35)",
    }),
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
    colorTheme: Object.freeze({
      name: "Soleil Joyeux & Doré Lumineux",
      accent: "#ffb703",
      accentHover: "#ffe082",
      accentRgb: "255, 183, 3",
      accentGradient: "linear-gradient(135deg, #ffb703 0%, #ffa000 100%)",
      badgeBg: "rgba(255, 183, 3, 0.25)",
      badgeBorder: "rgba(255, 183, 3, 0.75)",
      cardBg: "linear-gradient(180deg, rgba(255, 245, 205, 0.20) 0%, rgba(255, 225, 120, 0.10) 40%, rgba(28, 34, 48, 0.90) 100%)",
      cardBorder: "rgba(255, 183, 3, 0.50)",
      headerGlow: "rgba(255, 200, 50, 0.60)",
      navActiveBg: "linear-gradient(135deg, rgba(255, 183, 3, 0.35), rgba(255, 160, 0, 0.20))",
      navActiveBorder: "rgba(255, 183, 3, 0.70)",
    }),
    targetAudience: "Enfants et jeunes apprenants découvrant le Coran",
    description: "Affichage clair, lumineux et chaleureux avec caractères très grands (36px), espace aéré, boutons simplifiés et jeux stimulants.",
    featureFlags: Object.freeze({
      simplifiedAudioPlayer: true,
      simplifiedSurahHeader: true,
      showBeginnerTooltips: true,
      hideAdvancedMetrics: true,
    }),
    features: Object.freeze([
      "Caractères arabes géants (36px) lumineux et aérés",
      "Couleurs claires et chaudes pour une lecture facile sans fatigue",
      "Interface épurée avec un nombre minimal de boutons",
      "Jeux et quiz motivants avec encouragements visuels et sonores"
    ]),
    defaultSettings: Object.freeze({
      ayatFontSize: 36,
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
 * Pure getter returning color theme tokens for a given UX mode.
 */
export const getUxThemeTokens = (mode = UX_MODES.STANDARD) => {
  const profile = getUxProfile(mode);
  return profile?.colorTheme || UX_PROFILES[UX_MODES.STANDARD].colorTheme;
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
      { id: "quran",         icon: "📖", label: "LECTURE",      title: "Lire et écouter les belles sourates" },
      { id: "prononciation", icon: "🌟", label: "LETTRES",      title: "Apprendre à bien prononcer les lettres" },
      { id: "revision",      icon: "⭐", label: "JEUX & QUIZ",  title: "Jeux, quiz et révision amusante" },
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
      return isPlaying ? "⏸" : "▶";
    },
    playBtnAriaLabel: (isPlaying) => {
      if (mode === UX_MODES.CHILD) return isPlaying ? "Pause (mettre en pause)" : "Écouter la récitation";
      if (mode === UX_MODES.BEGINNER) return isPlaying ? "Pause" : "Écouter";
      return isPlaying ? "Pause" : "Lecture";
    },
    prevBtnText: () => "⏮",
    prevBtnAriaLabel: () => {
      if (mode === UX_MODES.CHILD) return "Verset précédent (revenir en arrière)";
      if (mode === UX_MODES.BEGINNER) return "Verset précédent";
      return "Précédent";
    },
    nextBtnText: () => "⏭",
    nextBtnAriaLabel: () => {
      if (mode === UX_MODES.CHILD) return "Verset suivant (avancer au verset d'après)";
      if (mode === UX_MODES.BEGINNER) return "Verset suivant";
      return "Suivant";
    },
    loopBtnText: () => "↺",
    loopBtnAriaLabel: () => {
      if (mode === UX_MODES.CHILD) return "Répéter le verset en boucle";
      if (mode === UX_MODES.BEGINNER) return "Répéter la sélection";
      return "Boucle";
    },
    showFastBackward: mode !== UX_MODES.CHILD && mode !== UX_MODES.BEGINNER,
    showLoopButton: mode !== UX_MODES.CHILD && mode !== UX_MODES.BEGINNER,
    showStandaloneReciter: mode !== UX_MODES.CHILD && mode !== UX_MODES.BEGINNER,
    tajweedBtnIcon: "🎨",
    tajweedBtnLabel: mode === UX_MODES.CHILD ? "OPTIONS" : mode === UX_MODES.BEGINNER ? "OPTIONS" : "TAJWID",
    tajweedBtnLabelShort: mode === UX_MODES.CHILD ? "OPTIONS" : mode === UX_MODES.BEGINNER ? "OPTIONS" : "TAJWID",
    surahTitleFormat: (surah) => {
      if (!surah) return "";
      if (mode === UX_MODES.CHILD) return `🌟 ${surah.englishName}`;
      if (mode === UX_MODES.BEGINNER) return `${surah.englishName}`;
      return surah.englishName.toUpperCase();
    },
    verseCounterFormat: (currentAyatNum, totalAyats, loopDetails = "") => {
      if (mode === UX_MODES.CHILD) {
        return `Verset ${currentAyatNum}/${totalAyats}${loopDetails ? ` · 🔁 ${loopDetails}` : ""}`;
      }
      if (mode === UX_MODES.BEGINNER) {
        return `Verset ${currentAyatNum}/${totalAyats}${loopDetails ? ` (${loopDetails})` : ""}`;
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
/**
 * Pure getter returning onboarding wizard configuration and steps adapted to each level/mode.
 */
export const getUxWizardConfig = (uxMode = UX_MODES.STANDARD) => {
  const mode = sanitizeUxMode(uxMode);
  const theme = getUxThemeTokens(mode);
  const profile = getUxProfile(mode);

  if (mode === UX_MODES.BEGINNER) {
    return Object.freeze({
      mode,
      badge: "Guide Débutant Pas-à-Pas",
      title: "Bienvenue dans votre espace Coran apaisé",
      subtitle: "Un guide pas-à-pas simple et rassurant pour apprendre à votre rythme",
      theme,
      steps: Object.freeze([
        {
          step: 1,
          icon: "📖",
          title: "Lecture Claire & Grands Caractères",
          shortDesc: "Verset agrandi (32px) et traduction en français immédiate",
          body: "Le texte sacré arabe s'affiche en très grands caractères avec les voyelles bien visibles. Juste en dessous, la traduction française vous permet de comprendre chaque phrase sans effort.",
          highlightTip: "Faites défiler vers le bas pour lire naturellement les versets suivants.",
          keyAction: "Touchez n'importe quel verset pour le sélectionner en grand écran."
        },
        {
          step: 2,
          icon: "▶️",
          title: "Écoute Audio Simplifiée",
          shortDesc: "Seulement 4 boutons essentiels : Précédent, Écouter, Suivant et Options",
          body: "Pas de commandes compliquées : appuyez sur '▶ Écouter' en bas pour lancer la récitation. Le mot en cours de récitation se colore pour vous guider les yeux fermés.",
          highlightTip: "En mode novice, tous les boutons inutiles sont masqués pour éviter les fausses manipulations.",
          keyAction: "Appuyez sur '▶ Écouter' pour démarrer ou '⏸ Pause' pour arrêter."
        },
        {
          step: 3,
          icon: "🧭",
          title: "4 Onglets Essentiels",
          shortDesc: "Coran, Prononciation, Progression et Révision",
          body: "La barre supérieure ne contient que 4 onglets clairs : lisez le Coran, pratiquez la prononciation des lettres, suivez vos sourates apprises et révisez sereinement.",
          highlightTip: "Vous pouvez changer de mode à tout moment via le badge 🌱 Novice en haut.",
          keyAction: "Naviguez facilement entre les 4 rubriques principales."
        },
        {
          step: 4,
          icon: "🎨",
          title: "Couleurs Chaleureuses & Bienveillantes",
          shortDesc: "Une ambiance ambrée douce conçue pour le confort des yeux",
          body: "L'interface utilise des teintes ambrées et miel apaisantes. Des conseils discrets vous accompagnent au fil de votre lecture sans jamais vous interrompre.",
          highlightTip: "Ce guide reste accessible à tout moment depuis le menu OUTILS ⚡ ou la bannière d'aide.",
          keyAction: "Vous êtes prêt ! Bonne et paisible lecture."
        }
      ])
    });
  }

  if (mode === UX_MODES.CHILD) {
    return Object.freeze({
      mode,
      badge: "Mission Apprenti Coran 🌟",
      title: "Bienvenue, jeune explorateur du Coran !",
      subtitle: "Découvre les trésors du Coran en t'amusant avec de belles couleurs",
      theme,
      steps: Object.freeze([
        {
          step: 1,
          icon: "🌟",
          title: "Des Versets Magiques & Très Grands",
          shortDesc: "Des lettres géantes dorées pour bien lire sans fatiguer",
          body: "Regarde comme les lettres arabes sont grandes et lumineuses ! Chaque verset ressemble à une carte d'étoile dorée avec sa traduction en français.",
          highlightTip: "Chaque verset porte son numéro d'étoile pour te repérer facilement.",
          keyAction: "Clique sur une carte de verset pour la voir en plein écran !"
        },
        {
          step: 2,
          icon: "🎧",
          title: "Écoute & Répète avec le Récitateur",
          shortDesc: "Les mots s'illuminent pendant que le cheikh récite",
          body: "Appuie sur le gros bouton jaune '▶ ÉCOUTER'. Les mots s'allument les uns après les autres comme des petites lanternes. Répète après le cheikh !",
          highlightTip: "Tu as de gros boutons rigolos : PRÉC., ÉCOUTER, SUIV. et TAJWID.",
          keyAction: "Appuie sur '▶ ÉCOUTER' pour chanter et apprendre les versets."
        },
        {
          step: 3,
          icon: "🎮",
          title: "Quiz & Jeux de Récitation",
          shortDesc: "Gagne des points et débloque des étoiles de champion",
          body: "Dans l'onglet RÉVISION, découvre des quiz rigolos à choix multiples. Réponds sans stress, prends tout ton temps et fête tes victoires avec des sons joyeux !",
          highlightTip: "Pas de panique si tu te trompes, tu peux recommencer autant de fois que tu veux !",
          keyAction: "Deviens un champion de la mémorisation !"
        },
        {
          step: 4,
          icon: "🚀",
          title: "Prêt pour l'Aventure ?",
          shortDesc: "Explore les sourates et amuse-toi bien",
          body: "Tu as maintenant ta cape d'Apprenti du Coran. Choisis ta première sourate et commence ton beau voyage !",
          highlightTip: "Clique sur ☰ en haut pour choisir ta sourate préférée.",
          keyAction: "C'est parti ! Que la paix soit sur toi 🌟"
        }
      ])
    });
  }

  if (mode === UX_MODES.EXPERT) {
    return Object.freeze({
      mode,
      badge: "Console Expert & Mémorisation Pro ⚡",
      title: "Architecture & Outils de Haute Précision",
      subtitle: "Guide des fonctionnalités avancées pour Hafiz, Imams et étudiants aguerris",
      theme,
      steps: Object.freeze([
        {
          step: 1,
          icon: "⚡",
          title: "Synchronisation Acoustique & Métadonnées",
          shortDesc: "Alignement mot à mot au millième de seconde et repères canoniques",
          body: "Chaque verset intègre les divisions coraniques complètes : Hizb, Juz, Ruku, Manzil et Page de Médine. La synchronisation temporelle fine permet le bouclage ciblé sur des segments précis.",
          highlightTip: "La vue compacte affiche un maximum de texte par écran pour les révisions rapides.",
          keyAction: "Activez le mode Hizb ou Page dans les options pour travailler par blocs."
        },
        {
          step: 2,
          icon: "🎯",
          title: "Studio de Tajweed & Silences Paramétrables",
          shortDesc: "Contrôle prédictif des pauses et masquage actif des mots à réviser",
          body: "Utilisez le 'SilenceReviseControl' pour tester votre mémoire : l'audio coupe le son sur les mots inconnus pour vous forcer à réciter de mémoire avant la reprise automatique.",
          highlightTip: "Le Coach Vocal de Tajweed annonce et analyse acoustiquement chaque règle (Ghunnah, Qalqala, Madd).",
          keyAction: "Configurez vos pauses de révision au millième de seconde."
        },
        {
          step: 3,
          icon: "⌨️",
          title: "Raccourcis Clavier & Recherche Concordance",
          shortDesc: "Contrôle mains-libres au clavier pour sessions intensives de mémorisation",
          body: "Raccourcis rapides : [Espace] pour play/pause, [Flèches] pour sauts de versets, [1-4] pour validation des quiz, [R] pour indice mot masqué, [T] pour Tajweed intégral.",
          highlightTip: "La page Concordance permet de croiser racines, occurrences lexicales et structures syntaxiques.",
          keyAction: "Utilisez la concordance lexicale pour maîtriser les versets similaires (Mutashabihat)."
        },
        {
          step: 4,
          icon: "💾",
          title: "Offline Storage & Télémétrie de Maîtrise",
          shortDesc: "Calcul d'estimation de mémoire spatiale et cache IndexedDB complet",
          body: "L'application fonctionne à 100% hors-ligne avec téléchargement ciblé des sourates et récitation audio. Les métriques de mémorisation calculent votre courbe d'oubli.",
          highlightTip: "Consultez le Dossier d'Architecture PDF depuis la barre latérale pour la documentation technique.",
          keyAction: "Vous disposez de l'environnement complet de travail pour Hafiz."
        }
      ])
    });
  }

  // STANDARD / BALANCED
  return Object.freeze({
    mode,
    badge: "Visite Guidée de l'Application ⚖️",
    title: "Guide Complet de Qur'an Study",
    subtitle: "Découvrez toutes les clés pour lire, écouter, comprendre et mémoriser",
    theme,
    steps: Object.freeze([
      {
        step: 1,
        icon: "📖",
        title: "Lecture & Récitation Synchronisée",
        shortDesc: "Texte arabe Uthmani, phonétique et traductions françaises",
        body: "Naviguez à travers les 114 sourates. Chaque verset peut être écouté individuellement ou en continu avec synchronisation lettre par lettre et mot à mot.",
        highlightTip: "Cliquez sur n'importe quel verset pour déployer ses détails, notes et analyses.",
        keyAction: "Utilisez le menu ☰ à gauche pour choisir une sourate ou filtrer par niveau de maîtrise."
      },
      {
        step: 2,
        icon: "🎨",
        title: "Tajweed Dynamique en Couleurs",
        shortDesc: "Visualisez instantanément les 8 règles fondamentales de Tajweed",
        body: "Qalqala (écho), Madd (prolongations), Idgham (assimilation), Ikhfa, Izhar, Iqlab et Ghunnah s'illuminent selon une charte chromatique claire et paramétrable.",
        highlightTip: "Activez ou désactivez chaque règle séparément via le bouton TAJWID.",
        keyAction: "Entraînez-vous avec les couleurs pour perfectionner votre récitation."
      },
      {
        step: 3,
        icon: "🔁",
        title: "Répétition & Mémorisation Pas-à-Pas",
        shortDesc: "Boucles personnalisées, quiz interactifs et suivi de progression",
        body: "Définissez une boucle audio sur un intervalle de versets (ex: versets 1 à 7) pour ancrer la mémorisation. Marquez chaque verset comme 'appris' pour voir grimper votre score.",
        highlightTip: "L'onglet 'Tableau de bord' vous présente vos statistiques et objectifs quotidiens.",
        keyAction: "Créez vos propres collections thématiques de versets à réviser."
      },
      {
        step: 4,
        icon: "⚙️",
        title: "Outils Intégrés & Personnalisation",
        shortDesc: "Clavier arabe, rappels réguliers, mode hors-ligne et choix du profil",
        body: "Retrouvez dans l'icône ⚡ (OUTILS) le clavier arabe virtuel, les alertes de révision et le mode hors-ligne pour continuer votre apprentissage sans connexion internet.",
        highlightTip: "Changez à tout moment de profil d'interface via le badge en haut à droite.",
        keyAction: "Bonne découverte et excellent apprentissage du Noble Coran !"
      }
    ])
  });
};
