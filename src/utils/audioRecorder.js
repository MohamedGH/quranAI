import { CapacitorAudioRecorder } from "@capgo/capacitor-audio-recorder";

// ─── Android / Capacitor detection ───────────────────────────────────────────
export const IS_ANDROID =
  typeof window !== "undefined" &&
  typeof window.Capacitor !== "undefined" &&
  /Android/i.test(navigator.userAgent);

// ─── Opus Mono Audio Compression Presets ─────────────────────────────────────
export const DEFAULT_COMPRESSION_PRESET = "balanced";

export const AUDIO_COMPRESSION_PRESETS = Object.freeze({
  compact: Object.freeze({
    id: "compact",
    label: "Compact (24 kbps)",
    shortLabel: "24k Compact",
    audioBitsPerSecond: 24000,
    bitrateKbps: 24,
    kbPerMin: 180,
    channelCount: 1,
    description: "Idéal pour économiser l'espace (~180 Ko/min)",
  }),
  balanced: Object.freeze({
    id: "balanced",
    label: "Équilibré (32 kbps)",
    shortLabel: "32k Voix",
    audioBitsPerSecond: 32000,
    bitrateKbps: 32,
    kbPerMin: 240,
    channelCount: 1,
    description: "Recommandé pour la voix (~240 Ko/min)",
  }),
  high: Object.freeze({
    id: "high",
    label: "Haute Qualité (64 kbps)",
    shortLabel: "64k HD",
    audioBitsPerSecond: 64000,
    bitrateKbps: 64,
    kbPerMin: 480,
    channelCount: 1,
    description: "Clarté maximale (~480 Ko/min)",
  }),
});

/**
 * Pure helper returning normalized compression preset configuration.
 */
export const getCompressionPresetConfig = (presetId = DEFAULT_COMPRESSION_PRESET) =>
  AUDIO_COMPRESSION_PRESETS[presetId] || AUDIO_COMPRESSION_PRESETS[DEFAULT_COMPRESSION_PRESET];

/**
 * Pure helper selecting the preferred supported Opus/Web audio MIME type.
 */
export const selectPreferredAudioMimeType = (
  isSupportedFn = (mime) => {
    try {
      return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime);
    } catch {
      return false;
    }
  }
) =>
  ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"].find((m) =>
    Boolean(isSupportedFn(m))
  ) || "";

/**
 * Pure helper building MediaRecorder constructor options with Opus mono bitrate.
 */
export const buildMediaRecorderOptions = (mimeType = "", presetId = DEFAULT_COMPRESSION_PRESET) => {
  const preset = getCompressionPresetConfig(presetId);
  const opts = { audioBitsPerSecond: preset.audioBitsPerSecond };
  if (mimeType) opts.mimeType = mimeType;
  return opts;
};

/**
 * Pure helper estimating encoded audio size in bytes from duration (ms) & bitrate (kbps).
 */
export const estimateRecordingSizeBytes = (durationMs = 0, bitrateKbps = 32) => {
  const safeMs = Math.max(0, Number(durationMs) || 0);
  const safeKbps = Math.max(8, Number(bitrateKbps) || 32);
  return Math.round((safeMs / 1000) * ((safeKbps * 1000) / 8));
};

/**
 * Pure helper formatting byte count into human-readable French units (o, Ko, Mo, Go).
 */
export const formatFileSize = (bytes = 0) => {
  const b = Math.max(0, Number(bytes) || 0);
  if (b < 1024) return `${Math.round(b)} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10 * 1024 ? 1 : 0)} Ko`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} Mo`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} Go`;
};

// ─── Unified audio recorder abstraction ──────────────────────────────────────
// Android APK  → CapacitorAudioRecorder
// Web / iOS    → MediaRecorder (Opus mono 24–64 kbps)
// API: { start(gainValue?, { preset }?), stop() → Promise<blobUrl|null>, release(), getCompressionConfig() }
export function createAudioRecorder(defaultOptions = {}) {
  const defaultPreset = defaultOptions?.preset || DEFAULT_COMPRESSION_PRESET;

  if (IS_ANDROID) {
    let _started = false;
    return {
      getCompressionConfig() {
        return getCompressionPresetConfig(defaultPreset);
      },
      async start() {
        const perm = await CapacitorAudioRecorder.requestPermission().catch(() => null);
        if (perm?.granted === false) throw new Error("Permission microphone refusée");
        await CapacitorAudioRecorder.startRecording();
        _started = true;
      },
      async stop() {
        if (!_started) return null;
        _started = false;
        const result = await CapacitorAudioRecorder.stopRecording();
        // Priorité à result.uri + Capacitor.convertFileSrc (chemin natif → URL lisible par WebView)
        if (result?.uri) {
          return window.Capacitor?.convertFileSrc(result.uri) ?? result.uri;
        }
        // Fallback base64
        const raw = result?.value ?? result?.recordDataBase64 ?? result?.blob ?? null;
        if (!raw) return null;
        return URL.createObjectURL(raw);
      },
      release() {
        if (_started) {
          CapacitorAudioRecorder.stopRecording().catch(() => {});
          _started = false;
        }
      },
    };
  }

  // Web MediaRecorder with gain boost + Mono Opus compression
  let _stream = null;
  let _mr = null;
  let _chunks = [];
  let _mime = "";
  let _actx = null;
  let _activePreset = getCompressionPresetConfig(defaultPreset);

  return {
    getCompressionConfig() {
      return _activePreset;
    },
    async start(gainValue = 4.0, startOptions = {}) {
      const presetId = startOptions?.preset || defaultPreset;
      _activePreset = getCompressionPresetConfig(presetId);

      _stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: _activePreset.channelCount },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Boost volume & downmix explicitly to mono via WebAudio GainNode → record compressed mono stream
      let recordStream = _stream;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          _actx = new AudioCtx();
          const src = _actx.createMediaStreamSource(_stream);
          const gain = _actx.createGain();
          gain.gain.value = gainValue;
          gain.channelCount = 1;
          gain.channelCountMode = "explicit";
          const dst = _actx.createMediaStreamDestination();
          dst.channelCount = 1;
          src.connect(gain);
          gain.connect(dst);
          recordStream = dst.stream;
        }
      } catch (e) {
        console.warn("[Recorder] GainNode unavailable, recording raw:", e);
        recordStream = _stream;
      }

      _mime = selectPreferredAudioMimeType();
      const mrOptions = buildMediaRecorderOptions(_mime, _activePreset.id);

      try {
        _mr = new MediaRecorder(recordStream, mrOptions);
      } catch {
        // Fallback if browser rejects audioBitsPerSecond combined with mimeType
        try {
          _mr = new MediaRecorder(recordStream, _mime ? { mimeType: _mime } : undefined);
        } catch {
          _mr = new MediaRecorder(recordStream);
        }
      }

      _chunks = [];
      _mr.ondataavailable = (e) => {
        if (e.data?.size > 0) _chunks.push(e.data);
      };
      _mr.start(200);
    },
    stop() {
      return new Promise((resolve) => {
        if (!_mr || _mr.state === "inactive") {
          resolve(null);
          return;
        }
        _mr.onstop = () => {
          _stream?.getTracks().forEach((t) => t.stop());
          try {
            _actx?.close();
          } catch {}
          _actx = null;
          resolve(
            _chunks.length
              ? URL.createObjectURL(new Blob(_chunks, { type: _mime || "audio/webm" }))
              : null
          );
        };
        _mr.stop();
      });
    },
    release() {
      try {
        if (_mr?.state !== "inactive") _mr?.stop();
      } catch {}
      _stream?.getTracks().forEach((t) => t.stop());
      try {
        _actx?.close();
      } catch {}
      _actx = null;
    },
  };
}
