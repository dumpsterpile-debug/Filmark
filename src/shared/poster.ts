/** 从 vjs-poster 的 background-image style 中提取封面 URL；协议相对地址补 https */
export function parsePosterUrl(style: string): string {
  const normalized = String(style).replace(/&quot;/g, '"');
  const match = /url\(\s*["']?([^"')]+)["']?\s*\)/i.exec(normalized);
  if (!match) return "";
  const candidate = match[1];
  let url = candidate?.trim() ?? "";
  if (url.startsWith("//")) url = `https:${url}`;
  return url;
}
