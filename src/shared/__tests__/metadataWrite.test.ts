import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DownloadMeta } from "../types";
import {
  APPEND_FILE_NAME,
  appendRecord,
  appendVideoRecord,
  downloadMetaToRecord,
  formatMetadataDate,
  recordKeys,
  toRecordFields,
  updateVideoRecord,
  writeTargets,
  type MetadataFilePort,
} from "../metadataWrite";

/**
 * 测试用端口：真实临时目录。
 * 生产用的是 `src/main/metadataFs.ts` 的实现 —— 两个适配器说明这个 seam 是真的。
 */
const port: MetadataFilePort = {
  isDirectory: async (target) => (await stat(target)).isDirectory(),
  listJsonFiles: async (target) => {
    const info = await stat(target);
    if (!info.isDirectory()) {
      return target.toLowerCase().endsWith(".json") ? [target] : [];
    }
    const files = (await readdir(target)).filter((f) => f.toLowerCase().endsWith(".json")).sort();
    return files.map((f) => join(target, f));
  },
  readArray: async (filePath) => {
    try {
      const data = JSON.parse(await readFile(filePath, "utf8")) as unknown;
      return Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  },
  writeJson: async (filePath, value) => {
    await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  },
  childPath: (dir, fileName) => join(dir, fileName),
};

let root = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "filmark-metadata-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

describe("writeTargets", () => {
  const base = {
    defaultDir: "C:/app/resources/public",
    importedDir: "C:/userData/imported",
  };

  it("puts the actually-loaded source first", () => {
    expect(writeTargets({ ...base, loadedSource: "C:/custom/my-videos.json" })[0]).toBe(
      "C:/custom/my-videos.json"
    );
  });

  it("orders every target the same way regardless of which path asks", () => {
    const withSource = writeTargets({
      ...base,
      loadedSource: "C:/custom/my-videos.json",
      persistedPath: "C:/custom/persisted.json",
    });
    expect(withSource).toEqual([
      "C:/custom/my-videos.json",
      "C:/custom/persisted.json",
      "C:/app/resources/public",
      "C:/userData/imported",
    ]);
  });

  it("always keeps the default dir in the list, with no historical fallback", () => {
    expect(writeTargets({ ...base })).toContain("C:/app/resources/public");
  });

  it("keeps the imported store as the last fallback", () => {
    const targets = writeTargets({ ...base, loadedSource: "C:/custom/my-videos.json" });
    expect(targets[targets.length - 1]).toBe("C:/userData/imported");
  });

  it("deduplicates and drops empty targets", () => {
    const targets = writeTargets({
      ...base,
      loadedSource: "C:/app/resources/public",
      persistedPath: "C:/app/resources/public",
    });
    expect(targets.filter((t) => t === "C:/app/resources/public")).toHaveLength(1);
    expect(targets).not.toContain("");
  });
});

describe("recordKeys", () => {
  it("treats file as the identity and id as an alias", () => {
    expect(recordKeys({ file: "C:/a.mp4", id: "C:/a.mp4" })).toEqual(["C:/a.mp4"]);
    expect(recordKeys({ file: "C:/a.mp4" })).toEqual(["C:/a.mp4"]);
    expect(recordKeys({ id: "abc", file: "C:/a.mp4" })).toEqual(["C:/a.mp4", "abc"]);
  });

  it("returns nothing for records with neither key", () => {
    expect(recordKeys({ title: "T" })).toEqual([]);
    expect(recordKeys(null)).toEqual([]);
  });
});

describe("toRecordFields", () => {
  it("maps the UI title field to file_name so the edit is not shadowed", () => {
    expect(toRecordFields({ title: "New title" })).toEqual({ file_name: "New title" });
  });

  it("passes through fields whose keys already match the record schema", () => {
    const fields = { artist: ["A"], character: ["B"], genre: "Genshin", tags: ["x"] };
    expect(toRecordFields(fields)).toEqual(fields);
  });

  it("does not mutate the input object", () => {
    const input = { title: "T" };
    toRecordFields(input);
    expect(input).toEqual({ title: "T" });
  });
});

describe("appendRecord", () => {
  it("appends a new record", () => {
    const out = appendRecord([{ file: "C:/a.mp4" }], { file: "C:/b.mp4" }) as { file: string }[];
    expect(out.map((r) => r.file)).toEqual(["C:/a.mp4", "C:/b.mp4"]);
  });

  it("skips a record whose identity already exists", () => {
    const out = appendRecord([{ file: "C:/a.mp4" }], { file: "C:/a.mp4" }) as { file: string }[];
    expect(out).toHaveLength(1);
  });

  it("matches an imported record by its id alias too", () => {
    const out = appendRecord([{ id: "abc", file: "C:/a.mp4" }], { id: "abc" }) as unknown[];
    expect(out).toHaveLength(1);
  });

  it("always appends a record that carries no identity at all", () => {
    expect(appendRecord([], { title: "NoFile" })).toHaveLength(1);
  });
});

describe("formatMetadataDate", () => {
  it("formats dates as YYYY-MM-DD HH:mm:ss.SSS UTC", () => {
    expect(formatMetadataDate(new Date("2023-03-10T15:29:27.975Z"))).toBe(
      "2023-03-10 15:29:27.975 UTC"
    );
  });

  it("returns an empty string for invalid dates", () => {
    expect(formatMetadataDate(new Date("not-a-date"))).toBe("");
  });
});

describe("downloadMetaToRecord", () => {
  const meta: DownloadMeta = {
    file: "C:/v.mp4",
    thumbnail: "C:/t.jpg",
    title: "T",
    durationMs: 123456,
    genre: "G",
    tags: ["a", "b"],
    artist: ["A"],
    character: ["C"],
    created: "2026-08-08T00:00:00.000Z",
    modified: "2026-08-08T01:00:00.000Z",
    extension: "mp4",
    video_id: "vid",
    url: "https://x",
    file_name: "v",
    file_extension: "mp4",
  };

  it("maps DownloadMeta onto the canonical record keys", () => {
    const record = downloadMetaToRecord(meta);
    expect(record.duration).toBe(123456);
    expect(record.file_creation_date).toBe("2026-08-08 00:00:00.000 UTC");
    expect(record.file_last_modification_date).toBe("2026-08-08 01:00:00.000 UTC");
    expect(record.file).toBe("C:/v.mp4");
    expect(record.file_name).toBe("v");
    expect(record.artist).toEqual(["A"]);
  });

  it("omits keys that are not part of the record shape", () => {
    const record = downloadMetaToRecord(meta);
    expect("title" in record).toBe(false);
    expect("extension" in record).toBe(false);
    expect("video_id" in record).toBe(false);
    expect("url" in record).toBe(false);
  });
});

describe("updateVideoRecord", () => {
  it("rewrites the record inside the actually-loaded source", async () => {
    const loaded = join(root, "library.json");
    const fallback = join(root, "fallback.json");
    await writeJson(loaded, [{ file: "C:/a.mp4", file_name: "Old" }]);
    await writeJson(fallback, [{ file: "C:/a.mp4", file_name: "Old" }]);

    const result = await updateVideoRecord(
      { videoId: "C:/a.mp4", fields: { title: "New" }, targets: [loaded, fallback] },
      port
    );

    expect(result).toEqual({ ok: true, source: loaded });
    expect(await readJson(loaded)).toEqual([{ file: "C:/a.mp4", file_name: "New" }]);
    expect(await readJson(fallback)).toEqual([{ file: "C:/a.mp4", file_name: "Old" }]);
  });

  it("writes file_name so the new title is not shadowed on reload", async () => {
    const file = join(root, "library.json");
    await writeJson(file, [{ file: "C:/a.mp4", file_name: "Old", id: "C:/a.mp4" }]);

    await updateVideoRecord(
      { videoId: "C:/a.mp4", fields: { title: "New", genre: "G" }, targets: [file] },
      port
    );

    const records = (await readJson(file)) as Record<string, unknown>[];
    expect(records[0]).toEqual({
      file: "C:/a.mp4",
      file_name: "New",
      id: "C:/a.mp4",
      genre: "G",
    });
  });

  it("finds an imported record by its id alias", async () => {
    const file = join(root, "imported.json");
    await writeJson(file, [{ id: "video-1", file: "C:/a.mp4", file_name: "Old" }]);

    const result = await updateVideoRecord(
      { videoId: "video-1", fields: { title: "New" }, targets: [file] },
      port
    );

    expect(result.ok).toBe(true);
    expect(await readJson(file)).toEqual([{ id: "video-1", file: "C:/a.mp4", file_name: "New" }]);
  });

  it("scans every json file in a directory target", async () => {
    const dir = join(root, "library");
    await mkdir(dir, { recursive: true });
    await writeJson(join(dir, "a.json"), [{ file: "C:/a.mp4", file_name: "Old" }]);
    await writeJson(join(dir, "b.json"), [{ file: "C:/b.mp4", file_name: "Old" }]);

    const result = await updateVideoRecord(
      { videoId: "C:/b.mp4", fields: { title: "New" }, targets: [dir] },
      port
    );

    expect(result).toEqual({ ok: true, source: join(dir, "b.json") });
  });

  it("skips a missing target and reports why when nothing matched", async () => {
    const missing = join(root, "gone.json");
    const other = join(root, "other.json");
    await writeJson(other, [{ file: "C:/other.mp4" }]);

    const result = await updateVideoRecord(
      { videoId: "C:/a.mp4", fields: { title: "New" }, targets: [missing, other] },
      port
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(missing);
      expect(result.error).toContain("Video not found in any writable metadata file");
    }
  });

  it("keeps trying later targets when an earlier one cannot be parsed", async () => {
    const broken = join(root, "broken.json");
    const good = join(root, "good.json");
    await writeFile(broken, "{ not json", "utf8");
    await writeJson(good, [{ file: "C:/a.mp4", file_name: "Old" }]);

    const result = await updateVideoRecord(
      { videoId: "C:/a.mp4", fields: { title: "New" }, targets: [broken, good] },
      port
    );

    // 解析失败的文件被读成 null，等价于「这里没有这条记录」，继续尝试下一个目标
    expect(result).toEqual({ ok: true, source: good });
  });
});

describe("appendVideoRecord", () => {
  const record = { file: "C:/new.mp4", file_name: "New" };

  it("writes into the fixed file name when the target is a directory", async () => {
    const dir = join(root, "library");
    await mkdir(dir, { recursive: true });

    const result = await appendVideoRecord({ record, targets: [dir] }, port);

    expect(result).toEqual({ ok: true, source: join(dir, APPEND_FILE_NAME) });
    expect(await readJson(join(dir, APPEND_FILE_NAME))).toEqual([record]);
  });

  it("writes in place when the target is a file", async () => {
    const file = join(root, "library.json");
    await writeJson(file, [{ file: "C:/old.mp4" }]);

    const result = await appendVideoRecord({ record, targets: [file] }, port);

    expect(result).toEqual({ ok: true, source: file });
    expect(await readJson(file)).toEqual([{ file: "C:/old.mp4" }, record]);
  });

  it("does not duplicate a record that is already present", async () => {
    const file = join(root, "library.json");
    await writeJson(file, [record]);

    await appendVideoRecord({ record, targets: [file] }, port);

    expect(await readJson(file)).toEqual([record]);
  });

  it("falls through to the next target when one is missing", async () => {
    const missing = join(root, "gone.json");
    const file = join(root, "library.json");
    await writeJson(file, []);

    const result = await appendVideoRecord({ record, targets: [missing, file] }, port);

    expect(result).toEqual({ ok: true, source: file });
  });

  it("reports every failed target when none is usable", async () => {
    const a = join(root, "a.json");
    const b = join(root, "b.json");

    const result = await appendVideoRecord({ record, targets: [a, b] }, port);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(a);
      expect(result.error).toContain(b);
    }
  });
});
