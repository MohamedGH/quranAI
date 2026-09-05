import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";

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
  initialTab = 'tools'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const dispatch = useDispatch();

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
          maxHeight: '90vh'
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

        {/* ── Tabs Selector ────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            padding: '8px 18px 0',
            gap: 8,
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          {[
            { id: 'tools', label: '🎛️ OUTILS D\'ÉTUDE' },
            { id: 'voice', label: '🎤 VOCAL & AIDE' },
            { id: 'account', label: '👤 MON COMPTE' }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`modal-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 14px',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: 1,
                  background: isActive ? 'rgba(201, 168, 76, 0.12)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  borderRadius: '6px 6px 0 0',
                  color: isActive ? 'var(--gold2)' : 'var(--text3)',
                  cursor: 'pointer',
                  transition: 'all .15s'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Modal Body Content ────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* TAB 1: OUTILS D'ÉTUDE */}
          {activeTab === 'tools' && (
            <>
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
