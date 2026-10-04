import React, { createContext, useContext, useState, useEffect } from "react";
import en from "../locales/en.json";
import ta from "../locales/ta.json";
import hi from "../locales/hi.json";

const translations = {
  en,
  ta,
  hi,
};

export const AVAILABLE_LANGUAGES = [
  { code: "en", name: "English", label: "English", flag: "🇬🇧" },
  { code: "ta", name: "Tamil", label: "தமிழ்", flag: "🇮🇳" },
  { code: "hi", name: "Hindi", label: "हिंदी", flag: "🇮🇳" },
];

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
  languages: AVAILABLE_LANGUAGES,
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem("foodsaver_lang") || "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {}
  }, [language]);

  const setLanguage = (lang) => {
    if (!translations[lang]) return;
    setLanguageState(lang);
    try {
      localStorage.setItem("foodsaver_lang", lang);
    } catch {}
  };

  const t = (path) => {
    if (!path || typeof path !== "string") return "";
    const keys = path.split(".");
    let current = translations[language] || translations.en;
    for (const k of keys) {
      if (!current || current[k] === undefined) {
        // Fallback to English
        let fallback = translations.en;
        for (const fk of keys) {
          if (!fallback || fallback[fk] === undefined) return path;
          fallback = fallback[fk];
        }
        return fallback;
      }
      current = current[k];
    }
    return current;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: AVAILABLE_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
