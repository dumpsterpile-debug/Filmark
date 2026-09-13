import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  ArrowUpDown,
  FileUp,
  ListMusic,
  ListPlus,
  RotateCw,
  EyeOff,
  SquareCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SORT_LABELS, type SortMode } from "@/lib/search";
import { useAppStore, useCriteria, type ThumbSize } from "@/store/useAppStore";
import type { TranslationKey } from "@/i18n";

const THUMB_OPTIONS: { value: ThumbSize; key: TranslationKey }[] = [
  { value: "small", key: "toolbar.thumbSmall" },
  { value: "medium", key: "toolbar.thumbMedium" },
  { value: "large", key: "toolbar.thumbLarge" },
];

export default function Toolbar({
  total,
  onOpenPlaylist,
}: {
  total: number;
  onOpenPlaylist: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const criteria = useCriteria();
  const setSortMode = useAppStore((s) => s.setSortMode);
  const thumbSize = useAppStore((s) => s.thumbSize);
  const setThumbSize = useAppStore((s) => s.setThumbSize);
  const multiSelectMode = useAppStore((s) => s.multiSelectMode);
  const toggleMultiSelect = useAppStore((s) => s.toggleMultiSelect);
  const selectAllAndPlay = useAppStore((s) => s.selectAllAndPlay);
  const playlistLength = useAppStore((s) => s.playlist.length);
  const startImport = useAppStore((s) => s.startImport);
  const loadMetadata = useAppStore((s) => s.loadMetadata);
  const loading = useAppStore((s) => s.loading);
  const setHideUnplayable = useAppStore((s) => s.setHideUnplayable);
  const navigate = useNavigate();

  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const chooseSort = (m: SortMode): void => {
    setSortMode(m);
    setSortOpen(false);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="result-count">{t("toolbar.resultCount", { count: total })}</span>

        <button
          className="tool-btn"
          onClick={() => void loadMetadata()}
          disabled={loading}
          title={t("toolbar.refreshTitle")}
        >
          <RotateCw size={16} />
          {t("toolbar.refresh")}
        </button>

        <button
          className={multiSelectMode ? "tool-btn active" : "tool-btn"}
          onClick={toggleMultiSelect}
          title={t("toolbar.multiSelectTitle")}
        >
          <SquareCheck size={16} />
          {t("toolbar.multiSelect")}
        </button>

        <button
          className="tool-btn"
          onClick={() => {
            if (selectAllAndPlay()) void navigate("/watch");
          }}
          title={t("toolbar.selectAllPlayTitle")}
        >
          <ListPlus size={16} />
          {t("toolbar.selectAllPlay")}
        </button>

        <button
          className="tool-btn"
          onClick={() => void startImport()}
          title={t("toolbar.importTitle")}
        >
          <FileUp size={16} />
          {t("toolbar.import")}
        </button>

        <button
          className={criteria.hideUnplayable ? "tool-btn active" : "tool-btn"}
          onClick={() => setHideUnplayable(!criteria.hideUnplayable)}
          title={t("toolbar.hideUnplayableTitle")}
        >
          <EyeOff size={16} />
          {t("toolbar.hideUnplayable")}
        </button>

        <div className="sort-wrap" ref={sortRef}>
          <button className="tool-btn" onClick={() => setSortOpen((v) => !v)}>
            {criteria.sort === "none" ? <ArrowUpDown size={16} /> : <ArrowDownUp size={16} />}
            {t(SORT_LABELS[criteria.sort])}
          </button>
          {sortOpen && (
            <div className="sort-menu">
              {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                <button
                  key={m}
                  className={criteria.sort === m ? "sort-option active" : "sort-option"}
                  onClick={() => chooseSort(m)}
                >
                  {t(SORT_LABELS[m])}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="thumb-size">
          <span className="thumb-label">{t("toolbar.thumbSize")}</span>
          <div className="segmented">
            {THUMB_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={thumbSize === opt.value ? "segment active" : "segment"}
                onClick={() => setThumbSize(opt.value)}
              >
                {t(opt.key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="toolbar-right">
        <button className="tool-btn primary" onClick={onOpenPlaylist}>
          <ListMusic size={16} />
          {t("toolbar.openPlaylist")}
          {playlistLength > 0 && <span className="badge">{playlistLength}</span>}
        </button>
      </div>
    </div>
  );
}
