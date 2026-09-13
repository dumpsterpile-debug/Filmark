/**
 * 播放器快捷键：绑定字符串的规范化、事件匹配、冲突校验与持久化清洗。
 * 纯函数、无 DOM 依赖，渲染进程与测试共用（KeyboardEvent 天然满足 ShortcutKeyEvent）。
 */

/** 所有可配置的播放器动作（新增动作时同步 i18n 与设置页标签） */
export const SHORTCUT_ACTIONS = [
  "playPause",
  "seekBack",
  "seekForward",
  "prev",
  "next",
  "theater",
  "fullscreen",
  "volumeUp",
  "volumeDown",
  "mute",
] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

/** 设置页分组顺序 */
export const SHORTCUT_CATEGORIES = ["playback", "view", "volume"] as const;

export type ShortcutCategory = (typeof SHORTCUT_CATEGORIES)[number];

export const SHORTCUT_CATEGORY_OF: Record<ShortcutAction, ShortcutCategory> = {
  playPause: "playback",
  seekBack: "playback",
  seekForward: "playback",
  prev: "playback",
  next: "playback",
  theater: "view",
  fullscreen: "view",
  volumeUp: "volume",
  volumeDown: "volume",
  mute: "volume",
};

/** 一个动作可以有多个绑定（如播放/暂停同时支持 Space 与 K） */
export type ShortcutMap = Record<ShortcutAction, string[]>;

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  playPause: ["Space", "k"],
  seekBack: ["ArrowLeft"],
  seekForward: ["ArrowRight"],
  prev: ["q"],
  next: ["e"],
  theater: ["t"],
  fullscreen: ["f"],
  volumeUp: ["ArrowUp"],
  volumeDown: ["ArrowDown"],
  mute: ["m"],
};

/** keydown 事件的最小结构，便于测试注入 */
export interface ShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/** 不产生绑定的按键：纯修饰键、IME 中间态，以及留给设置页「取消录制」的 Esc */
const IGNORED_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "Dead",
  "Unidentified",
  "Escape",
]);

const DISPLAY_KEY_LABELS: Record<string, string> = {
  Space: "Space",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Backspace: "Backspace",
  Delete: "Del",
  Enter: "Enter",
  Tab: "Tab",
  Home: "Home",
  End: "End",
  Insert: "Ins",
  Escape: "Esc",
};

const DISPLAY_MODIFIER_LABELS: Record<string, string> = {
  Ctrl: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Meta: "Win",
};

/** 修饰键在绑定字符串中的固定顺序 */
const MODIFIER_ORDER = ["Ctrl", "Alt", "Shift", "Meta"] as const;

/** 把键盘事件转成规范绑定字符串；不可绑定（Esc / 纯修饰键）时返回 null */
export function keyToBinding(event: ShortcutKeyEvent): string | null {
  const raw = event.key;
  if (!raw || IGNORED_KEYS.has(raw)) return null;
  const key = raw === " " ? "Space" : raw.length === 1 ? raw.toLowerCase() : raw;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  // 可打印字符的大小写已由 key 本身体现，不再叠加 Shift，避免 Ctrl+Shift+P 与 Ctrl+P 混淆
  if (event.shiftKey && key.length > 1) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(key);
  return parts.join("+");
}

/** 判断键盘事件是否命中某个绑定 */
export function matchesBinding(event: ShortcutKeyEvent, binding: string): boolean {
  const pressed = keyToBinding(event);
  return pressed !== null && pressed === binding;
}

/** 在绑定表中查找命中的动作；设置页已阻止冲突，这里按定义顺序取首个 */
export function matchShortcut(
  shortcuts: ShortcutMap,
  event: ShortcutKeyEvent
): ShortcutAction | null {
  const pressed = keyToBinding(event);
  if (!pressed) return null;
  for (const action of SHORTCUT_ACTIONS) {
    if (shortcuts[action]?.includes(pressed)) return action;
  }
  return null;
}

/** 绑定字符串 → 展示文案：'Ctrl+k' → 'Ctrl + K'，'ArrowLeft' → '←' */
export function formatBinding(binding: string): string {
  const modifiers: string[] = [];
  let rest = binding;
  for (const modifier of MODIFIER_ORDER) {
    if (rest.startsWith(`${modifier}+`)) {
      modifiers.push(DISPLAY_MODIFIER_LABELS[modifier] ?? modifier);
      rest = rest.slice(modifier.length + 1);
    }
  }
  const keyLabel = DISPLAY_KEY_LABELS[rest] ?? (rest.length === 1 ? rest.toUpperCase() : rest);
  return [...modifiers, keyLabel].join(" + ");
}

export interface ShortcutConflict {
  action: ShortcutAction;
  index: number;
}

/** 查找绑定是否已被其它动作（或同一动作的其它位置）占用 */
export function findShortcutConflict(
  shortcuts: ShortcutMap,
  action: ShortcutAction,
  binding: string,
  index: number | null
): ShortcutConflict | null {
  for (const other of SHORTCUT_ACTIONS) {
    const list = shortcuts[other] ?? [];
    for (let i = 0; i < list.length; i += 1) {
      if (list[i] !== binding) continue;
      if (other === action && i === index) continue;
      return { action: other, index: i };
    }
  }
  return null;
}

export type AssignShortcutResult =
  | { ok: true; shortcuts: ShortcutMap }
  | { ok: false; reason: "invalid" | "conflict"; conflict?: ShortcutConflict };

/**
 * 写入 / 替换（index 为数字）或追加（index 为 null）一个绑定。
 * 冲突或非法时返回失败原因且不改动原表；成功时返回新表。
 */
export function assignShortcut(
  shortcuts: ShortcutMap,
  action: ShortcutAction,
  binding: string,
  index: number | null = null
): AssignShortcutResult {
  const value = binding.trim();
  if (!value) return { ok: false, reason: "invalid" };
  const conflict = findShortcutConflict(shortcuts, action, value, index);
  if (conflict) return { ok: false, reason: "conflict", conflict };
  const list = [...(shortcuts[action] ?? [])];
  if (index === null || index >= list.length) {
    list.push(value);
  } else {
    list[index] = value;
  }
  return { ok: true, shortcuts: { ...shortcuts, [action]: list } };
}

/** 移除一个绑定；允许清空（该动作即不再响应键盘） */
export function removeShortcut(
  shortcuts: ShortcutMap,
  action: ShortcutAction,
  index: number
): ShortcutMap {
  return { ...shortcuts, [action]: (shortcuts[action] ?? []).filter((_, i) => i !== index) };
}

/** 合法绑定：非空、无空白、无控制字符，长度受限 */
function isValidBinding(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 32) return false;
  if (/\s/.test(trimmed)) return false;
  // eslint-disable-next-line no-control-regex
  return /^[^\x00-\x1F\x7F]+$/.test(trimmed);
}

/**
 * 清洗持久化的绑定表：缺失或非数组的动作回落默认；非法项丢弃；
 * 重复绑定保留先出现的动作，保证结果永远是无冲突的完整表。
 */
export function sanitizeShortcuts(raw: unknown): ShortcutMap {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const used = new Set<string>();
  const out = {} as ShortcutMap;
  for (const action of SHORTCUT_ACTIONS) {
    const value = source[action];
    if (!Array.isArray(value)) {
      out[action] = [...DEFAULT_SHORTCUTS[action]];
      for (const binding of out[action]) used.add(binding);
      continue;
    }
    const list: string[] = [];
    for (const item of value) {
      if (!isValidBinding(item)) continue;
      const binding = item.trim();
      if (used.has(binding) || list.includes(binding)) continue;
      list.push(binding);
      used.add(binding);
    }
    out[action] = list;
  }
  return out;
}

/** 深拷贝一份默认绑定表 */
export function defaultShortcuts(): ShortcutMap {
  return sanitizeShortcuts(undefined);
}
