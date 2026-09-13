import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 每个用例后卸载已渲染组件，避免 DOM 泄漏到下一个用例
afterEach(() => {
  cleanup();
});
