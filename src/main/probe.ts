import { execFile } from "child_process";
import { app } from "electron";
import { existsSync } from "fs";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";
import { parseFfmpegCodec } from "@shared/codec";
import { parseFfmpegDurationMs } from "@shared/probe";

/** 解析 ffmpeg 可执行文件路径：打包环境使用 app.asar.unpacked 真实路径，开发环境沿用 ffmpeg-static */
export function resolveFfmpegPath(): string | null {
  if (app.isPackaged) {
    const unpacked = join(
      process.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "ffmpeg-static",
      "ffmpeg.exe"
    );
    if (existsSync(unpacked)) return unpacked;
  }
  return ffmpegPath ?? null;
}

/** 用 ffmpeg -i 探测视频时长（毫秒）；失败返回 0 */
export function probeDurationMs(videoPath: string): Promise<number> {
  return new Promise((resolve) => {
    const bin = resolveFfmpegPath();
    if (!bin) {
      resolve(0);
      return;
    }
    execFile(
      bin,
      ["-i", videoPath],
      { timeout: 15000, windowsHide: true },
      (_error, _stdout, stderr) => {
        resolve(parseFfmpegDurationMs(stderr));
      }
    );
  });
}

/** 用 ffmpeg -i 探测视频编码名；失败返回空字符串 */
export function probeVideoCodec(videoPath: string): Promise<string> {
  return new Promise((resolve) => {
    const bin = resolveFfmpegPath();
    if (!bin) {
      resolve("");
      return;
    }
    execFile(
      bin,
      ["-i", videoPath],
      { timeout: 15000, windowsHide: true },
      (_error, _stdout, stderr) => {
        resolve(parseFfmpegCodec(stderr));
      }
    );
  });
}
