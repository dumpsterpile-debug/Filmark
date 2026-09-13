export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
}

export function formatDate(value: string): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : value.slice(0, 10);
}

export function shortPath(filePath: string, max = 42): string {
  if (!filePath) return "";
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  return base.length > max ? `${base.slice(0, max - 1)}…` : base;
}
