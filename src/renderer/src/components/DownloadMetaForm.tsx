import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buildFacets } from "@/lib/search";
import { scrapePage } from "@/lib/pageScraper";
import {
  parseDownloadFilename,
  mergeScrapedPage,
  scrapeToMeta,
  type DownloadMeta,
} from "@shared/download";
import { useAppStore } from "@/store/useAppStore";
import ChipInput from "@/components/ChipInput";

export default function DownloadMetaForm({
  webview,
}: {
  webview: { executeJavaScript: (code: string) => Promise<unknown> } | null;
}): JSX.Element | null {
  const { t } = useTranslation();
  const request = useAppStore((s) => s.downloadRequest);
  const videos = useAppStore((s) => s.videos);
  const userChips = useAppStore((s) => s.userChips);
  const confirmDownload = useAppStore((s) => s.confirmDownload);
  const cancelDownload = useAppStore((s) => s.cancelDownload);
  const savePerArtistPrefs = useAppStore((s) => s.savePerArtistPrefs);
  const addUserChip = useAppStore((s) => s.addUserChip);
  const [meta, setMeta] = useState<DownloadMeta | null>(null);

  const facets = useMemo(() => buildFacets(videos), [videos]);
  const candidates = useMemo(
    () => ({
      tags: [...facets.tags.map((f) => f.name), ...userChips.tags],
      artist: [...facets.artists.map((f) => f.name), ...userChips.artist],
      character: [...facets.characters.map((f) => f.name), ...userChips.character],
      genre: [...facets.genres.map((f) => f.name), ...userChips.genre],
    }),
    [facets, userChips]
  );

  useEffect(() => {
    if (!request) {
      setMeta(null);
      return;
    }
    const downloadId = request.downloadId;
    const state = useAppStore.getState();
    const prefs = state.perArtistPrefs;
    // 提取面板已经扫过同一页：它的结果优先于本组件再抓一遍页面
    const media = state.extractResult;
    const prefilled = scrapeToMeta({
      scraped: {
        artist: [],
        tags: [],
        title: "",
        videoId: "",
        url: "",
        fileName: request.fileName,
        extension: "",
        posterStyle: "",
      },
      request,
      prefs: undefined,
    });
    setMeta(prefilled);
    if (webview) {
      void scrapePage(webview).then((scraped) => {
        // 用户可能已经取消 / 换了一次下载，别用旧结果覆盖新表单
        if (useAppStore.getState().downloadRequest?.downloadId !== downloadId) return;
        const page = mergeScrapedPage(scraped, media);
        const parsed = parseDownloadFilename(
          request.url,
          page.url || request.url,
          request.fileName,
          page.title
        );
        const next = scrapeToMeta({
          scraped: { ...page, fileName: parsed.fileName, extension: parsed.extension },
          request,
          prefs: prefs[page.artist[0] ?? ""] ?? undefined,
        });
        setMeta(next);
      });
    }
  }, [request, webview]);

  if (!request || !meta) return null;

  const setField = (patch: Partial<DownloadMeta>): void => {
    setMeta((m) => (m ? { ...m, ...patch } : m));
  };

  const submit = (): void => {
    const primaryArtist = meta.artist[0] ?? "";
    if (primaryArtist) {
      savePerArtistPrefs(primaryArtist, { genre: meta.genre, character: meta.character[0] ?? "" });
    }
    for (const [kind, values] of Object.entries({
      tags: meta.tags,
      artist: meta.artist,
      character: meta.character,
      genre: meta.genre ? [meta.genre] : [],
    })) {
      for (const value of values) {
        addUserChip(kind as "tags" | "artist" | "character" | "genre", value);
      }
    }
    void confirmDownload(meta);
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancelDownload();
      }}
    >
      <div className="modal-card download-meta-card">
        <h3 className="modal-title">
          <Download size={16} />
          {t("download.metaTitle")}
        </h3>
        <p className="download-meta-file" title={request.url}>
          {request.fileName}
        </p>

        <div className="download-meta-field">
          <label>{t("download.title")}</label>
          <input value={meta.title} onChange={(e) => setField({ title: e.target.value })} />
        </div>

        <div className="download-meta-field">
          <label>{t("download.artist")}</label>
          <ChipInput
            values={meta.artist}
            candidates={candidates.artist}
            multi
            onChange={(artist) => setField({ artist })}
            onCreate={(v) => addUserChip("artist", v)}
          />
        </div>

        <div className="download-meta-field">
          <label>{t("download.tags")}</label>
          <ChipInput
            values={meta.tags}
            candidates={candidates.tags}
            multi
            onChange={(tags) => setField({ tags })}
            onCreate={(v) => addUserChip("tags", v)}
          />
        </div>

        <div className="download-meta-field">
          <label>{t("download.genre")}</label>
          <ChipInput
            values={meta.genre ? [meta.genre] : []}
            candidates={candidates.genre}
            multi={false}
            onChange={(genre) => setField({ genre: genre[0] ?? "" })}
            onCreate={(v) => addUserChip("genre", v)}
          />
        </div>

        <div className="download-meta-field">
          <label>{t("download.character")}</label>
          <ChipInput
            values={meta.character}
            candidates={candidates.character}
            multi
            onChange={(character) => setField({ character })}
            onCreate={(v) => addUserChip("character", v)}
          />
        </div>

        <div className="download-meta-field">
          <label>{t("download.fileName")}</label>
          <input value={meta.file_name} onChange={(e) => setField({ file_name: e.target.value })} />
          <span className="download-meta-ext">.{meta.extension || meta.file_extension}</span>
        </div>

        <div className="modal-actions">
          <button className="tool-btn" onClick={cancelDownload}>
            <X size={15} />
            {t("download.cancel")}
          </button>
          <button className="tool-btn primary" onClick={submit}>
            <Download size={15} />
            {t("download.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
