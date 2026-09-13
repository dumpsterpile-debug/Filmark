import type { Video } from "@shared/types";
import { useAppStore } from "@/store/useAppStore";
import VideoCard from "./VideoCard";

export default function VideoGrid({ items }: { items: Video[] }): JSX.Element {
  const thumbSize = useAppStore((s) => s.thumbSize);
  return (
    <div className={`video-grid size-${thumbSize}`}>
      {items.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  );
}
