/**
 * 元数据写入模块 —— 全仓唯一负责「一条记录写到哪里、按什么身份匹配、用什么键名落下」的地方。
 *
 * 编辑（`metadata:update-video`）与下载完成（原 `appendSingleMeta`）两条路径都调用它，
 * 因此不会再出现「编辑能生效、下载却写到别处」这类分歧：
 * 目标顺序、身份规则、目录下的文件名都只在这里定义一次。
 *
 * 模块本身不接触文件系统 —— 读写全部经注入的 `MetadataFilePort` 完成，
 * 所以它可以用真实临时目录（或内存实现）直接测试。
 *
 * 规则出处：CONTEXT.md「写入目标」「记录身份」、ADR-0001、ADR-0002。
 */

import type { DownloadMeta } from "./types";
import { pickMetadataTarget } from "./metadataSource";

/** 元数据 JSON 的读写端口。主进程注入真实 fs 实现，测试注入临时目录实现。 */
export interface MetadataFilePort {
  /** 目标是目录时返回 true。目标不存在时抛错（由调用方记为一次失败并继续下一个候选）。 */
  isDirectory(target: string): Promise<boolean>;
  /** 目标下的全部 JSON 文件（目标是文件时返回自身）；目标不存在时抛错。 */
  listJsonFiles(target: string): Promise<string[]>;
  /** 读取 JSON 数组；文件不存在或内容不是数组时返回 null。 */
  readArray(filePath: string): Promise<unknown[] | null>;
  /** 以数据源统一格式（2 空格缩进）写回 JSON。 */
  writeJson(filePath: string, value: unknown): Promise<void>;
  /** 拼接目录下的文件名 —— 路径分隔符是环境细节，不进本模块。 */
  childPath(dir: string, fileName: string): string;
}

/** 目录目标下新建记录时使用的固定文件名（此前内联在下载路径里） */
export const APPEND_FILE_NAME = "downloads.json";

export type WriteResult = { ok: true; source: string } | { ok: false; error: string };

export interface WriteTargetsInput {
  /** 实际加载来源：编辑与下载都必须优先写它，否则会出现「写进去了但界面上看不到」 */
  loadedSource?: string | null | undefined;
  /** 持久化的来源路径 */
  persistedPath?: string | null | undefined;
  defaultDir: string;
  importedDir: string;
}

/**
 * 候写目标，按唯一优先级排序（ADR-0002）：
 * 实际加载来源 > 持久化路径 > 默认目录 > 导入存储。
 *
 * 打包后默认目录可能为空或只读，真实数据也可能位于用户自己选的持久化来源下，
 * 只搜默认目录会导致永远找不到记录。
 */
export function writeTargets(input: WriteTargetsInput): string[] {
  const targets: string[] = [];
  const push = (target: string | null | undefined): void => {
    if (!target) return;
    if (!targets.includes(target)) targets.push(target);
  };

  push(input.loadedSource);
  push(input.persistedPath);
  push(
    pickMetadataTarget({
      requestedPath: null,
      persistedPath: null,
      defaultDir: input.defaultDir,
    })
  );
  push(input.importedDir);
  return targets;
}

/**
 * 记录的身份键集合（ADR-0001）：`file` 为准，`id` 作为别名。
 *
 * 默认目录与旧版单文件的记录没有 `id`，导入存储的记录两者都有；
 * 匹配与判重都必须同时看这两个键，否则两类来源会各行其是。
 */
export function recordKeys(record: unknown): string[] {
  const r = (record ?? {}) as { file?: unknown; id?: unknown };
  const keys: string[] = [];
  if (typeof r.file === "string" && r.file) keys.push(r.file);
  if (typeof r.id === "string" && r.id && r.id !== r.file) keys.push(r.id);
  return keys;
}

/** UI 字段名 → 元数据记录键名的映射（记录以 file_name 作为标题键） */
const UI_TO_RECORD_KEY: Record<string, string> = {
  title: "file_name",
};

/**
 * 把 UI 编辑表单的字段转换为元数据记录的键名。
 *
 * `normalizeVideos` 解析标题的优先级是 `file_name ?? title ?? file`，
 * 因此记录里的 `file_name` 会遮蔽表单写入的 `title`，
 * 导致「保存成功但标题不变」。这里把 `title` 归一为 `file_name`。
 */
export function toRecordFields(fields: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    mapped[UI_TO_RECORD_KEY[key] ?? key] = value;
  }
  return mapped;
}

/**
 * 追加一条记录；身份键与已有记录重叠时视为重复，不写入。
 * 没有身份键（既无 `file` 也无 `id`）的记录总是追加 —— 无从判重。
 */
export function appendRecord(records: unknown[], record: unknown): unknown[] {
  const next = Array.isArray(records) ? [...records] : [];
  const keys = recordKeys(record);
  if (keys.length === 0) {
    next.push(record);
    return next;
  }
  const duplicate = next.some((existing) => recordKeys(existing).some((key) => keys.includes(key)));
  if (duplicate) return next;
  next.push(record);
  return next;
}

/** 格式化为数据源统一的时间格式：YYYY-MM-DD HH:mm:ss.SSS UTC */
export function formatMetadataDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number, len = 2): string => String(n).padStart(len, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.` +
    `${pad(date.getUTCMilliseconds(), 3)} UTC`
  );
}

/** 将 DownloadMeta 转换为与现有数据源一致的记录键（无冗余键） */
export function downloadMetaToRecord(meta: DownloadMeta): Record<string, unknown> {
  return {
    file: meta.file,
    thumbnail: meta.thumbnail,
    file_name: meta.file_name,
    duration: meta.durationMs,
    genre: meta.genre,
    tags: meta.tags,
    artist: meta.artist,
    character: meta.character,
    file_creation_date: formatMetadataDate(new Date(meta.created)),
    file_last_modification_date: formatMetadataDate(new Date(meta.modified)),
    file_extension: meta.extension || meta.file_extension,
  };
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface UpdateVideoInput {
  videoId: string;
  /** UI 表单字段（键名会被 `toRecordFields` 归一） */
  fields: Record<string, unknown>;
  targets: string[];
}

/**
 * 更新一条已存在的记录：按目标顺序找到第一条含该记录的文件并就地改写。
 *
 * 某个目标不可写（不存在 / 只读 / 解析失败）时记录原因并继续尝试后续候选，
 * 全部失败才返回错误，且错误消息带上每个目标的原因。
 */
export async function updateVideoRecord(
  input: UpdateVideoInput,
  port: MetadataFilePort
): Promise<WriteResult> {
  const fields = toRecordFields(input.fields);
  const failures: string[] = [];

  for (const target of input.targets) {
    try {
      for (const filePath of await port.listJsonFiles(target)) {
        const records = await port.readArray(filePath);
        if (!records) continue;
        const index = records.findIndex((record) => recordKeys(record).includes(input.videoId));
        if (index === -1) continue;
        const record = records[index] as Record<string, unknown>;
        Object.assign(record, fields);
        await port.writeJson(filePath, records);
        return { ok: true, source: filePath };
      }
    } catch (error) {
      failures.push(`${target}: ${reasonOf(error)}`);
    }
  }

  return {
    ok: false,
    error:
      failures.length > 0
        ? `Video not found in any writable metadata file (${failures.join("; ")})`
        : "Video not found in any metadata file",
  };
}

export interface AppendVideoInput {
  record: Record<string, unknown>;
  targets: string[];
}

/**
 * 追加一条新记录：写到第一个可用目标。
 *
 * 目标是目录时写入 `APPEND_FILE_NAME`（历史行为：下载落盘到一个固定文件名），
 * 全部目标都不可用时返回错误 —— 调用方再决定是否回退到导入存储。
 */
export async function appendVideoRecord(
  input: AppendVideoInput,
  port: MetadataFilePort
): Promise<WriteResult> {
  const failures: string[] = [];

  for (const target of input.targets) {
    try {
      const filePath = (await port.isDirectory(target))
        ? port.childPath(target, APPEND_FILE_NAME)
        : target;
      const existing = (await port.readArray(filePath)) ?? [];
      const next = appendRecord(existing, input.record);
      if (next.length !== existing.length) {
        await port.writeJson(filePath, next);
      }
      return { ok: true, source: filePath };
    } catch (error) {
      failures.push(`${target}: ${reasonOf(error)}`);
    }
  }

  return {
    ok: false,
    error: `No writable metadata target (${failures.join("; ") || "none"})`,
  };
}
