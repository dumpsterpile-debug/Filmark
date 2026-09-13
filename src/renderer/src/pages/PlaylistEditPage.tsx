import { useNavigate } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, GripVertical, Play, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Video } from "@shared/types";
import { formatDuration } from "@/lib/format";
import { mediaUrl } from "@/lib/mediaUrl";
import { useAppStore } from "@/store/useAppStore";
import ToastHost from "@/components/ToastHost";
import LanguageSwitch from "@/components/LanguageSwitch";
import VirtualList, { ROW_HEIGHT } from "@/components/VirtualList";

function SortableRow({
  video,
  index,
  active,
  offsetY,
  onRemove,
}: {
  video: Video;
  index: number;
  active: boolean;
  offsetY: number;
  onRemove: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: video.id,
  });
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "edit-row dragging" : "edit-row"}
      style={{
        top: offsetY,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <button className="drag-handle" {...attributes} {...listeners} title={t("edit.dragTitle")}>
        <GripVertical size={18} />
      </button>
      <span className="row-index">{index + 1}</span>
      <div className="row-thumb">
        {video.thumbnail ? (
          <img src={mediaUrl(video.thumbnail)} loading="lazy" alt="" draggable={false} />
        ) : (
          <div className="row-thumb-placeholder" />
        )}
        <span className="duration-badge">{formatDuration(video.durationMs)}</span>
      </div>
      <div className="row-info">
        <div className="row-title" title={video.title}>
          {video.title}
        </div>
        <div className="row-artist">
          {[video.artist.join(", "), video.character.join(", "), video.genre]
            .filter(Boolean)
            .join(" · ") || t("common.unknownArtist")}
        </div>
      </div>
      {active && <span className="playing-badge">{t("common.playing")}</span>}
      <button className="row-remove" onClick={onRemove} title={t("edit.removeTitle")}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export default function PlaylistEditPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const playlist = useAppStore((s) => s.playlist);
  const currentVideoId = useAppStore((s) => s.currentVideoId);
  const reorderPlaylist = useAppStore((s) => s.reorderPlaylist);
  const removeFromPlaylist = useAppStore((s) => s.removeFromPlaylist);
  const clearPlaylist = useAppStore((s) => s.clearPlaylist);
  const setCurrentVideoId = useAppStore((s) => s.setCurrentVideoId);
  const toast = useAppStore((s) => s.toast);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const from = playlist.findIndex((v: Video) => v.id === active.id);
      const to = playlist.findIndex((v: Video) => v.id === over.id);
      if (from >= 0 && to >= 0) reorderPlaylist(from, to);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!window.api) {
      toast(t("toast.cannotSave"));
      return;
    }
    const result = await window.api.savePlaylist(playlist);
    toast(
      result.ok
        ? t("toast.playlistSaved", { count: playlist.length })
        : t("toast.saveFailed", { error: result.error ?? "" })
    );
  };

  const handlePlay = (): void => {
    if (playlist.length === 0) {
      toast(t("toast.emptyPlaylist"));
      return;
    }
    const first = playlist[0];
    if (!first) return;
    setCurrentVideoId(first.id);
    void navigate("/watch");
  };

  return (
    <div className="edit-page">
      <div className="edit-header">
        <button className="tool-btn" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          {t("edit.backHome")}
        </button>
        <div className="edit-title">
          <h1>{t("edit.title")}</h1>
          <span className="edit-count">{t("edit.count", { count: playlist.length })}</span>
        </div>
        <div className="edit-actions">
          <LanguageSwitch />
          <button
            className="tool-btn danger"
            onClick={() => {
              clearPlaylist();
              toast(t("toast.playlistCleared"));
            }}
          >
            {t("common.clear")}
          </button>
          <button className="tool-btn" onClick={() => void handleSave()}>
            <Save size={16} />
            {t("common.save")}
          </button>
          <button className="tool-btn primary" onClick={handlePlay}>
            <Play size={16} />
            {t("edit.playPlaylist")}
          </button>
        </div>
      </div>

      {playlist.length === 0 ? (
        <div className="state-block">
          <p>{t("edit.empty")}</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={playlist.map((v: Video) => v.id)}
            strategy={verticalListSortingStrategy}
          >
            <VirtualList
              total={playlist.length}
              renderRow={(i) => {
                const v = playlist[i];
                if (!v) return null;
                return (
                  <SortableRow
                    key={v.id}
                    video={v}
                    index={i}
                    active={v.id === currentVideoId}
                    offsetY={i * ROW_HEIGHT}
                    onRemove={() => removeFromPlaylist(v.id)}
                  />
                );
              }}
            />
          </SortableContext>
        </DndContext>
      )}

      <div className="edit-hint">{t("edit.hint")}</div>
      <ToastHost />
    </div>
  );
}
