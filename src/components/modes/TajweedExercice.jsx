import React, { useState, useMemo } from "react";
import { scanAyatTajweed, TAJWEED_RULES, TAJWEED_CATEGORIES } from "../../utils/tajweedRules.js";

export function TajweedExercice({ ayat }) {
  const [mode, setMode] = useState('detect'); // 'detect' | 'match' | 'guide'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeInspector, setActiveInspector] = useState(null); // rule object or finding
  const [selectedTarget, setSelectedTarget] = useState(null); // in match mode: finding ID
  const [selectedRule, setSelectedRule] = useState(null); // in match mode: rule ID
  const [answered, setAnswered] = useState({}); // { [findingId]: { correct: boolean, ruleId: string, message: string } }
  const [showHint, setShowHint] = useState(false);
  const [expandedGuideRule, setExpandedGuideRule] = useState(null);

  // ── 1. Scan ayat text with high-precision Tajweed engine ───────────────────
  const { findings, wordData } = useMemo(() => {
    const text = ayat?.text || '';
    if (!text) return { findings: [], wordData: [] };

    // Build word index lookup
    const rawWords = text.split(' ');
    let currentOffset = 0;
    const words = rawWords.map((w, wIdx) => {
      const charArr = [...w];
      const start = currentOffset;
      const end = currentOffset + charArr.length;
      currentOffset = end + 1; // +1 for space
      return { word: w, charArr, wIdx, start, end };
    });

    const rawFindings = scanAyatTajweed(text);

    // Enrich each finding with its containing word and unique ID
    const enriched = rawFindings.map((f, i) => {
      const parentWord = words.find(wd => f.idx >= wd.start && f.idx < wd.end) || { word: f.char, start: f.idx };
      const relativeCharIdx = f.idx - parentWord.start;
      const ruleMeta = TAJWEED_RULES.find(r => r.id === f.ruleId) || {
        id: f.ruleId,
        name: f.ruleId,
        nameAr: f.ruleId,
        label: f.ruleId,
        labelAr: f.ruleId,
        color: '#fbbf24',
        category: 'noun_tanwin',
        desc: ''
      };

      return {
        id: `f_${i}_${f.idx}_${f.ruleId}`,
        idx: f.idx,
        char: f.char,
        ruleId: f.ruleId,
        rule: ruleMeta,
        wordIdx: f.wordIdx,
        wordText: parentWord.word,
        relativeCharIdx,
        matchedWith: f.matchedWith || ''
      };
    });

    return { findings: enriched, wordData: words };
  }, [ayat?.text]);

  // Unique rules present in this verse
  const presentRules = useMemo(() => {
    const uniqueIds = [...new Set(findings.map(f => f.ruleId))];
    return uniqueIds.map(id => TAJWEED_RULES.find(r => r.id === id)).filter(Boolean);
  }, [findings]);

  // Filtered findings by active category in 'detect' mode
  const filteredFindings = useMemo(() => {
    if (selectedCategory === 'all') return findings;
    return findings.filter(f => f.rule?.category === selectedCategory);
  }, [findings, selectedCategory]);

  // Deduplicated exercise items for match mode
  const exerciseItems = useMemo(() => {
    // Keep distinctive instances so the student tests each rule in context
    return findings.slice(0, 8); // max 8 items per exercise to keep it focused
  }, [findings]);

  const exerciseRules = useMemo(() => {
    const ids = [...new Set(exerciseItems.map(item => item.ruleId))];
    return ids.map(id => TAJWEED_RULES.find(r => r.id === id)).filter(Boolean);
  }, [exerciseItems]);

  // ── Handlers for Match Mode ────────────────────────────────────────────────
  const handleSelectTarget = (targetId) => {
    if (answered[targetId]) return;
    setSelectedTarget(targetId);
    if (selectedRule) {
      checkMatch(targetId, selectedRule);
    }
  };

  const handleSelectRule = (ruleId) => {
    setSelectedRule(ruleId);
    if (selectedTarget) {
      checkMatch(selectedTarget, ruleId);
    }
  };

  const checkMatch = (targetId, ruleId) => {
    const target = exerciseItems.find(t => t.id === targetId);
    if (!target) return;

    const isCorrect = target.ruleId === ruleId;
    let message = '';

    if (isCorrect) {
      message = `✓ Exact ! ${target.rule.name} (${target.rule.nameAr}) — ${target.rule.desc}`;
    } else {
      const correctRule = TAJWEED_RULES.find(r => r.id === target.ruleId);
      message = `✗ Ce n'est pas cette règle. C'est ${correctRule?.name || target.ruleId} (${correctRule?.desc || ''})`;
    }

    setAnswered(prev => ({
      ...prev,
      [targetId]: { correct: isCorrect, ruleId, message }
    }));
    setSelectedTarget(null);
    setSelectedRule(null);
    setShowHint(false);
  };

  const resetExercise = () => {
    setAnswered({});
    setSelectedTarget(null);
    setSelectedRule(null);
    setShowHint(false);
  };

  const totalExercises = exerciseItems.length;
  const answeredCount = Object.keys(answered).length;
  const correctCount = Object.values(answered).filter(a => a.correct).length;
  const isComplete = answeredCount === totalExercises && totalExercises > 0;

  if (!ayat || !ayat.text) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 11, letterSpacing: 1.5 }}>
        Aucun texte de verset disponible pour cet exercice.
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Mode Navigation Bar ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 4
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            ['detect', '🔍 ANALYSE DU VERSET'],
            ['match', `🎯 QUIZ TAJWEED ${findings.length > 0 ? `(${findings.length})` : ''}`],
            ['guide', '📖 GUIDE DES RÈGLES']
          ].map(([m, label]) => (
            <button
              key={m}
              id={`tajweed-tab-${m}`}
              onClick={() => {
                setMode(m);
                setActiveInspector(null);
                setSelectedTarget(null);
                setSelectedRule(null);
              }}
              style={{
                padding: '9px 15px',
                fontSize: 9,
                letterSpacing: 1.5,
                fontFamily: "'Cinzel', serif",
                fontWeight: mode === m ? 700 : 500,
                background: mode === m ? 'rgba(201,168,76,.1)' : 'transparent',
                border: 'none',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                borderBottom: mode === m ? '2px solid var(--gold)' : '2px solid transparent',
                color: mode === m ? 'var(--gold)' : 'var(--text3)',
                transition: 'all .15s ease'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {findings.length > 0 && (
          <div style={{
            fontSize: 9,
            padding: '3px 10px',
            borderRadius: 12,
            background: 'rgba(56,189,248,.12)',
            color: '#38bdf8',
            border: '1px solid rgba(56,189,248,.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 5
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
            {findings.length} règle{findings.length > 1 ? 's' : ''} détectée{findings.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── MODE 1: DÉTECTION & ANALYSE DÉTAILLÉE ────────────────────────────── */}
      {mode === 'detect' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>Filtre :</span>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '4px 10px',
                borderRadius: 16,
                fontSize: 9,
                cursor: 'pointer',
                border: `1px solid ${selectedCategory === 'all' ? 'var(--gold)' : 'var(--border2)'}`,
                background: selectedCategory === 'all' ? 'rgba(201,168,76,.15)' : 'var(--surface2)',
                color: selectedCategory === 'all' ? 'var(--gold)' : 'var(--text2)',
                transition: 'all .15s'
              }}
            >
              Toutes ({findings.length})
            </button>
            {Object.entries(TAJWEED_CATEGORIES).map(([catKey, cat]) => {
              const count = findings.filter(f => f.rule?.category === catKey).length;
              if (count === 0) return null;
              const isSelected = selectedCategory === catKey;
              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 16,
                    fontSize: 9,
                    cursor: 'pointer',
                    border: `1px solid ${isSelected ? cat.color : 'var(--border2)'}`,
                    background: isSelected ? `${cat.color}22` : 'var(--surface2)',
                    color: isSelected ? cat.color : 'var(--text2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all .15s'
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Ayat display with interactive Tajweed highlighted letters */}
          <div style={{
            padding: '20px 22px',
            borderRadius: 12,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,.15)'
          }}>
            <div style={{
              direction: 'rtl',
              lineHeight: 2.5,
              fontSize: 26,
              fontFamily: "'Scheherazade New', serif",
              letterSpacing: 0.5,
              textAlign: 'right'
            }}>
              {wordData.map((wObj, wi) => {
                return (
                  <span key={wi} style={{ display: 'inline-block', margin: '0 5px' }}>
                    {wObj.charArr.map((ch, ci) => {
                      const absIdx = wObj.start + ci;
                      const finding = filteredFindings.find(f => f.idx === absIdx);
                      const isHighlighted = !!finding;
                      const rColor = finding?.rule?.color || '#fbbf24';
                      const isInspecting = activeInspector?.id === finding?.id;

                      if (!isHighlighted) {
                        return <span key={ci} style={{ color: 'var(--text)' }}>{ch}</span>;
                      }

                      return (
                        <span
                          key={ci}
                          id={`tajweed-char-${absIdx}`}
                          onClick={() => setActiveInspector(finding)}
                          title={`Cliquez pour inspecter : ${finding.rule?.name || 'Règle Tajweed'}`}
                          style={{
                            color: rColor,
                            cursor: 'pointer',
                            fontWeight: 700,
                            padding: '1px 3px',
                            borderRadius: 4,
                            background: isInspecting ? `${rColor}33` : `${rColor}15`,
                            borderBottom: `2px solid ${rColor}`,
                            boxShadow: isInspecting ? `0 0 10px ${rColor}66` : undefined,
                            transition: 'all .15s ease',
                            userSelect: 'none'
                          }}
                        >
                          {ch}
                        </span>
                      );
                    })}
                  </span>
                );
              })}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--border2)',
              fontSize: 10,
              color: 'var(--text3)'
            }}>
              <span>Astuce : Cliquez sur une lettre colorée pour inspecter sa règle de récitation.</span>
              {activeInspector && (
                <button
                  onClick={() => setActiveInspector(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--gold)',
                    fontSize: 9,
                    cursor: 'pointer'
                  }}
                >
                  Fermer l'inspecteur ✕
                </button>
              )}
            </div>
          </div>

          {/* Active Rule Inspector Card */}
          {activeInspector && (
            <div style={{
              padding: '16px 18px',
              borderRadius: 10,
              background: `${activeInspector.rule?.color || '#38bdf8'}12`,
              border: `1.5px solid ${activeInspector.rule?.color || '#38bdf8'}55`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              animation: 'fadeIn .2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: activeInspector.rule?.color || '#38bdf8',
                    boxShadow: `0 0 8px ${activeInspector.rule?.color || '#38bdf8'}`
                  }} />
                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: activeInspector.rule?.color || 'var(--gold)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <span>{activeInspector.rule?.name}</span>
                      <span style={{ fontFamily: "'Scheherazade New', serif", fontSize: 18 }}>
                        {activeInspector.rule?.nameAr}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                      Catégorie : {TAJWEED_CATEGORIES[activeInspector.rule?.category]?.name || 'Tajweed'}
                    </div>
                  </div>
                </div>

                <div style={{
                  textAlign: 'right',
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)'
                }}>
                  <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--text3)', textTransform: 'uppercase' }}>Durée</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)' }}>
                    {activeInspector.rule?.duration || 'Naturelle'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.6 }}>
                {activeInspector.rule?.desc}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 8,
                marginTop: 4,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--surface2)',
                fontSize: 10
              }}>
                <div>
                  <span style={{ color: 'var(--text3)' }}>Lettre dans le mot : </span>
                  <span style={{ fontWeight: 600, color: activeInspector.rule?.color }}>
                    {activeInspector.char}
                  </span>
                  <span style={{ color: 'var(--text3)', marginLeft: 6 }}>
                    dans « {activeInspector.wordText} »
                  </span>
                </div>
                {activeInspector.rule?.letters && (
                  <div>
                    <span style={{ color: 'var(--text3)' }}>Lettres associées : </span>
                    <span style={{ fontFamily: "'Scheherazade New', serif", fontSize: 14, color: 'var(--text)' }}>
                      {activeInspector.rule.letters}
                    </span>
                  </div>
                )}
                {activeInspector.rule?.ruleSummary && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--text3)' }}>Application : </span>
                    <span style={{ color: 'var(--text2)' }}>{activeInspector.rule.ruleSummary}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scannable Legend Pills of Present Rules */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--text3)', textTransform: 'uppercase' }}>
              Règles identifiées dans ce verset ({presentRules.length})
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {presentRules.map(rule => {
                const count = findings.filter(f => f.ruleId === rule.id).length;
                const rColor = rule.color || '#e5c07b';
                const isSelected = activeInspector?.rule?.id === rule.id;

                return (
                  <div
                    key={rule.id}
                    onClick={() => {
                      const firstFinding = findings.find(f => f.ruleId === rule.id);
                      if (firstFinding) setActiveInspector(firstFinding);
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? rColor : `${rColor}33`}`,
                      background: isSelected ? `${rColor}22` : `${rColor}0c`,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      transition: 'all .15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: rColor }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: rColor }}>{rule.label || rule.name}</span>
                      </div>
                      <span style={{
                        fontSize: 9,
                        padding: '1px 7px',
                        borderRadius: 10,
                        background: `${rColor}22`,
                        color: rColor,
                        fontWeight: 600
                      }}>
                        {count} fois
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{ fontFamily: "'Scheherazade New', serif", fontSize: 16, color: rColor }}>
                        {rule.nameAr}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text3)' }}>{rule.duration}</span>
                    </div>

                    <div style={{ fontSize: 9, color: 'var(--text2)', lineHeight: 1.4, marginTop: 2 }}>
                      {rule.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MODE 2: EXERCICE PRATIQUE & ASSOCIATION DIDACTIQUE ──────────────── */}
      {mode === 'match' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Progress Banner */}
          <div style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                Associez chaque lettre en contexte à sa règle de Tajweed
              </div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                Progression : {answeredCount} / {totalExercises} traités · {correctCount} correct{correctCount > 1 ? 's' : ''}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                id="btn-tajweed-hint"
                onClick={() => setShowHint(!showHint)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 9,
                  cursor: 'pointer',
                  border: '1px solid var(--border2)',
                  background: showHint ? 'rgba(234,179,8,.15)' : 'var(--surface3)',
                  color: showHint ? 'var(--gold)' : 'var(--text2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                💡 Indice
              </button>

              <button
                id="btn-tajweed-reset"
                onClick={resetExercise}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 9,
                  cursor: 'pointer',
                  border: '1px solid var(--border2)',
                  background: 'var(--surface3)',
                  color: 'var(--text3)'
                }}
              >
                ↺ Recommencer
              </button>
            </div>
          </div>

          {/* Hint callout */}
          {showHint && selectedTarget && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(234,179,8,.1)',
              border: '1px solid rgba(234,179,8,.3)',
              fontSize: 10,
              color: 'var(--gold)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span>💡</span>
              <span>
                Indice pour « {exerciseItems.find(t => t.id === selectedTarget)?.wordText} » :
                Observez la lettre qui suit et le signe de vocalisation porté.
              </span>
            </div>
          )}

          {/* Target Items: Words with spotlighted letter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--text3)', textTransform: 'uppercase' }}>
              1. Sélectionnez la lettre dans son mot
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {exerciseItems.map(item => {
                const isSelected = selectedTarget === item.id;
                const status = answered[item.id];
                const isAnswered = !!status;
                const isCorrect = status?.correct;

                let borderCol = 'var(--border2)';
                let bgCol = 'var(--surface2)';
                let textCol = 'var(--text)';

                if (isSelected) {
                  borderCol = 'var(--gold)';
                  bgCol = 'rgba(201,168,76,.15)';
                } else if (isAnswered) {
                  borderCol = isCorrect ? 'var(--green)' : 'var(--red)';
                  bgCol = isCorrect ? 'rgba(76,175,129,.12)' : 'rgba(224,90,90,.12)';
                  textCol = isCorrect ? 'var(--green)' : 'var(--red)';
                }

                return (
                  <button
                    key={item.id}
                    id={`quiz-target-${item.id}`}
                    onClick={() => handleSelectTarget(item.id)}
                    disabled={isAnswered}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `2px solid ${borderCol}`,
                      background: bgCol,
                      cursor: isAnswered ? 'default' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all .15s ease',
                      position: 'relative'
                    }}
                  >
                    <span style={{
                      fontFamily: "'Scheherazade New', serif",
                      fontSize: 24,
                      direction: 'rtl',
                      color: textCol
                    }}>
                      {item.wordText}
                    </span>

                    <span style={{
                      fontSize: 9,
                      color: isSelected ? 'var(--gold)' : 'var(--text3)',
                      fontWeight: 600
                    }}>
                      Lettre : {item.char}
                    </span>

                    {isAnswered && (
                      <span style={{
                        position: 'absolute',
                        top: 4,
                        right: 6,
                        fontSize: 10,
                        color: isCorrect ? 'var(--green)' : 'var(--red)'
                      }}>
                        {isCorrect ? '✓' : '✗'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rule Selection Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--text3)', textTransform: 'uppercase' }}>
              2. Choisissez la règle correspondante
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {exerciseRules.map(rule => {
                const isSelected = selectedRule === rule.id;
                const rColor = rule.color || '#e5c07b';

                return (
                  <button
                    key={rule.id}
                    id={`quiz-rule-${rule.id}`}
                    onClick={() => handleSelectRule(rule.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `2px solid ${isSelected ? 'var(--gold)' : 'var(--border2)'}`,
                      background: isSelected ? 'rgba(201,168,76,.15)' : 'var(--surface2)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 4,
                      transition: 'all .15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isSelected ? 'var(--gold)' : rColor
                      }}>
                        {rule.label || rule.name}
                      </span>
                      <span style={{ fontFamily: "'Scheherazade New', serif", fontSize: 16, color: rColor }}>
                        {rule.nameAr}
                      </span>
                    </div>

                    <span style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'left', lineHeight: 1.3 }}>
                      {rule.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Educational Feedback Message */}
          {Object.entries(answered).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(answered).slice(-2).map(([tId, status]) => (
                <div
                  key={tId}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 10,
                    background: status.correct ? 'rgba(76,175,129,.1)' : 'rgba(224,90,90,.1)',
                    border: `1px solid ${status.correct ? 'var(--green)' : 'var(--red)'}`,
                    color: status.correct ? 'var(--green)' : 'var(--red)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <span>{status.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Completion Celebration Card */}
          {isComplete && (
            <div style={{
              padding: '18px 20px',
              borderRadius: 12,
              textAlign: 'center',
              background: correctCount === totalExercises ? 'rgba(76,175,129,.15)' : 'rgba(201,168,76,.12)',
              border: `1.5px solid ${correctCount === totalExercises ? 'var(--green)' : 'var(--gold)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: correctCount === totalExercises ? 'var(--green)' : 'var(--gold)' }}>
                {correctCount === totalExercises ? '🎉 Félicitations ! Score Parfait !' : `Résultat : ${correctCount} sur ${totalExercises} réussis`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 460 }}>
                {correctCount === totalExercises
                  ? 'Vous maîtrisez parfaitement l’identification des règles de Tajweed pour ce verset.'
                  : 'Continuez votre pratique pour consolider vos réflexes sur les règles de récitation.'}
              </div>
              <button
                onClick={resetExercise}
                style={{
                  marginTop: 6,
                  padding: '8px 20px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  fontFamily: "'Cinzel', serif",
                  cursor: 'pointer',
                  background: 'var(--gold)',
                  color: '#000',
                  border: 'none'
                }}
              >
                RECOMMENCER LE QUIZ
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MODE 3: GUIDE PÉDAGOGIQUE DU TAJWEED ─────────────────────────────── */}
      {mode === 'guide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>
            Référence des règles de récitation selon la transmission de <strong>Hafs d'après 'Asim</strong>.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {TAJWEED_RULES.map(rule => {
              const isExpanded = expandedGuideRule === rule.id;
              const rColor = rule.color || '#e5c07b';

              return (
                <div
                  key={rule.id}
                  id={`guide-rule-${rule.id}`}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: 'var(--surface2)',
                    border: `1px solid ${isExpanded ? rColor : 'var(--border2)'}`,
                    boxShadow: isExpanded ? `0 4px 16px ${rColor}22` : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    cursor: 'pointer',
                    transition: 'all .2s ease'
                  }}
                  onClick={() => setExpandedGuideRule(isExpanded ? null : rule.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: rColor }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: rColor }}>
                        {rule.name}
                      </span>
                    </div>
                    <span style={{ fontFamily: "'Scheherazade New', serif", fontSize: 18, color: rColor }}>
                      {rule.nameAr}
                    </span>
                  </div>

                  <div style={{ fontSize: 10, color: 'var(--text)' }}>
                    {rule.desc}
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: 'var(--surface3)',
                    fontSize: 9
                  }}>
                    <span style={{ color: 'var(--text3)' }}>Durée : <strong style={{ color: 'var(--gold)' }}>{rule.duration}</strong></span>
                    <span style={{ color: 'var(--text3)' }}>Lettres : <strong style={{ color: 'var(--text)' }}>{rule.letters}</strong></span>
                  </div>

                  {rule.example && (
                    <div style={{
                      direction: 'rtl',
                      fontFamily: "'Scheherazade New', serif",
                      fontSize: 18,
                      color: rColor,
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: `${rColor}11`,
                      textAlign: 'center'
                    }}>
                      {rule.example}
                    </div>
                  )}

                  <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'right' }}>
                    {isExpanded ? 'Réduire ▲' : 'Détails ▼'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
