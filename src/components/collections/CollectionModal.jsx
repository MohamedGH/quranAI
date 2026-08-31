import React, { useState } from "react";

export function CollectionModal({ ayat, collections, onToggle, onCreateAndAdd, onClose }) {
  const [newName, setNewName] = useState("");
  const key = `${ayat.surahNum}:${ayat.ayatNum}`;

  const isInColl = (c) => c.ayats.some(a => `${a.surahNum}:${a.ayatNum}` === key);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateAndAdd(newName);
    setNewName("");
  };

  return (
    <div className="coll-modal-overlay" onClick={onClose}>
      <div className="coll-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="coll-modal-title">AJOUTER AUX COLLECTIONS</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <div className="coll-modal-subtitle">{ayat.text?.slice(0, 80)}{ayat.text?.length > 80 ? "…" : ""}</div>
        <div style={{ fontSize: 9, letterSpacing: 1, color: "var(--text3)" }}>
          {ayat.surahEn?.toUpperCase()} · AYAT {ayat.ayatNum}
        </div>

        {collections.length === 0 ? (
          <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: 1, textAlign: "center", padding: "8px 0" }}>
            Aucune collection — créez-en une ci-dessous
          </div>
        ) : (
          <div className="coll-modal-list">
            {collections.map(c => (
              <div key={c.id} className={`coll-modal-item${isInColl(c) ? " selected" : ""}`}
                onClick={() => onToggle(c.id, ayat)}>
                <div className="coll-modal-check">{isInColl(c) ? "✓" : ""}</div>
                <div className="coll-modal-item-name">{c.name}</div>
                <div className="coll-modal-item-count">{c.ayats.length} ayat{c.ayats.length > 1 ? "s" : ""}</div>
              </div>
            ))}
          </div>
        )}

        <div className="coll-modal-new">
          <input
            className="coll-input" placeholder="NOUVELLE COLLECTION..."
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={handleCreate} disabled={!newName.trim()}>+ CRÉER</button>
        </div>

        <div className="coll-modal-actions">
          <button className="btn-primary active" onClick={onClose}>FERMER</button>
        </div>
      </div>
    </div>
  );
}

// ─── COLLECTIONS PAGE ─────────────────────────────────────────────────────────
// CollectionAyatRow: renders a single collection ayat exactly like the Quran page
