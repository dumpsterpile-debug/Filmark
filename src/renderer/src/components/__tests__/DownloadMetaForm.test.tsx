import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ExtractResult } from "@shared/siteAdapters";
import i18n from "@/i18n";
import { resetAppStore } from "@/test/resetStore";
import DownloadMetaForm from "@/components/DownloadMetaForm";

const PAGE_URL = "https://www.pornhub.com/view_video.php?viewkey=abc";
const MEDIA_URL = "https://ev-h.phncdn.com/videos/abc/1080P_4000K_1.mp4";

const SCRAPED = {
  artist: [],
  tags: [],
  title: "Scraped Title",
  videoId: "abc",
  url: PAGE_URL,
  fileName: "",
  extension: "",
  posterStyle: "",
};

const EXTRACTED: ExtractResult = {
  adapterId: "pornhub",
  pageUrl: PAGE_URL,
  title: "PH Title",
  tags: ["tag one"],
  poster: "https://ci.phncdn.com/videos/abc/1.jpg",
  sources: [],
};

function makeWebview(): { executeJavaScript: (code: string) => Promise<unknown> } {
  return { executeJavaScript: vi.fn().mockResolvedValue(SCRAPED) };
}

/** 表单没有 label/for 关联，按字段标题定位输入框 */
function fieldInput(label: string): HTMLInputElement {
  const input = screen.getByText(label).parentElement?.querySelector("input");
  if (!input) throw new Error(`no input for field ${label}`);
  return input;
}

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

describe("DownloadMetaForm", () => {
  it("prefills from the extraction result the panel already produced", async () => {
    resetAppStore({
      downloadRequest: { downloadId: 1, fileName: "1080P_4000K_1.mp4", url: MEDIA_URL },
      extractResult: EXTRACTED,
    });
    render(<DownloadMetaForm webview={makeWebview()} />);

    await waitFor(() => {
      expect(fieldInput("Title").value).toBe("PH Title");
    });
    expect(fieldInput("Tags").value).toBe("");
    expect(screen.getByText("tag one")).toBeInTheDocument();
    // 文件名取标题（用户脚本 sanitizeTitle() 的等价物），而不是 CDN 的 1080P_4000K_1
    expect(fieldInput("File name").value).toBe("PH Title");
    expect(screen.getByText(".mp4")).toBeInTheDocument();
  });

  it("falls back to the scraped page when the panel produced no extraction", async () => {
    resetAppStore({
      downloadRequest: { downloadId: 1, fileName: "1080P_4000K_1.mp4", url: MEDIA_URL },
      extractResult: null,
    });
    render(<DownloadMetaForm webview={makeWebview()} />);

    await waitFor(() => {
      expect(fieldInput("Title").value).toBe("Scraped Title");
    });
    // 标题来源换了一处，但「标题优先于 CDN 文件名」的规则不变
    expect(fieldInput("File name").value).toBe("Scraped Title");
  });

  it("renders nothing without a pending download request", () => {
    resetAppStore();
    const { container } = render(<DownloadMetaForm webview={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
