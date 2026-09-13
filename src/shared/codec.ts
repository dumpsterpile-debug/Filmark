const SUPPORTED_CODECS = new Set(["h264", "avc1", "vp9", "vp8", "av1"]);

/** 从 ffmpeg -i stderr 提取视频编码名 */
export function parseFfmpegCodec(stderr: string): string {
  const match = /Stream #\d+:\d+.*Video:\s*([a-zA-Z0-9_]+)/.exec(stderr);
  const codec = match?.[1];
  return codec ? codec.toLowerCase() : "";
}

/** 系统 HTML5 播放器可解编码白名单（不捆绑闭源解码器） */
export function isSupportedCodec(codec: string): boolean {
  return SUPPORTED_CODECS.has(codec.toLowerCase());
}
