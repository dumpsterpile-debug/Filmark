import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, FolderSearch, Play, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Video } from "@shared/types";
import { formatDuration } from "@/lib/format";
import { mediaUrl } from "@/lib/mediaUrl";
import { useAppStore } from "@/store/useAppStore";

export default function VideoCard({ video }: { video: Video }): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const multiSelectMode = useAppStore((s) => s.multiSelectMode);
  const selected = useAppStore((s) => s.selectedIds.includes(video.id));
  const toggleSelected = useAppStore((s) => s.toggleSelected);
  const addToPlaylist = useAppStore((s) => s.addToPlaylist);
  const playVideo = useAppStore((s) => s.playVideo);
  const loadMetadata = useAppStore((s) => s.loadMetadata);
  const [imgError, setImgError] = useState(false);
  const unplayable = video.playable === false;

  const thumb = video.thumbnail ? mediaUrl(video.thumbnail) : "";
  const subtitle = [video.artist.join(", "), video.character.join(", "), video.genre]
    .filter(Boolean)
    .join(" · ");

  const handlePlay = (): void => {
    playVideo(video);
    void navigate("/watch");
  };

  return (
    <div
      className={selected ? "video-card selected" : "video-card"}
      data-testid="video-card"
      onDoubleClick={handlePlay}
      title={t("card.doubleClickPlay", { title: video.title })}
    >
      <div className="thumb-wrap">
        {thumb && !imgError ? (
          <img
            src={thumb}
            loading="lazy"
            alt=""
            draggable={false}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="thumb-placeholder">
            <Play size={30} />
          </div>
        )}
        <span className="duration-badge">{formatDuration(video.durationMs)}</span>
        {unplayable && <span className="unplayable-badge">{t("card.unplayable")}</span>}
        {multiSelectMode && (
          <button
            className={selected ? "select-box selected" : "select-box"}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelected(video.id);
            }}
            title={selected ? t("card.deselect") : t("card.select")}
          >
            {selected && <Check size={14} />}
          </button>
        )}
      </div>

      <div className="card-body">
        <div className="card-title" title={video.title} onClick={handlePlay}>
          {video.title}
        </div>
        <div className="card-artist" title={subtitle}>
          {subtitle || t("common.unknownArtist")}
        </div>
      </div>

      <button
        className="card-add"
        title={t("card.addToPlaylist")}
        onClick={(e) => {
          e.stopPropagation();
          addToPlaylist([video]);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Plus size={18} />
      </button>

      {unplayable && (
        <button
          className="card-relocate"
          title={t("card.relocate")}
          onClick={(e) => {
            e.stopPropagation();
            void window.api?.relocateFile(video.id, video.title).then((path) => {
              if (path) void loadMetadata();
            });
          }}
        >
          <FolderSearch size={14} />
          {t("card.relocate")}
        </button>
      )}
    </div>
  );
}
