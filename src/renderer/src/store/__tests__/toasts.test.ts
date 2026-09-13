import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppStore } from "@/test/resetStore";
import { useAppStore } from "../useAppStore";

const toastTexts = (): string[] => useAppStore.getState().toasts.map((t) => t.text);

describe("toasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAppStore();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("stacks messages and removes each one when its own window elapses", () => {
    const { toast } = useAppStore.getState();

    toast("first");
    vi.advanceTimersByTime(1000);
    toast("second");

    expect(toastTexts()).toEqual(["first", "second"]);

    vi.advanceTimersByTime(1600);
    expect(toastTexts()).toEqual(["second"]);

    vi.advanceTimersByTime(1000);
    expect(toastTexts()).toEqual([]);
  });

  it("gives every toast a distinct id, even for the same text", () => {
    const { toast } = useAppStore.getState();

    toast("same");
    toast("same");

    const ids = useAppStore.getState().toasts.map((t) => t.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
