import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

export const LANGUAGE_STORAGE_KEY = "media-player-language";

export type SupportedLanguage = "zh" | "en";
export type TranslationKey = keyof typeof en;

function detectLanguage(): SupportedLanguage {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === "zh" || saved === "en" ? saved : "zh";
}

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: detectLanguage(),
  fallbackLng: "zh",
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
  },
});

document.documentElement.lang = i18n.language === "zh" ? "zh-CN" : "en";

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  document.documentElement.lang = lng === "zh" ? "zh-CN" : "en";
});

export default i18n;
