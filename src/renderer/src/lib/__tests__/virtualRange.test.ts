import { describe, expect, it } from "vitest";
import { computeVisibleRange } from "../virtualRange";

describe("computeVisibleRange", () => {
  it("computes visible rows with overscan", () => {
    expect(computeVisibleRange(0, 360, 88, 100, 4)).toEqual({ start: 0, end: 9 });
  });

  it("clamps to the total row count", () => {
    expect(computeVisibleRange(8800, 360, 88, 100, 4)).toEqual({ start: 96, end: 100 });
  });

  it("handles empty lists", () => {
    expect(computeVisibleRange(0, 360, 88, 0, 4)).toEqual({ start: 0, end: 0 });
  });
});
