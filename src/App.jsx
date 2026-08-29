import React,{ useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from "react-router-dom";
import { Provider, useSelector, useDispatch, shallowEqual } from "react-redux";
import { store, sel, uiActions, quranActions, playerActions, learnActions, collectionsActions, voiceActions, goalsActions, setLDataThunk } from "./store";
import { CapacitorAudioRecorder } from '@capgo/capacitor-audio-recorder';
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";

// â”€â”€â”€ Firebase config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Replace with your actual Firebase project config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForMockOnly",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "quran-app-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "quran-app-demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "quran-app-demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:demo",
};
const firebaseApp  = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const firebaseDb   = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// â”€â”€â”€ Android / Capacitor detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const IS_ANDROID = typeof window !== 'undefined' &&
  (typeof window.Capacitor !== 'undefined' && /Android/i.test(navigator.userAgent));

// â”€â”€â”€ Unified audio recorder abstraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Android APK  â†’ CapacitorAudioRecorder
// Web / iOS    â†’ MediaRecorder
// API: { start(), stop() â†’ Promise<blobUrl|null>, release() }
function createAudioRecorder() {
  if (IS_ANDROID) {
    let _started = false;
    return {
      async start() {
        const perm = await CapacitorAudioRecorder.requestPermission().catch(() => null);
        if (perm?.granted === false) throw new Error("Permission microphone refusÃ©e");
        await CapacitorAudioRecorder.startRecording();
        _started = true;
      },
      async stop() {
        if (!_started) return null;
        _started = false;
        const result = await CapacitorAudioRecorder.stopRecording();
        // PrioritÃ© Ã  result.uri + Capacitor.convertFileSrc (chemin natif â†’ URL lisible par WebView)
        if (result?.uri) {
          return window.Capacitor?.convertFileSrc(result.uri) ?? result.uri;
        }
        // Fallback base64
        const raw = result?.value ?? result?.recordDataBase64 ?? result?.blob ?? null;
        if (!raw) return null;
       // const bin = atob(raw); const buf = new Uint8Array(bin.length);
       // for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return URL.createObjectURL(raw);
      },
      release() { if (_started) { CapacitorAudioRecorder.stopRecording().catch(()=>{}); _started = false; } },
    };
  }
  // Web MediaRecorder with gain boost
  let _stream, _mr, _chunks = [], _mime = "", _actx = null;
  return {
    async start(gainValue = 4.0) {
      _stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      // Boost volume via WebAudio GainNode â†’ record the boosted stream
      let recordStream = _stream;
      try {
        _actx = new (window.AudioContext || window.webkitAudioContext)();
        const src  = _actx.createMediaStreamSource(_stream);
        const gain = _actx.createGain();
        gain.gain.value = gainValue;
        const dst  = _actx.createMediaStreamDestination();
        src.connect(gain);
        gain.connect(dst);
        recordStream = dst.stream;
      } catch (e) {
        console.warn("[Recorder] GainNode unavailable, recording raw:", e);
        recordStream = _stream;
      }

      _mime = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4"]
        .find(m => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || "";
      _mr = new MediaRecorder(recordStream, _mime ? { mimeType: _mime } : undefined);
      _chunks = [];
      _mr.ondataavailable = e => { if (e.data?.size > 0) _chunks.push(e.data); };
      _mr.start(200);
    },
    stop() {
      return new Promise(resolve => {
        if (!_mr || _mr.state === "inactive") { resolve(null); return; }
        _mr.onstop = () => {
          _stream?.getTracks().forEach(t => t.stop());
          try { _actx?.close(); } catch {}
          _actx = null;
          resolve(_chunks.length ? URL.createObjectURL(new Blob(_chunks, { type: _mime || "audio/webm" })) : null);
        };
        _mr.stop();
      });
    },
    release() {
      try { if (_mr?.state !== "inactive") _mr?.stop(); } catch {}
      _stream?.getTracks().forEach(t => t.stop());
      try { _actx?.close(); } catch {}
      _actx = null;
    },
  };
}


// â”€â”€â”€ SURAH NAME MAP (French + Arabic + English for voice recognition) â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SURAH_NAMES = {
  "fatiha":1,"al-fatiha":1,"fatihah":1,"ouverture":1,
  "baqara":2,"al-baqara":2,"vache":2,"bakara":2,
  "imran":3,"al-imran":3,"famille d'imran":3,
  "nisa":4,"an-nisa":4,"femmes":4,
  "maida":5,"al-maida":5,"table":5,
  "anam":6,"al-anam":6,"troupeaux":6,
  "araf":7,"al-araf":7,"murailles":7,
  "anfal":8,"al-anfal":8,"dÃ©pouilles":8,
  "tawba":9,"at-tawba":9,"repentir":9,
  "yunus":10,"younes":10,"jonas":10,
  "hud":11,"houd":11,
  "yusuf":12,"youssef":12,"joseph":12,
  "rad":13,"ar-rad":13,"tonnerre":13,
  "ibrahim":14,"abraham":14,
  "hijr":15,"al-hijr":15,
  "nahl":16,"an-nahl":16,"abeilles":16,
  "isra":17,"al-isra":17,"voyage nocturne":17,
  "kahf":18,"al-kahf":18,"caverne":18,
  "maryam":19,"marie":19,
  "taha":20,"ta-ha":20,
  "anbiya":21,"al-anbiya":21,"prophÃ¨tes":21,
  "hajj":22,"pÃ¨lerinage":22,
  "muminun":23,"croyants":23,
  "nur":24,"an-nur":24,"lumiÃ¨re":24,
  "furqan":25,"al-furqan":25,"critÃ¨re":25,
  "shuara":26,"poÃ¨tes":26,
  "naml":27,"an-naml":27,"fourmis":27,
  "qasas":28,"al-qasas":28,"rÃ©cits":28,
  "ankabut":29,"araignÃ©e":29,
  "rum":30,"ar-rum":30,"romains":30,
  "luqman":31,"lokman":31,
  "sajda":32,"as-sajda":32,"prosternation":32,
  "ahzab":33,"al-ahzab":33,"coalisÃ©s":33,
  "saba":34,"saba'":34,
  "fatir":35,"crÃ©ateur":35,
  "yasin":36,"ya-sin":36,
  "saffat":37,"as-saffat":37,"rangÃ©s":37,
  "sad":38,
  "zumar":39,"az-zumar":39,"groupes":39,
  "ghafir":40,"al-ghafir":40,"pardonneur":40,
  "fussilat":41,"explicitement":41,
  "shura":42,"ash-shura":42,"concertation":42,
  "zukhruf":43,"az-zukhruf":43,"ornements":43,
  "dukhan":44,"ad-dukhan":44,"fumÃ©e":44,
  "jathiya":45,"al-jathiya":45,"agenouillÃ©e":45,
  "ahqaf":46,"al-ahqaf":46,
  "muhammad":47,"combat":47,
  "fath":48,"al-fath":48,"victoire":48,
  "hujurat":49,"al-hujurat":49,"appartements":49,
  "qaf":50,
  "dhariyat":51,"adh-dhariyat":51,"vents":51,
  "tur":52,"at-tur":52,"mont":52,
  "najm":53,"an-najm":53,"Ã©toile":53,
  "qamar":54,"al-qamar":54,"lune":54,
  "rahman":55,"ar-rahman":55,"misÃ©ricordieux":55,
  "waqia":56,"al-waqia":56,"Ã©vÃ©nement":56,
  "hadid":57,"al-hadid":57,"fer":57,
  "mujadila":58,"al-mujadila":58,"discussion":58,
  "hashr":59,"al-hashr":59,"rassemblement":59,
  "mumtahana":60,"al-mumtahana":60,"Ã©prouvÃ©e":60,
  "saff":61,"as-saff":61,"rang":61,
  "juma":62,"al-juma":62,"vendredi":62,
  "munafiqun":63,"hypocrites":63,
  "taghabun":64,"at-taghabun":64,"tromperie":64,
  "talaq":65,"at-talaq":65,"divorce":65,
  "tahrim":66,"at-tahrim":66,"interdiction":66,
  "mulk":67,"al-mulk":67,"royautÃ©":67,
  "qalam":68,"al-qalam":68,"plume":68,
  "haqqa":69,"al-haqqa":69,"inÃ©vitable":69,
  "maarij":70,"al-maarij":70,"degrÃ©s":70,
  "nuh":71,"noÃ©":71,
  "jinn":72,"al-jinn":72,"djinns":72,
  "muzzammil":73,"al-muzzammil":73,"enveloppÃ©":73,
  "muddaththir":74,"al-muddaththir":74,"revÃªtu":74,
  "qiyama":75,"al-qiyama":75,"rÃ©surrection":75,
  "insan":76,"al-insan":76,"homme":76,
  "mursalat":77,"al-mursalat":77,"envoyÃ©s":77,
  "naba":78,"an-naba":78,"nouvelle":78,
  "naziat":79,"an-naziat":79,"arracheurs":79,
  "abasa":80,"froncement":80,
  "takwir":81,"at-takwir":81,"obscurcissement":81,
  "infitar":82,"al-infitar":82,"fissure":82,
  "mutaffifin":83,"fraudeurs":83,
  "inshiqaq":84,"al-inshiqaq":84,"dÃ©chirement":84,
  "buruj":85,"al-buruj":85,"constellations":85,
  "tariq":86,"at-tariq":86,"nocturne":86,
  "ala":87,"al-ala":87,"trÃ¨s-haut":87,
  "ghashiya":88,"al-ghashiya":88,"enveloppante":88,
  "fajr":89,"al-fajr":89,"aube":89,
  "balad":90,"al-balad":90,"citÃ©":90,
  "shams":91,"ash-shams":91,"soleil":91,
  "layl":92,"al-layl":92,"nuit":92,
  "duha":93,"ad-duha":93,"matinÃ©e":93,
  "sharh":94,"inshirah":94,"ouverture de cÅ“ur":94,
  "tin":95,"at-tin":95,"figuier":95,
  "alaq":96,"al-alaq":96,"adhÃ©rence":96,
  "qadr":97,"al-qadr":97,"destin":97,
  "bayyina":98,"al-bayyina":98,"preuve":98,
  "zalzala":99,"az-zalzala":99,"sÃ©isme":99,
  "adiyat":100,"al-adiyat":100,"coursiers":100,
  "qaria":101,"al-qaria":101,"fracas":101,
  "takathur":102,"at-takathur":102,"accumulation":102,
  "asr":103,"al-asr":103,"aprÃ¨s-midi":103,
  "humaza":104,"al-humaza":104,"calomniateur":104,
  "fil":105,"al-fil":105,"Ã©lÃ©phant":105,
  "quraysh":106,"corÃ©ishites":106,
  "maun":107,"al-maun":107,"ustensiles":107,
  "kawthar":108,"al-kawthar":108,"abondance":108,
  "kafirun":109,"al-kafirun":109,"infidÃ¨les":109,
  "nasr":110,"an-nasr":110,"secours":110,
  "masad":111,"al-masad":111,"fibre":111,
  "ikhlas":112,"al-ikhlas":112,"sincÃ©ritÃ©":112,
  "falaq":113,"al-falaq":113,"aube naissante":113,
  "nas":114,"an-nas":114,"humanitÃ©":114,
};

// â”€â”€â”€ STYLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Amiri:wght@400;700&family=Cinzel:wght@400;600;700&display=swap');

  /* â”€â”€ TOKENS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  :root {
    --bg:#0c0e14; --surface:#13161f; --surface2:#1a1e2a; --surface3:#222736;
    --border:#2a2f40; --border2:#363c52;
    --gold:#c9a84c; --gold2:#e8c96e; --gold3:#f5e0a0;
    --teal:#3eb8a0; --teal2:#56d4bc; --red:#e05a5a; --green:#4caf81; --green2:#6fcf9a;
    --text:#e8e4d8; --text2:#a89f8c; --text3:#6e6659;
    --learned-bg:#1a2e20; --learned-border:#2d5a38; --highlight:rgba(201,168,76,.18);
    --sidebar-w:280px; --player-h:64px; --player-loop-h:50px;
    --header-h:calc(54px + env(safe-area-inset-top, 0px));
    --radius:8px; --radius-sm:5px;
    --transition:.18s ease;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html{font-size:16px;}
  body{background:var(--bg);color:var(--text);font-family:'Cinzel',serif;min-height:100dvh;overflow-x:hidden;-webkit-tap-highlight-color:transparent;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:var(--surface);}
  ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}
  .app{display:flex;flex-direction:column;height:100dvh;overflow:hidden;}

  /* â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .header{
    background:linear-gradient(180deg,rgba(16,19,30,0.95) 0%,rgba(10,12,20,0.98) 100%);
    backdrop-filter:blur(20px) saturate(160%);
    -webkit-backdrop-filter:blur(20px) saturate(160%);
    border-bottom:1px solid rgba(201,168,76,.18);
    padding:max(env(safe-area-inset-top, 0px), 0px) 14px 0 14px;
    height:var(--header-h);
    display:flex; align-items:center; justify-content:space-between; gap:8px;
    flex-shrink:0; position:relative; z-index:200;
    box-shadow:0 4px 24px rgba(0,0,0,.45);
    user-select:none;
  }
  .header::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent 0%,rgba(201,168,76,.5) 50%,transparent 100%);}
  .header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent 0%,rgba(201,168,76,.25) 50%,transparent 100%);}
  
  .header-left{display:flex;align-items:center;gap:10px;flex-shrink:0;}
  .header-menu-btn{display:flex;width:38px;height:38px;border-radius:10px;border:1px solid rgba(201,168,76,.22);background:rgba(201,168,76,.06);color:var(--text2);cursor:pointer;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;transition:all .2s cubic-bezier(0.4, 0, 0.2, 1);-webkit-tap-highlight-color:transparent;}
  .header-menu-btn:hover{border-color:rgba(201,168,76,.6);color:var(--gold2);background:rgba(201,168,76,.14);box-shadow:0 0 12px rgba(201,168,76,.2);}
  .header-menu-btn:active{transform:scale(0.94);}
  
  .header-logo{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1;font-size:15px;font-weight:700;letter-spacing:2.5px;color:var(--gold2);flex-shrink:0;text-shadow:0 0 20px rgba(201,168,76,.35);cursor:pointer;}
  .header-logo span.logo-highlight{color:var(--teal);text-shadow:0 0 16px rgba(62,184,160,.45);}
  .header-logo .header-subtitle{font-size:6.5px;letter-spacing:3px;color:var(--text3);font-family:'Cinzel',serif;opacity:.8;}
  .header-bismillah{font-family:'Amiri Quran',serif;font-size:20px;color:var(--gold);opacity:.7;margin-left:auto;direction:rtl;}

  /* â”€â”€ HEADER PAGE NAV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .header-nav{display:flex;align-items:center;gap:3px;flex:1;max-width:540px;min-width:0;background:rgba(255,255,255,.035);border-radius:12px;padding:3px;border:1px solid rgba(255,255,255,.07);box-shadow:inset 0 1px 3px rgba(0,0,0,.3);overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
  .header-nav::-webkit-scrollbar{display:none;}
  
  .header-nav-btn{font-family:'Cinzel',serif;font-size:9px;font-weight:600;letter-spacing:.8px;padding:6px 10px;border:1px solid transparent;background:transparent;color:var(--text3);cursor:pointer;border-radius:8px;transition:all .2s cubic-bezier(0.4, 0, 0.2, 1);white-space:nowrap;flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:5px;-webkit-tap-highlight-color:transparent;}
  .header-nav-btn:hover{color:var(--text2);background:rgba(255,255,255,.06);}
  .header-nav-btn:active{transform:scale(0.96);}
  .header-nav-btn .nav-icon{font-size:14px;line-height:1;display:inline-flex;align-items:center;justify-content:center;}
  .header-nav-btn.active-quran{background:linear-gradient(135deg,rgba(201,168,76,.22),rgba(201,168,76,.1));color:var(--gold2);border-color:rgba(201,168,76,.3);box-shadow:0 2px 10px rgba(201,168,76,.18),inset 0 1px 0 rgba(201,168,76,.2);}
  .header-nav-btn.active-prononciation{background:linear-gradient(135deg,rgba(62,184,160,.22),rgba(62,184,160,.1));color:var(--teal2);border-color:rgba(62,184,160,.3);box-shadow:0 2px 10px rgba(62,184,160,.18),inset 0 1px 0 rgba(62,184,160,.2);}
  .header-nav-btn.active-dashboard{background:linear-gradient(135deg,rgba(111,207,154,.22),rgba(111,207,154,.1));color:var(--green2);border-color:rgba(111,207,154,.3);box-shadow:0 2px 10px rgba(111,207,154,.18),inset 0 1px 0 rgba(111,207,154,.2);}
  .header-nav-btn.active-concordance{background:linear-gradient(135deg,rgba(201,168,76,.22),rgba(201,168,76,.1));color:var(--gold2);border-color:rgba(201,168,76,.3);box-shadow:0 2px 10px rgba(201,168,76,.18),inset 0 1px 0 rgba(201,168,76,.2);}
  .header-nav-btn.active-collections{background:linear-gradient(135deg,rgba(200,120,255,.22),rgba(200,120,255,.1));color:#c878ff;border-color:rgba(200,120,255,.3);box-shadow:0 2px 10px rgba(200,120,255,.18),inset 0 1px 0 rgba(200,120,255,.2);}
  .header-nav-btn.active-revision{background:linear-gradient(135deg,rgba(86,212,188,.22),rgba(86,212,188,.1));color:var(--teal2);border-color:rgba(86,212,188,.3);box-shadow:0 2px 10px rgba(86,212,188,.18),inset 0 1px 0 rgba(86,212,188,.2);}

  /* â”€â”€ RIGHT ACTION BUTTONS & USER MENU â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .header-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;position:relative;}
  .voice-btn{width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:var(--text2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .2s cubic-bezier(0.4, 0, 0.2, 1);flex-shrink:0;-webkit-tap-highlight-color:transparent;}
  .voice-btn:hover{border-color:rgba(201,168,76,.4);color:var(--gold2);background:rgba(201,168,76,.1);}
  .voice-btn:active{transform:scale(0.94);}
  .voice-btn.listening{border-color:var(--red);color:var(--red);animation:pulse 1.2s ease-in-out infinite;background:rgba(224,90,90,.14);}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(224,90,90,.45);}50%{box-shadow:0 0 0 8px rgba(224,90,90,0);}}

  .header-user-btn{display:flex;align-items:center;justify-content:center;padding:2px;border-radius:50%;border:1.5px solid rgba(201,168,76,.35);background:transparent;cursor:pointer;transition:all .2s cubic-bezier(0.4, 0, 0.2, 1);flex-shrink:0;-webkit-tap-highlight-color:transparent;}
  .header-user-btn:hover,.header-user-btn.active{border-color:var(--gold2);box-shadow:0 0 12px rgba(201,168,76,.35);transform:scale(1.05);}
  .header-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;}
  .header-avatar-placeholder{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#c9a84c,#e8c96e);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#0c0e14;font-family:'Cinzel',serif;}

  /* Dropdown User Menu */
  .header-user-menu{position:absolute;top:calc(100% + 8px);right:0;width:250px;background:rgba(19,22,31,.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(201,168,76,.25);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.05);padding:8px;z-index:300;display:flex;flex-direction:column;gap:4px;animation:menuFadeIn .2s cubic-bezier(0.16, 1, 0.3, 1);}
  @keyframes menuFadeIn{from{opacity:0;transform:translateY(-8px) scale(0.96);}to{opacity:1;transform:translateY(0) scale(1);}}
  .user-menu-header{padding:8px 10px 10px 10px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:4px;}
  .user-menu-name{font-family:'Cinzel',serif;font-size:11px;font-weight:600;color:var(--gold2);letter-spacing:.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .user-menu-email{font-size:9.5px;color:var(--text3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .user-menu-item{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;border:none;background:transparent;color:var(--text);cursor:pointer;font-family:'Cinzel',serif;font-size:10px;letter-spacing:.5px;transition:all .15s ease;text-align:left;width:100%;}
  .user-menu-item:hover{background:rgba(201,168,76,.1);color:var(--gold2);}
  .user-menu-item .menu-left{display:flex;align-items:center;gap:8px;}
  .user-menu-badge{font-size:8px;padding:2px 6px;border-radius:6px;letter-spacing:.5px;}
  .user-menu-badge.on{background:rgba(62,184,160,.2);color:var(--teal2);border:1px solid rgba(62,184,160,.4);}
  .user-menu-badge.off{background:rgba(255,255,255,.05);color:var(--text3);}
  .user-menu-item.logout{color:var(--red);border-top:1px solid rgba(255,255,255,.06);margin-top:4px;padding-top:10px;}
  .user-menu-item.logout:hover{background:rgba(224,90,90,.1);color:#ff7b7b;}

  /* â”€â”€ TOAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .voice-toast{position:fixed;top:calc(var(--header-h) + 10px);left:50%;transform:translateX(-50%);background:var(--surface3);border:1px solid var(--border2);border-radius:var(--radius);padding:9px 18px;font-size:11px;letter-spacing:1px;color:var(--text2);z-index:500;display:flex;align-items:center;gap:10px;max-width:min(420px,90vw);box-shadow:0 8px 32px rgba(0,0,0,.4);}
  .voice-toast.success{border-color:var(--teal);color:var(--teal);}
  .voice-toast.error{border-color:var(--red);color:var(--red);}
  .voice-toast .transcript{color:var(--gold2);font-style:italic;}
  .voice-dot{width:8px;height:8px;border-radius:50%;background:var(--red);animation:pulse-dot 1s infinite;flex-shrink:0;}
  @keyframes pulse-dot{0%,100%{opacity:1;}50%{opacity:.3;}}

  /* â”€â”€ VOICE HELP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .voice-help{position:fixed;top:calc(var(--header-h) + 10px);right:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px 18px;z-index:400;max-width:260px;box-shadow:0 8px 32px rgba(0,0,0,.4);}
  .voice-help-title{font-size:10px;letter-spacing:2px;color:var(--gold);margin-bottom:10px;}
  .voice-help-cmd{font-size:10px;letter-spacing:.5px;color:var(--text3);padding:3px 0;display:flex;gap:8px;align-items:baseline;}
  .voice-help-ex{color:var(--text2);font-size:10px;}

  /* â”€â”€ BODY / SIDEBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .body{display:flex;flex:1;overflow:hidden;position:relative;}

  .sidebar{
    width:var(--sidebar-w); background:var(--surface);
    border-right:1px solid var(--border);
    display:flex; flex-direction:column;
    flex-shrink:0; overflow:hidden;
    transition:transform var(--transition), width var(--transition);
  }
  /* On non-quran pages sidebar floats as a full-height drawer */
  .sidebar.sidebar-floating{
    position:absolute;left:0;top:0;bottom:0;z-index:300;
    transform:translateX(-100%);box-shadow:4px 0 24px rgba(0,0,0,.4);
  }
  .sidebar.sidebar-floating.open{transform:translateX(0);}
  /* On quran page desktop (non-floating): toggle width on open/close */
  @media (min-width:641px){
    .sidebar:not(.sidebar-floating):not(.open){
      width:0 !important;
      min-width:0 !important;
      border-right:none !important;
      overflow:hidden !important;
    }
    .sidebar:not(.sidebar-floating).open{
      width:var(--sidebar-w) !important;
    }
  }
  .sidebar-overlay{display:none;position:absolute;inset:0;z-index:299;background:rgba(0,0,0,.4);}
  .sidebar-overlay.open{display:block;}
  @media (min-width:641px){.sidebar-overlay.open{pointer-events:none;background:transparent;}}
  .sidebar-search{padding:12px;border-bottom:1px solid var(--border);}
  .sidebar-search input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;color:var(--text);font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;outline:none;transition:border-color var(--transition);}
  .sidebar-search input:focus{border-color:var(--gold);}
  .sidebar-search input::placeholder{color:var(--text3);}
  .sidebar-list{overflow-y:auto;flex:1;}
  .surah-item{display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;border-bottom:1px solid rgba(42,47,64,.5);transition:background var(--transition);position:relative;}
  .surah-item:hover{background:var(--surface2);}
  .surah-item.active{background:var(--surface3);}
  .surah-item.fully-learned{background:rgba(26,46,32,.45);border-right:2px solid var(--green);}
  .surah-item.fully-learned .surah-name-en{color:var(--green2);}
  .surah-item.fully-learned .surah-num{color:var(--green);border-color:var(--green);}
  .surah-item.fully-learned .surah-meta::before{content:'âœ“ ';color:var(--green);}
  .surah-item.active::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(to bottom,var(--gold),var(--teal));border-radius:0 2px 2px 0;}
  .surah-num{width:30px;height:30px;background:var(--surface2);border:1px solid var(--border);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--gold);font-weight:600;flex-shrink:0;}
  .surah-active .surah-num{background:var(--gold);color:var(--bg);border-color:var(--gold);}
  .surah-info{flex:1;min-width:0;}
  .surah-name-en{font-size:11px;letter-spacing:1px;color:var(--text);font-weight:600;}
  .surah-meta{font-size:9px;color:var(--text3);letter-spacing:.5px;margin-top:2px;}
  .surah-name-ar{font-family:'Amiri',serif;font-size:16px;color:var(--gold);direction:rtl;}

  /* â”€â”€ MAIN AREA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
  .surah-header{background:linear-gradient(180deg,var(--surface),var(--bg));border-bottom:1px solid var(--border);padding:10px 16px;flex-shrink:0;text-align:center;}
  .surah-header-ornament{font-family:'Amiri Quran',serif;font-size:26px;color:var(--gold2);direction:rtl;line-height:1.3;}
  .surah-header-title{font-size:9px;letter-spacing:2px;color:var(--gold);margin-top:3px;opacity:.8;}
  .surah-header-sub{font-size:9px;color:var(--text3);letter-spacing:2px;margin-top:2px;}
  .bismillah-line{font-family:'Amiri Quran',serif;font-size:26px;color:var(--gold);direction:rtl;text-align:center;padding:14px 24px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;opacity:.85;}

  /* â”€â”€ TS BAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .ts-global-bar{background:var(--surface2);border-bottom:1px solid var(--border);padding:6px 20px;display:flex;align-items:center;gap:8px;flex-shrink:0;position:relative;z-index:20;}
  .panel-row{position:relative;}
  .panel-expand{position:absolute;top:calc(100% + 4px);left:0;z-index:30;min-width:0;max-width:calc(100vw - 24px);}
  .tajweed-panel{display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--surface2);border-radius:8px;border:1px solid rgba(255,255,255,.12);flex-wrap:wrap;box-shadow:0 4px 16px rgba(0,0,0,.4);}
  @keyframes tajweedPanelIn{from{opacity:0;transform:scaleX(.9);transform-origin:left}to{opacity:1;transform:scaleX(1)}}
  .tajweed-panel{animation:tajweedPanelIn .18s cubic-bezier(.4,0,.2,1) forwards;}
  .ts-global-label{font-size:10px;letter-spacing:1px;color:var(--text3);}
  .ts-global-count{font-size:10px;letter-spacing:1px;color:var(--gold2);}
  .ts-drop-zone{border:1px dashed var(--border2);border-radius:var(--radius-sm);padding:5px 12px;cursor:pointer;transition:border-color var(--transition);display:flex;align-items:center;gap:8px;}
  .ts-drop-zone:hover{border-color:var(--gold);}
  .ts-drop-zone input{display:none;}
  .ts-drop-label{font-size:10px;letter-spacing:1px;color:var(--text3);}
  .ts-progress-bar{flex:1;min-width:80px;height:3px;background:var(--border);border-radius:2px;overflow:hidden;}
  .ts-progress-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--teal));border-radius:2px;transition:width .3s;}
  .ts-status{display:inline-flex;align-items:center;gap:5px;font-size:9px;letter-spacing:1px;padding:2px 8px;border-radius:10px;border:1px solid var(--border2);color:var(--text3);flex-shrink:0;align-self:flex-start;margin-top:6px;}
  .ts-status.loaded{border-color:var(--teal);color:var(--teal);}

  /* â”€â”€ AYAT LIST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .ayat-scroll{flex:1;overflow-y:auto;padding:6px 0 calc(var(--player-h) + var(--player-loop-h) + 20px);will-change:transform;}
  .ayat-row{border-bottom:1px solid rgba(42,47,64,.4);transition:background var(--transition);content-visibility:auto;contain-intrinsic-size:0 80px;}
  .ayat-row.playing{background:var(--highlight);}
  .ayat-row.playing .ayat-main{background:var(--highlight);}
  .ayat-row.current .ayat-number-badge{border-color:var(--gold);color:var(--gold);}
  .ayat-row.learned{background:var(--learned-bg);}
  .ayat-row.selecting{background:rgba(201,168,76,.03);}
  .ayat-row.learned .ayat-number-badge{border-color:var(--green);color:var(--green);}
  .ayat-row.page-start{position:relative;margin-top:22px;}
  .ayat-row.page-start::before{content:'';position:absolute;top:-11px;left:22px;right:22px;height:1px;background:linear-gradient(90deg,transparent,rgba(200,120,255,.15),#c878ff,rgba(200,120,255,.15),transparent);}
  .ayat-row.page-end{position:relative;margin-bottom:22px;}
  .ayat-row.page-end::after{content:'';position:absolute;bottom:-11px;left:22px;right:22px;height:1px;background:linear-gradient(90deg,transparent,rgba(200,120,255,.15),#c878ff,rgba(200,120,255,.15),transparent);}
  .page-edge-pill{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:5px;background:linear-gradient(135deg,#d896ff,#9a4fd1);color:#fff;font-size:7px;letter-spacing:2px;padding:4px 12px;border-radius:20px;font-family:'Cinzel',serif;box-shadow:0 3px 14px rgba(178,90,255,.45),0 0 0 3px var(--surface1,#12141c);white-space:nowrap;z-index:2;}
  .page-edge-pill.start{top:-11px;transform:translate(-50%,-50%);}
  .page-edge-pill.end{bottom:-11px;transform:translate(-50%,50%);}
  .page-edge-pill svg{width:8px;height:8px;}
  .ayat-main{display:flex;align-items:flex-start;gap:14px;padding:14px 22px;cursor:pointer;}
  .ayat-main:hover{background:rgba(255,255,255,.02);}
  .ayat-number-badge{width:32px;height:32px;border:1px solid var(--border2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3);flex-shrink:0;margin-top:4px;transition:all var(--transition);font-weight:600;}
  .ayat-playing .ayat-number-badge{border-color:var(--gold);color:var(--gold);box-shadow:0 0 12px rgba(201,168,76,.3);}
  .ayat-arabic{font-family:'Amiri Quran',serif;font-size:26px;line-height:2;direction:rtl;text-align:right;flex:1;min-width:0;overflow-wrap:break-word;word-break:break-word;color:var(--text);}
  .char-span{display:inline;transition:color .04s;color:var(--text);}
  .char-span.char-done{color:var(--teal);}
  .char-span.char-active{color:var(--gold2);text-shadow:0 0 14px rgba(232,201,110,.65);}
  .ayat-learned-badge{font-size:9px;letter-spacing:1px;color:var(--green);padding:2px 8px;border:1px solid var(--green);border-radius:10px;margin-top:6px;flex-shrink:0;align-self:flex-start;}

  /* â”€â”€ SUBMENU â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  @keyframes pageIn{from{opacity:0}to{opacity:1}}
  .page-anim{animation:pageIn .12s ease forwards;flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;width:100%;}
  @keyframes submenuIn{0%{opacity:0;transform:translateY(-4px)}100%{opacity:1;transform:translateY(0)}}
  @keyframes submenuOut{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-4px)}}
  .submenu{background:var(--surface2);border-top:1px solid var(--border);padding:14px 22px 18px;}
  .submenu-anim-wrap{animation:submenuIn .32s cubic-bezier(.4,0,.2,1) forwards;}
  .submenu-anim-wrap.closing{animation:submenuOut .24s cubic-bezier(.4,0,.2,1) forwards;}
  .submenu-header{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:14px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;flex-wrap:nowrap;}
  .submenu-header::-webkit-scrollbar{display:none;}
  .mode-btn{font-family:'Cinzel',serif;font-size:9px;letter-spacing:1.5px;padding:8px 14px;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text3);cursor:pointer;transition:all var(--transition);white-space:nowrap;flex-shrink:0;}
  .mode-btn:hover{color:var(--text2);}
  .mode-btn.active{color:var(--gold);border-bottom-color:var(--gold);}
  .submenu-tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:14px;overflow-x:auto;}
  .submenu-tab{font-size:9px;letter-spacing:1.5px;color:var(--text3);padding:8px 14px;background:transparent;border:none;cursor:pointer;border-bottom:2px solid transparent;transition:all var(--transition);white-space:nowrap;flex-shrink:0;}
  .submenu-tab:hover{color:var(--text2);}
  .submenu-tab.active{color:var(--gold);border-bottom-color:var(--gold);}

  /* â”€â”€ BUTTONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .btn-primary{font-family:'Cinzel',serif;font-size:9px;letter-spacing:1.5px;padding:8px 16px;border:1px solid var(--gold);background:transparent;color:var(--gold);cursor:pointer;border-radius:var(--radius-sm);transition:all var(--transition);}
  .btn-primary:hover{background:rgba(201,168,76,.12);}
  .btn-primary.active{background:var(--gold);color:var(--bg);}
  .btn-primary:disabled{opacity:.35;cursor:not-allowed;}
  .btn-small{font-family:'Cinzel',serif;font-size:9px;letter-spacing:1px;padding:5px 10px;border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;border-radius:var(--radius-sm);transition:all var(--transition);}
  .btn-small:hover{border-color:var(--text2);color:var(--text2);}
  .btn-small.done{border-color:var(--green);color:var(--green);}

  /* â”€â”€ LEARN SECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .learn-section{display:flex;flex-direction:column;gap:14px;}
  .learn-status-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
  .learn-stat{font-size:10px;letter-spacing:1px;color:var(--text3);display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--surface3);border-radius:var(--radius-sm);border:1px solid var(--border);}
  .learn-stat .val{color:var(--gold2);}
  .learn-stat.learned-stat{border-color:var(--green);color:var(--green);}
  .learn-stat.learned-stat .val{color:var(--green2);}
  .parts-title{font-size:9px;letter-spacing:2px;color:var(--text3);margin-bottom:8px;}
  .create-mode-hint{font-size:9px;letter-spacing:1px;color:var(--teal);margin-bottom:6px;padding:6px 10px;background:rgba(62,184,160,.06);border-radius:var(--radius-sm);}
  .words-area{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;direction:rtl;justify-content:flex-end;}
  .word-btn{font-family:'Amiri Quran',serif;font-size:18px;padding:4px 8px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;border-radius:var(--radius-sm);transition:all var(--transition);}
  .word-btn:hover{border-color:var(--gold);color:var(--gold);}
  .word-btn.word-learned{border-color:var(--green);color:var(--green2);background:rgba(76,175,129,.06);}
  .parts-divider{height:1px;background:var(--border);margin:8px 0;}
  .part-item{border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;overflow:hidden;}
  .part-item.part-learned{border-color:var(--learned-border);background:rgba(26,46,32,.3);}
  .part-header{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface3);}
  .part-label{font-size:10px;letter-spacing:1px;color:var(--text3);flex:1;}
  .part-arabic{font-family:'Amiri Quran',serif;font-size:18px;direction:rtl;text-align:right;padding:8px 12px 10px;color:var(--text2);line-height:1.8;}
  .part-learned .part-arabic{color:var(--green2);}

  /* â”€â”€ RECITATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .recit-section{display:flex;flex-direction:column;gap:0;margin-top:0;padding-top:16px;border-top:1px solid var(--border);}
  .recit-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;}
  .recit-title{font-size:9px;letter-spacing:3px;color:var(--text3);display:flex;align-items:center;gap:8px;font-family:'Cinzel',serif;}
  .recit-title-icon{width:26px;height:26px;border-radius:50%;background:rgba(62,184,160,.12);border:1px solid var(--teal);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;}
  .recit-tabs{display:flex;gap:0;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;margin-bottom:14px;}
  .recit-tab{flex:1;padding:8px 4px;font-family:'Cinzel',serif;font-size:9px;letter-spacing:1.5px;background:transparent;color:var(--text3);border:none;cursor:pointer;transition:all var(--transition);text-align:center;}
  .recit-tab:hover{background:rgba(255,255,255,.04);color:var(--text2);}
  .recit-tab.active{background:rgba(62,184,160,.1);color:var(--teal);border-bottom:2px solid var(--teal);}
  .recit-mic-zone{display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 16px;background:var(--surface3);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;transition:border-color .3s;}
  .recit-mic-zone.active{border-color:var(--red);background:rgba(224,90,90,.04);}
  .recit-mic-circle{width:64px;height:64px;border-radius:50%;border:2px solid var(--teal);background:rgba(62,184,160,.08);display:flex;align-items:center;justify-content:center;font-size:26px;cursor:pointer;transition:all .25s;position:relative;touch-action:manipulation;}
  .recit-mic-circle:hover,.recit-mic-circle:active{transform:scale(1.06);background:rgba(62,184,160,.16);}
  .recit-mic-circle.recording{border-color:var(--red);background:rgba(224,90,90,.12);animation:micPulse 1s ease-in-out infinite;}
  @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(224,90,90,.4)}50%{box-shadow:0 0 0 12px rgba(224,90,90,0)}}
  .recit-mic-label{font-family:'Cinzel',serif;font-size:9px;letter-spacing:2px;color:var(--text3);}
  .recit-mic-label.recording{color:var(--red);}
  .recit-live-box{width:100%;min-height:40px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:10px 14px;font-family:'Amiri Quran',serif;font-size:18px;direction:rtl;text-align:right;color:var(--text2);line-height:1.8;transition:border-color .2s;}
  .recit-live-box.has-text{border-color:var(--teal);}
  .recit-live-placeholder{color:var(--text3);font-family:'Cinzel',serif;font-size:9px;direction:ltr;text-align:center;letter-spacing:1px;padding:4px 0;}
  .recit-textarea{width:100%;background:var(--surface3);border:1px solid var(--border2);border-radius:var(--radius);padding:12px 16px;color:var(--text);font-family:'Amiri Quran',serif;font-size:22px;direction:rtl;text-align:right;resize:none;outline:none;line-height:1.8;transition:border-color var(--transition);margin-bottom:8px;}
  .recit-textarea:focus{border-color:var(--gold);}
  .recit-textarea::placeholder{color:var(--text3);font-family:'Cinzel',serif;font-size:11px;direction:ltr;text-align:left;}
  .recit-actions{display:flex;gap:8px;flex-wrap:wrap;}
  .recit-score-ring{display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px;background:var(--surface3);border-radius:12px;border:1px solid var(--border);margin-bottom:14px;}
  .recit-score-arc{position:relative;width:80px;height:80px;}
  .recit-score-arc svg{transform:rotate(-90deg);}
  .recit-score-arc-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:20px;font-weight:700;letter-spacing:-1px;}
  .recit-score-arc-num.perfect{color:var(--green2);}
  .recit-score-arc-num.good{color:var(--gold2);}
  .recit-score-arc-num.bad{color:var(--red);}
  .recit-score-label{font-family:'Cinzel',serif;font-size:9px;letter-spacing:2px;}
  .recit-score-label.perfect{color:var(--green2);}
  .recit-score-label.good{color:var(--gold2);}
  .recit-score-label.bad{color:var(--red);}
  .recit-compare{font-family:'Amiri Quran',serif;font-size:26px;direction:rtl;text-align:right;line-height:2.4;padding:12px 16px;background:var(--surface3);border-radius:var(--radius);border:1px solid var(--border);}
  .recit-char-ok{color:var(--green2);}
  .recit-char-near{color:#e8a020;text-decoration:underline wavy #e8a020;}
  .recit-char-err{color:var(--red);text-decoration:underline wavy var(--red);}
  .recit-char-miss{color:var(--border2);text-decoration:underline dotted var(--text3);}
  .recit-char-silent{color:var(--gold);opacity:0.65;font-style:italic;}
  .recit-wasl-fatha{color:var(--gold2);}
  .recit-wasl-damma{color:var(--teal);}
  .recit-wasl-kasra{color:var(--text2);}
  .recit-word-wrap{display:inline;margin:0 3px;}
  .recit-word-wrap.word-ok{border-bottom:2px solid rgba(76,175,129,.35);}
  .recit-word-wrap.word-err{border-bottom:2px solid rgba(224,90,90,.4);}
  .recit-word-wrap.word-del{color:var(--red);opacity:.5;text-decoration:line-through;}
  .recit-word-wrap.word-silent{}
  .recit-legend{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px;}
  .recit-legend-pill{display:inline-flex;align-items:center;gap:4px;font-family:'Cinzel',serif;font-size:8px;letter-spacing:1px;padding:3px 8px;border-radius:20px;opacity:.85;}
  .recit-replay{font-family:'Amiri Quran',serif;font-size:17px;direction:rtl;text-align:right;color:var(--text3);padding:8px 12px;background:var(--surface3);border-radius:var(--radius-sm);border:1px solid var(--border);margin-top:8px;line-height:1.8;}
  .recit-debug-toggle{margin-top:12px;width:100%;text-align:center;}
  .recit-debug-table{width:100%;border-collapse:collapse;font-size:11px;font-family:monospace;direction:ltr;}
  .recit-debug-table th{padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text3);font-size:9px;letter-spacing:1px;white-space:nowrap;background:var(--surface3);}
  .recit-debug-table td{padding:4px 8px;border-bottom:1px solid var(--border);vertical-align:top;}

  /* â”€â”€ REVISION PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .rev-page{flex:1;overflow-y:auto;padding:24px 28px 80px;display:flex;flex-direction:column;gap:20px;}
  .rev-header-block{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  .rev-title{font-size:18px;letter-spacing:3px;color:var(--gold2);font-weight:700;}
  .rev-subtitle{font-size:9px;letter-spacing:2px;color:var(--text3);margin-top:4px;}
  .rev-stats-row{display:flex;gap:10px;flex-wrap:wrap;}
  .rev-stat-pill{display:flex;flex-direction:column;align-items:center;padding:8px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);}
  .rev-stat-num{font-size:20px;color:var(--gold2);font-weight:700;}
  .rev-stat-label{font-size:8px;letter-spacing:1.5px;color:var(--text3);margin-top:2px;}
  .rev-filter-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
  .rev-filter-btn{font-family:'Cinzel',serif;font-size:9px;letter-spacing:1px;padding:5px 12px;border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;border-radius:var(--radius-sm);transition:all .2s;}
  .rev-filter-btn:hover{border-color:var(--text2);color:var(--text2);}
  .rev-filter-btn.active{border-color:var(--teal);color:var(--teal);background:rgba(62,184,160,.08);}
  .rev-surah-block{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);}
  .rev-surah-header{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;user-select:none;}
  .rev-surah-header:hover{background:rgba(255,255,255,.02);}
  .rev-surah-num{width:32px;height:32px;border-radius:50%;border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3);flex-shrink:0;}
  .rev-surah-name{flex:1;}
  .rev-surah-name-ar{font-family:'Amiri Quran',serif;font-size:18px;color:var(--text2);direction:rtl;}
  .rev-surah-name-en{font-size:10px;letter-spacing:1.5px;color:var(--text3);margin-top:2px;}
  .rev-surah-badge{font-size:9px;letter-spacing:1px;padding:3px 10px;border-radius:10px;border:1px solid var(--green);color:var(--green);white-space:nowrap;}
  .rev-ayat-grid{padding:0 16px 14px;display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--border);}
  .rev-ayat-card{border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;}
  .rev-ayat-card.rev-ayat-active{border-color:var(--teal);}
  .rev-ayat-card-header{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface2);cursor:pointer;}
  .rev-ayat-card-header:hover{background:var(--surface3);}
  .rev-ayat-num{width:28px;height:28px;border-radius:50%;border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text3);flex-shrink:0;}
  .rev-ayat-text-preview{font-family:'Amiri Quran',serif;font-size:15px;direction:rtl;color:var(--text2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;}
  .rev-ayat-score-badge{font-size:9px;letter-spacing:1px;padding:2px 8px;border-radius:10px;white-space:nowrap;flex-shrink:0;}
  .rev-ayat-score-badge.perfect{border:1px solid var(--green);color:var(--green);}
  .rev-ayat-score-badge.good{border:1px solid var(--gold);color:var(--gold);}
  .rev-ayat-score-badge.bad{border:1px solid var(--red);color:var(--red);}
  .rev-ayat-score-badge.none{border:1px solid var(--border2);color:var(--text3);}
  .rev-ayat-body{padding:14px 14px 10px;display:flex;flex-direction:column;gap:12px;}
  .rev-ayat-arabic{font-family:'Amiri Quran',serif;font-size:24px;direction:rtl;text-align:right;color:var(--text);line-height:1.9;padding:10px 14px;background:var(--surface2);border-radius:var(--radius-sm);}
  .rev-empty{text-align:center;padding:60px 20px;color:var(--text3);font-size:11px;letter-spacing:2px;}
  .rev-progress-bar{height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:4px;}
  .rev-progress-fill{height:100%;border-radius:2px;transition:width .4s ease;}
  .main-player{position:fixed;bottom:0;left:0;right:0;background:linear-gradient(0deg,var(--surface),rgba(19,22,31,.98));border-top:1px solid var(--border);z-index:200;backdrop-filter:blur(10px);}
  .main-player::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);}
  .player-row{display:flex;align-items:center;gap:14px;padding:8px 20px;height:var(--player-h);}
  .player-info{min-width:120px;max-width:180px;}
  .player-surah{font-size:9px;letter-spacing:1.5px;color:var(--gold);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .player-ayah{font-size:8px;letter-spacing:1px;color:var(--text3);margin-top:2px;}
  .player-controls{display:flex;align-items:center;gap:6px;}
  .ctrl-btn{width:32px;height:32px;border-radius:50%;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;transition:all var(--transition);flex-shrink:0;touch-action:manipulation;}
  .ctrl-btn:hover{border-color:var(--gold);color:var(--gold);}
  .ctrl-btn.play-btn{width:38px;height:38px;background:var(--gold);border-color:var(--gold);color:var(--bg);font-size:14px;}
  .ctrl-btn.play-btn:hover{background:var(--gold2);}
  .ctrl-btn.loop-on{border-color:var(--teal);color:var(--teal);background:rgba(62,184,160,.1);}
  .reciter-trigger{gap:5px;padding:0 10px;width:auto;min-width:44px;font-family:'Cinzel',serif;font-size:10px;}
  .reciter-trigger-label{max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .reciter-sheet-backdrop{position:fixed;inset:0;z-index:350;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);}
  .reciter-sheet{position:fixed;z-index:351;right:16px;bottom:76px;width:min(420px,calc(100vw - 32px));max-height:min(640px,calc(100dvh - 100px));display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border2);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.55);overflow:hidden;}
  .reciter-sheet-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;border-bottom:1px solid var(--border);}
  .reciter-sheet-title{font-family:'Cinzel',serif;font-size:12px;letter-spacing:2px;color:var(--gold2);}
  .reciter-sheet-current{font-size:10px;color:var(--text3);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .reciter-sheet-close{width:40px;height:40px;border-radius:50%;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:20px;cursor:pointer;flex-shrink:0;}
  .reciter-search{margin:12px 16px 8px;width:calc(100% - 32px);box-sizing:border-box;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:11px 12px;color:var(--text);font-size:16px;outline:none;}
  .reciter-search:focus{border-color:var(--gold);}
  .reciter-list{overflow-y:auto;padding:4px 12px 12px;overscroll-behavior:contain;}
  .reciter-option{width:100%;min-height:52px;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:9px;background:transparent;border:1px solid transparent;color:var(--text2);font-size:14px;text-align:left;cursor:pointer;}
  .reciter-option.selected{background:rgba(201,168,76,.12);border-color:var(--gold);color:var(--gold2);}
  .reciter-option-flag{font-size:20px;line-height:1;}
  .reciter-option-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .reciter-option-check{font-size:16px;color:var(--gold2);}
  .reciter-empty{padding:24px 12px;text-align:center;color:var(--text3);font-size:13px;}
  .reciter-sheet-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid var(--border);color:var(--text3);font-size:11px;}
  .reciter-reset{min-height:36px;padding:0 10px;border:1px solid var(--border2);border-radius:6px;background:transparent;color:var(--text2);font-size:11px;cursor:pointer;}
  .player-progress{flex:1;display:flex;align-items:center;gap:8px;min-width:0;}
  .progress-bar-wrap{flex:1;height:3px;background:var(--border);border-radius:2px;position:relative;}
  .progress-bar-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--teal));border-radius:2px;transition:width .3s;}
  .progress-range{position:absolute;top:0;height:100%;background:rgba(62,184,160,.3);border-radius:2px;pointer-events:none;}
  .progress-text{font-size:8px;color:var(--text3);letter-spacing:1px;white-space:nowrap;}
  .loop-bar{display:flex;align-items:center;gap:8px;padding:6px 20px 8px;border-top:1px solid rgba(42,47,64,.5);flex-wrap:wrap;}
  .loop-label{font-size:9px;letter-spacing:1.5px;color:var(--teal);flex-shrink:0;}
  .loop-inputs{display:flex;align-items:center;gap:6px;flex-shrink:0;}
  .loop-input{background:var(--surface3);border:1px solid var(--border2);border-radius:4px;padding:3px 6px;color:var(--text2);font-family:'Cinzel',serif;font-size:10px;width:52px;outline:none;text-align:center;}
  .loop-input:focus{border-color:var(--teal);}
  .loop-sep{font-size:10px;color:var(--text3);}
  .loop-rep-wrap{display:flex;align-items:center;gap:5px;margin-left:6px;}
  .loop-rep-label{font-size:9px;letter-spacing:1px;color:var(--text3);}
  .loop-rep-btns{display:flex;gap:3px;}
  .loop-rep-btn{font-family:'Cinzel',serif;font-size:9px;padding:3px 7px;border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;border-radius:3px;transition:all .15s;}
  .loop-rep-btn:hover{border-color:var(--teal);color:var(--teal);}
  .loop-rep-btn.sel{border-color:var(--teal);color:var(--teal);background:rgba(62,184,160,.1);}
  .loop-count-badge{font-size:9px;letter-spacing:1px;color:var(--text3);margin-left:auto;}
  .loop-count-badge span{color:var(--teal);}

  /* â”€â”€ DASHBOARD PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .dash-page{flex:1;overflow-y:auto;padding:24px 28px 60px;display:flex;flex-direction:column;gap:24px;}
  .dash-kpi-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;}
  .dash-kpi{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:18px 16px;display:flex;flex-direction:column;gap:6px;position:relative;overflow:hidden;transition:border-color .2s;}
  .dash-kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--kpi-color,var(--gold));}
  .dash-kpi-val{font-family:'Cinzel',serif;font-size:28px;font-weight:700;color:var(--kpi-color,var(--gold));letter-spacing:-1px;line-height:1;}
  .dash-kpi-label{font-size:9px;letter-spacing:2px;color:var(--text3);}
  .dash-kpi-sub{font-size:9px;color:var(--text2);}
  .dash-section-title{font-size:9px;letter-spacing:3px;color:var(--gold);margin-bottom:12px;display:flex;align-items:center;gap:10px;}
  .dash-section-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--border),transparent);}
  .dash-two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;}
  .dash-card{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;}
  .dash-surah-bar{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(42,47,64,.4);cursor:pointer;transition:background .15s;}
  .dash-surah-bar:last-child{border-bottom:none;}
  .dash-surah-bar:hover{background:rgba(255,255,255,.02);}
  .dash-surah-num{width:22px;font-size:9px;color:var(--text3);flex-shrink:0;text-align:right;}
  .dash-surah-name{font-size:10px;letter-spacing:.5px;color:var(--text2);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .dash-surah-ar{font-family:'Amiri',serif;font-size:14px;color:var(--gold);direction:rtl;flex-shrink:0;}
  .dash-bar-track{flex:1;max-width:90px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;}
  .dash-bar-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--teal),var(--green));}
  .dash-bar-pct{font-size:9px;color:var(--text3);width:28px;text-align:right;flex-shrink:0;}
  .dash-heatmap{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
  .dash-heatmap-cell{aspect-ratio:1;border-radius:3px;background:var(--surface3);border:1px solid var(--border);transition:transform .15s;cursor:default;}
  .dash-heatmap-cell:hover{transform:scale(1.15);}
  .dash-streak-badge{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:20px;border:1px solid var(--gold);background:rgba(201,168,76,.06);font-family:'Cinzel',serif;font-size:9px;letter-spacing:1.5px;color:var(--gold2);}
  .dash-activity-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(42,47,64,.4);}
  .dash-activity-row:last-child{border-bottom:none;}
  .dash-activity-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .dash-activity-text{font-size:10px;color:var(--text2);flex:1;}
  .dash-activity-time{font-size:9px;color:var(--text3);}
  .dash-donut-wrap{display:flex;align-items:center;gap:20px;flex-wrap:wrap;}
  .dash-legend-item{display:flex;align-items:center;gap:6px;font-size:9px;letter-spacing:.5px;color:var(--text2);}
  .dash-legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .dash-ring-label{font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;color:var(--text3);text-align:center;margin-top:4px;}
  .dash-empty-hint{font-size:10px;color:var(--text3);letter-spacing:1px;text-align:center;padding:20px 0;}
  @media(max-width:700px){
    .dash-two-col{grid-template-columns:1fr;}
    .dash-page{padding:12px 8px 60px;}
    .dash-kpi-row{grid-template-columns:repeat(2,1fr);}
    .dash-card{min-width:0;max-width:100%;overflow-x:hidden;}
    /* Force all dashboard grid cells to full width */
    .dash-widget-cell{grid-column:1 / -1 !important;max-width:100%;min-width:0;}
  }
  @media(max-width:480px){
    .dash-kpi-row{grid-template-columns:repeat(2,1fr);}
    .dash-kpi{padding:10px 8px;min-width:0;}
    .dash-kpi-val{font-size:20px;}
  }

  /* â”€â”€ PRONONCIATION PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .pronon-page{flex:1;overflow-y:auto;padding:24px 28px 80px;display:flex;flex-direction:column;gap:28px;}
  .pronon-section-title{font-size:9px;letter-spacing:3px;color:var(--gold);margin-bottom:14px;display:flex;align-items:center;gap:10px;}
  .pronon-section-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--border),transparent);}
  .pronon-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:10px;}
  .pronon-card{
    background:var(--surface2);border:1px solid var(--border);border-radius:10px;
    padding:14px 8px 10px;cursor:pointer;transition:all .2s;
    display:flex;flex-direction:column;align-items:center;gap:6px;
    position:relative;overflow:hidden;
  }
  .pronon-card:hover{border-color:var(--gold);background:var(--surface3);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3);}
  .pronon-card.selected{border-color:var(--teal);background:rgba(62,184,160,.07);box-shadow:0 0 0 2px rgba(62,184,160,.25);}
  .pronon-card.playing{border-color:var(--gold2);background:rgba(201,168,76,.08);}
  .pronon-letter{font-family:'Amiri Quran',serif;font-size:36px;color:var(--text);line-height:1.2;direction:rtl;}
  .pronon-letter-name{font-size:8px;letter-spacing:1px;color:var(--text3);text-align:center;font-family:'Cinzel',serif;}
  .pronon-letter-trans{font-size:9px;color:var(--teal2);letter-spacing:.5px;}
  .pronon-harakat-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;}
  .pronon-harakat-btn{
    background:var(--surface3);border:1px solid var(--border2);border-radius:8px;
    padding:10px 14px;cursor:pointer;transition:all .2s;
    display:flex;flex-direction:column;align-items:center;gap:4px;min-width:72px;
  }
  .pronon-harakat-btn:hover{border-color:var(--gold);background:rgba(201,168,76,.06);}
  .pronon-harakat-btn.playing{border-color:var(--teal);background:rgba(62,184,160,.08);}
  .pronon-harakat-arabic{font-family:'Amiri Quran',serif;font-size:28px;color:var(--gold2);direction:rtl;}
  .pronon-harakat-name{font-size:8px;letter-spacing:1px;color:var(--text3);font-family:'Cinzel',serif;text-align:center;}
  .pronon-harakat-desc{font-size:8px;color:var(--teal2);text-align:center;}
  .pronon-detail-panel{
    background:var(--surface2);border:1px solid var(--border2);border-radius:12px;
    padding:20px;display:flex;flex-direction:column;gap:16px;
    position:sticky;top:0;
  }
  .pronon-detail-letter{font-family:'Amiri Quran',serif;font-size:72px;color:var(--gold2);direction:rtl;text-align:center;line-height:1;}
  .pronon-detail-name{font-size:11px;letter-spacing:3px;color:var(--gold);text-align:center;}
  .pronon-detail-forms{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:4px;}
  .pronon-form-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 10px;background:var(--surface3);border-radius:6px;border:1px solid var(--border);}
  .pronon-form-arabic{font-family:'Amiri Quran',serif;font-size:22px;color:var(--text);direction:rtl;}
  .pronon-form-label{font-size:7px;letter-spacing:1px;color:var(--text3);font-family:'Cinzel',serif;}
  .pronon-detail-harakats{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}
  .pronon-detail-hbtn{
    display:flex;flex-direction:column;align-items:center;gap:3px;
    padding:10px 16px;background:var(--surface3);border:1px solid var(--border2);
    border-radius:8px;cursor:pointer;transition:all .2s;min-width:80px;
  }
  .pronon-detail-hbtn:hover{border-color:var(--teal);transform:scale(1.04);}
  .pronon-detail-hbtn.playing{border-color:var(--gold);background:rgba(201,168,76,.08);animation:softGlow .6s ease-in-out infinite alternate;}
  @keyframes softGlow{from{box-shadow:0 0 0 0 rgba(201,168,76,0);}to{box-shadow:0 0 12px 2px rgba(201,168,76,.2);}}
  .pronon-detail-hbtn-arabic{font-family:'Amiri Quran',serif;font-size:26px;color:var(--gold2);direction:rtl;}
  .pronon-detail-hbtn-name{font-size:8px;letter-spacing:1px;color:var(--text3);font-family:'Cinzel',serif;}
  .pronon-detail-hbtn-desc{font-size:8px;color:var(--teal);text-align:center;}
  .pronon-play-btn{
    display:flex;align-items:center;justify-content:center;gap:8px;
    padding:10px 20px;border:1px solid var(--teal);background:rgba(62,184,160,.08);
    border-radius:8px;cursor:pointer;font-family:'Cinzel',serif;font-size:9px;
    letter-spacing:2px;color:var(--teal);transition:all .2s;
  }
  .pronon-play-btn:hover{background:rgba(62,184,160,.16);}
  .pronon-play-btn.playing{border-color:var(--red);color:var(--red);background:rgba(224,90,90,.08);}
  .pronon-tip-box{padding:10px 14px;background:rgba(201,168,76,.05);border:1px solid rgba(201,168,76,.2);border-radius:8px;font-size:10px;color:var(--text2);line-height:1.6;}
  .pronon-makhraj-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:10px;background:rgba(62,184,160,.1);border:1px solid rgba(62,184,160,.3);font-size:8px;letter-spacing:1px;color:var(--teal2);}
  .pronon-nav-tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px;overflow-x:auto;flex-shrink:0;}
  .pronon-nav-tab{font-family:'Cinzel',serif;font-size:9px;letter-spacing:1.5px;color:var(--text3);padding:10px 16px;background:transparent;border:none;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap;flex-shrink:0;}
  .pronon-nav-tab:hover{color:var(--text2);}
  .pronon-nav-tab.active{color:var(--gold);border-bottom-color:var(--gold);}
  .pronon-two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;}
  @media (max-width:700px){.pronon-two-col{grid-template-columns:1fr;} .pronon-page{padding:16px 14px 80px;}}

  /* â”€â”€ MISC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:12px;color:var(--text3);font-size:11px;letter-spacing:2px;}
  .loading-ring{width:32px;height:32px;border:2px solid var(--border);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
  .empty-state{display:flex;align-items:center;justify-content:center;height:300px;color:var(--text3);font-size:11px;letter-spacing:2px;flex-direction:column;gap:12px;}
  /* â”€â”€ Quran Book (CSS 3D Transforms â€” inspired by Codrops AnimatedBooks) â”€â”€ */
  .qbook-wrapper{
    display:flex;flex-direction:column;height:100%;
    background:radial-gradient(ellipse at 50% 30%,#18090200 0%,#060200 100%);
    align-items:center;justify-content:space-between;overflow:hidden;position:relative;
    background-color:#0c0501;
  }
  /* â”€â”€ Scene / perspective â”€â”€ */
  .qbook-scene{
    perspective:2000px;perspective-origin:50% 40%;
    display:flex;align-items:center;justify-content:center;
    flex:1;width:100%;position:relative;
  }
  /* â”€â”€ Book root â”€â”€ */
  .qbook{
    position:relative;transform-style:preserve-3d;
    transition:transform .5s ease;
    transform:rotateX(4deg) rotateY(-1deg);
  }
  /* â”€â”€ Hardcover front â”€â”€ */
  .qbook-hc-front{
    position:absolute;top:0;left:0;width:100%;height:100%;
    transform-style:preserve-3d;transform-origin:left center;
    transition:transform .8s cubic-bezier(.645,.045,.355,1.000);
    z-index:100;
  }
  .qbook-hc-front > li:first-child{
    /* front face */
    position:absolute;top:0;left:0;width:100%;height:100%;
    border-radius:0 3px 3px 0;overflow:hidden;
    background:linear-gradient(135deg,#2d0e02 0%,#5c1e06 35%,#8b3410 55%,#5c1e06 75%,#2d0e02 100%);
    box-shadow:inset -6px 0 20px rgba(0,0,0,.5),inset 0 0 40px rgba(0,0,0,.3);
    backface-visibility:hidden;
    display:flex;align-items:center;justify-content:center;
  }
  .qbook-hc-front > li:last-child{
    /* back face of front cover (inside) */
    position:absolute;top:0;left:0;width:100%;height:100%;
    border-radius:0 3px 3px 0;overflow:hidden;
    background:linear-gradient(to right,#1a0500,#3d1208);
    transform:rotateY(180deg);backface-visibility:hidden;
  }
  /* front cover open state */
  .qbook-open .qbook-hc-front{
    transform:rotateY(-160deg);
  }
  /* Cover decorative design */
  .qbook-cover-design{
    position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:4px;
    padding:16px;
  }
  .qbook-cover-title{
    font-family:'Amiri Quran',serif;font-size:clamp(16px,4vw,32px);
    color:#c9a84c;direction:rtl;text-align:center;line-height:1.4;
    text-shadow:0 0 20px rgba(201,168,76,.4),0 2px 4px rgba(0,0,0,.6);
  }
  .qbook-cover-sub{
    font-family:'Cinzel',serif;font-size:clamp(6px,1.2vw,9px);
    letter-spacing:3px;color:rgba(201,168,76,.55);text-align:center;
    margin-top:4px;
  }
  /* Gold border on cover */
  .qbook-cover-design::before{
    content:'';position:absolute;inset:8%;
    border:1px solid rgba(201,168,76,.30);pointer-events:none;
  }
  .qbook-cover-design::after{
    content:'';position:absolute;inset:11%;
    border:1px solid rgba(201,168,76,.15);pointer-events:none;
  }
  /* Medallion ornament */
  .qbook-medallion{
    width:clamp(40px,8vw,70px);height:clamp(40px,8vw,70px);
    border-radius:50%;
    background:radial-gradient(circle,rgba(201,168,76,.25) 0%,rgba(201,168,76,.05) 60%,transparent 100%);
    border:1px solid rgba(201,168,76,.35);
    display:flex;align-items:center;justify-content:center;
    font-size:clamp(18px,3.5vw,28px);
    margin-bottom:4px;
  }
  /* â”€â”€ Hardcover back â”€â”€ */
  .qbook-hc-back{
    position:absolute;top:0;left:0;width:100%;height:100%;
    z-index:0;
  }
  .qbook-hc-back > li:first-child{
    position:absolute;top:0;left:0;width:100%;height:100%;
    border-radius:3px 0 0 3px;overflow:hidden;
    background:linear-gradient(135deg,#2d0e02,#4a1608,#2d0e02);
    box-shadow:-3px 0 10px rgba(0,0,0,.4),inset 3px 0 10px rgba(0,0,0,.3);
  }
  .qbook-hc-back > li:last-child{
    position:absolute;top:0;right:-8px;width:8px;height:100%;
    background:linear-gradient(to right,#1a0500,#0a0200);
    border-radius:0 2px 2px 0;
  }
  /* â”€â”€ Spine â”€â”€ */
  .qbook-spine-el{
    position:absolute;top:0;left:0;
    width:100%;height:100%;
    transform:translateX(-100%) rotateY(-90deg);
    transform-origin:right center;
    background:linear-gradient(to bottom,#0e0300,#3a1204,#7c3010,#c07828,#e8a840,#c07828,#7c3010,#3a1204,#0e0300);
    display:flex;align-items:center;justify-content:center;
    overflow:hidden;
  }
  .qbook-spine-el::before{
    content:'';position:absolute;inset:0;
    background:repeating-linear-gradient(to bottom,transparent 0,transparent 18px,rgba(255,195,70,.10) 18px,rgba(255,195,70,.10) 19px);
  }
  .qbook-spine-text{
    writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);
    font-family:'Amiri Quran',serif;font-size:clamp(8px,1.5vw,12px);
    color:rgba(201,168,76,.55);letter-spacing:3px;white-space:nowrap;
    text-shadow:0 0 8px rgba(201,168,76,.2);
  }
  /* â”€â”€ Pages stack â”€â”€ */
  .qbook-pages{
    position:absolute;top:3px;left:3px;right:3px;bottom:3px;
    transform-style:preserve-3d;
  }
  .qbook-pages > li{
    position:absolute;top:0;left:0;width:100%;height:100%;
    border-radius:0 2px 2px 0;overflow:hidden;
    background:linear-gradient(to right,#f5ead0,#fdf8ea,#f5ead0);
  }
  .qbook-pages > li:nth-child(1){ transform:translateX(0px);background:#f0e4c0; }
  .qbook-pages > li:nth-child(2){ transform:translateX(-1px);background:#f3e8c8; }
  .qbook-pages > li:nth-child(3){ transform:translateX(-2px);background:#f6ecce; }
  .qbook-pages > li:nth-child(4){ transform:translateX(-3px);background:#f9f0d4; }
  .qbook-pages > li:nth-child(5){ transform:translateX(-4px);background:#fcf4da; }
  /* â”€â”€ Individual flipping page â”€â”€ */
  .qbook-page{
    position:absolute;top:0;height:100%;width:100%;
    transform-style:preserve-3d;transform-origin:left center;
    z-index:200;
  }
  .qbook-page-face{
    position:absolute;top:0;left:0;width:100%;height:100%;
    backface-visibility:hidden;overflow:hidden;
    border-radius:0 2px 2px 0;
    background:linear-gradient(160deg,#fef9ee 0%,#fdf3d8 40%,#faecc0 100%);
  }
  .qbook-page-face-back{
    transform:rotateY(180deg);
    background:linear-gradient(160deg,#fdf8e8 0%,#fcefd2 50%,#f8e4b8 100%);
  }
  /* Paper grain on pages */
  .qbook-page-face::after{
    content:'';position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;opacity:.5;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='.08'/%3E%3C/svg%3E");
  }
  /* Flip animations */
  .qbook-flip-fwd{animation:qFlipFwd .72s cubic-bezier(.455,.030,.515,.955) forwards;}
  .qbook-flip-bwd{animation:qFlipBwd .72s cubic-bezier(.455,.030,.515,.955) forwards;}
  @keyframes qFlipFwd{
    0%  {transform:rotateY(0deg);z-index:200;}
    100%{transform:rotateY(-180deg);z-index:200;}
  }
  @keyframes qFlipBwd{
    0%  {transform:rotateY(-180deg);z-index:200;}
    100%{transform:rotateY(0deg);z-index:200;}
  }
  /* Shadow during page turn */
  .qbook-flip-fwd .qbook-page-face::before,
  .qbook-flip-bwd .qbook-page-face::before{
    content:'';position:absolute;inset:0;z-index:10;pointer-events:none;
    animation:qShadowFwd .72s cubic-bezier(.455,.030,.515,.955) forwards;
  }
  .qbook-flip-bwd .qbook-page-face::before{
    animation:qShadowBwd .72s cubic-bezier(.455,.030,.515,.955) forwards;
  }
  @keyframes qShadowFwd{
    0%  {background:linear-gradient(to right,rgba(0,0,0,.0),rgba(0,0,0,.0));}
    20% {background:linear-gradient(to right,rgba(0,0,0,.22),rgba(0,0,0,.0));}
    50% {background:linear-gradient(to left,rgba(0,0,0,.28),rgba(0,0,0,.05) 40%,transparent);}
    100%{background:linear-gradient(to right,rgba(0,0,0,.0),rgba(0,0,0,.0));}
  }
  @keyframes qShadowBwd{
    0%  {background:linear-gradient(to right,rgba(0,0,0,.0),rgba(0,0,0,.0));}
    20% {background:linear-gradient(to left,rgba(0,0,0,.22),rgba(0,0,0,.0));}
    50% {background:linear-gradient(to right,rgba(0,0,0,.28),rgba(0,0,0,.05) 40%,transparent);}
    100%{background:linear-gradient(to right,rgba(0,0,0,.0),rgba(0,0,0,.0));}
  }
  /* Click zones */
  .qbook-click{position:absolute;top:0;height:100%;width:44%;cursor:pointer;z-index:300;transition:background .2s;}
  .qbook-click-left{left:0;}.qbook-click-right{right:0;}
  .qbook-click:hover{background:rgba(255,240,180,.03);}
  /* Page content */
  .qbook-page-content{
    padding:clamp(8px,2%,20px) clamp(7px,2%,16px) clamp(6px,1.5%,12px);
    direction:rtl;font-family:'Amiri Quran',serif;color:#1a0a03;
    overflow:hidden;height:100%;display:flex;flex-direction:column;
    box-sizing:border-box;position:relative;
  }
  /* Inset border */
  .qbook-page-content::before{
    content:'';position:absolute;
    inset:clamp(4px,1.2%,8px);
    border:1px solid rgba(139,90,20,.14);pointer-events:none;border-radius:1px;
  }
  /* Spine shadow on page */
  .qbook-page-content::after{
    content:'';position:absolute;top:0;bottom:0;left:0;width:20%;
    background:linear-gradient(to right,rgba(0,0,0,.08),transparent);
    pointer-events:none;
  }
  .qbook-page-content-right::after{
    left:auto;right:0;
    background:linear-gradient(to left,rgba(0,0,0,.08),transparent);
  }
  .qbook-ayah-text{line-height:2.1;text-align:justify;word-break:break-word;flex:1;overflow:hidden;}
  .qbook-surah-header{
    text-align:center;font-family:'Cinzel',serif;font-size:clamp(7px,1.3vw,9px);letter-spacing:1.5px;
    color:#7a4010;
    border-top:1px solid rgba(139,90,20,.28);border-bottom:1px solid rgba(139,90,20,.28);
    padding:4px 0;margin:6px 0 4px;
    background:linear-gradient(to right,transparent,rgba(201,168,76,.09),transparent);
  }
  .qbook-basmala{
    text-align:center;font-family:'Amiri Quran',serif;color:#3d1a05;
    margin:3px 0 5px;direction:rtl;text-shadow:0 1px 2px rgba(255,255,255,.6);
  }
  .qbook-page-num{
    text-align:center;font-family:'Cinzel',serif;font-size:clamp(6px,1.1vw,7.5px);
    letter-spacing:2.5px;color:rgba(120,76,20,.48);
    padding-top:5px;border-top:1px solid rgba(139,90,20,.12);
    margin-top:auto;
  }
  .qbook-page-num::before,.qbook-page-num::after{content:'â§';font-size:8px;color:rgba(139,90,20,.22);margin:0 4px;}
  .qbook-ayah-num{font-size:.68em;color:#9b6020;padding:0 2px;vertical-align:middle;font-family:'Amiri Quran',serif;}
  .qbook-loading-page{display:flex;align-items:center;justify-content:center;height:100%;
    font-family:'Amiri Quran',serif;font-size:clamp(24px,5vw,40px);color:rgba(139,92,26,.14);direction:rtl;}
  /* Topbar */
  .qbook-topbar{
    display:flex;align-items:center;gap:10px;width:100%;padding:10px 20px;
    box-sizing:border-box;flex-shrink:0;flex-wrap:wrap;
    background:linear-gradient(to bottom,rgba(0,0,0,.38),transparent);
  }
  /* Bottom nav */
  .qbook-botnav{display:flex;align-items:center;gap:14px;padding:10px 0 16px;flex-shrink:0;flex-wrap:wrap;justify-content:center;}
  .qbook-navbtn{
    font-size:9px;letter-spacing:1.5px;padding:6px 18px;font-family:'Cinzel',serif;
    background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.30);
    color:var(--gold2);border-radius:8px;cursor:pointer;transition:all .2s;
  }
  .qbook-navbtn:hover:not(:disabled){background:rgba(201,168,76,.18);border-color:rgba(201,168,76,.55);}
  .qbook-navbtn:disabled{opacity:.3;cursor:default;}
  .qbook-navlabel{font-size:9px;letter-spacing:1.5px;color:rgba(201,168,76,.4);font-family:'Cinzel',serif;min-width:70px;text-align:center;}
  /* Progress bar */
  .qbook-progress{width:88px;height:2px;background:rgba(201,168,76,.10);border-radius:2px;overflow:hidden;margin-top:4px;}
  .qbook-progress-bar{height:100%;border-radius:2px;background:linear-gradient(to right,#7a3c0a,#c9a84c);transition:width .5s;}
  /* Open/close book button */
  .qbook-open-btn{
    font-size:clamp(7px,1.5vw,9px);letter-spacing:clamp(2px,0.5vw,3px);
    padding:clamp(4px,1vh,6px) clamp(12px,2.5vw,20px);
    font-family:'Cinzel',serif;border-radius:20px;cursor:pointer;
    background:rgba(0,0,0,.38);border:1px solid rgba(201,168,76,.25);
    color:rgba(201,168,76,.72);text-shadow:0 0 12px rgba(201,168,76,.35);
    animation:qbpulse 2.4s ease-in-out infinite;
  }
  @keyframes qbpulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}
  /* Surah picker */
  .qbook-surah-select{
    background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);
    color:var(--gold2);font-family:'Cinzel',serif;font-size:9px;letter-spacing:1px;
    border-radius:6px;padding:4px 8px;outline:none;cursor:pointer;
  }
  .qbook-surah-select option{background:#1a0a03;color:#c9a84c;}
  /* Responsive */
  @media(max-width:600px){
    .qbook-page-content{padding:8px 7px 6px;}
  }

  .empty-arabic{font-family:'Amiri Quran',serif;font-size:32px;color:var(--gold);opacity:.3;direction:rtl;}

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     RESPONSIVE â€” TABLET  (â‰¤ 900px)
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  @media (max-width:900px) {
    :root{ --sidebar-w:240px; }
    .header-bismillah{ display:none; }
    .ayat-arabic{ font-size:22px; }
    .recit-compare{ font-size:22px; line-height:2.2; }
    .surah-header{ padding:12px 20px; }
    .surah-header-ornament{ font-size:28px; }
    .bismillah-line{ font-size:22px; padding:12px 18px; }
    .player-info{ display:none; }
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     RESPONSIVE â€” MOBILE  (â‰¤ 640px)
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  @media (max-width:640px) {
    :root{ --sidebar-w:100vw; --header-h:calc(52px + env(safe-area-inset-top, 0px)); --player-h:56px; }

    /* Header: Single compact fluid bar */
    .header{ padding:max(env(safe-area-inset-top, 0px), 0px) 8px 0 8px; height:var(--header-h); gap:6px; }
    .header-left{ gap:6px; }
    .header-menu-btn{ width:36px; height:36px; font-size:15px; border-radius:8px; }
    .header-logo{ font-size:13px; letter-spacing:1.5px; }
    .header-logo .header-subtitle{ font-size:5.5px; letter-spacing:2px; }
    
    .header-nav{ padding:2px; gap:2px; border-radius:10px; flex:1; min-width:0; justify-content:space-around; }
    .header-nav-btn{ padding:5px 6px; font-size:8px; letter-spacing:0; border-radius:7px; flex:1; min-width:0; }
    .header-nav-btn .nav-label{ display:none; }
    .header-nav-btn .nav-icon{ font-size:16px; margin:0; }

    .header-actions{ gap:5px; }
    .voice-btn{ width:36px; height:36px; font-size:14px; border-radius:8px; }
    .desktop-only-action{ display:none !important; }
    
    .header-user-btn{ width:36px; height:36px; }
    .header-avatar,.header-avatar-placeholder{ width:30px; height:30px; font-size:12px; }

    /* Sidebar becomes a full-screen drawer aligned below header */
    .sidebar{
      position:fixed; top:var(--header-h); left:0; bottom:0; z-index:300;
      width:var(--sidebar-w); transform:translateX(-100%);
      transition:transform .25s ease;
      box-shadow:4px 0 32px rgba(0,0,0,.5);
    }
    .sidebar.open{ transform:translateX(0); }

    /* Overlay when sidebar open */
    .sidebar-overlay{
      display:none; position:fixed; inset:0; z-index:299;
      background:rgba(0,0,0,.5); backdrop-filter:blur(2px);
    }
    .sidebar-overlay.open{ display:block; }

    /* Main takes full width */
    .main{ width:100%; }

    /* Ayat list */
    .ayat-main{ padding:12px 14px; gap:10px; }
    .ayat-arabic{ font-size:20px; line-height:1.9; }
    .ayat-number-badge{ width:28px; height:28px; font-size:9px; }
    .submenu{ padding:12px 14px 16px; }

    /* Surah header compact */
    .surah-header{ padding:7px 10px; }
    .surah-header-ornament{ font-size:20px; }
    .surah-header-bismillah{ font-size:14px !important; }
    .surah-header-title{ font-size:8px; letter-spacing:1px; }
    .bismillah-line{ font-size:20px; padding:10px 14px; }

    /* TS bar compact */
    .ts-global-bar{ padding:6px 14px; gap:8px; }

    /* Player compact */
    .player-row{ padding:6px 14px; gap:10px; }
    .ctrl-btn{ width:30px; height:30px; font-size:11px; }
    .ctrl-btn.play-btn{ width:36px; height:36px; font-size:13px; }
    .reciter-trigger{position:fixed;right:12px;bottom:68px;z-index:201;min-height:44px;padding:0 14px;border-radius:22px;background:var(--surface2);box-shadow:0 6px 20px rgba(0,0,0,.35);}
    .reciter-trigger-label{display:inline;max-width:120px;}
    .reciter-sheet{right:0;bottom:0;width:100%;max-height:min(82dvh,680px);border-radius:18px 18px 0 0;}
    .reciter-sheet-header{padding:18px 16px 14px;}
    .reciter-list{padding-bottom:16px;}
    .reciter-option{min-height:56px;font-size:16px;}
    .progress-text{ display:none; }
    .loop-bar{ padding:4px 14px 6px; gap:6px; }
    .loop-rep-wrap{ display:none; }

    /* Recitation */
    .recit-compare{ font-size:18px; line-height:2; padding:10px 10px; }
    .recit-score-arc{ width:68px; height:68px; }
    .recit-score-arc-num{ font-size:17px; }
    .recit-mic-circle{ width:56px; height:56px; font-size:22px; }
    .recit-mic-zone{ padding:14px 10px; }
    .recit-debug-table{ font-size:9px; }
    .recit-debug-table td,.recit-debug-table th{ padding:3px 4px; }

    /* Voice help full-width on mobile */
    .voice-help{ right:8px; left:8px; max-width:none; top:calc(var(--header-h) + 6px); }
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     RESPONSIVE â€” SMALL MOBILE  (â‰¤ 400px)
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  @media (max-width:400px) {
    .header{ padding:max(env(safe-area-inset-top, 0px), 0px) 4px 0 4px; gap:3px; }
    .header-menu-btn{ width:34px; height:34px; font-size:14px; }
    .header-logo{ display:none; }
    .header-nav-btn{ padding:4px 3px; }
    .header-nav-btn .nav-icon{ font-size:15px; }
    .voice-btn{ width:34px; height:34px; font-size:13px; }
    .header-user-btn{ width:34px; height:34px; }
    .header-avatar,.header-avatar-placeholder{ width:28px; height:28px; font-size:11px; }
    .ayat-arabic{ font-size:18px; }
    .recit-compare{ font-size:16px; }
    .surah-header-ornament{ font-size:18px; }
    .surah-header-bismillah{ font-size:14px !important; }
    .bismillah-line{ font-size:18px; }
  }

  /* â”€â”€ COLLECTIONS PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .collections-page{flex:1;overflow-y:auto;padding:24px 28px 80px;display:flex;flex-direction:column;gap:20px;}
  .coll-top-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
  .coll-create-form{display:flex;gap:8px;align-items:center;flex:1;min-width:200px;}
  .coll-input{flex:1;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:9px 14px;color:var(--text);font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;outline:none;transition:border-color var(--transition);}
  .coll-input:focus{border-color:var(--gold);}
  .coll-input::placeholder{color:var(--text3);}
  .coll-list{display:flex;flex-direction:column;gap:14px;}
  .coll-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;transition:border-color var(--transition);}
  .coll-card:hover{border-color:var(--border2);}
  .coll-card-header{display:flex;align-items:center;gap:12px;padding:13px 18px;cursor:pointer;background:linear-gradient(135deg,var(--surface),var(--surface2));}
  .coll-card-header:hover{background:var(--surface2);}
  .coll-card-icon{width:34px;height:34px;border-radius:8px;background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.3);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
  .coll-card-name{font-size:11px;letter-spacing:2px;color:var(--gold2);font-weight:600;flex:1;}
  .coll-card-count{font-size:9px;letter-spacing:1px;color:var(--text3);padding:2px 8px;border:1px solid var(--border2);border-radius:10px;flex-shrink:0;}
  .coll-card-chevron{font-size:10px;color:var(--text3);transition:transform .2s;flex-shrink:0;}
  .coll-card-chevron.open{transform:rotate(90deg);}
  .coll-card-actions{display:flex;gap:6px;align-items:center;flex-shrink:0;}
  .coll-ayat-list{border-top:1px solid var(--border);display:flex;flex-direction:column;}
  .coll-ayat-row{display:flex;align-items:flex-start;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(42,47,64,.4);transition:background var(--transition);}
  .coll-ayat-row:last-child{border-bottom:none;}
  .coll-ayat-row:hover{background:rgba(255,255,255,.02);}
  .coll-ayat-ref{display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;width:46px;}
  .coll-ayat-surah{font-size:8px;letter-spacing:1px;color:var(--text3);}
  .coll-ayat-num{width:28px;height:28px;border:1px solid var(--border2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--gold);font-weight:600;}
  .coll-ayat-text{font-family:'Amiri Quran',serif;font-size:20px;line-height:1.9;direction:rtl;text-align:right;flex:1;color:var(--text);}
  .coll-ayat-btns{display:flex;flex-direction:column;gap:4px;flex-shrink:0;align-self:center;}
  .coll-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:14px;color:var(--text3);}
  .coll-empty-arabic{font-family:'Amiri Quran',serif;font-size:36px;color:var(--gold);opacity:.3;direction:rtl;}
  .coll-empty-msg{font-size:10px;letter-spacing:2px;text-align:center;line-height:1.8;}
  /* Modal overlay for "add to collection" */
  .coll-modal-overlay{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;}
  .coll-modal{background:var(--surface2);border:1px solid var(--border2);border-radius:12px;padding:24px;width:100%;max-width:400px;display:flex;flex-direction:column;gap:16px;box-shadow:0 24px 64px rgba(0,0,0,.5);}
  .coll-modal-title{font-size:11px;letter-spacing:3px;color:var(--gold2);}
  .coll-modal-subtitle{font-family:'Amiri Quran',serif;font-size:17px;direction:rtl;text-align:right;color:var(--text2);line-height:1.7;padding:8px 12px;background:var(--surface3);border-radius:6px;border:1px solid var(--border);}
  .coll-modal-list{display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;}
  .coll-modal-item{display:flex;align-items:center;gap:10px;padding:9px 14px;border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all .15s;}
  .coll-modal-item:hover{border-color:var(--gold);background:rgba(201,168,76,.07);}
  .coll-modal-item.selected{border-color:var(--teal);background:rgba(62,184,160,.08);}
  .coll-modal-check{width:18px;height:18px;border-radius:4px;border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;transition:all .15s;}
  .coll-modal-item.selected .coll-modal-check{background:var(--teal);border-color:var(--teal);color:var(--bg);}
  .coll-modal-item-name{font-size:10px;letter-spacing:1.5px;color:var(--text2);flex:1;}
  .coll-modal-item-count{font-size:9px;color:var(--text3);}
  .coll-modal-actions{display:flex;gap:8px;justify-content:flex-end;}
  .coll-modal-new{display:flex;gap:8px;padding-top:8px;border-top:1px solid var(--border);}
  @media(max-width:640px){.collections-page{padding:16px 14px 80px;}.coll-top-bar{flex-direction:column;align-items:stretch;}.coll-ayat-text{font-size:17px;}}
  .coll-search-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--border2);flex-shrink:0;}
  .coll-search-input{background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:7px 12px;color:var(--text);font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;outline:none;flex:1;min-width:140px;transition:border-color .2s;}
  .coll-search-input:focus{border-color:#c878ff;}
  .coll-search-chip{font-family:'Cinzel',serif;font-size:9px;letter-spacing:1px;padding:5px 12px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;transition:all .2s;white-space:nowrap;}
  .coll-search-chip.active{border-color:#c878ff;color:#c878ff;background:rgba(200,120,255,.08);}
  .coll-search-results{flex:1;overflow-y:auto;padding:8px 0;}
  .coll-search-result-item{display:flex;align-items:flex-start;gap:10px;padding:10px 20px;border-bottom:1px solid rgba(42,47,64,.4);cursor:pointer;transition:background .15s;}
  .coll-search-result-item:hover{background:var(--surface2);}
  .coll-search-meta{font-size:9px;letter-spacing:1.5px;color:#c878ff;margin-bottom:4px;}
  .coll-search-arabic{font-family:'Amiri Quran',serif;font-size:18px;direction:rtl;text-align:right;line-height:1.8;color:var(--text);flex:1;}

  /* â”€â”€ CALENDAR & GOALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
  .cal-day-name{font-size:8px;letter-spacing:1px;color:var(--text3);text-align:center;padding-bottom:4px;font-family:'Cinzel',serif;}
  .cal-cell{aspect-ratio:1;border-radius:6px;border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:default;transition:all .15s;position:relative;font-size:9px;color:var(--text3);}
  .cal-cell.today{border-color:var(--gold);color:var(--gold2);font-weight:700;}
  .cal-cell.has-activity{border-color:rgba(62,184,160,.4);}
  .cal-cell.goal-reached{background:rgba(62,184,160,.12);border-color:var(--teal);}
  .cal-cell.goal-partial{background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.4);}
  .cal-cell.other-month{opacity:.3;}
  .cal-cell-num{font-family:'Cinzel',serif;font-size:9px;line-height:1;}
  .cal-cell-dot{width:4px;height:4px;border-radius:50%;flex-shrink:0;}
  .cal-month-nav{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
  .cal-month-title{flex:1;text-align:center;font-family:'Cinzel',serif;font-size:11px;letter-spacing:2px;color:var(--text2);}
  .cal-nav-btn{background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:4px 10px;color:var(--text3);cursor:pointer;font-size:12px;transition:all .15s;}
  .cal-nav-btn:hover{border-color:var(--gold);color:var(--gold);}
  .cal-legend{display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;}
  .cal-legend-item{display:flex;align-items:center;gap:5px;font-size:8px;letter-spacing:1px;color:var(--text3);}
  .cal-legend-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0;}
  /* Goals */
  .goals-grid{display:flex;flex-direction:column;gap:12px;}
  .goal-row{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:10px;transition:border-color .15s;}
  .goal-row:hover{border-color:var(--border2);}
  .goal-icon{font-size:20px;flex-shrink:0;width:36px;text-align:center;}
  .goal-info{flex:1;min-width:0;}
  .goal-label{font-size:9px;letter-spacing:2px;color:var(--text3);margin-bottom:3px;}
  .goal-value{font-family:'Cinzel',serif;font-size:13px;color:var(--text2);}
  .goal-track{flex:1;height:5px;background:var(--surface3);border-radius:3px;overflow:hidden;}
  .goal-fill{height:100%;border-radius:3px;transition:width .5s ease;}
  .goal-pct{font-family:'Cinzel',serif;font-size:10px;color:var(--text3);min-width:34px;text-align:right;}
  .goal-edit-btn{background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:4px 10px;color:var(--text3);cursor:pointer;font-size:9px;letter-spacing:1px;font-family:'Cinzel',serif;transition:all .15s;flex-shrink:0;}
  .goal-edit-btn:hover{border-color:var(--gold);color:var(--gold2);}
  .goal-input{background:var(--surface2);border:1px solid var(--gold);border-radius:6px;padding:4px 8px;color:var(--text);font-family:'Cinzel',serif;font-size:11px;width:60px;outline:none;text-align:center;}
  .goal-today-box{background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2);border-radius:10px;padding:14px 18px;display:flex;gap:16px;flex-wrap:wrap;align-items:center;}
  .goal-today-stat{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:70px;}
  .goal-today-val{font-family:'Cinzel',serif;font-size:20px;color:var(--gold2);}
  .goal-today-label{font-size:8px;letter-spacing:1.5px;color:var(--text3);text-align:center;}
  .goal-streak{display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(224,90,90,.06);border:1px solid rgba(224,90,90,.2);border-radius:8px;}
  .goal-streak-fire{font-size:18px;}
  .goal-streak-num{font-family:'Cinzel',serif;font-size:16px;color:#e05a5a;}
  .goal-streak-label{font-size:8px;letter-spacing:1px;color:var(--text3);}
  @media(max-width:640px){.cal-cell{font-size:8px;}.cal-cell-num{font-size:8px;}}

  /* â”€â”€ RECORDING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .rec-wrap{display:flex;flex-direction:column;gap:14px;}
  .rec-btn{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 20px;border-radius:50px;border:2px solid;cursor:pointer;font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;transition:all .2s;width:100%;}
  .rec-btn.idle{background:rgba(201,168,76,.08);border-color:var(--gold);color:var(--gold2);}
  .rec-btn.idle:hover{background:rgba(201,168,76,.16);}
  .rec-btn.recording{background:rgba(224,90,90,.15);border-color:var(--red);color:#e05a5a;animation:recPulse 1s ease-in-out infinite;}
  @keyframes recPulse{0%,100%{box-shadow:0 0 0 0 rgba(224,90,90,.4)}50%{box-shadow:0 0 0 8px rgba(224,90,90,0)}}
  .rec-dot{width:10px;height:10px;border-radius:50%;background:currentColor;flex-shrink:0;}
  .rec-timer{font-variant-numeric:tabular-nums;font-size:13px;font-family:'Cinzel',serif;color:var(--red);}
  .rec-list{display:flex;flex-direction:column;gap:8px;}
  .rec-item{background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden;transition:border-color .15s;}
  .rec-item:hover{border-color:var(--border2);}
  .rec-item-header{display:flex;align-items:center;gap:10px;padding:10px 14px;}
  .rec-item-icon{width:30px;height:30px;border-radius:50%;background:rgba(62,184,160,.1);border:1px solid rgba(62,184,160,.3);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
  .rec-item-info{flex:1;min-width:0;}
  .rec-item-date{font-size:9px;letter-spacing:1px;color:var(--text3);}
  .rec-item-dur{font-family:'Cinzel',serif;font-size:11px;color:var(--teal2);}
  .rec-item-actions{display:flex;gap:6px;align-items:center;}
  .rec-audio{width:100%;padding:0 14px 10px;display:block;}
  .rec-compare{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px 12px;}
  .rec-compare-label{font-size:8px;letter-spacing:1.5px;color:var(--text3);padding-bottom:4px;}

  /* â”€â”€ INLINE PART PLAYER (floating under clicked part) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .part-player-inline{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;margin:4px 0 2px;flex-wrap:wrap;}
  .part-player-btn{width:30px;height:30px;border-radius:50%;border:1.5px solid;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;background:transparent;flex-shrink:0;transition:all .15s;}
  .part-player-btn.play{border-color:var(--teal);color:var(--teal);}
  .part-player-btn.play:hover{background:rgba(62,184,160,.15);}
  .part-player-btn.stop{border-color:var(--red);color:var(--red);}
  .part-player-btn.stop:hover{background:rgba(224,90,90,.15);}
  .part-player-btn.loop-on{border-color:var(--gold);color:var(--gold2);background:rgba(201,168,76,.12);}
  .part-player-btn.loop-off{border-color:var(--border2);color:var(--text3);}
  .part-player-chars{font-family:'Amiri Quran',serif;font-size:20px;direction:rtl;flex:1;text-align:right;line-height:1.8;min-width:0;}
  .part-player-dur{font-family:'Cinzel',serif;font-size:9px;color:var(--text3);letter-spacing:1px;flex-shrink:0;}
  .part-player-progress{height:3px;background:var(--border2);border-radius:2px;overflow:hidden;width:100%;}
  .part-player-progress-fill{height:100%;background:var(--teal);border-radius:2px;transition:width .1s linear;}
  /* â”€â”€ CREATE PART FROM AUDIO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .cpa-wrap{display:flex;flex-direction:column;gap:10px;padding:12px;background:rgba(201,168,76,.04);border:1px solid rgba(201,168,76,.2);border-radius:10px;margin-top:8px;}
  .cpa-title{font-family:'Cinzel',serif;font-size:9px;letter-spacing:2px;color:var(--gold2);}
  .cpa-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
  .cpa-marker{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:80px;}
  .cpa-marker-label{font-size:8px;letter-spacing:1.5px;color:var(--text3);}
  .cpa-marker-time{font-family:'Cinzel',serif;font-size:13px;color:var(--text2);font-variant-numeric:tabular-nums;}
  .cpa-marker-time.set{color:var(--gold2);}
  .cpa-btn-capture{padding:6px 14px;border:1.5px solid var(--gold);background:rgba(201,168,76,.1);color:var(--gold2);border-radius:6px;cursor:pointer;font-family:'Cinzel',serif;font-size:9px;letter-spacing:1.5px;transition:all .15s;white-space:nowrap;}
  .cpa-btn-capture:hover{background:rgba(201,168,76,.2);}
  .cpa-btn-capture:active{transform:scale(.96);}
  .cpa-preview{font-family:'Amiri Quran',serif;font-size:20px;direction:rtl;text-align:right;padding:8px 12px;background:var(--surface3);border-radius:6px;border:1px solid var(--border);color:var(--text);line-height:1.9;}
  .cpa-preview-word{display:inline;transition:all .12s;}
  .cpa-preview-word.in-range{background:rgba(62,184,160,.2);outline:1px solid var(--teal);border-radius:3px;padding:0 2px;}
  .cpa-create-btn{padding:9px 18px;border:1.5px solid var(--teal);background:rgba(62,184,160,.1);color:var(--teal2);border-radius:8px;cursor:pointer;font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;transition:all .15s;align-self:flex-start;}
  .cpa-create-btn:hover{background:rgba(62,184,160,.2);}
  .cpa-create-btn:disabled{opacity:.4;cursor:default;}

  /* â”€â”€ CONCORDANCE PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .concord-page{flex:1;overflow-y:auto;padding:24px 28px 80px;display:flex;flex-direction:column;gap:20px;}
  .concord-search-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;}
  .concord-search-bar input{flex:1;min-width:200px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:10px 14px;color:var(--text);font-family:'Amiri Quran',serif;font-size:20px;direction:rtl;text-align:right;outline:none;transition:border-color var(--transition);}
  .concord-search-bar input:focus{border-color:var(--gold);}
  .concord-search-bar input::placeholder{font-family:'Cinzel',serif;font-size:11px;direction:ltr;color:var(--text3);}
  .concord-filter-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
  .concord-filter-label{font-size:9px;letter-spacing:2px;color:var(--text3);flex-shrink:0;}
  .concord-surah-select{background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:5px 10px;color:var(--text2);font-family:'Cinzel',serif;font-size:9px;letter-spacing:1px;outline:none;cursor:pointer;max-width:200px;}
  .concord-surah-select:focus{border-color:var(--gold);}
  .concord-mode-tabs{display:flex;border:1px solid var(--border2);border-radius:var(--radius-sm);overflow:hidden;}
  .concord-mode-tab{font-family:'Cinzel',serif;font-size:9px;letter-spacing:1px;padding:5px 12px;background:transparent;color:var(--text3);border:none;cursor:pointer;border-right:1px solid var(--border2);transition:all .2s;white-space:nowrap;}
  .concord-mode-tab:last-child{border-right:none;}
  .concord-mode-tab.active{background:rgba(201,168,76,.12);color:var(--gold2);}
  .concord-results-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
  .concord-results-count{font-size:10px;letter-spacing:1.5px;color:var(--text3);}
  .concord-results-count span{color:var(--gold2);}
  .concord-group{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:0;}
  .concord-group-header{display:flex;align-items:center;gap:12px;padding:12px 18px;background:linear-gradient(90deg,var(--surface2),var(--surface));border-bottom:1px solid var(--border);cursor:pointer;transition:background .2s;user-select:none;}
  .concord-group-header:hover{background:var(--surface2);}
  .concord-group-num{width:28px;height:28px;border-radius:50%;background:var(--surface3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--gold);font-weight:600;flex-shrink:0;}
  .concord-group-name{flex:1;font-size:11px;letter-spacing:1px;color:var(--text);}
  .concord-group-ar{font-family:'Amiri',serif;font-size:15px;color:var(--gold);direction:rtl;}
  .concord-group-badge{font-size:9px;letter-spacing:1px;padding:3px 8px;border-radius:10px;background:rgba(62,184,160,.1);border:1px solid rgba(62,184,160,.3);color:var(--teal2);flex-shrink:0;}
  .concord-group-chevron{font-size:10px;color:var(--text3);transition:transform .2s;flex-shrink:0;}
  .concord-group-chevron.open{transform:rotate(90deg);}
  .concord-ayat-item{display:flex;align-items:flex-start;gap:14px;padding:14px 18px;border-bottom:1px solid rgba(42,47,64,.3);transition:background .15s;cursor:pointer;}
  .concord-ayat-item:last-child{border-bottom:none;}
  .concord-ayat-item:hover{background:rgba(255,255,255,.02);}
  .concord-ayat-num{width:30px;height:30px;border:1px solid var(--border2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text3);flex-shrink:0;margin-top:4px;}
  .concord-ayat-text{font-family:'Amiri Quran',serif;font-size:22px;direction:rtl;text-align:right;flex:1;line-height:2;color:var(--text);}
  .concord-highlight{background:rgba(201,168,76,.25);color:var(--gold2);border-radius:3px;padding:0 2px;}
  .concord-ayat-actions{display:flex;flex-direction:column;gap:6px;flex-shrink:0;align-items:flex-end;}
  .concord-go-btn{font-family:'Cinzel',serif;font-size:8px;letter-spacing:1px;padding:5px 10px;border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;border-radius:var(--radius-sm);transition:all .2s;white-space:nowrap;}
  .concord-go-btn:hover{border-color:var(--gold);color:var(--gold);}
  .concord-link-btn{font-family:'Cinzel',serif;font-size:8px;letter-spacing:1px;padding:5px 10px;border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;border-radius:var(--radius-sm);transition:all .2s;}
  .concord-link-btn:hover{border-color:var(--teal);color:var(--teal);}
  .concord-link-btn.linked{border-color:var(--teal);color:var(--teal);background:rgba(62,184,160,.08);}
  .concord-links-panel{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;}
  .concord-links-title{font-size:9px;letter-spacing:3px;color:var(--gold);margin-bottom:14px;display:flex;align-items:center;gap:10px;}
  .concord-links-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--border),transparent);}
  .concord-link-card{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid rgba(42,47,64,.3);cursor:pointer;transition:background .15s;}
  .concord-link-card:last-child{border-bottom:none;}
  .concord-link-card:hover{background:rgba(255,255,255,.02);}
  .concord-link-ref{font-size:9px;letter-spacing:1px;color:var(--gold2);flex-shrink:0;padding-top:4px;}
  .concord-link-text{font-family:'Amiri Quran',serif;font-size:19px;direction:rtl;text-align:right;flex:1;line-height:1.9;color:var(--text2);}
  .concord-link-remove{width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
  .concord-link-remove:hover{border-color:var(--red);color:var(--red);}
  .concord-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:60px 20px;color:var(--text3);}
  .concord-empty-arabic{font-family:'Amiri Quran',serif;font-size:40px;color:var(--gold);opacity:.25;direction:rtl;}
  .concord-empty-msg{font-size:11px;letter-spacing:2px;text-align:center;line-height:1.8;}
  .concord-loading{display:flex;align-items:center;gap:12px;padding:24px;justify-content:center;color:var(--text3);font-size:10px;letter-spacing:2px;}
  .concord-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;border:1px solid var(--border2);background:var(--surface2);font-size:9px;letter-spacing:1px;color:var(--text2);cursor:pointer;transition:all .2s;}
  .concord-tag:hover{border-color:var(--gold);color:var(--gold);}
  .concord-tags-row{display:flex;flex-wrap:wrap;gap:6px;}
  @media(max-width:700px){.concord-page{padding:16px 14px 80px;}.concord-ayat-text{font-size:18px;}.concord-search-bar input{font-size:16px;}}

`;

const StyleTag = () => <style dangerouslySetInnerHTML={{ __html: CSS }} />;

const API = "https://api.alquran.cloud/v1";
const AUDIO_CDN_ROOT = 'https://cdn.islamic.network/quran/audio'; // bitrate is appended dynamically, see getAudioBase()
// Bitrate list: see BITRATE_FALLBACK_ORDER below (auto-detected per reciter).

const RECITATORS = [
  { id: 'ar.alafasy',            label: 'Mishary Al-Afasy',            flag: 'ğŸ‡°ğŸ‡¼' },
  { id: 'ar.abdulbasitmurattal', label: 'Abdul Basit (Murattal)',      flag: 'ğŸ‡ªğŸ‡¬' },
  { id: 'ar.abdullahbasfar',     label: 'Abdullah Basfar',             flag: 'ğŸ‡¸ğŸ‡¦' },
  { id: 'ar.abdurrahmaansudais', label: 'Abdul Rahman Al-Sudais',      flag: 'ğŸ‡¸ğŸ‡¦' },
  { id: 'ar.shaatree',           label: 'Abu Bakr Ash-Shaatree',       flag: 'ğŸ‡¸ğŸ‡¦' },
  { id: 'ar.ahmedajamy',         label: 'Ahmed Al-Ajamy',              flag: 'ğŸ‡¸ğŸ‡¦' },
  { id: 'ar.hanirifai',          label: 'Hani Ar-Rifai',               flag: 'ğŸ‡¸ğŸ‡¦' },
  { id: 'ar.husary',             label: 'Mahmoud Khalil Al-Husary',    flag: 'ğŸ‡ªğŸ‡¬' },
  { id: 'ar.husarymujawwad',     label: 'Al-Husary (Mujawwad)',        flag: 'ğŸ‡ªğŸ‡¬' },
  { id: 'ar.hudhaify',           label: 'Ali Al-Hudhaify',             flag: 'ğŸ‡¸ğŸ‡¦' },
  { id: 'ar.ibrahimakhbar',      label: 'Ibrahim Al-Akhdar',           flag: 'ğŸ‡¸ğŸ‡¦' },
  { id: 'ar.mahermuaiqly',       label: 'Maher Al-Muaiqly',            flag: 'ğŸ‡¸ğŸ‡¦' },
  { id: 'ar.minshawi',           label: 'Mohamed Siddiq Al-Minshawi',  flag: 'ğŸ‡ªğŸ‡¬' },
  { id: 'ar.minshawimujawwad',   label: 'Al-Minshawi (Mujawwad)',      flag: 'ğŸ‡ªğŸ‡¬' },
  { id: 'ar.muhammadayyoub',     label: 'Muhammad Ayyoub',             flag: 'ğŸ‡¸ğŸ‡¦' },
  { id: 'ar.muhammadjibreel',    label: 'Muhammad Jibreel',            flag: 'ğŸ‡ªğŸ‡¬' },
  { id: 'ar.saoodshuraym',       label: 'Saud Al-Shuraim',             flag: 'ğŸ‡¸ğŸ‡¦' },
  { id: 'ar.parhizgar',          label: 'Shahriar Parhizgar',          flag: 'ğŸ‡®ğŸ‡·' },
  { id: 'ar.aymanswoaid',        label: 'Ayman Sowaid',                flag: 'ğŸ‡¸ğŸ‡¾' },
];

let _recitatorId = (() => { try { return localStorage.getItem('quran_recitator') || 'ar.alafasy'; } catch { return 'ar.alafasy'; } })();

// Bitrate is automatic and per-reciter â€” not every reciter's audio is hosted at every bitrate.
// The official per-ayah API response (`audio` + `audioSecondary` fields) reports exactly which
// bitrate URLs actually exist for a given reciter â€” this is the same source data that backs
// cdn.islamic.network's info.json, fetched live via the API instead of parsing a static dump.
const BITRATE_FALLBACK_ORDER = [128, 64, 192, 48, 40, 32]; // generic guess, used only until the official list arrives
let _officialBitrates = (() => { try { return JSON.parse(localStorage.getItem('quran_official_bitrates')) || {}; } catch { return {}; } })();
let _bitrateByReciter  = (() => { try { return JSON.parse(localStorage.getItem('quran_bitrate_by_reciter')) || {}; } catch { return {}; } })();

const bitrateOrderFor  = (id) => (_officialBitrates[id]?.length ? _officialBitrates[id] : BITRATE_FALLBACK_ORDER);
const getReciterBitrate = (id) => _bitrateByReciter[id] ?? bitrateOrderFor(id)[0];
const setReciterBitrate = (id, kbps) => {
  _bitrateByReciter = { ..._bitrateByReciter, [id]: kbps };
  try { localStorage.setItem('quran_bitrate_by_reciter', JSON.stringify(_bitrateByReciter)); } catch {}
};
// Called when the current bitrate 404s for a reciter â€” advances to the next candidate in its
// (ideally official) list and remembers it, so this reciter "just works" from then on. Returns
// the new bitrate, or null if every candidate has already been exhausted.
const markBitrateBad = (id) => {
  const order = bitrateOrderFor(id);
  const cur   = getReciterBitrate(id);
  const next  = order[order.indexOf(cur) + 1];
  if (next == null) return null;
  setReciterBitrate(id, next);
  return next;
};
// Queries the official API for the bitrates actually available for a reciter and caches the
// result. `data.audio` is the primary URL, `data.audioSecondary` lists the rest â€” together they
// enumerate every working `{bitrate}` for that edition, straight from the source.
async function fetchOfficialBitrates(id) {
  if (_officialBitrates[id]) return _officialBitrates[id];
  try {
    const r = await fetch(`${API}/ayah/1/${id}`);
    const j = await r.json();
    const urls = [j?.data?.audio, ...(j?.data?.audioSecondary || [])].filter(Boolean);
    const kbps = [...new Set(urls
      .map(u => parseInt((u.match(/\/audio\/(\d+)\//) || [])[1], 10))
      .filter(n => !isNaN(n)))];
    if (!kbps.length) return null;
    kbps.sort((a, b) => (a === 128 ? -1 : b === 128 ? 1 : a - b)); // prefer 128 when it's an option
    _officialBitrates = { ..._officialBitrates, [id]: kbps };
    try { localStorage.setItem('quran_official_bitrates', JSON.stringify(_officialBitrates)); } catch {}
    // if what we had remembered for this reciter turns out not to be real, snap to the true default
    if (!kbps.includes(getReciterBitrate(id))) setReciterBitrate(id, kbps[0]);
    return kbps;
  } catch { return null; }
}
const getAudioBase = () => `${AUDIO_CDN_ROOT}/${getReciterBitrate(_recitatorId)}/${_recitatorId}`;
const setGlobalRecitator = (id) => { _recitatorId = id; try { localStorage.setItem('quran_recitator', id); } catch {} };
const getGlobalRecitator = () => _recitatorId;

// AUDIO_BASE removed â€” use getAudioBase() (dynamic, follows the selected reciter, bitrate is automatic)



async function fetchSurahs() {
  const idbKey = 'surahs';
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const r = await fetch(`${API}/surah`);
  const data = (await r.json()).data;
  idbSetQuran(idbKey, data).catch(() => {});
  return data;
}

// Translation editions keyed by lang code
const TRANS_EDITIONS = {
  fr: 'fr.hamidullah',
  en: 'en.sahih',
  tr: 'tr.diyanet',
  ur: 'ur.jalandhry',
  de: 'de.aburida',
  es: 'es.asad',
  id: 'id.indonesian',
  ru: 'ru.kuliev',
};
const TRANS_LABELS = { fr:'ğŸ‡«ğŸ‡· FR', en:'ğŸ‡¬ğŸ‡§ EN', tr:'ğŸ‡¹ğŸ‡· TR', ur:'ğŸ‡µğŸ‡° UR', de:'ğŸ‡©ğŸ‡ª DE', es:'ğŸ‡ªğŸ‡¸ ES', id:'ğŸ‡®ğŸ‡© ID', ru:'ğŸ‡·ğŸ‡º RU' };

// fetchSurahTranslation(sn, lang) â†’ [{numberInSurah, text}] cached in IDB
async function fetchSurahTranslation(sn, lang) {
  const edition = TRANS_EDITIONS[lang];
  if (!edition) return [];
  const idbKey = `trans:${lang}:${sn}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const r = await fetch(`${API}/surah/${sn}/${edition}`);
  const ayahs = (await r.json()).data?.ayahs || [];
  const result = ayahs.map(a => ({ numberInSurah: a.numberInSurah, text: a.text }));
  idbSetQuran(idbKey, result).catch(() => {});
  return result;
}
async function fetchAyats(n) {
  const idbKey = `alafasy:${n}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const r = await fetch(`${API}/surah/${n}/ar.alafasy`);
  const data = (await r.json()).data;
  idbSetQuran(idbKey, data).catch(() => {});
  return data;
}
// /surah/${n}/quran-simple  â†’  [{num, text}, â€¦]
async function fetchSurahSimple(n) {
  const idbKey = `text:${n}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const r = await fetch(`${API}/surah/${n}/quran-simple`);
  const data = (await r.json()).data?.ayahs || [];
  const ayats = data.map(a => ({ num: a.numberInSurah, text: a.text }));
  idbSetQuran(idbKey, ayats).catch(() => {});
  return ayats;
}
// /surah/${n}  (default edition â€” used for ayat texts in MemoriseMode etc.)
// Returns raw ayahs array from API data.ayahs
async function fetchSurahDefault(n) {
  const idbKey = `simple:${n}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const r = await fetch(`${API}/surah/${n}`);
  const ayahs = (await r.json()).data?.ayahs || [];
  idbSetQuran(idbKey, ayahs).catch(() => {});
  return ayahs;
}
// Static surah metadata cache: hizb, juz, page (from ayat 1) + total word count
async function fetchSurahMeta(n) {
  const idbKey = `smeta:${n}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const ayahs = await fetchSurahDefault(n);
  const a1 = ayahs[0] || {};
  const wordCount = ayahs.reduce((s, a) => s + splitArabicWords(a.text || '').length, 0);
  const meta = {
    hizb:      a1.hizbQuarter != null ? Math.ceil(a1.hizbQuarter / 4) : null,
    juz:       a1.juz  ?? null,
    page:      a1.page ?? null,
    wordCount,
  };
  idbSetQuran(idbKey, meta).catch(() => {});
  return meta;
}
// Single-ayah meta (page, juz, hizb, manzil, ruku, sajda) â€” cached per-surah
async function fetchAyahMeta(sn, an) {
  const ayahs = await fetchSurahDefault(sn);
  return ayahs.find(a => a.numberInSurah === an) || null;
}
async function fetchQuranPage(pageNum) {
  const key = `mushaf_page:${pageNum}`;
  try { const c = await idbGetQuran(key); if (c) return c; } catch {}
  const r = await fetch(`${API}/page/${pageNum}/quran-uthmani`);
  const ayahs = (await r.json()).data?.ayahs || [];
  idbSetQuran(key, ayahs).catch(() => {});
  return ayahs;
}
// Static page-level metadata: hizb, juz, word count â€” cached in IDB as pmeta:N
async function fetchPageMeta(pageNum) {
  const idbKey = `pmeta:${pageNum}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const ayahs = await fetchQuranPage(pageNum);
  const a1 = ayahs[0] || {};
  const wordCount = ayahs.reduce((s, a) => s + splitArabicWords(a.text || '').length, 0);
  const meta = {
    hizb:      a1.hizbQuarter != null ? Math.ceil(a1.hizbQuarter / 4) : null,
    juz:       a1.juz  ?? null,
    ayatCount: ayahs.length,
    wordCount,
  };
  idbSetQuran(idbKey, meta).catch(() => {});
  return meta;
}

function _stripBasmalaWords(words, sn) {
  // Strip first 4 words (basmala) from ayat 1 timestamps for non-Fatiha/Tawba surahs
  if (!words || words.length <= 4 || sn === 1 || sn === 9) return words;
  const stripD = s => s.replace(/[Ø-Ù‹Øš-Ù°ÙŸÛ–-Û­]/g, '');
  const firstWord = words[0]?.chars?.map(c => c.char).join('') || '';
  if (stripD(firstWord).startsWith('Ø¨Ø³Ù…')) return words.slice(4);
  return words;
}

function parseTimestampsFile(data, surahNum, keyPrefix) {
  const result = {};
  const pfx = keyPrefix ? `${keyPrefix}:` : '';
  const addEntry = (sn, ayatNum, words) => {
    const processedWords = ayatNum === 1 ? _stripBasmalaWords(words, sn) : words;
    result[`${pfx}${sn}:${ayatNum}`] = { words: processedWords };
  };
  if (Array.isArray(data)) {
    data.forEach(item => { if (item.ayat && item.words) addEntry(item.surah || surahNum, item.ayat, item.words); });
  } else if (data.ayat && data.words) {
    addEntry(data.surah || surahNum, data.ayat, data.words);
  }
  return result;
}

// â”€â”€â”€ PlayingArabicHighlighted â€” zero-rerender highlight via DOM refs â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders chars once, then updates active/done classes via RAF + DOM refs only.
const PlayingArabicHighlighted = React.memo(function PlayingArabicHighlighted({
  text, timestamps, mode, playingPart, ld, showQalqala, showMadd, showIzhar, showIdgham
}) {
  const mainCurrentMs = useSelector(sel.mainCurrentMs);
  const partCurrentMs = useSelector(sel.partCurrentMs);
  const localPlaying  = useSelector(sel.localPlaying);
  const containerRef  = useRef(null);
  const charDataRef   = useRef(null); // flat array of {start,end,el}
  const prevActiveRef = useRef(-1);

  // Build flat char metadata once per timestamps change
  const charData = useMemo(() => {
    if (!timestamps?.words) return null;
    const flat = [];
    timestamps.words.forEach(word => {
      const chars = fixChars(word.chars || []);
      chars.forEach(c => flat.push({ start: c.start, end: c.end }));
    });
    return flat;
  }, [timestamps]);

  charDataRef.current = charData;

  // Update active/done spans via direct DOM after every currentMs change
  useEffect(() => {
    const flat = charDataRef.current;
    if (!flat || !containerRef.current) return;
    let curMs;
    let rangeStartMs = null;
    if (mode === 'main') {
      curMs = mainCurrentMs;
    } else if (mode === 'part') {
      const activePart = (ld?.parts || []).find(p => p.id === playingPart?.partId);
      const firstWordIdx = activePart?.wordIndices?.[0];
      rangeStartMs = firstWordIdx != null ? timestamps?.words?.[firstWordIdx]?.chars?.[0]?.start : null;
      curMs = partCurrentMs;
    } else {
      curMs = localPlaying?.currentMs ?? -1;
    }
    const spans = containerRef.current.querySelectorAll('.char-span');
    if (spans.length !== flat.length) return;
    flat.forEach(({ start, end }, i) => {
      const active = curMs >= start && curMs <= end;
      const done   = curMs > end && curMs > 0 && (rangeStartMs == null || end > rangeStartMs);
      const el = spans[i];
      if (active) {
        if (!el.classList.contains('char-active')) { el.classList.add('char-active'); el.classList.remove('char-done'); }
      } else if (done) {
        if (!el.classList.contains('char-done')) { el.classList.add('char-done'); el.classList.remove('char-active'); }
      } else {
        if (el.classList.contains('char-active') || el.classList.contains('char-done')) {
          el.classList.remove('char-active','char-done');
        }
      }
    });
  }, [mainCurrentMs, partCurrentMs, localPlaying, mode]);

  // Render static chars (no active/done â€” DOM handles it)
  return <ArabicHighlighted ref={containerRef} text={text} timestamps={timestamps}
    currentMs={-1} showQalqala={showQalqala} showMadd={showMadd}
    showIzhar={showIzhar} showIdgham={showIdgham} />;
}, (prev, next) =>
  prev.text === next.text &&
  prev.timestamps === next.timestamps &&
  prev.mode === next.mode &&
  prev.showQalqala === next.showQalqala &&
  prev.showMadd === next.showMadd &&
  prev.showIzhar === next.showIzhar &&
  prev.showIdgham === next.showIdgham
);

// â”€â”€â”€ Arabic Virtual Keyboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ArabicKeyboardContext = React.createContext({ show: false, setShow: () => {}, activeInput: { current: null } });
function useArabicKeyboard() { return React.useContext(ArabicKeyboardContext); }

const AR_ROWS = [
  ['Ø¶','Øµ','Ø«','Ù‚','Ù','Øº','Ø¹','Ù‡','Ø®','Ø­','Ø¬','Ø¯','Ø°'],
  ['Ø´','Ø³','ÙŠ','Ø¨','Ù„','Ø§','Øª','Ù†','Ù…','Ùƒ','Ø·','Ø¸'],
  ['Ø¦','Ø¡','Ø¤','Ø±','Ù„Ø§','Ù‰','Ø©','Ùˆ','Ø²','Ø³Ù‘'],
];
const AR_DIACRITICS = [
  { label:'Ù', title:'Fatha' },
  { label:'Ù', title:'Damma' },
  { label:'Ù', title:'Kasra' },
  { label:'Ù‹', title:'Tanwin fath' },
  { label:'ÙŒ', title:'Tanwin damm' },
  { label:'Ù', title:'Tanwin kasr' },
  { label:'Ù‘', title:'Shadda' },
  { label:'Ù’', title:'Sukun' },
  { label:'Ù°', title:'Dagger alif' },
];

function ArabicKeyboard({ show, onClose }) {
  const { activeInput } = useArabicKeyboard();
  const [capsHamza, setCapsHamza] = React.useState(false);

  const insert = (char) => {
    const el = activeInput.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    const before = el.value.slice(0, start);
    const after  = el.value.slice(end);
    const newVal = before + char + after;
    // Use native input setter to trigger React's onChange
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')
                      || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    nativeSetter?.set?.call(el, newVal);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const newPos = start + char.length;
    el.setSelectionRange(newPos, newPos);
    el.focus();
  };

  const backspace = () => {
    const el = activeInput.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    if (start !== end) {
      insert('');
    } else if (start > 0) {
      const before = el.value.slice(0, start - 1);
      const after  = el.value.slice(start);
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')
                        || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      nativeSetter?.set?.call(el, before + after);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.setSelectionRange(start - 1, start - 1);
      el.focus();
    }
  };

  const HAMZA_MAP = {
    'Ø§': 'Ø£', 'Ùˆ': 'Ø¤', 'ÙŠ': 'Ø¦', 'Ù‡': 'Ù‡',
  };

  if (!show) return null;
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:9999,
      background:'var(--surface2)', borderTop:'1px solid var(--border)',
      padding:'8px 6px 12px', boxShadow:'0 -4px 24px rgba(0,0,0,.4)',
      userSelect:'none' }}>
      {/* Header row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>CLAVIER ARABE</div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setCapsHamza(v => !v)}
            style={{ fontSize:9, padding:'3px 10px', borderRadius:6,
              background: capsHamza ? 'rgba(201,168,76,.18)' : 'transparent',
              border:'1px solid ' + (capsHamza ? 'var(--gold)' : 'var(--border2)'),
              color: capsHamza ? 'var(--gold2)' : 'var(--text3)', cursor:'pointer' }}>
            Ø¡ HAMZA
          </button>
          <button onClick={onClose}
            style={{ fontSize:11, padding:'3px 10px', borderRadius:6,
              background:'transparent', border:'1px solid var(--border2)',
              color:'var(--text3)', cursor:'pointer' }}>âœ•</button>
        </div>
      </div>

      {/* Letter rows */}
      {AR_ROWS.map((row, ri) => (
        <div key={ri} style={{ display:'flex', justifyContent:'center', gap:3, marginBottom:3 }}>
          {row.map((ch) => {
            const display = capsHamza && HAMZA_MAP[ch] ? HAMZA_MAP[ch] : ch;
            return (
              <button key={ch} onClick={() => insert(display)}
                style={{ minWidth:32, height:38, fontSize:18, borderRadius:6,
                  fontFamily:"'Amiri Quran',serif", border:'1px solid var(--border2)',
                  background:'var(--surface3)', color:'var(--text)',
                  cursor:'pointer', direction:'rtl', padding:'0 4px',
                  transition:'background .1s', flexShrink:0 }}>
                {display}
              </button>
            );
          })}
          {ri === 2 && (
            <button onClick={backspace}
              style={{ minWidth:44, height:38, fontSize:14, borderRadius:6,
                border:'1px solid var(--border2)', background:'rgba(224,90,90,.12)',
                color:'var(--red)', cursor:'pointer', flexShrink:0 }}>
              âŒ«
            </button>
          )}
        </div>
      ))}

      {/* Diacritics row */}
      <div style={{ display:'flex', justifyContent:'center', gap:3, marginTop:4 }}>
        {AR_DIACRITICS.map(({ label, title }) => (
          <button key={label} onClick={() => insert(label)} title={title}
            style={{ minWidth:32, height:32, fontSize:14, borderRadius:6,
              fontFamily:"'Amiri Quran',serif", border:'1px solid var(--border2)',
              background:'rgba(201,168,76,.08)', color:'var(--gold2)',
              cursor:'pointer', padding:'0 4px', flexShrink:0 }}>
            Ø¯{label}
          </button>
        ))}
        <button onClick={() => insert(' ')}
          style={{ minWidth:80, height:32, fontSize:9, borderRadius:6,
            border:'1px solid var(--border2)', background:'var(--surface3)',
            color:'var(--text3)', cursor:'pointer', letterSpacing:2, fontFamily:"'Cinzel',serif" }}>
          ESPACE
        </button>
      </div>
    </div>
  );
}


// â”€â”€â”€ IndexedDB timestamps cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const IDB_NAME        = 'quran-ts-cache';
const IDB_STORE       = 'timestamps';
const IDB_QURAN_STORE = 'quran';
const tsMemCache    = {};
const quranMemCache = {};
let _tsDbPromise = null;
function openTsDb() {
  if (!_tsDbPromise) {
    _tsDbPromise = new Promise((res, rej) => {
      const req = indexedDB.open(IDB_NAME, 3);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE))       db.createObjectStore(IDB_STORE);
        if (!db.objectStoreNames.contains(IDB_QURAN_STORE)) db.createObjectStore(IDB_QURAN_STORE);
        if (!db.objectStoreNames.contains('audio'))         db.createObjectStore('audio');
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror = e => { _tsDbPromise = null; rej(e.target.error); };
    });
  }
  return _tsDbPromise;
}
async function idbGetQuran(key) {
  if (quranMemCache[key] !== undefined) return quranMemCache[key];
  const db = await openTsDb();
  return new Promise((res, rej) => {
    const tx  = db.transaction(IDB_QURAN_STORE, 'readonly');
    const req = tx.objectStore(IDB_QURAN_STORE).get(key);
    req.onsuccess = () => { quranMemCache[key] = req.result ?? null; res(req.result ?? null); };
    req.onerror   = e => rej(e.target.error);
  });
}
async function idbSetQuran(key, val) {
  quranMemCache[key] = val;
  const db = await openTsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_QURAN_STORE, 'readwrite');
    tx.objectStore(IDB_QURAN_STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror    = e => rej(e.target.error);
  });
}
async function idbGet(key) {
  const db = await openTsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = e => rej(e.target.error);
  });
}
async function idbSet(key, val) {
  const db = await openTsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = res;
    tx.onerror = e => rej(e.target.error);
  });
}

// â”€â”€â”€ Auto-load timestamps for a surah (per reciter) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Path scheme â€” one subfolder per reciter id, same file-naming pattern as before:
//   Android (bundled assets): public/assets/timestamps/{recitatorId}/surah_XXX.json
//   Web (server):              http://localhost:3000/sourate/{recitatorId}/surah_XXX.json
// e.g. for sourate 1 / ar.husary â†’ public/assets/timestamps/ar.husary/surah_001.json
const TS_SERVER_BASE   = 'http://localhost:3000/sourate';
const TS_ANDROID_BASE  = 'public/assets/timestamps';
async function loadTimestampsForSurah(surahNum, recitatorId = 'ar.alafasy') {
  const memKey = `${recitatorId}:${surahNum}`;
  if (tsMemCache[memKey]) return tsMemCache[memKey];
  const cacheKey = `ts:${recitatorId}:${surahNum}`;
  const file     = `surah_${String(surahNum).padStart(3,'0')}.json`;

  if (IS_ANDROID) {
    // Capacitor: load directly from bundled assets, no IDB needed
    const url = `${TS_ANDROID_BASE}/${recitatorId}/${file}`;
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await r.json();
      const parsed = parseTimestampsFile(data, surahNum, recitatorId);
      if (parsed) tsMemCache[memKey] = parsed;
      return parsed;
    } catch { return null; }
  }

  // Web: try IDB cache first, then fetch from server and cache
  try {
    const cached = await idbGet(cacheKey);
    if (cached) { tsMemCache[memKey] = cached; return cached; }
  } catch {}

  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 5000); // 5s timeout â€” don't stall UI
    const r = await fetch(`${TS_SERVER_BASE}/${recitatorId}/${file}`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!r.ok) return null;
    const data   = await r.json();
    const parsed = parseTimestampsFile(data, surahNum, recitatorId);
    if (Object.keys(parsed).length > 0) {
      tsMemCache[memKey] = parsed;
      idbSet(cacheKey, parsed).catch(() => {});
    }
    return parsed;
  } catch { return null; }
}


// Fix degenerate timestamp chars where start===end by extending to next real boundary
function fixChars(chars) {
  if (!chars?.length) return [];
  const wordEnd = chars[chars.length - 1].end;
  return chars.map((c, ci) => {
    if (c.start === c.end) {
      const nextReal = chars.slice(ci + 1).find(x => x.end > c.start);
      return { ...c, end: nextReal ? nextReal.start : wordEnd };
    }
    return c;
  });
}

const ArabicHighlighted = React.memo(React.forwardRef(function ArabicHighlighted({ text, timestamps, currentMs, rangeStartMs, showQalqala, showMadd, showIzhar, showIdgham }, ref) {
  if (!timestamps?.words) return <div className="ayat-arabic">{text}</div>;

  // Pre-compute tajweed styles and fixed chars once per timestamps+tajweed change
  const wordData = useMemo(() => timestamps.words.map(word => {
    const wordArr = word.chars ? word.chars.map(x => x.char) : [];
    const fixed = fixChars(word.chars || []);
    return fixed.map((c, ci) => {
      const isQalqalaOn = showQalqala && isQalqala(wordArr, ci);
      const maddType    = showMadd ? getMaddType(wordArr, ci) : null;
      const izharOn     = showIzhar && isIzhar(wordArr, ci);
      const idghamOn    = showIdgham && isIdgham(wordArr, ci);
      const tajStyle    = isQalqalaOn ? {color:'#5bc8f5',textShadow:'0 0 6px rgba(91,200,245,.5)'}
                        : maddType === 'muttasil' ? {color:'#ff7eb3',textShadow:'0 0 8px rgba(255,126,179,.6)',fontWeight:600}
                        : maddType === 'normal'   ? {color:'#f09de0',textShadow:'0 0 6px rgba(240,157,224,.5)'}
                        : izharOn                 ? {color:'#4caf81',textShadow:'0 0 6px rgba(76,175,129,.5)'}
                        : idghamOn                ? {color:'#ffd166',textShadow:'0 0 6px rgba(255,209,102,.5)'}
                        : undefined;
      return { char: c.char, start: c.start, end: c.end, tajStyle };
    });
  }), [timestamps, showQalqala, showMadd, showIzhar, showIdgham]);

  // Static render â€” no active/done classes here (DOM updates them for playing mode)
  return (
    <div className="ayat-arabic" ref={ref}>
      {wordData.map((chars, wi) => (
        <span key={wi}>
          {chars.map((c, ci) => (
            <span key={ci} className="char-span" style={c.tajStyle}>{c.char}</span>
          ))}
          {wi < wordData.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );
}), (prev, next) =>
  prev.text === next.text &&
  prev.timestamps === next.timestamps &&
  prev.currentMs === next.currentMs &&
  prev.showQalqala === next.showQalqala &&
  prev.showMadd === next.showMadd &&
  prev.showIzhar === next.showIzhar &&
  prev.showIdgham === next.showIdgham
);

// â”€â”€â”€ Qalqala letters (Ù‚ Ø· Ø¨ Ø¬ Ø¯)
const QALQALA_LETTERS = new Set(['Ù‚','Ø·','Ø¨','Ø¬','Ø¯']);
function isQalqala(arr, i) {
  if (!QALQALA_LETTERS.has(arr[i])) return false;
  // Check next char is sukun, or last char of word (waqf = implicit sukun)
  for (let j = i + 1; j < arr.length; j++) {
    const nc = arr[j];
    if (nc === SUKUN) return true;
    if (nc === ' ' || j === arr.length - 1) return true; // waqf
    if (nc >= 'Ø€' && nc <= 'Û¿') continue; // other diacritics â€” keep looking
    return false; // base letter follows â€” no sukun
  }
  return true; // end of text
}

// â”€â”€â”€ Madd detection
const MADD_MARK   = new Set(['Ù“','Ù°']);
const LONG_VOWEL  = new Set(['Ù','Ù','Ù']);
const MADD_LETTER = new Set(['Ø§','Ùˆ','ÙŠ']);
const HAMZA_SET   = new Set(['Ø¡','Ø£','Ø¥','Ø¤','Ø¦']); // Ø¡ Ø£ Ø¥ Ø¤ Ø¦
// Izhar halqi letters: Ø¡ Ù‡ Ø¹ Øº Ø­ Ø®
const IZHAR_LETTERS = new Set(['Ø¡','Ù‡','Ø¹','Øº','Ø­','Ø®']);
const SUKUN = 'Ù’'; // Ù’
const TANWIN = new Set(['Ù‹','ÙŒ','Ù']); // Ù‹ ÙŒ Ù
// Returns true if char at i is a nun-sakin or tanwin that is followed (skip diacritics) by an izhar letter
function isIzhar(arr, i) {
  const ch = arr[i];
  let isNunSakin = false;
  // Nun with sukun: Ù† followed by sukun OR sukun directly on this char
  if (ch === 'Ù†') { // Ù†
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[j] === ' ') break;
      if (arr[j] === SUKUN) { isNunSakin = true; break; }
      if (arr[j] >= 'Ø¡' && arr[j] <= 'ÙŠ' && !TANWIN.has(arr[j])) break;
    }
  }
  // Tanwin on current char
  const isTanwin = TANWIN.has(ch);
  if (!isNunSakin && !isTanwin) return false;
  // Find next base letter (skip diacritics and spaces)
  const start = isTanwin ? i + 1 : i + 2; // skip sukun for nun-sakin
  for (let j = (isTanwin ? i + 1 : i + 1); j < arr.length; j++) {
    const nc = arr[j];
    if (nc === ' ') continue;
    if (IZHAR_LETTERS.has(nc)) return true;
    if (nc >= 'Ø¡' && nc <= 'ÙŠ' && !TANWIN.has(nc) && nc !== SUKUN) return false;
  }
  return false;
}

// Idgham letters: ÙŠ Ù† Ù… Ùˆ Ù„ Ø±
const IDGHAM_LETTERS = new Set(['ÙŠ','Ù†','Ù…','Ùˆ','Ù„','Ø±']);
function isIdgham(arr, i) {
  const ch = arr[i];
  let isNunSakin = false;
  if (ch === 'Ù†') {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[j] === SUKUN) { isNunSakin = true; break; }
      if (arr[j] >= 'Ø¡' && arr[j] <= 'ÙŠ' && !TANWIN.has(arr[j])) break;
    }
  }
  const isTanwin = TANWIN.has(ch);
  if (!isNunSakin && !isTanwin) return false;
  // Must be at word boundary (next non-diacritic is in next word = after space)
  // For nun-sakin: skip to next word
  let hitSpace = false;
  for (let j = i + 1; j < arr.length; j++) {
    const nc = arr[j];
    if (nc === ' ') { hitSpace = true; continue; }
    if (!hitSpace && (nc >= 'Ø€' && nc <= 'Û¿')) continue; // diacritics same word
    if (IDGHAM_LETTERS.has(nc)) return true;
    return false;
  }
  return false;
}

// Returns 'muttasil' (4-5 beats, madd before hamza same word), 'normal' (2 beats), or null
function getMaddType(arr, i) {
  const ch = arr[i];
  // Explicit maddah/superscript-alif mark
  const hasMark = MADD_MARK.has(ch) || (i + 1 < arr.length && MADD_MARK.has(arr[i + 1]));
  // Long vowel + letter
  const isLongVowelLetter = MADD_LETTER.has(ch) && i > 0 && LONG_VOWEL.has(arr[i - 1]);
  if (!hasMark && !isLongVowelLetter) return null;
  // Check if a hamza follows (skip diacritics) within the same word
  for (let j = i + 1; j < arr.length; j++) {
    const nc = arr[j];
    if (nc === ' ') break; // word boundary
    if (HAMZA_SET.has(nc)) return 'muttasil';
    if (nc >= 'Ø¡' && nc <= 'ÙŠ') break; // another base letter â€” no hamza follows immediately
  }
  return 'normal';
}
// Backward-compat single-char check
function isMaddChar(arr, i) { return getMaddType(arr, i) !== null; }

// â”€â”€â”€ VOICE COMMAND PARSER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function parseVoiceCommand(transcript, surahs, ayats, currentSurah) {
  const t = transcript.toLowerCase().trim()
    .replace(/[,;.!?]/g, ' ')
    .replace(/\s+/g, ' ');

  // Play / pause / stop
  if (/\b(play|joue|lecture|lire|lancer|dÃ©marrer|start)\b/.test(t)) return { action: 'play' };
  if (/\b(pause|pauser|mettre en pause)\b/.test(t)) return { action: 'pause' };
  if (/\b(stop|arrÃªter|arrÃªte|stopper)\b/.test(t)) return { action: 'stop' };
  if (/\b(suivant|next|verset suivant)\b/.test(t)) return { action: 'next' };
  if (/\b(prÃ©cÃ©dent|retour|previous|verset prÃ©cÃ©dent)\b/.test(t)) return { action: 'prev' };

  // Surah selection: "sourate fatiha", "ouvre al-baqara", "va Ã  la sourate 2"
  const surahByNum = t.match(/\b(?:sourate|surah|sura|ouvre|va Ã  la sourate|va sourate)\s+(\d+)\b/i);
  if (surahByNum) {
    const n = parseInt(surahByNum[1]);
    if (n >= 1 && n <= 114) return { action: 'surah', number: n };
  }
  // By name
  for (const [key, num] of Object.entries(SURAH_NAMES)) {
    if (t.includes(key)) return { action: 'surah', number: num };
  }

  // Ayat: "verset 5", "ayat 12", "va au verset 7", "commence au verset 3"
  const ayatMatch = t.match(/\b(?:verset|ayat|ayah|aya|commence|va au|aller au verset|aller verset)\s+(\d+)\b/i);
  if (ayatMatch) {
    const n = parseInt(ayatMatch[1]);
    return { action: 'ayat', number: n };
  }

  // Loop range: "boucle versets 2 Ã  5", "rÃ©pÃ©ter 3 Ã  7", "loop 1 5"
  const loopMatch = t.match(/\b(?:boucle|loop|rÃ©pÃ©ter|rÃ©pÃ¨te|lire en boucle)\s+(?:versets?\s+)?(\d+)\s+(?:Ã |au|jusqu'Ã |to|-)\s+(\d+)\b/i);
  if (loopMatch) {
    return { action: 'loop', from: parseInt(loopMatch[1]), to: parseInt(loopMatch[2]) };
  }

  // Loop off: "arrÃªter la boucle", "stop loop"
  if (/\b(arrÃªter la boucle|stop loop|dÃ©sactiver boucle|no loop|sans boucle)\b/.test(t)) {
    return { action: 'loop_off' };
  }

  // Repetitions: "rÃ©pÃ©ter 3 fois", "5 fois"
  const repMatch = t.match(/\b(\d+)\s+fois\b/i);
  if (repMatch) return { action: 'repeat', times: parseInt(repMatch[1]) };

  return null;
}

// â”€â”€â”€ CONCORDANCE PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SURAH_INFO = [
  {n:1,en:"Al-Fatiha",ar:"Ø§Ù„ÙØ§ØªØ­Ø©"},{n:2,en:"Al-Baqara",ar:"Ø§Ù„Ø¨Ù‚Ø±Ø©"},{n:3,en:"Al-Imran",ar:"Ø¢Ù„ Ø¹Ù…Ø±Ø§Ù†"},
  {n:4,en:"An-Nisa",ar:"Ø§Ù„Ù†Ø³Ø§Ø¡"},{n:5,en:"Al-Maida",ar:"Ø§Ù„Ù…Ø§Ø¦Ø¯Ø©"},{n:6,en:"Al-Anam",ar:"Ø§Ù„Ø£Ù†Ø¹Ø§Ù…"},
  {n:7,en:"Al-Araf",ar:"Ø§Ù„Ø£Ø¹Ø±Ø§Ù"},{n:8,en:"Al-Anfal",ar:"Ø§Ù„Ø£Ù†ÙØ§Ù„"},{n:9,en:"At-Tawba",ar:"Ø§Ù„ØªÙˆØ¨Ø©"},
  {n:10,en:"Yunus",ar:"ÙŠÙˆÙ†Ø³"},{n:11,en:"Hud",ar:"Ù‡ÙˆØ¯"},{n:12,en:"Yusuf",ar:"ÙŠÙˆØ³Ù"},
  {n:13,en:"Ar-Rad",ar:"Ø§Ù„Ø±Ø¹Ø¯"},{n:14,en:"Ibrahim",ar:"Ø¥Ø¨Ø±Ø§Ù‡ÙŠÙ…"},{n:15,en:"Al-Hijr",ar:"Ø§Ù„Ø­Ø¬Ø±"},
  {n:16,en:"An-Nahl",ar:"Ø§Ù„Ù†Ø­Ù„"},{n:17,en:"Al-Isra",ar:"Ø§Ù„Ø¥Ø³Ø±Ø§Ø¡"},{n:18,en:"Al-Kahf",ar:"Ø§Ù„ÙƒÙ‡Ù"},
  {n:19,en:"Maryam",ar:"Ù…Ø±ÙŠÙ…"},{n:20,en:"Taha",ar:"Ø·Ù‡"},{n:21,en:"Al-Anbiya",ar:"Ø§Ù„Ø£Ù†Ø¨ÙŠØ§Ø¡"},
  {n:22,en:"Al-Hajj",ar:"Ø§Ù„Ø­Ø¬"},{n:23,en:"Al-Muminun",ar:"Ø§Ù„Ù…Ø¤Ù…Ù†ÙˆÙ†"},{n:24,en:"An-Nur",ar:"Ø§Ù„Ù†ÙˆØ±"},
  {n:25,en:"Al-Furqan",ar:"Ø§Ù„ÙØ±Ù‚Ø§Ù†"},{n:26,en:"Ash-Shuara",ar:"Ø§Ù„Ø´Ø¹Ø±Ø§Ø¡"},{n:27,en:"An-Naml",ar:"Ø§Ù„Ù†Ù…Ù„"},
  {n:28,en:"Al-Qasas",ar:"Ø§Ù„Ù‚ØµØµ"},{n:29,en:"Al-Ankabut",ar:"Ø§Ù„Ø¹Ù†ÙƒØ¨ÙˆØª"},{n:30,en:"Ar-Rum",ar:"Ø§Ù„Ø±ÙˆÙ…"},
  {n:31,en:"Luqman",ar:"Ù„Ù‚Ù…Ø§Ù†"},{n:32,en:"As-Sajda",ar:"Ø§Ù„Ø³Ø¬Ø¯Ø©"},{n:33,en:"Al-Ahzab",ar:"Ø§Ù„Ø£Ø­Ø²Ø§Ø¨"},
  {n:34,en:"Saba",ar:"Ø³Ø¨Ø£"},{n:35,en:"Fatir",ar:"ÙØ§Ø·Ø±"},{n:36,en:"Ya-Sin",ar:"ÙŠØ³"},
  {n:37,en:"As-Saffat",ar:"Ø§Ù„ØµØ§ÙØ§Øª"},{n:38,en:"Sad",ar:"Øµ"},{n:39,en:"Az-Zumar",ar:"Ø§Ù„Ø²Ù…Ø±"},
  {n:40,en:"Ghafir",ar:"ØºØ§ÙØ±"},{n:41,en:"Fussilat",ar:"ÙØµÙ„Øª"},{n:42,en:"Ash-Shura",ar:"Ø§Ù„Ø´ÙˆØ±Ù‰"},
  {n:43,en:"Az-Zukhruf",ar:"Ø§Ù„Ø²Ø®Ø±Ù"},{n:44,en:"Ad-Dukhan",ar:"Ø§Ù„Ø¯Ø®Ø§Ù†"},{n:45,en:"Al-Jathiya",ar:"Ø§Ù„Ø¬Ø§Ø«ÙŠØ©"},
  {n:46,en:"Al-Ahqaf",ar:"Ø§Ù„Ø£Ø­Ù‚Ø§Ù"},{n:47,en:"Muhammad",ar:"Ù…Ø­Ù…Ø¯"},{n:48,en:"Al-Fath",ar:"Ø§Ù„ÙØªØ­"},
  {n:49,en:"Al-Hujurat",ar:"Ø§Ù„Ø­Ø¬Ø±Ø§Øª"},{n:50,en:"Qaf",ar:"Ù‚"},{n:51,en:"Adh-Dhariyat",ar:"Ø§Ù„Ø°Ø§Ø±ÙŠØ§Øª"},
  {n:52,en:"At-Tur",ar:"Ø§Ù„Ø·ÙˆØ±"},{n:53,en:"An-Najm",ar:"Ø§Ù„Ù†Ø¬Ù…"},{n:54,en:"Al-Qamar",ar:"Ø§Ù„Ù‚Ù…Ø±"},
  {n:55,en:"Ar-Rahman",ar:"Ø§Ù„Ø±Ø­Ù…Ù†"},{n:56,en:"Al-Waqia",ar:"Ø§Ù„ÙˆØ§Ù‚Ø¹Ø©"},{n:57,en:"Al-Hadid",ar:"Ø§Ù„Ø­Ø¯ÙŠØ¯"},
  {n:58,en:"Al-Mujadila",ar:"Ø§Ù„Ù…Ø¬Ø§Ø¯Ù„Ø©"},{n:59,en:"Al-Hashr",ar:"Ø§Ù„Ø­Ø´Ø±"},{n:60,en:"Al-Mumtahana",ar:"Ø§Ù„Ù…Ù…ØªØ­Ù†Ø©"},
  {n:61,en:"As-Saff",ar:"Ø§Ù„ØµÙ"},{n:62,en:"Al-Juma",ar:"Ø§Ù„Ø¬Ù…Ø¹Ø©"},{n:63,en:"Al-Munafiqun",ar:"Ø§Ù„Ù…Ù†Ø§ÙÙ‚ÙˆÙ†"},
  {n:64,en:"At-Taghabun",ar:"Ø§Ù„ØªØºØ§Ø¨Ù†"},{n:65,en:"At-Talaq",ar:"Ø§Ù„Ø·Ù„Ø§Ù‚"},{n:66,en:"At-Tahrim",ar:"Ø§Ù„ØªØ­Ø±ÙŠÙ…"},
  {n:67,en:"Al-Mulk",ar:"Ø§Ù„Ù…Ù„Ùƒ"},{n:68,en:"Al-Qalam",ar:"Ø§Ù„Ù‚Ù„Ù…"},{n:69,en:"Al-Haqqa",ar:"Ø§Ù„Ø­Ø§Ù‚Ø©"},
  {n:70,en:"Al-Maarij",ar:"Ø§Ù„Ù…Ø¹Ø§Ø±Ø¬"},{n:71,en:"Nuh",ar:"Ù†ÙˆØ­"},{n:72,en:"Al-Jinn",ar:"Ø§Ù„Ø¬Ù†"},
  {n:73,en:"Al-Muzzammil",ar:"Ø§Ù„Ù…Ø²Ù…Ù„"},{n:74,en:"Al-Muddaththir",ar:"Ø§Ù„Ù…Ø¯Ø«Ø±"},{n:75,en:"Al-Qiyama",ar:"Ø§Ù„Ù‚ÙŠØ§Ù…Ø©"},
  {n:76,en:"Al-Insan",ar:"Ø§Ù„Ø¥Ù†Ø³Ø§Ù†"},{n:77,en:"Al-Mursalat",ar:"Ø§Ù„Ù…Ø±Ø³Ù„Ø§Øª"},{n:78,en:"An-Naba",ar:"Ø§Ù„Ù†Ø¨Ø£"},
  {n:79,en:"An-Naziat",ar:"Ø§Ù„Ù†Ø§Ø²Ø¹Ø§Øª"},{n:80,en:"Abasa",ar:"Ø¹Ø¨Ø³"},{n:81,en:"At-Takwir",ar:"Ø§Ù„ØªÙƒÙˆÙŠØ±"},
  {n:82,en:"Al-Infitar",ar:"Ø§Ù„Ø§Ù†ÙØ·Ø§Ø±"},{n:83,en:"Al-Mutaffifin",ar:"Ø§Ù„Ù…Ø·ÙÙÙŠÙ†"},{n:84,en:"Al-Inshiqaq",ar:"Ø§Ù„Ø§Ù†Ø´Ù‚Ø§Ù‚"},
  {n:85,en:"Al-Buruj",ar:"Ø§Ù„Ø¨Ø±ÙˆØ¬"},{n:86,en:"At-Tariq",ar:"Ø§Ù„Ø·Ø§Ø±Ù‚"},{n:87,en:"Al-Ala",ar:"Ø§Ù„Ø£Ø¹Ù„Ù‰"},
  {n:88,en:"Al-Ghashiya",ar:"Ø§Ù„ØºØ§Ø´ÙŠØ©"},{n:89,en:"Al-Fajr",ar:"Ø§Ù„ÙØ¬Ø±"},{n:90,en:"Al-Balad",ar:"Ø§Ù„Ø¨Ù„Ø¯"},
  {n:91,en:"Ash-Shams",ar:"Ø§Ù„Ø´Ù…Ø³"},{n:92,en:"Al-Layl",ar:"Ø§Ù„Ù„ÙŠÙ„"},{n:93,en:"Ad-Duha",ar:"Ø§Ù„Ø¶Ø­Ù‰"},
  {n:94,en:"Ash-Sharh",ar:"Ø§Ù„Ø´Ø±Ø­"},{n:95,en:"At-Tin",ar:"Ø§Ù„ØªÙŠÙ†"},{n:96,en:"Al-Alaq",ar:"Ø§Ù„Ø¹Ù„Ù‚"},
  {n:97,en:"Al-Qadr",ar:"Ø§Ù„Ù‚Ø¯Ø±"},{n:98,en:"Al-Bayyina",ar:"Ø§Ù„Ø¨ÙŠÙ†Ø©"},{n:99,en:"Az-Zalzala",ar:"Ø§Ù„Ø²Ù„Ø²Ù„Ø©"},
  {n:100,en:"Al-Adiyat",ar:"Ø§Ù„Ø¹Ø§Ø¯ÙŠØ§Øª"},{n:101,en:"Al-Qaria",ar:"Ø§Ù„Ù‚Ø§Ø±Ø¹Ø©"},{n:102,en:"At-Takathur",ar:"Ø§Ù„ØªÙƒØ§Ø«Ø±"},
  {n:103,en:"Al-Asr",ar:"Ø§Ù„Ø¹ØµØ±"},{n:104,en:"Al-Humaza",ar:"Ø§Ù„Ù‡Ù…Ø²Ø©"},{n:105,en:"Al-Fil",ar:"Ø§Ù„ÙÙŠÙ„"},
  {n:106,en:"Quraysh",ar:"Ù‚Ø±ÙŠØ´"},{n:107,en:"Al-Maun",ar:"Ø§Ù„Ù…Ø§Ø¹ÙˆÙ†"},{n:108,en:"Al-Kawthar",ar:"Ø§Ù„ÙƒÙˆØ«Ø±"},
  {n:109,en:"Al-Kafirun",ar:"Ø§Ù„ÙƒØ§ÙØ±ÙˆÙ†"},{n:110,en:"An-Nasr",ar:"Ø§Ù„Ù†ØµØ±"},{n:111,en:"Al-Masad",ar:"Ø§Ù„Ù…Ø³Ø¯"},
  {n:112,en:"Al-Ikhlas",ar:"Ø§Ù„Ø¥Ø®Ù„Ø§Øµ"},{n:113,en:"Al-Falaq",ar:"Ø§Ù„ÙÙ„Ù‚"},{n:114,en:"An-Nas",ar:"Ø§Ù„Ù†Ø§Ø³"},
];

// Normalize Arabic for fuzzy matching (remove diacritics)
function normalizeAr(s) {
  if (!s) return "";
  return s
    .replace(/[\u0610-\u061A]/g, "")          // signes arabes (haut de page)
    .replace(/[\u064B-\u065F]/g, "")          // harakat classiques (fatha, damma, kasraâ€¦)
    .replace(/\u0670/g, "")                    // Ù° alef superscript (U+0670) â€” cause principale du bug
    .replace(/[\u06D6-\u06ED]/g, "")          // marques coraniques Ã©tendues
    .replace(/[Ø£Ø¥Ø¢Ù±\u0671]/g, "Ø§")           // toutes variantes d'alef â†’ Ø§
    .replace(/[Ù‰Ø¦]/g, "ÙŠ")
    .replace(/Ø©/g, "Ù‡")
    .replace(/\s+/g, " ").trim();
}

// Arabic root extraction via morphological pattern stripping
// Handles: prefixes (conj/art/prep), verb conjugation affixes (ÙŠÙ/ØªÙ/Ø£Ù/Ù†Ù),
// object/subject suffixes, dual/plural endings, shadda (doubled letter), weak letters.
function arabicRoot(word) {
  let w = normalizeAr(word);
  if (!w) return '';

  // 1. Strip definite article + prepositional prefixes (longest first)
  w = w.replace(/^(ÙˆØ¨Ø§Ù„|ÙˆÙƒØ§Ù„|ÙˆÙØ§Ù„|ÙˆØ§Ù„|ÙØ§Ù„|Ø¨Ø§Ù„|ÙƒØ§Ù„|Ù„Ù„|ÙÙ„|Ø¨Ù„|ÙƒÙ„|ÙˆÙ„|Ø§Ù„)/, '');

  // 2. Strip conjunctions / prepositions (single-letter prefixes)
  w = w.replace(/^[ÙˆÙØ¨ÙƒÙ„](?=[^\s])/, '');

  // 3. Strip verb conjugation prefixes: ÙŠÙÙ€ ÙŠÙÙ€ ØªÙÙ€ ØªÙÙ€ Ø£ÙÙ€ Ù†ÙÙ€
  //    (imperfect prefixes â€” the letter stays, we just note it's a prefix marker)
  //    represented after normalizeAr as bare ÙŠ Øª Ø§ Ù†
  const verbPrefixRe = /^[ÙŠØªØ§Ù†]/;

  // 4. Strip common verb/noun suffixes (longest first)
  w = w.replace(/(ÙˆÙƒÙ…|ÙˆÙƒÙ†|ÙˆÙ‡Ù…|ÙˆÙ‡Ù†|ÙˆÙ‡Ø§|ÙˆÙ†ÙŠ|ÙˆÙƒÙ|ÙˆÙƒ|ÙˆÙ†|ÙŠÙ†|ØªÙ…|ØªÙ†|ÙƒÙ…|ÙƒÙ†|Ù‡Ù…|Ù‡Ù†|ÙˆØ§|Ù‡Ø§|Ù†ÙŠ|ØªÙŠ|Ø§Ù†|Ø§Øª|Ø§Ù‡|Ø§Ùƒ|Ù†Ø§|Ùƒ|Ù‡|Ø§|Ù†)$/, '');

  // 5. Strip verb conjugation prefix AFTER suffix stripping (order matters)
  if (verbPrefixRe.test(w) && w.length > 3) w = w.replace(/^[ÙŠØªØ§Ù†]/, '');

  // 6. Collapse shadda-equivalent doubled letters (Ø´Ø¯Ø© effect):
  //    In uthmani text after normalizeAr, shadda (Ù‘) is stripped by normalizeAr already,
  //    but the doubled consonant may appear as two identical letters â€” deduplicate runs of 2
  w = w.replace(/(.)\1/, '$1');

  // 7. Strip remaining weak letters at edges if root still > 3 chars
  if (w.length > 3) {
    w = w.replace(/^[Ø§ÙˆÙŠØ¡]/, '');
    w = w.replace(/[Ø§ÙˆÙŠ]$/, '');
  }

  // 8. Collapse again after weak-letter stripping
  w = w.replace(/(.)\1/, '$1');

  return w.length >= 2 ? w : normalizeAr(word);
}

// Highlight occurrences of query in text
function highlightArabic(text, query) {
  if (!query || !text) return text;
  const normQ = normalizeAr(query.trim());
  if (!normQ) return text;
  const words = text.split(' ');
  const result = [];
  words.forEach((w, i) => {
    const normW = normalizeAr(w);
    const hit = normW.includes(normQ);
    result.push(
      <span key={i}>
        {hit ? <mark className="concord-highlight">{w}</mark> : w}
        {i < words.length - 1 ? ' ' : ''}
      </span>
    );
  });
  return result;
}

const SUGGESTED_SEARCHES = [
  "Ø§Ù„Ø±Ø­Ù…Ù†","Ø§Ù„Ù„Ù‡","Ø§Ù„ØµÙ„Ø§Ø©","Ø§Ù„Ø¬Ù†Ø©","Ø§Ù„Ù†Ø§Ø±","Ø§Ù„Ø¥ÙŠÙ…Ø§Ù†","Ø§Ù„ØªÙˆØ¨Ø©","Ø§Ù„ØµØ¨Ø±","Ø§Ù„Ø´ÙŠØ·Ø§Ù†","Ø§Ù„ÙƒØ§ÙØ±ÙŠÙ†",
  "Ø§Ù„Ù„Ù‡Ù…","Ø§Ù„Ù…Ø¤Ù…Ù†ÙŠÙ†","Ø§Ù„Ø±Ø­ÙŠÙ…","Ø§Ù„Ø³Ù…Ø§Ø¡","Ø§Ù„Ø£Ø±Ø¶"
];

// â”€â”€â”€ Lecteur audio inline pour concordance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ConcordInlinePlayer({ audioUrl }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  useEffect(() => () => { audioRef.current?.pause(); }, []);
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.currentTime = 0; a.play().catch(()=>{}); setPlaying(true); }
  };
  return (
    <>
      <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} style={{display:'none'}} />
      <button className="concord-go-btn" onClick={toggle}
        style={{ color: playing ? 'var(--teal)' : undefined, borderColor: playing ? 'var(--teal)' : undefined }}>
        {playing ? 'â¹' : 'â–¶'}
      </button>
    </>
  );
}

// â”€â”€ Sous-composant : un groupe sourate avec lazy-load Ã  l'ouverture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ConcordGroup({ group, debouncedQ, onNavigate, isLinked, toggleLink, textCache, onOpenCollModal, ayatInCollectionsFn }) {
  const [open, setOpen]       = useState(false);
  const [ayats, setAyats]     = useState(null); // null = pas encore chargÃ©
  const [loadingAyats, setLoadingAyats] = useState(false);
  const headerRef   = useRef(null);
  const observerRef = useRef(null);

  // IntersectionObserver : charge les ayats dÃ¨s que le header entre dans le viewport
  // ET que le groupe est ouvert â€” Ã©vite tout chargement hors-Ã©cran
  const loadAyats = useCallback(async () => {
    if (ayats !== null || loadingAyats) return; // dÃ©jÃ  chargÃ© ou en cours
    setLoadingAyats(true);
    try {
      // RÃ©utiliser le cache de phase 1 (quran-simple, sans diacritiques)
      // pour garantir que normalizeAr produit le mÃªme rÃ©sultat qu'au scan
      let all = textCache?.current?.[group.surahNum];
      if (!all) {
        all = await fetchSurahSimple(group.surahNum);
        if (textCache?.current) textCache.current[group.surahNum] = all;
      }
      const normQ = normalizeAr(debouncedQ.trim());
      const matching = all.filter(a => {
        const t = normalizeAr(a.text);
        const words = normQ.split(/\s+/).filter(Boolean);
        if (group.fuzzy)    return words.every(w => t.includes(w));
        if (group.wordMode) return t.split(" ").some(w => w === normQ || w.startsWith(normQ) || w.endsWith(normQ));
        return t.includes(normQ);
      });
      setAyats(matching);
    } catch {
      setAyats([]);
    }
    setLoadingAyats(false);
  }, [ayats, loadingAyats, group.surahNum, group.fuzzy, debouncedQ, textCache]);

  // Quand on ouvre le groupe, charger les ayats
  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && ayats === null) loadAyats();
  };

  // Observer scroll : si le header devient visible ET groupe dÃ©jÃ  ouvert, charger
  useEffect(() => {
    if (!headerRef.current) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && open && ayats === null) loadAyats(); },
      { rootMargin: '120px' }
    );
    observerRef.current.observe(headerRef.current);
    return () => observerRef.current?.disconnect();
  }, [open, ayats, loadAyats]);

  const displayAyats = ayats ?? [];

  return (
    <div className="concord-group">
      {/* En-tÃªte cliquable */}
      <div ref={headerRef} className="concord-group-header" onClick={handleToggle}>
        <div className="concord-group-num">{group.surahNum}</div>
        <div className="concord-group-name">{group.surahEn}</div>
        <div className="concord-group-ar">{group.surahAr}</div>
        <div className="concord-group-badge">
          {ayats === null ? `~${group.count}` : displayAyats.length} AYAT{group.count>1?"S":""}
        </div>
        <div className={`concord-group-chevron${open?" open":""}`}>â–¶</div>
      </div>

      {/* Corps â€” visible seulement si ouvert */}
      {open && (
        <div>
          {loadingAyats && (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 18px",color:"var(--text3)",fontSize:10,letterSpacing:1}}>
              <div className="loading-ring" style={{width:16,height:16,borderWidth:2}} />
              CHARGEMENT...
            </div>
          )}
          {!loadingAyats && displayAyats.length === 0 && (
            <div style={{padding:"12px 18px",fontSize:10,color:"var(--text3)",letterSpacing:1}}>
              AUCUN RÃ‰SULTAT DANS CETTE SOURATE
            </div>
          )}
          {displayAyats.map(ayat => (
            <div key={ayat.num} className="concord-ayat-item">
              <div className="concord-ayat-num">{ayat.num}</div>
              <div className="concord-ayat-text">
                {highlightArabic(ayat.text, debouncedQ)}
              </div>
              <div className="concord-ayat-actions">
                <button className="concord-go-btn" onClick={() => onNavigate(group.surahNum, ayat.num)}>
                  â†’ OUVRIR
                </button>
                {onOpenCollModal && (
                  <button
                    className="concord-go-btn"
                    style={{ color: ayatInCollectionsFn?.(group.surahNum, ayat.num)?.length > 0 ? "#c878ff" : undefined,
                             borderColor: ayatInCollectionsFn?.(group.surahNum, ayat.num)?.length > 0 ? "#c878ff" : undefined }}
                    onClick={() => onOpenCollModal({ surahNum: group.surahNum, surahEn: group.surahEn, ayatNum: ayat.num, text: ayat.text, number: ayat.num })}
                  >
                    ğŸ—‚
                  </button>
                )}
                <button
                  className={`concord-link-btn${isLinked(group.surahNum, ayat.num) ? " linked" : ""}`}
                  onClick={() => toggleLink(group.surahNum, group.surahEn, ayat.num, ayat.text)}
                >
                  {isLinked(group.surahNum, ayat.num) ? "âœ“ LIÃ‰" : "ğŸ”— LIER"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// â”€â”€â”€ SharedGroup â€” affiche un groupe d'ayats partageant une sÃ©quence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SharedGroup({ group, sharedN, searchMode, onNavigate, toggleLink, isLinked, onOpenCollModal }) {
  const [open, setOpen] = useState(false);
  const label = searchMode === 'shared-start' ? 'DÃ‰BUT' : searchMode === 'shared-end' ? 'FIN' : 'SÃ‰QUENCE';
  return (
    <div style={{borderBottom:'1px solid var(--border2)',margin:'0'}}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{padding:'10px 20px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,background:open?'var(--surface2)':'transparent',transition:'background .15s'}}>
        <div style={{width:28,height:28,borderRadius:'50%',border:'1px solid var(--gold)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'var(--gold)',fontFamily:"'Cinzel',serif",flexShrink:0}}>
          {group.count}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:8,letterSpacing:1.5,color:'var(--text3)',marginBottom:3}}>{label} Â· {sharedN} MOT{sharedN>1?'S':''}</div>
          <div style={{fontFamily:"'Amiri Quran',serif",fontSize:17,direction:'rtl',color:'var(--gold2)',textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {group.seq}
          </div>
        </div>
        <span style={{fontSize:8,color:'var(--text3)'}}>{open?'â–²':'â–¼'}</span>
      </div>
      {open && (
        <div style={{background:'var(--surface2)',padding:'4px 0 8px'}}>
          {group.ayats.map((a,i) => {
            const info = SURAH_INFO.find(s=>s.n===a.sn);
            const linked = isLinked(a.sn, a.num);
            return (
              <div key={i} style={{padding:'8px 20px',borderBottom:'1px solid rgba(42,47,64,.3)',display:'flex',alignItems:'flex-start',gap:10}}>
                <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:3,alignItems:'center',minWidth:44}}>
                  <div style={{width:30,height:30,border:'1px solid var(--border2)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'var(--text3)',fontFamily:"'Cinzel',serif"}}>{a.num}</div>
                  <div style={{fontSize:7,letterSpacing:1,color:'var(--text3)'}}>{info?.en||`S.${a.sn}`}</div>
                </div>
                <div style={{flex:1,minWidth:0,fontFamily:"'Amiri Quran',serif",fontSize:18,direction:'rtl',textAlign:'right',lineHeight:1.8,color:'var(--text)',cursor:'pointer'}}
                  onClick={()=>onNavigate(a.sn,a.num)}>
                  {a.text}
                </div>
                <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:4}}>
                  <button onClick={()=>toggleLink(a.sn,info?.en||`S.${a.sn}`,a.num,a.text)}
                    style={{fontSize:8,padding:'3px 8px',border:`1px solid ${linked?'var(--gold)':'var(--border2)'}`,background:linked?'rgba(201,168,76,.12)':'transparent',color:linked?'var(--gold)':'var(--text3)',borderRadius:10,cursor:'pointer',fontFamily:"'Cinzel',serif"}}>
                    {linked?'âœ“':'ğŸ”—'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConcordancePage({ surahs: surahList, onNavigate, collections, onOpenCollModal, ayatInCollectionsFn, initialQuery }) {
  const [query, setQuery]           = useState(initialQuery || "");
  const [debouncedQ, setDebouncedQ] = useState(initialQuery || "");
  const [searchMode, setSearchMode] = useState("exact");
  const [surahFilter, setSurahFilter]= useState("all"); // "all" | Set of surahNums as strings
  const surahFilterKey = useMemo(() =>
    surahFilter instanceof Set ? [...surahFilter].sort().join(',') : String(surahFilter),
  [surahFilter]);
  const [surahPickerOpen, setSurahPickerOpen] = useState(false);
  const [surahPickerSearch, setSurahPickerSearch] = useState("");
  // surahsToSearch helper (shared by both useEffects)
  const getsurahsToSearch = (filter) =>
    filter === "all" ? SURAH_INFO.map(s => s.n)
    : filter instanceof Set ? [...filter].map(Number).sort((a,b)=>a-b)
    : [parseInt(filter)];
  // groups = [{surahNum, surahEn, surahAr, count, fuzzy}] â€” PAS les ayats
  const [groups, setGroups]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [sharedN, setSharedN]         = useState(3);   // nb de mots pour modes shared-*
  const [sharedGroups, setSharedGroups] = useState([]); // [{seq, count, ayats:[{sn,num,text}]}]
  const [sharedLoading, setSharedLoading] = useState(false);
  const sharedTokenRef = useRef(0);

  const [linkedAyats, setLinkedAyats]= useState(() => {
    try { const s = localStorage.getItem("quran_concordLinks"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const debounceRef    = useRef(null);
  const cacheRef       = useRef({}); // surahNum -> ayats[] (texte brut)
  const searchTokenRef = useRef(0);
  const listRef        = useRef(null); // ref sur le conteneur de rÃ©sultats

  // Debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(query), 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Re-sync when a new "search selection" query arrives while page stays mounted
  useEffect(() => {
    if (initialQuery && initialQuery !== query) { setQuery(initialQuery); setDebouncedQ(initialQuery); }
  }, [initialQuery]); // eslint-disable-line

  // Fetch texte brut d'une sourate (cache lÃ©ger â€” texte seul, pas d'audio)
  const fetchSurahText = useCallback(async (num) => {
    if (cacheRef.current[num]) return cacheRef.current[num];
    const ayats = await fetchSurahSimple(num);
    cacheRef.current[num] = ayats;
    return ayats;
  }, []);

  // Phase 1 : scan lÃ©ger â€” dÃ©termine quelles sourates contiennent le mot
  // Charge le texte sans audio (endpoint plus lÃ©ger), pas les ayats complets
  useEffect(() => {
    if (!debouncedQ.trim()) { setGroups([]); setLoading(false); return; }
    const normQ = normalizeAr(debouncedQ.trim());
    if (normQ.length < 2) { setGroups([]); return; }

    const token = ++searchTokenRef.current;
    setGroups([]);
    setLoading(true);

    const surahsToSearch = getsurahsToSearch(surahFilter);

    const BATCH = 5; // plus rapide pour le scan lÃ©ger
    const fuzzy = searchMode === "fuzzy";
    const wordMode = searchMode === "word";
    const startMode = searchMode === "start";
    const endMode   = searchMode === "end";

    // matchText: retourne true si normQ correspond dans le texte selon le mode
    const matchText = (t, q) => {
      if (fuzzy) return q.split(/\s+/).filter(Boolean).every(w => t.includes(w));
      if (wordMode) {
        const words = t.split(" ");
        return words.some(w => w === q || w.startsWith(q) || w.endsWith(q));
      }
      if (startMode) {
        // L'ayat (normalisÃ©) commence par exactement ces mots
        const qWords = q.split(/\s+/).filter(Boolean);
        const tWords = t.split(/\s+/).filter(Boolean);
        return qWords.every((w, i) => tWords[i] !== undefined && (tWords[i] === w || tWords[i].startsWith(w)));
      }
      if (endMode) {
        // L'ayat (normalisÃ©) se termine par exactement ces mots
        const qWords = q.split(/\s+/).filter(Boolean);
        const tWords = t.split(/\s+/).filter(Boolean);
        const offset = tWords.length - qWords.length;
        if (offset < 0) return false;
        return qWords.every((w, i) => tWords[offset + i] !== undefined && (tWords[offset + i] === w || tWords[offset + i].endsWith(w)));
      }
      return t.includes(q);
    };

    (async () => {
      for (let i = 0; i < surahsToSearch.length; i += BATCH) {
        if (token !== searchTokenRef.current) return;
        const batch = surahsToSearch.slice(i, i + BATCH);
        const batchGroups = await Promise.all(batch.map(async (sn) => {
          try {
            const ayats = await fetchSurahText(sn);
            const count = ayats.filter(a => {
              const t = normalizeAr(a.text);
              return matchText(t, normQ);
            }).length;
            if (count > 0) {
              const info = SURAH_INFO.find(s => s.n === sn);
              return { surahNum: sn, surahEn: info?.en||`Sourate ${sn}`, surahAr: info?.ar||"", count, fuzzy, wordMode, startMode, endMode };
            }
          } catch {}
          return null;
        }));
        if (token !== searchTokenRef.current) return;
        const valid = batchGroups.filter(Boolean);
        if (valid.length > 0) {
          setGroups(prev => {
            const merged = [...prev, ...valid];
            merged.sort((a,b) => a.surahNum - b.surahNum);
            return merged;
          });
        }
      }
      if (token === searchTokenRef.current) setLoading(false);
    })();
  }, [debouncedQ, searchMode, surahFilter, fetchSurahText]);

  // â”€â”€ Modes shared-* : grouper les ayats par sÃ©quence de N mots identiques â”€â”€
  const isSharedMode = ["shared-start","shared-end","shared-contain"].includes(searchMode);

  useEffect(() => {
    if (!isSharedMode) { setSharedGroups([]); return; }
    const token = ++sharedTokenRef.current;
    setSharedGroups([]);
    setSharedLoading(true);

    const surahsToSearch = getsurahsToSearch(surahFilter);

    const N = Math.max(1, sharedN);

    const getSeq = (words, mode) => {
      if (mode === "shared-start")   return words.slice(0, N).join(" ");
      if (mode === "shared-end")     return words.slice(-N).join(" ");
      // shared-contain: toutes les sous-sÃ©quences de N mots consÃ©cutifs
      const seqs = [];
      for (let i = 0; i <= words.length - N; i++) seqs.push(words.slice(i, i + N).join(" "));
      return seqs;
    };

    (async () => {
      // Phase 1: charger tous les ayats
      const allAyats = [];
      for (let i = 0; i < surahsToSearch.length; i += 10) {
        if (token !== sharedTokenRef.current) return;
        const batch = surahsToSearch.slice(i, i + 10);
        const results = await Promise.all(batch.map(sn =>
          fetchSurahText(sn).then(ayats => ayats.map(a => ({ sn, num: a.num, text: a.text }))).catch(() => [])
        ));
        results.forEach(r => allAyats.push(...r));
      }
      if (token !== sharedTokenRef.current) return;

      // Phase 2: grouper par sÃ©quence
      const map = new Map(); // seq -> [{sn,num,text}]
      allAyats.forEach(a => {
        const words = normalizeAr(a.text).split(/\s+/).filter(Boolean);
        if (words.length < N) return;
        const seqs = searchMode === "shared-contain" ? getSeq(words, searchMode) : [getSeq(words, searchMode)];
        seqs.forEach(seq => {
          if (!seq) return;
          if (!map.has(seq)) map.set(seq, []);
          map.get(seq).push(a);
        });
      });

      // Phase 3: garder uniquement les sÃ©quences partagÃ©es par â‰¥2 ayats
      const groups = [];
      map.forEach((ayats, seq) => {
        if (ayats.length >= 2) groups.push({ seq, count: ayats.length, ayats });
      });
      groups.sort((a, b) => b.count - a.count);

      if (token === sharedTokenRef.current) {
        setSharedGroups(groups);
        setSharedLoading(false);
      }
    })();
  }, [searchMode, sharedN, surahFilterKey, isSharedMode, fetchSurahText]);

  // Scroll vers le haut quand une nouvelle recherche commence
  useEffect(() => {
    if (debouncedQ && listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [debouncedQ]);

  const totalCount = groups.reduce((a, g) => a + g.count, 0);

  const toggleLink = (surahNum, surahEn, ayatNum, text) => {
    setLinkedAyats(prev => {
      const key = `${surahNum}:${ayatNum}`;
      const exists = prev.find(l => l.key === key);
      const next = exists
        ? prev.filter(l => l.key !== key)
        : [...prev, { key, surahNum, surahEn, ayatNum, text }];
      try { localStorage.setItem("quran_concordLinks", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const isLinked = (surahNum, ayatNum) =>
    linkedAyats.some(l => l.key === `${surahNum}:${ayatNum}`);

  return (
    <div className="concord-page" ref={listRef}>
      {/* Barre de recherche */}
      <div className="concord-search-bar">
        <input
          type="text"
          placeholder="Rechercher des mots ou parties d'ayats..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="concord-mode-tabs">
          <button className={`concord-mode-tab${searchMode==="exact"?" active":""}`} onClick={()=>setSearchMode("exact")} title="Correspondance exacte n'importe oÃ¹ dans le mot">EXACT</button>
          <button className={`concord-mode-tab${searchMode==="word"?" active":""}`} onClick={()=>setSearchMode("word")} title="Mot entier â€” premier ou dernier mot de l'ayat inclus">MOT</button>
          <button className={`concord-mode-tab${searchMode==="fuzzy"?" active":""}`} onClick={()=>setSearchMode("fuzzy")} title="Tous les mots de la recherche prÃ©sents dans l'ayat">FLOU</button>
          <button className={`concord-mode-tab${searchMode==="start"?" active":""}`} onClick={()=>setSearchMode("start")} title="L'ayat commence par ces mots">DÃ‰BUT</button>
          <button className={`concord-mode-tab${searchMode==="end"?" active":""}`} onClick={()=>setSearchMode("end")} title="L'ayat se termine par ces mots">FIN</button>
          <button className={`concord-mode-tab${searchMode==="shared-start"?" active":""}`} onClick={()=>setSearchMode("shared-start")} title="Ayats partageant les mÃªmes N premiers mots">DÃ‰BUT COMMUN</button>
          <button className={`concord-mode-tab${searchMode==="shared-end"?" active":""}`} onClick={()=>setSearchMode("shared-end")} title="Ayats partageant les mÃªmes N derniers mots">FIN COMMUNE</button>
          <button className={`concord-mode-tab${searchMode==="shared-contain"?" active":""}`} onClick={()=>setSearchMode("shared-contain")} title="Ayats partageant une sÃ©quence de N mots identiques">SÃ‰QUENCE</button>
        </div>
        {isSharedMode && (
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0 2px',flexWrap:'wrap'}}>
            <span style={{fontSize:9,letterSpacing:1.5,color:'var(--text3)',fontFamily:"'Cinzel',serif"}}>MOTS :</span>
            {[1,2,3,4,5,6,7,8].map(n => (
              <button key={n} onClick={()=>setSharedN(n)}
                style={{fontSize:9,letterSpacing:1,padding:'3px 10px',borderRadius:12,cursor:'pointer',fontFamily:"'Cinzel',serif",
                  border:`1px solid ${sharedN===n?'var(--gold)':'var(--border2)'}`,
                  background:sharedN===n?'rgba(201,168,76,.12)':'transparent',
                  color:sharedN===n?'var(--gold)':'var(--text3)',transition:'all .2s'}}>
                {n}
              </button>
            ))}
          </div>
        )}
        {/* Surah multi-picker */}
        <div style={{position:'relative'}}>
          <button onClick={()=>setSurahPickerOpen(o=>!o)}
            style={{display:'flex',alignItems:'center',gap:6,background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:'var(--radius-sm)',padding:'7px 12px',color:surahFilter==='all'?'var(--text3)':'var(--gold)',fontSize:10,letterSpacing:1,fontFamily:"'Cinzel',serif",cursor:'pointer',whiteSpace:'nowrap',minWidth:180}}>
            {surahFilter==='all'
              ? 'TOUTES LES SOURATES'
              : `${surahFilter instanceof Set ? surahFilter.size : 1} SOURATE${(surahFilter instanceof Set?surahFilter.size:1)>1?'S':''} SÃ‰LECTIONNÃ‰E${(surahFilter instanceof Set?surahFilter.size:1)>1?'S':''}`}
            <span style={{marginLeft:'auto',fontSize:8,color:'var(--text3)'}}>{surahPickerOpen?'â–²':'â–¼'}</span>
          </button>
          {surahPickerOpen && (
            <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:200,background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:'var(--radius-sm)',boxShadow:'0 8px 24px rgba(0,0,0,.4)',width:260,maxHeight:320,display:'flex',flexDirection:'column'}}>
              <div style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)',display:'flex',gap:6}}>
                <input value={surahPickerSearch} onChange={e=>setSurahPickerSearch(e.target.value)}
                  placeholder="Filtrer souratesâ€¦"
                  style={{flex:1,background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:4,padding:'4px 8px',color:'var(--text)',fontSize:10,outline:'none'}}/>
                <button onClick={()=>{setSurahFilter('all');setSurahPickerOpen(false);setSurahPickerSearch('');}}
                  style={{fontSize:8,padding:'4px 8px',border:'1px solid var(--border2)',background:'transparent',color:'var(--text3)',borderRadius:4,cursor:'pointer',fontFamily:"'Cinzel',serif"}}>
                  TOUT
                </button>
              </div>
              <div style={{overflowY:'auto',flex:1}}>
                {SURAH_INFO.filter(s=>
                  !surahPickerSearch.trim() ||
                  s.en.toLowerCase().includes(surahPickerSearch.toLowerCase()) ||
                  s.ar.includes(surahPickerSearch) ||
                  String(s.n).includes(surahPickerSearch)
                ).map(s => {
                  const sel = surahFilter instanceof Set ? surahFilter.has(String(s.n)) : surahFilter===String(s.n);
                  return (
                    <div key={s.n} onClick={()=>{
                      setSurahFilter(prev => {
                        const set = prev === 'all' ? new Set() : prev instanceof Set ? new Set(prev) : new Set([String(prev)]);
                        if (set.has(String(s.n))) set.delete(String(s.n)); else set.add(String(s.n));
                        return set.size === 0 ? 'all' : set;
                      });
                    }}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',cursor:'pointer',background:sel?'rgba(201,168,76,.08)':'transparent',transition:'background .1s',borderBottom:'1px solid rgba(42,47,64,.3)'}}>
                      <div style={{width:14,height:14,border:`1px solid ${sel?'var(--gold)':'var(--border2)'}`,borderRadius:3,background:sel?'var(--gold)':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {sel && <span style={{fontSize:8,color:'var(--surface)',lineHeight:1}}>âœ“</span>}
                      </div>
                      <span style={{fontSize:9,color:'var(--text3)',minWidth:20}}>{s.n}.</span>
                      <span style={{fontSize:10,color:sel?'var(--gold)':'var(--text2)',flex:1}}>{s.en}</span>
                      <span style={{fontFamily:"'Amiri Quran',serif",fontSize:14,color:sel?'var(--gold)':'var(--text3)',direction:'rtl'}}>{s.ar}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{padding:'6px 10px',borderTop:'1px solid var(--border2)',display:'flex',justifyContent:'flex-end'}}>
                <button onClick={()=>setSurahPickerOpen(false)}
                  style={{fontSize:8,padding:'4px 12px',border:'1px solid var(--gold)',background:'transparent',color:'var(--gold)',borderRadius:4,cursor:'pointer',fontFamily:"'Cinzel',serif"}}>
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shared-mode results */}
      {isSharedMode && (
        <div style={{padding:'0 0 12px'}}>
          {sharedLoading && (
            <div style={{padding:'16px 20px',fontSize:9,letterSpacing:1.5,color:'var(--text3)',fontFamily:"'Cinzel',serif"}}>
              ANALYSE DU CORPUSâ€¦
            </div>
          )}
          {!sharedLoading && sharedGroups.length === 0 && (
            <div style={{padding:'16px 20px',fontSize:9,letterSpacing:1.5,color:'var(--text3)',fontFamily:"'Cinzel',serif',textAlign:'center"}}>
              AUCUN AYAT NE PARTAGE {sharedN} MOT{sharedN>1?'S':''} {searchMode==='shared-start'?'DE DÃ‰BUT':searchMode==='shared-end'?'DE FIN':'EN SÃ‰QUENCE'}
            </div>
          )}
          {!sharedLoading && sharedGroups.length > 0 && (
            <div style={{padding:'8px 0 0'}}>
              <div style={{padding:'4px 20px 10px',fontSize:9,letterSpacing:1.5,color:'var(--text3)',fontFamily:"'Cinzel',serif"}}>
                {sharedGroups.length} SÃ‰QUENCE{sharedGroups.length>1?'S':''} â€” {sharedGroups.reduce((a,g)=>a+g.count,0)} AYATS
              </div>
              {sharedGroups.map((g, gi) => (
                <SharedGroup key={gi} group={g} sharedN={sharedN} searchMode={searchMode}
                  onNavigate={onNavigate} toggleLink={toggleLink} isLinked={isLinked}
                  onOpenCollModal={onOpenCollModal} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suggestions */}
      {!isSharedMode && !query && (
        <div>
          <div style={{fontSize:9,letterSpacing:2,color:"var(--text3)",marginBottom:8,fontFamily:"'Cinzel',serif"}}>SUGGESTIONS DE RECHERCHE</div>
          <div className="concord-tags-row">
            {SUGGESTED_SEARCHES.map(s => (
              <button key={s} className="concord-tag" onClick={() => setQuery(s)}>
                <span style={{fontFamily:"'Amiri Quran',serif",fontSize:16,direction:"rtl"}}>{s}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chargement initial */}
      {!isSharedMode && loading && groups.length === 0 && (
        <div className="concord-loading">
          <div className="loading-ring" />
          SCAN EN COURS...
        </div>
      )}

      {/* Pas de rÃ©sultats */}
      {!loading && debouncedQ && groups.length === 0 && (
        <div className="concord-empty">
          <div className="concord-empty-arabic">Ù„Ø§ Ù†ØªØ§Ø¦Ø¬</div>
          <div className="concord-empty-msg">AUCUN AYAT TROUVÃ‰<br/>Essayez un autre mot ou le mode FLOU</div>
        </div>
      )}

      {/* RÃ©sultats */}
      {groups.length > 0 && (
        <>
          <div className="concord-results-header">
            <div className="concord-results-count">
              <span>~{totalCount}</span> AYAT{totalCount>1?"S":""} Â· <span>{groups.length}</span> SOURATE{groups.length>1?"S":""}
              {loading && (
                <span style={{marginLeft:8,display:"inline-flex",alignItems:"center",gap:5,color:"var(--text3)",fontSize:9}}>
                  <span style={{width:10,height:10,border:"1.5px solid var(--border2)",borderTopColor:"var(--gold)",borderRadius:"50%",display:"inline-block",animation:"spin .8s linear infinite"}}/>
                  EN COURS...
                </span>
              )}
            </div>
            <div style={{fontSize:9,letterSpacing:1,color:"var(--text3)"}}>
              CLIQUEZ SUR UNE SOURATE POUR CHARGER LES AYATS
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {groups.map(group => (
              <ConcordGroup
                key={`${group.surahNum}-${debouncedQ}`}
                group={group}
                debouncedQ={debouncedQ}
                onNavigate={onNavigate}
                isLinked={isLinked}
                toggleLink={toggleLink}
                textCache={cacheRef}
                onOpenCollModal={onOpenCollModal}
                ayatInCollectionsFn={ayatInCollectionsFn}
              />
            ))}
          </div>
        </>
      )}

      {/* Ayats liÃ©s */}
      {linkedAyats.length > 0 && (
        <div className="concord-links-panel">
          <div className="concord-links-title">ğŸ”— AYATS LIÃ‰S Â· {linkedAyats.length}</div>
          {linkedAyats.map(link => (
            <div key={link.key} className="concord-link-card" onClick={()=>onNavigate(link.surahNum, link.ayatNum)}>
              <div className="concord-link-ref">{link.surahEn} Â· {link.ayatNum}</div>
              <div className="concord-link-text">{link.text}</div>
              <button className="concord-link-remove" onClick={e=>{e.stopPropagation();toggleLink(link.surahNum,link.surahEn,link.ayatNum,link.text);}}>âœ•</button>
            </div>
          ))}
          <div style={{marginTop:10}}>
            <button className="btn-small" style={{color:"var(--red)",borderColor:"var(--red)"}} onClick={()=>{
              setLinkedAyats([]);
              try{localStorage.removeItem("quran_concordLinks");}catch{}
            }}>EFFACER TOUS LES LIENS</button>
          </div>
        </div>
      )}

      {!query && linkedAyats.length === 0 && (
        <div className="concord-empty">
          <div className="concord-empty-arabic">Ø§Ù„Ø¨Ø­Ø«</div>
          <div className="concord-empty-msg">
            RECHERCHEZ DES MOTS OU PARTIES D'AYATS<br/>
            PUIS LIEZ LES VERSETS QUI PARTAGENT UN THÃˆME
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ MAIN APP (inner â€” wrapped by Provider below) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AppInner({ currentUser, onSignOut }) {
  const dispatch = useDispatch();

  // â”€â”€ Selectors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const surahs          = useSelector(sel.surahs);
  const selectedSurah   = useSelector(sel.selectedSurah);
  const ayats           = useSelector(sel.ayats);
  const loadingSurahs   = useSelector(sel.loadingSurahs);
  const loadingAyats    = useSelector(sel.loadingAyats);
  const search          = useSelector(sel.search);
  const openAyatNum     = useSelector(sel.openAyatNum);
  const submenuMode     = useSelector(sel.submenuMode);
  const lastAyatBySurah = useSelector(sel.lastAyatBySurah, shallowEqual);
  const partSelectAyat  = useSelector(sel.partSelectAyat);
  const partSelectStep  = useSelector(sel.partSelectStep);
  const partSelectStart = useSelector(sel.partSelectStart);
  const learnData       = useSelector(sel.learnData, shallowEqual);
  const collections     = useSelector(sel.collections, shallowEqual);
  const collModal       = useSelector(sel.collModal);
  // â”€â”€ High-frequency play state â†’ refs + version counter (avoids full re-render) â”€â”€
  const playingAyatNumRef = useRef(null);
  const isMainPlayingRef  = useRef(false);
  const mainAyatIdxRef    = useRef(0);
  const localPlayingRef   = useRef(null);
  const [playStateVer, setPlayStateVer] = useState(0);
  useEffect(() => {
    const unsub = store.subscribe(() => {
      const s = store.getState();
      mainCurrentMsRef.current = sel.mainCurrentMs(s);
      const pan = sel.playingAyatNum(s);
      const imp = sel.isMainPlaying(s);
      const mai = sel.mainAyatIdx(s);
      const lp  = sel.localPlaying(s);
      if (pan !== playingAyatNumRef.current || imp !== isMainPlayingRef.current ||
          mai !== mainAyatIdxRef.current || lp?.ayatNum !== localPlayingRef.current?.ayatNum) {
        playingAyatNumRef.current = pan;
        isMainPlayingRef.current  = imp;
        mainAyatIdxRef.current    = mai;
        localPlayingRef.current   = lp;
        setPlayStateVer(v => v + 1);
      }
    });
    return unsub;
  }, []);
  const playingAyatNum = playingAyatNumRef.current;
  const isMainPlaying  = isMainPlayingRef.current;
  const mainAyatIdx    = mainAyatIdxRef.current;
  const localPlaying   = localPlayingRef.current;
  const timestampsMapRef = useRef({});
  const tsVersionRef = useRef(0);
  const [tsVersion, setTsVersion] = useState(0);
  const timestampsMap = timestampsMapRef.current;
  const mainCurrentMsRef = useRef(0);

  const sidebarOpen     = useSelector(sel.sidebarOpen);
  const location        = useLocation();
  const navigate        = useNavigate();
  const [selMenu, setSelMenu] = useState(null); // {x,y,text} â€” custom context menu on ayat text selection
  const [pendingSearchQuery, setPendingSearchQuery] = useState(null);
  const handleAyatContextMenu = (e) => {
    const winSel = window.getSelection ? window.getSelection() : null;
    const text = winSel ? winSel.toString().trim() : "";
    if (!text) { setSelMenu(null); return; } // no selection â†’ let native menu show
    e.preventDefault();
    setSelMenu({ x: e.clientX, y: e.clientY, text });
  };
  const searchSelectionInCollections = () => {
    if (!selMenu?.text) return;
    setPendingSearchQuery(selMenu.text);
    setSelMenu(null);
    navigate("/collections");
  };
  const urlSegs         = location.pathname.replace(/^\//, '').split('/');
  const activePage      = urlSegs[0] || 'quran';
  const urlSurahNum     = parseInt(urlSegs[1]);
  const urlAyatNum      = parseInt(urlSegs[2]);

  // â”€â”€ Sync URL â†’ Redux (selectedSurah, openAyatNum) â”€â”€
  useEffect(() => {
    if (isNaN(urlSurahNum) || surahs.length === 0) return;
    const s = surahs.find(x => x.number === urlSurahNum);
    if (s && s.number !== selectedSurah?.number) {
      setSelectedSurah(s);
    } else if (s && s.number === selectedSurah?.number) {
      // Same surah â€” back navigation: restore openAyatNum from URL or lastAyatBySurah
      const targetAyat = !isNaN(urlAyatNum) ? urlAyatNum : (lastAyatBySurah[urlSurahNum] ?? null);
      if (targetAyat != null) {
        setOpenAyatNum(targetAyat);
        const tryScroll = (attempts = 0) => {
          const el = ayatRefs.current[targetAyat];
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
          else if (attempts < 20) requestAnimationFrame(() => tryScroll(attempts + 1));
        };
        requestAnimationFrame(() => tryScroll());
      } else {
        setOpenAyatNum(null);
      }
    }
    if (!isNaN(urlAyatNum) && s?.number !== selectedSurah?.number) setTimeout(() => {
      setOpenAyatNum(urlAyatNum);
      const el = ayatRefs.current[urlAyatNum];
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    }, 400);
  }, [urlSurahNum, urlAyatNum, surahs.length, activePage]);

  // â”€â”€ Sync Redux â†’ URL (selectedSurah) â”€â”€
  useEffect(() => {
    if (!selectedSurah) return;
    const target = `/quran/${selectedSurah.number}`;
    if (!location.pathname.startsWith(target)) navigate(target, { replace: true });
  }, [selectedSurah?.number]);

  // â”€â”€ Sync Redux â†’ URL (openAyatNum) â”€â”€
  useEffect(() => {
    if (!selectedSurah || openAyatNum == null) return;
    const target = `/quran/${selectedSurah.number}/${openAyatNum}`;
    if (location.pathname !== target) navigate(target, { replace: true });
  }, [openAyatNum, selectedSurah?.number]);
  const showTsBar           = useSelector(sel.showTsBar);
  const enableTimestamps     = useSelector(sel.enableTimestamps);
  const enableLetterByLetter = useSelector(sel.enableLetterByLetter);
  const enableAnimations     = useSelector(sel.enableAnimations);
  const enableHeavyCompute   = useSelector(sel.enableHeavyCompute);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showUserMenu, setShowUserMenu]         = useState(false);
  const userMenuRef                             = useRef(null);

  // Close user menu on outside click or page change
  useEffect(() => {
    const handleOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("touchstart", handleOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showUserMenu]);

  useEffect(() => {
    setShowUserMenu(false);
  }, [activePage]);

  const loopActiveRef   = useRef(false);
  const loopStartRef    = useRef(0);
  const loopEndRef      = useRef(0);
  const [loopStateVer, setLoopStateVer] = useState(0);
  useEffect(() => {
    const unsub = store.subscribe(() => {
      const s = store.getState();
      const la = sel.loopActive(s), ls = sel.loopStart(s), le = sel.loopEnd(s);
      if (la !== loopActiveRef.current || ls !== loopStartRef.current || le !== loopEndRef.current) {
        loopActiveRef.current = la; loopStartRef.current = ls; loopEndRef.current = le;
        setLoopStateVer(v => v + 1);
      }
    });
    return unsub;
  }, []);
  const loopActive = loopActiveRef.current;
  const loopStart  = loopStartRef.current;
  const loopEnd    = loopEndRef.current;
  const loopMax         = useSelector(sel.loopMax);
  const loopCount       = useSelector(sel.loopCount);
  const showLoopBar     = useSelector(sel.showLoopBar);
  const loopStartInput  = useSelector(sel.loopStartInput);
  const loopEndInput    = useSelector(sel.loopEndInput);
  const loopBySurah     = useSelector(sel.loopBySurah);
  const playingPartRef  = useRef(null);
  useEffect(() => {
    const unsub = store.subscribe(() => {
      const pp = sel.playingPart(store.getState());
      if (pp?.ayatNum !== playingPartRef.current?.ayatNum || pp?.partId !== playingPartRef.current?.partId) {
        playingPartRef.current = pp;
        setPlayStateVer(v => v + 1);
      }
    });
    return unsub;
  }, []);
  const playingPart = playingPartRef.current;
  const listening       = useSelector(sel.listening);
  const voiceToast      = useSelector(sel.voiceToast);
  const showVoiceHelp   = useSelector(sel.showVoiceHelp);
  const showQalqala     = useSelector(sel.showQalqala);
  const showMadd        = useSelector(sel.showMadd);
  const showIzhar       = useSelector(sel.showIzhar);
  const showIdgham      = useSelector(sel.showIdgham);
  const announceNum     = useSelector(sel.announceNum);
  const spellCheck      = useSelector(sel.spellCheck);
  const showParts       = useSelector(sel.showParts);
  const showVoiceInput  = useSelector(sel.showVoiceInput);
  const voiceInputText  = useSelector(sel.voiceInputText);
  const goals           = useSelector(sel.goals, shallowEqual);
  const activity        = useSelector(sel.activity, shallowEqual);

  // â”€â”€ Dispatch shims (drop-in replacements for old setState calls) â”€â”€â”€
  const setSurahs          = (v) => dispatch(quranActions.setSurahs(v));
  const setSelectedSurah   = (v) => dispatch(quranActions.setSelectedSurah(v));
  const setAyats           = (v) => dispatch(quranActions.setAyats(v));
  const setLoadingAyats    = (v) => dispatch(quranActions.setLoadingAyats(v));
  const setSearch          = (v) => dispatch(quranActions.setSearch(v));
  const setOpenAyatNum     = (v) => {
    dispatch(quranActions.setOpenAyatNum(v));
    if (v == null) setAideMemoireClickModes({});
  };
  const setSubmenuMode     = (v) => dispatch(quranActions.setSubmenuMode(v));
  const setLastAyatForSurah = (surahNum, ayatNum) => dispatch(quranActions.setLastAyatForSurah({ surahNum, ayatNum }));
  const setPartSelectAyat  = (v) => dispatch(learnActions.setPartSelectAyat(v));
  const setPartSelectStep  = (v) => dispatch(learnActions.setPartSelectStep(v));
  const setPartSelectStart = (v) => dispatch(learnActions.setPartSelectStart(v));
  const setPlayingPart     = (v) => dispatch(playerActions.setPlayingPart(v));
  const setPartCurrentMs   = (v) => dispatch(playerActions.setPartCurrentMs(v));
  const setLocalPlaying    = (v) => dispatch(playerActions.setLocalPlaying(v));
  const setCollModal       = (v) => dispatch(collectionsActions.setCollModal(v));
  const setPlayingAyatNum  = (v) => dispatch(playerActions.setPlayingAyatNum(v));
  const setIsMainPlaying   = (v) => dispatch(playerActions.setIsMainPlaying(v));
  const setMainAyatIdx     = (v) => dispatch(playerActions.setMainAyatIdx(v));
  const setTimestampsMap   = (v) => { timestampsMapRef.current = v; tsVersionRef.current++; setTsVersion(n => n + 1); };
  const updateTimestamps   = (v) => {
    Object.assign(timestampsMapRef.current, v);
    tsVersionRef.current++;
    // Use startTransition so timestamp render doesn't block user interactions
    if (typeof React.startTransition === 'function') {
      React.startTransition(() => setTsVersion(n => n + 1));
    } else {
      setTsVersion(n => n + 1);
    }
  };
  const setMainCurrentMs   = (v) => dispatch(playerActions.setMainCurrentMs(v));
  const setSidebarOpen     = (v) => dispatch(uiActions.setSidebarOpen(v));
  const setActivePage      = (v) => navigate("/" + v);
  const setShowTsBar       = (v) => dispatch(uiActions.setShowTsBar(v));
  const setLoopActive      = (v) => dispatch(playerActions.setLoopActive(v));
  const setLoopStart       = (v) => dispatch(playerActions.setLoopStart(v));
  const setLoopEnd         = (v) => dispatch(playerActions.setLoopEnd(v));
  const setLoopMax         = (v) => dispatch(playerActions.setLoopMax(v));
  const saveLoopForSurah   = (surahNum, data) => dispatch(playerActions.saveLoopForSurah({ surahNum, ...data }));
  const setLoopCount       = (v) => dispatch(playerActions.setLoopCount(v));
  const setShowLoopBar     = (v) => dispatch(uiActions.setShowLoopBar(v));
  const setLoopStartInput  = (v) => dispatch(playerActions.setLoopStartInput(v));
  const setLoopEndInput    = (v) => dispatch(playerActions.setLoopEndInput(v));
  const setListening       = (v) => dispatch(voiceActions.setListening(v));
  const setVoiceToast      = (v) => dispatch(voiceActions.setVoiceToast(v));
  const setShowVoiceHelp   = (v) => dispatch(uiActions.setShowVoiceHelp(v));
  const [showTajweedPanel, setShowTajweedPanel] = React.useState(false);
  const [showArabicKeyboard, setShowArabicKeyboard] = React.useState(() => { try { return localStorage.getItem('quran_arabic_keyboard') === '1'; } catch { return false; } });
  const activeArabicInput = React.useRef(null);
  const [showOptionsPanel, setShowOptionsPanel] = React.useState(false);
  const [showLangPanel,    setShowLangPanel]    = React.useState(false);
  const [recitatorId,      setRecitatorId]      = useState(() => { try { return localStorage.getItem('quran_recitator') || 'ar.alafasy'; } catch { return 'ar.alafasy'; } });
  const [showRecitPanel,   setShowRecitPanel]   = useState(false);
  const [recitatorSearch,  setRecitatorSearch]  = useState("");
  // Bumped whenever a reciter's bitrate self-heals (markBitrateBad) so components
  // re-render and pick up the newly-known-good bitrate for that reciter.
  const [bitrateVersion,   setBitrateVersion]   = useState(0);

  // Keep global in sync with state
  useEffect(() => { setGlobalRecitator(recitatorId); }, [recitatorId]);

  // Fetch the official bitrate list (from the API's own audio/audioSecondary fields) for the
  // currently selected reciter as soon as it's chosen â€” this is the "real" data, so it takes
  // over from the generic guess order the moment it arrives.
  useEffect(() => {
    let cancelled = false;
    fetchOfficialBitrates(recitatorId).then(() => { if (!cancelled) setBitrateVersion(v => v + 1); });
    return () => { cancelled = true; };
  }, [recitatorId]);

  // Warm the same cache for every other reciter in the background (staggered, one at a time)
  // so the picker panel can show everyone's real bitrate without waiting for each to be selected.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const r of RECITATORS) {
        if (cancelled) return;
        await fetchOfficialBitrates(r.id);
        if (cancelled) return;
        setBitrateVersion(v => v + 1);
        await new Promise(res => setTimeout(res, 250));
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bitrate   = getReciterBitrate(recitatorId); // eslint-disable-line react-hooks/exhaustive-deps
  const audioBase = `${AUDIO_CDN_ROOT}/${bitrate}/${recitatorId}`;
  const activeRecitator = RECITATORS.find(r => r.id === recitatorId);
  const visibleRecitators = RECITATORS.filter(r =>
    r.label.toLowerCase().includes(recitatorSearch.trim().toLowerCase())
  );
  const toggleQalqala      = () => dispatch(uiActions.toggleQalqala());
  const toggleMadd         = () => dispatch(uiActions.toggleMadd());
  const toggleIzhar        = () => dispatch(uiActions.toggleIzhar());
  const toggleIdgham       = () => dispatch(uiActions.toggleIdgham());
  const toggleAnnounceNum  = () => dispatch(uiActions.toggleAnnounceNum());
  const toggleSpellCheck   = () => dispatch(uiActions.toggleSpellCheck());
  const toggleShowParts    = () => dispatch(uiActions.toggleShowParts());
  const toggleEnableTimestamps     = () => dispatch(uiActions.toggleEnableTimestamps());
  const toggleEnableLetterByLetter = () => dispatch(uiActions.toggleEnableLetterByLetter());
  const toggleEnableAnimations     = () => dispatch(uiActions.toggleEnableAnimations());
  const toggleEnableHeavyCompute   = () => dispatch(uiActions.toggleEnableHeavyCompute());
  const setShowVoiceInput  = (v) => dispatch(voiceActions.setShowVoiceInput(v));
  const setVoiceInputText  = (v) => dispatch(voiceActions.setVoiceInputText(v));

  // Part audio refs (not in Redux â€” updated 60fps, no need to re-render)
  const partAudioRef  = useRef(null);
  const partRafRef    = useRef(null);

  const stopPartRaf = () => { if (partRafRef.current) { cancelAnimationFrame(partRafRef.current); partRafRef.current = null; } };
  const startPartRaf = () => {
    stopPartRaf();
    const tick = () => {
      if (partAudioRef.current) setPartCurrentMs(partAudioRef.current.currentTime * 1000);
      partRafRef.current = requestAnimationFrame(tick);
    };
    partRafRef.current = requestAnimationFrame(tick);
  };

  // â”€â”€ setLData shim â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const setLData = useCallback((surahNum, ayatNum, fn) => {
    dispatch(setLDataThunk(surahNum, ayatNum, fn));
  }, [dispatch]);

  // â”€â”€ Collections helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveCollections    = null; // no longer needed â€” Redux handles persistence
  const createCollection   = (name)            => dispatch(collectionsActions.createCollection(name));
  const deleteCollection   = (id)              => dispatch(collectionsActions.deleteCollection(id));
  const toggleAyatInCollection = (collId, ayatEntry) => dispatch(collectionsActions.toggleAyatInCollection({ collId, ayatEntry }));
  // Memoized per-surah collection lookup â€” O(1) instead of O(collectionsÃ—ayats) per row
  const collectionsByAyat = useMemo(() => {
    const map = {};
    for (const c of collections) {
      for (const a of (c.ayats || [])) {
        const k = `${a.surahNum}:${a.ayatNum}`;
        if (!map[k]) map[k] = [];
        map[k].push(c.id);
      }
    }
    return map;
  }, [collections]);
  const ayatInCollections = (surahNum, ayatNum) => collectionsByAyat[`${surahNum}:${ayatNum}`] || [];

  const recognitionRef = useRef(null);
  const toastTimerRef  = useRef(null);

  const ayatRefs     = useRef({});
  const mainAudioRef = useRef(null);
  const tsLoadGenRef = useRef(0); // incremented on each surah change to cancel stale ts loads

  // Re-run timestamp auto-load when the reciter changes (without redoing the whole
  // surah-load effect below, which also restores scroll position, loop, etc.)
  useEffect(() => {
    if (!selectedSurah || !sel.enableTimestamps(store.getState())) return;
    const gen = ++tsLoadGenRef.current;
    loadTimestampsForSurah(selectedSurah.number, recitatorId).then(parsed => {
      if (gen !== tsLoadGenRef.current) return;
      if (parsed && Object.keys(parsed).length > 0) updateTimestamps(parsed);
    });
  }, [recitatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [renderLimit, setRenderLimit] = useState(30);
  const [pageMode,    setPageMode]    = useState(() => { try { return JSON.parse(localStorage.getItem('quran_page_mode')) ?? false; } catch { return false; } });
  const [surahMeta,   setSurahMeta]   = useState(null); // { hizb, juz, page, wordCount }
  const [pageMeta,    setPageMeta]    = useState(null); // { hizb, juz, ayatCount, wordCount } for current page
  const [showSurahInfo, setShowSurahInfo] = useState(false);
  const [showAyatJump, setShowAyatJump] = useState(false);
  const [surahTextCache, setSurahTextCache] = useState({}); // surahNum â†’ { numberInSurah: text } â€” feeds mastery calc
  const [ayatSearchInput, setAyatSearchInput] = useState("");
  const [autoPageFollow, setAutoPageFollow] = useState(true);
  const [translationLang, setTranslationLang] = useState(null); // null | 'fr'|'en'|'tr'â€¦
  const [translations, setTranslations] = useState({}); // { 'fr:2': [{numberInSurah, text}] }
  const [activePageCoran,  setactivePageCoran]  = useState(null);
  React.useEffect(() => { try { localStorage.setItem('quran_page_mode', JSON.stringify(pageMode)); } catch {} }, [pageMode]);
  const rafRef       = useRef(null);
  const wakeLockRef  = useRef(null);

  const [showRappel, setShowRappel] = useState(false);
  const [aideMemoireClickModes, setAideMemoireClickModes] = useState({});

  const surahs_ref    = useRef(surahs);
  const ayats_ref     = useRef(ayats);
  const selSurah_ref  = useRef(selectedSurah);
  useEffect(() => {
    if (!selectedSurah) { setSurahMeta(null); return; }
    fetchSurahMeta(selectedSurah.number).then(setSurahMeta).catch(() => setSurahMeta(null));
  }, [selectedSurah?.number]);
  useEffect(() => {
    if (!pageMode || !ayats || ayats.length === 0) { setPageMeta(null); return; }
    const curPage = activePageCoran ?? ayats[mainAyatIdx]?.page ?? null;
    if (!curPage) { setPageMeta(null); return; }
    fetchPageMeta(curPage).then(setPageMeta).catch(() => setPageMeta(null));
  }, [pageMode, activePageCoran, mainAyatIdx, ayats]);
  useEffect(() => {
    if (!translationLang || !selectedSurah) return;
    const key = `${translationLang}:${selectedSurah.number}`;
    if (translations[key]) return;
    fetchSurahTranslation(selectedSurah.number, translationLang).then(data => {
      setTranslations(p => ({ ...p, [key]: data }));
    }).catch(() => {});
  }, [translationLang, selectedSurah?.number]);

  // pageMode: auto-change page when mainAyatIdx moves to a different page, then scroll to ayat
  useEffect(() => {
    if (!pageMode || !autoPageFollow || !ayats || ayats.length === 0) return;
    const curAyat = ayats[mainAyatIdx];
    if (!curAyat?.page) return;
    const curPage = activePageCoran ?? ayats[0]?.page;
    if (curAyat.page !== curPage) {
      setactivePageCoran(curAyat.page);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ayatRefs.current[curAyat.numberInSurah]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    }
  }, [mainAyatIdx, pageMode, autoPageFollow]);

  // pageMode: when page changes manually, scroll to first ayat of that page
  useEffect(() => {
    if (!pageMode || !activePageCoran || !ayats || ayats.length === 0) return;
    const firstOfPage = ayats.find(a => a.page === activePageCoran);
    if (!firstOfPage) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ayatRefs.current[firstOfPage.numberInSurah]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, [activePageCoran, pageMode]);
  useEffect(() => { ayats_ref.current = ayats; }, [ayats]);
  useEffect(() => { selSurah_ref.current = selectedSurah; }, [selectedSurah]);

  // â”€â”€ AUDIO PERSISTANCE APK / VEILLE MOBILE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // StratÃ©gie multi-couches pour WebView Android :
  // 1. Media Session API  â†’ contrÃ´les Ã©cran verrouillÃ© + signal "mÃ©dia actif"
  // 2. Pre-fetch audio    â†’ l'ayat suivant est chargÃ© Ã  l'avance
  // 3. visibilitychange   â†’ reprend si le WebView a suspendu l'audio
  // 4. Wake Lock API      â†’ fallback si disponible (Chromium rÃ©cent)
  // 5. Silent audio loop  â†’ maintient le contexte audio actif en arriÃ¨re-plan

  const silentAudioRef  = useRef(null);   // <audio> silencieux en boucle
  const prefetchRef     = useRef(null);   // <audio> de prÃ©-chargement
  const isPlayingRef    = useRef(false);  // ref miroir pour closures

  // Maintenir ref miroir de isMainPlaying (utilisable dans les callbacks)
  useEffect(() => { isPlayingRef.current = isMainPlaying; }, [isMainPlaying]);

  // Robust "resume playback" helper â€” tries immediately, and again as soon as the
  // audio element signals it's actually ready (more reliable in background than a
  // blind setTimeout, which Android can throttle/delay well past the media's own timing).
  const playWhenReady = useCallback(() => {
    const a = mainAudioRef.current;
    if (!a) return;
    const tryNow = () => a.play().catch(() => {});
    tryNow();
    if (a.readyState < 2) {
      const onReady = () => { tryNow(); a.removeEventListener('canplay', onReady); };
      a.addEventListener('canplay', onReady, { once: true });
    }
  }, []);

  // â”€â”€ 1. Media Session API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const updateMediaSession = useCallback((ayat, surah) => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Ayat ${ayat?.numberInSurah || ''}`,
        artist: surah?.englishName || 'Quran',
        album: 'Ø§Ù„Ù‚Ø±Ø¢Ù† Ø§Ù„ÙƒØ±ÙŠÙ…',
        artwork: [{ src: 'https://cdn.islamic.network/quran/images/chapter_icon.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.playbackState = 'playing';
    } catch {}
  }, []);

  // Enregistrer les action handlers Media Session une seule fois
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const handlers = {
      play:         () => { setIsMainPlaying(true); mainAudioRef.current?.play().catch(()=>{}); },
      pause:        () => { setIsMainPlaying(false); mainAudioRef.current?.pause(); },
      stop:         () => { setIsMainPlaying(false); mainAudioRef.current?.pause(); },
      nexttrack:    () => {
        const a = ayats_ref.current;
        const idx = Math.min((a.findIndex(x => x.numberInSurah === (mainAudioRef.current?._ayatNum)) || 0) + 1, a.length - 1);
        playMainAyat(idx);
        playWhenReady();
      },
      previoustrack: () => {
        const a = ayats_ref.current;
        const idx = Math.max((a.findIndex(x => x.numberInSurah === (mainAudioRef.current?._ayatNum)) || 0) - 1, 0);
        playMainAyat(idx);
        playWhenReady();
      },
    };
    Object.entries(handlers).forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    });
    return () => {
      Object.keys(handlers).forEach(action => {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
      });
    };
  }, []); // eslint-disable-line

  // Mettre Ã  jour Media Session quand l'ayat change
  useEffect(() => {
    if (isMainPlaying && currentMainAyat) {
      updateMediaSession(currentMainAyat, selectedSurah);
    }
  }, [mainAyatIdx, isMainPlaying, updateMediaSession]); // eslint-disable-line

  // â”€â”€ 2. Audio silencieux en boucle (maintient contexte audio actif) â”€
  // Un fichier audio silencieux ultra-court en base64 (WAV 0.1s silence)
  const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  useEffect(() => {
    if (!silentAudioRef.current) return;
    const s = silentAudioRef.current;
    s.loop = true;
    s.volume = 0.001; // quasi-silencieux mais non-nul pour Ã©viter optimisations
    if (isMainPlaying) {
      s.play().catch(() => {});
    } else {
      s.pause();
    }
  }, [isMainPlaying]);

  // â”€â”€ 3. visibilitychange â€” reprend si suspendu par le WebView â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const audio = mainAudioRef.current;
      if (!audio || !isPlayingRef.current) return;
      // Petit dÃ©lai pour laisser le WebView se rÃ©veiller complÃ¨tement
      setTimeout(() => {
        if (audio.paused && isPlayingRef.current) {
          audio.play().catch(() => {});
        }
        silentAudioRef.current?.play().catch(() => {});
        // Re-signaler Ã  Android que le mÃ©dia est actif
        if ('mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch {}
        }
      }, 300);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Aussi sur 'resume' pour les WebView qui Ã©mettent cet Ã©vÃ©nement
    document.addEventListener('resume', handleVisibility);

    // Capacitor natif : plus fiable que 'visibilitychange' dans certaines WebView Android
    let removeCapListener = null;
    (async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const sub = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) handleVisibility();
        });
        removeCapListener = () => sub.remove();
      } catch {} // plugin absent ou non-natif : les listeners web ci-dessus suffisent
    })();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('resume', handleVisibility);
      removeCapListener?.();
    };
  }, []);

  // â”€â”€ 4. Wake Lock API (Chromium WebView rÃ©cent) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock = null;
    if (isMainPlaying) {
      navigator.wakeLock.request('screen').then(l => { lock = l; wakeLockRef.current = l; }).catch(() => {});
    } else {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    }
    const reacquire = () => {
      if (isPlayingRef.current && !lock) {
        navigator.wakeLock.request('screen').then(l => { lock = l; wakeLockRef.current = l; }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', reacquire);
    return () => {
      lock?.release().catch(() => {});
      document.removeEventListener('visibilitychange', reacquire);
    };
  }, [isMainPlaying]);

  // â”€â”€ 6. Watchdog â€” auto-relance si l'OS a mis l'audio en pause en arriÃ¨re-plan â”€â”€
  // Contrairement Ã  un setTimeout ponctuel (peut Ãªtre diffÃ©rÃ© indÃ©finiment quand le
  // WebView est en arriÃ¨re-plan), un setInterval continue de se dÃ©clencher (throttled
  // mais jamais totalement gelÃ©) : c'est le filet de sÃ©curitÃ© qui rÃ©pare toute lecture
  // interrompue par le systÃ¨me, sans dÃ©pendre du retour au premier plan de l'utilisateur.
  useEffect(() => {
    if (!isMainPlaying) return;
    const iv = setInterval(() => {
      const a = mainAudioRef.current;
      if (a && isPlayingRef.current && a.paused && !a.ended) {
        a.play().catch(() => {});
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [isMainPlaying]);

  // â”€â”€ 5. PrÃ©-chargement de l'ayat suivant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!isMainPlaying || !ayats.length) return;
    const nextIdx = mainAyatIdx + 1;
    if (nextIdx >= ayats.length) return;
    const nextUrl = `${getAudioBase()}/${ayats[nextIdx].number}.mp3`;
    if (!prefetchRef.current) {
      prefetchRef.current = new Audio();
      prefetchRef.current.preload = 'auto';
    }
    prefetchRef.current.src = nextUrl;
    prefetchRef.current.load();
  }, [mainAyatIdx, isMainPlaying, ayats]);

  useEffect(() => {
    fetchSurahs().then(d => { setSurahs(d); }); // setSurahs already sets loadingSurahs:false in reducer
    // SW registered only in prod/Android (not localhost) so dev streams CDN directly
    if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
      navigator.serviceWorker.register('/audio-sw.js', { scope: '/' }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!selectedSurah) return;
    setOpenAyatNum(null); setPlayingAyatNum(null);
    setactivePageCoran(null);
    setIsMainPlaying(false); setMainCurrentMs(0);
    setLoopActive(false); setLoopCount(0);
    // Only show spinner if data isn't already in memory cache
    if (quranMemCache[`alafasy:${selectedSurah.number}`] == null) setLoadingAyats(true);
    fetchAyats(selectedSurah.number).then(d => {
      const ayahList = (d.ayahs || []).map(a => {
        if (a.numberInSurah === 1 && a.text) {
          // Strip leading basmala from first ayat (except Al-Fatiha surah 1 and At-Tawba surah 9)
          const sn = selectedSurah.number;
          if (sn !== 1 && sn !== 9) {
            // Basmala = exactly 4 words: Ø¨Ø³Ù… / Ø§Ù„Ù„Ù‡ / Ø§Ù„Ø±Ø­Ù…Ù† / Ø§Ù„Ø±Ø­ÙŠÙ…
            // Check first word starts with Ø¨Ø³Ù… (bare, no diacritics)
            const words = a.text.trim().split(' ');
            const stripD = s => s.replace(/[Ø-ØšÙ‹-ÙŸÙ°Û–-Û­]/g, '');
            if (words.length > 4 && stripD(words[0]) === 'Ø¨Ø³Ù…') {
              return { ...a, text: words.slice(4).join(' ') };
            }
            return a;
          }
        }
        return a;
      });
      const savedAyatNum = lastAyatBySurah[selectedSurah.number] ?? null;
      const restoredIdx = savedAyatNum != null
        ? Math.max(0, ayahList.findIndex(a => a.numberInSurah === savedAyatNum))
        : 0;
      // Start render window around the active ayat so it's visible immediately
      const initialLimit = Math.max(30, restoredIdx + 15);
      setRenderLimit(initialLimit);
      setAyats(ayahList); setLoadingAyats(false);
      setMainAyatIdx(restoredIdx);
      setactivePageCoran(null); // reset; will be derived from mainAyatIdx
      if (savedAyatNum != null) setOpenAyatNum(savedAyatNum);
      // Expand remaining ayats progressively after first paint
      const total = ayahList.length;
      const expandChunk = (from) => {
        if (from >= total) return;
        const next = Math.min(from + 50, total);
        requestAnimationFrame(() => { setRenderLimit(next); expandChunk(next); });
      };
      requestAnimationFrame(() => expandChunk(initialLimit));
      // Restore loop
      const savedLoop = loopBySurah[selectedSurah.number];
      if (savedLoop) {
        setLoopActive(savedLoop.active ?? false);
        setLoopStart(Math.min(savedLoop.start ?? 0, ayahList.length - 1));
        setLoopEnd(Math.min(savedLoop.end ?? Math.min(2, ayahList.length - 1), ayahList.length - 1));
        setLoopMax(savedLoop.max ?? 0);
        setLoopStartInput(parseInt(savedLoop.startInput) || 1);
        setLoopEndInput(parseInt(savedLoop.endInput) || Math.min(3, ayahList.length));
      } else {
        setLoopStart(0); setLoopEnd(Math.min(2, ayahList.length - 1));
        setLoopStartInput(1); setLoopEndInput(Math.min(3, ayahList.length));
      }
      // Scroll to active ayat â€” retry until ref is mounted (handles progressive render)
      if (savedAyatNum != null) {
        let attempts = 0;
        const tryScroll = () => {
          const el = ayatRefs.current[savedAyatNum];
          if (el) {
            el.scrollIntoView({ behavior: "instant", block: "center" });
          } else if (attempts++ < 20) {
            requestAnimationFrame(tryScroll);
          }
        };
        requestAnimationFrame(tryScroll);
      }
      // Auto-load timestamps deferred â€” don't block first ayat render
      // Use a ref-based generation counter to discard results from previous surahs
      if (sel.enableTimestamps(store.getState())) {
        const gen = ++tsLoadGenRef.current;
        setTimeout(() => {
          if (gen !== tsLoadGenRef.current) return; // surah changed before we ran
          loadTimestampsForSurah(selectedSurah.number, recitatorId).then(parsed => {
            if (gen !== tsLoadGenRef.current) return; // surah changed while loading
            if (parsed && Object.keys(parsed).length > 0) {
              updateTimestamps(parsed);
            }
          });
        }, 0);
      }
    });
  }, [selectedSurah]);

  useEffect(() => {
    if (selectedSurah && ayats.length > 0) {
      saveLoopForSurah(selectedSurah.number, {
        active: loopActive, start: loopStart, end: loopEnd, max: loopMax,
        startInput: loopStartInput, endInput: loopEndInput,
      });
    }
  }, [loopActive, loopStart, loopEnd, loopMax, loopStartInput, loopEndInput, selectedSurah?.number]);

  useEffect(() => {
    if (selectedSurah && ayats.length > 0) {
      const ayatNum = ayats[mainAyatIdx]?.numberInSurah;
      if (ayatNum != null) setLastAyatForSurah(selectedSurah.number, ayatNum);
    }
  }, [mainAyatIdx, selectedSurah?.number]);

  useEffect(() => {
    if (selectedSurah && openAyatNum != null) {
      setLastAyatForSurah(selectedSurah.number, openAyatNum);
    }
  }, [openAyatNum, selectedSurah?.number]);

  // RAF
  const startRaf = useCallback(() => {
    const tick = () => {
      if (mainAudioRef.current) setMainCurrentMs(mainAudioRef.current.currentTime * 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);
  const stopRaf = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);
  useEffect(() => {
    if (isMainPlaying) startRaf(); else stopRaf(); // keep mainCurrentMs as-is on pause so playback can resume from the same spot
    return stopRaf;
  }, [isMainPlaying, startRaf, stopRaf]);

  const lkey     = (s, a) => `${s}:${a}`;
  const getLData = (s, a) => learnData[lkey(s, a)] || { learned: false, readCount: 0, parts: [], wordsLearned: {} };
  // Forced-alignment timestamps are tied to one specific reciter's audio timing,
  // so they're stored/looked-up per reciter (unlike learnData, which stays global).
  const tskey    = (s, a) => `${recitatorId}:${s}:${a}`;

  const announceNumRef = useRef(false);
  useEffect(() => { announceNumRef.current = announceNum; }, [announceNum]);

  const speakAyatNum = useCallback((ayatNum) => {
    if (!announceNumRef.current) return Promise.resolve();
    return new Promise(resolve => {
      const ss = window.speechSynthesis;
      if (!ss) { resolve(); return; }
      ss.cancel();
      const utter = new SpeechSynthesisUtterance(String(ayatNum));
      utter.lang = 'ar-SA';
      utter.rate = 0.85;
      utter.volume = 1;
      utter.onend = resolve;
      utter.onerror = () => resolve();
      // Android Chrome fix: resume if paused
      const resumeTimer = setInterval(() => { if (ss.paused) ss.resume(); }, 250);
      utter.onend = () => { clearInterval(resumeTimer); resolve(); };
      utter.onerror = () => { clearInterval(resumeTimer); resolve(); };
      ss.speak(utter);
    });
  }, []);

  const playMainAyat = useCallback((idx) => {
    if (!ayats.length) return;
    const i = Math.max(0, Math.min(idx, ayats.length - 1));
    const changed = i !== mainAyatIdx;
    setMainAyatIdx(i); setPlayingAyatNum(ayats[i]?.numberInSurah);
    if (changed) setMainCurrentMs(0); // only reset elapsed time on an actual ayat change, not on resume
    const targetAyat = ayats[i];
    // Page mode: if the target ayat lives on a different page than the one currently
    // displayed, switch page first (its DOM node doesn't exist until we do) then scroll to it.
    if (pageMode && targetAyat?.page != null) {
      const curPage = activePageCoran ?? ayats[0]?.page;
      if (targetAyat.page !== curPage) {
        setactivePageCoran(targetAyat.page);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            ayatRefs.current[targetAyat.numberInSurah]?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        });
        return;
      }
    }
    if (changed) ayatRefs.current[ayats[i]?.numberInSurah]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [ayats, mainAyatIdx, pageMode, activePageCoran]);

  const handleMainEnded = useCallback(() => {
    const next = mainAyatIdx + 1;
    if (loopActive) {
      const end = Math.min(loopEnd, ayats.length - 1);
      if (mainAyatIdx < end) {
        playMainAyat(next); playWhenReady();
      } else {
        const nc = loopCount + 1;
        if (loopMax === 0 || nc < loopMax) {
          setLoopCount(nc); playMainAyat(loopStart); playWhenReady();
        } else {
          setLoopActive(false); setLoopCount(0);
          setIsMainPlaying(false); setPlayingAyatNum(null); setMainCurrentMs(0);
        }
      }
      return;
    }
    if (next < ayats.length) { playMainAyat(next); playWhenReady(); }
    else { setIsMainPlaying(false); setPlayingAyatNum(null); setMainCurrentMs(0); }
  }, [mainAyatIdx, ayats, playMainAyat, loopActive, loopStart, loopEnd, loopCount, loopMax, playWhenReady]);

  const loadedAyatIdxRef = useRef(null);
  useEffect(() => {
    if (!mainAudioRef.current) return;
    const audioEl = mainAudioRef.current;
    const ayatChanged = loadedAyatIdxRef.current !== mainAyatIdx;
    if (isMainPlaying) {
      const num = ayats[mainAyatIdx]?.numberInSurah;
      if (ayatChanged) {
        loadedAyatIdxRef.current = mainAyatIdx;
        audioEl.load(); // new ayat â†’ (re)load its audio source from the start
        if (announceNumRef.current && num) {
          audioEl.pause();
          speakAyatNum(num).then(() => { mainAudioRef.current?.play().catch(() => {}); });
        } else {
          audioEl.play().catch(() => {});
        }
      } else {
        audioEl.play().catch(() => {}); // resume: same ayat, same audio element â†’ keeps its currentTime
      }
    } else {
      audioEl.pause(); // pausing never touches currentTime, so resuming continues from here
    }
  }, [mainAyatIdx, isMainPlaying]);

  useEffect(() => {
    if (openAyatNum && submenuMode === "lecture" && selectedSurah) {
      setLData(selectedSurah.number, openAyatNum, d => ({ ...d, readCount: (d.readCount || 0) + 1 }));
      // Record daily activity
      const today = new Date().toISOString().slice(0, 10);
      dispatch(goalsActions.recordActivity({ date: today, ayatsRead: 1 }));
    }
    // Stop part audio when leaving apprentissage tab
    if (submenuMode !== "apprentissage") {
      if (partAudioRef.current && !partAudioRef.current.paused) {
        partAudioRef.current.pause();
      }
      setPlayingPart(null);
      setPartCurrentMs(0);
      stopPartRaf();
    }
  }, [openAyatNum, submenuMode]);

  // â”€â”€ Toast helper â”€â”€
  const showToast = useCallback((text, type = 'info') => {
    setVoiceToast({ text, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setVoiceToast(null), 3000);
  }, []);

  // â”€â”€ Aller Ã  un ayat par son numÃ©ro (sourate courante) â”€â”€
  const jumpToAyatNumber = (raw) => {
    const n = parseInt(raw, 10);
    if (!n || !selectedSurah) return;
    const target = ayats.find(a => a.numberInSurah === n);
    if (!target) { showToast(`Ayat ${n} introuvable`, 'error'); return; }
    navigate(`/quran/${selectedSurah.number}/${n}`);
    setOpenAyatNum(n);
    if (pageMode && target.page != null) setactivePageCoran(target.page);
    setTimeout(() => { ayatRefs.current[n]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, pageMode ? 250 : 50);
  };

  // â”€â”€ Voice command execution â”€â”€
  const executeCommand = useCallback((cmd) => {
    if (!cmd) return false;
    const s = surahs_ref.current;
    const a = ayats_ref.current;

    if (cmd.action === 'play') {
      const startIdx = loopActive ? loopStart : mainAyatIdx;
      playMainAyat(startIdx); setIsMainPlaying(true);
      showToast('â–¶ Lecture', 'success'); return true;
    }
    if (cmd.action === 'pause') {
      setIsMainPlaying(false); mainAudioRef.current?.pause();
      showToast('â¸ Pause', 'success'); return true;
    }
    if (cmd.action === 'stop') {
      setIsMainPlaying(false); setPlayingAyatNum(null);
      setLoopActive(false); setLoopCount(0);
      mainAudioRef.current?.pause();
      showToast('â¹ Stop', 'success'); return true;
    }
    if (cmd.action === 'next') {
      const i = Math.min(a.length - 1, mainAyatIdx + 1);
      playMainAyat(i); if (isMainPlaying) setTimeout(() => mainAudioRef.current?.play(), 100);
      showToast(`â†’ Ayat ${a[i]?.numberInSurah}`, 'success'); return true;
    }
    if (cmd.action === 'prev') {
      const i = Math.max(0, mainAyatIdx - 1);
      playMainAyat(i); if (isMainPlaying) setTimeout(() => mainAudioRef.current?.play(), 100);
      showToast(`â† Ayat ${a[i]?.numberInSurah}`, 'success'); return true;
    }
    if (cmd.action === 'surah') {
      const surah = s.find(x => x.number === cmd.number);
      if (surah) { setSelectedSurah(surah); showToast(`ğŸ“– ${surah.englishName}`, 'success'); return true; }
    }
    if (cmd.action === 'ayat') {
      const idx = a.findIndex(x => x.numberInSurah === cmd.number);
      if (idx >= 0) {
        playMainAyat(idx);
        if (!isMainPlaying) { setIsMainPlaying(true); }
        else setTimeout(() => mainAudioRef.current?.play(), 100);
        showToast(`â†’ Ayat ${cmd.number}`, 'success'); return true;
      }
      showToast(`Ayat ${cmd.number} introuvable`, 'error'); return true;
    }
    if (cmd.action === 'loop') {
      const fromIdx = a.findIndex(x => x.numberInSurah === cmd.from);
      const toIdx   = a.findIndex(x => x.numberInSurah === cmd.to);
      if (fromIdx >= 0 && toIdx >= 0) {
        const s = Math.min(fromIdx, toIdx);
        const e = Math.max(fromIdx, toIdx);
        setLoopStart(s); setLoopEnd(e);
        setLoopStartInput(a[s]?.numberInSurah ?? 1);
        setLoopEndInput(a[e]?.numberInSurah ?? 1);
        setLoopActive(true); setLoopCount(0); setShowLoopBar(true);
        playMainAyat(s); setIsMainPlaying(true);
        showToast(`â†º Boucle ${a[s]?.numberInSurah}â€“${a[e]?.numberInSurah}`, 'success'); return true;
      }
      showToast(`Range introuvable`, 'error'); return true;
    }
    if (cmd.action === 'loop_off') {
      setLoopActive(false); setLoopCount(0);
      showToast('â†º Boucle dÃ©sactivÃ©e', 'success'); return true;
    }
    if (cmd.action === 'repeat') {
      setLoopMax(cmd.times); setLoopActive(true); setLoopCount(0); setShowLoopBar(true);
      showToast(`â†º Ã— ${cmd.times}`, 'success'); return true;
    }
    return false;
  }, [mainAyatIdx, isMainPlaying, loopActive, loopStart, playMainAyat, showToast]);

  // â”€â”€ Voice recognition â€” enregistrement continu robuste mobile â”€â”€â”€â”€â”€â”€
  //
  // ProblÃ¨me Android WebView / Chrome mobile :
  //   â€¢ continuous:true â†’ erreur "aborted" en boucle sur certains appareils
  //   â€¢ continuous:false â†’ session courte, gap au redÃ©marrage, overlap si deux
  //     instances se chevauchent â†’ erreurs "aborted" en cascade
  //
  // Solution : session unique continuous:true avec watchdog.
  //   Si continuous:true Ã©choue 2Ã— de suite â†’ basculer en mode session courte
  //   avec verrou isStarting pour empÃªcher tout overlap.
  //
  // Couche 1 : Android native bridge  â†’ window.Android.startSpeechRecognition()
  // Couche 2 : Web Speech API continue (continuous:true + watchdog)
  // Couche 3 : Web Speech API sessions courtes (fallback si continuous crash)
  // Couche 4 : Saisie manuelle (dernier recours)

  const shouldListenRef  = useRef(false);
  const voicePausedMain  = useRef(false);   // main audio was paused for voice
  const voicePausedPart  = useRef(false);   // part audio was paused for voice
  const isStartingRef    = useRef(false); // verrou anti-overlap
  const recInstanceRef   = useRef(null);  // instance active
  const voiceLayer       = useRef('unknown');
  const continuousFails  = useRef(0);     // nb d'Ã©checs consecutive de continuous:true
  const restartTimerRef  = useRef(null);
  // showVoiceInput and voiceInputText are now in Redux (voiceSlice)

  const clearRestartTimer = () => {
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
  };

  // Callback partagÃ© : traite un transcript quelle que soit la couche
  const handleTranscript = useCallback((transcript) => {
    if (!transcript?.trim()) return;
    showToast(transcript, 'info');
    const cmd = parseVoiceCommand(transcript, surahs_ref.current, ayats_ref.current, selSurah_ref.current);
    if (cmd) { executeCommand(cmd); }
    else { showToast(`"${transcript}" â€” commande inconnue`, 'error'); }
  }, [executeCommand, showToast]);

  // Exposer le callback pour le bridge Android natif
  useEffect(() => {
    window.QuranApp = window.QuranApp || {};
    window.QuranApp.onSpeechResult = (transcript) => {
      handleTranscript(transcript);
      if (shouldListenRef.current) {
        try { window.Android?.startSpeechRecognition('fr-FR'); } catch {}
      } else { setListening(false); }
    };
    window.QuranApp.onSpeechError = () => {
      if (shouldListenRef.current) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          try { window.Android?.startSpeechRecognition('fr-FR'); } catch {}
        }, 700);
      } else { setListening(false); }
    };
    return () => {
      clearTimeout(restartTimerRef.current);
      if (window.QuranApp) { window.QuranApp.onSpeechResult = null; window.QuranApp.onSpeechError = null; }
    };
  }, [handleTranscript]);

  // â”€â”€ Couche Web Speech : crÃ©e une instance et la dÃ©marre â”€â”€
  const spawnRecognition = useCallback((useContinuous) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !shouldListenRef.current || isStartingRef.current) return;

    // DÃ©truire l'instance prÃ©cÃ©dente proprement
    if (recInstanceRef.current) {
      try {
        recInstanceRef.current.onend   = null;
        recInstanceRef.current.onerror = null;
        recInstanceRef.current.onresult= null;
        recInstanceRef.current.abort();
      } catch {}
      recInstanceRef.current = null;
    }

    isStartingRef.current = true;
    const rec = new SR();
    rec.lang            = 'fr-FR';
    rec.continuous      = useContinuous;
    rec.interimResults  = false;
    rec.maxAlternatives = 1;
    recInstanceRef.current  = rec;
    recognitionRef.current  = rec;

    rec.onstart = () => {
      isStartingRef.current = false;
      continuousFails.current = useContinuous ? 0 : continuousFails.current;
      setListening(true);
    };

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) handleTranscript(e.results[i][0].transcript.trim());
      }
    };

    rec.onerror = (e) => {
      isStartingRef.current = false;
      clearRestartTimer();

      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        shouldListenRef.current = false;
        setListening(false);
        voiceLayer.current = 'manual';
        setShowVoiceInput(true);
        showToast('Micro refusÃ© â€” saisie manuelle', 'error');
        return;
      }

      if (e.error === 'aborted') {
        // aborted = on a appelÃ© abort() nous-mÃªmes â†’ ignorer si on arrÃªte
        if (!shouldListenRef.current) { setListening(false); return; }
        // sinon : overlap ou bug WebView â€” courte pause puis respawn
        restartTimerRef.current = setTimeout(() => spawnRecognition(useContinuous), 400);
        return;
      }

      if (e.error === 'audio-capture') {
        restartTimerRef.current = setTimeout(() => spawnRecognition(useContinuous), 1200);
        return;
      }

      if (e.error === 'network') {
        restartTimerRef.current = setTimeout(() => spawnRecognition(useContinuous), 2500);
        return;
      }

      // no-speech et autres : redÃ©marrer rapidement
      if (shouldListenRef.current) {
        restartTimerRef.current = setTimeout(() => spawnRecognition(useContinuous), 350);
      }
    };

    rec.onend = () => {
      isStartingRef.current = false;
      if (!shouldListenRef.current) { setListening(false); return; }

      if (useContinuous) {
        // continuous:true s'est terminÃ© seul â†’ probablement pas supportÃ©
        continuousFails.current += 1;
        clearRestartTimer();
        if (continuousFails.current >= 2) {
          // Basculer dÃ©finitivement en sessions courtes
          restartTimerRef.current = setTimeout(() => spawnRecognition(false), 300);
        } else {
          restartTimerRef.current = setTimeout(() => spawnRecognition(true), 300);
        }
      } else {
        // Session courte terminÃ©e normalement â†’ redÃ©marrer
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => spawnRecognition(false), 200);
      }
    };

    try {
      rec.start();
    } catch {
      isStartingRef.current = false;
      restartTimerRef.current = setTimeout(() => spawnRecognition(useContinuous), 600);
    }
  }, [handleTranscript, showToast]);

  const toggleVoice = useCallback(() => {
    if (shouldListenRef.current) {
      // â”€â”€ ARRÃŠT â”€â”€
      shouldListenRef.current = false;
      clearRestartTimer();
      isStartingRef.current = false;
      if (recInstanceRef.current) {
        try {
          recInstanceRef.current.onend   = null;
          recInstanceRef.current.onerror = null;
          recInstanceRef.current.abort();
        } catch {}
        recInstanceRef.current = null;
      }
      try { window.Android?.stopSpeechRecognition(); } catch {}
      setListening(false);
      setShowVoiceInput(false);
      // â”€â”€ Reprendre les audios mis en pause pour la voix â”€â”€
      if (voicePausedMain.current) {
        voicePausedMain.current = false;
        mainAudioRef.current?.play().catch(() => {});
        setIsMainPlaying(true);
      }
      if (voicePausedPart.current) {
        voicePausedPart.current = false;
        partAudioRef.current?.play().catch(() => {});
      }
    } else {
      // â”€â”€ DÃ‰MARRAGE : couper tous les audios en cours â”€â”€
      voicePausedMain.current = false;
      voicePausedPart.current = false;
      if (isPlayingRef.current) {
        mainAudioRef.current?.pause();
        setIsMainPlaying(false);
        voicePausedMain.current = true;
      }
      if (partAudioRef.current && !partAudioRef.current.paused) {
        partAudioRef.current.pause();
        voicePausedPart.current = true;
      }
      shouldListenRef.current = true;
      continuousFails.current = 0;

      if (window.Android && typeof window.Android.startSpeechRecognition === 'function') {
        voiceLayer.current = 'bridge';
        setListening(true);
        try { window.Android.startSpeechRecognition('fr-FR'); } catch {
          voiceLayer.current = 'webspeech';
          spawnRecognition(true);
        }
      } else if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        voiceLayer.current = 'webspeech';
        spawnRecognition(true);
      } else {
        voiceLayer.current = 'manual';
        setListening(true);
        setShowVoiceInput(true);
      }
    }
  }, [spawnRecognition]);

  // Timestamps
  const handleTimestampsFiles = useCallback(async (files) => {
    const newEntries = {};
    for (const file of files) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        Object.assign(newEntries, parseTimestampsFile(data, selectedSurah?.number, recitatorId));
      } catch (e) { console.error(e); }
    }
    setTimestampsMap({ ...timestampsMap, ...newEntries });
  }, [selectedSurah, timestampsMap, recitatorId]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = [...e.dataTransfer.files].filter(f => f.name.endsWith('.json'));
    if (files.length) handleTimestampsFiles(files);
  }, [handleTimestampsFiles]);

  // Loop inputs apply
  const applyLoopInputs = () => {
    const s = (typeof loopStartInput === "number" ? loopStartInput : parseInt(loopStartInput)) || 1;
    const e = (typeof loopEndInput   === "number" ? loopEndInput   : parseInt(loopEndInput))   || 1;
    const si = ayats.findIndex(a => a.numberInSurah === s);
    const ei = ayats.findIndex(a => a.numberInSurah === e);
    if (si >= 0) setLoopStart(si);
    if (ei >= 0) setLoopEnd(ei);
  };

  // Memoized per-surah learn stats â€” only recomputes when learnData or the text cache changes
  const surahStats = useMemo(() => {
    if (!enableHeavyCompute) return {};
    const stats = {};
    for (const [key, val] of Object.entries(learnData)) {
      const colon = key.indexOf(':');
      if (colon === -1) continue;
      const sn = parseInt(key.slice(0, colon));
      const an = parseInt(key.slice(colon + 1));
      if (!stats[sn]) stats[sn] = { learned: 0, mastery: 0, count: 0 };
      if (val.learned) stats[sn].learned++;
      const ayatText = surahTextCache[sn]?.[an];
      stats[sn].mastery += computeMastery(val, ayatText);
      stats[sn].count++;
    }
    return stats;
  }, [learnData, surahTextCache]);

  // Seed the text cache from the surah currently loaded (no extra fetch needed)
  useEffect(() => {
    if (!selectedSurah || !ayats || ayats.length === 0) return;
    const map = {};
    ayats.forEach(a => { map[a.numberInSurah] = a.text; });
    setSurahTextCache(c => ({ ...c, [selectedSurah.number]: map }));
  }, [ayats, selectedSurah]);

  // Lazily fetch text for any other surah that has learnData but isn't cached yet
  // (needed so the sidebar mastery % is accurate for surahs not currently open)
  useEffect(() => {
    const sns = new Set();
    Object.keys(learnData).forEach(k => {
      const sn = parseInt(k.slice(0, k.indexOf(':')));
      if (!isNaN(sn)) sns.add(sn);
    });
    const toFetch = [...sns].filter(sn => !surahTextCache[sn]);
    if (toFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const sn of toFetch) {
        try {
          const arr = await fetchSurahSimple(sn); // [{num, text}]
          if (cancelled) return;
          const map = {};
          arr.forEach(a => { map[a.num] = a.text; });
          setSurahTextCache(c => c[sn] ? c : { ...c, [sn]: map });
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [learnData]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSurahs = useMemo(() => surahs.filter(s =>
    s.englishName.toLowerCase().includes(search.toLowerCase()) ||
    s.name.includes(search) || String(s.number).includes(search)
  ), [surahs, search]);

  const currentMainAyat = ayats[mainAyatIdx];
  const audioUrl = a => a ? `${getAudioBase()}/${a.number}.mp3` : "";
  // Memoized mastery per ayat key
  const masteryMap = useMemo(() => {
    if (!enableHeavyCompute) return {};
    const m = {};
    // Build ayat text lookup from loaded ayats
    const textLookup = {};
    if (selectedSurah && ayats) {
      ayats.forEach(a => { textLookup[`${selectedSurah.number}:${a.numberInSurah}`] = a.text; });
    }
    for (const [k, v] of Object.entries(learnData)) m[k] = computeMastery(v, textLookup[k]);
    return m;
  }, [learnData, enableHeavyCompute, ayats, selectedSurah]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadedCount = useMemo(() => selectedSurah
    ? ayats.filter(a => timestampsMapRef.current[tskey(selectedSurah.number, a.numberInSurah)]).length : 0,
  [tsVersion, ayats, selectedSurah, recitatorId]);

  const loopStartNum = ayats[loopStart]?.numberInSurah || 1;
  const loopEndNum   = ayats[Math.min(loopEnd, ayats.length - 1)]?.numberInSurah || 1;

  return (
    <ArabicKeyboardContext.Provider value={{ show: showArabicKeyboard, setShow: setShowArabicKeyboard, activeInput: activeArabicInput }}>
    <>
      <StyleTag />
      <div className="app" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        <header className="header">
          {/* Left Branding / Hamburger group */}
          <div className="header-left">
            <button
              className="header-menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Menu sourates"
              style={{
                background: sidebarOpen ? "rgba(201,168,76,.18)" : undefined,
                borderColor: sidebarOpen ? "rgba(201,168,76,.55)" : undefined,
                color: sidebarOpen ? "var(--gold2)" : undefined,
              }}
            >
              â˜°
            </button>

            <div className="header-logo" onClick={() => setActivePage('quran')} title="Accueil Coran">
              <span>QUR<span className="logo-highlight">Ã‚N</span></span>
              <span className="header-subtitle">STUDY</span>
            </div>
          </div>

          {/* Page nav tabs â€” Segmented pill control */}
          <nav className="header-nav" aria-label="Navigation principale">
            {[
              { id: "quran",         icon: "ğŸ“–", label: "CORAN" },
              { id: "prononciation", icon: "ğŸ”¤", label: "PRONON." },
              { id: "dashboard",     icon: "ğŸ“Š", label: "DASH" },
              { id: "collections",   icon: "ğŸ—‚", label: "COLL." },
              { id: "revision",      icon: "âœ",  label: "RÃ‰VISION" },
            ].map(({ id, icon, label }) => (
              <button
                key={id}
                className={`header-nav-btn${activePage === id ? ` active-${id}` : ""}`}
                onClick={() => setActivePage(id)}
                title={label}
              >
                <span className="nav-icon">{icon}</span>
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>

          {/* Right Action buttons & User Menu */}
          <div className="header-actions" ref={userMenuRef}>
            {/* Arabic keyboard toggle (desktop only) */}
            <button
              className="voice-btn desktop-only-action"
              onClick={() => setShowArabicKeyboard(v => {
                const next = !v;
                try { localStorage.setItem('quran_arabic_keyboard', next ? '1' : '0'); } catch {}
                return next;
              })}
              title={showArabicKeyboard ? "Masquer clavier arabe" : "Afficher clavier arabe"}
              style={{
                background: showArabicKeyboard ? 'rgba(62,184,160,.18)' : undefined,
                borderColor: showArabicKeyboard ? 'var(--teal)' : undefined,
                color: showArabicKeyboard ? 'var(--teal2)' : undefined,
              }}
            >
              âŒ¨ï¸
            </button>

            {/* Voice Command Mic */}
            <button
              className={`voice-btn${listening ? ' listening' : ''}`}
              onClick={toggleVoice}
              title={listening ? "ArrÃªter Ã©coute vocale" : "Commande vocale"}
            >
              ğŸ¤
            </button>

            {/* Rappel vocal (desktop only) */}
            <button
              className="voice-btn desktop-only-action"
              onClick={() => setShowRappel(v => !v)}
              title="Rappel vocal"
              style={{
                background: showRappel ? 'rgba(201,168,76,.18)' : undefined,
                borderColor: showRappel ? 'rgba(201,168,76,.5)' : undefined,
                color: showRappel ? 'var(--gold2)' : undefined,
              }}
            >
              ğŸ””
            </button>

            {/* User Avatar & Dropdown */}
            {currentUser && (
              <div style={{ position: 'relative' }}>
                <button
                  className={`header-user-btn${showUserMenu ? ' active' : ''}`}
                  onClick={() => setShowUserMenu(v => !v)}
                  title={currentUser.displayName || currentUser.email || "Mon compte"}
                  aria-expanded={showUserMenu}
                >
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="avatar" className="header-avatar" />
                  ) : (
                    <div className="header-avatar-placeholder">
                      {(currentUser.displayName || currentUser.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                </button>

                {/* Mobile / Desktop Dropdown Menu */}
                {showUserMenu && (
                  <div className="header-user-menu">
                    <div className="user-menu-header">
                      <div className="user-menu-name">
                        {currentUser.displayName || "Utilisateur"}
                      </div>
                      <div className="user-menu-email">
                        {currentUser.email || ""}
                      </div>
                    </div>

                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setShowArabicKeyboard(v => {
                          const next = !v;
                          try { localStorage.setItem('quran_arabic_keyboard', next ? '1' : '0'); } catch {}
                          return next;
                        });
                        setShowUserMenu(false);
                      }}
                    >
                      <div className="menu-left">
                        <span>âŒ¨ï¸</span>
                        <span>Clavier Arabe</span>
                      </div>
                      <span className={`user-menu-badge ${showArabicKeyboard ? 'on' : 'off'}`}>
                        {showArabicKeyboard ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setShowRappel(v => !v);
                        setShowUserMenu(false);
                      }}
                    >
                      <div className="menu-left">
                        <span>ğŸ””</span>
                        <span>Rappel Vocal</span>
                      </div>
                      <span className={`user-menu-badge ${showRappel ? 'on' : 'off'}`}>
                        {showRappel ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setShowOptionsModal(true);
                        setShowUserMenu(false);
                      }}
                    >
                      <div className="menu-left">
                        <span>âš™</span>
                        <span>ParamÃ¨tres & Sync</span>
                      </div>
                    </button>

                    <button
                      className="user-menu-item logout"
                      onClick={() => {
                        setShowUserMenu(false);
                        onSignOut();
                      }}
                    >
                      <div className="menu-left">
                        <span>â</span>
                        <span>Se dÃ©connecter</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Voice toast */}
        {voiceToast && (
          <div className={`voice-toast${voiceToast.type === 'success' ? ' success' : voiceToast.type === 'error' ? ' error' : ''}`}>
            {listening && <div className="voice-dot" />}
            <span className="transcript">{voiceToast.text}</span>
          </div>
        )}

        {/* Manual voice input â€” fallback quand SpeechRecognition indisponible (Android WebView) */}
        {showVoiceInput && listening && (
          <div style={{
            position:"fixed",top:66,left:0,right:0,zIndex:490,
            background:"var(--surface2)",borderBottom:"2px solid var(--gold)",
            padding:"10px 14px",display:"flex",gap:10,alignItems:"center",
            boxShadow:"0 4px 20px rgba(0,0,0,.4)"
          }}>
            <div className="voice-dot" />
            <input
              autoFocus
              type="text"
              placeholder="Tapez une commande... (ex: sourate 2, verset 5, play)"
              value={voiceInputText}
              onChange={e => setVoiceInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && voiceInputText.trim()) {
                  handleTranscript(voiceInputText.trim());
                  setVoiceInputText('');
                }
              }}
              style={{
                flex:1,background:"var(--surface3)",border:"1px solid var(--gold)",
                borderRadius:6,padding:"8px 12px",color:"var(--text)",
                fontFamily:"'Cinzel',serif",fontSize:11,letterSpacing:1,outline:"none"
              }}
            />
            <button
              onClick={() => { if (voiceInputText.trim()) { handleTranscript(voiceInputText.trim()); setVoiceInputText(''); } }}
              style={{ padding:"8px 14px",background:"rgba(201,168,76,.15)",border:"1px solid var(--gold)",borderRadius:6,color:"var(--gold)",cursor:"pointer",fontSize:11,fontFamily:"'Cinzel',serif",letterSpacing:1,flexShrink:0 }}>
              â†µ OK
            </button>
            <button onClick={toggleVoice}
              style={{ padding:"8px 12px",background:"transparent",border:"1px solid var(--border2)",borderRadius:6,color:"var(--text3)",cursor:"pointer",fontSize:11,flexShrink:0 }}>
              âœ•
            </button>
          </div>
        )}

        {/* Voice help panel */}
        {showVoiceHelp && (
          <div className="voice-help">
            <div className="voice-help-title">COMMANDES VOCALES</div>
            {[
              ["â–¶ Lecture",    "play / joue / lire"],
              ["â¸ Pause",     "pause"],
              ["â¹ Stop",      "stop / arrÃªte"],
              ["â†’ Suivant",   "suivant"],
              ["â† PrÃ©cÃ©dent", "prÃ©cÃ©dent"],
              ["ğŸ“– Sourate",  "sourate fatiha / sourate 2"],
              ["â†’ Verset",    "verset 5 / ayat 12"],
              ["â†º Boucle",    "boucle versets 2 Ã  7"],
              ["â†º Off",       "arrÃªter la boucle"],
              ["Ã— RÃ©pÃ©ter",   "3 fois"],
            ].map(([label, ex]) => (
              <div className="voice-help-cmd" key={label}>
                <span>{label}</span>
                <span className="voice-help-ex">"{ex}"</span>
              </div>
            ))}
          </div>
        )}

        <div className="body">
          {/* Mobile overlay */}
          <div className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

          {/* Sidebar â€” always rendered, accessible via â˜° from any page */}
          <aside className={`sidebar${sidebarOpen ? ' open' : ''}${activePage !== 'quran' ? ' sidebar-floating' : ''}`}>
            <div className="sidebar-search">
              <input placeholder="RECHERCHER..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="sidebar-list">
              {loadingSurahs
                ? <div className="loading"><div className="loading-ring" /><span>CHARGEMENT</span></div>
                : filteredSurahs.map(s => (
                  <div key={s.number}
                    className={`surah-item${selectedSurah?.number === s.number ? " active surah-active" : ""}${(surahStats[s.number]?.learned >= s.numberOfAyahs && s.numberOfAyahs > 0) ? " fully-learned" : ""}`}
                    onClick={() => { setSelectedSurah(s); setSidebarOpen(false); if (activePage !== 'quran') setActivePage('quran'); }}>
                    <div className="surah-num">{s.number}</div>
                    <div className="surah-info">
                      <div className="surah-name-en">{s.englishName}</div>
                      <div className="surah-meta">{s.revelationType} Â· {s.numberOfAyahs} AYATS{surahStats[s.number]?.learned > 0 ? ` Â· ${surahStats[s.number].learned}âœ“` : ''}</div>
                      {(() => { const st = surahStats[s.number]; const total = s.numberOfAyahs || 0; const pct = total > 0 ? Math.round((st?.mastery || 0) / total) : 0; return (
                        <div style={{marginTop:3,display:'flex',alignItems:'center',gap:6}}>
                          <div style={{flex:1,height:2,background:'var(--surface3)',borderRadius:2,overflow:'hidden'}}>
                            <div style={{height:'100%',width:pct+'%',background:masteryColor(pct),borderRadius:2}} />
                          </div>
                          <span style={{fontSize:7,fontFamily:"'Cinzel',serif",color:masteryColor(pct),flexShrink:0}}>{pct}%</span>
                        </div>
                      ); })()}
                    </div>
                    <div className="surah-name-ar">{s.name}</div>
                  </div>
                ))}
            </div>
          </aside>

          <Routes>
            <Route path="/" element={<Navigate to="/quran" replace />} />
            <Route path="/prononciation" element={<AnimatedPage pageKey="prononciation"><PrononciationPage /></AnimatedPage>} />
            <Route path="/dashboard" element={
              <AnimatedPage pageKey="dashboard"><DashboardPage
                learnData={learnData}
                surahs={surahs}
                goals={goals}
                activity={activity}
                onSetGoal={(key, value) => dispatch(goalsActions.setGoal({ key, value }))}
                onRecordActivity={(date, delta) => dispatch(goalsActions.recordActivity({ date, ...delta }))}
                onNavigate={(surahNum) => { navigate(`/quran/${surahNum}`); const s = surahs.find(x=>x.number===surahNum); if(s){setSelectedSurah(s);} }}
              /></AnimatedPage>
            } />
            <Route path="/collections" element={
              <AnimatedPage pageKey="collections"><CollectionsPage
                collections={collections}
                learnData={learnData}
                showQalqala={showQalqala}
                showMadd={showMadd}
                showIzhar={showIzhar}
                showIdgham={showIdgham}
                setLData={setLData}
                onCreateCollection={createCollection}
                onDeleteCollection={deleteCollection}
                onToggleAyat={toggleAyatInCollection}
                onOpenCollModal={(entry) => setCollModal(entry)}
                ayatInCollectionsFn={ayatInCollections}
                surahs={surahs}
                initialSearchQuery={pendingSearchQuery}
                onConsumeSearchQuery={() => setPendingSearchQuery(null)}
                onNavigate={(surahNum, ayatNum) => {
                  navigate(`/quran/${surahNum}/${ayatNum}`);
                  const s = surahs.find(x => x.number === surahNum);
                  if (s) {
                    setSelectedSurah(s);
                    setTimeout(() => {
                      const el = ayatRefs.current[ayatNum];
                      if (el) { el.scrollIntoView({ behavior:"smooth", block:"center" }); setOpenAyatNum(ayatNum); }
                    }, 1200);
                  }
                }}
              /></AnimatedPage>
            } />
            <Route path="/revision" element={
              <AnimatedPage pageKey="revision"><RevisionPage
                learnData={learnData}
                surahs={surahs}
                setLData={setLData}
                onNavigate={(surahNum, ayatNum) => {
                  navigate(`/quran/${surahNum}/${ayatNum}`);
                  const s = surahs.find(x => x.number === surahNum);
                  if (s) {
                    setSelectedSurah(s);
                    setTimeout(() => {
                      const el = ayatRefs.current[ayatNum];
                      if (el) { el.scrollIntoView({ behavior:"smooth", block:"center" }); setOpenAyatNum(ayatNum); }
                    }, 1200);
                  }
                }}
              /></AnimatedPage>
            } />
            <Route path="/revision/memorise/:surahNum?/:rangeFrom?/:rangeTo?" element={
              <AnimatedPage pageKey="revision"><RevisionPage
                learnData={learnData}
                surahs={surahs}
                setLData={setLData}
                initialFilter="carte"
                onNavigate={(surahNum, ayatNum) => {
                  navigate(`/quran/${surahNum}/${ayatNum}`);
                  const s = surahs.find(x => x.number === surahNum);
                  if (s) {
                    setSelectedSurah(s);
                    setTimeout(() => {
                      const el = ayatRefs.current[ayatNum];
                      if (el) { el.scrollIntoView({ behavior:"smooth", block:"center" }); setOpenAyatNum(ayatNum); }
                    }, 1200);
                  }
                }}
              /></AnimatedPage>
            } />
            <Route path="/revision/questions/:surahNum?/:rangeFrom?/:rangeTo?/:qIdx?" element={
              <AnimatedPage pageKey="revision"><RevisionPage
                learnData={learnData}
                surahs={surahs}
                setLData={setLData}
                initialFilter="questions"
                onNavigate={(surahNum, ayatNum) => {
                  navigate(`/quran/${surahNum}/${ayatNum}`);
                  const s = surahs.find(x => x.number === surahNum);
                  if (s) {
                    setSelectedSurah(s);
                    setTimeout(() => {
                      const el = ayatRefs.current[ayatNum];
                      if (el) { el.scrollIntoView({ behavior:"smooth", block:"center" }); setOpenAyatNum(ayatNum); }
                    }, 1200);
                  }
                }}
              /></AnimatedPage>
            } />
            <Route path="/quran/book" element={
              <AnimatedPage pageKey="quran-book">
                <QuranBookPage surahs={surahs} />
              </AnimatedPage>
            } />
            <Route path="/quran/book3d" element={
              <AnimatedPage pageKey="quran-book3d">
                <QuranBook3DPage surahs={surahs} />
              </AnimatedPage>
            } />
            <Route path="/quran/:surahNum?/:ayatNum?" element={(
            <AnimatedPage pageKey="quran"><main className="main">
              {!selectedSurah ? (
              <div className="empty-state">
                <div className="empty-arabic">Ø§Ù„Ù‚Ø±Ø¢Ù† Ø§Ù„ÙƒØ±ÙŠÙ…</div>
                <span>SÃ‰LECTIONNEZ UNE SOURATE</span>
                <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap',justifyContent:'center'}}>
                  <button onClick={() => navigate('/quran/book')}
                    style={{ fontSize:9, letterSpacing:1.5, padding:'7px 16px',
                      fontFamily:"'Cinzel',serif", background:'rgba(201,168,76,.08)',
                      border:'1px solid rgba(201,168,76,.3)', color:'var(--gold2)',
                      borderRadius:8, cursor:'pointer' }}>ğŸ“– LIVRE CSS</button>
                  <button onClick={() => navigate('/quran/book3d')}
                    style={{ fontSize:9, letterSpacing:1.5, padding:'7px 16px',
                      fontFamily:"'Cinzel',serif", background:'rgba(201,168,76,.14)',
                      border:'1px solid rgba(201,168,76,.5)', color:'var(--gold)',
                      borderRadius:8, cursor:'pointer' }}>âœ¨ LIVRE 3D WEBGL</button>
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  const isSurahFullyLearned = ayats.length > 0 && ayats.every(a => getLData(selectedSurah.number, a.numberInSurah).learned);
                  const markAllLearned   = () => ayats.forEach(a => setLData(selectedSurah.number, a.numberInSurah, d => ({ ...d, learned: true })));
                  const unmarkAllLearned = () => ayats.forEach(a => setLData(selectedSurah.number, a.numberInSurah, d => ({ ...d, learned: false })));
                  return (
                <div className="surah-header">
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,flexWrap:'wrap'}}>
                    <div className="surah-header-ornament">{selectedSurah.name}</div>
                    {selectedSurah.number !== 9 && (
                      <div className="surah-header-bismillah" style={{fontFamily:"'Amiri Quran',serif",fontSize:18,color:'var(--gold)',direction:'rtl',opacity:.8,lineHeight:1.3}}>Ø¨ÙØ³Ù’Ù…Ù Ø§Ù„Ù„ÙÙ‘Ù‡Ù Ø§Ù„Ø±ÙÙ‘Ø­Ù’Ù…ÙÙ°Ù†Ù Ø§Ù„Ø±ÙÙ‘Ø­ÙÙŠÙ…Ù</div>
                    )}
                  </div>
                  <div className="surah-header-title">{selectedSurah.englishName.toUpperCase()} Â· <span style={{opacity:.6}}>{selectedSurah.englishNameTranslation?.toUpperCase()}</span> Â· {selectedSurah.numberOfAyahs} AYATS</div>

                  {/* Compact single-line toolbar: mastery Â· info toggle Â· learned toggle Â· go-to-ayat toggle */}
                  {(() => {
                    const st = surahStats[selectedSurah.number];
                    const total = selectedSurah.numberOfAyahs || 0;
                    const totalMasteryPct = total > 0 ? Math.round((st?.mastery || 0) / total) : 0;

                    const sn = selectedSurah.number;
                    const curPage = pageMode ? (activePageCoran ?? ayats[mainAyatIdx]?.page ?? null) : null;
                    const pageAyats = curPage ? ayats.filter(a => a.page === curPage) : ayats;
                    const totalParts = pageAyats.reduce((s, a) => s + (learnData[lkey(sn, a.numberInSurah)]?.parts?.length || 0), 0);
                    const totalUnk   = pageAyats.reduce((s, a) => s + (learnData[lkey(sn, a.numberInSurah)]?.unknownWords?.length || 0), 0);
                    const meta = pageMode && pageMeta ? pageMeta : surahMeta;
                    const pills = pageMode && curPage ? [
                      { label: 'PAGE',    val: curPage,              color: '#c878ff' },
                      { label: 'HIZB',    val: meta?.hizb    ?? 'â€¦', color: '#ffd166' },
                      { label: 'JUZ',     val: meta?.juz     ?? 'â€¦', color: '#a8edea' },
                      { label: 'AYATS',   val: meta?.ayatCount ?? pageAyats.length, color: 'var(--gold2)' },
                      { label: 'MOTS',    val: meta?.wordCount ?? 'â€¦', color: '#5bc8f5' },
                      { label: 'PARTIES', val: totalParts,            color: '#c878ff' },
                      { label: 'INCONNUS',val: totalUnk, color: totalUnk > 0 ? '#ff9f43' : 'var(--text3)' },
                    ] : [
                      { label: 'HIZB',    val: surahMeta?.hizb ?? 'â€¦', color: '#ffd166' },
                      { label: 'AYATS',   val: selectedSurah.numberOfAyahs, color: 'var(--gold2)' },
                      { label: 'MOTS',    val: surahMeta?.wordCount ?? 'â€¦', color: '#5bc8f5' },
                      { label: 'PARTIES', val: totalParts, color: '#c878ff' },
                      { label: 'INCONNUS',val: totalUnk,  color: totalUnk > 0 ? '#ff9f43' : 'var(--text3)' },
                    ];
                    const infoLabel = pageMode && curPage ? `PAGE ${curPage}` : `SOURATE`;

                    const pillBtnStyle = (active, activeColor='rgba(255,255,255,.2)') => ({
                      display:'flex', alignItems:'center', gap:4,
                      fontSize:8, letterSpacing:1, padding:'4px 10px', borderRadius:20,
                      fontFamily:"'Cinzel',serif", cursor:'pointer', whiteSpace:'nowrap',
                      background: active ? 'rgba(255,255,255,.06)' : 'transparent',
                      border:'1px solid ' + (active ? activeColor : 'rgba(255,255,255,.1)'),
                      color: active ? 'var(--text2)' : 'var(--text3)', transition:'all .2s',
                    });

                    return (
                      <>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:8,flexWrap:'wrap'}}>
                          {/* Mastery */}
                          <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 11px',borderRadius:20,
                            border:`1px solid ${masteryColor(totalMasteryPct)}`,background:'rgba(255,255,255,.03)'}}>
                            <span style={{fontSize:9}}>ğŸ¯</span>
                            <span style={{fontSize:11,fontWeight:700,fontFamily:"'Cinzel',serif",color:masteryColor(totalMasteryPct)}}>{totalMasteryPct}%</span>
                          </div>

                          {/* Info toggle (page/hizb/juz/mots/parties/inconnus pills) */}
                          <button onClick={() => setShowSurahInfo(v => !v)}
                            style={pillBtnStyle(showSurahInfo, 'rgba(255,255,255,.25)')}>
                            â„¹ {infoLabel} {showSurahInfo ? 'â–²' : 'â–¼'}
                          </button>

                          {/* Learned toggle */}
                          {ayats.length > 0 && (
                            <button onClick={isSurahFullyLearned ? unmarkAllLearned : markAllLearned}
                              title={isSurahFullyLearned ? "Sourate apprise â€” cliquer pour dÃ©sactiver" : "Marquer toute la sourate comme apprise"}
                              style={pillBtnStyle(isSurahFullyLearned, 'var(--green)')}>
                              {isSurahFullyLearned
                                ? <span style={{color:'var(--green)'}}>âœ“ APPRISE</span>
                                : 'MARQUER APPRISE'}
                            </button>
                          )}

                          {/* Go-to-ayat toggle */}
                          {ayats.length > 0 && (
                            <button onClick={() => setShowAyatJump(v => !v)}
                              style={pillBtnStyle(showAyatJump, '#c878ff')}>
                              ğŸ” ALLER {showAyatJump ? 'â–²' : 'â–¼'}
                            </button>
                          )}
                        </div>

                        {showSurahInfo && (
                          <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',marginTop:8}}>
                            {pills.map(({ label: l, val, color }) => (
                              <div key={l} style={{
                                display:'flex',flexDirection:'column',alignItems:'center',
                                background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',
                                borderRadius:7,padding:'5px 12px',minWidth:52,
                              }}>
                                <div style={{fontSize:14,fontWeight:700,color,fontFamily:"'Cinzel',serif",lineHeight:1}}>{val}</div>
                                <div style={{fontSize:7,letterSpacing:1.5,color:'var(--text3)',marginTop:3}}>{l}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {showAyatJump && (
                          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:8}}>
                            <input type="number" min={1} max={selectedSurah.numberOfAyahs}
                              autoFocus
                              value={ayatSearchInput}
                              onChange={e => setAyatSearchInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { jumpToAyatNumber(ayatSearchInput); setAyatSearchInput(''); setShowAyatJump(false); } }}
                              placeholder="NÂ°"
                              style={{width:56,textAlign:'center',background:'var(--surface3)',
                                border:'1px solid var(--border2)',borderRadius:6,padding:'4px 6px',
                                color:'var(--text)',fontSize:12,fontFamily:"'Cinzel',serif",outline:'none'}} />
                            <button onClick={() => { jumpToAyatNumber(ayatSearchInput); setAyatSearchInput(''); setShowAyatJump(false); }}
                              style={{fontSize:8,letterSpacing:1,padding:'5px 10px',fontFamily:"'Cinzel',serif",
                                background:'rgba(200,120,255,.08)',border:'1px solid #c878ff',color:'#c878ff',
                                borderRadius:6,cursor:'pointer'}}>
                              ğŸ” ALLER
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                  );
                })()}

                {(() => {
                  const anyTj = showQalqala||showMadd||showIzhar||showIdgham;
                  const anyOpt = announceNum||spellCheck||showParts||pageMode;
                  return (
                <div className="ts-global-bar">
                  <button onClick={() => setShowTsBar(!showTsBar)}
                    style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:"1px solid var(--border2)", borderRadius:"var(--radius-sm)", padding:"3px 10px", cursor:"pointer", flexShrink:0 }}>
                    <span className="ts-global-label">âš¡ TS</span>
                    <span className="ts-global-count">{loadedCount}/{ayats.length}</span>
                    <span style={{ fontSize:8, color:"var(--text3)", marginLeft:2 }}>{showTsBar ? "â–²" : "â–¼"}</span>
                  </button>
                  <div className="panel-row">
                  <button onClick={() => setShowTajweedPanel(v => !v)}
                    style={{ display:"flex", alignItems:"center", gap:5,
                      background: showTajweedPanel ? "rgba(255,255,255,.06)" : anyTj ? "rgba(91,200,245,.08)" : "transparent",
                      border: "1px solid " + (anyTj ? "#5bc8f5" : showTajweedPanel ? "rgba(255,255,255,.15)" : "var(--border2)"),
                      borderRadius:"var(--radius-sm)", padding:"3px 10px", cursor:"pointer", flexShrink:0,
                      color: anyTj ? "#5bc8f5" : "var(--text3)",
                      fontSize:9, letterSpacing:"1px", fontFamily:"Cinzel,serif", transition:"all .2s" }}>
                    ØªØ¬ÙˆÙŠØ¯ <span style={{fontSize:7,marginLeft:2}}>{showTajweedPanel ? "â–²" : "â–¼"}</span>
                  </button>
                  {showTajweedPanel && (
                    <div className="panel-expand" style={{ left:0, right:0, minWidth:0 }}>
                    <div className="tajweed-panel" style={{ flexWrap:'wrap', gap:6, padding:'8px 12px' }}>
                      {[
                        { toggle: toggleQalqala, on: showQalqala, label: "Ù‚Ù„Ù‚Ù„Ø©", color: "#5bc8f5", bg: "rgba(91,200,245,.1)" },
                        { toggle: toggleMadd,    on: showMadd,    label: "Ù…ÙØ¯Ù‘",   color: "#f09de0", bg: "rgba(240,157,224,.1)" },
                        { toggle: toggleIzhar,   on: showIzhar,   label: "Ø¥Ø¸Ù‡Ø§Ø±", color: "#4caf81", bg: "rgba(76,175,129,.1)" },
                        { toggle: toggleIdgham,  on: showIdgham,  label: "Ø¥Ø¯ØºØ§Ù…", color: "#ffd166", bg: "rgba(255,209,102,.1)" },
                      ].map(({toggle,on,label,color,bg}) => (
                        <button key={label} onClick={toggle}
                          style={{ display:"flex", alignItems:"center", background: on ? bg : "transparent",
                            border: "1px solid " + (on ? color : "rgba(255,255,255,.1)"),
                            borderRadius:"var(--radius-sm)", padding:"3px 9px", cursor:"pointer", flexShrink:0,
                            color: on ? color : "var(--text3)", fontSize:10, fontFamily:"Cinzel,serif", transition:"all .2s" }}>
                          {label}
                        </button>
                      ))}
                    </div></div>
                  )}
                  </div>
                  <div className="panel-row">
                  <button onClick={() => setShowOptionsPanel(v => !v)}
                    style={{ display:"flex", alignItems:"center", gap:5,
                      background: showOptionsPanel ? "rgba(255,255,255,.06)" : anyOpt ? "rgba(201,168,76,.08)" : "transparent",
                      border: "1px solid " + (anyOpt ? "var(--gold)" : showOptionsPanel ? "rgba(255,255,255,.15)" : "var(--border2)"),
                      borderRadius:"var(--radius-sm)", padding:"3px 10px", cursor:"pointer", flexShrink:0,
                      color: anyOpt ? "var(--gold2)" : "var(--text3)",
                      fontSize:9, letterSpacing:"1px", fontFamily:"Cinzel,serif", transition:"all .2s" }}>
                    OPTIONS <span style={{fontSize:7,marginLeft:2}}>{showOptionsPanel ? "â–²" : "â–¼"}</span>
                  </button>
                  {showOptionsPanel && (
                    <div className="panel-expand" style={{ left:0, right:0, minWidth:0 }}>
                    <div className="tajweed-panel" style={{ flexWrap:'wrap', gap:6, padding:'8px 12px' }}>
                      {[
                        { toggle: toggleAnnounceNum, on: announceNum, label: "ğŸ”¢ NÂ°",      color: "var(--teal2)",  bg: "rgba(62,184,160,.12)" },
                        { toggle: toggleSpellCheck,  on: spellCheck,  label: "âœ” ORTHO",   color: "var(--gold2)",  bg: "rgba(201,168,76,.1)" },
                        { toggle: toggleShowParts,   on: showParts,   label: "âœ‚ PARTIES", color: "var(--gold2)",  bg: "rgba(201,168,76,.1)" },
                        { toggle: () => { setPageMode(v=>!v); setactivePageCoran(null); }, on: pageMode, label: "ğŸ“– PAGE", color: "#c878ff", bg: "rgba(200,120,255,.12)" },
                        ...(pageMode ? [{ toggle: () => setAutoPageFollow(v=>!v), on: autoPageFollow, label: "â‡„ SUIVI", color: "#c878ff", bg: "rgba(200,120,255,.12)" }] : []),
                      ].map(({toggle,on,label,color,bg}) => (
                        <button key={label} onClick={toggle}
                          style={{ display:"flex", alignItems:"center", background: on ? bg : "transparent",
                            border: "1px solid " + (on ? color : "rgba(255,255,255,.1)"),
                            borderRadius:"var(--radius-sm)", padding:"3px 9px", cursor:"pointer", flexShrink:0,
                            color: on ? color : "var(--text3)", fontSize:9, fontFamily:"Cinzel,serif", transition:"all .2s" }}>
                          {label}
                        </button>
                      ))}
                      <button onClick={()=>navigate('/quran/book')}
                        style={{display:"flex",alignItems:"center",background:"rgba(201,168,76,.07)",
                          border:"1px solid rgba(201,168,76,.28)",borderRadius:"var(--radius-sm)",
                          padding:"3px 9px",cursor:"pointer",flexShrink:0,
                          color:"var(--gold2)",fontSize:9,fontFamily:"Cinzel,serif"}}>ğŸ“– CSS</button>
                      <button onClick={()=>navigate('/quran/book3d')}
                        style={{display:"flex",alignItems:"center",background:"rgba(201,168,76,.13)",
                          border:"1px solid rgba(201,168,76,.45)",borderRadius:"var(--radius-sm)",
                          padding:"3px 9px",cursor:"pointer",flexShrink:0,
                          color:"var(--gold)",fontSize:9,fontFamily:"Cinzel,serif"}}>âœ¨ 3D</button>
                    </div>
                    </div>
                  )}
                  </div>
                  {/* LANGUES button */}
                  <div style={{ position:"relative", flexShrink:0 }}>
                  <button onClick={() => setShowLangPanel(v => !v)}
                    style={{ display:"flex", alignItems:"center", gap:5,
                      background: showLangPanel ? "rgba(255,255,255,.06)" : translationLang ? "rgba(91,200,245,.08)" : "transparent",
                      border: "1px solid " + (translationLang ? "#5bc8f5" : showLangPanel ? "rgba(255,255,255,.15)" : "var(--border2)"),
                      borderRadius:"var(--radius-sm)", padding:"3px 10px", cursor:"pointer", flexShrink:0,
                      color: translationLang ? "#5bc8f5" : "var(--text3)",
                      fontSize:9, letterSpacing:"1px", fontFamily:"Cinzel,serif", transition:"all .2s" }}>
                    ğŸŒ LANGUE <span style={{fontSize:7,marginLeft:2}}>{showLangPanel ? "â–²" : "â–¼"}</span>
                  </button>
                  {showLangPanel && (
                    <div className="panel-expand" style={{ left:0, right:0, minWidth:0 }}>
                    <div className="tajweed-panel" style={{ flexWrap:'wrap', gap:6, padding:'8px 12px' }}>
                      {Object.entries(TRANS_LABELS).map(([lang, label]) => (
                        <button key={lang} onClick={() => setTranslationLang(t => t === lang ? null : lang)}
                          style={{ display:"flex", alignItems:"center", flexShrink:0,
                            background: translationLang === lang ? 'rgba(91,200,245,.12)' : 'transparent',
                            border:`1px solid ${translationLang === lang ? '#5bc8f5' : 'rgba(255,255,255,.08)'}`,
                            borderRadius:5, padding:'5px 12px', cursor:'pointer',
                            color: translationLang === lang ? '#5bc8f5' : 'var(--text3)',
                            fontSize:10, fontFamily:"Cinzel,serif", transition:'all .15s',
                            boxShadow: translationLang === lang ? '0 0 6px rgba(91,200,245,.2)' : 'none' }}>
                          {label}
                        </button>
                      ))}
                      {translationLang && (
                        <button onClick={() => setTranslationLang(null)}
                          style={{ fontSize:9, padding:'5px 10px', borderRadius:5, cursor:'pointer',
                            background:'rgba(229,115,115,.1)', border:'1px solid rgba(229,115,115,.3)',
                            color:'var(--red)', fontFamily:"Cinzel,serif" }}>âœ• OFF</button>
                      )}
                    </div>
                    </div>
                  )}
                  </div>
                  {showTsBar && (
                    <>
                      <span style={{ fontSize:8, letterSpacing:1, color:'var(--text3)', fontFamily:"'Cinzel',serif", marginRight:4 }}>
                        {RECITATORS.find(r => r.id === recitatorId)?.flag} {RECITATORS.find(r => r.id === recitatorId)?.label?.toUpperCase()}
                      </span>
                      <div className="ts-progress-bar">
                        <div className="ts-progress-fill" style={{ width: `${ayats.length ? (loadedCount / ayats.length) * 100 : 0}%` }} />
                      </div>
                      <label className="ts-drop-zone">
                        <input type="file" accept=".json" multiple onChange={e => handleTimestampsFiles([...e.target.files])} />
                        <span className="ts-drop-label">ğŸ“‚ CHARGER JSON(S)</span>
                      </label>
                      {loadedCount > 0 && (
                        <button className="btn-small" style={{ color: "var(--red)", borderColor: "var(--red)" }}
                          title={`Effacer les timestamps de ${RECITATORS.find(r => r.id === recitatorId)?.label || recitatorId}`}
                          onClick={() => {
                            // Only clear this reciter's entries â€” other reciters keep theirs
                            const kept = {};
                            for (const [k, v] of Object.entries(timestampsMap)) {
                              if (!k.startsWith(`${recitatorId}:`)) kept[k] = v;
                            }
                            setTimestampsMap(kept);
                          }}>âœ•</button>
                      )}
                    </>
                  )}
                </div>); })()} 

                {/* â”€â”€ Page mode navigator bar â”€â”€ */}
                {pageMode && ayats && ayats.length > 0 && (() => {
                  const pages = [...new Set(ayats.map(a => a.page).filter(Boolean))].sort((a,b)=>a-b);
                  const curPage = activePageCoran ?? ayats[mainAyatIdx]?.page ?? pages[0];
                  const idx = pages.indexOf(curPage);
                  return (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'6px 14px', background:'var(--surface2)', borderBottom:'1px solid var(--border)',
                      position:'sticky', top:0, zIndex:10, gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <button onClick={() => setactivePageCoran(pages[0])} disabled={idx<=0}
                          title="PremiÃ¨re page de la sourate"
                          style={{ fontSize:11, padding:'3px 7px', fontFamily:"'Cinzel',serif",
                            background:'transparent', border:'1px solid var(--border2)',
                            color: idx>0 ? 'var(--text2)' : 'var(--text3)', borderRadius:6,
                            cursor: idx>0 ? 'pointer' : 'default', lineHeight:1 }}>â®</button>
                        <button onClick={() => setactivePageCoran(pages[idx-1])} disabled={idx<=0}
                          style={{ fontSize:8, letterSpacing:1, padding:'3px 10px', fontFamily:"'Cinzel',serif",
                            background:'transparent', border:'1px solid var(--border2)',
                            color: idx>0 ? 'var(--text2)' : 'var(--text3)', borderRadius:6,
                            cursor: idx>0 ? 'pointer' : 'default' }}>â† {idx>0 ? pages[idx-1] : ''}</button>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:7, letterSpacing:2, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>PAGE</span>
                        <input type="number" value={curPage}
                          onChange={e => { const v=parseInt(e.target.value); if(pages.includes(v)) setactivePageCoran(v); }}
                          style={{ width:48, textAlign:'center', background:'var(--surface3)',
                            border:'1px solid #c878ff', borderRadius:6, padding:'3px 6px',
                            color:'#c878ff', fontSize:13, fontFamily:"'Cinzel',serif", outline:'none' }} />
                        <span style={{ fontSize:7, color:'var(--text3)' }}>/ {pages[pages.length-1]}</span>
                        {/* Page loop button */}
                        {(() => {
                          const pageAyats = ayats.filter(a => a.page === curPage);
                          const firstIdx  = pageAyats.length ? ayats.indexOf(pageAyats[0]) : -1;
                          const lastIdx   = pageAyats.length ? ayats.indexOf(pageAyats[pageAyats.length-1]) : -1;
                          const isPageLoop = loopActive && loopStart === firstIdx && loopEnd === lastIdx;
                          const togglePageLoop = () => {
                            if (isPageLoop) {
                              setLoopActive(false);
                            } else {
                              if (firstIdx < 0) return;
                              setLoopStart(firstIdx); setLoopEnd(lastIdx);
                              setLoopStartInput(pageAyats[0].numberInSurah);
                              setLoopEndInput(pageAyats[pageAyats.length-1].numberInSurah);
                              setLoopActive(true); setLoopCount(0);
                              playMainAyat(firstIdx);
                              setTimeout(() => mainAudioRef.current?.play(), 80);
                            }
                          };
                          return (
                            <button onClick={togglePageLoop} title={isPageLoop ? 'ArrÃªter boucle page' : 'Lire page en boucle'}
                              style={{ fontSize:12, padding:'2px 7px', borderRadius:6, cursor:'pointer', lineHeight:1,
                                background: isPageLoop ? 'rgba(200,120,255,.2)' : 'transparent',
                                border: `1px solid ${isPageLoop ? '#c878ff' : 'rgba(255,255,255,.15)'}`,
                                color: isPageLoop ? '#c878ff' : 'var(--text3)', transition:'all .2s' }}>
                              {isPageLoop ? 'â¹' : 'ğŸ”'}
                            </button>
                          );
                        })()}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <button onClick={() => setactivePageCoran(pages[idx+1])} disabled={idx>=pages.length-1}
                          style={{ fontSize:8, letterSpacing:1, padding:'3px 10px', fontFamily:"'Cinzel',serif",
                            background:'transparent', border:'1px solid var(--border2)',
                            color: idx<pages.length-1 ? 'var(--text2)' : 'var(--text3)', borderRadius:6,
                            cursor: idx<pages.length-1 ? 'pointer' : 'default' }}>
                          {idx<pages.length-1 ? pages[idx+1] : ''} â†’</button>
                        <button onClick={() => setactivePageCoran(pages[pages.length-1])} disabled={idx>=pages.length-1}
                          title="DerniÃ¨re page de la sourate"
                          style={{ fontSize:11, padding:'3px 7px', fontFamily:"'Cinzel',serif",
                            background:'transparent', border:'1px solid var(--border2)',
                            color: idx<pages.length-1 ? 'var(--text2)' : 'var(--text3)', borderRadius:6,
                            cursor: idx<pages.length-1 ? 'pointer' : 'default', lineHeight:1 }}>â­</button>
                      </div>
                    </div>
                  );
                })()}

                <div className="ayat-scroll" onContextMenu={handleAyatContextMenu}>
                  <audio ref={partAudioRef} style={{ display: "none" }} onEnded={() => { setTimeout(() => { setPlayingPart(null); setPartCurrentMs(0); stopPartRaf(); }, 250); }} />
                  {loadingAyats
                    ? <div className="loading"><div className="loading-ring" /><span>CHARGEMENT</span></div>
                    : <>{tsVersion > -1 && (playStateVer >= 0) && (loopStateVer >= 0) && (() => {
                      const curPage = pageMode ? (activePageCoran ?? ayats[mainAyatIdx]?.page) : null;
                      const visible = curPage ? ayats.filter(a => a.page === curPage) : ayats.slice(0, renderLimit);
                      return visible.map(ayat => {
                      const ld        = getLData(selectedSurah.number, ayat.numberInSurah);
                      const isOpen    = openAyatNum === ayat.numberInSurah;
                      const isPlaying = playingAyatNum === ayat.numberInSurah && isMainPlaying;
                      const isCurrent = ayats[mainAyatIdx]?.numberInSurah === ayat.numberInSurah && !isPlaying;
                      const ts        = timestampsMap[tskey(selectedSurah.number, ayat.numberInSurah)];
                      const inLoop    = loopActive && ayat.numberInSurah >= loopStartNum && ayat.numberInSurah <= loopEndNum;
                      const isSelecting = partSelectAyat === ayat.numberInSurah;
                      const globalIdx = ayats.indexOf(ayat);
                      const prevAyat  = globalIdx > 0 ? ayats[globalIdx - 1] : null;
                      const nextAyat  = globalIdx >= 0 && globalIdx < ayats.length - 1 ? ayats[globalIdx + 1] : null;
                      const isPageStart = ayat.page != null && (!prevAyat || prevAyat.page !== ayat.page);
                      const isPageEnd   = ayat.page != null && (!nextAyat || nextAyat.page !== ayat.page);

                      const playPartInline = (part, loop = false) => {
                        if (!ts?.words || !part.wordIndices?.length) return;
                        const url = audioUrl(ayat);
                        if (!url) return;
                        const firstTs = ts.words[part.wordIndices[0]];
                        const lastTs  = ts.words[part.wordIndices[part.wordIndices.length - 1]];
                        if (!firstTs || !lastTs) return;
                        const startMs = firstTs.chars?.[0]?.start;
                        const endMs   = lastTs.chars?.[lastTs.chars.length - 1]?.end;
                        if (startMs == null || endMs == null) return;
                        const audio = partAudioRef.current;
                        if (!audio) return;
                        // Toggle stop if same part playing
                        if (playingPart?.ayatNum === ayat.numberInSurah && playingPart?.partId === part.id) {
                          audio.pause(); setPlayingPart(null); setPartCurrentMs(0); stopPartRaf(); return;
                        }
                        audio.src = url;
                        audio.currentTime = startMs / 1000;
                        audio.play().catch(() => {});
                        setPlayingPart({ ayatNum: ayat.numberInSurah, partId: part.id, loop });
                        startPartRaf();
                        const endSec = endMs / 1000;
                        const startSec = startMs / 1000;
                        const check = () => {
                          if (audio.currentTime >= endSec) {
                            if (loop && playingPart?.loop !== false) {
                              audio.currentTime = startSec;
                              audio.play().catch(() => {});
                            } else {
                              audio.pause();
                              setTimeout(() => { stopPartRaf(); setPlayingPart(null); setPartCurrentMs(0); audio.removeEventListener('timeupdate', check); }, 250);
                              audio.removeEventListener('timeupdate', check);
                            }
                          }
                        };
                        audio.addEventListener('timeupdate', check);
                      };

                      // Wordâ†’partIndex map for coloring
                      const PART_COLORS  = ["rgba(201,168,76,.22)","rgba(62,184,160,.18)","rgba(111,207,154,.18)","rgba(224,90,90,.15)","rgba(200,120,255,.15)"];
                      const PART_BORDERS = ["var(--gold)","var(--teal)","var(--green)","var(--red)","#c878ff"];
                      const wordPartMap  = {};
                      (ld.parts || []).forEach((p, pi) => p.wordIndices?.forEach(wi => { wordPartMap[wi] = pi; }));
                      const wordsInParts = new Set(Object.keys(wordPartMap).map(Number));
                      const nextAvail    = wordsInParts.size > 0 ? Math.max(...wordsInParts) + 1 : 0;
                      const ayatWords    = ayat.text ? ayat.text.split(" ").filter(Boolean) : [];

                      // Handle word click during inline selection
                      const handleInlineWordClick = (e, wi) => {
                        e.stopPropagation();
                        // Aide mÃ©moire click modes
                        const aideMemoireClickMode = aideMemoireClickModes[ayat.numberInSurah]||null;
                        if (aideMemoireClickMode === 'highlight') {
                          e.stopPropagation();
                          const word = ayatWords[wi];
                          const prev = ld?.highlight?.trim() ? ld.highlight.trim().split(/\s+/) : [];
                          const normWord = normalizeAr(word);
                          const exists = prev.some(w => normalizeAr(w) === normWord);
                          const next = exists ? prev.filter(w => normalizeAr(w) !== normWord) : [...prev, word];
                          setLData(selectedSurah.number, ayat.numberInSurah, d => ({ ...d, highlight: next.join(' ') }));
                          return;
                        }
                        if (aideMemoireClickMode === 'unknown') {
                          e.stopPropagation();
                          const ayatWordsList = ayat.text ? ayat.text.split(' ').filter(Boolean) : [];
                          const rootClicked   = arabicRoot(ayatWordsList[wi] || '');
                          const prev = ld?.unknownWords || [];
                          const isRemoving = prev.includes(wi);
                          // add/remove ALL indices with the same root
                          const sameForm = ayatWordsList.reduce((acc, w, i) => { if (arabicRoot(w) === rootClicked) acc.push(i); return acc; }, []);
                          const next = isRemoving
                            ? prev.filter(x => !sameForm.includes(x))
                            : [...new Set([...prev, ...sameForm])];
                          setLData(selectedSurah.number, ayat.numberInSurah, d => ({ ...d, unknownWords: next }));
                          return;
                        }
                        if (!isSelecting) return;
                        if (partSelectStep === 'start') {
                          if (wi < nextAvail) return;
                          setPartSelectStart(wi);
                          setPartSelectStep('end');
                        } else if (partSelectStep === 'end') {
                          if (partSelectStart === null) return;
                          const from = Math.min(partSelectStart, wi);
                          const to   = Math.max(partSelectStart, wi);
                          const clampedFrom = Math.max(from, nextAvail);
                          const indices = []; for (let i = clampedFrom; i <= to; i++) indices.push(i);
                          if (indices.length === 0) return;
                          setLData(selectedSurah.number, ayat.numberInSurah, d => ({
                            ...d, parts: [...(d.parts || []), { id: Date.now(), wordIndices: indices, text: indices.map(i => ayatWords[i]).join(" "), learned: !!d.learned }]
                          }));
                          const newNext = to + 1;
                          if (newNext < ayatWords.length) {
                            setPartSelectStart(null);
                            setPartSelectStep('start');
                          } else {
                            setPartSelectAyat(null); setPartSelectStep(null); setPartSelectStart(null);
                          }
                        }
                      };

                      // Render the Arabic text â€” either TS-highlighted, inline-selectable, or plain
                      // _tsForAyat: basmala already stripped at parse time â€” pass ts directly
                      const renderAyatText = () => {
                        if (isPlaying && ts && enableLetterByLetter) return <PlayingArabicHighlighted text={ayat.text} timestamps={ts} mode="main" showQalqala={showQalqala} showMadd={showMadd} showIzhar={showIzhar} showIdgham={showIdgham} />;
                        if (playingPart?.ayatNum === ayat.numberInSurah && ts && enableLetterByLetter)
                          return <PlayingArabicHighlighted text={ayat.text} timestamps={ts} mode="part" playingPart={playingPart} ld={ld} showQalqala={showQalqala} showMadd={showMadd} showIzhar={showIzhar} showIdgham={showIdgham} />;
                        if (localPlaying?.ayatNum === ayat.numberInSurah && ts && enableLetterByLetter)
                          return <PlayingArabicHighlighted text={ayat.text} timestamps={ts} mode="local" showQalqala={showQalqala} showMadd={showMadd} showIzhar={showIzhar} showIdgham={showIdgham} />;

                        // Revise highlighting â€” declared early to avoid TDZ with showPartColors
                        const _reviseData = ld?.toRevise;
                        const revWordSet  = _reviseData && typeof _reviseData === 'object' ? new Set(_reviseData.words || []) : (_reviseData === true ? 'all' : null);
                        const revChars    = _reviseData && typeof _reviseData === 'object' ? (_reviseData.chars || {}) : {};

                        const aideMemoireClickMode = aideMemoireClickModes[ayat.numberInSurah]||null;
                        const showWordButtons = isSelecting || aideMemoireClickMode !== null;
                        const showPartColors  = !isSelecting && showParts && Object.keys(wordPartMap).length > 0;

                        // When timestamps loaded and not in word-select/aide-memoire mode: use ArabicHighlighted for tajweed coloring
                        if (ts && enableTimestamps && !showWordButtons && !showPartColors) {
                          return <ArabicHighlighted text={ayat.text} timestamps={ts} currentMs={-1} showQalqala={showQalqala} showMadd={showMadd} showIzhar={showIzhar} showIdgham={showIdgham} />;
                        }

                        if (showWordButtons) {
                          return (
                            <div className="ayat-arabic" style={{ cursor: aideMemoireClickMode ? "pointer" : "default" }}>
                              {ayatWords.map((w, wi) => {
                                // Aide mÃ©moire display
                                const aideMemoireClickMode = aideMemoireClickModes[ayat.numberInSurah]||null;
                        if (aideMemoireClickMode === 'highlight') {
                                  const normW = normalizeAr(w);
                                  const isHl = ld?.highlight?.trim()?.split(/\s+/).some(hw => normalizeAr(hw) === normW);
                                  return (
                                    <span key={wi} onClick={e => handleInlineWordClick(e, wi)} style={{
                                      display:'inline-block', cursor:'pointer', padding:'1px 4px', margin:'1px',
                                      borderRadius:5, transition:'all .15s', userSelect:'none',
                                      background: isHl ? 'rgba(255,209,102,.2)' : 'transparent',
                                      border: `1px solid ${isHl ? 'var(--gold)' : 'transparent'}`,
                                      color: isHl ? '#ffd166' : undefined,
                                      textShadow: isHl ? '0 0 8px rgba(255,209,102,.5)' : 'none',
                                    }}>{w}{wi < ayatWords.length-1 ? ' ' : ''}</span>
                                  );
                                }
                                if (aideMemoireClickMode === 'unknown') {
                                  const isUnk = (ld?.unknownWords||[]).includes(wi);
                                  return (
                                    <span key={wi} onClick={e => handleInlineWordClick(e, wi)} style={{
                                      display:'inline-block', cursor:'pointer', padding:'1px 4px', margin:'1px',
                                      borderRadius:5, transition:'all .15s', userSelect:'none',
                                      background: isUnk ? 'rgba(255,126,179,.18)' : 'transparent',
                                      border: `1px solid ${isUnk ? '#ff7eb3' : 'transparent'}`,
                                      color: isUnk ? '#ff7eb3' : undefined,
                                      textDecoration: isUnk ? 'underline dotted #ff7eb3' : 'none',
                                    }}>{w}{wi < ayatWords.length-1 ? ' ' : ''}</span>
                                  );
                                }
                                const inExistingPart = wordsInParts.has(wi);
                                const pi             = wordPartMap[wi];
                                const isLearned      = pi !== undefined && (ld.parts || [])[pi]?.learned;
                                const isPast         = wi < nextAvail;
                                const isStart        = partSelectStep === 'end' && wi === partSelectStart;
                                const isInPreview    = partSelectStep === 'end' && partSelectStart !== null && wi >= Math.min(partSelectStart, wi) && wi >= nextAvail && wi <= Math.max(partSelectStart, wi);
                                // preview: between startIdx and current (we can't hover in React without extra state,
                                // so we just highlight the chosen start word)
                                let bg = "transparent", border = "var(--border)", color = "var(--text2)", cursor = "pointer";
                                if (isPast || inExistingPart) {
                                  bg = isLearned ? "rgba(76,175,129,.15)" : PART_COLORS[pi % PART_COLORS.length] ?? "rgba(62,184,160,.1)";
                                  border = isLearned ? "var(--green)" : PART_BORDERS[pi % PART_BORDERS.length] ?? "var(--teal)";
                                  color  = "var(--text2)"; cursor = "default";
                                } else if (isStart) {
                                  bg = "rgba(201,168,76,.25)"; border = "var(--gold2)"; color = "var(--gold2)";
                                } else if (partSelectStep === 'start') {
                                  bg = "rgba(201,168,76,.04)"; border = "rgba(201,168,76,.5)"; color = "var(--gold)";
                                } else if (partSelectStep === 'end') {
                                  bg = "rgba(62,184,160,.05)"; border = "rgba(62,184,160,.5)"; color = "var(--teal2)";
                                }
                                return (
                                  <span key={wi} onClick={e => handleInlineWordClick(e, wi)} style={{
                                    display: "inline-block", margin: "2px 3px", padding: "2px 5px",
                                    borderRadius: 5, border: `1px solid ${border}`,
                                    background: bg, color, cursor,
                                    transition: "all .12s",
                                    fontFamily: "'Amiri Quran',serif",
                                  }}>{w}</span>
                                );
                              })}
                            </div>
                          );
                        }

                        if (showPartColors) {
                          // pre-compute annotation indices
                          const _hlSet  = (() => { const s=new Set(); if (!ld.highlight?.trim()) return s; ld.highlight.trim().split(/\s+/).forEach(hw => { const n=normalizeAr(hw); ayatWords.forEach((aw,i)=>{ if(normalizeAr(aw)===n) s.add(i); }); }); return s; })();
                          const _unkSet = new Set(ld?.unknownWords||[]);
                          // Group consecutive words by part (segment) â€” one unified bubble per part
                          const segments2 = [];
                          let seg2 = null;
                          ayatWords.forEach((w, wi) => {
                            const pi = wordPartMap[wi];
                            if (seg2 && seg2.pi === pi) { seg2.words.push({ w, wi }); }
                            else { seg2 = { pi, words: [{ w, wi }] }; segments2.push(seg2); }
                          });
                          return (
                            <div className="ayat-arabic">
                              {segments2.map((seg, si) => {
                                const pi        = seg.pi;
                                const hasPart   = pi !== undefined;
                                const part      = hasPart ? (ld.parts||[])[pi] : null;
                                const isLearned = part?.learned;
                                const isPlaying = hasPart && playingPart?.ayatNum===ayat.numberInSurah && playingPart?.partId===part?.id;
                                const canPlay   = hasPart && !!ts?.words;
                                const segBg     = hasPart ? (isPlaying ? "rgba(62,184,160,.28)" : isLearned ? "rgba(76,175,129,.18)" : PART_COLORS[pi%PART_COLORS.length]) : "transparent";
                                const segBorder = hasPart ? `1px solid ${isPlaying ? "var(--teal2)" : isLearned ? "var(--green)" : PART_BORDERS[pi%PART_BORDERS.length]}` : "none";
                                return (
                                  <span key={si}
                                    onClick={e=>{ e.stopPropagation(); if(canPlay) playPartInline(part,false); }}
                                    title={canPlay ? (isPlaying?"Stopper":"Lire cette partie") : undefined}
                                    style={{
                                      display:"inline-block",
                                      background:segBg, border:segBorder,
                                      borderRadius:6, padding:"1px 7px", margin:"2px 2px",
                                      cursor:canPlay?"pointer":"default",
                                      transition:"all .15s",
                                    }}>
                                    {seg.words.map(({w,wi},wii) => {
                                      const isUnk = _unkSet.has(wi);
                                      const isHl  = _hlSet.has(wi);
                                      const isRevW = revWordSet === 'all' || (revWordSet && revWordSet.has(wi));
                                      const wRevChars = isRevW ? revChars[wi] : null;
                                      const wColor  = isUnk?"#ff7eb3":isHl?"#ffd166":isRevW?"var(--gold2)":undefined;
                                      const wShadow = isUnk?"0 0 8px rgba(255,126,179,.5)":isHl?"0 0 8px rgba(255,209,102,.6)":isRevW?"0 0 6px rgba(201,168,76,.4)":"none";
                                      const wDecor  = isUnk?"underline dotted #ff7eb3":isRevW&&!wRevChars?.length?"underline wavy var(--gold)":"none";
                                      const wBg     = isUnk?"rgba(255,126,179,.15)":isHl?"rgba(255,209,102,.12)":isRevW&&!wRevChars?.length?"rgba(201,168,76,.2)":"transparent";
                                      const renderCh = (ch,ci,arr2) => {
                                        if(isUnk||isHl) return <span key={ci}>{ch}</span>;
                                        const q  = showQalqala && isQalqala(arr2,ci);
                                        const mt = showMadd ? getMaddType(arr2,ci) : null;
                                        const iz = showIzhar && isIzhar(arr2,ci);
                                        const id = showIdgham && isIdgham(arr2,ci);
                                        return q               ? <span key={ci} style={{color:"#5bc8f5",textShadow:"0 0 6px rgba(91,200,245,.5)"}}>{ch}</span>
                                             : mt==="muttasil" ? <span key={ci} style={{color:"#ff7eb3",textShadow:"0 0 8px rgba(255,126,179,.6)",fontWeight:600}}>{ch}</span>
                                             : mt==="normal"   ? <span key={ci} style={{color:"#f09de0",textShadow:"0 0 6px rgba(240,157,224,.5)"}}>{ch}</span>
                                             : iz              ? <span key={ci} style={{color:"#4caf81",textShadow:"0 0 6px rgba(76,175,129,.5)"}}>{ch}</span>
                                             : id              ? <span key={ci} style={{color:"#ffd166",textShadow:"0 0 6px rgba(255,209,102,.5)"}}>{ch}</span>
                                             : <span key={ci}>{ch}</span>;
                                      };
                                      return (
                                        <span key={wii} style={{
                                          color:wColor, textShadow:wShadow,
                                          textDecoration:wDecor,
                                          background: wBg,
                                          borderRadius: (isUnk||isHl||isRevW)?3:0,
                                          padding: (isUnk||isHl||isRevW)?"0 1px":0,
                                          borderBottom: isRevW&&!wRevChars?.length ? '2px solid rgba(201,168,76,.5)' : 'none',
                                        }}>
                                          {(showQalqala||showMadd||showIzhar||showIdgham)
                                            ? (() => { const arr2=[...w]; return arr2.map((ch,ci)=>renderCh(ch,ci,arr2)); })()
                                            : w}
                                          {wii < seg.words.length-1 ? " " : ""}
                                        </span>
                                      );
                                    })}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        }

                        // Build highlight index set from ld.highlight
                        const hlIndices  = (() => {
                          const set = new Set();
                          if (!ld.highlight?.trim()) return set;
                          ld.highlight.trim().split(/\s+/).forEach(hw => {
                            const norm = normalizeAr(hw);
                            ayatWords.forEach((aw, i) => { if (normalizeAr(aw) === norm) set.add(i); });
                          });
                          return set;
                        })();
                        const unkIndices = new Set(ld?.unknownWords || []);
                        const hasRevise  = !!_reviseData;
                        const hasAnnotations = (ld.highlight?.trim() && hlIndices.size > 0) || unkIndices.size > 0 || hasRevise;

                        if (hasAnnotations) {
                          return (
                            <div className="ayat-arabic">
                              {ayatWords.map((w, wi) => {
                                const hit = hlIndices.has(wi);
                                const unk = unkIndices.has(wi);
                                const isRevWord = revWordSet === 'all' || (revWordSet && revWordSet.has(wi));
                                const wordChars = isRevWord ? revChars[wi] : null; // selected char indices
                                const clusters  = isRevWord ? splitArabicClusters(w) : null;

                                const baseStyle = {
                                  color: unk ? '#ff7eb3' : hit ? '#ffd166' : isRevWord ? 'var(--text1)' : undefined,
                                  textShadow: unk ? '0 0 8px rgba(255,126,179,.5)' : hit ? '0 0 8px rgba(255,209,102,.6)' : 'none',
                                  background: unk ? 'rgba(255,126,179,.12)' : hit ? 'rgba(255,209,102,.13)' : isRevWord && !wordChars?.length ? 'rgba(201,168,76,.12)' : 'transparent',
                                  textDecoration: unk ? 'underline dotted #ff7eb3' : isRevWord && !wordChars?.length ? 'underline wavy var(--gold)' : 'none',
                                  borderRadius: (hit||unk||isRevWord) ? 4 : 0,
                                  padding: (hit||unk||isRevWord) ? '0 2px' : 0,
                                  border: isRevWord && !wordChars?.length ? '1px solid rgba(201,168,76,.35)' : 'none',
                                  display: 'inline',
                                };

                                if (isRevWord && wordChars?.length && clusters) {
                                  // Highlight whole word (Arabic shaping can't split mid-ligature)
                                  // show char selection as badge count
                                  return (
                                    <span key={wi} style={{
                                      display:'inline', padding:'0 2px',
                                      background:'rgba(91,200,245,.15)',
                                      borderBottom:'2px solid #5bc8f5',
                                      borderRadius:3,
                                      color:'#5bc8f5',
                                      textShadow:'0 0 6px rgba(91,200,245,.5)',
                                      position:'relative',
                                    }}>
                                      {w}
                                      <sup style={{ fontSize:'0.4em', color:'#5bc8f5', marginRight:1, verticalAlign:'super' }}>{wordChars.length}</sup>
                                      {wi < ayatWords.length - 1 ? ' ' : ''}
                                    </span>
                                  );
                                }

                                return (
                                  <span key={wi} style={baseStyle}>
                                    {w}{wi < ayatWords.length - 1 ? ' ' : ''}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        }

                        return (
                          <div className="ayat-arabic">
                            {(showQalqala || showMadd)
                              ? (() => { const arr = [...ayat.text]; return arr.map((ch, i) => {
                                  const q = showQalqala && isQalqala(arr, i);
                                  const mt = showMadd ? getMaddType(arr, i) : null;
                                  const iz = showIzhar && isIzhar(arr, i);
                                  const id = showIdgham && isIdgham(arr, i);
                                  return q ? <span key={i} style={{color:'#5bc8f5',textShadow:'0 0 6px rgba(91,200,245,.5)'}}>{ch}</span>
                                       : mt==='muttasil' ? <span key={i} style={{color:'#ff7eb3',textShadow:'0 0 8px rgba(255,126,179,.6)',fontWeight:600}}>{ch}</span>
                                       : mt==='normal'   ? <span key={i} style={{color:'#f09de0',textShadow:'0 0 6px rgba(240,157,224,.5)'}}>{ch}</span>
                                       : iz              ? <span key={i} style={{color:'#4caf81',textShadow:'0 0 6px rgba(76,175,129,.5)'}}>{ch}</span>
                                       : id              ? <span key={i} style={{color:'#ffd166',textShadow:'0 0 6px rgba(255,209,102,.5)'}}>{ch}</span>
                                       : <span key={i}>{ch}</span>;
                                }); })()
                              : ayat.text}
                          </div>
                        );
                      };

                      return (
                        <div key={ayat.number}
                          className={`ayat-row${isPlaying ? " playing" : ""}${isCurrent ? " current" : ""}${ld.learned ? " learned" : ""}${isSelecting ? " selecting" : ""}${isPageStart ? " page-start" : ""}${isPageEnd ? " page-end" : ""}`}
                          style={inLoop && !isPlaying && !isSelecting ? { borderLeft: "2px solid var(--teal)", background: "rgba(62,184,160,0.04)" } : isSelecting ? { borderLeft: "2px solid var(--gold)", background: "rgba(201,168,76,0.04)" } : {}}
                          ref={el => ayatRefs.current[ayat.numberInSurah] = el}>

                          {isPageStart && <div className="page-edge-pill start">â—† PAGE {ayat.page}</div>}

                          {/* Selection hint bar shown above the ayat when selecting */}
                          {isSelecting && (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 22px 2px", background: "rgba(201,168,76,.05)" }}>
                              <span style={{ fontSize: 9, letterSpacing: 1.5, color: partSelectStep === 'start' ? "var(--gold2)" : "var(--teal2)", fontFamily: "'Cinzel',serif" }}>
                                {partSelectStep === 'start' ? "â‘  CLIQUEZ LE PREMIER MOT" : `â‘¡ CLIQUEZ LE DERNIER MOT â€” dÃ©but : `}
                                {partSelectStep === 'end' && partSelectStart !== null && (
                                  <span style={{ fontFamily: "'Amiri Quran',serif", fontSize: 15, color: "var(--gold2)", marginRight: 4 }}>{ayatWords[partSelectStart]}</span>
                                )}
                              </span>
                              <button onClick={e => { e.stopPropagation(); setPartSelectAyat(null); setPartSelectStep(null); setPartSelectStart(null); }}
                                style={{ marginLeft: "auto", fontSize: 9, letterSpacing: 1, padding: "3px 8px", border: "1px solid var(--border2)", background: "transparent", color: "var(--text3)", cursor: "pointer", borderRadius: 4, fontFamily: "'Cinzel',serif" }}>
                                ANNULER
                              </button>
                            </div>
                          )}

                          <div className={`ayat-main${isPlaying ? " ayat-playing" : ""}`}
                            onClick={() => {
                              if (isSelecting) return; // don't open/close while selecting
                              setOpenAyatNum(isOpen ? null : ayat.numberInSurah);
                              if (isOpen) setAideMemoireClickModes(prev => { const n={...prev}; delete n[ayat.numberInSurah]; return n; });
                              if (!isOpen) setSubmenuMode("lecture");
                            }}>
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, flexShrink:0 }}>
                              <div className="ayat-number-badge"
                                title="Ouvrir le verset"
                                style={{cursor:'pointer'}}
                              >{ayat.numberInSurah}</div>
                              <button
                                title="Lire depuis ce verset"
                                onClick={e => {
                                  e.stopPropagation();
                                  const idx = ayats.findIndex(a => a.numberInSurah === ayat.numberInSurah);
                                  if (idx >= 0) { playMainAyat(idx); setIsMainPlaying(true); }
                                }}
                                style={{
                                  width:22, height:22, borderRadius:"50%", border:"none",
                                  background: isPlaying ? "var(--teal)" : "rgba(62,184,160,.15)",
                                  color: isPlaying ? "#fff" : "var(--teal2)",
                                  fontSize:9, cursor:"pointer", display:"flex", alignItems:"center",
                                  justifyContent:"center", flexShrink:0, transition:"all .15s",
                                  outline: isPlaying ? "2px solid var(--teal)" : "none",
                                  outlineOffset:2,
                                }}>â–¶</button>
                            </div>
                            {renderAyatText()}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                              {ld.learned && <div className="ayat-learned-badge">âœ“ APPRIS</div>}
                              {ld.toRevise && <div style={{ fontSize:7, letterSpacing:1, padding:'2px 6px', borderRadius:8, border:'1px solid var(--gold)', color:'var(--gold2)', fontFamily:"'Cinzel',serif" }}>ğŸ”– RÃ‰VISER</div>}
                              {(() => { const m = masteryMap[lkey(selectedSurah.number, ayat.numberInSurah)] ?? 0; return m > 0 ? <div style={{ fontSize:8, letterSpacing:1, padding:'2px 7px', borderRadius:10, border:'1px solid '+masteryColor(m), color:masteryColor(m), fontFamily:"'Cinzel',serif" }}>{m}%</div> : null; })()}
                              {ts && <div className="ts-status loaded">âš¡ TS</div>}
                            </div>
                          </div>

                          {/* Translation â€” full-width block below Arabic */}
                          {translationLang && (() => {
                            const key = `${translationLang}:${selectedSurah.number}`;
                            const tList = translations[key];
                            const tText = tList?.find(t => t.numberInSurah === ayat.numberInSurah)?.text;
                            return tText ? (
                              <div style={{
                                padding: '4px 14px 8px 54px',
                                borderTop: '1px solid rgba(91,200,245,.08)',
                                background: 'rgba(91,200,245,.03)',
                                direction: translationLang === 'ur' ? 'rtl' : 'ltr',
                              }}>
                                <div style={{
                                  fontSize: 11,
                                  color: 'rgba(91,200,245,.6)',
                                  fontStyle: 'italic',
                                  lineHeight: 1.65,
                                  letterSpacing: .2,
                                }}>
                                  {tText}
                                </div>
                              </div>
                            ) : null;
                          })()}

                          <AnimatedSubmenu isOpen={isOpen}>
                            <Submenu
                              ayat={ayat} surahNum={selectedSurah.number}
                              ld={ld} setLData={setLData}
                              submenuMode={submenuMode} setSubmenuMode={setSubmenuMode}
                              audioUrl={audioUrl(ayat)}
                              isMainPlaying={isMainPlaying}
                              timestamps={ts}
                              partSelectAyat={partSelectAyat} partSelectStep={partSelectStep}
                              onStartPartCreate={() => {
                                setPartSelectAyat(ayat.numberInSurah);
                                setPartSelectStep('start');
                                setPartSelectStart(null);
                              }}
                              collections={collections}
                              ayatInCollections={ayatInCollections(selectedSurah.number, ayat.numberInSurah)}
                              onOpenCollModal={() => setCollModal({ surahNum: selectedSurah.number, surahEn: selectedSurah.englishName, ayatNum: ayat.numberInSurah, text: ayat.text, number: ayat.number })}
                              onLoadTimestamps={data => {
                                const parsed = parseTimestampsFile(data, selectedSurah.number, recitatorId);
                                if (Object.keys(parsed).length === 0 && data.words)
                                  setTimestampsMap({ ...timestampsMap, [tskey(selectedSurah.number, ayat.numberInSurah)]: { words: data.words } });
                                else setTimestampsMap({ ...timestampsMap, ...parsed });
                              }}
                              onUpdateTimestamps={data => {
                                setTimestampsMap({ ...timestampsMap, [tskey(selectedSurah.number, ayat.numberInSurah)]: data });
                              }}
                              onLocalPlay={(ms) => setLocalPlaying(ms != null ? { ayatNum: ayat.numberInSurah, currentMs: ms } : null)}
                              aideMemoireClickMode={aideMemoireClickModes[ayat.numberInSurah]||null}
                              setAideMemoireClickMode={(m)=>setAideMemoireClickModes(prev=>({...prev,[ayat.numberInSurah]:m}))}
                              spellCheck={spellCheck}
                              ayatLoopActive={loopActive && loopStartNum === ayat.numberInSurah && loopEndNum === ayat.numberInSurah}
                              onSetLoop={() => {
                                const idx = ayats.findIndex(a => a.numberInSurah === ayat.numberInSurah);
                                if (idx === -1) return;
                                setLoopStart(idx); setLoopEnd(idx);
                                setLoopStartInput(ayat.numberInSurah); setLoopEndInput(ayat.numberInSurah);
                                setLoopActive(true);
                              }}
                            />
                          </AnimatedSubmenu>
                          {isPageEnd && <div className="page-edge-pill end">FIN Â· PAGE {ayat.page} â—†</div>}
                        </div>
                      );
                    }); })()}</>}
                </div>
              </>
            )}
          </main></AnimatedPage>
            )} />
            <Route path="*" element={<Navigate to="/quran" replace />} />
          </Routes>
        </div>

        {/* CONTEXT MENU â€” apparaÃ®t sur clic droit / appui long avec une sÃ©lection de texte dans un ayat */}
        {selMenu && (
          <>
            <div onClick={() => setSelMenu(null)} onContextMenu={e => { e.preventDefault(); setSelMenu(null); }}
              style={{ position:"fixed", inset:0, zIndex:998 }} />
            <div style={{
              position:"fixed", top:selMenu.y, left:selMenu.x, zIndex:999,
              background:"var(--surface2)", border:"1px solid #c878ff", borderRadius:8,
              boxShadow:"0 6px 20px rgba(0,0,0,.4)", overflow:"hidden", minWidth:200,
              transform:"translate(4px,4px)",
            }}>
              <button onClick={searchSelectionInCollections} style={{
                display:"flex", alignItems:"center", gap:8, width:"100%", padding:"10px 14px",
                background:"transparent", border:"none", color:"var(--text)", fontSize:11,
                letterSpacing:.5, cursor:"pointer", textAlign:"left",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(200,120,255,.12)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                ğŸ” Rechercher la sÃ©lection
              </button>
              <div style={{ padding:"0 14px 8px", fontSize:9, color:"var(--text3)",
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:260, direction:"rtl" }}>
                {selMenu.text}
              </div>
            </div>
          </>
        )}

        {/* COLLECTION MODAL */}
        {showOptionsModal && <OptionsModal onClose={() => setShowOptionsModal(false)} />}
        {collModal && (
          <CollectionModal
            ayat={collModal}
            collections={collections}
            onToggle={toggleAyatInCollection}
            onCreateAndAdd={(name) => {
              dispatch(collectionsActions.createCollectionWithAyat({ name, ayatEntry: collModal }));
            }}
            onClose={() => setCollModal(null)}
          />
        )}

        {/* RAPPEL WIDGET GLOBAL */}
        <div style={{ display: showRappel ? 'block' : 'none' }}>
          <RappelWidget onClose={() => setShowRappel(false)} />
        </div>

        {/* AUDIO PERSISTANTS â€” toujours montÃ©s pour ne jamais interrompre la lecture en changeant de page */}
        <audio ref={silentAudioRef} src={SILENT_WAV} loop style={{ display:"none" }} />
        <audio
          ref={el => {
            mainAudioRef.current = el;
            if (el) el._ayatNum = currentMainAyat?.numberInSurah;
          }}
          src={audioUrl(currentMainAyat)}
          onEnded={handleMainEnded}
          onError={() => {
            // Current bitrate 404s for this reciter â†’ fall back to the next candidate
            // automatically (and remember it), then retry without interrupting playback.
            const next = markBitrateBad(recitatorId);
            if (next != null) {
              setBitrateVersion(v => v + 1);
              loadedAyatIdxRef.current = null;
              // wait one frame so React commits the new `src` (now built from the updated
              // bitrate) before forcing the element to actually load it
              requestAnimationFrame(() => {
                const a = mainAudioRef.current;
                if (!a) return;
                a.load();
                loadedAyatIdxRef.current = mainAyatIdx;
                if (isMainPlaying) playWhenReady();
              });
            }
          }}
          style={{ display: "none" }}
        />

        {/* MAIN PLAYER */}
        {selectedSurah && ayats.length > 0 && (
          <div className="main-player">

            <div className="player-row">
              <div className="player-info">
                <div className="player-surah">{selectedSurah.englishName.toUpperCase()}</div>
                <div className="player-ayah">
                  AYAT {currentMainAyat?.numberInSurah || 1} / {ayats.length}
                  {loopActive && <span style={{ color: "var(--teal)", marginLeft: 8 }}>
                    â†º {loopStartNum}â€“{loopEndNum}
                    {loopMax > 0 && <span style={{ color: "var(--text3)" }}> Â· {loopCount + 1}/{loopMax}</span>}
                  </span>}
                </div>
              </div>

              <div className="player-controls">
                <button className="ctrl-btn" title="Premier verset" onClick={() => {
                  playMainAyat(loopActive ? loopStart : 0); if (isMainPlaying) setTimeout(() => mainAudioRef.current?.play(), 100);
                }} style={{ fontSize: 11 }}>â®</button>
                <button className="ctrl-btn" onClick={() => {
                  const i = Math.max(loopActive ? loopStart : 0, mainAyatIdx - 1);
                  playMainAyat(i); if (isMainPlaying) setTimeout(() => mainAudioRef.current?.play(), 100);
                }}>â—€</button>
                <button className="ctrl-btn play-btn" onClick={() => {
                  if (!isMainPlaying) { playMainAyat(loopActive ? loopStart : mainAyatIdx); setIsMainPlaying(true); }
                  else { setIsMainPlaying(false); setPlayingAyatNum(null); mainAudioRef.current?.pause(); }
                }}>{isMainPlaying ? "â¸" : "â–¶"}</button>
                <button className="ctrl-btn" onClick={() => {
                  const i = Math.min(loopActive ? loopEnd : ayats.length - 1, mainAyatIdx + 1);
                  playMainAyat(i); if (isMainPlaying) setTimeout(() => mainAudioRef.current?.play(), 100);
                }}>â–¶</button>
                <button
                  className={`ctrl-btn${loopActive ? " loop-on" : ""}`}
                  title="Activer/dÃ©sactiver la boucle"
                  onClick={() => { setLoopActive(!loopActive); if (!loopActive) setLoopCount(0); }}
                  style={{ fontSize: 12 }}>â†º</button>
                <button
                  className={`ctrl-btn${showLoopBar ? " loop-on" : ""}`}
                  title="Configurer le range de boucle"
                  onClick={() => setShowLoopBar(!showLoopBar)}
                  style={{ fontSize: 11 }}>âš™</button>
                {/* Voice mic shortcut */}
                <button
                  className={`ctrl-btn${listening ? " loop-on" : ""}`}
                  title="Commande vocale"
                  onClick={toggleVoice}
                  style={{ fontSize: 14 }}>ğŸ¤</button>
                {/* Reciter picker */}
                <button
                  className={`ctrl-btn reciter-trigger${showRecitPanel ? " loop-on" : ""}`}
                  aria-haspopup="dialog"
                  aria-expanded={showRecitPanel}
                  aria-label={`Choisir le rÃ©citateur. Actuel : ${activeRecitator?.label || recitatorId}`}
                  title={`RÃ©citateur : ${activeRecitator?.label || recitatorId}`}
                  onClick={() => { setRecitatorSearch(""); setShowRecitPanel(v => !v); }}>
                  <span>{activeRecitator?.flag || 'ğŸ™ï¸'}</span>
                  <span className="reciter-trigger-label">{activeRecitator?.label || 'RÃ©citateur'}</span>
                </button>
              </div>

              {showRecitPanel && createPortal(
                <>
                  <div className="reciter-sheet-backdrop" onClick={() => setShowRecitPanel(false)} aria-hidden="true" />
                  <section className="reciter-sheet" role="dialog" aria-modal="true" aria-labelledby="reciter-sheet-title">
                    <div className="reciter-sheet-header">
                      <div style={{ minWidth:0 }}>
                        <div id="reciter-sheet-title" className="reciter-sheet-title">CHOISIR UN RÃ‰CITATEUR</div>
                        <div className="reciter-sheet-current">Actuel Â· {activeRecitator?.label || recitatorId}</div>
                      </div>
                      <button className="reciter-sheet-close" onClick={() => setShowRecitPanel(false)} aria-label="Fermer le choix du rÃ©citateur">Ã—</button>
                    </div>
                    <input className="reciter-search" type="search" autoFocus value={recitatorSearch}
                      onChange={e => setRecitatorSearch(e.target.value)} placeholder="Rechercher un rÃ©citateur" aria-label="Rechercher un rÃ©citateur" />
                    <div className="reciter-list">
                      {visibleRecitators.map(r => (
                        <button key={r.id} className={`reciter-option${r.id === recitatorId ? ' selected' : ''}`} onClick={() => {
                          const changed = r.id !== recitatorId;
                          setRecitatorId(r.id);
                          setShowRecitPanel(false);
                          if (changed && mainAudioRef.current) {
                            loadedAyatIdxRef.current = null;
                            if (isMainPlaying) {
                              mainAudioRef.current.load();
                              mainAudioRef.current.play().catch(() => {});
                              loadedAyatIdxRef.current = mainAyatIdx;
                            }
                          }
                        }}>
                          <span className="reciter-option-flag">{r.flag}</span>
                          <span className="reciter-option-name">{r.label}</span>
                          {r.id === recitatorId && <span className="reciter-option-check" aria-label="SÃ©lectionnÃ©">âœ“</span>}
                        </button>
                      ))}
                      {visibleRecitators.length === 0 && <div className="reciter-empty">Aucun rÃ©citateur ne correspond Ã  cette recherche.</div>}
                    </div>
                    <div className="reciter-sheet-footer">
                      <span>DÃ©bit audio Â· {bitrate} kbps</span>
                      <button className="reciter-reset" onClick={() => {
                        setReciterBitrate(recitatorId, bitrateOrderFor(recitatorId)[0]);
                        setBitrateVersion(v => v + 1);
                        loadedAyatIdxRef.current = null;
                        if (mainAudioRef.current) {
                          mainAudioRef.current.load();
                          loadedAyatIdxRef.current = mainAyatIdx;
                          if (isMainPlaying) playWhenReady();
                        }
                      }}>RÃ©initialiser le dÃ©bit</button>
                    </div>
                  </section>
                </>,
                document.body
              )}

              {(() => {
                const sn = selectedSurah.number;
                const ayatDurations = ayats.map(a => {
                  const ts = timestampsMap[tskey(sn, a.numberInSurah)];
                  if (!ts?.words?.length) return 0;
                  const allChars = ts.words.flatMap(w => w.chars || []);
                  const first = allChars[0], last = allChars[allChars.length - 1];
                  if (!first || !last) return 0;
                  return Math.max(0, (last.end || 0) - (first.start || 0));
                });
                const totalMs = ayatDurations.reduce((s, d) => s + d, 0);
                const fmt = ms => { const s = Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

                if (totalMs <= 0) return (
                  <div className="player-progress">
                    <div className="progress-bar-wrap">
                      {loopActive && ayats.length > 1 && (
                        <div className="progress-range" style={{ left:`${(loopStart/ayats.length)*100}%`, width:`${((Math.min(loopEnd,ayats.length-1)-loopStart+1)/ayats.length)*100}%` }} />
                      )}
                      <div className="progress-bar-fill" style={{ width:`${((mainAyatIdx+1)/ayats.length)*100}%` }} />
                    </div>
                    <span className="progress-text">{mainAyatIdx+1}/{ayats.length}</span>
                  </div>
                );

                const prevMs = ayatDurations.slice(0, mainAyatIdx).reduce((s, d) => s + d, 0);
                const ts = timestampsMap[tskey(sn, currentMainAyat?.numberInSurah)];
                const ayatStartMs = ts?.words?.[0]?.chars?.[0]?.start ?? 0;
                const curMs = Math.max(0, prevMs + (mainCurrentMsRef.current - ayatStartMs));
                const pct = Math.min(100, (curMs / totalMs) * 100);

                // Loop range overlay
                const loopStartMs = ayatDurations.slice(0, loopStart).reduce((s,d)=>s+d,0);
                const loopEndMs   = ayatDurations.slice(0, Math.min(loopEnd,ayats.length-1)+1).reduce((s,d)=>s+d,0);

                return (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'2px 0', width:'100%' }}>
                    <span style={{ fontSize:9, color:'var(--text3)', fontFamily:"'Cinzel',serif", letterSpacing:1, flexShrink:0 }}>{fmt(curMs)}</span>
                    <div style={{ flex:1, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden', cursor:'pointer', position:'relative' }}
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const targetMs = (e.clientX - rect.left) / rect.width * totalMs;
                        let acc = 0;
                        for (let i = 0; i < ayats.length; i++) {
                          if (acc + ayatDurations[i] >= targetMs || i === ayats.length - 1) {
                            playMainAyat(i);
                            const tsA = timestampsMap[tskey(sn, ayats[i].numberInSurah)];
                            const aStart = tsA?.words?.[0]?.chars?.[0]?.start ?? 0;
                            setTimeout(() => {
                              if (mainAudioRef.current) {
                                mainAudioRef.current.currentTime = aStart/1000 + (targetMs-acc)/1000;
                                if (isMainPlaying) mainAudioRef.current.play().catch(()=>{});
                              }
                            }, 80);
                            break;
                          }
                          acc += ayatDurations[i];
                        }
                      }}>
                      {loopActive && <div style={{ position:'absolute', left:`${(loopStartMs/totalMs)*100}%`, width:`${((loopEndMs-loopStartMs)/totalMs)*100}%`, height:'100%', background:'rgba(62,184,160,.25)' }} />}
                      <div style={{ height:'100%', width:`${pct}%`, background:'var(--gold)', borderRadius:2, transition:'width .1s linear' }} />
                    </div>
                    <span style={{ fontSize:9, color:'var(--text3)', fontFamily:"'Cinzel',serif", letterSpacing:1, flexShrink:0 }}>{fmt(totalMs)}</span>
                  </div>
                );
              })()}
            </div>

            {/* LOOP CONFIG BAR */}
            {showLoopBar && (
              <div className="loop-bar">
                <span className="loop-label">BOUCLE</span>
                <div className="loop-inputs">
                  <span className="loop-rep-label">DE</span>
                  <input className="loop-input" value={loopStartInput}
                    onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) setLoopStartInput(n); }}
                    onBlur={applyLoopInputs}
                    onKeyDown={e => e.key === 'Enter' && applyLoopInputs()}
                    placeholder="1" />
                  <span className="loop-sep">â†’</span>
                  <input className="loop-input" value={loopEndInput}
                    onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) setLoopEndInput(n); }}
                    onBlur={applyLoopInputs}
                    onKeyDown={e => e.key === 'Enter' && applyLoopInputs()}
                    placeholder={ayats.length} />
                  <button className="btn-small" onClick={() => {
                    applyLoopInputs(); setLoopActive(true); setLoopCount(0);
                    playMainAyat(ayats.findIndex(a => a.numberInSurah === ((typeof loopStartInput === "number" ? loopStartInput : parseInt(loopStartInput)) || 1)));
                    setIsMainPlaying(true);
                  }}>â–¶ GO</button>
                </div>

                <div className="loop-rep-wrap">
                  <span className="loop-rep-label">RÃ‰PÃ‰TER</span>
                  <div className="loop-rep-btns">
                    {[0, 2, 3, 5, 10].map(n => (
                      <button key={n} className={`loop-rep-btn${loopMax === n ? ' sel' : ''}`}
                        onClick={() => { setLoopMax(n); setLoopCount(0); }}>
                        {n === 0 ? 'âˆ' : `Ã—${n}`}
                      </button>
                    ))}
                  </div>
                </div>

                {loopActive && (
                  <div className="loop-count-badge">
                    CYCLE <span>{loopCount + 1}{loopMax > 0 ? `/${loopMax}` : ''}</span>
                  </div>
                )}

                <button className="btn-small" style={{ marginLeft: "auto" }}
                  onClick={() => { setLoopActive(false); setLoopCount(0); setShowLoopBar(false); }}>
                  âœ• DÃ‰SACTIVER
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <ArabicKeyboard
        show={showArabicKeyboard}
        onClose={() => { setShowArabicKeyboard(false); try { localStorage.setItem('quran_arabic_keyboard', '0'); } catch {} }}
      />
    </>
    </ArabicKeyboardContext.Provider>
  );
}

// â”€â”€â”€ LearningMapPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Visual heatmap of Quran learning progress: all 114 surahs, per-ayat coloring
function LearningMapPage({ surahs, learnData, onNavigate }) {
  const [selectedSns, setSelectedSns] = React.useState(new Set()); // selected surahs
  const [view, setView] = React.useState("surahs"); // "surahs" | "detail"
  const [hoveredSn, setHoveredSn] = React.useState(null);
  const [pageData, setPageData] = React.useState({}); // sn -> [{numberInSurah, page}]

  // Compute per-surah stats
  const surahStats = React.useMemo(() => {
    return surahs.map(s => {
      const total = s.numberOfAyahs;
      const learned = Object.keys(learnData).filter(k => {
        const [sn] = k.split(':').map(Number);
        return sn === s.number && learnData[k]?.learned;
      }).length;
      const perfect = Object.keys(learnData).filter(k => {
        const [sn] = k.split(':').map(Number);
        if (sn !== s.number || !learnData[k]?.learned) return false;
        const attempts = learnData[k]?.writingAttempts || [];
        return attempts.some(a => a.score === 100);
      }).length;
      const questioned = Object.keys(learnData).filter(k => {
        const [sn] = k.split(':').map(Number);
        return sn === s.number && learnData[k]?.questionScores && Object.keys(learnData[k].questionScores).length > 0;
      }).length;
      return { sn: s.number, name: s.name, ename: s.englishName, total, learned, perfect, questioned };
    });
  }, [surahs, learnData]);

  const toggleSn = (sn) => setSelectedSns(prev => {
    const next = new Set(prev);
    if (next.has(sn)) next.delete(sn); else next.add(sn);
    return next;
  });

  // Fetch page mapping when a surah is expanded
  const ensurePageData = React.useCallback((sn) => {
    if (pageData[sn]) return;
    fetchSurahDefault(sn).then(ayahs => {
      setPageData(p => ({ ...p, [sn]: ayahs.map(a => ({ numberInSurah: a.numberInSurah, page: a.page })) }));
    }).catch(() => {});
  }, [pageData]);

  const selectAll = () => setSelectedSns(new Set(surahs.map(s => s.number)));
  const clearAll  = () => setSelectedSns(new Set());

  const totalLearned   = surahStats.reduce((a, s) => a + s.learned, 0);
  const totalAyat      = surahStats.reduce((a, s) => a + s.total, 0);
  const totalPerfect   = surahStats.reduce((a, s) => a + s.perfect, 0);
  const totalQuestion  = surahStats.reduce((a, s) => a + s.questioned, 0);

  const selStats = selectedSns.size > 0
    ? surahStats.filter(s => selectedSns.has(s.sn))
    : null;

  const getAyatColor = (sn, an) => {
    const ld = learnData[`${sn}:${an}`];
    if (!ld?.learned) return { bg: 'var(--surface3)', border: 'var(--border)' };
    const attempts = ld.writingAttempts || [];
    const best = attempts.length ? Math.max(...attempts.map(a => a.score)) : 0;
    const qs = ld.questionScores || {};
    const qKeys = Object.keys(qs);
    const allQCorrect = qKeys.length > 0 && qKeys.every(k => { const arr = qs[k]; return arr[arr.length-1] === 1; });
    if (best === 100 && allQCorrect) return { bg: 'rgba(201,168,76,.4)',  border: 'var(--gold)' };
    if (best === 100)                return { bg: 'rgba(76,175,129,.35)', border: 'var(--green)' };
    if (best >= 70)                  return { bg: 'rgba(62,184,160,.25)', border: 'var(--teal)' };
    if (best > 0)                    return { bg: 'rgba(229,115,115,.2)', border: 'var(--red)' };
    return { bg: 'rgba(255,255,255,.05)', border: 'var(--border2)' };
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, padding:'12px 0' }}>
      {/* Global stats */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {[
          { label:'TOTAL CORAN', val:totalAyat, color:'var(--text3)' },
          { label:'APPRIS',      val:totalLearned,  color:'var(--teal2)' },
          { label:'PARFAITS',    val:totalPerfect,  color:'var(--green)' },
          { label:'QUESTIONS',   val:totalQuestion, color:'var(--gold)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ flex:1, minWidth:70, padding:'8px 10px', borderRadius:8,
            background:'var(--surface2)', border:'1px solid var(--border)', textAlign:'center' }}>
            <div style={{ fontSize:14, fontFamily:"'Cinzel',serif", color, fontWeight:600 }}>{val}</div>
            <div style={{ fontSize:7, letterSpacing:1.5, color:'var(--text3)', marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar overall */}
      <div style={{ height:6, borderRadius:3, background:'var(--surface3)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${totalAyat ? (totalLearned/totalAyat*100) : 0}%`,
          background:'linear-gradient(90deg,var(--teal),var(--green))', borderRadius:3, transition:'width .5s' }} />
      </div>

      {/* Selection controls */}
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
          {selectedSns.size > 0 ? `${selectedSns.size} SOURATE${selectedSns.size>1?'S':''} SÃ‰LECTIONNÃ‰E${selectedSns.size>1?'S':''}` : 'CLIQUER POUR SÃ‰LECTIONNER'}
        </div>
        <button onClick={selectAll} style={{ fontSize:7, letterSpacing:1, padding:'2px 8px', borderRadius:10,
          border:'1px solid var(--teal)', background:'rgba(62,184,160,.08)', color:'var(--teal)',
          fontFamily:"'Cinzel',serif", cursor:'pointer' }}>TOUT</button>
        {selectedSns.size > 0 && <button onClick={clearAll} style={{ fontSize:7, letterSpacing:1, padding:'2px 8px', borderRadius:10,
          border:'1px solid var(--border2)', background:'transparent', color:'var(--text3)',
          fontFamily:"'Cinzel',serif", cursor:'pointer' }}>EFFACER</button>}
      </div>

      {/* Surah grid */}
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {surahStats.map(({ sn, name, ename, total, learned, perfect }) => {
          const pct = total ? learned / total : 0;
          const pctP = total ? perfect / total : 0;
          const selected = selectedSns.has(sn);
          const hovered  = hoveredSn === sn;
          const si = surahs.find(s => s.number === sn);
          const ayahs = si ? Array.from({ length: si.numberOfAyahs }, (_, i) => i + 1) : [];

          return (
            <div key={sn}
              style={{ borderRadius:9, border:`1px solid ${selected ? 'var(--teal)' : 'var(--border)'}`,
                background: selected ? 'rgba(62,184,160,.04)' : 'var(--surface2)', overflow:'hidden',
                transition:'border-color .15s' }}>
              {/* Surah header row */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer' }}
                onClick={() => { toggleSn(sn); ensurePageData(sn); }}
                onMouseEnter={() => { setHoveredSn(sn); ensurePageData(sn); }}
                onMouseLeave={() => setHoveredSn(null)}>
                <div style={{ width:16, height:16, borderRadius:4, flexShrink:0, transition:'all .15s',
                  background: selected ? 'var(--teal)' : 'transparent',
                  border:`1px solid ${selected ? 'var(--teal)' : 'var(--border2)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, color:'var(--surface)' }}>{selected ? 'âœ“' : ''}</div>
                <div style={{ fontSize:8, color:'var(--text3)', fontFamily:"'Cinzel',serif", letterSpacing:1, width:18, flexShrink:0 }}>{sn}</div>
                <div style={{ flex:1 }}>
                  {/* Mini progress bar */}
                  <div style={{ height:4, borderRadius:2, background:'var(--surface3)', overflow:'hidden', marginBottom:2 }}>
                    <div style={{ height:'100%', width:`${pct*100}%`, borderRadius:2,
                      background: pct === 1 ? 'var(--gold)' : 'var(--teal)', transition:'width .3s' }} />
                  </div>
                  {pctP > 0 && <div style={{ height:2, borderRadius:1, background:'var(--surface3)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pctP*100}%`, borderRadius:1, background:'var(--green)' }} />
                  </div>}
                </div>
                <div style={{ fontSize:8, color: learned > 0 ? 'var(--teal2)' : 'var(--text3)',
                  fontFamily:"'Cinzel',serif", letterSpacing:.5, minWidth:40, textAlign:'right' }}>
                  {learned}/{total}
                </div>
                <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:16, color:'var(--gold)', direction:'rtl' }}>{name}</div>
              </div>

              {/* Ayat heatmap â€” compact inline with page badges */}
              {(selected || hovered) && (() => {
                const pd = pageData[sn];
                // Build sorted flat list with page boundary markers
                const items = []; // {type:'badge'|'cell', page?, an?}
                if (pd && pd.length > 0) {
                  let lastPage = null;
                  pd.forEach(({ numberInSurah: an, page }) => {
                    if (page !== lastPage) { items.push({ type:'badge', page }); lastPage = page; }
                    items.push({ type:'cell', an });
                  });
                } else {
                  ayahs.forEach(an => items.push({ type:'cell', an }));
                }
                return (
                  <div style={{ borderTop:'1px solid var(--border)', padding:'8px 12px',
                    display:'flex', flexWrap:'wrap', gap:2, alignItems:'center' }}>
                    {items.map((item, i) => item.type === 'badge'
                      ? <span key={`p${item.page}-${i}`} style={{
                          fontSize:6, letterSpacing:1, color:'#c878ff',
                          fontFamily:"'Cinzel',serif", padding:'0 3px',
                          borderLeft: i > 0 ? '1px solid rgba(200,120,255,.2)' : 'none',
                          marginLeft: i > 0 ? 3 : 0, lineHeight:'18px',
                        }}>P{item.page}</span>
                      : (() => {
                          const { bg, border } = getAyatColor(sn, item.an);
                          return (
                            <div key={item.an}
                              title={`${ename} ${item.an}`}
                              onClick={e => { e.stopPropagation(); onNavigate?.('quran', sn, item.an); }}
                              style={{ width:18, height:18, borderRadius:3, cursor:'pointer',
                                background:bg, border:`1px solid ${border}`,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:6, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
                              {item.an}
                            </div>
                          );
                        })()
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', padding:'4px 0' }}>
        {[
          { bg:'rgba(201,168,76,.4)',  border:'var(--gold)',    label:'MaÃ®trisÃ© (Ã©crit + questions)' },
          { bg:'rgba(76,175,129,.35)',border:'var(--green)',   label:'Parfait (Ã©criture)' },
          { bg:'rgba(62,184,160,.25)',border:'var(--teal)',    label:'Bon (â‰¥70%)' },
          { bg:'rgba(229,115,115,.2)',border:'var(--red)',     label:'Ã€ revoir' },
          { bg:'rgba(255,255,255,.05)',border:'var(--border2)',label:'Non rÃ©visÃ©' },
          { bg:'var(--surface3)',     border:'var(--border)',  label:'Non appris' },
        ].map(({ bg, border, label }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:bg, border:`1px solid ${border}`, flexShrink:0 }} />
            <span style={{ fontSize:7, color:'var(--text3)', letterSpacing:.5 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Selected surahs actions */}
      {selectedSns.size > 0 && selStats && (
        <div style={{ padding:'14px', background:'var(--surface2)', border:'1px solid var(--teal)',
          borderRadius:10, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:8, letterSpacing:2, color:'var(--teal2)', fontFamily:"'Cinzel',serif" }}>
            SÃ‰LECTION â€” {selStats.reduce((a,s)=>a+s.learned,0)} ayats appris
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'var(--green)', fontFamily:"'Cinzel',serif" }}>{selStats.reduce((a,s)=>a+s.perfect,0)}</div>
              <div style={{ fontSize:7, color:'var(--text3)', letterSpacing:1 }}>PARFAITS</div>
            </div>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'var(--gold)', fontFamily:"'Cinzel',serif" }}>{selStats.reduce((a,s)=>a+s.questioned,0)}</div>
              <div style={{ fontSize:7, color:'var(--text3)', letterSpacing:1 }}>QUESTIONS</div>
            </div>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'var(--teal2)', fontFamily:"'Cinzel',serif" }}>
                {selStats.reduce((a,s)=>a+s.learned,0)}/{selStats.reduce((a,s)=>a+s.total,0)}
              </div>
              <div style={{ fontSize:7, color:'var(--text3)', letterSpacing:1 }}>APPRIS/TOTAL</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ RevisionPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Page dÃ©diÃ©e Ã  la rÃ©vision de tous les ayats marquÃ©s comme appris.
// Pour chaque ayat, on propose l'exercice d'Ã©criture (RevisionEcritureMode)
// directement sur cette page, sans ouvrir le submenu.
function RevisionPage({ learnData, surahs, setLData, onNavigate, initialFilter }) {
  const { surahNum: urlSn, rangeFrom: urlRf, rangeTo: urlRt, qIdx: urlQIdx } = useParams();
  const [filter, setFilter]         = useState(initialFilter || "carte"); // "carte" | "questions"
  const [openSurahs, setOpenSurahs] = useState({});    // surahNum â†’ bool
  const [openAyat,   setOpenAyat]   = useState(null);  // "surahNum:ayatNum" | null
  const [ayatTab,    setAyatTab]    = useState({});    // key -> "ecriture" | "tajweed"

  // â”€â”€ Data repair: close orphaned reviseHistory entries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Ayats where toRevise=false but reviseHistory still has an item with endDate
  // null (left open by a code path that cleared toRevise without closing it).
  useEffect(() => {
    const now = new Date().toISOString();
    Object.entries(learnData).forEach(([key, val]) => {
      if (val?.toRevise) return; // still active, nothing to fix
      const hist = val?.reviseHistory;
      if (!hist || hist.length === 0) return;
      const openIdx = hist.findIndex(e => !e.endDate);
      if (openIdx === -1) return;
      const [sn, an] = key.split(":").map(Number);
      setLData(sn, an, d => {
        const h = [...(d.reviseHistory || [])];
        const idx = h.findIndex(e => !e.endDate);
        if (idx === -1 || d.toRevise) return { ...d }; // already fixed / re-activated meanwhile â€” never return the frozen object as-is
        h[idx] = { ...h[idx], endDate: now };
        return { ...d, reviseHistory: h };
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Construire la liste des ayats appris groupÃ©s par sourate
  const learnedBySurah = useMemo(() => {
    const map = {};
    Object.entries(learnData).forEach(([key, val]) => {
      if (!val?.learned) return;
      const [sn, an] = key.split(":").map(Number);
      if (!map[sn]) map[sn] = [];
      map[sn].push({ surahNum: sn, ayatNum: an, ld: val });
    });
    // Sort by surah then ayat
    Object.values(map).forEach(arr => arr.sort((a, b) => a.ayatNum - b.ayatNum));
    return map;
  }, [learnData]);

  const surahNums = Object.keys(learnedBySurah).map(Number).sort((a, b) => a - b);

  // Stats globales
  const totalLearned = useMemo(() => Object.values(learnedBySurah).reduce((s, a) => s + a.length, 0), [learnedBySurah]);
  const totalPerfect = useMemo(() =>
    Object.values(learnedBySurah).flat().filter(({ ld }) => {
      const attempts = ld.writingAttempts || [];
      return attempts.some(a => a.score === 100);
    }).length,
  [learnedBySurah]);
  const totalNone = useMemo(() =>
    Object.values(learnedBySurah).flat().filter(({ ld }) => !(ld.writingAttempts?.length > 0)).length,
  [learnedBySurah]);
  const totalToRevise = useMemo(() =>
    Object.values(learnData).filter(ld => ld?.toRevise).length,
  [learnData]);

  // Filtrage par statut de rÃ©vision
  const getRevStatus = (ld) => {
    const attempts = ld.writingAttempts || [];
    if (attempts.length === 0) return "none";
    const best = Math.max(...attempts.map(a => a.score));
    if (best === 100) return "perfect";
    if (best >= 70)  return "good";
    return "bad";
  };

  const filteredBySurah = useMemo(() => {
    if (filter === "all") return learnedBySurah;
    if (filter === "toRevise") {
      // Include ALL ayats (learned or not) that have toRevise flag
      const out = {};
      Object.entries(learnData).forEach(([key, val]) => {
        if (!val?.toRevise) return;
        const [sn, an] = key.split(":").map(Number);
        if (!out[sn]) out[sn] = [];
        out[sn].push({ surahNum: sn, ayatNum: an, ld: val });
      });
      Object.values(out).forEach(arr => arr.sort((a, b) => a.ayatNum - b.ayatNum));
      return out;
    }
    const out = {};
    surahNums.forEach(sn => {
      const arr = (learnedBySurah[sn] || []).filter(({ ld }) => {
        const st = getRevStatus(ld);
        if (filter === "perfect") return st === "perfect";
        if (filter === "todo")    return st === "bad" || st === "good";
        if (filter === "none")    return st === "none";
        return true;
      });
      if (arr.length > 0) out[sn] = arr;
    });
    return out;
  }, [filter, learnedBySurah, surahNums, learnData]);

  const filteredSurahNums = Object.keys(filteredBySurah).map(Number).sort((a, b) => a - b);

  const toggleSurah = (sn) => setOpenSurahs(p => ({ ...p, [sn]: !p[sn] }));
  const toggleAyat  = (key) => setOpenAyat(p => p === key ? null : key);

  // RÃ©cupÃ©rer le texte de l'ayat depuis l'API (cache local)
  const [ayatTexts, setAyatTexts] = useState({}); // "sn:an" â†’ text
  useEffect(() => {
    const missing = [];
    filteredSurahNums.forEach(sn => {
      (filteredBySurah[sn] || []).forEach(({ ayatNum }) => {
        const k = `${sn}:${ayatNum}`;
        if (!ayatTexts[k]) missing.push({ sn, an: ayatNum, k });
      });
    });
    if (missing.length === 0) return;
    // Group by surah to batch
    const bySurah = {};
    missing.forEach(({ sn, an, k }) => { if (!bySurah[sn]) bySurah[sn] = []; bySurah[sn].push({ an, k }); });
    Object.entries(bySurah).forEach(([sn, items]) => {
      fetchSurahDefault(Number(sn))
        .then(ayahs => {
          if (!ayahs?.length) return;
          const newTexts = {};
          ayahs.forEach(a => {
            const k = `${sn}:${a.numberInSurah}`;
            newTexts[k] = a.text;
          });
          setAyatTexts(p => ({ ...p, ...newTexts }));
        })
        .catch(() => {});
    });
  }, [filteredSurahNums.join(",")]);

  // Faux objet ayat pour RevisionEcritureMode
  const makeAyat = (sn, an) => ({ numberInSurah: an, text: ayatTexts[`${sn}:${an}`] || "" });

  const statusColor = {
    perfect: "var(--green)",
    good:    "var(--gold)",
    bad:     "var(--red)",
    none:    "var(--border2)",
  };
  const statusLabel = {
    perfect: "âœ“ PARFAIT",
    good:    "~ BON",
    bad:     "âœ— Ã€ REVOIR",
    none:    "â€” NON RÃ‰VISÃ‰",
  };

  return (
    <div className="rev-page">
      {/* Header */}
      <div className="rev-header-block">
        <div>
          <div className="rev-title">âœ RÃ‰VISION</div>
          <div className="rev-subtitle">EXERCICES D'Ã‰CRITURE Â· AYATS APPRIS</div>
        </div>
        <div className="rev-stats-row">
          <div className="rev-stat-pill">
            <div className="rev-stat-num" style={{ color:"var(--gold2)" }}>{totalLearned}</div>
            <div className="rev-stat-label">APPRIS</div>
          </div>
          <div className="rev-stat-pill">
            <div className="rev-stat-num" style={{ color:"var(--green)" }}>{totalPerfect}</div>
            <div className="rev-stat-label">PARFAITS</div>
          </div>
          <div className="rev-stat-pill">
            <div className="rev-stat-num" style={{ color:"var(--text3)" }}>{totalNone}</div>
            <div className="rev-stat-label">Ã€ DÃ‰BUTER</div>
          </div>
          {totalToRevise > 0 && (
          <div className="rev-stat-pill" style={{ cursor:'pointer' }} onClick={() => setFilter("toRevise")}>
            <div className="rev-stat-num" style={{ color:"var(--gold2)" }}>{totalToRevise}</div>
            <div className="rev-stat-label">ğŸ”– RÃ‰VISER</div>
          </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rev-filter-row">
        {[
          { id:"carte",    label:"ğŸ“Š CARTE" },
          { id:"questions",label:"â“ QUESTIONS" },
        ].map(f => (
          <button key={f.id}
            className={`rev-filter-btn${filter===f.id?" active":""}`}
            onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {filter === "carte" && (
        <LearningMapPage surahs={surahs} learnData={learnData} onNavigate={onNavigate} />
      )}

      {filter === "questions" && (
        <QuestionsModePage surahs={surahs} learnData={learnData} setLData={setLData}
          initialSurahNum={urlSn ? Number(urlSn) : undefined}
          initialRangeFrom={urlRf || undefined}
          initialRangeTo={urlRt || undefined}
          initialQIdx={urlQIdx ? Number(urlQIdx) : 0}
        />
      )}

      {filter !== "questions" && filter !== "carte" && totalLearned === 0 && (
        <div className="rev-empty">
          Aucun ayat appris.<br />
          Marquez des ayats comme appris dans l'onglet CORAN pour les retrouver ici.
        </div>
      )}

      {filter !== "questions" && filter !== "carte" && totalLearned > 0 && filteredSurahNums.length === 0 && (
        <div className="rev-empty">Aucun ayat dans ce filtre.</div>
      )}

      {/* Surah blocks */}
      {(filter !== "questions" && filter !== "carte") && filteredSurahNums.map(sn => {
        const surahInfo  = surahs.find(s => s.number === sn);
        const ayatItems  = filteredBySurah[sn] || [];
        const isOpen     = !!openSurahs[sn];
        const perfectCnt = ayatItems.filter(({ ld }) => getRevStatus(ld) === "perfect").length;
        const pct        = ayatItems.length > 0 ? Math.round((perfectCnt / ayatItems.length) * 100) : 0;

        return (
          <div key={sn} className="rev-surah-block">
            {/* Surah header */}
            <div className="rev-surah-header" onClick={() => toggleSurah(sn)}>
              <div className="rev-surah-num">{sn}</div>
              <div className="rev-surah-name">
                <div className="rev-surah-name-ar">{surahInfo?.name ?? `Sourate ${sn}`}</div>
                <div className="rev-surah-name-en">{surahInfo?.englishName?.toUpperCase() ?? ""}</div>
                <div className="rev-progress-bar" style={{ width: 120, marginTop: 6 }}>
                  <div className="rev-progress-fill" style={{ width:`${pct}%`, background: pct===100?"var(--green)":pct>0?"var(--gold)":"var(--border2)" }} />
                </div>
              </div>
              <div className="rev-surah-badge" style={{ borderColor: pct===100?"var(--green)":"var(--border2)", color: pct===100?"var(--green)":"var(--text3)" }}>
                {perfectCnt}/{ayatItems.length} PARFAIT{perfectCnt!==1?"S":""}
              </div>
              <span style={{ fontSize:12, color:"var(--text3)", marginLeft:4 }}>{isOpen ? "â–²" : "â–¼"}</span>
            </div>

            {/* Ayat list */}
            {isOpen && (
              <div className="rev-ayat-grid">
                {ayatItems.map(({ surahNum: sNum, ayatNum: an, ld }) => {
                  const key      = `${sNum}:${an}`;
                  const status   = getRevStatus(ld);
                  const attempts = ld.writingAttempts || [];
                  const best     = attempts.length > 0 ? Math.max(...attempts.map(a => a.score)) : null;
                  const isExpanded = openAyat === key;
                  const text     = ayatTexts[key];
                  const ayat     = makeAyat(sNum, an);

                  return (
                    <div key={key} className={`rev-ayat-card${isExpanded?" rev-ayat-active":""}`}>
                      {/* Card header */}
                      <div className="rev-ayat-card-header" onClick={() => toggleAyat(key)}>
                        <div className="rev-ayat-num">{an}</div>
                        <div className="rev-ayat-text-preview">{text || "â€¦"}</div>
                        <div className={`rev-ayat-score-badge ${status}`}>
                          {best !== null ? `${best}%` : statusLabel[status]}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); onNavigate(sNum, an); }}
                          className="btn-small"
                          style={{ fontSize:8, padding:"2px 7px", marginLeft:4, flexShrink:0 }}
                          title="Aller Ã  cet ayat dans le Coran"
                        >â†—</button>
                        <span style={{ fontSize:11, color:"var(--text3)", marginLeft:4 }}>{isExpanded?"â–²":"â–¼"}</span>
                      </div>

                      {/* Expanded: tab switcher + exercise */}
                      {isExpanded && (
                        <div className="rev-ayat-body">
                          {/* Tab buttons */}
                          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                            {[["ecriture","âœ RÃ‰VISION"],["tajweed","â˜ª TAJWEED"]].map(([t,l]) => (
                              <button key={t}
                                onClick={e => { e.stopPropagation(); setAyatTab(p => ({ ...p, [key]: t })); }}
                                style={{ padding:"4px 12px", fontSize:8, letterSpacing:1, fontFamily:"'Cinzel',serif",
                                  cursor:"pointer", borderRadius:6, border:"none",
                                  borderBottom:"2px solid " + ((ayatTab[key]||"ecriture")===t ? "var(--teal)" : "transparent"),
                                  background:(ayatTab[key]||"ecriture")===t ? "rgba(62,184,160,.1)" : "transparent",
                                  color:(ayatTab[key]||"ecriture")===t ? "var(--teal2)" : "var(--text3)",
                                  transition:"all .15s" }}>
                                {l}
                              </button>
                            ))}
                          </div>
                          {text
                            ? <div className="rev-ayat-arabic">{text}</div>
                            : <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1 }}>Chargementâ€¦</div>
                          }
                          {text && (ayatTab[key]||"ecriture") === "ecriture" && (
                            <RevisionEcritureMode
                              ayat={ayat}
                              surahNum={sNum}
                              ld={ld}
                              setLData={setLData}
                            />
                          )}
                          {text && (ayatTab[key]||"ecriture") === "tajweed" && (
                            <TajweedExercice ayat={ayat} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// â”€â”€â”€ MemoriseMode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Mastery helpers (exported so surah list can use them)
// Non-letter Quranic marks that must never count as a "letter" for mastery:
// waqf/pause signs, sajda place marker, rub-el-hizb marker, end-of-ayah marker,
// small Quranic annotation ligatures (U+06D6â€“U+06ED), Arabic-Indic digits
// (juz/hizb/ayah numerals) and ornate ayah-number parentheses.
const QURAN_NON_LETTER_RE = /[\u06D6-\u06ED\u0660-\u0669\u06F0-\u06F9\uFD3E\uFD3F]/;

// Split Arabic text into grapheme clusters (letter + harakat), skipping
// non-letter Quranic annotation marks (juz/hizb/sajda/pause/etc.) entirely â€”
// they neither form their own cluster nor attach to a neighbouring letter.
function splitArabicClusters(text) {
  if (!text) return [];
  const clusters = [];
  const base = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const diac = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/;
  let cur = '';
  for (const ch of text) {
    if (QURAN_NON_LETTER_RE.test(ch)) { continue; } // ignore entirely â€” not a letter or harakat
    if (ch === ' ') { if (cur) { clusters.push(cur); cur = ''; } }
    else if (base.test(ch)) { if (cur) clusters.push(cur); cur = ch; }
    else if (diac.test(ch) && cur) { cur += ch; }
    else { if (cur) clusters.push(cur); cur = ch; }
  }
  if (cur) clusters.push(cur);
  return clusters;
}

function computeMastery(ld, ayatText) {
  const toRevise    = ld?.toRevise;
  const words       = ayatText ? ayatText.split(' ').filter(Boolean) : [];
  const totalLetters = words.reduce((s, w) => s + splitArabicClusters(w).length, 0);

  if (totalLetters === 0) return 0;

  let reviseLetters = 0;
  if (toRevise === true) {
    reviseLetters = totalLetters;
  } else if (toRevise && typeof toRevise === 'object') {
    const chars    = toRevise.chars   || {};
    const revWords = toRevise.words   || [];
    reviseLetters += Object.values(chars).reduce((s, arr) => s + arr.length, 0);
    revWords.forEach(wi => {
      if (!chars[wi] && words[wi]) reviseLetters += splitArabicClusters(words[wi]).length;
    });
  }

  const knownLetters = Math.max(0, totalLetters - reviseLetters);
  return Math.round(knownLetters / totalLetters * 100);
}

function masteryColor(pct) {
  if (pct >= 80) return 'var(--green)';
  if (pct >= 50) return 'var(--gold)';
  if (pct > 0)   return 'var(--teal2)';
  return 'var(--border2)';
}

function MasteryBar({ pct, size = 'sm' }) {
  const h = size === 'sm' ? 3 : 5;
  return (
    <div style={{ width:'100%', height:h, background:'var(--surface3)', borderRadius:h, overflow:'hidden' }}>
      <div style={{ height:'100%', width:pct+'%', background:masteryColor(pct), borderRadius:h, transition:'width .4s' }} />
    </div>
  );
}

function MasteryBadge({ pct }) {
  return (
    <span style={{ fontSize:8, letterSpacing:1, padding:'2px 7px', borderRadius:10,
      border:'1px solid '+masteryColor(pct), color:masteryColor(pct),
      fontFamily:"'Cinzel',serif", flexShrink:0 }}>
      {pct}%
    </span>
  );
}

function MasteryDebug({ ld, ayatText }) {
  const [open, setOpen] = React.useState(false);
  if (!ld) return null;

  const toRevise     = ld.toRevise;
  const words        = ayatText ? ayatText.split(' ').filter(Boolean) : [];
  const totalLetters = words.reduce((s, w) => s + splitArabicClusters(w).length, 0);

  let reviseLetters = 0;
  if (toRevise === true) {
    reviseLetters = totalLetters;
  } else if (toRevise && typeof toRevise === 'object') {
    const chars    = toRevise.chars   || {};
    const revWords = toRevise.words   || [];
    reviseLetters += Object.values(chars).reduce((s, arr) => s + arr.length, 0);
    revWords.forEach(wi => { if (!chars[wi] && words[wi]) reviseLetters += splitArabicClusters(words[wi]).length; });
  }

  const knownLetters = Math.max(0, totalLetters - reviseLetters);
  const mastery      = totalLetters > 0 ? Math.round(knownLetters / totalLetters * 100) : 0;

  const rows = [
    { label:'ğŸ“ Lettres totales',     val: `${totalLetters}`,                                          color:'var(--text2)' },
    { label:'ğŸ”– Lettres Ã  rÃ©viser',   val: `${reviseLetters}`,                                         color: reviseLetters > 0 ? '#ff7eb3' : 'var(--text3)' },
    { label:'âœ… Lettres connues',     val: `${knownLetters}`,                                           color:'var(--teal2)' },
    { label:'ğŸ¯ MAÃTRISE',            val: `${knownLetters} / ${totalLetters} = ${mastery}%`,           color: masteryColor(mastery), bold: true },
  ];

  return (
    <div style={{ marginTop:6 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ fontSize:7, letterSpacing:1.5, padding:'3px 10px', borderRadius:6, cursor:'pointer',
          fontFamily:"'Cinzel',serif", background:'transparent',
          border:`1px solid ${open ? masteryColor(mastery) : 'rgba(255,255,255,.1)'}`,
          color: open ? masteryColor(mastery) : 'var(--text3)', transition:'all .2s' }}>
        ğŸ”¬ DEBUG MAÃTRISE {open ? 'â–²' : 'â–¼'}
      </button>
      {open && (
        <div style={{ marginTop:6, background:'var(--surface2)', border:'1px solid var(--border)',
          borderRadius:9, overflow:'hidden', fontSize:8 }}>
          {rows.map(({ label, val, color, bold }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'6px 12px', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <span style={{ color:'var(--text3)', letterSpacing:.5 }}>{label}</span>
              <span style={{ color, fontWeight: bold ? 700 : 400, fontFamily: bold ? "'Cinzel',serif" : 'inherit',
                fontSize: bold ? 11 : 8 }}>{val}</span>
            </div>
          ))}
          <div style={{ padding:'8px 12px' }}>
            <MasteryBar pct={mastery} size="lg" />
          </div>
        </div>
      )}
    </div>
  );
}


// â”€â”€â”€ TextAnswerInput â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Text input widget for QuestionsMode non-reconstruct questions.
// - User types their answer in Arabic (or any text)
// - On submit: auto-grades by comparing normalised strings
// - Shows diff word by word on wrong answer
// - onReveal(true|false|null): passes auto-grade result; null = user skipped
function TextAnswerInput({ q, onReveal }) {
  const { activeInput } = useArabicKeyboard();
  const [value,    setValue]    = React.useState('');
  const [graded,   setGraded]   = React.useState(null); // null | true | false
  const [diffWords, setDiffWords] = React.useState(null); // [{word, correct}]
  const inputRef = React.useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    if (!value.trim()) { onReveal(null); return; }
    const userNorm = normalizeArabic(value.trim());
    const corrNorm = normalizeArabic(q.answer.trim());
    const correct  = userNorm === corrNorm;
    // Build word-level diff for wrong answers
    if (!correct) {
      const userWords = value.trim().split(/\s+/);
      const corrWords = q.answer.trim().split(/\s+/);
      const diff = corrWords.map((w, i) => ({
        word: w,
        correct: i < userWords.length && normalizeArabic(userWords[i]) === normalizeArabic(w),
      }));
      setDiffWords(diff);
    }
    setGraded(correct);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (graded === null) submit(); }
  };

  const borderColor = graded === true  ? 'var(--green)'
                    : graded === false ? 'var(--red)'
                    : 'var(--border)';

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
      {/* Input field */}
      <div style={{ position:'relative' }}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={e => { if (graded === null) setValue(e.target.value); }}
          onKeyDown={handleKey}
          disabled={graded !== null}
          placeholder="ÙƒØªØ¨ Ø¥Ø¬Ø§Ø¨ØªÙƒâ€¦"
          rows={2}
          onFocus={e => { if (activeInput) activeInput.current = e.target; }}
          style={{
            width:'100%', boxSizing:'border-box',
            padding:'10px 12px', fontSize:18,
            fontFamily:"'Amiri Quran',serif",
            direction:'rtl', textAlign:'right',
            background:'var(--surface3)',
            border:'1.5px solid ' + borderColor,
            borderRadius:10, color:'var(--text)',
            resize:'none', outline:'none',
            transition:'border-color .25s',
            lineHeight:1.8,
          }}
        />
        {graded !== null && (
          <div style={{ position:'absolute', top:8, left:10, fontSize:16,
            color: graded ? 'var(--green)' : 'var(--red)' }}>
            {graded ? 'âœ“' : 'âœ—'}
          </div>
        )}
      </div>

      {/* Word-level diff on wrong answer */}
      {graded === false && diffWords && (
        <div style={{ padding:'8px 12px', background:'rgba(224,90,90,.06)',
          border:'1px solid var(--red)', borderRadius:8, direction:'rtl' }}>
          <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)',
            direction:'ltr', marginBottom:6 }}>MOT PAR MOT</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {diffWords.map((d, i) => (
              <span key={i} style={{
                fontFamily:"'Amiri Quran',serif", fontSize:16,
                padding:'2px 8px', borderRadius:6,
                background: d.correct ? 'rgba(76,175,129,.18)' : 'rgba(224,90,90,.18)',
                border:'1px solid ' + (d.correct ? 'var(--green)' : 'var(--red)'),
                color:'var(--text)',
              }}>{d.word}</span>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {graded === null ? (
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => onReveal(null)}
            style={{ padding:'7px 14px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:'transparent', border:'1px solid var(--border2)', color:'var(--text3)',
              borderRadius:8, cursor:'pointer' }}>
            ğŸ‘ VOIR
          </button>
          <button onClick={submit} disabled={!value.trim()}
            style={{ flex:1, padding:'9px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background: value.trim() ? 'rgba(201,168,76,.12)' : 'transparent',
              border:'1px solid ' + (value.trim() ? 'var(--gold)' : 'var(--border2)'),
              color: value.trim() ? 'var(--gold2)' : 'var(--text3)',
              borderRadius:8, cursor: value.trim() ? 'pointer' : 'default', transition:'all .2s' }}>
            VALIDER
          </button>
        </div>
      ) : (
        <button onClick={() => onReveal(graded)}
          style={{ padding:'9px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
            background: graded ? 'rgba(76,175,129,.12)' : 'rgba(224,90,90,.08)',
            border:'1px solid ' + (graded ? 'var(--green)' : 'var(--red)'),
            color: graded ? 'var(--green)' : 'var(--red)',
            borderRadius:8, cursor:'pointer', width:'100%' }}>
          {graded ? 'âœ“ CORRECT â€” VOIR LE VERSET' : 'âœ— INCORRECT â€” VOIR LE VERSET'}
        </button>
      )}
    </div>
  );
}


// â”€â”€â”€ Arabic word categorizer for ReconstructQuestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Returns a category label for each Arabic word (approximate, pattern-based).
const ARABIC_WORD_CATS = (() => {
  const n = (s) => {
    if (!s) return '';
    return s
      .replace(/[Ù±Ø£Ø¥Ø¢Ø¤Ø¦Ø¡Ù”]/g, 'Ø§')   // alef variants
      .replace(/ÛŒ/g, 'ÙŠ')
      .replace(/[\u0670\u0640]/g, '')  // dagger alef + tatweel
      .replace(/[Ù€Ù‹-ÙŸØ-ØšÛ–-Û­\u0870-\u08FF\uFE70-\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Divine names / Allah set
  const ALLAH = new Set(['Ø§Ù„Ù„Ù‡','Ø§Ù„Ø±Ø­Ù…Ù†','Ø§Ù„Ø±Ø­ÙŠÙ…','Ø§Ù„Ù…Ù„Ùƒ','Ø§Ù„Ù‚Ø¯ÙˆØ³','Ø§Ù„Ø³Ù„Ø§Ù…','Ø§Ù„Ù…Ø¤Ù…Ù†','Ø§Ù„Ù…Ù‡ÙŠÙ…Ù†','Ø§Ù„Ø¹Ø²ÙŠØ²','Ø§Ù„Ø¬Ø¨Ø§Ø±','Ø§Ù„Ù…ØªÙƒØ¨Ø±','Ø§Ù„Ø®Ø§Ù„Ù‚','Ø§Ù„Ø¨Ø§Ø±Ø¦','Ø§Ù„Ù…ØµÙˆØ±','Ø§Ù„ØºÙÙˆØ±','Ø§Ù„Ù‚Ù‡Ø§Ø±','Ø±Ø¨Ùƒ','Ø±Ø¨Ù‡','Ø±Ø¨Ù†Ø§','Ø±Ø¨ÙƒÙ…','Ø¥Ù„Ù‡ÙƒÙ…','Ø¥Ù„Ù‡Ù†Ø§','Ø¥Ù„Ù‡Ù‡Ù…']);

  // Proper nouns â€” all names of persons, peoples, places, books, angels cited in the Quran
  // Each entry in its base form; normalize() handles diacritics/alef variants at match time
  const PROPER = new Set([
    // â”€â”€ Prophets (25 named in Quran) â”€â”€
    'Ø¢Ø¯Ù…','Ø§Ø¯Ø±ÙŠØ³','Ù†ÙˆØ­','Ù‡ÙˆØ¯','ØµØ§Ù„Ø­','Ø§Ø¨Ø±Ø§Ù‡ÙŠÙ…','Ù„ÙˆØ·','Ø§Ø³Ù…Ø§Ø¹ÙŠÙ„','Ø§Ø³Ø­Ø§Ù‚','ÙŠØ¹Ù‚ÙˆØ¨',
    'ÙŠÙˆØ³Ù','Ø´Ø¹ÙŠØ¨','Ù…ÙˆØ³Ù‰','Ù‡Ø§Ø±ÙˆÙ†','Ø¯Ø§ÙˆØ¯','Ø³Ù„ÙŠÙ…Ø§Ù†','Ø§ÙŠÙˆØ¨','ÙŠÙˆÙ†Ø³','Ø°ÙˆØ§Ù„ÙƒÙÙ„',
    'Ø§Ù„ÙŠØ§Ø³','Ø§Ù„ÙŠØ³Ø¹','Ø²ÙƒØ±ÙŠØ§','ÙŠØ­ÙŠÙ‰','Ø¹ÙŠØ³Ù‰','Ù…Ø­Ù…Ø¯','Ø§Ø­Ù…Ø¯',
    // â”€â”€ Other Quranic persons â”€â”€
    'Ù…Ø±ÙŠÙ…','Ø¹Ù…Ø±Ø§Ù†','ÙØ±Ø¹ÙˆÙ†','Ù‡Ø§Ù…Ø§Ù†','Ù‚Ø§Ø±ÙˆÙ†','Ø¬Ø§Ù„ÙˆØª','Ø·Ø§Ù„ÙˆØª','Ù„Ù‚Ù…Ø§Ù†',
    'Ø°ÙˆØ§Ù„Ù‚Ø±Ù†ÙŠÙ†','Ø§Ù„Ø¹Ø²ÙŠØ²','Ø§Ø¯Ø±ÙŠØ³','Ø®Ø¶Ø±','Ø§Ø¨Ù„ÙŠØ³','Ø¹Ø²ÙŠØ±','Ù„Ù‚Ù…Ø§Ù†',
    'Ø­Ø§Ø¨ÙŠÙ„','Ù‚Ø§Ø¨ÙŠÙ„','Ø§Ù„ÙŠØ³Ø¹','Ø§Ø±Ù…','Ø¹Ø§Ø¯','Ø«Ù…ÙˆØ¯',
    // â”€â”€ Angels â”€â”€
    'Ø¬Ø¨Ø±ÙŠÙ„','Ø¬Ø¨Ø±Ø§Ø¦ÙŠÙ„','Ù…ÙŠÙƒØ§Ø¦ÙŠÙ„','Ù…ÙŠÙƒØ§Ù„','Ø§Ø³Ø±Ø§ÙÙŠÙ„','Ù‡Ø§Ø±ÙˆØª','Ù…Ø§Ø±ÙˆØª','Ù…Ø§Ù„Ùƒ',
    // â”€â”€ Peoples / tribes â”€â”€
    'Ø§Ø³Ø±Ø§Ø¦ÙŠÙ„','ÙŠÙ‡ÙˆØ¯','Ù†ØµØ§Ø±Ù‰','Ù‚Ø±ÙŠØ´','Ø§Ø¹Ø±Ø§Ø¨','Ø§ØµØ­Ø§Ø¨','ÙØ±Ø¹ÙˆÙ†',
    'Ø¹Ø§Ø¯','Ø«Ù…ÙˆØ¯','Ù…Ø¯ÙŠÙ†','Ø³Ø¨Ø§','ÙŠØ§Ø¬ÙˆØ¬','Ù…Ø§Ø¬ÙˆØ¬',
    // â”€â”€ Places â”€â”€
    'Ù…ÙƒØ©','Ø¨ÙƒØ©','Ù…Ø¯ÙŠÙ†Ø©','ÙŠØ«Ø±Ø¨','Ø·ÙˆØ±','Ø³ÙŠÙ†Ø§Ø¡','Ø¨Ø§Ø¨Ù„','Ù…ØµØ±','Ø§Ù„Ø§Ø­Ù‚Ø§Ù',
    'Ø§Ù„Ø±Ø³','Ø§ÙŠÙƒØ©','Ø­Ø¬Ø±','Ø¨Ø¯Ø±','Ø­Ù†ÙŠÙ†','Ø§Ù„Ø§Ø­Ø²Ø§Ø¨','ØªØ¨ÙˆÙƒ',
    // â”€â”€ Revealed books â”€â”€
    'ØªÙˆØ±Ø§Ø©','Ø§Ù†Ø¬ÙŠÙ„','Ø²Ø¨ÙˆØ±','ØµØ­Ù',
    // â”€â”€ Surahs referenced by name in Quran â”€â”€
    'Ø§Ù„ÙØ±Ù‚Ø§Ù†',
  ]);

  // Pronouns
  const PRON = new Set(['Ù‡Ùˆ','Ù‡ÙŠ','Ù‡Ù…','Ù‡Ù†','Ø£Ù†Øª','Ø£Ù†ØªÙ…','Ø£Ù†ØªÙ†','Ù†Ø­Ù†','Ø§Ù†Ø§','Ø§Ù†Ø§','Ù‡Ù…Ø§','Ù‡Ù…Ø§','Ø§Ù†ØªÙ…Ø§']);

  // Particles / prepositions / conjunctions / negations
  const PART = new Set(['ÙÙŠ','Ù…Ù†','Ø¥Ù„Ù‰','Ø¹Ù„Ù‰','Ø¹Ù†','Ø¨','Ù„','Ùƒ','Ùˆ','Ù','Ø«Ù…','Ø£Ù†','Ø£Ù†Ù‘','Ø¥Ù†','Ø¥Ù†Ù‘','Ø§Ù†','Ø§Ù†','Ù„Ø§','Ù…Ø§','Ù„Ù†','Ù„Ù…','Ù„Ù…Ø§','Ø¥Ø°Ø§','Ø§Ø°Ø§','Ø¥Ø°','Ø§Ø°','Ø­ØªÙ‰','ÙƒÙŠ','Ù„ÙƒÙŠ','Ù‚Ø¯','Ø³ÙˆÙ','Ø³','Ù‡Ù„','Ø£Ù…','Ø£Ùˆ','Ø§Ù…','Ø¨Ù„','Ù„Ùˆ','Ù„ÙˆÙ„Ø§','ÙˆÙ„Ùˆ','ÙƒÙ…','Ø§Ù„Ø°ÙŠ','Ø§Ù„ØªÙŠ','Ø§Ù„Ø°ÙŠÙ†','Ø§Ù„Ù„ÙˆØ§ØªÙŠ','Ù…Ø§Ø°Ø§','Ù…ØªÙ‰','ÙƒÙŠÙ','Ø§ÙŠÙ†','Ø£ÙŠÙ†','Ù„Ù…Ø§Ø°Ø§','Ø¹Ù†Ø¯','Ù…Ø¹','Ø¨ÙŠÙ†','Ø¯ÙˆÙ†','ØªØ­Øª','ÙÙˆÙ‚','Ø®Ù„Ù','Ø§Ù…Ø§Ù…','ÙˆØ±Ø§Ø¡','Ø­ÙˆÙ„','ÙˆØ³Ø·','ØºÙŠØ±','Ø³ÙˆÙ‰','Ø¥Ù„Ø§','Ø§Ù„Ø§','Ù„ÙŠØ³','Ù„ÙƒÙ†','Ù„ÙƒÙ†Ù‘','Ù„ÙƒÙ†','Ø§Ù…Ø§','Ø¥Ù…Ø§','Ø­ÙŠÙ†','Ø¹Ù†Ø¯Ù…Ø§','Ø¨Ø¹Ø¯','Ù‚Ø¨Ù„','Ù…Ù†Ø°']);

  // Pre-normalize all sets so classify(w) matches normalized input
  const ALLAH_N  = new Set([...ALLAH].map(n));
  const PROPER_N = new Set([...PROPER].map(n));
  // Also build sorted array by length desc for prefix matching
  const PROPER_LIST = [...PROPER_N].sort((a,b) => b.length - a.length);
  const PRON_N   = new Set([...PRON].map(n));
  const PART_N   = new Set([...PART].map(n));

  const isProperNoun = (w) => {
    if (PROPER_N.has(w)) return true;
    // Strip definite article and check
    const wNoAl = w.startsWith('Ø§Ù„') ? w.slice(2) : w;
    if (PROPER_N.has(wNoAl)) return true;
    // Strip vocative prefix ÙŠØ§ (appears as ÙŠØ§ or merged as first letters ÙŠØ§/ÙŠØ§)
    const wNoYa = w.startsWith('ÙŠØ§') ? w.slice(2) : w.startsWith('ÙŠÙ€Ø§') ? w.slice(3) : w;
    if (wNoYa !== w && PROPER_N.has(wNoYa)) return true;
    const wNoYaNoAl = wNoYa.startsWith('Ø§Ù„') ? wNoYa.slice(2) : wNoYa;
    if (wNoYaNoAl !== wNoYa && PROPER_N.has(wNoYaNoAl)) return true;
    // Check if word starts with a proper noun (handles case suffixes like ØªØ§Ù†ØŒ ÙŠÙ†ØŒ ÙˆÙ†)
    for (const p of PROPER_LIST) {
      if (p.length >= 3 && w.startsWith(p) && (w.length - p.length) <= 3) return true;
      if (p.length >= 3 && wNoAl.startsWith(p) && (wNoAl.length - p.length) <= 3) return true;
      if (p.length >= 3 && wNoYa.startsWith(p) && (wNoYa.length - p.length) <= 3) return true;
    }
    return false;
  };

  const classify = (rawWord) => {
    const w = n(rawWord);
    if (!w) return 'autre';

    // Allah / divine names first
    if (ALLAH_N.has(w) || w === 'Ø§Ù„Ù„Ù‡') return 'allah';

    // Proper nouns (before other noun rules)
    if (isProperNoun(w)) return 'propre';

    // Pronouns
    if (PRON_N.has(w)) return 'pronom';

    // Particles (single letter or known set)
    if (PART_N.has(w) || (w.length === 1 && /[ÙÙˆØ¨Ù„Ùƒ]/.test(w))) return 'particule';

    // Verb detection: starts with ÙŠ / Øª / Ù† / Ø§ (Ø£ normalized) (mudari') or matches madi pattern
    // Strip object pronoun suffixes before testing: Ù‡Ù…ØŒÙ‡Ù†ØŒÙ‡Ø§ØŒÙƒÙ…ØŒÙƒÙ†ØŒÙ†Ø§ØŒÙ†ÙŠØŒÙƒØŒÙ‡
    const wNoSuffix = w.replace(/(Ù‡Ù…|Ù‡Ù†|Ù‡Ø§|ÙƒÙ…|ÙƒÙ†|Ù†Ø§|Ù†ÙŠ|ÙˆØ§|Ùƒ|Ù‡)$/, '');
    const verbRe = /^[ÙŠØªÙ†][Ø§-ÙŠØ¡-Øº]{2,9}$/;
    const verbReA = /^[Ø§][Ù†][Ø§-ÙŠØ¡-Øº]{1,7}$/; // Ø£ÙÙ†... imperative/form IV
    if (!w.startsWith('Ø§Ù„') && (verbRe.test(wNoSuffix) || verbRe.test(w) || verbReA.test(wNoSuffix) || verbReA.test(w))) return 'verbe';
    if (!w.startsWith('Ø§Ù„') && w.length === 3) return 'verbe';
    if (!w.startsWith('Ø§Ù„') && !/^[ÙŠØªÙ†Ø§Ø£]/.test(w)) {
      const madiM = w.match(/(ØªÙ…|ØªÙ†|ØªÙ…Ø§|ØªØ§|Ù†Ø§|ÙˆØ§|Øª)$/);
      if (madiM && (w.length - madiM[0].length) >= 2) return 'verbe';
    }
    // Words with definite article Ø§Ù„ = noun
    if (w.startsWith('Ø§Ù„')) return 'nom';

    // Tanwin endings (indefinite nouns): Ø§Ù†ØŒ ÙˆÙ†ØŒ ÙŠÙ†
    if (/[Ø§Ù†]$/.test(w) || w.endsWith('ÙˆÙ†') || w.endsWith('ÙŠÙ†')) return 'nom';

    // Masdar / noun patterns: ÙÙØ¹ÙØ§Ù„ØŒ ÙÙØ¹ÙÙˆÙ„ØŒ ÙÙØ§Ø¹ÙÙ„ØŒ Ù…ÙÙÙ’Ø¹ÙÙˆÙ„
    if (/^[Ù…Ù]/.test(w) && w.length >= 4) return 'nom';

    // Default: if longer word, treat as noun; short = particule
    return w.length <= 2 ? 'particule' : 'nom';
  };

  return { classify };
})();

const Q_CAT_LABELS = {
  allah:    { label: 'Ø§Ù„Ù„Ù‡',   color: 'rgba(201,168,76,.18)',   border: 'var(--gold)',   text: 'var(--gold2)' },
  propre:   { label: 'Ø£Ø¹Ù„Ø§Ù…',  color: 'rgba(100,160,255,.16)',  border: '#64a0ff',       text: '#64a0ff' },
  verbe:    { label: 'Ø£ÙØ¹Ø§Ù„',  color: 'rgba(62,184,160,.14)',   border: 'var(--teal)',   text: 'var(--teal2)' },
  nom:      { label: 'Ø£Ø³Ù…Ø§Ø¡',  color: 'rgba(111,207,154,.14)',  border: 'var(--green)',  text: 'var(--green)' },
  pronom:   { label: 'Ø¶Ù…Ø§Ø¦Ø±',  color: 'rgba(200,120,255,.14)',  border: '#c878ff',       text: '#c878ff' },
  particule:{ label: 'Ø­Ø±ÙˆÙ',   color: 'rgba(224,90,90,.12)',    border: 'var(--red)',    text: 'var(--red)' },
  autre:    { label: 'Ø£Ø®Ø±Ù‰',   color: 'var(--surface3)',        border: 'var(--border2)',text: 'var(--text3)' },
};

// â”€â”€â”€ ReconstructQuestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReconstructQuestion({ q, ayatTexts, selectedSn, onAnswer }) {
  const pool = React.useMemo(() => {
    const real = [...q.words];
    const impostorCandidates = [];
    Object.entries(ayatTexts).forEach(([k, txt]) => {
      if (!k.startsWith(selectedSn + ':')) return;
      const num = parseInt(k.split(':')[1]);
      if (num === q.ayatNum) return;
      splitArabicWords(txt).forEach(w => {
        if (!real.includes(w)) impostorCandidates.push(w);
      });
    });
    const impostorCount = Math.min(8, Math.max(2, Math.round(real.length * 0.4)));
    const impostors = [...impostorCandidates].sort(() => Math.random() - 0.5).slice(0, impostorCount);
    return [...real, ...impostors].sort(() => Math.random() - 0.5);
  }, [q.ayatNum]);

  // Classify each pool word and group by category
  const poolByCategory = React.useMemo(() => {
    const realSet = new Set(q.words);
    const groups = {};
    pool.forEach((word, idx) => {
      const cat = ARABIC_WORD_CATS.classify(word);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ word, idx, isReal: realSet.has(word) });
    });
    const ORDER = ['allah', 'propre', 'verbe', 'nom', 'pronom', 'particule', 'autre'];
    return ORDER.filter(c => groups[c]).map(c => ({ cat: c, items: groups[c] }));
  }, [pool]);

  const [picked,     setPicked]     = React.useState([]);
  const [graded,     setGraded]     = React.useState(null);
  const [shake,      setShake]      = React.useState(false);
  const [poolSearch, setPoolSearch] = React.useState('');
  // Cursor = insertion position (0 = before first word, picked.length = after last)
  const [cursor, setCursor] = React.useState(0);

  // Per-position status after grading
  const wordStatuses = React.useMemo(() => {
    if (graded === null) return null;
    return picked.map((poolIdx, pos) => {
      if (pos >= q.words.length) return 'extra';
      return normalizeArabic(pool[poolIdx]) === normalizeArabic(q.words[pos]) ? 'correct' : 'wrong';
    });
  }, [graded, picked, pool]);

  // Per-pool-index status after grading
  const poolStatuses = React.useMemo(() => {
    if (graded === null) return {};
    const m = {};
    picked.forEach((poolIdx, pos) => {
      m[poolIdx] = pos < q.words.length && normalizeArabic(pool[poolIdx]) === normalizeArabic(q.words[pos]) ? 'correct' : 'wrong';
    });
    return m;
  }, [graded, picked]);

  // Insert word at cursor position
  const pickWord = (idx) => {
    if (graded !== null || picked.includes(idx)) return;
    setPicked(p => { const n = [...p]; n.splice(cursor, 0, idx); return n; });
    setCursor(c => c + 1);
  };
  // Remove word at pos, move cursor there
  const unpick = (pos) => {
    if (graded !== null) return;
    setPicked(p => p.filter((_, i) => i !== pos));
    setCursor(pos);
  };
  // Click placed word sets cursor after it (for insertion next to it)
  const moveCursor = (pos) => {
    if (graded !== null) return;
    setCursor(pos + 1);
  };
  const submit = () => {
    if (graded !== null) return;
    const composed = picked.map(i => pool[i]).join(' ').trim();
    const correct = normalizeArabic(composed) === normalizeArabic(q.answer.trim());
    setGraded(correct);
    if (!correct) { setShake(true); setTimeout(() => setShake(false), 600); }
  };
  const reset = () => { setPicked([]); setGraded(null); setShake(false); setCursor(0); };

  const isComplete = picked.length === q.words.length;
  const borderColor = graded === true ? 'var(--green)' : graded === false ? 'var(--red)' : 'var(--border)';

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:12 }}>

      {/* Composition zone â€” coloured per-word after grading */}
      <div style={{ minHeight:60, padding:'10px 12px', background:'var(--surface3)',
        borderRadius:10, border:'1.5px solid ' + borderColor,
        direction:'rtl', display:'flex', flexWrap:'wrap', alignItems:'center', gap:6,
        transition:'border-color .3s', animation: shake ? 'shake .5s' : 'none' }}>
        {picked.length === 0 ? (
          <React.Fragment>
            {graded === null && (
              <span style={{ display:'inline-block', width:2, height:22, background:'var(--teal)',
                borderRadius:1, animation:'blink 1s step-end infinite', verticalAlign:'middle', marginLeft:2 }} />
            )}
            <span style={{ fontSize:9, color:'var(--text3)', letterSpacing:1, direction:'ltr', marginRight:6 }}>
              Tape les mots dans l&apos;ordreâ€¦
            </span>
          </React.Fragment>
        ) : (
          <React.Fragment>
            {/* Cursor at position 0 */}
            {graded === null && cursor === 0 && (
              <span style={{ display:'inline-block', width:2, height:22, background:'var(--teal)',
                borderRadius:1, animation:'blink 1s step-end infinite', verticalAlign:'middle' }} />
            )}
            {picked.map((poolIdx, pos) => {
              const status = wordStatuses?.[pos];
              const bg   = status === 'correct' ? 'rgba(76,175,129,.22)'
                         : status              ? 'rgba(224,90,90,.22)'
                         : 'rgba(62,184,160,.18)';
              const bord = status === 'correct' ? '1px solid var(--green)'
                         : status              ? '1px solid var(--red)'
                         : '1px solid var(--teal2)';
              const icon = status === 'correct' ? ' âœ“' : status ? ' âœ—' : '';
              return (
                <React.Fragment key={pos}>
                  <span
                    onClick={() => { if (graded === null) { cursor === pos + 1 ? unpick(pos) : moveCursor(pos); } }}
                    title={graded === null ? (cursor === pos + 1 ? 'Cliquer pour retirer' : 'Cliquer pour placer ici') : ''}
                    style={{ fontFamily:"'Amiri Quran',serif", fontSize:18, padding:'3px 10px',
                      borderRadius:7, border:bord, background:bg, color:'var(--text)',
                      cursor: graded === null ? 'pointer' : 'default', transition:'all .2s',
                      outline: graded === null && cursor === pos + 1 ? '2px solid var(--teal)' : 'none' }}>
                    {pool[poolIdx]}
                    {icon && <sup style={{ fontSize:10, marginRight:2,
                      color: status === 'correct' ? 'var(--green)' : 'var(--red)' }}>{icon}</sup>}
                  </span>
                  {/* Cursor after this word */}
                  {graded === null && cursor === pos + 1 && (
                    <span style={{ display:'inline-block', width:2, height:22, background:'var(--teal)',
                      borderRadius:1, animation:'blink 1s step-end infinite', verticalAlign:'middle' }} />
                  )}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        )}
      </div>

      {/* Word pool â€” categorized always; labels + status colors only after grading */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {/* Search bar (before grading only) */}
        {graded === null && (
          <div style={{ position:'relative' }}>
            <input
              value={poolSearch}
              onChange={e => setPoolSearch(e.target.value)}
              placeholder="Ø¨Ø­Ø«â€¦"
              style={{ width:'100%', boxSizing:'border-box',
                padding:'7px 30px 7px 10px', fontSize:15,
                fontFamily:"'Amiri Quran',serif", direction:'rtl',
                background:'var(--surface3)', border:'1px solid var(--border2)',
                borderRadius:8, color:'var(--text)', outline:'none' }}
            />
            {poolSearch && (
              <button onClick={() => setPoolSearch('')}
                style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', color:'var(--text3)',
                  fontSize:12, cursor:'pointer', padding:0, lineHeight:1 }}>âœ•</button>
            )}
          </div>
        )}
        {poolByCategory.filter(({ cat }) => cat !== 'autre').map(({ cat, items }) => {
          const meta = Q_CAT_LABELS[cat] || Q_CAT_LABELS.autre;
          const visibleItems = items.filter(({ word }) =>
            !poolSearch || normalizeArabic(word).includes(normalizeArabic(poolSearch))
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={cat}>
              {/* Category label â€” always shown */}
              <div style={{ fontSize:7, letterSpacing:2,
                color: graded !== null ? meta.text : 'var(--text3)', opacity: graded !== null ? .85 : .5,
                fontFamily:"'Cinzel',serif", marginBottom:3, paddingRight:4,
                textAlign:'right', direction:'rtl', transition:'color .3s' }}>
                {meta.label}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, direction:'rtl' }}>
                {visibleItems.map(({ word, idx, isReal }) => {
                  const used      = picked.includes(idx);
                  const status    = graded !== null ? poolStatuses[idx] : null;
                  const isMissing = graded === false && !used && isReal;
                  // Before grading: uniform teal style. After: coloured by status.
                  const bg   = graded === null
                    ? (used ? 'var(--surface3)' : meta.color)
                    : status === 'correct' ? 'rgba(76,175,129,.18)'
                    : status === 'wrong'   ? 'rgba(224,90,90,.15)'
                    : isMissing            ? 'rgba(201,168,76,.15)'
                    : used                 ? 'var(--surface3)'
                    : meta.color;
                  const bord = graded === null
                    ? (used ? 'var(--border2)' : meta.border)
                    : status === 'correct' ? 'var(--green)'
                    : status === 'wrong'   ? 'var(--red)'
                    : isMissing            ? 'var(--gold)'
                    : used                 ? 'var(--border2)'
                    : meta.border;
                  return (
                    <button key={idx}
                      onClick={() => pickWord(idx)}
                      disabled={used || graded !== null}
                      style={{ fontFamily:"'Amiri Quran',serif", fontSize:17, padding:'5px 12px',
                        borderRadius:8, border:'1px solid ' + bord, background:bg,
                        color:'var(--text)',
                        opacity: used && graded === null ? 0.3 : used && !status ? 0.3 : 1,
                        cursor: used || graded !== null ? 'default' : 'pointer',
                        direction:'rtl', transition:'all .2s',
                        boxShadow: isMissing ? '0 0 0 2px rgba(201,168,76,.3)' : 'none' }}>
                      {word}
                      {isMissing && <sup style={{ fontSize:9, color:'var(--gold)', marginRight:2 }}> âœ•</sup>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Impostors (autre) â€” shown ungrouped, no label, muted */}
        {(() => {
          const autreGroup = poolByCategory.find(({ cat }) => cat === 'autre');
          if (!autreGroup) return null;
          const visibleItems = autreGroup.items.filter(({ word }) =>
            !poolSearch || normalizeArabic(word).includes(normalizeArabic(poolSearch))
          );
          if (visibleItems.length === 0) return null;
          return (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, direction:'rtl', opacity:.7 }}>
              {visibleItems.map(({ word, idx }) => {
                const used   = picked.includes(idx);
                const status = graded !== null ? poolStatuses[idx] : null;
                const bg   = graded === null
                  ? (used ? 'var(--surface3)' : 'rgba(62,184,160,.10)')
                  : status === 'correct' ? 'rgba(76,175,129,.18)'
                  : status === 'wrong'   ? 'rgba(224,90,90,.15)'
                  : used ? 'var(--surface3)' : 'rgba(62,184,160,.10)';
                const bord = graded === null
                  ? (used ? 'var(--border2)' : 'var(--teal)')
                  : status === 'correct' ? 'var(--green)'
                  : status === 'wrong'   ? 'var(--red)'
                  : used ? 'var(--border2)' : 'var(--teal)';
                return (
                  <button key={idx} onClick={() => pickWord(idx)}
                    disabled={used || graded !== null}
                    style={{ fontFamily:"'Amiri Quran',serif", fontSize:17, padding:'5px 12px',
                      borderRadius:8, border:'1px solid ' + bord, background:bg,
                      color:'var(--text)', opacity: used ? 0.25 : 1,
                      cursor: used || graded !== null ? 'default' : 'pointer',
                      direction:'rtl', transition:'all .2s' }}>
                    {word}
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Correct order â€” shown only on wrong answer */}
      {graded === false && (
        <div style={{ padding:'8px 12px', background:'rgba(201,168,76,.07)',
          border:'1px solid var(--gold)', borderRadius:8, direction:'rtl' }}>
          <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)',
            direction:'ltr', marginBottom:6 }}>ORDRE CORRECT</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {q.words.map((w, i) => {
              const userWord = picked[i] !== undefined ? pool[picked[i]] : null;
              const ok = userWord != null && normalizeArabic(userWord) === normalizeArabic(w);
              return (
                <span key={i} style={{ fontFamily:"'Amiri Quran',serif", fontSize:17,
                  padding:'3px 10px', borderRadius:7,
                  background: ok ? 'rgba(76,175,129,.15)' : 'rgba(201,168,76,.18)',
                  border:'1px solid ' + (ok ? 'var(--green)' : 'var(--gold)'),
                  color:'var(--text)' }}>
                  {w}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      {graded === null ? (
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={reset} disabled={picked.length === 0}
            style={{ padding:'7px 14px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:'transparent', border:'1px solid var(--border2)', color:'var(--text3)',
              borderRadius:8, cursor:'pointer', opacity: picked.length===0 ? 0.4 : 1 }}>
            â†º
          </button>
          <button onClick={submit} disabled={!isComplete}
            style={{ flex:1, padding:'9px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background: isComplete ? 'rgba(201,168,76,.12)' : 'transparent',
              border:'1px solid ' + (isComplete ? 'var(--gold)' : 'var(--border2)'),
              color: isComplete ? 'var(--gold2)' : 'var(--text3)',
              borderRadius:8, cursor: isComplete ? 'pointer' : 'default', transition:'all .2s' }}>
            VALIDER ({picked.length}/{q.words.length})
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', gap:8 }}>
          {!graded && (
            <button onClick={reset}
              style={{ padding:'7px 14px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
                background:'transparent', border:'1px solid var(--teal)', color:'var(--teal)',
                borderRadius:8, cursor:'pointer' }}>
              â†º RÃ‰ESSAYER
            </button>
          )}
          <button onClick={() => onAnswer(graded)}
            style={{ flex:1, padding:'9px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background: graded ? 'rgba(76,175,129,.12)' : 'rgba(224,90,90,.08)',
              border:'1px solid ' + (graded ? 'var(--green)' : 'var(--red)'),
              color: graded ? 'var(--green)' : 'var(--red)',
              borderRadius:8, cursor:'pointer' }}>
            SUIVANT â†’
          </button>
        </div>
      )}
    </div>
  );
}
// â”€â”€â”€ QAyatPlayer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Interactive ayat display for QuestionsMode:
// - Letter-by-letter highlight driven by local RAF currentMs
// - Click word â†’ play from that word's timestamp
// - Parts shown as colored chips â†’ click to play that range
// - Full-ayat play/pause button
function QAyatPlayer({ ayatText, timestamps, parts, audioUrl, learnData }) {
  const [currentMs,  setCurrentMs]  = React.useState(0);
  const [isPlaying,  setIsPlaying]  = React.useState(false);
  const [rangeEnd,   setRangeEnd]   = React.useState(null);  // ms â€” null = play to end
  const [rangeStart, setRangeStart] = React.useState(null);
  const audioRef = React.useRef(null);
  const rafRef   = React.useRef(null);
  const containerRef = React.useRef(null);

  const PART_COLORS  = ["rgba(201,168,76,.22)","rgba(62,184,160,.18)","rgba(111,207,154,.18)","rgba(224,90,90,.15)","rgba(200,120,255,.15)"];
  const PART_BORDERS = ["var(--gold)","var(--teal)","var(--green)","var(--red)","#c878ff"];

  // RAF loop â€” updates char highlight via DOM
  const startRaf = () => {
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      const ms = a.currentTime * 1000;
      setCurrentMs(ms);
      // Apply highlight via DOM
      if (containerRef.current && timestamps?.words) {
        const spans = containerRef.current.querySelectorAll('.char-span');
        let si = 0;
        timestamps.words.forEach(word => {
          const chars = fixChars(word.chars || []);
          chars.forEach(c => {
            if (si < spans.length) {
              const active = ms >= c.start && ms <= c.end;
              const done   = ms > c.end && ms > 0 && (rangeStart == null || c.end > rangeStart);
              const el = spans[si];
              if (active) { el.classList.add('char-active'); el.classList.remove('char-done'); }
              else if (done) { el.classList.add('char-done'); el.classList.remove('char-active'); }
              else { el.classList.remove('char-active','char-done'); }
              si++;
            }
          });
        });
      }
      // Stop at range end
      if (rangeEnd !== null && ms >= rangeEnd) {
        a.pause();
        setIsPlaying(false);
        setRangeEnd(null);
        setRangeStart(null);
        cancelAnimationFrame(rafRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  const stopRaf = () => { cancelAnimationFrame(rafRef.current); };

  // Clear highlight
  const clearHighlight = () => {
    if (containerRef.current) {
      containerRef.current.querySelectorAll('.char-span').forEach(el => {
        el.classList.remove('char-active','char-done');
      });
    }
  };

  React.useEffect(() => () => { stopRaf(); audioRef.current?.pause(); }, []);

  // Play from a specific time, with optional end time
  const playFrom = (startMs, endMs = null) => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    if (a.src !== audioUrl) a.src = audioUrl;
    a.currentTime = startMs / 1000;
    setRangeEnd(endMs);
    setRangeStart(startMs);
    a.play().then(() => { setIsPlaying(true); startRaf(); }).catch(() => {});
  };

  const toggleFull = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause(); setIsPlaying(false); stopRaf();
    } else {
      playFrom(0, null);
    }
  };

  // Click a word â†’ play from that word's start to word's end
  const onWordClick = (wi) => {
    if (!timestamps?.words?.[wi]) return;
    const word = timestamps.words[wi];
    const chars = fixChars(word.chars || []);
    if (!chars.length) return;
    const startMs = chars[0].start;
    const endMs   = chars[chars.length - 1].end;
    playFrom(startMs, endMs);
  };

  // Click a part â†’ play its word range
  const onPartClick = (part) => {
    if (!timestamps?.words || !part.wordIndices?.length) return;
    const firstW = timestamps.words[part.wordIndices[0]];
    const lastW  = timestamps.words[part.wordIndices[part.wordIndices.length - 1]];
    if (!firstW || !lastW) return;
    const firstChars = fixChars(firstW.chars || []);
    const lastChars  = fixChars(lastW.chars || []);
    if (!firstChars.length || !lastChars.length) return;
    playFrom(firstChars[0].start, lastChars[lastChars.length - 1].end);
  };

  // Build word-to-part map
  const wordPartMap = {};
  (parts || []).forEach((p, pi) => p.wordIndices?.forEach(wi => { wordPartMap[wi] = pi; }));

  const hasTs = !!timestamps?.words;
  const hasParts = (parts || []).length > 0;

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
      <audio ref={audioRef} style={{ display:'none' }}
        onEnded={() => { setIsPlaying(false); setRangeEnd(null); setRangeStart(null); stopRaf(); clearHighlight(); }}
        onPause={() => { if (!audioRef.current?.ended) { setIsPlaying(false); stopRaf(); } }}
      />

      {/* Arabic text + optional play button */}
      <div style={{ padding:'12px 14px', background:'var(--surface3)', borderRadius:10,
        border:'1px solid var(--border2)', direction:'rtl', textAlign:'right',
        position:'relative' }}>
        {/* Play/pause full ayat */}
        {audioUrl && (
          <button onClick={toggleFull}
            style={{ position:'absolute', top:8, left:8, width:30, height:30, borderRadius:'50%',
              border:'none', background: isPlaying && rangeEnd === null ? 'rgba(62,184,160,.3)' : 'rgba(62,184,160,.1)',
              color:'var(--teal2)', fontSize:13, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow: isPlaying && rangeEnd === null ? '0 0 0 2px rgba(62,184,160,.4)' : 'none',
              transition:'all .2s', zIndex:1 }}>
            {isPlaying && rangeEnd === null ? 'â¸' : 'â–¶'}
          </button>
        )}
        {/* Clickable words or plain text */}
        {hasTs ? (
          <div className="ayat-arabic" ref={containerRef}>
            {timestamps.words.map((word, wi) => {
              const pi = wordPartMap[wi];
              const part = pi !== undefined ? (parts || [])[pi] : null;
              const chars = fixChars(word.chars || []);
              const isActivePart = isPlaying && rangeStart !== null && part &&
                chars.length > 0 && rangeStart <= chars[0].start;
              const bg     = part ? PART_COLORS[pi % PART_COLORS.length]  : 'transparent';
              const border = part ? `1px solid ${PART_BORDERS[pi % PART_BORDERS.length]}` : 'none';
              return (
                <span key={wi}
                  onClick={() => audioUrl && onWordClick(wi)}
                  style={{
                    background: isActivePart ? 'rgba(62,184,160,.28)' : bg,
                    border, borderRadius: part ? 5 : 0,
                    padding: part ? '1px 4px' : 0,
                    margin: part ? '1px' : 0,
                    cursor: audioUrl ? 'pointer' : 'default',
                    display:'inline',
                    transition:'background .15s',
                  }}>
                  {chars.map((c, ci) => (
                    <span key={ci} className="char-span">{c.char}</span>
                  ))}
                  {wi < timestamps.words.length - 1 ? ' ' : ''}
                </span>
              );
            })}
          </div>
        ) : (
          <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, color:'var(--text)', lineHeight:2 }}>
            {ayatText}
          </span>
        )}
      </div>

      {/* Parts as clickable chips */}
      {hasParts && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, direction:'rtl' }}>
          {(parts || []).map((part, pi) => (
            <button key={part.id ?? pi}
              onClick={() => audioUrl ? onPartClick(part) : null}
              style={{ fontFamily:"'Amiri Quran',serif", fontSize:15,
                padding:'4px 10px', borderRadius:7,
                background: PART_COLORS[pi % PART_COLORS.length],
                border:`1px solid ${PART_BORDERS[pi % PART_BORDERS.length]}`,
                color:'var(--text)', cursor: audioUrl ? 'pointer' : 'default',
                direction:'rtl', transition:'all .15s',
                boxShadow: isPlaying && rangeStart !== null ? '0 0 0 2px rgba(62,184,160,.3)' : 'none',
              }}>
              {part.text || (part.wordIndices?.map(i => timestamps?.words?.[i]?.chars?.map(c=>c.char).join('')).join(' '))}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Split Arabic text into words, separating attached prefix particles (Ùˆ Ù Ø¨ Ù„)
// so ÙˆÙÙ±Ù„Ù„ÙÙ‘Ù‡Ù â†’ ['ÙˆÙ', 'Ù±Ù„Ù„ÙÙ‘Ù‡Ù'] matching the space-split form from quran-simple
function splitArabicWords(text) {
  if (!text) return [];

  const PREFIXES = [
    { p: 'Ùˆ', alefOnly: false },
    { p: 'Ù', alefOnly: false },
    { p: 'Ù„', alefOnly: false },
    { p: 'Ø¨', alefOnly: true  },
  ];
  const ALEF_VARIANTS = new Set(['Ø§','Ø£','Ø¥','Ø¢','Ù±','\u0671','\u0622','\u0623','\u0625']);

  // Zero-width / invisible joiners that should NOT cause word breaks
  const ZW_RE = /[\u2060\uFEFF\u200B\u200C\u200D]/;
  const ZW_STRIP = /[\u2060\uFEFF\u200B\u200C\u200D]/g;

  // Step 1: split on whitespace, then merge tokens around ZW chars
  const rawTokens = text.trim().split(/[ \t\n\r\u00A0\u202F\u2009]+/).filter(t => t.length > 0);

  const merged = [];
  let i = 0;
  while (i < rawTokens.length) {
    const raw = rawTokens[i];
    const tok = raw.replace(ZW_STRIP, '');
    if (!tok) {
      // Purely ZW token â†’ merge previous and next
      if (merged.length > 0 && i + 1 < rawTokens.length) {
        merged[merged.length - 1] += rawTokens[i + 1].replace(ZW_STRIP, '');
        i += 2; continue;
      }
    } else if (ZW_RE.test(raw)) {
      // Token contains ZW (at start, end, or middle)
      // If ZW is at the end, merge with next token
      if (/[\u2060\uFEFF\u200B\u200C\u200D]$/.test(raw) && i + 1 < rawTokens.length) {
        merged.push(tok + rawTokens[i + 1].replace(ZW_STRIP, ''));
        i += 2; continue;
      }
      // If ZW is at the start, merge into previous token
      if (/^[\u2060\uFEFF\u200B\u200C\u200D]/.test(raw) && merged.length > 0) {
        merged[merged.length - 1] += tok;
      } else {
        merged.push(tok);
      }
    } else {
      merged.push(tok);
    }
    i++;
  }

  // Also merge any token that is purely diacritics/starts with dagger alif into the previous token,
  // AND merge any token with only 1 Arabic consonant (incomplete word, e.g. ÙÙ split by newline) with the next
  const COMBINING = /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0870-\u08FF]+$/;
  const STARTS_COMBINING = /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/; // starts with diacritic/dagger alif
  const ARABIC_CONS = /[\u0600-\u063F\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06D5\u06EE-\u06EF\u06FA-\u06FC\u06FF]/g;
  const isSingleConsonant = (tok) => (tok.match(ARABIC_CONS) || []).length === 1;

  const cleaned = [];
  for (let j = 0; j < merged.length; j++) {
    const tok = merged[j];
    if (cleaned.length > 0 && (COMBINING.test(tok) || STARTS_COMBINING.test(tok))) {
      // Token is purely diacritics OR starts with dagger alif â€” belongs to previous word
      cleaned[cleaned.length - 1] += tok;
    } else if (isSingleConsonant(tok) && j + 1 < merged.length) {
      // Single consonant token (e.g. ÙÙ from ÙÙØ¶Û¡Ù„Ù split by newline): merge with next
      merged[j + 1] = tok + merged[j + 1];
    } else {
      cleaned.push(tok);
    }
  }

  // Step 3: prefix splitting
  const result = [];
  cleaned.forEach(token => {
    const norm = normalizeArabic(token);
    let split = false;
    for (const { p, alefOnly } of PREFIXES) {
      const rest = norm.slice(p.length);
      if (norm.startsWith(p) && norm.length > 2 && (!alefOnly || ALEF_VARIANTS.has(rest[0]))) {
        let i = 0;
        const originalChars = [...token];
        let letterCount = 0;
        while (i < originalChars.length) {
          const cp = originalChars[i].codePointAt(0);
          const isDiacritic = (cp >= 0x064B && cp <= 0x065F) || cp === 0x0670 || (cp >= 0x0610 && cp <= 0x061A) ||
                              (cp >= 0x06D6 && cp <= 0x06ED) || (cp >= 0x0870 && cp <= 0x08FF);
          if (!isDiacritic) letterCount++;
          i++;
          if (letterCount === 1) {
            while (i < originalChars.length) {
              const cp2 = originalChars[i].codePointAt(0);
              const isDia2 = (cp2 >= 0x064B && cp2 <= 0x065F) || cp2 === 0x0670 || (cp2 >= 0x0610 && cp2 <= 0x061A) ||
                             (cp2 >= 0x06D6 && cp2 <= 0x06ED) || (cp2 >= 0x0870 && cp2 <= 0x08FF);
              if (!isDia2) break;
              i++;
            }
            break;
          }
        }
        if (i < originalChars.length) {
          result.push(originalChars.slice(0, i).join(''));
          result.push(originalChars.slice(i).join(''));
          split = true;
          break;
        }
      }
    }
    if (!split) result.push(token);
  });
  return result;
}

// â”€â”€â”€ CompareVerseQuestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Shows multiple ayat texts (same number, different surahs), user taps to match
function CompareVerseQuestion({ q, onAnswer, globalNums }) {
  const { entries } = q;
  const [playingIdx, setPlayingIdx] = React.useState(null);
  const [progress, setProgress]     = React.useState({});  // idx â†’ 0..1
  const audioRef = React.useRef(null);

  const playEntry = (i, sn, an) => {
    const gn = globalNums?.[`${sn}:${an}`];
    if (!gn) return;
    const url = `${getAudioBase()}/${gn}.mp3`;
    if (playingIdx === i) {
      audioRef.current?.pause();
      setPlayingIdx(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    }
    setPlayingIdx(i);
  };

  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnd  = () => { setPlayingIdx(null); };
    const onTime = () => {
      if (el.duration) setProgress(p => ({ ...p, [playingIdx]: el.currentTime / el.duration }));
    };
    el.addEventListener('ended', onEnd);
    el.addEventListener('timeupdate', onTime);
    return () => { el.removeEventListener('ended', onEnd); el.removeEventListener('timeupdate', onTime); };
  }, [playingIdx]);

  // Shuffle display order
  const shuffled = React.useMemo(() => {
    const arr = [...entries];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [q.id]);

  // Shuffled surah names (to match)
  const shuffledNames = React.useMemo(() => {
    const arr = [...entries.map(e => ({ sn: e.sn, name: e.name }))];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [q.id]);

  const [assignments, setAssignments] = React.useState({}); // textIndex â†’ snAssigned
  const [selected, setSelected] = React.useState(null); // { side: 'text'|'name', index }
  const [checked, setChecked] = React.useState(false);

  const assign = (side, index) => {
    if (checked) return;
    if (!selected) { setSelected({ side, index }); return; }
    if (selected.side === side) { setSelected({ side, index }); return; }
    // Cross-assign
    if (side === 'name' && selected.side === 'text') {
      setAssignments(prev => ({ ...prev, [selected.index]: shuffledNames[index].sn }));
    } else if (side === 'text' && selected.side === 'name') {
      setAssignments(prev => ({ ...prev, [index]: shuffledNames[selected.index].sn }));
    }
    setSelected(null);
  };

  const allAssigned = shuffled.every((_, i) => assignments[i] !== undefined);

  const check = () => {
    setChecked(true);
    const correct = shuffled.every((e, i) => assignments[i] === e.sn);
    onAnswer(correct);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, width:'100%' }}>
      <audio ref={audioRef} style={{ display:'none' }} />
      <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:2, textAlign:'center' }}>
        ASSOCIE CHAQUE TEXTE Ã€ SA SOURATE
      </div>
      <div style={{ display:'flex', gap:8 }}>
        {/* Texts column */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
          {shuffled.map((e, i) => {
            const isSelected = selected?.side === 'text' && selected.index === i;
            const assignedSn = assignments[i];
            const assignedName = assignedSn ? shuffledNames.find(n => n.sn === assignedSn)?.name : null;
            const correct = checked && assignedSn === e.sn;
            const wrong   = checked && assignedSn !== undefined && assignedSn !== e.sn;
            const isPlaying = playingIdx === i;
            const hasAudio  = !!(globalNums?.[`${e.sn}:${q.ayatNum}`]);
            return (
              <div key={i}
                style={{ borderRadius:8, cursor:'pointer',
                  border:`1px solid ${isSelected ? 'var(--gold)' : correct ? 'var(--green)' : wrong ? 'var(--red)' : 'var(--border2)'}`,
                  background: isSelected ? 'rgba(201,168,76,.08)' : correct ? 'rgba(76,175,129,.08)' : wrong ? 'rgba(229,115,115,.08)' : 'var(--surface2)',
                  overflow:'hidden' }}>
                {/* Audio bar */}
                {hasAudio && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                    borderBottom:`1px solid var(--border)`, background:'rgba(0,0,0,.15)', cursor:'pointer' }}
                    onClick={ev => { ev.stopPropagation(); playEntry(i, e.sn, q.ayatNum); }}>
                    <span style={{ fontSize:16, color: isPlaying ? 'var(--teal2)' : 'var(--text3)', flexShrink:0 }}>
                      {isPlaying ? 'â¸' : 'â–¶'}
                    </span>
                    <div style={{ flex:1, height:3, borderRadius:2, background:'var(--surface3)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:2, background:'var(--teal)',
                        width:`${(progress[i] ?? 0) * 100}%`,
                        transition: isPlaying ? 'width .1s linear' : 'width .2s' }} />
                    </div>
                  </div>
                )}
                <div style={{ padding:'8px 10px' }} onClick={() => assign('text', i)}>
                  <div style={{ direction:'rtl', fontFamily:"'Amiri Quran',serif", fontSize:15, lineHeight:1.7, color:'var(--text)' }}>
                    {e.text}
                  </div>
                  {assignedName && (
                    <div style={{ fontSize:7, color: correct ? 'var(--green)' : wrong ? 'var(--red)' : 'var(--gold)',
                      fontFamily:"'Cinzel',serif", letterSpacing:1, direction:'ltr', marginTop:4 }}>
                      {assignedName}{checked && !correct && ` â†’ ${e.name}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Names column */}
        <div style={{ flex:'0 0 auto', display:'flex', flexDirection:'column', gap:6, minWidth:90 }}>
          {shuffledNames.map((nm, i) => {
            const isSelected = selected?.side === 'name' && selected.index === i;
            const used = Object.values(assignments).includes(nm.sn);
            return (
              <div key={i} onClick={() => assign('name', i)}
                style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer', textAlign:'center',
                  border:`1px solid ${isSelected ? 'var(--gold)' : used ? 'var(--teal)' : 'var(--border2)'}`,
                  background: isSelected ? 'rgba(201,168,76,.1)' : used ? 'rgba(62,184,160,.08)' : 'var(--surface2)',
                  fontSize:8, letterSpacing:1, fontFamily:"'Cinzel',serif",
                  color: isSelected ? 'var(--gold2)' : used ? 'var(--teal2)' : 'var(--text3)',
                  opacity: used && !isSelected ? 0.6 : 1 }}>
                {nm.name.toUpperCase()}
              </div>
            );
          })}
        </div>
      </div>
      {!checked && allAssigned && (
        <button onClick={check}
          style={{ padding:'10px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
            background:'rgba(201,168,76,.12)', border:'1px solid var(--gold)', color:'var(--gold2)',
            borderRadius:8, cursor:'pointer' }}>
          âœ“ VÃ‰RIFIER
        </button>
      )}
      {checked && (
        <div style={{ textAlign:'center', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
          color: shuffled.every((_,i) => assignments[i] === shuffled[i].sn) ? 'var(--green)' : 'var(--red)',
          padding:'8px', borderRadius:8,
          background: shuffled.every((_,i) => assignments[i] === shuffled[i].sn) ? 'rgba(76,175,129,.08)' : 'rgba(229,115,115,.08)' }}>
          {shuffled.every((_,i) => assignments[i] === shuffled[i].sn) ? 'âœ“ CORRECT' : 'âœ— INCORRECT'}
        </div>
      )}
    </div>
  );
}


// â”€â”€â”€ FindSurahQuestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FindSurahQuestion({ q, surahs, onAnswer }) {
  const [chosen, setChosen] = React.useState(null);
  const correct = q.answer;
  const pick = (sn) => {
    if (chosen !== null) return;
    setChosen(String(sn));
    onAnswer(String(sn) === correct);
  };
  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:14, alignItems:'center' }}>
      <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:24, direction:'rtl', textAlign:'center',
        color:'var(--text1)', padding:'14px 18px', background:'var(--surface3)',
        borderRadius:10, border:'1px solid var(--border)', lineHeight:2.2, width:'100%' }}>
        {q.questionData}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', width:'100%' }}>
        {(q.options || []).map(sn => {
          const s = surahs.find(x => x.number === sn);
          const isCorrect = String(sn) === correct;
          const isChosen  = String(sn) === chosen;
          let bg = 'transparent', border = 'var(--border2)', color = 'var(--text2)';
          if (chosen !== null) {
            if (isCorrect)     { bg='rgba(76,175,129,.15)'; border='var(--green)'; color='var(--green)'; }
            else if (isChosen) { bg='rgba(224,90,90,.12)';  border='var(--red)';   color='var(--red)'; }
          }
          return (
            <button key={sn} onClick={() => pick(sn)}
              style={{ padding:'9px 16px', fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif",
                background:bg, border:`1px solid ${border}`, color, borderRadius:8,
                cursor: chosen===null ? 'pointer' : 'default', transition:'all .2s', minWidth:120 }}>
              <span style={{ opacity:.6, marginRight:4 }}>{sn}.</span>{s ? s.englishName : `S.${sn}`}
            </button>
          );
        })}
      </div>
      {chosen !== null && (
        <div style={{ fontSize:9, letterSpacing:1, color: chosen===correct ? 'var(--green)' : 'var(--red)' }}>
          {chosen===correct ? 'âœ“ Correct' : `âœ— â€” ${surahs.find(x=>String(x.number)===correct)?.englishName ?? correct}`}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ QuranBookPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Inspired by Codrops / billionbd CodePen: hardcover_front + pages + spine
// Structure: <ul class="qbook"> with li.qbook-hc-front, li.qbook-pages,
//            li.qbook-page (flipping leaf), li.qbook-hc-back
const MUSHAF_TOTAL = 604;

function QuranBookPage({ surahs }) {
  const navigate = useNavigate();
  const [spread,    setSpread]    = React.useState(0);    // 0 = cover closed
  const [flipState, setFlipState] = React.useState('idle'); // 'idle'|'fwd'|'bwd'
  const [pageCache, setPageCache] = React.useState({});
  const [inputVal,  setInputVal]  = React.useState('1');
  const [bookOpen,  setBookOpen]  = React.useState(false);
  const [sz,        setSz]        = React.useState({ w: 440, h: 560 });
  const [showSurahMenu, setShowSurahMenu] = React.useState(false);
  const [bookmark,  setBookmark]  = React.useState(() => {
    try { return parseInt(localStorage.getItem('quranbook_bm')) || null; } catch { return null; }
  });

  // Responsive single-page width (book shows one spread = two half-pages)
  React.useEffect(() => {
    const upd = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      // single page half-width; full spread = w*2
      const maxH = vh - 160;
      const maxW = Math.min((vw - 40) / 2, maxH * 0.68, 440);
      setSz({ w: Math.round(maxW), h: Math.round(maxW / 0.68) });
    };
    upd(); window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  const rPage = spread === 0 ? null : 2 * spread - 1;
  const lPage = spread === 0 ? null : Math.min(2 * spread, MUSHAF_TOTAL);

  const loadPage = React.useCallback(async (n) => {
    if (!n || n < 1 || n > MUSHAF_TOTAL || pageCache[n] !== undefined) return;
    setPageCache(c => ({ ...c, [n]: null }));
    try {
      const data = await fetchQuranPage(n);
      setPageCache(c => ({ ...c, [n]: data }));
    } catch {
      setPageCache(c => ({ ...c, [n]: [] }));
    }
  }, [pageCache]);

  React.useEffect(() => {
    if (spread === 0) return;
    [rPage, lPage, rPage+2, lPage+2, rPage-2, lPage-2]
      .filter(Boolean).forEach(loadPage);
  }, [spread]); // eslint-disable-line

  React.useEffect(() => {
    if (rPage) setInputVal(String(rPage));
  }, [rPage]);

  // Open book: animate cover swing then go to spread 1
  const openBook = React.useCallback(() => {
    if (bookOpen) return;
    setBookOpen(true);
    setTimeout(() => {
      setSpread(1);
      setFlipState('idle');
    }, 820);
  }, [bookOpen]);

  const closeBook = React.useCallback(() => {
    setBookOpen(false);
    setTimeout(() => setSpread(0), 820);
  }, []);

  const goNext = React.useCallback(async () => {
    if (flipState !== 'idle' || !lPage || lPage >= MUSHAF_TOTAL) return;
    // preload next spread before animating
    const np1 = rPage + 2, np2 = lPage + 2;
    await Promise.all([np1, np2].filter(p => p >= 1 && p <= MUSHAF_TOTAL && pageCache[p] === undefined)
      .map(async p => {
        setPageCache(c => ({ ...c, [p]: null }));
        try { const d = await fetchQuranPage(p); setPageCache(c => ({ ...c, [p]: d })); }
        catch { setPageCache(c => ({ ...c, [p]: [] })); }
      }));
    setFlipState('fwd');
    setTimeout(() => { setSpread(s => s + 1); setFlipState('idle'); }, 720);
  }, [flipState, lPage, rPage, pageCache]);

  const goPrev = React.useCallback(async () => {
    if (flipState !== 'idle' || spread <= 1) return;
    const pp1 = rPage - 2, pp2 = lPage ? lPage - 2 : null;
    await Promise.all([pp1, pp2].filter(p => p && p >= 1 && pageCache[p] === undefined)
      .map(async p => {
        setPageCache(c => ({ ...c, [p]: null }));
        try { const d = await fetchQuranPage(p); setPageCache(c => ({ ...c, [p]: d })); }
        catch { setPageCache(c => ({ ...c, [p]: [] })); }
      }));
    setFlipState('bwd');
    setTimeout(() => { setSpread(s => s - 1); setFlipState('idle'); }, 720);
  }, [flipState, spread, rPage, lPage, pageCache]);

  const jumpTo = (v) => {
    const p = Math.max(1, Math.min(MUSHAF_TOTAL, parseInt(v) || 1));
    setSpread(Math.ceil(p / 2));
    if (!bookOpen) { setBookOpen(true); }
  };

  // Keyboard
  React.useEffect(() => {
    const h = e => {
      if (e.key === 'ArrowLeft')  goNext();
      if (e.key === 'ArrowRight') goPrev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goNext, goPrev]);

  // Touch swipe
  const tx = React.useRef(0);

  const isFwd  = flipState === 'fwd';
  const isBwd  = flipState === 'bwd';
  const isFlip = isFwd || isBwd;

  // Page content renderer
  const PageContent = React.useCallback(({ pageNum, side }) => {
    const ayahs = pageCache[pageNum];
    if (!pageNum) return null;
    if (ayahs === undefined || ayahs === null)
      return <div className="qbook-loading-page">Ø§Ù„Ù‚Ø±Ø¢Ù†</div>;

    const groups = [];
    (ayahs || []).forEach(a => {
      const last = groups[groups.length - 1];
      if (!last || last.sn !== a.surah.number)
        groups.push({ sn: a.surah.number, name: a.surah.name, eng: a.surah.englishName, ayahs: [] });
      groups[groups.length - 1].ayahs.push(a);
    });

    const fs = Math.max(Math.min(sz.h / 20, sz.w / 14, 16), 10);

    return (
      <div className={`qbook-page-content${side === 'right' ? ' qbook-page-content-right' : ''}`}>
        {groups.map((g, gi) => (
          <React.Fragment key={gi}>
            {g.ayahs[0]?.numberInSurah === 1 && (
              <>
                <div className="qbook-surah-header">
                  {g.eng.toUpperCase()}
                  <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:'1.3em', margin:'0 5px' }}>{g.name}</span>
                </div>
                {g.sn !== 9 && (
                  <div className="qbook-basmala" style={{ fontSize: fs + 1 }}>
                    Ø¨ÙØ³Ù’Ù…Ù Ù±Ù„Ù„ÙÙ‘Ù‡Ù Ù±Ù„Ø±ÙÙ‘Ø­Ù’Ù…ÙÙ°Ù†Ù Ù±Ù„Ø±ÙÙ‘Ø­ÙÙŠÙ…Ù
                  </div>
                )}
              </>
            )}
            <div className="qbook-ayah-text" style={{ fontSize: fs }}>
              {g.ayahs.map(a => (
                <React.Fragment key={a.numberInSurah}>
                  {a.text}<span className="qbook-ayah-num">ï´¿{a.numberInSurah}ï´¾</span>{' '}
                </React.Fragment>
              ))}
            </div>
          </React.Fragment>
        ))}
        <div className="qbook-page-num">{pageNum}</div>
      </div>
    );
  }, [pageCache, sz]);

  const spineW = Math.max(Math.round(sz.w * 0.052), 20);
  const totalW = sz.w * 2 + spineW;

  return (
    <div className="qbook-wrapper">

      {/* â”€â”€ Top bar â”€â”€ */}
      <div className="qbook-topbar" style={{ maxWidth: totalW + 60 }}>
        <button onClick={() => navigate('/quran')}
          style={{ fontSize:8,letterSpacing:1.5,padding:'4px 12px',fontFamily:"'Cinzel',serif",
            background:'transparent',border:'1px solid rgba(201,168,76,.25)',
            color:'rgba(201,168,76,.55)',borderRadius:6,cursor:'pointer',flexShrink:0 }}>
          â† SOURATES
        </button>

        {/* Surah picker */}
        <div style={{ position:'relative', flexShrink:0 }}>
          <button onClick={() => setShowSurahMenu(v => !v)}
            style={{ fontSize:8,letterSpacing:1.2,padding:'4px 10px',fontFamily:"'Cinzel',serif",
              background:'rgba(201,168,76,.07)',border:'1px solid rgba(201,168,76,.22)',
              color:'rgba(201,168,76,.6)',borderRadius:6,cursor:'pointer' }}>
            SOURATE â–¾
          </button>
          {showSurahMenu && (
            <div style={{ position:'absolute',top:'115%',left:0,zIndex:300,minWidth:240,
              background:'#120701',border:'1px solid rgba(201,168,76,.2)',borderRadius:8,
              maxHeight:260,overflowY:'auto',boxShadow:'0 10px 40px rgba(0,0,0,.85)' }}>
              {surahs.map(s => (
                <div key={s.number}
                  onClick={() => { jumpTo(s.startPage || s.number * 2 - 1); setShowSurahMenu(false); }}
                  style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 12px',
                    cursor:'pointer',borderBottom:'1px solid rgba(201,168,76,.05)' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,.1)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span style={{ fontSize:8,color:'rgba(201,168,76,.4)',minWidth:20 }}>{s.number}</span>
                  <span style={{ fontFamily:"'Amiri Quran',serif",fontSize:14,color:'#c9a84c',direction:'rtl' }}>{s.name}</span>
                  <span style={{ fontSize:7,color:'rgba(201,168,76,.35)',marginLeft:'auto' }}>{s.englishName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontFamily:"'Amiri Quran',serif",fontSize:Math.max(sz.w*.044,16),
          color:'rgba(201,168,76,.48)',direction:'rtl',textAlign:'center',flex:1,
          textShadow:'0 0 16px rgba(201,168,76,.2)' }}>
          Ø§Ù„Ù‚Ø±Ø¢Ù† Ø§Ù„ÙƒØ±ÙŠÙ…
        </div>

        {/* Bookmark */}
        <button onClick={() => { setBookmark(rPage); if(rPage) localStorage.setItem('quranbook_bm', String(rPage)); }}
          style={{ fontSize:14,background:'transparent',border:'none',cursor:'pointer',flexShrink:0,
            color: bookmark === rPage ? '#c0392b' : 'rgba(201,168,76,.32)' }}>ğŸ”–</button>
        {bookmark && rPage && bookmark !== rPage && (
          <button onClick={() => jumpTo(bookmark)}
            style={{ fontSize:8,letterSpacing:1,padding:'4px 8px',fontFamily:"'Cinzel',serif",
              background:'rgba(192,57,43,.14)',border:'1px solid rgba(192,57,43,.28)',
              color:'rgba(220,100,80,.7)',borderRadius:6,cursor:'pointer',flexShrink:0 }}>
            p.{bookmark}
          </button>
        )}

        {/* Page input */}
        {bookOpen && (
          <div style={{ display:'flex',alignItems:'center',gap:4,flexShrink:0 }}>
            <span style={{ fontSize:7,color:'rgba(201,168,76,.4)',fontFamily:"'Cinzel',serif" }}>P.</span>
            <input type="number" value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && jumpTo(inputVal)}
              onBlur={() => jumpTo(inputVal)}
              style={{ width:44,textAlign:'center',background:'transparent',
                border:'1px solid rgba(201,168,76,.22)',borderRadius:6,
                padding:'3px 5px',color:'var(--gold)',fontSize:12,
                fontFamily:"'Cinzel',serif",outline:'none' }} />
            <span style={{ fontSize:7,color:'rgba(201,168,76,.25)',fontFamily:"'Cinzel',serif" }}>/604</span>
          </div>
        )}
      </div>

      {/* â”€â”€ Book scene â”€â”€ */}
      <div className="qbook-scene"
        onTouchStart={e => { tx.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - tx.current;
          if (dx < -55) goNext(); if (dx > 55) goPrev();
        }}>

        {/* Ambient glow under book */}
        <div style={{ position:'absolute',bottom:'8%',left:'50%',transform:'translateX(-50%)',
          width:'55%',height:30,pointerEvents:'none',
          background:'radial-gradient(ellipse,rgba(180,110,20,.16) 0%,transparent 70%)' }}/>

        {/* â”€â”€ THE BOOK â”€â”€ */}
        <div style={{
          position:'relative',
          width: totalW,
          height: sz.h,
          transformStyle:'preserve-3d',
          transform:'rotateX(4deg)',
          filter:`drop-shadow(0 ${sz.h*.12}px ${sz.h*.16}px rgba(0,0,0,.95)) drop-shadow(0 8px 24px rgba(0,0,0,.6))`,
        }}>

          {/* â”€â”€ HARDCOVER BACK â”€â”€ */}
          <ul style={{ listStyle:'none',margin:0,padding:0,
            position:'absolute',top:0,left:0,width:sz.w,height:sz.h,
            transformStyle:'preserve-3d',zIndex:0 }}>
            {/* back board */}
            <li style={{ position:'absolute',top:0,left:0,width:'100%',height:'100%',
              borderRadius:'3px 0 0 3px',
              background:'linear-gradient(135deg,#200800,#4a1508,#200800)',
              boxShadow:'-4px 0 12px rgba(0,0,0,.5),inset 4px 0 10px rgba(0,0,0,.3)' }}/>
            {/* thickness edge */}
            <li style={{ position:'absolute',top:4,right:-spineW*.35,
              width:spineW*.35, height:'calc(100% - 8px)',
              background:'linear-gradient(to right,#1a0500,#0e0200)',
              borderRadius:'0 2px 2px 0' }}/>
          </ul>

          {/* â”€â”€ STACKED PAGES (visible fore-edge) â”€â”€ */}
          <ul style={{ listStyle:'none',margin:0,padding:0,
            position:'absolute',top:3,left:3,
            width: sz.w * 2 + spineW - 6, height: sz.h - 6,
            transformStyle:'preserve-3d',zIndex:1 }}>
            {[0,1,2,3,4].map(k => (
              <li key={k} style={{
                position:'absolute',top:0,left:0,width:'100%',height:'100%',
                borderRadius:'0 2px 2px 0',
                background: ['#ede1bb','#f0e4c0','#f3e7c6','#f6eacc','#f9edd2'][k],
                transform:`translateX(${-k}px)`,
              }}/>
            ))}
          </ul>

          {/* â”€â”€ LEFT PAGE (even) â€” always visible under the flipping leaf â”€â”€ */}
          <div style={{ position:'absolute',top:0,left:0,width:sz.w,height:sz.h,zIndex:2,overflow:'hidden',
            background:'linear-gradient(160deg,#fef9ee,#fdf3d8,#faecc0)',
            borderRadius:'2px 0 0 2px',
            boxShadow:'inset 8px 0 20px rgba(0,0,0,.08)' }}>
            {bookOpen && <PageContent pageNum={isFwd ? lPage + 2 : lPage} side="left" />}
          </div>

          {/* â”€â”€ RIGHT PAGE (odd) â€” always visible â”€â”€ */}
          <div style={{ position:'absolute',top:0,left:sz.w + spineW,width:sz.w,height:sz.h,zIndex:2,
            overflow:'hidden',
            background:'linear-gradient(160deg,#fef9ee,#fdf3d8,#faecc0)',
            borderRadius:'0 2px 2px 0',
            boxShadow:'inset -8px 0 20px rgba(0,0,0,.08)' }}>
            {bookOpen && <PageContent pageNum={isBwd ? rPage - 2 : rPage} side="right" />}
          </div>

          {/* â”€â”€ SPINE â”€â”€ */}
          <div style={{ position:'absolute',top:0,left:sz.w,width:spineW,height:sz.h,zIndex:20,
            background:`linear-gradient(to right,#0a0200 0%,#3a1204 18%,#8a3810 34%,#d08c38 50%,#8a3810 66%,#3a1204 82%,#0a0200 100%)`,
            boxShadow:'0 0 18px rgba(0,0,0,.7),inset 0 0 6px rgba(255,195,70,.08)' }}>
            <div style={{ position:'absolute',inset:0,
              background:'repeating-linear-gradient(to bottom,transparent 0,transparent 20px,rgba(255,190,60,.07) 20px,rgba(255,190,60,.07) 21px)' }}/>
          </div>

          {/* â”€â”€ FLIPPING PAGE â”€â”€ */}
          {isFlip && (
            <div className={`qbook-page${isFwd ? ' qbook-flip-fwd' : ' qbook-flip-bwd'}`}
              style={{
                position:'absolute',top:0,
                left: isFwd ? 0 : sz.w + spineW,
                width:sz.w,height:sz.h,
                transformOrigin: isFwd ? 'right center' : 'left center',
                transformStyle:'preserve-3d',zIndex:200,
              }}>
              {/* front face */}
              <div className="qbook-page-face">
                <PageContent pageNum={isFwd ? lPage : rPage} side={isFwd ? 'left' : 'right'} />
              </div>
              {/* back face */}
              <div className="qbook-page-face qbook-page-face-back">
                <PageContent pageNum={isFwd ? rPage + 2 : lPage - 2} side={isFwd ? 'right' : 'left'} />
              </div>
            </div>
          )}

          {/* â”€â”€ HARDCOVER FRONT â”€â”€ */}
          <ul className={`qbook-hc-front${bookOpen ? ' qbook-open' : ''}`}
            style={{ listStyle:'none',margin:0,padding:0,
              position:'absolute',top:0,
              left: sz.w + spineW,   // cover starts at right half
              width:sz.w,height:sz.h,
              transformStyle:'preserve-3d',
              transformOrigin:'left center',
              transition:'transform .82s cubic-bezier(.645,.045,.355,1)',
              transform: bookOpen ? 'rotateY(-175deg)' : 'rotateY(0deg)',
              zIndex:bookOpen ? 5 : 150,
            }}>
            {/* front face */}
            <li style={{ position:'absolute',top:0,left:0,width:'100%',height:'100%',
              backfaceVisibility:'hidden',borderRadius:'0 3px 3px 0',overflow:'hidden',
              background:'linear-gradient(135deg,#280b01 0%,#561c05 30%,#8b3210 50%,#561c05 70%,#280b01 100%)',
              boxShadow:'inset -8px 0 24px rgba(0,0,0,.45),inset 0 0 40px rgba(0,0,0,.28)' }}>
              <div className="qbook-cover-design">
                <div className="qbook-medallion">â˜½</div>
                <div className="qbook-cover-title">Ø§Ù„Ù‚Ø±Ø¢Ù† Ø§Ù„ÙƒØ±ÙŠÙ…</div>
                <div className="qbook-cover-sub">THE NOBLE QURAN</div>
                {!bookOpen && (
                  <button className="qbook-open-btn" style={{ marginTop:16 }}
                    onClick={openBook}>
                    OUVRIR LE LIVRE
                  </button>
                )}
              </div>
            </li>
            {/* back face (inside of front cover) */}
            <li style={{ position:'absolute',top:0,left:0,width:'100%',height:'100%',
              backfaceVisibility:'hidden',transform:'rotateY(180deg)',
              borderRadius:'0 3px 3px 0',overflow:'hidden',
              background:'linear-gradient(to right,#1c0601,#3a1008)',
              display:'flex',alignItems:'center',justifyContent:'center' }}>
              <div style={{ fontFamily:"'Amiri Quran',serif",fontSize:'1.8em',
                color:'rgba(201,168,76,.22)',direction:'rtl' }}>ï·½</div>
            </li>
          </ul>

          {/* â”€â”€ Click zones (when open) â”€â”€ */}
          {bookOpen && !isFlip && <>
            <div className="qbook-click qbook-click-left"
              style={{ left:0, width:sz.w*.46, height:sz.h, position:'absolute',top:0,zIndex:250,cursor:'pointer' }}
              onClick={goNext} title="Suivant (â†)" />
            <div className="qbook-click qbook-click-right"
              style={{ left:sz.w + spineW + sz.w*.54, width:sz.w*.46, height:sz.h, position:'absolute',top:0,zIndex:250,cursor:'pointer' }}
              onClick={goPrev} title="PrÃ©cÃ©dent (â†’)" />
          </>}

          {/* â”€â”€ Top & bottom hardcover boards (3D depth illusion) â”€â”€ */}
          <div style={{ position:'absolute',top:-5,left:0,right:0,height:6,
            background:'linear-gradient(to bottom,#1e0602,#5a1a08)',
            borderRadius:'2px 2px 0 0',boxShadow:'0 -2px 8px rgba(0,0,0,.5)' }}/>
          <div style={{ position:'absolute',bottom:-5,left:0,right:0,height:6,
            background:'linear-gradient(to top,#1e0602,#5a1a08)',
            borderRadius:'0 0 2px 2px',boxShadow:'0 2px 8px rgba(0,0,0,.5)' }}/>
        </div>
      </div>

      {/* â”€â”€ Bottom nav â”€â”€ */}
      <div className="qbook-botnav">
        {bookOpen ? (<>
          <button className="qbook-navbtn" onClick={goPrev} disabled={spread <= 1 || isFlip}>
            â†’ PRÃ‰C.
          </button>

          <div style={{ textAlign:'center', minWidth:80 }}>
            <div className="qbook-navlabel">
              {rPage}{lPage && lPage <= MUSHAF_TOTAL ? 'â€“' + lPage : ''}
            </div>
            <div className="qbook-progress">
              <div className="qbook-progress-bar"
                style={{ width:`${rPage ? (rPage/MUSHAF_TOTAL)*100 : 0}%` }}/>
            </div>
          </div>

          <button className="qbook-navbtn" onClick={goNext}
            disabled={!lPage || lPage >= MUSHAF_TOTAL || isFlip}>
            SUIV. â†
          </button>

          <button className="qbook-navbtn" onClick={closeBook}
            style={{ fontSize:8,padding:'5px 12px',opacity:.6 }}>
            âœ• FERMER
          </button>
        </>) : (
          <button className="qbook-navbtn" onClick={openBook}>
            ğŸ“– OUVRIR LE LIVRE
          </button>
        )}
      </div>
    </div>
  );
}


// â”€â”€â”€ QuranBook3DPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Architecture: single WebGL canvas for all rendering.
// Each page spread is drawn as a WebGL texture (parchment + text composited
// on an offscreen 2D canvas) then mapped through the curl shader.
// No separate 2D overlay â€” everything in one GL canvas.

const _MUSHAF_PAGES = 604;
const _API3D = "https://api.alquran.cloud/v1";

// â”€â”€ Vertex shader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const _VS3D = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying   vec2 v_uv;
void main(){ v_uv = a_uv; gl_Position = vec4(a_pos, 0., 1.); }`;

// â”€â”€ Page spread fragment shader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders left+right page textures with:
//  â€¢ cylindrical curl with crease highlight + back-face tint
//  â€¢ spine groove + gold filament
//  â€¢ per-page AO shadow near spine
//  â€¢ stacked-pages fore-edge
const _PAGE_FS = `
precision highp float;
varying vec2 v_uv;

uniform sampler2D u_tex;     // current spread texture (both pages)
uniform sampler2D u_texNext; // next spread (shown on back of curling leaf)
uniform float u_curl;        // 0=flat â€¦ 1=fully turned
uniform float u_dir;         // +1 = right-page curls forward, -1 = left-page

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}

// â”€â”€ Spine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
vec4 spineColor(float t, float vy){
  vec3 base = mix(vec3(.055,.020,.004), vec3(.095,.038,.009), noise(vec2(t*8.,vy*30.))*.5);
  float gold = exp(-pow((t-.5)*4.8,2.));
  base = mix(base, vec3(.82,.60,.20), gold*.6);
  float gl2  = smoothstep(.007,0.,abs(t-.20)) + smoothstep(.007,0.,abs(t-.80));
  base = mix(base, vec3(.78,.55,.18), gl2*.75);
  base -= smoothstep(.78,1.,fract(vy*58.))*.05;
  float sv = 1.-smoothstep(.82,1.,abs(vy-.5)*2.);
  base *= mix(.55,1.,sv);
  return vec4(base,1.);
}

// â”€â”€ Cylindrical curl â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
void curl(
  in  vec2  pageUV,  // 0..1 within this half-page
  in  float c,       // curl progress 0..1
  in  bool  right,   // is this the right page?
  out vec2  mapped,  // remapped UV into the page texture half
  out float shade,   // darkening factor
  out bool  isBack,  // are we on the back face?
  out float crease   // crease highlight (0..1)
){
  mapped = pageUV; shade = 1.; isBack = false; crease = 0.;
  if(c < .001) return;

  bool curling = (u_dir > 0.) == right;
  if(!curling) return;

  float foldX = u_dir > 0. ? (1. - c) : c;
  float x     = u_dir > 0. ? pageUV.x : (1. - pageUV.x);
  float d     = x - foldX;
  float R     = max(.06, .55 * (1. - c * .65));

  crease = exp(-abs(d) * 180.) * c;

  if(d > 0.){
    // back face
    float ang   = min(d / (R * 3.14159), 1.);
    float flipX = foldX - sin(ang * 3.14159) * R * .55;
    float flipY = pageUV.y + (cos(ang * 3.14159) - 1.) * R * .07;
    mapped  = u_dir > 0. ? vec2(flipX, flipY) : vec2(1.-flipX, flipY);
    mapped  = clamp(mapped, 0., 1.);
    shade   = (.55 + .30 * (1.-c)) * cos(ang * 3.14159 * .4);
    isBack  = true;
  } else {
    // front face bulge
    float t2 = clamp((-d)/(.4*(1.-foldX)+.01),0.,1.);
    float by = sin(t2*3.14159)*c*.035;
    float bx = sin(t2*3.14159)*c*.010;
    mapped = u_dir > 0.
      ? vec2(pageUV.x-bx, pageUV.y+by*(pageUV.y-.5))
      : vec2(pageUV.x+bx, pageUV.y+by*(pageUV.y-.5));
    mapped = clamp(mapped, 0., 1.);
    shade  = .80 + .20*smoothstep(0.,.20,-d);
  }
}

// â”€â”€ Fore-edge (stacked pages) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
vec3 foreEdge(vec2 puv, vec3 col, bool right){
  float e = right ? smoothstep(.93,1.,puv.x) : smoothstep(.07,0.,puv.x);
  vec3 edge = vec3(.76,.68,.50);
  col = mix(col, edge, e * .55);
  float lines = fract(puv.y * 140.);
  col -= e * smoothstep(.65,1.,lines) * .045;
  return col;
}

void main(){
  bool  right  = v_uv.x > .5;
  float spW    = .014;
  float sx     = abs(v_uv.x - .5);

  // â”€â”€ Spine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(sx < spW){
    float t = (v_uv.x - (.5-spW)) / (spW*2.);
    gl_FragColor = spineColor(t, v_uv.y);
    return;
  }

  // â”€â”€ Page UV (0..1 within this half) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  vec2 pageUV = right ? vec2((v_uv.x-.5)*2., v_uv.y)
                      : vec2(v_uv.x*2.,       v_uv.y);

  vec2  mapped; float shade; bool isBack; float crease;
  curl(pageUV, u_curl, right, mapped, shade, isBack, crease);

  // â”€â”€ Sample texture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // texture layout: left-half = left page, right-half = right page
  vec2 texUV = right ? vec2(.5 + mapped.x*.5, mapped.y)
                     : vec2(mapped.x*.5,       mapped.y);

  vec4 col;
  bool curling2 = (u_dir > 0.) == right;
  if(isBack && curling2 && u_curl > .01){
    // back face shows next spread
    vec2 nextUV = right ? vec2(.5 + mapped.x*.5, mapped.y)
                        : vec2(mapped.x*.5,       mapped.y);
    col = texture2D(u_texNext, nextUV);
  } else {
    col = texture2D(u_tex, texUV);
  }

  // â”€â”€ Spine AO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  float ao = right ? 1.-.44*exp(-pageUV.x*10.)
                   : 1.-.44*exp(-(1.-pageUV.x)*10.);
  col.rgb *= ao;

  // â”€â”€ Fore-edge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  col.rgb = foreEdge(pageUV, col.rgb, right);

  // â”€â”€ Back face tint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(isBack){
    col.rgb = mix(col.rgb * .70, vec3(.86,.76,.58), .15);
  }

  // â”€â”€ Curl shade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  col.rgb *= shade;

  // â”€â”€ Crease highlight â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  col.rgb += vec3(.98,.90,.72) * crease * .65;

  // â”€â”€ Fold shadow on unturned pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(u_curl > .01){
    bool curling3 = (u_dir > 0.) == right;
    if(!isBack){
      float foldX2 = u_dir > 0. ? (1.-u_curl) : u_curl;
      float fx = u_dir > 0. ? pageUV.x : (1.-pageUV.x);
      col.rgb -= .32 * u_curl * exp(-abs(fx-foldX2)*24.) * (1.-float(isBack));
    }
  }

  gl_FragColor = vec4(clamp(col.rgb,0.,1.), 1.);
}`;

// â”€â”€ Cover shader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const _CVR_FS = `
precision highp float;
varying vec2 v_uv;
attribute vec2 a_uv;
uniform float u_time;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<7;i++){v+=a*noise(p);p*=2.1;a*=.48;}return v;}
vec3 gold(float t){ return mix(vec3(.66,.42,.08),vec3(.96,.80,.34),t); }

float rosette(vec2 c, float r, float petals, float t){
  float a=atan(c.y,c.x);
  float petal=.5+.5*cos(petals*a+t);
  return smoothstep(r*.85,r*.05, length(c)-petal*r*.48);
}

void main(){
  float n=fbm(v_uv*7.)*.2+fbm(v_uv*23.+3.)*.08;
  vec3 col=mix(vec3(.040,.015,.003),vec3(.110,.046,.011),n);
  vec2 c=v_uv-.5; float r=length(c),a=atan(c.y,c.x);

  // rings
  for(int k=0;k<5;k++){
    float rk=.40-float(k)*.055; float w=.007-.001*float(k);
    float ring=smoothstep(w*.5,0.,abs(r-rk));
    float sh=.65+.35*sin(float(k)*1.4+u_time*.7+a*4.);
    col=mix(col,gold(sh),ring*(.92-.15*float(k)));
  }

  // inner field
  float inner=smoothstep(.27,.22,r);
  vec3 fillC=mix(vec3(.07,.028,.006),vec3(.13,.055,.014),fbm(c*15.+u_time*.03)*.5);
  float tr=max(
    smoothstep(.035,.0,abs(sin(c.x*26.+u_time*.08)*cos(c.y*26.-.08*u_time)*.4)),
    smoothstep(.035,.0,abs(sin((c.x+c.y)*18.+u_time*.06)*.35))
  )*inner;
  fillC=mix(fillC,gold(.55+.4*sin(r*28.-u_time*1.1+a*3.))*.72,tr);
  col=mix(col,fillC,inner);

  // rosettes
  col=mix(col,gold(.55+.4*sin(u_time*1.4+r*18.)),rosette(c,.20,8.,u_time*.22)*.88);
  col=mix(col,gold(.75+.2*sin(u_time*1.8)),rosette(c,.10,6.,-u_time*.30)*.92);
  col=mix(col,vec3(1.,.94,.62),smoothstep(.020,.0,r));

  // 8-point star
  float star=pow(abs(sin(a*4.+u_time*.18)),3.5);
  col=mix(col,gold(.6+.35*star),star*(1.-smoothstep(.26,.36,r))*smoothstep(.07,.26,r)*.65);

  // corner ornaments
  vec2 co=abs(v_uv-.5)*2.;
  float cscroll=smoothstep(.60,.64,max(co.x,co.y))-smoothstep(.72,.76,max(co.x,co.y));
  col=mix(col,gold(.62+.25*sin(u_time+co.x*4.)),cscroll*.70);
  float cd=(1.-smoothstep(.0,.14,length(co-.82)))*smoothstep(.055,.0,abs(co.x-co.y));
  col=mix(col,gold(.72+.2*sin(u_time*.9)),cd*.88);

  // borders
  vec2 bd=min(v_uv,1.-v_uv);
  float b1=smoothstep(0.,.006,min(bd.x,bd.y))-smoothstep(.006,.014,min(bd.x,bd.y));
  float b2=smoothstep(.018,.022,min(bd.x,bd.y))-smoothstep(.022,.028,min(bd.x,bd.y));
  float b3=smoothstep(.033,.036,min(bd.x,bd.y))-smoothstep(.036,.042,min(bd.x,bd.y));
  float bs=.5+.5*sin(u_time*.5+(v_uv.x+v_uv.y)*7.);
  col=mix(col,gold(.58+.32*bs),b1*.92+b2*.72+b3*.55);

  // vignette
  vec2 dv=v_uv*(1.-v_uv);
  col*=mix(.35,1.,pow(dv.x*dv.y*18.,.27));

  col+=vec3(.92,.80,.44)*exp(-r*r*5.5)*(.11+.05*sin(u_time*1.8));
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

// â”€â”€ GL helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _csh(gl,t,src){
  const s=gl.createShader(t);
  gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
  return s;
}
function _cprog(gl,vs,fs){
  const p=gl.createProgram();
  gl.attachShader(p,_csh(gl,gl.VERTEX_SHADER,vs));
  gl.attachShader(p,_csh(gl,gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p); return p;
}
function _makeTex(gl){
  const t=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  // init with 1x1 blank
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([245,235,200,255]));
  return t;
}
function _uploadTex(gl,tex,canvas){
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
}

// â”€â”€ Offscreen spread canvas renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Draws parchment background + ayat text for both pages side by side
function _renderSpread(leftAyahs, leftPn, rightAyahs, rightPn, W, H){
  const cvs=document.createElement("canvas"); cvs.width=W; cvs.height=H;
  const ctx=cvs.getContext("2d");

  const hw=W/2;

  // â”€â”€ Parchment background â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // We draw it via gradient + noise simulation on 2D canvas
  for(let side=0;side<2;side++){
    const x0=side===0?0:hw;
    ctx.save();
    // base warm ivory
    const g=ctx.createLinearGradient(x0,0,x0+hw,H);
    g.addColorStop(0,  "#fdf8ea");
    g.addColorStop(.4, "#faf2d8");
    g.addColorStop(1,  "#f4e8c0");
    ctx.fillStyle=g;
    ctx.fillRect(x0,0,hw,H);

    // subtle grain via tiny dots (fast approximation)
    ctx.globalAlpha=.055;
    ctx.fillStyle="#8b6030";
    // draw a grid of semi-random dots for grain texture
    const step=3;
    for(let yy=0;yy<H;yy+=step){
      for(let xx=0;xx<hw;xx+=step){
        const v=Math.sin(xx*.71+yy*.53)*Math.cos(xx*.37-yy*.81)*.5+.5;
        if(v>.62){ ctx.fillRect(x0+xx,yy,1,1); }
      }
    }
    // laid lines
    ctx.globalAlpha=.04;
    ctx.fillStyle="#7a5520";
    for(let yy=0;yy<H;yy+=Math.round(H/42)){
      ctx.fillRect(x0,yy,hw,1);
    }
    ctx.globalAlpha=1;
    ctx.restore();

    // edge yellowing
    const ew=ctx.createLinearGradient(x0,0,x0+12,0);
    ew.addColorStop(0,"rgba(140,100,40,.22)"); ew.addColorStop(1,"rgba(140,100,40,0)");
    ctx.fillStyle=ew; ctx.fillRect(x0,0,18,H);
    const ew2=side===0
      ? ctx.createLinearGradient(x0+hw-12,0,x0+hw,0)
      : ctx.createLinearGradient(x0+hw-12,0,x0+hw,0);
    ew2.addColorStop(0,"rgba(140,100,40,0)"); ew2.addColorStop(1,"rgba(140,100,40,.22)");
    ctx.fillStyle=ew2; ctx.fillRect(x0+hw-18,0,18,H);
    const ewt=ctx.createLinearGradient(0,0,0,12);
    ewt.addColorStop(0,"rgba(140,100,40,.18)"); ewt.addColorStop(1,"rgba(140,100,40,0)");
    ctx.fillStyle=ewt; ctx.fillRect(x0,0,hw,14);
    const ewb=ctx.createLinearGradient(0,H-12,0,H);
    ewb.addColorStop(0,"rgba(140,100,40,0)"); ewb.addColorStop(1,"rgba(140,100,40,.18)");
    ctx.fillStyle=ewb; ctx.fillRect(x0,H-14,hw,14);
  }

  // â”€â”€ Double border on each page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const gold1="rgba(160,105,22,.55)", gold2="rgba(120,78,15,.35)";
  [[0,hw],[hw,hw]].forEach(([x0,w2])=>{
    const pm=w2*.044, pm2=w2*.060;
    ctx.strokeStyle=gold1; ctx.lineWidth=.9;
    ctx.strokeRect(x0+pm,H*.044,w2-pm*2,H*(1-.088));
    ctx.strokeStyle=gold2; ctx.lineWidth=.65;
    ctx.strokeRect(x0+pm2,H*.060,w2-pm2*2,H*(1-.12));
  });

  // â”€â”€ Text: right page (odd) on right half, left page (even) on left half â”€â”€
  _drawPageText(ctx, rightAyahs, rightPn, hw, 0, hw, H);  // right half
  _drawPageText(ctx, leftAyahs,  leftPn,  0,  0, hw, H);  // left half

  return cvs;
}

function _drawPageText(ctx, ayahs, pn, x0, y0, w, h){
  if(!ayahs||!ayahs.length) return;

  const PAD  = Math.max(w*.078, 9);
  const PADt = Math.max(h*.065, 7);
  const BOT  = h - Math.max(h*.055, 6);
  const TW   = w - PAD*2;

  // Font â€” scales to available space, clamped for legibility
  const fs  = Math.max(Math.min(h/18.5, w/21, 17), 10);
  const lh  = fs * 1.52;
  const hfs = Math.max(fs*.56, 8);
  const bfs = Math.max(fs*.98, 11);

  // Top ornament rule
  ctx.save();
  ctx.strokeStyle="rgba(139,90,20,.30)"; ctx.lineWidth=.8;
  ctx.beginPath(); ctx.moveTo(x0+PAD*.85,y0+PADt-4); ctx.lineTo(x0+w-PAD*.85,y0+PADt-4); ctx.stroke();
  ctx.restore();

  let y=y0+PADt;

  // Group by surah
  const groups=[];
  (ayahs||[]).forEach(a=>{
    const last=groups[groups.length-1];
    if(!last||last.sn!==a.surah.number)
      groups.push({sn:a.surah.number,name:a.surah.name,eng:a.surah.englishName,ayahs:[]});
    groups[groups.length-1].ayahs.push(a);
  });

  for(const g of groups){
    if(g.ayahs[0]?.numberInSurah===1){
      y+=lh*.22;
      // header band
      ctx.save();
      const grd=ctx.createLinearGradient(x0+PAD,0,x0+w-PAD,0);
      grd.addColorStop(0,"rgba(139,90,20,.0)");
      grd.addColorStop(.3,"rgba(139,90,20,.09)");
      grd.addColorStop(.7,"rgba(139,90,20,.09)");
      grd.addColorStop(1,"rgba(139,90,20,.0)");
      ctx.fillStyle=grd;
      ctx.fillRect(x0+PAD*.7,y,w-PAD*1.4,lh*.92);

      ctx.strokeStyle="rgba(139,90,20,.32)"; ctx.lineWidth=.7;
      ctx.beginPath(); ctx.moveTo(x0+PAD*.75,y); ctx.lineTo(x0+w-PAD*.75,y); ctx.stroke();

      // English name left
      ctx.font=`italic ${hfs}px Georgia,serif`;
      ctx.fillStyle="rgba(65,35,5,.80)";
      ctx.textAlign="left"; ctx.textBaseline="middle"; ctx.direction="ltr";
      ctx.fillText(g.eng.toUpperCase(), x0+PAD*.85, y+lh*.46);

      // Arabic name right
      ctx.font=`${Math.max(hfs*1.3,10)}px 'Amiri Quran','Scheherazade New',serif`;
      ctx.fillStyle="rgba(75,40,6,.82)";
      ctx.textAlign="right"; ctx.textBaseline="middle"; ctx.direction="rtl";
      ctx.fillText(g.name, x0+w-PAD*.85, y+lh*.46);

      y+=lh*.92;
      ctx.strokeStyle="rgba(139,90,20,.32)"; ctx.lineWidth=.7;
      ctx.beginPath(); ctx.moveTo(x0+PAD*.75,y); ctx.lineTo(x0+w-PAD*.75,y); ctx.stroke();
      ctx.restore();
      y+=lh*.22;

      // Basmala
      if(g.sn!==9 && y+bfs*1.5<y0+BOT){
        ctx.save();
        ctx.font=`${bfs}px 'Amiri Quran','Scheherazade New',serif`;
        ctx.fillStyle="rgba(24,10,2,.87)";
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.direction="rtl";
        ctx.fillText("\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064e\u0647\u0650 \u0671\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0670\u0646\u0650 \u0671\u0644\u0631\u0651\u064e\u062d\u0650\u064a\u0645\u0650",
          x0+w/2, y+bfs*.55);
        ctx.restore();
        y+=lh*1.0;
      }
    }

    // Word-wrap ayahs
    ctx.font=`${fs}px 'Amiri Quran','Scheherazade New',serif`;
    const lines=[];
    let cur="";
    for(const a of g.ayahs){
      const words=a.text.split(" ");
      words.forEach((wd,wi)=>{
        const token = wi===words.length-1 ? wd+" ï´¿"+a.numberInSurah+"ï´¾" : wd;
        const test  = cur ? cur+" "+token : token;
        ctx.font=`${fs}px 'Amiri Quran','Scheherazade New',serif`;
        if(ctx.measureText(test).width>TW && cur){ lines.push(cur); cur=token; }
        else cur=test;
      });
    }
    if(cur) lines.push(cur);

    ctx.save();
    ctx.font=`${fs}px 'Amiri Quran','Scheherazade New',serif`;
    ctx.fillStyle="rgba(18,7,2,.91)";
    ctx.direction="rtl"; ctx.textAlign="right"; ctx.textBaseline="alphabetic";
    for(const ln of lines){
      if(y+lh>y0+BOT) break;
      ctx.fillText(ln, x0+w-PAD, y+lh);
      y+=lh;
    }
    ctx.restore();
    y+=lh*.12;
  }

  // Page number + ornament
  const pnfs=Math.max(h*.027,7);
  ctx.save();
  ctx.strokeStyle="rgba(139,90,20,.26)"; ctx.lineWidth=.7;
  ctx.beginPath();
  ctx.moveTo(x0+PAD*.85,y0+BOT+3); ctx.lineTo(x0+w-PAD*.85,y0+BOT+3);
  ctx.stroke();

  const oy=y0+BOT+3+pnfs*1.1;
  const dd=pnfs*.38;
  ctx.fillStyle="rgba(120,78,18,.36)";
  [[x0+w/2-dd*5.5,oy],[x0+w/2+dd*5.5,oy]].forEach(([px2,py2])=>{
    ctx.beginPath();
    ctx.moveTo(px2,py2-dd*.65); ctx.lineTo(px2+dd*.65,py2);
    ctx.lineTo(px2,py2+dd*.65); ctx.lineTo(px2-dd*.65,py2);
    ctx.closePath(); ctx.fill();
  });

  ctx.font=`${pnfs}px 'Cinzel',Georgia,serif`;
  ctx.fillStyle="rgba(108,68,16,.46)";
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(String(pn), x0+w/2, oy);
  ctx.restore();
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function QuranBook3DPage({ surahs }) {
  const navigate = useNavigate();

  const cvs3 = React.useRef(null);  // single WebGL canvas
  const raf3 = React.useRef(null);
  const gl3  = React.useRef(null);
  const glState = React.useRef({
    pageProg: null, coverProg: null,
    buf: null, uvBuf: null,
    texCur: null, texNext: null,
  });

  const pd  = React.useRef({});    // pageNum â†’ ayahs[] (null=loading)
  const tx0 = React.useRef(0);

  const SR = React.useRef({
    curl: 0, targetCurl: 0, dir: 1,
    spread: 0,
    flipping: false,
    time: 0,
    phase: "cover",   // "cover"|"open"
    texDirty: true,   // need to re-upload textures
  });

  const [sp,    setSp]    = React.useState(0);
  const [ph,    setPh]    = React.useState("cover");
  const [smenu, setSmenu] = React.useState(false);
  const [bm,    setBm]    = React.useState(()=>parseInt(localStorage.getItem("q3d_bm")||"0")||0);
  const [sz,    setSz]    = React.useState({w:860,h:522});
  const [ready, setReady] = React.useState(false);

  // Responsive size
  React.useEffect(()=>{
    const u=()=>{
      const vw=window.innerWidth, vh=window.innerHeight;
      const w=Math.min((vw-14)*.97, (vh-85)*1.63, 980);
      setSz({w:Math.round(w), h:Math.round(w/1.63)});
    };
    u(); window.addEventListener("resize",u);
    return()=>window.removeEventListener("resize",u);
  },[]);

  // â”€â”€ Build and upload spread textures to WebGL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const uploadSpreadTex = React.useCallback((spread, which="cur")=>{
    const gl=gl3.current; const gls=glState.current;
    if(!gl||spread===0) return;
    const rp=2*spread-1, lp=Math.min(2*spread,_MUSHAF_PAGES);
    const rd=pd.current[rp], ld=pd.current[lp];
    if(!rd||!ld) return;  // not loaded yet
    const cvs=_renderSpread(ld, lp, rd, rp, sz.w, sz.h);
    const tex=which==="cur"?gls.texCur:gls.texNext;
    _uploadTex(gl,tex,cvs);
  },[sz.w, sz.h]);

  // â”€â”€ Prefetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const prefetch=React.useCallback(async(spread, onReady)=>{
    if(spread===0) return;
    const pages=[
      2*spread-1, 2*spread,
      2*spread+1, 2*spread+2,
      2*spread-3, 2*spread-2,
    ].filter(p=>p>=1&&p<=_MUSHAF_PAGES);

    const crit=[2*spread-1,2*spread].filter(p=>p>=1&&p<=_MUSHAF_PAGES);

    // load critical first
    await Promise.all(crit.map(async p=>{
      if(pd.current[p]!==undefined) return;
      pd.current[p]=null;
      try{
        const d=await fetch(`${_API3D}/page/${p}/quran-uthmani`).then(r=>r.json()).then(r=>r.data?.ayahs||[]);
        pd.current[p]=d;
      }catch{ pd.current[p]=[]; }
    }));

    if(onReady) onReady();

    // load rest in background
    for(const p of pages){
      if(pd.current[p]!==undefined) continue;
      pd.current[p]=null;
      try{
        const d=await fetch(`${_API3D}/page/${p}/quran-uthmani`).then(r=>r.json()).then(r=>r.data?.ayahs||[]);
        pd.current[p]=d;
      }catch{ pd.current[p]=[]; }
    }
  },[]);

  // â”€â”€ WebGL init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  React.useEffect(()=>{
    const cvs=cvs3.current; if(!cvs)return;
    const gl=cvs.getContext("webgl",{antialias:true,alpha:false});
    if(!gl){console.error("WebGL not available");return;}
    gl3.current=gl;

    const gls=glState.current;
    gls.pageProg  = _cprog(gl,_VS3D,_PAGE_FS);
    gls.coverProg = _cprog(gl,_VS3D,_CVR_FS);

    // Full-screen quad
    const verts=new Float32Array([-1,-1, 1,-1, -1,1, 1,-1, 1,1, -1,1]);
    const uvs  =new Float32Array([ 0, 1,  1, 1,  0,0,  1, 1, 1,0,  0,0]);
    gls.buf   = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,gls.buf);
    gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
    gls.uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,gls.uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER,uvs,gl.STATIC_DRAW);

    gls.texCur  = _makeTex(gl);
    gls.texNext = _makeTex(gl);

    let lastSp=-1, lastW=0, lastH=0;

    const draw=(ts)=>{
      const s=SR.current;
      s.time=ts*.001;

      // smooth curl
      const diff=s.targetCurl-s.curl;
      s.curl+=diff*(diff>0?.15:.18);
      if(Math.abs(diff)<.003){
        s.curl=s.targetCurl;
        if(s.targetCurl===1&&s.flipping){
          s.flipping=false; s.curl=0; s.targetCurl=0;
          s.spread+=s.dir>0?1:-1;
          s.spread=Math.max(1,Math.min(302,s.spread));
          s.texDirty=true;
          setSp(s.spread);
          setReady(false);
          prefetch(s.spread,()=>{
            uploadSpreadTex(s.spread,"cur");
            prefetch(s.spread+1,()=>uploadSpreadTex(s.spread+1,"next"));
            prefetch(s.spread-1,()=>uploadSpreadTex(s.spread-1,"next"));
            setReady(true);
          });
        }
      }

      // re-upload textures when spread changed or canvas resized
      if(s.phase==="open" && (s.spread!==lastSp||sz.w!==lastW||sz.h!==lastH)){
        lastSp=s.spread; lastW=sz.w; lastH=sz.h;
        uploadSpreadTex(s.spread,"cur");
      }

      gl.viewport(0,0,cvs.width,cvs.height);
      gl.clearColor(.028,.012,.003,1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const usePageProg = s.phase==="open";
      const prog = usePageProg ? gls.pageProg : gls.coverProg;
      gl.useProgram(prog);

      // bind vertex pos
      const aPos=gl.getAttribLocation(prog,"a_pos");
      gl.bindBuffer(gl.ARRAY_BUFFER,gls.buf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);

      // bind uv (cover shader also has varying v_uv via a_pos*.5+.5, but page shader uses a_uv)
      const aUv=gl.getAttribLocation(prog,"a_uv");
      if(aUv>=0){
        gl.bindBuffer(gl.ARRAY_BUFFER,gls.uvBuf);
        gl.enableVertexAttribArray(aUv);
        gl.vertexAttribPointer(aUv,2,gl.FLOAT,false,0,0);
      }

      gl.uniform1f(gl.getUniformLocation(prog,"u_time"),s.time);

      if(usePageProg){
        gl.uniform1f(gl.getUniformLocation(prog,"u_curl"),s.curl);
        gl.uniform1f(gl.getUniformLocation(prog,"u_dir"),s.dir);

        // texCur â†’ unit 0
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,gls.texCur);
        gl.uniform1i(gl.getUniformLocation(prog,"u_tex"),0);

        // texNext â†’ unit 1
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D,gls.texNext);
        gl.uniform1i(gl.getUniformLocation(prog,"u_texNext"),1);
      }

      gl.drawArrays(gl.TRIANGLES,0,6);
      raf3.current=requestAnimationFrame(draw);
    };
    raf3.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(raf3.current);
  },[]); // eslint-disable-line

  // Resize canvas
  React.useEffect(()=>{
    const c=cvs3.current; if(!c)return;
    c.width=sz.w; c.height=sz.h;
    if(SR.current.phase==="open") uploadSpreadTex(SR.current.spread,"cur");
  },[sz,uploadSpreadTex]);

  // â”€â”€ Open book â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openBook=React.useCallback(()=>{
    const s=SR.current; if(s.phase!=="cover")return;
    s.spread=1; s.phase="open"; setPh("open"); setSp(1); setReady(false);
    prefetch(1,()=>{
      uploadSpreadTex(1,"cur");
      prefetch(2,()=>uploadSpreadTex(2,"next"));
      setReady(true);
    });
  },[prefetch,uploadSpreadTex]);

  // â”€â”€ Flip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startFlip=React.useCallback((dir)=>{
    const s=SR.current;
    if(s.flipping||s.phase!=="open") return;
    if(dir>0&&2*(s.spread+1)-1>_MUSHAF_PAGES) return;
    if(dir<0&&s.spread<=1) return;

    const next=s.spread+dir;
    const doFlip=()=>{
      // upload next spread to texNext before flipping
      uploadSpreadTex(next,"next");
      s.flipping=true; s.dir=dir; s.curl=0; s.targetCurl=1;
    };

    // ensure next spread is loaded
    const np=[2*next-1,2*next].filter(p=>p>=1&&p<=_MUSHAF_PAGES);
    const missing=np.filter(p=>pd.current[p]===undefined);
    if(missing.length===0){
      doFlip();
    } else {
      Promise.all(missing.map(async p=>{
        if(pd.current[p]!==undefined)return;
        pd.current[p]=null;
        try{
          const d=await fetch(`${_API3D}/page/${p}/quran-uthmani`).then(r=>r.json()).then(r=>r.data?.ayahs||[]);
          pd.current[p]=d;
        }catch{pd.current[p]=[];}
      })).then(doFlip);
    }
  },[uploadSpreadTex]);

  const flipFwd =React.useCallback(()=>startFlip(1), [startFlip]);
  const flipBwd =React.useCallback(()=>startFlip(-1),[startFlip]);

  const jumpTo=React.useCallback((pn)=>{
    const s=SR.current; if(s.phase!=="open")return;
    const p=Math.max(1,Math.min(_MUSHAF_PAGES,parseInt(pn)||1));
    s.spread=Math.ceil(p/2); s.curl=0; s.targetCurl=0; s.flipping=false;
    setSp(s.spread); setReady(false); setSmenu(false);
    prefetch(s.spread,()=>{
      uploadSpreadTex(s.spread,"cur");
      prefetch(s.spread+1,()=>uploadSpreadTex(s.spread+1,"next"));
      setReady(true);
    });
  },[prefetch,uploadSpreadTex]);

  // Keyboard
  React.useEffect(()=>{
    const h=e=>{if(e.key==="ArrowLeft")flipFwd();if(e.key==="ArrowRight")flipBwd();};
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[flipFwd,flipBwd]);

  const rp=2*sp-1, lp=Math.min(2*sp,_MUSHAF_PAGES);
  const BB={
    fontSize:9,letterSpacing:1.6,padding:"6px 14px",
    fontFamily:"'Cinzel',serif",
    background:"rgba(201,168,76,.07)",
    border:"1px solid rgba(201,168,76,.26)",
    color:"rgba(201,168,76,.68)",
    borderRadius:7,cursor:"pointer",transition:"all .18s",
  };
  const BBh=(e,on)=>{
    e.currentTarget.style.background=on?"rgba(201,168,76,.17)":"rgba(201,168,76,.07)";
    e.currentTarget.style.borderColor=on?"rgba(201,168,76,.52)":"rgba(201,168,76,.26)";
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",
      background:"radial-gradient(ellipse at 50% 28%,#1e0d03 0%,#060200 100%)",
      alignItems:"center",justifyContent:"space-between",
      overflow:"hidden",userSelect:"none",fontFamily:"'Cinzel',Georgia,serif"}}>

      {/* ambient floor */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"70%",height:55,pointerEvents:"none",
        background:"radial-gradient(ellipse,rgba(170,105,18,.13) 0%,transparent 70%)"}}/>

      {/* â”€â”€ Top bar â”€â”€ */}
      <div style={{display:"flex",alignItems:"center",gap:10,width:"100%",
        maxWidth:sz.w+40,padding:"8px 16px",boxSizing:"border-box",flexShrink:0,
        background:"linear-gradient(to bottom,rgba(0,0,0,.42),transparent)",flexWrap:"wrap"}}>

        <button onClick={()=>navigate("/quran")} style={{...BB,flexShrink:0}}
          onMouseEnter={e=>BBh(e,true)} onMouseLeave={e=>BBh(e,false)}>â† SOURATES</button>

        <div style={{fontFamily:"'Amiri Quran',serif",
          fontSize:Math.max(sz.w*.022,13),
          color:"rgba(201,168,76,.50)",direction:"rtl",flex:1,textAlign:"center",
          textShadow:"0 0 18px rgba(201,168,76,.18)"}}>Ø§Ù„Ù‚Ø±Ø¢Ù† Ø§Ù„ÙƒØ±ÙŠÙ…</div>

        {ph==="open"&&<>
          {/* Surah picker */}
          <div style={{position:"relative",flexShrink:0}}>
            <button onClick={()=>setSmenu(v=>!v)} style={BB}
              onMouseEnter={e=>BBh(e,true)} onMouseLeave={e=>BBh(e,false)}>SOURATE â–¾</button>
            {smenu&&(
              <div style={{position:"absolute",top:"115%",right:0,zIndex:200,
                background:"linear-gradient(160deg,#150902,#0d0500)",
                border:"1px solid rgba(201,168,76,.20)",borderRadius:10,
                maxHeight:260,overflowY:"auto",minWidth:220,
                boxShadow:"0 14px 55px rgba(0,0,0,.9)"}}>
                {surahs.map(s=>(
                  <div key={s.number}
                    onClick={()=>jumpTo(s.startPage||(s.number*2-1))}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",
                      cursor:"pointer",borderBottom:"1px solid rgba(201,168,76,.05)"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(201,168,76,.1)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{fontSize:8,color:"rgba(201,168,76,.36)",minWidth:18,flexShrink:0}}>{s.number}</span>
                    <span style={{fontFamily:"'Amiri Quran',serif",fontSize:14,color:"#c9a84c",direction:"rtl"}}>{s.name}</span>
                    <span style={{fontSize:7,color:"rgba(201,168,76,.30)",marginLeft:"auto",flexShrink:0}}>{s.englishName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bookmark */}
          <button onClick={()=>{setBm(rp);localStorage.setItem("q3d_bm",String(rp));}}
            style={{...BB,fontSize:13,padding:"3px 7px",flexShrink:0,
              color:bm===rp?"#c0392b":"rgba(201,168,76,.35)"}}>ğŸ”–</button>
          {bm>0&&bm!==rp&&(
            <button onClick={()=>jumpTo(bm)} style={{...BB,flexShrink:0}}
              onMouseEnter={e=>BBh(e,true)} onMouseLeave={e=>BBh(e,false)}>p.{bm}</button>
          )}

          {/* Page jump */}
          <input type="number" defaultValue={rp} key={rp}
            onKeyDown={e=>e.key==="Enter"&&jumpTo(e.target.value)}
            onBlur={e=>jumpTo(e.target.value)}
            style={{width:44,textAlign:"center",background:"rgba(0,0,0,.22)",
              border:"1px solid rgba(201,168,76,.20)",borderRadius:6,
              padding:"4px 4px",color:"#c9a84c",fontSize:11,
              fontFamily:"'Cinzel',serif",outline:"none",flexShrink:0}}/>
          <span style={{fontSize:7,color:"rgba(201,168,76,.26)",flexShrink:0}}>/604</span>

          {/* Loading dot */}
          {!ready&&<div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,
            background:"rgba(201,168,76,.55)",
            animation:"q3dpulse 1s ease-in-out infinite"}}/>}
        </>}
      </div>

      {/* â”€â”€ Book scene â”€â”€ */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",
        width:"100%",position:"relative"}}
        onTouchStart={e=>{tx0.current=e.touches[0].clientX;}}
        onTouchEnd={e=>{
          const dx=e.changedTouches[0].clientX-tx0.current;
          if(dx<-55)flipFwd(); if(dx>55)flipBwd();
        }}>

        <div style={{perspective:3600,perspectiveOrigin:"50% 38%",
          display:"flex",alignItems:"center",justifyContent:"center",
          width:sz.w+80,height:sz.h+60}}>

          <div style={{position:"relative",width:sz.w,height:sz.h,
            transform:ph==="cover"
              ? "rotateX(8deg) rotateY(-5deg)"
              : "rotateX(5deg) rotateY(0deg)",
            transformStyle:"preserve-3d",
            transition:"transform .7s cubic-bezier(.4,0,.2,1)",
            filter:`drop-shadow(0 ${sz.h*.11}px ${sz.h*.16}px rgba(0,0,0,.97))
                    drop-shadow(0 ${sz.h*.03}px ${sz.h*.05}px rgba(0,0,0,.70))`,
            cursor:ph==="cover"?"pointer":"default"}}
            onClick={ph==="cover"?openBook:undefined}>

            {/* â”€â”€ Single WebGL canvas â€” renders everything â”€â”€ */}
            <canvas ref={cvs3} width={sz.w} height={sz.h}
              style={{position:"absolute",top:0,left:0,display:"block",
                borderRadius:"1px 2px 2px 1px"}}/>

            {/* 3D Spine overlay (DOM element for depth) */}
            {ph==="open"&&(
              <div style={{position:"absolute",top:0,bottom:0,left:"50%",
                width:26,transform:"translateX(-50%) translateZ(1px)",
                zIndex:40,pointerEvents:"none",
                background:"linear-gradient(to right,#060200 0%,#321203 17%,#8a3a0e 33%,#d08c38 50%,#8a3a0e 67%,#321203 83%,#060200 100%)",
                boxShadow:"0 0 22px rgba(0,0,0,.88),inset 0 0 7px rgba(255,195,75,.10)"}}>
                <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(to bottom,transparent 0,transparent 22px,rgba(255,182,50,.06) 22px,rgba(255,182,50,.06) 23px)"}}/>
                <div style={{position:"absolute",top:0,bottom:0,left:"15%",width:1,background:"rgba(255,205,95,.10)"}}/>
                <div style={{position:"absolute",top:0,bottom:0,right:"15%",width:1,background:"rgba(255,205,95,.10)"}}/>
              </div>
            )}

            {/* Cover boards (top / bottom 3D depth) */}
            <div style={{position:"absolute",top:-6,left:3,right:3,height:7,
              background:"linear-gradient(135deg,#380d04,#7a2b0a,#380d04)",
              borderRadius:"2px 2px 0 0",
              boxShadow:"0 -3px 8px rgba(0,0,0,.65)"}}/>
            <div style={{position:"absolute",bottom:-6,left:3,right:3,height:7,
              background:"linear-gradient(135deg,#380d04,#7a2b0a,#380d04)",
              borderRadius:"0 0 2px 2px",
              boxShadow:"0 3px 8px rgba(0,0,0,.65)"}}/>

            {/* Click zones */}
            {ph==="open"&&<>
              <div onClick={flipBwd}
                style={{position:"absolute",top:0,right:0,width:"45%",height:"100%",
                  zIndex:50,cursor:"pointer"}}
                title="Page prÃ©cÃ©dente (â†’)"/>
              <div onClick={flipFwd}
                style={{position:"absolute",top:0,left:0,width:"45%",height:"100%",
                  zIndex:50,cursor:"pointer"}}
                title="Page suivante (â†)"/>
            </>}

            {/* Cover CTA */}
            {ph==="cover"&&(
              <div style={{position:"absolute",bottom:"19%",left:0,right:0,
                textAlign:"center",zIndex:60,pointerEvents:"none"}}>
                <div style={{display:"inline-block",
                  fontSize:Math.max(sz.w*.009,8),
                  letterSpacing:Math.max(sz.w*.003,2.5),
                  color:"rgba(201,168,76,.72)",
                  border:"1px solid rgba(201,168,76,.24)",
                  padding:`${Math.max(sz.h*.008,4)}px ${Math.max(sz.w*.02,13)}px`,
                  borderRadius:30,background:"rgba(0,0,0,.38)",
                  textShadow:"0 0 14px rgba(201,168,76,.40)",
                  animation:"q3dpulse 2.6s ease-in-out infinite"}}>
                  OUVRIR LE LIVRE
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side arrow hints */}
        {ph==="open"&&<>
          {[{side:"right",dir:-1,char:"â€º"},{side:"left",dir:1,char:"â€¹"}].map(({side,dir,char})=>(
            <div key={side}
              onClick={dir>0?flipFwd:flipBwd}
              style={{position:"absolute",[side]:Math.max(sz.w*.004,5),
                top:"50%",transform:"translateY(-50%)",zIndex:100,cursor:"pointer",
                fontSize:Math.max(sz.w*.03,20),color:"rgba(201,168,76,.17)",
                transition:"color .22s,transform .22s",userSelect:"none"}}
              onMouseEnter={e=>{e.currentTarget.style.color="rgba(201,168,76,.65)";e.currentTarget.style.transform="translateY(-50%) scale(1.18)";}}
              onMouseLeave={e=>{e.currentTarget.style.color="rgba(201,168,76,.17)";e.currentTarget.style.transform="translateY(-50%) scale(1)";}}>
              {char}
            </div>
          ))}
        </>}
      </div>

      {/* â”€â”€ Bottom nav â”€â”€ */}
      {ph==="open"&&(
        <div style={{display:"flex",alignItems:"center",gap:12,
          padding:"8px 0 14px",flexShrink:0,flexWrap:"wrap",justifyContent:"center"}}>
          <button style={BB} onClick={flipBwd} disabled={sp<=1}
            onMouseEnter={e=>BBh(e,true)} onMouseLeave={e=>BBh(e,false)}>â†’ PRÃ‰C.</button>
          <div style={{textAlign:"center",minWidth:80}}>
            <div style={{fontSize:10,letterSpacing:2,color:"rgba(201,168,76,.48)"}}>
              {rp}{lp<=_MUSHAF_PAGES?"â€“"+lp:""}
            </div>
            <div style={{width:86,height:2,background:"rgba(201,168,76,.10)",
              borderRadius:2,marginTop:4,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:2,
                background:"linear-gradient(to right,#7a3c0a,#c9a84c)",
                width:`${(rp/_MUSHAF_PAGES)*100}%`,transition:"width .5s"}}/>
            </div>
          </div>
          <button style={BB} onClick={flipFwd} disabled={lp>=_MUSHAF_PAGES}
            onMouseEnter={e=>BBh(e,true)} onMouseLeave={e=>BBh(e,false)}>SUIV. â†</button>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Amiri+Quran&display=swap');
        @keyframes q3dpulse{0%,100%{opacity:.48;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,.22);border-radius:2px}
      `}</style>
    </div>
  );
}



// â”€â”€â”€ UnknownWordQuestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Shows full ayat with the unknown word replaced by â–¢â–¢â–¢ â€” user types the word
function UnknownWordQuestion({ q, onAnswer }) {
  const answerWords = React.useMemo(() => (q.answer || '').split('|').filter(Boolean), [q.answer]);
  const isMulti = answerWords.length > 1;
  const [vals,      setVals]     = React.useState(() => answerWords.map(() => ''));
  const [shaken,    setShaken]   = React.useState(false);
  const [revealed,  setRevealed] = React.useState(false);
  const [checked,   setChecked]  = React.useState(false);
  const [correctArr,setCorrectArr] = React.useState([]); // per-word correctness

  const correct = correctArr.length > 0 && correctArr.every(Boolean);

  const _normQ = s => s.trim().replace(/[Ø-Ù‹Øš-Ù°ÙŸÛ–-Û­\u200c]/g,'').replace(/Ø£|Ø¥|Ø¢/g,'Ø§').replace(/Ø©/g,'Ù‡').replace(/Ù‰/g,'ÙŠ');

  const setValAt = (i, v) => setVals(prev => prev.map((p, pi) => pi === i ? v : p));

  const submit = () => {
    if (vals.some(v => !v.trim())) return;
    const results = answerWords.map((w, i) => _normQ(vals[i]) === _normQ(w));
    if (results.some(r => !r)) { setShaken(true); setTimeout(() => setShaken(false), 500); }
    setCorrectArr(results);
    setChecked(true);
  };

  const reveal = () => { setRevealed(true); setChecked(true); setCorrectArr(answerWords.map(() => false)); };

  const proceed = (removeRevise) => onAnswer(correct, removeRevise);

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      {/* Ayat with masked word(s) */}
      <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, direction:'rtl',
        textAlign:'center', color:'var(--text1)', padding:'12px 16px', width:'100%',
        background:'var(--surface3)', borderRadius:9, border:'1px solid var(--border)', lineHeight:2.4 }}>
        {q.questionData}
      </div>

      {!checked ? (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
            {answerWords.map((_, i) => (
              <input key={i} autoFocus={i === 0} value={vals[i]}
                onChange={e => setValAt(i, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder={isMulti ? `Mot manquant ${i+1}/${answerWords.length}â€¦` : "Ã‰cris le mot arabe manquantâ€¦"}
                dir="rtl"
                style={{ width:'100%', padding:'10px 14px', fontSize:18,
                  fontFamily:"'Amiri Quran',serif", direction:'rtl', textAlign:'center',
                  background:'var(--surface3)', border:`1px solid ${shaken?'var(--red)':'var(--border2)'}`,
                  borderRadius:8, color:'var(--text1)', outline:'none',
                  animation: shaken ? 'qshake .4s' : 'none' }} />
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={submit}
              style={{ padding:'8px 22px', background:'var(--teal)', border:'none',
                borderRadius:7, color:'#fff', fontSize:9, letterSpacing:2,
                fontFamily:"'Cinzel',serif", cursor:'pointer' }}>VALIDER</button>
            <button onClick={reveal}
              style={{ padding:'8px 16px', background:'transparent',
                border:'1px solid var(--border2)', borderRadius:7,
                color:'var(--text3)', fontSize:9, letterSpacing:1,
                fontFamily:"'Cinzel',serif", cursor:'pointer' }}>{isMulti ? 'VOIR LES MOTS' : 'VOIR LE MOT'}</button>
          </div>
        </>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', alignItems:'center' }}>
          {/* Feedback */}
          <div style={{ fontSize:13, fontFamily:"'Cinzel',serif", letterSpacing:1,
            color: correct ? 'var(--green)' : 'var(--red)' }}>
            {correct ? 'âœ“ EXACT !' : revealed ? (isMulti ? 'ğŸ“– RÃ‰PONSES :' : 'ğŸ“– RÃ‰PONSE :') : (isMulti ? 'âœ— RÃ©ponses :' : 'âœ— RÃ©ponse :')}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
            {answerWords.map((w, i) => (
              <div key={i} style={{ fontFamily:"'Amiri Quran',serif", fontSize:24, direction:'rtl', textAlign:'center',
                padding:'10px 18px', borderRadius:8,
                background: correctArr[i] ? 'rgba(76,175,129,.08)' : 'rgba(201,168,76,.07)',
                border: `1px solid ${correctArr[i] ? 'var(--green)' : 'var(--gold)'}`,
                color: correctArr[i] ? 'var(--green)' : 'var(--gold2)' }}>
                {w}
                {isMulti && <span style={{fontSize:11,marginRight:6}}>{correctArr[i] ? ' âœ“' : (revealed ? '' : ' âœ—')}</span>}
              </div>
            ))}
          </div>

          {/* If toRevise: ask whether to keep or remove from Ã -rÃ©viser */}
          {q.toRevise ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center', width:'100%' }}>
              <div style={{ fontSize:8, letterSpacing:1.5, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
                ğŸ”– RETIRER DE LA LISTE Ã€ RÃ‰VISER ?
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => proceed(true)}
                  style={{ padding:'7px 16px', background:'rgba(76,175,129,.1)',
                    border:'1px solid var(--green)', borderRadius:7, color:'var(--green)',
                    fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  âœ“ OUI â€” MAÃTRISÃ‰
                </button>
                <button onClick={() => proceed(false)}
                  style={{ padding:'7px 16px', background:'rgba(255,80,80,.08)',
                    border:'1px solid var(--red)', borderRadius:7, color:'var(--red)',
                    fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  ğŸ”– GARDER
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', gap:10 }}>
              {!correct && (
                <button onClick={() => onAnswer(false)}
                  style={{ padding:'7px 18px', background:'rgba(255,80,80,.12)',
                    border:'1px solid var(--red)', borderRadius:7, color:'var(--red)',
                    fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  âœ— Ã€ REVOIR
                </button>
              )}
              <button onClick={() => onAnswer(correct)}
                style={{ padding:'7px 18px', background: correct ? 'rgba(76,175,129,.12)' : 'rgba(255,255,255,.05)',
                  border:`1px solid ${correct ? 'var(--green)' : 'var(--border2)'}`,
                  borderRadius:7, color: correct ? 'var(--green)' : 'var(--text3)',
                  fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                {correct ? 'âœ“ CONTINUER' : 'CONTINUER â†’'}
              </button>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes qshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}60%{transform:translateX(6px)}80%{transform:translateX(-3px)}}`}</style>
    </div>
  );
}

// â”€â”€â”€ UnknownPickQuestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Shows full ayat â†’ user picks which words they don't know (multi-select MCQ)
// Correct = selecting exactly the unknown words
function UnknownPickQuestion({ q, onAnswer }) {
  const [selected, setSelected] = React.useState(new Set());
  const [checked,  setChecked]  = React.useState(false);
  const [result,   setResult]   = React.useState(null); // true/false

  const correctSet = new Set((q.answer || '').split('|').filter(Boolean));

  const toggle = (w) => {
    if (checked) return;
    setSelected(prev => {
      const n = new Set(prev);
      n.has(w) ? n.delete(w) : n.add(w);
      return n;
    });
  };

  const check = () => {
    // correct if selected set equals correctSet â€” empty selection is a valid
    // submission (e.g. no unknown/marked words left), not blocked anymore
    const correct = selected.size === correctSet.size &&
      [...selected].every(w => correctSet.has(w));
    setResult(correct);
    setChecked(true);
  };

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      {/* Full ayat display */}
      <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, direction:'rtl',
        textAlign:'center', color:'var(--text1)', padding:'12px 16px', width:'100%',
        background:'var(--surface3)', borderRadius:9, border:'1px solid var(--border)', lineHeight:2.4 }}>
        {q.questionData}
      </div>

      {/* Word chips */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center',
        direction:'rtl', width:'100%' }}>
        {(q.options || []).map((w, i) => {
          const isSel  = selected.has(w);
          const isCorr = checked && correctSet.has(w);
          const isWrong= checked && isSel && !correctSet.has(w);
          const isMissed=checked && !isSel && correctSet.has(w);
          return (
            <button key={i} onClick={() => toggle(w)}
              style={{
                fontFamily:"'Amiri Quran',serif", fontSize:18, direction:'rtl',
                padding:'6px 14px', borderRadius:8, cursor: checked?'default':'pointer',
                border: isCorr  ? '2px solid var(--green)'
                      : isWrong ? '2px solid var(--red)'
                      : isMissed? '2px dashed var(--gold)'
                      : isSel   ? '2px solid var(--teal)'
                      :           '1px solid var(--border2)',
                background: isCorr   ? 'rgba(76,175,129,.15)'
                           : isWrong  ? 'rgba(255,80,80,.12)'
                           : isMissed ? 'rgba(201,168,76,.10)'
                           : isSel    ? 'rgba(62,184,160,.12)'
                           :            'var(--surface3)',
                color:'var(--text1)',
                transition:'all .15s',
              }}>
              {w}
              {isCorr  && <span style={{fontSize:9,marginRight:4,color:'var(--green)'}}> âœ“</span>}
              {isWrong && <span style={{fontSize:9,marginRight:4,color:'var(--red)'}}>  âœ—</span>}
              {isMissed&& <span style={{fontSize:9,marginRight:4,color:'var(--gold)'}}>  !</span>}
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:.5 }}>
        {checked ? '' : q.toRevise
          ? `SÃ©lectionne ${correctSet.size} mot${correctSet.size>1?'s':''} marquÃ©${correctSet.size>1?'s':''} Ã  rÃ©viser`
          : `SÃ©lectionne ${correctSet.size} mot${correctSet.size>1?'s':''} inconnu${correctSet.size>1?'s':''}`}
      </div>

      {/* Actions */}
      {!checked ? (
        <button onClick={check}
          style={{ padding:'8px 24px', background:'var(--teal)',
            border:'none', borderRadius:7, color:'#fff',
            fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
            cursor:'pointer', transition:'all .2s' }}>
          VALIDER
        </button>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
          <div style={{ fontSize:11, letterSpacing:1,
            color: result?'var(--green)':'var(--red)',
            fontFamily:"'Cinzel',serif" }}>
            {result ? 'âœ“ EXACT !' : 'âœ— PAS TOUT Ã€ FAIT'}
          </div>
          {!result && (
            <div style={{ color:'var(--text3)', textAlign:'center', direction:'rtl',
              fontFamily:"'Amiri Quran',serif", fontSize:14 }}>
              {correctSet.size === 0
                ? (q.toRevise ? 'Aucun mot marquÃ© Ã  rÃ©viser' : 'Aucun mot inconnu')
                : `${q.toRevise ? 'Mots Ã  rÃ©viser' : 'Mots inconnus'} : ${[...correctSet].join('  Â·  ')}`}
            </div>
          )}
          {/* If toRevise: ask whether to keep or remove from Ã -rÃ©viser */}
          {q.toRevise ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center', width:'100%' }}>
              <div style={{ fontSize:8, letterSpacing:1.5, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
                ğŸ”– RETIRER DE LA LISTE Ã€ RÃ‰VISER ?
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => onAnswer(result, true)}
                  style={{ padding:'7px 16px', background:'rgba(76,175,129,.1)',
                    border:'1px solid var(--green)', borderRadius:7, color:'var(--green)',
                    fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  âœ“ OUI â€” MAÃTRISÃ‰
                </button>
                <button onClick={() => onAnswer(result, false)}
                  style={{ padding:'7px 16px', background:'rgba(255,80,80,.08)',
                    border:'1px solid var(--red)', borderRadius:7, color:'var(--red)',
                    fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  ğŸ”– GARDER
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => onAnswer(result)}
              style={{ padding:'7px 22px', background:'var(--surface3)',
                border:'1px solid var(--border2)', borderRadius:7, color:'var(--text3)',
                fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
              CONTINUER â†’
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ RevisePartQuestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RevisePartQuestion({ q, onAnswer }) {
  const [revealed, setRevealed] = React.useState(false);
  const audioRef = React.useRef(null);

  const partWords = q.partText ? q.partText.split(' ').filter(Boolean) : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, alignItems:'center', width:'100%' }}>
      {/* Context: full ayat text with part highlighted */}
      {q.questionData && (
        <div style={{ direction:'rtl', fontFamily:"'Amiri Quran',serif", fontSize:17,
          textAlign:'center', lineHeight:1.9, color:'var(--text3)',
          background:'var(--surface3)', borderRadius:8, padding:'10px 14px', width:'100%' }}>
          {q.questionData.split(' ').filter(Boolean).map((w, i) => {
            const partWs = q.partText?.split(' ').filter(Boolean) || [];
            const startIdx = q.questionData.split(' ').filter(Boolean).findIndex((_, si) =>
              q.questionData.split(' ').filter(Boolean).slice(si, si + partWs.length).join(' ') === q.partText
            );
            const inPart = startIdx >= 0 && i >= startIdx && i < startIdx + partWs.length;
            return (
              <span key={i} style={{ color: inPart ? '#c878ff' : 'var(--text3)',
                background: inPart ? 'rgba(200,120,255,.08)' : 'transparent',
                borderRadius:3, padding:'0 2px', marginLeft:4 }}>{w}</span>
            );
          })}
        </div>
      )}

      {!revealed ? (
        <>
          <div style={{ fontSize:9, letterSpacing:1.5, color:'#c878ff', fontFamily:"'Cinzel',serif" }}>
            PARTIE {q.partIdx + 1} Â· {partWords.length} MOTS
          </div>
          <div style={{ fontSize:9, color:'var(--text3)', textAlign:'center', lineHeight:1.6 }}>
            RÃ©cite cette partie de mÃ©moire, puis rÃ©vÃ¨le pour vÃ©rifier
          </div>
          <button onClick={() => setRevealed(true)}
            style={{ padding:'8px 28px', background:'rgba(200,120,255,.12)',
              border:'1px solid #c878ff', borderRadius:7, color:'#c878ff',
              fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
            RÃ‰VÃ‰LER
          </button>
        </>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center', width:'100%' }}>
          <div style={{ direction:'rtl', fontFamily:"'Amiri Quran',serif", fontSize:22,
            textAlign:'center', lineHeight:2, color:'var(--text1)',
            background:'rgba(200,120,255,.06)', borderRadius:8, padding:'12px 16px', width:'100%',
            border:'1px solid rgba(200,120,255,.2)' }}>
            {q.partText}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => onAnswer(false)}
              style={{ padding:'7px 20px', background:'rgba(229,115,115,.1)',
                border:'1px solid var(--red)', borderRadius:7, color:'var(--red)',
                fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
              âœ— Ã€ REVOIR
            </button>
            <button onClick={() => onAnswer(true)}
              style={{ padding:'7px 20px', background:'rgba(76,175,129,.1)',
                border:'1px solid var(--green)', borderRadius:7, color:'var(--green)',
                fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
              âœ“ SU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ PageStructureQuestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PageStructureQuestion({ q, onAnswer, ayatTexts, globalNums, timestamps, sn }) {
  const [input, setInput]   = React.useState('');
  const [checked, setChecked] = React.useState(false);
  const [correct, setCorrect] = React.useState(false);
  const audioRefs = React.useRef({});

  const check = () => {
    const ok = input.trim() === q.answer.trim();
    setCorrect(ok); setChecked(true);
  };

  // Determine which ayat numbers are relevant for this question
  const relevantAyatNums = React.useMemo(() => {
    if (!checked) return [];
    const { subtype, first, last, multi10, multi5 } = q;
    if (subtype === 'first')    return [first];
    if (subtype === 'last')     return [last];
    if (subtype === 'findpage') {
      const m = q.id?.match(/:findpage:(\d+)$/);
      return m ? [parseInt(m[1])] : [];
    }
    if (subtype === 'multi10')  return multi10 || [];
    if (subtype === 'multi5')   return (multi5 || []).filter(n => n % 10 !== 0);
    if (subtype === 'count')    return [first, last].filter(Boolean);
    return [];
  }, [checked, q]);

  const playAyat = (ayatNum) => {
    const globalNum = globalNums?.[`${sn}:${ayatNum}`];
    if (!globalNum) return;
    const url = `${getAudioBase()}/${globalNum}.mp3`;
    let audio = audioRefs.current[ayatNum];
    if (!audio) { audio = new Audio(url); audioRefs.current[ayatNum] = audio; }
    else audio.src = url;
    audio.currentTime = 0; audio.play().catch(() => {});
  };

  // Page summary card
  const Summary = () => (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginTop:4 }}>
      {[
        { label:'PAGE',    val: q.page,    color:'#c878ff' },
        { label:'PREMIER', val: q.first,   color:'var(--gold2)' },
        { label:'DERNIER', val: q.last,    color:'var(--gold2)' },
        { label:'NB AYATS',val: q.count,   color:'#5bc8f5' },
        q.hizb != null && { label:'HIZB',  val: q.hizb,    color:'#ffd166' },
        q.juz  != null && { label:'JUZ',   val: q.juz,     color:'#a8edea' },
        q.multi10?.length && { label:'Ã— 10', val: q.multi10.join(', '), color:'#ff9f43' },
        q.multi5?.filter(n=>n%10!==0).length && { label:'Ã— 5', val: q.multi5.filter(n=>n%10!==0).join(', '), color:'#ffeaa7' },
      ].filter(Boolean).map(({ label, val, color }) => (
        <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center',
          background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)',
          borderRadius:7, padding:'5px 12px', minWidth:52 }}>
          <div style={{ fontSize:13, fontWeight:700, color, fontFamily:"'Cinzel',serif", lineHeight:1 }}>{val}</div>
          <div style={{ fontSize:7, letterSpacing:1.5, color:'var(--text3)', marginTop:3 }}>{label}</div>
        </div>
      ))}
    </div>
  );

  // Ayat card with text + audio
  const AyatCard = ({ ayatNum }) => {
    const text = ayatTexts?.[`${sn}:${ayatNum}`] || '';
    if (!text) return null;
    return (
      <div style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border)',
        borderRadius:9, padding:'10px 14px', display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:8, letterSpacing:1.5, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
            VERSET {ayatNum}
          </div>
          <button onClick={() => playAyat(ayatNum)}
            style={{ width:30, height:30, borderRadius:'50%', border:'none',
              background:'rgba(62,184,160,.15)', color:'var(--teal2)',
              fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            â–¶
          </button>
        </div>
        <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, direction:'rtl',
          textAlign:'right', color:'var(--text1)', lineHeight:2 }}>
          {text}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, alignItems:'center', width:'100%' }}>
      {!checked ? (
        <>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && input.trim() && check()}
            placeholder="Votre rÃ©ponseâ€¦"
            style={{ width:'100%', maxWidth:220, textAlign:'center', padding:'9px 12px',
              background:'var(--surface3)', border:'1px solid var(--border2)',
              borderRadius:8, color:'var(--text1)', fontSize:15, outline:'none',
              fontFamily:"'Cinzel',serif" }} />
          <button onClick={check} disabled={!input.trim()}
            style={{ padding:'8px 28px', background: input.trim() ? 'var(--teal)' : 'var(--surface3)',
              border:'none', borderRadius:7, color: input.trim() ? '#fff' : 'var(--text3)',
              fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              cursor: input.trim() ? 'pointer' : 'default', transition:'all .2s' }}>
            VALIDER
          </button>
        </>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center', width:'100%' }}>
          <div style={{ fontSize:13, letterSpacing:1, fontFamily:"'Cinzel',serif",
            color: correct ? 'var(--green)' : 'var(--red)' }}>
            {correct ? 'âœ“ EXACT !' : `âœ— RÃ©ponse : ${q.answer}`}
          </div>
          <Summary />
          {/* Show relevant ayats */}
          {relevantAyatNums.length > 0 && (
            <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
              <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)', textAlign:'center' }}>VERSETS</div>
              {relevantAyatNums.map(n => <AyatCard key={n} ayatNum={n} />)}
            </div>
          )}
          <button onClick={() => onAnswer(correct)}
            style={{ padding:'7px 22px', background:'var(--surface3)',
              border:'1px solid var(--border2)', borderRadius:7, color:'var(--text3)',
              fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer', marginTop:4 }}>
            CONTINUER â†’
          </button>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ QuestionsMode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Per-ayat questions to test real mastery. Called from MemoriseMode after session
// or standalone. Persists answers in learnData[key].questionScores[questionId][].
function QuestionsMode({ selectedSn, ayatList, surahs, learnData, setLData, ayatTexts, randomize, selectedQTypes, initialQIdx, onQIdxChange, onDone, multiItems, skipCorrect }) {
  // â”€â”€ Session persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const _items = multiItems || (ayatList||[]).map(n => ({ sn: selectedSn, ayatNum: n }));
  const Q_KEY = multiItems ? `quran_questions_multi_${_items.length}` : `quran_questions_${selectedSn}_${ayatList[0]}_${ayatList[ayatList.length-1]}`;
  const loadQSession  = () => { try { return JSON.parse(localStorage.getItem(Q_KEY)) || null; } catch { return null; } };
  const saveQSession  = (data) => { try { localStorage.setItem(Q_KEY, JSON.stringify(data)); } catch {} };
  const clearQSession = () => { try { localStorage.removeItem(Q_KEY); } catch {} };

  const saved = React.useMemo(() => loadQSession(), []);

  const [results,   setResults]   = React.useState(() => saved?.results ?? []);
  const [revealed,  setRevealed]  = React.useState(false);
  const [done,      setDone]      = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [emptyTimeout, setEmptyTimeout] = React.useState(false);
  const [globalNums, setGlobalNums] = React.useState({}); // numberInSurah -> globalNumber
  const [timestamps, setTimestamps] = React.useState(null); // {ayatNum: tsData}
  const [pageAyatData, setPageAyatData] = React.useState({}); // { sn: [{numberInSurah, page, hizbQuarter}] }
  // Persist the shuffled question order so resume gives same sequence
  const [savedOrder, setSavedOrder] = React.useState(() => saved?.questionOrder ?? null);
  const [currentQId, setCurrentQId] = React.useState(() => saved?.currentQId ?? null);
  const audioRef = React.useRef(null);

  // Load global ayat numbers + timestamps once (mono + multi)
  React.useEffect(() => {
    const sns = multiItems ? [...new Set(multiItems.map(i => i.sn))] : (selectedSn ? [selectedSn] : []);
    sns.forEach(sn => {
      fetchAyats(sn).then(data => {
        const m = {};
        (data?.ayahs || []).forEach(a => { m[`${sn}:${a.numberInSurah}`] = a.number; });
        setGlobalNums(p => ({ ...p, ...m }));
      }).catch(() => {});
      loadTimestampsForSurah(sn, getGlobalRecitator()).then(ts => { if (ts) setTimestamps(p => ({ ...p, [sn]: ts })); }).catch(() => {});
      fetchSurahDefault(sn).then(ayahs => {
        setPageAyatData(p => ({ ...p, [sn]: ayahs.map(a => ({ numberInSurah: a.numberInSurah, page: a.page, hizbQuarter: a.hizbQuarter, juz: a.juz })) }));
      }).catch(() => {});
    });
  }, [selectedSn, multiItems?.length]);

  React.useEffect(() => {
    setRevealed(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setIsPlaying(false);
  }, [currentQId]);

  // Cleanup on unmount
  React.useEffect(() => () => { audioRef.current?.pause(); }, []);

  const surahInfo  = surahs.find(s => s.number === selectedSn);
  const maxAyat    = surahInfo?.numberOfAyahs ?? 1;

  // Build question list: 2 questions per ayat
    const questions = React.useMemo(() => {        const qs = [];

        _items.forEach(({ sn: itemSn, ayatNum }) => {
            const effectiveSn = itemSn ?? selectedSn;
            const rawText = ayatTexts[`${effectiveSn}:${ayatNum}`] || "";
            const text = (() => {
              if (ayatNum === 1 && effectiveSn !== 1 && effectiveSn !== 9 && rawText) {
                const ws = rawText.trim().split(' ');
                const stripD = s => s.replace(/[Ø-Ù‹Øš-Ù°ÙŸÛ–-Û­]/g, '');
                if (ws.length > 4 && stripD(ws[0]) === 'Ø¨Ø³Ù…') return ws.slice(4).join(' ');
              }
              return rawText;
            })();
            const words = text.split(/\s+/).filter(Boolean);
            const surahObj  = surahs.find(s => s.number === effectiveSn);
            const surahLabel = surahObj ? `${surahObj.englishName} Â· ${surahObj.name}` : `S.${effectiveSn}`;
            const vLabel = `verset ${ayatNum} Â· ${surahLabel}`;

            // 1. Premier mot
            if (words.length > 0) {
                qs.push({
                    id: `${effectiveSn}:${ayatNum}:first_word`,
                    sn: effectiveSn, type: "first_word",
                    ayatNum,
                    question: `Quel est le premier mot du ${vLabel} ?`,
                    answer: words[0],
                    hint:
                        words.length > 1
                            ? words.slice(1, 4).join(" ") + (words.length > 4 ? "..." : "")
                            : ""
                });
            }

            // 2. Dernier mot
            if (words.length > 1) {
                qs.push({
                    id: `${effectiveSn}:${ayatNum}:last_word`,
                    sn: effectiveSn, type: "last_word",
                    ayatNum,
                    question: `Quel est le dernier mot du ${vLabel} ?`,
                    answer: words[words.length - 1],
                    hint: words.slice(Math.max(0, words.length - 4), -1).join(" ")
                });
            }

            // 3. Mot manquant
            if (words.length >= 4) {
                const idx = Math.floor(words.length / 2);

                qs.push({
                    id: `${effectiveSn}:${ayatNum}:missing_word`,
                    sn: effectiveSn, type: "missing_word",
                    ayatNum,
                    question: `Quel mot manque dans le ${vLabel} ?`,
                    answer: words[idx],
                    questionData: words
                        .map((w, i) => (i === idx ? "____" : w))
                        .join(" "),
                    hint: words
                        .map((w, i) => (i === idx ? "____" : w))
                        .join(" ")
                });
            }

            // 4. Verset suivant
            if (ayatNum < maxAyat) {
                const nextText = ayatTexts[`${effectiveSn}:${ayatNum + 1}`] || "";
                const nextWords = nextText.split(/\s+/).filter(Boolean);

                if (nextWords.length) {
                    qs.push({
                        id: `${effectiveSn}:${ayatNum}:next_verse`,
                        sn: effectiveSn, type: "next_verse",
                        ayatNum,
                        question: `Quel verset suit le ${vLabel} ?`,
                        answer: String(ayatNum + 1),
                        hint:
                            nextWords.slice(0, 5).join(" ") +
                            (nextWords.length > 5 ? "..." : "")
                    });
                }
            }

            // 5. Verset prÃ©cÃ©dent
            if (ayatNum > 1) {
                const prevText = ayatTexts[`${effectiveSn}:${ayatNum - 1}`] || "";
                const prevWords = prevText.split(/\s+/).filter(Boolean);

                if (prevWords.length) {
                    qs.push({
                        id: `${effectiveSn}:${ayatNum}:previous_verse`,
                        sn: effectiveSn, type: "previous_verse",
                        ayatNum,
                        question: `Quel verset prÃ©cÃ¨de le ${vLabel} ?`,
                        answer: String(ayatNum - 1),
                        hint:
                            prevWords.slice(0, 5).join(" ") +
                            (prevWords.length > 5 ? "..." : "")
                    });
                }
            }

            // 6. NumÃ©ro du verset
            if (words.length) {
                qs.push({
                    id: `${effectiveSn}:${ayatNum}:verse_number`,
                    sn: effectiveSn, type: "verse_number",
                    ayatNum,
                    question: `Quel est le numÃ©ro du ${vLabel.replace(`verset ${ayatNum}`, "verset ci-dessous")} ?`,
                    answer: String(ayatNum),
                    hint: words.slice(0, 6).join(" ")
                });
            }

            // 7. Reconstituer le verset
            if (words.length >= 3) {
                const splitWords = splitArabicWordxœì½moY–&ø=E˜“U$Ë%J¶ÓI§,(me¥ªmÉåÌmh…THYQ¦‚4#h§‹æ"wÑ[ØÜÌÔTª‹ZTc?4:?,ĞØÌ`ƒ] õ'º1ßüº~ÂsîûK¼’\YÕ¥®N“Áˆ{oÜ{î¹çõ9i#‹¾Îš÷>¬¿“a’fÁ8‚7“ôu4Öƒt4ˆ³/‡ã~Úşé0Nõ îyòeÚMÒ³ÆÔùÿâ~78úpF'Yü*ê%³î‡ÓğM˜íLÎg]ê0ÍÆ““ì¨åm Mºöt+ÈŞŒ¢nPÓ¬ùŸäø|9‰Ò,BãG{¬¥8›DÁ 
>œ¾zGƒYĞ“¯“ faå1¤	ëê³ç¿ñ5ÎeW›W÷¶™5Ã³Œ¯ËËÁİv°?N^ÁÁØ’ÉùÅwãaĞŸp%² <ã/Çƒ8š4&âÓ Ai¢äyvÜ_Öš»|Œ$Ò,g@Ãì¬}~İè´ØçÓÁp86[Z††ri+JúğY4äÄZ¾Ünz+ù|}G8v{:ˆO"ÖJ[o^•ÆIÿ+ü6ÖåsõËQèÓI4à›Áav²(	øá,±Õß(!Ö^6“ç>„fñ†YØà¿õ,N²n€ÜeN¢’$/’áëä+\Wí¶ìƒşvÃª¢pL#9È_ª£ÃàíÛ`:»ç4}l'} ˜šj°FÛ¼cÚ‹øàÁ¡1RÜ*ê9¹_‚•à‡?Ì=¬Ø[H{ğt8Ş
OÎ¯ã`ı¾³ÓhCÆ¸m ì$›Œ›”åÛà Å^8xúo<ÓQ?›æ<5¯[AÜÄ¡ÀxÖá—8Øêï~ó²ÿÕƒnğº`3É­„Û¦`×è«
×_Ç³£nw§Ôõ[ë­ü}!÷ÄÑƒáùhpñw±ìóaÄ	¼p2‘L[±ñ.tË©O[Ë$l6GnoDÒGO†iŒ·ø
7;³ Œñ³¶VøbøÖ;úºÓé¼õİXÄWG§–xEãF¼~?şÄ Z<¸Ì–<>ô6ª´XsŞ`ã«VÜ\¿Cë
&m0éGi#¶ù6k¬'ÚlHµÚN‡ã¬Ñ€†ˆ‘Ã¤?<o4—Ú·›œ#¯´äY±Úºµ$ŞR¼…·£p0ØeØÓA»İ´à3ÂaA·f{óRç(>yQJ—xS>]*ªDF"9¦Aá«%aœ.e“`¦pDÇ‘‡@]Vm’«¿ŞÖ›­`8Â®Ò.Ÿ1‹”}ü—‘ñ‡Sk!f8NçêıÎF=­wëõ™ØQ·Y„móõw¿şş\|ì]|ûÅvokO6å?~şçœÙp/z§:ì WìÓAŞYá@"ö+±;HdÃSÙğâúğø§@„ulO\nSÃMv>ù64ù„ yšáıÅMnr&5pT€¼™÷ã,ˆw*xyÑğ«p÷·û_óD¯ƒ^”Éš‡‚[±³şû‰y,rF¶„KÇÎñ„½È:"­Y¥lFã“ÚAÙ-:&%k£½,Ö\6‰İğw'x‘ØZÂÍÆ´Dt~æ23í¢3V—<İyìx…¿àè÷¿ûõo¸bÜ-Eöf><c|ñ<¿œ\|—Œ/¾Ã!½‡¶·£®İı¼ÍÒ&}/ËY­¶J:·­$'(ë{eçªÆbùÀ‹nñJ!pùõ®h­%7o7®#† ÇÎÿÆw6±–Â$¤ib*oß‚-%Ş)®ÌËZ¿!›—hÇıæÛ·7è#™+rDa±ÃF±&ÒkƒˆQÛ=¥6/¿·°¸Ì˜/Ëj·WÜfŒ¤÷.¾;‰Q|6FÒ‘ÀÉ©$º}ËÉô	’~é.’6øº¿}[ß¨³ìíŸÛ‡–ônğ#Ğ`wW CGA´I…HÎ1ëµ]0²@îª›*ÁñG…&‡²ƒ!†³ğu\ù(˜“Ò@´»,·hëA”Ñ½dDğqËwßü^ÚR©ÎÃäåí
>Êât%/?¯ÌÑ¡–‹õ§2‚ÑÉC}Æ»ä%}>²x)NÆauƒçprŒh2R  ¡4<'«Ê1LCx2¦)òÜğLH¨²I$ÃslùLŠ¤¨¾åòGFIÇo6ÙJ1™Æ	­	Á3LĞ ”ÊåíÂdÃÛ¹|”x¨lû L›ñ¥,K¾3~gd™šB¼ñm—„Çv”dãØ³|Z±ø4ÔËÆH°éaÎ á'1CŸ«~~.¤%3°4ÚN²µl->¬ìn2xœŒ#XP¢ÚÔ*A}Øl ±†g!ˆ	È‚Á0ìG}O—üİĞà°]&¾3‹KÆáë}¸—9^ŠÆ¨”mã„›Ÿêu??¡aÀIÕğÌ’˜)|³;H^0ŒÖçñ3Á'ÎJÆ‡ï‚7µáÅ€×µÉàœ#¤*;ï8=ÄIÀÁ¥íq4„ Í/üã/–şé_ÿãÿ¾ôOÿO¿ûo¿Yúoÿ×áòó¼¤·12fiÛáÚ†ë+H!ğõü»üÿô?×)À˜¹õàV¡H=s®ğçñuİS¥‘ÃÙÜóëœFÚh¦m¤«ôŞ«mÎ
p”iÒÜ Ò>ˆÓ³|dİ^›üÈn™7o‹ÙAY73‹w5…†a‡QÛãÁIäTYºmòÛdÒæ›ƒgÇÍí7b’[õ¦+Nrë5ø+23;l7Ù?÷Jp±í_ˆÛõ’”~Ï5£G_0Ë6›Î¦0M‡' œ…pM/‰CipÎî¼ŸÀÓŠµ×Ù&>Ò¦¥e­Z‹œùÎ2üuI«yğîç¿„EQÅ§oåñãDœMÁØZó
O`ƒù„[ê¶ÖÙÉÜro^ÙáTÀ.¹%SˆÅå9,nù¿Oo.Ëöép8ˆÂÄ³¹^kûj­¨Ÿ2ïW‘ë«‚Û+G 5åE˜´¹¡úµN2£¶2îÎTbáÅ7øe ’ ¾pÄÔ×$öw¥³Èü^›9Ó1ÇB\9Ã”)étÎödóÇ[AoïÙƒıg{[ßë¢>ÌkÒæñlGÁ$…Y¤(Káœµ‚çQÑ*06¬È@{™œGx¿l™g{ÙÚÙ_Åî®Æc+ ÇEı¹Ç©	¹¹]¹‡3’7pL>²d35îƒ41øm]u3lnùEì<VW|;&k¡ p‚öW>eqdg0)Qš¢hÊ›6	rØ¯@ñÈ¬‰Î|±†g2Ä9¯Ï˜ğ‰¤hôÅçB½ï&$B§}¦‹ÛI·©Ù,¼6ÓH8uxT‡'H4¶Ş D._˜£!„mlÙÏæ¸
}°ûH‡Ğ¿{•ıÆ¬Â-‚O¾>+®Rör4š®àIA¤ëUS¸)‰ÍµT@ø³–iÆhlÑZé`)8¶ÖŞwBœÆã4Óv
Næc¾§!üÇxJŠíµ¥N…fN†“Äèœ?ì»÷,şÙq`/> §‡u»Ûoº×;íN¢xĞÈ½y9¸Õºô€¯³ŸN~8áE ƒ¼gH^¹m<eìL{}~Üæ‰¶¿ïïŠQ?•9úÁ›èè8$'Ó)°¯£–-‹­^‹¦…3ÖâSĞClé›nvÏ	&zÚé£qtÃ‚ğp’>7A¼È–IFiW¨½x'†ÈÀ°¤P‚×¾GY„‚ÉäXˆ+pŸ£L˜TêÒñ*à=€|7@s½¨"Ô…º	NKšWÃ^$æcµ}“KÏ®O…éÀÛ*ÎFî°Ÿì½lBÖ`‹ÏÑq]g‡2z$˜¢Õ
SB÷ÌÉH©¾á,>ÔiÙTÜê2˜Cx”Òïœ6Ëfo®0!x[Á|pIMâ/='Ø`Ù”ÜîrzLÇ¡ëæø]™H…¶³bè¯%“Å©0_üÎ’m•æ<
2r/&Ù%‰K¼&7*şS8wr¦óvĞH†ÉR¦)oZõ	pl°/âd"Ù>agÑ:‹\IP=>÷ÒÜ®º2·[}
®vØûV^£ºÔ)×©c9 `’Hşÿ,ŒP«ß…Ù0WÛ~£3Æ‰í¬ä9µ‚f›M'*°ôOúø	/@Ÿ³J':{Äãª¶—;cpå•°öQ—¸ØÆzCY-^E
¹púİ†ÃH·)X.£Ïh« .&TDzıÔR¼CrÊíã/¨Éğ[Ÿ² õšòé B&g¢şğ®ßŸ/I(T?’îø²ı7QP~™ª&_J»ìã{²u©ôP[b©_6õ·do°ÿ—O¶¾Úİ{¸µ‡Ú]D#r*ÖZ5”
Äçó8Ek…øšD_gÌ_Fè‹NRyşıŠIµğUF?Ãg#Z¿fX–Å´âğEÕ¾"m`§RËÒ!ª¾á!X;ÔŞš\È´KâŸEæ.ƒeß2ÅĞ¼4|K”MNO,¡E â¥ğøöCŒ]ÉNÎ‚èkX¥ÁËîAÏîÒ#èñßtÃÇKÜëS>é!fÒVÕW?x™š·¿d–¶üFáW_è5Öeí&…P~…—@»’¸ç°Áj½iÄ}FZx¨Ûq6ì!™¿Ùî3{Q¿N²Súñ ‡f‡—÷<±"@–‡v”6ÙdÅ¡!RCĞL‰5ØÙK²á‚Í¤?>àÈŠœWeTÅ(Éú	ÚÈ0>Aõ¾tîÁ¥û8ˆxi)?^í§ap4âàfĞñåa¼Ä¨áôyğÓC2ëĞ'º:GE~l÷}­K½Ô\¯”6à¾,^/‚ã*Éâp ÇıpŒT+ìêA˜DIØb­“	ş„\š1­™—Ê>çšœÂäa|zŠ~áPXÑÆ²ÀRĞ86/¹;?}C7«ò&Í›ùOŠñËğ¨1ĞçÇcöc£<ï@S³VpÀl°-ÍŞÚR ğ¡¯ÑvÒ
$gnY‡iKsAqSü+AZ†5ús°xOà\‰•µ6x«„ì+x‰‘§@§ã(…vSt'2‹ò^<½=I£-
¹1\ôd"•ÆxozçÆüv
¬+¾Å”ï©f5ş£ÍzòkÃhŒ?‚w?í±—	îd2>İî·Äµ¬A°µÂµ(¼9¥¹c“·9Á‰—¾ˆG†ğÈ‰^‚¹.Åx)‹ÏÑoÄä {“§Ğâ§‘‹ó)-=•ŞŒu5Û£ó¡;×Zß’¤åHÙLØW!Jì2‘?dç½tÜ ( ¿[ÍI"â§3Fï§ŞıöèÚF›Xâ~öìvhˆ}ò8òY45Îù‹(ác§f^f@•Á*Ì7ı(Â'2%˜) c„ŒÀ«\Nøf+B/'lú>0¶æÊ9"àĞ‡ZĞ‰ÿ–U~§DEWr	Z:Í›TÍ³Ú¢ûãTN”*xXéöÃ ]‡Ç ñp,›€P˜<M²¾6Yƒ½7É‰¶#Ğ‡Äë²íariN5: ÙÀár$C!ı±íÕ¬Â´î`æla*t°»ÈÛåî†S*‰ñ”yŠœ	yüá~R·¬*®1³§w¦föa4†Ùb¬ît<<×'whœØ*wêK˜_²=U{’Wt6S#Väè¡ø>Å‰¢´ÖŒ­­Ü‡Ct$üØe}à«[-·´&ø,ğ·qGq€ox¨\ŠG‰œçÆ‰ à1¼ü«H&‚œ† %8§‚ïs‹=¨l£ÑÂ&$¿iá¼wiFZbãŠ¨! š=Æ¬¨na÷(•ãg¡È€»áVkø:Ôúé»Üñ%úŞ`¸ĞhÃækŒ6USšÍ"|æ >µ„5úuÉ÷ğºİq”uåVòÀ€¥[Mõ¢Àv`qMf;â*
LË×cëÒ°g:¿ÕWK—1©¡¶–ĞCë¨áÙJ…#f)‘ŸÇ¨¾áC?´¢„m|X#o
ëºµá¨„5ÑE'§x¶¥)cCü†CñòÆEÊs~Hq¬¨òá§FŞn»·Ë!M3ŞŒ½¾ùBlÄºgşË7 =ªs{n!Iúšä’h”×·“MÚs9›ÅøC% éOäñJıÅàçÈ4·ÄÆ[ŒÒëaèÎ"8rØÉ	¼ù?PM8y®Àä·#ßLPØ~:I³%Æ(àœàô+í B-®{„“—¦€ğR2Bú ÇÈ‰%ù0‚ÅÀ¹(wr|‰§šÌc=ØsÃ!L™ÇVòå
€÷+Íƒoy6×Fl	ëZ— Õ„]=&QÇĞ¼œà,IyZ¶í(„(]d1ÆÏuš9 ÉÑÆ{Šò±fHu¢¨Å>ü8oçê”Wú ülø;E‘ğŠİÀˆ1Nf0¾¥æŒ÷ÁoĞ»‚(cŸÖÆŒQòhŸ`Ãc›Éšíƒf0œˆöáÂW\¥Wok++J•åÀ I‘wûw²İ(;˜MéÈÿ:-ó5”È´9f!¥)Ì+®3ŸÃn¢ï‚ÈYG˜¼ÁPì³0E‰‘=ó&ÊšR Kø¬»ó†“yƒ_Err*y0å3hÒİÀj÷2Ãˆ5–ö-}}PN5MºÌY0BÀ‚_ÖOúñ+˜ş7ƒh}:…Ã§3Ø­¯®Œ¾®³xêÍAü<éÖO`Ec¸v:L²^ü³¨û1Jƒá¸[KKxóZ³:¨PãŞ(<Á¶:Álv_nÇÍgí›¹¹l>y²·İnîô‚G›Á“GTxñí£­ûÛ»;;ßnÉÇ>MŸ‘2ñ d™ëÓa‚»z¦†ŞÓlØnıx0¤¬ñópü<†wîŒ¾Â	lÌkôæ8WuoŞöYxŞtkõqò³hPo¥ âŸÖZj–>‚–;wi¦É
½Á¥t8€3…M
»¾Ú4Ü4Ç „aøYÒïÖ³1-h–Gï{Î„²Fö€º'i÷IŞ)Ş6Æ´(8Ãï~ş‹`ok÷ÙŞ'Ël²Ä¤²kÌ¾è6HÛÍUÉbíêÈbµU4ÉÍ¼ûwÿ!xğùæŞ·oíì·zÁşÖ·¿Õ{÷Íß©Aæ3ÂØ
¦<@íEô&UÛLš¥_¬ß¡Òëİz³)[ 0÷´™;}x8ÄáódìñõÙGQSv\èÊYúx˜û( İĞËáØtËi«êºİ‚é7Âùu` [9‡ú£À3ñAŠôÍqÅp_Zúğ½üµ…#Â¸U¸#(¹Ô”šÌLØ‹e8<PFä3Ğ¹dî×‹8w/Uäc·`?03É5NŞƒÿ<ŒQ€Aÿ)Ìë`r`Æ>Gk¤=ü<u;·R.ÿ(x€®ĞN—¹0	Î'‹Ñ£¾ŠNX_ÿ‡Ù–•M|ª‘	Ì‚»tò}éïk_ì)û±Ó±6äóá ©˜É1qö‡fë`{çÁîã'›ûÛŸ>Ú2G£¶MÉ ïVcíÛdºş2îggİÕ»+ğ;èÁŸGñó³¬Ûiäá#˜2¶
Ÿ¤Ùx¢èİ7!ğ¼Dø’ù-Ÿ,³'ïQVµ•l7E©j$¹øîeÏŒB…86›Eá€5kd­¨6ÛÖKr<^¾ß»ønÀˆ8¡²I6–s1œğıŒ“4à0‘#m—®aéA\tÂ’œõóœ²8ItPjëøùqØ¸³ÚêÜ½ÕêÜYiµWî6`	ßTW?oáPÚùñÖ^ğO$Ø=ûèe“¨¾a@Æ·³d%«ôŒnBŒ£°ÿFÚr®× #(Î¢s|°i°˜‚}¸ºJïõÛ_Ußº.oGQr¼e÷œï4±OŸmõPì7/şí>ˆŒ öŞ'¯¹S•×Líól¦­lôìv†âÀˆ‚‹ï²‹ï0|4Lúp£XÑèÙC8ö gs°
ã+lMã•í“«»ì€ûrŸë¯á¿õY7âÓ7Í.“§›ç­Ÿ—PËrJ¢Ì [nÛDw5P&5ImÎ³"Dæ½¹io¾¬7ö'²©cşM¸¶‘gÚœÎ@+ó¥¾º¨	•˜]ihvg3¼;…/Ã[]é ·»ÛúèŸá9²@–ç4õûßıú¯cj{g{{ó!Má–í=Øİ³¶(R¬Ëéú{;Qæ›b¥¹åëkÅ“{Eú›˜>kÃÛçJ•£d­Ë'ÉPdæ£_{U=(RüùHt`#¨oNN&‰†"ğüâ;‘Æˆº2‘„sÌTJ3mDI¬ï“‚†F@%?G\#4üásiÆím’pÕ&k×g¥Üó{)Ø,@„×E‚½‰é´•ã™°Q¡VØ¢DÊPÖE„PÅÇÈ—Çma€72¡¸[êD&Óoa°,Ûââ‚4rjˆ—Wüî¶L»S3šw÷$‘ÍóxOAêN”\¤D±[­Iúªâ8PoSÍš°õEçë÷y¾¹P„ätY¤Ïvr:Üh#†ÂÌÚ&¯cKxòMnI‰ë<Laö@Ğ€/XÑ¦½‹–HşœÂO³”öœ»}äOírš™-OMš™pZím=ØGñ½ WŸ@u«º@%’ûCxÌâŒrD„u4n1”Ø†Ë‹_DoÖ§±Æ“^3	ÆqÆ„SühìõÛ®‘ÃKÓyÃ¶¸‹Ë¨ê7rón˜j€XPGš6´ƒ`T•5Í‹%vCgCŒä76êu4¨•ó^}sN„fSsÓÅ]}µïZ«'G;¾)+4’›îåF´¨u£b@€eöıè¸Q_xo¤wL|Ÿ™ç¤kP»«Î¬«:ó­áeÒ¯—EV;éşœtŸmnïmyºYàan4‰á’Àoìoí=ŞŞÙòÈÆvğJ üØa3§©',I3÷nè;E,çİÎNw”Ä#iz]õrÃñµ«[„õßDyé@dÈ(Â«ÿ”½¦íÛ/
^o½"å’üøO‚Ufù)#©§7ÔçùIåšk¹Ü|B6'ıxølŒÙşÏÃãp€yƒ&ù<Êè¡OAGh4&®ôÁYû|´vätŸ?DÔFuiš:_
\üu/:msÏ½æ“"ğŠòÌ0/¼#NŸ ¯…}²e€81ñ±mñ“bfôóbÃÍéø)E4~Ÿ‡'0’ç,J”ï\5DófûCr„ï~Æfq†Œ¹˜„É¼š0IË]’Dıíó¸ß6yğNÌD¤¶OØãèt}*&xl+MK1YòyP1¸»–õàYrGJ\ˆ±,Ê›0D†	+ltjCœ²Ğíƒ»\xåQSÀŠçk®D~×öÌ®"+Îq»ú­Ãef½1Şm&FKv81™™m© X{¢É¸ğ²Lƒ~÷›ÿô¶z½íİ8³Ğe¾E³/ì¢ÁT„`hëgœ İ`ëìBHá+]—~EÓªó:û´-TiæòğŸİy:
h!»oí<(=u›2·æqĞjü`±=ÔY1ØKEô5¹¥Ö¤¢ğó‡|~şÏÌ›Ú'íL©pİ2-3¬OP¤OÃ“Èí¤¿á«h|:¾F„dé#0zã½ÔAğù4Æô=!Xİ¬ÿ îë^ºÃ¬®i"cvşPKA{-59}‰²3·{½38^t‰¸ˆ]İ,dV~ñRØ1Ç}›ÎI-Æf}§Ùâı–GÀd{93¹Ë¾Zt’°ëÎêtV8L°¹7n>Oì¤×mµ‹nöÕBÒ«hàYa_¾d„úÑÊŠÿ¸3]hŒòµïÅE)Û¶rYW ªfÓÀ±6ÚÙğÙh0ÁÙgV~ÌÖíÓ°ÿ<BCæú”eÑDü‡èMczÌÓS%Ô’’—Gk2¸ÛjÙn)»Ñ-ÛnT¿MG1É„®¿CÛ”ÍÑ°ïÈW«·›d»w~è”:©$)¿óÇå‡yp¥v/ø€…}`Üæ›®ø(u8¯¶Æ^9gîtnŒÒöjês³MŞŞıæ…ÿQ³ :n×–‘oÆB#˜o;qÃ¦J¹Æ\ÆYa*ûtC?ïŞÁÖ…l[ÂŒ8„b¡»JĞgJBšõmg¯ëˆ³ëqxŸHÜYttK(–=ˆR»
ÛãY)¦s'@on~9$4?EéÁ¥¯Ú?õ½ò~¤"Kö:Ş}ÎoTiÁeGşUªê÷Xu\¾º¾H>‡´¯hJõªôøzœC‚ûØû|éa¯~«íU!È1±Îë[wÖİÅàö’¢¶ß™jÀĞB¸£Œp`Í˜Cİî„ëKP‚Ö²–¡ZÅfü2±1dw¿ıU ¾BÆvñwãˆ"büí_ÛÉIî=³üsÕš*É‰Ôñğ l8c²ø> ,u3èÖæâA€©-[~	b*ZeXµÒõ)Ë*šivºuÍôfH„E£õ®o{«kL#pC«_–È¿Î„™Ô7‚ş4(§Ã=õ›èÒXUêŞ¸"í°ëSùÑÒú¥!wìÆÎÈµ_ŞÁä‡oßZ/¨±<ëŸ©‚•rN™Ò5ir—µÂP÷õw÷~»¢îí¬ş†æéÌ»‚¹„ŒĞiàºú$ÉW·hì–=ü'+–ı:Ç”ÓcŞÛOÎûfX|‰Ì_ö{`ŸlˆÛ	è%h˜03Úú´¹-2ëlx”$¤®J¶NFsêÂxèÌõ2Ìs<cnfÚãŠ¢ŒSB?áªÚ{ŒPø§	X”nG˜Ts
b5íğ÷ï2Õ¿:AuÈ£-ÓPŸ¢vrµ£“‚¢ûäõ/9ztzÉ!9v¸^{h?I#^Ÿ‚Ê·Á*fÙ7„\Í[WŸ}‹ôCQ;æ¯ËYc)ög zPü(	òR†´tn1;ja”áGŒt·<jÀôÙ–êî@çÖã-=ƒì{ß>Ùİémù%ıE¥Ø=$©|øÂw€ZCòk/Û$²@6¯%NE Üq¥êÒ÷ácÃÎùÈJCèÜzÑàt)LÑûC–ÎqÜG¼ÔJÓÒóR ”ò5Ô¸ßÃÁù÷~92µcæ•âã+uìÓ®p¶Õê­ÖÇ+ø¿w—¦ug×r•å©ò;üÿšRy(ªr¤®1£t\|Ï&øSç£Û­ÎêÇ­v§Ğ,+¼éÏê¯‚Â9õõú5íºüØ¼÷Áìƒ>U9°0‡4¦cU0øƒ—ù-©ÚAYşaÒèÆºÕ	"	JÇèlşù/Y
ı	ˆÚwãÕ?8$ÄîÜÁllÑL¤´D
Á·ğ{8€ÏÆCëÊşP~'0¡‹zeáO¿ÂJ)_ıÅÖ_ È¾Dşú•t–~Å[æiÕcN†aŸû_UEßÀy¼ÁOz»;mª–ĞO`°ÙpµŸGÚ7ªßf“Ç¥€GqªvQ‹XAÿ¼ÖqßèÙè'uúi±1¥‡Üº •ªO£r1“Øó–F_bÆ~-»mÙøæ£G_=ıŠ²±şÔ1V5øÒø(‹–Aå€ÙêêÖh¶gGkï@Ï›!e=%F—´Şz‰Ñp:Ú`ãj«ÆTP€êj¬ö”èJn3ÖSnWò>Õ×X¿TëÔœp¯fOûÃCq©°§ı¡Õ»P3:±Qµ™ãùÓn'6$ˆ9mì1™oàÓÚ7QïâNm;°ğ<kR ¤6)ìRŞôË)`·á$((1:"§ ué° ]=“Zf*¨jÍèÌ\!IsW^Ê!MÖ°zÒ;bÒŸœ…ZÃä¥œ†kóëùnìsğ6¨eÃšjVŞdÍŠ’[‚ìrÆ+ÄÑêC¥_ˆ&Ó–Ş&»T4¹Ú“Ø,…²ÁØ:É”Pë°,
Vw9Tï.åÌÌÔ 2zT´°).åQ™ÙÂK<,Øé,Zx*.µ€o—&ÁÒıà`jT}a¦³CdÏ†¯7_!
Ö±­k\òl]›:±'*#ÇÙ×òÆÉ‘­DIŠv,ñzúÂÁ EÜF#MğÎ„ì™â1,fFOFpXÒË?ŒNCXAl„E>R=-=§RŸßÆH¥Mà¬€†»¬—ª©¿ÓÛµ«ì°ùî¬r&ZªdË™`ù[”k,!ƒÒŒÚ©±÷Ñ'}"¶Ìö òCúÄ¥+ö;0j»“cKñŠ[%ÌÙ>æ@+·#É«eß÷òW·²¡Kt‘íÓàuÄjèÚá”0ôÓø9(ÇCÜ©ì•‚ôõ”œ#¤G”a³–.¯è SÚÀØœGŸ|ç4¡ÂƒX|šM(~öLé•fQkøåNø*~À[ë4#¾5ô]¾
ã‚—öXıa¯8D/! Qî‘½#U‚&Ãnz7¼hÓ»¥_ÆÙY#mË˜œZ·ÖÄÑ«Ğğ˜X_@ø19ÅÊ´*e”sà(%†T&Pìn¬l°^ÁMUÙSsÈ1Ÿ‰éY^ôØîé&q 8:úœÂBcr°VØÉBC€¨f9OYëm¬vĞiÇÀ7ŠxJèjóéı!=Ë5ÑgÆcVHÏJÇ!>ú'ëĞ|¸y³‰·2°ùØ¥àºàHºh,ÖK“aù`Œ…Ó’‘ÊæÑŞŠ&b—ªnÁ!…x›b¦åÓş²’œŒârúQXı’vğ¡ØO.úcQ,…	zJƒÆ"éÃ¡…ö©"PT¬ö99¨ÇId’°øÇl‚ïNh%g×|(wß'°ã(*wÇ‹øw¹/L¼ÚIUéåÀ_ˆjáĞÁAçP¶Åñ:áæûŒj±wüJ”ÛdT jË¤:ĞmB8s6†ãÌ¤mz\P·’V31•â4»lA§_¬¬#JÛš,‹£ÜÉTå¢Œj G¤Q5R7¼Pò’Ø’ŸLÎÉ)ôyN˜}&\Ÿ)ö`‚Í:p|4ÉßÓŸƒ»ºŸe](N]Š¶d4ø/0#˜¶.)PUD-+¼hq+q}yG‘lÎ¿²ó‰©UVÕ¿®%++Ö¶úšê«Z}5MtC³ªº¤y‹ªcÅ‹õª°´š	ù‰vÜ¹Ç\+Èc†]¢ëÃ‘3‹OèæMQ÷‘gÙ@lLy7J¹à6ô=]¨VuáI²Î¨P-œ’B261â”VPƒ¦X­3?)ƒ­Î+Ï)Ècì_”õås’ ¤>k2ÓßùÆÖGj 1fU›ñV4<€UI¤Ô´º®GC[ÁĞîøáT.×ìİÏÉ¿î©@ƒjÅ,ä £N­VAëÑæ§[z_õ>ßİÃ*÷bã*So·†ELÏ‡Y•låòZìİ Ü­=¢¤“¼œ„I&KÊ(Ü­}ÁÊ¥¥“øUA@±üy4¾øî¤-ĞíÆİÚÎ?ü=¯º†îbaCîÖìœüM³)wk<º*Î&h{–LV³3wkrN´ËêÖË†ùÒË§uC4{u„)L’	<¯[¥é·Tü˜Ö˜¯ŒÔİšŒ¼¡_dšéº[ûıï~ı› j¤Íàâo¥Ó{J›6¿í	ÕÑ4ocìÌÂ”¤ı-¬«DŞ«ÔähÍj ŒT	©¡ï²f­ÔXĞJ{ªï(×fmSÁWLÓ¼¨êóg×Zsuw§Z¶“)·&<œ5=Z€F*’Ÿì]|ûàâÛ‡[;ûn`ÄTç;n.Â	$
C®¦GKøaâôî=˜ºûy*˜qÉ(íY·q=jè“¬9ajÙT‚OCÃÜÍe¦¤¤şÑÎÔŸ€s­˜2ùÂ”[J!q ,ÓrË³JÍšNó@òwF_{ó†k¾æ*«¹ùyÜU_S®zçÁUF¹Ó4€5v+'oÅs”‘J‚ZLŠ²ƒ„íˆ“°´ğ”ùöö-#UEÚyM9yî–gnÒ‡[
dÑÖãp[—ÊÊb³jZb¢»³K³2öwŸõ@v™ø¬é°—èğ’{Ş°?õ@¸ç3Ì‡ImËÌ—RûQAJ-m·ªo7+Õ½æÛ^Æy›usÕÙ¸•êÀŞÆô9’İAF%ƒœğKšº¼îD ùè£ '`R¦]”fè?¦šã4¨íî=ÜÛÑäâÛÍıİí½-ÀÙÅŞÅ·°'wö··ÕfÁ?üç`j¸FƒÚöwv÷¶öx=ìÃM­Í¦º÷3¨as$lÁAÿÅ6ù\òÏŸûk9(º1q Ç ~eãxÄÙfv&r¢@B|µ_8¸1Eıp_‡JŠ>?ĞıU\¹V˜µ&İ[¥ƒS˜P6âÙ×ÜJH[û†êšj³fM_mVŞ®*úºÒ}µaO7êJ{©3Ïe8xEş¨H]H–K¬”¸­¦o¬Ûøît½é#ˆçÌ*“ÚgåÇ±àÂUÖÎ-ãas•¤ß¦q´L‚>Ü¿,£Ÿ–û×²®(.jbCé‰>ts¶¼rdŒ‚BÙUç5Oçú°u8WÉ];k£¯ñgeñèÄBÑ§³ZÄ‹…å•õ.Ì5ŒXãÁˆ6×EH‘½­G›4¥7¸ä¯ív¡|ÃÛQ]cQŒ "EDzü°£Åå4jü»ˆ˜hæ5É	Úô"Ûdl×¨[£“9596KicÅ¤K®ê¤¡¡\P„@¹°‰BG‹Å?ÿ×ìì>ûbëÑ£­RŠğ¢~)ZÏˆŞÌ± ñÙ6h¢b\
–êH–¼cîµIÇ‘î¸‘C¼¹qĞ
^™¾Ú¥è´ûl‘LĞp‹ß³rØtf:ğ¹p­ÓìQªîê
«º´·RfP°›¶EW ­“hé8Ê^GvQ®aTÍë.0)<ø|ä‹½àÙÔî³½ME!‰ÈŞúÚFeA—…
ªİâ(QµE1ù”­ıJ‘‰Ö²RºaÙ–}üìÑş¶˜\s»A±˜Õf³ê¯4*¬9ñÚZiÍZrğD™î,@—.ÉXVW–‹¤>Á—È#<RÚ˜=mútğO'¿{Êl($FSÎUÄŸâ./${±ÜÄ7…“ØËvdCØOØèPg:Às´¨’õûáÒ±cbUÊµ:€Ò%O%.Ñ•Üº»šüg\SÏ/ÁPkªmd|3‘EfØ ¶0y2eÏœÍl³6ë*åwÖì¨Ã\àøôX{–r‚<£Ö|’]‰¥gCdUÏ­«¢ÓÌ§ÛØsJ6Ø²¦Wòb 7÷>»ø¶çWÙóºöÙ>üú÷¼ÆQìU8˜D¾ĞWë÷õ+ıgX´nÁ‡ïw6ê=ØÒu¦Ê»Œw&8¸ç7õ°cÚpgÔA”3Å»ñì—t@çìĞ±¬`;§jeäˆÎJEs
‘	àN¬ Æ0Aí|4‡Å÷‹ƒÌm¿+ñİãäÒÁEƒ
ß•ø³DN9üàfvŞÁÌ+giª™¸±²zfñs›‹ãßU
©>Ã¤¡šQÒrÍHZ®Yğl¥ú•ßş™“ò§‡*¼öRÜ<ÇzZ™/ÊD|òıy¶Xo>sÙë{ÏöP€â—Ïó=”½*ßj3ÎgòŞÎÛñÜ	â†3Ït¡'+“Ê—\jÊVy8`%šücÍ.[¢Ïs¥ÌĞçùd2uŞæ¥Z¶©İ_q$öÚl3CDP®ŠĞAdhXu&ÙÏY´İSßşl8&ĞñÅ[&M7øÍ-Î£Â§æ7q÷VûöİÉ@3+Uò6ìß»¹yaªƒ1<ò*L²¿€E°N²—©y„Ù1­c=Ğ•˜{D&ô‹˜İO‚5«ÌºlG„\«—$“:{<…s+j¬6Û?†Ëj¶ºq‘¬D¹z…²`j~½'ê®à‘ÿ‚ƒ#k1å/1|ñhps<ß´ã”şmÀDR.H
¿h¨Î:BÙ[ƒWáÅVY ½@G¥ftr¡½âd¥}[<$®ğPAƒÖÅ/(ü4}Pv}ªj){¥,Â7‘*DèwÒ=‰¢1ç”Z…ß¡Ù€—^û^ÙÏªD9Ç¬</jrM &[ÂH1Jõ%,Ê–Dë“r0”•CùJÌ‰¦­«ÄEYêğwB¨r×Qš¶Ôq¦)07/e‹\“‹]n\·<×YÁœé‘£xT†×¢ÂDş‘Í–æwÉßbytKEïKí±‹³:*7ô5‡—¬İYyuVS8ãÙ­!Ø—­‹L}´ìSj	ŸA±É*ßJOô<ƒ™X(˜şZßNÊÄ’’ŒGNwrsÉôü!ï³™z–ç“ådmzŸÿiøü\©÷’€k¦KÚ5LÖw#0÷vW|Ú°S»ËD~fM¸Ìã–Ş–®}KüÃÀÏ±ÔaÙ“(„ãák2î5øÀ*›<'ŸçÑB§–šhúğ‹aëOX(‡ØfË£`¢•Ü% ^[	ãº'Ga^Lî±Ë˜å5Èpÿ0šC‹wîXLú–YÀjæ£0›Hî›×Ê¢T¿ê%{ö·G¢€Âğ/ß6Êw7°‘¿ûí¯xĞV™…fn»3Ñ«úÄ\«¹(×`tû‡²]Êjtga«Q¾1Î™££1·û0è­›Áó1ìÛÃ¢OÂ¸àV˜§6€”ĞW%\ğ4Õ€+ksÃÜÉ.õé$ôƒã7K„$’KnÃÇo Íõ³?2KôUŞ o„ÀûûZ-rå"a	1A~IrÑÓ6š¼ı°èß´n÷O¿‘¥ù†¾ üs+•ÓUíê}„·^÷ÍßÖqÌŠ2¼,›˜.æf­ ñU+`•Ic¬6åïÍs-GxaæÖfœCgóó¶ï–ÇsYòLÉøG5f0Nô“¢¶Ñ=Gœ}ĞúÏĞÿüwòÌ2ç~Ú*!ÿÆ@v–øó#øÿªíñ‡@
huâ[Ì—\aş]ÅF2†Š·£„$FàÆF6<†wë´ZuÙü=}Ôxí—fŞÜFO¢b¨#÷o:õWü»Ä]®ºñnvš*i™ÄÄ’Ñ5‹ßO‡`)øQtW¼„hwkPİl²›Å[^ıi	G£§Ô3-Á—Ù‘Ï`v'¿ĞÇ¿:¹ûÑİÓS/Z§ùWhø¤TÔ¥BkŒ3=ŠN³.pFVÒ´î$-­´:«+­ÕÛ·1k©¨,ŒıÇÒ	Ìæ×Ğpl•¨Sq*dO´y,DÄ_	‹0)L2ÆvÃ¤Êı)/|êúM¤~B®“*mÅ‰0GÃ(î¯“ş¶õ10@¡¯ÒÆñs4G°A‰–fºF¢.»	ºéHVG‘]»mŞµÒ¾-ïÓ£Xcü:<ØéÜ¦ÿÇ”µJ&¢z0Œ[‰Î¨uğZßhñQJ÷ \2¶ªûZÚ%Â¤Œ»ztdˆ1Éµ½}‹Ø¥ò¶ÏªŒ4ãÀ%fzû¶ƒî§Æqåí[ü”›SáäPäXÇê-ş¬ÓsS6¬·êõæ½1nh;L>áC¨Ø(=é»›6nô›Ì¿,ÎC‘oñÃ)­4œŠH(úv½³QP_ì²ï+ğõ¨uñÚ_×š]Ìø/ïÇVïï*õş®¥Ş¯ù"#4^ÚW	ƒ¾å[ÿ3jšqŞ³¤= ß“¨á°–'úøÚlŸWê’)Ô© ëzÃmšîJş0;ªÖ*^&_©ÆJ—uDé2;³8Q•&›´ÆÍFÎ„Öiê6f%ç¿±æ2°ûëåì«ÊPµºk5ª»ÖI‹%mñW›cÄ_±@Xğë¬Ùğà«Wè—ª7Ó²ÄXYdqÕeK5šãY9ğáV™,ó	½‰Àë5ÔœÇÉz­SCQz}Šòô, ĞÍõ);ĞØ0 }ñş‚‚Óêçr}q§–ÅÇÎóƒ¨èñ`ÑÜ¥Ã?O]ÆÜğµµòğ57+÷¶åV¾ÍlØöì7k0C!#öaX'J¥]Æ9¬Ò²—$ŒÜpÕKB6ô‘Á”ŸÅä*Z¼
GûŸé¡œŠÇV¬‰“õ)wŒ€PØ€yDA¢ÙeÌÏ=ï!gÖ«eà¯‰üùÌ¿÷ïŞÛêmå–ù«QàXÈûÉs|ù-_R~¥hEOeî”%'X9'Á00^U0ş½‡L`êf¾ÄÏ è=ÛşbsgŸÊh4¦*8’UyKõä¥‚Ì€’HÒ=îEØ×êv4N†çÇ1º½óqÖØRÍ³FwZ!¬BĞåİÏÓXFÒÇA6Ş›€HÇE€ã&/…À&Ó ÉLP²'ãè<¾`²\h2º©œìâ»¾é/µ0Ê&çß‡ARU6ˆäÏ²¡Ô²<¼2‘Ô‘jÍø Ì¡Â0+À ëGx§DvXdø—¡¦-–…¥¶ŸÆ4}).¶­Æ[¶Â}Y1oÅÌ$3“Şåq(‡ÆE¬“§P,ğ6Uîˆ¼j ]"‰ûˆÀK_Ù‘ÚĞêÒe­È´eá	…‹9A´¬í½nÀ« º0•HOÆÃ4Eh7éXäXXÆ„pgŞ˜„™.ÔV)š–SÂ
‰f\ã³¹A¬Íç÷ı`ÖìMŠ!­Ù=ÆlöŞ$'v&­ÎİŒ„£Ñàœ²Æ)ÈjMÍxÓjKà^¥©‚_V„#M„T©ªOşiÓÌX5!¡‘¦µ—ğ­úUgr–=¡ÿâÜñ…ş/ü?Oøÿ{H Ø½ó„şK?¾?ğ¿BĞ~ØQÈ¿¹¦äc¡âı½‘şz¬?Öİ_ÛÏ"ûµ¸şƒPeIÛı*>¿Z4¿v¿/’ßÊoó»ìf»ànGı	Ìm#<9i©Ÿ”ç$¬_¥2€%¿áîÌ­PÔ’†ïI>9Á1hq‰Ov˜µ‚Å‡È¥+`Bº®p•™s¥
Ïåºª”…÷•´piÕrpçÍPw›EjxnsÏEoË¯,©]A³°.“‚Y^2›Ö5‘\GÏ b>y´ùã­ ¡áè‰tÒäšË¯ÓH^Í"*åLe•l¥rË:5“Ç-Óç=] mH.mİõö-p!:—$–3;éíÕ«·“zŒ\’toÈÛ2ËéÚõXN¯Ò~~)ÙæÛÎ•úâ®_.Õì‹iFidÚ)ïĞ¥=ı™‚\
* ß*Ã~Ğ×ƒ`O«O¶N©†=ıîâöô2Ëi°Àµ§§Â…ğ°å¼<9ß¡lÇ^“i“)ÕSÀEÿÌ«UT¯”CöÂ.ŸGe0Ÿ¹¼ê`¶w*„Ùâ¨O-Uİ{——Ù²ŠEÍi¬0œ½Jğî\¸Õ‚ÖsÂÓ½aèUÃĞ«F¡;)Q>ÂsÙSAt›–i—TÊ‚š7Ey~:qî İ\RN¬¼»p‘ôœÑUÍn±ó¾ßî+†5Îjˆ%	/ÅşË÷¡_Ÿ_=:Øü9#ó¯..ÿ}Få_"&¿0Äª,ÿZÃñÆ¿l(ş&ÿ*Ãğ¯5¿jş…Bğ©u¾ğ{3`^FÌ‹º‘,d>–71èo%ÙøM0‡'#w4)Gu]nÜàíJ€Ä¢Ç«Q®j>Oòš“,5Œ>«:XHz© äybFì?#:9UEÜx’»ìûµòYo,²Ö‘}«Eü²!ÀæÿßîÜö¡	”‡,‹hâJİ*yÇ›¬\	}ÉhDïï£•hêÖJnvºš.Y­«oû«×´Àê
QÇ¥1Ç¥Ç…Åy¿åÇç'iûpº(­¹ä·Tï—Ö[úş™¨m„¡…Æsi>„È÷U'ªR‘%?"f¾;ªB.ZLi~4!ö÷=C`ZpZjF˜Víğxr¯°‰O«Ç4¯kÈ«bú6‡QóLVË3ÂV“Uı‡x¹Œ¾ÈÚ¡#gd0‹IƒFı'Äüş0=ı¶°çœLp‡:+óI>×Særnyòn$"yAvV•|»ê‘oÿ²cÿå"½\9ÆÃÛ·’ûçÀå¡¡kqÈÙa!"LŞ¹qU"ÛîˆŠm%<
'ÉÉY¡ôv9_Å'*H»€+¾^àÕÂi¹^OÎ¢“ TÔúõ×UÍÀ™?×ˆW¶’îOş ‡=Ëù	Opø°8k¹¥XË-¯ëĞ.^hQ-È¿ EÒÊ3ú–©§~¾ìB	ÃxÕ…•"1˜åáÅ·?¹øFüŞ/Z`–®´“Š¯wMUß¾%İ•¿¾ï¥ì„g;Û =ŞÚÙ`EEÉ³ÔçQĞøpÚP çoßÊ8ŞÆ4MZè_Ş™œÏšë÷}†>şëÑ¡§ JóÈwæ£¡‚(ƒ
&Ë‹9ºÁ@¦ˆ4‹ØÈÁwo2HpûÁëÏ3…®üá1;³?Q¬šxë3å•öçÏ®—âšÏxÇ·êMW³Ôå$²•w$ã:¡iÑÕr{˜Á»ÿãW/‰Y:IG°­„Ò¬n%ı,^¿Û'n³·åÂš]t†c¡§ÚcF8g½G~‰:ß^REé™`óÉ“½màá›;=¬ÚI¡ŠMgÿyğ˜€²¹¬7Óà‹ v½y.¹ØºğîÅ‰-Íü*˜eQµ¸‚*$û/´È‚¼gb<ì…\†A^‰…ÒÚøüŸë0,X‡¡¬£í)»vƒhÅ¬Ş BJ=ftÔz6«¿=ÕãI¶è ¬éaFøŸJä« õ@¶Ö¨eCUÓÏ‰øa5	$Ã4í C»§UÍsÎ½ôÚXŠfo§Ÿy¦ÍŸ¾{=É»W•º{E‰»W’¶[–´+—îzòfgúA4ÎlyÆìUçË:Ù²2Wöê
 Üú@ñ!6lˆzQ(äü¹@
MãÂ±s«6bxQìœ5>tóÄ&GA”–h;9æŞ€WN`)œ+s„
!ŞÄ„ÊYğÅÖ^ok¿wäÓ6T¢™ş:|'pÊ€ ÊB­¯Ùñ\Vº÷ì¶³áëÍW(šE7ˆÃİx•‡rr%Îçª¥®<OkóTÕĞúquiY^\èijÌ*J“ùÃ¯Lèª;õŠdÈ&<B;ÏPøÃ‹o?}¶óˆ}u$©‘«ºí³íĞ‘M’su¾-ËBoÍé …õİoşoRYßıæ¿Ö½ş†<wAá$7
VTRİ
‘£;ßÚå†àú¡ç¥é	Å¥xøQ~'¼\>çï,ó­Ş[1¬÷òá¼ï#Œwğİ¢”‚|øldí×²[–*à0Ÿ:2Ÿºæø¯£ã¿ÎÏšÁ”êŒ)Õs]ÁÓ9#„/üş#ƒ¯**øÚ"‚+F£Ä=g4pn8^õ(àøm–šãbjß_‡Cä‡?“OÖM[†í¢V¾&@/ğ»º¼?äó‘·KbˆË¬uşæŠ#.§o#~XÊTÑúıiÔN³áèÉx+¢İhŞ3­+4£… Í<³x‡:ùp¨¨;mæÈ¸õz÷(øEÂn6¡›¹›aïÂ6[¡"@äÜ§Ÿ¬jLó¡^s ²?üø3ïFâóùŞoxrAÄïoÄïm>Hó%ø2ÇÙ—
 Ë–LëiBÀvÓÉŞCöåB°‹Î‹ ®ƒ­sËòøÚ«-íAÏ,³E%Ry»î:ñ†~äÀ3Î©ß° ÇÏ} –­J.`¢wñBÏQ¬¨Ğy‹úqÓğya}	òLÊÚ·õîœ¦é·¿3ıèâ»³¢$ßyû8d²ï‡ÌÈíâŒRºs¶€¾šŸ&ê\Qa+v,®aÃáûØ0½İì¨ Ä÷’É©íÛ¬šMÈÜµÌÜ`å*‘º.Ò¬aÒQKÓ û„èß|ƒPŞ–ÔWZ¢ú l7êÚ0" ”"ò`]:E¨¼knÅu™¡
Qô96¨k¶Bİ©f…º:¼ 2Ä‚Æ¶òÙU¸!…µ0‡åšµù Ë®"¿%iaÇÇZõTíÊÑ»9Q„Å¥	*cêø—æDTò{LÓ7®òæNë{pSakú&%?1:ÏGNúc!ÔŸ<ë=}V¿øæŠÉµü©Y@Ê>˜§<çıŸIù
òHl¬¢Ln·@X]a²mâcD¡ÄI*ƒ‘²{‰"Õ,
ã¸‚œ´œÚŞœ´ù³6®%'ÍÓSxÒÔ7{Bé9Ù¡y1H0kÓÏµ|ß£Å»1«Ù+D+¹d,Ô¢9Ò¤4t®AW0 kç”#=é<W&}iÑÎ„6şşT2¡µ¨¸?çA_"ºZó¼éËËËZÄa&}3R1`Eê‡ãAœ0Ès§ˆe`¼}ÓM˜ÒCÈ˜“TõPG¿jtT·&"	£~úŒ1ªöôĞG½E=ÚÑiŞ”ç²ˆ¨H^¤&>’!Ã‡„w$I<€Éw}	¤ŞÁÁM›É5º¶ñ(N3–DËÌ3Ş(óÛm´õŞØó*rËY5Ö¿HÍ	=Í:LGÃ˜¶ş0¸ad5}ZØ!Ì€gEs½~%‰í7dãĞya–;÷ëÉû7‚úC`òÃ$Æ…Š• <F+¿œP€Úu`F§Xû¨µT6¡èHªå¡°³?İƒ§½#W”aŸ“îv­4¾Lê¸Á^?RiCz‡É0[
ƒáë¨O-sŞ!²óìÑD{í.<Øñ?àÍí74¿AtšåÉõ^ó½h!·ªäú[™ş¸½Ü˜'í??é¿¬íjËxõùÿ¹6X#ûßsãy-…PİI‘oÉqÏ… \@ş"TÅğO„Î#ÍwÑ"€x¼ŞE½¥ÎÜ‚î?{´¿ÍmQşÌ1Så©²æq3ó)LÖWÃÕSWpu`×—P}Í9ğï¦àê@

 
<yÊ²s•ĞW—Æ^–àû¶P×Hğşà®nçƒ"š†HpejF¹–Q{ÀG(9¦Lãªa`@­'S¥YT`4CÁËê‘#Ï#ËÆ„À7å _ö‡Z>õlyåÈ¬¤û/´Æmq¶^b \EzŒúÛ*FvA²ååèÁ‚¨U?fÇowLûD"Á4coÚ#éZ#ñ7x‹Œù’ZÃ|3Ø÷s}üHƒXh`8</àXc‚-Ò5,¡Î–1¯¤ ±QˆøE4Ê‚0’áÒpf™s@øc¢è%²údùeŠÉ&SkJL­Êô=#ÙGac“òéÎjr;¬7{ÊøÕ\E‘Õçœı}8¡Äc0ôv›à*è§V 
ª²;g°$òG½9F¥Q“o’À¦®K3}Ş3¶áëø±L´{®†|ã&û†¢Údƒ±óuŸ
ŞıX7L©7\Ÿª)GŠÀäJõúòñÆúíTĞ°'\!8K¡&NÛ7êô¶îtn¸-ks­ÏDÓoÏbå`@ ¥Õu9ÛëSùQ{*Ê±Å'sVˆ×§«ß¥¢«#Î"0ÓòúÔü®î‹“8‹ÃÁÓíş×0Eêî=0h˜àE!‡©©”3«õ’åæ\õ1ÿáôe<;jÁ¦G|ÑPz1´Şaòp˜D^´%B1Dq”NÎ£¹Ñ–4İÂT4øËÿŞw
ª56<Î‡cØS¸MSN+-E-I-± ”Æ{R^şhó
ÌÕŒ1GÅfŸDãöA”œD ĞFğUñZÆPo=şê/¶ş¸Hı%fZuÎ‡øg¾dœç2Â0ì÷8Ë^ÄcºËTp„ŸôvwÚ~ÓO`ôÙpSİÁ7Mƒw×lòì`±'avr¦Z`gª×4|i½öarŒ~R³ŸPJ~úøô{º©u;ã˜ª/ÌÜ‹Â“¬=…‚Ù0ä&˜Üg{9&~…/à8Ç0cÙŠåMğÉ£G(Í\Ì¦ö¶:CÕf¸ÁÈ§¡$h§ç£GÁç»»Ñ>ÛŞëí½	bDOƒÏ‡ÃiÓ^c-É³èÀ^rèoÛv€5VÌ9§—j«f¼ˆŒ¼©Öé`¬ÓSNr{‘7©nd;uCQV/ûÃ–`›œøé{a/˜‚bôAÅÉYF\Ô]pRÜ…š.9„|O{ûa,Hï+îİ|ûæz(¿;}±áy!téÓ,m€’Œ˜ö=gì|2Ø=¢="8m2¢QK`¾–ŸÑrœPy£šÄEnŠï^R™ÎŒ_3€NÌò»˜9Ó7Ç]İïÃ¿zßÇû8BBˆ‘÷ÄwïÈÕãF”šØÓ·Ãü‡µÎ'Çxr(Âdßs·&XyyÕ÷à­@"QmZÌËcşİ?/H#Ø¦`	ì(ã¹×)©Ô ğTê hÖÒ:ÁïŞÙœB8|P¶7¥*ô\NÕ:RWïK™èKY	1	o~œ±¥zb^ó,¶A“ÍÏ	GS˜tÉı0¸‚Stõ‚8ÛN®8	j>ßİîmïÏv¶DÍ]µ$°\B*A3¤Œ"Êõ¦Àù'#¼«Ï&…÷gãI€¤4HI©Â“ñ0…“ë,
²×CøŞ¿Æ)…€ğ” |SœdğÿiSæ¹Ú¥ú›?€–±İFƒÖ…`·ˆÜå·Kè C°¦—Õ<“C´xèÌÁºñPßá«0 W†8oê?µi(²B#)BFFQs-Yít8Î°uLç}(Ê8.Çü#9íXsæX„òQ$:š‚8@ü¹¡a(@ %T¯/©á0èúnøõNIqÉò‚’EÀ‡Â‘;ù°‡;Æ³ÃK)"¥6å_‡r>±rMA|óf“@ì¥ n‚\â‘<­u)GHÖšLÂ‡Ä×M.ÓÖé):ô…Ò$NÒµfİæZìŸryşÒ8“BÜ%Z©0bFZ9é“°x<^Õ¡Â¨“ûõÅ¡ùüi’2m²‡VTo€«<mà'	¶q–š6F]WPzãÉZe>é![a›.Ï=6”¶ıÌf¶q&ñÆä“p_·âÓì¢z^ÇäĞ%—Æˆ¢‡È 4b†$Xö‡RGÕğ"Û¤|ˆô‰’ù…?‹oØ"°È'â÷¸s9‘Ÿ¼ÙYHQN†.9$6ŸwÊ@ãÂˆÁdaÜ?]~8Š@•ácü(ùA]'h³d¼08höñtFéH,Xi—P,gpIªÏñÒAåÛ(  T4ÃÀ<ïyÁ=WZÁ‹6pÍèëİS‚õTK@T§;áÖImâ8«NMYÌî3š~`Z°®pó¡<LÈ®wCm±Å’æ!E#x:mÓñ†½8¡ì.d'ˆ4fªÁ™6ÂôMr˜V}â¨rV`Ex:ÀéÍÚ†g¢áë0Î|›Ş,(Kšb`îVÑÈ)ßËùdŸ4v8>p`mEm[8®XÖ8ÁfNpA;-Œvä	î®ä°KãÑÛP† ±;ùú7ÌGX;ôµÀ}™*p÷JZåbkd˜dK<vd	S] 5ØKg¨¦/G_Ÿ…Éó*ZêG£´ôTÒUÃ˜Å5û©%öE†Š¢ô89¿ÂNÎÈü´„\,¤¢ûØ¹Zá4âª
*q]Ã$i°ëo–Úv­ÄØ½JºwÎ+ï‰•4ßÓÅ¦ÒÉ>H”zrÙ“$ĞÅ¡1ŠévŒI£qŒ+JEsÌƒq^ATŠ¡¤¢âq¦èI¹‡m2Æø;zDˆÕD¡Âä¤níƒ²Â&b]ÈOÈsÑ<r_s`ræŠÈÖ%î$’Ûh­ÀQÃÇg ø(%€Ô#Şˆ©4R«™üx0<hK2ñ	-fCæôGc™!€ƒ:É—7L I)ú¡é·¡ƒ5Èè…Hxi BÇ@Šd„F)ã±›&í<æw–+FÊ¸ob¯T‚6ë	h7Õ]Ö2{5ÚIñA…v+D¦–®ê6t¹=‘Mùı8„ö8êO@ğP*äÍã{™F(˜‹O%C7|Ú8m³·¿õ›vÉ¾ËLlhUá ?‰‚óÑL_Åğ$÷¶vzéØB·¶wñ]ŠøÉ0¼ììâïàv£,?Xãˆ>\Ô8ğÇ»û¢ujüé$ ÿ„!Ÿ /«Q_#kb7ZŸÀî~²¹·¿½Uk±FŸD3	FƒIG“q
<ç9F–Û-#r2…C¨–I:Î¢`P§ª[;Ğê/µü:¿øî|“]VÂ¸/ÀU5gècè[g‹@ÌpELÁã>ã†pŸ¾d°ŸAinfëm¬ğŒB¦ğ1“·²6„İT÷†‡ØK±‡«rÛ†²‹,Íì¤ûí„ñĞtÛ™£Chgbø0<Bï2='ÜƒVIïJtPœ x¶8P ×1\N2%ÔŠ+Æ~å¶‚>;Påqœ4mÉéº$Ö74Ş'dS¦H,}Ül1x¹CyğÊ¼w1Écì
›£Ÿ’Û)»j(¥n&” w9ØÒÅÒÜäVİGÅr4>ÍXRpJo‰ /€Ç	ã| †N4¶ƒ;İ™/•kÎä-
¥goT¡(‹Œ ×ƒüÕÓnV~Œ?rôuíp,+cÈá|Ø
h;¶ğõØÊÒâ×¿ÏÿûÀ”ï×•|Oú®7L‡GVõHÛ·ì¶ºY–Ï^€’´HûÁ|jé—qzƒBoµnJ_¨sşÅ¡H£Æ-¥wxExó„)sUxóe€…õ¥Øâ˜ ÃïÛ`ÎÛÜPÉĞ¾íE£//şiôdM2ô¿*ùœE¿ûù/‚½­ıİg{^zR´½–›æ.+D”ß±Älvš´ıõRÚ7L{‚l‹~FE#dŞÅß`íˆÁN>¡w°…e˜Kµú»]´=«F·šŸœ,üÅ4H74N;7y1º]½4İú™c}çŠš÷Û_˜ı½Õ£TV$>4¦Ú¬‰°q}Ú}ä_¾ 
}?æûšù„ÑóÃ‹o{ß>Úz€;{gk¯p«í¬³€;şÙÎáZ= ÓØÿ8EaÖ@\»%8­ó8!‡Üm`¯­Î)Ğ<ßlw¬¡N};ÅŒòæÊhîZ¤,±Ğİä	jQg·U°K·Ëku»¼óÍÂcÙ>“Ìl¤2‹æŒfrGìÂ „º‘)YR(ä›Lµä%›ä²Ÿ'ûFî»r8›B,o®ë`—øšó@Yòf‹Äê< `cÏú2Šœ,ßyË’æ$ ßQ™8wæO ³°:ß,äT|ô.’İNY
ñ¥|õŒ•œ¬]ñ~yº9Yº~ĞàB_ÒRäuXRÆ—õGœÚAÜdÄ´+/GƒA<Jc´@½>‹³[$Ğ°|X_6‚A´ñ3p™Aœí`!ßkä¦.ûß/İU¥à¬2`WÆçfA8(7ù^@oÒ¯™êäB¹Ê÷÷Õ² 2+%‹ºúé$ôƒôlrzŠ®/‹%Îf¦P3 ,õ(£ápà©	â8.ÅğİÒ ZpŒ«Lú‰u¶	£sÜÄÖ²8™8	?FlJ‡¦¤±é¼àa*öy‘C7Á"6r¤h.D-®k,¸µ?L²ÙkÔc«ãNªxêL€¼Ç
9À?KKysüSâ;q8f u,Ç åGAƒY¨œ‘`Wña‹ú<øé!ú½øg~1>´À’0µàÀ>`u2‡‰Ó~ÎÌ|Ô7SiŞ`ÇÌtTÄïÚ çğvµ‹ßü'”~oîa®rC1áß@;&+°™Ì-&•$BôœğRgÅ*Œdy¹o5ÿµŒ-0bùSÍàŒÒ³×'©{%EVwEÊ‡4_¤sMf¬áÈd#N¹šDãÕ[d{òmÎeÑºSĞšs&¢1,ÇB‚
«Hâ€æ@ª¸ø.ªf©ZK©ÛóÊ’-{Á?üç`ÊÃêi×ïÛ¼æÈšL³Æ\îg½Ş¶c½© w>‡®²ƒÆàáöÛ-!¿/™¸`ÛëyLûG,­h„|ØR_€W¯è_[ú‡”›SÆ&?R\]y¬rq£Ëü¼ñçÿ%ØÛz°ûøñæô.f[™×i÷‡ñËš]˜å_ÊøRİòbŸ "ÒXYnğÀù#§¶:Õ›â•’i±zÑ&ş8ˆ×’J[`²’]«³¼m#BÑ	¸æ €k
¸ÎÀ€ë
àÁ†¨…ã\÷\«h—&¦\ú¾ù¯­@'9éı.÷zs,DÛç­GœåzºÓ¤Èş•cÄò}Wö~ËR×Wæ¶3jÂú<
EÍUèº3l~+Âò}	‡Ş%<pñıQ:øzû»Oæpïù•€È§ ÖßìÌ–]YÓ8©ì°‹‘Ó–^|±Fuo\¥ŠuW„0TVg›IÒtåÖ¾Õ¯ >ƒìE·Ï‘°nœ›ÒÛ…¾U*'$Ê[çojn[^«VBA2|›NIoµÎÊÊ<M¹›`TXã»Ñ Šk.ÛäÖü´9ûÁ‘BíµÔ®¨à™"äEó3—âhk?SvR™0LeòlåA¯,ğflzüxşæsGñ˜_ºõÿyÎ#Y|á™Ï¼³ªjÙ"«Ï¡Â†½a,[¸a9Uì2l>ï‚Å´áÛ¿ƒ™8Ö§5E{@6‚ö-‚juc•Vsê^a#·9Y‘3P%9ÍI®İ¦ıQÔÕãÕ)]
àQb¯D®£ÇÂ¦vh1`:İnuV?f•4»0c¯Èå#y¹ïµ¼ï_©¢›âR>£4†Ãí.òU,ÓW|pŞµ•¥¡ø€¨º—[á’á¾Î®c;‚Ò6¨3Qú‚éÍ¹¬¬¼ ·VÖiå²e*ä n( †¼QĞHòË¨l&2ÅWI5ÂJ¨ˆÛ­…¤SõW¡ CY§@ÃÜ=úßï÷ïÿÇà‹İí½àé¤y3›[úÿ¼î¼XZ5f½(Z>ëPd2ÎI­šµÂWóÄ*mÈ×·°ÍŸ™É]5çÁÕ¾HÓETP7GÎ1…®°GS@<ÿüÿ?SÔıçÿøÿWL/`Wy‹~ş¨ß>ƒ>ØïûYnô#ğøW§§ıÎ;[ĞÜĞ+9%¬W>nuVVaÅ?òÕ-Ë[qıÉò%×'+oéç_„ËDQú=µ1“4ÌämåáE„»|ÊÍŸB¦¶êè å„C¥ÆÍÃFŒ-\h•î,ù.ş
yw¡_ ˜uÏm±¶ÿ.¾İß|²ôm±¹³¿…€0Eó]ÈÊ×Ä°6pMš^İF«û>ÃÔQŞŸçÀşÛßÚ{¼½³µl?Ø¾Ô|’Sşö;B}å?WeÙnıáö³ƒ§8ÉİöI'®^ríĞeLy¾‡
V¦xíòøq®:“Sj»B¥íj±Y%½=¶/À9Œ´fOôºšô"š9,ÕÊ|›ÑşÅ¶îË'\xMl{`¥ô†KpÏv¿ç³¹vô÷ ]'\uåäİÿö÷V^‹FÖæÖ3Éü
ƒàïØAğ¦b:µ]§Ş8x•ar6¦¢mÇá›6Æ-bâŠM]lÖ
_µ˜éÏVáDK>Çf+&Ÿ‹ØÔ¢Ôs~x®w<:É$W¥$ô†–…Î½ŒV½vSÈ½Å	½›Låš©ü‚’zªµšëÍ•Ïœ“şV!­Y¼İ‘¯bë%š*[dú½|aÒ»nûU¢õsŠwÍgÂ¨ê†’â·
Ÿÿ*%Ç…$V£êöAWg]½°ühş +E°ó±kş«v6|6EãX¸™ó:Ğ1çŸ†cÜËëÓÖªY¨šûbz¹}ªâ
äúú<B–£äÂôğeÎ£À¨Š[§RĞìœœ`DÏv$Š`5	Ûº±UËÎÁfåüÂ–/t|º³`â8S1¼Ddôù‰TQÚˆ-Áü›œ“Kà¤k'Vuü´ù—# Pğ ;ª''¯G;Šäh‹Î#u“çPâÓ†³RôÖr!€dp—h0td±‰€§oÆ¦‚îkz+&CÜ·ÃæHİ‘?Gv+¨l•-œÂ-ê	QùALB…·Şğçå]‘¦±ºr	M£àœ5µ‹"ÉßI€×Å‚š+° šŠ§ƒ/h¦ãš&å‚GËxâ(>QVmf-lİ–ù˜1
˜ï¬™[„ğSÁ	ƒ/¶öz[û=³ó„ZşQ 0ª€İgz4ÄÜßØØ—gÃÇÉ+¬x5éo)ƒß¥J7^¾d<W)´òâÙ³Uõy6ş1ˆTèDªùS¡‹ÉØŞ~Š‚ï²/_2×ÔG+’¢9Ğ‹kˆ³®i8²:Š®á·ÙæŒ”ªLÕ7/şí>¦ù—ÆByDK9¼ ÅB1µÁóš)iVòNX.mã§ÆW¸å1¶ Zõ³«Ä˜y'&8‡“ßò¨b~¡<¾øöq»|$å‚Ò†N¯™72.cçŒD®hdÏƒCY”íÍĞÊkÀz¾YáõD]ëıYì×”ƒSÁ«ñçf@•E‚dg`a—Œ,,Sôè¹’Z)$l—Ã+ˆËÀx*ØŠ pT(Ê+	ƒòD
-«oõ‡Hí¦ÁÖ„ÔÚü#9N<ÚüñV€"ëìİ7¿š‚ĞïFğü‘œ(ÚÔ;'Šøí{z¢Èá]Û‰rd?ğq Çm5C0µ/Á–§¶Ú6ã=–MÅáïù}áàe¯œ¯_VQ«ËNÉ^é¨..çE}Gã%‚É?“8è33¾¹Šúj` ¡®•ˆ>jJèÀÃÊl%'\<²8Ã!‰¹éNÏg?8ÒÎ=O9b‹G¯Ÿcöñİ‰&£ûv×°„î¸½âÅ›Y½-n	ÔºûiÕH³æ¤)=ƒÎ›îC—Š›uZs‘;ìÌ¯Çî*%€Úõ©Šd‰Y½5÷ÙŞ1ËªnİÒ£ıá–RÜçHÁÎ7'hÌóÊ·Ê“ã©ƒ+ÈŒyè9–³^:ó—ÔÕ­×:5´ ¯+ã!º¯ke5=Ô•3NÖO§Çò«§3tçVµ”™B–m«2¢ ï9:“Ó4N¤[%g—a8ÉPÖâ9iNyw÷”)8@=ÁŞT1şş»ŸÿÒ#Tı1İOõ>«_|s…Ä·?œT¯õäh¼>å%„—#—0÷‡&K?YÎMq§,ıtz rÁJkuåPE0„$ìŞ´Ä¹Ï]zÀ’–ts5î—KTõâSÏ,W…fr-ùÅô+è›sb¼XS¾(p€”¯\“ëÊ¾ô‚”!}g
Üõ‚°5Ùß}Ö+Åö$ÍäXà	qÌİ
I”"DÁgfXÍÙÀ±š·¿B¹mOLõU”/¯ïå×XX¨Šî¢dXíKY¸§‹d!`¢›€ğ|8DÄÌé…Ã¡N·ZàÁ]TÉ•°ÇîÚŠ@£)Qªúm›Ö|şÅ*SkwJNlŠˆS¿¾¾.¦M°†ˆ7İ7oY^ÕÓWU®â8ê»Æ¹%fhÁvfËS³¥Š/4ÒÅu-IæßÚz×Ô(å£Wâ0À$¹^^`–FSuFSu)±0¡®™óu:¿äñb.iYvf]íº3;†9ĞG›)£•ltÕìÁyE>¯ME¿ü
Z~İŞ½®=ñD®1Öl¨Y5áß1Óúr”rl0eG¯‰ãËV¹{xVDWäb…U¬0ĞÁ*A‚á0¿GspU&bûÌ	ŠvÙ ?éû7ÿS jH,†5_dÏ¾cíèjXD¨ó°<$sh;[­ âNÜkÎ–~¨^lƒÁš_³ÆïT²ccÍ"‰"yË–ä/«~l:ÿ+Ø¾+œ—±‰ËèªK¾‰¿‹Üí5òóú8„ˆgP×ğÀë¼c{—kê:úMˆTÙIxktYÇ…¦D%ÒRN3üwLD ğI<C-q¼‡¥}×1ŞĞ ®)[ì)ÖNÂqß.ß9Hn9L'1†‚eû>„yùK†E:UqG{Ç÷[²r%úªRÕî–[ºÿ@Ù	ı§èÊ’–¾°áä/8'7…oœŠ&X…€å ˜N‹±qAç7k?¨ùº÷Êp«‹áf]¦ØD8"™_ÀÉY[oVÕ3xiõİØV«šätµ>ÇÕ{@µ,PGs­$	54Wİ,qVSó>ZÍû±‡pQÉ·b(ÓÂjµ›¥4Ê>&Â Niò÷K¸"JrÖsQ-3â¬×jöÜ %vŸªaŒCÍeçwŠ qå#qLeIÎ†B×iµßÿîW¿áìÇØ|èG¯ğÒW¦ßj‹&cĞè_ÿ2ØÜ~¸Åì5Û{‚k6K–«4JâáéÚ»¿ú‚íÏv%°3TVL¾J£ÜÓ¢‘ş»Ÿ·¶=Úz¶çŸ VŞÓªc€ÊÅšòÁÌ‰ÃÁìWıpòb9‡°ƒ’£¹÷Hªô ˆ
áÈ7.“†á3ñY¬†%ZŠÎs2»ó&aPFşºitùİ7ËÛ¹ï¬J›{@ˆrÁ‡™¹}(fsâ~NúñĞ#â“ÂhÕ‘O(tuUlèS&*-h=Ú>­ùÀª3ãá õµ#X­­êå˜àOğ=ølU´J½“3Xn­_Ô\ÿjPMG)ˆ\Ò~›
õ}Ü—»›,ä¬KŠØÁï÷ë_—é‚4”çõú"úøÅ†÷âé„àÛ|/ºšWNÀ£·ì…?ÄßGáóè	WÔ¯l–õW%Á;<kÍ’>WÊŸ·6…ÜĞf’½†×ãYÏÉ03óœ+íT:Íi ¹¯<	“hÀ’O€w­ë¦:o!EC”	­FYI÷?îı_1ÎªÔ¿oUÑ"¸ç(šGiÆ¦N8ÖF½‘‡Ö¶+JÊ	ìÚcïÓ~+t^Òö9¨½ûæ×µV•“¨QÕ‡ÿ  ÿÿì½{w[Éu/øŠjtÛ, À‡(¨!DB-vóe‚êvG‹K:I´@ Æ(Ñfùf’x:³–Ø“¹+k’{×ä:²;¾÷¼f2k…_¢õçíO0{ïz×©s Rjwœ{e·„sN½k×®]»öşí|FÆhÈ¬ïnïm|øH•J¡“ÔSëë…Iæâf³ÑDRpŸâo«ob©î{4ÅÃË—çèò¥gÉÎ&¬7pÖ{}¢±ôö91gdÓî0ç™Öô[×Å‘á¹;ã:Õ=ú^ùBUâªÇ}æ:¦3-<uŸ‡A"Ä9ç»«J”\u8)ÇŞN¶ÁaØºõTø[âg¶İ‹:§€`äÌ½Z¹~ÅŞ¸®±«–tt{²SN¦öœÆ;çs‹›KÅÕ#s8ëĞúàœ|HĞgÖq}}8ë%¿Ó½[¯F»¾ŞÍ¥„PzSæò–™ÿ	‚±1SåœqÊÓ	œÓ;,ìF¡‚nÌ.Íš«òåCûê ¤q÷á¦Åç¾ñW)†9)Èüot,+•¥üíşö·0İ²R¼»Æ0ş)Û¹J ³Ùcj¶5°ña½5Ï°^côKŠ×g×1ÛªxØ_üÇÿÄ>h°m’ühX4ÿ:Ø}x`Œ¼;¤X’×9îÜœq•°º9Ì«.øfŞŠxKñ‰ßF]ÁéÍ1obëæ ÔÏÕãš¾õÖ[Çã·¢G10²8ª¸blÊbù]ô£³pä	Â~`¤áı0hŠã(lĞjˆAzõ¾q|BtÖv6[— ù½üq8j"$–›µ"W†½l[ï*o·Ú9Ù–,nÓ\±@A²6×YŞˆ‹]	ëFCî;<ÖÙ4ÏÅjäÓ¨&ì³€}íIûXîb/ÎŸ¶öŸE*úà£Ì‡ôıØÊâ§ãïæÅ‡½úût]AP)¢¾<Øü{ø…Za§›¥4§ï}sŒvîCv“-åTúíúÎïlneò”ê,è}§Ó¥o‡3¬ì®&˜;&cIt¡™àpÙüQ7~èHç¶E’±š'ÎÁÑøœ”y%²öõOÛ“¹¤Í9üÍ}1*¾Ğ*ç©‚¦–Ş'D-Qği;ˆkáfMF‚+É¼3"÷µ9¦cÎ9%z¦ Yÿ`£Îá*±š}ƒ((Lø·²FâxŠƒAØ…şœ Kıâ»?fCzÁÎû­ ËNèjR4
z#ïÍş›ToµĞµâ¨²v8w"Ö[èœúÀLØ·ÇaŞ#bç€árŒ[v#|Âã)„,ê­ÉììJ¸µ÷á4`ïE¼¯»=>«øó!>×˜Ú“²­›ñ["TªÌø-Êgf\,Ås}âäú$–ka!k+èä\ø|hç
†…fİ“uVÄ(¯³Òó¡™Õlå¨s$<eÃ/½%›ñß0‰J!è-Zµ?àµaxTcçV™‹Bucïâ-´>=€&ÀôfeSdÒœ‘fãyĞÍ>Ã¬P*sÍIéÀjF<ág^»ÿ¬Â°uÚ¼è|u"("èµ@’ETaíú®hbYßõ3gŒI%H?Œº ğ`{CìÕŞ ë‘ìˆ6Ã–5äiuhÎ˜¦%L§	dhŞ”f"sLYœŒY†½Ş;Í4‚Ş‹£aç,›“ĞD: ‰Šg·:m$§½VŸÕw\‚xwãId«â³Ìôì×´dh™p
ä½G!ÊOEF4ë(Ò§·0áÂøà*«÷ÚÃ>ì;ë§Ãşò8ëˆ4YpŒrÔÿZ^ –Ñ)¬ÙY˜ÍQQæ<ƒ„ ÜryXz”¨HÅ£Ì‹(¦¼$"ÅåRÉí]ë4l»á˜mN.K$qs†½Ëš&W·]â¼e2Öî7ağ4«ìq¡ù	ôBÆ°%•Øè(åš=ƒá³Ù„,NSÈdÂg¬iSÄCÜõ1KÖ!IU d-"EÓ‚sHÛLC°É˜¦T\]6?œãbÊ–Í·p´ìµ™î'õĞÇŒù&¢p
ûÃ×(F,¢iƒâ¬øÔÆújö¯Hú-{Êqõw†HŸ4}³³°İé^°,H,İ°ÍqX˜˜Á^zÎÀ†ì$Œ`CTƒåŞ’¥‹å|±è¢×¢õF £!È`CÌŸ¢N;„û á‡Qòu6ó"Ş/ÓÎº1g18£’RKraŒ¥}rÈYAòÁLÌŸ6Ö?î<ÛÚRŸ­*}†—«ß¡°êU¶XRQBa}Á1V]PrùB‚±ê‚#É‹†ô_eûÄ!ao«TŒ^läŞ<Úè¹PBœ¶ˆ×Útl(åñÅe]ĞUpëË"VqÚôE,¿†á«sĞ]ˆàÂÑ³Ğu¼˜ûæBİJYxmA€[ˆ]êÍ¯|ú×¿øñÙ~}o¯±Å>Ú]¯oMdñl=Á€ÑïNátzù§OX•-,$_Ü¸*:!ĞûıËvœæCçfPêÜ’®/…&nAhâøÑêO¨ÓŒ†z&ä{X$ThˆZaˆJí®>Ä T˜Û55†z”Lœ–¯ûò/Y(“._;ıvÎNB”!ÅOm²ˆeBz4:R%ù€«ÆÌuYI_˜…èL/)k}®
÷ß„HÊSvS3Í¬Œ€Sc¶…óp8êÀş° ¡[$è#şq¬í¤ÖD©¸¢5oÜÃY\;s/e®n8÷2G~±l(ªPQå_ş6tõ#XÉ‹¥üJ)_®à/sîŞ2[(0ç
ŒAußÊÏ 4‹DL¥šÂ%=…Iª~µœ® bÅò›g­V;_[0ô+Šg)zŒGŒ6Ü*&~ñQÁò,îáerÎ”Æ(¶â¡«eOğåÉù{+¥µ'ïÂ„EOªøïÍ•Òô¬Ó{bÅt÷æÅwø“Å‹¾•Ä‹¾•5Âf¨Àzñ¢lÛ—§S‘£Ù]vXõ—Íp˜M¯+ópœR*ËP›sâÜjã„øvrÛøŠìÂaÄ?¿Pß_8Ì?Z8îïÃã}şö
›ğØØY8<”*oT&‘¥«ùv8&LbØö,&xmÖ±ø›gØxX°Ø|x–Z«ÇË×bVAÄBn—ó0+KËxwz’Ú¦+óŞu¿ğ2ÜSÇ Ì „–èm_ÕT
™„áhƒÈÖ6N,1ı>Šîr¼şU·i$¥^u¸\ºEÿ	Öï»C°f0™¾„½r´r¤¦o
6M	ÓÎY™â•&³»ø’12Kêq•s_ÿºšŒPÔ’CQ–øşÅşÕ÷÷/ÿğ ±Ob;¢.m\~¶/ûš¦LzK½ƒØİ=`oííîĞ
A«›½œ™àP¾¶ÇÏÙŞ°Şi«¸OoøB·g«Òé5[hfóeİx|Ùÿ×!FgèOÛ½–ï·C~-?½—™.–”á:ñÀ^°Ì0<é õeF.•ÖÀ_‡Â2æ=Å ˆ¢g@Ö”eO<&§G'CJ‹ĞşÆZéIyÅÛƒ¿<íq®8uû²Ê³Å2ïÊT»R‡ÑŸôH¦nQÖ®ëÚF-„Óx[CÃ«ğä™}Œ»Ù‰¢ğ;lÔãuWÄZ§ÁÙ *âlÍ$›ÊZD{MEöhxai8	m1õìåU¬€†ˆ\<:ô ½~,õãÎè”zYïµå\eáÈ‰Øüõ1†›ó¯º£•·Xy‚î‰;^úxĞ†Òa}wºa+FL™’p¦«ÌÈÊ¦F±š¬uf­æ†€©İ‹ğ¼Õ{­®¥·«„—°l¨G[à°D'x› Û˜	 º›XF¡×qÏÊTåGr'!8ñça‹µÂo[ÑØğx!Ï†ıŞIA¶X²İ±vH]Aõf«?D…V<?[º@í‹B§W€VA)NêíË—Ÿ^ş%:]2•WOãµ;Õ†ıôg<±ì
‚cñ°’‹—ÖéÁ¹£Ó.P£ŒÒxcÄ×09Nb€gùúcv6c4¦†Òš/Lœ³Ga±E–oX<£(8‘‹nÊ;½ Û½à«Y.K¡X© Mşñ~¿r×dÎ¥¾Ù|\ßÙØßİÜ0W8°ğõ€dşğ¦¸‚ª’»GÈ.L´£	ë¢ ›Şºÿ/-™£ ×ÄM[N kØlÌâN;&”ÿô.ØÇáÑGğ°+î÷Æn².Úœöq-Â0¡lÆ€ÍÃÈY©vßXƒº:a¹~¹¥@63»cÉ
s(JREùë*jÁ‡&k”İİêôÊ±Ó4[•Ç>h²æÆ‡ (2(k±ş1ıáÊ,+‹Y@¦FÇì~ÛA[?£Ã&ZÅƒåô4b½şği,6d¼•˜YŠMUö~}/o°ºuİÎøHZÃ4£5,·¨_dù€oŠöAÿiØó–âáÁºa÷ÕE~9Ì¯?œ:Oh å ¾>ÃÇEÉ¹7I%ö4ÀŠx¹¶GÈbqKVK^ñd4û7Ì]•ÑÌ¼Ğû@#¶œŸz-ÜN´mï›ˆú:e†=È¸7+¾>0ÇjPQ.®–ô®h¸7TŠ.Æ‚L1Yï¨²j…ÖwN™¶0Œ”î\:éÇ‰UÔÖ®I‘H’=•¼kd$vßÍ-VRl-ŒU+Û*^üÙÿ›n+¨é1°iŸ›t ,+¥TòÍ‡ûõ¸ÛŸ¿š˜İ».ÙçS•hiXœjÖXf}wg§ñ­ÍİòKZß¿ü¬±Ïî0t<hdfG±¦Nì¦Ö¤¹úsÿ7'â(2Ó¹Ké~]'H\}1/RzR(¦ÇH„Ø¯Ä¯ÍÌ1»÷7LFz%Y”ŒjEÓÕ€w·@] Ÿ]‚å/ÔïmÃñ+Ü=Ç aín(/Ó¸Bœæ§ÈK#‡ËšEê¾¢Æ£«•¤fFf¿8?á4QË”W3Âÿ>áë^ÿy8O‰-­Âÿ3oå ÂNÒíÖ2ïÜ¿¿^.İÊ°v-³½´X\nU,?Xª|T)=¨,¯–ËÅÅõÅÅâ-¶X¿*·‹‹l’-Áß­Â
ä(Ê•Ârq	ÿ)W"ş‹ÑCk±X†V,WY~İ*Şf‹İåâ-H~k}q	^­—y™KXäd+Ş^fæ¯ÊR´Š¿*%õÿ‚xQ¨”ZP{q±P,*Å•T½X¼ıÌÍÔ/n”J¼Ç+Pqy©x«‹ıX*®®ÃÃ2,(V¾õc‹®Õ‡ú}†kµ¸Äd%éÍZZ¯ß_ÍÂR–ZËÅ
Ô{»x» £¹]ƒ]qìÊ:ŸLSY¦é)Y†÷¥TC±XÀé+¬>€6¬c{aäDûxc—Ò[U¾}ke£2ƒ<Zh@…¦ Â`üK›
-Å×q|–Êf	[ÈkcŞŞ»	Tn¾ V}°¹óøsı£Æ:{w÷ı­†Á¥ÒâÈ®JLÜG¯€Gã/i¬ã)ÅŒéÔî¸…qeğphÔîÃan®İ:ß¦‡*–•
&àyİ‹œ5Ş*æ›E÷˜öiô°7¼|ÙëŸ±l€Ü¼vs+µ¸ë$xyëC<Š68=„'jS›ŸáÈMí¡àZ‹ÖÜ~ñ›Z®Ö0^[m¸_Eç(—½¿¸}£¬ië÷>/6úÏz"Oˆhùä4zrfgÖç¦è˜›YHÅÚ<Ã¡ÔFI#b*‘<#ó§Rõ}ÙÃ3aÅbQ‘Ã7å'íõÃ2Ó0\,êMóMrDvÓÅÀ \+ÈˆôÌ1¢Rz}p­­AÁ3•‹Ud&G‡"×©È]‚ÍñÑœõçÁiş^W_¼’.@Í	Bƒƒ`X8Á«=Øn²åÅåvx’7$Jãw%çÇß9(,/¹Cìt@0SEóØìÌyõ*o™M8dÜPee[Ébr¸­¡‹È][•ùpÍ£SÜúAcß<Åm5â§¸)!v>Ça;íª:qg6{çë‹JƒFÈ\ñ¿F½Ú
ø~=d˜}DÅ]ßİıbpş·ÈW»Ş«L_ºúèpï©¦«³UØçõæB§µ†aHlâ 4ĞÂÂíÃº- ÍÄï«¥/dİâ®&õü½”´úßÀ¹{Æy{Ñ]§tŞ¶ƒÖqèÎw¨ÅâoÌ’Nï–òˆ*óaT+ZWçM¼´€YaÙè4@ëÙx„\Íëó¬×‡å÷Pònõ£Qîİ¯‹ÂK“­ş	lÉÃNHNÎ‡t_}<Ç¸¹!S5NoF§cœT.Rè+s˜Æ&/'‹bHoçÌËr,aÔ'L}Î“³K•<?6ğz8Wõ·ğ~#D¡±ÍmV¯5Oûc˜¿J¡İ9ÁÑEÍëxšo¢jkë7xaO—Pv‹ãõ#K­R>çN"#¿\Ê¹ˆoXsÃhõú¨XaˆÁ€±½îÃFã#\bGá0zKùÏ=~,ŠC,ì°ßÖŠÇıa#hf).áq/ûä»ÖÃ_XjĞŠ²–ePS$îáO"`€¯lã&¿?{”}~x²÷ø~¬º£Oìl.y¤#P8’wE‰I‹@rYÑEâ@rÆv«2´ò
ÏB}³HÌ‚®—Yœ‘½³†·n‘‰{&xu{±µ|Ü†W$MÁ‹ãV°,gĞ¹ê¸Ïípe5@Â|Ú`†¥`ñh53ójA{‰dÈK$£¼DV”“¡…Èmøc³ ³~¯O®öæj^$xà¤+Äb gòÙwJÇå[•À+¿³¸¸T^^ÖH'²û	W«şØşHŠRZH¸'àqLİ[}IğÅŸı6A2'yè'ÿÌšŸì¬³­İ÷i'üâ'¯_LQv:‰Ì¨èYo)„I'Z}J‡kEdu‡/^ £ÄòÅŸş@»–…¼1Ö±$éPbáT]y2b’t|ôW¥Õşb…ôÀÏÅıÖâ’%çÊ¨ŸTñ>®ŸÉÛs°$@ö­I¸eh®±ÚÕ[[n<®„í†tÕ@’—n-/¯ÜNÇB\­İ‡Š¼Qƒã=%ì¥;’9gÉ¡yê='¹‹M‰ 6Û›”sÛ*;è°õ­FİÈË½P²
“¥ÈDÊØjHWr‚ìŒ._Æ1"ydrİ6š
Ø™&ŒÀÔW‹IE s}”ÃÊíÅ#_àZ?Â®î¡Â¶¨,qp"Ê5	ĞãŞÂãàï«9Ï0
/û¡.'<LF÷©ÌZæ‹?øãLU¿»}ø‘ùö,|ıçb¾Æ
ß~÷Ç™jæ_ş.3u;0·2ï´ÚËaºª¢{Ã0x
b3şS 9IàAôVŒüA
s³1;vIÕÁq-èşö¨š½IBêÀA†d€¹!²†œöğ˜²v4BÓH>˜Ü^“€‘1~cØ-ºébElÏ¼wÁÿM.ÂN+¦Şëœ‘áĞŒ–èt±"„Á9ìª)­3Q‚<3è~;è!Æ1Ò9¹·áØKÃŸÓ9Y7¿Ç¿9²R:7oûä48›#/¥s2ïÃQ4GÅ”ÎÌ;»İõÓ°õtF^•ÎDDéõ`Wk…ˆv––ÙHgÊçûıgèYîŞG!ìí0j¡åşÇ5Pbg„T.º±©\#ÖQD°$[¥›¶óØ7D‰±¾œ€Ôûâp=fhšy°W½X«ıÔ÷9 WcÖØB3„‡Û§šŒıxÜ(Ãã™Ó‚G¼âîRE]ÜU–bÑœ¼²”ÛÊkµÃ¡‚Ó^*,pB¨E_vº¯>"ÊĞ‚¤n“¥N$ó¾H•-#
bÙ0M‹"œ ïd¥M´ÂòQ-ë˜“e7ædˆ96t\ôÑ—ÔbŞtİÄöÄTß1Bë§ÉHš"º=1n'–Ì LŠëY­W
ê¢RyíM4MµNÖÅ•É~ü’çÄ”30’ŠPTJ^0‰ŒyD[ñ…09!¾*„½¶ß²PµR\ù¡ŸÛŞ°?NhËÎÎÒ($Jê)“Û;şUB®ê,gÃ~QÚd®.“Ifì°êW–ü¨³WÏ›Ü<h2Õ¢ÒB!2ßF’÷.g¨½õôB,æRŠÎG^ë(™;)¾Í¸íüQ_â»Ìÿñÿd»{Ê é1¾˜k1÷¡ÙY«–)¦7¦dÏbæ·šFa¼Š´ò–<ˆA-³×Ø¿¿»¿]ßYo¸˜ü(öĞ\Ëln7šõí½f†¤ŸZÕÁ§Ã~¯qS
 EŞíË—GbP¥Ë—İË¿†ØR §QXµ¬?Uò”ÔjÈsEvÜ©S³£"Öp²fá¼ÆºæH`‰}Újì7Ø^oñ§êÚxˆË	¹ş/_²p „Wì"´a‹0Š¨¿f7ìóÆ•»bg7»#<SzRßÙÜ¦`jvÔÑmÇfŒÌöêƒÍ•Ûª³Æ‡])Hlìz}kıáV“Õ?š»üL5y;¸üåÁŠ¡©CÂèÍÂSgŒ˜ZÑêÂk«±ÙCóÜuå>š™­Ùh­ŞZE‘áfÚª:¨ğq£±‘2ß¬oÁÿëìÕï¾ú=üïó—¼éÆiï
m9®F6Ûõöê÷_}ÿó_½úc];¯P5&·ê=.İn‡¥”z7ç¬¹Ïÿêó¿õ½Ïúù¯uÕtÚ¼Bİ”Şª|©¯–Ó*ßxÿA}kÿÕçÿøùO_ı¾Q;W¯R=e°;OĞL3¨£~ÿşæúoNn'ö£VGıø¸Ó:šGçRX­şx€¿Bü‰@¾¹ó”êŸ¯Ğ—¦Ìs%½»ğ`÷ııúŞÅC?Bt£céöD¨|€Æ; äó¦ªãúUÚª2]£±;·/?ÛßÕ#g~8òó‘ía8‡}Øä@¼†Và
¬ë\smNs:XŠFEÆt¾àv5$‰"'İ#ŞêX¦ÜÕŞ¤2’ZòİÿÒì ¹"ÚÿØğåOû‘ô‚îñ·!òé BJ»~at´†a§+o‡G4ˆl)¢Âı1ººe££âø9;ÇK]ÕY­Át‡	_ca-&bÖö6‚‘ÔÅÅ•C*…¡X‚Iíòµ%ä2RÀ~vtá\Ğøö8ˆö¢QUbİ2…‘é¤tMEZ<¥0AhûıÁ½‹&âà'uQ§°Àk#
‚!ózòÙ);:9Ğ‘î­’èN¸(El¬œ„<î'HCÖ#‹R òñyx °-E´›xèA‡Íáå_Gï ¸ÿ«0Š:”×°90Á’•êÖÒºl%v€	Æ½h|¤ğ{ıiyoÄ>»$Û¯\áÿºì@ó`Ğ½ G«É‚uáDœÍ¶äg×ŒÃø`ºšÓåÅ#6,‚Ô%Te6ú½p›ˆ˜Ò˜öKâ:C†y<Ä&…îZ,ÚP»0õ'á‡hNÌ²OÃ‹<¹ŸŸüº¡Æğiåg&"ªĞ˜ú‘P™(ññ+“É‰E-òQ¶ä×,y+¿xÁ&Sİ”\J¹’{¨b­rëâë•‹5X›(Ù,v]U%?:œ¯d‡Ÿ¨k|(ÂM©9–İ2å6º”ËsÛn13
-@$W0¢š%‰o‹³Y	½}^áõƒúãŸ4] =÷Ló#Ètx'•@0€q§7VÔ!øeğC!#Ş0šª5daÿ*„#Ôõà¨©QÄˆ+&yÌ ½!(Y^Îû ¹»S$¬¸¬x™cUº®œ¡U6ñÚjÍ-ºfËEá]ªUf³#İì<oHDfwã‹,/V9L+$î=j‡ê &„
à•±:10.Ì<;>’`ºÔy1µF—ı£˜Ëá¬™# òò—‚Xˆc•ÀÇ­Ñà¦¶îûgÄı2Fìwü3.Ğ,ºŠíÍÆ|ITA¦$Õd¬¸”ú|5™k•ÌÏfÖEÒƒ¬EòˆXm¾º»™¯S¨È‡²¦-½ ­Ê¼Ãg,şùê¢|ª*Áeæê”Ë’æ«OÊ2éÔá«Oæ|,¤ §ÂG™vĞé^`‹`BùßàáY>ÕŸ¸ÇŒh´xBØÌ¡2}jn`|QÃ’ÂÖ<á­AbxüîäéôIğHœ›³·%sÆhH‹`ù¿ß'` Uë•¼xªP×T-|¹ñ&lèœœÁ~ù—ìS¿øóIğBù8‚óæ¸¸(AT>^´(t	×q9Ï¤hD oMY²ÀÁ°?¢Ä D>Í1tü$Ñ„‡ÌÈı~«O4q>è5x¥¤8À‰Hprq"5CEf90NMÕCÖqµKXßæBÛDmsí}Æ†5ÏfÅ»‰sŠY·å>	ùíM*gòe3|#î,oKÄ¿3¨¼ßÊ¶á?	²q#ƒÀ‚ãâHæ.`Ùú&‡²]U™m3¾ÙÜÆâÆõhk+Üä+xC<˜	ğdŠw"Œ)Çzå›@Œ©&ñò%FmÓ3)gO‹	^b–Å® °P%ä×$÷xı›€ZbÅLèwÃâ3Ø¦²™Gê}HÄDŞéÒÕŸBTt#{èt”q:bîÃ [@Ë5,öÕŞJ5+-6œBÄz™E^f&:B­0Éòrò,Á›x˜|[Ÿw"ÒÊ”jÎ2Zã$sGÁ¯¸ğÉ¹\K:$™(Av¼[ÆãË,¯È:/ÁQ«0FX‚YŞ<éõ‡ï|†z¾ˆeÏ.v*İNÎè¢¬Dzkí$u—L‘ÃI¥S+†’íõéƒêæUçfwØ¿Ï<Q¥ÓÁQß¨ö¢ÕäZfÊ²ïNÄØ¬£.|Ë–òå•Ü‹ø5÷D¯qëTœmK5­—¬}„ô®aÕ"îSúÚ8²Ê3×°øWj2ŒM^y¼è}Vír@øy§Ã1n {mÎIàøM›†Ğê}EìàŠ¼€NríßÏáj.,H—œğµ’JíÓùšÕrÒµq™*'nU¬+Õ)^%Œ ·°~Pbì¸mÉ”|•Øƒ‰&Ï–td‹Xækx<ê†â¥Ğ[¸y´F…Ó~ÿit3|~ ™ÃyX€E™¨Wyf)aåñ$ÏU¨yS/šw•yWg™7å6;]æêèëƒÁW¶¹}Yë$|:{XÄÇ"ó)E;ôÕöã ¡@"Lê‚÷ ˜Õ6Ç­U¨?ÁXZº8„bÛG”K*³.Ÿ,$Ú™şbînìâ÷9ğrÙ±ÅœE_àíıFµÄztBÓ*æix0+™YòË+ÉnîÊHpo9¡u2<´„Z™Ïİ<Ñ®IÙÄ,•¼hf	Xf1[ ŸÁ)÷ã^Pß¿±İØ9Pqwå0ë¾“©	"ÜÀ„¹1ÚFíB¾yÂ$Dİ‹&†yë…ÃÛ[hóøñéè¬[U9{Röû£	NTU`ÜQVQÕwÊ‹å•ò±~SWA9¬w¤éUõJP9^*©dqe±µ\¹Ã¯B«ï´n«K-ñŸÃÕÖí•ğ|—Ú«â>«·W[ây±úÎJ¸²²|ûA@êÒr°Ü™~crÔ^ˆ¸s²öM¾Ãml«¥;Ò©tgúÄÍPfÂxk¬ÆÚD,1Ë®ÒÛbQ“ %à?ÚTğAîÃvÚcw§°iÔ&8×Eø5µZj:ÙšïºØº°Ù¼¼(FlVBŞüÑb/"êµr‡$ÖBª”œÕ}·ïİ”]N¸~·¾Õd{õÆÖoëî£ïoQmÉøåbÓõÛÁE½5Ê3®î:è„4¡ÇßÚI¶‡Iğ‰´c{:ı„IâZ©<‹9¨ëa»3ú0äÛMƒÿ¶6–ÓtUzø‡IWÉ)&SKçAWÃ=ˆ
¹æÄ(1+}HŒŠk(Sò“—Ò= ±3Y°#ÇŠ.ñKCHÉñoòjEî<jÄ²jlD§± C7è »ò¦¡é³TÃóYºÄ·;ÑN°“íQü‰»[c¥œ¯Î^Î†ÁR-˜åöìì†	Û³CÅ5‰ÆÜ 0-#D¨ª‘ê¼À)1ãl^şT„…œ¹û¯ñã¿òìx‰«NÌı
Ë¼+1Õ”¶ôÆg™»ş=—ll2w?Ø}¸/Jx»V+¯eš™jNËÖ|¸yĞˆ£‡Î'ºš÷ÚÒÆİh›—Ÿío6Xñ@î7Óâ™ÇC«ÔÇ¨Yn/œ;³&™¸¡rÌ˜gí3±núÓÂê†il®ˆæHŠ‰/^”ÂûËSRÿ¤~Ğd[›ïoŞ­?Ä)ÚXxğp3ml¾ÔÎĞ}vøZıá}ÙÛÛßLâ/«ÜR^¯ÂÌÏèHãŠÔº{ô)2­ãˆóıà×Gh•N¹QádØiı<2ÚÍ¯h¬+&`Ï-dŒÿú?ú	¢aó«™İ{4Ö6ï³o>Ü=ØÜØlìğ‹­q¯gšæ›¸˜ø[¾*U^Ô%ãÕ^kTµ÷kWz‡M"ç¦„Š{/ÙÂ/şüwñA´P0»Éâõµo!Î`'ÔmtZH%-Ô2„+ÙÛBë2Náï{ÆğAãŞÆîv}£¾¹ß@ı±1†"’3n¡QrZhÈ5øÇn!JÙ»<ÚØI,À˜òy?A½iŒ€‡ıg.4­Î±¯°ZNŠøcî„tT1o_J±‚ ¯Ÿ ˜S¤¡ş°5ÇÇ_U°­rï~ÏaÙç"/‘=ı‚·_¼¿’Š÷'"×ÿqc Ja0SgÖèˆµ»“Îq–ğÑŸ£#æ¡1›»c%ˆZÁ ÌäbBÖÔ_ÚŸŞï·Æ»éùÙ ì|áhD&ÌÂÙÆhºÃüÈ‡qbE”<«3	î6ªtm¡åL)¹­ ¹!Z…_Ód¤X¯xcjT¢ „6Å{Pcå#×şVÇ@LÚ×N²+ùñRj…pm¬úÖç­§±Å˜±Œ3ªeÜéîÉ»
zIj®ìIøŞ7Ê¥Rnúµ'yCÿuR¤‘t zSæ2¡	P<ÌZBŞ‚||.şJ±¥·[rPB)ãiZ'³T"{‘Úˆ´¿ï'íœ¼gãsÆ :¹ku|‹³v‰”=â_ÿâû¿šOvòìi{C¶üúAƒ­oŞÛŠ:œİÁ:ğzv‰kíy:8ƒQó¼{Æ{Y@»»Àëp|ÙÌT˜Â$˜CiùÂ®ä-¸,
›áóé7•²œ!HØ49:´‚Læ.ŞF‰møùŞMşİ—uÂ7$ËDµ»²$`¢"ßi§rlÕ‹»úgŠ(†½“n':EšªÚ<Cœ•&Ë3‹_Æ¾öeîjõàÛÑÒö³X{'\45V.$1CÇ` 0EräaÑíĞl,W.·fN	ª–Hşón¼’é“A©}÷Ç¡x/S¸Ãšm€ ×eÉ¶‹uáÅ‹LÆaÕ1 "‹£Òu;gÑ›eÆ_üà¿})¼xñÖæ¶OıãçÄ\-ù†±—ñš1¸ÛTÛÿ <ØÓÜßÜ!õ€ğ?Ù(sØ(.Ï(®i»D7µÆ¶Å'ÛvÒÆÕ­Lşˆå´šéö{'™üEõ·iÎSm›õ´Ù'ÑÒH|‡Ÿ<?¸l!^Œ÷@‚²\’o…n6›<zmğ™»™Y¿ôúe	¯å>õ‹©ÎwÚzûçŒo`;¢‚ìİ_Í³ÅÒUëë›m|ÂîÕ÷ŞÁüvÜJê;Héq/Â0e'ÒTš8 < d.æ*ÕX)/' ¯QpÛ›íçò–‘n¼°s™³M‰”ÏMğü#ŠãHäOÙ2y3QN”{Û¤Ãk‡ü~ ‡¦mî°Jšia˜‚<y(«¼8bCLTÛ²m	­é‹ğÊo(S~ÇÉ§otü£œ7ÅÀ¸iDö=Jj—˜§5ÅôI›)”G:®i‚¾´3ş“'ïNÚB-Y•Ú;}‹oc¸ŠÇµb¶“gm\Ìvªm¾æPJ2Òq­{x%ıG ÒÈV!R–Â¦-@X~!äT,†:Q+B w4 kªpçÇ#P0M]RpÕ0èYYÓM>Í9TÕ n(Æ˜¹d…Š.’½ÚAtÊh*¥r¾¼²š¿µ’/..;àD®ÌâL”İ|(JÌ™Taá:®æ^i°ü)„†ªÄĞ§Dû$3¾îÖ4ç5Ç<Ö{˜ÎXü’Õ’¿„_äM´'nş©šëf9UÑí‚Š8b‚0o¥â­e_¡î‹åå(>
QËi†Ñ[‘ØZæ”.ñ¦‘@›PW	¦ìÅç€}U›Üz}«±³;İW¾]{›[á±×*!n/« jä+,,gp'´Ígè¦S ìsyêıDSâæğÓv­Ñ¶ô%Ó`æIÄ’è†ÄôÄ3™–šv9²F^6ˆ5÷aGı$D´a;„/·QøÅ7åœiÅ#ùÿFÀ-šúÙoıƒª –öÛbë WüŠ›	tˆì/(N-à=İ{Áà|kAW< B¶)ïàzsèôÇtÁ`XÏ‹´b‡x‚m¢ì'‹İWo‹…Ù@	'dÜI×)­Ñk‹«TY¼á¾)æQ¼e{2ë¥¡]7ßøìx±)­.ÿÎà¸a`rzƒš§‰/X»¤{Öi
'İI'A'¢š6lêÅ
ò<;RL‘„å3Lr´ÙÛø2Ş€½»$²Úb0Ï)'”%VkçU™[a·ñÑÛÏú{ç`8äÑVŒwtØ=>¸µêó¶’c_c·xZr D÷ò“ï°÷ÌœğâÆ–_DËx’‹§Ûİ)Xuİ€2n``)2ªÜURYK«ÚP+ßŞ«™ã
o°º˜ÓbÈy	l®8^ÓÂ»ÁKÄ°çŠ ¬ÅÃ¦›)ÁñF'iÇ?>±ñ
Ú–Üğ‘¨óÃØÉù†ŒÉ³c»C"n·ÉÙ%t¢Á<Ußj5Å4í´È–·i
]ã
)oY‚™À.ˆ¬!H$[–©3³’øxL8x‰”ÚÎAj°òrH¤- mæó²ŸäŸ‘ç•æå0äeó²yYÿÔ2”03h-ÁA–*@|X3?ayHºL$]Ó¹(ºã¥Wq €ÄÒ¶ß¹¦ò&çíÕsI±Ìcäœ[¾ÃT:÷iÛÍ|ô€›3ùÌıË—çCşs;¢ÿw»ôØ¿?wzüŸ.ô?÷/ÿ	ÿm†8í¡û[f·5êó_;ısùrãòe‹ÿ>txé8Ç*wº`Øªİm¡GÏ×¿ŞBô¢ñÚcØÒ³Q¾…šˆÙV‘&i?_rÑBÁË¤¼wêyÕ«2³´ì‚tö·Lï4ÚĞ~K¡yÔ@ĞîJféƒdàX¾i®^Ih–Ój›CŸ·Õf§7/ áZÉİQÌBÑ­‡^¢û?£70X™P¾UÌâ)”
ª^ .›$|ÔLÑF¤K,< Àd±–9Òk©,ËÅ.ıÉh()æ’®¡²š3D¥ØÔvĞÎ”ÅÈ;m±yĞ©œéÀ›ÒÃù¦Ó4gà„˜ú¦†Ç]Gd@ÒXÀèµbğR¸üqÃnùöwèÔ"8í¸²•¸ZÒkÎvÕÖ"¶é¸l`«(ö8}ª´mäÕì¸Ì‡{“Ê
'[ãKUpZajúwÕHu'ÖpZ¹ø{Aö—äùÓşÖqGVà"MuDòĞ‰áR`×.*fSí´&É†”»™›ã@g'ccTÕ=›ïÈE"‡ªŒaÒz[”2—c˜Ò‚lÀ]k€Ää‡÷Ä(F·ÈİŸ¢ñÙY0¼àzè¯|ß™sW¢n	åï´2×ˆJõ¸yîŠn¬ÍÍXŸ<Í³Ó\6…İ›“ 5VÅÅÂÙ;¤öm{7Ê™ä<!0bîT‰˜r÷°Yuøxz¸fŸ*è0^²ö (Q/®T¢q$ÉÇK”á[æ,Ñ±•hÉzT¢Õ’(¥¿3Zn†^ÑĞ{VZ{£¨¹uÈF¡Šóä~¼vƒÒF3":£ÙòSMØúE”Ô¬F$ä&}”??¤	9/ŠÜ@wŒõ$¦4—¬‡.v=•µL”æ¬—z‡µ§ÅhĞÅ[Æj&Gi¹pk…ÎG)óçyRâI¦šl%õls /4ßD=t-½ÃÔ5u1êÃ¶òGpÀÈÑ…æİl{·ÆÊÕBÙ¢ID©	EÔ€ğ@dt¿dPÀ‹®ÀbAO#>]ñóÛœ¯¶ğŒ&şû şûe¨{ğÌ´\~ˆHA»êêòò:¬êQ:Hd;ç0K^:zOÊ¬$¯˜@ŞX¼yµ´ò’ZóÆ8NåÑØTDj5¢>ıœââ’ˆX;Aºë[¡¹B«7x£SvCC¸:Ä™k‚j~–b²çê¸ã v1Äüì„!?AÌh4Ï›]í¬ìF^«É’C1É¢œJ4Ãb…NäYo99å"ñ´Z Ûy¾@=·÷í¹· Å'=UÉ>9’2g |Äz>‹JÎD««_£²ÔâäVDHÖtIÖÍRf«,ÙâáØ|¡ˆ…€™2wüÙïãÈÍ~4;»”ÚŠRbXˆ`2]³{d®Èã3\‘¨/pÑ·¹¯0Ô"›US[&P{d;-BùÄ‰Oî†'ŸJ—pƒ©“bU±glŸbÌÖ—Á…5kæ3n)!F½&a^Ô„Äa¬²¡cM
_UöÇ^¶î¾1p,š*7	_DFŞy¢Í)ßğ¦­Y®zU7Ö™\ÆµºÌ»@.c~ºœF*èTˆŸxM]•Y,ñj{šË°ğB[…B+¶3×qf_²ÙùeU/8Oq,¦· éLOç¸õ&…DÛ³‰y_›µïxá0Â9~ +{( ÒwÿÁ)±­dŠ“¹;ÑºòGôópÊø‘ëgûF{scFo¾!®Ú5j0PÏ¥õ×¿N¥šÅ¥Y’$iYqòÖJÅ%rÓøâ»ÿèwÜûØºöî]"JµÒv\cfYm'Ø®ºîÿ^;R(h1v7¬êkÊ™eK¾&TXSÏÌÇôS>ÕT\3•¤$Cêş º‡¼š¦Õ”0…Bm4ÔÖıOï6¹ÿğüå{»nj§³·rÓ»·>}“%.– ÈÅÒÊ´5²æJH2­z¾æ´q”¯DFe´cb5ôh-müö„&£`ŸOíË—Ğß¹´@«£~¯K#º|™1pİ1š%¿x¡W3”“b±èL‘½~†¡öCX}˜&š4ŠQŸot}Ë)q¡xmñÕä[L}b«8ä Øc2'Ô7a‹C˜“­«›R¸š‰¬qÊşåïÄ
VkER,peĞôScVí@ã£•YqfìÕ1h‡åB>³‘9”FºTš˜„bšµ: €Ê÷°»¶İmÔœ>á÷¯TC‹j0{¼€o‘„
Å´–è­¯lTÜ
J2°şè4ò>–©Uv9'íuäò6ØIÎ]§Â u¶­\tkÃ³
{„œ“K¼NÊ%o¯u®Ó *(à|3WÌ>¯µé¯¤Ô]†s,ö” î1ğQ‚ºàğ\O™ÕóEÛ¦‹•9k×o«í=ß!™…{¬©	oCå:S8&ÔÎ`¶ó¾ğ„İöÎªkoË+ÂDÓçX¦I®mÈ??pãXu/Izm™Ó#jÎ\ñúŒÍU27Äª²BÅM÷ñq\«¥F”sKµòœã–Ì5[*«ª–"xÌEŒ‡AñÊÉï`”ØÜv”ñ9å©å¿fáÍTÕÚutŒƒ¸Fán—ŒE0uw.ƒço…'xİŸÎì»”(J'*t@¸ÎÜMI4FÖÈ`‡ìĞ ¥7X9~ª|`{ºİğ7W»5İÒLúòåp&y_[ßy¿Á6õM	ÇhÌª–”r‘ÅñdğÆg6ƒW\`4mAÉ‰ì••nçİøäŞHÌ)š¨eÿò³&†fD¸­:“§µtd8Ï¹ruä‚…tE/SIÍAQİz0"µõ°™ñ€*	¡pêòĞxêöDÈ¡¾21)t»˜«@‰LåÀ\¹Ñ¦ÅĞÏ*Ğ¼É"Zïtì8=Gú:ˆ¹0WMÇiÙßg!–F1±T‘€”5rÏ¨³NïcòºY.iwir•NôÃ^Œ;Zc7ë¨H÷÷Ã¯¤Qºè|$jˆ1ÒPibUÜšWç…§€cù|Qg8£ê)V×{òNû½[,Ç÷ä÷\ÏI²W©ùJš
©ÚäViª˜jÜ³xÍ¸D°=ÛoÇj¶Q¶PwË6z¥†kÂ‚.åÏ‚çƒ»R*åûçáğ¸ÛöI5ƒîŠI:i:“Y\NšNâx°_ÿ6’-`˜,›Ø×iÎ/IÅÓÓJ›Ä.ä§•g®½'t{T}wô¦O¦I˜ˆ¥Wç²º¸ÂMÀ‘IØŸ¼®åÜ;¯Rò¬ö{v9aÁºmà\)Á4®V(.ÓÒU‘XÕÄ{MZFÓ×¸ÃŸî½š)`$hXoé©Bc…fÊœŒUkâè¼çœò­å|¹rÎ;èCéãùÉèbO°¤­õ!I$qÇ$n˜dã’È}½ j3¥û_y[¡#Í6wŞßÙ°şI²|hŞ–“‘ 4xsBáÒ›
çXş®2Lo+,…£g0ë1¶™ˆùÿdNsd½•BYêê¬cjß©é˜‹Âº.”dÏ1Y¼¼É½ûäzOv¿±¿İØ÷A‘ü¦ädE|Å¸¥‹ÌóËË‚µ¡R\p_n¶v,ó1zùùÚÂéW$®ş;HõìzD=;êMHzKóHzfq)qc’V^XÛÌ’¸÷úrÖÊ¿9ë
›XHĞ|BºOF¯
Ÿ-·]ãv<©¹)B ZÎÚ’Ã¿Mq¦n.šã³QÖèVnš"Š1ğKvñ1H­·¿ÌÑZ©äË«KùòJ‰Ì‡üw‹Iƒ%µ®w¿øƒbÛ—ßı >Rªó3F*y1%1o¢q—†Z¹õ³Î°Ã¾‰±‚Õ¾¢÷Ÿ¥ø¦
İmë…9uõÒ©KËúæµäñÛ•Ø—»³y¸˜¹¯³’o?È&ËM¹¾–3Şö(•3{Ãğ¤(t ¥‚Cc,?,ƒ®©xj rµB
˜\Ì¼‘Óu/ØQ0ä†ŞI–?WÖNÏ6¯ÂD`Âİãè@¸“	„T2?dÛ»ñ¨®®Ê®µò:s{axÊJó|a­I7Z9a™O~Ğk	ÆùæGÓ>ß&îõ˜£32éÃK'ß&»Qó÷çQçğZ¬â×¯ımüG:L¾ù“k‡^À ©xqW¼†)«æ
ÿlÙ™ğ\5ó·–09h¥L Nü(×ŞrU¬Ø§lÆV]®˜<ãX5yDgCánêÛ	Bè~ÎçÁL£Uè"v¿—IHC˜™¦œPæR¯ø„µ9šIgŒÔ½@ÊMÉÇ/ñĞçI0êĞÚ¨7ÜÛ­ïo°½úûß_wŠ†ƒÚè÷Æ#‰w8@ûqâ<‹`X­–(äZÿ)=ØèOÇ’¥t‘á÷*©¡Õ¶ M…}ƒîmÂ¯¡‰¦!Œ%I€@³ÔŒ²Ğ0:?áˆkÀ Z}›ÀŸïç^XÆ„{W¼ÿ
lRÕ÷‡g —ô	Š¨p¡ÑrÆxÕYë9/ıfeÊZú÷°6N0¨	 1>µŒ½õ‰×‹VÓƒ6'¸v-Ücê-]7Ş€A†Ã€+ôqÈqL°b>&˜·™V0¨eH¤Í%#&¬ÙyB[ËŠ«ƒ(Ôv ¡Ÿh5ElÛ^Ç×ôÃË\›	˜i¢e
¨L?ÕÌ©¼ÔH‰ÈóóÌoÑ8 ˜—çyyéhgØ®q\8¿[Z³¸XÒÁ<Ğƒ2¸”Ï# bNJñì‚şh¡¼V®Wòæ„
hÓâRdZºäæÀÃûpĞÒ;	G¿•\ĞâˆŠFUŸ€@ÉÉô‹ºÊ]2è~³‰ßâ¶^“ZOMáèÈEùLNàÿÏ<íÙïíç„f³øíÓA‡¼Ii^¤ šù¨±ßl4™¶8 RvÛ½F2T”*j„‡û¦¢¥‹R^o¬¨í]hÒöågÛ»Ğ¨ËÏœv‰¡sscXMÜ_ëû—Ÿ]~ÖpJS¦^K†ÄÂd46sË»ùz)Â4™  ­r&>yìıÜÊë
¤ö_
 'À©E{6ûŸ
±ÉW¶•Ê¨|êF¦úTé‘ãR§¯Y<¤ŞÓ$Ù/1ŸŒşõ4I´K4KN†¬ÖbÔrÔ‡aİNB<ÔÅı’õ*T¸˜ÚYÎ+Ûïí‡- gy²|ã™LBdj—hôOr#"ûgf§àhOˆØKÌÿ8Ñ/8Ï©ËĞd)ŒÅ
%ù 
Ä‚è’½<Y­AÌ†'IªDãR¨j¢ÙsÂ™^‡v$Á(ò‰•H¤‹«WBWLRBQ¥tÊä-×¯Oì vwà¨nDbw‰ç^½»‚L€]DĞ’gXˆR_L¦9…¤Q»k}ôôPO·Û0NÌèõ
|6(`0Û6zA÷bÔiEú„âÉ´{¡aN¼-§¥BwõwENÈòÁ!tñˆ§ÊŞÁwY`<q¬âB9'³Ë¹ïİà‡Êı~Vµb7µ‰Ú£›¨Ÿ›¸¨†ùcŠÉÃ>ì¯QCˆJ#9øz´{ıg·lVE¯Â=˜Pb·â$~pÚ‰İl~P'ÓUŸ9_ĞM¬.ş'º>_=zœìzô ÇêQÑ>°'-y5N27ùV­éAë!
(î·R Á	vÆgM^$‚ğ'bÀsä˜ü…+cI£
É’vÈ—¸qıf¹š?ëdâN¨¾`ÉèÑbóZ/ÌH4îç¾µbII³¶'k6rÆ\·ùÀª  ÒP¿@ç”6ï·æH¬­v™rúÕšÅ— ¦èÏò¬í›õ³gfÆÌ‚g3¥|üámÕHÀÃDğğ°²—pÂT½¿)Ş!MPÅ
Æd7ˆ¨ƒ=â³[ ƒ?\²šsÎ0ê’ö#h­9¾‡¤ÏÆ^,ø·ˆ×ZyÌºNÃ`«¨ª‰"JFÙ	ŸóêÒíi>ûØpRJ¨ŠÃóÚéU±ø]viµĞÉY È€ U
¶¹NØhB&l‹<(a/ğT
fH)Q´fˆS„ï«R¡Cñ½`İšgänùÎ·Ğì
üå›ÆsNYK¿ña3+À›;vÉ]R¹=¸K,x‰y.õôFâ4…­VĞc
qZ·älAínPÄ»+ñœoô{Ç¬VËlSŞL|s<Û–z­B)¯§T¢!bVc+•ÅıIj1¨F:n›cnšß«1r©É Ú«Hy®Ğu[Œ«°’£î# G“EÏØ˜á¼7÷ö<'gÇbã,]WÆIºR5º¥)MmÕy/ˆñ)ã§A‰„ &8¾Ş‡½l»5Î4üR††VÊÅ9ê ôí1];³lèn«Ûá ½Úà˜-)ø¡sîáT+±I×œ%™A@‡İót…]–bª:Î8˜ZÎ¸=š†ƒøl.h¥Œ•¬A»+fÌ÷±F$Àª[r^u@³˜·›±œhî í{$“û1ÔÌFÉ°öiâ‡Ó”F™ãc·Š²¦¶ŠRXÔ€¼Ÿ&ÈÕè8Q0‚äı†¾O‚kpÖğÓy6—„­Ù’º¤•ùvf¾Tr„Å7K>z÷F„%U¨}-¹ÁÀ§pÈîHPaù$ÚJï"-°'Viôç{qeY–Ìù„%ÁKŞ»‡=£“¥D‡ŸGŒ`$G¤¢”§Hœ#-Í3l†AN¤Ÿ”¶CÊ¾Á#¡¨0ûjw5y	ñïIÛ¨›ñréÉòñT4ôVZL_.úãË¶‡ÁÉMÌñş0h·áçYQ»¾Ä›9Bõ­­Çon¼wú’¢Ó®fP­®ä­ÅÃÛXhì4Û÷¶Æ…î÷d PÑw,¨/7L÷:dÎ³¤²]R‹À6xYê´¿ÙØ‡–)C"^lJQZÌ{èŞ\~vğpcS]YÌjÖ0$tË2Òàcÿò3º±8ØÜİqû˜R;è·ØFc:ØdÚûsfIâˆ•1Íÿ4êÛõ=v‹ÁÖ7wŒş¥Ì—ó"«$m±]oì4æk2uBQÖÁî“CïUZI³!Ì	<ØÜnlA·âD•Ö¿Vgğ¹Ó%­oÔ}S—^Rø| çb‘G”ÔøÖŞîşğÍmü1cÍšš–~ĞŞâÂ1^8»&îº„Øõ—Pì$¼ Ïf¾¶Ÿñzæ1ç6{+Q7õ4wwPX q[âÇOY+µNá¨fòoƒcLıŒƒâ °gÅÈ¸ç¨sÔedkøÉè.Ğ¹îxûd(,Şs7€=2Y+@†WQºD¬`¡+¿JgBæ»Ù~çÕnğ'oø-;Ï.œMò*>úòhÑ)8õtvùT½ÍJ”|ša{F£äÍóÉãÁ:ÇPYç³7µ=''İğ#>IØ–N›ß¨fyÁzzq^yÈMŒá7AíÕ3cß~V¿¡V˜êœ%Şcm4é4¦×®M’7qª¡W£Wâ•âöùp ×Uú<'?éI
y"ğ\r5TuñöŞ’|IåÃ<ı8<¬ñ7â>@"³#İS·#w'·ânMô]ÚyÌÕ Qı²jĞİÄ´ˆ!I7È‰7µ¶Mºï÷p}p—W>
¼VµÖ²cæxjŠlîI«Ì›¼-‡Øi‹›‚4SP	Ô1‹‚b/eB™À=› ¸lM‡àˆa‚
‡.©@:U,
Ö[Î4@jÄ<ŠÛ3fÈóÆ iS]5N¼-anŒß“{äo™¡æ³g¼#¢Í'Üvßz¢?ªŒpBìv7õ†H„¯X´Î³äùiFµ°‚–µyT=Š]v—‡å+bañ®xpš_ıÊŒ#2 ©¡¸FÎÜ}8iê+¼÷t» –O¯Ïúƒ°,V8œHÃ(B‹‹à¢H(
Æ¾ª[&¯¯ô¹_‰˜B¡®cıãdÛ36 ·UxÕ¯
/óà’z´šcßrXÇ¨Ó‡v!o[7™ñ4ÎœsWÙxèz|sl6NËiØzŠ¹Á~D|à÷è´ñ8ŸÙ6yaEGL|nqwĞ‰P¦@Õ#–÷ ûCpW4j¦ÆvqÜ‘ø1k1êŸ…Ù0ïmÇ¬dÄAÂ5/Á™™d8¬f»=+‹ÔZHT„H†F’Šşôoc‘Ğ%üç®ZÎ·1£º¯9»ÕÑä¿|mëè‚£°ªãÊ»ÿ½Á¿à
\ øï…<ÑP]pß"Ş`u!:…ƒÁis•*XÄR¤;@&TdvšíÚZxö4Y#½ƒ`Q!ï€ÔşæQ±E`ßj8_IG=>›qŞ‹Ä~ˆ¼¬²¦Ñ‰^ÜÚšN›½Qö©±¨•A^8”7÷ú}ÈÚËY7ŒAáÈ¹¢îÅ;éXtôÚáP˜¹j¡SÈÛÏ: Ó;Å˜X‡\åQ••¼§ŒJm 4‡µ‰ù4ÕwvâşœF<â5ıÚ%’U|§ßSËö¨61Ÿ¦ö¼úÈuÉæURmb>MÕPm"MåõAm"~LÅmC»ÿ%k»ÚDÿ–ßoŞ½cªVÿTãÀ’ï¡5^´ôÂ.W	·©©R`ã°ğ_SS!W›S¡—&czø×ôJ2µû¼pù4µ”ìü›|šjÕ¡¬	ßå*[Bñ36dÚ_)gŠ¡ÉòŠî[i¹ÅDÂ¯©3^j‚àÀMó¶G©Ã|­™iÜŠ,
³î €¥y‹ñŞªp
+sW¸EŠf°Ë—£q»sùÒÄĞöV=t%Ìr§rk¦Ñ(C=^s6Àë¿ÜLĞM£8„İ¼;¡|)ŞR	y9h¯¼æuîÅ ¼+
råâ¡£ºğ•šÉ\¡©Âh´Æ‘ÕwtwÑÆÇ[@:;ğÍŒ,D¤«ú,\­z‘PŞky9kÁTç^{9xSµÑm«@î‡)`:ó%Ì@å÷”;èKß‘!œ‡bµ$ıfVK^üío†[‡¹kUyÍõ@µ@m…)Ï§Ûq4ÖÄæGtrÍëô·äâGÌƒ^$ßÇ*MUbzDâïù¸Ü*•<H
•\şƒI¦r¬¥ÆaNÄ•šBùSZİ“—é<KáÚ+ÜÖ‡Òƒ%‚Wò²`0Š»¤¸‹TãÓ&kô ËChSa^3ÒÚ]}–ûú×]S„pNTN]ùœÌºcê
V®<¹Jy4°)˜=+¼VËrNÓ4Ì­Û8áRÜõ‚ÍØ-^{	n.oW:šxÖ»rwÒUŞ!vÄ'¡*Ÿ#l…Ç#í3rRW#'u…‹¿²ë¡W¸)
]ê]'I êT¶€Ú¡vùjğœim–×‡ov”¥:ˆfâµöÑ´P«X>0÷ˆ[›™“Æ½ıùÍ¥|9§#yê?òX—¶"DKxĞƒ¥xÈ]µènií‰‹)óî¤T,ßPI¾Q*ŞZæx|H=+ÀŒíaÖG®YtÑÏc@ğÅ]"oâs<-´6"åLõÿ™¦C{]Vo|”H)¶W+'Şù@=`@(k{wsÇ·NÁ¨UòÅ¥|ñV¾|hÒİ\°q\j*+©	~ÙQÒRƒœ'“Êy
‰Äaˆb„àC½1²×Ò½­‡ñ½/”Æ×?gÚf§b¿„ƒæUÎ™~Çíñ6Ê®wÜ”GvÇ×3¥×*GÒ.«üÖÉ)àÛ†Ó+Ä™÷ÈövìƒšK¨¾MàqEe[õÀå´òMÜ¡'ŒÓ“™â.Æ ?İÆÜDJ%Ì Vü‚¼İH–€Û5¿€®‡¶#ùJæ›^şé›<¸¢qÍõ×•öÿ¸Îš¢[&¤ïYGFá_‰ÊÆáÜ«Šs¯:ğËè>c
lVŒ0_ãô:×ªZõâ¸aeÍS8>­â¡~Ò¹Q~Ãz©ßœBêjXF	GõØˆ(~1½9	¸ÃÕëA¹ëQš¨éEi^£PBk?q¶\*åÙtÕ0WqåL÷ÍÎ%Ntó&û„µûIµ‡ó°Ç.Øè”¶¹qĞ¥óXÂ0@!ÒVü2‘Wu±…Ô´4],¡vZ³ºÂ!/¯œÛÂ‹í²Ë\Ùx0¦ËRª>‡·|e«{ÍŞgƒ~÷‚nìù—SÒ¨ÿ-m,’í°›ĞÓ‘RCX9—cß`»õ?ÁlØ8Ìø ığI5å¦h#æ~kş°!ºƒ©+V–á/üïü%„Êc,•Æô;†"DanAØ¯=iW .;È3ŞÙ¡Ğ¹i}’åÃ9}’+~
¹²l!V$ªcU‘OP¾|0eO Fñó—ù°w'O©œ'±öãÕÁˆ·ı‘=î‡ñ†áo‘¶ûÜ»@¬hLCeùdP&ümDıö)³x…b»¸îòÌVk-pµ¼çáwuğã…òÊ Ò[<ÀØ¬¡’[pB$—+*ŞñBÂ±ç…Ø@,‡0ÔÄ#}±[çé¥±»,ğ]^:ÛË‚í.††°ñP9-Æd5)èØµF¸â)Í-Ï€üd.Œ¼Ğ‡-˜Çíúå÷†mÔwšl«ÁÛ{¾cßÕÑpa¦ŒhÉ™º•Õ|zLlŞÉˆéœŸÕDŸc¤¸RÏxÅ1Ÿ®ÌEQ	_UwùeÜ‚‰õ» ÂÙ‚ºàÓD07P8µÍ.ó‹ŸüW*ê‹Ÿü?S¡ÿ¢,¥ÊM¿œ”BÈ^Aç“…îş×«ÆVÇ¬)æÀáqŠ‡m‹c,VVJ~R–‰1{47ø@Â„@KLÃ¾€@b«ÈŒl³¤‚°/ˆ@ŞyK#?ŸÂÉˆ“7¨ªIcI˜ìxèÄeNHF8o‹|qàÓ«2DZªW½¼œ—ÿË¹%Şşc/°9Ë±—ƒİ‡¾À‚“Lg,s'Úp£^ÜÂJ6TÚğ›>¨Ï1ùsá…Êãˆör®Nÿx£uÊ?’jé\õ¦s‘oÄÇ(>rk|ÜªØ”TòÆ?¿	—õ\ÌñÏlR°³\K§H4Æ£§ í•sOæ¡|ªunê§Úw†«-ü“ºfV[	µL"~˜C<™1 •Ÿ*”„Sş™ÆÆ&Óbbİ™TÙ'…ày'bÙ¯©£HZx°¸šxEA <c€5‰*èj+Šµ®¼U%‰S3¤¹Øğ	]Çí/RóLc	/1‰r'üœ#8šá•Ÿ„©iô$W}®9ÃŠ_¬sù«¼d”²òID1náÏsÉ”«"O’GÈÖE«ıaY˜8µL ‡rÌ[8”J_ƒ“ ã”@¯¹7ÅóÜ×Ğ[cxÖ£PÀ>º¨	8YÏõ½ÈqYG,1ŒÍPçØzÊ²¨ (Õ œê	sÔCzªgO,ÅåÄ>/×2¥»(×è 	cÍWj86õÊ;ƒ~7ÎÏJËo¦¸œaKåøìññ¸'`9ğöô=Ô'œô¥Élm¢Ì¾–˜/Ş%n•Ê“©¯y0+±†V£6Ñª€Äf8˜Â‰-²G¯\¬Ä/4å8HÂÆ[T¨×	İÛè"†Lá‚-s/m¡b@CHòûäáf‚I›~jB¡œ“ÊŠÇù`8Ì¥‹P¡>é ªüîqvpyI`;+=ôóšTÆ³¡ aCÕeß¨ª¹²gGfôšFÌ¹ï	Œfó•ßû–µ]c—Ã3‘¼´-ÌVˆpB{“lñî:§~Á/İF¤osş­*‰ÆnÍEc)üÎw|}Œ¶¥AZ¬­9·£¤Yß§KåŸãNûÄÁfLÀú:ê¥«¨{VcT¤&)|”7<»*¯é¼cë¯Ær „Ì?Ê)Ìí†äæHN…êå|ğ?=S¿ê–jÃ™KWçtOØŒ_6ŸB‘uèSœŒ›|öIR .Æ¨>ñÚjtŠ¦ËÖmÍĞÀÙÂ°à_ÄèRœyÚ!8˜IĞ1ê­$ò"•+Õgœ¬“VÉ„ğí=•&¶Ÿ’å¦4M¼JMIútİƒ[š¹‘*sšËº.¶!éÊ[Ë(P•X½˜"«´”lic)¼*.ğ¹â‹@uËÚ”à­óÇôªøczÉ¸ÅUOx¯Ïùêû¯şğÕ?ÿõ«¼úßà¿ßõC}ÿÕÀÏöêûŸÿ<üü÷Çøš}şSxøá«ß}õÈòÃÏÿ3¤û>{õ¿»é^}ïÕÒ­ÇŒõ;w¬íù9ªø·›[[‡û„Fs°ß`í>l²Fó€­7¶n²oÂ¸14v60ùúî~}‡5Ø×l¾¿Ó`ÿòO{Vß*Ü{øáƒúşæ¬˜Ğ‡vkĞ‹Í3üÛğ€nñ*‡ÁİöLPqT @È2A$2üßO;ívØ“.ıŞlo›ùŞrëéÖØ¸¤Çg¯Å‘40´â­×V	qÆtL¾%ŒØğ—\<"X²1…Å£ÕÜÌivX^ÑYÌ®à!+Â.K’gË«H&oíK¹¼ê°måÿŞ,Šm °èûbRğ¥ƒú½­Fı!Ûh°{»û×\M•´0l(İWb×‘Ù>¶dhÿÈäÉü÷L·ß;F‡?A´®¶2b;Ÿ.`¬õ·iÎ1úJfşî£ÙÙ¸Eø¼4áFÉNˆ%-Ñc²çh³Ÿ¤íN~WÑÁI6ª ÍÏ­©6ˆUbÚ¬Å7+Œïé„°¶Kñè›uqæw3pTÉœ€|™›CIXNŒd7f¶Q0Ê)²P¦ˆfwıíÍÆ>…KüâÏÀö@ÖßİÙ©om6áíÔ§;Ö… åŸ;£ì‰' x,l¡3s¥Y373¸Ÿ¹UâñFç>
8úl¿Ñlè‹©é\³)Gt¸åhÓÿ5ü÷³W›şï½ú#¿p@B>bº?„ÿÇç?M[ìöéÖkH6NLMèDâ :§ØI÷¡7).Ï%Î4oŸo¦+é3µìÎ”q“8àçıê>ÿo0Q¿/çŒËmß{õG³¼ÅLC»™ßÇÖw··;ëß9¥5.šl6›ŒÛm,ìî¼¿"Éj3ÃÆLµê…|ó€Ä!<Ê„£§èWEæÀÎ€;HDEK-bñSJÑ$ˆ8•ÙµìÒr¨Â/ó‰t¢{ÎFK–:•²øÉ6Ã£½f¸Ö%¨IâEn×›ß|xùY“äèV·óí1ÈD;­Ópèó½°†XƒL¹çDóŞ¡§¦öm˜e1AÚ…ô<Ì~éêÛ4şI´N­ÄÛÙ ²åäÿÀŒÜ`º‹”MŞi×j55®tD(§ÿ
6—z÷/:²q‚÷Oõå÷ÂÔ@»ğ÷Ax6Àk‹u:G§£,Ju…ãÎ£Ÿ¢M)²	ç‘qçòåã!HæRÎ7Å=Âq¼Z,®|†JĞ€Ç3U|d	xV‚ÔÑèú0p:"u`Ø–šÂ£r%cT§Â(ó¥OPëi…MpŒRİ”sÉW7lÀIp„“&ùc¼DÚMZã«YÚ¤ïfæ é9Úˆ³!~&¥ÂƒöÖî†ÅŞR÷Fü õœb½‚dÉÉ18˜)³›¬P&á”Ÿ;<ùåNl’À+.A¦²7ıx„GÒª¤ØmŞ¶²RTIÏV­ ÛÀ”RwÑ‰-úÒ%YF4›8yKT.úÌ€ˆ+ı|3À.ğDEwßÀ 0HÛk½çlÈ‰—1Wô@\‰GOÖŠ+?'ÁxO†ÁQJ°dÉ·ÕVRb¤âÃÁãjWù,¡èş—ÿ_šnÕ’³¸Vyş[ÇÒö/<pq¯‹Ô+(j‹ï`¬Ñ<å+ÜJù2URYËì_¾lA…ƒa†®ÒhÆıÏ|Ê-¥sÓ°/ù„µä;a%´Öè&Wÿğ?ñSêş_	L3tJb]JÌõ\Èƒ÷=Ã°¥ëâÊW0Šê<Â›¾V\"Ò/şà¯9(¥ê{k—·º¿½cåïÀ]c }òò›Z’ü”SYÊß.áÿ‹åÉÌ1â¯f¯É/şüOÒ:t›îÙ`Ş¶ÔE^75~|.wËøx¦§XtÎ?Ä¾Û/Âp ÷¨£ÇßØÎ°Ùã¿Õ§İõ+Gr½ø«Šöjõ%k†g}„TÇ‘€ìnÒGìŞ1¨Sì¶0÷z@Éø»{2ı‡ÃşpA?ĞqÒÂ‘Š6/~Â°ˆªÂ@¥_@¹È*ªlaA€4Š`%@á£ığØ, ¹¾Ó³KİFğÚè¢×²`e9EQ$¢"8©ñÈª®æÔÙ•ùN¹x“vê[›÷ë0LD¹¼ÄËDß¼Q8@DŞ(ª
cÖíD£ll9öì h‘>e!'¾F¶èy«‚[ò75¶¸´h´BâÌ–!­Õ¢o°EŞ„¦Å1úHeE;H„]Çlù0¹/16H
§S?G+üMQ	ÊÃR.²¦ñ[‘]Ø‚!k‡‘„»‹¾øîÑ|Á³ ääãpÔ:å%è‹oÄ4u§ãÔèI/AÄÕ]£wgùüó^ÍCxuã†‰T{ºdV—”Û¿ğudÙ¢RÁ UŠŒÇ^ÉA ¹ŒÛ>ã2‘öM¥q{ i›ˆ®¼“#æcGg{6şëôÎløb‘`‹ä£H½V˜Ö\ì^˜Ú\šêfçl »ó—Ôè¥¢İ¥5V%Jj1Æ_ĞEİï©õÙ^ÁÎ÷~·„è§dŸÑfs_No–vˆZà¤_h­ÓwÖ‡çVÈ>îŸ†Ã4
ÂÌ±{±àÚ@FŸ»æ%._zŠ?*óQ#x“ Æ=C{.`Ğ#ŞzŞøµ"bPûİn8t‘!ˆ.T´Ds”XÑ³"×GÛÀÉx°ôÑÅ 8şÂŞ~c½¾ş ñ¸şpcsw!ÏÆÃ.pn^ªÅáSI|_ÓŞŞş°2§Å³Áâ“œ¸¬×¿7„é™3v'Ú|s>¾;AĞ‰ÜÜ•@¦Ù…ÿ0°•ülÂ¹şò%üúâÏ´ ‹èFdcFõ|Ë¿Rıø1¢C†‹g|hqjÅåx˜ËxË¶ğP*)ZŸ³*íc79ÚˆëÀwz´6¤î‘¶Jíÿ«Ëšl¦’Úño6=2\›Ÿ1m…MSa»&ë¦DØ¤+Ğ]K–`AÅ¸mÇM¿ñª,È§(rM3–Éq†ÅM´Rn]æñfvN‰³Zşõ/~ôWl{w£Áìî7ÙÚ1Íº­ó%ºµê©[ô[(:§˜½áåË­»V#kJ”áNEğ2	{lsãİÊW|³&Ğï”=‘kÁgÍì÷àøDjor×ÕÄŠ˜oiZaÑ|í‹%ß	;qİòó4óœ±ãuØ7,¦—ˆ_5Á)œ5v÷î/wÄõÙÆÔâˆ9Kl{¨WguåJmº‚JÚYcq=òGªz>”ã›43£8¸;5ø²’TFljÌ6
ëBjVÒŒ©«¯x+~za£d8`©ænÂËøŒOÖÔ÷ß—F:¿ø“ÏŞ{E¿©‡zdeÕ°•Æët^Š;õJşJÛFÜŞÜ.Kxî-¥lU‹±]²âÙ$g¹ĞÄ–§¨YÜÜÇ*0.o2tÇÏŠ‹¾‹~ÿOÈ–ùZ:¯ñŒ5ÎºÁF’Ã4½'º°ˆ>ÆI\· ™™;§WÚ¬ãÅÍŞıÎ;R{Å¨Uª®8‚ñà¬ßëS}=EO(SœŞœØräüF‰/«·t“â§G5i™HåjÆëh&¹°½Q?¨?ş°ñ‰Œ—*ò© 0OâUnÄq"ıRÂÒŠyûıÁ½:Dë„İ "àpõA§GdßÇ×WçÑ(…óÁˆJ+m„ÒÜÈi‚ñM€ÍLjzöX88Â7Œ]©”·˜%Ä³ìf[¨n)DV{V JÊó¸Óæa*)ˆÓBÙaÛ;œNÆOM PôÏ(Ü¸8„-®ÈxXŒ$Œ,’cŠ½ş3'­P¦…ZTmÊ3aê1Õ'ªN[’úFØYˆRñèY_ä`<JÄÆîqã†Â\†|Œú9 ¯ch7…éCü{F=Tî–,2‹àDĞš^«ešºqî>@§WLÄÃÿÅr]_H.U`Îˆ¡÷6‰¹Q;#c¼© {G‡Éç^É|–)•¦x'|î?ëôxÇ#û`È;a·™¥ğ5–=*êl d29ÊBbÌXmPC
%­AÃªÔn#Q·¡Ù‘@²#ÕğmšS
¤^eõ­ë°öÇ=œÁ£>ì»QÕ¹¨Vê¡4kûP†Á´YØâ{"%Yî}è;ùécxÅUŞ†¼77=ãÔ¦PNÂå¯†'8Å>CkLbt‰šº¦F”:ñ›q›`X)%WNåòH34¦æÛC­>!be?;íCSëdA]‡rŞâaÎ]ØÃğyvpÒ[Øyc ˆŠz¾_¼Õp!~$§	Y¨™P½³ÓÇªAeÜ@RÁ h@f¼“ÜIZi2áà™š¤*{ûmh³ôÆÅğe²)â]MÕ(½¥ÿVT7D=jä³Rê›ã0(Ü D Gì¥1÷H›8ı1ıVé/^XDÿ³m”ş((bÕ8³TaŒ«-9D¨…>ëÊ¡ƒV˜É_¼˜LFÄ>±x‡ŒŒbyJÌñÚ=…=ëÂ?ò¼O%N,ÆüD.AíâLEÊ³j¢éÏ‘9ÕØ~ìÍN]U­Ôœyéë#™CQ¬È¡ñüƒ9ô‹5ì ~|/öÙüZµ¿¢BÑÊ-Ú£È©e%¤ù”h~±f3î»±Ïæ×ªıU4ÈâîvÙ …¦LR¤GVhÚñì`2¿àëâ #H=†ıP®v£2s9Ú‰µ¡Ã×}'ÇE)”ã{ì;üÇ+`äâ²”T
Ëº=öâyÖåï§ØTJr‡- H ò×‘°	;“ÅâR>lá<Q<Pü\%OØà¶w³¹HéJƒîÙt kP	ˆàÏ¹õÊ&5‚Ìœ¶ÜWª,ª ­,3(Ëy•ó³]„½hõcÂŠ•û›oèaê§«Şº>êÌ¤=üN7M-}ÑÒ’÷&%Âñ	iĞ.È#;p‡×^›—×’vÙ][f¡Ê<‚NeœO¬¾Oú1rU;ÍIÕØu#ôWÅ/ğ¯¹Ã›C
,#cª]ŸÊ±®Ù$şølZÅ'QŞô‰¼Gr·nìã†F‡´M+‚·e#‹§A”}Šš9¤Ñ	`PTÒ İ†¤wA%.Ìó¾m½ƒQYó¼-pÔÚ…§Cş3°‘¶1ÃÛò'ÉôGçìPCHFÃó|òXõÄ*muûãvSÔ™×õ³'»[1ÏœSÕLç§7^«%öCë+;°n½š£Çnè±>Ê9¡ÃOÃî F¿e
ÕË®—{òÚf[…„?îCd<õ1°à–N²VwHZã®ùª ~QÁiØ‰+/ÏX]n¢%W!¢â‘q<Sñ_ÚBRµõ!ò3‡à¬Y·c{«¢àğWyŞàÊ¶^ wPÚ)—;ƒgIºÈj™ARäÜâCôå–@ÊÅ4wwŠÍ—ÒöŞä“˜çŞ¦O£~OQ;ÇYQD¦$Ï*Ö‘ş¨Û?ŒõüÌ>Â21ğ2·oÈƒˆT„r¿e”™/`<ìâ’{¸¿%vJ.ãÀsË¶Òœ³´û­ñĞ‹ÈĞè†ø”ÍR	Š§CXZ<5T ß¶ûÏz‚Hp]*ÚÇƒÇd]¡éa
/’æ_É–K¹i{ôDßÂ;5i††çı§F‡ )ÚøOX>ˆÊôŸâÍotRÍ"]¾ì^¾æhL!Gn[B‰«¬ÃØê@nCá¿¹ö)Âh­¨ ßiÂ—9iŞ#›©8sd¢ù¦m0èCó+e“ñã,Rƒd1¡Eïo‹dkDµ96:öŸ‰5ğş#›¹ß}$ıN;Ìä”›p» NcÍ©¬ Õ$"µ£Ä9W®{ÆE R”8ëK«&°+:%‡8öÅ±Wü -{æá	¼È=]s°#^‚,kÍáørÄ[&!²‰×oYÕÃhÜÙ½ÂB‘.¦j·xV•W–"‹æ©¥I]ƒĞNy*Rºú´z¬3×µª1ï	Òjr…l®¡»beîµâ&1®#Ú#T7Ğ­°Q´7µÃ[uamM5ßÈ¥)Â§—'¶³iğRÍ#|ÑiÓ^EgZØ¹GÜ˜çA˜Èwo¦
½T8ÓŞÓ¾Úê+yc‹G.ŸoOgˆ×Íµcyµ»ë±s\&{K8qñÂ–L¹ŞÆ­>îánå9{ú3i+WSdĞ=wovæÈ*Roïz÷NÙ¼íš¦lâª)Şœu|1Ç–ÎdzskW•»iâı½úú‡÷i=ægØä‘D®µÙëª¬Mß¿í«fê}
hş x3ŞvÚÁ“Ã…5@âMi—u¢["_†÷dê!_äAoBªz‡r­áİÚÙ<+‡¯2ÔóVå¾ªi$íÏimŒƒÈÆ
\¥”ËéñK‘ŸØ“ûœsì~H7@0ËÔ,Œavù2İ"Õv8w"H‘0S–Õß4#Y3ÉB&Í=1úÍC{l8ƒ‹SÏ:= É".& ,Ç¯\)•lÙlˆÀºqYÙSø,»šQ6°x£
”¬r‡ˆËqú$Ê´@H:S¼ÍÍhS3f:İ²&
—_ùÙrşÃ'åé>ôzïˆCHGÈ‹ÖaU®j’IÇtíí¨<sB1©¡Ô,şË—Eâ˜O†­r0åj§t¥ºğIÜmn?ñîP3EØ9ŸèœÏÄ'sö*`ı\?²R-°q”gô×cÓŸ1`¨6 Ï7úG·²ê)‚‰Ÿë<?S9`(”>ÁZñ>ºĞ§ºf0>O‚as,Y8‘	OvÄ§p[äXoÈGl¬7mèŸÄ0fP¨`¼ú9X‡I¬šyÄ¡†ìßŞbSº¹k¯·«Ò©Â0¦Æ'&ÙÚ§^LÉo®£lÎ\±³‡A„Ñ$IÚûãsØê8
P^÷Ï£°˜±|EâCdnøÇÔ	¸ëw"ì ÄJ¢¬Q§IFµ}åŞN8ÏoÀÒ†Ì[-ÏõQÑ8Ù»çökğ<ãØşïé¸nÖò?Oëÿ£œÖUz8±Û´õ%Öù¿³ö¹'ÈD‚ñv9!][]Ö`Qí1HŞ‚k¼Y‘zy¦Hıeì>öim’ê<§n|¶Ã³¾ƒ–óq…÷ÚÇ>ƒgˆ"r‹Œ®ı}ÄoÜÍt@KŒÚ‡÷ÙsBHöÂ»Z¨yoÂ}LvÚ®4¯œöwÔIsy‘KÊôK9—«÷Fûá?³Æ·öv÷ØM¶¹-~¬oí>ÜpC-%Õ‡Óç7¾WŞé!
DáH=9=À6|VeHPk™aŸî;9†3‚ÑŠüÑö’P™Y±Q'¾øÉ?ÛmÕş+âÅ«±½M’¼	:æj.‹nœŒ¹#d$Ï‹QC¤Íú~cs‹ıËß¹“àÅJñ1pî¬âÑ´â1I”@:]í(PIÇôp`À®ïÊ÷¼FÄ‘øˆŞß\°ÙØg[»ëõ­+û©p×T#ä(îô9¨øİåøİ<®ˆ·¬mú’~=GD×ûíø»ÍvFt2àâıÅ÷jì'A%l ÂBš¬I½ªé–¨LFşí½:œ6ôJÖ¿È¯<ôyÒP
z® c|^&f"éL˜ùâ v	XJ_g÷67wwv’|iî:½ÁÇŸ'lJÂS-ƒ´Zá`TËùeÌñ)X—‡ë =±mDµ¹œĞ&ÂUkfx¤Tf­èdUÁÌ:QoæñÊ+Rçk5”•—*ĞBùÖr¾\¹M4¡œTá„I‡ÔšvPğÌú«JğM#À\¼pËÍí*eù½ÙD9 ,_3 ŒSâzæHë™ßÜN¤¦œ ädãC¢hûål^_üÙ`ÍúÃï×÷7\<cÙû›ûæÁî~#÷ bÑ:)åî½Z.ú:5õ¹¬ÛAÑå_²óşh(UFoB^I¶ù
Ï‚A!súqÆ#Ê\Ãõµ·yuq`îA†õ ¶×¶ü·³/Á)	PI†"önLï¬,İZ=>Ö›Ò;«ÇAéØ[şüûQÖ¡/ìñÉ¥íQæÈš»”µ\Ò6§”YJéßÂ‰Ä	DÁn5Y¶{ç¦m¹dÌãññÑê­ÒW9*©-p|ÃdÔî'O¤oÇ7~¿âmßhÉodïO©ïzÀ5ôKfaoDxÏÆË¼iË	Ò" -Fæõ%_„Ì7²á?ØÄ}ó›BÜöÇœ  èâ¡Ôû41êŒH¨‰2‚¾ÇX KYö*(ş(£1uÓ•%‡Ó"ÚªJâŸ¾Ãª3i++.t2™|†ef–•Ğrqr-Dac’TœwŞİğ²±DI´â}ÆÃŞşîÎîÎúfı vlƒ»|åæs™pl‡ú~ıŞæúã­ÆÁ˜å ±øª™ÏÿÈ!«™{xûÊu‹ÕÌşî EÇ)‘¬ÓëŒ:AŸ^}õüa›_}W¼8îôä3ap==ŸV3[—}>ºaÔò^§Ğ gÈú­VwuÎC`Ø=.ŠL¤eÇáğï3ó,èQÇ6îFüz:o·ÿgªıfûGNûfµÿgnûæ´ÿgfû7@Èntá>e'êƒN«_hÃèG‘Q|sD@eİ€ñ”lÔ#„c—¬¤ —/‡p<Ä{ÙXO~®{rH-/ôÑ+ŒüÜêÉÏİüÜéÉÏgõd½v†­d£ÓŸºAZuã›NïéÌ
ï:Mòôáª\şòLwâSg:~auân'~átâf'öl¡l>>ñ9h‚äºĞştñ¶‘S_€ ä§¹£šûßÿşÿ6Éç¿ÿı_9-ş«Åã¶øoœÿÙâ÷ûÃ5Ş÷‡d
4?8†½\ˆ5×¦>ŒaûNñòú/`'XÀ¬œ÷;Ï=}ù¥êË‡&ù<uÈç—V?~éöã—N?~™ØM70ä!pë“z7éUI©Û…Ci¯-hé^ /=íş•j÷FĞÕín;ãÿ+«İ¿rÛı+§İ¿ºÒVì‡wj¡½À¡—?%òÁ¿·4öÿVwä{";âLÀßZù[·#ëtäo_sıF‰ËXëyØJ"§_«Şì›cèLË¯­ŞüÚíÍ¯ŞüÚÚ¬~ì÷Ç°ñ³ æ%èú9êyçˆ´)ªA÷üòe¿ëe§ÿõÿgíêÚ:®ø¿²¹ÃTf"¾ì”¦4Ø#c«Åˆ áLâa†‹$£[ôé
‚)lêÄî´3}IkÚ!NëLı…Ì´êSşxŒÿ‚ü	9g¿îîŞ½WÂc=€¤{ïóÛ={ÎÙ£³{$€Oİ•@®® i ™  u¬ØEÖ…L¥±·±’q[$q]-×Ï%×ÙöwÕ€í¦Áösíç&ÛÏ¶ŸŸ„mTEølQJ¸§¯ı.=uŞ&ŠPcÍ¢Ê	e¬D±(Æ„x¡AyaBya@ymÆJ-Š"Ï&2ê¡bUéqÂ€yâs[láüe`¹…`~<Ø1Æá¥ÆüK“ù—ó/;C"c—R‰‘0ï6q:5l¸˜®‡&O¦jÀL¶àØSÌÛÇş]Ç†cÏÄ±gàØ‹Ç.ö,*Õ -„ÿÚ#å„ÛpçÙy<"Òcª gİOz¥ŒÎ¿5£}ğÄ@õJCõÊDõÊ@õªãèä¬£cÍÓ³ŒšÔ~ êğêğ¡j_µo‚Ú7@íwu¡¤£båè?ÌòQ#Ág¹"nx.w´,p$œÔŠ¢Å~øŸå@Ãr`b90°Dz#Sª/%lyÓ³ØÖıÀ×b–ğ·{*“Ñ %ˆKîJ À@)5‡&†CÃa$†™¥zPWÂEÔı’8¸æá5½"P@Z¾ß‚Ùfÿø†dÿ¢*P×ô! ·Iöoìó/$ûôvse÷.•ú@Ì{µÀ±b­n¯ÅÁãuÉùGîµ@z>38_×8_79_78_ìøŒ\†¶Ä¾§àZW@„XL$ç¼ÜBÆ-86—\Å±hàØĞpl˜86ÑğJû±Î¾Şí‹ñİ¾)Ùp•µ[Ù`wScwÓdwÓ`w³SÁ9äİdºòÅë8&y¼Ùâ¦qY[V757M77-b/`LºMÄ0/ã&„J|¿ß’,O¶¿W´eÕ`ù–Æò-“å[Ë·¢;sÓëÕx–·$Ë—TİR28ŞÒ8Ş29Ş28ŞŠœ¡–k¾Xå³r¡Öú<¼@Î=	 n•Û’óİå ¯—Úß«ZŞ°~Ûdı¶ÁúíùÈ+^Fãp—*í¥ÚJÇ¤\£îC"3“"_ iÀy6×çx[2ÿ‰Úí+íï4æ·5æ·Mæ·æ·£5JGŞÓ‰î|êİÀ#(ãïvœõö£ÿßĞÌé®fNwMsºk˜ÓİH™¹bpšJ ÿàšÑ4=p<KnåºÛO2­¥b—¸>F3¿£ˆ;<#¹ÿá¿¶”ÙÑxß1yß1xßéÂ"-HÉ‘‡’»Ì¸lòÎûµ©•Şá!<¹–€/¥¦S¿Kå‚Ğ/úß^Fqï).‚ÿãş?©PÁ«IK¼ÓËXÕ)tfôUŠİhÿ³O0ÏxŞ•=©ĞüR1ŠÍ†AñËHŠiE‘wPôlï;ê2¨R1hŞ¤™™¡wê(ñÇ=JTĞ¬µlDH¢ ±k-ªÌÉÉ11·xl2`)¹¨ã´QüÊ	ÖÛn¡ÀQrŠ_Y(‚
/ÃrÄÒ³¼à	(ZIşQ’Ì¹ÕeXä&GN’“…ÑÔ$“{Ü Th?†÷%’ FVJPÕFönˆ,Š’$zWMwCTdt*Bd%z'D”I“${GÍÌØé†åHS”‘İGx÷g‚A£ú0UÔªl­æ–QãÑİÿN¸šî•¦ëJe!9›óS«æ=º%d
-i'ùî<=­+çÎÏ*?¹yL—ƒjÍ+SÈ?‘?€¾m¸‹®ï|÷÷Ë^!h´IK
´å,ÿ0«6jA†?¼zÕ…4{dJ|Š{†bfûùIaü†àzÑ¥5õpÂáÉØI™À=İn£/›r”m&t3ß@Ïó¥,¶_lzMı  û=ıy,°V›ûø¶Nß'ìéwÏ ÂÔ“~àî~Îş¾¤µéFÉ`ÿpğ]İÃM,X(~¥öÙ)¹áo¬U‹Õ‘çƒi7*›;ù­¸ù°Ó­¢ß•R4ğtlçĞ8w…v 5ıZ=+†I{CçŒn¶³¨µ_Äc|…<’wø.FrÎø!UŠì¬Ø]Ş„EMÕ2¬øÙ‘?„‡sæz•BÍZâD°!“
NcêÍ (0ËëGo/Âô„l©áUG“]:­ÕÃÅŒ˜<ÓªÏ·¦$µ\†Ş¤„Ñ«œÖK€«¹\©Š×ğÈG¸K&tÉ¼‹Ó§ÃÚĞ‚ä“†_ê÷¿4Á=Ü<zrôüó„~88z
Ê{ûè±Y±%\—|mm †if&§ÙRC€‘±	ÌVùs>Û_ŒefrìıÔt*G/ØJáÆü õ7óÈôË8)òZ§– ¯ê.õÖo:jFÅêÕ«RÏ'Ÿ¾şÓ?ÎŒéñ¬3›¼êpU—^ÿå¹’ùd|bb<K~A²Xà‹İÃŒ }úá_I.õÛÓœÙY–­su1I‹’Îö5Ò“x’"MØY\S^Ó9îY…?£££‹ç0­ãiÎˆã¬Í­éu¤W™5Ã#†ëÃÕƒÔ7 BÂ‰9«¬|²‘|ÎÉëíPYùğ ÔÁ+¯î@b]wŞ–íÍñË²
Óó—k°ä+;áTakrW¸£Ô4üé_Kf/Œ“‰DjbêRêüxªU[Å·ÈÆ 4–L:]?3)*ƒHúÒÓ¾,—‰M²òn£Ğ³*t?ô­²%>RéêY•®	\cê¢¯hÌÁ­ü—C+ÕP)7U(=ğ©˜qÄƒÕ±é$ÑhàUkşXd²§³«¢E{ùŸ.ÚèC?•6„oúıÚL½^lŒ±b›oÜ(]j;g Yúvm ¦©èÎ·e½jH[[+AçaÑXN6hòÿp’m£NòZVÃz¡wç—¸»6¬rù:Ã­z—µ9MÅ¾BÍ'CMâUq™ Ä4+¤¾¬Õí£JÄwS§=œ<jŸå(ïxò½=q2<p…¢ïzeP[Õ¢©D,ıİ…C¿	ù„òÎ.` ,?y—âëç_ÇÊ)SìBdÑˆ«oŞ¯Fé¡8ºUD7\UŒ×Óˆ”ëÛ½]9±T¯ïĞ2Š€àõŸ÷„Û3íØ±DíA`×"Æ ^à¤&PFg|S\“aC]†Ü ½¨k¤îÉèRÎV¶”;wèÏ^ÌL_“™ŸÈL’‰™ÊdÓ˜ˆú†°pŸxÓ:%™G—…GBˆMÄ5ÑWK³ ¦¸Â>á…Ë,·_`±Nüş"Æ?ø·4";Ğ¯Iä#ìÙ(¨i†»×,x°>Ğ–smğÒ¦
“~|*9GŸí¡-Ç|dWÒÇY|$?ÅéŒNQÚnº7˜13Ä¦ú•Ş¾„¦®ŒIÿÅ’¯"%S„°eú{2§Ÿ”<%
~‰ªY~é[×sÅ@Ş%¥~Œ¢ı&öÁ:=hkNğ©j<x_ò‚æKØ^ŒC36ë!ˆ†0Õ­½À—e"ĞşH"º¸	ĞqØ€³`&Ğ6;M…®šäÊ·tB7²ëö1`JÛÇ7'oÜå^ûè¯½)è{uXĞ1+~úúÁßÉMî]8›jø^¾U¦%ù`€Í\hç®£}‡Ö.²û~\Ä>¡nÜ;ñ½¨{fî¤a©á¨€K'7³û¸Ó{ï1¥3f¸	cLß£oÉÑ¿â•](t44hÆ”0QvfšÌLó5ò	[6ƒRCÖ>
@ı
Oe€â•LzšàêüBû‹\*=‘%° ~Û‰Ä£Ãş›pU[4ƒ«ùNÑ[
E3ŞV¼B†« #¦sğÿÔÑ“ã{GOïoÀÿİ£om;Ì£¦W$ño®X©£G5Fç&SAû§Ü–_ë»æ•ËÉŠWÅZJCÃ ğÉ¡kŞ^µn”vÑ0†ñÑR‡pÇÏ   ÿÿì½kw[Ùu ø½~ÅR6 AŠ¤TTQ\	UÑæCÈªÄj®Ò%p)^ pQ*f9»ìò¤íÄNìÉ´×rÇİi—¼;é¬vbOO>„kş¹üiôòfï}Şç{Pª²=3°Uî=ï³Ï>û½+H,µ‡‡¡7â
œY®!¯¡“2¿=JVsiWRÊæÉ1Š‹Hm ?'eúËıËx‘+ˆ"dW¼™&´:õ}”¾xüÈá–‹H
á"NÖa(‡EŠ õ+VÛ%ğ$İïJô0İ­íî×«çßÙ­íÀ7F) éÂİ`–sª¯-#Ô?}•™NŸµ¨I`£Nù˜I:N>Çì%\É”D¾dkHÿJ(¯±šˆ±T¹…aÍ1áÒçÎİµ¾ÃC›®tjB!2~8©q}/áÒoÆ[ÚmŠ´†¸úm¾à1¸†ã<t¥¼ÎYRCüÒéğ+R17–Jô2#c,ØÍÔ2İ‘½£å‘iÚ+1$Ä?u\¤ˆ‡í½İ7ñğ] ¾«t’—ß»üĞ¿¼üËÙñ“ĞÍ:hÊ‹ŸxÖhd96yÀk+0nTB.•çæÉ†¯2N]şéå_ˆ9}”“KZ™ˆ¾Æ¾hè/,ûF63‡óg8PÖô;©QÙŒa`‡ñ]ÛFÆa˜™ùOÖ@>ÂŠ°×î7õqF‚xF"„dK£ñ˜ÆÿSğ¿¥ÔÎ-0øß1P/vÜJC ú–à
ê¬ Ÿ“ğøC\P¸Yy5„~%t‚Â=üq™v±d5“d½î–\îãtÜıxZjv2»X^ö›N@Ü¯B{Fã½4ğoµMVny—Ù$òK IÍ9Vn´0‰a†Ÿ¿Z?ÿÖÛ\±~·Ú¨±Í9°ÂÅÏ.~8úÛ¿ô_5Kb$\vY£ú¥­]öyhm÷m ¯)ÇÂÖÿı›ïŸœÿ¤mÿİÅ¿\~ØáDµ¦ÄŸÿ¸ä.¿wñkøûøû3´"æXÓ²,äÂ½Ø{CtÚ,D+¬aô8BCç‹¿e—ßd¿f¿aÏ.~Qf{tdF#5ôyîä1Ë ê4dñXö]FEª4ÏÖ#˜æ)Mó—¿+ïÆ4ñÇi2¸{¾s¥n¡ïÊ¹Š:rvd¡®Bd‰Aó#7ÕÂå·áæ`—ß`—ßb—_g°–e¶­æÕƒşÎ1PÕ•!¾l 1],¯0İ÷ÚÁNöòÃË¯Ã~âÛSº@Iò·rû2ü0ßT9ß°ÃĞınQr4i…”L/ÀÅ'e˜ãQ2† M úÈPáärCÙ+Léİ“ãóŸĞşâòOqĞŞäôÌGLÉ9&Šù„0vD6áj+ù\–¥e+<Aw4`Í}íÕa	 ¼ º˜5¿êæ&M¨ª{a­€GÛ @‚”dÿ_h‡ á¿æd?¤9~]ÏÑl
Ù"Ã<ï1eU¹ø)Áâ·Å‰ìõÏŸ5aZÅr ivû0ù^·ÓJÄÙ§Õ=œº¸„zj€Áè~4§—?ç°˜:­¥¹e11>tĞ•æÈğúô°øæ1ù…ˆ3¥Îv
ÿíúQË¬)~¹ºÿ¯¾	SùĞÃ÷Äßï\<3·Î¼øíà¯5Ù>öˆ|1îGöFÏâòCØwv\üœ]ü’¡g'w€B¯œığ}Šâ8ğ`H²õOLBP¢ıa;,õıÄ¨&EûFà,KC¬ŠOˆ0˜nÛèxü÷vx<X}xÃ ,qìBü÷p
Á´–±•RB	:#ñç„0œ‚2ÓS)I[Õ;|~i“¨®	b¢3É]ôØä&Hn+&ÚBÅ‹àÔÖ}â|á¹=AÔœ„ù§—tNqØÃY<´+R®mu“a]cTJ3—™äÍĞByi};º­‚®,r{–Pl	J7Cİé`J/%ÏØ¿ÿø;ßWêOti
v44Ÿäİÿ¾Â˜áÔ¾ep(½ b²OA¼à^ §Htõ£˜GîmŸ2 ëŸof	®D)á}îoÈïÈ}N ¸jÚÑq÷eˆPH4ãe]8X¼s¨Ó¢)Bµ=W=â§å™ø‘D©×çÑÁ %Œ]õOªûlco{»¶öCÜd¸Œ·úğ®Ìañ³‹l§İ0‘W±G¸iÁÉîğ´ÄxM_ŒEüéVgÃ|Ôí`ö“n+h³±é±Q¹˜­™M`önXúBö‰ÖÖ1•P{À_h–£Oê“‘àEŞÌ$“ÙQ2™•!cBKÆ-ÄtVŞŒ™™yB3§„Şd‰»L¥DaN@WQñH,ªŒ#Š¹›* u-ºÔvóµÆ>Û¬¤U6Pµ­#£>¤W¯:Rî;v†]4(°ª¥ft];„‡€bĞì£× £<Íi¤mÀæ~ùá‡ìóë5®7‹k«hõ—f%+µŠVÌ-»ëFWİ YÖLjy51† ëIÀdÚ™Éµ¢ƒ˜2~c{Âü²ÅJÉtW$u0‚g/QS#p.YB¥L]Ğ0úGÍ[vÛcêN»K@dQ6>MuÊPÏG&Æ°@=cƒ­9¤œªäÔìõ®¸SÙ	õxˆsjÂ½¾?Ì6¾ÔÁøMc ûî9ò&^‰±;}é™U·Îvö6«ÛAQİËGã|Bpóà]à\6] A=ÂÀA€8(·vµÓª¶Zô»İCû¾yĞ	Ïécê.ÿn¹¥ær†S*e¾c_aÇeyïWÅqı¡X_h1¿¬Ğ²Iç&•‹Ëq÷4,ø´[ÓMóìŠªMèfçxV’£«˜S¨¢SÌ¬i:¸Ú«REµÇ¥X9ïqJº4[ãòÏâÌa"4À^Ò¦E·/Poe£Rˆó	Ëh¿ß…óAìt¡˜z[Îvû2^ùç#D¶Õ/’Ül_4.ÍçFä—³×#åT2q¿,‡¦D.²%uG/è“?¸ÆØ2íšC	9éØ8b[ Ëéùş:iÄïó²ô¯b18¨c×:Æ4»U)Íêv½U1âç\îdz¢g!eòîÅ«Of­³îñ zÇ>®îrh•@ê²ôÌóÌB'—›âNÑ:bõEsËwÑLwÕ4#4ZŠ»ÃØâOl#?Çd4€E8V®ÖB¥<I¢Ç4a3ÚGG 'ŞD¤	¤İöô¤ü8®xò" ¦€3!>–>c¢Í“°ù. ¼3”ç?ú¾˜§hç&íÒš™Ò I 7
[á·‰$Éñ—óPÒâqÖ°}¹|ÉÔKCÇ–1V¸_,Xáµ¬nÜŠT‚Œ›áI·øo-·»wğjè·\.Ûî$ƒö@IÜhc#W(È»nF@Ãá LUH·ó¥ğéf÷¬£î!•ï¶F§ÉIó.8hD ¸1ãı¼ïÂ˜Èû˜ı™I]œ«~|ç:Û¨ŸìËFç"·ŒMDváé‡*=¶=ÿ½Z}'c<‰ÓÑ±? àş‚…™h
)õîÙ*V€ğ˜,Dß¶P9b>µm?eíèİNB.í%®ÁG‹†8F¥ÖSNcà•›HİmşM"É*ÒœÃÆ¶ˆÀöHnîur;>é}9h¿´şãŞğo[ïŸ}ñµõè$8u(ï(ÆŞh4[ô5%BN.,ãÏpŒ‘“íıûĞ	mÓD½[Î
Eô…ƒvcöx<ëÑ¡İ{"”Q¾&€¯™¡p¢˜—„ÍSW¿§š=eFqQøV“¤Äâ¹¯¯{à[€f'VÓWOİú£r0lE]ê#‹q}”Ù-´Vå²ÊÔƒcj)5>uvĞosĞ=µz—“‚ó¯è|”;ÃÓ£°?.Ÿön<Ô´ÑôW˜ei“IãO£vHÉÜy¥(yÚ¸œï µwõ*«”hàÀ’`ö3Œ¨¼-KÆ‰À9÷ù$5ƒGÌºŒĞ‡ŠñÀ9Ué­~¯×œ§èm–|ÈxĞL=6â/!$'†À¹D=8;"Ò 0¿S–©AË=ÕÃvAÇ[LşÅ\èì@R«TçÌ?—~øŞ0ŒÎZàĞdsşç*•©*€[íø¬Hd.â)™‹R‚6Añ~µ¾ÿ\^{õìƒd.ÕETëxÔg·Ôã………ÒbåfiayÉznfÚZÖO­|xğüğ¶=š»{˜]âÚ{l×'ş™pNIöŒ¶ªqv‚ÎtD+Vh·ÊùxD`eÊÇİ~-h
=tk¤õë•±êV§e¼®JœEôvœEˆa{@l±hw”ú}êHæ
…½£¯Â^Q¶¢‚Ñ
÷Iİ¥Óo¶ÒA6ì1fg$e6Z«#‰ñ:Û	'eôş2Ô,Sd×âƒ³n =ÀoSøtj‘£äö ı£÷ÚÑ €Ù™¤ºãn·Ø¤ƒ¬ÙƒCšƒcg[$!Æ‡‹k:ŸŒPŸÄ‚·µx_ÀF\ÃZöªs~ÁÈWİsD¦©˜]ŸÎ¿¾cÖ	¶ZDQÓ¢VQ!ª%†ˆ¤o;×“ÀğI¼QÁ‡R²FÀÉoŞtÜoâ!×ÃÀu;4•ÛâPeôà5úPh¼NÜ)`‡ mT0X˜¦ÔGá™Ñ‹‰³Ö8,¨¹Á|
År3 üóM'ÑtGŒ/Õª\'¦
È¹ˆŠ&rt àE`×Ñ™éõâ±{iP*µh&ÚÌ<*_´0?œß×õ™²ÛaÚ	*SŞ†½B¶%/Ñ8á‚M•L\BFOTŒ Ê_DÌ¿kÆÏyÔqkÓJÚ5]:ß
3L®¼Ôi/lİ3»‚ŠØuÉX4»RÄ+"îÃÛğ$ ×£ÊT·w¼¾c‚/×¯e­roŸô8p]ä+SÀåÙ(â
6TbTb-ºµO`Ç–¦zàWÁ¾	JHÕ €CÛa¹lK‘F#­Êqsñ˜úI¸;’Ú`B®"¸W¾Ú…BZÒtØµk­²øÁÆ‡bdââĞ«Š|4¢d\2DáæÉw¯ëŞ¦ù`ØÆS&üŠ#r›I‘ ÁğÈa$ÑïiÁß´ÑéX¡<%p.¹¼}>ËBâº@>çv—øt„/Üv
şEÉfŒ o¢
”È”¼4õşÕØÛ¯(¼âŒBŸà„›+¿À½I¸•jÉx+<†íW^Ì·”,èÎ)?òìÕı2!h—<8	b}™{‘(lĞ0¾r‘äˆÀ¡€–CØ9LïÓ"5¦CI=èE‡ë¼ıŞàa&ûKsÔÈÄMïCª8¤ÊÖì"ğÕn‘ÒEcõ©4ğ¹c(ÈEåú…Š£Ì÷_Hõ†İ!1>OX{Š	O“^go"ÛeÊkPí°Îìsæ½‡l]6àX½¹îmjÚV×n
Z“47úO¬NM2İíÌ¿’·•”ÇÁ®iÜ©RÖÏÃÀ,cîæ
“ÃÛîˆäó´Ş§!/&¨²d(Q`9e\)ÃÊèÖò•]ötkğu+Ì¯~­_)nÆ<]+)UÎ¢±£Bõ‚‚
ÌÈø­Lk…	ÊQ»Û|7'ìhWs‹½'ìZ˜(3Q|²¬Ã
““åÔ¬Ï–¡'6~hš˜=âvÂ45é¶€>½‰æ'šÆ:5ĞpòÌ›×BâãTÓ“¿·—¾5¨ÊhÅN)á‘nâ¢I˜¥ÂH>HİJŠUöİLÓ\.8.ì Ğ6ü)÷êHlè
ãtáY‘PDÙ"ñF3`Q,|ÈÀ¡DB’äİÙaIhø¸ôñm5iŞT3Z«eév·îoÕ>]ßğ«ÄbßNÛ>’óW·ª¤tÍ“GcŒ&÷H¬¢*ÇLÀŠ÷ŠçAâ†æN¾í‰7Î¼É÷Oğ–ëK+eğÕëÀ0Ş…Ä'U¥Œ¼L£ÂÙEG8ÁŞf“ìTô“Š€‘Xéù"F-PK¼î¹æ±€yÉøğ^ô>ÿUİiß	@o+ˆM”¹˜¡;à$m¤è™ŸuS˜ó²hˆU‹‚°'äP~ŸÜÉş·Ë>Ü;N92/	»:°;zõG© *ı¯3)†‘¢®>¢6dVµtîPJ”ğ-G5Í®ØaŞÌ{ÁÎèğo‹hk'é6¬y:Uq¨0¾Gá ¿í?í…²¢
cï«½/ê“wL_³»¥p'†¶×£ïiÅš¼ƒ4°ˆá^Ä­_ò´|Ô¼u¼œ'GáÆIĞê­æ+¬‚§„› ¾†ÂíJiqi)¤<BSó$#M=,Àé P]şÅ Úù‰c8>¾İHá–ÊÊA rX)æÉ“æm6¸R™~Lô°„±Écª¼Ö
+ë²¸T)-,ß,¡”Ú…ı·>“±Ôo-dÂDšÓ¡5Û[++Y›³Xy­´PYœzV—fq‡ĞÆªX0‘Âª!™÷8o$D®ÜÜ{«…´GiÓ÷<Í¦I±¿¢±ØVç¥ğƒzõÍw¶vïía¸ÖV!&T¹C—¿İjÑoÀ)	SÃ‹ph¿{öê¨­%fhz%¾ë!¼œ´´G›fa@1Ç6Kl²]~Ä@FW£é7(³
ù,ĞïV!î83TœòŞ”%	×TôÃãµ‘©¬ğÚØ“U¥Iœt;5 [V8w”âÃ%]0]Q)1.±Åå
‘Ch$zÅbºv×®—`äˆÖ&9*Lv‡TT
­EE™˜NI^z9ahÉÏVÒè1İ+ÒæéOr~İ–	¸a2|1Ö£´>Ènï/ÿ3“·kì~½¶³U«³½}rqyş—k¾JiW¼&“ÊÖù³£á 'u)¥d®ÂA¥§ñ·÷,çtNË~'ONzÖéò"&-étmXıDšmüçHØ:g±/Q¼bkgØU³êŒ€›ê ÿ±‘§%Í‹™üœóa	4½QT´Å*,ÍÔÕİİƒmÃùƒy¢±»!~2Yàxt<t‘|Ò¬6‘ÙBH:AmÀUèbÉk]Á^ã^EÇFË´Ë²&‹ˆß
tyÁĞz²ëÜÛéX[21àŒñ’nX9x|ITwÓ,_dt8Ox8º+¶3ïb§©‹ms¿RDæa#ašô0Ãj7…sâ‹;G»ãX6¹&ûöÏ‘­Z2a¯²?¸KÖ.aÁ9è#—µC&4Ëàšî$Å{9Ëç?ú>«Ş¿_ßJÍÌÈù3â íÜÄ¸ñ`‡8i¾°[nÎª«-å:MMi–DyùLÀ¼…óä6¯¹Ûn”iÓnYµ„şvm$¿ÙmªÃ	ô§…†UÌúm–”'k#ùÍ|Å;€~µ6¢«À|¯M,ÖFˆóÍwİÎv7hí%¤…]ê ×
áärÊr
œÆ2-iO	áÚ–IåHìÉÉ;`õb¢?é^2›Õ—k•€À¦~-Õıµ‰šp¨{øiÂíÂ-¢Õ¼nı¡ÿ¶Õêè)/\ÃôwÍôù; o1:k#ÅÙã·ŒµÛ†õØp/_e.¿$Ü|V™…"9Zì)±b;*/õ+Gc»ç;ÿ8Æëûì˜’tl+êÛl¾¯º.>Û„-rŸÍnÃMËAŞ’»ÁcŒáÎfÊ­'7`äÍ“/C45‡CûÃÓĞx:»¥Ô2×îÂdDÚĞ=úš°/vó†ê® Cèh&œ8ôjš³M>Õ×ºÚĞc"ªŒÎqf|~Uûıè1b„“",W›ğÿ¡Sp|şLÔÊûñÕáiîÒ~€tÚ¨ ' ï…Á(_Iš¥jPÏ‹Ş½Z/c2n¿ŠÜèæ„ÇÉÒ*zyDÃ",}ÏÜL^^Ûí«Ÿ¶Ù>B¬HGË¿3ØJ«‡_N¢÷rºÍÓpl°lÔäüåŒMìø''Ş\¼ÀÂ~ô=äß0=¶úå!à½°?¶Ç+GšÚïèßÖFúˆ¶ß n¡G¿²’×œ·ÛjÂğ¦)ñ•€q|1[0v0œ	ë˜Í~7Ml¢ek€·"²ƒ¾vÂÓnÁc÷ÊÔæ²–A·…ÊgFD¡–l’kóCÓÙnç3Y$ğé,ß~ÔinÏ¶şò’ìkŞ-r›+ø	Ø	³@’D”‹Gµ(ÿjé½pc6‡ê\Ş1ñ.‚Ä<BC  Z" ;;\|¾êg'°fñféÅCÇ‘ƒvæ1„cJ"€\'xœóÙØFqÌõzzë¤-0-â5ì²ÖîĞ°âmf÷Ù`-ˆ…WÄY¹‹fª«ì˜/ &Î™pş§AÏüÑS‚keóÍät8àû)J?Ğs8,2ÏCaåèy#¶\IKo«­ö›8d}a€ò-ˆ¶DN¢qç÷I€Õ¢÷›Ü@FXˆâN±XÆi Ã“ØUû(#B\JcItbœ‡§I¥‘¨‰Ûwx<²Å; 	éÛ4W¡ÁrmÑSã7³†0¶t7â4ˆ^õ›±m˜Œh³¨Ş³Ã®†e€Ï‚X`±*ı0†ÕŠmT@@ö‘‚[lğdÀÛAË%4ÕL“_…Â…ñË5©´hË0Şt€Wãa9c<ét‹GJè?Ó/8èä17
­ò¶¦Á­¤ä£ğĞ4ì«ßS¦zl&w¸U@nu…÷<æGîÒ,N‰4L‹W}QsÇW~#ëŞC6ÔY5éÚÖ5q,ë»“«ÒEïV5üš§’ít3ŒÚ,f•šgKE»3Ñ ‹+I£i½Ú%½š–ƒÏËˆÈ¡Iô)£rH³óAĞ®ÒµdÍ6ÃBÍÄì:³=ÃK¬âÓe§Bgş\è%WÂÃü"ÔhZVl6eælöByÏ3p¹“ñ	™ˆï¯ƒª£.y±âÕ”*¦…œÔ"GìÌ:ŞPñAÍ8K¦£ôçƒÓŞmV¯m¼Y«Ã?_0m¿|3„u9nÜXÏBGÿs£áÇHƒ+cH‘á1Åç0 Á´°kPª"{Ì²V¹³J*&+YŒu¿•Xf`weŠ®e„}+¦&®Äı9›Æ\¿æÉ¨.ÿ<[š…ĞhK®ôÁ‹ÙÄTí?üĞô™§Dî<F²ÈÿC²ÚÂ¤¥[;[ÛÕ-™iT*ñvok{Ã¬!á°„`q©ĞÔàÅêÕ]>jÉÔğ(hfrxŒâèDªwÌ{˜f.6İ±ñC²:µ71hÚŠÇ>+Ué#-YU\WßÃ¼YhÜæMÇxüùˆÔ1Z+®Nµ¥+·ã´*"Î˜Í™Ø×ª‹ZBÚ¬±/ßoj6GD|]à&0zt×Nì	Qr(†‰ñ™İŞÜQĞ÷d½Ÿ‘-¦¡1WÅà‰;’†?İ6éR§¼±‰œ<
Ê”‘Ov0UÀv5+ô	~^RøüxC `n„Ô (,‘ı³m’€Hïƒ)ã¦nhxÚ<MnejQeè¹¥§ò·u?òd¥ù
³v²­¹ÍZ£qĞxı¨ïÉNÏ£™} ªA·-¦¢¸°Õ`Ûyû«í°·¶ªÌ‡íİiL‘®Ã¶.ğÍ{ª0SôI~¤Å4éêÖ"Óf“|Ê5ŒÎHâfÄ¬â5ÇÉƒô[Ş¬¯~´ ¥çNÂ …)yßq!wA}38«rØÓ&[Ô=E°9Š–:CÆC]]†ªÂî§‰]îoEÅªÒÂAI¹—xnR}WêQF0š)¦ Ó¸Å§$¡Õ†‰àü’8ØH¼ñ™ÁËÇÜ¢puZİ³2láqÔ?-<l{ˆ?©Í½jìI­?,=º¡‚›Û© ­O½Ò"^ßÜ“ğq¿ÛyU¨Æ×stÜDnQLN9{0t¯–}âÆs%?b½;’Äsí¬Şà—v-$†è'‡d¤H›ÀÌ0î)ô†C•fŒ?›™G0DPğUŒHNaşd4Y²¼;$¥’Ò)¥O#3av¸šK†x8HËc+:I„§Ê˜$![[R5gIª²²§“¢vmŒEØ+¶3*)íëÚH}O0™p?¦ƒŸé_ã¤¦ÛyÕ®G{»6ò<O¥›w?†Ê¦©Lªƒša^¿M*MÚc^œ¾N,O*fQ¾§×ğ*ü“Ì"Æ?é	)“åı9\ãñs«³<Í"IfœpMÁñ&AıË0j·² ½˜u…úip >°\8»ŸQT™w? Äcø¹pŠè|u…ÒDn¬ÚºÜ‰ç(Ì?øÃÊÊÒİ9ü³|ÿ{³r8ÿ¨”Ï….şË÷ÁÅOğùÅO­7ÏğÙå7Íg—Ó³oçÉ^-Ÿ¿mÎï`€
od4Ü¥ŒBq¨“éL)Tbø†…ÅºX@(€h[‡¸~.H5Z´İŠIfÛnqŸ:#.´8ˆ:ÃĞ©ÛîÀ¸;¨¤şD0ŸüjŞ
3tÛéÂÖså QC¡C¿…úÉ.YôDzúÂ+%!{dãR”Èõi#ÆçQ"ÇNlmŸŒbzÒ à‡?á ¤Z±õKæ¯±µß8vô”i% u6U ¼­G“•³İyÑ®ñª0šêa‘%Ÿ‘.MØû”å4K,â£ÚÊ³dı2•äkš“-Zà½×i?x{rFgP‹×¥’9íÓa{½!ç.`•˜ô¸ÀP±¡áä‰aÈHkl±X»ıA¡”hßì"s,°Ã5¼L èbáç‹¢¥O÷»¾K*ªŞ5`ÿAå°X,ºñ¬Œ!®İ	æŠ·uTR#æ§´ò<A[y­yÈ£ü&ïjò\ó×òzŒS~ÜîıÉjeÁù¤Ñíü¤ş€•+½MÓãä¸Ü!ğœÜ:_DÓEä-=Bë’½§{WÜÊÉçMÚ2_Êb½ƒzu¿FYx<.T£#)Áµ¡#±àj~E<ãÚ[,¡®ÅZ ïÎ£B§(k>l”_uÆQy+DÃTR¼G+1/	i‰ˆ¡¼OFl[Ö TVt–µšZ(œ¿!r_åK®Ÿ¯”öæ…´7ïó£ÍL{Š›îN6²:fÄÖYŞØ/ÏVYŞ{ãM°•Ò‹S»ÚóNü+/ó)~Ã\ê<M«œ¦°<Bí!Éüì4™¬F~µ8=§­uçh§¯å‚Ì]r²P_I›¹ˆèÎ)Cú<:&sTöÚÃ8
‡0IÁéHÖUófá‡®ÀRQÚ¹Sr¯G†·¦	¦y' :'€šıÚZ÷$½¦ñjş$jµÂN*8 >¾¯(\CöÜ¨ÅË"ï(•3†©µyùş í=RSDñ©ó¦—VJÃæ"û\ñkŸ‘¤ÇˆZ4ÚdË‡u"¨ÈÅæÈcÛIsc¦¥¿¥WŞwC[÷¢¸/§»E¯)—äÍ—sI&µAiÒ¾Î&]%›ÉwÖó òiÜiª;³İ¸A5µ.nPß}‡ƒºCöÌ¿mßanÜø0î$ıå'UN®&`Ş×ÚšşÛ‹²…7‰Ò6}½\È¿Ç–˜qªd
?ÓX2èx)å¢_IKYÏ?™3… ?o'ÛòâÖdÉiE~¤·½¼Œ³ÅÜó]*µ£øE­Ü·¢Lûúò©àŞfDe$AYhî—
®/d¹íÓ'[PÂÈÏØ³eÄ´¥;é²5 Üµ•d(fpØN1–)ı \O£@øSå/âÖ>¹_õ,Ê{4Ğ#m	‡*`2\ÏíşÛ?ŠË­Ú¯I{Ï_c‚†Ü*}}së+wsîÖ…µ°¸ó)¬…OABaÍO{0p²r¸4k¹…œ+D{m)G#åÆ/0¼R††¿ÉÆ°”£ñ)“•Ó’×ZÅAn§6b›'QïU{İN×s2G×Œ$>–GDá”{eÉ%È	gÙ‘ß6cB²¤}µ™lŠ¾Û£ÌXæl®2#L}Ú²C{³Z£¶SÛİg;çïW7÷vwÏ?®5€y¼‚JX,¯0v•Ã×lK[œåµÌY§ÎûÊS6	i%èE²° uRÜ³İX˜ú»ì¸2µÂŒ–£„ÅòX©ëÙ[{VÊKwZ\>NÔÇŠYkqüªô«™ÛmLÀ$0ƒ—øZ"×Œµ‹àõ‰ÁşøIS˜dM<i`A,%nJîd>…ÀğvÔ¾“³£;Æ´Ó^6ÜŞoë
X–»¬/¥ÓÂöÎ¸‡ûb‰ğ›¿&#-hƒJ‹üÊ-W>ç1*öí«Ãx?İèbvèñÂ§‚Õı™$§àù˜±±JRÂ«Êå|İl˜&`¼¸Æ#ãõ‡ìÍWéÛø¡¶˜‰ÁK‚Š 0øOØßÇaæîØÑ
¹˜á	Œ4|Ó,qV§ÒÄ
Z"6÷
¶26Ãè@Üş)gLİ’ŸpPSÍ!“íN}Ç'ßöy†(ôk.>-zÌVÓT¦
ó’å»LôÛşàƒ\ÎpÎ\ÇìÀqÊÖ^(cN]§+1‹ux):^
:êRî}ê’ü¾P"†	É~}ïà­ó'³ª´¥ë³Íû jn4bš"t€7Úç²ˆ58âéìf±¨˜Ú‚Âj_ŞÀØ´ün…±à^ää6­xÓÃ:+F úÓè vŠ;<äõ;OX÷RŞqr­Z¯ŞİÚx§¾··ù†ÂÌ_üôòëğ¿oæWY¾Ún'ù<üÇ‹¿¿üÆåGøp'ŠÏŸõ#š(>Q¯¿}ù|½ß?ÿ$f‰BÔ4´qñK,´İ"C)ê~‚@‰tÂaŸıšFAíít;­pş Z?æíÀH¾~ùgø²Şæw‚ó_úÔŒá[¼Ö»¢¥_Â3ö‡BŒG<_áìd‰1ıúâ>¦j«Ûûó°ÿÈAQı§ÿtñ³‹_ó&¶N{m,Ã‚¨Åûû&¶¯ŞÒ#jñÀ”~zñÏøxã$„Ë{ş­nÄË›»üP®Õf¿èÅGĞ=º…ã ˆ¶~sñ+¾<p"Î?á³¼øî><ÿøQĞ?F-|xùuQòÿú>üåG—zñOTîÃS9¸‚1üŸ¡Åx§%ZüOa¤bäú7‚Çğl¾Ñ„5E+—‹ò	A³aÈ¨ùíè±hì'R6`zâÙÿ€Ñı½œßü[a0„¦Æ·u Ğso3
°½¨DnAøÇ†%ÌÅ_Ì]üï—ÿëÜå/ÿá·?˜ûí~ûã¹ßş×ßşô·Ÿüögs¿ı{´Šaù<aÕ:¿İÇû5àgfà‹&j¾QòêôFWe®Rzì3U1‘²V¡ØŞØr9ê4ÛÃVÈäÅl“« çxŒá6ƒvs3:>šÀ<-ğëµİ2ÇMá|1+
¦¨ÖB\Á?ÿâëó‰\U·'Î˜ìEt1Í`›î43mPÊ|€Ü›håGÃ¤Å
²×Ä47ô`©š/)G—nı=J½'l(¯l­Ğ,E¥€ø­/W·áÿÕw¶kûûã4éV/¢ë‡p¯5¾t°ûÁ|Äå>·P”ILt‡P—¢ö®±êææ;;Õú—tÚ0hQƒÒ¿ÓœtIŞ3­Æ…±©RüÇu#%Ñ™‘‰¸Z`Ünı%íEgÀ•,ÚEÅB}UÊËÖ9¡u|#›‘».•x’ğ…É‡mÊfÍµş,¯º±µ]Ë«<Ø:Ú,¹ğ{±ÂMmÌ—’-.êwö6Ï?®Ÿl¶)£Çò6—=m®$Û¼¡ÛÜÚ…ß9ÿxs=àì–_;^º![¾¹Ì[v›ZÒMUßªîn¸£[9Z9’m,ThxÎ1¼‚y)åÙögæ˜Eó»èß±·³Ss:qÔZñ ìÁ^éuĞñÑ<îTÏ¿³_ßjœÌÿèûŞÍâ.™"ÉÖL/i{¦R¿çgæÀk·)Gï^ÔGC™¯ÁšöŸz<+ µœˆÓ’g6Ò£QÏªÖğŸÓ½Hö˜<M×v ßÆŞ
½`ÂÛ\ÔmâÊ« | ­¦6Ò¼üdÜlÑî‚~W†Š1RDä, $í Ëõƒ!`ïaLÈ¢ÀÙtïÙüKKaó¢q³bcUâÇ7N‚>Oöd_¢É5+®ñ ><â¦§•
™ŞCÓÓ›ËôãæMøqï.ı¸·‰oîÕnÒÚ½{‡óº!S--ğ–ª‹Vüïæ
=ªmò&tn¡jÜÈÍ¼õlø¾â°“ÇƒBó¤h'šÃ$j¶FŞQ„wÓ<¡tÒœ€jRäë0rˆ@µë‰zWïWĞ*
P“/eJî·Ø [G0ŒãÍ¯V ˆó‚x˜‡>ºvz<C&ADñ ÛŠ¬Íw1L6{C£GOÙ¾h÷~Ğ	Û,è´ØfØì/Bbb ë4èc]Öî>Šš¬Ä;%fì¢ı’qeÃ8”­Â‘,1µ±´ó76‡oÃxßÃ]ÃtpO¼¡ëõÃÇü{"öG§{&È™Mò‘,º[=a§#;ğ´zÑ´’=pÍ-S@¬‚ıÊñl#Jô.¨· ®’Ò	“´]ÓƒuJEíöİĞ(¨g¨,3éFÒÍQ0]«h[­S AÜ—€æß0Æ1ì„*ˆ³VÇ¦8 ëâŠ­â
šêlà#Äs cÍ"ÿ*á êÁó´Q]¢£1´±s<M…X4´I#+G£M‘²p¦6Í´/¼İlÎÀŒòsƒi¥ÇE
u®Ô†Æ±öçZÆm´»iJ&>[C^E¨¡ÃÕÆ„jèËÅ½jT}‘!Ş
÷J„GÜÌCI@ìØÊ°ÔO¸™öµ°,¶Ï­]"›¹C©’1•¢Öè‚`EÙ0/À?YÑ”Ôa©P›w‹QÑƒ’=p.ëîñ„eÌXEf”ÖJ.¤^®|,ãâ ÿ²t–0ĞZFëÍ§qî>…“÷ÒÏ³à'™@c·k€Ğc<0P·:KÄ	˜÷ş?½ùW‘Ç<û¬$RV™ys[·ç*¿ZÇV4(+}*–£³^–-jÚ32ïÙ¾óğÀÛBŒR-bkÑO®C¢ïİ-+!HØ–¹Îgn6±]V³D¿_¥ÙÄ–YqªÈ#öE|,‡¶*¨E\ç±¹ ŒF(÷ª˜hW[‹Ä§uÓ]ˆ§«ÊÇHpµğÉd™/’—gĞÅ‚Zìá2Ğ#!_z‚CzB>\”®	1=¾/±(ÑšÜFÊÏ§wÆ-&·… )t{½Ç:¶œ;¶"k‘k¸næAròDÒ„KÓ~£·ŠÇéöU>À‰ÅÉ×ãÃt7?y6íˆwî”(x‚N˜Ø·«qåQˆÊa™…d mœvÃÓhP|Å†€„#C@:‹`À~h¢Ï€¯Ø5J“è1^Ãw3Îš 5İ=>Ë† %mä{eBSpâMêŒ“zÆåyO²ÛPY–Qåı
Ñ5UL/È·Ñ’œ=ıÆŒ™‡ó $-)mz‡çYt•ğy¦ãÅ5ëÂD3£øÄçdÔ–;P´Jù˜ì4óÌ‰•SçV ÍØ:–É#$bzQëÓÁÆˆ1qLh©ç„Şš$ÚÌßY¦gw} ˆ.óìM‰"ÇfÇ‘xSR$IIÑ%E2”Ô-_Ò÷rÉ¸UKb,™;<– ­±¶…5¿s¥óUôÔ0ŸmÀHÃ8ì“L‰tÛ<Ä6,U/lFÇQ“Ÿô>hÍwûú±ğá'‘!->r|Jîd­Na$ÛTòvKœXùá“^€ÙÈø†@¡šñ µz p#á«^,¬ßïØ\l°5‚ÛlQ›×Øº#W©ªD:=R™‰$zô]:³|Bé³m0E»[hdjzò,ù4Hwa¯GAŞ Bv 
0·Tt7R'00‘*ÍO^×®hİ(‡d(´6’çåoïí—‹ğÖ›0İ‘9Ó—z©äsÈ6ìÑ—ìv÷(h‹U3<È²ûõx‚%=óq/h†sGáà,tg˜ôKı÷ÿÕØNµşåƒZÕÏ?~k«èl“(7š:F^7ä	ÎÜ¶_Ò¢Ï/)Ó½(Ó/ÉˆJ™Q)­Ê¦²Á%İ'y;Eæd5V-Üú=Œ—]c¡Írj/&\‰éèøÙYs=Ñ>¢†ókÅêµı­z­3ÈÉıE×v¶'W‘„…â€šN´’ğ¡zyˆV?j·çZİ³™ÃQgs·	ÚI¾AÓÁ[Óå*›>p ¶·ƒ–ZÿöÏ-"ê5úúfµ^ıRu?éX"×‚/Xìxˆº³ıj§tM†gĞ+J.;gÙ©˜a›è×šºş,NÒ[Gbî5÷×@  ÜÏ{‘L¶I5êÏ~‘'a©5Æƒ>â÷ ‰„oõ´‘ä„Éo_h á¤à*fÜ´Ğ &Rá¤ã“d³•ô 	ÄËåJúz†İÍŒ1³·ÇiÔÛ¬éÑi¡HåÇ‰ƒóÓ:Š
¨wÀA~‹|‰Fg)Îa™ËåÒ#Æö‹è“QŠ»mÒã»ÂnÒ…•˜–3oos6¤˜P˜H.ÀE9­úJ£m
p-¥»ÌiŠ^·V·ÒÛ§æØÀ?fãœ¥]jöÇÄìSNéA¼ãqÂ òc/<ÿÁ§±>ÿÁ¿z]ÙÓáğ…ƒªñ;g«ƒ1ø­ÛhÎovŒ×aG!à=.ìãLW#Í\b½öU5²½•¬×ÌÆ·–ëÎù/ûš¸í+ÉdIˆWÿÌ hº‚´¹X3˜a/š(š¼zÎüwOÊÍó2®é¥$¨Ú‘ „½ëìnÔÄ§ø¾›ÑE\ÂÈ7Qî¡–_¨T>gFtÉ ¡l²<PŸI{ó"øÈ’#¦îqigTa›5MéÂ‚'[ZôÔtDÛöGÀ"yúM±³Ïá>3„å,İŒÏZˆ Åî®ê™.ëÅÅ4Äi]á·$•çÛ¥Ùx-ócŞ]´¾›h1õ"ZtÙ4šìÁ¼7<$ÙbM†q9ùšÒWĞBÖ¸4N`vt¸=0nbâ7}—yı'¸Ó`O‰°if6àôE‚˜’şIdt•'—Ï­ÎÈÙÈÃbN±+YdHêFùß$)´#–1_ğâç?úkv¯VßI‹Òï÷M7·ÏŒ¦‘îm&ÂA66&¿İ3Õ&/‘×vÑ—Âk«,÷Ï?ŞØº·õåƒZcB.›«rÍ|]è6H‹j²ÌkJFlhV(œøÔì¬yôÊ/Z|Ì›~	û–Såf¾{/q’Hh9ıt¤ó¼ğ}~¦wZv]4ÿbqû<Xìe²ªŸXáĞÌx”úÆÛáLôIIŒĞë@Dš!âß,CiO1!‰‰>"Ãü/m˜ èG°I§nÚ;L‘•yN@1–r	ØQºÕZ‰uö ±ˆJîe#Å‡=æ›1;íO1jYLQË<0dª£%ûQLvd‡³Õušº ¸v'¾.İ«J@¸ˆığJ•3Ç¬›o=Ì7c¡ŞK¼Èh>ğö«€]
y£Š(Ø"È£Îòlo!ú¡	=ÜşWI¾7<–Ÿê^ii_oÀuõ_>«ñOãªœŞ¼­¦¸^348on5ö÷êx§&…dFßvìè‹¦%.İ”Â„ÓwYŠ«rÀMD¢yi½‰â3iüï¼ò‡Ÿ‘ñÌ[Œ©Ö„í'j§5iLà’ÖÚñé€Z+p£İ´Êƒîv·´C¬.üòÇı¹{uØØeÜáÅ¹Vôˆœ†OaÙEOº}üyÒö­×Qg8õF†ùç_ûo^™ÆÙ6Eû•ÓŞ¥ˆÉĞo @Ã=ŞBÕ~?xZŒŒF-r1~Ûò+8ÈÉw·%_g9c-{rì¾1	×5¦	jŒ©çÅ/ÉwÓ«)]ğxÜ kİ‰n¼ËDšÒÁ3Ñ‰œ{S»ìÑŒøo¨ùïéF>‘ÉŠ’Xà’è,E§dMT âÌ–“â›9:¡ZGÑ–+š¡K‹„ë¥Ü\¡ÂÄH¹‰dEBë¬¼‚Î¸ş„1)xó¦òäM8ØÒtcœU´eãcävìØ8F¸Ú…r’1áŸ‘º âhPûî‘-§Es¼òUµ(ƒ,¦i™&,g‚ğ3'ë&é4¦¸¹@ t˜ûÃç}(z|Štzòø,ì@gÀª¤ÈÚÓbá	K½Üg[½y#+".uŒ×ç`Bf âè¼ÆE^Ébôğğ,§ªàøÇ:xKéóÔR8İÚd9L2¤†n0!ôé§–¶f²Ü%º´ñ 5Ê¾MÆ«Q¦m¦A›¶ı²MÛdT	mÏ5Sh‰Vt|ŒT¿BµFA,°îblùÙë×Âp‚gÊàLd2@wı3 üãDöÕøcéÇåã¾Ñæı7«»yàúf[Ş®CyŠïºá Ÿ7­Öµú;›[÷îmmlS=ìP†\ÈïìıImşòüÙ~ıü[¦Ÿ–rªµw6ö¶÷êF­© Úq^ß*¶ÛŒ1ÿó¯Éé×ê|Æ0İ:ÎÊ°¨²çH¥îW¡%Ãr€Ø¼|µvÆ®9¸¹ˆhô¹) 
$ù›[_Wô‹._@”,Ï«¢¯h)ÚàÀh¾ğX
œ}^¿®adK@!÷b²‡µ
d¼3P¤¢kıcÑÛîHäÀ_t$Ô„hÔÛÿ+™¶†/ÌeÅ±5TrşŒ¡dŞ17|iæ:d5ê$Ì
Õƒı½âT¹½3i’c¿QÙ\š@›ÚWââ49|JS ı—‚şøsUïR—jŠÑ&û6…­Ô.+/‘ÊÇæ<A>UÆzsJá÷Z%EË''“aÏ°İä40ã‡¯XÏ–ÖÉ y´Áƒ0›³8ÜqÉ_Aê‰vI‡ ëš•ÜXLêÆÔIšškwšwÖd„¥Ï¾ùúš])c t­©¹¸I‡>±+Ê,@T¹„©}|â;Ç·"	õÓd$ğ–w#`æK6g',’É[|šü¸°âÉô1E6&Êm”úÅ’\hà[´r¼O‘¦9*äØ¯¢ÆÄdÔ¼$K’ÁEİ®p#Õ]¶»õV­z€¦òù€&ót¹g4Aiqàm•|ùs,­WRåe…V‚|Ÿ.„°­ìZH*»+©f4–òHp{#êÒ€hÁªTA¼~ŠI©ğr…«ÂÓîxqñáäÜUBb1Ë0Sç¦Ğõ-NPõyÁÈÉêÓWe#Ef‘tDHÎĞPê„?«®ŞM¬ebñ’Àaø‰½ã‚[ñğ†ü)yXTh h¿7,pşŸY#ôCÖëÑj 4[ßN4£ç´ãgM©qìÜ\äÀ™¥W÷¢S,9ˆØzÏs›	*jÅ9Í7\`¶ü40"ñ¸eğ…~ôƒC‹tñ¤-&[Z@pù†}Rtç¬|ÃC­e@ûè6c2&ÀÓ0â/½÷WwYAédø5Wö‚ÇÎ¦†tVNPõÖîè(vRê?¯‹I=€dı«÷ï\3s:¸™gÆÉK˜Ë8>Ûû·ÊÅl3c®íîo5Õ7\MÛK»~íc6ñâí¥]¼\Ôû}¸yi(p§õäfŠ7®~÷šÍÊË×iyæÛwú¡~Ö÷oïÅï_~}¦°µ|&|›w/Ë¸|é÷K¼}ßBÑç°@YÓP€$¢™FWáÅg¸ŸßÚÛ¨Ş=ØÆ`¬lcÛ£şåØÃñyr64è—ûc/ZIÓ*¾H2Ì¹ÓeÍN+K'ùF&wqZ·¨4×ñ"à9Uúi):fÎŸ’4ö§´îÓ}\Ñ\l'@“ú§¬™$«x±IÏÛ­5¸àÇ$LÅ|á<á OQ"i%G¡bÇT¨F­p'<ÅÀæ€É (BhğÕVÀ“Ô2%^^•ŒDf€Fõ‹›ÕwxV+#ô7,Jî&\¤+¹RnáÆêÂ2ş]Y]®àß›«•×ğËk«Ë·àïââê‚ø{ó&Ùbæ—WW°ì"4‚mÜXämÜ¸µº¸—Vo`•å«+‹ğ÷ÖÒêâü}meuáµÜ+‡°#BäÌ;÷÷[˜eëíêİÚ6i^A©à“·ÓÅ»yşñ½­İ­<¾ğ†âå’0ÑD^X¨& úİƒ}ªM7³]û4jQQÌyk{«v j»¡„íÊaÇ®ÃÖı•….+£îDiÿ8ß.ÒcX’n¿za»½q6ßÅø
ÖÉ…éS¨Î|ÁØNÔŒ…ú„GĞ–‘ì#¼7Lçıö©?|w­híÆkı>2¢úeuC[¸BÕ·Y~aAó›´Û$‚*pë1zèVŸ'Øt¦®EfŸ,NÂ›BõÊdi;&dP”3°‚
âº`ÂœÄúàCw¹ğ®šQŸ¯¾0W+J9~ğ‹/J)ãaÍå-à6Y4åÔ›¬–\ZxÖ˜µ§ÕÔ4‰ªæn`ÉÛ<°Î¸ÄdíÁ¡‰$Š	‘‘5æš‰¯(V?Ú‹š©àm:8#mİLêtí/ëê…dµ9¶PdŸÃº×‰q÷Ô'Ë*2ºÊÿÛÿd­óg@+çKùû?ÜõQ8ÄïÿŠ!`áş—+Jydæ>kÁÖZu€¥ûİXÇU¡ŸDÌ³¤Ö4’=š,­~ÒJsH9ÒG'm”ƒğ²ê§¯ìƒ°¼5D\èÌ£Ÿ2æ;Ãª²Æ[A[Ôm¨NUcĞ|@i?ôÔŠûX ŒJŠ«kV@‡«Ø†RÂÒïó¸)*L;œÕ‹=aÈlb’K¸ÕiEÍ0æSALmá,¥6n_#˜Í5ÕÌº0ĞPë¡/§ŠøM8ºıZ §ù,ÌºÓíŸb·ğHÕ÷Ãjßpnõúïv3ÚÎŠ¤ŠÆg„-Ê@CS¼@‰%l!f‚XAÍ¥¤`aî­ò¦,¦âµ$#%L\ôLœ¨|kıİ­¥y9Â:Ôİº|ÂCññ‡«ò!Í8=©‘‹Hy¼4×ÄE85póÊdÛ«kNöB^ˆ³Y#Œ ®î/‚.ÆqB?mş$ ¾ã1YµCµÒÃÎ»ğ¢Ã—Æ]¹Pd|Á‹‘¯Â<8Ä†îskû@ñ„}52º
ª{ym'v3è÷3÷Ò±Fµùş‰Ì”éµêú^[Ö„·LÎ˜©¾’´NŸâéb'afô8´¨ …Ù‡Ÿ2ÜœĞÑ7prFuñ‘ö+s
ğì½j_Š1Ã†V€"Fk–ô	6‡‘+TCëÌôT³Î~nÿÂ]¶ÒŠ©b5˜Á:×7Ã£hóŠû°nÛ«v`¯¤HQúàŠæĞ÷–tÁE‹Ä…Å•ÒÂÍ×Jeîm&úH[¬¼VZ¨,–Ê+™ºBˆÇÌR=¬‹Û>i¢%î0OÀqÚêÒí¯ı•`.èîç¯jÉFù
%WfûeëÆ	¶Vaµ>¢ğÑ©Ó°|D‘*R6óZô)¦ÂSŸ‚[´ºÄP€øwÅ#=¢×AÈ\Uë€¬Ğ ß‘•º¶¨fXí¢êb‰Hu˜ì‘h "
M8I‚«-áy3Dk–¤şƒd°ğPGP|Ix„¾°x>Õ¥ß'¦d1GæÈ› ¦ª¡ÖÌ¸|Ö•#PŸ9ÀÛ+F”İ‡O²Ğóè9Èù#·ÎCÈ4¥gçÏ€¬P:4éÎ0>	§ÓûbeWªì*Û2eTù
)Û¬î6Øví4Ş¬Şsµ×d>çkJ(ĞcñõiïO {ÊùükÿÍMĞ<š¥ei`nöºq!zjñÀ7€'kÃBšËêí.SãéÙPSzNÎ2	Ù¹ëc:F`"3Y€©ÌÕ(K¹]L&[ùâÁWH¥Z!1s›2­ÔfŞÜúÊ]9äKv1½Ætİ¦6¬2oI¶óe~°éëx~‰(Zñ“sØèûÜÂ¡r€*½‘rjo;Õİ¯lmóÎhîRæbZS›©|éü?Y;Áe5‰ÉW^k…·exºvç½È®­‘ Í5Úãp:.®İI×™8¦{™Ö©“T"¶½yù'ÍõJÊ¾sei¢®C+2–ødJYß½ÍÉñ›•J¦á^Z?7KI[‡Ff{™V{S(8È«]K²&% özÉXÔR)©Ş’dÊKÚCÒ_5Âö±å›7Ãv.8”u/şéâç¿¼xö²6LÍÙŞ+’N½Sš¨b†å”¶µàÆâ‰rŸÁeº’¼L«¤(É²ûp®nõá\4®U•G÷bÙÔ n¹¶fa%”ÀqÌ¤°’µÒHª„ rmmv‚\- ',É6LA&©`âëØÛ*’²‚®-ígØHYiê}kpğ˜Ú|×Æ€7“²v–Z9´äàƒ*®sã*D13Ö“Éf"&4†_Óª6>•vvDè$è¦A3	<ä_¬%ãáz‚L­İÙbéÂ5Cj]¼mÉ“’æ±È=°ãrA
ÁŞPf“­R£Oy!ÓÂñˆj]–*ãMĞ’Æj¬çyø¨<:@lnİÛ‚¯6~t­{Ü³f4†²›)‰^ÂH	¿—¨ÓùĞ¯´²€˜ÔL-¿6
oXû–H™×{h¤T›Ğ†ú>Òy´–;îçœ+‚2WtÛ°¾k¹ğÉ*ÛÎ‚wß¸9JL¦˜. ß‰Â>°n
F¸Yi¦¡Ê1Ó}Nà–€™b^K9LèÈÇ ksùRw8@É‡;Ï;â?\„·Åö ©½RÉ>à:bç
mĞ8MlgOk	§•Š$2‰ÆÔ£•¶öBÜç3«™´îALL{_rd@I{9—
k&õ %	®XeËıÙÅ TÛĞå¹JF@õÍÄØG/R ÓUÒ:wT”Ÿ•Ê´À©‹L5ô•şa˜áh»ßè'gX6<Ce„1ª-ÄŠ«, „Uı€ ®†gªøRøô¨ô[\¡k{?ìÇQŒÍ ÎiÓİ´[å3ôEë<ªŠg¨™Â 4ƒ;b•x*z$Ôú(dbãC5 ÙÔ*»M©ø·BİKèœfLãuT¼ù¼©î‡ñ°Í×ékªÑ‰_ø¤Gi?J”è¨Uâ^ê†•	†&®‡ÇÔdƒ÷Z˜¨
dÓMÅÉîÓ.Î6ÌóQˆì–çÏÛúi±$$§å_QË5z3iªÅ1"}µøî¬úªÌOìİb9†“æ^ZŒE$‹”:o­º"ĞÛˆtêå~H—carŠïÃùG%;*® K^ ^íÄga_e"4U}´{ŒÖšàEµ ‹È­öD00”çÔ6Ó1»¹mô¼ôÄ j&ä°¦oE©51$YV'T8#e:ïôÂ\Ÿ`6BğOë&bÌ	3ºû
Ùİ¼]²È¾ dƒ>D-Hc‰¹vø8lÓI2:¤ƒ¥z³@(=£ÌE*4-ïª˜æv[¾í¾k¾ÂŸÙ é`J¡×âIYS|sìµ*‘Ä0mÒ ]dí3ò~‰S£NëmyV92*(´ƒ‹áA>:Òíqo‰5<™O¹uˆ´©’¸“°¥1uƒ
;il'1œè§±A
5ÆGAC[?Ê¼pO FH;*Í Wí"wÖØÍŠ£>u,É$‚1HÀN:úÖO?|÷’ÌqORøÜ6¼wcà¿	$^2­Rrœ/;µR²‡+¥WªŸ¼QGu½xwÎ?ŞÙƒG>ßdío ×ãµ;×¿¨Sf˜ı¡Vy_ë”¬Îè¢ãÄv4sVËÊSÂåºg‹âìÓ‹~ñTlT7Şä9‘òUô}Óa½3Y…W<m&¤Ì6Ì¼,Ï}Ü/ÁŸ9³›-^|2íA"2DŠ§ƒm£SR•å›¾%×® Îâº¾÷csU_Ç 3ÁŒò„nç^·9Œ×F¡¶—KPîÅ$1_–)íá¢@Üö…`„È¤±Ó«’kH~k¸Â«¬ÿZVŞ€%¹øéåŸ]üìâ_¾~ñ“Ëo_<c—ß¸üˆÿşzıÏ"‘~÷–`É/Iûôy\	º<VµOdbÀg¥4œn¦g¸ ±ùüã°?ˆš–²e0	èv:±ƒiæ¸ùB™Çî7ŠÏ[hb²_h2ƒGâ0ˆù1¶Æ;­µÑ5“rO¿„Óµ•¥d‘c-Õ¨x}“g
>K`³øĞM²ùI¨2yKh—oc¡ÖV+å%¿‰‘½uşq´ïˆÔÔ£©¹Ïµ;…1Â“zú‘:çj¡˜@N¿ë&½éMT™¢êô5Ğ£6•ÑÉ\ÍşKÙè)÷$~È¯kì¼µUÛmL{ñëŸ‡9ƒ üëÚ¶A${UëÑÛ;\™šj½±’½Ñ’HS¼ŠÉ¸Êd5ÆŸó°/Ï!ßUT@p~ãyù€8À1£œ{õzmcßİİ	c½jd1#‚@eš8c©‘ÆìµÍŒ6fîÑÑÆ–é8¸j†„R/IäÊ´—$ŒH‚é§²õ¦‹ôÆŞÎıj½ºÕØÛÅ­Åğøw*¸›Ö³÷æt4±qË‹÷ko•$ÇIfè‘˜İ–D>ÀŸúƒ­Ğ¤M#oƒcïÊıï‡í ‰]i !Æ–’&£ÄfNJ¹«m‹-¬ïæøX¨Ü¤ô&#Ç‡“:WwaÈ?´yàâbVv	µÓ2ëjôüVÓ"gEµuâ 8†Ïy ¹Á	¬æ£ƒ8)/óD¾Ø7‰µ>ø ÿük•ŸBw”gŞ0É87®î§šÙMú;o@^_a×BkJ¬S¥ã8)Ïî•¨i"¥¦§¢nÚ”?ˆÏ4¡ì9uÉÛ¨şÉTdïÈ+ÃôYß¥·^ˆ6Nâg¹—“¨áŞzrøål('~ep}ÉİïæfGğ‡àYF0f‹•\¨È~G!WVìL)¬àhìI›& KšÌÛ2†²ËDş• ;·w•pü€Áù‚ãµ® fU<¿³vŸ
­€~ºÄŸ’*@[ÚŠ¹º­0,·¼á]&£+ÈI½Ù#ÉeštœGşHÜ7ÜØtùeN‚{»y8Urâ$)¨^Xì9‡åæ^ÍL=ÁƒÎd0eŞó$£²"wã/O<ˆâE‰s·(F§9¶@2k§İAœ:Ú¬óŸGé)ƒ2*.‹YY€Fv ;“ÈM 4.¦YÃ{ÍÔÇ/’ŞÍzÆ{ìè:èfİºÓÈ£ô0{ôïÚzg*Ãsè…Z4·[@"q;å/…Om‹°ƒQ¬#,G([f·ÔÊú%‘áÜÑ\`;ÛD»cÖlq¼œ¢L_7»ÎrXb.€9ËöÎHN Dú>4†G§agøû¼Éƒ†Mˆâ½nœ¯Ü²á/UÜéIo®³^Ù\Ì¥åœÃåÈM±ŒûÁWÏÂ°U{ö›Qó÷ŞJÍ³¸Z÷«_|»VÛ|§~°]Óa–"¸öŞÚğÿ@ÅHÊÙ~PŒtùáå×ñßÅ3ƒv´ru·Â¸¹š¯‡GİNàØå‡ìâŸj“~Î.~É‚Ça¿;:|ˆ)wÎ‚÷UÀ$Ç)\Øy#ÜS~Ç~@ãøÆåw.~yù—Fô'åde£Únw;Â’ƒ|<‹VŒş}½~ßÓÑ´Æ½ô Mù-ûáâï.şåò›?½øG|î%¤ù î÷»n§Q7ˆ	°5dóÿØäóŸ¼uØ<³ó_t`ìÅß²Ëo²‹_³‹ß°‹¿g¿°‡×ztœb·rxö1¼_^üæâ§—ß0‡'óu˜kÇÜò|t†uùmvù»ü»ü»ü:ƒ©'¢U9EDº‘¦(ÿ`°!øy(~®±z4emƒ×
hs\¼M&Kò'šáb£¼n–'*FÓhFü<ô5+ŒièC&†(ı jØóä›|»Â2ŒÒ©æ«â§·ùÑX6.š§&·ZOV±‡­V~•Â%} L@9p“#¹4$¢?LY>	D ªF3àÑkhÙ)H G  ƒ¡~bÀ·ˆu›\ÿŒ±k®‚QTÄ¨ƒ$vl0%Ç°èã&b¦¥F‘S(4Œùsúd¾z(C£Ö“ùéb¸,\ØY¥ÁB3N£`È0ùdM&Ş;îöYßDôƒ23íÈ¿¯_/*^ˆkóûÒjâµŒd›×¯ßÆÁ€BÃØWF•(+#UÔ´•˜H¹7ŒO
4‰ÕˆOc•÷$gc¢e5/E¶a7àø ‚ÜèMv4C?íúû‰bÂÉÌÖF­©ı2óv4K?
%ºığMÄhQF'ò‡$:FÆ°>l‡) NŠX?6Gâ®ñ—ùÀŠE	ˆl}­Û˜;õñy¿ŒïØ"¨€ÈúlñĞ=ïw‡@¹°ødx|ŒQØBÂ»€RzpÍ\éX¿4‚C[òò!İ§eáÜµtBNƒ«PQ¤İ`ş›ak›u;!OËÉ¬-˜¸ hà8b#K†Yã#“­z[ÏºÇ
ÁğZTcÔ)í'†§“û<~hõ5ìbç _c‘tòğ #HáƒÛ|¬‹X€J%$˜:Ğ f(`€Ò6§¬3©µ‡å8Nñ–ÛÃuÑÅØCs¬¼Œ±ìòf¾+ÑaÆÉ õñ™¢7£°9¹(×¼šÊâm÷³=HX°kˆ¥9m`Gp[Á©¾ŠH(p
€ßùdò@õÄ&`MY‘ô$—øe¦f l¹ïÎ¼ÙhoR(ó‘AµêƒTßQË²-'šÂªF”Ë¤jÊ$İÚ[Lª‡+
0İS0İƒêOÆ©}Ñãç?Ïze9hx,Î›²x–´Q¡×ëø{øöãµP;ãUh^˜ÃUíRÔM©•Ôm;M²YXb>Ú^ĞbT2›¯™U]¾+&j‰AñJº–Èú«ë¹	Ée;ª¡(Æ£)—†‚¢Ñ*ûÇB;ò.¾—§¶ß'¢»Îò««y3]ãÑ1»;ƒMØ‹#İ¼ño/iıË('~ÊÍ4B ™{]´ÜPğ©4O/ˆ3=ÍÕ(¼ª‰ˆÖæ8ïÜ›Ä*0D
pNºg .’Î-%ïww+ò yU5¯›ÌQË2:âTÁôUƒc°>0MzM?ÓFó$<	ûÁûàáİğ=«ÈéTÉµ]æ"™%”`–x¤†ğ+PÁiaøÎª?—KÎ£îÌ«]AÅ„Dy;<x4¼8ÈªŒØ<rÔ¯JQ[vs^DnšğÖYòÌ`œêLZ‹””ÑuV8‹„åAÚR½kF®’Å<mè|(	-:[‚Hpdp¸ø ‹iM4¥/ÉbÓ©óKØFRº¦¤2ÙÎéMhF‰0dvÏdodFããÃXge =leå¡Ù{ºZSh	tK‹¦j…ÚšĞÒ˜„°ÒÁç8a0e08%l7n¼Éäq–æğ™óù•(™ZjãpÈúçŸ ƒŒ”,´ÎŸ!æ=òÈ)M`µ	‹%Ô¯|&Î?|¬	Ä€·#Û®£R²á%5§¼¼<ÒªfZÿ´~¿¶±_«çK‰Š¯¾óKVûãZ}ck£–?Iœ
ÁëaÂüÊŠìwšÈÁ3’2µÂ©ğ³I(‹@#A•4É)á0lÓO±éN?‹3Y3˜*Xa/-ÄÏ´‚ş#·>œTŸä½-h¥ßd…š&^f“nCyyüaÅñO‹>DœQôRà¹jÊëĞ¶9şÕ­’wİHsg¤ü*I5Œ¨W2"ÈOK8¢ÈO¸‡Š¦ì[‚Ûí
f¢µ)Œ X2-°ïî°ÁbÒšñ–_WOƒá·Ê^[Bã<´Ê/,LgK £²Y¶Ì%ad°’šş›xÚ·¥G”°`óÓjı§Ôô{ìRl’:o	ãÄ©²ãY“b–Êúc6M7…¥	İ¦ÒØNÿÕşãÊY-¦3¸XÒÃ@ıRº¡Â4Û=1kù!™ÇKÍ¿Å²½øœê<ûváÖUwÁ„øÇ2‚¾•D+ÑÆò²mÈO:ú¸õĞ¡TSZñY4ÒŠ}öö&ÊØÄ²‡¶n¾Y!Õ>â!Ë?Õ8î6£ğ}¼»Ğ€+‹1õ[¸Dî¿ı3€œ!Ï´4j,ÅFVàÖxˆ‰dğÓ1¯u W·iÀ³"g]éÉmÓæËğ1IÑ'ºEL•Bî–7©™Ëq[²n:ò½,[ÉI}rÍ4&7Š%İŒÁQÄ×õ²+jıüçM1«!$Mk"%EDÍEäˆ1ŒÇƒw9Ù?Iìç­àÎ±# áÏƒ…Ã„_BXY–ƒ<.Í¿KA §íTbËáG„d×eJL~Aê×…üÓr’@9»´Éşx¢%è6{Ÿ/Š´K–ÆwÈÄİ¦Á ¢$ÓÀû˜ô<Ñ‘écuÀ=`*¥…•[¥›+*>ïÉ“°tMéOÆN÷WxQ§ÔL¸F.,Ç)…)Õ0?›~[pü$à2)`™ÊÁƒ«¬~¯±jıü[ol¿4¬š…D'ósS£D®´ò DÁ‡¥¡¬jq×õEA²‚WGFŠıËÄF4ê’â<§EG/Å?>±J^¢•ú´“èDŸ2zıÙ4ëÕ”oè™sµ#(Î†È¦÷DXIEz~r;ƒ;|ù¼ ÉµzIüO;ZYÔ«k¥î„ø6¾ 5‰£ã‘z§Ëmu¯3¯ó©é{º¸Tz­‚ÿ/Wn%Éë¿‘İ Ö~vLhEJNàDïn3p¨<!/Ğ£^'M]¿îp|£»†->|Õá›^5§‡.úc¼g»HÊ¶ùw"Š…İµĞl%K¶}To»"y`u¥ä“‚O{•?'ÎxşÑoX½¶±·³SÛİ¨ÕSb‹x'éwÙn!Ê4X[óOˆ‘ÊË©¶ów0lEİƒ~»X}'ˆ:÷ıÂ¢Â)NCà•N{1&FÚî­}ëÉA}röRM ;h};úNª48ı»1{X¸Œ ò`£RèTaS‹~Ükt«³a>êvĞ-ÁĞ1ıe 3ùnXIz«ş*ğuëÓíöxOø’’–ÕI-ZÒå!§‘y!0—İŞı~·p#øBQGÊKs›8	á®éçI8Š†óÊCÔ^Ì:˜»Umá†®Ï°æĞ­E»E§–\N¾{œíÍ/¨ºE:lì`»D¬òÙ†Ó
›İ!FfºÚˆŒê0¨ÿñ_ş)*ù6öŞªÕ÷_|tA¯‡
©(ƒGW İŒ½ok»û[å“H qÔ§ªq¼5Zœ0d³%‹HÚìúZ¢k gqİ—*ƒ°œH’”ccæÈ¸L\÷ï?şá‡lcoAnko·1šÔşCVx5YH9ú>äKb Ğ„’¨sÜõ/ú¤¥æ5*ı×lk÷Ş^ã…sÊñØ•†#ëÒQúşXuËŠWù‚#‚Û+LÖÅ¥úß~&­Ó¦9>Ù»ƒÌ÷1ªxH&œyî8})[bğ@´[åA—Â‘#ë“ƒÆ¢ã(ì#-óŞı/Ïÿ3ëŸ?£hÆ;ø
˜Ï=Í˜ú>íW“		¬¨67Ù’d‹C™·3|“ˆ£ÎZªœN!)ş•+ËT+gèõİ1p¢)‡tVÎ±ğpåµ ˜8*·'»hX^Ãg€K9CÑ˜b]Læ–úµbwgğ¸9ÉãZEÆx,ÿêéÑuE´¬—E¯q×,0µ”SVfH›D’ğ±²XZ¸µpUQ@•
2B:’$·:hO»ÓR¾šhT75i÷&ìİx,pEn½ÃÌgØl‡9$ÿİı´ˆı42°ÉÃt`:©gŒs½¾ÍŸR1œò]•cÅàÏ¿µeÄ·±M÷¯¬ŸcƒXéïãK€¹Oí'c“€¥Ügc“qàÍˆDòhšä¢½(›êÅTëÒn!Ö+¦im$¿ù×,mU&×¦í!WÍw/<ê´zfãğ¿RºÛ¿ÅU„ÍÎq›ÖD\·%›ç3ÁßÉ<ÖGˆ°à<rë4%wÓñğ|´4ºL
k8yß8]gï×<KlSÖ–ø¶pRÇ’‚s@EOâ…åe-aZˆçI3ì‹´/Î½¹l^dWŸ¤Tíá¹ñÌ‘M5ã°ï¶(H’ûA'l¿ĞLş_ÇkğMûÁ‘sŠ¼7T¢G“¹Á.®Œn¹·–dê’He>$ïAt`	€ì²Æ¬§Hœ¤„h˜]«Û§L…ÃDlû1Fˆ‹wb'¡UÄ½(D©Z3è!4ZR¿jI”Ì%ŞíÔ1$ÊÓ6£ ¡7j
1˜·÷»0ê›úÙ“¿¬;£±•`‡_Ìä–‰©+ôï´l?gQ©i—x‘|aE‚Rır«á[VbÎ¢ÃUv­‡L78ìılÎĞgÿ%nhÖh9!f¿.#´şƒôÎö+„A7İ¾Ú€÷[O™˜6ÀDfªcAÖË8¥5šzÔ™ošü:“H‚™z.÷‚!îºí,¦\@s\ccjdFÒ1”W“Û”°yŒ”W±2ŞtZX„Q!øs3
‘¤jsÖPyµ¸­ğQØ	û°¥¯è1‹UD
Ç¢‰ÛF	œ{¡Xn¢I¼ô	63¨Å€Y¸Ê¡ÛÈ9ä¸Q	çıÄîè¡kndšåu
÷áVyÖC»Û˜v&^È#õ2$š‘,\`Tªğë5',Ï´õÓ* õ7úî*`Ì8bô3rh†<R…Xí±XÇç±¡Õ'Ì´9HÑJ±„
v·.»cš²[–†efâØØÆ¨{_aÏğ+vï ÎHF»_«cb]n¿†ö|Ï¿ı7üõFõ>J—éµJÄ[=ØÜÚKå‘,‡ÜmÎ5!qåğ´“ãŠaF†ÚO„w[Z4¢8ÿ	†ƒ®=—Gúåé]ãx|$:Ö×®)Xòv¢,6µÏıñ+äÄëÜª[orc|î–ËÙ:ğ©¹d;'A,øX»!òå-É;£ÄI€õó×²ÔÌ~_>eğo¹òyÃüê‘YÂ“Áî<9Œ­gièp·V›åìtÈtû,mæ¿Àöù-Æµ'”Ì>†‹öİ§MÆ/Má÷ Ü^†(E˜õ³éÎYêCfÍ3!T«Ü2'¬"Œ+I‡–|H©ËÉ\â¹RÈË€ğ‹g8„SXAa¾¢E7†Z%Çìª«–¯C\-¼¿hîÉ*[te1ºa’)^Y4OšŒWí±µĞ8%;z7ÃÓÚ26fVá¦mùÍbKš‰	ğ8!kA™É{•f8•êÈã6ıÁJVéæÈ†ÙÍ	ªÀjKRåoîÈ;ş6¹¼¸œ¡íY‰!ãÖ`zƒ•©©-ÀµÃ×heuôV+
ušÜ7ÂèH<o¨	ÅÂQS5¦àx,Ü’¶44•”FÒì…Ø­ÔËÔ½w'ß¦ğ+»ÎÆdınâu¡ ƒÛ 2fÊ"|ÆÑê ¤ÎpyÔpuĞŸÿà¿Ó?ÿÁÿÌ¥,lšÑâb!óy°¯ìÆA:Íúˆ)5zuø°c6	ôCCy)^Zà\¢jÔ`‚4˜P[ñHˆÖğÑ9Ÿf<‘1\!³ı©Ñg†‡‘ÒôÅ˜æ*]1¯cL¤·BğfÓ(vm%‰€›t9Ú«áÓ–ˆ‚¶¶ÄÈp¤÷Îy	Š¦{ùáO!ö7OìOò0‹ç'Š$_o0õf’*Ş8| ¤¤÷Â”ú—Iún/un™“]ŞtîªjC:K—ƒz""4=sZ¦˜˜¡EMrù× «bª«é2ëò0t¬25Ùç„šVo2a‚P¯3Áçßıè•Ë€TUUâi<åVË—lÊUÍY*ñ<¬Å¢ÿ”¹Ú=ëåc[•;²H™üìÄ87(Nwc¿ZßŸØ­ÿÄšIqjİ#‹G4EZ ±ªU—ì·š¤ÿåI˜ædÉ3‘ºì¢)ëøß°NYÆ©"CËoÿÍ€JÉâ(×ZK±s2¤¸"ÇÌJâ«ğ`^º±»é “K=6\1ƒÿ¹foÈßs½ÓL[X*µIsVc~ÃË‹ÅœCÖv;]Êºë^_´w•ò²¸ºüŞì/ÿ<-’¿tmwóÅNS­Óú”Ï‘¼”³¤šú% 1§<I˜.ëÿ?G/ÿÄ]	Tö5ûr„'Ó2yÃ"Xüğ»â¥oÆHó©}ÜÌ`Cÿ—©zĞ{0S?|Ÿ —kzÉ«0ƒ0Áç£?)cò„xU¥áÄÇÜ2£“ ü[„aÒ¬3w4èÌõúÔyj±s&¥}ï_Y£zğVíj}³Vg×YíïïÕQ¾ÿÅÆŞî4–£ÔE|´ÛV¤NçoíníoU··I?	c	²Òb3lmŞ¦¢İC×~6û¸‹:ù>¦kã‘´?£`„0´ºîğ8;jwbO7°G]u Pkø¤Ì€US(‹Œ›wßÙ­îÔ€‰Î	­ÌİÖEŞ‚­€"ò&Bª1|”ë›´¢õĞÖæİ‚åà€„î÷»§Q
ı0ÆôÊ_M(rûá{(PcÅÆ
b¤%1	ñ½r·3ì=ê-8³a‹œ[…„@ù2í'ÙôpÏıÆ ãeÑ4PQlıı€$ñQ+§4“¼íxØl†q,[…Æ
NËVñ°ß`J•	ó+àzÎ•pXAü´Ódj½b8
jí¡BÓTÜ·P«}†.XÆºŞuY·°uT¦{? ~åäPï}ÖĞ‚Ïfğ¤Üu—ªXÆå88]¦Óìö€@
Ç³€\kIàÍ„iwƒ–†ÆÚn|)|úé,Köºt;í§9K[ÍÔ¿D Õv»Cz‰*D¢_!QµD¤T1ceı†³ Ö
q»4°aÈÖßGXãã,(ò—m6bß‰:QUìHÃü~æ×Éº	ÔŞ:ó(ŒXÜo–TL›æ
1®ú°İ¶m…úá1ã>õğX›OØfA¦IeDy1Ì
Àğ¬H£û<%†Q¡bn…7'îÇhçäT›E	³4*éI“’¢“ùÌ47‘G:’/0zjøŞ0Œ*;Ô½>"ìÏæZØ@¹Ã¸fÃvnˆ$­õÜzJv7¦µK­=Ğh–á
Ë–“™8$íiäæ"‰ÑÛNƒv¿¢i¾ĞRíøC6ğe,ğäVJˆÍŒ§8£X„:§HôÇí.&íš_©18H×f¾ú¼‚,hqÙÕb)WÉyü adF1Õø„U>:…âmÙ<¾Ã€;3l|…;‹èıÕ5wX3É]A',àß]äQwÑày×Ma/ B3|ÈÁŒ:¬†OÇ© DK“Zúc6G½–Qk_„YÑâl‹ì4G€3Œ…$oà&Ûz“AÎİRV‚ô6ØäT.9˜1ÅX@0’’¨ç°\˜¸÷xŒ¸pmÿÑL÷"[;á h‘a«òóÚ´QÂzV†§Y‚í¬Í6jhÂe9±_í¬DT±Ü“.­!4{/q”ãñÚé*+:]eÅYe[+â„; ˜ÊÚ3Å”qô”lÜ‰T”â¥c„åã.B!ÊTm/´9šıÂòTmPÈ¢e…Ëò°YÒ€dŒ)p¥‰‰ì›VÀI+¬±ÚND3¦ Päß[h«íS´hzYû¼è[ni¼¶š;‰ZÀQ™f=9™ŞÖ9ZuU:8°B ĞE­ÜÈöÇŠÎÊá#¼5_X¨TÆŸ³•jZÜ˜SÔ+/Äd¹¬qŞÃá§Ë€oM³gÃˆªYà¢*ÀÇv‡VZš7¾3/€€*"&Ö"-_ÎPl yçì’ŠuiYk.@ÉıĞo 5XşÚô*¾ô‚=[Ÿ¤e™D-ö¹/ÒÉà÷l²†@¥±8Œ`_å…óÇÖ7‡Üìş€?ÌnJ‹Ö%İœM6ÏL7‹e¶hgšºûÆCA’Öª.×Âyñ’éoÜÛ»]Œ·Ÿ¤Àq­æÒ$Û2æ©3Ô¥Ï†éBnKıÚ‘DOW0Á¼øÒ!àY;gğëŠSğØy™$8=<‰äŒ x§]0@/ºSí¤h§Ú^u2*œ²#0¯Sxyü‡GTèä3»^&¤eÜm¢Ú©"e£¦ß*fpŸ*çÖï>ºË½ƒ%Fü]±Fê‹H‘”o)“÷pH$eÄ©°7	Ñ‡0íVÔîNeİ`-óxÏ#Å³J4O‚äq†‘Iğ(zgê$Š/S!Ør%‡ä¶­•ñ£àì2	O‡{ËfŞˆ’ôöüØ›´ÌÂ«+lS`+ñ‡ÁŞ	, Æ^öní¾P“gC2y| à¨Y;ã„™\—Í`Ò ø8‰2ö3˜4~GÜ#h÷ÏÒG`,TÅ»¸cxın;5=Š³³>Šo«O¡§˜Í4éÛaU]²ŞH‚ë\)É£·RòğœvH)ÃEˆÑ¬ë "‹àƒû-s«àËEO ÕÎßnäVm¯’ËÂ¨=Åš¦±¥>®t6¾Ô³;òNÌØ‡Å[roeíCªeÚ½±9/ke²ÿŸòª>ÿî¯=ëgqf'˜Œh_ÊĞ3xAèR8ª±ÆÖÎÁö~u÷üãšm*ääÓŒ¨	ÙZ ¿§;Åøy)•OŸÜ²M>§],w«Å26†‚Ñ|çoØÎŞVÒvj$.ô‚à°+d™óÙùü#»™töHˆİ¦¾Šãyõc“wgp¶!±yÈTı¿jï˜»{÷ı°zí^ÆŞqvW²¥–ñØKŞ9ìInïoæ}ÛêÀ“¨5Ú³Ş¡;¸bí «b´)šìšcTL‚Áµœ<(9ÓËß¢;¬ö¤•joÑŞ”ö/o¡¥×cÃ£9ÔÇÂmİù]dãœ ?²ë	[ÚíG¢NĞ®ª˜¤mTõÆNPÊxä[TÜŠÕW}+ZbiÁPâL üiéK˜‰™D±*F•¶ôï„„)!”
ÛA/yDÖÿ~ÈÌOš )|¨Ë-QWı<LVt…gM.ªU7ä¯C_§nİÓ¨ùFu¨æÿ:à¥r…G™N{íè8jr…4Ñïê­âØ$WªÀ½æû¼HF)2ÃFÆŞ––UŠ^SZ)†+åÁIØ)X0à˜ ÙCC7RÏdLT3}à”®³{ô¦BºQ8&±T r¶û4Ñ#ìœ³½,:u™tF\ºæècö9,“,ò0)Õ×u
vÁMWÌÕÅTñ’¢ÅÈÃ>«vZınÔ*qv¤ÏÚ!1#ğíÍım< =µà!fÚëcZ 1”%ş¸¡ ¥ß:-Š†Ql²Õx§º»YßÛÚD­;uk#ˆõ¤|‹"Ç…½Taadª_¼ƒlĞD3)±Šg?q	ú2Öv9ø„;ÄáQM˜ğj´±	–;İ3İ—VLi!30G¡¢Êób´Šm ¹ñ8h”ÚTÖÔ]²9ï°Š%¶¨€K®[!ì÷µ 
—®Û¹íN!÷ÀÂè‡
NVs%†õÔ*µCXšÜÜLqÁv·òA³yş/­`È7¿w‚^¿ÀWa&Ş3 ‡
ÀØXŠ ¹«4ĞlÂÉë«qLK?Í…7k&h­F¿­¬±¼§‡3	€¥İ6 û´ªeÚú(y`Ku¡XÈàÏWá[Ì0_ìA}›µ#¾´€é®`o‡GoEá™nÏFÄ»µCÔÖÄæAE;ÕUjŸ…Gòà-J/ÔÑ±:µÇ!bMœÆm*­^ôËø³ ,Z˜<*ÆÍØ\ªûË1PvB^µ8Â2NêÿÍó”Ü·­š˜EÅs•¼1\÷K£¹¬’©V+ÀåÑİjì	LZ,©± oÛi¸ÿ´¥iè.Á×Wª‘X#iajƒ‡i©µL¹Æ$a¼•-¢mÂwÅcNGÎ>åî¹äâ±ÍPØŠÃ)²Ñê³¨Óê•ñGıÓB®1ì¡e:€:f9;ığQú$ldë¹¢­üá+ã1 TgÛXaÆ)Œ:Ÿà¯'˜Pƒ^CC5¡I/@µ½€Fø",¯È-f–Wd—.n®šXJáÆ®ÅR³üÎ/‚ÓÖ¿ œUË€~ctŞlÁ¬˜eGdïC•9Lw”3Å¿x¯±¸!Ò¬ØèšAÛ^şWâ‘KVT¢[%%Ç”Õ•ÜËhIWZ¾‰¤hä¿²7ª[»IşÚr‹ê£÷Sı[×r9ŒD´–»•ƒ†½µ\¥¼¬¦`{‡îS$’Ôwa—¸™‚ã2å¸–¨Uà¦(p¿Â²n¸b”éÛND)køZŠÈ(cÍ”,S;ôæú(ÕÄ]S3>ÿa¦( fe‰o²’ín\p3	ïÑ CÎ[2×ÏßF€¬@úJ`kW“Æª"odGäœŸVw`ÉÌfå_g¯ßá[àÔ'r%G¼Ë
‚T’ªt§Z¯Ÿ›oåk»õÚ[ızm§¶+İ‰_w¢ArÙ….Zg;UtÅÙØÚ¯bT.•R[ºH	­ÜÍBË0%tKÇ³iáòm˜„M“<ØµÒê²EÂK|uØvÜ[İq‚^oø4|ŸÈ šºC°PTĞÑ)k†ıé”ü}€ ˜ˆ1¹L"¶O!n°™œu@ıÁŞ«´è_£dÖñÄÀÆÌ†ïĞ1Ój®‘s’-x\ÚF˜ \·pßîDvŒG[W%æ·"c‰È{Ípí‹¯27ëŠ@Âo[
Íb_Ç¾Z)±EŒLçTiìîNWVîSË¿‘X4™ŞeŠ:L)GÒøô4Á©u;Ç]oouRL©»©h^\,Š´/Åèñ± sÇı¹{õúnµÈ"vØ+jb”A Ø“Õ\|Òí£WóS`ÉÌ×'päVs‹s­èQ„ïáê©­x]-i:2a{g:41*MHĞíÅôÌÚ³oB ’§¤Œ.ËY2e’Y/Lj^Ÿ˜uî9²*`>eé±`Õ”ñı<4C³pq¸Èò’
:VóF”©_©x‘)QH²Ñ_Îjê\ã™—OWô®tÍ÷ip&­Şóoş9ÛØÛ¹_…Kúw³H&W˜nE¼«@^ØÎ"(Ïìç?úë¬‰dçCO<—,Åxm@$š{U6š/#¦,E4gìï^‚Daæœ§sø7m0²¬78ÌÒ¶º)Ï¹–imäjP¼ñ{èYcËé}le§³I!ë™GAå$bøk£®¢À‚	Q„WÆíÌØYQ}›q‘×5Å·y(}$|1ÌÛeH÷í˜aŠ.Ëô½]l¯ÊË4ì‡]v¢ÿ» –…nŸµúQÃµºg6è
:ş<ÛEÄ,gf*k›½Ú3êä:E„­eãÃÉ L§¾—£…<Ë+OÙ»İn;:è”õàĞÒºáR„­ƒŞ~WèİôÔ¼ÕC¸4ËJ¯4·ÀÕJärÎºÇ°Ø€ÉVhXºq\9•ûoGü0U]NãÒÚç^91Ã<<´¸}[¯$”poSH`ãŞÅ‹èĞØ¶Ø5ÚÌ9ÜJİª°&RŞ×¿}#6Zå+"¤šmıÿáìêrÛ¸ğ»O±}¢TGª$'®aG\ÔXN!»íCÙZU‹¨Rê•%†à´O=A¯á›ä$.9$g%£F€HÚÙáßpfÈ!¿Ù‰‚mÉD‹£å^.>ãuâ„ÒFôøL)H/®{a‰Tâåù²Í¨L<T”­§0Ê[^À‹şr÷¯¬Jr%s¾à²3.öÀÌ¡àÏMò•üùP|şqTæÕ3ÂŸÌú¤ƒ îUr'òi<ØOfr'Áí¸"‰Æ­G2[wX% ÷›’»” ŞlÆrïBï£DdËinO[–ùï´tEtp†©¾Åoøà:·h[(ıŒn3Ça^.f+u!'Öø¾)o³l±œZ5TÀ:x\€ü˜AÃŠ¥±Àáo¶ƒ±.i”}™ïN[œ†w°©Ç´Œ®ş=‰ èiåFûW[®­ ‹Äú.ÿšÇ2©Õ»öGÕÍIè–A¥éRòí^*¿ásDD†ígõ¨ÃAQôÀ®ª_ÄŸvX½ú±ó‰Ca[óùh2G%‹ÉZY÷“Ä %ÿ68;´õ]5,ıæqñ
-ãÀ ’d‘sS_·$(àŞˆVş"İÀÉ<>./Ç(kì\¡ÅÜÏØ$'Yû×uEÄ9hí·ÔF›â`P6£=‹äİàfEõç+¡lB®Ö|ª]
©:Jù/|ç1<èàªWÅr]ÄÀfåéø®á¯ñbÙ v* ò…0ı	¨¬	Ú½Ñ|ã}cµÏ1Njê 3äLËüŞšĞHåì$rœÌpÏ¸¨ĞªÎ¹€’­ÚøOH&»„˜ã…ÎŠ	EÎj&D…ÛÀ hSœ;‚/oû\"|ŞİõBA)=¶	e8ìÂ
ô£TGÿ—óã2)#Cãì¾zœ¥¶©—.üöÓ99Êhm&ÅM¥“ñØf+@ŞL§	Î Q¸à‚§¿Œ–¦Lß™;É$(DÒ¾îy*”à`Ûğ”É® Â!ò¶“2K .ƒ7ÿDámîm[T¼ígÒ»ÿ|ÎÙÜ¾ƒô|+üÑ]>Yay¯¸YBw7ƒk“À‚%¢'úÎQafÕÒ'Å%M°¸Ğ²™aÏØ…×*âW½å©A\Lqi“0ı!y»+¦‹ö¼{+æH<ë…{ğô…ˆ	ƒf&Æ7|vÔXĞ„×>Ú`ğ^NÖİÿrgjàª¢ Ss"z	(hsVÿŒs­†˜28¥Ó3w¿8~áÅ\<µ–‹§(«`RDLCúõÂ;q¿Šh¯áxI°á¶®òå:Ïç&
[ÔAÒKş>Tdd$æm©–˜¸JhóËy†°üÃç§_ŸŸÎŸ8}ÍÙI68Ár›ádÑ¹8åyÿÍŠ/"*KÄ’P³st|HwE&³1ôß^éÏD£:XW&	Xlé<'ã¯-0ˆ‰.ùï;˜co›(ÔÅˆ%>€¡Ìª½ÒÔç2–c”&2~Ó4„óìò²¤4¢1âŞK\œûéÊ%€oÇŸ4ĞaUŒLŒu‘8øg±(7ğê!³@L£üÀ~ıç¯ìòd88=gA”§RZp>ütúşÔJ¬Šß—ßÙ”F»ÀTí¤5¬ÜuÇñEs³œ™ACwE‹/½v€îÕ†×Á=›%Â¨ğ'&º?‹q×Á¬ +ış£`¬YŠßnÀ,<'cMÄAªÔ\µ¥
Ä—[ƒ‚SÈTZ„Ô™dúÖşˆXlyBpt,¡÷mTB»óHn0oÄ´‹ùõìvœ—*=®-/¦¬Ú®õ4¯uSâjû£¯l„¤ÔÕ5;—Bb1Ç'HËªËFvš«„‹A¾<¾jŠíl¡º2t‡°VñšÏŞæå€æ¡w*\RXûÌî½3uuobÕ#Ö±wVDkF®ï¹€ö‹we™äWG1—GÆ«a7Wc](L¥î’ôc>P‘¦ı´¶SqL“:ÅõGk‹/§ù"IŒg³‡ã‘fåneúP½ZXmƒÛŞZ2„Eík|Ÿ÷½w˜dà	Îi%5{áj¶¸ş,ÕeÓé¤Ö<aµU_ÈenVY¯“²²&©VÑxÛçoÕ]3¡Yì6©g7Øpü“nC\^­ï * İJ6º±ïìÙ)¾oju³>×+ñ4\ŸÔuImEöÑëÀg¥â›huò98¸Vè.îé6WiÏİÅt4^¬3ßÇ`‰›’¾Ş‹»: ”]¾g»œæ@Zlê;¾‰Göš¸EkdõõïùŸ©ËlBO½hé‚êaï¥ÙïìíÉÈ×FW[¸;İ´µL«Kô‘–s‡&“Æy`ÖøµyP¼OJˆ%«Úè5u…Så¼…Ÿåíò?   ÿÿì½ks×u(ú¿¢9¦ÏÌˆƒÁàERC(J8Az XñE±1Ó Zœ—ºg ÑR~È²åsÊrì§nJU‰s|#Sç8¶ã8R·òáâO Wßøîù	w­µßîT”S•±ÎtïçÚk¯½^{­ağ0éÂRQ–<BPäø³Äf>ıã6gUt<¼N¢š/~ea¯uk¡˜Ë‰‹bÉ>™IxN</Ù#"ı×¢ofYğ÷Øïİ‚î³¼Hó‹¿FÇ‡0^`éàÔ‚¢N¸¢¯A1#2—uE#ã‡úJZSÄ¿-à8æ?Mñ¶],Å˜"ğ˜q¡Å¢]xÙt‘•†LÖËI¸·¸µ¦ì”æì­Îß»®‡©#M$CÌ›x'ï[RØ1„¢¯ÎTfkµÊì<?¼®}Dè•féè–ƒÖæä˜¯wƒé+9dN×Çˆ­fï¬\}qÀ<HYìÛ\¸Vèbu<&îT ãÒraÂØÉRVj¹¼zf
;¡%’ùë¼ÙiµTlå…„ù,Ûì¬²ZÆ&J¹‚Ëi€ØGçÈfâÌ²P/ƒ·YğÓ`oTŞºNÌ=§ã¬«£ëÊNO3êä…D}ƒ¿Ñ';†¿ñp83³i‘%'óhjØÇ–Âì”#~}¤Wï˜)cùÔú¦÷ 1¹üºÉÙg,s-}‹áÓûzP5—à8ZôŒû,÷ÍûnÚ¸I`4£kÉÔ¦t`‚½0ÉÑ¦MÈŞÊ‰ë	Ok…muÎs/¢¡BÑ™½'_G/#¬•„ŞcZ·í”eLY>(~–d©‚iÈT#ó¨ks©u³VÆ$ke.9ØF-d£ñìµ€Èéô‰“Óq¡ˆVÆ„Bq°ÅEŒ“«Òü¶d2/6PæKÿE3‰UJ#ëò'æª‰í¥vdqÁ5ìïïón9çY.?1–}G÷ôÍíµ¯/olQVf†ë§¨6çßïÌ,7‹uÛdSÒe›°8ğ|*î‰çj`%Ğ’¨WCŞ¬ÅbÔì§äh\“Mº4¿_;0““6'sQF0´pb¬-&CïáRsÀ¡6©h6ç_şgü‹»zÚ>±äÛŒ²Üédì“ Èƒd,PÜËv/¼¶loy¶ƒ'»™å9.ı˜×Ap%YNÌÊm9Nï‡qï¡ˆ­<ı*<Îã–ñd›.ÅoY¥Za‡<œÌğBÂ6;€5ØœÂºÃ¦±î1—SùÓ‡§€7ÿ¢^¹ßŠ_Á{ââjA5,sŒWxŠö+/u
¨ÜhÇÃ>`½)æç‰‰ Ìë¦A_ârÂNà2-¨õ(«J˜B®
ØFìkJ7Èâı'zù2w%RŒÀ9¨CbàÓû³"Şb Š‰Ò<8ñ˜)BGpª£ÇRUšæ³'là£´XcÊtxğè§n4¦Ç£êÓÃÀ²ye†	÷;9–µK7õxÔz|!•¸¡ã0RoLÀi¯¸lliQzØÙÜ(=ºt„’±ZÄ{+b³\c¢5†WL3$†U	xJ:}Aö)™¿¸¿…Ğaí6³-î{Ğ şEÇ6Ø¤Û£2ˆwµßÃ  Øâ ÇbÓ:}‹EGVn<=(’ˆÌƒåƒ¸wbt‡Ã@Ñ'úÒ-§[pp”ö,ùgŒ8S:ÄQMïüÉ¨vcşîş³pÿŞ¬íNW‡0ºRëĞØÆZ‚X»È»*+Áğèdğù_Ññ·‡vĞJ6}Áze‰Š¦û6Ö®J="óß–%™Ku¼»CCÈC2àuÍ}6“ÅE–æVßdèDú6Iz²Ïñ!bNéíàµÀpÚê¡A·ÄÆğ6Y™h›xBîØÖ˜ÔÛˆœªwo_¿®Ûºqà¾î¯æõŸÛ»µÙ-È°TÚ:lí´;kÅj¶O¢rJ¤Ê;<AŞŞšÒë2 Ü¡hCã`«@Çíèÿ¶ÃËYZ50›ŞŠ›ï]o¾´Lòj3:'LW†¥#îµäœ,KÆ™±´„C~E\—Ÿ`İVI¹¿„a±lÕjPŠv…GÑr¯İxwĞO†Ö‘ë²š%ÆH•uJÏ#e!±Çëœ¥‹\	ŞùJ0[ŞÅÛõC
-Uƒ¶8ıvÚG]ŒÑ6*Ëˆ¤E7iòê·F]:ò©Bƒx/Ã"/V–Ñ%î(¬â6~=R|Ú[È®¿åÃYÅ‘>‘÷®8H ÌıÇÚ )–˜ñ!p$ã,B g«îµò;ÁƒˆÀëÚƒ|¾—ª®löºñÈ¨^sª®Êx`¢¦xâT´	Ş¬Îƒ˜ÃùXü¨Ñr9yMˆœ!ò6B¬ĞdPQÎ&™@rx%fÖ öÕ“úÅåQíŒ~Ş¹]ö0Õ:T“htŞMc_g%ô]@ºj,öËÊ'ØÒÒz3ÎT‚‰ÒŠ›ÇÔ/RG¯%c*z¨Q7_H7µ`ƒÑKùS¨Õkµ‚>‘‰ã˜æ¤¡œ#ş”#Fv‚™97y¤¹¹a4Ö*ŠŒ’ †ÿQìò/Ñ=p.Œ™'$’øàAc9+`Ko³Á¿éÍÚ­ÿ~E¸+—J|™œç¾Ô4¾¨Sß
÷&2ÀˆÆ)¸©RßÙÚš
‹å-Ã›ìVv„ö¦â„Ş*ìî2ƒóNÜ®P(ğİòâŸª‘yI¶+±¡TÂ°‡FâlÓÆ¬BkA&œ™ÜB¦Ûx•ºØü˜b¾¸~w;#3%µèóÇ÷4­GXÁíä}~güÜ†fõ–Dˆ1Ïà3¸–¯QOÄ,¸©Ñˆ`ÒÑ‘f9æ¨a“%•ƒÜÁ™dSØŞ”í‡tVä’çH8kg1®ù¸ÑÉ&½è“ílò\ì³üå­ÀÇ«šƒòøŒh!3<pÙVw¥y-Ñ)z5ÍsíÈñ¬ÑvîwºÌÎ%tÖv¯ÁX{6î¸}Kíy|3T»KÆuÓmz\3ø®5Çv™«FÅ7í¼gÓZ5p‡š=*ƒ?öÕµ­Æv“…²úø£`kí~cskùşÃM_6 ü˜Ù5œÈEdØ…MÒïŠ(é9{.‹øº©¾Ædfvr9ÏÔüg,²"?.wÒZdÏÜ?*¡XrØòHv¤¤ŒK•íHØÜÛÈ´,pNëT]™Ôå#2±Y·±Ì„Ô†XçS8è¹Ã^!×mY3¦,°[V|Y¾.#»õüDÕÎrdø£hX˜‘şØêv‚$Èn*q_òc«]OŞc_~d£–çEæv2û¸\¶dö—3Ù—O¨ÆåRv©Ö´íìÆH3œH’ş±™Ÿ#£ü¬Ò"Û4IÚhIÒ±NÎ‘(S×*w/azîi§«†üçİ;[Ük!³ÙKg|v~•GeÎ>ü²›™µÛñÍçÿÏıryÜİÎŒ¼Üc™aüClÍ1#ÇÁ˜hë¢Ö¤÷ÅŸƒt3Æ;` ÔW¦Ú ¸¼ií¹Ô6dDãóLÇìlèó,bôÀ°MÊ$€j<<Í\Íçm¡C`T—6VeÜ‰0B¥£-´`˜òÁp±@ªá‚]YU=!ŒsÌÓÏ¤—pü<´§Å`75ëœgóˆåm<ÙãaDkó¦°üËøöXÌ¬["¯MÓ9ÎÂÎb›k±onú#À:ğ$wª¿ú9ÑxŒåg†C#Æz›¸©3åx­„”ÿ<¦—‹§¯±’,r#+»xÂş=ñóîÃ#s—f dtÔ/tºÁlñDÿuªÙ¬äøî²›á@Ú°%!cÚDï:İUûR®3v7šƒÖÊ§Ra¨óÖÆ–Ê	ı™¥›àú.K7aäÑ:@Ñ{‘pÃ™;{-ªÔnÚ[;Ì©_0rCi”E¦µÉôÄ1İè']8a—‡Èo“îE±`ã1¯Óè¦8¼Ía4fàœõ (Îh¼êôaØıfˆô)1CóİÆ½ÍF€È2àÛb+Apñ[ŠZØ	ÈWc¦LÁ—ÒAÔÂP[tû0	ŞÄ(JÇ…,mGC´j`¤4HD÷†0ä°®ÔÜùÎÿ¯àüoƒóŸç¿ÎÿÚ;ÿ$J8Ä!™ÛXˆyÜ£1()º’tÑ=FZ–³œ¥ü0`¦‡£ƒ–†¨C‚/°Ib)UN„=¶dßŒØŠ• :S›“Å‚~	“™+øxAØ —?XgwáÈ"Áİ—”6-øĞ·	#–××½ë¡ÁşüªVM"xØŠJÌƒçæş£¿ôw–şÎÓß»Ó• @ßoÊ¢ã{@âàÑağùJøve…!ß8øêâ‡ìÕürÙê™U-Ï/«–ß€Š¯÷#?ÿ6oxÍ]øxµ¶/ºQü¿ÿÊŞŞm°nñıÅ÷y7íşvXC¬‚šÑ¼6£-hà~˜ òş¿ËûŸc=èÎŸ²w³¯zg6§`öªêãÙjxp€ó:€ tñ1ıw‡jbÄ^üw3 O7|itp=h«ñ—å–çÄ§í››Bó¯21/né ÂşYÑ2^ˆîö"®\¿2_*/³G	Õ*x“µÇo–Z#(:ÔjäºvïŞnÙteÛ½Î
Ü¬í–i€×f®Íì….íü)8ü­ÍBQ1N^Å˜•9{>o3–u@_|$#Z\°•.x’Ä—Ÿm¼+RZZ´áâİ Â‚³uÏ\ÙÙ›Ş•İÇãgÆbGî‡ÃÃ0ÀKÇaïCBÂoQ¥¨zP…}ñÑù¯/şôù_ƒóÏ.~tñ>ü÷¡w{Ï7Ø*îòéüIúŞµ²6Œk3Îbøê]›däÃ4	§Ûa·Ò€‘Ò±ûâÇPj¿üĞÛİBú¹çæürÖ0­z×¼kƒ/ÅãT.í…ITc28êc`ñœ¥›fyPâx¼I'8EÛª¸-é²* pØëõ‡<‡,ğéóS?Ñ3ğã½v˜´%ßÀO±§Ë@¸`ÑãvÈßÔüÈP3IµQÅØ¨)øJ0S'†j†m›™e_³òå$Î²WoPÆª¯Aù2«ÁÆ»C3í1/lõÖMÉ­{÷0*g«S¥‡÷øÃù ? ¢É¶ã4áKê“jÅîŸşñŞP/ñ=àĞRŠò‰yå€µ;Lú£ƒCœå½»ØÒ½Õ{÷*ø³AßkÜ»çöª•5JCĞğ4½N/ñ²[òğü›œ³åqÜ‰éıww"+„Çßt.o ,0ƒ6l<hŞ_^_Ûl¬ò°ŒRYìq¹JŒAß7£!ÆİG_SŒ9Â_)–Û‚ SJé~hÔF")€&$'µ¡Alñ~8Àv˜N3€;©Ç=¬™ê†í1%ôî	Y«RA·|…y¸l®­76¶ŞzóAsõ­ûË1GçB­óO.Ş‡]ÜëzZøYìW8*â4`Œ/	7$Ô°)nı UŒZá¸x°b‘X Ó¥2T;8ˆz˜ªˆÖà*:ıãà(¹¤¤!ü?	©D«ÂùoàDún¡† ÏÒÎÌn¹Â¶¼éãØa0Aá›!ÌüqZø5Lìç¿¦6d³N?°šh‡áñ¨Íšø5ñ»±MPáOÎwñ=kÄ5YVƒ$,øù//~Årñ½‹_Acç¼¡Ê­p‡£Ê˜zFã/iƒpüÆ}ÁF6ì#+ˆâ,!…>ËTkIçø,fS®3™·H,KD\€øØYJei¶ó	QKí£ì#ØIpşu¢2o˜ŞÂG¬…9h€“èSàÈàIãF£\|Õ o‰˜ŞÒYK<ÖXP¢àÊGQ²G{+Å )œ D[Õ²’¢á› …¯#JĞó›,şK€ømœªÎ?™¾ø-B2î¥J
å¥Ã+ÒÕ¹ßÆÍÛQ´øOw`ˆ¿İ®EæeÌ‰i5tĞ]¼ûBØT?2 Hi¸„?ı§ïcë?¾ğ£‹‹(8ŠÈ†ï/Ş×ŸJ} _L}<¨0Wç(Qœ°²hÖ³e¹@ly`uhq˜4	Õ´†$L`WbšK1ê†O`‡¥,ÃÉ$¨şfØyÌÈ3Ğ/ú7}ìèwpQ Nm-v«ÉC*ÂúêÚòJsmkmeÆ3½sñ_¦.şúüÇSçõùÏ¦>ÿøó¿úüŸòù/?ÿtêó_íN#Xğ’keöúğ‘c¡-½FqÒåš³{%F¼tRÄ¨ÎÙRxÄ»° Z×¯+7`£ëÅÅ`NùCdV0Ü=–ÃøòJ8ÒÓY°#‚0êbÌ—Œ·%®r7v´û:æÔPá™5™·wËö}õŠİŠ¹ø¨¨Ñºzñ‘¬ö¶€rÂÜK¢ğ1÷®¼Âş(;(+¶=n¢
JÏÅ©„`{ƒ×ëAÍ¨®‘;Á<Ewš6(§uœb>l>Øx°½±Ì©NJ+µÆøˆğ,÷BEëİÀ‘¸É¨Ey$i®öqzG)r¶hmPÖpáÃ+	
úNÜŠù´ºá€“
‹³ØãÛ•’YÂè‰„vô•€(
*€Âµ ¨±*¬M<La6=–/Èg„é¸ÕTîÀDDçu¦Œ:Yc(0òe<ˆgõŠƒÈ£c£#x‘ß“pXÌÛ	Ûm~ùáôŠ…ztØ¹Tú[?Õ84<6`¸­q0©è“‚±ûñ³*‰¿TÁÜ˜ŸçD^,Z9kRÜÅ7á¬•´9XÒÁS—ÆØ½6QZ‡œ/î‹Ù›Ú¥7€bk`œG0şw8¦¾MĞ¼ø6°h¿½øÎùSZÕaÆÎéò]Ùdû ×Ge–×ß\şÆ&ïLÀ†€r‹Ëñ>Øˆ*rİ¬gİíR,u Ÿ‚P¦SqW´B›Z«›LQR3 ÒûûtĞ£Jš­ê—Ë Â§/`Eñ«à~RXúşãâ{Å(Iào7NSø‡Í±xš?ÃuøÛK‡)İE–¦/gnØ=l¬A(ìœ$Ñş
Mò ?d_úƒÓ]¬ÑÀŒÉ(ÓÑılıÛ:EsÖ\Ê—†` ß»ñğÉ—°œã²‚¼p- XÚmŒkRz^ƒçÀ)wÕé ânØå”lÔarx¨PøÃ êÃ4N§úq‹±aûûÀ¯•µ&oàÅPÖ}X“{	:d´€59è'Oêtí8óı„ÌMG|?‡¸¹Ógßú;Õà}Ô#8ÊÒQâ'>–Áb¯'ıÑ€19¤è†“ğm8Çi”I—Æû!Fvê›á¦3£å$ŒÁÏùï}ğç¿‡/ÿ€_ş¾ü¿ü|ù¿ü
!c `d¸­52$¼øW_¾‹_¾_¾U)øŞÀ|PàpÃp^ÀÏ?ÃŠÿ_~…_şšú>~ù<ù9~ùÌÎf¼wÈ&Û )ı£˜ÒïàËïù”Ìá°ÖÑà	c˜î…)ÊÅû8àË÷øıÃ*/°Ê¤Ğ—æ8êıìëçâËg¾Êó\òğ8	ßz¸¼ÖÜäŒÑı"H–èóC t)¬{èº‘òCZÍj
ÌšmDÛ÷{ğ>”ï‰ÄId€a¢ÑT$0dæÆ7Å0Ü|wå^ SImª+b Åóß+Åóß+¸D˜ëP½ù|óÏ™oş‰½Y€ª7¿ÖŞ˜u>Å7Po´W¿1:¢í#1mˆZ˜<é`JO­£Ï°Î¿ø:ú¾ù{_GßÇW¿òû)¼Á×ğfÆxñ	VùŒ^Ì³±I¶ø¢”ªß©7Ú«ß+X‰¦‘ ©f/¾‹£ú¯Ù_â›o³7@ÿZ6k¶Æƒu°Ã¶‡¦ƒNüÎ(në}{ø€J›\¼o½±^ÿÖèb3êÆLq­5ş,÷K_ã?Ä7?7ZX»AzvÓøÉ“°º»0MátCÚ‹·AÖNû0‘úLÆ¥E!ùI Óî•–ÿÁaÃqî·øG¬- ZBVBKœìndìFØ:,µ(Ó>ã Åp­ÌÔq›ÆXJ½3ŞáaÔ%u°—RÏú`}¹ùÆPmHúBºÀ;_-
ã#é2
}<ÊˆR)÷Œ¸æ=)Õ4FVÆı3‚Ñ|(ø"2=ôi&QzØï`,RÊ/öá/˜üOjaâî‚"®QµXCQû#NÃe£`Ùz£ÙØ|ãÁú*Ê©Õ}.Åá±ĞÂœ¯J%c•ê‚m“.>²œ…®¯ÃCQXhLdö Ş.#cZÅÄ¥“€•¨C[×8­¥·@¦F§1bÖ½e_×Ë°„o	1Ä8ˆòW‚Ê€rù
b)Õ;¨·š¹ÿ¼¶4á_¥Ò‘EX‘,ò:ü«gÉãap5ĞØI¦fvĞvà§¼}Úì$»;t{_^é•
|	…ñu@¹ÔŒ7»Ô’ïÕÁw×iTÂ-ÌÔ«ˆäeŒy^äÁ 8ššòëøŒ«ˆoü€¤xMéÅŞ€¤e¼y1Àˆ4v!Ã3)«pmÌ,AÒa§¼‘Ëqg‘õR`4õ*Î~ÂêcWÚOhÔ½½ÜGÔfóæ¨'Ä¾]¡¢µÿ–Äv­3ÁDİ\æKTŒÒÃÒ‰ØdõÀÆº	O~Ã##jà'™š$Æ?0àaÜE¦&îÔ]Û’ØG€œ_Óªi/;j„$4”ÃØ˜ë¸µå°w¼lœ,¸Ì©"ª¢wŒe˜°°Œ”rU¿:9Ú$HT„¤Î¼PƒéèÉé¿<ÃÛøõSæXğ)Ñ: ‰ßF‰ AM˜ØB"yPæ$n¹V’q£`–â~+Ì¼€èØƒ£ºt¬[,îSÀ+ÒI‘,R¤CÛïw:ÀP?¾lM“Eéü“%8-K;çŸÿó_Ÿÿæü·çÿpş»ó<ÿıù?ÿáüŸ/Ş¿ø`·<=ªÅk³E	I¥–v-Cag
v–Ñ½œÌØ3'>¶é?¥ÑäezÄ”<TÛŒ´ˆ|9ÅØ6ÃcÂ/ú×£åù°œ<˜¤7¬f™·€¹‹B;JãŸîŒz8=X<ô_ªc-±¢¸0×iúx¬„
€ın<œVØG†hâŠŠ¯±ÿt©ÃÊöÿä#/‹k5M L`C™¡e}>?3¸Ç>¹´è@°ğ/¯­«ìp¼4¦Rİg0IÃ¸-ÓwöôGC‚jIÛ¤å
ç<ÛÇqÓıÇŠNéc_\4†+côvQÃğrww0?+Æ™ciKÄr1U(Y¬»÷AãDC!¾ê?6A÷Vyº98p«ÕjÆ°d^–Ve×ÿĞÍª&	èû)|pš3HÅ1¦™gŞ']¸ÁWİJVW;ñuíPV Ä¯7^ÓéNÕ`ÁĞ´ÉÍÆâ’aVM!I Ô¿f&ƒÎ®Õì«sjk¢åRø6‡½bPÇoAB6b{épŒFX‘eß$OZ÷ÇÂ^í1´if|Ğ™ƒÂ›Né%Ë Îw;†™ãøoF¨Ş@ã+ø–<	°wu[#Ñı ©Ç×ÜòuË,Ùd•ÚMÓÍp"³Àh´1œkpBÍYw‘üø$ßŠÃ‘qËê SB·EP<g«éBë˜q6øô6ïWT;½Œ«!g²¹Õ\{øÖêÚæÃõåoHĞ4jÚÔWWèï=òVoĞª6ÈèÑXæ ²ıïT'ÏW€ä`¸™Ñ±ÂÏ A­âé¡yCKdj-ñl‰ØZ¹%kaL­R¤c¼<H#`ˆğ”öªàØ¾)ÓqÊZ¢*wĞ‘9% D× ÖŠ¨Ì·gQù2Ğngµ¸›C<ó–=brÒVS¹Ì·MN#åk¯£€TÇK€ÛàÆÓluÏF¥a±ûgïà]«óOåTHîKQâx‰Âû}îûlÛ>0¨ï„Âævş?/¾wşÉùgçOË|‡a© £sCBmNÚÜÉF²¡VC=¦oÅ`ƒ·Š+1ÂÓ›l"í ˆ0ŒØ”f§Cµ–×2Å•3rÅÓà(ÅöØäË•…ãYïPÃÕì¢«&±IS—˜„5D,®ëø©énJ¤nF¼R‚•;Ş¨1 =Fï¿k°Hò¶üf(7{ßëÓ¬IUçõ‰®ºú{±ç˜9Vˆ9?&†ïŒÈØßWãÕ÷AXEI.´Á••p‡}÷újì06!“[eéJíı¯æúõ]eÛÑÆD¦|dø4—	2°âeâæÌ†4—é—.P¢.y.Ë’ŒMÔ„üÌ’´xT’ Œê „·Pğ0'¬’D:Â+ŠÑ‘ÆöhOã\¹íw”âŞ×N\!‘ü¸ô8Š©vd—5n‰ZyR't8ÔnÆñcE6‹xè‘u.”ŒñÓÚÓ8@n¶V<ŸÊ–#:¥^Ô5®19Ğ¨¶òšÂT#1şg1ÈOÚ­²¯¢xÀ´0ººIã%·WfTuöO~¿í·”{RnÀb®¿‚N#‘³äFı/Áï1c³+Îè—ğÛQ‚nÀÑ;£°S@¨Á'tA?Äø¤şa¤‚{:§x¥ŠNµvï5WPœ0^@4Ôõô<êvèáøCëz{{R
è1ÏÒñ+İx/4´â½=áÂHûî¥¥&¯—™“
oêÕWÿ7ÑšO®3ŸTïºm]c›§ëVæ^ÈÕ‹½=¦—tUà´ĞDswçõ]S¤ê”ÌÏBK–Û˜¾zŒojÉ*Á6‹Œ›èO_ö:nëeGö:ğ.õË°~ŒX‘Ù†]ëîÄ`ÑÜ["|-$,vF®¢?z'à©İI9ÎR3ÕÙÌíkfrg^›°µiWWó&pÙÀ®Q>v2¬*£«ÊˆaZ	†ËRÏxPk"ë
‚tÛg]eZWF>ëÊK¼Õzx°Âì7jÊé…JNeàéœ7hÍ„áÑ¤Î4Zd0âUö˜Nœ.öpâe—£( º¯›±Èé<Ná”LG	İ@Î@HêDÒ"Ø9CŒß½µææ1“Çä‹¤L“'[UÆŸS¥X+.Á/½f¡ÖpÉ­!Ñjpxéæ$×ŠR<«[·Ö˜RhÅ”á‰ù»9V Ñ¥¬@~]Î³ıdŒºXÔL>“Xzp,£Ì±ÈÕ3–b1lÌPÆ 6
Ğé`®z0Óíƒ>*J ëi‚|ùKŞÇ_$IüÑ9n9Õ—Ô…ŸeÕF|e£¡d
˜ùƒ¾ÄìÂ'®&’a½â7Ó°„O(ªºz-uØ¸ÎMâÎAXØ!¦­~Ií5[Ó¯m7—7ÖVŞº¿Üü£M©”QGWÊo´×(ºÅÌ‚¡lu¢°‡¢…à1¯¹Ö–k2š­ÕîÒßú»ª]:-E=S_¹€œ?¡U‡r•ÒQ—°8™(±¯cÙ—1º"UÆBÃ()İí÷±%­¹„²	E½§~Ès,OÄè‰Fâ]Ğá“à˜âô¥xA*(ÅÉO¨ã¤/tkôcbÖ`<eÚQ¯H8ì'Ó½Q7Jğ×âà¹‡WÃ:Øb r'í5ò´Â¦twò°ƒ©‹B¼¡›oıı Ædr]<7)nk—ü!êÜÂö˜YÁ¤‘]ƒ¼6„İ`¾s¦‚å³Ãk¶ıSÙt¦P–:2h˜|(xÃl–Üü‹gjÌlÚØl:Dx )Œ·+ÿ°±±¼¾õ aúuô;ªà€³ÀoĞC=˜ãQÒ‘aö‡aç!ºô".Ô*A&°zê‰ä¬„BH†»gWª Å(a,EÊÎ|ò€™Ñ0f¯Jœu`PfS)“½K±ÛÎÀ(J:ç8oßCV­cQÒ¿¡™€€ÔAW•^Œ“ÊQ¡Û[{>aµŠ‹c&#¸ªXeøî	%Ÿ€)ùŒkÏW˜rINB£[jÔ•1k¬ ‚'t]Ç†°vêB®§‘´ŠRƒIÎE¤¹’öş¨Ì~%`“¯@›*¾?Ë†	0L;)PŒj”$ı¤TÍô»ˆõ±-£ÉH·‚j:bşˆ8,>95JÅUKSW¡N «e!PìíŠÚù†äˆ«ÂÔÌlâÒ²Œµ4Øh%¨^È±?%µ¤©ÿÂC¦M„›ì|Éh˜-®°bËÆÕi“Ñ,îG²–`ªíPv´W‚–eŒFL–­’rÕ¤p ši^Ç¡%rÊâ`A•ÈÙÆœ¹bceM	ÍJP“C×éZ÷øĞ•@ƒ¦@!>ÓÛÚ²¼©eŠVr%=¯ˆ“AnÙÙA$0ˆQQFÊ±š&w˜Ê_Mí¡sÚYm+M Dµ?`Ò[Kmyp–‰ã8ãš¦#·„Õ+K*¢Q®º<•âš h À1†p|± fìn7œR©7âÀd¨}Å¤¢“Â&ôŠŞÀmÖ7Z¾hb“à:¨ºeÍ Ñ;Ò³¨hÙhx²-¦õŠ<ÉV™gU	¼çæ*:É?5™IÅE’lB™¤ŞMV=<ï`F.W(ØÂk4kèX+EdgY=ŠGŠ'Fş(z²×“¶~ÑtC–¶ëšFÃ-ñKäqÕ³¸Œz ·•Ä^QşÜÍ¯—D-ªÖ¿<ıÙ9gYôE‘ğª)~yj:9¯0šÇj´7:bé×$UÉgÓõRÕ5ñËSµØ[:s¼ƒ[Hr¤ÚÛÚ¶Y5Õxø v’˜*û5ÉxAê“5ßà?¼YyEÕ+z£f´ÏÎ˜îÙ§t%¬…1Z)fğÎ(âi®èÆ†g=îá:ôb-|ŒÚl‡ıQ§ÍS	kÉ„E~-ê“~á!¥®İÉÎDQÍ‘Ó”RRXr3{±ÑÜÛ£ ¾v
ÕIº
-V™"+A“e{Ó“sÒóÁfÓ ³Ùò'GæõYŠ9œ“Å-•e«ÚXÈIc<'ÄÓÛî+(€^pm
; Wb…Ö;)l¢Æê³&Î¶€¨¤T%j(A;:Œ>0 ¸ ²M
¡…ûßj÷°lN×Qoñ¢ì‘œ=Åı"Õ…Ê£wÉf‰M_+ƒ‰ºU‡\$Æ•
nÀ™Ş`Ş„ }ö´cÅ_»ìÅF¶)ı´’d•Y)´Yö§ëÓK°Š¨´ EE¡ÌºVAqÔt½áT;NÃ½N4…!îµÄ”8Ú¦6ÊÀÍ—5	4:N4Y×ÜlĞWD&*µ+\›¥ÖWŞÌqÔıçq×¬ÍÏdSu,0\Í–JCR‚˜¹ÖğÙZefœÓñRÉûü:FÀ‚¿Ô…Œ…Í•·²åK*‡leÏøH¶Ñ Á«®i”´"²*·Š‚‡ÒOÁ’ÖäÉ¿Tn€+„’*ç%Œv@`‚S'oU¤ë0åşÚæ^®,<*x¬Ğ¸wm¢7‰Û°Á–{í¤·)k	,;Èy WƒÄŸ­-Õ~o“B°Q—³·&[Üã¸×îW	‚Pu›Ö4ºsxX¯¬¾pÑ-Ô	\c%tëº<Š|iæXªiŞ/ÂR•öŒèZq¥"d›ËE=×´ÌHk§ÌÕÙí¤¦²ŒÎŸrEĞÀ—5/w>U)iòj61P§M©d‰o/F„ˆ7k5M&N ‰¬yÆP/Aş -Ğ—Õ$³QÍq‹¦h+2î@S­èòT’ëôbÜ…ø_ğ6?Ê»]h£~µÂNä0avƒÆ’pÒ6n6ÕfuÖw-wí=]LPíUh	õßââSƒ³sS¤^á|ÇêÙS`Vb`.:EÉ¦à€j=Å ø£?HXàÇˆKgŸ¶—ÒâóMƒoö»{q”j¶ƒ+t÷“©mò—†ÅÇŒÕA Ö}‚ò„&“—OìW>Üë'Ã’­øRÛĞ_Íhk¼kƒt22ôĞ"wÜlŠáYµöí³pê Š(fT1R¤qW(¡ ¦Å ¿/£‹åİJ•µ9s¾ğ‚#ÖÇ™„NÎël hİK~RßM:‹®U“©JZÇÒz¡I.½‘¹×ò¿‹ª¬İ`¾xâQêsÈ#–…vâİ*F¦ì¨z±ÚnU±‚_sˆ´6ƒHdÑåÁê=Í®èà­“±?œ
Ù­7R//“?¹uJ/¤ƒÃ¥MÖPr'4DF°é
÷ã!t<E‘g”± FGgO“x?¾Ii%hO!ÕVÁ8Ó«iôœ‰Ò·ÆÏÜÉ=œwØ¢«àTë|bŞÀ>V,Ì¯óÚ‰i¡h5ÅÓŠ“{™c›™}®Áõ¢áq?yü…kvaÒaå²/sHsµüİk_–XjÓğ"«œ…VNÎ>g3êŒh¡R&èÄ{°—`[·ÓÅÍV!Ÿşh„ÎìxFôBò…O¢ƒ8&ZR–Üí‹#ZÛ|kycµù`m•"©y$ı²ÁSìŒ^‹rhh=Ò)cã‘3¯ˆ¢@-I âÛıÑÙÓ(è‚£¸™-—R¨*„2Lû±IÂTŸ]€Ã(ÚÙ/;ÄB/›Í²Ùšó’Šı¬2Qq+Æ,GÁ~gô.OQ	àíÉR¦|Ğ¨µ ˜ú¨’‹ûI¬ùI0Õ:³›{4^×¼UÆÈ1dQòµqgQÅt{ñÁ6‚±5¡åÅ:¡“ßé#K@zYâ]æ\uêhnzF@}‰î¥u5IÊ—;â_&ÅºQ3‚N"sİ…æ1€’¦å"%7éñÆÄA42BdÉV¬Ü}ºdU–b+‡Ìi™0šÍ³n©.ğ3–#ÉÁ…ÉÉğ8	È–./]^šT²ñÈ6I7jei6úW±aj4Ô6¦p(!‰gLŒ¢ĞpP•@>\ñ¤ä£Ñvİ°€Ô—Œ Ú9†<¯iü¨	<Œ`‹$[ã©âY"à¨·lWôP[r•í|÷y­k.ƒ€™§²Eú´|BgŞ‡ı²üzcü~Q‚jÆ¡£Écjf–E‹UŠ
Šs7´¸Òœ'h˜N&048 ç†!ë6ÁÃåMA¦ õVBÌV8ì'†ù	ù¦ABrJú#W—£ãc]õ²J;ÖaUÁ=ÎÒ }<“ö1zEqÊ	0Itö	ñ„,=ÅiÀ(CÜí=Å@ÕA¢»7—l«ª»õ¢ÅDñ½„^±gOS2ÈÁ~Ò«ñl@ş±Ä>&4ƒYRXv_U[«Z'`BÈ^3Şí¼-‡v-Ò&È2Ú	É7Hô<ûĞ³c˜?*·0øóG}¯M×$mÈ×¢Í3W/2”¹LôÎ
¦¼œ¡½À}bLÔ—R»Ô]k+ƒqÉd4 <‡ÓI6¹]“±÷¸;(I¼"ì–i¹öı>ƒ2ğ±DÃŞ7£½¯ÇÑñ•Ì¹iÉ;»aÅ`»ôñz®ªÀz½0NSÒ¥rrÈÁ 3v¢lÒÆ½
o{áQ| ›b”hu; Y-{ôÌHº<èŞƒh–~Lî&›çUé•âµNhs™À2‡–£—bš£†&µÍİÖ­äĞ«$9<äÈ%**2!“˜Ï
&`78¦˜`¿DÖï"Ÿ# ç¼H‘ğñ?›¢¿cX”—ÍmğI¿0æ	â²AÙ´CV:aŠÛöªôÃ¤èŠÂT¹“Æ)ª¡k^a%hSö•iÿ&•9è÷Û”X}/l´^÷ í7¹×Ÿp¢[Ráß×? ¢ˆòPYOe#$0>|ÌÌÒùé´lÚ·*tím¿Ó?®ãv;ê0uMr÷¶úƒú--ã8¥&™“´2‡QØ6²¦¿Æ²Éc®ñNÜz¬eY–.d¥#|rõ¨¬rË½s·‡‡0ğZí«0™‘³®*ÌÁ{ “Ö­ˆ’¡W‚·G)0OP‡Gõeªâi]´”à2ù-ÌE>‹¹È•ÈËRäŞ†ƒqêk)Çy>ôŠ“‡]5—a\ìw-g»¹XMò 4—šÉHÄşª8|ÖŸ-å9ÿÑÿ¬<h6+[k6‚Õ’®¬m-ãO7ıù‰ÂetÌFdô$ÏØ--!<À?¸ÅÖ@GÅ™šÃ]["µ‘`cŠ,’ƒ½°tóFeææBeföÕJuf¡\¨ËbwoŠB³µ™ÊÌ[(\2üéì|åÕşÚ]3 ¹½2($€_noüe¿ÓÅnØÏ$j»Í»»´p½ô¼Y}•-\1×îô«æz9Ëœ•˜<{maá¼HVa^Zt€ÕôScÕÙÔ ˆÜqıÓ¦('£¨5ˆî2‚´6é“éÌ­Z;:(Õåø˜ÿ³Ÿı«9µ×¦uº#Ó««6‹i_¶ğtØ»Ñb^N¥,]A§€”A>à¤.éë0wsÛÄ
O["éíİ>´Ù­Ïëw¢N*k³	r«zoØ›¢XE„‰£SäV#&¥˜A¨}ğ/HÖ6Ö¶Ö(³aSÍÁhĞ39†{©°X¨ a–3•“G²àµéƒœÎ–ŠÜ9¶X/OêGÎâİQš»EµûEğõkìÎè2½_}™î©ôÿìãş¿ş(ØjüñVÃ‚’˜ ¡© ©ÆÁ/S Ÿ¯i»yˆ¹&Ğ‰Íƒ£8ñØFñ¯¡%šäE]¯A¹ûm­S^3\­o éª+‚ªÓï™ÚàİbE#ÛE"µµ
ş¯ºP†wŒğıìÉ¬,ÁÏ„í|-vû½>ñÅŠN|í)êÔ·XAJò]¬ÏToV€¿¿nÔ*‚åùF½†ı¢M0-ÂW,`¸¨Ë1õM`®È‹6šÜqêo§' 3™-ÉïÎI3À©Eô“~i¡Z!ÀÀSp/ê,ê3g”@³+ın£Z$E÷ü5ğö³>£KØ¸§Š§ùË('ù#~åÁöV#hl '³İÜ|ö­¿£‘-?|¸ıF3x9WÓh*îšuôQ×Ü‹½›ÁNª¿{íDÕ…é†)‡bÕÄ.bÌn™]û`ªëÆãÊyYÏ ·4:ºûŒ‘ú­¼³‘ƒrD ïõF˜Ü6LÂ³¿ÇSq+fĞ1çgOÏ¶ú£!Y#,…ª	Í]$“·Z]—µt©I(Š	îŞC‚nÌVfnÍWpóWk7¼„È)7gS£[q¦ñğ*WI‡,NÑ¨Û+Vc¿á®ª1ìs¸º`R´av¢åHŒ›ÿ1ïˆfpÙdçd‡1õ6ªV¤Aš´%ñãkåQÒ9˜c0=†rf±“åSı¼£›c<¦Ë<ñè7–	“(4Æär¼TSàu:tïmñ„”&Â÷{÷ú­QºxÂ4çÌfßr+»ß4ÍHT…®¢ámàêŒ¶u„†çÌ‡Ú],œrñİóOÏIA¼Ïÿöâ‡çOƒ‹ï_|pş	¹‚Qï(ìŒ`™¤ÊÑÆÊaØ;ˆø<…Š_•š(›ñp„Sa 
Àëïïë½+ï';!mÓ£²~ÆuÄ°«Ÿh¬«RÒüK{ñÄÑÎŞùúÙ‡Íµ{k>v•0IÖ V2¾™³r
REdã÷î-¯hıœfSÃtç½†ë\~Í›!êbÑ]&šSÆ “ÊfÈ6X|
‹ÛË“S<LZ‡Š¤GLy³X¸U+Œ:°ïGqt|·ÿîb¡Ô‚[ø§:4Àø åæ¡Rë	û¶ÀÜ|!Ø;E¦ˆ¡`aL¦N‹?~“áFaúEúpª¢×KûÇÅô¢&¦®[¥HZ7™SAÙQ\/Ú\›êPÎ‡ÿ^–¶`Eğ`Ëèj˜R¨M`N®Ì¾B
Æ‡k¯ÌÍ’[v8 ¼Sí•ÒÌ”5«i¼zœÕCWMø/².¦Ú² z#ğÆZñÔmÃY?å¼Ç©ËˆIDêºÁµ¥÷EnÒ^ÃÓ¯ú8Ö‰™XÖ±±NWÆÕ‡=Ï>şiğp¹yoym+wş,¸û`æÙÇœ}+h6@ŒËÌš2% hEØ{2ÅoÄË, CÒèzÈ†XÌÉŸy›ñÑ&®İL“Å;ÇIµ?¸
Ò5…è`9YìÛb+¾ Ôfßo{ËÅé*KÉC½ ±üeAYéc¤Sª·¤ïÔ:ëf©è¨çpOÛZEx˜ÑËö€Ù‹]·¶×½õÖ¹}ÅêQs3£H¼€U	ËşKsDÔİ/0ª÷—WWe)€BÈÏSô¨ùWY<şİiºÃzşIpñƒàâ‡ÁÅ‡ÁÅo¼büü·šÙ¦ÅŸöÏŠåàÀŒG´é'İåN¼ÿ&Å«§`Uv€•Í÷Åb9£F5xhŞ`6†ºd]_U\œfxì©JË–Ñ­´®å©Ç[İ°xJRow)ÕrBrq¨V2‡™h©N°:~/‰içLMKÍÂêˆùzçÄR6×)óèO€Ñ»š²Èá±ÊS¸ähTdÎ‘²K{PVÆSFR¸x£5íıÅ÷‹å²Cœ§w³¾?5S®Ø‰=¢Ó,Ì^ŸCM8­e=œ’„G ¢“	RÙ<(¹T—¶7f‡í‚Œì6Ëi‚ŠòÃ³°˜ü2…œtƒ%¥J31ŞjŒğU3 çÅŒ{*px)2`t£ÖĞ&sì¸Ã¨7{ODš«)•#“É(mu2‹…Ø?V1àKÌ$sƒ4ù^‡İ=p@!Ëğ= _{½‡‚–mùLRö*¨ÕÆÕ«ì<Ã8İI•­½ö]³,ûQSÀ[Ï-@ğß5B0]õ’Ñ]»¥UvV’Í [’ÏìzÚ¼|Ì¾úB6‰@PNˆĞ¬òÏ’¼ñ¡íb¨zÛÑ4»Ï¼0Q¾Q³¸ˆÇ‡á§ka”¡ÎJ0å­#¼&VË¨hóu>ahÜa.– ‚zPCì0"®êóLÿh^lf§›>4yÌ26¤1;EŞÇ!0ºê·¼md¢øì[?-JHXZ2ù¨eNãö{Å!>"×3ìégÎ’H€˜’ZtJ&F¡û^Ú’ë¬h…òF$c¦™¿®Î3û‰sn'ú‡D…ÇœÇñi–Ì 97™snùlHk:]â …
÷‘Rá^;‘üé#Sw+ G¿¦ÒnÙ£vÇ×`ï£7=b†­ş×&,U¹0½úŒ©Ÿ]îÆIÌ"VHw©ò­UÚJxJ†bU’÷~£úÄ6`ùÃ•”Ÿeb«´âòâw…ø°É‚OÕ‚…ÒäÙŒ
$4(8™i„_âà·>Ä_‘(¦Q•LV™èŒQ™LV™Fuş,»½0å)ö;½s¢3ç-Zˆ²{>=i©,K%íq?†0Ä‹ëÖ«vØíÒ«@à»øq±Œf$×gC}Êe/ºú´ÿø!½áÙSŠt”L‚íÌ0Ã¶ófÔÙ'íN„‘ı³‹m×Å]²y¼ããzíôÔ£¢c£ÙÆ8e£A..>8{ú…lÂ™[/oO–%K–ßŒn¹¶,?¦İ‡ú|«Ïıå¯m/olå¡Z#Fñˆ™;`É¬A´ePäÑ¾&ŠÂb“ŸÿÃæ=¨Ò¿>Ú¯p•VÑLHò,Ô¢©H'".œíÈsÀTéaQy=W¨ëõ3Ù]­\f”´Ì8{5Àx{¦E}£ 3¦wXİèë0w»³OÙ–&Ô§naŸeYD?-Ó™"ß€ÓÉÎ¥iÏZëì{“²rŒs)©pztKß½‚½`³ÍÑäYª{“_Îßî¨¹ıKÕÒ³
õÿÌ«ÎÏ ÷±ÅÊ–=&K©»¦b{Zæu¥yUñ?…÷ñÚúO—5°çøø8vk^Y?È·û½~ØjÏxìèyM­ÙtUÛ‘f>ØÚ–ÿóƒí­³7ƒÒàì)F˜Â1sö—såàÿùƒÇ)2šŒ4†?eÔ¨alºàMxFİğÑßŒÙr­GûÃºs®!%au3h‰Í4øŒøÎQ SqSys#9¡M±
“Ùƒ3²2|jéhñz’[“ï`Qã|#ÃµÂ®şÙ?÷—7¿¶İh«»Û¯£ægÿw°µ|w½±¼>Ó«gŞ}ğúòëÇ"ãš¢=ûWv6ñnÎkœá¼6©£É¬ífÂÃõÆ˜óÀÁN€ÆÖòÚz ›­Zô/ì(ÌëÜlĞöÕ1ğùÜS˜U*•ğ¥Ïš<Ä‹	>ÊıÚ0¹s²SüJ±R|ğş4Ï>¼wöa³±±Ò€_Û[këk›Ë[í&üÚxĞ¼4÷Ä×íÍ>fƒß,² ê‡YÜŒíúCØzx‚¹õ„}¯ßÉ1‰×†{ıöïiê·²	[Úq6ë`qew¾KûšÏ5ïµDÍgØ_;—ArCxWÑnôMÆ¢ß¬	gĞL~HY,r‡0Œ„&Ï0¾M4_.tÙå(N¨ô{ï•*^j’>òÏlNÿ–½ò…à«%m‰TÔ‚gÂö„7ğŞ{¯E]Mƒºİ°÷Î(ì_›ºw&›×iØƒÆtri_7P0¨–Ÿ¯O~p_¾KJª‘/M‡†0¼ÏD Ê^Šqş o&á ^<†¿L¯7—·®—Õ\ñ!˜ú«	¥K9V~¿$×…Á§¥Ó>NvF1Éx½ixd§«tãyôÔPiQ£¾cJ:
:|ä!Ô3³yÌ×–HÌ©ûÜ,ñöğÏs´¥´pÔÖÌ,la¯^]²)–‹XX¸Šøo²¶|ç Ã]#G )^ÏÇ^{*rµ¬3èù–é+Ñ­°6[{Ş•Ñ®“=ïŠX¿ç\íÈÍVkà'Ÿ¼àÇU¼½àiöË+”_Ü1àáÇ4ê(Àğ“¡e½é—r1¯JBªãèĞOphyÛ¡`…Ê{öÒ§Êi‡YG¥k'zê—™)4)ôÓáÒR­:_.¿B.—_-?BÀ$=(‹Ã£`çšşàtw’F&û$ÊÉì~2uƒìe7âšü]AYŸÈQ~œHÇ“­1£–ürúÅ,°ûÎÏ¡4ÃÏegóº*×Ï/ <»õÊ³Làæ+ĞÔˆ_@‰6ïŞ§15f7ÆjÈğãÇ.Ÿ
×.—‰"cøvÓüt+Oc­ZuÁ·úÏ>ÜX^_£¥Ë5(qusûnp½V]à`>)Ê‘Óór?½³ÚX®Ï¼PSlé ­µÍàú\µæ_­I\ºsî%±/'ŞpÙ·3¾ÈÈÔYft‘f)/¸~¾À ø‘ñn¾ô ø™ Ğ~œ«¼/!RÆk›[šk_Ûn “ˆÁñÂK2¾¨X	ø™ ^‚HÃõÜáØ¾p5Ø'²åüû™FÈ¶™ÒwIß<ØÉ¼/€ÅgW%FÖ,ÇÖb˜{a'Ì¾¨#_ÍÃ«¯ìï¿º??g^ßq]«˜—”ï,SnR/ä%µàµÂÛË¹ºêº?yİ§Z§³³²aÈÜ¼¼:ou¸€7Eı}<²ïÑú&m‘ùÜ½ùßÊ=M¿<ç³/şxgÊ=K¤ú&ƒ±rë©Ø7ã-3|h¿M…¹Q+èú
Ü<¾ùƒ £ˆV1\Æˆ[§H|ø‡Š+î'S÷šÅÊImvªÄC˜´~X/¦‡ı~Âàõ—qo4ŒÔƒÓrŞ¸'^Í'ciµ›UÖæş3v‹*€/ËÓ	L¦ŞwVøöK–ÀDïêÎ^Ûé ûó‰’÷
?Q$GàŸ£à¥]Ó‘ù@Ñã‡î?„JÙ@±+–z5…C&îb$¿î ¾‡2»$"±|NvD7mL¡<îœ‘ÔÏÊ:™„û"WcV‘¤"çCöİÉ÷é¤¤ìôûQi}w*Éˆ–¼¿¿}?¥Z+â—‘5³¦Ç“D°4ñ5+q?êö8ÜWì–È¤F÷‡®"xéçZ¯·"ÉoÊDÄÊ]÷•ŠtôªAÖ^*n¿Ëgiw —Úø‹¥x«;Po§¶»«ê„TÆ*ÿ	Îx*˜5h¢¬UœVÍœE„¼¡
Ì°T…îyn/ÓYŸUŠzíû)Û–uÔ}PKx_Çl…¢YŠy3LÕBÍòËìº¼n…×¹µôaCÜ=Š›áş˜ íl;éÑS½³Ü‹»äv/	»‘]ìv`>0“,²´æHr†!6­
.9G"Çd íA#N¤¾_J">Ÿ³JOÉÃ¡›ˆÖppóVè:Ò}7=_±èTÃDV1QîP_0WZÔeŠ<J]!ÊÈ
U¾ä·TDOÎ”.±±êÓ2²¦—Ã9e…ãÔ ¨EÔ5@¥ÈKë±7ßU{îæìDınê“1‰W´¡[‹ØMhâĞÖE:´ìD@¸ne_¬iï‹.´`f4‘]öq¶C½3‚}jm#„o~‚W53È³*ú<=š™/Ù€ >½
´dí¯{€Şt§ÏÚgÆUkÿaåÛ7ì<ğœD;Ç±q„ğm%N¥q´‡ ê˜4Yí=­ª‘¥ƒĞBûœx`b^’XßÂÀÆ+q°edúÕ¶hô9L^ŒÒ›ïñ!FÆáïGÑıMÁEQ"AOÿ< (…¡ÔQ;É€Ïîr«F!„qPŠY»ª¨"¢\zƒTz#Íê±=ı*[“¬”ó<® ÉùË£fõËÂB™bdšobn£ı¸uGIğŸ7l°ˆàb¿w€wEÀ#‡‘–xß1ÿíûiàĞ-à¼tï˜¤D)c7´fôÀ½q¯3“A|k• $¹G_ëe lª)Šë[óõ•áÙ!–Dû‹'ßNY°¦Ğ	Ô¤4-,bŠ^£ßkôÚAGÇ¦«åËbKzP'Û—Œ#‚Á“H4<Š9ï¦7‘¯ĞB¹îR#§z(½Ñ½a/¸vÂù|Ô^á¨Hg…Ï
fÄKªj±©@-Û0"¸´D <êl3Tµ}¹ U0d~½Ş³>£*Ï~öO]æ³ug[®ÿ‚€áSÁ~ñëö«‹ïûûùğ1õc<Ê†º8`
¹J\*õ:– Œ˜ÃaPæ±Äs»jcB¾òmã~À©g9´éİí0^MÑ4Y„-Jc¶G¯ÍUù_ıß³ xDÔƒÃ*­Ì¥ÈAu:¬
b)w	æÎ®M×‹{QRº1x—.gbÀEwqÑ$àJíÆ†T>íSÆ”'õê<Ğæ:0/‰gÎ!l¬Â’#hpÏ¸ÄşØ)—8¸õOæÍOÓ<Ÿúö¤à9ÉĞ•­îÏtè8Ùß¥KÜ%ƒy@®~ç„N‰z ÇO…
cÉë5Óêµàt·,üÌ‚Vht ±È(=ó­‘ $]˜'W1Ÿ¿†Ï¡Gÿ}\y arÎ ³íü&øRd_å|Ä.9Âëk'lKãı*Ô±ñ¿ê…G2.ü#°5_r•bLúê ¤ÆqW´¾²¯Õ›ñ€2ïœP×È{x2™1­é.?Mr@ğÍ p~îœ”4€	+¨;½¿µK3åÓÔ@m‡çÌÅ^¨_¼<Ñ¢4u\Šá?I…){VP;’éôÁù+†FRáéWf¤GŸFÓĞa^¹b(1W(j‘v‘qx	fxÑÔ™È‡	¹óbdb áÓû1Ë%›q}%¦çÜG¶²‘-)+ròFuûÃ”ÒQÃ'!lè£¨…'éÒ³§f{êÁªØÚ× Ó¶TIEBÑ”öÙP`1­°Óu"ÕA«?‚#	¾Å¡FL±EŒDC„^ùüõF!§‡ª*µ«D¥“ G¥sŞSÌœò¦Úm@ö1_HØÙŒ¢Ç¨£j,ÛÍÔÈN¢’ÍÖÉNª*}1%®Ôºá öİ©dŒ°'ÓÀï»AQGV:æšU< Zò{8ëxX*VÑRîöû(ì!¯‰ñZ<J>Ù~ÙJ=#ÁI¿GR¡¥&£?rÕG†êg•‘¤Ï—W|<§ÂÃ¯9;½­C…pøšÄîª-Íª$#]¦j¦¢@ÖTzWÊà=†İ,¦ìÅ¤?CLŠò,’@8Ş!jÔ¡Ì·,SßÙÛ NúÔRsbP]Ë=F]8FGg6«ëç¤1ŠI•‹ñTcE#¨1£bH´MÚ
ÔS#´¯wå’µĞ&$0Çş2Në/ÕÄ^µ—ŒÇÄÚŒ3ßœ÷/äGx<Nı¥•ŒòÇÙ8ÄŒ¹aS™öüÀrl£JjH9ôƒ´w0_ÚQH)ÿ<ë u(àŒ]";ËÄŞ.ùÃãXªBw'DÆFø«'¹ê9üª‡aŠ"†fcĞj£ú†®t¿ËS¨üÆş»
’ÀÆNMÕ§¦ªSSS,k= ‰[ÊI´‚l‚ŠòiL4²\„m:·J³•B­P>­ûj`•¯ò*‚¥t«V3:ûªSaUx¤'¾c¹Àé½¤rêP-éÈ®rS§€q0J~hç.ï¡A¹xµè~öµ8WCÁõôÍ¯yêiåYfYÅ1ËÊö¼näœ~p“sÄ‚g¹ú6²Äèõ{Ñ±€5#68-V@gÎ€×Ó¤¦ºÕ_…C3‰åÍ«7ÌZXÿ1/èÒ’/‡?m²ÆpzE$^s•Çš@Ò„Sèw_ÈÒ5bÒî<ûø;ÁJóìÃF3Ø¦´³Í­µFğõµå`½¸¼½ºöÀÍ ²nHZ>z ÑC©j†Â—ÚUYÜ•„/¥áÊ3kê\‘cX<aÿ
Ö„à—S¥•å_Dİi3!JE0Ÿ”‹E°(eçÙAè‰Ùè™v<Å`ô1%Dô¨Š±`Ç…;xí}{Ë;lÇIÖj"ı½v"N‡«Šœ":qÅ j!ˆöŠÓÚã4ä‰€½`Ì N{ôò½³ôKÏşç/‚ûËM¼Ü¯·îæ²âºû­ 3¶D\„¾µ+I¸Ö’Óå?ñ5ı2VçŞš›ñaüÒ05naØqşr–0ş%-ÊøÎsãEe¹'-Jjª«-Ÿï•Œe÷[ÅtŸhrÙÅ²½¡­ÿ¤\\ÍÆV¦JÛ%z“³§Gq:
)„J&­i™\_¤\}sDÏß@Åª›Íôâ‡û#õ˜Tà¦q¯Õµ#âŞnûª¦d×¨jãgVÍPYkzÓc[oªæHÒ1õ3n…¸7•à¹M%Ç
1Z4HışÜWğ{tÜ'Ç§'À68·F<
Qc§ãï0ØÄÖØÜäßØÇBaˆÏš01C¯{½ı,¢m¶PQşàIŸk üQØé°le!zGßdê7q$‚Çïîy¦eÖ¶÷í_ı™™Ğrİ.b²à¶nÁÆyr8y¦lß„ÄÆ÷;–4iFhuæ×È¢"¹^mô×—µ¾,˜¬Ò‰?Nq™ü¯HP#mÊ÷JY,€Y
cÃ}Á¥çé ã}: ã²©ßÜÁ¤Ó=X Ía4`¾ŸÚ[;‰¢om1H3‹<{cš¯S–¬r0»Ø={Úí³‡AŠëÆßÌ-Õ…]®dÇğq´Œ*g[3Â:õ@š**°1XôZos”„‡üMÜ†¹€ «ãÏus«ñpc88O:û1<îŸÿD¥"ê?E Ù¯,ìµní/À³½ƒ:¿õşêLe¶V«ÌÎ/°kï 9;Íı<¸öáıÍ5
‚£šÛßoÏÜ¸a47»° í½Z™©Íf·÷·*%›1¼Ö­›·ö÷Íöğrÿ,Œo!{|â ¤ÆTs¦·=kS;oyK»Jp…ƒ¸¥ª¯s€Ìl©v¹ÙÓ9­QX|uÄ+±ûh@ÄVkĞF
Ûn¦<V`âî 1ìŒkÌÖEƒ‰Út:Ñ;ş@ql²fé›sDÖ$ã'918Ä8ØSº•å·|ŠAŸ63ø3I—8œ¼WÕtÏ¢L¢âœ¼XÑã„i¹ÈMËÆ½Ú¼»"ú%¬":xıÊ¨ld$fèRİ;7ÙÌPÄü=áãé#¹oŒçªq¼À ^ÔO'ËT*C¥y°‚Œ»~Åâı,µ9ªV«mFqÒzĞ®dĞYô‘<!w Hò9P½çX×õàê@¹AèYÙò ±ÆúìãŸ2‡ÎäzÒäÇ‹SşşÃÃ¯Ó“½ğpe¥‚ĞU!>ûgÿ·I8xÍ(¬ğ3Ss:ãnĞ¦1WR­kVìv¶…æùMÍ V´¸˜¢l2[Å÷H+ŒÁ÷Üü³ïµüŞT .ˆYÛtÖÜmjgÕ¹Ô©m<ô30 °¤l7Æ1Äÿ«Öná±a¥*,O–˜Ùª™İœq ãğIJáŞ{ Œ´¢ÁÖ)È^$<@rI¬†9'ÆÃÆ¨±BJGä†X³øÀº#l]Ş1€HôÇ:uÍ -Ë Ú.Ò=e|×"“òN5ökQ O%+æS™áGxœ.:Øk–UV9„Å¬^2ÇA[;ª;[A!}Dæ06òzºÈ[%‘ö˜/ÅsôÌ£î1ä?7<|ÆË«07BÄS’E­ÀD˜·9§§¼âìÃÜByÒcÒB:º“È¢d}H{„swÿ†Ç$ÎqMø8nÁæx¶w¦¿ Q’»ní®‚¤ut5İŞ8MÙå
ï­ş˜”ñò€ãüò1ÛUã2öŞ{;»@ùÂ£ˆ’0.¤î¹a zşk{¦‘·¥s¨pfq`ûG	×åèAs¬ä6ç¸øñk"ˆ­”Ê	¯[c 9e”İƒİÏr½°ZĞK{‡EiÄµ°°ƒ‚_¿„­ÎJíìÅ»üÑrà† tÍññb]<Fâˆáà=ÕÍhXÚ©UDçÑ7ã<§fvËĞz?â•ğ½òâpj\d«áCˆwşäí.ÆÈ «Ó8*øª”ò±#ÚÍÔjÄûH®‡åâ -OYø6ˆá´†ìÀ%İ©¤t¼< ô§ixQŠyá%”¢¹1êÂ®o3w5†Y2sœ2UØ[‡qºLM n±ÇLjî÷H+Š§
Ó AÎûeî>â—)|3%Ëó»ÑÈ<>L°_ö{B–Â9•ÔT©QC†ØÓ¬‘ÀÒ•ÅuÎj.²ÁY1=Ø3*ğ¤TzK o§ÍÔE¼îRU lšÂã«¦;|+Û!CÄsŞç9âP‹ş«%{ô°w­^)EÙÕN[¶ægW-$-óû)Vû»uCß°ƒLÃâ1˜3–ùÌP¬8^\ŒÁœ¿Ä/o%™Öz"-–Ï»ƒû\1{%	¾ÃKòŒê¾õ“FØ:K`ˆ¯â]Ì²àÁÁQŠË"Õ§©p.êáq|ÆaòÕÇ^MáP6®„ï–`u¶éåv11Ü»bcñršÂaO¸fõuÇDlá^#Àí^fi†q-ˆ­şhÒee¦†×À{ôPAIêWòY¤'g¿L„w¦ŞµÅ¡6˜÷Ì%/<»0!^7ó–0€‰3ù@Ó«ûÛY;ú5åãì{¾—ó¸±¯”Ù#»âsEP®°‹iş—æ~Î<aQ2ñ¼‚v;†p¨öúÇèƒæt ìWÛJbß%úpe"+>UšJ™/m¦)Ÿ—¢ˆwSIÿ8[ëtòH•)¥m¨3øwz©”\›[Ë[Û[®ÃöQØ)Ü±šÀd»\Ã€õÁÊƒíæfA¸Œ±Çª±î¬7V¶¶›Íœa™Û+xÁW¥–ÕG†N‡§Cw€ÀøÅôó”:)½QÔi¥ÖÜ¸1ËY!—_5HÔQMÚá 9µ—KÇ[rTHâœ
$lDyÒ.â–OÇ¬27'ÃRß¿ß/<Úµ“Œã[—&MU0No´³Ë©Äº˜0ŞıA5Okk[kËë¨nwÍ›*£—Ì‹èÆT¿Ó	iŒ‘ø™ÊØwÍ•LîùaÉ¾Ğ dzª—’,GBÖ•º:öx•s¹s¥ĞO_HP3¦ÒßôY™³6B†1İ{#X‚kKlä›©¹Á.u%ŸÍ\c 3'¨õgÆ,E3•™·*P :Sv‚¦I»§a-kPæiÉİg`ÙJ—k¹\({o¼IàKòâ%+Ë´*ÆŸØKãóğä¿˜/²n‚€uR2xˆuŠ¢+
¦ÚµĞ7CKÄ‰ÄeÂÕ¹Ûéæ]J ·ã¤·Ê§,Ú[ CêÈKÒïªGˆ'qĞ<{wâÃÌQx¯i¢‹æ*YÂQËS¿lº}zb
âÇ¹T(5ÉÏ1vÏğ8´-	–ô7›ÛŸÚsr üx<¸‡ %«£ĞÂÿõ×?ú½pÀ@ßVòl}^º©†(q™_²îwˆ	œã%˜©.H»¦©<â9›sŠ%ä0””¥í-TôÓ4pí²ÒFâFĞ¦—?t‹€õygDşC¨ í
y—ß/Dp<ûàÏÙuş?ÿ¹^Z—­Ò.åuBÈYksâÛŸŸ¹Ù‹ÃÂ<uÜ5#ò	,òV”ª‹Œâ¢#ªÎ¦şY˜Ó°w“o´{ÎÂ1U;şuwU†ÉÉmcŒ	
?ßAnÚâ²º[Å¸µ´xbh>ÜÒºG¿éz%'oWšcGƒÅrqrÇ(1–[‘‘äy8™ÁàÔ°ëb– ó¹í{\ºY<aÿ:±qŞÁoéa˜yŒM‚_“î†ï½ÀvßcòDTA¿õÁˆòÒ1ğtA4ıG¬÷V´Hñ#ËZZ–*ÒA\ÒNÅåTËÂuLNkeî"05ÿjmE—6“pSˆf$p}+ØÜn®¯½¾À´n9ää ò$ô±‚ç2 –Ÿcm;Áõ¹Älä„Èë{’ ¶†˜ZÌ‘/™±ODå×AæwşÏ<Bè†#bº‚=¥_”Ÿ¥jIÚ‚0`­ŒªR\Bµh]{Üğô²½<~^y®[ËW¶1?š¨™5ŸCã&/Ó3Òœš³:0’²ØésNÙmóhÇã[›uR¬™MQn3°U‹Ï>şoHá6—W¶Ö¾Şh‰úø£`e}ôh€exïêË[>-mãN{©*]ª“¸[*{éwšYv>™¯½x§tB´Jv„9MÊÙÈ69ºİzÉØf:€ø“•ŞC%N÷¶:8õº—±OŞùbGCÉÂŠ<á9;Ä4²ön>Ãûl‚¼(·ÜôÀù9QlRLºdå‰w—ÁA˜÷=qò­xª¥é(à0ÎDğ¥l(ùòüMœ¨ÃU:\ÛÉ>&ÊĞlºİœª^ÿ#GÛ\†E/td<edBQéÔEu†º/bÄsÃCÙ¬ÆÚÆÊƒíÍÿ`3&b3¸.Ïbø†ÿÂlÇ¨÷¸×?î	¦Cüüßˆå3PÛtfµÜ¯¾†C5äãf´7÷œ¬Fv;“ñ¢şKâ0JHy›¤KaÒÈİÉKà6ô>ë NıÃñÒ‰"—c7>>§aì¶ÉX·'‡q&Ï÷ZpH^ˆù(¹ñ<¹›4Fˆ9;Æ÷®³}ïÌ6aQ6£¡æZeo<®˜Òk¢w«çsğy™?'»*~}(ÓÓÁİQÜeë#øûûAJº¦oeÒ$;°¦œ÷F?éêNe¨aÓÚUN¥!%fnBë%şˆ²X,;`.[£[†04KÊøGzxiØhàîJ†}sYŒvÕH¤W^ÏõÀ¿|ğòtL²™˜1=Ò¦u\.—E‡Ü+îv`†Y—^jÛ½Ç^€‘^ˆ·aâŠ÷öó2`®.ïå1áf2>¯B»¸ŸkTx·õF!á5–ÃzS-|€®µWyMX8±6ÙuiÁU…«X##"Ó˜•‘põfe´Sm“¥W¤:ÒRcÉ²o8É²²’/‰¥ÀGÇA¸1®üTfÛŒÒ+•İÉìBV'ó>J­¢yfÉb>µêMhv&«>ÒÅÕ¨Õg‘G‘á…ASj vˆTM¶œÑ€([ ê„èK–Q4;ÍÕÉqVJW/À0Ó™@õîdGCèsÑÔJBjVí´®tk_Z‘¾QÎåšğ¤ØŞzÀıücÎÉ÷éî	7ö­7_Ô‰ØÒã×oÃÎgküÓõegÍ¾gZ×Ñ ¡fÃxvgf©¸YDeZğ`ee»Ùll¬d– 6~«±²uöaV	{|ÎT7–îğWò™EŒÿ?   ÿÿ  Û‘¸