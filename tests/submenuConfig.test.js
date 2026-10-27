import { describe, it, expect } from "vitest";
import {
  SUBMENU_MODES,
  SUBMENU_CATEGORIES,
  getFilteredSubmenuModes,
  getSubmenuModeMeta,
  computeSubmenuBadge,
  getCycleSubmenuMode,
} from "../src/utils/submenuConfig.js";

describe("Submenu Config & Pure Helpers", () => {
  it("defines 9 comprehensive study modes covering all study features", () => {
    expect(SUBMENU_MODES).toHaveLength(9);
    const ids = SUBMENU_MODES.map((m) => m.id);
    expect(ids).toContain("lecture");
    expect(ids).toContain("decouverte");
    expect(ids).toContain("progression");
    expect(ids).toContain("apprentissage");
    expect(ids).toContain("tajweed");
    expect(ids).toContain("reviser");
    expect(ids).toContain("memoire");
    expect(ids).toContain("collections");
    expect(ids).toContain("infos");
  });

  describe("getFilteredSubmenuModes", () => {
    it("returns all modes when category is 'all'", () => {
      const all = getFilteredSubmenuModes("all");
      expect(all).toHaveLength(9);
    });

    it("filters modes correctly by recitation category", () => {
      const recit = getFilteredSubmenuModes("recitation");
      expect(recit.map((m) => m.id)).toEqual(["lecture", "decouverte", "tajweed"]);
    });

    it("filters modes correctly by memorisation category", () => {
      const memo = getFilteredSubmenuModes("memorisation");
      expect(memo.map((m) => m.id)).toEqual(["progression", "apprentissage", "reviser", "memoire"]);
    });

    it("filters modes correctly by tools category", () => {
      const tools = getFilteredSubmenuModes("tools");
      expect(tools.map((m) => m.id)).toEqual(["collections", "infos"]);
    });
  });

  describe("getSubmenuModeMeta", () => {
    it("retrieves metadata for a known mode", () => {
      const meta = getSubmenuModeMeta("decouverte");
      expect(meta.label).toBe("Découverte");
      expect(meta.icon).toBe("👁");
      expect(meta.category).toBe("recitation");
    });

    it("falls back safely to default mode for unknown ID", () => {
      const fallback = getSubmenuModeMeta("unknown_mode_id");
      expect(fallback.id).toBe("lecture");
    });
  });

  describe("computeSubmenuBadge", () => {
    it("computes tajweed rule count badge for decouverte mode", () => {
      const badge = computeSubmenuBadge("decouverte", { ayatTajweedCount: 5 });
      expect(badge.badge).toBe("5");
      expect(badge.highlight).toBe(true);
    });

    it("returns null badge when no tajweed rules exist", () => {
      const badge = computeSubmenuBadge("decouverte", { ayatTajweedCount: 0 });
      expect(badge.badge).toBeNull();
      expect(badge.highlight).toBe(false);
    });

    it("computes badge for reviser when toRevise is set", () => {
      const badge = computeSubmenuBadge("reviser", { ld: { toRevise: true } });
      expect(badge.badge).toBe("•");
      expect(badge.highlight).toBe(true);
    });

    it("computes count badge for collections when entry is in collections", () => {
      const badge = computeSubmenuBadge("collections", { ayatInCollections: [1, 2] });
      expect(badge.badge).toBe("2");
      expect(badge.highlight).toBe(true);
    });
  });

  describe("getCycleSubmenuMode", () => {
    it("cycles forward to next mode in circular sequence", () => {
      const next = getCycleSubmenuMode("lecture", "next");
      expect(next).toBe("decouverte");
    });

    it("wraps around to first mode when cycling next at end", () => {
      const lastId = SUBMENU_MODES[SUBMENU_MODES.length - 1].id;
      const next = getCycleSubmenuMode(lastId, "next");
      expect(next).toBe("lecture");
    });

    it("cycles backward to previous mode", () => {
      const prev = getCycleSubmenuMode("decouverte", "prev");
      expect(prev).toBe("lecture");
    });

    it("wraps around to last mode when cycling prev at start", () => {
      const lastId = SUBMENU_MODES[SUBMENU_MODES.length - 1].id;
      const prev = getCycleSubmenuMode("lecture", "prev");
      expect(prev).toBe(lastId);
    });
  });
});
