import { safeGetItem, safeSetItem, safeRemoveItem } from "./safeStorage.js";

export const AUTH_STORAGE_KEY = "quran_auth_user";

/**
 * Origine d'une session. Seule "firebase" correspond à une vraie
 * authentification ; les autres sont des profils locaux sans lien avec
 * un compte distant (jamais synchronisés au cloud).
 *   firebase : utilisateur Firebase authentifié (Google, email/mot de passe)
 *   local    : profil créé localement quand le fournisseur email n'est pas activé
 *   demo     : session de démonstration (aperçu/développement uniquement)
 *   offline  : invité
 */
export const SESSION_SOURCES = Object.freeze({
  FIREBASE: "firebase",
  LOCAL: "local",
  DEMO: "demo",
  OFFLINE: "offline",
});

/**
 * Check if the application is currently running inside an iframe.
 * In sandboxed iframes, cross-origin popups lose window.opener and are
 * closed automatically by Google/Firebase security handlers.
 */
export const isIframeEnvironment = () => {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    // If accessing window.top throws a security error, it's definitely a cross-origin iframe
    return true;
  }
};

/**
 * La « connexion rapide » fabrique une session sans aucune authentification.
 * Elle ne doit exister que pour le développement / l'aperçu : désactivée
 * dans un build de production, sauf opt-in explicite (VITE_ALLOW_DEMO_LOGIN=true).
 */
export const isDemoLoginAllowed = (env = import.meta.env) =>
  Boolean(env?.DEV) || env?.VITE_ALLOW_DEMO_LOGIN === "true";

/**
 * Profil de démonstration générique (aucune donnée personnelle embarquée
 * dans le bundle — l'ancien profil codait en dur un vrai nom et un vrai email).
 */
export const DEFAULT_GOOGLE_USER = Object.freeze({
  uid: "google_user_demo",
  displayName: "Compte démo",
  email: "demo@example.com",
  photoURL: null,
  providerId: "google.com",
  isOffline: false,
  source: SESSION_SOURCES.DEMO,
});

/**
 * Functional factory to create a local / demo user session.
 */
export const createDemoGoogleUser = (overrides = {}) => ({
  ...DEFAULT_GOOGLE_USER,
  ...overrides,
  source: SESSION_SOURCES.DEMO,
});

/**
 * Functional factory for guest/offline user.
 */
export const createOfflineUser = () => ({
  uid: "offline_user",
  displayName: "Invité",
  email: null,
  photoURL: null,
  isOffline: true,
  source: SESSION_SOURCES.OFFLINE,
});

/**
 * Hash 53 bits (cyrb53) d'une chaîne complète. Remplace l'ancien
 * btoa(email).slice(0, 16) qui (1) ne gardait que les 12 premiers octets
 * de l'email — deux emails partageant ce préfixe recevaient le MÊME uid —
 * et (2) levait InvalidCharacterError sur tout caractère hors Latin-1.
 */
const hashString = (str) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

/**
 * Functional factory to create a local user for email/password fallback.
 * Profil LOCAL uniquement : aucun mot de passe n'est vérifié et il n'est
 * jamais synchronisé au cloud.
 */
export const createLocalEmailUser = (email, name = "") => {
  const cleanEmail = (email || "").trim().toLowerCase();
  const displayName = (name || "").trim() || cleanEmail.split("@")[0] || "Utilisateur";
  return {
    uid: `local_${hashString(cleanEmail || "user").toString(36)}`,
    email: cleanEmail,
    displayName,
    photoURL: null,
    isOffline: false,
    source: SESSION_SOURCES.LOCAL,
  };
};

/**
 * Détermine l'origine d'une session. Gère les sessions enregistrées avant
 * l'introduction du champ `source` (déduction à partir de l'uid) ; un
 * objet User Firebase vivant n'a pas de `source` et n'a pas d'uid
 * préfixé → "firebase".
 */
export const getSessionSource = (user) => {
  if (!user) return null;
  if (user.source) return user.source;
  if (user.isOffline) return SESSION_SOURCES.OFFLINE;
  const uid = String(user.uid || "");
  if (uid.startsWith("local_")) return SESSION_SOURCES.LOCAL;
  if (uid.startsWith("google_user_")) return SESSION_SOURCES.DEMO;
  return SESSION_SOURCES.FIREBASE;
};

/** Seule une vraie session Firebase peut lire/écrire les données cloud. */
export const isCloudSyncEligible = (user) =>
  getSessionSource(user) === SESSION_SOURCES.FIREBASE;

/**
 * Faut-il restaurer une session enregistrée quand Firebase ne rapporte
 * aucun utilisateur ? Uniquement pour les profils locaux/démo/invité.
 * Une session « firebase » enregistrée alors que Firebase dit « personne »
 * est périmée (révoquée, supprimée, persistance vidée) : la restaurer
 * produirait un faux « connecté » avec un vrai uid mais sans request.auth,
 * donc une synchro cloud qui échoue en silence.
 */
export const shouldRestoreSavedSession = (saved) => {
  const source = getSessionSource(saved);
  if (!source) return false;
  if (source === SESSION_SOURCES.DEMO && !isDemoLoginAllowed()) return false;
  return source !== SESSION_SOURCES.FIREBASE;
};

const POPUP_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/popup-blocked",
]);

// Erreurs de configuration du projet Firebase : à corriger dans la console,
// pas à contourner côté utilisateur.
const CONFIG_CODES = new Set([
  "auth/unauthorized-domain",
  "auth/invalid-api-key",
  "auth/app-not-authorized",
  "auth/internal-error",
]);

/**
 * Parse any Firebase or browser error into a clear, user-friendly outcome.
 * Pure functional error manager.
 */
export const parseAuthError = (error) => {
  if (!error) {
    return {
      code: "",
      rawMsg: "",
      isPopupClosure: false,
      isUserCancelled: false,
      isConfigError: false,
      isIframeBlock: false,
      userFriendlyMessage: "",
    };
  }

  const code = String(error.code || "");
  const rawMsg = error.message || (typeof error === "string" ? error : String(error));
  const inIframe = isIframeEnvironment();

  // Fermeture/blocage de popup : uniquement les codes précis. L'ancienne
  // détection par sous-chaînes ("closed", "popup") et l'inclusion de
  // unauthorized-domain / internal-error faisaient passer des erreurs de
  // configuration pour « fenêtre fermée », masquant la vraie cause.
  const isPopupClosure =
    POPUP_CODES.has(code) ||
    rawMsg.includes("popup-closed-by-user") ||
    rawMsg.includes("popup-blocked");

  // Annulation volontaire du sélecteur de compte natif (Android) — pas une erreur.
  const isUserCancelled =
    !isPopupClosure &&
    (/^(sign_in_canceled|sign_in_cancelled|canceled|cancelled|12501)$/i.test(code) ||
      /\bcancel+ed\b/i.test(rawMsg));

  const isConfigError = CONFIG_CODES.has(code);

  let userFriendlyMessage = "";

  if (isPopupClosure) {
    userFriendlyMessage = inIframe
      ? "La fenêtre Google s'est refermée en raison des règles de sécurité du navigateur dans l'iframe. Ouvrez l'application dans un nouvel onglet."
      : "La fenêtre de connexion Google a été fermée ou bloquée par le navigateur.";
  } else if (isUserCancelled) {
    userFriendlyMessage = "";
  } else if (code === "auth/unauthorized-domain") {
    userFriendlyMessage =
      "Ce domaine n'est pas autorisé pour la connexion Google. Ajoutez-le dans la console Firebase (Authentication → Paramètres → Domaines autorisés).";
  } else if (code === "auth/invalid-api-key" || code === "auth/app-not-authorized") {
    userFriendlyMessage =
      "Configuration Firebase invalide (clé API ou application non autorisée). Vérifiez les variables VITE_FIREBASE_*.";
  } else if (code === "auth/internal-error") {
    userFriendlyMessage =
      "Erreur interne du service d'authentification. Réessayez ; si elle persiste, vérifiez la configuration Firebase (domaines autorisés, clé API).";
  } else if (code === "auth/operation-not-allowed") {
    userFriendlyMessage =
      "Ce mode de connexion n'est pas activé sur le serveur distant. Un profil local a été créé : il n'est pas protégé par mot de passe et n'est pas synchronisé.";
  } else if (code === "auth/network-request-failed") {
    userFriendlyMessage = "Connexion réseau indisponible. Vérifiez votre connexion et réessayez.";
  } else if (code === "auth/too-many-requests") {
    userFriendlyMessage = "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  } else if (code === "auth/user-disabled") {
    userFriendlyMessage = "Ce compte a été désactivé.";
  } else if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
    userFriendlyMessage = "Email ou mot de passe incorrect.";
  } else if (code === "auth/wrong-password") {
    userFriendlyMessage = "Mot de passe incorrect.";
  } else if (code === "auth/email-already-in-use") {
    userFriendlyMessage = "Cet email est déjà associé à un compte.";
  } else if (code === "auth/weak-password") {
    userFriendlyMessage = "Mot de passe trop court (6 caractères minimum).";
  } else if (code === "auth/invalid-email") {
    userFriendlyMessage = "Format d'email invalide.";
  } else {
    userFriendlyMessage = rawMsg || "Une erreur est survenue lors de la connexion.";
  }

  return {
    code,
    rawMsg,
    isPopupClosure,
    isUserCancelled,
    isConfigError,
    isIframeBlock: inIframe && isPopupClosure,
    userFriendlyMessage,
  };
};

/**
 * Storage helpers for persisting authenticated user session.
 */
export const saveSessionUser = (user) => {
  if (!user) return;
  safeSetItem(AUTH_STORAGE_KEY, {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    isOffline: Boolean(user.isOffline),
    source: getSessionSource(user),
  });
};

export const getSavedSessionUser = () => {
  return safeGetItem(AUTH_STORAGE_KEY, null);
};

export const clearSessionUser = () => {
  safeRemoveItem(AUTH_STORAGE_KEY);
};

/**
 * Safely open the app in a new browser tab where standard popups and cookies are unrestricted.
 */
export const openAppInNewTab = () => {
  if (typeof window === "undefined") return;
  try {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  } catch (err) {
    console.warn("Could not open in new tab:", err);
  }
};
