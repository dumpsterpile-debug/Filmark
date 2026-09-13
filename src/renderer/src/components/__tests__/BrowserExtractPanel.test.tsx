import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { matchExtractAdapter } from "@shared/siteAdapters";
import i18n from "@/i18n";
import BrowserExtractPanel from "@/components/BrowserExtractPanel";
import { useAppStore } from "@/store/useAppStore";

const genericAdapter = matchExtractAdapter("https://spankbang.com/abc/video/x");

const PAYLOAD = {
  adapterId: "generic",
  pageUrl: "https://spankbang.com/abc/video/x",
  title: "Panel Title",
  tags: [],
  sources: [
    {
      url: "https://cdn.example/a-1080p.mp4",
      kind: "progressive",
      label: "1080p MP4",
      quality: "1080p",
    },
    { url: "https://cdn.example/b.m3u8", kind: "hls", label: "HLS stream" },
  ],
};

function makeWebview(payload: unknown) {
  return {
    executeJavaScript: vi.fn().mockResolvedValue(payload),
    getWebContentsId: vi.fn().mockReturnValue(42),
  };
}

const writeText = vi.fn().mockResolvedValue(undefined);
const downloadFromWebContents = vi.fn().mockResolvedValue(undefined);
const openExternal = vi.fn().mockResolvedValue(undefined);

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  writeText.mockClear();
  downloadFromWebContents.mockClear();
  openExternal.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  Object.defineProperty(window, "api", {
    value: { downloadFromWebContents, openExternal },
    configurable: true,
    writable: true,
  });
  useAppStore.setState({ toasts: [] });
});

function renderPanel(
  overrides: Partial<{
    webview: ReturnType<typeof makeWebview> | null;
    adapter: typeof genericAdapter;
    pageUrl: string;
    enabled: boolean;
  }> = {}
) {
  return render(
    <BrowserExtractPanel
      webview={overrides.webview === undefined ? makeWebview(PAYLOAD) : overrides.webview}
      adapter={overrides.adapter === undefined ? genericAdapter : overrides.adapter}
      pageUrl={overrides.pageUrl ?? PAYLOAD.pageUrl}
      enabled={overrides.enabled ?? true}
    />
  );
}

describe("BrowserExtractPanel", () => {
  it("renders the page title and each extracted source", async () => {
    renderPanel();

    expect(await screen.findByText("Panel Title")).toBeInTheDocument();
    expect(await screen.findByText("1080p MP4")).toBeInTheDocument();
    expect(screen.getByText("HLS stream")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("copies, downloads and opens a progressive source", async () => {
    renderPanel();
    const row = (await screen.findByText("1080p MP4")).closest(
      ".browser-extract-row"
    ) as HTMLElement;

    fireEvent.click(within(row).getByRole("button", { name: "Copy link 1080p MP4" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://cdn.example/a-1080p.mp4");
    });

    fireEvent.click(within(row).getByRole("button", { name: "Download 1080p MP4" }));
    await waitFor(() => {
      expect(downloadFromWebContents).toHaveBeenCalledWith(42, "https://cdn.example/a-1080p.mp4");
    });

    fireEvent.click(within(row).getByRole("button", { name: "Open in system browser 1080p MP4" }));
    expect(openExternal).toHaveBeenCalledWith("https://cdn.example/a-1080p.mp4");
  });

  it("disables download for HLS sources", async () => {
    renderPanel();
    const row = (await screen.findByText("HLS stream")).closest(
      ".browser-extract-row"
    ) as HTMLElement;

    expect(within(row).getByRole("button", { name: "Download HLS stream" })).toBeDisabled();
    // 复制/外部打开仍可用
    expect(within(row).getByRole("button", { name: "Copy link HLS stream" })).toBeEnabled();
  });

  it("reports an empty page once scanning settles", async () => {
    renderPanel({ webview: makeWebview({ title: "Empty", tags: [], sources: [] }) });

    expect(
      await screen.findByText("No downloadable media found on this page.", {}, { timeout: 4500 })
    ).toBeInTheDocument();
  }, 10_000);

  it("renders nothing when disabled or without an adapter", () => {
    const { container } = renderPanel({ enabled: false });
    expect(container).toBeEmptyDOMElement();

    const second = renderPanel({ adapter: null });
    expect(second.container).toBeEmptyDOMElement();
  });
});
