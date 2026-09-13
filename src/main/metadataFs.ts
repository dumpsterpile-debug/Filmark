/**
 * 元数据文件系统访问 —— 集中本进程内所有对元数据 JSON 的文件操作。
 *
 * 不 import electron，因此可在 vitest 的 node 项目里直接测试。
 * 上层（`src/main/index.ts`）只负责把 `app.getPath(...)` 解析出来的目录传进来。
 */

import { readdir, readFile, stat, writeFile } from "fs/promises";
import { join } from "path";
import type { MetadataFilePort } from "@shared/metadataWrite";

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export type JsonReadResult =
  { kind: "array"; data: unknown[] } | { kind: "not-array" } | { kind: "parse-error" };

/** 读取 JSON 数组，保留「不是数组」与「解析失败」的区分（加载路径据此给出错误码） */
export async function readJsonArray(filePath: string): Promise<JsonReadResult> {
  try {
    const text = await readFile(filePath, "utf8");
    const data = JSON.parse(text) as unknown;
    return Array.isArray(data) ? { kind: "array", data } : { kind: "not-array" };
  } catch (error) {
    console.warn("[metadata] 跳过无法解析的文件:", filePath, error);
    return { kind: "parse-error" };
  }
}

/**
 * 把目标解析为具体的 JSON 文件列表。
 * 目标是文件时返回自身；是目录时返回其中所有 .json（按名排序）。
 * 目标不存在或不可读时抛错，交由调用方记为一次失败并继续下一个候选。
 */
export async function metadataJsonFiles(target: string): Promise<string[]> {
  const info = await stat(target);
  if (!info.isDirectory()) {
    return target.toLowerCase().endsWith(".json") ? [target] : [];
  }
  const files = (await readdir(target))
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
  return files.map((f) => join(target, f));
}

/** 写入模块使用的端口实现：真实文件系统 */
export const metadataFilePort: MetadataFilePort = {
  isDirectory: async (target) => (await stat(target)).isDirectory(),
  listJsonFiles: metadataJsonFiles,
  readArray: async (filePath) => {
    const result = await readJsonArray(filePath);
    return result.kind === "array" ? result.data : null;
  },
  writeJson: async (filePath, value) => {
    await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  },
  childPath: (dir, fileName) => join(dir, fileName),
};
