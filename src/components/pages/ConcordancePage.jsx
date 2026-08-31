const normalizeAr = (s) => normalizeArabic(s);
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";
import { normalizeArabic } from "../../utils/recitationDiff.js";
import { splitArabicWords, stripDiacritics, wordTranslit, ARABIC_ROOTS, SURAH_INFO, SUGGESTED_SEARCHES } from "../../utils/arabicUtils.js";
import { fetchSurahSimple, fetchSurahs } from "../../utils/reciterAudio.js";


function ConcordGroup({ group, debouncedQ, onNavigate, isLinked, toggleLink, textCache, onOpenCollModal, ayatInCollectionsFn }) {
  const [open, setOpen] = useState(true);
  const [ayatsWithText, setAyatsWithText] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadText() {
      if (textCache.current[group.surahNum]) {
        setAyatsWithText(group.ayats.map(a => ({
          ...a,
          text: textCache.current[group.surahNum][a.numberInSurah] || a.text || ''
        })));
        return;
      }
      setLoading(true);
      try {
        const textMap = await fetchSurahSimple(group.surahNum);
        textCache.current[group.surahNum] = textMap;
        if (!cancelled) {
          setAyatsWithText(group.ayats.map(a => ({
            ...a,
            text: textMap[a.numberInSurah] || a.text || ''
          })));
        }
      } catch (e) {
        if (!cancelled) setAyatsWithText(group.ayats);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadText();
    return () => { cancelled = true; };
  }, [group, debouncedQ]);

  const highlightText = (txt) => {
    if (!debouncedQ || !txt) return txt;
    const qNorm = normalizeArabic(debouncedQ);
    const words = txt.split(' ');
    return words.map((w, i) => {
      const match = normalizeArabic(w).includes(qNorm) || qNorm.includes(normalizeArabic(w));
      return (
        <span key={i} style={{ color: match ? 'var(--gold2)' : undefined, background: match ? 'rgba(201,168,76,.15)' : undefined, padding: match ? '1px 3px' : undefined, borderRadius: 3 }}>
          {w}{' '}
        </span>
      );
    });
  };

  return (
    <div className="concord-surah-group" style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', cursor:'pointer', background:'var(--surface3)' }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:10, fontFamily:"'Cinzel',serif", color:'var(--gold2)' }}>{group.surahNum}. {group.surahEn}</span>
          <span style={{ fontSize:9, color:'var(--text3)' }}>({group.ayats.length} verset{group.ayats.length > 1 ? 's' : ''})</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:16, color:'var(--gold)' }}>{group.surahAr}</span>
          <span style={{ fontSize:10, color:'var(--text3)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, padding:10 }}>
          {loading ? (
            <div style={{ padding:10, textAlign:'center', color:'var(--text3)', fontSize:9 }}>Chargement des textes…</div>
          ) : (
            (ayatsWithText.length ? ayatsWithText : group.ayats).map(ayat => {
              const linked = isLinked ? isLinked(group.surahNum, ayat.numberInSurah) : false;
              const inColls = ayatInCollectionsFn ? ayatInCollectionsFn(group.surahNum, ayat.numberInSurah) : [];
              return (
                <div
                  key={ayat.numberInSurah}
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--surface)', borderRadius:8, border:'1px solid var(--border2)', gap:10 }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <button
                      onClick={() => onNavigate(group.surahNum, ayat.numberInSurah)}
                      style={{ fontSize:9, fontFamily:"'Cinzel',serif", padding:'4px 8px', borderRadius:6, background:'rgba(201,168,76,.12)', border:'1px solid var(--gold)', color:'var(--gold2)', cursor:'pointer' }}
                    >
                      {ayat.numberInSurah} ↗
                    </button>
                    {toggleLink && (
                      <button
                        onClick={() => toggleLink(group.surahNum, group.surahEn, ayat.numberInSurah, ayat.text)}
                        style={{ fontSize:10, padding:'3px 6px', borderRadius:6, background: linked ? 'rgba(91,200,245,.2)' : 'transparent', border:'1px solid ' + (linked ? '#5bc8f5' : 'var(--border2)'), color: linked ? '#5bc8f5' : 'var(--text3)', cursor:'pointer' }}
                        title="Lier ce verset"
                      >
                        🔗
                      </button>
                    )}
                    {onOpenCollModal && (
                      <button
                        onClick={() => onOpenCollModal(group.surahNum, ayat.numberInSurah)}
                        style={{ fontSize:10, padding:'3px 6px', borderRadius:6, background: inColls.length ? 'rgba(200,120,255,.2)' : 'transparent', border:'1px solid ' + (inColls.length ? '#c878ff' : 'var(--border2)'), color: inColls.length ? '#c878ff' : 'var(--text3)', cursor:'pointer' }}
                        title="Ajouter à une collection"
                      >
                        📁
                      </button>
                    )}
                  </div>
                  <div style={{ flex:1, direction:'rtl', fontFamily:"'Amiri Quran',serif", fontSize:18, color:'var(--text)', textAlign:'right', lineHeight:1.8 }}>
                    {highlightText(ayat.text)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}



function SharedGroup({ group, sharedN, searchMode, onNavigate, toggleLink, isLinked, onOpenCollModal }) {
  const [open, setOpen] = useState(false);
  const surahs = useSelector(sel.surahs);

  const getSurahInfo = (sn) => {
    const s = surahs?.find(x => x.number === sn);
    return s ? { name: s.name, englishName: s.englishName } : { name: `Sourate ${sn}`, englishName: `Surah ${sn}` };
  };

  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom: 8 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', cursor:'pointer', background:'var(--surface3)' }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16, fontFamily:"'Amiri Quran',serif", color:'var(--gold2)', direction:'rtl' }}>{group.seq}</span>
          <span style={{ fontSize:9, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>({group.count} versets)</span>
        </div>
        <span style={{ fontSize:10, color:'var(--text3)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, padding:10 }}>
          {group.ayats.map((ayat, idx) => {
            const sInfo = getSurahInfo(ayat.sn);
            const linked = isLinked ? isLinked(ayat.sn, ayat.num) : false;
            return (
              <div
                key={idx}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--surface)', borderRadius:8, border:'1px solid var(--border2)', gap:10 }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  <button
                    onClick={() => onNavigate(ayat.sn, ayat.num)}
                    style={{ fontSize:9, fontFamily:"'Cinzel',serif", padding:'4px 8px', borderRadius:6, background:'rgba(201,168,76,.12)', border:'1px solid var(--gold)', color:'var(--gold2)', cursor:'pointer' }}
                  >
                    {sInfo.englishName} · {ayat.num}
                  </button>
                  {toggleLink && (
                    <button
                      onClick={() => toggleLink(ayat.sn, sInfo.englishName, ayat.num, ayat.text)}
                      style={{ fontSize:11, padding:'4px 7px', borderRadius:6, background: linked ? 'rgba(201,168,76,.2)' : 'transparent', border:'1px solid var(--border2)', color: linked ? 'var(--gold2)' : 'var(--text3)', cursor:'pointer' }}
                      title={linked ? "Retirer le lien" : "Lier cet ayat"}
                    >
                      🔗
                    </button>
                  )}
                </div>
                <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:16, color:'var(--text)', direction:'rtl', textAlign:'right', flex:1 }}>
                  {ayat.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ConcordancePage({ surahs: surahList, onNavigate, collections, onOpenCollModal, ayatInCollectionsFn, initialQuery }) {
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
  // groups = [{surahNum, surahEn, surahAr, count, fuzzy}] — PAS les ayats
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
  const listRef        = useRef(null); // ref sur le conteneur de résultats

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

  // Fetch texte brut d'une sourate (cache léger — texte seul, pas d'audio)
  const fetchSurahText = useCallback(async (num) => {
    if (cacheRef.current[num]) return cacheRef.current[num];
    const ayats = await fetchSurahSimple(num);
    cacheRef.current[num] = ayats;
    return ayats;
  }, []);

  // Phase 1 : scan léger — détermine quelles sourates contiennent le mot
  // Charge le texte sans audio (endpoint plus léger), pas les ayats complets
  useEffect(() => {
    if (!debouncedQ.trim()) { setGroups([]); setLoading(false); return; }
    const normQ = normalizeAr(debouncedQ.trim());
    if (normQ.length < 2) { setGroups([]); return; }

    const token = ++searchTokenRef.current;
    setGroups([]);
    setLoading(true);

    const surahsToSearch = getsurahsToSearch(surahFilter);

    const BATCH = 5; // plus rapide pour le scan léger
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
        // L'ayat (normalisé) commence par exactement ces mots
        const qWords = q.split(/\s+/).filter(Boolean);
        const tWords = t.split(/\s+/).filter(Boolean);
        return qWords.every((w, i) => tWords[i] !== undefined && (tWords[i] === w || tWords[i].startsWith(w)));
      }
      if (endMode) {
        // L'ayat (normalisé) se termine par exactement ces mots
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

  // ── Modes shared-* : grouper les ayats par séquence de N mots identiques ──
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
      // shared-contain: toutes les sous-séquences de N mots consécutifs
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

      // Phase 2: grouper par séquence
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

      // Phase 3: garder uniquement les séquences partagées par ≥2 ayats
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
          <button className={`concord-mode-tab${searchMode==="exact"?" active":""}`} onClick={()=>setSearchMode("exact")} title="Correspondance exacte n'importe où dans le mot">EXACT</button>
          <button className={`concord-mode-tab${searchMode==="word"?" active":""}`} onClick={()=>setSearchMode("word")} title="Mot entier — premier ou dernier mot de l'ayat inclus">MOT</button>
          <button className={`concord-mode-tab${searchMode==="fuzzy"?" active":""}`} onClick={()=>setSearchMode("fuzzy")} title="Tous les mots de la recherche présents dans l'ayat">FLOU</button>
          <button className={`concord-mode-tab${searchMode==="start"?" active":""}`} onClick={()=>setSearchMode("start")} title="L'ayat commence par ces mots">DÉBUT</button>
          <button className={`concord-mode-tab${searchMode==="end"?" active":""}`} onClick={()=>setSearchMode("end")} title="L'ayat se termine par ces mots">FIN</button>
          <button className={`concord-mode-tab${searchMode==="shared-start"?" active":""}`} onClick={()=>setSearchMode("shared-start")} title="Ayats partageant les mêmes N premiers mots">DÉBUT COMMUN</button>
          <button className={`concord-mode-tab${searchMode==="shared-end"?" active":""}`} onClick={()=>setSearchMode("shared-end")} title="Ayats partageant les mêmes N derniers mots">FIN COMMUNE</button>
          <button className={`concord-mode-tab${searchMode==="shared-contain"?" active":""}`} onClick={()=>setSearchMode("shared-contain")} title="Ayats partageant une séquence de N mots identiques">SÉQUENCE</button>
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
              : `${surahFilter instanceof Set ? surahFilter.size : 1} SOURATE${(surahFilter instanceof Set?surahFilter.size:1)>1?'S':''} SÉLECTIONNÉE${(surahFilter instanceof Set?surahFilter.size:1)>1?'S':''}`}
            <span style={{marginLeft:'auto',fontSize:8,color:'var(--text3)'}}>{surahPickerOpen?'▲':'▼'}</span>
          </button>
          {surahPickerOpen && (
            <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:200,background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:'var(--radius-sm)',boxShadow:'0 8px 24px rgba(0,0,0,.4)',width:260,maxHeight:320,display:'flex',flexDirection:'column'}}>
              <div style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)',display:'flex',gap:6}}>
                <input value={surahPickerSearch} onChange={e=>setSurahPickerSearch(e.target.value)}
                  placeholder="Filtrer sourates…"
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
                        {sel && <span style={{fontSize:8,color:'var(--surface)',lineHeight:1}}>✓</span>}
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
              ANALYSE DU CORPUS…
            </div>
          )}
          {!sharedLoading && sharedGroups.length === 0 && (
            <div style={{padding:'16px 20px',fontSize:9,letterSpacing:1.5,color:'var(--text3)',fontFamily:"'Cinzel',serif',textAlign:'center"}}>
              AUCUN AYAT NE PARTAGE {sharedN} MOT{sharedN>1?'S':''} {searchMode==='shared-start'?'DE DÉBUT':searchMode==='shared-end'?'DE FIN':'EN SÉQUENCE'}
            </div>
          )}
          {!sharedLoading && sharedGroups.length > 0 && (
            <div style={{padding:'8px 0 0'}}>
              <div style={{padding:'4px 20px 10px',fontSize:9,letterSpacing:1.5,color:'var(--text3)',fontFamily:"'Cinzel',serif"}}>
                {sharedGroups.length} SÉQUENCE{sharedGroups.length>1?'S':''} — {sharedGroups.reduce((a,g)=>a+g.count,0)} AYATS
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

      {/* Pas de résultats */}
      {!loading && debouncedQ && groups.length === 0 && (
        <div className="concord-empty">
          <div className="concord-empty-arabic">لا نتائج</div>
          <div className="concord-empty-msg">AUCUN AYAT TROUVÉ<br/>Essayez un autre mot ou le mode FLOU</div>
        </div>
      )}

      {/* Résultats */}
      {groups.length > 0 && (
        <>
          <div className="concord-results-header">
            <div className="concord-results-count">
              <span>~{totalCount}</span> AYAT{totalCount>1?"S":""} · <span>{groups.length}</span> SOURATE{groups.length>1?"S":""}
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

      {/* Ayats liés */}
      {linkedAyats.length > 0 && (
        <div className="concord-links-panel">
          <div className="concord-links-title">🔗 AYATS LIÉS · {linkedAyats.length}</div>
          {linkedAyats.map(link => (
            <div key={link.key} className="concord-link-card" onClick={()=>onNavigate(link.surahNum, link.ayatNum)}>
              <div className="concord-link-ref">{link.surahEn} · {link.ayatNum}</div>
              <div className="concord-link-text">{link.text}</div>
              <button className="concord-link-remove" onClick={e=>{e.stopPropagation();toggleLink(link.surahNum,link.surahEn,link.ayatNum,link.text);}}>✕</button>
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
          <div className="concord-empty-arabic">البحث</div>
          <div className="concord-empty-msg">
            RECHERCHEZ DES MOTS OU PARTIES D'AYATS<br/>
            PUIS LIEZ LES VERSETS QUI PARTAGENT UN THÈME
          </div>
        </div>
      )}
    </div>
  );
}

