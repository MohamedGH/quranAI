import React, { useState, useMemo } from "react";

export function GoalsPanel({ goals, todayAct, weeklyTotal, streak, goalAyatsPct, goalPartsPct, weeklyPct, onSetGoal, surahs }) {
  const [editKey, setEditKey] = useState(null);
  const [editVal, setEditVal] = useState("");

  const startEdit = (key, val) => { setEditKey(key); setEditVal(String(val ?? "")); };
  const confirmEdit = () => {
    if (editKey === "targetDate" || editKey === "targetSurah") {
      onSetGoal(editKey, editVal || null);
    } else {
      const n = parseInt(editVal);
      if (!isNaN(n) && n >= 0) onSetGoal(editKey, n);
    }
    setEditKey(null);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Streak */}
      <div className="goal-streak">
        <div className="goal-streak-fire">🔥</div>
        <div>
          <div style={{display:"flex",alignItems:"baseline",gap:6}}>
            <div className="goal-streak-num">{streak}</div>
            <div className="goal-streak-label">JOUR{streak!==1?"S":""} DE SUITE</div>
          </div>
          <div style={{fontSize:8,color:"var(--text3)",letterSpacing:1}}>SÉRIE EN COURS</div>
        </div>
      </div>

      {/* Aujourd'hui */}
      <div className="goal-today-box">
        <div className="goal-today-stat">
          <div className="goal-today-val">{todayAct.ayatsRead||0}</div>
          <div className="goal-today-label">AYATS LUS<br/>AUJOURD'HUI</div>
        </div>
        <div className="goal-today-stat">
          <div className="goal-today-val">{todayAct.ayatsLearned||0}</div>
          <div className="goal-today-label">AYATS<br/>APPRIS</div>
        </div>
        <div className="goal-today-stat">
          <div className="goal-today-val">{todayAct.partsLearned||0}</div>
          <div className="goal-today-label">PARTIES<br/>APPRISES</div>
        </div>
      </div>

      {/* Objectifs configurables */}
      <div className="goals-grid">
        {[
          { key:"dailyAyats",  icon:"📖", label:"OBJECTIF QUOTIDIEN",    unit:"ayats/jour",    val:goals.dailyAyats,  pct:goalAyatsPct,  color:"var(--teal)" },
          { key:"dailyParts",  icon:"✂",  label:"PARTIES / JOUR",        unit:"parties/jour",  val:goals.dailyParts,  pct:goalPartsPct,  color:"var(--gold)" },
          { key:"weeklyAyats", icon:"📅", label:"OBJECTIF HEBDOMADAIRE", unit:"ayats/semaine", val:goals.weeklyAyats, pct:weeklyPct,     color:"var(--green2)" },
        ].map(g => (
          <div key={g.key} className="goal-row">
            <div className="goal-icon">{g.icon}</div>
            <div className="goal-info">
              <div className="goal-label">{g.label}</div>
              {editKey === g.key ? (
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input className="goal-input" type="number" min="0" value={editVal}
                    onChange={e=>setEditVal(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter")confirmEdit();if(e.key==="Escape")setEditKey(null);}}
                    autoFocus />
                  <button className="goal-edit-btn" onClick={confirmEdit}>✓</button>
                  <button className="goal-edit-btn" onClick={()=>setEditKey(null)}>✕</button>
                </div>
              ) : (
                <div className="goal-value">{g.val} <span style={{fontSize:9,color:"var(--text3)",fontFamily:"sans-serif",letterSpacing:0}}>{g.unit}</span></div>
              )}
              <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}}>
                <div className="goal-track">
                  <div className="goal-fill" style={{width:`${Math.round(g.pct*100)}%`,background:g.color}}/>
                </div>
                <div className="goal-pct">{Math.round(g.pct*100)}%</div>
              </div>
            </div>
            {editKey !== g.key && (
              <button className="goal-edit-btn" onClick={()=>startEdit(g.key, g.val)}>✎</button>
            )}
          </div>
        ))}

        {/* Sourate cible */}
        <div className="goal-row">
          <div className="goal-icon">🎯</div>
          <div className="goal-info">
            <div className="goal-label">SOURATE CIBLE</div>
            {editKey === "targetSurah" ? (
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <select value={editVal} onChange={e=>setEditVal(e.target.value)}
                  style={{background:"var(--surface2)",border:"1px solid var(--gold)",borderRadius:6,padding:"4px 8px",color:"var(--text)",fontSize:10,outline:"none",flex:1}}>
                  <option value="">— Aucune —</option>
                  {surahs.map(s=><option key={s.number} value={s.number}>{s.number}. {s.englishName}</option>)}
                </select>
                <button className="goal-edit-btn" onClick={confirmEdit}>✓</button>
                <button className="goal-edit-btn" onClick={()=>setEditKey(null)}>✕</button>
              </div>
            ) : (
              <div className="goal-value">
                {goals.targetSurah ? (surahs.find(s=>s.number===Number(goals.targetSurah))?.englishName || `Sourate ${goals.targetSurah}`) : "—"}
              </div>
            )}
          </div>
          {editKey !== "targetSurah" && <button className="goal-edit-btn" onClick={()=>startEdit("targetSurah", goals.targetSurah||"")}>✎</button>}
        </div>

        {/* Date limite */}
        <div className="goal-row">
          <div className="goal-icon">⏳</div>
          <div className="goal-info">
            <div className="goal-label">DATE LIMITE</div>
            {editKey === "targetDate" ? (
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input type="date" value={editVal} onChange={e=>setEditVal(e.target.value)}
                  style={{background:"var(--surface2)",border:"1px solid var(--gold)",borderRadius:6,padding:"4px 8px",color:"var(--text)",fontSize:10,outline:"none",flex:1}}
                  onKeyDown={e=>{if(e.key==="Enter")confirmEdit();if(e.key==="Escape")setEditKey(null);}}
                  autoFocus />
                <button className="goal-edit-btn" onClick={confirmEdit}>✓</button>
                <button className="goal-edit-btn" onClick={()=>setEditKey(null)}>✕</button>
              </div>
            ) : (
              <div className="goal-value">
                {goals.targetDate
                  ? new Date(goals.targetDate).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})
                  : "—"}
                {goals.targetDate && (
                  <span style={{fontSize:9,color:"var(--text3)",fontFamily:"sans-serif",letterSpacing:0,marginLeft:8}}>
                    ({Math.ceil((new Date(goals.targetDate)-new Date())/(1000*60*60*24))} j)
                  </span>
                )}
              </div>
            )}
          </div>
          {editKey !== "targetDate" && <button className="goal-edit-btn" onClick={()=>startEdit("targetDate", goals.targetDate||"")}>✎</button>}
        </div>
      </div>
    </div>
  );
}

// ─── ACTIVITY BAR CHART ───────────────────────────────────────────────────────
export function ActivityBarChart({ data = [], height = 60, goalLine = 0, onClick, selectedIdx }) {
  if (!data.length) return null;
  const maxVal = Math.max(1, ...data.map(d => (d.read||0) + (d.learned||0)));
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:2, height, padding:"0 2px" }}>
      {data.map((d, i) => {
        const total = (d.read||0) + (d.learned||0);
        const pct = total / maxVal;
        const learnedPct = (d.learned||0) / maxVal;
        const isSelected = selectedIdx === i;
        return (
          <div key={i} title={`${d.label}: ${total}`}
            onClick={() => onClick?.(i, d)}
            style={{ flex:1, height:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end",
              cursor: onClick ? "pointer" : "default", position:"relative" }}>
            {goalLine > 0 && i === 0 && (
              <div style={{ position:"absolute", left:0, right:0, bottom:`${(goalLine/maxVal)*100}%`,
                borderTop:"1px dashed rgba(201,168,76,.35)", zIndex:1 }} />
            )}
            <div style={{ width:"100%", height:`${Math.max(2, pct*100)}%`, borderRadius:"2px 2px 0 0",
              background: total >= goalLine && goalLine > 0
                ? "linear-gradient(180deg,var(--green2),var(--teal2))"
                : isSelected ? "var(--gold2)" : "var(--teal2)",
              opacity: isSelected ? 1 : 0.75, transition:"all .15s",
              boxShadow: isSelected ? "0 0 6px rgba(201,168,76,.4)" : "none" }} />
          </div>
        );
      })}
    </div>
  );
}

// ─── ACTIVITY CALENDAR ────────────────────────────────────────────────────────
export function ActivityCalendar({ activity, goals, learnData = {}, surahs = [] }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);

  const [viewDate,    setViewDate]    = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);
  // Period selection: null = single day mode, 'week' | 'custom'
  const [periodMode,    setPeriodMode]   = useState(null); // null | 'week' | 'custom'
  const [rangeStart,    setRangeStart]   = useState(null); // ISO date string
  const [rangeEnd,      setRangeEnd]     = useState(null);
  const [customPicking, setCustomPicking] = useState(false); // clicking first / second date

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = useMemo(() => {
    const arr = [];
    const startOffset = (firstDay + 6) % 7;
    for (let i = 0; i < startOffset; i++) arr.push({ day: prevMonthDays - startOffset + i + 1, cur: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const act     = activity[dateStr] || {};
      const total   = (act.ayatsRead||0) + (act.ayatsLearned||0);
      const isToday = dateStr === todayStr;
      const goalMet = goals.dailyAyats > 0 && total >= goals.dailyAyats;
      const partial = !goalMet && total > 0;
      const future  = new Date(year, month, d) > today;
      arr.push({ day: d, cur: true, dateStr, act, total, isToday, goalMet, partial, future });
    }
    const remaining = 42 - arr.length;
    for (let i = 1; i <= remaining; i++) arr.push({ day: i, cur: false });
    return arr;
  }, [year, month, firstDay, daysInMonth, prevMonthDays, activity, goals.dailyAyats, todayStr]);

  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const monthTotal = cells.filter(c=>c.cur&&c.act).reduce((s,c)=>s+(c.total||0),0);
  const activeDays = cells.filter(c=>c.cur&&c.total>0).length;
  const goalDays   = cells.filter(c=>c.cur&&c.goalMet).length;

  // ── Range helpers ──────────────────────────────────────────────────────────
  const setCurrentWeek = () => {
    const d = new Date(todayStr);
    const dow = (d.getDay() + 6) % 7; // Mon=0
    const start = new Date(d); start.setDate(d.getDate() - dow);
    const end   = new Date(start); end.setDate(start.getDate() + 6);
    setRangeStart(start.toISOString().slice(0,10));
    setRangeEnd(end.toISOString().slice(0,10));
    setPeriodMode('week');
    setCustomPicking(false);
    setSelectedDay(null);
  };

  const setLastNDays = (n) => {
    const end   = new Date(todayStr);
    const start = new Date(todayStr); start.setDate(end.getDate() - n + 1);
    setRangeStart(start.toISOString().slice(0,10));
    setRangeEnd(todayStr);
    setPeriodMode('custom');
    setCustomPicking(false);
    setSelectedDay(null);
  };

  const handleCellClick = (c) => {
    if (!c.cur || c.future) return;
    if (periodMode === 'custom' && customPicking) {
      if (!rangeStart) {
        setRangeStart(c.dateStr);
      } else {
        const s = rangeStart <= c.dateStr ? rangeStart : c.dateStr;
        const e = rangeStart <= c.dateStr ? c.dateStr : rangeStart;
        setRangeEnd(e);
        setRangeStart(s);
        setCustomPicking(false);
      }
      return;
    }
    // Single day
    setPeriodMode(null);
    setRangeStart(null); setRangeEnd(null);
    setSelectedDay(d => d === c.dateStr ? null : c.dateStr);
  };

  const isInRange = (dateStr) => {
    if (!rangeStart || !rangeEnd) return false;
    return dateStr >= rangeStart && dateStr <= rangeEnd;
  };

  // ── Range summary data ─────────────────────────────────────────────────────
  const rangeData = useMemo(() => {
    if (!rangeStart || !rangeEnd) return null;
    const days = [];
    const d = new Date(rangeStart);
    while (d.toISOString().slice(0,10) <= rangeEnd) {
      days.push(d.toISOString().slice(0,10));
      d.setDate(d.getDate()+1);
    }
    const totRead    = days.reduce((s,k) => s+(activity[k]?.ayatsRead||0),    0);
    const totLearned = days.reduce((s,k) => s+(activity[k]?.ayatsLearned||0), 0);
    const totParts   = days.reduce((s,k) => s+(activity[k]?.partsLearned||0), 0);
    const activeDays = days.filter(k => (activity[k]?.ayatsRead||0)+(activity[k]?.ayatsLearned||0)>0).length;
    const goalDays   = goals.dailyAyats > 0 ? days.filter(k => (activity[k]?.ayatsRead||0)+(activity[k]?.ayatsLearned||0)>=goals.dailyAyats).length : 0;
    // Ayats updated in range
    const updated = Object.entries(learnData)
      .filter(([,v]) => v.updatedAt?.slice(0,10) >= rangeStart && v.updatedAt?.slice(0,10) <= rangeEnd)
      .map(([k,v]) => { const [sn,an]=k.split(":").map(Number); return { sn,an,v,surahName:surahs.find(s=>s.number===sn)?.englishName||`S${sn}` }; })
      .sort((a,b)=>(b.v.updatedAt||"")>(a.v.updatedAt||"")? 1:-1);
    const chartData = days.map(k => {
      const act = activity[k]||{};
      const d = new Date(k);
      const labels = ["D","L","M","M","J","V","S"];
      return { label:labels[d.getDay()], read:act.ayatsRead||0, learned:act.ayatsLearned||0 };
    });
    return { days, totRead, totLearned, totParts, activeDays, goalDays, updated, chartData };
  }, [rangeStart, rangeEnd, activity, learnData, surahs, goals.dailyAyats]);

  // ── Single day detail ──────────────────────────────────────────────────────
  const dayDetail = useMemo(() => {
    if (!selectedDay) return null;
    const act = activity[selectedDay] || {};
      const updated = Object.entries(learnData)
          .filter(
              ([, v]) =>
                  v.updatedAt?.slice(0, 10) === selectedDay ||
                  v.learnedAt?.slice(0, 10) === selectedDay
          )
          .map(([k, v]) => {
              const [sn, an] = k.split(":").map(Number);

              return {
                  key: k,
                  sn,
                  an,
                  v,
                  surahName:
                      surahs.find(s => s.number === sn)?.englishName || `S${sn}`,
                  surahAr:
                      surahs.find(s => s.number === sn)?.name
              };
          })
          .sort((a, b) => {
              const da = a.v.updatedAt || a.v.learnedAt || "";
              const db = b.v.updatedAt || b.v.learnedAt || "";
              return db.localeCompare(da);
          });
    const fmt = iso => { if(!iso) return ""; const d=new Date(iso); return d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}); };
    return { act, updated, fmt };
  }, [selectedDay, learnData, activity, surahs]);

  const btnStyle = (active) => ({
    fontSize:8, letterSpacing:1, padding:"4px 10px", borderRadius:20, cursor:"pointer",
    fontFamily:"'Cinzel',serif", border:`1px solid ${active?"var(--gold)":"var(--border2)"}`,
    background:active?"rgba(201,168,76,.1)":"transparent", color:active?"var(--gold2)":"var(--text3)",
    transition:"all .15s",
  });

  return (
    <div className="dash-card" style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Month nav */}
      <div className="cal-month-nav">
        <button className="cal-nav-btn" onClick={()=>{ setViewDate(new Date(year,month-1,1)); setSelectedDay(null); }}>‹</button>
        <div className="cal-month-title">{monthNames[month]} {year}</div>
        <button className="cal-nav-btn" onClick={()=>{ setViewDate(new Date(year,month+1,1)); setSelectedDay(null); }}
          disabled={year===today.getFullYear()&&month===today.getMonth()}
          style={{opacity:year===today.getFullYear()&&month===today.getMonth()?0.4:1}}>›</button>
      </div>

      {/* Period selector */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:8,letterSpacing:1,color:"var(--text3)"}}>PÉRIODE :</span>
        <button style={btnStyle(false)} onClick={()=>{ setPeriodMode(null);setRangeStart(null);setRangeEnd(null);setCustomPicking(false); }}>Jour</button>
        <button style={btnStyle(periodMode==='week')} onClick={setCurrentWeek}>Semaine</button>
        <button style={btnStyle(false)} onClick={()=>setLastNDays(7)}>7j</button>
        <button style={btnStyle(false)} onClick={()=>setLastNDays(30)}>30j</button>
        <button style={btnStyle(customPicking)}
          onClick={()=>{ setPeriodMode('custom');setRangeStart(null);setRangeEnd(null);setCustomPicking(true);setSelectedDay(null); }}>
          {customPicking ? (rangeStart?"Cliquer fin":"Cliquer début") : "Personnalisé"}
        </button>
        {(rangeStart||rangeEnd) && (
          <button style={{...btnStyle(false),color:"var(--red)",borderColor:"var(--red)"}}
            onClick={()=>{ setRangeStart(null);setRangeEnd(null);setPeriodMode(null);setCustomPicking(false); }}>✕</button>
        )}
      </div>
      {rangeStart && rangeEnd && (
        <div style={{fontSize:8,color:"var(--teal2)",letterSpacing:1}}>
          {rangeStart} → {rangeEnd} · {rangeData?.days.length}j
        </div>
      )}

      {/* Calendar grid */}
      <div className="cal-grid">
        {["L","M","M","J","V","S","D"].map((d,i)=>(
          <div key={i} className="cal-day-name">{d}</div>
        ))}
        {cells.map((c,i)=>{
          let cls = "cal-cell";
          if (!c.cur)         cls += " other-month";
          if (c.isToday)      cls += " today";
          if (c.goalMet)      cls += " goal-reached";
          else if (c.partial) cls += " goal-partial";
          else if (c.total>0) cls += " has-activity";
          const isSelected  = c.cur && c.dateStr === selectedDay;
          const inRange     = c.cur && isInRange(c.dateStr);
          const isRangeEdge = c.cur && (c.dateStr === rangeStart || c.dateStr === rangeEnd);
          return (
            <div key={i} className={cls}
              onClick={() => handleCellClick(c)}
              style={{
                cursor: c.cur && !c.future ? "pointer" : "default",
                background: inRange ? "rgba(201,168,76,.12)" : undefined,
                outline: isSelected || isRangeEdge ? "2px solid var(--gold)" : undefined,
                outlineOffset: -2,
              }}>
              <div className="cal-cell-num" style={{color:c.isToday?"var(--gold)":c.future?"var(--text3)":undefined}}>{c.day}</div>
              {c.cur && c.total > 0 && (
                <div className="cal-cell-dot" style={{background:c.goalMet?"var(--teal)":c.partial?"var(--gold)":"var(--border2)"}}/>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="cal-legend">
        <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:"var(--teal)"}}/> Objectif</div>
        <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:"var(--gold)"}}/> Partielle</div>
        <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:"var(--border2)"}}/> Activité</div>
      </div>

      {/* ── RANGE DETAIL ── */}
      {rangeData && rangeStart && rangeEnd && (
        <div style={{borderTop:"1px solid var(--border)",paddingTop:12,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:9,letterSpacing:2,color:"var(--gold2)",fontFamily:"'Cinzel',serif"}}>RÉSUMÉ DE LA PÉRIODE</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[
              {val:rangeData.totRead,    label:"LUS",     color:"var(--teal2)"},
              {val:rangeData.totLearned, label:"APPRIS",  color:"var(--green)"},
              {val:rangeData.totParts,   label:"PARTIES", color:"var(--gold2)"},
              {val:rangeData.activeDays, label:"JOURS",   color:"var(--text2)"},
              {val:rangeData.goalDays,   label:"OBJECTIFS",color:"var(--green)"},
            ].map((s,i)=>(
              <div key={i} style={{flex:1,minWidth:50,padding:"8px",background:"var(--surface3)",borderRadius:6,textAlign:"center"}}>
                <div style={{fontSize:16,fontFamily:"'Cinzel',serif",color:s.color}}>{s.val}</div>
                <div style={{fontSize:7,letterSpacing:1,color:"var(--text3)"}}>{s.label}</div>
              </div>
            ))}
          </div>
          {rangeData.chartData.length <= 31 && (
            <ActivityBarChart data={rangeData.chartData} height={70} goalLine={goals?.dailyAyats||0} />
          )}
          {rangeData.updated.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:200,overflowY:"auto"}}>
              <div style={{fontSize:8,letterSpacing:1.5,color:"var(--text3)"}}>AYATS TRAVAILLÉS ({rangeData.updated.length})</div>
              {rangeData.updated.map(({sn,an,v,surahName})=>(
                <div key={`${sn}:${an}`} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 10px",background:"var(--surface3)",borderRadius:6}}>
                  <div style={{fontSize:9,color:"var(--text3)",width:20,textAlign:"center",fontFamily:"'Cinzel',serif"}}>{an}</div>
                  <div style={{flex:1,fontSize:8,color:"var(--text2)",letterSpacing:.5}}>{surahName}</div>
                  {v.learnedAt?.slice(0,10)>=rangeStart && v.learnedAt?.slice(0,10)<=rangeEnd && <span style={{fontSize:7,padding:"1px 6px",borderRadius:8,background:"rgba(76,175,129,.15)",color:"var(--green)",border:"1px solid var(--green)"}}>✓</span>}
                  <div style={{fontSize:7,color:"var(--text3)"}}>{v.updatedAt?.slice(0,10)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SINGLE DAY DETAIL ── */}
      {selectedDay && dayDetail && (
        <div style={{borderTop:"1px solid var(--border)",paddingTop:14,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:10,letterSpacing:2,color:"var(--gold2)",fontFamily:"'Cinzel',serif"}}>{selectedDay}</div>
            <button onClick={()=>setSelectedDay(null)} style={{fontSize:9,background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer"}}>✕ FERMER</button>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[
              {val:dayDetail.act.ayatsRead||0,    label:"LUS",    color:"var(--teal2)"},
              {val:dayDetail.act.ayatsLearned||0, label:"APPRIS", color:"var(--green)"},
              {val:dayDetail.act.partsLearned||0, label:"PARTIES",color:"var(--gold2)"},
            ].map((s,i)=>(
              <div key={i} style={{flex:1,padding:"8px",background:"var(--surface3)",borderRadius:6,textAlign:"center"}}>
                <div style={{fontSize:18,fontFamily:"'Cinzel',serif",color:s.color}}>{s.val}</div>
                <div style={{fontSize:7,letterSpacing:1,color:"var(--text3)"}}>{s.label}</div>
              </div>
            ))}
          </div>
          {dayDetail.updated.length > 0 ? (
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:240,overflowY:"auto"}}>
              {dayDetail.updated.map(({key,sn,an,v,surahName,surahAr})=>(
                <div key={key} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"var(--surface3)",borderRadius:6}}>
                  <div style={{fontSize:9,color:"var(--text3)",width:20,textAlign:"center",fontFamily:"'Cinzel',serif"}}>{an}</div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:1}}>
                    <div style={{fontSize:8,letterSpacing:.5,color:"var(--text2)"}}>{surahName}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {v.learnedAt?.slice(0,10)===selectedDay && <span style={{fontSize:7,padding:"1px 6px",borderRadius:8,background:"rgba(76,175,129,.15)",color:"var(--green)",border:"1px solid var(--green)"}}>✓ APPRIS {dayDetail.fmt(v.learnedAt)}</span>}
                      {v.updatedAt?.slice(0,10)===selectedDay && v.learnedAt?.slice(0,10)!==selectedDay && <span style={{fontSize:7,padding:"1px 6px",borderRadius:8,background:"rgba(62,184,160,.1)",color:"var(--teal2)",border:"1px solid var(--teal)"}}>↻ MÀJ {dayDetail.fmt(v.updatedAt)}</span>}
                    </div>
                  </div>
                  {surahAr && <div style={{fontFamily:"'Amiri Quran',serif",fontSize:14,color:"var(--gold)",direction:"rtl"}}>{surahAr}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:9,color:"var(--text3)",letterSpacing:1,textAlign:"center",padding:"8px 0"}}>
              {(dayDetail.act.ayatsRead||0)+(dayDetail.act.ayatsLearned||0)>0 ? "Activité enregistrée — pas de détail." : "Aucune activité ce jour."}
            </div>
          )}
        </div>
      )}

      {/* Monthly bar chart */}
      <div style={{borderTop:"1px solid var(--border)",paddingTop:12}}>
        <div style={{fontSize:8,letterSpacing:1.5,color:"var(--text3)",marginBottom:6}}>ACTIVITÉ DU MOIS</div>
        <ActivityBarChart
          data={cells.filter(c=>c.cur).map(c=>({ label:String(c.day), read:c.act?.ayatsRead||0, learned:c.act?.ayatsLearned||0 }))}
          height={70} goalLine={goals.dailyAyats||0}
          onClick={(i,d)=>{ const cell=cells.filter(c=>c.cur)[i]; if(cell&&!cell.future){ setPeriodMode(null);setRangeStart(null);setRangeEnd(null); setSelectedDay(s=>s===cell.dateStr?null:cell.dateStr); } }}
          selectedIdx={selectedDay?cells.filter(c=>c.cur).findIndex(c=>c.dateStr===selectedDay):null}
        />
        <div style={{display:"flex",gap:12,paddingTop:8,flexWrap:"wrap"}}>
          {[{val:activeDays,label:"JOURS ACTIFS"},{val:goalDays,label:"OBJECTIFS"},{val:monthTotal,label:"AYATS"}].map((s,i)=>(
            <div key={i} style={{flex:1,minWidth:60,textAlign:"center"}}>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:14,color:"var(--gold2)"}}>{s.val}</div>
              <div style={{fontSize:7,letterSpacing:1,color:"var(--text3)"}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// ─── DASHBOARD PAGE ────────────────────────────────────────────────────────────

export function DonutChart({ pct, color, size = 80, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct, 1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray .8s ease"}}/>
    </svg>
  );
}

export function MiniBarChart({ data, color }) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:3,height:36}}>
      {data.map((v,i) => (
        <div key={i} style={{flex:1,background:v>0?color:"var(--surface3)",borderRadius:"2px 2px 0 0",
          height:`${Math.max(4,(v/max)*100)}%`,opacity:i===data.length-1?1:.6,transition:"height .4s"}}/>
      ))}
    </div>
  );
}

// ─── KpiWidget ────────────────────────────────────────────────────────────────
export function KpiWidget({ totalLearned, totalRead, totalWords, totalParts, learnedParts, learnedSurahs, activeSurahs, pctAyats, entries, surahs, onNavigate }) {
  const kpis = [
    { label:"VERSETS APPRIS",   val:totalLearned,  color:"var(--gold2)" },
    { label:"LECTURES",         val:totalRead,     color:"var(--teal2)" },
    { label:"MOTS MÉMORISÉS",   val:totalWords,    color:"var(--green2)" },
    { label:"PARTIES CRÉÉES",   val:totalParts,    color:"var(--text2)" },
    { label:"PARTIES APPRISES", val:learnedParts,  color:"var(--teal2)" },
    { label:"SOURATES 100%",    val:learnedSurahs, color:"var(--gold2)" },
  ];
  return (
    <div className="dash-card">
      <div className="dash-kpi-row">
        {kpis.map(k => (
          <div key={k.label} className="dash-kpi" style={{"--kpi-color":k.color}}>
            <div className="dash-kpi-val">{k.val}</div>
            <div className="dash-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}