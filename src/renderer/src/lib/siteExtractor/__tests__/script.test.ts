import { describe, expect, it } from "vitest";
import { SITE_ADAPTERS } from "@shared/siteAdapters";
import adaptersSource from "../adapters.ts?raw";
import { PAGE_HELPER_POOL } from "../adapters";
import { buildExtractScript } from "../index";

/** 模块级 function 声明（顶格）即 helper；三个 extractor 写作 `export function`，不会命中 */
function moduleLevelFunctionNames(): string[] {
  return [...adaptersSource.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(
    (match) => match[1] ?? ""
  );
}

const strategies = SITE_ADAPTERS.map((adapter) => adapter.strategy).filter(
  (strategy): strategy is NonNullable<typeof strategy> => strategy !== null
);

describe("PAGE_HELPER_POOL registration", () => {
  it("registers every module-level helper defined in adapters.ts", () => {
    // 漏登记的失败模式是访客页里的 ReferenceError —— 类型检查与构建都看不见
    const pooled = new Set(PAGE_HELPER_POOL.map((fn) => fn.name));
    const missing = moduleLevelFunctionNames().filter((name) => !pooled.has(name));
    expect(missing).toEqual([]);
  });

  it("holds uniquely named functions only", () => {
    const names = PAGE_HELPER_POOL.map((fn) => fn.name);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("buildExtractScript", () => {
  it("builds a script for every strategy registered in SITE_ADAPTERS", () => {
    expect(strategies.length).toBeGreaterThan(0);
    for (const strategy of strategies) {
      const script = buildExtractScript(strategy, "https://example.com/");
      expect(script).toContain("var __extract =");
      expect(script).toContain(JSON.stringify("https://example.com/"));
    }
  });

  it("inlines helpers as named function declarations, not arrow constants", () => {
    // ADR-0004 约束 1：箭头常量序列化后不构成可调用声明
    const script = buildExtractScript("generic", "https://example.com/");
    for (const fn of PAGE_HELPER_POOL) {
      expect(script).toContain(`function ${fn.name}(`);
    }
  });

  it("runs in a page context without reaching module scope", () => {
    // 访客页只能看到 global；`new Function` 正是这个语义。
    // 某个 helper 一旦引用了模块作用域的导入或闭包变量，这里就会抛 ReferenceError。
    for (const strategy of strategies) {
      // oxlint-disable-next-line typescript/no-implied-eval
      const run = new Function(
        buildExtractScript(strategy, "https://example.com/")
      ) as () => unknown;
      expect(() => run()).not.toThrow();
    }
  });
});
