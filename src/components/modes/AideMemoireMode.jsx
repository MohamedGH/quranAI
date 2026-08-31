import React, { useState, useEffect, useMemo } from "react";
import { fetchAyahMeta } from "../../utils/reciterAudio.js";
import { SAJDA_AYATS, PAGE_POSITION_LABELS } from "../../utils/arabicUtils.js";
import { normalizeArabic as normalizeAr } from "../../utils/recitationDiff.js";

export function AideMemoireMode({ ayat, surahNum, ld, setLData, clickMode, setClickMode, spellCheck = true }) {
  const [meta, setMeta] = useState(null); // { page, hizbQuarter, juz, manzil, ruku, sajda }
  const [metaError, setMetaError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAyahMeta(surahNum, ayat.numberInSurah)
      .then(a => {
        if (cancelled) return;
        if (a) setMeta({
          page: a.page, hizbQuarter: a.hizbQuarter, juz: a.juz,
          manzil: a.manzil, ruku: a.ruku, sajda: a.sajda,
        });
        else setMetaError(true);
      })
      .catch(() => { if (!cancelled) setMetaError(true); });
    return () => { cancelled = true; };
  }, [surahNum, ayat.numberInSurah]);

  const isSajdaAyat = SAJDA_AYATS.has(`${surahNum}:${ayat.numberInSurah}`);
  const hizb = meta ? Math.ceil(meta.hizbQuarter / 4) : null;
  const hizbQ = meta ? ((meta.hizbQuarter - 1) % 4) + 1 : null;
  const hizbQLabels = ['¼ début','½ milieu','¾ fin','fin'];

  // User data
  const pagePos  = ld?.pagePosition  ?? null;
  const subject  = ld?.subject       ?? '';
  const highlight= ld?.highlight     ?? '';
  const [editSubject,   setEditSubject]   = useState(false);
  const [subjectVal,   setSubjectVal]   = useState(ld?.subject||'');

  const save = (key, val) => setLData(surahNum, ayat.numberInSurah, d => ({ ...d, [key]: val }));

  // Toggle a word in the highlight set by index
  const highlightIndices = useMemo(() => {
    const set = new Set();
    if (!highlight?.trim()) return set;
    highlight.trim().split(/\s+/).forEach(w => {
      const norm = normalizeAr(w);
      ayat.text.split(' ').forEach((aw, i) => { if (normalizeAr(aw) === norm) set.add(i); });
    });
    return set;
  }, [highlight, ayat.text]);

  const toggleHighlightWord = (idx) => {
    const words = ayat.text.split(' ');
    const newSet = new Set(highlightIndices);
    newSet.has(idx) ? newSet.delete(idx) : newSet.add(idx);
    const newHighlight = [...newSet].map(i => words[i]).join(' ') || null;
    save('highlight', newHighlight);
  };

  // Highlight words in text — words are now clickable
  const unknownSet = useMemo(() => new Set(ld?.unknownWords||[]), [ld?.unknownWords]);

  const renderHighlighted = (clickable = false) => {
    const arr = ayat.text.split(' ');
    return (
      <span style={{fontFamily:"'Amiri Quran',serif",fontSize:22,direction:'rtl',lineHeight:1.8}}>
        {arr.map((w,i) => {
          const norm = normalizeAr(w);
          const hit  = highlightIndices.has(i) || (highlight?.trim() && highlight.trim().split(/\s+/).some(hw => normalizeAr(hw) && norm.includes(normalizeAr(hw)) && !clickable));
          const unk  = unknownSet.has(i);
          return (
            <span key={i}
              onClick={clickable ? () => toggleHighlightWord(i) : undefined}
              style={{
                color: unk ? '#ff7eb3' : hit ? '#ffd166' : 'var(--gold)',
                textShadow: unk ? '0 0 8px rgba(255,126,179,.5)' : hit ? '0 0 8px rgba(255,209,102,.6)' : 'none',
                cursor: clickable ? 'pointer' : 'default',
                borderRadius: (clickable || unk) ? 4 : 0,
                padding: (clickable || unk) ? '0 2px' : 0,
                background: unk ? 'rgba(255,126,179,.12)' : clickable && hit ? 'rgba(255,209,102,.12)' : 'transparent',
                display: 'inline',
                textDecoration: unk ? 'underline dotted #ff7eb3' : 'none',
              }}>
              {w}{i<arr.length-1?' ':''}
            </span>
          );
        })}
      </span>
    );
  };

  const chip = (active, color, onClick, label, key) => (
    <button key={key ?? label} onClick={onClick} style={{
      fontSize:8, letterSpacing:1, padding:'5px 11px', borderRadius:20, cursor:'pointer',
      border:`1px solid ${active ? color : 'var(--border2)'}`,
      background: active ? `${color}22` : 'transparent',
      color: active ? color : 'var(--text3)',
      fontFamily:"'Cinzel',serif", transition:'all .2s'
    }}>{label}</button>
  );

  return (
    <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:16}}>

      {/* Métadonnées Mushaf */}
      <div>
        <div style={{fontSize:9,letterSpacing:2,color:'var(--text3)',marginBottom:8}}>POSITION DANS LE MUSHAF</div>
        {!meta && !metaError && <div style={{fontSize:9,color:'var(--text3)'}}>Chargement…</div>}
        {metaError && <div style={{fontSize:9,color:'#ff6b6b'}}>Impossible de charger les métadonnées</div>}
        {meta && (
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {[
              {label:'PAGE',  val:meta.page,        color:'#c878ff'},
              {label:'JUZ',   val:meta.juz,          color:'#5bc8f5'},
              {label:'HIZB',  val:hizb,              color:'#ffd166'},
              {label:'¼ HIZB',val:hizbQ ? `${hizbQ}/4 — ${hizbQLabels[hizbQ-1]}` : null, color:'#ff9f43'},
              {label:'MANZIL',val:meta.manzil,       color:'#4caf81'},
              {label:'RUKÛ',  val:meta.ruku,         color:'#f09de0'},
            ].filter(m=>m.val!=null).map(({label,val,color})=>(
              <div key={label} style={{background:'var(--surface3)',borderRadius:'var(--radius-sm)',padding:'6px 12px',textAlign:'center',minWidth:64}}>
                <div style={{fontSize:14,color,fontFamily:"'Cinzel',serif",fontWeight:700}}>{val}</div>
                <div style={{fontSize:7,letterSpacing:1.5,color:'var(--text3)',marginTop:2}}>{label}</div>
              </div>
            ))}
            {isSajdaAyat && (
              <div style={{background:'rgba(255,126,179,.12)',border:'1px solid #ff7eb3',borderRadius:'var(--radius-sm)',padding:'6px 12px',textAlign:'center',alignSelf:'flex-start'}}>
                <div style={{fontSize:12,color:'#ff7eb3'}}>سجدة</div>
                <div style={{fontSize:7,letterSpacing:1.5,color:'#ff7eb3',marginTop:2}}>SAJDA</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Position dans la page */}
      <div>
        <div style={{fontSize:9,letterSpacing:2,color:'var(--text3)',marginBottom:6}}>POSITION DANS LA PAGE</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {PAGE_POSITION_LABELS.filter(p=>p.key!==null).map(({key,label,color})=>
            chip(pagePos===key, color, ()=>save('pagePosition', pagePos===key?null:key), label)
          )}
        </div>
        {pagePos && <div style={{fontSize:8,color:'var(--text3)',marginTop:4}}>
          Position : <span style={{color:PAGE_POSITION_LABELS.find(p=>p.key===pagePos)?.color}}>{PAGE_POSITION_LABELS.find(p=>p.key===pagePos)?.label}</span>
        </div>}
      </div>

      {/* Sujet */}
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <div style={{fontSize:9,letterSpacing:2,color:'var(--text3)'}}>SUJET</div>
          <button onClick={()=>{setEditSubject(!editSubject);setSubjectVal(ld?.subject||'');}}
            style={{fontSize:8,letterSpacing:1,padding:'3px 10px',border:'1px solid var(--border2)',background:'transparent',color:'var(--text3)',borderRadius:12,cursor:'pointer',fontFamily:"'Cinzel',serif"}}>
            {editSubject?'FERMER':'MODIFIER'}
          </button>
        </div>
        {editSubject ? (
          <div style={{display:'flex',gap:6}}>
            <input value={subjectVal} onChange={e=>setSubjectVal(e.target.value)} spellCheck={spellCheck} lang="fr"
              placeholder="ex: Tawakkul, Dua, Jugement dernier…"
              style={{flex:1,background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:'var(--radius-sm)',padding:'6px 10px',color:'var(--text)',fontSize:11,fontFamily:'sans-serif',outline:'none'}}/>
            <button onClick={()=>{save('subject',subjectVal.trim()||null);setEditSubject(false);}}
              style={{padding:'6px 14px',fontSize:9,letterSpacing:1,fontFamily:"'Cinzel',serif",background:'transparent',border:'1px solid var(--gold)',color:'var(--gold)',borderRadius:'var(--radius-sm)',cursor:'pointer'}}>
              OK
            </button>
          </div>
        ) : (
          <div style={{fontSize:12,color:subject?'var(--text2)':'var(--text3)',fontStyle:subject?'normal':'italic'}}>
            {subject||'Aucun sujet défini'}
          </div>
        )}
      </div>

    </div>
  );
}


// ─── RevisionEcritureMode ─────────────────────────────────────────────────────
