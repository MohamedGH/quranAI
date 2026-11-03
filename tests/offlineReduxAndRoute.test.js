import { describe, it, expect } from "vitest";
import { store, sel, offlineActions } from "../src/store.js";
import { parseQuranRoute, buildQuranRoute, VALID_PAGES } from "../src/utils/routeManager.js";
import { ERROR_CODES, createAppError } from "../src/utils/errorManager.js";

describe("Offline Integration — State, Route & Error Managers", () => {
  describe("Redux State Manager (offlineSlice)", () => {
    it("has valid initial offline state and selectors", () => {
      const state = store.getState();
      expect(sel.isOnline(state)).toBeDefined();
      expect(typeof sel.isOnline(state)).toBe("boolean");

      const downloadTask = sel.downloadTask(state);
      expect(downloadTask).toBeDefined();
      expect(downloadTask.active).toBe(false);

      const cachedMap = sel.cachedSurahsMap(state);
      expect(cachedMap).toBeDefined();
      expect(typeof cachedMap).toBe("object");

      const storage = sel.storageEstimate(state);
      expect(storage).toBeDefined();
      expect(typeof storage.usedBytes).toBe("number");
    });

    it("updates online connectivity status via offlineActions.setOnline", () => {
      store.dispatch(offlineActions.setOnline(false));
      expect(sel.isOnline(store.getState())).toBe(false);

      store.dispatch(offlineActions.setOnline(true));
      expect(sel.isOnline(store.getState())).toBe(true);
    });

    it("manages active download task lifecycle", () => {
      store.dispatch(
        offlineActions.setDownloadTask({
          active: true,
          surahNum: 1,
          phase: "audio",
          done: 3,
          total: 7,
          message: "Téléchargement verset 3/7",
        })
      );

      let task = sel.downloadTask(store.getState());
      expect(task.active).toBe(true);
      expect(task.surahNum).toBe(1);
      expect(task.done).toBe(3);
      expect(task.total).toBe(7);

      store.dispatch(offlineActions.resetDownloadTask());
      task = sel.downloadTask(store.getState());
      expect(task.active).toBe(false);
      expect(task.surahNum).toBeNull();
      expect(task.done).toBe(0);
    });

    it("updates cached surahs and storage estimates", () => {
      store.dispatch(
        offlineActions.updateCachedSurah({
          surahNum: 1,
          status: { hasText: true, audioCount: 7, totalCount: 7, isComplete: true, percent: 100 },
        })
      );

      const map = sel.cachedSurahsMap(store.getState());
      expect(map[1]).toBeDefined();
      expect(map[1].isComplete).toBe(true);
      expect(map[1].audioCount).toBe(7);

      store.dispatch(
        offlineActions.setStorageEstimate({
          usedBytes: 15000000,
          quotaBytes: 100000000,
          percentUsed: 15,
          formattedUsed: "14.3 MB",
          formattedQuota: "95.4 MB",
        })
      );

      const storage = sel.storageEstimate(store.getState());
      expect(storage.percentUsed).toBe(15);
      expect(storage.formattedUsed).toBe("14.3 MB");
    });
  });

  describe("Route Manager Integration for /offline", () => {
    it("includes offline in VALID_PAGES", () => {
      expect(VALID_PAGES).toContain("offline");
    });

    it("purely parses /offline route", () => {
      const parsed = parseQuranRoute("/offline");
      expect(parsed.activePage).toBe("offline");
      expect(parsed.surahNum).toBeNull();
    });

    it("purely builds /offline route path", () => {
      const path = buildQuranRoute({ activePage: "offline" });
      expect(path).toBe("/offline");
    });
  });

  describe("Error Manager Offline Codes", () => {
    it("provides OFFLINE_ERROR, DOWNLOAD_ERROR, and STORAGE_QUOTA_EXCEEDED", () => {
      expect(ERROR_CODES.OFFLINE_ERROR).toBe("OFFLINE_ERROR");
      expect(ERROR_CODES.DOWNLOAD_ERROR).toBe("DOWNLOAD_ERROR");
      expect(ERROR_CODES.STORAGE_QUOTA_EXCEEDED).toBe("STORAGE_QUOTA_EXCEEDED");
    });

    it("creates an immutable AppError with offline error code", () => {
      const err = createAppError(ERROR_CODES.OFFLINE_ERROR, "Ressource indisponible hors-ligne", { surahNum: 1 });
      expect(err.code).toBe("OFFLINE_ERROR");
      expect(err.message).toBe("Ressource indisponible hors-ligne");
      expect(err.context.surahNum).toBe(1);
      expect(Object.isFrozen(err)).toBe(true);
    });
  });
});
