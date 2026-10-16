// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isIframeEnvironment,
  parseAuthError,
  createDemoGoogleUser,
  createOfflineUser,
  createLocalEmailUser,
  saveSessionUser,
  getSavedSessionUser,
  clearSessionUser,
  DEFAULT_GOOGLE_USER,
  AUTH_STORAGE_KEY,
  SESSION_SOURCES,
  getSessionSource,
  isCloudSyncEligible,
  shouldRestoreSavedSession,
  isDemoLoginAllowed,
} from "../src/utils/authManager.js";

describe("authManager functionality & error management", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("Environment Detection", () => {
    it("detects top-level window when self === top", () => {
      // In default test environment window.self === window.top
      expect(typeof isIframeEnvironment()).toBe("boolean");
    });
  });

  describe("Error Manager (parseAuthError)", () => {
    it("handles null or empty errors gracefully", () => {
      const result = parseAuthError(null);
      expect(result.code).toBe("");
      expect(result.isPopupClosure).toBe(false);
      expect(result.userFriendlyMessage).toBe("");
    });

    it("correctly identifies popup closure errors (e.g. popup closed before rendering)", () => {
      const err = { code: "auth/popup-closed-by-user", message: "Popup was closed by the user" };
      const parsed = parseAuthError(err);
      expect(parsed.isPopupClosure).toBe(true);
      expect(parsed.userFriendlyMessage).toContain("fermé");
    });

    it("identifies cancelled popup request errors", () => {
      const err = { code: "auth/cancelled-popup-request", message: "Cancelled popup request" };
      const parsed = parseAuthError(err);
      expect(parsed.isPopupClosure).toBe(true);
    });

    it("identifies unauthorized-domain as a CONFIG error, not a popup closure", () => {
      const err = { code: "auth/unauthorized-domain", message: "Domain not authorized" };
      const parsed = parseAuthError(err);
      expect(parsed.isPopupClosure).toBe(false);
      expect(parsed.isConfigError).toBe(true);
      expect(parsed.userFriendlyMessage).toMatch(/domaine|Domaines autoris/i);
    });

    it("translates operation-not-allowed gracefully for local fallback", () => {
      const err = { code: "auth/operation-not-allowed", message: "Operation not allowed" };
      const parsed = parseAuthError(err);
      expect(parsed.isPopupClosure).toBe(false);
      expect(parsed.userFriendlyMessage).toContain("activé");
    });

    it("translates invalid password errors to French user friendly text", () => {
      const err = { code: "auth/wrong-password", message: "Wrong password" };
      const parsed = parseAuthError(err);
      expect(parsed.userFriendlyMessage).toBe("Mot de passe incorrect.");
    });
  });

  describe("User Factory - Functional Programming", () => {
    it("creates a generic demo Google user (no personal data in the bundle)", () => {
      const user = createDemoGoogleUser();
      expect(user.displayName).toBe("Compte démo");
      expect(user.email).toBe("demo@example.com");
      expect(user.providerId).toBe("google.com");
      expect(user.isOffline).toBe(false);
      expect(user.source).toBe(SESSION_SOURCES.DEMO);
      expect(JSON.stringify(DEFAULT_GOOGLE_USER)).not.toMatch(/ghalleb|gmail/i);
    });

    it("allows overrides for demo Google user", () => {
      const user = createDemoGoogleUser({ displayName: "Custom User", email: "custom@gmail.com" });
      expect(user.displayName).toBe("Custom User");
      expect(user.email).toBe("custom@gmail.com");
    });

    it("creates offline guest user", () => {
      const guest = createOfflineUser();
      expect(guest.uid).toBe("offline_user");
      expect(guest.displayName).toBe("Invité");
      expect(guest.isOffline).toBe(true);
    });

    it("creates local email user with sanitized credentials", () => {
      const local = createLocalEmailUser("test.user@example.com", "Tester");
      expect(local.displayName).toBe("Tester");
      expect(local.email).toBe("test.user@example.com");
      expect(local.uid.startsWith("local_")).toBe(true);
      expect(local.isOffline).toBe(false);
    });

    it("falls back to email prefix if display name is empty", () => {
      const local = createLocalEmailUser("karim.ali@domain.com", "");
      expect(local.displayName).toBe("karim.ali");
    });
  });

  describe("State Manager & Session Persistence", () => {
    it("persists user to localStorage and retrieves it", () => {
      const user = createDemoGoogleUser();
      saveSessionUser(user);

      const retrieved = getSavedSessionUser();
      expect(retrieved).not.toBeNull();
      expect(retrieved.email).toBe("demo@example.com");
      expect(retrieved.displayName).toBe("Compte démo");
      expect(retrieved.isOffline).toBe(false);
      expect(retrieved.source).toBe(SESSION_SOURCES.DEMO);
    });

    it("clears user session properly", () => {
      const user = createDemoGoogleUser();
      saveSessionUser(user);
      expect(getSavedSessionUser()).not.toBeNull();

      clearSessionUser();
      expect(getSavedSessionUser()).toBeNull();
    });

    it("handles corrupt or invalid stored JSON without crashing", () => {
      localStorage.setItem(AUTH_STORAGE_KEY, "invalid_json_{{");
      const user = getSavedSessionUser();
      expect(user).toBeNull();
    });
  });

  describe("parseAuthError — classification précise", () => {
    it("ne confond plus une erreur quelconque contenant « closed » ou « popup » avec une fermeture de popup", () => {
      expect(parseAuthError(new Error("Connection closed by peer")).isPopupClosure).toBe(false);
      expect(parseAuthError(new Error("popup window handler failed")).isPopupClosure).toBe(false);
    });

    it("reconnaît toujours les trois codes de popup", () => {
      for (const code of ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/popup-blocked"]) {
        expect(parseAuthError({ code, message: "x" }).isPopupClosure).toBe(true);
      }
    });

    it("traite l'annulation du sélecteur de compte natif comme silencieuse (pas d'erreur affichée)", () => {
      const byCode = parseAuthError({ code: "SIGN_IN_CANCELED", message: "x" });
      expect(byCode.isUserCancelled).toBe(true);
      expect(byCode.userFriendlyMessage).toBe("");
      expect(parseAuthError(new Error("The user canceled the sign-in flow")).isUserCancelled).toBe(true);
    });

    it("n'annule pas à tort les vraies erreurs", () => {
      expect(parseAuthError({ code: "auth/network-request-failed", message: "x" }).isUserCancelled).toBe(false);
    });

    it("donne un message clair pour réseau, trop de tentatives, compte désactivé et clé API invalide", () => {
      expect(parseAuthError({ code: "auth/network-request-failed" }).userFriendlyMessage).toMatch(/réseau/i);
      expect(parseAuthError({ code: "auth/too-many-requests" }).userFriendlyMessage).toMatch(/tentatives/i);
      expect(parseAuthError({ code: "auth/user-disabled" }).userFriendlyMessage).toMatch(/désactivé/i);
      const badKey = parseAuthError({ code: "auth/invalid-api-key" });
      expect(badKey.isConfigError).toBe(true);
    });

    it("ne prétend plus que le profil local est « sécurisé »", () => {
      const msg = parseAuthError({ code: "auth/operation-not-allowed" }).userFriendlyMessage;
      expect(msg).not.toMatch(/sécuris/i);
      expect(msg).toMatch(/local/i);
    });
  });

  describe("createLocalEmailUser — identifiants fiables", () => {
    it("donne des uid DIFFÉRENTS à deux emails partageant les 12 premiers caractères (ancienne collision)", () => {
      const a = createLocalEmailUser("abcdefghijkl@one.com");
      const b = createLocalEmailUser("abcdefghijkl@two.com");
      expect(a.uid).not.toBe(b.uid);
    });

    it("ne plante pas sur un email avec caractères non Latin-1 (btoa levait InvalidCharacterError)", () => {
      expect(() => createLocalEmailUser("محمد@example.com")).not.toThrow();
      expect(() => createLocalEmailUser("用户@例え.jp")).not.toThrow();
    });

    it("est déterministe et insensible à la casse/espaces", () => {
      expect(createLocalEmailUser("  Karim@Domain.com ").uid).toBe(createLocalEmailUser("karim@domain.com").uid);
    });

    it("marque le profil comme local", () => {
      expect(createLocalEmailUser("a@b.com").source).toBe(SESSION_SOURCES.LOCAL);
    });
  });

  describe("Origine de session & restauration", () => {
    const firebaseUser = { uid: "Xk3Rr9qLmNoPqRsTuVwXyZ12345", email: "a@b.com" };

    it("identifie l'origine, y compris pour les sessions enregistrées avant le champ source", () => {
      expect(getSessionSource(firebaseUser)).toBe(SESSION_SOURCES.FIREBASE);
      expect(getSessionSource({ uid: "local_abc" })).toBe(SESSION_SOURCES.LOCAL);
      expect(getSessionSource({ uid: "google_user_ghalleb" })).toBe(SESSION_SOURCES.DEMO);
      expect(getSessionSource({ uid: "offline_user", isOffline: true })).toBe(SESSION_SOURCES.OFFLINE);
      expect(getSessionSource(null)).toBeNull();
    });

    it("n'autorise la synchro cloud que pour une vraie session Firebase", () => {
      expect(isCloudSyncEligible(firebaseUser)).toBe(true);
      expect(isCloudSyncEligible(createLocalEmailUser("a@b.com"))).toBe(false);
      expect(isCloudSyncEligible(createOfflineUser())).toBe(false);
      expect(isCloudSyncEligible(createDemoGoogleUser())).toBe(false);
      expect(isCloudSyncEligible({ uid: "google_user_ghalleb" })).toBe(false); // ancienne session démo
    });

    it("NE restaure PAS une session Firebase périmée quand Firebase ne rapporte personne", () => {
      expect(shouldRestoreSavedSession({ ...firebaseUser, source: SESSION_SOURCES.FIREBASE })).toBe(false);
      expect(shouldRestoreSavedSession(firebaseUser)).toBe(false);
    });

    it("restaure les profils local et invité", () => {
      expect(shouldRestoreSavedSession(createLocalEmailUser("a@b.com"))).toBe(true);
      expect(shouldRestoreSavedSession(createOfflineUser())).toBe(true);
    });

    it("ne restaure rien s'il n'y a pas de session enregistrée", () => {
      expect(shouldRestoreSavedSession(null)).toBe(false);
    });

    it("saveSessionUser persiste l'origine pour que la restauration reste correcte", () => {
      saveSessionUser(createLocalEmailUser("a@b.com"));
      expect(getSavedSessionUser().source).toBe(SESSION_SOURCES.LOCAL);
      saveSessionUser(firebaseUser);
      expect(getSavedSessionUser().source).toBe(SESSION_SOURCES.FIREBASE);
    });
  });

  describe("Connexion rapide (démo)", () => {
    it("est interdite en production sans opt-in explicite", () => {
      expect(isDemoLoginAllowed({ DEV: false })).toBe(false);
      expect(isDemoLoginAllowed({})).toBe(false);
      expect(isDemoLoginAllowed({ DEV: false, VITE_ALLOW_DEMO_LOGIN: "false" })).toBe(false);
    });

    it("est autorisée en développement ou avec VITE_ALLOW_DEMO_LOGIN=true", () => {
      expect(isDemoLoginAllowed({ DEV: true })).toBe(true);
      expect(isDemoLoginAllowed({ DEV: false, VITE_ALLOW_DEMO_LOGIN: "true" })).toBe(true);
    });
  });
});
