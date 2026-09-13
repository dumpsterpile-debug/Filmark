import { app, BrowserWindow } from "electron";
import { execFileSync } from "child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";
import { generateThumbnail } from "./thumbnail";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function shot(win: BrowserWindow, dir: string, name: string): Promise<void> {
  const image = await win.webContents.capturePage();
  await writeFile(join(dir, `${name}.png`), image.toPNG());
}

async function diag(win: BrowserWindow, dir: string, label: string, script: string): Promise<void> {
  const value = await win.webContents.executeJavaScript(script);
  console.log(`[QA][${label}]`, JSON.stringify(value));
  await writeFile(join(dir, `diag-${label}.json`), JSON.stringify(value, null, 2), "utf8");
}

const HOME_DIAG = `(() => {
  const $$ = (s) => [...document.querySelectorAll(s)];
  const grid = document.querySelector('.video-grid');
  return {
    route: location.hash,
    cards: $$('[data-testid="video-card"]').length,
    gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
    toolbar: $$('.toolbar .tool-btn').map((b) => b.textContent.trim().replace(/\\s+/g, ' ')),
    resultCount: document.querySelector('.result-count')?.textContent.trim(),
    pagination: document.querySelector('.pagination')?.textContent.replace(/\\s+/g, ' ').trim(),
    thumbLoaded: $$('.thumb-wrap img').filter((i) => i.complete && i.naturalWidth > 0).length,
    playlistBadge: document.querySelector('.toolbar-right .badge')?.textContent.trim()
  };
})()`;

const ADVANCED_DIAG = `(() => {
  const $$ = (s) => [...document.querySelectorAll(s)];
  return {
    panelOpen: !!document.querySelector('.advanced-panel'),
    tagChips: $$('.filter-group .chip').length,
    filterLabels: $$('.filter-label').map((l) => l.textContent)
  };
})()`;

const WATCH_DIAG = `(() => {
  const $$ = (s) => [...document.querySelectorAll(s)];
  const player = document.querySelector('.player')?.getBoundingClientRect();
  const col = document.querySelector('.player-col')?.getBoundingClientRect();
  const page = document.querySelector('.watch-page')?.getBoundingClientRect();
  const layout = document.querySelector('.watch-layout');
  return {
    route: location.hash,
    theater: layout?.classList.contains('theater') ?? false,
    playerWidth: player ? Math.round(player.width) : 0,
    playerColWidth: col ? Math.round(col.width) : 0,
    pageWidth: page ? Math.round(page.width) : 0,
    playerFillRatio: player && col ? +(player.width / col.width).toFixed(3) : 0,
    title: document.querySelector('.watch-title')?.textContent,
    tagChips: $$('.watch-tags .chip').map((c) => c.textContent),
    controlTitles: $$('.player-controls button').map((b) => b.title || b.textContent.trim()),
    timeLabel: document.querySelector('.time-label')?.textContent,
    playlistRows: $$('.playlist-row').length,
    autoplayOn: document.querySelector('.player-controls [role="switch"]')?.getAttribute('aria-checked') === 'true'
  };
})()`;

const EDIT_DIAG = `(() => {
  const $$ = (s) => [...document.querySelectorAll(s)];
  const viewport = document.querySelector('.virtual-viewport');
  const rows = $$('.edit-row');
  const first = rows[0]?.getBoundingClientRect();
  const second = rows[1]?.getBoundingClientRect();
  const vpStyle = viewport ? getComputedStyle(viewport) : null;
  return {
    route: location.hash,
    rows: rows.length,
    dragHandles: $$('.drag-handle').length,
    count: document.querySelector('.edit-count')?.textContent,
    actions: $$('.edit-actions .tool-btn').map((b) => b.textContent.trim()),
    rowHeight: first ? Math.round(first.height * 100) / 100 : 0,
    rowOffset: first && second ? Math.round((second.top - first.top) * 100) / 100 : 0,
    viewportClientHeight: viewport?.clientHeight ?? 0,
    viewportScrollHeight: viewport?.scrollHeight ?? 0,
    viewportClientWidth: viewport?.clientWidth ?? 0,
    viewportScrollWidth: viewport?.scrollWidth ?? 0,
    viewportMaxHeight: vpStyle?.maxHeight ?? '',
    overflowX: vpStyle?.overflowX ?? '',
    overflowY: vpStyle?.overflowY ?? '',
    spacerHeight: document.querySelector('.virtual-spacer')?.style.height ?? ''
  };
})()`;

const BROWSER_DIAG = `(() => {
  const $$ = (s) => [...document.querySelectorAll(s)];
  const webview = document.querySelector('webview');
  let webviewUrl = '';
  try {
    webviewUrl = webview ? webview.getURL() : '';
  } catch {
    /* webview 未就绪 */
  }
  return {
    route: location.hash,
    addressBar: document.querySelector('.browser-address input')?.value ?? '',
    webviewAttached: !!webview,
    webviewUrl,
    navButtons: $$('.browser-nav .tool-btn').map((b) => b.title || b.textContent.trim()),
    modalVisible: !!document.querySelector('.download-meta-card'),
    modalFile: document.querySelector('.download-meta-file')?.textContent ?? ''
  };
})()`;

async function waitForLoad(win: BrowserWindow): Promise<void> {
  if (!win.webContents.isLoading()) return;
  await new Promise<void>((resolve) => win.webContents.once("did-finish-load", () => resolve()));
}

async function waitForWebview(win: BrowserWindow): Promise<boolean> {
  for (let i = 0; i < 24; i++) {
    const has = await win.webContents.executeJavaScript(`!!document.querySelector('webview')`);
    if (has) return true;
    await sleep(250);
  }
  return false;
}

async function webviewHas(win: BrowserWindow, selector: string): Promise<boolean> {
  try {
    const found = await win.webContents.executeJavaScript(
      `document.querySelector('webview')
        ? document.querySelector('webview').executeJavaScript("!!document.querySelector('${selector}')")
        : Promise.resolve(false)`
    );
    return Boolean(found);
  } catch {
    return false;
  }
}

async function waitForModal(win: BrowserWindow): Promise<boolean> {
  for (let i = 0; i < 24; i++) {
    const has = await win.webContents.executeJavaScript(
      `!!document.querySelector('.download-meta-card')`
    );
    if (has) return true;
    await sleep(250);
  }
  return false;
}

/**
 * 生成一次性测试视频（ffmpeg-static）与缩略图，写入临时元数据 JSON。
 * 使 QA 在无真实视频库的环境下也能确定性验证播放/缩略图链路。
 */
async function prepareQaMedia(): Promise<{ dir: string; metadataPath: string }> {
  const dir = mkdtempSync(join(tmpdir(), "qa-media-"));
  const videoPath = join(dir, "qa-test.mp4");
  if (!existsSync(videoPath) && ffmpegPath) {
    execFileSync(
      ffmpegPath,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=2:size=320x180:rate=10",
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        "-movflags",
        "+faststart",
        videoPath,
      ],
      { stdio: "ignore" }
    );
  }
  if (!existsSync(videoPath)) {
    throw new Error("[QA] ffmpeg test video generation failed");
  }
  const durationMs = 2000;
  const thumbnail = await generateThumbnail(videoPath, durationMs);
  const metadataPath = join(dir, "qa-metadata.json");
  writeFileSync(
    metadataPath,
    JSON.stringify(
      [
        {
          file: videoPath,
          file_name: "qa-test.mp4",
          title: "Miku QA Test Video",
          duration: durationMs,
          thumbnail: thumbnail ?? "",
          genre: "miku",
          tags: ["miku", "qa"],
          artist: ["Miku"],
          character: ["Miku"],
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          file_extension: "mp4",
        },
      ],
      null,
      2
    ),
    "utf8"
  );
  return { dir, metadataPath };
}

/** 重置持久化设置：数据源指向临时元数据，清除浏览器/下载/隐藏不可播放等状态 */
async function resetSettingsForQa(win: BrowserWindow, metadataPath: string): Promise<void> {
  await win.webContents.executeJavaScript(`
    (() => {
      const raw = localStorage.getItem('media-player-settings');
      let state = {};
      try { state = raw ? JSON.parse(raw).state ?? {} : {}; } catch { /* ignore */ }
      delete state.defaultWebUrl;
      delete state.downloadPath;
      delete state.hideUnplayable;
      state.defaultMetadataPath = ${JSON.stringify(metadataPath)};
      state.hideUnplayable = false;
      localStorage.setItem('media-player-settings', JSON.stringify({ state, version: 0 }));
      return true;
    })()
  `);
  win.webContents.reload();
  await waitForLoad(win);
  await sleep(1200);
}

/** 清理持久化设置，避免 QA 残留影响日常使用 */
async function clearQaSettings(win: BrowserWindow): Promise<void> {
  await win.webContents.executeJavaScript(`
    (() => {
      const raw = localStorage.getItem('media-player-settings');
      if (!raw) return true;
      let state = {};
      try { state = JSON.parse(raw).state ?? {}; } catch { return true; }
      delete state.defaultMetadataPath;
      delete state.defaultWebUrl;
      delete state.downloadPath;
      delete state.hideUnplayable;
      localStorage.setItem('media-player-settings', JSON.stringify({ state, version: 0 }));
      return true;
    })()
  `);
}

/** 浏览器导航 + 下载拦截回归：本地 HTTP 测试页验证 webview 加载/导航/拦截表单 */
async function runBrowserChecks(win: BrowserWindow, dir: string): Promise<void> {
  const pages = new Map<string, string>([
    [
      "/",
      '<!doctype html><html><body><h1 id="qa-home">QA Browser Home</h1>' +
        '<a href="/page.html">goto-page</a>' +
        '<a id="qa-download" href="/file.bin" download>download</a></body></html>',
    ],
    [
      "/page.html",
      '<!doctype html><html><body><h1 id="qa-page">QA Browser Page</h1>' +
        '<a id="qa-download" href="/file.bin" download>download</a></body></html>',
    ],
  ]);
  const payload = Buffer.alloc(1024, 0x61);
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/file.bin") {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(payload.length),
      });
      res.end(payload);
      return;
    }
    const html = path ? pages.get(path) : undefined;
    if (html) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const tempDir = mkdtempSync(join(tmpdir(), "qa-browser-"));

  const prior = (await win.webContents.executeJavaScript(
    `localStorage.getItem('media-player-settings')`
  )) as string | null;

  // 预置默认网页与下载目录为本地测试地址，重载后 zustand persist 重新水合
  await win.webContents.executeJavaScript(`
    localStorage.setItem('media-player-settings', JSON.stringify({
      state: {
        defaultWebUrl: ${JSON.stringify(base + "/")},
        downloadPath: ${JSON.stringify(tempDir)}
      },
      version: 0
    })); true
  `);
  win.webContents.reload();
  await waitForLoad(win);
  await sleep(1200);

  await win.webContents.executeJavaScript(`location.hash = '#/browser'; true`);
  await waitForWebview(win);
  await sleep(2000);
  await diag(win, dir, "browser", BROWSER_DIAG);
  await shot(win, dir, "07-browser");

  // 页面内导航（will-navigate 不拦截非下载 URL）
  await win.webContents.executeJavaScript(`
    document.querySelector('webview')?.executeJavaScript(
      "document.querySelector('a[href=\\"/page.html\\"]').click(); true"
    ); true
  `);
  for (let i = 0; i < 12 && !(await webviewHas(win, "#qa-page")); i++) {
    await sleep(250);
  }
  await diag(win, dir, "browser-navigate", BROWSER_DIAG);
  await shot(win, dir, "08-browser-navigate");

  // 触发下载 → 主进程 will-download 拦截 → 渲染进程弹元数据表单
  await win.webContents.executeJavaScript(`
    document.querySelector('webview')?.executeJavaScript(
      "document.getElementById('qa-download').click(); true"
    ); true
  `);
  await waitForModal(win);
  await diag(win, dir, "browser-download-intercept", BROWSER_DIAG);
  await shot(win, dir, "09-browser-download-intercept");

  // 取消下载表单
  await win.webContents.executeJavaScript(`
    (() => {
      const btn = [...document.querySelectorAll('.download-meta-card .modal-actions .tool-btn')]
        .find((b) => !b.classList.contains('primary'));
      if (btn) btn.click();
      return !!btn;
    })()
  `);
  await sleep(800);
  await diag(win, dir, "browser-download-cancel", BROWSER_DIAG);

  // 恢复此前设置并重载，避免影响后续运行
  await win.webContents.executeJavaScript(`
    ${
      prior
        ? `localStorage.setItem('media-player-settings', ${JSON.stringify(prior)});`
        : `localStorage.removeItem('media-player-settings');`
    }
    true
  `);
  win.webContents.reload();
  await waitForLoad(win);
  await sleep(1000);

  server.closeAllConnections?.();
  server.close();
  rmSync(tempDir, { recursive: true, force: true });
}

/** 备份真实播放单，QA 结束后恢复，避免回归流程覆盖用户数据 */
function backupPlaylist(): string | null {
  const src = join(app.getPath("userData"), "playlist.json");
  if (!existsSync(src)) return null;
  const backup = join(tmpdir(), `qa-playlist-backup-${Date.now()}.json`);
  copyFileSync(src, backup);
  console.log("[QA] playlist backed up:", src, "->", backup);
  return backup;
}

function restorePlaylist(backup: string | null): void {
  const dest = join(app.getPath("userData"), "playlist.json");
  if (backup && existsSync(backup)) {
    copyFileSync(backup, dest);
    rmSync(backup, { force: true });
    console.log("[QA] playlist restored:", dest);
  }
}

/** 由 QA_SHOTS_DIR 环境变量触发：自动走一遍核心页面与交互并截图，用于视觉回归检查。 */
export async function runQaShots(win: BrowserWindow, dir: string): Promise<void> {
  const playlistBackup = backupPlaylist();
  try {
    await runQaShotsInner(win, dir);
  } finally {
    // 恢复真实播放单；任何失败也必须退出应用，避免残留进程占用单实例锁
    restorePlaylist(playlistBackup);
    setTimeout(() => app.quit(), 400);
  }
}

async function runQaShotsInner(win: BrowserWindow, dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await sleep(1600);

  // 0) 准备测试媒体并重置持久化设置（数据源 → 临时元数据）
  const media = await prepareQaMedia();
  await resetSettingsForQa(win, media.metadataPath);

  // 1) 主页：点击第一个视频的 ＋ 加入播放单，再记录状态与截图
  await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.querySelector('[data-testid="video-card"] .card-add');
      if (btn) btn.click();
      return !!btn;
    })()
  `);
  await sleep(500);
  await diag(win, dir, "home", HOME_DIAG);
  await shot(win, dir, "01-home");

  // 2) 展开高级搜索
  await win.webContents.executeJavaScript(
    `document.querySelector('input[data-testid="search-input"]')?.focus(); true`
  );
  await sleep(500);
  await diag(win, dir, "advanced", ADVANCED_DIAG);
  await shot(win, dir, "02-home-advanced");

  // 3) 测试搜索：输入 miku 并回车
  await win.webContents.executeJavaScript(`
    (() => {
      const input = document.querySelector('input[data-testid="search-input"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'miku');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      return true;
    })()
  `);
  await sleep(700);
  await diag(win, dir, "search", HOME_DIAG);

  // 3.5) 主页交互：翻页、多选加入播放单、全选、排序
  await diag(
    win,
    dir,
    "interactions",
    `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = {};
      const clickByText = (selector, text) => {
        const el = [...document.querySelectorAll(selector)].find((b) => b.textContent?.includes(text));
        el?.click();
        return !!el;
      };

      clickByText('.page-btn', '2');
      await sleep(350);
      out.pageRangeAfterNext = document.querySelector('.page-range')?.textContent;
      clickByText('.page-btn', '1');
      await sleep(350);

      clickByText('.toolbar .tool-btn', '多选');
      await sleep(200);
      out.multiBarVisible = !!document.querySelector('.multi-bar');
      const boxes = document.querySelectorAll('.select-box');
      boxes[0]?.click();
      boxes[1]?.click();
      await sleep(200);
      out.selectedInfo = document.querySelector('.multi-info')?.textContent;
      clickByText('.multi-bar .tool-btn', '加入播放单');
      await sleep(500);
      out.badgeAfterMulti = document.querySelector('.toolbar-right .badge')?.textContent;

      clickByText('.toolbar .tool-btn', '无排序');
      await sleep(150);
      clickByText('.sort-option', 'A → Z');
      await sleep(450);
      out.firstTitleSorted = document.querySelector('[data-testid="video-card"] .card-title')?.textContent;
      out.resultAfterSort = document.querySelector('.result-count')?.textContent;
      return out;
    })()`
  );

  // 3.6) 角色 character 高级筛选（与 artist 相同逻辑）
  await diag(
    win,
    dir,
    "character-search",
    `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = {};
      const input = document.querySelector('input[data-testid="search-input"]');
      input?.focus();
      input?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await sleep(350);
      const panel = document.querySelector('.advanced-panel');
      out.panelOpen = !!panel;
      out.groups = [...document.querySelectorAll('.filter-group')].map((g) =>
        g.querySelector('.filter-label')?.textContent.trim()
      );
      out.chipCount = panel ? panel.querySelectorAll('.chip').length : 0;
      const groups = [...document.querySelectorAll('.filter-group')];
      const group = groups.find((g) =>
        g.querySelector('.filter-label')?.textContent.includes('character')
      );
      out.groupFound = !!group;
      const chip = group?.querySelector('.chip');
      out.characterChip = chip?.textContent.trim();
      chip?.click();
      await sleep(250);
      out.panelActions = [...document.querySelectorAll('.panel-actions .tool-btn')].map((b) =>
        b.textContent.trim().replace(/\\s+/g, ' ')
      );
      out.prefixChips = [...document.querySelectorAll('.search-prefix-chip')].map((c) =>
        c.textContent.trim().replace(/\\s+/g, ' ')
      );
      document.querySelector('input[data-testid="search-input"]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })
      );
      await sleep(650);
      out.resultCount = document.querySelector('.result-count')?.textContent;
      out.panelClosed = !document.querySelector('.advanced-panel');
      out.appliedChips = [...document.querySelectorAll('.applied-filters .chip')].map((c) =>
        c.textContent.trim()
      );
      return out;
    })()`
  );

  // 4) 主页「全选并播放」：生成播放列表并进入播放页播放第一个视频
  await win.webContents
    .executeJavaScript(
      `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = {};
      const btn = [...document.querySelectorAll('.toolbar .tool-btn')].find((b) =>
        b.textContent.includes('全选并播放')
      );
      out.buttonFound = !!btn;
      out.buttonLabel = btn?.textContent.trim();
      btn?.click();
      await sleep(1000);
      out.route = location.hash;
      out.playlistCount = document.querySelector('.playlist-title .badge')?.textContent;
      out.firstRowTitle = document.querySelector('.playlist-row .row-title')?.textContent;
      out.watchTitle = document.querySelector('.watch-title')?.textContent;
      return out;
    })()
  `
    )
    .then((value) => {
      console.log("[QA][select-all-play]", JSON.stringify(value));
    });
  await sleep(1800);
  await diag(win, dir, "watch", WATCH_DIAG);
  await shot(win, dir, "03-watch");

  // 5) 键盘 T 进入剧场模式
  await win.webContents.executeJavaScript(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT', bubbles: true })); true`
  );
  await sleep(700);
  await diag(win, dir, "watch-theater", WATCH_DIAG);
  await shot(win, dir, "04-watch-theater");

  // 5.5) 视频页交互：面板排序、Q/E 切换、标签生成新列表
  await diag(
    win,
    dir,
    "watch-interactions",
    `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = {};
      const getSortBtn = () => document.querySelector('.playlist-header .tool-btn');
      out.sortLabels = [];
      out.sortFirstTitles = [];
      for (let i = 0; i < 6; i++) {
        getSortBtn()?.click();
        await sleep(280);
        out.sortLabels.push(getSortBtn()?.textContent.trim());
        out.sortFirstTitles.push(
          document.querySelector('.playlist-row .row-title')?.textContent
        );
      }

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ', bubbles: true }));
      await sleep(450);
      out.titleAfterQ = document.querySelector('.watch-title')?.textContent;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', bubbles: true }));
      await sleep(450);
      out.titleAfterE = document.querySelector('.watch-title')?.textContent;

      const tagBtn = document.querySelector('.playlist-tags .chip');
      out.tagName = tagBtn?.textContent;
      tagBtn?.click();
      await sleep(500);
      out.rowsAfterTagClick = document.querySelectorAll('.playlist-row').length;
      out.panelCount = document.querySelector('.playlist-title .badge')?.textContent;
      return out;
    })()`
  );

  // 6) 返回主页并打开待播菜单编辑页
  await win.webContents.executeJavaScript(`location.hash = '#/'; true`);
  await sleep(900);
  await win.webContents.executeJavaScript(`
    (() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('打开待播菜单'));
      if (btn) btn.click();
      return !!btn;
    })()
  `);
  await sleep(1000);
  await diag(win, dir, "playlist-edit", EDIT_DIAG);
  await shot(win, dir, "05-playlist-edit");

  // 6.5) 编辑页交互：删除、保存、播放菜单
  await diag(
    win,
    dir,
    "edit-interactions",
    `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = {};
      out.rowsBeforeDelete = document.querySelectorAll('.edit-row').length;
      document.querySelector('.edit-row .row-remove')?.click();
      await sleep(350);
      out.rowsAfterDelete = document.querySelectorAll('.edit-row').length;
      const saveBtn = [...document.querySelectorAll('.edit-actions .tool-btn')].find((b) =>
        b.textContent.includes('保存')
      );
      saveBtn?.click();
      await sleep(500);
      out.toastAfterSave = [...document.querySelectorAll('.toast')].map((t) => t.textContent);
      const playBtn = [...document.querySelectorAll('.edit-actions .tool-btn')].find((b) =>
        b.textContent.includes('播放菜单')
      );
      playBtn?.click();
      await sleep(900);
      out.routeAfterPlay = location.hash;
      out.titleOnWatch = document.querySelector('.watch-title')?.textContent;
      return out;
    })()`
  );

  // 7) 验证 media:// 协议：加载真实缩略图
  await win.webContents
    .executeJavaScript(
      `
    (async () => {
      let persisted;
      try {
        persisted =
          (JSON.parse(localStorage.getItem('media-player-settings') || '{}').state || {})
            .defaultMetadataPath;
      } catch {
        persisted = undefined;
      }
      const meta = await window.api.loadMetadata(undefined, persisted);
      if (!meta.ok || !meta.videos.length) return 'no-metadata';
      const files = meta.fileCount ?? 1;
      const v = meta.videos.find((x) => x.thumbnail);
      if (!v) return 'no-thumb';
      // 与真实卡片缩略图一致：经 <img> 走 media://（img-src 'self' media: 允许），
      // 不用 fetch（connect-src 'self' 会拦截自定义 scheme）
      const loaded = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = 'media://media/' + encodeURIComponent(v.thumbnail);
        setTimeout(() => resolve(false), 5000);
      });
      return (
        'videos=' + meta.videos.length +
        ' files=' + files +
        ' thumb-loaded=' + loaded +
        ' status=' + (loaded ? 200 : 0)
      );
    })()
  `
    )
    .then((result) => {
      console.log("[QA] media protocol check:", result);
    })
    .catch((error) => {
      console.log("[QA] media protocol check error:", error);
    });

  // 8) 语言切换：主页切换至英文并截图，随后恢复中文
  await win.webContents.executeJavaScript(`location.hash = '#/'; true`);
  await sleep(900);
  await diag(win, dir, "language-zh", HOME_DIAG);
  await diag(
    win,
    dir,
    "language-en",
    `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const btn = document.querySelector('[data-testid="language-switch"]');
      if (!btn) return { clicked: false, lang: document.documentElement.lang };
      btn.click();
      await sleep(600);
      return {
        clicked: true,
        lang: document.documentElement.lang,
        buttonLabel: document
          .querySelector('[data-testid="language-switch"]')
          ?.textContent.trim(),
        placeholder: document
          .querySelector('input[data-testid="search-input"]')
          ?.getAttribute('placeholder'),
        searchButton: [...document.querySelectorAll('.search-btn')].map((b) =>
          b.textContent.trim()
        ),
        toolbar: [...document.querySelectorAll('.toolbar .tool-btn')].map((b) =>
          b.textContent.trim().replace(/\\s+/g, ' ')
        ),
        resultCount: document.querySelector('.result-count')?.textContent.trim(),
        sourceButton: document
          .querySelector('.source-btn')
          ?.textContent.trim().replace(/\\s+/g, ' '),
        pagination: document.querySelector('.pagination')?.textContent.replace(/\\s+/g, ' ').trim()
      };
    })()`
  );
  await shot(win, dir, "06-language-en");
  // 恢复中文，保证后续 QA 运行仍从默认中文开始
  await win.webContents.executeJavaScript(`
    (async () => {
      const btn = document.querySelector('[data-testid="language-switch"]');
      if (btn && document.documentElement.lang === 'en') btn.click();
      await new Promise((r) => setTimeout(r, 400));
      return document.documentElement.lang;
    })()
  `);

  // 9) 浏览器导航 + 下载拦截回归
  await runBrowserChecks(win, dir);

  // 10) 设置 → 快捷键：确认分组、按键芯片与总开关渲染
  await win.webContents.executeJavaScript(`location.hash = '#/settings'; true`);
  await sleep(700);
  await win.webContents.executeJavaScript(`
    (() => {
      const items = [...document.querySelectorAll('.settings-nav-item')];
      const btn = items.find((b) => b.textContent?.includes('快捷键')) ?? items[3];
      btn?.click();
      return !!btn;
    })()
  `);
  await sleep(400);
  await diag(
    win,
    dir,
    "shortcuts",
    `(() => {
      const $$ = (s) => [...document.querySelectorAll(s)];
      return {
        route: location.hash,
        groups: $$('.shortcut-group-title').map((h) => h.textContent.trim()),
        rows: $$('.shortcut-row').length,
        bindings: $$('.shortcut-row').map((row) => ({
          name: row.querySelector('.shortcut-name')?.textContent.trim(),
          keys: $$('.shortcut-key:not(.add)').length
            ? [...row.querySelectorAll('.shortcut-key:not(.add)')].map((k) => k.textContent.trim())
            : []
        })),
        masterSwitch: document.querySelector('.settings-section .tool-btn.active')?.textContent.trim() ?? ''
      };
    })()`
  );
  await shot(win, dir, "10-shortcuts");

  // 11) 清理：移除临时媒体并清除 QA 残留设置
  await clearQaSettings(win);
  rmSync(media.dir, { recursive: true, force: true });
}
