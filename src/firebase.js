import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
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
  apiKey: envApiKey || "AIzaSyDummyKeyForMockOnly",
  // Par défaut, dérivé du projet configuré : l'ancien repli fixe
  // "quran-app-demo.firebaseapp.com" ne correspondait pas au vrai projet dès
  // que VITE_FIREBASE_AUTH_DOMAIN manquait, cassant les flux popup/redirect.
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId || "quran-app-demo"}.firebaseapp.com`,
  projectId: envProjectId || "quran-app-demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "quran-app-demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:demo",
};

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

// Initialize Firestore with long-polling to prevent WebChannel streaming dropouts in proxies & containers
export const firebaseDb = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
});

// Suppress internal Firestore connection warnings when offline or unconfigured
setLogLevel("silent");

// If not configured with valid production credentials, stay in offline mode to avoid 10s backend connection timeouts
if (!isFirebaseConfigured) {
  disableNetwork(firebaseDb).catch(() => {});
}

export const googleProvider = new GoogleAuthProvider();

