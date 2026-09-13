import { describe, expect, it } from "vitest";
import { IPC_CHANNELS, IPC_EVENTS } from "@shared/ipcChannels";

describe("ipc channel table", () => {
  it("lists every channel exactly once", () => {
    expect(IPC_CHANNELS.length).toBeGreaterThan(0);
    expect(new Set(IPC_CHANNELS).size).toBe(IPC_CHANNELS.length);
  });

  it("names every channel as domain:action", () => {
    for (const channel of IPC_CHANNELS) {
      expect(channel).toMatch(/^[a-z]+:[a-z-]+$/);
    }
  });

  it("keeps push events out of the invoke channel list", () => {
    for (const event of Object.values(IPC_EVENTS)) {
      expect(IPC_CHANNELS).not.toContain(event);
    }
  });
});
