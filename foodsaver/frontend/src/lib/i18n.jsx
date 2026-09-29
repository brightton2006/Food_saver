import React, { createContext, useContext, useState, useEffect } from "react";
import en from "../locales/en.json";
import ta from "../locales/ta.json";

const translations = {
  en,
  ta,
};

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem("foodsaver_lang") || "en";
    } catch {
      return "en";
    }
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("foodsaver_lang", lang);
    } catch {}
  };

  const t = (path) => {
    const keys = path.split(".");
    let current = translations[language] || translations.en;
    for (const k of keys) {
      if (!current || current[k] === undefined) {
        // Fallback to english
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
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
