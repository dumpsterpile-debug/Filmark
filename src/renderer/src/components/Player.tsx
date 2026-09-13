import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactPlayer from "react-player";
import { useTranslation } from "react-i18next";
import {
  FastForward,
  FolderOpen,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  TvMinimal,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Video } from "@shared/types";
import { formatDuration } from "@/lib/format";
import { mediaUrl } from "@/lib/mediaUrl";
import { useAppStore } from "@/store/useAppStore";
import { isSupportedCodec } from "@shared/codec";
import { formatBinding, type ShortcutAction } from "@shared/shortcuts";

export interface PlayerHandle {
  togglePlay: () => void;
  seekBy: (seconds: number) => void;
  toggleFullscreen: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
}

interface PlayerProps {
  video: Video;
  autoplay: boolean;
  theater: boolean;
  volume: number;
  muted: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoplay: () => void;
  onToggleTheater: () => void;
  onVolumeChange: (v: number) => void;
  onToggleVolume: () => void;
  onDurationChange?: (seconds: number) => void;
}

const Player = forwardRef<PlayerHandle, PlayerProps>(function Player(
  {
    video,
    autoplay,
    theater,
    volume,
    muted,
    canPrev,
    canNext,
    onPrev,
    onNext,
    onToggleAutoplay,
    onToggleTheater,
    onVolumeChange,
    onToggleVolume,
    onDurationChange,
  },
  ref
) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<ReactPlayer | null>(null);
  const [playing, setPlaying] = useState(true);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [errorKind, setErrorKind] = useState<"missing" | "unsupported" | "unknown" | null>(null);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumePlayback = useAppStore((s) => s.resumePlayback);
  const shortcuts = useAppStore((s) => s.shortcuts);

  /** 首帧到达前用本地缩略图当原生 poster，避免播放器整块纯黑（流行播放器的通行做法） */
  const poster = video.thumbnail ? mediaUrl(video.thumbnail) : "";
  const playerConfig = useMemo(
    () => ({ file: { attributes: poster ? { poster } : {} } }),
    [poster]
  );

  /** 把当前配置的首个绑定附在提示文案后，保持 tooltip 与实际快捷键一致 */
  const hint = useCallback(
    (action: ShortcutAction): string => {
      const first = shortcuts[action]?.[0];
      return first ? ` (${formatBinding(first)})` : "";
    },
    [shortcuts]
  );

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  const seekBy = useCallback(
    (seconds: number) => {
      const current = playerRef.current?.getCurrentTime() ?? playedSeconds;
      const target = Math.min(Math.max(0, current + seconds), duration || current);
      playerRef.current?.seekTo(target);
      setPlayedSeconds(target);
    },
    [playedSeconds, duration]
  );

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setPlayedSeconds(seconds);
  }, []);

  const getCurrentTime = useCallback(
    () => playerRef.current?.getCurrentTime() ?? playedSeconds,
    [playedSeconds]
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void wrapperRef.current?.requestFullscreen().catch(() => undefined);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({ togglePlay, seekBy, toggleFullscreen, seekTo, getCurrentTime }),
    [togglePlay, seekBy, toggleFullscreen, seekTo, getCurrentTime]
  );

  useEffect(() => {
    const onFullscreenChange = (): void => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    setPlaying(true);
    setError(false);
    setErrorKind(null);
    setPlayedSeconds(0);
    setDuration(0);
    setBuffered(0);
    setReady(false);
    setBuffering(false);
  }, [video.id, attempt]);

  useEffect(() => {
    if (!resumePlayback || !video.file) return;
    const report = (): void => {
      const seconds = playerRef.current?.getCurrentTime() ?? 0;
      if (seconds > 0) {
        void window.api?.savePlaybackProgress({ [video.file]: seconds });
      }
    };
    const timer = setInterval(report, 5000);
    return () => {
      clearInterval(timer);
      report();
    };
  }, [resumePlayback, video.id, video.file]);

  useEffect(() => {
    if (!error || !video.file) return;
    void window.api?.probeFile(video.file).then((result) => {
      if (!result.ok && result.error === "not-found") {
        setErrorKind("missing");
      } else if (result.ok && result.codec && !isSupportedCodec(result.codec)) {
        setErrorKind("unsupported");
      } else {
        setErrorKind("unknown");
      }
    });
  }, [error, video.file]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setPlaying((p) => {
        if (p) setControlsVisible(false);
        return p;
      });
    }, 3000);
  }, []);

  useEffect(() => {
    showControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [playing, video.id, showControls]);

  const handleEnded = (): void => {
    if (autoplay && canNext) {
      onNext();
    } else {
      setPlaying(false);
      showControls();
    }
  };

  const playedPct = duration > 0 ? (playedSeconds / duration) * 100 : 0;
  const progressStyle = {
    "--played": `${playedPct}%`,
    "--loaded": `${buffered * 100}%`,
  } as React.CSSProperties;

  /** 全屏且控件已隐藏时藏光标，避免指针停在画面上（YouTube / Plex 行为） */
  const playerClassName = [
    "player",
    fullscreen && "fullscreen",
    fullscreen && !controlsVisible && "hide-cursor",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={wrapperRef}
      className={playerClassName}
      onMouseMove={showControls}
      onClick={togglePlay}
      onDoubleClick={toggleFullscreen}
    >
      <ReactPlayer
        key={`${video.id}-${attempt}`}
        ref={playerRef}
        url={mediaUrl(video.file)}
        playing={playing}
        volume={volume}
        muted={muted}
        controls={false}
        width="100%"
        height="100%"
        progressInterval={250}
        config={playerConfig}
        onReady={() => {
          setReady(true);
          setPlaying(true);
        }}
        onPlay={() => setPlaying(true)}
        onBuffer={() => setBuffering(true)}
        onBufferEnd={() => setBuffering(false)}
        onPause={() => {
          setPlaying(false);
          if (resumePlayback && video.file) {
            const seconds = playerRef.current?.getCurrentTime() ?? 0;
            if (seconds > 0) void window.api?.savePlaybackProgress({ [video.file]: seconds });
          }
        }}
        onProgress={(state) => {
          setPlayedSeconds(state.playedSeconds);
          setBuffered(state.loaded);
        }}
        onDuration={(d) => {
          setDuration(d);
          onDurationChange?.(d);
        }}
        onEnded={handleEnded}
        onError={() => {
          setError(true);
          setPlaying(false);
          setBuffering(false);
        }}
      />

      {!error && playing && (!ready || buffering) && (
        <div className="player-spinner" role="status" aria-label={t("player.buffering")} />
      )}

      {error ? (
        <div className="player-error">
          <div className="player-error-title">
            {errorKind === "missing"
              ? t("player.loadFailed")
              : errorKind === "unsupported"
                ? t("player.codecUnsupported")
                : t("player.loadFailed")}
          </div>
          <div className="player-error-path">{video.file || video.title}</div>
          {errorKind === "unsupported" && (
            <div className="player-error-hint">{t("player.codecHint")}</div>
          )}
          <div className="player-error-actions">
            {errorKind !== "missing" && (
              <button
                className="tool-btn primary"
                onClick={(e) => {
                  e.stopPropagation();
                  void window.api?.openInFolder(video.file);
                }}
              >
                <FolderOpen size={15} />
                {t("player.openFolder")}
              </button>
            )}
            <button
              className="tool-btn"
              onClick={(e) => {
                e.stopPropagation();
                setAttempt((n) => n + 1);
              }}
            >
              <RotateCcw size={15} />
              {t("common.retry")}
            </button>
          </div>
        </div>
      ) : (
        !playing && (
          <button
            className="big-play"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            title={`${t("player.playHint")}${hint("playPause")}`}
          >
            <Play size={34} fill="currentColor" />
          </button>
        )
      )}

      {!error && (
        <div
          className={controlsVisible ? "player-controls" : "player-controls hidden"}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            className="progress-slider"
            type="range"
            min={0}
            max={duration || 0}
            step={0.05}
            value={Math.min(playedSeconds, duration || 0)}
            disabled={!duration}
            style={progressStyle}
            onChange={(e) => {
              const t = Number(e.target.value);
              playerRef.current?.seekTo(t);
              setPlayedSeconds(t);
            }}
            aria-label={t("player.progressLabel")}
          />
          <div className="controls-row">
            <div className="controls-group">
              <button
                className="icon-btn"
                disabled={!canPrev}
                onClick={onPrev}
                title={`${t("player.prev")}${hint("prev")}`}
              >
                <SkipBack size={20} fill="currentColor" />
              </button>
              <button
                className="icon-btn"
                onClick={() => seekBy(-5)}
                title={`${t("player.back5")}${hint("seekBack")}`}
              >
                <FastForward size={20} style={{ transform: "scaleX(-1)" }} />
              </button>
              <button
                className="icon-btn primary"
                onClick={togglePlay}
                title={`${t("player.playPause")}${hint("playPause")}`}
              >
                {playing ? (
                  <Pause size={22} fill="currentColor" />
                ) : (
                  <Play size={22} fill="currentColor" />
                )}
              </button>
              <button
                className="icon-btn"
                onClick={() => seekBy(5)}
                title={`${t("player.forward5")}${hint("seekForward")}`}
              >
                <FastForward size={20} />
              </button>
              <button
                className="icon-btn"
                disabled={!canNext}
                onClick={onNext}
                title={`${t("player.next")}${hint("next")}`}
              >
                <SkipForward size={20} fill="currentColor" />
              </button>
            </div>

            <div className="controls-group volume-group">
              <button
                className="icon-btn"
                onClick={onToggleVolume}
                title={`${t("player.mute")}${hint("mute")}`}
              >
                {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                className="volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                aria-label={t("player.volumeLabel")}
              />
            </div>

            <span className="time-label">
              {formatDuration(playedSeconds * 1000)} / {formatDuration(duration * 1000)}
            </span>

            <div className="controls-group right">
              <button
                className={autoplay ? "switch on" : "switch"}
                role="switch"
                aria-checked={autoplay}
                onClick={onToggleAutoplay}
                title={t("player.autoplayTitle")}
              >
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-knob" aria-hidden="true" />
                </span>
                <span className="switch-text">{t("player.autoplay")}</span>
              </button>
              <button
                className={theater ? "icon-btn on" : "icon-btn"}
                aria-pressed={theater}
                onClick={onToggleTheater}
                title={`${t("player.theaterTitle")}${hint("theater")}`}
              >
                <TvMinimal size={20} />
              </button>
              <button
                className="icon-btn"
                onClick={toggleFullscreen}
                title={`${t("player.fullscreenTitle")}${hint("fullscreen")}`}
              >
                {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default Player;
