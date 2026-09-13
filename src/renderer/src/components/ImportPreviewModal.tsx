import { useState } from "react";
import { ChevronDown, ChevronRight, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/useAppStore";

export default function ImportPreviewModal(): JSX.Element | null {
  const { t } = useTranslation();
  const preview = useAppStore((s) => s.importPreview);
  const confirmImport = useAppStore((s) => s.confirmImport);
  const cancelImport = useAppStore((s) => s.cancelImport);
  const [showFailed, setShowFailed] = useState(false);

  if (!preview) return null;

  const hasFailed = preview.failedFiles.length > 0;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancelImport();
      }}
    >
      <div className="modal-card">
        <h3 className="modal-title">
          <Upload size={16} />
          {t("import.previewTitle")}
        </h3>

        <p className="import-summary">
          {t("import.summary", {
            count: preview.newCount,
            skipped: preview.duplicateCount,
            failed: preview.failedFiles.length,
          })}
        </p>

        {preview.samples.length > 0 && (
          <div className="import-samples">
            <div className="import-subtitle">{t("import.samples")}</div>
            <ul>
              {preview.samples.map((s, i) => (
                <li key={i}>
                  <span className="import-sample-title">{s.title || s.file}</span>
                  {s.artist.length > 0 && (
                    <span className="import-sample-artist">{s.artist.join(", ")}</span>
                  )}
                  <span className="import-sample-file">{s.file}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasFailed && (
          <div className="import-failed">
            <button className="import-failed-toggle" onClick={() => setShowFailed((v) => !v)}>
              {showFailed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {t("import.failed", { count: preview.failedFiles.length })}
            </button>
            {showFailed && (
              <ul>
                {preview.failedFiles.map((f, i) => (
                  <li key={i}>
                    <span className="import-failed-path">{f.path}</span>
                    <span className="import-failed-error">{f.error}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="tool-btn" onClick={cancelImport}>
            {t("import.cancel")}
          </button>
          <button className="tool-btn primary" onClick={() => void confirmImport()}>
            <Upload size={15} />
            {t("import.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
