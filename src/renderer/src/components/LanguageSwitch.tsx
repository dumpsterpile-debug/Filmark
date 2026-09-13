import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function LanguageSwitch(): JSX.Element {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.startsWith("zh") ? "zh" : "en";
  const next: "zh" | "en" = current === "zh" ? "en" : "zh";

  return (
    <button
      className="tool-btn lang-switch"
      data-testid="language-switch"
      title={t("lang.label")}
      onClick={() => void i18n.changeLanguage(next)}
    >
      <Languages size={16} />
      {t(`lang.${next}`)}
    </button>
  );
}
