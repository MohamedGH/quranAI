// ─── Shared toRevise state/actions with history tracking ─────────────────────
// Used by ToRevisePanel and DecouverteMode so the marking logic lives in one place.

export function useToRevise(ld, surahNum, ayatNum, setLData) {
  const saveWithHistory = (nextRevise, prevRevise) => {
    const now = new Date().toISOString();
    setLData(surahNum, ayatNum, d => {
      const hist = [...(d.reviseHistory || [])];
      const wasActive = !!prevRevise;
      const willBeActive = !!nextRevise;
      if (!wasActive && willBeActive) {
        // Starting a new revise session
        hist.push({
          startDate: now,
          endDate: null,
          words: typeof nextRevise === "object" ? nextRevise.words || [] : "all",
          parts: typeof nextRevise === "object" ? nextRevise.parts || [] : [],
          chars: typeof nextRevise === "object" ? nextRevise.chars || {} : {},
        });
      } else if (wasActive && !willBeActive) {
        // Closing current session — find the last open entry
        const lastOpen = [...hist].reverse().findIndex(e => !e.endDate);
        if (lastOpen >= 0) {
          const idx = hist.length - 1 - lastOpen;
          hist[idx] = { ...hist[idx], endDate: now };
        }
      } else if (wasActive && willBeActive) {
        // Update the current open entry's selection
        const lastOpen = [...hist].reverse().findIndex(e => !e.endDate);
        if (lastOpen >= 0) {
          const idx = hist.length - 1 - lastOpen;
          hist[idx] = {
            ...hist[idx],
            words: typeof nextRevise === "object" ? nextRevise.words || [] : "all",
            parts: typeof nextRevise === "object" ? nextRevise.parts || [] : [],
            chars: typeof nextRevise === "object" ? nextRevise.chars || {} : {},
          };
        } else {
          // No open entry, create one
          hist.push({
            startDate: now,
            endDate: null,
            words: typeof nextRevise === "object" ? nextRevise.words || [] : "all",
            parts: typeof nextRevise === "object" ? nextRevise.parts || [] : [],
            chars: typeof nextRevise === "object" ? nextRevise.chars || {} : {},
          });
        }
      }
      return { ...d, toRevise: nextRevise, reviseHistory: hist };
    });
  };

  const revise = ld?.toRevise;
  const isActive = !!revise;
  const selWords = revise && typeof revise === "object" ? revise.words || [] : [];
  const selParts = revise && typeof revise === "object" ? revise.parts || [] : [];
  const selChars = revise && typeof revise === "object" ? revise.chars || {} : {};

  const toggleAll = () => saveWithHistory(isActive ? false : true, revise);

  const toggleWord = i => {
    const cur = typeof revise === "object" ? revise : {};
    const prev = cur.words || [];
    const next = prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i];
    const nextParts = cur.parts || [];
    const nextChars = { ...(cur.chars || {}) };
    if (prev.includes(i)) delete nextChars[i];
    const nextRevise =
      next.length === 0 && nextParts.length === 0
        ? false
        : { ...cur, words: next, chars: nextChars };
    saveWithHistory(nextRevise, revise);
    return prev.includes(i); // true if word WAS selected (i.e. we just removed it)
  };

  const toggleChar = (wi, ci) => {
    const cur = typeof revise === "object" ? revise : {};
    const prev = (cur.chars || {})[wi] || [];
    const next = prev.includes(ci) ? prev.filter(x => x !== ci) : [...prev, ci];
    const newChars = { ...(cur.chars || {}), [wi]: next };
    if (next.length === 0) delete newChars[wi];
    const prevWords = cur.words || [];
    let newWords = prevWords;
    if (next.length > 0 && !prevWords.includes(wi)) newWords = [...prevWords, wi];
    if (next.length === 0 && prevWords.includes(wi))
      newWords = prevWords.filter(x => x !== wi);
    const nextParts = cur.parts || [];
    const isEmpty =
      newWords.length === 0 && nextParts.length === 0 && Object.keys(newChars).length === 0;
    saveWithHistory(isEmpty ? false : { ...cur, words: newWords, chars: newChars }, revise);
  };

  const togglePart = pid => {
    const cur = typeof revise === "object" ? revise : {};
    const prev = cur.parts || [];
    const next = prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid];
    const nextWords = cur.words || [];
    const nextRevise =
      next.length === 0 && nextWords.length === 0 ? false : { ...cur, parts: next };
    saveWithHistory(nextRevise, revise);
  };

  return {
    revise,
    isActive,
    selWords,
    selParts,
    selChars,
    toggleAll,
    toggleWord,
    toggleChar,
    togglePart,
  };
}
