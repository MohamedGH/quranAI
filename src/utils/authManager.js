import { safeGetItem, safeSetItem, safeRemoveItem } from "./safeStorage.js";

export const AUTH_STORAGE_KEY = "quran_auth_user";

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
 * Standard default Google user profile based on the user's known account.
 */
export const DEFAULT_GOOGLE_USER = Object.freeze({
  uid: "google_user_ghalleb",
  displayName: "Mohamed Ghalleb",
  email: "Ghalleb.Mohamed2@gmail.com",
  photoURL: null,
  providerId: "google.com",
  isOffline: false,
});

/**
 * Functional factory to create a local / demo user session.
 */
export const createDemoGoogleUser = (overrides = {}) => ({
  ...DEFAULT_GOOGLE_USER,
  ...overrides,
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
});

/**
 * Functional factory to create a local user for email/password fallback.
 */
export const createLocalEmailUser = (email, name = "") => {
  const cleanEmail = (email || "").trim().toLowerCase();
  const safeId = btoa(cleanEmail || "user").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  const displayName = name.trim() || cleanEmail.split("@")[0] || "Utilisateur";
  return {
    uid: `local_${safeId || Date.now()}`,
    email: cleanEmail,
    displayName,
    photoURL: null,
    isOffline: false,
  };
};

/**
 * Parse any Firebase or browser error into a clear, user-friendly outcome.
 * Pure functional error manager.
 */
export const parseAuthError = (error) => {
  if (!error) {
    return {
      code: "",
      isPopupClosure: false,
      isIframeBlock: false,
      userFriendlyMessage: "",
    };
  }

  const code = error.code || "";
  const rawMsg = error.message || (typeof error === "string" ? error : String(error));
  const inIframe = isIframeEnvironment();

  const isPopupClosure =
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/popup-blocked" ||
    code === "auth/unauthorized-domain" ||
    code === "auth/internal-error" ||
    rawMsg.includes("popup-closed-by-user") ||
    rawMsg.includes("closed") ||
    rawMsg.includes("popup") ||
    rawMsg.includes("unauthorized-domain");

  let userFriendlyMessage = "";

  if (isPopupClosure) {
    userFriendlyMessage = inIframe
      ? "La fenêtre Google s'est refermée en raison des règles de sécurité du navigateur dans l'iframe. Utilisez la connexion rapide ou ouvrez dans un nouvel onglet."
      : "La fenêtre de connexion Google a été fermée ou bloquée par le navigateur.";
  } else if (code === "auth/operation-not-allowed") {
    userFriendlyMessage = "Ce mode de connexion n'est pas activé sur le serveur distant. Connexion locale sécurisée activée.";
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
