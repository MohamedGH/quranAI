import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
} from "firebase/auth";
import {
  initializeFirestore,
  setLogLevel,
  disableNetwork,
} from "firebase/firestore";

// ─── Firebase config ─────────────────────────────────────────────────────────
const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

export const isFirebaseConfigured = Boolean(
  envApiKey &&
  envProjectId &&
  !String(envApiKey).includes("Dummy") &&
  !String(envProjectId).includes("demo")
);

export const firebaseConfig = {
  apiKey: envApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Explicit browser dependencies: persistent auth + OAuth popup/redirect resolver.
// This avoids relying on platform defaults and keeps the auth state available
// after a full-page OAuth navigation.
export const firebaseAuth = initializeAuth(firebaseApp, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});

console.log("[AUTH] Firebase initialized", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  persistence: "indexedDBLocalPersistence + browserLocalPersistence",
  resolver: "browserPopupRedirectResolver",
});

export const firebaseDb = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
});

setLogLevel("silent");

if (!isFirebaseConfigured) {
  disableNetwork(firebaseDb).catch(() => {});
}

export const googleProvider = new GoogleAuthProvider();
