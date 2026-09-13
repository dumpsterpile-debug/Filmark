/** 把本地绝对路径转成主进程 media:// 协议可访问的 URL */
export function mediaUrl(filePath: string): string {
  if (!filePath) return "";
  return "media://media/" + encodeURIComponent(filePath);
}
