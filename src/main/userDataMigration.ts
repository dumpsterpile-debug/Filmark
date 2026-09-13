import { app } from "electron";
import { cp, mkdir, readdir } from "fs/promises";
import { join } from "path";
import { LEGACY_APP_DATA_DIR_NAMES, pickEntriesToMigrate } from "@shared/appIdentity";

/** 目录不存在或不可读时返回空数组：迁移不应因为读不到旧目录而失败 */
async function listEntries(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/**
 * 一次性迁移：把历史显示名 / 历史包名目录下的持久化数据并入当前 userData。
 *
 * - 只迁移 `APP_DATA_ENTRIES` 白名单内的条目，不搬运 Chromium 的缓存与状态目录
 * - 当前目录已存在的条目一律不覆盖，避免旧数据回灌
 * - 单个条目失败只告警并继续，绝不阻塞启动
 *
 * @returns 实际迁移成功的条目名（按排序稳定，便于日志核对）
 */
export async function migrateLegacyUserData(): Promise<string[]> {
  const current = app.getPath("userData");
  const appData = app.getPath("appData");
  const migrated: string[] = [];

  for (const legacyName of LEGACY_APP_DATA_DIR_NAMES) {
    const legacyDir = join(appData, legacyName);
    if (legacyDir === current) continue;

    const entries = pickEntriesToMigrate(await listEntries(current), await listEntries(legacyDir));
    if (entries.length === 0) continue;

    try {
      await mkdir(current, { recursive: true });
    } catch (error) {
      console.warn("[migrate] cannot create userData dir:", error);
      return migrated;
    }

    for (const entry of entries) {
      try {
        // force / errorOnExist 同为 false -> 目标已存在时跳过而非覆盖
        await cp(join(legacyDir, entry), join(current, entry), {
          recursive: true,
          force: false,
          errorOnExist: false,
        });
        migrated.push(entry);
      } catch (error) {
        console.warn(`[migrate] failed to migrate "${entry}" from ${legacyDir}:`, error);
      }
    }
  }

  return migrated;
}
