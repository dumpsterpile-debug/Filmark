import { describe, expect, it } from "vitest";
import { isAbsolute, join, parse, resolve, sep } from "path";
import {
  assertTrustedSender,
  isSafeExternalUrl,
  isPathInside,
  safeResolve,
  safeUrl,
} from "../boundary";

/**
 * 路径用例必须在 Windows 本地与 Linux CI（ubuntu-latest）上等价通过，
 * 因此统一使用当前平台的原生分隔符（join/sep）并把根锚定到当前卷根，
 * 而不是硬编码 "C:/..." 或反斜杠 —— 在 Linux 上 "C:/x" 只是相对路径、"\\x" 只是文件名的一部分。
 */
const VOLUME_ROOT = parse(process.cwd()).root; // Windows "C:\\"，POSIX "/"
const ROOT = resolve(VOLUME_ROOT, "Users", "Test", "Downloads");
const OUTSIDE_ABS = resolve(VOLUME_ROOT, "Windows", "win.ini");

describe("safeResolve", () => {
  it("rejects paths outside the root via traversal", () => {
    expect(safeResolve(ROOT, join("..", "..", "evil.mp4"))).toBeNull();
    expect(safeResolve(ROOT, join("sub", "..", "..", "evil.mp4"))).toBeNull();
  });

  it("rejects an absolute path outside the root", () => {
    expect(isAbsolute(OUTSIDE_ABS)).toBe(true);
    expect(safeResolve(ROOT, OUTSIDE_ABS)).toBeNull();
  });

  it("rejects the root itself", () => {
    expect(safeResolve(ROOT, ".")).toBeNull();
    expect(safeResolve(ROOT, ROOT)).toBeNull();
  });

  it("accepts paths inside the root", () => {
    expect(safeResolve(ROOT, "a.mp4")).toBe(join(ROOT, "a.mp4"));
    expect(safeResolve(ROOT, join("sub", "a.mp4"))).toBe(join(ROOT, "sub", "a.mp4"));
  });

  it("accepts an absolute path inside the root", () => {
    expect(safeResolve(ROOT, join(ROOT, "sub", "b.mp4"))).toBe(join(ROOT, "sub", "b.mp4"));
  });

  it("rejects crafted file_name + file_extension traversal", () => {
    // 复现 fileName/fileExtension 拼接出的跨目录路径，用原生分隔符构造
    const fileExtension = `.${sep}..${sep}..${sep}evil.mp4`;
    const fileName = `..${fileExtension.slice(1)}`;
    expect(safeResolve(ROOT, fileName)).toBeNull();
  });
});

describe("isPathInside", () => {
  const dir = resolve(
    VOLUME_ROOT,
    "Users",
    "Test",
    "AppData",
    "Roaming",
    "filmark",
    "metadata",
    "imported"
  );

  it("accepts files directly inside the directory", () => {
    expect(isPathInside(dir, resolve(dir, "import-1.json"))).toBe(true);
  });

  it("rejects same-prefix sibling directories", () => {
    expect(isPathInside(dir, resolve(dir + "2", "victim.json"))).toBe(false);
    expect(isPathInside(dir, resolve(dir + "-evil", "victim.json"))).toBe(false);
  });

  it("rejects the directory itself and parents", () => {
    expect(isPathInside(dir, dir)).toBe(false);
    expect(isPathInside(dir, resolve(dir, "..", "other.json"))).toBe(false);
  });
});

describe("safeUrl", () => {
  const hosts = new Set(["i.iwara.tv"]);

  it("rejects non-http(s) and private hosts by default", () => {
    expect(safeUrl("file:///C:/x", hosts)).toBeNull();
    expect(safeUrl("http://127.0.0.1:8080/", hosts)).toBeNull();
    expect(safeUrl("http://localhost:3000/", hosts)).toBeNull();
    expect(safeUrl("http://evil.com/a.jpg", hosts)).toBeNull();
  });

  it("accepts allowed https hosts", () => {
    expect(safeUrl("https://i.iwara.tv/a.jpg", hosts)).toBe("https://i.iwara.tv/a.jpg");
    expect(safeUrl("https://cdn.i.iwara.tv/a.jpg", hosts)).toBe("https://cdn.i.iwara.tv/a.jpg");
  });
});

describe("isSafeExternalUrl", () => {
  it("rejects non-http(s) external URLs", () => {
    expect(isSafeExternalUrl("file:///C:/x")).toBe(false);
    expect(isSafeExternalUrl("ms-settings:")).toBe(false);
    expect(isSafeExternalUrl("https://www.iwara.tv/")).toBe(true);
  });
});

describe("assertTrustedSender", () => {
  it("accepts app file:// origins and rejects browser partition frames", () => {
    const allowed = new Set(["file://"]);
    expect(
      assertTrustedSender({ senderFrame: { url: "file:///C:/app/index.html" } } as never, allowed)
    ).toBe(true);
    expect(
      assertTrustedSender({ senderFrame: { url: "https://evil.example/" } } as never, allowed)
    ).toBe(false);
    expect(assertTrustedSender({} as never, allowed)).toBe(false);
  });
});
