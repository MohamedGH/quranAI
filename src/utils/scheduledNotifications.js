// ─── Scheduled Notification System for Daily Quran Revision & Memorization ───

const STORAGE_KEY = "quran_scheduled_reminders";
const SETTINGS_KEY = "quran_reminders_settings";
const SNOOZE_KEY = "quran_reminders_snooze";

export const REMINDER_TYPES = [
  { id: "revision", label: "Révision des Versets", icon: "🔄", color: "#ff7eb3", defaultPath: "/revision" },
  { id: "memorization", label: "Mémorisation", icon: "🧠", color: "var(--teal2)", defaultPath: "/quran" },
  { id: "reading", label: "Lecture & Récitation", icon: "📖", color: "var(--gold2)", defaultPath: "/quran" },
  { id: "goal_check", label: "Bilan des Objectifs", icon: "🎯", color: "var(--green2)", defaultPath: "/dashboard" },
];

export const DAYS_OPTIONS = [
  { id: "all", label: "Tous les jours" },
  { id: "weekdays", label: "Du lundi au vendredi" },
  { id: "weekends", label: "Samedi & Dimanche" },
  { id: "custom", label: "Jours personnalisés" },
];

export const DAY_NAMES = [
  { idx: 1, short: "Lun", full: "Lundi" },
  { idx: 2, short: "Mar", full: "Mardi" },
  { idx: 3, short: "Mer", full: "Mercredi" },
  { idx: 4, short: "Jeu", full: "Jeudi" },
  { idx: 5, short: "Ven", full: "Vendredi" },
  { idx: 6, short: "Sam", full: "Samedi" },
  { idx: 0, short: "Dim", full: "Dimanche" },
];

export const DEFAULT_REMINDERS = [
  {
    id: "preset_fajr",
    title: "Révision du Matin",
    time: "06:30",
    type: "revision",
    enabled: true,
    daysMode: "all",
    customDays: [0, 1, 2, 3, 4, 5, 6],
    sound: true,
    speech: false,
    message: "Prenez 10 minutes pour consolider vos versets appris.",
    quote: "وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا",
  },
  {
    id: "preset_afternoon",
    title: "Mémorisation Quotidienne",
    time: "14:30",
    type: "memorization",
    enabled: true,
    daysMode: "all",
    customDays: [0, 1, 2, 3, 4, 5, 6],
    sound: true,
    speech: false,
    message: "C'est l'heure de votre session de mémorisation du Coran.",
    quote: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
  },
  {
    id: "preset_evening",
    title: "Session du Soir & Tilawa",
    time: "20:45",
    type: "reading",
    enabled: true,
    daysMode: "all",
    customDays: [0, 1, 2, 3, 4, 5, 6],
    sound: true,
    speech: false,
    message: "Terminez votre journée par une lecture et révision sereine.",
    quote: "إِنَّ قُرْآنَ الْفَجْرِ كَانَ مَشْهُودًا",
  },
];

export const DEFAULT_SETTINGS = {
  masterEnabled: true,
  enableBrowserNotifications: true,
  enableInAppToasts: true,
  soundEnabled: true,
  soundType: "chime", // "chime" | "bell" | "subtle"
  volume: 0.8,
  snoozeDurationMin: 15,
};

// ─── Local Storage Operations ──────────────────────────────────────────────────

export function loadReminders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveReminders(DEFAULT_REMINDERS);
      return DEFAULT_REMINDERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_REMINDERS;
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export function saveReminders(reminders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  } catch (err) {
    console.warn("Could not save reminders:", err);
  }
}

export function loadReminderSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveReminderSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("Could not save reminder settings:", err);
  }
}

// ─── Sound Generator (Web Audio API) ──────────────────────────────────────────

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && typeof window !== "undefined") {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playReminderChime(soundType = "chime", volume = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(Math.min(1, volume * 0.9), now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    gainNode.connect(ctx.destination);

    if (soundType === "chime") {
      // Harmonic crystal chime: E5 (659Hz) + B5 (987Hz) + E6 (1318Hz)
      const freqs = [659.25, 987.77, 1318.51];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + idx * 0.12);
        osc.connect(gainNode);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.4);
      });
    } else if (soundType === "bell") {
      // Deeper resonant bell tone
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(261.63, now + 1.5);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 1.6);
    } else {
      // Soft double blip
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      osc1.connect(gainNode);
      osc1.start(now);
      osc1.stop(now + 0.2);

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1174.66, now + 0.25);
      osc2.connect(gainNode);
      osc2.start(now + 0.25);
      osc2.stop(now + 0.7);
    }
  } catch (err) {
    console.warn("Audio chime error:", err);
  }
}

// ─── Browser Notifications ────────────────────────────────────────────────────

export function getBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission; // "default", "granted", "denied"
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "denied";
  }
}

export function sendBrowserNotification(title, { body, icon, tag, onClick } = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;

  try {
    const notif = new Notification(title, {
      body: body || "Rappel de révision du Saint Coran",
      icon: icon || "/favicon.ico",
      tag: tag || "quran_daily_reminder",
      badge: "/favicon.ico",
      silent: false,
    });

    if (onClick) {
      notif.onclick = (e) => {
        window.focus();
        onClick(e);
        notif.close();
      };
    }
    return notif;
  } catch (err) {
    console.warn("Browser notification dispatch failed:", err);
    return null;
  }
}

// ─── Snooze Management ────────────────────────────────────────────────────────

export function snoozeReminder(reminderId, minutes = 15) {
  try {
    const snoozes = getSnoozes();
    const triggerAt = Date.now() + minutes * 60 * 1000;
    snoozes[reminderId] = triggerAt;
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozes));
  } catch {}
}

export function getSnoozes() {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function clearSnooze(reminderId) {
  try {
    const snoozes = getSnoozes();
    delete snoozes[reminderId];
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozes));
  } catch {}
}

// ─── Time Calculation & Matching Helpers ──────────────────────────────────────

export function isDayMatching(reminder, dayOfWeek) {
  // dayOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  if (reminder.daysMode === "all") return true;
  if (reminder.daysMode === "weekdays") return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (reminder.daysMode === "weekends") return dayOfWeek === 0 || dayOfWeek === 6;
  if (reminder.daysMode === "custom" && Array.isArray(reminder.customDays)) {
    return reminder.customDays.includes(dayOfWeek);
  }
  return true;
}

export function getNextTriggerDate(reminder) {
  if (!reminder || !reminder.time) return null;
  const [targetH, targetM] = reminder.time.split(":").map(Number);
  const now = new Date();

  for (let offset = 0; offset <= 7; offset++) {
    const cand = new Date(now);
    cand.setDate(now.getDate() + offset);
    cand.setHours(targetH, targetM, 0, 0);

    const dayOfWeek = cand.getDay();
    if (isDayMatching(reminder, dayOfWeek)) {
      if (cand.getTime() > now.getTime()) {
        return cand;
      }
    }
  }
  return null;
}

export function formatTimeUntil(date) {
  if (!date) return "—";
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Maintenant";

  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `Dans ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (diffHours < 24) {
    return remMin > 0 ? `Dans ${diffHours}h ${remMin}m` : `Dans ${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
}

// ─── Core Background Scheduler Loop ───────────────────────────────────────────

let schedulerInterval = null;
let lastFiredMap = {}; // key = `${reminderId}_${YYYY-MM-DD_HH:MM}`

export function initNotificationScheduler({ onTrigger, onNavigate }) {
  if (typeof window === "undefined") return () => {};

  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  const checkScheduledReminders = () => {
    const settings = loadReminderSettings();
    if (!settings.masterEnabled) return;

    const reminders = loadReminders();
    const snoozes = getSnoozes();
    const now = new Date();
    const nowTs = now.getTime();
    const currentDay = now.getDay();
    const currentH = String(now.getHours()).padStart(2, "0");
    const currentM = String(now.getMinutes()).padStart(2, "0");
    const currentTimeStr = `${currentH}:${currentM}`;
    const todayDateStr = now.toISOString().slice(0, 10);

    reminders.forEach((rem) => {
      if (!rem.enabled) return;

      let shouldFire = false;
      let isSnoozedFire = false;

      // 1. Check Snooze
      if (snoozes[rem.id] && nowTs >= snoozes[rem.id]) {
        shouldFire = true;
        isSnoozedFire = true;
        clearSnooze(rem.id);
      }

      // 2. Check Standard Schedule Match
      if (!shouldFire && rem.time === currentTimeStr && isDayMatching(rem, currentDay)) {
        const fireKey = `${rem.id}_${todayDateStr}_${currentTimeStr}`;
        if (!lastFiredMap[fireKey]) {
          shouldFire = true;
          lastFiredMap[fireKey] = true;
        }
      }

      if (shouldFire) {
        fireReminder(rem, { isSnoozedFire, settings, onTrigger, onNavigate });
      }
    });
  };

  // Run immediate initial check, then every 30 seconds
  checkScheduledReminders();
  schedulerInterval = setInterval(checkScheduledReminders, 30000);

  return () => {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
  };
}

export function fireReminder(reminder, { isSnoozedFire = false, settings = null, onTrigger, onNavigate }) {
  const currentSettings = settings || loadReminderSettings();

  // 1. Play Chime Sound if enabled
  if (currentSettings.soundEnabled && reminder.sound !== false) {
    playReminderChime(currentSettings.soundType, currentSettings.volume);
  }

  // 2. Trigger Vocal synthesis if enabled
  if (reminder.speech && typeof window !== "undefined" && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
      const textToSpeak = reminder.quote || reminder.message || reminder.title;
      const utt = new SpeechSynthesisUtterance(textToSpeak);
      utt.lang = "ar-SA";
      utt.rate = 0.9;
      window.speechSynthesis.speak(utt);
    } catch {}
  }

  const typeConfig = REMINDER_TYPES.find((t) => t.id === reminder.type) || REMINDER_TYPES[0];
  const targetPath = reminder.customPath || typeConfig.defaultPath;

  // 3. Dispatch Browser Notification
  if (currentSettings.enableBrowserNotifications && getBrowserNotificationPermission() === "granted") {
    sendBrowserNotification(`📖 ${reminder.title}`, {
      body: reminder.message || `Il est l'heure de votre session de ${typeConfig.label}.`,
      tag: `reminder_${reminder.id}`,
      onClick: () => {
        if (onNavigate) {
          onNavigate(targetPath);
        }
      },
    });
  }

  // 4. In-App Toast / Callback
  if (onTrigger) {
    onTrigger({
      reminder,
      typeConfig,
      isSnoozedFire,
      timestamp: Date.now(),
      targetPath,
    });
  }
}
