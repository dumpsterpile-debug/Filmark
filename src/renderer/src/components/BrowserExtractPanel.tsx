import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ExtractAdapter, ExtractResult, ExtractedSource } from "@shared/siteAdapters";
import { runExtraction } from "@/lib/siteExtractor";
import { useAppStore } from "@/store/useAppStore";

/** webview 元素中本组件需要用到的最小接口 */
export interface ExtractTarget {
  executeJavaScript: (code: string) => Promise<unknown>;
  getWebContentsId: () => number;
}

interface BrowserExtractPanelProps {
  webview: ExtractTarget | null;
  adapter: ExtractAdapter | null;
  pageUrl: string;
  enabled: boolean;
}

/**
 * 站点媒体提取面板：宿主层渲染（webview 之外），提取逻辑注入访客页执行。
 * 下载统一走既有 will-download 拦截 -> 元数据弹窗 -> 进度条链路；
 * 扫描结果同时写进 store 的 `extractResult`，供元数据弹窗预填（两者共用一次提取）。
 */
export default function BrowserExtractPanel({
  webview,
  adapter,
  pageUrl,
  enabled,
}: BrowserExtractPanelProps): JSX.Element | null {
  const { t } = useTranslation();
  const toast = useAppStore((s) => s.toast);
  const setExtractResult = useAppStore((s) => s.setExtractResult);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  /** 防止旧扫描的结果覆盖新扫描 */
  const requestRef = useRef(0);

  const active = Boolean(enabled && adapter && webview);

  const scan = useCallback(async () => {
    if (!enabled || !adapter || !webview) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    const next = await runExtraction(webview, adapter.strategy, pageUrl);
    if (requestRef.current !== requestId) return;
    setResult(next);
    // 交给元数据弹窗的那一份：页面导航时由下面的 effect 负责清空
    setExtractResult(next);
    setLoading(false);
  }, [adapter, enabled, pageUrl, setExtractResult, webview]);

  useEffect(() => {
    if (!active) {
      requestRef.current += 1;
      setResult(null);
      setLoading(false);
      setExtractResult(null);
      return;
    }
    setResult(null);
    setExtractResult(null);
    void scan();
  }, [active, scan, setExtractResult]);

  /** 离开浏览器页后不该再有「当前页」的提取结果 */
  useEffect(() => () => setExtractResult(null), [setExtractResult]);

  const copyUrl = useCallback(
    async (source: ExtractedSource) => {
      try {
        await navigator.clipboard.writeText(source.url);
        toast(t("browser.extractCopied"));
      } catch {
        toast(t("browser.extractCopyFailed"));
      }
    },
    [t, toast]
  );

  const download = useCallback(
    (source: ExtractedSource) => {
      const webContentsId = webview?.getWebContentsId?.() ?? 0;
      void window.api?.downloadFromWebContents(webContentsId, source.url);
    },
    [webview]
  );

  const openExternal = useCallback((source: ExtractedSource) => {
    void window.api?.openExternal(source.url);
  }, []);

  if (!enabled || !adapter) return null;

  const sources = result?.sources ?? [];
  const canDownload = (source: ExtractedSource): boolean =>
    source.kind === "progressive" && source.headersRequired !== true;

  return (
    <aside className="browser-extract" aria-label={t("browser.extractTitle")}>
      <div className="browser-extract-head">
        <span className="browser-extract-badge">{adapter.label}</span>
        <span className="browser-extract-title" title={result?.title ?? ""}>
          {result?.title || t("browser.extractUntitled")}
        </span>
        {result && <span className="browser-extract-count">({sources.length})</span>}
        <span className="browser-extract-spacer" />
        <button
          className="tool-btn"
          onClick={() => void scan()}
          disabled={loading}
          title={t("browser.extractRescan")}
          aria-label={t("browser.extractRescan")}
        >
          <RefreshCw size={14} />
        </button>
        <button
          className="tool-btn"
          onClick={() => setExpanded((value) => !value)}
          title={expanded ? t("browser.extractCollapse") : t("browser.extractExpand")}
          aria-label={expanded ? t("browser.extractCollapse") : t("browser.extractExpand")}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="browser-extract-body">
          {loading && !result && (
            <p className="browser-extract-state">
              <Loader2 className="spin" size={14} />
              {t("browser.extractLoading")}
            </p>
          )}

          {!loading && !result && (
            <p className="browser-extract-state">{t("browser.extractError")}</p>
          )}

          {result && sources.length === 0 && (
            <p className="browser-extract-state">{t("browser.extractEmpty")}</p>
          )}

          {sources.length > 0 && (
            <ul className="browser-extract-list">
              {sources.map((source) => (
                <li className="browser-extract-row" key={source.url} data-source-url={source.url}>
                  <span className="browser-extract-row-label">
                    {source.label}
                    {source.kind === "hls" && (
                      <span className="browser-extract-tag">{t("browser.extractHls")}</span>
                    )}
                    {source.headersRequired && (
                      <span className="browser-extract-tag">{t("browser.extractHeaders")}</span>
                    )}
                  </span>
                  <span className="browser-extract-url" title={source.url}>
                    {source.url}
                  </span>
                  <span className="browser-extract-row-actions">
                    <button
                      className="tool-btn"
                      onClick={() => void copyUrl(source)}
                      title={t("browser.extractCopy")}
                      aria-label={`${t("browser.extractCopy")} ${source.label}`}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      className="tool-btn"
                      onClick={() => download(source)}
                      disabled={!canDownload(source)}
                      title={
                        canDownload(source)
                          ? t("browser.extractDownload")
                          : t("browser.extractDownloadUnsupported")
                      }
                      aria-label={`${t("browser.extractDownload")} ${source.label}`}
                    >
                      <Download size={13} />
                    </button>
                    <button
                      className="tool-btn"
                      onClick={() => openExternal(source)}
                      title={t("browser.extractOpen")}
                      aria-label={`${t("browser.extractOpen")} ${source.label}`}
                    >
                      <ExternalLink size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {result?.poster && (
            <img
              className="browser-extract-poster"
              src={result.poster}
              alt=""
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>
      )}
    </aside>
  );
}
