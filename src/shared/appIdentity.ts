/**
 * 应用身份的单一真源。
 *
 * `package.json` 里的 `name` / `build.productName` / `build.appId` 是打包器直接读取的副本，
 * 无法从 TS 导入，因此由 `src/shared/__tests__/appIdentity.test.ts` 断言两者保持一致，
 * 防止改名时只改一处导致窗口标题、快捷方式与数据目录互相错位。
 *
 * 本文件必须保持纯粹（无副作用、不引入 Node 内置模块），因为它同时被渲染层引用。
 */

/** 显示名：窗口标题、界面品牌名、快捷方式名 */
export const APP_DISPLAY_NAME = "Filmark";

/**
 * 用户数据目录名（`app.getPath("userData")` 的末级目录）。
 *
 * 必须与显示名解耦：Electron 默认按 `productName` 推导该目录，因此改名会连带
 * 换目录，表现为「播放单 / 观看进度 / 导入数据全部消失」。主进程在 ready 之前
 * 显式 `app.setName(APP_DATA_DIR_NAME)` 把它钉死，所以该值是持久契约，**不要改**。
 */
export const APP_DATA_DIR_NAME = "filmark";

/**
 * 反向域名应用标识。安装器写入的 AppUserModelId（任务栏固定与分组）、
 * 以及未来的商店身份都依赖它，正式发布后不应再变更。
 */
export const APP_ID = "io.github.dumpsterpile-debug.filmark";

/**
 * 历史数据目录名（旧显示名 / 旧包名），仅用于一次性迁移。
 *
 * 本发行版没有需要继承的历史目录（不存在从其它名称升级过来的用户），所以这里是空数组；
 * 迁移机制本身保持不变（`migrateLegacyUserData()` 会空跑一遍）。
 */
export const LEGACY_APP_DATA_DIR_NAMES: readonly string[] = [];

/**
 * 需要随改名迁移的数据（userData 根目录下的文件或目录）。
 *
 * 采用白名单而非「整目录拷贝」：userData 里还混有 Chromium 的缓存与状态
 * （`Cache`、`GPUCache`、`Local Storage`、`SingletonLock` 等），拷贝过来会造成
 * 陈旧状态。**新增持久化文件时同步这个列表。**
 */
export const APP_DATA_ENTRIES = [
  "playlist.json",
  "playback-progress.json",
  "file-relocations.json",
  "metadata",
  "thumbnails",
] as const;

/**
 * 从旧目录条目中挑出需要迁移的部分：只包含白名单内、且当前目录缺失的条目。
 *
 * 当前已存在的条目不会被覆盖，避免旧数据回灌覆盖用户新数据。
 *
 * @param currentEntries 当前 userData 目录下的条目名
 * @param legacyEntries 旧数据目录下的条目名
 * @returns 需要从旧目录拷贝过来的条目名（已排序，便于测试与日志稳定）
 */
export function pickEntriesToMigrate(
  currentEntries: Iterable<string>,
  legacyEntries: Iterable<string>
): string[] {
  const current = new Set(currentEntries);
  const allowlist = new Set<string>(APP_DATA_ENTRIES);
  const legacy = new Set(legacyEntries);
  return [...legacy].filter((entry) => allowlist.has(entry) && !current.has(entry)).sort();
}
