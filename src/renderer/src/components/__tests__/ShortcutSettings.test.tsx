import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import ShortcutSettings from "@/components/ShortcutSettings";
import { useAppStore } from "@/store/useAppStore";
import { defaultShortcuts } from "@shared/shortcuts";

beforeAll(async () => {
  // 固定语言，断言使用 en.json 中的已知字面量
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  useAppStore.setState({
    shortcuts: defaultShortcuts(),
    shortcutsEnabled: true,
    toasts: [],
  });
});

describe("ShortcutSettings", () => {
  it("rebinds an action when a new key is pressed", async () => {
    const user = userEvent.setup();
    render(<ShortcutSettings />);

    await user.click(screen.getByRole("button", { name: "Q" }));
    expect(screen.getByRole("button", { name: "Press a key…" })).toBeInTheDocument();

    await user.keyboard("j");

    expect(useAppStore.getState().shortcuts.prev).toEqual(["j"]);
    expect(screen.getByRole("button", { name: "J" })).toBeInTheDocument();
  });

  it("rejects a key that is already taken and keeps the old binding", async () => {
    const user = userEvent.setup();
    render(<ShortcutSettings />);

    await user.click(screen.getByRole("button", { name: "Q" }));
    // E 默认属于「下一个视频」
    await user.keyboard("e");

    expect(useAppStore.getState().shortcuts.prev).toEqual(["q"]);
    expect(useAppStore.getState().toasts.at(-1)?.text).toContain("already used by");
  });

  it("cancels recording on Escape without changing the binding", async () => {
    const user = userEvent.setup();
    render(<ShortcutSettings />);

    await user.click(screen.getByRole("button", { name: "Q" }));
    await user.keyboard("{Escape}");

    expect(useAppStore.getState().shortcuts.prev).toEqual(["q"]);
    expect(screen.queryByRole("button", { name: "Press a key…" })).not.toBeInTheDocument();
  });

  it("appends an extra key to an action", async () => {
    const user = userEvent.setup();
    render(<ShortcutSettings />);

    const addButton = screen.getAllByTitle("Add another key")[0];
    if (!addButton) throw new Error("no add button rendered");
    await user.click(addButton);
    await user.keyboard("j");

    expect(useAppStore.getState().shortcuts.playPause).toEqual(["Space", "k", "j"]);
  });

  it("restores every action to its defaults", async () => {
    const user = userEvent.setup();
    useAppStore.setState({ shortcuts: { ...defaultShortcuts(), next: ["x"] } });
    render(<ShortcutSettings />);

    await user.click(screen.getByRole("button", { name: "Reset all" }));

    expect(useAppStore.getState().shortcuts).toEqual(defaultShortcuts());
  });

  it("toggles the master switch", async () => {
    const user = userEvent.setup();
    render(<ShortcutSettings />);

    await user.click(screen.getByRole("button", { name: "On" }));

    expect(useAppStore.getState().shortcutsEnabled).toBe(false);
  });
});
