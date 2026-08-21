import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import i18n from "@/i18n";

export type Theme = "light" | "dark";
export type TextSize = "small" | "medium" | "large";
export type Lang = "en" | "ru" | "kk";

const SIZE_MAP: Record<TextSize, string> = {
  small: "1rem",
  medium: "1.125rem",
  large: "1.375rem",
};

// Base root font size — scales the whole UI (rem-based) so the setting
// is visible everywhere, not just inside the student editor.
const ROOT_SIZE_MAP: Record<TextSize, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
};


interface Ctx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  textSize: TextSize;
  setTextSize: (t: TextSize) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

const SettingsCtx = createContext<Ctx>({
  theme: "light",
  setTheme: () => {},
  textSize: "medium",
  setTextSize: () => {},
  lang: "en",
  setLang: () => {},
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "light"
  );
  const [textSize, setTextSizeState] = useState<TextSize>(
    () => (localStorage.getItem("textSize") as TextSize) || "medium"
  );
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem("lang") as Lang) || "en"
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--editor-size", SIZE_MAP[textSize]);
    root.style.fontSize = ROOT_SIZE_MAP[textSize];
    root.dataset.textSize = textSize;
    localStorage.setItem("textSize", textSize);
  }, [textSize]);


  useEffect(() => {
    i18n.changeLanguage(lang);
    localStorage.setItem("lang", lang);
  }, [lang]);

  return (
    <SettingsCtx.Provider
      value={{
        theme,
        setTheme: setThemeState,
        textSize,
        setTextSize: setTextSizeState,
        lang,
        setLang: setLangState,
      }}
    >
      {children}
    </SettingsCtx.Provider>
  );
};

export const useSettings = () => useContext(SettingsCtx);