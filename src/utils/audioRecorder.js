import { CapacitorAudioRecorder } from "@capgo/capacitor-audio-recorder";

// ─── Android / Capacitor detection ───────────────────────────────────────────
export const IS_ANDROID =
  typeof window !== "undefined" &&
  typeof window.Capacitor !== "undefined" &&
  /Android/i.test(navigator.userAgent);

// ─── Unified audio recorder abstraction ──────────────────────────────────────
// Android APK  → CapacitorAudioRecorder
// Web / iOS    → MediaRecorder
// API: { start(), stop() → Promise<blobUrl|null>, release() }
export function createAudioRecorder() {
  if (IS_ANDROID) {
    let _started = false;
    return {
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

  // Web MediaRecorder with gain boost
  let _stream = null;
  let _mr = null;
  let _chunks = [];
  let _mime = "";
  let _actx = null;

  return {
    async start(gainValue = 4.0) {
      _stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      // Boost volume via WebAudio GainNode → record the boosted stream
      let recordStream = _stream;
      try {
        _actx = new (window.AudioContext || window.webkitAudioContext)();
        const src = _actx.createMediaStreamSource(_stream);
        const gain = _actx.createGain();
        gain.gain.value = gainValue;
        const dst = _actx.createMediaStreamDestination();
        src.connect(gain);
        gain.connect(dst);
        recordStream = dst.stream;
      } catch (e) {
        console.warn("[Recorder] GainNode unavailable, recording raw:", e);
        recordStream = _stream;
      }
      _mime =
        ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find(m => {
          try {
            return MediaRecorder.isTypeSupported(m);
          } catch {
            return false;
          }
        }) || "";
      _mr = new MediaRecorder(recordStream, _mime ? { mimeType: _mime } : undefined);
      _chunks = [];
      _mr.ondataavailable = e => {
        if (e.data?.size > 0) _chunks.push(e.data);
      };
      _mr.start(200);
    },
    stop() {
      return new Promise(resolve => {
        if (!_mr || _mr.state === "inactive") {
          resolve(null);
          return;
        }
        _mr.onstop = () => {
          _stream?.getTracks().forEach(t => t.stop());
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
      _stream?.getTracks().forEach(t => t.stop());
      try {
        _actx?.close();
      } catch {}
      _actx = null;
    },
  };
}
