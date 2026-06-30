import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import ru from "./locales/ru";
import kk from "./locales/kk";

const stored = (typeof window !== "undefined" && localStorage.getItem("lang")) || "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    kk: { translation: kk },
  },
  lng: stored,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;