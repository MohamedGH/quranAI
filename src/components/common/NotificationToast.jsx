import React from "react";
import { snoozeReminder, playReminderChime } from "../../utils/scheduledNotifications.js";

export function NotificationToast({ payload, onClose, onNavigate }) {
  if (!payload || !payload.reminder) return null;

  const { reminder, typeConfig, isSnoozedFire, targetPath } = payload;

  const handleAction = () => {
    onClose();
    if (onNavigate && targetPath) {
      onNavigate(targetPath);
    }
  };

  const handleSnooze = () => {
    snoozeReminder(reminder.id, 15);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 380,
        width: "calc(100vw - 48px)",
        background: "var(--surface2)",
        border: `1.5px solid ${typeConfig?.color || "var(--gold)"}`,
        borderRadius: 14,
        boxShadow: "0 12px 40px rgba(0,0,0,0.65), 0 0 20px rgba(201,168,76,0.15)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        animation: "toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            {typeConfig?.icon || "🔔"}
          </div>
          <div>
            <div style={{ fontSize: 8, letterSpacing: 1.5, color: "var(--text3)", fontFamily: "'Cinzel',serif" }}>
              {isSnoozedFire ? "⏰ RAPPEL REPORTÉ" : "🔔 RAPPEL PROGRAMMÉ"} · {reminder.time}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold2)", fontFamily: "'Cinzel',serif" }}>
              {reminder.title}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text3)",
            fontSize: 16,
            cursor: "pointer",
            padding: "4px 8px",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Message & Arabic Quote */}
      <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.5 }}>
        {reminder.message || "Il est l'heure de votre session de Coran."}
      </div>

      {reminder.quote && (
        <div
          style={{
            fontFamily: "'Amiri Quran',serif",
            fontSize: 15,
            color: "var(--gold)",
            direction: "rtl",
            textAlign: "center",
            padding: "6px 10px",
            background: "var(--surface3)",
            borderRadius: 8,
            border: "1px solid var(--border2)",
          }}
        >
          {reminder.quote}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={handleAction}
          style={{
            flex: 2,
            padding: "8px 12px",
            borderRadius: 8,
            background: "linear-gradient(135deg, rgba(62,184,160,0.3), rgba(76,175,129,0.2))",
            border: "1px solid var(--teal)",
            color: "var(--teal2)",
            fontSize: 9,
            fontFamily: "'Cinzel',serif",
            letterSpacing: 1.5,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          ▶ COMMENCER LA SESSION
        </button>

        <button
          onClick={handleSnooze}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border2)",
            color: "var(--text2)",
            fontSize: 8.5,
            fontFamily: "'Cinzel',serif",
            letterSpacing: 1,
            cursor: "pointer",
          }}
        >
          ⏰ +15 MIN
        </button>
      </div>
    </div>
  );
}
