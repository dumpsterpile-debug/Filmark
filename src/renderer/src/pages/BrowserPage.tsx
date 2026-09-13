import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CornerUpLeft,
  CornerUpRight,
  Globe,
  Home,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { isValidHttpUrl, normalizeWebUrl } from "@shared/browser";
import { defaultBrowserPolicy } from "@shared/browserPolicy";
import { matchExtractAdapter } from "@shared/siteAdapters";
import { useAppStore } from "@/store/useAppStore";
import LanguageSwitch from "@/components/LanguageSwitch";
import ToastHost from "@/components/ToastHost";
import DownloadMetaForm from "@/components/DownloadMetaForm";
import BrowserExtractPanel from "@/components/BrowserExtractPanel";

/** 不内置默认站点：未配置时留空，等待用户输入 */
const DEFAULT_WEB_URL = "";
const browserPolicy = defaultBrowserPolicy();

interface WebviewElement extends HTMLElement {
  loadURL: (url: string) => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getURL: () => string;
  executeJavaScript: (code: string) => Promise<unknown>;
  getWebContentsId: () => number;
}

interface NewWindowEvent extends Event {
  url: string;
}

export default function BrowserPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const defaultWebUrl = useAppStore((s) => s.defaultWebUrl);
  const siteExtractEnabled = useAppStore((s) => s.siteExtractEnabled);
  const toast = useAppStore((s) => s.toast);
  const downloadProgress = useAppStore((s) => s.downloadProgress);
  const cancelDownload = useAppStore((s) => s.cancelDownload);
  const [address, setAddress] = useState(() => normalizeWebUrl(defaultWebUrl, DEFAULT_WEB_URL));
  const webviewRef = useRef<WebviewElement | null>(null);
  const [formWebview, setFormWebview] = useState<WebviewElement | null>(null);
  /** 未配置默认网页时留空 -> webview 不挂 src，等用户输入 */
  const initialUrl = normalizeWebUrl(defaultWebUrl, DEFAULT_WEB_URL);
  /** 当前地址命中的「可提取」站点；iwara 等仅登记域名策略的站点不渲染面板 */
  const adapter = useMemo(() => matchExtractAdapter(address), [address]);
  const webviewProps = {
    allowpopups: "true" as unknown as boolean,
  };

  const attachWebview = useCallback((el: HTMLElement | null) => {
    const webview = el as WebviewElement | null;
    webviewRef.current = webview;
    setFormWebview(webview);
    if (!webview) return;
    webview.addEventListener("did-navigate", (() => {
      setAddress(webview.getURL());
    }) as EventListener);
    webview.addEventListener("did-navigate-in-page", (() => {
      setAddress(webview.getURL());
    }) as EventListener);
    webview.addEventListener("new-window", ((e: Event) => {
      const event = e as NewWindowEvent;
      e.preventDefault();
      console.log("[browser] new-window:", event.url);
      if (browserPolicy.decideDownload(event.url).action === "intercept") {
        const webContentsId =
          typeof webview.getWebContentsId === "function" ? webview.getWebContentsId() : 0;
        void window.api?.downloadFromWebContents(webContentsId, event.url);
      } else if (browserPolicy.decideExternal(event.url).action === "allow") {
        void window.api?.openExternal(event.url);
      }
    }) as EventListener);
    webview.addEventListener("will-navigate", ((e: Event) => {
      const event = e as NewWindowEvent;
      if (browserPolicy.decideDownload(event.url).action === "intercept") {
        e.preventDefault();
        const webContentsId =
          typeof webview.getWebContentsId === "function" ? webview.getWebContentsId() : 0;
        void window.api?.downloadFromWebContents(webContentsId, event.url);
      }
    }) as EventListener);
  }, []);

  const go = (url: string): void => {
    if (!isValidHttpUrl(url)) {
      toast(t("browser.invalidUrl"));
      return;
    }
    setAddress(url.trim());
    void webviewRef.current?.loadURL(url.trim());
  };

  const goHome = (): void => {
    const home = normalizeWebUrl(defaultWebUrl, DEFAULT_WEB_URL);
    if (!home) {
      toast(t("browser.noDefaultPage"));
      return;
    }
    go(home);
  };

  return (
    <div className="browser-page">
      <div className="browser-topbar">
        <button className="tool-btn" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          {t("browser.backHome")}
        </button>

        <div className="browser-nav">
          <button
            className="tool-btn"
            onClick={() => webviewRef.current?.goBack()}
            title={t("browser.back")}
          >
            <CornerUpLeft size={16} />
          </button>
          <button
            className="tool-btn"
            onClick={() => webviewRef.current?.goForward()}
            title={t("browser.forward")}
          >
            <CornerUpRight size={16} />
          </button>
          <button
            className="tool-btn"
            onClick={() => webviewRef.current?.reload()}
            title={t("browser.reload")}
          >
            <RefreshCw size={16} />
          </button>
          <button className="tool-btn" onClick={goHome} title={t("browser.home")}>
            <Home size={16} />
          </button>
        </div>

        <form
          className="browser-address"
          onSubmit={(e) => {
            e.preventDefault();
            go(address);
          }}
        >
          <Globe size={15} />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("browser.addressPlaceholder")}
            spellCheck={false}
          />
          <button className="tool-btn" type="submit" title={t("browser.go")}>
            <Search size={15} />
          </button>
        </form>

        <LanguageSwitch />
      </div>

      <div className="browser-viewport">
        <webview
          ref={attachWebview}
          {...(initialUrl ? { src: initialUrl } : {})}
          partition="persist:browser"
          {...webviewProps}
        />
        <BrowserExtractPanel
          webview={formWebview}
          adapter={adapter}
          pageUrl={address}
          enabled={siteExtractEnabled}
        />
      </div>

      {downloadProgress && downloadProgress.state === "progressing" && (
        <div className="download-progress-bar">
          <span className="download-progress-name">{downloadProgress.fileName}</span>
          <div className="download-progress-track">
            <div
              className="download-progress-fill"
              style={{
                width:
                  downloadProgress.totalBytes > 0
                    ? `${Math.min(100, (downloadProgress.receivedBytes / downloadProgress.totalBytes) * 100)}%`
                    : "4%",
              }}
            />
          </div>
          <button className="tool-btn" onClick={cancelDownload} title={t("download.cancel")}>
            <X size={14} />
          </button>
        </div>
      )}

      <DownloadMetaForm webview={formWebview} />
      <ToastHost />
    </div>
  );
}
