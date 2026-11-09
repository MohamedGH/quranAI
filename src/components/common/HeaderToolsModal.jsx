import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import { OfflineLoader } from "./OfflineLoader.jsx";
import { PWAInstallButton } from "./PWAInstallButton.jsx";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.js";
import { getAvailableUxProfiles, getUxProfile, isValidUxMode } from "../../utils/uxProfileManager.js";

export const HEADER_TOOLS_TABS = [
  { id: 'tools', icon: '🎛️', label: 'OUTILS' },
  { id: 'ux', icon: '🧭', label: 'MODE & PROFIL' },
  { id: 'voice', icon: '🎤', label: 'VOCAL' },
  { id: 'offline', icon: '📥', label: 'HORS-LIGNE' },
  { id: 'account', icon: '👤', label: 'COMPTE' }
];

export function HeaderToolsModal({
  isOpen,
  onClose,
  currentUser,
  onSignOut,
  showArabicKeyboard,
  setShowArabicKeyboard,
  showRappel,
  setShowRappel,
  onOpenScheduledReminders,
  onOpenOptionsModal,
  toggleVoice,
  listening,
  selectedSurah,
  activeHizb,
  initialTab = 'tools'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const isOnline = useOnlineStatus();
  const dispatch = useDispatch();
  const fullScreenSelectedAyat = useSelector(sel.fullScreenSelectedAyat);
  const ayatFontSize = useSelector(sel.ayatFontSize) || 26;
  const uxMode = useSelector(sel.uxMode);
  const showBeginnerGuides = useSelector(sel.showBeginnerGuides);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2500,
        background: 'rgba(8, 10, 16, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn .2s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 500,
          background: 'linear-gradient(180deg, #161a26 0%, #10131d 100%)',
          border: '1px solid rgba(201, 168, 76, 0.28)',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 25px rgba(201,168,76,0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(90dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box'
        }}
      >
        {/* ── Modal Header ────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, color: 'var(--gold)' }}>⚡</span>
            <div>
              <div
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: 'var(--gold2)'
                }}
              >
                OUTILS & RÉGLAGES
              </div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>
                Accès rapide aux aides d'étude et au compte
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text2)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all .15s'
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Tabs Selector (5 Tabs: OUTILS, MODE & PROFIL, VOCAL, HORS-LIGNE, COMPTE) ── */}
        <div
          id="modal-header-tabs-container"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            padding: '10px 14px 8px',
            gap: 6,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          {HEADER_TOOLS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const isUx = tab.id === 'ux';
            return (
              <button
                key={tab.id}
                id={`modal-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: '1 1 auto',
                  padding: '7px 11px',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9.5,
                  fontWeight: isActive ? 700 : 600,
                  letterSpacing: 0.8,
                  background: isActive
                    ? 'rgba(201, 168, 76, 0.22)'
                    : isUx
                    ? 'rgba(201, 168, 76, 0.09)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isActive
                    ? '1.5px solid var(--gold)'
                    : isUx
                    ? '1px solid rgba(201, 168, 76, 0.35)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 8,
                  color: isActive ? 'var(--gold2)' : isUx ? 'var(--gold3)' : 'var(--text2)',
                  cursor: 'pointer',
                  transition: 'all .15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 0 10px rgba(201, 168, 76, 0.25)' : 'none',
                }}
              >
                <span style={{ fontSize: 13 }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Modal Body Content ────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* TAB 1: OUTILS D'ÉTUDE */}
          {activeTab === 'tools' && (
            <>
              {/* Profil d'Interface UX Actif */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--surface2)',
                  border: '1px solid rgba(201, 168, 76, 0.35)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(201, 168, 76, 0.14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                    }}
                  >
                    {getUxProfile(uxMode).icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', fontFamily: "'Cinzel', serif" }}>
                      PROFIL UX : {getUxProfile(uxMode).name.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                      {getUxProfile(uxMode).targetAudience}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    id="btn-open-wizard-header-tools"
                    type="button"
                    onClick={() => {
                      onClose();
                      dispatch(uiActions.setShowUxWizard(true));
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--gold)',
                      background: 'rgba(201, 168, 76, 0.16)',
                      color: 'var(--gold2)',
                      fontSize: 9,
                      fontFamily: "'Cinzel', serif",
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    title="Lancer le guide pas-à-pas de l'application"
                  >
                    ✨ GUIDE
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ux')}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text)',
                      fontSize: 9,
                      fontFamily: "'Cinzel', serif",
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    CHANGER
                  </button>
                </div>
              </div>

              {/* Taille du Texte des Versets */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--surface2)',
                  border: '1px solid rgba(201, 168, 76, 0.35)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'rgba(201, 168, 76, 0.14)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: "'Cinzel', serif",
                        color: 'var(--gold2)'
                      }}
                    >
                      A±
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                        Taille du Texte Coranique
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                        Ajuster la taille des versets pour une meilleure lisibilité ({ayatFontSize} px)
                      </div>
                    </div>
                  </div>
                  {ayatFontSize !== 26 && (
                    <button
                      type="button"
                      onClick={() => dispatch(uiActions.resetAyatFontSize())}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(201, 168, 76, 0.4)',
                        background: 'rgba(201, 168, 76, 0.1)',
                        color: 'var(--gold2)',
                        fontSize: 8,
                        fontFamily: "'Cinzel', serif",
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      26PX ↺
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    id="tools-modal-fontsize-dec"
                    onClick={() => dispatch(uiActions.decreaseAyatFontSize())}
                    disabled={ayatFontSize <= 16}
                    aria-label="Réduire la taille du texte"
                    style={{
                      width: 38,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(201, 168, 76, 0.35)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      color: ayatFontSize <= 16 ? 'var(--text3)' : 'var(--gold2)',
                      fontFamily: "'Cinzel', serif",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: ayatFontSize <= 16 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    A−
                  </button>
                  <input
                    type="range"
                    min={16}
                    max={48}
                    step={2}
                    value={ayatFontSize}
                    onChange={(e) => dispatch(uiActions.setAyatFontSize(Number(e.target.value)))}
                    aria-label="Curseur de taille du texte des versets"
                    style={{ flex: 1, accentColor: 'var(--gold)', cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    id="tools-modal-fontsize-inc"
                    onClick={() => dispatch(uiActions.increaseAyatFontSize())}
                    disabled={ayatFontSize >= 48}
                    aria-label="Augmenter la taille du texte"
                    style={{
                      width: 38,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(201, 168, 76, 0.35)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      color: ayatFontSize >= 48 ? 'var(--text3)' : 'var(--gold2)',
                      fontFamily: "'Cinzel', serif",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: ayatFontSize >= 48 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    A+
                  </button>
                </div>
              </div>

              {/* Clavier Arabe Virtuel */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--surface2)',
                  border: `1px solid ${showArabicKeyboard ? 'rgba(62, 184, 160, 0.4)' : 'rgba(255, 255, 255, 0.07)'}`,
                  transition: 'all .2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: showArabicKeyboard ? 'rgba(62, 184, 160, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      color: showArabicKeyboard ? 'var(--teal2)' : 'var(--text2)'
                    }}
                  >
                    ⌨️
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                      Clavier Arabe Virtuel
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                      Saisie avec voyelles (Tashkeel) et lettres arabes
                    </div>
                  </div>
                </div>

                <div
                  id="toggle-arabic-keyboard-switch"
                  onClick={() => {
                    setShowArabicKeyboard((v) => {
                      const next = !v;
                      try {
                        localStorage.setItem('quran_arabic_keyboard', next ? '1' : '0');
                      } catch {}
                      return next;
                    });
                  }}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: showArabicKeyboard ? 'var(--teal)' : 'rgba(255, 255, 255, 0.15)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background .2s'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: showArabicKeyboard ? 23 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left .2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }}
                  />
                </div>
              </div>

              {/* Plein Écran Verset */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--surface2)',
                  border: `1px solid ${fullScreenSelectedAyat ? 'rgba(201, 168, 76, 0.4)' : 'rgba(255, 255, 255, 0.07)'}`,
                  transition: 'all .2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: fullScreenSelectedAyat ? 'rgba(201, 168, 76, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      color: fullScreenSelectedAyat ? 'var(--gold2)' : 'var(--text2)'
                    }}
                  >
                    ⛶
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                      Plein Écran Verset (Focus)
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                      Affiche le verset sélectionné en plein écran immersif
                    </div>
                  </div>
                </div>

                <div
                  id="toggle-fullscreen-ayat-switch"
                  onClick={() => dispatch(uiActions.toggleFullScreenSelectedAyat())}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: fullScreenSelectedAyat ? 'var(--gold)' : 'rgba(255, 255, 255, 0.15)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background .2s'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: fullScreenSelectedAyat ? 23 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left .2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }}
                  />
                </div>
              </div>

              {/* Rappels Programmés */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--surface2)',
                  border: '1px solid rgba(255, 255, 255, 0.07)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(201, 168, 76, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      color: 'var(--gold2)'
                    }}
                  >
                    ⏰
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                      Rappels Programmés de Révision
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                      Alertes personnalisées pour vos sourates cibles
                    </div>
                  </div>
                </div>

                <button
                  id="btn-open-scheduled-reminders"
                  onClick={() => {
                    onClose();
                    onOpenScheduledReminders();
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(201, 168, 76, 0.4)',
                    background: 'rgba(201, 168, 76, 0.1)',
                    color: 'var(--gold2)',
                    fontSize: 9,
                    fontFamily: "'Cinzel', serif",
                    fontWeight: 600,
                    letterSpacing: 0.8,
                    cursor: 'pointer',
                    transition: 'all .15s'
                  }}
                >
                  OUVRIR →
                </button>
              </div>

              {/* Rappel Vocal Périodique */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--surface2)',
                  border: `1px solid ${showRappel ? 'rgba(201, 168, 76, 0.4)' : 'rgba(255, 255, 255, 0.07)'}`,
                  transition: 'all .2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: showRappel ? 'rgba(201, 168, 76, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      color: showRappel ? 'var(--gold2)' : 'var(--text2)'
                    }}
                  >
                    🔔
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                      Rappel Vocal Périodique (Dhikr)
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                      Lectures de versets et rappels à intervalles réguliers
                    </div>
                  </div>
                </div>

                <div
                  id="toggle-voice-reminder-switch"
                  onClick={() => setShowRappel((v) => !v)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: showRappel ? 'var(--gold)' : 'rgba(255, 255, 255, 0.15)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background .2s'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: showRappel ? 23 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left .2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }}
                  />
                </div>
              </div>

              {/* Paramètres Généraux */}
              <button
                id="btn-open-options-modal"
                onClick={() => {
                  onClose();
                  onOpenOptionsModal();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px dashed rgba(201, 168, 76, 0.3)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all .15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16 }}>⚙</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold2)', fontFamily: "'Cinzel', serif" }}>
                      Options Générales & Performance
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                      Timestamps audio, animations, orthographe, règles de récitation
                    </div>
                  </div>
                </div>
                <span style={{ color: 'var(--gold)', fontSize: 12 }}>⚙ →</span>
              </button>
            </>
          )}

          {/* TAB 2: VOCAL & AIDE */}
          {activeTab === 'voice' && (
            <>
              {/* Commande Vocale Trigger */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 10,
                  background: listening ? 'rgba(224, 90, 90, 0.15)' : 'var(--surface2)',
                  border: `1px solid ${listening ? 'var(--red)' : 'rgba(255, 255, 255, 0.08)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={toggleVoice}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: listening ? 'var(--red)' : 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      color: '#fff',
                      fontSize: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: listening ? '0 0 16px rgba(224,90,90,0.6)' : undefined
                    }}
                  >
                    🎤
                  </button>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                      {listening ? 'Écoute vocale en cours...' : 'Commande Vocale'}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                      {listening ? 'Dites votre commande ci-dessous' : 'Cliquez sur le micro pour parler'}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 9,
                    padding: '3px 8px',
                    borderRadius: 12,
                    background: listening ? 'rgba(224, 90, 90, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                    color: listening ? 'var(--red)' : 'var(--text3)',
                    fontWeight: 600
                  }}
                >
                  {listening ? 'ACTIF' : 'EN ATTENTE'}
                </span>
              </div>

              {/* Raccourcis Vocaux Utiles */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--surface2)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold2)', letterSpacing: 1, fontFamily: "'Cinzel', serif" }}>
                  Exemples de commandes reconnues :
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6, fontSize: 10 }}>
                  {[
                    ['« Sourate Al-Baqara »', 'Ouvre la sourate 2'],
                    ['« Verset 255 »', 'Navigue à l\'ayat'],
                    ['« Play » ou « Lire »', 'Démarre l\'audio'],
                    ['« Pause » ou « Arrêt »', 'Stoppe la lecture'],
                    ['« Répéter »', 'Active le mode boucle'],
                    ['« Clavier »', 'Active le clavier arabe']
                  ].map(([cmd, desc], idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.04)'
                      }}
                    >
                      <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{cmd}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 8.5 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB: HORS-LIGNE & PWA */}
          {activeTab === 'offline' && (
            <>
              {/* Connectivity & PWA Status Card */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: isOnline ? 'var(--green)' : '#ffd166',
                        display: 'inline-block'
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "'Cinzel', serif",
                        fontSize: 10,
                        fontWeight: 700,
                        color: isOnline ? 'var(--green)' : '#ffd166'
                      }}
                    >
                      {isOnline ? 'CONNECTÉ À INTERNET' : 'MODE HORS-LIGNE ACTIF'}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>
                    Application PWA installable avec cache IndexedDB persistant
                  </div>
                </div>

                <PWAInstallButton />
              </div>

              {/* Offline Resource Downloader */}
              <OfflineLoader
                currentSurah={selectedSurah}
                currentHizb={activeHizb}
                onDownloadDone={() => {}}
              />
            </>
          )}

          {/* TAB: MODE & PROFIL UX */}
          {activeTab === 'ux' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>
                Choisissez le niveau d'interface adapté à vos besoins (novice, débutant, standard, expert, enfant).
              </div>

              {getAvailableUxProfiles().map((p) => {
                const isSelected = uxMode === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => dispatch(uiActions.setUxMode(p.id))}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: '12px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: isSelected
                        ? '2px solid var(--gold)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isSelected
                        ? 'rgba(201, 168, 76, 0.12)'
                        : 'var(--surface2)',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{p.icon}</span>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--gold2)' : 'var(--text)', fontFamily: "'Cinzel', serif" }}>
                            {p.name}
                          </span>
                          {isSelected && (
                            <span style={{ marginLeft: 8, fontSize: 9, color: 'var(--gold)', fontWeight: 600 }}>
                              · ACTIF
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: isSelected ? '2px solid var(--gold)' : '2px solid var(--border2)',
                          background: isSelected ? 'var(--gold)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10131d' }} />}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text2)', lineHeight: 1.4 }}>
                      {p.description}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>
                      Idéal pour : {p.targetAudience}
                    </div>
                  </div>
                );
              })}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  marginTop: 4,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                    Aides et infobulles pas-à-pas
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                    Affiche des conseils pour guider la lecture
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch(uiActions.toggleBeginnerGuides())}
                  role="switch"
                  aria-checked={showBeginnerGuides}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    cursor: 'pointer',
                    background: showBeginnerGuides ? 'var(--gold)' : 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    position: 'relative',
                    transition: 'background .2s',
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: showBeginnerGuides ? 20 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left .2s',
                    }}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MON COMPTE */}
          {activeTab === 'account' && (
            <>
              <div
                style={{
                  padding: '16px',
                  borderRadius: 12,
                  background: 'var(--surface2)',
                  border: '1px solid rgba(201, 168, 76, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14
                }}
              >
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="avatar"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--gold)'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #c9a84c, #e8c96e)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#0c0e14',
                      fontFamily: "'Cinzel', serif"
                    }}
                  >
                    {(currentUser?.displayName || currentUser?.email || '?')[0].toUpperCase()}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {currentUser?.displayName || 'Apprenant du Coran'}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text3)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {currentUser?.email || 'Compte Synchronisé'}
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 6,
                      fontSize: 9,
                      color: 'var(--teal2)',
                      background: 'rgba(62, 184, 160, 0.12)',
                      padding: '2px 8px',
                      borderRadius: 10
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal2)' }} />
                    Synchronisation Cloud Active
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <button
                  id="btn-modal-logout"
                  onClick={() => {
                    onClose();
                    onSignOut();
                  }}
                  style={{
                    padding: '12px',
                    borderRadius: 8,
                    border: '1px solid rgba(224, 90, 90, 0.35)',
                    background: 'rgba(224, 90, 90, 0.08)',
                    color: 'var(--red)',
                    fontFamily: "'Cinzel', serif",
                    fontSize: 10,
                    letterSpacing: 1,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all .15s'
                  }}
                >
                  <span>⏏</span>
                  <span>SE DÉCONNECTER DU COMPTE</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Modal Footer ────────────────────────────────────────────── */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 9,
            color: 'var(--text3)'
          }}
        >
          <span>Qurân Study v1.0 · Hafs 'an 'Asim</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--gold)',
              fontSize: 9,
              letterSpacing: 1,
              fontFamily: "'Cinzel', serif",
              cursor: 'pointer'
            }}
          >
            FERMER
          </button>
        </div>
      </div>
    </div>
  );
}
