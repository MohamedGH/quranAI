// @vitest-environment jsdom
import "fake-indexeddb/auto";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { Provider } from "react-redux";
import { store, uiActions, sel } from "../src/store.js";
import { ERROR_CODES } from "../src/utils/errorManager.js";
import { VALID_PAGES, parseQuranRoute } from "../src/utils/routeManager.js";
import {
  AUDIO_COMPRESSION_PRESETS,
  DEFAULT_COMPRESSION_PRESET,
  getCompressionPresetConfig,
  selectPreferredAudioMimeType,
  buildMediaRecorderOptions,
  estimateRecordingSizeBytes,
  formatFileSize,
  createAudioRecorder,
} from "../src/utils/audioRecorder.js";
import {
  parseAyatKey,
  getExtensionFromMimeType,
  normalizeRecordingRecord,
  buildRecordingFilename,
  downloadRecordingFile,
  saveRecording,
  loadRecordings,
  updateRecordingMeta,
  getAllRecordings,
  deleteRecording,
  requestPersistentStorage,
  getStoragePersistenceInfo,
} from "../src/utils/recordingsDb.js";
import {
  canSyncRecordingsToCloud,
  buildRecordingStoragePath,
  buildCloudRecordingMetadata,
  uploadRecordingToCloud,
  deleteRecordingFromCloud,
  fetchCloudRecordingsMeta,
  restoreCloudRecordingToLocal,
} from "../src/utils/recordingsCloudSync.js";
import { VoiceRecorder } from "../src/components/audio/VoiceRecorder.jsx";
import { RecordingsPage } from "../src/components/pages/RecordingsPage.jsx";

const resetStoreUi = () => {
  store.dispatch(uiActions.setVoiceCompressionPreset("balanced"));
  store.dispatch(uiActions.setStoragePersisted(false));
};

const clearAllDbRecordings = async () => {
  const all = await getAllRecordings().catch(() => []);
  await Promise.all(all.map((r) => deleteRecording(r.id)));
};

describe("Audio Compression Presets & Recorder (Opus Mono 24–64 kbps)", () => {
  it("defines compact (24k), balanced (32k), and high (64k) mono presets", () => {
    expect(DEFAULT_COMPRESSION_PRESET).toBe("balanced");
    expect(AUDIO_COMPRESSION_PRESETS.compact.audioBitsPerSecond).toBe(24000);
    expect(AUDIO_COMPRESSION_PRESETS.compact.channelCount).toBe(1);
    expect(AUDIO_COMPRESSION_PRESETS.balanced.audioBitsPerSecond).toBe(32000);
    expect(AUDIO_COMPRESSION_PRESETS.balanced.channelCount).toBe(1);
    expect(AUDIO_COMPRESSION_PRESETS.high.audioBitsPerSecond).toBe(64000);
    expect(AUDIO_COMPRESSION_PRESETS.high.channelCount).toBe(1);
  });

  it("falls back safely to balanced preset and builds MediaRecorder options", () => {
    expect(getCompressionPresetConfig("unknown").id).toBe("balanced");
    expect(buildMediaRecorderOptions("audio/webm;codecs=opus", "compact")).toEqual({
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 24000,
    });
    expect(buildMediaRecorderOptions("", "high")).toEqual({
      audioBitsPerSecond: 64000,
    });
  });

  it("estimates recording byte size and formats file sizes cleanly", () => {
    // 60s at 32 kbps = 240,000 bytes (~234 Ko)
    expect(estimateRecordingSizeBytes(60000, 32)).toBe(240000);
    expect(estimateRecordingSizeBytes(60000, 24)).toBe(180000);
    expect(formatFileSize(512)).toBe("512 o");
    expect(formatFileSize(1536)).toBe("1.5 Ko");
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.50 Mo");
  });

  it("selects Opus MIME type first when supported", () => {
    const mime = selectPreferredAudioMimeType((m) => m === "audio/webm;codecs=opus" || m === "audio/mp4");
    expect(mime).toBe("audio/webm;codecs=opus");
    expect(selectPreferredAudioMimeType(() => false)).toBe("");
  });

  it("records in mono with Opus bitrate and cleans up tracks on stop()", async () => {
    const stopTrack = vi.fn();
    const mockStream = { getTracks: () => [{ stop: stopTrack }] };
    const mockGain = {
      gain: { value: 1 },
      channelCount: 2,
      channelCountMode: "max",
      connect: vi.fn(),
    };
    const mockDst = { channelCount: 2, stream: mockStream };
    const mockActx = {
      createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
      createGain: vi.fn(() => mockGain),
      createMediaStreamDestination: vi.fn(() => mockDst),
      close: vi.fn(),
    };

    const recordedOptions = [];
    class MockMediaRecorder {
      static isTypeSupported(m) {
        return m === "audio/webm;codecs=opus";
      }
      constructor(stream, opts) {
        recordedOptions.push(opts);
        this.stream = stream;
        this.state = "inactive";
        this.ondataavailable = null;
        this.onstop = null;
      }
      start() {
        this.state = "recording";
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(["audio"], { type: "audio/webm" }) });
        }
      }
      stop() {
        this.state = "inactive";
        if (this.onstop) this.onstop();
      }
    }

    const origMediaDevices = navigator.mediaDevices;
    const origAudioCtx = window.AudioContext;
    const origMR = globalThis.MediaRecorder;
    const origCreateObjectURL = URL.createObjectURL;

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => mockStream) },
    });
    window.AudioContext = vi.fn(function () { return mockActx; });
    globalThis.MediaRecorder = MockMediaRecorder;
    URL.createObjectURL = vi.fn(() => "blob:mock-audio");

    try {
      const rec = createAudioRecorder({ preset: "compact" });
      await rec.start(3.5, { preset: "compact" });

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: expect.objectContaining({ channelCount: { ideal: 1 } }),
      });
      expect(mockGain.channelCount).toBe(1);
      expect(mockGain.channelCountMode).toBe("explicit");
      expect(mockDst.channelCount).toBe(1);
      expect(recordedOptions[0]).toEqual({
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 24000,
      });

      const url = await rec.stop();
      expect(url).toBe("blob:mock-audio");
      expect(stopTrack).toHaveBeenCalledTimes(1);
      expect(mockActx.close).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: origMediaDevices });
      window.AudioContext = origAudioCtx;
      globalThis.MediaRecorder = origMR;
      URL.createObjectURL = origCreateObjectURL;
    }
  });
});

describe("Redux State, Route Manager & Error Manager Integration", () => {
  beforeEach(resetStoreUi);

  it("persists voiceCompressionPreset and storagePersisted in Redux store", () => {
    expect(sel.voiceCompressionPreset(store.getState())).toBe("balanced");
    store.dispatch(uiActions.setVoiceCompressionPreset("compact"));
    expect(sel.voiceCompressionPreset(store.getState())).toBe("compact");
    expect(JSON.parse(localStorage.getItem("quran_voiceCompressionPreset"))).toBe("compact");

    store.dispatch(uiActions.setStoragePersisted(true));
    expect(sel.storagePersisted(store.getState())).toBe(true);
  });

  it("includes recordings route and recording/cloud error codes", () => {
    expect(VALID_PAGES).toContain("recordings");
    expect(parseQuranRoute("/recordings").activePage).toBe("recordings");
    expect(ERROR_CODES.RECORDING_ERROR).toBe("RECORDING_ERROR");
    expect(ERROR_CODES.CLOUD_STORAGE_ERROR).toBe("CLOUD_STORAGE_ERROR");
  });
});

describe("IndexedDB Persistence, Normalization & File Export", () => {
  beforeEach(clearAllDbRecordings);
  afterEach(clearAllDbRecordings);

  it("parses ayatKey, maps MIME extensions, and builds descriptive filenames", () => {
    expect(parseAyatKey("2:255")).toEqual({ surahNum: 2, ayatNum: 255 });
    expect(getExtensionFromMimeType("audio/ogg;codecs=opus")).toBe("ogg");
    expect(getExtensionFromMimeType("audio/mp4")).toBe("m4a");
    expect(getExtensionFromMimeType("audio/webm;codecs=opus")).toBe("webm");

    const filename = buildRecordingFilename({
      id: 1710000000000,
      ayatKey: "18:10",
      date: "2026-04-01T10:00:00.000Z",
      mimeType: "audio/webm;codecs=opus",
    });
    expect(filename).toBe("recitation-s018-v010-2026-04-01-1710000000000.webm");
  });

  it("normalizes legacy VoiceRecorder entries for RecordingsPage", () => {
    const legacy = normalizeRecordingRecord({
      id: 1710000000000,
      ayatKey: "1:5",
      date: "2026-04-01T10:00:00.000Z",
      duration: 12400,
      mimeType: "audio/webm",
      blob: new Blob(["abc"], { type: "audio/webm" }),
    });

    expect(legacy.surahNum).toBe(1);
    expect(legacy.ayatNum).toBe(5);
    expect(legacy.durationMs).toBe(12400);
    expect(legacy.durationSec).toBe(12);
    expect(legacy.sizeBytes).toBe(3);
    expect(legacy.timestamp).toBeGreaterThan(0);
  });

  it("saves, loads, updates metadata, computes stats, downloads, and deletes from IndexedDB", async () => {
    const blob = new Blob(["opus-audio-bytes"], { type: "audio/webm;codecs=opus" });
    await saveRecording({
      id: 5001,
      ayatKey: "1:1",
      duration: 8200,
      mimeType: blob.type,
      bitrateKbps: 24,
      compressionPreset: "compact",
      blob,
    });

    const loaded = await loadRecordings("1:1");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].surahNum).toBe(1);
    expect(loaded[0].ayatNum).toBe(1);
    expect(loaded[0].durationSec).toBe(8);

    const updated = await updateRecordingMeta(5001, { cloudUrl: "https://storage.example/5001.webm" });
    expect(updated.cloudUrl).toBe("https://storage.example/5001.webm");

    const info = await getStoragePersistenceInfo({
      storage: {
        persisted: async () => true,
        estimate: async () => ({ usage: 1024, quota: 1024 * 1024 }),
      },
    });
    expect(info.persisted).toBe(true);
    expect(info.recordingsCount).toBe(1);
    expect(info.recordingsBytes).toBe(blob.size);

    const persistRes = await requestPersistentStorage({
      storage: { persist: async () => true },
    });
    expect(persistRes).toEqual({ supported: true, persisted: true });

    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:download-5001");
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      const dlName = downloadRecordingFile(loaded[0], document);
      expect(dlName).toContain("recitation-s001-v001-");
      expect(clickSpy).toHaveBeenCalledTimes(1);
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }

    await deleteRecording(5001);
    expect(await getAllRecordings()).toHaveLength(0);
  });
});

describe("Firebase Storage Cloud Sync Module", () => {
  it("builds deterministic cloud paths and metadata", () => {
    expect(canSyncRecordingsToCloud(false, null)).toBe(false);
    expect(canSyncRecordingsToCloud(true, { currentUser: { uid: "u123" } })).toBe(true);

    const path = buildRecordingStoragePath("u123", {
      id: 9001,
      ayatKey: "112:1",
      mimeType: "audio/ogg;codecs=opus",
    });
    expect(path).toBe("users/u123/recordings/9001.ogg");

    const meta = buildCloudRecordingMetadata(
      "u123",
      { id: 9001, ayatKey: "112:1", duration: 4000, sizeBytes: 12000, compressionPreset: "compact", bitrateKbps: 24 },
      { cloudUrl: "https://firebase/9001.ogg", storagePath: path, syncedAt: "2026-04-01T12:00:00Z" }
    );
    expect(meta.surahNum).toBe(112);
    expect(meta.ayatNum).toBe(1);
    expect(meta.durationSec).toBe(4);
    expect(meta.blob).toBeUndefined();
  });

  it("handles unconfigured/unauthenticated cloud operations cleanly via errorManager", async () => {
    const up = await uploadRecordingToCloud({ id: 1, blob: new Blob(["x"]) });
    expect(up.ok).toBe(false);
    expect(up.error.code).toBe(ERROR_CODES.CLOUD_STORAGE_ERROR);

    const del = await deleteRecordingFromCloud({ id: 1 });
    expect(del.ok).toBe(true);
    expect(del.skipped).toBe(true);

    const list = await fetchCloudRecordingsMeta();
    expect(list.ok).toBe(true);
    expect(list.items).toEqual([]);
  });

  it("restores a cloud recording blob into IndexedDB", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["restored-opus"], { type: "audio/webm" }),
    }));
    const res = await restoreCloudRecordingToLocal(
      {
        id: 7777,
        ayatKey: "1:2",
        durationMs: 5000,
        cloudUrl: "https://storage.example/7777.webm",
      },
      mockFetch
    );
    expect(res.ok).toBe(true);
    expect(res.recording.surahNum).toBe(1);
    expect(res.recording.ayatNum).toBe(2);
    const saved = await loadRecordings("1:2");
    expect(saved).toHaveLength(1);
    await deleteRecording(7777);
  });
});

describe("VoiceRecorder & RecordingsPage Components", () => {
  beforeEach(async () => {
    resetStoreUi();
    await clearAllDbRecordings();
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:test-url");
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }
  });

  afterEach(async () => {
    cleanup();
    await clearAllDbRecordings();
  });

  it("renders compression preset buttons, saved recording metadata, download, and inline delete in VoiceRecorder", async () => {
    const blob = new Blob(["audio-sample-data"], { type: "audio/webm;codecs=opus" });
    await saveRecording({
      id: 8001,
      ayatKey: "1:1",
      surahNum: 1,
      ayatNum: 1,
      text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      date: "2026-04-01T08:00:00.000Z",
      timestamp: 1711958400000,
      duration: 12000,
      mimeType: "audio/webm;codecs=opus",
      bitrateKbps: 32,
      compressionPreset: "balanced",
      blob,
    });

    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:vr-test");
    URL.revokeObjectURL = vi.fn();
    try {
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(VoiceRecorder, {
            surahNum: 1,
            ayat: { numberInSurah: 1, text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
            originalAudioUrl: "https://example.com/ref.mp3",
          })
        )
      );

      const compactBtn = screen.getByRole("button", { name: "24k Compact" });
      fireEvent.click(compactBtn);
      expect(sel.voiceCompressionPreset(store.getState())).toBe("compact");

      await waitFor(() => {
        expect(screen.getByText("00:12")).toBeTruthy();
      });
      expect(screen.getByText(/32 kbps/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Télécharger l'enregistrement" })).toBeTruthy();

      // Inline delete confirmation without window.confirm
      fireEvent.click(screen.getByRole("button", { name: "Supprimer l'enregistrement" }));
      fireEvent.click(screen.getByRole("button", { name: "Oui" }));

      await waitFor(async () => {
        expect(await loadRecordings("1:1")).toHaveLength(0);
      });
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it("renders normalized duration, download button, and persistent storage activation in RecordingsPage", async () => {
    const blob = new Blob(["page-sample-audio"], { type: "audio/webm;codecs=opus" });
    await saveRecording({
      id: 9002,
      ayatKey: "2:255",
      date: "2026-04-02T09:00:00.000Z",
      duration: 15400,
      mimeType: "audio/webm;codecs=opus",
      bitrateKbps: 24,
      compressionPreset: "compact",
      blob,
    });

    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origStorage = navigator.storage;
    URL.createObjectURL = vi.fn(() => "blob:rp-test");
    URL.revokeObjectURL = vi.fn();
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persisted: vi.fn(async () => false),
        persist: vi.fn(async () => true),
        estimate: vi.fn(async () => ({ usage: 2048, quota: 1024 * 1024 * 50 })),
      },
    });

    try {
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(RecordingsPage, { onNavigate: vi.fn() })
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/S\. 2 • V\. 255/i)).toBeTruthy();
      });
      // Normalized ms->s (15s, NOT 15400s)
      expect(screen.getByText(/Durée : 15s/i)).toBeTruthy();
      expect(screen.getByText(/Opus mono 24 kbps/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /Télécharger/i })).toBeTruthy();

      const persistBtn = screen.getByRole("button", { name: /Protéger le stockage/i });
      fireEvent.click(persistBtn);
      await waitFor(() => {
        expect(sel.storagePersisted(store.getState())).toBe(true);
      });
    } finally {
      Object.defineProperty(navigator, "storage", { configurable: true, value: origStorage });
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});
