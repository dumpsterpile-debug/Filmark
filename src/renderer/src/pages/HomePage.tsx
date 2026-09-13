import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, ListPlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { selectVisible } from "@/lib/search";
import { useAppStore, useCriteria } from "@/store/useAppStore";
import SearchBar from "@/components/SearchBar";
import Toolbar from "@/components/Toolbar";
import VideoGrid from "@/components/VideoGrid";
import Pagination from "@/components/Pagination";
import ToastHost from "@/components/ToastHost";
import ImportPreviewModal from "@/components/ImportPreviewModal";

export default function HomePage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videos = useAppStore((s) => s.videos);
  const loading = useAppStore((s) => s.loading);
  const loadError = useAppStore((s) => s.loadError);
  const loadErrorCode = useAppStore((s) => s.loadErrorCode);
  const loadMetadata = useAppStore((s) => s.loadMetadata);
  const chooseMetadata = useAppStore((s) => s.chooseMetadata);
  const page = useAppStore((s) => s.page);
  const pageSize = useAppStore((s) => s.pageSize);
  const setPage = useAppStore((s) => s.setPage);
  const setPageSize = useAppStore((s) => s.setPageSize);
  const multiSelectMode = useAppStore((s) => s.multiSelectMode);
  const selectedIds = useAppStore((s) => s.selectedIds);
  const setSelectedIds = useAppStore((s) => s.setSelectedIds);
  const toggleMultiSelect = useAppStore((s) => s.toggleMultiSelect);
  const addSelectedToPlaylist = useAppStore((s) => s.addSelectedToPlaylist);
  const criteria = useCriteria();

  const filtered = useMemo(() => selectVisible(videos, criteria), [videos, criteria]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  const selectAllPage = (): void => {
    setSelectedIds(pageItems.map((v) => v.id));
  };

  return (
    <div className="home-page">
      <SearchBar />
      <Toolbar total={filtered.length} onOpenPlaylist={() => navigate("/playlist")} />

      {multiSelectMode && (
        <div className="multi-bar">
          <span className="multi-info">
            {t("home.selectedCount", { count: selectedIds.length })}
          </span>
          <button className="tool-btn" onClick={selectAllPage}>
            <CheckSquare size={15} />
            {t("home.selectPage")}
          </button>
          <button className="tool-btn primary" onClick={addSelectedToPlaylist}>
            <ListPlus size={15} />
            {t("home.addToPlaylist")}
          </button>
          <button className="tool-btn" onClick={toggleMultiSelect}>
            <X size={15} />
            {t("home.cancelMulti")}
          </button>
        </div>
      )}

      {loading ? (
        <div className="state-block">
          <div className="spinner" />
          <p>{t("home.loadingLibrary")}</p>
        </div>
      ) : loadError ? (
        <div className="state-block error">
          <p>{t("home.loadFailed", { error: loadError ?? "" })}</p>
          {(loadErrorCode === "E_NO_JSON" || loadErrorCode === "E_PATH_NOT_FOUND") && (
            <p className="state-hint">{t("home.noMetadataHint")}</p>
          )}
          <div className="state-actions">
            <button className="tool-btn primary" onClick={() => void loadMetadata()}>
              {t("home.retryDefault")}
            </button>
            <button className="tool-btn" onClick={() => void chooseMetadata()}>
              {t("home.chooseOtherJson")}
            </button>
            <button className="tool-btn" onClick={() => navigate("/browser")}>
              {t("home.openBrowser")}
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="state-block">
          <p>{t("home.emptyResults")}</p>
        </div>
      ) : (
        <>
          <VideoGrid items={pageItems} />
          <Pagination
            total={filtered.length}
            page={safePage}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        </>
      )}

      <ToastHost />
      <ImportPreviewModal />
    </div>
  );
}
