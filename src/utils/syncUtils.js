// ─── Sync & Storage Merge Utilities ─────────────────────────────────────────

export const DATA_KEYS = [
  "quran_learnData",
  "quran_collections",
  "quran_activity",
  "quran_loopBySurah",
  "quran_lastAyatBySurah",
  "quran_goal_dailyAyats",
  "quran_goal_dailyParts",
  "quran_goal_weeklyAyats",
  "quran_goal_targetSurah",
  "quran_goal_targetDate",
  "quran_revision_mastery",
];
DATA_KEYS.LEARN       = "quran_learnData";
DATA_KEYS.COLLECTIONS = "quran_collections";
DATA_KEYS.ACTIVITY    = "quran_activity";
DATA_KEYS.GOALS       = "quran_goal_dailyAyats";
DATA_KEYS.OPTIONS     = "quran_options";
DATA_KEYS.REVISION    = "quran_revision_mastery";


export function getDeviceId() {
  let id = localStorage.getItem("quran_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
    localStorage.setItem("quran_device_id", id);
  }
  return id;
}

// Deep merge two learnData objects using updatedAt timestamps for conflict resolution
export function mergeLearnData(base, incoming) {
  const out = { ...base };
  for (const [key, val] of Object.entries(incoming)) {
    if (!out[key]) {
      out[key] = val;
      continue;
    }
    const b = out[key];
    // Newer updatedAt wins for scalar fields
    const bNewer = (b.updatedAt || "") >= (val.updatedAt || "");
    const winner = bNewer ? b : val;
    const loser = bNewer ? val : b;

    // Merge parts: ALWAYS union of both sides — never drop a part from either device
    // For each id: newer createdAt/updatedAt wins for data, learned=true always wins
    const partsMap = {};
    for (const p of [...(b.parts || []), ...(val.parts || [])]) {
      if (!partsMap[p.id]) {
        partsMap[p.id] = p;
      } else {
        const existing = partsMap[p.id];
        const pNewer = (p.updatedAt || p.createdAt || "") >= (existing.updatedAt || existing.createdAt || "");
        const pw = pNewer ? p : existing;
        partsMap[p.id] = { ...existing, ...pw, learned: !!(p.learned || existing.learned) };
      }
    }

    // Merge recitAttempts: concat + dedupe by date
    const attemptsMap = {};
    for (const a of [...(b.recitAttempts || []), ...(val.recitAttempts || [])]) {
      attemptsMap[a.date] = a;
    }

    // Merge wordsLearned: true wins
    const wl = { ...(b.wordsLearned || {}), ...(val.wordsLearned || {}) };
    for (const k of Object.keys(b.wordsLearned || {})) {
      if (b.wordsLearned[k]) wl[k] = true;
    }

    out[key] = {
      ...loser,
      ...winner,
      learned: b.learned || val.learned,
      learnedAt: b.learnedAt || val.learnedAt,
      createdAt:
        b.createdAt && val.createdAt
          ? b.createdAt < val.createdAt
            ? b.createdAt
            : val.createdAt
          : b.createdAt || val.createdAt,
      updatedAt:
        b.updatedAt && val.updatedAt
          ? b.updatedAt > val.updatedAt
            ? b.updatedAt
            : val.updatedAt
          : b.updatedAt || val.updatedAt,
      readCount: Math.max(b.readCount || 0, val.readCount || 0),
      parts: Object.values(partsMap),
      recitAttempts: Object.values(attemptsMap)
        .sort((a, z) => (a.date < z.date ? -1 : 1))
        .slice(-50),
      wordsLearned: wl,
    };
  }
  return out;
}

export function mergeActivity(base, incoming) {
  const out = { ...base };
  for (const [date, v] of Object.entries(incoming)) {
    if (!out[date]) {
      out[date] = v;
      continue;
    }
    const bNewer = (out[date].updatedAt || "") >= (v.updatedAt || "");
    out[date] = {
      ayatsRead: Math.max(out[date].ayatsRead || 0, v.ayatsRead || 0),
      partsLearned: Math.max(out[date].partsLearned || 0, v.partsLearned || 0),
      ayatsLearned: Math.max(out[date].ayatsLearned || 0, v.ayatsLearned || 0),
      createdAt: out[date].createdAt || v.createdAt,
      updatedAt: bNewer ? out[date].updatedAt : v.updatedAt,
    };
  }
  return out;
}

export function mergeCollections(base, incoming) {
  const out = base.map(c => ({ ...c }));
  for (const col of incoming) {
    const existing = out.find(c => c.id === col.id);
    if (!existing) {
      out.push({ ...col });
      continue;
    }
    // Merge ayats: dedupe by surahNum:ayatNum
    const ayatKeys = new Set(existing.ayats.map(a => `${a.surahNum}:${a.ayatNum}`));
    for (const a of col.ayats) {
      const k = `${a.surahNum}:${a.ayatNum}`;
      if (!ayatKeys.has(k)) {
        existing.ayats.push(a);
        ayatKeys.add(k);
      }
    }
  }
  return out;
}


export const syncLogEntries = [];

export function addSyncLog(type, msg) {
  const entry = { date: new Date().toLocaleTimeString(), type, msg };
  syncLogEntries.unshift(entry);
  if (syncLogEntries.length > 50) syncLogEntries.length = 50;
  window.__syncLogListeners?.forEach(fn => fn([...syncLogEntries]));
}
