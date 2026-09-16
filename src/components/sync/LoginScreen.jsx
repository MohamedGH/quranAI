import React, { useState, useEffect } from "react";
import {
  getRedirectResult,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { IS_ANDROID } from "../../utils/audioRecorder.js";
import { firebaseAuth, googleProvider } from "../../firebase.js";
import {
  isIframeEnvironment,
  parseAuthError,
  createDemoGoogleUser,
  createOfflineUser,
  createLocalEmailUser,
  saveSessionUser,
  openAppInNewTab,
  DEFAULT_GOOGLE_USER,
} from "../../utils/authManager.js";

export function LoginScreen({ onLoggedIn }) {
  const [mode, setMode]                 = useState("login"); // "login" | "register"
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [name, setName]                 = useState("");
  const [error, setError]               = useState(null);
  const [loading, setLoading]           = useState(false);
  const [showIframeModal, setShowIframeModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState(DEFAULT_GOOGLE_USER.email);
  const [customGoogleName, setCustomGoogleName]   = useState(DEFAULT_GOOGLE_USER.displayName);
  const [isIframe, setIsIframe]         = useState(false);

  useEffect(() => {
    setIsIframe(isIframeEnvironment());

    // Complete a Google redirect login after Firebase returns to the app.
    let cancelled = false;
    getRedirectResult(firebaseAuth)
      .then((result) => {
        if (!cancelled && result?.user) {
          handleSuccessfulLogin(result.user);
        }
      })
      .catch((redirectErr) => {
        if (!cancelled) {
          const parsed = parseAuthError(redirectErr);
          setError(parsed.userFriendlyMessage);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSuccessfulLogin = (user) => {
    saveSessionUser(user);
    onLoggedIn(user);
  };

  const handleEmail = async () => {
    setError(null);
    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        try {
          const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
          if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
          handleSuccessfulLogin(cred.user);
        } catch (fbErr) {
          if (fbErr.code === "auth/operation-not-allowed") {
            const localUser = createLocalEmailUser(email, name);
            handleSuccessfulLogin(localUser);
            return;
          }
          throw fbErr;
        }
      } else {
        try {
          const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
          handleSuccessfulLogin(cred.user);
        } catch (fbErr) {
          if (fbErr.code === "auth/operation-not-allowed") {
            const localUser = createLocalEmailUser(email, name);
            handleSuccessfulLogin(localUser);
            return;
          }
          throw fbErr;
        }
      }
    } catch (e) {
      const parsed = parseAuthError(e);
      setError(parsed.userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);

    try {
      if (IS_ANDROID) {
        const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
        const result = await FirebaseAuthentication.signInWithGoogle();
        const { GoogleAuthProvider: GAP, signInWithCredential } = await import("firebase/auth");
        const credential = GAP.credential(result.credential.idToken);
        const cred = await signInWithCredential(firebaseAuth, credential);
        handleSuccessfulLogin(cred.user);
      } else {
        // Use redirect instead of signInWithPopup. Redirect does not poll
        // window.closed and therefore avoids the COOP blank-popup failure.
        await signInWithRedirect(firebaseAuth, googleProvider);
      }
    } catch (e) {
      const parsed = parseAuthError(e);
      if (parsed.isPopupClosure || isIframe) {
        setShowIframeModal(true);
      }
      setError(parsed.userFriendlyMessage);
      setLoading(false);
    }
  };

  const handleQuickGoogleLogin = (emailOverride, nameOverride) => {
    const user = createDemoGoogleUser({
      email: emailOverride || customGoogleEmail || DEFAULT_GOOGLE_USER.email,
      displayName: nameOverride || customGoogleName || DEFAULT_GOOGLE_USER.displayName,
    });
    handleSuccessfulLogin(user);
  };

  const handleOfflineLogin = () => {
    handleSuccessfulLogin(createOfflineUser());
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Cinzel', serif",
      padding: "16px",
      boxSizing: "border-box",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "32px 24px",
        boxShadow: "0 20px 60px rgba(0,0,0,.5)",
        position: "relative",
      }}>
        {isIframe && (
          <div style={{
            background: "rgba(201, 168, 76, 0.08)",
            border: "1px solid rgba(201, 168, 76, 0.25)",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 20,
            fontSize: 10,
            color: "var(--gold2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            letterSpacing: 0.5,
          }}>
            <span>Aperçu dans l'iframe</span>
            <button onClick={openAppInNewTab} style={{ background: "transparent", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: 10, fontWeight: 600, textDecoration: "underline", fontFamily: "inherit" }}>
              Plein écran ↗
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>☽</div>
          <div style={{ fontSize: 18, letterSpacing: 4, color: "var(--gold)", fontWeight: 600 }}>QURAN</div>
          <div style={{ fontSize: 9, letterSpacing: 5, color: "var(--text3)", marginTop: 4 }}>
            {mode === "login" ? "CONNEXION" : "CRÉER UN COMPTE"}
          </div>
        </div>

        <button onClick={handleGoogle} disabled={loading} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 11.5, letterSpacing: 2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12, transition: "all .2s", opacity: loading ? 0.7 : 1 }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.3-.1-2.6-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.2 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.3C9.7 38.9 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.1-2.2 3.9-4 5.2l6.2 5.2C36.5 41.8 44 36 44 24c0-1.3-.1-2.6-.4-3.9z"/>
          </svg>
          CONTINUER AVEC GOOGLE
        </button>

        <div style={{ marginBottom: 20, textAlign: "center" }}>
          <button type="button" onClick={() => handleQuickGoogleLogin()} style={{ background: "transparent", border: "none", color: "var(--gold)", fontSize: 10, letterSpacing: 1, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: "4px 8px" }}>
            ⚡ Connexion rapide 1-clic ({DEFAULT_GOOGLE_USER.displayName})
          </button>
        </div>

        {showIframeModal && (
          <div style={{ background: "rgba(20, 24, 34, 0.95)", border: "1px solid var(--gold)", borderRadius: 12, padding: "16px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold2)", marginBottom: 6 }}>🛡️ Sécurité Navigateur (Iframe)</div>
            <p style={{ fontSize: 10.5, color: "var(--text2)", lineHeight: 1.5, marginBottom: 12 }}>
              Le navigateur bloque cette prévisualisation. Ouvrez l'application dans un nouvel onglet pour terminer la connexion Google.
            </p>
            <button onClick={openAppInNewTab} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, var(--gold), var(--gold2))", color: "#0c0e14", fontSize: 10.5, fontWeight: 700, cursor: "pointer", marginBottom: 8, letterSpacing: 1, fontFamily: "inherit" }}>
              Ouvrir plein écran ↗
            </button>
            <button onClick={() => setShowIframeModal(false)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border2)", background: "transparent", color: "var(--text3)", fontSize: 9.5, cursor: "pointer", fontFamily: "inherit" }}>
              Fermer
            </button>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 9, letterSpacing: 2, color: "var(--text3)" }}>OU</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {mode === "register" && (
          <input placeholder="Prénom (optionnel)" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        )}

        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmail()} style={inputStyle} />
        <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmail()} style={{ ...inputStyle, marginBottom: 16 }} />

        {error && (
          <div style={{ background: "rgba(224,90,90,.12)", border: "1px solid rgba(224,90,90,.3)", borderRadius: 8, padding: "10px 14px", fontSize: 10.5, color: "var(--red)", marginBottom: 16, lineHeight: 1.4, letterSpacing: 0.5 }}>
            {error}
          </div>
        )}

        <button onClick={handleEmail} disabled={loading} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,var(--gold),var(--gold2))", color: "#0c0e14", fontSize: 11, letterSpacing: 3, fontWeight: 700, cursor: "pointer", marginBottom: 16, fontFamily: "'Cinzel',serif", opacity: loading ? 0.6 : 1, transition: "opacity .2s" }}>
          {loading ? "…" : mode === "login" ? "SE CONNECTER" : "CRÉER LE COMPTE"}
        </button>

        <div style={{ textAlign: "center", fontSize: 10, letterSpacing: 1, color: "var(--text3)" }}>
          {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
          <span onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }} style={{ color: "var(--gold)", cursor: "pointer", letterSpacing: 1 }}>
            {mode === "login" ? "S'inscrire" : "Se connecter"}
          </span>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)", textAlign: "center" }}>
          <button type="button" onClick={handleOfflineLogin} style={{ background: "transparent", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 14px", color: "var(--text2)", fontSize: 9.5, letterSpacing: 1.5, cursor: "pointer", fontFamily: "'Cinzel',serif", transition: "all .2s" }}>
            CONTINUER SANS COMPTE (HORS-LIGNE)
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--border2)",
  background: "var(--surface2)",
  color: "var(--text)",
  fontSize: 13,
  marginBottom: 12,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  letterSpacing: 0.5,
};
