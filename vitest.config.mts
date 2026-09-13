import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sharedDir = fileURLToPath(new URL("./src/shared", import.meta.url));
const rendererDir = fileURLToPath(new URL("./src/renderer/src", import.meta.url));

/** 与 electron.vite.config.ts 保持一致的别名，避免测试环境与构建环境解析结果不同 */
const alias = {
  "@shared": sharedDir,
  "@": rendererDir,
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        // 主进程 / shared：纯 Node 环境，覆盖 IPC、策略与纯函数
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/main/**/*.test.ts", "src/shared/**/*.test.ts"],
        },
      },
      {
        // 渲染层：jsdom + Testing Library
        extends: true,
        test: {
          name: "renderer",
          environment: "jsdom",
          include: ["src/renderer/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/renderer/src/test/setup.ts"],
        },
      },
    ],
  },
});
