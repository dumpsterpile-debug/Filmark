import { describe, expect, it } from "vitest";
import { computeImportPreview, importFileName } from "../imports";

describe("computeImportPreview", () => {
  it("counts new records and duplicates against existing ids", () => {
    const result = computeImportPreview(
      [
        {
          path: "C:/a.json",
          ok: true,
          raw: [
            { file: "C:/v1.mp4", title: "V1" },
            { file: "C:/v2.mp4", title: "V2" },
          ],
        },
      ],
      new Set(["C:/v1.mp4"])
    );
    expect(result.newCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.failedFiles).toEqual([]);
  });

  it("dedupes records within the same batch", () => {
    const result = computeImportPreview(
      [
        {
          path: "C:/a.json",
          ok: true,
          raw: [{ file: "C:/v1.mp4" }, { file: "C:/v1.mp4" }],
        },
      ],
      new Set()
    );
    expect(result.newCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("collects failed files with their error", () => {
    const result = computeImportPreview(
      [
        { path: "C:/bad.json", ok: false, error: "parse error" },
        { path: "C:/good.json", ok: true, raw: [{ file: "C:/v1.mp4" }] },
      ],
      new Set()
    );
    expect(result.failedFiles).toEqual([{ path: "C:/bad.json", error: "parse error" }]);
    expect(result.newCount).toBe(1);
  });

  it("limits samples to 5", () => {
    const raw = Array.from({ length: 8 }, (_, i) => ({ file: `C:/v${i}.mp4`, title: `V${i}` }));
    const result = computeImportPreview([{ path: "C:/a.json", ok: true, raw }], new Set());
    expect(result.samples).toHaveLength(5);
    expect(result.samples[0]?.title).toBe("V0");
    expect(result.samples[4]?.title).toBe("V4");
  });

  it("returns empty summary for empty input", () => {
    const result = computeImportPreview([], new Set());
    expect(result).toEqual({
      newCount: 0,
      duplicateCount: 0,
      failedFiles: [],
      samples: [],
    });
  });
});

describe("importFileName", () => {
  it("formats a timestamped import file name", () => {
    expect(importFileName(new Date(2026, 7, 8, 9, 5, 3))).toBe("import-20260808-090503.json");
  });

  it("pads single-digit components", () => {
    expect(importFileName(new Date(2026, 0, 2, 3, 4, 5))).toBe("import-20260102-030405.json");
  });
});
