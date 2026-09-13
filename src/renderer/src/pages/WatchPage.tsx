import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ListMusic, Pencil, Plus, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDate, formatDuration } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import Player, { type PlayerHandle } from "@/components/Player";
import PlaylistPanel from "@/components/PlaylistPanel";
import ToastHost from "@/components/ToastHost";
import { EditMetadataModal } from "@/components/EditMetadataModal";
import LanguageSwitch from "@/components/LanguageSwitch";
import { shouldResume } from "@shared/playback";
import { matchShortcut, type ShortcutAction } from "@shared/shortcuts";
import { Video } from "@shared/types";

export default function WatchPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videos = useAppStore((s) => s.videos);
  const playlist = useAppStore((s) => s.playlist);
  const currentVideoId = useAppStore((s) => s.currentVideoId);
  const setCurrentVideoId = useAppStore((s) => s.setCurrentVideoId);
  const setPlaylist = useAppStore((s) => s.setPlaylist);
  const addToPlaylist = useAppStore((s) => s.addToPlaylist);
  const toast = useAppStore((s) => s.toast);
  const autoplay = useAppStore((s) => s.autoplay);
  const theater = useAppStore((s) => s.theaterMode);
  const volume = useAppStore((s) => s.volume);
  const muted = useAppStore((s) => s.muted);
  const setAutoplay = useAppStore((s) => s.setAutoplay);
  const setTheaterMode = useAppStore((s) => s.setTheaterMode);
  const setVolume = useAppStore((s) => s.setVolume);
  const setMuted = useAppStore((s) => s.setMuted);
  const resumePlayback = useAppStore((s) => s.resumePlayback);
  const shortcuts = useAppStore((s) => s.shortcuts);
  const shortcutsEnabled = useAppStore((s) => s.shortcutsEnabled);
  const playerRef = useRef<PlayerHandle>(null);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);

  const video =
    (currentVideoId ? videos.find((v: Video) => v.id === currentVideoId) : undefined) ??
    playlist.find((v: Video) => v.id === currentVideoId);
  const currentIndex = playlist.findIndex((v: Video) => v.id === currentVideoId);

  const playAt = useCallback(
    (index: number) => {
      const v = playlist[index];
      if (v) setCurrentVideoId(v.id);
    },
    [playlist, setCurrentVideoId]
  );

  const playNext = useCallback(() => {
    const idx = playlist.findIndex((v: Video) => v.id === currentVideoId);
    if (idx >= 0 && idx < playlist.length - 1) playAt(idx + 1);
  }, [playlist, currentVideoId, playAt]);

  const playPrev = useCallback(() => {
    const idx = playlist.findIndex((v: Video) => v.id === currentVideoId);
    if (idx > 0) {
      playAt(idx - 1);
    } else {
      playerRef.current?.seekBy(-99999);
    }
  }, [playlist, currentVideoId, playAt]);

  useEffect(() => {
    setResumeAt(null);
    setDuration(0);
    if (!resumePlayback || !video?.file) return;
    void window.api?.loadPlaybackProgress().then((result) => {
      const saved = result.ok ? result.progress[video.file] : undefined;
      if (saved && saved > 5) setResumeAt(saved);
    });
  }, [video?.id, video?.file, resumePlayback]);

  useEffect(() => {
    if (resumeAt != null && duration > 0 && !shouldResume(resumeAt, duration)) {
      setResumeAt(null);
    }
  }, [resumeAt, duration]);

  const runShortcut = useCallback(
    (action: ShortcutAction) => {
      const state = useAppStore.getState();
      switch (action) {
        case "playPause":
          playerRef.current?.togglePlay();
          break;
        case "seekBack":
          playerRef.current?.seekBy(-5);
          break;
        case "seekForward":
          playerRef.current?.seekBy(5);
          break;
        case "prev":
          playPrev();
          break;
        case "next":
          playNext();
          break;
        case "theater":
          state.setTheaterMode(!state.theaterMode);
          break;
        case "fullscreen":
          playerRef.current?.toggleFullscreen();
          break;
        case "volumeUp":
          state.setVolume(state.volume + 0.05);
          break;
        case "volumeDown":
          state.setVolume(state.volume - 0.05);
          break;
        case "mute":
          state.setMuted(!state.muted);
          break;
        default:
          break;
      }
    },
    [playNext, playPrev]
  );

  useEffect(() => {
    if (!shortcutsEnabled) return;
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)
      )
        return;
      const action = matchShortcut(shortcuts, e);
      if (!action) return;
      e.preventDefault();
      runShortcut(action);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts, shortcutsEnabled, runShortcut]);

  if (!video) {
    return <Navigate to="/" replace />;
  }

  const clickTag = (tag: string): void => {
    const list = videos.filter((v: Video) => v.tags.includes(tag));
    if (list.length === 0) return;
    setPlaylist(list);
    toast(t("watch.tagPlaylistToast", { tag, count: list.length }));
  };

  return (
    <div className="watch-page">
      <div className="watch-topbar">
        <button className="tool-btn" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          {t("watch.back")}
        </button>
        <div className="watch-topbar-title" title={video.title}>
          {video.title}
        </div>
        <div className="watch-topbar-actions">
          <LanguageSwitch />
          <button
            className="tool-btn"
            onClick={() => navigate("/settings")}
            title={t("settings.title")}
          >
            <Settings size={16} />
          </button>
          <button className="tool-btn" onClick={() => addToPlaylist([video])}>
            <Plus size={16} />
            {t("watch.addToPlaylist")}
          </button>
          <button className="tool-btn primary" onClick={() => navigate("/playlist")}>
            <ListMusic size={16} />
            {t("watch.openPlaylist")}
          </button>
        </div>
      </div>

      <div className={theater ? "watch-layout theater" : "watch-layout"}>
        <div className="player-col">
          {resumeAt != null && (
            <div className="resume-bar">
              <span>{t("watch.resumePrompt", { time: formatDuration(resumeAt * 1000) })}</span>
              <button
                className="tool-btn primary"
                onClick={() => {
                  playerRef.current?.seekTo(resumeAt);
                  setResumeAt(null);
                }}
              >
                {t("watch.resumeContinue")}
              </button>
              <button className="tool-btn" onClick={() => setResumeAt(null)}>
                {t("watch.resumeFromStart")}
              </button>
              <button className="tool-btn" onClick={() => setResumeAt(null)}>
                {t("watch.resumeDismiss")}
              </button>
            </div>
          )}
          <Player
            ref={playerRef}
            video={video}
            autoplay={autoplay}
            theater={theater}
            volume={volume}
            muted={muted}
            canPrev={currentIndex > 0}
            canNext={currentIndex >= 0 && currentIndex < playlist.length - 1}
            onPrev={playPrev}
            onNext={playNext}
            onToggleAutoplay={() => setAutoplay(!autoplay)}
            onToggleTheater={() => setTheaterMode(!theater)}
            onVolumeChange={setVolume}
            onToggleVolume={() => setMuted(!muted)}
            onDurationChange={setDuration}
          />

          <div className="watch-meta">
            <h1 className="watch-title">{video.title}</h1>
            <div className="watch-subtitle">
              {[video.artist.join(", "), video.character.join(", "), video.genre]
                .filter(Boolean)
                .join(" · ") || t("common.unknownArtist")}
              {video.created && <span className="watch-date">{formatDate(video.created)}</span>}
            </div>
            {video.tags.length > 0 && (
              <div className="watch-tags">
                {video.tags.map((tag: string) => (
                  <button key={tag} className="chip" onClick={() => clickTag(tag)}>
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <button
              className="btn btn-secondary watch-edit-btn"
              onClick={() => useAppStore.getState().setEditingVideo(video)}
            >
              <Pencil size={16} />
              {t("edit.metaTitle")}
            </button>
          </div>
        </div>

        <aside className="playlist-col">
          <PlaylistPanel />
        </aside>
      </div>

      <ToastHost />
      <EditMetadataModal />
    </div>
  );
}
