import { Database, Globe, Keyboard, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TranslationKey } from "@/i18n";

export type SettingsSection = "data-source" | "browser" | "playback" | "shortcuts";

const SECTIONS: { id: SettingsSection; icon: typeof Database; labelKey: TranslationKey }[] = [
  { id: "data-source", icon: Database, labelKey: "settings.navDataSource" },
  { id: "browser", icon: Globe, labelKey: "settings.navBrowser" },
  { id: "playback", icon: PlayCircle, labelKey: "settings.navPlayback" },
  { id: "shortcuts", icon: Keyboard, labelKey: "settings.navShortcuts" },
];

export default function SettingsNav({
  active,
  onChange,
}: {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <nav className="settings-nav">
      {SECTIONS.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          className={active === id ? "settings-nav-item active" : "settings-nav-item"}
          onClick={() => onChange(id)}
        >
          <Icon size={16} />
          {t(labelKey)}
        </button>
      ))}
    </nav>
  );
}
