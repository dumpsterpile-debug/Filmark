import { describe, expect, it } from "vitest";
import { filterCandidates, mergeChipCandidates } from "../chips";

describe("mergeChipCandidates", () => {
  it("dedupes and keeps facet order before user chips", () => {
    expect(mergeChipCandidates(["dance", "miku"], ["miku", "new-one"])).toEqual([
      "dance",
      "miku",
      "new-one",
    ]);
  });

  it("handles empty inputs", () => {
    expect(mergeChipCandidates([], [])).toEqual([]);
    expect(mergeChipCandidates(["a"], [])).toEqual(["a"]);
  });
});

describe("filterCandidates", () => {
  it("filters case-insensitively by substring", () => {
    expect(filterCandidates(["Miku", "Dance", "MMD"], "mi")).toEqual(["Miku"]);
  });

  it("returns all candidates for an empty query", () => {
    expect(filterCandidates(["a", "b"], "")).toEqual(["a", "b"]);
  });
});
