# CONTEXT — Filmark 领域词汇

本文件是本仓库**领域术语的唯一来源**。代码、提交信息、评审与计划都应使用这里的词，
不要在别处发明同义词（例如不要用 "item"、"entry" 指代 metadata record）。

架构层面的词汇（module / interface / depth / seam / adapter / leverage / locality）
不在此定义，参见 `.agents/skills/codebase-design`。

---

## 1. 库与记录

**Video / 视频条目**
UI 中的一个可播放条目。来自 `normalizeVideos()`（`src/shared/videos.ts`）的输出，
类型为 `Video`（`src/shared/types.ts`）。

**Metadata record / 元数据记录**
`metadata.json` 数组中的一条原始 JSON 记录（`Record<string, unknown>`）。
它是磁盘上的形态，**不是** `Video`：记录以 `file` 标识，标题键是 `file_name`。
二者的转换在 `normalizeVideos()`。

**Record identity / 记录身份**
一条记录的标识值。约定见 [ADR-0001](docs/adr/0001-record-identity.md)：
以 `file` 为准，`id` 作为别名；标题以 `file_name` 为准，`title` 作为别名。
统一实现为 `recordIdentity()`。

**Video library / 视频库**
本应用管理的全部视频条目，来自一个**元数据来源**。

## 2. 来源与写入

**Metadata source / 元数据来源**
视频库的读取位置：单个 JSON 文件，或包含多个 JSON 的目录。
加载结果通过 `LoadMetadataResult.source` 回传，渲染层记为 `metadataPath`。

**Write target / 写入目标**
写入时必须搜索的候选位置列表。**优先级有一个唯一顺序**，
见 [ADR-0002](docs/adr/0002-write-target-priority.md)。统一实现为 `writeTargets()`。

**Loaded source / 实际加载来源**
本次视频库实际来自哪里。它排在写入优先级第一位 —— 打包后默认目录可能为空或只读。

**Imported store / 导入存储**
`userData/metadata/imported` 下的导入记录目录，是写入优先级的最后一档，也是兜底落点。

## 3. 浏览器与站点

**Site adapter / 站点适配器**
`src/shared/siteAdapters.ts` 注册表中的一个条目：页面域名、媒体域名、提取策略。
它承载**数据**，不含逻辑。**注册表是 host 事实的唯一来源**，
见 [ADR-0003](docs/adr/0003-site-registry-is-host-source.md)。

**Extract strategy / 提取策略**
在访客页执行的解析策略（`generic` / `pornhub` / `xhamster`），或 `null`
（只登记域名策略、不挂提取面板，例如 iwara）。
执行方式见 [ADR-0004](docs/adr/0004-extractor-serialization.md)。

**Media host / 媒体域名**
媒体文件或封面所在的 CDN 域名。**只能放媒体域名，不能放普通页面域名** ——
`decideDownload` 的调用方包含 webview 的 `will-navigate`，
把页面域名放进来会把站内正常跳转误判成下载。
全仓只有**一份**白名单（`collectMediaHosts()`）：封面拉取与下载拦截共用它，
不存在第二种白名单。

**Download interception / 下载拦截**
`persist:browser` 会话内拦截下载、弹出元数据表单、确认后再落盘的过程。
状态机实现为 `downloadInterception.ts`。

## 4. 界面

**Visible videos / 可见列表**
当前查询、facet 筛选、排序与「隐藏不可播放」共同作用后的结果列表。
**只有一个来源**：`selectVisibleVideos()`。任何页面或 action 都不得自行重建该列表。

**Search criteria / 检索条件**
构成可见列表的全部输入：查询串 + 4 个 facet + 排序 + 「隐藏不可播放」，
收敛成一个值（`SearchCriteria`），在 store 里就是 `criteria`。
编辑中的那份是 `draft`（`SearchDraft`），只有 `applySearch()` 会把它合进 `criteria`。
页面经 `useCriteria()` / `useDraft()` 订阅，非 React 上下文用 `selectVisibleVideos()`。

**Facet / 分面**
tags / artists / characters / genres 四类可累加筛选条件。

## 5. 进程边界

**IPC channel / IPC 频道**
渲染层与主进程之间一次请求-响应（invoke）的名称，形如 `域:动作`。
**频道表是唯一来源**：`src/shared/ipcChannels.ts` 的 `IpcChannels` 声明每个频道的入参与出参，
`CHANNELS` 列出全部频道名；主进程的 handler 表与 preload 的 `invoke()` 都由它约束，
完备性由 typecheck 保证（构建脚本只核对产物里装齐了没有）。

**IPC event / 推送事件**
主进程 → 渲染层的单向通知（`browser:download-intercept` / `browser:download-progress`）。
它们不是 invoke 频道，名称集中在 `IPC_EVENTS`。

---

## 变更本文件

改这份文件时改的是**领域语言**，不是实现。若某个词在代码里改了名，
本文件与对应 ADR 必须同步更新；相反，纯粹的实现重构不应改动这里。
