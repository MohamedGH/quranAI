import React, { useState } from "react";

export function AyatCollectionsTab({ surahNum, ayatNum, collections, ayatInCollections, onOpenModal }) {
  const inColls = collections.filter(c => ayatInCollections?.includes(c.id));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--text3)", flex: 1 }}>
          {inColls.length === 0 ? "CET AYAT N'EST DANS AUCUNE COLLECTION" : `DANS ${inColls.length} COLLECTION${inColls.length > 1 ? "S" : ""}`}
        </div>
        <button className="btn-primary" onClick={onOpenModal}>🗂 GÉRER LES COLLECTIONS</button>
      </div>
      {inColls.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {inColls.map(c => (
            <div key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(200,120,255,.4)", background: "rgba(200,120,255,.08)", fontSize: 9, letterSpacing: 1, color: "#c878ff" }}>
              🗂 {c.name}
            </div>
          ))}
        </div>
      )}
      {collections.length === 0 && (
        <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1, padding: "4px 0" }}>
          Aucune collection — créez-en une depuis la page COLLECTIONS ou en cliquant sur GÉRER
        </div>
      )}
    </div>
  );
}

// ─── COLLECTION MODAL ─────────────────────────────────────────────────────────
