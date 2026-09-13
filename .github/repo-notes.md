# Repo Notes — 工程约定

供人和 agent 共用的项目约定。代码评审、脚手架改动、agent 任务都应以此为准。

## 运行环境

- Node `>=24.15.0 <25`（开发使用 `.nvmrc` 指定的 24.15.0），npm `>=11.12.1 <12`。
- `.npmrc` 开启 `engine-strict=true`，版本不符时安装会直接失败。
- 仅有 `package-lock.json`，使用 npm；依赖全部锁定**精确版本**（无 `^` / `~`）。
- 质量门禁：`npm run lint`（oxlint）+ `npm run typecheck` + `npm test`；提交时由 husky 跑前两项与测试。

## 布局与边界

| 目录                | 职责                                              | 约束                                     |
| ------------------- | ------------------------------------------------- | ---------------------------------------- |
| `src/main/`         | Electron 主进程：IPC、`media://` 协议、元数据读写 | 允许访问 Node/Electron API               |
| `src/preload/`      | `contextBridge` 暴露的 `window.api`               | 只做转发，不放业务逻辑                   |
| `src/renderer/src/` | React UI（页面 / 组件 / store / i18n）            | 不直接使用 Node API，一律经 `window.api` |
| `src/shared/`       | 纯逻辑，可被三端复用                              | 必须无副作用、可单测                     |

## 导入别名

三端统一（`electron.vite.config.ts` 与 `vitest.config.mts` 必须保持一致）：

- `@shared/*` → `src/shared/*`
- `@/*` → `src/renderer/src/*`（仅渲染层）

`src/main`、`src/preload` 不再使用 `../shared/...` 相对路径。

## 测试

- 测试与代码同级放在 `__tests__/`，命名 `*.test.ts` / `*.test.tsx`。
- Vitest 分两个 project（见 `vitest.config.mts`）：
  - `node`：`src/main/**`、`src/shared/**`，Node 环境。
  - `renderer`：`src/renderer/**`，jsdom + Testing Library，setup 在 `src/renderer/src/test/setup.ts`。
- 渲染层测试优先通过公共接口（角色 / 可访问名 / 回调）断言，不要依赖 class 名等实现细节。
- 断言使用来自 `en.json` 的已知字面量；需要固定语言时显式 `i18n.changeLanguage('en')`。
- 端到端测试工具的取舍（是否引入 Playwright）见 `.github/research/playwright-migration.md`；结论：保留 Vitest，仅按需新增 Electron E2E。该文件也记录了 `<webview>` 只能走 `electronApp.waitForEvent('window')` 这条未文档化路径。

## 命令

```bash
npm run dev            # 开发（热更新）
npm run lint           # oxlint（type-aware，全仓）
npm run typecheck      # 主进程 + 渲染层两套 tsconfig
npm test               # 全量测试
npm run build          # 构建到 out/
npm run verify:build   # 校验产物；打包后额外校验 app.asar
npm run dist           # 构建 + 打包 + 严格校验产物
```

提交时 Husky 会依次执行 `lint-staged`、`typecheck`、`test`。

## 已知约束

- **用 oxlint，不用 ESLint**：`typescript-eslint` 的 peer 范围是 `typescript >=4.8.4 <6.1.0`，加载时会直接拒绝 TypeScript 7.0（跟踪 issues#10940），因此 Lint 走 `oxlint`（`.oxlintrc.json`：`options.typeAware: true`，只开 `correctness` 类别）。刻意违反规则的地方用 `// oxlint-disable-next-line <rule>` 并在上一行写明理由（例：`siteExtractor` 测试里模拟页面上下文的 `new Function`）。在此之上仍依赖 TypeScript `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` 与测试。
- 打包产物路径为 `release/win-unpacked/resources/app.asar`；`resources/public` 由 `src/public` 经 `extraResources` 复制，而 `src/public/*.json` 被 git 忽略（属于本地媒体库数据，不入库）。
- 元数据写入必须优先写"实际加载来源"（`metadataUpdateTargets`），不要搜索固定目录列表；记录身份同时匹配 `file` 与 `id`（`findVideoRecordIndex`）。
