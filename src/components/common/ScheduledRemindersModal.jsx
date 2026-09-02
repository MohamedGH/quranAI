import React, { useState, useEffect } from "react";
import {
  loadReminders,
  saveReminders,
  loadReminderSettings,
  saveReminderSettings,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  playReminderChime,
  fireReminder,
  getNextTriggerDate,
  formatTimeUntil,
  REMINDER_TYPES,
  DAYS_OPTIONS,
  DAY_NAMES,
  DEFAULT_REMINDERS,
} from "../../utils/scheduledNotifications.js";

export function ScheduledRemindersModal({ surahs = [], onClose, onNavigate }) {
  const [reminders, setReminders] = useState(() => loadReminders());
  const [settings, setSettings] = useState(() => loadReminderSettings());
  const [permission, setPermission] = useState(() => getBrowserNotificationPermission());
  const [editingId, setEditingId] = useState(null); // null = list, "new" = create, or reminder.id
  const [formData, setFormData] = useState(null);
  const [testStatus, setTestStatus] = useState(null);

  useEffect(() => {
    setPermission(getBrowserNotificationPermission());
  }, []);

  const handleUpdateReminders = (newList) => {
    setReminders(newList);
    saveReminders(newList);
  };

  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings);
    saveReminderSettings(newSettings);
  };

  const handleRequestPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setPermission(res);
  };

  const toggleReminder = (id) => {
    const next = reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    handleUpdateReminders(next);
  };

  const deleteReminder = (id) => {
    const next = reminders.filter((r) => r.id !== id);
    handleUpdateReminders(next);
  };

  const startCreate = () => {
    setFormData({
      id: "rem_" + Date.now(),
      title: "Nouvelle Révision",
      time: "18:00",
      type: "revision",
      enabled: true,
      daysMode: "all",
      customDays: [0, 1, 2, 3, 4, 5, 6],
      sound: true,
      speech: false,
      targetSurah: "",
      message: "Prenez quelques minutes pour votre révision quotidienne du Coran.",
      quote: "وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا",
    });
    setEditingId("new");
  };

  const startEdit = (rem) => {
    setFormData({ ...rem });
    setEditingId(rem.id);
  };

  const handleSaveForm = () => {
    if (!formData.title.trim() || !formData.time) return;

    let nextList;
    if (editingId === "new") {
      nextList = [...reminders, formData];
    } else {
      nextList = reminders.map((r) => (r.id === editingId ? formData : r));
    }
    handleUpdateReminders(nextList);
    setEditingId(null);
    setFormData(null);
  };

  const handleTestReminder = (rem) => {
    setTestStatus(`Test envoyé pour : ${rem.title}`);
    fireReminder(rem, {
      settings,
      onTrigger: (payload) => {
        // Broadcast custom event for in-app toast
        window.dispatchEvent(new CustomEvent("quran_reminder_toast", { detail: payload }));
      },
      onNavigate,
    });
    setTimeout(() => setTestStatus(null), 3000);
  };

  const applyPreset = (preset) => {
    setFormData({
      ...formData,
      title: preset.title,
      time: preset.time,
      type: preset.type,
      message: preset.message,
      quote: preset.quote,
    });
  };

  // Find next upcoming reminder
  const activeReminders = reminders.filter((r) => r.enabled);
  const nextTriggers = activeReminders
    .map((r) => ({ reminder: r, date: getNextTriggerDate(r) }))
    .filter((x) => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const upcoming = nextTriggers[0];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2500,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 620,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(201,168,76,0.12)",
                border: "1px solid var(--gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              ⏰
            </div>
            <div>
              <div style={{ fontSize: 13, fontFamily: "'Cinzel',serif", color: "var(--gold2)", fontWeight: 700, letterSpacing: 1.5 }}>
                RAPPELS PROGRAMMÉS
              </div>
              <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>
                RÉVISIONS & MÉMORISATION QUOTIDIENNES
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text3)",
              fontSize: 18,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: "18px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Permission Banner */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background:
                permission === "granted"
                  ? "rgba(76,175,129,0.08)"
                  : permission === "denied"
                  ? "rgba(229,115,115,0.08)"
                  : "rgba(201,168,76,0.08)",
              border: `1px solid ${
                permission === "granted"
                  ? "var(--green)"
                  : permission === "denied"
                  ? "var(--red)"
                  : "var(--gold)"
              }`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 16 }}>
                {permission === "granted" ? "🔔" : permission === "denied" ? "🔕" : "💬"}
              </span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Cinzel',serif", color: "var(--text)" }}>
                  {permission === "granted"
                    ? "NOTIFICATIONS SYSTÈME ACTIVÉES"
                    : permission === "denied"
                    ? "NOTIFICATIONS BLOQUÉES DANS LE NAVIGATEUR"
                    : "NOTIFICATIONS SYSTÈME NON AUTORISÉES"}
                </div>
                <div style={{ fontSize: 8, color: "var(--text3)", marginTop: 2 }}>
                  {permission === "granted"
                    ? "Vous recevrez des alertes programmées même si l'onglet est en arrière-plan."
                    : permission === "denied"
                    ? "Veuillez autoriser les notifications dans les paramètres du navigateur pour les alertes en arrière-plan."
                    : "Activez les notifications pour être averti à l'heure exacte de vos révisions."}
                </div>
              </div>
            </div>

            {permission !== "granted" && (
              <button
                onClick={handleRequestPermission}
                style={{
                  fontSize: 8,
                  letterSpacing: 1.5,
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontFamily: "'Cinzel',serif",
                  background: "var(--gold)",
                  color: "var(--surface)",
                  border: "none",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                AUTORISER
              </button>
            )}
          </div>

          {/* Master Toggle & Next upcoming reminder */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "var(--surface2)",
              borderRadius: 10,
              border: "1px solid var(--border)",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 8, letterSpacing: 1.5, color: "var(--text3)", fontFamily: "'Cinzel',serif" }}>
                SYSTÈME DE RAPPELS
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
                {settings.masterEnabled ? "Rappels programmés actifs" : "Tous les rappels sont désactivés"}
              </div>
              {settings.masterEnabled && upcoming && (
                <div style={{ fontSize: 8.5, color: "var(--teal2)", marginTop: 4, fontFamily: "'Cinzel',serif" }}>
                  ⏳ Prochain : <strong>{upcoming.reminder.title}</strong> à {upcoming.reminder.time} ({formatTimeUntil(upcoming.date)})
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => playReminderChime(settings.soundType, settings.volume)}
                style={{
                  fontSize: 8,
                  letterSpacing: 1,
                  padding: "4px 8px",
                  background: "transparent",
                  border: "1px solid var(--border2)",
                  borderRadius: 6,
                  color: "var(--text2)",
                  fontFamily: "'Cinzel',serif",
                  cursor: "pointer",
                }}
                title="Tester le carillon audio"
              >
                🔔 TEST SON
              </button>

              <div
                onClick={() => handleUpdateSettings({ ...settings, masterEnabled: !settings.masterEnabled })}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: settings.masterEnabled ? "var(--teal)" : "var(--surface3)",
                  border: "1px solid " + (settings.masterEnabled ? "var(--teal)" : "var(--border2)"),
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: settings.masterEnabled ? 22 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.2s",
                  }}
                />
              </div>
            </div>
          </div>

          {testStatus && (
            <div
              style={{
                fontSize: 8.5,
                color: "var(--teal2)",
                fontFamily: "'Cinzel',serif",
                letterSpacing: 1,
                textAlign: "center",
                padding: "4px",
              }}
            >
              ✓ {testStatus}
            </div>
          )}

          {/* MAIN LIST OR EDIT FORM */}
          {editingId ? (
            /* ── EDIT / CREATE FORM ── */
            <div
              style={{
                background: "var(--surface2)",
                borderRadius: 12,
                border: "1px solid var(--gold)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--gold2)", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
                  {editingId === "new" ? "➕ NOUVEAU RAPPEL" : "✏ MODIFIER LE RAPPEL"}
                </div>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setFormData(null);
                  }}
                  style={{ fontSize: 11, background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}
                >
                  Annuler
                </button>
              </div>

              {/* Presets Quick Pick */}
              {editingId === "new" && (
                <div>
                  <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, marginBottom: 6 }}>MODÈLES RAPIDES :</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {DEFAULT_REMINDERS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        style={{
                          fontSize: 7.5,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "var(--surface3)",
                          border: "1px solid var(--border2)",
                          color: "var(--text2)",
                          cursor: "pointer",
                          fontFamily: "'Cinzel',serif",
                        }}
                      >
                        {preset.title} ({preset.time})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Row: Title & Time */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 2, minWidth: 160 }}>
                  <label style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                    TITRE DU RAPPEL
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Révision du Matin"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      background: "var(--surface3)",
                      border: "1px solid var(--border2)",
                      borderRadius: 6,
                      color: "var(--text)",
                      fontSize: 12,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 100 }}>
                  <label style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                    HEURE (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "var(--surface3)",
                      border: "1px solid var(--border2)",
                      borderRadius: 6,
                      color: "var(--text)",
                      fontSize: 12,
                      outline: "none",
                      textAlign: "center",
                    }}
                  />
                </div>
              </div>

              {/* Row: Session Type */}
              <div>
                <label style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 6 }}>
                  TYPE DE SESSION
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6 }}>
                  {REMINDER_TYPES.map((type) => {
                    const isSelected = formData.type === type.id;
                    return (
                      <div
                        key={type.id}
                        onClick={() => setFormData({ ...formData, type: type.id })}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: `1px solid ${isSelected ? type.color : "var(--border2)"}`,
                          background: isSelected ? "rgba(255,255,255,0.06)" : "var(--surface3)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          transition: "all 0.15s",
                        }}
                      >
                        <span>{type.icon}</span>
                        <span style={{ fontSize: 8, fontFamily: "'Cinzel',serif", color: isSelected ? type.color : "var(--text2)" }}>
                          {type.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Target Surah if any */}
              <div>
                <label style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                  SOURATE CIBLE (OPTIONNEL)
                </label>
                <select
                  value={formData.targetSurah || ""}
                  onChange={(e) => setFormData({ ...formData, targetSurah: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    background: "var(--surface3)",
                    border: "1px solid var(--border2)",
                    borderRadius: 6,
                    color: "var(--text)",
                    fontSize: 11,
                    outline: "none",
                  }}
                >
                  <option value="">— Toute révision / Non spécifiée —</option>
                  {surahs.map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.number}. {s.englishName} ({s.numberOfAyahs} ayats)
                    </option>
                  ))}
                </select>
              </div>

              {/* Days Selection */}
              <div>
                <label style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 6 }}>
                  RÉPÉTITION
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {DAYS_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setFormData({ ...formData, daysMode: opt.id })}
                      style={{
                        fontSize: 8,
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: `1px solid ${formData.daysMode === opt.id ? "var(--teal)" : "var(--border2)"}`,
                        background: formData.daysMode === opt.id ? "rgba(62,184,160,0.12)" : "transparent",
                        color: formData.daysMode === opt.id ? "var(--teal2)" : "var(--text3)",
                        cursor: "pointer",
                        fontFamily: "'Cinzel',serif",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {formData.daysMode === "custom" && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {DAY_NAMES.map(({ idx, short }) => {
                      const active = (formData.customDays || []).includes(idx);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            const cur = formData.customDays || [];
                            const next = active ? cur.filter((x) => x !== idx) : [...cur, idx];
                            setFormData({ ...formData, customDays: next });
                          }}
                          style={{
                            flex: 1,
                            padding: "6px 0",
                            borderRadius: 6,
                            border: `1px solid ${active ? "var(--teal)" : "var(--border2)"}`,
                            background: active ? "rgba(62,184,160,0.2)" : "var(--surface3)",
                            color: active ? "var(--teal2)" : "var(--text3)",
                            fontSize: 8,
                            cursor: "pointer",
                            fontFamily: "'Cinzel',serif",
                            fontWeight: active ? 700 : 400,
                          }}
                        >
                          {short}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Message & Quote */}
              <div>
                <label style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                  MESSAGE DE RAPPEL
                </label>
                <input
                  type="text"
                  value={formData.message || ""}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Message affiché sur l'alerte"
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    background: "var(--surface3)",
                    border: "1px solid var(--border2)",
                    borderRadius: 6,
                    color: "var(--text)",
                    fontSize: 10,
                    outline: "none",
                  }}
                />
              </div>

              {/* Save / Cancel buttons */}
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button
                  onClick={handleSaveForm}
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: 8,
                    background: "var(--gold)",
                    border: "none",
                    color: "var(--surface)",
                    fontSize: 9,
                    fontFamily: "'Cinzel',serif",
                    letterSpacing: 1.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✓ ENREGISTRER LE RAPPEL
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setFormData(null);
                  }}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    background: "transparent",
                    border: "1px solid var(--border2)",
                    color: "var(--text3)",
                    fontSize: 9,
                    fontFamily: "'Cinzel',serif",
                    cursor: "pointer",
                  }}
                >
                  ANNULER
                </button>
              </div>
            </div>
          ) : (
            /* ── REMINDERS LIST ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 9, letterSpacing: 1.5, color: "var(--text3)", fontFamily: "'Cinzel',serif" }}>
                  HORAIRES PROGRAMMÉS ({reminders.length})
                </div>
                <button
                  onClick={startCreate}
                  style={{
                    fontSize: 8,
                    letterSpacing: 1.5,
                    padding: "5px 12px",
                    borderRadius: 6,
                    background: "rgba(201,168,76,0.15)",
                    border: "1px solid var(--gold)",
                    color: "var(--gold2)",
                    fontFamily: "'Cinzel',serif",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ➕ AJOUTER UN RAPPEL
                </button>
              </div>

              {reminders.map((rem) => {
                const typeConfig = REMINDER_TYPES.find((t) => t.id === rem.type) || REMINDER_TYPES[0];
                const nextDate = getNextTriggerDate(rem);

                let daysLabel = "Tous les jours";
                if (rem.daysMode === "weekdays") daysLabel = "Semaine (Lun-Ven)";
                else if (rem.daysMode === "weekends") daysLabel = "Week-end (Sam-Dim)";
                else if (rem.daysMode === "custom" && Array.isArray(rem.customDays)) {
                  daysLabel = rem.customDays.map((d) => DAY_NAMES.find((x) => x.idx === d)?.short).join(", ");
                }

                return (
                  <div
                    key={rem.id}
                    style={{
                      background: "var(--surface2)",
                      borderRadius: 10,
                      border: `1px solid ${rem.enabled ? "var(--border)" : "var(--border2)"}`,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      opacity: rem.enabled ? 1 : 0.6,
                      transition: "all 0.15s",
                    }}
                  >
                    {/* Time display */}
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: rem.enabled ? "rgba(201,168,76,0.1)" : "var(--surface3)",
                        border: `1px solid ${rem.enabled ? "var(--gold)" : "var(--border2)"}`,
                        textAlign: "center",
                        minWidth: 64,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: rem.enabled ? "var(--gold2)" : "var(--text3)",
                          fontFamily: "'Cinzel',serif",
                          lineHeight: 1,
                        }}
                      >
                        {rem.time}
                      </div>
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text)", fontFamily: "'Cinzel',serif" }}>
                          {rem.title}
                        </span>
                        <span
                          style={{
                            fontSize: 7.5,
                            color: typeConfig.color,
                            background: "rgba(255,255,255,0.05)",
                            border: `1px solid ${typeConfig.color}`,
                            padding: "1px 5px",
                            borderRadius: 4,
                            fontFamily: "'Cinzel',serif",
                          }}
                        >
                          {typeConfig.icon} {typeConfig.label}
                        </span>
                      </div>

                      <div style={{ fontSize: 8, color: "var(--text3)", marginTop: 3 }}>
                        📅 {daysLabel}
                        {rem.targetSurah && ` · Sourate ${rem.targetSurah}`}
                        {rem.enabled && nextDate && ` · Prochain : ${formatTimeUntil(nextDate)}`}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => handleTestReminder(rem)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text3)",
                          fontSize: 12,
                          cursor: "pointer",
                          padding: "4px",
                        }}
                        title="Tester ce rappel"
                      >
                        ▶
                      </button>

                      <button
                        onClick={() => startEdit(rem)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text3)",
                          fontSize: 12,
                          cursor: "pointer",
                          padding: "4px",
                        }}
                        title="Modifier"
                      >
                        ✎
                      </button>

                      <button
                        onClick={() => deleteReminder(rem.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text3)",
                          fontSize: 12,
                          cursor: "pointer",
                          padding: "4px",
                        }}
                        title="Supprimer"
                      >
                        🗑
                      </button>

                      {/* Toggle Switch */}
                      <div
                        onClick={() => toggleReminder(rem.id)}
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: 10,
                          background: rem.enabled ? "var(--teal)" : "var(--surface3)",
                          border: "1px solid " + (rem.enabled ? "var(--teal)" : "var(--border2)"),
                          position: "relative",
                          cursor: "pointer",
                          transition: "background 0.2s",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 2,
                            left: rem.enabled ? 18 : 2,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left 0.2s",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {reminders.length === 0 && (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text3)", fontSize: 10 }}>
                  Aucun rappel programmé. Cliquez sur "Ajouter un rappel" pour créer votre planning quotidien.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
