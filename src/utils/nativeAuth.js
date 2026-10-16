import { IS_ANDROID } from "./audioRecorder.js";

/**
 * Déconnecte aussi la session NATIVE du plugin Capacitor sur Android.
 * Avec skipNativeAuth=false, le plugin ouvre sa propre session Firebase/
 * Google en plus de celle du SDK web ; ne déconnecter que le SDK web laisse
 * le compte Google en cache, et le sélecteur de compte réutilise alors
 * silencieusement le même compte (impossible d'en changer).
 */
export async function nativeSignOut() {
  if (!IS_ANDROID) return;
  try {
    const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
    await FirebaseAuthentication.signOut();
  } catch (err) {
    console.warn("Native sign-out failed:", err);
  }
}
