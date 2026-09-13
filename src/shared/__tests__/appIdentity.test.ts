import { describe, expect, it } from "vitest";
import pkg from "../../../package.json";
import {
  APP_DATA_DIR_NAME,
  APP_DISPLAY_NAME,
  APP_ID,
  APP_DATA_ENTRIES,
  LEGACY_APP_DATA_DIR_NAMES,
  pickEntriesToMigrate,
} from "../appIdentity";

describe("app identity drift guard", () => {
  it("keeps package.json in sync with the identity module", () => {
    // 打包器只读 package.json，TS 侧只读本模块，两者必须一致
    expect(pkg.name).toBe(APP_DATA_DIR_NAME);
    expect(pkg.build.productName).toBe(APP_DISPLAY_NAME);
    expect(pkg.build.appId).toBe(APP_ID);
  });

  it("keeps the package / data dir name npm- and path-safe", () => {
    expect(APP_DATA_DIR_NAME).toMatch(/^[a-z0-9-]+$/);
    expect(APP_DATA_DIR_NAME).not.toContain(" ");
  });

  it("keeps artifact names based on ${name} instead of ${productName}", () => {
    // productName 是显示名，未来含空格时会让产物名与命令行引用变脆
    expect(pkg.build.nsis.artifactName).toContain("${name}");
    expect(pkg.build.nsis.artifactName).not.toContain("${productName}");
    expect(pkg.build.portable.artifactName).toContain("${name}");
    expect(pkg.build.portable.artifactName).not.toContain("${productName}");
  });

  it("does not migrate the current data dir again via the legacy list", () => {
    expect(LEGACY_APP_DATA_DIR_NAMES).not.toContain(APP_DATA_DIR_NAME);
  });
});

describe("pickEntriesToMigrate", () => {
  it("selects allowlisted legacy entries missing from the current dir", () => {
    expect(pickEntriesToMigrate([], ["playlist.json", "thumbnails"])).toEqual([
      "playlist.json",
      "thumbnails",
    ]);
  });

  it("never overwrites data that already exists in the current dir", () => {
    expect(pickEntriesToMigrate(["playlist.json"], ["playlist.json", "metadata"])).toEqual([
      "metadata",
    ]);
  });

  it("ignores Chromium cache / lock state found in the legacy dir", () => {
    const legacy = ["Cache", "GPUCache", "Local Storage", "SingletonLock", "Preferences"];
    expect(pickEntriesToMigrate([], legacy)).toEqual([]);
  });

  it("returns a de-duplicated, sorted list", () => {
    expect(pickEntriesToMigrate([], ["thumbnails", "playlist.json", "thumbnails"])).toEqual([
      "playlist.json",
      "thumbnails",
    ]);
  });

  it("is a no-op when the legacy dir is empty or unreadable", () => {
    expect(pickEntriesToMigrate(["playlist.json", "metadata"], [])).toEqual([]);
  });

  it("covers every persistent entry the app writes to userData", () => {
    // 白名单是迁移的唯一边界，漏项会导致该数据静默丢失
    const migrated = pickEntriesToMigrate([], [...APP_DATA_ENTRIES]);
    expect(migrated).toEqual([...APP_DATA_ENTRIES].sort());
  });
});
