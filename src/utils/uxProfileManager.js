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
    name: "Débutant informatique",
    shortLabel: "Simple",
    badge: "Débutant",
    icon: "🔰",
    targetAudience: "Seniors, débutants en informatique ou personnes souhaitant une interface très simple",
    description: "Interface épurée avec très grands caractères, gros boutons tactiles avec texte explicite et aides pas-à-pas bienveillantes.",
    features: Object.freeze([
      "Texte arabe agrandi (32px) et traduction en français très lisible",
      "Gros boutons avec icône ET libellé clair (pas de symboles mystérieux)",
      "Bannière d'aide et conseils contextuels pas-à-pas",
      "Masquage des réglages techniques complexes pour éviter toute fausse manipulation",
      "Lecteur audio grand format avec commandes simples : Écouter / Pause"
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
      fullScreenSelectedAyat: false,
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
      fullScreenSelectedAyat: false,
    }),
  }),
});

/**
 * Pure predicate checking whether a mode is valid.
 */
export const isValidUxMode = (mode) =>
  typeof mode === "string" && Object.values(UX_MODES).includes(mode);

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
 * Pure helper providing contextual guidance tips for beginner and child modes.
 */
export const getBeginnerTip = (context = "general") => {
  const tips = {
    general: "💡 Astuce : Cliquez sur n'importe quel verset pour l'écouter. Vous pouvez changer de mode à tout moment via le bouton en haut.",
    quran: "📖 Pour lire : Faites défiler vers le bas pour continuer votre lecture. Cliquez sur le bouton vert 'Écouter' pour entendre la récitation.",
    audio: "🎧 Écoute audio : Le texte en arabe se colore au fur et à mesure que le récitateur parle pour vous guider.",
    quiz: "🎯 Quiz d'apprentissage : Choisissez la bonne réponse parmi les choix proposés. Prenez votre temps, aucune pression !",
    prononciation: "🎤 Prononciation : Écoutez attentivement chaque lettre pour apprendre la bonne articulation avec le Tajweed.",
    revision: "🔁 Révision : Vos versets à réviser sont regroupés ici pour vous aider à les mémoriser durablement.",
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
