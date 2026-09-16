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
  apiKey: envApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

// Initialize Firestore with long-polling to prevent WebChannel streaming dropouts in proxies & containers
export const firebaseDb = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
});

setLogLevel("silent");

if (!isFirebaseConfigured) {
  disableNetwork(firebaseDb).catch(() => {});
}

export const googleProvider = new GoogleAuthProvider();
