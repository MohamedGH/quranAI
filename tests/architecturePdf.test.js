import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Architecture & Design Patterns PDF Documentation", () => {
  it("verifies the physical PDF file exists in public directory and has valid size", () => {
    const pdfPath = path.resolve("public", "architecture_design_patterns.pdf");
    expect(fs.existsSync(pdfPath)).toBe(true);

    const stats = fs.statSync(pdfPath);
    // Should be at least 15KB for an 8-page document
    expect(stats.size).toBeGreaterThan(15000);
  });

  it("checks PDF binary header format", () => {
    const pdfPath = path.resolve("public", "architecture_design_patterns.pdf");
    const buffer = fs.readFileSync(pdfPath);
    const header = buffer.subarray(0, 5).toString("utf-8");
    expect(header).toBe("%PDF-");
  });
});
