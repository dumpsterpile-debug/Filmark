import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileUp,
  FolderOpen,
  FolderSearch,
  Image,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { shortPath } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import SettingsNav, { type SettingsSection } from "@/components/SettingsNav";
import ShortcutSettings from "@/components/ShortcutSettings";
import LanguageSwitch from "@/components/LanguageSwitch";
import ToastHost from "@/components/ToastHost";
import ImportPreviewModal from "@/components/ImportPreviewModal";
import type { TranslationKey } from "@/i18n";
import { Video } from "@shared/types";

const ERROR_KEYS: Record<string, TranslationKey> = {
  E_PATH_NOT_FOUND: "settings.errorPathNotFound",
  E_NO_JSON: "settings.errorNoJson",
  E_PARSE_FAILED: "settings.errorParseFailed",
};

export default function SettingsPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [section, setSection] = useState<SettingsSection>("data-source");

  const metadataPath = useAppStore((s) => s.metadataPath);
  const metadataFileCount = useAppStore((s) => s.metadataFileCount);
  const defaultMetadataPath = useAppStore((s) => s.defaultMetadataPath);
  const loadError = useAppStore((s) => s.loadError);
  const loadErrorCode = useAppStore((s) => s.loadErrorCode);
  const chooseDefaultSource = useAppStore((s) => s.chooseDefaultSource);
  const resetDefaultSource = useAppStore((s) => s.resetDefaultSource);
  const startImport = useAppStore((s) => s.startImport);
  const importsList = useAppStore((s) => s.importsList);
  const removeImport = useAppStore((s) => s.removeImport);
  const clearImports = useAppStore((s) => s.clearImports);
  const videos = useAppStore((s) => s.videos);
  const toast = useAppStore((s) => s.toast);
  const defaultWebUrl = useAppStore((s) => s.defaultWebUrl);
  const setDefaultWebUrl = useAppStore((s) => s.setDefaultWebUrl);
  const resetDefaultWebUrl = useAppStore((s) => s.resetDefaultWebUrl);
  const downloadPath = useAppStore((s) => s.downloadPath);
  const setDownloadPath = useAppStore((s) => s.setDownloadPath);
  const resetDownloadPath = useAppStore((s) => s.resetDownloadPath);
  const siteExtractEnabled = useAppStore((s) => s.siteExtractEnabled);
  const setSiteExtractEnabled = useAppStore((s) => s.setSiteExtractEnabled);
  const [webUrlDraft, setWebUrlDraft] = useState(defaultWebUrl);
  const [systemDownloads, setSystemDownloads] = useState("");
  const resumePlayback = useAppStore((s) => s.resumePlayback);
  const setResumePlayback = useAppStore((s) => s.setResumePlayback);

  useEffect(() => {
    setWebUrlDraft(defaultWebUrl);
  }, [defaultWebUrl]);

  useEffect(() => {
    void window.api?.getDownloadsDir().then((dir) => {
      setSystemDownloads(dir);
    });
  }, []);

  const errorKey = loadErrorCode ? ERROR_KEYS[loadErrorCode] : undefined;

  return (
    <div className="settings-page">
      <div className="settings-topbar">
        <button className="tool-btn" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          {t("settings.backHome")}
        </button>
        <div className="settings-title">{t("settings.title")}</div>
        <LanguageSwitch />
      </div>

      <div className="settings-layout">
        <SettingsNav active={section} onChange={setSection} />

        <div className="settings-content">
          {section === "data-source" && (
            <section className="settings-section">
              <h2 className="settings-section-title">{t("settings.navDataSource")}</h2>

              <div className="settings-row">
                <span className="settings-label">{t("settings.currentSource")}</span>
                <span className="settings-value" title={metadataPath}>
                  {metadataPath
                    ? metadataFileCount > 1
                      ? t("settings.sourceFiles", {
                          path: shortPath(metadataPath),
                          count: metadataFileCount,
                        })
                      : shortPath(metadataPath)
                    : t("settings.currentSourceNone")}
                </span>
              </div>

              <div className="settings-row">
                <span className="settings-label">{t("settings.defaultPath")}</span>
                <span className="settings-value" title={defaultMetadataPath}>
                  {defaultMetadataPath
                    ? shortPath(defaultMetadataPath)
                    : t("settings.defaultPathNone")}
                </span>
              </div>

              <div className="settings-actions">
                <button className="tool-btn primary" onClick={() => void chooseDefaultSource()}>
                  <FolderOpen size={16} />
                  {t("settings.choosePath")}
                </button>
                <button className="tool-btn" onClick={() => void resetDefaultSource()}>
                  <RotateCcw size={16} />
                  {t("settings.resetDefault")}
                </button>
                <button className="tool-btn" onClick={() => void startImport()}>
                  <FileUp size={16} />
                  {t("toolbar.import")}
                </button>
              </div>

              <div className="settings-actions">
                <button
                  className="tool-btn"
                  onClick={() => {
                    const missing = videos.filter((v: Video) => v.file && !v.thumbnail);
                    if (missing.length === 0) {
                      toast(t("toast.thumbnailsNoneMissing"));
                      return;
                    }
                    let done = 0;
                    toast(t("toast.thumbnailsBatch", { total: missing.length, done: 0 }));
                    for (const v of missing) {
                      void window.api?.generateThumbnail(v.file).then((r) => {
                        done += 1;
                        toast(
                          t("toast.thumbnailsBatch", {
                            total: missing.length,
                            done,
                          })
                        );
                        void r;
                      });
                    }
                  }}
                  title={t("settings.generateThumbnailsTitle")}
                >
                  <Image size={16} />
                  {t("settings.generateThumbnails")}
                </button>
              </div>

              <div className="settings-row import-list-row">
                <span className="settings-label">{t("settings.importedTitle")}</span>
                <div className="settings-value">
                  {importsList.length === 0 ? (
                    <span className="settings-placeholder">{t("settings.importedNone")}</span>
                  ) : (
                    <ul className="import-list">
                      {importsList.map(
                        (item: { id: string; path: string; importedAt: string; count: number }) => (
                          <li key={item.id} className="import-list-item">
                            <span className="import-list-path" title={item.path}>
                              {item.path}
                            </span>
                            <span className="import-list-meta">
                              {t("settings.importedCount", { count: item.count })} ·{" "}
                              {new Date(item.importedAt).toLocaleString()}
                            </span>
                            <button
                              className="tool-btn danger import-list-remove"
                              onClick={() => void removeImport(item.id)}
                              title={t("settings.removeImport")}
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        )
                      )}
                    </ul>
                  )}
                  {importsList.length > 0 && (
                    <button className="tool-btn danger" onClick={() => void clearImports()}>
                      <X size={14} />
                      {t("settings.clearImports")}
                    </button>
                  )}
                </div>
              </div>

              {loadError && (
                <div className="settings-error">
                  <p>{errorKey ? t(errorKey) : loadError}</p>
                  <div className="settings-error-actions">
                    {loadErrorCode !== "E_PATH_NOT_FOUND" && metadataPath && (
                      <button
                        className="tool-btn"
                        onClick={() => void window.api?.openInFolder(metadataPath)}
                      >
                        <FolderSearch size={14} />
                        {t("settings.openFolder")}
                      </button>
                    )}
                    <button className="tool-btn" onClick={() => void chooseDefaultSource()}>
                      {t("settings.reselect")}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {section === "browser" && (
            <section className="settings-section">
              <h2 className="settings-section-title">{t("settings.navBrowser")}</h2>

              <div className="settings-row">
                <span className="settings-label">{t("settings.browserDefaultUrl")}</span>
                <div className="settings-value">
                  <div className="settings-input-row">
                    <input
                      className="settings-input"
                      value={webUrlDraft}
                      onChange={(e) => setWebUrlDraft(e.target.value)}
                      placeholder="https://example.com"
                      spellCheck={false}
                    />
                    <button
                      className="tool-btn primary"
                      onClick={() => setDefaultWebUrl(webUrlDraft)}
                    >
                      <Save size={14} />
                      {t("common.save")}
                    </button>
                    <button className="tool-btn" onClick={resetDefaultWebUrl}>
                      <RotateCcw size={14} />
                      {t("settings.resetDefault")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="settings-row">
                <span className="settings-label">{t("settings.browserDownloadDir")}</span>
                <div className="settings-value">
                  <span className="settings-value-line" title={downloadPath || systemDownloads}>
                    {downloadPath
                      ? shortPath(downloadPath)
                      : systemDownloads
                        ? shortPath(systemDownloads)
                        : t("settings.browserDownloadDirNone")}
                  </span>
                  <div className="settings-input-row">
                    <button
                      className="tool-btn"
                      onClick={() =>
                        void window.api?.chooseDownloadDir().then((dir) => {
                          if (dir) setDownloadPath(dir);
                        })
                      }
                    >
                      <FolderOpen size={14} />
                      {t("settings.chooseDownloadDir")}
                    </button>
                    <button className="tool-btn" onClick={resetDownloadPath}>
                      <RotateCcw size={14} />
                      {t("settings.resetDefault")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="settings-row">
                <span className="settings-label">{t("settings.siteExtract")}</span>
                <div className="settings-value">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={siteExtractEnabled}
                      onChange={(e) => setSiteExtractEnabled(e.target.checked)}
                    />
                    <span>{t("settings.siteExtractOn")}</span>
                  </label>
                  <span className="settings-hint">{t("settings.siteExtractHint")}</span>
                </div>
              </div>
            </section>
          )}

          {section === "playback" && (
            <section className="settings-section">
              <h2 className="settings-section-title">{t("settings.navPlayback")}</h2>

              <div className="settings-row">
                <span className="settings-label">{t("settings.resumePlayback")}</span>
                <div className="settings-value">
                  <button
                    className={resumePlayback ? "tool-btn active" : "tool-btn"}
                    onClick={() => setResumePlayback(!resumePlayback)}
                  >
                    {resumePlayback ? t("common.enabled") : t("common.disabled")}
                  </button>
                </div>
              </div>

              <div className="settings-row">
                <span className="settings-label">{t("settings.codecSupport")}</span>
                <div className="settings-value">
                  <span className="settings-value-line">{t("settings.codecSupportDesc")}</span>
                </div>
              </div>
            </section>
          )}

          {section === "shortcuts" && <ShortcutSettings />}
        </div>
      </div>

      <ToastHost />
      <ImportPreviewModal />
    </div>
  );
}
