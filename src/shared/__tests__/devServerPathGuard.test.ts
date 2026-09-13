import { describe, expect, it } from "vitest";

import { hasWindowsPathAlias } from "../devServerPathGuard";

describe("hasWindowsPathAlias", () => {
  it("detects NTFS alternate data streams (GHSA-fx2h-pf6j-xcff PoC)", () => {
    expect(hasWindowsPathAlias("/.env::$DATA?raw")).toBe(true);
    expect(hasWindowsPathAlias("/tls.pem::$DATA?raw")).toBe(true);
    expect(hasWindowsPathAlias("/.env::$DATA")).toBe(true);
  });

  it("detects percent-encoded alternate data streams", () => {
    expect(hasWindowsPathAlias("/.env%3A%3ADATA?raw")).toBe(true);
    expect(hasWindowsPathAlias("/.env%3a%3adata")).toBe(true);
  });

  it("detects 8.3 short names", () => {
    expect(hasWindowsPathAlias("/ENV~1")).toBe(true);
    expect(hasWindowsPathAlias("/TLS~1.PEM")).toBe(true);
    expect(hasWindowsPathAlias("/.env.local/../ENV~10")).toBe(true);
  });

  it("allows ordinary dev-server requests", () => {
    expect(hasWindowsPathAlias("/")).toBe(false);
    expect(hasWindowsPathAlias("/index.html")).toBe(false);
    expect(hasWindowsPathAlias("/@vite/client")).toBe(false);
    expect(hasWindowsPathAlias("/src/renderer/src/main.tsx")).toBe(false);
    expect(hasWindowsPathAlias("/node_modules/.vite/deps/react.js?v=9f2c1a3b")).toBe(false);
    expect(hasWindowsPathAlias("/@fs/C:/Users/Test/project/src/main/index.ts")).toBe(false);
  });

  it("does not reject a bare tilde", () => {
    expect(hasWindowsPathAlias("/~user/notes.md")).toBe(false);
    expect(hasWindowsPathAlias("/docs/~/draft.md")).toBe(false);
  });

  it("does not throw on malformed percent escapes", () => {
    expect(() => hasWindowsPathAlias("/bad%zz")).not.toThrow();
    expect(hasWindowsPathAlias("/bad%zz")).toBe(false);
    expect(hasWindowsPathAlias("/bad%zz::DATA")).toBe(true);
  });
});
