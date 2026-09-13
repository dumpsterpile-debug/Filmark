/// <reference types="vite/client" />

import type { MediaApi } from "@shared/types";

declare global {
  interface Window {
    api: MediaApi;
  }
}

export {};
