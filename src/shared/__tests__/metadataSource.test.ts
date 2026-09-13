import { describe, expect, it } from "vitest";
import { metadataErrorCode, pickMetadataTarget } from "../metadataSource";

describe("pickMetadataTarget", () => {
  it("prefers the explicitly requested path", () => {
    expect(
      pickMetadataTarget({
        requestedPath: "C:/explicit.json",
        persistedPath: "C:/persisted.json",
        defaultDir: "C:/public",
      })
    ).toBe("C:/explicit.json");
  });

  it("falls back to the persisted path when no explicit path is given", () => {
    expect(
      pickMetadataTarget({
        requestedPath: null,
        persistedPath: "C:/persisted.json",
        defaultDir: "C:/public",
      })
    ).toBe("C:/persisted.json");
  });

  it("uses the default directory when nothing is configured, with no historical fallback", () => {
    expect(
      pickMetadataTarget({
        requestedPath: null,
        persistedPath: undefined,
        defaultDir: "C:/app/resources/public",
      })
    ).toBe("C:/app/resources/public");
  });
});

describe("metadataErrorCode", () => {
  it("reports E_PATH_NOT_FOUND when the path does not exist", () => {
    expect(
      metadataErrorCode({
        exists: false,
        isDirectory: false,
        jsonCount: 0,
        parsedArrayCount: 0,
        parsedOtherCount: 0,
      })
    ).toBe("E_PATH_NOT_FOUND");
  });

  it("reports E_NO_JSON when a directory contains no json files", () => {
    expect(
      metadataErrorCode({
        exists: true,
        isDirectory: true,
        jsonCount: 0,
        parsedArrayCount: 0,
        parsedOtherCount: 0,
      })
    ).toBe("E_NO_JSON");
  });

  it("reports E_PARSE_FAILED when every json file fails to parse", () => {
    expect(
      metadataErrorCode({
        exists: true,
        isDirectory: true,
        jsonCount: 3,
        parsedArrayCount: 0,
        parsedOtherCount: 0,
      })
    ).toBe("E_PARSE_FAILED");
  });

  it("returns null when at least one array parses successfully", () => {
    expect(
      metadataErrorCode({
        exists: true,
        isDirectory: true,
        jsonCount: 3,
        parsedArrayCount: 1,
        parsedOtherCount: 1,
      })
    ).toBeNull();
  });

  it("reports E_NO_JSON when a single file parses but is not an array", () => {
    expect(
      metadataErrorCode({
        exists: true,
        isDirectory: false,
        jsonCount: 1,
        parsedArrayCount: 0,
        parsedOtherCount: 1,
      })
    ).toBe("E_NO_JSON");
  });

  it("reports E_PARSE_FAILED when a single json file fails to parse", () => {
    expect(
      metadataErrorCode({
        exists: true,
        isDirectory: false,
        jsonCount: 1,
        parsedArrayCount: 0,
        parsedOtherCount: 0,
      })
    ).toBe("E_PARSE_FAILED");
  });
});
