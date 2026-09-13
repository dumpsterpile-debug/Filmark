/**
 * 元数据**读取**规则：加载目标与错误分类。
 *
 * 写入规则不在这里 —— 见 `metadataWrite.ts`（目标优先级、记录身份、键名映射、
 * 落盘循环都在其中）。两侧共用 `pickMetadataTarget`，所以「默认目录是哪个」
 * 这个问题只有一份答案。
 */

export type MetadataErrorCode = "E_PATH_NOT_FOUND" | "E_NO_JSON" | "E_PARSE_FAILED";

export interface PickMetadataTargetInput {
  requestedPath: string | null | undefined;
  persistedPath: string | null | undefined;
  defaultDir: string;
}

/**
 * 解析元数据加载目标路径。
 * 优先级：显式请求路径 > 持久化默认路径 > 默认目录。
 *
 * 默认目录就是「用户自己放元数据 JSON 的地方」（开发环境 `src/public`，打包后
 * `resources/public`）。**没有历史路径回退** —— 找不到时不再去翻开发机上的旧项目目录，
 * 而是把结果交给界面：引导用户放入 JSON，或改用内置浏览器下载（下载会自动生成记录）。
 */
export function pickMetadataTarget(input: PickMetadataTargetInput): string {
  if (input.requestedPath) return input.requestedPath;
  if (input.persistedPath) return input.persistedPath;
  return input.defaultDir;
}

export interface MetadataErrorInput {
  exists: boolean;
  isDirectory: boolean;
  jsonCount: number;
  parsedArrayCount: number;
  parsedOtherCount: number;
}

/**
 * 依据元数据收集统计分类错误：
 * - E_PATH_NOT_FOUND：路径不存在；
 * - E_NO_JSON：目录无 JSON 文件，或文件/内容解析成功但不是数组；
 * - E_PARSE_FAILED：存在 JSON 文件但全部解析失败；
 * - null：至少一个数组解析成功。
 */
export function metadataErrorCode(input: MetadataErrorInput): MetadataErrorCode | null {
  if (!input.exists) return "E_PATH_NOT_FOUND";
  if (input.jsonCount === 0) return "E_NO_JSON";
  if (input.parsedArrayCount > 0) return null;
  return input.parsedOtherCount > 0 ? "E_NO_JSON" : "E_PARSE_FAILED";
}
