import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import ffmpeg from "fluent-ffmpeg";
import { thumbnailCachePath, thumbnailSeekMs } from "@shared/thumbnail";
import { resolveFfmpegPath } from "./probe";

let cacheDir = "";
let queue: Promise<unknown> = Promise.resolve();

export function setThumbnailCacheDir(dir: string): void {
  cacheDir = dir;
}

export function getThumbnailCacheDir(): string {
  return cacheDir;
}

/** 从远程 URL 下载封面并缓存；失败返回 null */
export async function downloadRemoteThumbnail(url: string): Promise<string | null> {
  try {
    const target = thumbnailCachePath(url, cacheDir);
    if (existsSync(target)) return target;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) return null;
    await mkdir(cacheDir, { recursive: true });
    await writeFile(target, buffer);
    return target;
  } catch (error) {
    console.warn("[thumbnail] remote download failed:", url, error);
    return null;
  }
}

/** 串行执行，避免批量截帧并发卡 IO */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** 为视频生成缩略图并缓存；命中缓存直接返回，失败返回 null */
export function generateThumbnail(videoPath: string, durationMs = 0): Promise<string | null> {
  return enqueue(async () => {
    const bin = resolveFfmpegPath();
    if (!bin) return null;
    try {
      const target = thumbnailCachePath(videoPath, cacheDir);
      if (existsSync(target)) return target;
      await mkdir(cacheDir, { recursive: true });
      const seek = thumbnailSeekMs(durationMs);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .setFfmpegPath(bin)
          .seekInput(seek / 1000)
          .outputOptions(["-frames:v", "1", "-vf", "scale=320:-1"])
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .save(target);
      });
      return target;
    } catch (error) {
      console.warn("[thumbnail] generate failed:", videoPath, error);
      return null;
    }
  });
}
