import { describe, expect, it } from "vitest";
import { isAllowedMediaPath } from "../mediaPolicy";

describe("isAllowedMediaPath", () => {
  it("allows media extensions only", () => {
    expect(isAllowedMediaPath("C:/Videos/a.mp4")).toBe(true);
    expect(isAllowedMediaPath("C:/Videos/a.jpg")).toBe(true);
  });

  it("rejects non-media files", () => {
    expect(isAllowedMediaPath("C:/Windows/win.ini")).toBe(false);
    expect(isAllowedMediaPath("C:/Users/Test/.env")).toBe(false);
    expect(isAllowedMediaPath("C:/Users/Test/secrets.json")).toBe(false);
  });
});
