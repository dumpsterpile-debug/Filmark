import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import HomePage from "@/pages/HomePage";
import WatchPage from "@/pages/WatchPage";
import PlaylistEditPage from "@/pages/PlaylistEditPage";
import SettingsPage from "@/pages/SettingsPage";
import BrowserPage from "@/pages/BrowserPage";

export default function App(): JSX.Element {
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/watch" element={<WatchPage />} />
        <Route path="/playlist" element={<PlaylistEditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/browser" element={<BrowserPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
