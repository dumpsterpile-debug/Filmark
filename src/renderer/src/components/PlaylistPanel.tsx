import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ListMusic, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDuration } from "@/lib/format";
import { mediaUrl } from "@/lib/mediaUrl";
import {
  comparePlaylist,
  PLAYLIST_SORT_CYCLE,
  PLAYLIST_SORT_LABELS,
  type PlaylistSortMode,
} from "@/lib/playlistSort";
import { useAppStore } from "@/store/useAppStore";

const ROW_HEIGHT = 88;
const OVERSCAN = 4;

export default function PlaylistPanel(): JSX.Element {
  const { t } = useTranslation();
  const playlist = useAppStore((s) => s.playlist);
  const videos = useAppStore((s) => s.videos);
  const currentVideoId = useAppStore((s) => s.currentVideoId);
  const setCurrentVideoId = useAppStore((s) => s.setCurrentVideoId);
  const setPlaylist = useAppStore((s) => s.setPlaylist);
  const toast = useAppStore((s) => s.toast);

  const [sortMode, setSortMode] = useState<PlaylistSortMode>("duration-asc");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(360);
  const [filterArtists, setFilterArtists] = useState<string[]>([]);
  const [filterCharacters, setFilterCharacters] = useState<string[]>([]);
  const [filterGenres, setFilterGenres] = useState<string[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);

  const current = playlist.find((v) => v.id === currentVideoId);

  // Extract unique facet values for filter chips
  const uniqueArtists = useMemo(
    () => [...new Set(playlist.flatMap((v) => v.artist))].sort(),
    [playlist]
  );
  const uniqueCharacters = useMemo(
    () => [...new Set(playlist.flatMap((v) => v.character))].sort(),
    [playlist]
  );
  const uniqueGenres = useMemo(
    () => [...new Set(playlist.map((v) => v.genre).filter(Boolean))].sort(),
    [playlist]
  );

  // Apply active filters
  const filteredPlaylist = useMemo(() => {
    if (filterArtists.length === 0 && filterCharacters.length === 0 && filterGenres.length === 0)
      return playlist;
    return playlist.filter((v) => {
      if (filterArtists.length > 0 && !filterArtists.some((a) => v.artist.includes(a)))
        return false;
      if (filterCharacters.length > 0 && !filterCharacters.some((c) => v.character.includes(c)))
        return false;
      if (filterGenres.length > 0 && !filterGenres.includes(v.genre)) return false;
      return true;
    });
  }, [playlist, filterArtists, filterCharacters, filterGenres]);

  function toggleFilter(value: string, current: string[], setter: (next: string[]) => void): void {
    setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setViewportHeight(el.clientHeight);
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visible = useMemo(() => {
    const list = filteredPlaylist;
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(
      list.length,
      Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN
    );
    return { start, end };
  }, [scrollTop, viewportHeight, filteredPlaylist.length]);

  const cycleSort = (): void => {
    const index = PLAYLIST_SORT_CYCLE.indexOf(sortMode);
    const candidate = PLAYLIST_SORT_CYCLE[(index + 1) % PLAYLIST_SORT_CYCLE.length];
    const fallback: PlaylistSortMode = "duration-asc";
    const next: PlaylistSortMode = candidate ?? fallback;
    const sorted = [...playlist].sort((a, b) => comparePlaylist(a, b, next));
    setPlaylist(sorted);
    setSortMode(next);
  };

  const playAt = (index: number): void => {
    const v = filteredPlaylist[index];
    if (v) setCurrentVideoId(v.id);
  };

  const clickTag = (tag: string): void => {
    const list = videos.filter((v) => v.tags.includes(tag));
    if (list.length === 0) return;
    setPlaylist(list);
    toast(t("watch.tagPlaylistToast", { tag, count: list.length }));
  };

  return (
    <section className="playlist-panel">
      <div className="playlist-header">
        <div className="playlist-title">
          <ListMusic size={17} />
          {t("watch.playlist")}
          <span className="badge">{playlist.length}</span>
        </div>
        <button className="tool-btn" onClick={cycleSort} title={t("watch.sortTitle")}>
          <ArrowDownUp size={15} />
          {t(PLAYLIST_SORT_LABELS[sortMode])}
        </button>
      </div>

      {current && current.tags.length > 0 && (
        <div className="playlist-tags">
          {current.tags.slice(0, 10).map((tag) => (
            <button
              key={tag}
              className="chip"
              onClick={() => clickTag(tag)}
              title={t("watch.tagPlaylistTitle")}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Playlist filter chips */}
      {uniqueArtists.length > 1 && (
        <div className="playlist-filters">
          <span className="filter-label">{t("playlist.filterArtist")}</span>
          {uniqueArtists.map((a) => (
            <button
              key={a}
              className={`chip ${filterArtists.includes(a) ? "active" : ""}`}
              onClick={() => toggleFilter(a, filterArtists, setFilterArtists)}
            >
              {a}
            </button>
          ))}
        </div>
      )}
      {uniqueCharacters.length > 1 && (
        <div className="playlist-filters">
          <span className="filter-label">{t("playlist.filterCharacter")}</span>
          {uniqueCharacters.map((c) => (
            <button
              key={c}
              className={`chip ${filterCharacters.includes(c) ? "active" : ""}`}
              onClick={() => toggleFilter(c, filterCharacters, setFilterCharacters)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {uniqueGenres.length > 1 && (
        <div className="playlist-filters">
          <span className="filter-label">{t("playlist.filterGenre")}</span>
          {uniqueGenres.map((g) => (
            <button
              key={g}
              className={`chip ${filterGenres.includes(g) ? "active" : ""}`}
              onClick={() => toggleFilter(g, filterGenres, setFilterGenres)}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {filteredPlaylist.length === 0 && playlist.length > 0 ? (
        <div className="playlist-empty">{t("watch.emptyPlaylist")}</div>
      ) : playlist.length === 0 ? (
        <div className="playlist-empty">{t("watch.emptyPlaylist")}</div>
      ) : (
        <div
          className="playlist-viewport"
          ref={viewportRef}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div className="playlist-spacer" style={{ height: filteredPlaylist.length * ROW_HEIGHT }}>
            {filteredPlaylist.slice(visible.start, visible.end).map((v, i) => {
              const index = visible.start + i;
              const active = v.id === currentVideoId;
              return (
                <div
                  key={v.id}
                  className={active ? "playlist-row active" : "playlist-row"}
                  style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
                  onClick={() => playAt(index)}
                  title={t("watch.clickToPlay")}
                >
                  <div className="row-thumb">
                    {v.thumbnail ? (
                      <img src={mediaUrl(v.thumbnail)} loading="lazy" alt="" draggable={false} />
                    ) : (
                      <div className="row-thumb-placeholder" />
                    )}
                    <span className="duration-badge">{formatDuration(v.durationMs)}</span>
                    {active && (
                      <span className="now-playing">
                        <Play size={12} fill="currentColor" />
                      </span>
                    )}
                  </div>
                  <div className="row-info">
                    <div className="row-title" title={v.title}>
                      {v.title}
                    </div>
                    <div className="row-artist">
                      {[v.artist.join(", "), v.character.join(", "), v.genre]
                        .filter(Boolean)
                        .join(" · ") || t("common.unknownArtist")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
