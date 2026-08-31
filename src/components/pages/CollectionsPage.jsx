import { ConcordancePage } from "./ConcordancePage.jsx";
import { SURAH_INFO } from "../../utils/arabicUtils.js";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { fetchSurahDefault } from "../../utils/reciterAudio.js";
import { CollectionModal } from "../collections/CollectionModal.jsx";
import { CollectionAyatRow } from "../collections/CollectionAyatRow.jsx";

export function CollectionsPage({ collections, learnData, setLData, onCreateCollection, onDeleteCollection, onToggleAyat, onOpenCollModal, ayatInCollectionsFn, surahs, onNavigate, showQalqala, showMadd, showIzhar, showIdgham, initialSearchQuery, onConsumeSearchQuery }) {
  const [newName, setNewName]   = useState("");
  const [openId, setOpenId]     = useState(null);
  const searchQuerySnapshot     = useRef(initialSearchQuery || "").current;
  const [tab, setTab]           = useState(searchQuerySnapshot ? "search" : "collections");

  // Arriving here via "Rechercher la sélection" — jump straight to the search tab
  useEffect(() => {
    if (searchQuerySnapshot) onConsumeSearchQuery?.();
  }, []); // eslint-disable-line
  const [searchQ, setSearchQ]   = useState("");
  const [searchMode, setSearchMode] = useState("ayat"); // "ayat" | "page" | "hizb"
  const [metaCache, setMetaCache]   = useState({});     // key "s:a" → {page, hizbQuarter}
  const [metaLoading, setMetaLoading] = useState(false);
  const [partGroupSurah, setPartGroupSurah] = useState("all"); // "all" | surahNum

  // Collect all unique ayats across collections
  const allEntries = useMemo(() => {
    const seen = new Set();
    const arr = [];
    collections.forEach(coll => {
      coll.ayats.forEach(a => {
        const k = `${a.surahNum}:${a.ayatNum}`;
        if (!seen.has(k)) { seen.add(k); arr.push(a); }
      });
    });
    return arr;
  }, [collections]);

  // Fetch page/hizb metadata for all ayats when switching to search
  useEffect(() => {
    if (tab !== "nav") return;
    const missing = allEntries.filter(a => !metaCache[`${a.surahNum}:${a.ayatNum}`]);
    if (missing.length === 0) return;
    setMetaLoading(true);
    // Batch: fetch per surah then map
    const bySurah = {};
    missing.forEach(a => { if (!bySurah[a.surahNum]) bySurah[a.surahNum] = []; bySurah[a.surahNum].push(a.ayatNum); });
    const fetches = Object.entries(bySurah).map(([sn]) =>
      fetchSurahDefault(Number(sn)).then(ayahs => {
          const newMeta = {};
          ayahs.forEach(ay => {
            newMeta[`${sn}:${ay.numberInSurah}`] = { page: ay.page, hizbQuarter: ay.hizbQuarter };
          });
          return newMeta;
        }).catch(() => ({}))
    );
    Promise.all(fetches).then(results => {
      const merged = Object.assign({}, ...results);
      setMetaCache(c => ({ ...c, ...merged }));
      setMetaLoading(false);
    });
  }, [tab, allEntries.length]); // eslint-disable-line

  // Filter entries
  const filteredEntries = useMemo(() => {
    const q = searchQ.trim();
    if (!q) return allEntries;
    const n = parseInt(q);
    return allEntries.filter(a => {
      const meta = metaCache[`${a.surahNum}:${a.ayatNum}`];
      if (searchMode === "ayat")  return a.ayatNum === n;
      if (searchMode === "page")  return meta?.page === n;
      if (searchMode === "hizb")  return meta?.hizbQuarter != null && Math.ceil(meta.hizbQuarter / 4) === n;
      return false;
    });
  }, [searchQ, searchMode, allEntries, metaCache]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateCollection(newName);
    setNewName("");
  };

  const totalAyats = collections.reduce((s, c) => s + c.ayats.length, 0);

  return (
    <main className="main" style={{ background:"var(--bg)", display:"flex", flexDirection:"column" }}>
      <div style={{ flexShrink:0, borderBottom:"1px solid var(--border)", background:"linear-gradient(180deg,var(--surface),var(--bg))" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 20px 0" }}>
          <div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:12, letterSpacing:3, color:"#c878ff" }}>COLLECTIONS &amp; RECHERCHE</div>
            <div style={{ fontSize:9, letterSpacing:1.5, color:"var(--text3)", marginTop:1 }}>
              {collections.length} COLL. · {totalAyats} AYAT{totalAyats!==1?"S":""}
            </div>
          </div>
          <div style={{ marginLeft:"auto", fontFamily:"'Amiri Quran',serif", fontSize:18, color:"#c878ff", opacity:.5, direction:"rtl" }}>مَجْمُوعَاتٌ</div>
        </div>
        <div style={{ display:"flex", paddingLeft:4 }}>
          {[["collections","🗂 COLLECTIONS"],["parties","🔗 PARTIES SIMILAIRES"],["nav","🔎 FILTRER COLLECTION"],["search","🔍 RECHERCHE CORAN"]].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:1.5, padding:"7px 16px",
              background:"transparent", border:"none", cursor:"pointer", transition:"all .2s",
              borderBottom: tab===id ? "2px solid #c878ff" : "2px solid transparent",
              color: tab===id ? "#c878ff" : "var(--text3)",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {tab === "collections" && (
        <div className="collections-page">
          <div className="coll-top-bar">
            <div style={{ fontSize:9, letterSpacing:2, color:"var(--text3)", flexShrink:0 }}>NOUVELLE COLLECTION</div>
            <div className="coll-create-form">
              <input className="coll-input" placeholder="NOM DE LA COLLECTION..."
                value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key==="Enter" && handleCreate()} />
              <button className="btn-primary" onClick={handleCreate} disabled={!newName.trim()}>+ CRÉER</button>
            </div>
          </div>
          {collections.length === 0 && (
            <div className="coll-empty">
              <div className="coll-empty-arabic">مَجْمُوعَة</div>
              <div className="coll-empty-msg">
                CRÉEZ UNE COLLECTION CI-DESSUS<br/>
                AJOUTEZ DES AYATS DEPUIS LE CORAN<br/>
                OU VIA 🔍 RECHERCHE CORAN
              </div>
            </div>
          )}
          <div className="coll-list">
            {collections.map(coll => {
              const isOpen = openId === coll.id;
              return (
                <div key={coll.id} className="coll-card">
                  <div className="coll-card-header" onClick={() => setOpenId(isOpen ? null : coll.id)}>
                    <div className="coll-card-icon">🗂</div>
                    <div className="coll-card-name">{coll.name}</div>
                    <div className="coll-card-count">{coll.ayats.length} AYAT{coll.ayats.length!==1?"S":""}</div>
                    <div className="coll-card-actions" onClick={e => e.stopPropagation()}>
                      <button className="btn-small" style={{ color:"var(--red)", borderColor:"var(--red)" }}
                        onClick={() => { if(window.confirm(`Supprimer "${coll.name}" ?`)) onDeleteCollection(coll.id); }}>✕</button>
                    </div>
                    <div className={`coll-card-chevron${isOpen?" open":""}`}>▶</div>
                  </div>
                  {isOpen && (
                    <div className="coll-ayat-list" style={{ padding:0 }}>
                      {coll.ayats.length === 0 && (
                        <div style={{ padding:"16px 18px", fontSize:10, color:"var(--text3)", letterSpacing:1 }}>
                          AUCUN AYAT — ajoutez-en depuis le Coran ou via Recherche
                        </div>
                      )}
                      {coll.ayats.map(a => (
                        <CollectionAyatRow
                          key={`${a.surahNum}-${a.ayatNum}`}
                          entry={a} collId={coll.id}
                          learnData={learnData} setLData={setLData}
                          onToggleAyat={onToggleAyat} onOpenCollModal={onOpenCollModal}
                          ayatInCollectionsFn={ayatInCollectionsFn} collections={collections}
                          showQalqala={showQalqala}
                          showMadd={showMadd}
                          showIzhar={showIzhar}
                          showIdgham={showIdgham}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "parties" && (() => {
        // Build groups of ayats that share the same part text (normalized)
        const _normP = s => s?.trim().replace(/[\u064B-\u065F\u0670]/g,'').replace(/أ|إ|آ/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي') || '';
        // Gather all (surahNum, ayatNum, part) from learnData
        const entries = [];
        for (const [key, ld] of Object.entries(learnData)) {
          if (!ld?.parts?.length) continue;
          const [sn, an] = key.split(':').map(Number);
          if (partGroupSurah !== "all" && sn !== Number(partGroupSurah)) continue;
          ld.parts.forEach((p, pi) => {
            if (p.text) entries.push({ sn, an, pi, partText: p.text, normText: _normP(p.text) });
          });
        }
        // Group by normalized text
        const groups = {};
        entries.forEach(e => {
          if (!groups[e.normText]) groups[e.normText] = { text: e.partText, items: [] };
          groups[e.normText].items.push(e);
        });
        // Only keep groups with 2+ entries
        const multiGroups = Object.values(groups).filter(g => g.items.length >= 2).sort((a,b) => b.items.length - a.items.length);
        const surahNums = [...new Set(Object.keys(learnData).map(k => parseInt(k.split(':')[0])))].filter(Boolean).sort((a,b)=>a-b);

        return (
          <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>
            {/* Filter by surah */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:8, letterSpacing:1.5, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>SOURATE :</span>
              {[{ val:'all', label:'TOUTES' }, ...surahNums.map(n => ({ val:String(n), label:`S.${n}` }))].map(({ val, label }) => (
                <button key={val} onClick={() => setPartGroupSurah(val)} style={{
                  fontSize:8, letterSpacing:1, padding:'3px 10px', borderRadius:5, cursor:'pointer',
                  fontFamily:"'Cinzel',serif",
                  background: partGroupSurah===val ? 'rgba(200,120,255,.15)' : 'transparent',
                  border:`1px solid ${partGroupSurah===val ? '#c878ff' : 'rgba(255,255,255,.1)'}`,
                  color: partGroupSurah===val ? '#c878ff' : 'var(--text3)' }}>
                  {label}
                </button>
              ))}
            </div>

            {multiGroups.length === 0
              ? <div style={{ color:'var(--text3)', fontSize:9, letterSpacing:1, textAlign:'center', padding:'32px 0' }}>
                  Aucune partie partagée entre plusieurs ayats
                </div>
              : multiGroups.map((group, gi) => (
                <div key={gi} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:9, overflow:'hidden' }}>
                  {/* Part text */}
                  <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', direction:'rtl',
                    fontFamily:"'Amiri Quran',serif", fontSize:18, color:'var(--gold2)',
                    background:'rgba(201,168,76,.05)', lineHeight:2 }}>
                    {group.text}
                  </div>
                  {/* Ayats sharing this part */}
                  <div style={{ padding:'8px 14px', display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:7, letterSpacing:1.5, color:'var(--text3)', fontFamily:"'Cinzel',serif", flexShrink:0 }}>
                      {group.items.length} AYAT{group.items.length>1?'S':''}
                    </span>
                    {group.items.map(({ sn, an, pi }) => {
                      const surah = surahs.find(s => s.number === sn);
                      return (
                        <button key={`${sn}:${an}:${pi}`}
                          onClick={() => onNavigate?.('quran', sn, an)}
                          style={{ fontSize:9, letterSpacing:1, padding:'4px 10px', borderRadius:6,
                            fontFamily:"'Cinzel',serif", cursor:'pointer',
                            background:'rgba(200,120,255,.08)', border:'1px solid rgba(200,120,255,.3)',
                            color:'#c878ff' }}>
                          {surah?.englishName || `S.${sn}`} · {an} <span style={{ fontSize:7, opacity:.6 }}>P.{pi+1}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            }
          </div>
        );
      })()}
      {tab === "nav" && (
        <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
          <div className="coll-search-bar">
            <input className="coll-search-input" placeholder={searchMode==="ayat"?"N° AYAT":searchMode==="page"?"N° PAGE":"N° HIZB"}
              value={searchQ} onChange={e => setSearchQ(e.target.value)} type="number" min="1" />
            {[["ayat","AYAT"],["page","PAGE"],["hizb","HIZB"]].map(([m,l]) => (
              <button key={m} className={`coll-search-chip${searchMode===m?" active":""}`} onClick={() => { setSearchMode(m); setSearchQ(""); }}>{l}</button>
            ))}
          </div>
          {metaLoading && (
            <div style={{ padding:"12px 20px", fontSize:10, letterSpacing:1, color:"var(--text3)" }}>CHARGEMENT MÉTADONNÉES...</div>
          )}
          <div className="coll-search-results">
            {!searchQ.trim() && !metaLoading && (
              <div style={{ padding:"20px", fontSize:10, letterSpacing:1, color:"var(--text3)", textAlign:"center" }}>
                ENTREZ UN NUMÉRO POUR FILTRER LES {allEntries.length} AYATS DE VOS COLLECTIONS
              </div>
            )}
            {filteredEntries.map(a => {
              const meta = metaCache[`${a.surahNum}:${a.ayatNum}`];
              const surahInfo = SURAH_INFO.find(s => s.n === a.surahNum);
              const hizb = meta?.hizbQuarter != null ? Math.ceil(meta.hizbQuarter / 4) : null;
              return (
                <div key={`${a.surahNum}:${a.ayatNum}`} className="coll-search-result-item"
                  onClick={() => onNavigate(a.surahNum, a.ayatNum)}>
                  <div style={{ flexShrink:0, display:"flex", flexDirection:"column", gap:3, alignItems:"center", minWidth:40 }}>
                    <div style={{ width:32, height:32, border:"1px solid #c878ff", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#c878ff", fontFamily:"Cinzel,serif" }}>{a.ayatNum}</div>
                    {meta && <div style={{ fontSize:8, letterSpacing:1, color:"var(--text3)", textAlign:"center" }}>P.{meta.page}{hizb?` H${hizb}`:""}</div>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="coll-search-meta">{surahInfo?.en || `S.${a.surahNum}`} · AYAT {a.ayatNum}</div>
                    <div className="coll-search-arabic">{a.text}</div>
                  </div>
                  {onOpenCollModal && (
                    <button style={{ flexShrink:0, padding:"4px 10px", fontSize:9, fontFamily:"Cinzel,serif", letterSpacing:1, background:"transparent", border:"1px solid #c878ff", color:"#c878ff", borderRadius:"var(--radius-sm)", cursor:"pointer" }}
                      onClick={e => { e.stopPropagation(); onOpenCollModal({ surahNum: a.surahNum, surahEn: surahInfo?.en||"", ayatNum: a.ayatNum, text: a.text, number: a.ayatNum }); }}>+ COLL</button>
                  )}
                </div>
              );
            })}
            {searchQ.trim() && filteredEntries.length === 0 && !metaLoading && (
              <div style={{ padding:"20px", fontSize:10, letterSpacing:1, color:"var(--text3)", textAlign:"center" }}>AUCUN AYAT TROUVÉ</div>
            )}
          </div>
        </div>
      )}

      {tab === "search" && (
        <ConcordancePage
          surahs={surahs} collections={collections}
          onOpenCollModal={onOpenCollModal}
          ayatInCollectionsFn={ayatInCollectionsFn}
          onNavigate={onNavigate}
          initialQuery={searchQuerySnapshot}
        />
      )}
    </main>
  );
}
