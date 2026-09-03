import { ActivityCalendar } from "../common/Charts.jsx";
import { ExportImport } from "../sync/ExportImport.jsx";
import { masteryColor, computeMastery } from "../common/Mastery.jsx";
import React, { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";
import { DonutChart, MiniBarChart, KpiWidget, ActivityBarChart, GoalsPanel } from "../common/Charts.jsx";
import { LearningEvolutionChart } from "../common/LearningEvolutionChart.jsx";
import { MasteryTimelineWidget } from "../common/MasteryTimelineWidget.jsx";
import { fetchSurahSimple } from "../../utils/reciterAudio.js";

export function DashboardPage({ learnData, surahs, onNavigate, goals, activity, onSetGoal, onRecordActivity, surahStats, surahTextCache = {}, onOpenReminders }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // ── Compute stats from learnData ──
  const entries = useMemo(() => Object.entries(learnData), [learnData]);

  const totalLearned   = useMemo(() => entries.filter(([,v]) => v.learned).length,       [entries]);
  const totalRead      = useMemo(() => entries.reduce((s,[,v]) => s+(v.readCount||0), 0),[entries]);
  const totalParts     = useMemo(() => entries.reduce((s,[,v]) => s+(v.parts?.length||0), 0),       [entries]);
  const learnedParts   = useMemo(() => entries.reduce((s,[,v]) => s+(v.parts?.filter(p=>p.learned).length||0), 0), [entries]);
  const totalWords     = useMemo(() => entries.reduce((s,[,v]) => s+Object.keys(v.wordsLearned||{}).filter(k=>v.wordsLearned[k]).length, 0), [entries]);

  // Timestamp-based analytics
  const recentlyLearned = useMemo(() => entries
    .filter(([,v]) => v.learnedAt)
    .sort(([,a],[,b]) => (b.learnedAt > a.learnedAt ? 1 : -1))
    .slice(0, 5), [entries]);

  const recentlyUpdated = entries
    .filter(([,v]) => v.updatedAt)
    .sort(([,a],[,b]) => (b.updatedAt > a.updatedAt ? 1 : -1))
    .slice(0, 3);

  // Weekly progress using timestamps
  const now7 = new Date(); now7.setDate(now7.getDate() - 7);
  const learnedThisWeek = entries.filter(([,v]) => v.learnedAt && new Date(v.learnedAt) > now7).length;
  const updatedThisWeek = entries.filter(([,v]) => v.updatedAt && new Date(v.updatedAt) > now7).length;

  const surahProgress = useMemo(() => {
    const sp = {};
    entries.forEach(([key, v]) => {
      const [sNum, aNum] = key.split(":").map(Number);
      if (!sp[sNum]) sp[sNum] = { learned:0, total:0, read:0, masterySum:0 };
      sp[sNum].total++;
      if (v.learned) sp[sNum].learned++;
      sp[sNum].read += v.readCount||0;
      const text = surahTextCache[sNum]?.[aNum];
      sp[sNum].masterySum += computeMastery(v, text);
    });
    return sp;
  }, [entries, surahTextCache]);

  const learnedSurahs = useMemo(() => Object.entries(surahProgress).filter(([,d]) => d.learned > 0 && d.learned === d.total).length, [surahProgress]);

  const activeSurahs = useMemo(() => Object.entries(surahProgress)
    .map(([num, d]) => {
      const sNum = Number(num);
      const meta = surahs.find(s=>s.number===sNum);
      const totalAyahs = meta?.numberOfAyahs || d.total || 1;
      const st = surahStats?.[sNum];
      const masterySum = st?.mastery !== undefined ? st.mastery : d.masterySum;
      const masteryPct = totalAyahs > 0 ? Math.min(100, Math.round(masterySum / totalAyahs)) : 0;
      return { num: sNum, ...d, pct: masteryPct / 100, masteryPct, meta };
    })
    .sort((a,b) => b.read - a.read)
    .slice(0, 8), [surahProgress, surahs, surahStats]);

  const topLearned = useMemo(() => [...activeSurahs].sort((a,b)=>b.pct-a.pct).slice(0,5), [activeSurahs]);

  const heatmap = useMemo(() => Array.from({length:49},(_,i)=>{
    const d2 = new Date(); d2.setDate(d2.getDate() - (48-i));
    const k = d2.toISOString().slice(0,10);
    const a = activity[k] || {};
    return (a.ayatsRead||0) + (a.ayatsLearned||0);
  }), [activity]);

  const hasActivity = totalRead > 0;

  const weekBars7 = useMemo(() => Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0,10);
    const act = activity[dateStr] || {};
    const dayNames = ["D","L","M","M","J","V","S"];
    return { label: dayNames[d.getDay()], read: act.ayatsRead||0, learned: act.ayatsLearned||0 };
  }), [activity]);

  const meccan   = activeSurahs.filter(a=>a.meta?.revelationType==="Meccan").length;
  const medinan  = activeSurahs.filter(a=>a.meta?.revelationType==="Medinan").length;
  const totalAyats = 6236;

  // Unified global mastery: sum of all ayat masteries in the Quran / 6236
  const totalMasterySum = useMemo(() => {
    let sum = 0;
    for (const [key, v] of entries) {
      const [sn, an] = key.split(':').map(Number);
      const text = surahTextCache[sn]?.[an];
      sum += computeMastery(v, text);
    }
    return sum;
  }, [entries, surahTextCache]);

  const globalMasteryPct = totalAyats > 0 ? (totalMasterySum / totalAyats) / 100 : 0;
  const pctAyats   = globalMasteryPct;

  const recentActivity = useMemo(() => entries
    .filter(([,v]) => (v.readCount||0) > 0)
    .slice(-6).reverse()
    .map(([key, v]) => {
      const [sNum, aNum] = key.split(":").map(Number);
      const meta = surahs.find(s=>s.number===sNum);
      return { sNum, aNum, readCount:v.readCount, learned:v.learned, surahName: meta?.englishName||`S${sNum}` };
    }), [entries, surahs]);

  const isEmpty = entries.length === 0;

  // ── Objectifs du jour (live — depend on activity + goals) ──
  const todayStr2 = useMemo(() => new Date().toISOString().slice(0,10), []);
  const todayAct = useMemo(() => activity[todayStr2] || { ayatsRead:0, partsLearned:0, ayatsLearned:0 }, [activity, todayStr2]);
  const goalAyatsPct = useMemo(() => goals.dailyAyats > 0 ? Math.min(1, todayAct.ayatsRead   / goals.dailyAyats) : 0, [todayAct, goals.dailyAyats]);
  const goalPartsPct = useMemo(() => goals.dailyParts > 0 ? Math.min(1, todayAct.partsLearned / goals.dailyParts) : 0, [todayAct, goals.dailyParts]);

  const streak = useMemo(() => {
    let s = 0;
    const d = new Date();
    while (true) {
      const k = d.toISOString().slice(0,10);
      const a = activity[k];
      if (!a || (a.ayatsRead||0) + (a.ayatsLearned||0) === 0) { if (s === 0) { d.setDate(d.getDate()-1); if (!activity[d.toISOString().slice(0,10)]) break; } else break; }
      else s++;
      d.setDate(d.getDate()-1);
      if (s > 365) break;
    }
    return s;
  }, [activity]);

  const weeklyTotal = useMemo(() => Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return (activity[d.toISOString().slice(0,10)]?.ayatsRead || 0);
  }).reduce((a,b) => a+b, 0), [activity]);
  const weeklyPct = useMemo(() => goals.weeklyAyats > 0 ? Math.min(1, weeklyTotal / goals.weeklyAyats) : 0, [weeklyTotal, goals.weeklyAyats]);


  // ── Dashboard layout (drag/resize/add/remove) ──────────────────────────────
  const ALL_WIDGETS = [
    { id:"kpis",       label:"VUE D'ENSEMBLE & KPIS",       defaultSize:2 },
    { id:"evolution",  label:"ÉVOLUTION DE L'APPRENTISSAGE",defaultSize:2 },
    { id:"repartition",label:"RÉPARTITION DU CORAN",        defaultSize:1 },
    { id:"week",       label:"ACTIVITÉ (7 DERNIERS JOURS)",  defaultSize:1 },
    { id:"timeline",   label:"MAÎTRISE DANS LE TEMPS (30J)",defaultSize:2 },
    { id:"calendrier", label:"CALENDRIER D'ACTIVITÉ",        defaultSize:2 },
    { id:"objectifs",  label:"OBJECTIFS & SÉRIE",           defaultSize:1 },
    { id:"sourates",   label:"SOURATES ÉTUDIÉES",           defaultSize:1 },
    { id:"heatmap",    label:"HEATMAP D'ACTIVITÉ (7 SEM.)", defaultSize:2 },
    { id:"top",        label:"TOP SOURATES",                defaultSize:1 },
    { id:"recents",    label:"ACTIVITÉ RÉCENTE",            defaultSize:1 },
    { id:"citation",   label:"CITATION",                    defaultSize:2 },
    { id:"export",     label:"EXPORT / IMPORT",             defaultSize:2 },
  ];

  const loadLayout = () => {
    try {
      const s = localStorage.getItem("quran_dash_layout");
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          const map = new Map(parsed.map(w => [w.id, w]));
          // Merge to ensure all widgets from ALL_WIDGETS are present
          return ALL_WIDGETS.map(w => {
            const existing = map.get(w.id);
            return existing ? { ...w, ...existing, visible: existing.visible !== undefined ? existing.visible : true } : { id: w.id, visible: true, size: w.defaultSize };
          });
        }
      }
    } catch {}
    return ALL_WIDGETS.map(w => ({ id: w.id, visible: true, size: w.defaultSize }));
  };

  const [layout,    setLayout]    = useState(() => loadLayout());
  const [editMode,  setEditMode]  = useState(false);
  const [dragIdx,   setDragIdx]   = useState(null);
  const [dragOver,  setDragOver]  = useState(null);

  const saveLayout = (l) => {
    setLayout(l);
    try { localStorage.setItem("quran_dash_layout", JSON.stringify(l)); } catch {}
  };

  const toggleVisible = (id) => saveLayout(layout.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  const toggleSize    = (id) => saveLayout(layout.map(w => w.id === id ? { ...w, size: w.size === 2 ? 1 : 2 } : w));
  const moveUp        = (idx) => { if (idx === 0) return; const l=[...layout]; [l[idx-1],l[idx]]=[l[idx],l[idx-1]]; saveLayout(l); };
  const moveDown      = (idx) => { if (idx>=layout.length-1) return; const l=[...layout]; [l[idx],l[idx+1]]=[l[idx+1],l[idx]]; saveLayout(l); };
  const resetLayout   = () => saveLayout(ALL_WIDGETS.map(w => ({ id: w.id, visible: true, size: w.defaultSize })));
  const showAllCharts = () => saveLayout(layout.map(w => ({ ...w, visible: true })));

  const onDragStart   = (i) => setDragIdx(i);
  const onDragEnter   = (i) => setDragOver(i);
  const onDragEnd     = () => {
    if (dragIdx !== null && dragOver !== null && dragIdx !== dragOver) {
      const l = [...layout]; const [item] = l.splice(dragIdx, 1); l.splice(dragOver, 0, item);
      saveLayout(l);
    }
    setDragIdx(null); setDragOver(null);
  };

  const renderWidget = (id) => {
    switch(id) {
      case "kpis": return <KpiWidget
        totalLearned={totalLearned} totalRead={totalRead} totalWords={totalWords}
        totalParts={totalParts} learnedParts={learnedParts} learnedSurahs={learnedSurahs}
        activeSurahs={activeSurahs} pctAyats={pctAyats} entries={entries} surahs={surahs}
        globalMasteryPct={globalMasteryPct}
        onNavigate={onNavigate}
      />;
      case "evolution": return (
        <LearningEvolutionChart
          learnData={learnData}
          activity={activity}
          surahs={surahs}
          surahTextCache={surahTextCache}
          goals={goals}
          onNavigate={onNavigate}
        />
      );
      case "objectifs": return (
        <GoalsPanel goals={goals} todayAct={todayAct} weeklyTotal={weeklyTotal} streak={streak}
          goalAyatsPct={goalAyatsPct} goalPartsPct={goalPartsPct} weeklyPct={weeklyPct}
          onSetGoal={onSetGoal} surahs={surahs} onOpenReminders={onOpenReminders} />
      );
      case "calendrier": return (
        <ActivityCalendar activity={activity} goals={goals} learnData={learnData} surahs={surahs} />
      );
      case "sourates": return (
        <div className="dash-card">
          {activeSurahs.length === 0 ? <div className="dash-empty-hint">Aucune sourate étudiée</div>
          : activeSurahs.map((a,i)=>(
            <div key={i} className="dash-surah-bar" onClick={()=>onNavigate(a.num)}>
              <div className="dash-surah-num">{a.num}</div>
              <div className="dash-surah-name">{a.meta?.englishName||`Sourate ${a.num}`}</div>
              <div className="dash-surah-ar">{a.meta?.name||""}</div>
              <div className="dash-bar-track">
                <div className="dash-bar-fill" style={{width:`${a.masteryPct}%`, background: masteryColor(a.masteryPct)}}/>
              </div>
              <div className="dash-bar-pct" style={{color: masteryColor(a.masteryPct)}}>{a.masteryPct}%</div>
            </div>
          ))}
        </div>
      );
      case "repartition": return (
        <div className="dash-card">
          <div className="dash-donut-wrap">
            <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{position:"relative",width:80,height:80}}>
                <DonutChart pct={pctAyats} color={masteryColor(Math.round(pctAyats*100))} size={80} stroke={9}/>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:"'Cinzel',serif",fontSize:14,fontWeight:700,color:masteryColor(Math.round(pctAyats*100))}}>
                  {Math.round(pctAyats*100)}%
                </div>
              </div>
              <div className="dash-ring-label">MAÎTRISE CORAN</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,flex:1}}>
              {[
                {label:"Maîtrise totale", val:`${Math.round(pctAyats*100)}%`, color:masteryColor(Math.round(pctAyats*100))},
                {label:"Appris",   val:totalLearned, color:"var(--green2)"},
                {label:"En cours", val:entries.filter(([,v])=>!v.learned&&(v.readCount||0)>0).length, color:"var(--gold2)"},
                {label:"Non lus",  val:Math.max(0,6236-totalLearned-entries.filter(([,v])=>!v.learned&&(v.readCount||0)>0).length), color:"var(--border2)"},
              ].map((l,i)=>(
                <div key={i} className="dash-legend-item">
                  <div className="dash-legend-dot" style={{background:l.color}}/>
                  <span>{l.label}</span>
                  <span style={{marginLeft:"auto",fontFamily:"'Cinzel',serif",color:l.color}}>{l.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
      case "week": return (
        <div className="dash-card" style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between"}}>
            <div style={{fontSize:9,color:"var(--text3)",letterSpacing:1}}>ACTIVITÉ SUR 7 JOURS</div>
            <div style={{fontSize:12,fontFamily:"'Cinzel',serif",color:"var(--teal2)",fontWeight:600}}>
              {weekBars7.reduce((s,d)=>s+d.read+d.learned,0)} ayats
            </div>
          </div>
          <ActivityBarChart data={weekBars7} height={60} goalLine={goals?.dailyAyats||0} />
          <div style={{display:"flex",justifyContent:"space-between",padding:"0 2px"}}>
            {weekBars7.map((d,i)=>(
              <div key={i} style={{flex:1,textAlign:"center",fontSize:8,color:"var(--text3)",fontFamily:"'Cinzel',serif"}}>
                {d.label}
              </div>
            ))}
          </div>
        </div>
      );
      case "heatmap": return (
        <div className="dash-card">
          <div className="dash-heatmap">
            {heatmap.map((v,i)=>{
              const intensity = hasActivity ? Math.min(v/4,1) : 0;
              return <div key={i} className="dash-heatmap-cell"
                style={{background:intensity>0?`rgba(62,184,160,${0.1+intensity*0.75})`:"var(--surface3)",
                  borderColor:intensity>0?"rgba(62,184,160,.3)":"var(--border)"}}
                title={`${v} lecture(s)`}/>;
            })}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,justifyContent:"flex-end"}}>
            <div style={{fontSize:8,color:"var(--text3)",letterSpacing:1}}>MOINS</div>
            {[0,.2,.4,.7,1].map((v,i)=>(
              <div key={i} style={{width:10,height:10,borderRadius:2,
                background:v>0?`rgba(62,184,160,${0.1+v*0.75})`:"var(--surface3)",border:"1px solid rgba(62,184,160,.2)"}}/>
            ))}
            <div style={{fontSize:8,color:"var(--text3)",letterSpacing:1}}>PLUS</div>
          </div>
        </div>
      );
      case "recents": return (
        <div className="dash-card">
          {recentActivity.length===0 ? <div className="dash-empty-hint">Aucune activité enregistrée</div>
          : recentActivity.map((a,i)=>(
            <div key={i} className="dash-activity-row">
              <div className="dash-activity-dot" style={{background:a.learned?"var(--green2)":"var(--gold2)"}}/>
              <div className="dash-activity-text">
                <span style={{color:"var(--gold)",fontFamily:"'Cinzel',serif",fontSize:9}}>{a.surahName.toUpperCase()}</span>
                {" · "}Ayat {a.aNum}
                {a.learned && <span style={{marginLeft:6,color:"var(--green2)",fontSize:9}}>✓ APPRIS</span>}
              </div>
              <div className="dash-activity-time">{a.readCount}×</div>
            </div>
          ))}
        </div>
      );
      case "top": return (
        <div className="dash-card">
          {topLearned.length===0 ? <div className="dash-empty-hint">Aucun ayat appris</div>
          : topLearned.map((a,i)=>(
            <div key={i} className="dash-surah-bar" onClick={()=>onNavigate(a.num)}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"var(--surface3)",border:"1px solid var(--border)",
                display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cinzel',serif",fontSize:8,color:"var(--gold)",flexShrink:0}}>{i+1}</div>
              <div className="dash-surah-name">{a.meta?.englishName||`S${a.num}`}</div>
              <div className="dash-surah-ar">{a.meta?.name||""}</div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:"var(--green2)",flexShrink:0}}>{a.learned}/{a.total}</div>
            </div>
          ))}
        </div>
      );
      case "timeline": return (
        <MasteryTimelineWidget
          learnData={learnData}
          surahs={surahs}
          surahTextCache={surahTextCache}
          onNavigate={onNavigate}
        />
      );
      case "citation": return (
        <div style={{padding:"20px",background:"rgba(201,168,76,.04)",border:"1px solid rgba(201,168,76,.12)",borderRadius:12,textAlign:"center",display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontFamily:"'Amiri Quran',serif",fontSize:24,color:"var(--gold)",opacity:.8,direction:"rtl"}}>خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ</div>
          <div style={{fontSize:9,letterSpacing:1.5,color:"var(--text3)"}}>« LE MEILLEUR D'ENTRE VOUS EST CELUI QUI APPREND LE CORAN ET L'ENSEIGNE » — AL-BUKHARI</div>
        </div>
      );
      case "export": return <ExportImport />;
      default: return null;
    }
  };

  const visibleLayout = layout.filter(w => w.visible);
  const hiddenLayout  = layout.filter(w => !w.visible);

  return (
    <main className="main" style={{background:"var(--bg)"}}>
      {/* Header */}
      <div style={{padding:"14px 28px 14px",borderBottom:"1px solid var(--border)",flexShrink:0,
        display:"flex",alignItems:"center",gap:16,
        background:"linear-gradient(180deg,var(--surface),var(--bg))"}}>
        <div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:13,letterSpacing:3,color:"var(--gold2)"}}>TABLEAU DE BORD</div>
          <div style={{fontSize:9,letterSpacing:2,color:"var(--text3)",marginTop:2}}>
            {today.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase()}
          </div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {hiddenLayout.length > 0 && !editMode && (
            <button onClick={showAllCharts} style={{
              fontSize:8,letterSpacing:1.5,padding:"5px 10px",fontFamily:"'Cinzel',serif",
              background:"rgba(62,184,160,.1)",border:"1px solid var(--teal)",color:"var(--teal2)",
              borderRadius:6,cursor:"pointer"
            }}>📊 AFFICHER TOUS LES GRAPHIQUES</button>
          )}
          <button onClick={()=>setEditMode(v=>!v)} style={{
            fontSize:8,letterSpacing:2,padding:"5px 12px",fontFamily:"'Cinzel',serif",
            background:editMode?"rgba(201,168,76,.15)":"transparent",
            border:`1px solid ${editMode?"var(--gold)":"var(--border2)"}`,
            color:editMode?"var(--gold2)":"var(--text3)",borderRadius:6,cursor:"pointer"
          }}>{editMode ? "✓ TERMINER" : "✏ PERSONNALISER"}</button>
          {editMode && <button onClick={resetLayout} style={{fontSize:8,letterSpacing:1,padding:"5px 10px",fontFamily:"'Cinzel',serif",background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",borderRadius:6,cursor:"pointer"}}>↺ RESET</button>}
          <div style={{fontFamily:"'Amiri Quran',serif",fontSize:20,color:"var(--gold)",opacity:.7,direction:"rtl"}}>وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا</div>
        </div>
      </div>

      <div className="dash-page">
        {isEmpty && (
          <div style={{padding:"28px 20px",background:"rgba(201,168,76,.04)",border:"1px solid rgba(201,168,76,.15)",borderRadius:12,textAlign:"center"}}>
            <div style={{fontFamily:"'Amiri Quran',serif",fontSize:32,color:"var(--gold)",opacity:.5,direction:"rtl",marginBottom:10}}>بِسْمِ اللَّهِ</div>
            <div style={{fontSize:10,letterSpacing:2,color:"var(--text2)"}}>COMMENCEZ VOTRE APPRENTISSAGE DANS L'ONGLET CORAN</div>
          </div>
        )}

        {/* ── Hidden widgets panel (edit mode) ── */}
        {editMode && hiddenLayout.length > 0 && (
          <div style={{padding:"12px",background:"rgba(201,168,76,.05)",border:"1px dashed var(--gold)",borderRadius:8,display:"flex",flexWrap:"wrap",gap:6}}>
            <div style={{width:"100%",fontSize:8,letterSpacing:1.5,color:"var(--text3)",marginBottom:4}}>WIDGETS MASQUÉS — cliquer pour afficher</div>
            {hiddenLayout.map(w => (
              <button key={w.id} onClick={()=>toggleVisible(w.id)} style={{
                fontSize:8,letterSpacing:1,padding:"4px 12px",fontFamily:"'Cinzel',serif",
                background:"var(--surface2)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:20,cursor:"pointer"
              }}>+ {ALL_WIDGETS.find(a=>a.id===w.id)?.label || w.id}</button>
            ))}
          </div>
        )}

        {/* ── Widget grid ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))",gap:16,alignItems:"start"}}>
          {visibleLayout.map((w, wi) => {
            const meta   = ALL_WIDGETS.find(a => a.id === w.id);
            const isDragging = dragIdx === wi;
            const isOver     = dragOver === wi;
            return (
              <div key={w.id}
                className="dash-widget-cell"
                draggable={editMode}
                onDragStart={()=>onDragStart(wi)}
                onDragEnter={()=>onDragEnter(wi)}
                onDragEnd={onDragEnd}
                onDragOver={e=>e.preventDefault()}
                style={{
                  gridColumn: w.size === 2 ? "1 / -1" : "auto",
                  opacity: isDragging ? .4 : 1,
                  outline: isOver && !isDragging ? "2px dashed var(--gold)" : "none",
                  outlineOffset: 3,
                  transition: "opacity .15s",
                  position: "relative",
                }}>
                {/* Edit overlay header */}
                {editMode && (
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                    <div style={{cursor:"grab",fontSize:14,color:"var(--text3)",padding:"0 4px",userSelect:"none"}}>⠿</div>
                    <div style={{flex:1,fontSize:8,letterSpacing:1.5,color:"var(--gold2)",fontFamily:"'Cinzel',serif"}}>{meta?.label}</div>
                    <button onClick={()=>toggleSize(w.id)} title={w.size===2?"Réduire":"Agrandir"}
                      style={{fontSize:9,padding:"2px 8px",background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",borderRadius:4,cursor:"pointer"}}>
                      {w.size===2 ? "⊡" : "⊞"}
                    </button>
                    <button onClick={()=>moveUp(wi)} disabled={wi===0}
                      style={{fontSize:9,padding:"2px 6px",background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",borderRadius:4,cursor:"pointer",opacity:wi===0?.4:1}}>↑</button>
                    <button onClick={()=>moveDown(wi)} disabled={wi===visibleLayout.length-1}
                      style={{fontSize:9,padding:"2px 6px",background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",borderRadius:4,cursor:"pointer",opacity:wi===visibleLayout.length-1?.4:1}}>↓</button>
                    <button onClick={()=>toggleVisible(w.id)}
                      style={{fontSize:9,padding:"2px 8px",background:"rgba(224,90,90,.1)",border:"1px solid var(--red)",color:"var(--red)",borderRadius:4,cursor:"pointer"}}>✕</button>
                  </div>
                )}
                {!editMode && <div className="dash-section-title">{meta?.label}</div>}
                {renderWidget(w.id)}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

// ─── OfflineLoader ────────────────────────────────────────────────────────────
