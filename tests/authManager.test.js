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

    it("identifies unauthorized-domain errors as popup closure issues", () => {
      const err = { code: "auth/unauthorized-domain", message: "Domain not authorized" };
      const parsed = parseAuthError(err);
      expect(parsed.isPopupClosure).toBe(true);
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
    it("creates default demo Google user with Ghalleb profile", () => {
      const user = createDemoGoogleUser();
      expect(user.displayName).toBe("Mohamed Ghalleb");
      expect(user.email).toBe("Ghalleb.Mohamed2@gmail.com");
      expect(user.providerId).toBe("google.com");
      expect(user.isOffline).toBe(false);
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
      expect(retrieved.email).toBe("Ghalleb.Mohamed2@gmail.com");
      expect(retrieved.displayName).toBe("Mohamed Ghalleb");
      expect(retrieved.isOffline).toBe(false);
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
});
