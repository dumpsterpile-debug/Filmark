declare module "react-player" {
  import type { Component, RefObject } from "react";

  export interface OnProgressProps {
    played: number;
    playedSeconds: number;
    loaded: number;
    loadedSeconds: number;
  }

  export interface ReactPlayerProps {
    url?: string | null;
    playing?: boolean;
    volume?: number;
    muted?: boolean;
    controls?: boolean;
    width?: string | number;
    height?: string | number;
    progressInterval?: number;
    onReady?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onBuffer?: () => void;
    onBufferEnd?: () => void;
    onProgress?: (state: OnProgressProps) => void;
    onDuration?: (duration: number) => void;
    onEnded?: () => void;
    onError?: (error: unknown) => void;
    config?: Record<string, unknown>;
  }

  export default class ReactPlayer extends Component<ReactPlayerProps> {
    seekTo(amount: number, type?: "seconds" | "fraction" | "time"): void;
    getCurrentTime(): number;
    getDuration(): number;
  }

  export type ReactPlayerRef = ReactPlayer;
}
