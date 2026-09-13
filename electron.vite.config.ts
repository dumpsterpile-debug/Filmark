import { resolve } from "path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

import { hasWindowsPathAlias } from "./src/shared/devServerPathGuard";

/**
 * 把 qaShots 从主进程入口 bundle 中外部化，并作为独立入口编译为 out/main/qaShots.js。
 * 效果：生产 main bundle（index.js）不再包含测试面；QA_SHOTS_DIR 预览运行时由独立
 * 入口文件提供模块（打包阶段再经 electron-builder files 排除，见 package.json）。
 */
function externalizeQaShots(): Plugin {
  return {
    name: "externalize-qa-shots",
    apply: "build",
    enforce: "post",
    config(config) {
      const existing = config.build?.rollupOptions?.external;
      const list = Array.isArray(existing) ? existing : [];
      return {
        build: {
          rollupOptions: {
            // 只匹配动态 import('./qaShots.js') 的说明符，不匹配 qaShots.ts 入口绝对路径
            external: [...list, /(^|\/)qaShots(\.js)?$/],
          },
        },
      };
    },
  };
}

/** 生产构建注入渲染进程 CSP（dev 不注入，避免破坏 HMR 与 React 刷新运行时） */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' media: data:",
  "media-src 'self' media:",
  "connect-src 'self'",
].join("; ");

function injectCsp(): Plugin {
  return {
    name: "inject-csp",
    apply: "build",
    transformIndexHtml() {
      return {
        html: "",
        tags: [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
            injectTo: "head-prepend",
          },
        ],
      };
    },
  };
}

/**
 * 开发服务器加固（GHSA-fx2h-pf6j-xcff / CVE-2026-53571）。
 *
 * Vite 通过 `server.fs.deny` 拒绝对 `.env` / `*.pem` 等敏感文件的直接访问，但在 Windows 上
 * `/.env::$DATA?raw`（NTFS 备用数据流）与 `ENV~1`（8.3 短名）会被当成“不敏感路径”放行。
 * Vite 7.3.6 起已修复该缺陷；这里再补一道与版本无关的防线：命中别名形态即 403，
 * 即使 dev server 被 `--host` 暴露到网络也不会泄露文件内容。判定逻辑见 shared 测试。
 */
function denyWindowsPathAliases(): Plugin {
  return {
    name: "deny-windows-path-aliases",
    apply: "serve",
    configureServer(server) {
      // 仅 Windows 需要（其它平台的 `~` 可能是合法路径），且仅作用于 dev server
      if (process.platform !== "win32") return;
      server.middlewares.use((req, res, next) => {
        if (hasWindowsPathAlias(req.url ?? "")) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }
        next();
      });
    },
  };
}

/** 跨进程共享代码别名：三端（main / preload / renderer）保持一致，避免相对路径风格分裂 */
const sharedAlias = { "@shared": resolve("src/shared") };

export default defineConfig({
  main: {
    resolve: { alias: sharedAlias },
    plugins: [externalizeQaShots()],
    build: {
      // electron-vite 5 起取代已废弃的 externalizeDepsPlugin()
      externalizeDeps: true,
      lib: {
        entry: {
          index: resolve("src/main/index.ts"),
          qaShots: resolve("src/main/qaShots.ts"),
        },
        formats: ["cjs"],
      },
    },
  },
  preload: {
    resolve: { alias: sharedAlias },
    build: {
      externalizeDeps: true,
    },
  },
  renderer: {
    resolve: {
      alias: {
        "@": resolve("src/renderer/src"),
        ...sharedAlias,
      },
    },
    plugins: [react(), injectCsp(), denyWindowsPathAliases()],
    // 渲染进程只从本机加载，显式绑定回环：dev server 不需要（也不应）暴露到局域网。
    // 注意 CLI 的 `--host` 优先级更高，真正的防线是上面的 denyWindowsPathAliases。
    server: { host: "127.0.0.1" },
  },
});
