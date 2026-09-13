import { normalizeVideos } from "./videos";

export interface ImportSourceParse {
  path: string;
  ok: boolean;
  raw?: unknown[];
  error?: string;
}

export interface ImportPreviewResult {
  newCount: number;
  duplicateCount: number;
  failedFiles: { path: string; error: string }[];
  samples: { title: string; artist: string[]; file: string }[];
}

/** 依据解析结果与库中已有 id 计算导入预览（新增 / 重复 / 失败 / 样本）。 */
export function computeImportPreview(
  sources: ImportSourceParse[],
  existingIds: Set<string>
): ImportPreviewResult {
  const seen = new Set(existingIds);
  const result: ImportPreviewResult = {
    newCount: 0,
    duplicateCount: 0,
    failedFiles: [],
    samples: [],
  };

  for (const source of sources) {
    if (!source.ok) {
      result.failedFiles.push({ path: source.path, error: source.error ?? "parse error" });
      continue;
    }
    for (const video of normalizeVideos(source.raw ?? [])) {
      if (seen.has(video.id)) {
        result.duplicateCount += 1;
      } else {
        seen.add(video.id);
        result.newCount += 1;
        if (result.samples.length < 5) {
          result.samples.push({ title: video.title, artist: video.artist, file: video.file });
        }
      }
    }
  }

  return result;
}

/** 生成导入文件名称：import-YYYYMMDD-HHmmss.json */
export function importFileName(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `import-${stamp}.json`;
}
