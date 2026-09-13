import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHORTCUTS,
  assignShortcut,
  defaultShortcuts,
  findShortcutConflict,
  formatBinding,
  keyToBinding,
  matchShortcut,
  matchesBinding,
  removeShortcut,
  sanitizeShortcuts,
  type ShortcutKeyEvent,
} from "../shortcuts";

function event(key: string, mods: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent {
  return { key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods };
}

describe("keyToBinding", () => {
  it("normalizes space and lowercases printable keys", () => {
    expect(keyToBinding(event(" "))).toBe("Space");
    expect(keyToBinding(event("K"))).toBe("k");
  });

  it("keeps named keys as-is", () => {
    expect(keyToBinding(event("ArrowLeft"))).toBe("ArrowLeft");
  });

  it("prefixes modifiers in a fixed order", () => {
    expect(keyToBinding(event("p", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+p");
    expect(keyToBinding(event("ArrowRight", { altKey: true, shiftKey: true }))).toBe(
      "Alt+Shift+ArrowRight"
    );
    expect(keyToBinding(event("k", { metaKey: true, ctrlKey: true }))).toBe("Ctrl+Meta+k");
  });

  it("ignores modifier-only keys and Esc", () => {
    expect(keyToBinding(event("Shift", { shiftKey: true }))).toBeNull();
    expect(keyToBinding(event("Escape"))).toBeNull();
  });
});

describe("matchesBinding / matchShortcut", () => {
  it("matches case-insensitively through normalization", () => {
    expect(matchesBinding(event("K"), "k")).toBe(true);
    expect(matchesBinding(event("j"), "k")).toBe(false);
  });

  it("finds the action bound to an event", () => {
    expect(matchShortcut(DEFAULT_SHORTCUTS, event(" "))).toBe("playPause");
    expect(matchShortcut(DEFAULT_SHORTCUTS, event("e"))).toBe("next");
    expect(matchShortcut(DEFAULT_SHORTCUTS, event("z"))).toBeNull();
    expect(matchShortcut(DEFAULT_SHORTCUTS, event("Escape"))).toBeNull();
  });
});

describe("formatBinding", () => {
  it("labels modifiers and special keys", () => {
    expect(formatBinding("Space")).toBe("Space");
    expect(formatBinding("ArrowLeft")).toBe("←");
    expect(formatBinding("k")).toBe("K");
    expect(formatBinding("Ctrl+p")).toBe("Ctrl + P");
    expect(formatBinding("Alt+Shift+ArrowRight")).toBe("Alt + Shift + →");
  });

  it("handles a literal plus key without splitting it away", () => {
    expect(formatBinding("+")).toBe("+");
  });
});

describe("assignShortcut", () => {
  it("appends when index is null and replaces when index is given", () => {
    const appended = assignShortcut(DEFAULT_SHORTCUTS, "playPause", "j");
    expect(appended.ok && appended.shortcuts.playPause).toEqual(["Space", "k", "j"]);

    const replaced = assignShortcut(DEFAULT_SHORTCUTS, "playPause", "j", 1);
    expect(replaced.ok && replaced.shortcuts.playPause).toEqual(["Space", "j"]);
  });

  it("rejects conflicts with another action and leaves the map untouched", () => {
    const result = assignShortcut(DEFAULT_SHORTCUTS, "next", "q");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflict?.action).toBe("prev");
    expect(DEFAULT_SHORTCUTS.next).toEqual(["e"]);
  });

  it("rejects duplicates inside the same action", () => {
    const result = assignShortcut(DEFAULT_SHORTCUTS, "playPause", "k");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflict?.action).toBe("playPause");
  });

  it("rejects empty bindings", () => {
    expect(assignShortcut(DEFAULT_SHORTCUTS, "next", "  ").ok).toBe(false);
  });
});

describe("removeShortcut", () => {
  it("removes only the requested index and allows an empty list", () => {
    expect(removeShortcut(DEFAULT_SHORTCUTS, "playPause", 0).playPause).toEqual(["k"]);
    expect(removeShortcut({ ...DEFAULT_SHORTCUTS, mute: ["m"] }, "mute", 0).mute).toEqual([]);
  });
});

describe("findShortcutConflict", () => {
  it("ignores the slot being edited", () => {
    expect(findShortcutConflict(DEFAULT_SHORTCUTS, "playPause", "Space", 0)).toBeNull();
    expect(findShortcutConflict(DEFAULT_SHORTCUTS, "playPause", "Space", 1)?.action).toBe(
      "playPause"
    );
  });
});

describe("sanitizeShortcuts", () => {
  it("falls back to defaults for missing or malformed entries", () => {
    expect(sanitizeShortcuts(undefined)).toEqual(DEFAULT_SHORTCUTS);
    expect(sanitizeShortcuts({ next: "e" }).next).toEqual(["e"]);
    expect(sanitizeShortcuts({ mute: [] }).mute).toEqual([]);
  });

  it("drops invalid and duplicate bindings, keeping the first occurrence", () => {
    const cleaned = sanitizeShortcuts({
      prev: ["q", "q", "", "   ", "x".repeat(40)],
      next: ["q", "e"],
    });
    expect(cleaned.prev).toEqual(["q"]);
    expect(cleaned.next).toEqual(["e"]);
  });

  it("returns a fresh copy so callers cannot mutate the defaults", () => {
    const a = defaultShortcuts();
    a.playPause.push("j");
    expect(DEFAULT_SHORTCUTS.playPause).toEqual(["Space", "k"]);
  });
});
