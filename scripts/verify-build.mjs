#!/usr/bin/env node
/**
 * 构建产物校验：防止"源码已修但打包产物陈旧"这类事故。
 *
 * 校验三件事：
 * 1. 通道表（`src/shared/ipcChannels.ts` 的 `CHANNELS`）里的每个频道都出现在 out/ 构建产物中。
 *    「preload 调用的频道主进程都注册了 handler」已由通道表 + `IpcHandlers` 在 typecheck 阶段保证，
 *    这里只防产物陈旧或漏打。
 * 2. 若已打包，app.asar 必须同样包含这些频道，且不包含仅用于预览的 qaShots 代码。
 * 3. 若已打包，app.asar 不得早于最新构建产物（否则就是"源码已改但包没重打"）。
 *    第 3 条默认只告警；加上 --strict（dist 流程使用）时视为失败。
 *
 * 用法：npm run verify:build（构建后执行；打包后再次执行会额外校验 asar）
 *      npm run verify:build -- --strict
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const strict = process.argv.includes("--strict");
const root = process.cwd();
const mainBundle = join(root, "out/main/index.js");
const preloadBundle = join(root, "out/preload/index.js");
const asarPath = join(root, "release/win-unpacked/resources/app.asar");

/**
 * 只在 qaShots 模块实现里出现的字符串。
 * 注意不能使用 `runQaShots`：主进程 bundle 里保留了 `import('./qaShots.js').then(({ runQaShots }) => ...)`
 * 的解构名，会误报。
 */
const QA_SHOTS_MARKER = "qa-metadata.json";

const problems = [];

/**
 * 频道名从**源码**的通道表里读，而不是从压缩后的产物里正则抓调用 ——
 * 产物里的函数名会被压缩改掉，源码里的数组是稳定的。
 */
function readTableChannels() {
  const table = readFileSync(join(root, "src/shared/ipcChannels.ts"), "utf8");
  const block = table.match(
    /const CHANNELS = \[([\s\S]*?)\] as const satisfies readonly IpcChannel\[\];/
  );
  if (!block) return [];
  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function assert(condition, message) {
  if (!condition) problems.push(message);
}

for (const file of [mainBundle, preloadBundle]) {
  if (!existsSync(file)) {
    console.error(`[verify:build] 缺少构建产物 ${file}，请先运行 npm run build`);
    process.exit(1);
  }
}

const mainSource = readFileSync(mainBundle, "utf8");
const preloadSource = readFileSync(preloadBundle, "utf8");

// 1. 通道表 ↔ 构建产物
const channels = readTableChannels();
assert(channels.length > 0, "未能从 src/shared/ipcChannels.ts 的 CHANNELS 数组解析出频道名");

for (const channel of channels) {
  assert(preloadSource.includes(channel), `preload 构建产物缺少频道 "${channel}"（请重新构建）`);
  assert(mainSource.includes(channel), `主进程构建产物缺少频道 "${channel}"（请重新构建）`);
}

// 2. 打包产物一致性（仅在已打包时校验）
let checkedAsar = false;
let freshAsar = false;
if (existsSync(asarPath)) {
  checkedAsar = true;
  const asar = readFileSync(asarPath);
  for (const channel of channels) {
    assert(
      asar.includes(Buffer.from(channel)),
      `app.asar 中缺少频道 "${channel}"，打包产物可能早于当前源码（请重新打包）`
    );
  }
  assert(
    !asar.includes(Buffer.from(QA_SHOTS_MARKER)),
    "app.asar 中包含 qaShots 模块代码，仅用于预览的 QA 入口不应进入发布包"
  );

  // 新鲜度：app.asar 必须不早于它所打包的构建产物
  const bundles = [mainBundle, preloadBundle, join(root, "out/renderer/index.html")].filter(
    (file) => existsSync(file)
  );
  const newestBundle = Math.max(...bundles.map((file) => statSync(file).mtimeMs));
  if (statSync(asarPath).mtimeMs < newestBundle) {
    const message =
      "app.asar 早于最新构建产物（out/ 已重建但未重新打包），包内代码可能与源码不一致";
    if (strict) problems.push(message);
    else console.warn(`[verify:build] 警告：${message}`);
  } else {
    freshAsar = true;
  }

  console.log(`[verify:build] 已校验 app.asar（${statSync(asarPath).size} 字节）`);
}

if (problems.length > 0) {
  console.error("[verify:build] 校验失败：");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `[verify:build] 通过：通道表 ${channels.length} 个频道均出现在构建产物中` +
    (checkedAsar
      ? freshAsar
        ? "，且 app.asar 与当前源码一致"
        : "；app.asar 存在但早于当前构建（见上方警告）"
      : "（未发现打包产物，跳过 asar 校验）")
);
