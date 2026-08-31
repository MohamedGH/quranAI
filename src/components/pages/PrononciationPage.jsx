import { ARABIC_LETTERS, HARAKATS } from "../../utils/arabicUtils.js";
import React, { useState, useEffect, useRef } from "react";

export function PrononciationPage() {
  const [tab, setTab]           = useState("lettres"); // lettres | harakat | tajwid
  const [selected, setSelected] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const synthRef = useRef(null);

  const speak = (text, id, lang = "ar-SA") => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 0.6;
    utt.pitch = 1;
    setPlayingId(id);
    utt.onend  = () => setPlayingId(null);
    utt.onerror= () => setPlayingId(null);
    synthRef.current = utt;
    window.speechSynthesis.speak(utt);
  };

  const stopSpeak = () => {
    window.speechSynthesis?.cancel();
    setPlayingId(null);
  };

  const sel = selected !== null ? ARABIC_LETTERS[selected] : null;

  return (
    <main className="main" style={{background:"var(--bg)"}}>
      <div style={{padding:"14px 28px 0",borderBottom:"1px solid var(--border)",flexShrink:0,display:"flex",alignItems:"center",gap:12,background:"linear-gradient(180deg,var(--surface),var(--bg))"}}>
        <div style={{fontFamily:"'Amiri Quran',serif",fontSize:22,color:"var(--gold)",direction:"rtl",opacity:.8}}>الحروف العربية</div>
        <div style={{flex:1}}/>
        <div style={{fontSize:9,letterSpacing:2,color:"var(--text3)"}}>CLIQUEZ · ÉCOUTEZ · PRATIQUEZ</div>
      </div>

      <div style={{padding:"0 28px",borderBottom:"1px solid var(--border)",flexShrink:0,background:"var(--surface)"}}>
        <div className="pronon-nav-tabs">
          {[["lettres","🔤 LETTRES"],["harakat","◌ VOYELLES & SIGNES"],["tajwid","📚 TAJWID"]].map(([k,label])=>(
            <button key={k} className={`pronon-nav-tab${tab===k?" active":""}`} onClick={()=>{setTab(k);setSelected(null);stopSpeak();}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pronon-page">
        {/* ── LETTRES TAB ── */}
        {tab==="lettres" && (
          <div className="pronon-two-col">
            <div>
              <div className="pronon-section-title">LES 29 LETTRES DE L'ALPHABET ARABE</div>
              <div className="pronon-grid">
                {ARABIC_LETTERS.map((l, i) => (
                  <div key={i}
                    className={`pronon-card${selected===i?" selected":""}${playingId===`letter-${i}`?" playing":""}`}
                    onClick={() => { setSelected(i); speak(l.letter, `letter-${i}`); }}>
                    <div className="pronon-letter">{l.letter}</div>
                    <div className="pronon-letter-name">{l.name.toUpperCase()}</div>
                    <div className="pronon-letter-trans">/{l.trans}/</div>
                    {playingId===`letter-${i}` && (
                      <div style={{position:"absolute",top:6,right:6,width:6,height:6,borderRadius:"50%",background:"var(--teal)",animation:"pulse-dot 1s infinite"}}/>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              {sel ? (
                <div className="pronon-detail-panel">
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div className="pronon-makhraj-tag">📍 {sel.makhraj}</div>
                    <button
                      className={`pronon-play-btn${playingId===`letter-${selected}`?" playing":""}`}
                      onClick={()=>playingId===`letter-${selected}`?stopSpeak():speak(sel.letter,`letter-${selected}`)}>
                      {playingId===`letter-${selected}`?"⏹ STOP":"▶ ÉCOUTER"}
                    </button>
                  </div>
                  <div className="pronon-detail-letter">{sel.letter}</div>
                  <div className="pronon-detail-name">{sel.name.toUpperCase()} · /{sel.trans}/</div>

                  <div className="pronon-section-title" style={{marginBottom:8}}>FORMES SELON LA POSITION</div>
                  <div className="pronon-detail-forms">
                    {[["Isolée",sel.isolated],["Initiale",sel.initial],["Médiane",sel.medial],["Finale",sel.final]].map(([pos,form])=>(
                      <div key={pos} className="pronon-form-item"
                        onClick={()=>speak(form,`form-${pos}`)}>
                        <div className="pronon-form-arabic">{form}</div>
                        <div className="pronon-form-label">{pos.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>

                  <div className="pronon-section-title" style={{marginBottom:8}}>AVEC VOYELLES</div>
                  <div className="pronon-detail-harakats">
                    {HARAKATS.slice(0,4).map((h, hi) => {
                      const withH = sel.letter + h.sign;
                      const pid = `detail-h-${selected}-${hi}`;
                      return (
                        <div key={hi} className={`pronon-detail-hbtn${playingId===pid?" playing":""}`}
                          onClick={()=>speak(withH, pid)}>
                          <div className="pronon-detail-hbtn-arabic">{withH}</div>
                          <div className="pronon-detail-hbtn-name">{h.name.toUpperCase()}</div>
                          <div className="pronon-detail-hbtn-desc">{h.desc}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pronon-tip-box">
                    💡 <strong>Articulation :</strong> {sel.tip}
                  </div>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"300px",gap:16,color:"var(--text3)"}}>
                  <div style={{fontFamily:"'Amiri Quran',serif",fontSize:48,opacity:.3,direction:"rtl"}}>ب ت ث</div>
                  <div style={{fontSize:10,letterSpacing:2}}>CLIQUEZ SUR UNE LETTRE</div>
                  <div style={{fontSize:9,letterSpacing:1,color:"var(--text3)",opacity:.7}}>POUR VOIR LES DÉTAILS ET ÉCOUTER</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HARAKAT TAB ── */}
        {tab==="harakat" && (
          <>
            <div>
              <div className="pronon-section-title">VOYELLES COURTES (حَرَكَات)</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
                {HARAKATS.map((h, hi) => (
                  <div key={hi}
                    className={`pronon-harakat-btn${playingId===`harak-${hi}`?" playing":""}`}
                    onClick={()=>speak(h.arabic,`harak-${hi}`)}>
                    <div className="pronon-harakat-arabic" style={{color:h.color}}>{h.arabic}</div>
                    <div className="pronon-harakat-name">{h.name.toUpperCase()}</div>
                    <div className="pronon-harakat-desc">{h.desc}</div>
                    {playingId===`harak-${hi}` && <div style={{fontSize:8,color:"var(--teal)",letterSpacing:1,marginTop:2}}>▶ EN COURS</div>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="pronon-section-title">ENTRAÎNEMENT AVEC ب (Ba)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                {HARAKATS.map((h, hi) => {
                  const pid = `train-${hi}`;
                  return (
                    <div key={hi}
                      style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"14px 18px",
                        background:playingId===pid?"rgba(62,184,160,.08)":"var(--surface2)",
                        border:`1px solid ${playingId===pid?"var(--teal)":"var(--border)"}`,
                        borderRadius:10,cursor:"pointer",transition:"all .2s",minWidth:90}}
                      onClick={()=>speak("ب"+h.sign,"train-"+hi)}>
                      <div style={{fontFamily:"'Amiri Quran',serif",fontSize:34,color:h.color,direction:"rtl"}}>{"ب"+h.sign}</div>
                      <div style={{fontSize:8,letterSpacing:1,color:"var(--text3)",fontFamily:"'Cinzel',serif"}}>{h.name.toUpperCase()}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="pronon-section-title">VOYELLES LONGUES (حُرُوف الْمَدّ)</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {[
                  {arabic:"بَا", name:"Alif + Fatḥa", desc:"Son 'Â' long (ex: كَافِرُون)", color:"var(--gold2)", synth:"بَا"},
                  {arabic:"بِي", name:"Ya + Kasra",   desc:"Son 'Î' long (ex: كِيلَ)", color:"var(--teal2)", synth:"بِي"},
                  {arabic:"بُو", name:"Waw + Ḍamma",  desc:"Son 'Û' long (ex: نُوحٌ)", color:"var(--green2)", synth:"بُو"},
                ].map((v,vi)=>(
                  <div key={vi}
                    style={{flex:"1 1 140px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,
                      padding:"18px",background:"var(--surface2)",border:`1px solid ${playingId===`long-${vi}`?"var(--teal)":"var(--border)"}`,
                      borderRadius:10,cursor:"pointer",transition:"all .2s"}}
                    onClick={()=>speak(v.synth,`long-${vi}`)}>
                    <div style={{fontFamily:"'Amiri Quran',serif",fontSize:36,color:v.color,direction:"rtl"}}>{v.arabic}</div>
                    <div style={{fontSize:9,letterSpacing:1.5,color:"var(--text2)",fontFamily:"'Cinzel',serif"}}>{v.name.toUpperCase()}</div>
                    <div style={{fontSize:9,color:"var(--text3)",textAlign:"center"}}>{v.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── TAJWID TAB ── */}
        {tab==="tajwid" && (
          <>
            <div>
              <div className="pronon-section-title">RÈGLES DE BASE DU TAJWID (تجويد)</div>
              {[
                {name:"NUN SAKIN & TANWÎN — Iẓhâr (إظهار)",arabic:"أَنْعَمْتَ",desc:"Prononciation claire du Nûn quand il est suivi de ء ه ع غ ح خ. On entend le 'n' distinctement.", color:"var(--gold)"},
                {name:"NUN SAKIN & TANWÎN — Idghâm (إدغام)",arabic:"مَنْ يَعْمَلُ",desc:"Fusion du Nûn dans la lettre suivante (ي ن م و ل ر). Le 'n' disparaît dans la consonne suivante.", color:"var(--teal)"},
                {name:"NUN SAKIN & TANWÎN — Iqlab (إقلاب)",arabic:"أَنْبِيَاء",desc:"Transformation du Nûn en Mîm nasale devant la lettre ب. 'nb' devient 'm' nasal.", color:"var(--green)"},
                {name:"NUN SAKIN & TANWÎN — Ikhfâ (إخفاء)",arabic:"مَنْ كَانَ",desc:"Nasalisation partielle du Nûn devant 15 lettres. Son intermédiaire entre Iẓhâr et Idghâm.", color:"var(--gold2)"},
                {name:"MADD — Allongement naturel (مَدّ طَبِيعِي)",arabic:"قَالَ",desc:"Allongement de 2 temps sur ا و ي quand précédé de sa voyelle correspondante.", color:"var(--teal2)"},
                {name:"MADD — Allongement obligatoire (مَدّ وَاجِب)",arabic:"جَاءَ",desc:"Allongement de 4-5 temps quand les lettres de madd sont suivies d'une hamza dans le même mot.", color:"var(--gold3)"},
                {name:"QALQALAH (قَلْقَلَة)",arabic:"يَقْطَعُ",desc:"Légère vibration sur les lettres ق ط ب ج د portant un soukoun. Son rebondissant.", color:"var(--red)"},
              ].map((rule,ri)=>(
                <div key={ri} style={{marginBottom:12,padding:"14px 18px",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,borderLeft:`3px solid ${rule.color}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:1.5,color:rule.color,flex:1}}>{rule.name}</div>
                    <div
                      style={{fontFamily:"'Amiri Quran',serif",fontSize:22,color:"var(--gold2)",direction:"rtl",cursor:"pointer",padding:"4px 10px",background:playingId===`tajwid-${ri}`?"rgba(62,184,160,.1)":"var(--surface3)",borderRadius:6,border:`1px solid ${playingId===`tajwid-${ri}`?"var(--teal)":"var(--border2)"}`}}
                      onClick={()=>speak(rule.arabic,`tajwid-${ri}`)}>
                      {rule.arabic}
                    </div>
                  </div>
                  <div style={{fontSize:10,color:"var(--text2)",lineHeight:1.6}}>{rule.desc}</div>
                </div>
              ))}
            </div>

            <div className="pronon-tip-box" style={{marginTop:4}}>
              🎓 <strong>Conseil :</strong> Cliquez sur les exemples arabes pour les entendre. Pour une maîtrise complète du tajwid, pratiquez avec un récitateur qualifié et utilisez la page Coran pour écouter Al-Afasy.
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ─── AYAT COLLECTIONS TAB (inside submenu) ───────────────────────────────────
