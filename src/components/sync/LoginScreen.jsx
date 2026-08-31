import React, { useState } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { IS_ANDROID } from "../../utils/audioRecorder.js";
import { firebaseAuth, googleProvider } from "../../firebase.js";

export function LoginScreen({ onLoggedIn }) {
  const [mode, setMode]         = useState("login"); // "login" | "register"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const handleEmail = async () => {
    setError(null);
    if (!email || !password) { setError("Remplissez tous les champs."); return; }
    setLoading(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
        onLoggedIn(cred.user);
      } else {
        const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
        onLoggedIn(cred.user);
      }
    } catch (e) {
      const msgs = {
        "auth/user-not-found":       "Aucun compte avec cet email.",
        "auth/wrong-password":       "Mot de passe incorrect.",
        "auth/email-already-in-use": "Email déjà utilisé.",
        "auth/weak-password":        "Mot de passe trop court (6 car. min).",
        "auth/invalid-email":        "Email invalide.",
        "auth/invalid-credential":   "Email ou mot de passe incorrect.",
      };
      setError(msgs[e.code] || e.message);
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(null); setLoading(true);
    try {
      if (IS_ANDROID) {
        // Capacitor/Android: use native Google Sign-In via @capacitor-firebase/authentication
        // This avoids any WebView redirect / localhost callback issues
        const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
        const result = await FirebaseAuthentication.signInWithGoogle();
        // Link native credential to Firebase JS SDK so the rest of the app
        // (Firestore, onAuthStateChanged, etc.) works normally
        const { GoogleAuthProvider: GAP, signInWithCredential } = await import("firebase/auth");
        const credential = GAP.credential(result.credential.idToken);
        const cred = await signInWithCredential(firebaseAuth, credential);
        onLoggedIn(cred.user);
      } else {
        const cred = await signInWithPopup(firebaseAuth, googleProvider);
        onLoggedIn(cred.user);
      }
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") setError(e.message || String(e));
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight:"100vh", background:"var(--bg)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Cinzel',serif", padding:"20px",
    }}>
      <div style={{
        width:"100%", maxWidth:380,
        background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:16, padding:"36px 28px",
        boxShadow:"0 20px 60px rgba(0,0,0,.5)",
      }}>
        {/* Logo / title */}
        <div style={{textAlign:"center", marginBottom:32}}>
          <div style={{fontSize:36, marginBottom:8}}>☽</div>
          <div style={{fontSize:18, letterSpacing:4, color:"var(--gold)", fontWeight:600}}>QURAN</div>
          <div style={{fontSize:9, letterSpacing:6, color:"var(--text3)", marginTop:4}}>
            {mode === "login" ? "CONNEXION" : "CRÉER UN COMPTE"}
          </div>
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={loading} style={{
          width:"100%", padding:"12px 16px", borderRadius:10,
          border:"1px solid var(--border2)", background:"var(--surface2)",
          color:"var(--text)", fontSize:12, letterSpacing:2,
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          gap:10, marginBottom:20, transition:"border-color .2s",
        }}
          onMouseOver={e=>e.currentTarget.style.borderColor="var(--gold)"}
          onMouseOut={e=>e.currentTarget.style.borderColor="var(--border2)"}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.3-.1-2.6-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.2 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.3C9.7 38.9 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.1-2.2 3.9-4 5.2l6.2 5.2C36.5 41.8 44 36 44 24c0-1.3-.1-2.6-.4-3.9z"/>
          </svg>
          CONTINUER AVEC GOOGLE
        </button>

        {/* Divider */}
        <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:20}}>
          <div style={{flex:1, height:1, background:"var(--border)"}}/>
          <span style={{fontSize:9, letterSpacing:2, color:"var(--text3)"}}>OU</span>
          <div style={{flex:1, height:1, background:"var(--border)"}}/>
        </div>

        {/* Name (register only) */}
        {mode === "register" && (
          <input
            placeholder="Prénom (optionnel)"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
          />
        )}

        {/* Email */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleEmail()}
          style={inputStyle}
        />

        {/* Password */}
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleEmail()}
          style={{ ...inputStyle, marginBottom: 20 }}
        />

        {/* Error */}
        {error && (
          <div style={{
            background:"rgba(224,90,90,.12)", border:"1px solid rgba(224,90,90,.3)",
            borderRadius:8, padding:"10px 14px", fontSize:11, color:"var(--red)",
            marginBottom:16, letterSpacing:.5,
          }}>{error}</div>
        )}

        {/* Submit */}
        <button onClick={handleEmail} disabled={loading} style={{
          width:"100%", padding:"13px 16px", borderRadius:10,
          border:"none", background:"linear-gradient(135deg,var(--gold),var(--gold2))",
          color:"#0c0e14", fontSize:11, letterSpacing:3, fontWeight:700,
          cursor:"pointer", marginBottom:16, fontFamily:"'Cinzel',serif",
          opacity: loading ? .6 : 1, transition:"opacity .2s",
        }}>
          {loading ? "…" : mode === "login" ? "SE CONNECTER" : "CRÉER LE COMPTE"}
        </button>

        {/* Toggle */}
        <div style={{textAlign:"center", fontSize:10, letterSpacing:1, color:"var(--text3)"}}>
          {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
          <span
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            style={{color:"var(--gold)", cursor:"pointer", letterSpacing:1}}
          >
            {mode === "login" ? "S'inscrire" : "Se connecter"}
          </span>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width:"100%", padding:"12px 14px", borderRadius:10,
  border:"1px solid var(--border2)", background:"var(--surface2)",
  color:"var(--text)", fontSize:13, marginBottom:12,
  outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  letterSpacing:.5,
};

// ─── Sync log (shared mutable ref, no re-render cost) ────────────────────────
