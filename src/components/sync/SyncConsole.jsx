import React, { useState, useEffect } from "react";
import { DATA_KEYS, getDeviceId, syncLogEntries } from "../../utils/syncUtils.js";

export function SyncConsole() {
  const [logs, setLogs] = React.useState([...syncLogEntries]);
  const [open, setOpen] = React.useState(false);

  useEffect(() => {
    if (!window.__syncLogListeners) window.__syncLogListeners = new Set();
    window.__syncLogListeners.add(setLogs);
    return () => window.__syncLogListeners.delete(setLogs);
  }, []);

  const colors = { save:"#6ee7b7", restore:"#93c5fd", error:"#fca5a5", info:"#fde68a", skip:"#94a3b8" };

  return (
    <div style={{ position:"fixed", bottom:60, right:12, zIndex:9999, fontFamily:"monospace", fontSize:10 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        background:"#0f172a", border:"1px solid #334155", color:"#94a3b8",
        borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:10,
        boxShadow:"0 2px 8px rgba(0,0,0,.5)"
      }}>☁ {open ? "▾ SYNC LOG" : "▸ SYNC LOG"} {logs.length > 0 && <span style={{color: colors[logs[0]?.type]||"#fff"}}>●</span>}</button>
      {open && (
        <div style={{
          marginTop:4, background:"#0f172a", border:"1px solid #334155",
          borderRadius:8, padding:8, width:320, maxHeight:340,
          overflowY:"auto", boxShadow:"0 4px 20px rgba(0,0,0,.7)"
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{color:"#475569", fontSize:9, letterSpacing:1}}>CLOUD SYNC LOG</span>
            <button onClick={() => { syncLogEntries.length = 0; setLogs([]); }} style={{
              background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:9
            }}>✕ CLEAR</button>
          </div>
          {logs.length === 0 && <div style={{color:"#475569", fontSize:9}}>Aucune activité</div>}
          {logs.map((l, i) => (
            <div key={i} style={{ display:"flex", gap:6, padding:"3px 0", borderBottom:"1px solid #1e293b" }}>
              <span style={{ color:"#475569", minWidth:24 }}>{l.time}</span>
              <span style={{ color: colors[l.type] || "#fff", minWidth:14 }}>
                {l.type==="save"?"↑":l.type==="restore"?"↓":l.type==="error"?"✕":l.type==="skip"?"—":"·"}
              </span>
              <span style={{ color:"#cbd5e1", wordBreak:"break-all" }}>{l.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── OptionsModal ─────────────────────────────────────────────────────────────
