import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import hi from "./locales/hi";
import es from "./locales/es";

const resources = { en: { translation: en }, hi: { translation: hi }, es: { translation: es } };
const LANGUAGE_KEY = "app_language";
const initialLanguage = localStorage.getItem(LANGUAGE_KEY) || "en";

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: ["en", "hi", "es"],
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (language) => {
  localStorage.setItem(LANGUAGE_KEY, language);
});

export default i18n;
