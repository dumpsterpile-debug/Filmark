# Filmark

Local-first video library and player.
本地优先的视频媒体库与播放器。

**English** · [中文](#中文)

---

## English

### Usage

#### Features

**Library**

- Fuzzy search over title / tags / artist / character / genre, with multi-select facet chips and applied filters shown as removable tags under the search bar.
- Sortable, paginated grid (20 / 50 / 100 per page) with three thumbnail sizes; multi-select or "select all results and play" to build a playlist in one go.
- Double-click a card to play it immediately.

**Playback**

- Player with volume / mute, ±5s seek, previous / next, theater mode (16:9, full width), fullscreen, auto-play-next and remembered progress; the control bar auto-hides after 3s idle.
- Shortcuts are fully rebindable (Settings → Shortcuts): click a key and press a new one, add several keys per action, remove or reset per action / all at once; conflicting keys are rejected. Defaults: `space` / `K` play-pause · `←` / `→` ±5s · `Q` / `E` prev-next · `↑` / `↓` volume · `M` mute · `T` theater · `F` fullscreen, plus a master on/off switch.
- Playlist panel sorts by duration / created / modified, and can rebuild the queue from the current video's tag.
- Playlist edit page adds drag-and-drop reordering, per-row delete and clear-all, with debounced auto-save.
- If a file cannot be played, the player offers "open containing folder" and retry.

**Acquisition**

- Built-in browser with address bar, back / forward, reload and an external-link policy; intercepted downloads are saved to a folder you choose, with progress.
- Import metadata files (previewed and de-duplicated), edit records in-app, and save a record automatically for each new download.

**Other**

- UI in English / 中文, remembered locally (default 中文).

#### Library & data

- Point the app at your metadata — one JSON file or a folder of them. It reads **every** `.json` it finds, merges them and de-duplicates by video path; a broken file is skipped with a warning instead of taking the rest down with it.
- Nothing to point at yet? Drop a JSON file into the app's `public` folder, or download a video in the built-in browser — a record is written for you automatically.
- Records are plain objects in an array, and missing fields degrade gracefully:

| Field                                     | Meaning                             |
| ----------------------------------------- | ----------------------------------- |
| `file`                                    | absolute path to the video          |
| `file_name`                               | title                               |
| `thumbnail`                               | thumbnail path or `url(...)` poster |
| `duration`                                | milliseconds                        |
| `genre` / `tags` / `artist` / `character` | facet fields                        |

- Nothing is locked in: change the data source any time from the toolbar, which always shows what is currently loaded.
- Your playlist, watch progress, imported metadata and thumbnails live in the app's data folder (`%APPDATA%/filmark` on Windows), not next to your videos.
- Playback settings (volume, autoplay, thumbnail size, page size, sort) are remembered automatically.

#### Known limitations

- Very large playlists make the edit page heavy: the watch page list is windowed, the edit page is not.
- Videos whose codec the OS cannot decode (e.g. some HEVC) need a system codec pack.

### Development

#### Quick start

```bash
npm install        # install deps (downloads Electron on first run)
npm run dev        # dev server with HMR
npm run lint       # oxlint over the whole repo
npm run typecheck  # tsc over main + renderer
npm test           # vitest
npm run build      # production build
npm run start      # run the production build
npm run dist       # build + package + verify
```

Husky runs `lint-staged`, `typecheck` and `test` on every commit. The stack is Electron + React + TypeScript, bundled by electron-vite; media is probed with ffmpeg.

#### Data locations & migration

- The data folder name is **pinned** and decoupled from the display name, so renaming the app never moves your library.
- On first launch data is migrated once from the legacy folders and existing files are never overwritten.
- Playback settings live in localStorage rather than the data folder.

#### QA screenshots

Setting `QA_SHOTS_DIR` before starting the production build walks the main flows and writes screenshots plus layout / interaction metrics. The script generates its own throwaway media (a 2s mp4 + thumbnail + temp metadata via ffmpeg-static), so it verifies playback / thumbnails / download interception / browser navigation deterministically without a real library, and restores your real data afterwards.

```powershell
# ELECTRON_RUN_AS_NODE=1 forces pure Node mode and must be cleared first
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:QA_SHOTS_DIR = "$PWD\qa-output"
npm run start
```

#### Packaging (Windows)

```bash
npm run dist   # build + electron-builder + verify:build --strict
```

Artifacts land in `release/`:

- `filmark-setup-<version>.exe` — NSIS installer with optional install directory, desktop and start-menu shortcuts.
- `filmark-portable-<version>.exe` — portable, no install needed.
- `win-unpacked/` — unpacked directory; run `Filmark.exe` from it.

No code-signing certificate is configured yet, so Windows SmartScreen may warn about an unknown publisher — add one before distributing widely. The package ships no `node_modules` (Vite bundles the renderer) and is about 78 MB.

---

## 中文

### 使用

#### 功能

**媒体库**

- 标题 / 标签 / 作者 / 角色 / 分类模糊搜索，多选分面筛选，已应用条件以可删除标签展示在搜索栏下方。
- 可排序分页网格（每页 20 / 50 / 100）与三档缩略图；支持多选或「全选并播放」一次性生成播放单。
- **双击卡片**直接播放。

**播放**

- 播放器支持音量 / 静音、±5 秒、上下一个、剧场模式（16:9 全宽）、全屏、连播与观看进度记忆；控制条 3 秒无操作自动隐藏。
- 快捷键可在「设置 → 快捷键」中完全自定义：点击按键后按下新键、可为同一动作添加多个按键、逐项或一键恢复默认，冲突按键会被拒绝。默认 `space` / `K` 播放暂停，`←` / `→` 前后 5 秒，`Q` / `E` 上下一个，`↑` / `↓` 音量，`M` 静音，`T` 剧场模式，`F` 全屏，并提供总开关。
- 待播面板按时长 / 创建 / 修改排序，也可用当前视频的标签重建待播单。
- 待播编辑页支持拖拽排序、逐行删除与一键清空，改动防抖自动保存。
- 文件无法播放时提供「打开所在文件夹」与重试。

**获取**

- 内置浏览器含地址栏、前进 / 后退、刷新与外链策略；拦截到的下载保存到你选择的目录并显示进度。
- 元数据可导入（预览、去重）、应用内编辑，并为每次新下载自动保存一条记录。

**其他**

- 界面支持中文 / English，本地记忆，默认中文。

#### 媒体库与数据

- 把你的元数据交给应用即可 —— 单个 JSON 文件或一整个目录。它会读取其中**所有** `.json` 并合并，按视频路径去重；某个文件损坏只会被跳过并告警，不影响其他文件。
- 还没有元数据？把 JSON 放进应用的 `public` 文件夹，或在内置浏览器里下载一个视频 —— 会自动写入一条记录。
- 记录就是数组里的普通对象，字段缺失会自动降级：

| 字段                                      | 含义                         |
| ----------------------------------------- | ---------------------------- |
| `file`                                    | 视频绝对路径                 |
| `file_name`                               | 标题                         |
| `thumbnail`                               | 缩略图路径或 `url(...)` 海报 |
| `duration`                                | 毫秒                         |
| `genre` / `tags` / `artist` / `character` | 分面字段                     |

- 数据源不锁定：随时可在工具栏切换，那里始终显示当前加载的来源。
- 播放单、观看进度、导入的元数据与缩略图保存在应用数据目录（Windows 下为 `%APPDATA%/filmark`），不写进视频所在文件夹。
- 播放设置（音量、连播、缩略图尺寸、每页数量、排序）会自动记住。

#### 已知限制

- 超大播放单会让编辑页变重：视频页列表已窗口化，编辑页没有。
- 视频编码不被系统解码器支持（如部分 HEVC）时，需自行安装解码器。

### 开发

#### 快速开始

```bash
npm install        # 安装依赖（首次会下载 Electron）
npm run dev        # 开发模式，带 HMR
npm run lint       # 全仓 oxlint
npm run typecheck  # tsc 检查 main + renderer
npm test           # vitest
npm run build      # 生产构建
npm run start      # 以生产构建启动
npm run dist       # 构建 + 打包 + 校验
```

提交时 Husky 会依次执行 `lint-staged`、`typecheck`、`test`。技术栈为 Electron + React + TypeScript，由 electron-vite 打包；媒体探测走 ffmpeg。

#### 数据位置与迁移

- 数据目录名**固定**且与显示名解耦，改应用名不会搬走你的库。
- 首次启动会从旧目录一次性迁移数据，且永不覆盖已有文件。
- 播放设置存在 localStorage，不在数据目录里。

#### 自动化 QA

设置 `QA_SHOTS_DIR` 后启动生产构建，会自动走一遍核心流程并输出截图与布局 / 交互指标。脚本自备一次性测试媒体（ffmpeg-static 生成的 2 秒 mp4 + 缩略图 + 临时元数据），无需真实视频库即可确定性验证播放 / 缩略图 / 下载拦截 / 浏览器导航链路，结束后恢复真实数据。

```powershell
# ELECTRON_RUN_AS_NODE=1 会强制纯 Node 模式，必须先清掉
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:QA_SHOTS_DIR = "$PWD\qa-output"
npm run start
```

#### 打包分发（Windows）

```bash
npm run dist   # 构建 + 打包 + 严格校验
```

产物在 `release/` 下：

- `filmark-setup-<version>.exe` — 安装版，可自选安装目录并创建桌面 / 开始菜单快捷方式。
- `filmark-portable-<version>.exe` — 便携版，免安装直接运行。
- `win-unpacked/` — 未压缩绿色目录，可直接运行 `Filmark.exe`。

当前未配置代码签名证书，Windows SmartScreen 可能提示「未知发布者」，正式对外分发前建议配置；包内不含 `node_modules`（渲染层由 Vite 打包），体积约 78 MB。
