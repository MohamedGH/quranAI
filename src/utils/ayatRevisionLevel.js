import { getAyatLetterStats } from "../components/common/Mastery.jsx";

/**
 * Computes comprehensive revision & mastery level info for an Ayat.
 * Returns color, background, border, glow, label, and statistics based on:
 * - toRevise flag (active revision needed)
 * - writing attempts scores (best score: 100%, >=70%, <70%)
 * - letter mastery percentage
 * - learned status
 */
export function getAyatRevisionInfo(ld, ayatText) {
  const stats = getAyatLetterStats(ld, ayatText);
  const masteryPct = stats?.masteryPct || 0;

  const isToRevise = Boolean(ld?.toRevise);
  const attempts = ld?.writingAttempts || [];
  const bestScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.score)) : null;
  const isLearned = Boolean(ld?.learned);

  const qs = ld?.questionScores || {};
  const qKeys = Object.keys(qs);
  const totalQuestionsAnswered = qKeys.reduce((acc, k) => acc + (qs[k]?.length || 0), 0);

  // Classification:
  // 1. "toRevise": Flagged for revision (highest priority alert)
  // 2. "perfect": Writing score 100% or mastery 100% with practice
  // 3. "good": Writing score >= 70% or mastery >= 70%
  // 4. "review": Attempted with bestScore < 70% (errors to fix)
  // 5. "learned": Marked learned (awaiting evaluation or in progress)
  // 6. "unlearned": Not yet learned

  let levelId = "unlearned";
  let label = "Non appris";
  let shortLabel = "—";
  let color = "var(--text3)";
  let bg = "rgba(255, 255, 255, 0.03)";
  let border = "var(--border2)";
  let glow = "none";
  let badgeIcon = "";

  if (isToRevise) {
    levelId = "toRevise";
    label = "À réviser";
    shortLabel = "🔖 REV";
    color = "#ff7eb3";
    bg = "rgba(255, 126, 179, 0.24)";
    border = "#ff7eb3";
    glow = "0 0 8px rgba(255, 126, 179, 0.5)";
    badgeIcon = "🔖";
  } else if (bestScore === 100 || (isLearned && masteryPct === 100 && (attempts.length > 0 || totalQuestionsAnswered > 0))) {
    levelId = "perfect";
    label = "Parfait (100%)";
    shortLabel = "100%";
    color = "var(--green2)";
    bg = "rgba(76, 175, 129, 0.26)";
    border = "var(--green)";
    glow = "0 0 6px rgba(76, 175, 129, 0.35)";
    badgeIcon = "✓";
  } else if ((bestScore !== null && bestScore >= 70) || (isLearned && masteryPct >= 70 && (attempts.length > 0 || totalQuestionsAnswered > 0))) {
    levelId = "good";
    const sc = bestScore !== null ? bestScore : masteryPct;
    label = `Bon niveau (${sc}%)`;
    shortLabel = `${sc}%`;
    color = "var(--teal2)";
    bg = "rgba(62, 184, 160, 0.22)";
    border = "var(--teal)";
    glow = "none";
    badgeIcon = "⭐";
  } else if (bestScore !== null && bestScore > 0) {
    levelId = "review";
    label = `À retravailler (${bestScore}%)`;
    shortLabel = `${bestScore}%`;
    color = "var(--red2)";
    bg = "rgba(224, 98, 82, 0.22)";
    border = "var(--red)";
    glow = "0 0 6px rgba(224, 98, 82, 0.35)";
    badgeIcon = "✗";
  } else if (isLearned) {
    levelId = "learned";
    label = "Appris";
    shortLabel = "Appris";
    color = "#a5b4fc";
    bg = "rgba(124, 140, 248, 0.16)";
    border = "#7c8cf8";
    glow = "none";
    badgeIcon = "●";
  }

  return {
    levelId,
    label,
    shortLabel,
    color,
    bg,
    border,
    glow,
    badgeIcon,
    isToRevise,
    isLearned,
    masteryPct,
    bestScore,
    attemptsCount: attempts.length,
    totalQuestionsAnswered,
    stats,
  };
}

export const REVISION_LEVEL_LEGEND = [
  { id: "toRevise", label: "À réviser (marqué 🔖)", color: "#ff7eb3", bg: "rgba(255, 126, 179, 0.24)", border: "#ff7eb3", glow: "0 0 8px rgba(255, 126, 179, 0.5)" },
  { id: "perfect", label: "Parfait (100% écriture/maîtrise)", color: "var(--green2)", bg: "rgba(76, 175, 129, 0.26)", border: "var(--green)", glow: "0 0 6px rgba(76, 175, 129, 0.35)" },
  { id: "good", label: "Bon niveau (≥ 70%)", color: "var(--teal2)", bg: "rgba(62, 184, 160, 0.22)", border: "var(--teal)" },
  { id: "review", label: "À retravailler (< 70% ou erreurs)", color: "var(--red2)", bg: "rgba(224, 98, 82, 0.22)", border: "var(--red)" },
  { id: "learned", label: "Appris", color: "#a5b4fc", bg: "rgba(124, 140, 248, 0.16)", border: "#7c8cf8" },
  { id: "unlearned", label: "Non appris", color: "var(--text3)", bg: "rgba(255, 255, 255, 0.03)", border: "var(--border2)" },
];
