import { OfflineLoader } from "../common/OfflineLoader.jsx";
import { firebaseAuth, firebaseDb } from "../../firebase.js";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { getDeviceId, mergeLearnData, mergeActivity, mergeCollections } from "../../utils/syncUtils.js";
import React, { useState } from "react";
import { DATA_KEYS } from "../../utils/syncUtils.js";

export function ExportImport() {
  const [open,      setOpen]      = React.useState(false);
  const [status,    setStatus]    = React.useState(null);
  const [importing, setImporting] = React.useState(false);
  const [cloudStatus, setCloudStatus] = React.useState(null);
  const [cloudSaving,   setCloudSaving]   = React.useState(false);
  const [cloudRestoring, setCloudRestoring] = React.useState(false);
  const fileRef = React.useRef();

  // ── helpers ──────────────────────────────────────────────────────────
  const getCurrentUserId = () => firebaseAuth.currentUser?.uid || null;

  const handleExport = () => {
    const payload = {
      version:  2,
      deviceId: getDeviceId(),
      exportedAt: new Date().toISOString(),
      data: {},
    };
    for (const key of DATA_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) { try { payload.data[key] = JSON.parse(raw); } catch { payload.data[key] = raw; } }
    }
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `quran_backup_${getDeviceId()}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ type:"ok", msg:"Export téléchargé ✓" });
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload?.data) throw new Error("Format invalide");

      const myId = getDeviceId();
      let merged = 0;

      for (const key of DATA_KEYS) {
        const incoming = payload.data[key];
        if (incoming == null) continue;
        const rawBase = localStorage.getItem(key);
        let base;
        try { base = rawBase ? JSON.parse(rawBase) : null; } catch { base = null; }

        let result;
        if (key === "quran_learnData") {
          result = mergeLearnData(base || {}, incoming);
        } else if (key === "quran_activity") {
          result = mergeActivity(base || {}, incoming);
        } else if (key === "quran_collections") {
          result = mergeCollections(base || [], incoming);
        } else if (key === "quran_lastAyatBySurah" || key === "quran_loopBySurah") {
          result = { ...(base||{}), ...incoming };
        } else {
          result = base ?? incoming;
        }
        localStorage.setItem(key, JSON.stringify(result));
        merged++;
      }

      // ── Backup avant fusion ──
      const backupPayload = { version:2, deviceId: myId, exportedAt: new Date().toISOString(), isBackup: true, data: {} };
      for (const k of DATA_KEYS) { const r = localStorage.getItem(k); if (r) { try { backupPayload.data[k] = JSON.parse(r); } catch { backupPayload.data[k] = r; } } }
      const backupBlob = new Blob([JSON.stringify(backupPayload, null, 2)], { type:"application/json" });
      const backupUrl  = URL.createObjectURL(backupBlob);
      const backupA    = document.createElement("a");
      backupA.href     = backupUrl;
      backupA.download = `quran_BACKUP_avant_import_${myId}_${new Date().toISOString().slice(0,10)}.json`;
      backupA.click();
      URL.revokeObjectURL(backupUrl);

      // Track import history
      const history = JSON.parse(localStorage.getItem("quran_import_history") || "[]");
      history.push({ from: payload.deviceId || "?", importedAt: new Date().toISOString(), myId, keys: merged });
      localStorage.setItem("quran_import_history", JSON.stringify(history.slice(-20)));

      setStatus({ type:"ok", msg: `Fusion OK — ${merged} clés importées depuis ${payload.deviceId || "?"} (${payload.exportedAt?.slice(0,10) || "?"})` });
      setTimeout(() => window.location.reload(), 1200);
    } catch(err) {
      setStatus({ type:"err", msg: "Erreur : " + err.message });
    }
    setImporting(false);
    e.target.value = "";
  };

  // ── Cloud Sync ──────────────────────────────────────────────────────
  const handleCloudSave = async () => {
    const uid = getCurrentUserId();
    if (!uid) { setCloudStatus({ type:"err", msg:"Non connecté." }); return; }
    setCloudSaving(true);
    setCloudStatus(null);
    try {
      const data = {};
      for (const key of DATA_KEYS) {
        const raw = localStorage.getItem(key);
        if (raw) { try { data[key] = JSON.parse(raw); } catch { data[key] = raw; } }
      }
      const docRef = doc(firebaseDb, "userData", uid);
      await setDoc(docRef, {
        data,
        savedAt: new Date().toISOString(),
        deviceId: getDeviceId(),
        version: 2,
      });
      setCloudStatus({ type:"ok", msg:"Sauvegardé sur le cloud ✓ — " + new Date().toLocaleTimeString("fr-FR") });
    } catch(err) {
      setCloudStatus({ type:"err", msg:"Erreur cloud : " + err.message });
    }
    setCloudSaving(false);
  };

  const handleCloudRestore = async () => {
    const uid = getCurrentUserId();
    if (!uid) { setCloudStatus({ type:"err", msg:"Non connecté." }); return; }
    setCloudRestoring(true);
    setCloudStatus(null);
    try {
      const docRef = doc(firebaseDb, "userData", uid);
      const snap   = await getDoc(docRef);
      if (!snap.exists()) {
        setCloudStatus({ type:"err", msg:"Aucune sauvegarde cloud trouvée pour ce compte." });
        setCloudRestoring(false);
        return;
      }
      const { data, savedAt } = snap.data();
      if (!data) throw new Error("Données cloud invalides.");

      let merged = 0;
      for (const key of DATA_KEYS) {
        const incoming = data[key];
        if (incoming == null) continue;
        const rawBase = localStorage.getItem(key);
        let base;
        try { base = rawBase ? JSON.parse(rawBase) : null; } catch { base = null; }
        let result;
        if (key === "quran_learnData") {
          result = mergeLearnData(base || {}, incoming);
        } else if (key === "quran_activity") {
          result = mergeActivity(base || {}, incoming);
        } else if (key === "quran_collections") {
          result = mergeCollections(base || [], incoming);
        } else if (key === "quran_lastAyatBySurah" || key === "quran_loopBySurah") {
          result = { ...(base||{}), ...incoming };
        } else {
          result = incoming ?? base;
        }
        localStorage.setItem(key, JSON.stringify(result));
        merged++;
      }
      setCloudStatus({ type:"ok", msg:`Restauré depuis le cloud ✓ (sauvegarde du ${savedAt?.slice(0,10) || "?"})` });
      setTimeout(() => window.location.reload(), 1500);
    } catch(err) {
      setCloudStatus({ type:"err", msg:"Erreur cloud : " + err.message });
    }
    setCloudRestoring(false);
  };

  const history = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem("quran_import_history") || "[]"); } catch { return []; }
  }, [open]);

  return (
    <div style={{ border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 14px", background:"var(--surface2)", border:"none", cursor:"pointer", fontFamily:"'Cinzel',serif"
      }}>
        <span style={{ fontSize:9, letterSpacing:2, color:"var(--text3)" }}>💾 EXPORT / IMPORT / CLOUD</span>
        <span style={{ fontSize:10, color:"var(--text3)", display:"inline-block", transform: open?"rotate(180deg)":"rotate(0deg)", transition:"transform .2s" }}>▾</span>
      </button>

      {open && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ fontSize:8, letterSpacing:1, color:"var(--text3)" }}>
            APPAREIL · <span style={{ color:"var(--gold2)", fontFamily:"monospace" }}>{getDeviceId()}</span>
          </div>

          {/* ── Local export / import ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:8, letterSpacing:1.5, color:"var(--text3)" }}>FICHIER LOCAL</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <button onClick={handleExport} style={{
                padding:"9px 20px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
                background:"rgba(62,184,160,.1)", border:"1px solid var(--teal)", color:"var(--teal2)",
                borderRadius:8, cursor:"pointer"
              }}>⬇ EXPORTER</button>
              <button onClick={() => fileRef.current?.click()} disabled={importing} style={{
                padding:"9px 20px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
                background:"rgba(201,168,76,.1)", border:"1px solid var(--gold)", color:"var(--gold2)",
                borderRadius:8, cursor:"pointer", opacity: importing ? .6 : 1
              }}>{importing ? "…" : "⬆ IMPORTER & FUSIONNER"}</button>
              <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }} />
            </div>
            {status && (
              <div style={{ fontSize:8, letterSpacing:1, padding:"8px 12px", borderRadius:6,
                background: status.type==="ok" ? "rgba(76,175,129,.1)" : "rgba(224,90,90,.1)",
                border: "1px solid " + (status.type==="ok" ? "var(--green)" : "var(--red)"),
                color: status.type==="ok" ? "var(--green)" : "var(--red)" }}>
                {status.msg}
              </div>
            )}
          </div>

          {/* ── Cloud sync ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, paddingTop:8, borderTop:"1px solid var(--border)" }}>
            <div style={{ fontSize:8, letterSpacing:1.5, color:"var(--text3)" }}>☁ SAUVEGARDE CLOUD (FIRESTORE)</div>
            <div style={{ fontSize:8, color:"var(--text3)", letterSpacing:.5, lineHeight:1.6 }}>
              Sauvegarde liée à votre compte · <span style={{ color:"var(--gold2)", fontFamily:"monospace" }}>{firebaseAuth.currentUser?.email || "—"}</span>
            </div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <button onClick={handleCloudSave} disabled={cloudSaving || cloudRestoring} style={{
                padding:"9px 20px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
                background:"rgba(100,120,255,.1)", border:"1px solid #6478ff", color:"#8fa0ff",
                borderRadius:8, cursor:"pointer", opacity: (cloudSaving||cloudRestoring) ? .6 : 1
              }}>{cloudSaving ? "…" : "☁ SAUVEGARDER"}</button>
              <button onClick={handleCloudRestore} disabled={cloudSaving || cloudRestoring} style={{
                padding:"9px 20px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
                background:"rgba(255,160,80,.1)", border:"1px solid #ffa050", color:"#ffb870",
                borderRadius:8, cursor:"pointer", opacity: (cloudSaving||cloudRestoring) ? .6 : 1
              }}>{cloudRestoring ? "…" : "⬇ RESTAURER"}</button>
            </div>
            {cloudStatus && (
              <div style={{ fontSize:8, letterSpacing:1, padding:"8px 12px", borderRadius:6,
                background: cloudStatus.type==="ok" ? "rgba(76,175,129,.1)" : "rgba(224,90,90,.1)",
                border: "1px solid " + (cloudStatus.type==="ok" ? "var(--green)" : "var(--red)"),
                color: cloudStatus.type==="ok" ? "var(--green)" : "var(--red)" }}>
                {cloudStatus.msg}
              </div>
            )}
          </div>

          <OfflineLoader />

          {history.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <div style={{ fontSize:8, letterSpacing:1.5, color:"var(--text3)" }}>HISTORIQUE IMPORTS</div>
              {[...history].reverse().map((h,i) => (
                <div key={i} style={{ fontSize:8, color:"var(--text3)", display:"flex", gap:8, padding:"4px 8px", background:"var(--surface3)", borderRadius:4 }}>
                  <span style={{ color:"var(--gold2)", fontFamily:"monospace" }}>{h.from?.slice(0,16)}</span>
                  <span>{h.importedAt?.slice(0,16).replace("T"," ")}</span>
                  <span style={{ color:"var(--teal2)" }}>{h.keys} clés</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PRONONCIATION PAGE ───────────────────────────────────────────────────────

const ARABIC_LETTERS = [
  { letter:"ب", name:"Ba",  trans:"b",  isolated:"ب", initial:"بـ", medial:"ـبـ", final:"ـب", makhraj:"Lèvres", tip:"Bi-labiale occlusive sonore. Lèvres fermées, air expulsé." },
  { letter:"ت", name:"Ta",  trans:"t",  isolated:"ت", initial:"تـ", medial:"ـتـ", final:"ـت", makhraj:"Dents+langue", tip:"Apico-dentale. Pointe de la langue touche les dents supérieures." },
  { letter:"ث", name:"Tha", trans:"th", isolated:"ث", initial:"ثـ", medial:"ـثـ", final:"ـث", makhraj:"Dents+langue", tip:"Comme le 'th' anglais dans 'think'. Langue entre les dents." },
  { letter:"ج", name:"Jîm", trans:"j",  isolated:"ج", initial:"جـ", medial:"ـجـ", final:"ـج", makhraj:"Palais", tip:"Palatale. Son 'dj' profond, palais médian." },
  { letter:"ح", name:"Ḥa",  trans:"ḥ",  isolated:"ح", initial:"حـ", medial:"ـحـ", final:"ـح", makhraj:"Gorge", tip:"Fricative pharyngale sourde. Souffle chaud depuis la gorge, sans voix." },
  { letter:"خ", name:"Kha", trans:"kh", isolated:"خ", initial:"خـ", medial:"ـخـ", final:"ـخ", makhraj:"Gorge", tip:"Comme le 'j' espagnol ou le 'ch' allemand dans 'Bach'." },
  { letter:"د", name:"Dal", trans:"d",  isolated:"د", initial:"دـ", medial:"ـدـ", final:"ـد", makhraj:"Dents+langue", tip:"Apico-dentale sonore. Comme 'd' français mais contre les dents." },
  { letter:"ذ", name:"Dhal",trans:"dh", isolated:"ذ", initial:"ذـ", medial:"ـذـ", final:"ـذ", makhraj:"Dents+langue", tip:"Comme le 'th' anglais dans 'this'. Langue entre les dents, avec voix." },
  { letter:"ر", name:"Ra",  trans:"r",  isolated:"ر", initial:"رـ", medial:"ـرـ", final:"ـر", makhraj:"Langue", tip:"Roulé apical. Pointe de la langue vibre contre les alvéoles." },
  { letter:"ز", name:"Zay", trans:"z",  isolated:"ز", initial:"زـ", medial:"ـزـ", final:"ـز", makhraj:"Dents+langue", tip:"Sifflante sonore. Identique au 'z' français." },
  { letter:"س", name:"Sîn", trans:"s",  isolated:"س", initial:"سـ", medial:"ـسـ", final:"ـس", makhraj:"Dents+langue", tip:"Sifflante sourde fine. Langue derrière les dents, pas d'emphase." },
  { letter:"ش", name:"Chîn",trans:"sh", isolated:"ش", initial:"شـ", medial:"ـشـ", final:"ـش", makhraj:"Palais", tip:"Chuintante comme 'ch' en français. Palais antérieur." },
  { letter:"ص", name:"Ṣad", trans:"ṣ",  isolated:"ص", initial:"صـ", medial:"ـصـ", final:"ـص", makhraj:"Dents+langue", tip:"'S' emphatique. Langue basse, gorge contractée, son grave." },
  { letter:"ض", name:"Ḍad", trans:"ḍ",  isolated:"ض", initial:"ضـ", medial:"ـضـ", final:"ـض", makhraj:"Langue", tip:"Latérale emphatique unique à l'arabe. Bords de la langue touche les molaires." },
  { letter:"ط", name:"Ṭa",  trans:"ṭ",  isolated:"ط", initial:"طـ", medial:"ـطـ", final:"ـط", makhraj:"Dents+langue", tip:"'T' emphatique. Langue contre les dents supérieures, gorge contractée." },
  { letter:"ظ", name:"Ẓa",  trans:"ẓ",  isolated:"ظ", initial:"ظـ", medial:"ـظـ", final:"ـظ", makhraj:"Dents+langue", tip:"'Dh' emphatique. Comme ذ mais avec emphase, son grave et profond." },
  { letter:"ع", name:"Ayn", trans:"ʿ",  isolated:"ع", initial:"عـ", medial:"ـعـ", final:"ـع", makhraj:"Gorge", tip:"Pharyngale sonore. Constriction pharyngale, son vocalique profond." },
  { letter:"غ", name:"Ghayn",trans:"gh",isolated:"غ", initial:"غـ", medial:"ـغـ", final:"ـغ", makhraj:"Gorge", tip:"Uvulaire fricative sonore. Comme un 'r' parisien ou guttural." },
  { letter:"ف", name:"Fa",  trans:"f",  isolated:"ف", initial:"فـ", medial:"ـفـ", final:"ـف", makhraj:"Lèvres+dents", tip:"Labiodentale sourde. Identique au 'f' français." },
  { letter:"ق", name:"Qaf", trans:"q",  isolated:"ق", initial:"قـ", medial:"ـقـ", final:"ـق", makhraj:"Gorge", tip:"Occlusive uvulaire sourde. Plus en arrière que 'k', depuis la luette." },
  { letter:"ك", name:"Kaf", trans:"k",  isolated:"ك", initial:"كـ", medial:"ـكـ", final:"ـك", makhraj:"Palais", tip:"Vélaire sourde. Identique au 'k' français." },
  { letter:"ل", name:"Lam", trans:"l",  isolated:"ل", initial:"لـ", medial:"ـلـ", final:"ـل", makhraj:"Langue", tip:"Latérale alvéolaire. Identique au 'l' français mais plus clair." },
  { letter:"م", name:"Mîm", trans:"m",  isolated:"م", initial:"مـ", medial:"ـمـ", final:"ـم", makhraj:"Lèvres", tip:"Nasale bi-labiale. Identique au 'm' français." },
  { letter:"ن", name:"Nûn", trans:"n",  isolated:"ن", initial:"نـ", medial:"ـنـ", final:"ـن", makhraj:"Langue", tip:"Nasale alvéolaire. Identique au 'n' français." },
  { letter:"ه", name:"Ha",  trans:"h",  isolated:"ه", initial:"هـ", medial:"ـهـ", final:"ـه", makhraj:"Gorge", tip:"Glottale. Souffle doux depuis la gorge, comme un soupir." },
  { letter:"و", name:"Waw", trans:"w/û",isolated:"و", initial:"وـ", medial:"ـوـ", final:"ـو", makhraj:"Lèvres", tip:"Semi-consonne ou voyelle longue 'OU'. Lèvres arrondies." },
  { letter:"ي", name:"Ya",  trans:"y/î",isolated:"ي", initial:"يـ", medial:"ـيـ", final:"ـي", makhraj:"Palais", tip:"Semi-consonne ou voyelle longue 'I'. Palais antérieur." },
  { letter:"ا", name:"Alif",trans:"â/ā",isolated:"ا", initial:"اـ", medial:"ـاـ", final:"ـا", makhraj:"Gorge", tip:"Voyelle longue 'A' ou support de hamza. Ouverte centrale." },
  { letter:"أ", name:"Hamza",trans:"ʾ", isolated:"أ", initial:"أـ", medial:"ـأـ", final:"ـأ", makhraj:"Gorge", tip:"Occlusive glottale. Coupure de la voix, comme dans 'oh oh!'." },
];

const HARAKATS = [
  { arabic:"بَ", name:"Fatḥa",     sign:"َ",  desc:"Voyelle courte A",    color:"var(--gold2)",  synth:"ba" },
  { arabic:"بِ", name:"Kasra",     sign:"ِ",  desc:"Voyelle courte I",    color:"var(--teal2)",  synth:"bi" },
  { arabic:"بُ", name:"Ḍamma",     sign:"ُ",  desc:"Voyelle courte OU",   color:"var(--green2)", synth:"bou" },
  { arabic:"بْ", name:"Soukoun",   sign:"ْ",  desc:"Consonne sans voyelle",color:"var(--text2)",  synth:"b" },
  { arabic:"بّ", name:"Chadda",    sign:"ّ",  desc:"Consonne doublée",    color:"var(--red)",    synth:"bb" },
  { arabic:"بً", name:"Tanwîn Fatḥ",sign:"ً",desc:"AN final (indéfini)",  color:"var(--gold)",   synth:"ban" },
  { arabic:"بٍ", name:"Tanwîn Kasr",sign:"ٍ",desc:"IN final (indéfini)",  color:"var(--teal)",   synth:"bin" },
  { arabic:"بٌ", name:"Tanwîn Ḍamm",sign:"ٌ",desc:"OUN final (indéfini)", color:"var(--green)",  synth:"boun" },
  { arabic:"آ",  name:"Madda",     sign:"ٓ",  desc:"Alif avec allongement",color:"var(--gold3)",  synth:"aa" },
];
