import { useEffect, useState } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SHORTCUT_ACTIONS,
  SHORTCUT_CATEGORIES,
  SHORTCUT_CATEGORY_OF,
  formatBinding,
  keyToBinding,
  type ShortcutAction,
  type ShortcutCategory,
} from "@shared/shortcuts";
import { useAppStore } from "@/store/useAppStore";
import type { TranslationKey } from "@/i18n";

const ACTION_LABEL_KEYS: Record<ShortcutAction, TranslationKey> = {
  playPause: "settings.shortcutPlayPause",
  seekBack: "settings.shortcutSeekBack",
  seekForward: "settings.shortcutSeekForward",
  prev: "settings.shortcutPrev",
  next: "settings.shortcutNext",
  theater: "settings.shortcutTheater",
  fullscreen: "settings.shortcutFullscreen",
  volumeUp: "settings.shortcutVolumeUp",
  volumeDown: "settings.shortcutVolumeDown",
  mute: "settings.shortcutMute",
};

const CATEGORY_LABEL_KEYS: Record<ShortcutCategory, TranslationKey> = {
  playback: "settings.shortcutCategoryPlayback",
  view: "settings.shortcutCategoryView",
  volume: "settings.shortcutCategoryVolume",
};

interface RecordingTarget {
  action: ShortcutAction;
  /** null 表示追加一个新绑定，数字表示替换该位置 */
  index: number | null;
}

export default function ShortcutSettings(): JSX.Element {
  const { t } = useTranslation();
  const shortcuts = useAppStore((s) => s.shortcuts);
  const shortcutsEnabled = useAppStore((s) => s.shortcutsEnabled);
  const setShortcutsEnabled = useAppStore((s) => s.setShortcutsEnabled);
  const assignShortcutBinding = useAppStore((s) => s.assignShortcutBinding);
  const removeShortcutBinding = useAppStore((s) => s.removeShortcutBinding);
  const resetShortcut = useAppStore((s) => s.resetShortcut);
  const resetAllShortcuts = useAppStore((s) => s.resetAllShortcuts);
  const toast = useAppStore((s) => s.toast);
  const [recording, setRecording] = useState<RecordingTarget | null>(null);

  const stopRecording = (): void => {
    setRecording(null);
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  };

  // 录制期间在捕获阶段拦截按键：先于播放器 / 按钮默认行为
  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        stopRecording();
        return;
      }
      const binding = keyToBinding(e);
      if (!binding) return;
      const result = assignShortcutBinding(recording.action, binding, recording.index);
      if (result.ok) {
        stopRecording();
        return;
      }
      if (result.reason === "conflict" && result.conflict) {
        toast(
          t("settings.shortcutConflict", {
            key: formatBinding(binding),
            action: t(ACTION_LABEL_KEYS[result.conflict.action]),
          })
        );
      } else {
        toast(t("settings.shortcutInvalid"));
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, assignShortcutBinding, toast, t]);

  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <h2 className="settings-section-title">{t("settings.navShortcuts")}</h2>
        <button
          className="tool-btn"
          onClick={() => {
            resetAllShortcuts();
            toast(t("settings.shortcutsResetAll"));
          }}
        >
          <RotateCcw size={14} />
          {t("settings.shortcutsResetAllAction")}
        </button>
      </div>

      <p className="settings-hint">{t("settings.shortcutsHint")}</p>

      <div className="settings-row">
        <span className="settings-label">{t("settings.shortcutsEnable")}</span>
        <div className="settings-value">
          <button
            className={shortcutsEnabled ? "tool-btn active" : "tool-btn"}
            onClick={() => setShortcutsEnabled(!shortcutsEnabled)}
          >
            {shortcutsEnabled ? t("common.enabled") : t("common.disabled")}
          </button>
        </div>
      </div>

      {SHORTCUT_CATEGORIES.map((category) => (
        <div key={category} className="shortcut-group">
          <h3 className="shortcut-group-title">{t(CATEGORY_LABEL_KEYS[category])}</h3>
          {SHORTCUT_ACTIONS.filter((action) => SHORTCUT_CATEGORY_OF[action] === category).map(
            (action) => (
              <div key={action} className="shortcut-row">
                <span className="shortcut-name">{t(ACTION_LABEL_KEYS[action])}</span>
                <div className="shortcut-keys">
                  {(shortcuts[action] ?? []).map((binding, index) => {
                    const isRecording = recording?.action === action && recording.index === index;
                    return (
                      <span key={`${binding}-${index}`} className="shortcut-key-wrap">
                        <button
                          className={isRecording ? "shortcut-key recording" : "shortcut-key"}
                          onClick={() => setRecording({ action, index })}
                          title={t("settings.shortcutRebind")}
                        >
                          {isRecording ? t("settings.shortcutRecording") : formatBinding(binding)}
                        </button>
                        <button
                          className="shortcut-key-remove"
                          onClick={() => removeShortcutBinding(action, index)}
                          title={t("settings.shortcutRemove")}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                  <button
                    className={
                      recording?.action === action && recording.index === null
                        ? "shortcut-key recording"
                        : "shortcut-key add"
                    }
                    onClick={() => setRecording({ action, index: null })}
                    title={t("settings.shortcutAdd")}
                  >
                    {recording?.action === action && recording.index === null ? (
                      t("settings.shortcutRecording")
                    ) : (
                      <Plus size={12} />
                    )}
                  </button>
                </div>
                <button
                  className="tool-btn shortcut-reset"
                  onClick={() => {
                    resetShortcut(action);
                    toast(t("settings.shortcutReset"));
                  }}
                  title={t("settings.shortcutResetOne")}
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            )
          )}
        </div>
      ))}
    </section>
  );
}
