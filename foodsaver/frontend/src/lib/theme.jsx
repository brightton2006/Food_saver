import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "./api";

// 7 Approved Curated Palettes + Custom Color Support
export const THEME_PALETTES = {
  forest_green: {
    key: "forest_green",
    name: "Forest Green",
    concept: "Food sustainability & freshness (Default)",
    primary: "#145C52",
    primaryLight: "#16796B",
    secondary: "#1E806F",
    primaryDark: "#0F4C45",
    tealLight: "#E8F4F1",
    tealVeryLight: "#F3F9F7",
    background: "#F7F9F8",
    accent: "#FF9F43",
    accentLight: "#FFF5EB",
    border: "#DCE6E3",
    text: "#102A2A",
    textSecondary: "#687674",
    shadowRgb: "20, 92, 82",
  },
  ocean_blue: {
    key: "ocean_blue",
    name: "Ocean Blue",
    concept: "Clean, crisp & modern",
    primary: "#1D4ED8",
    primaryLight: "#2563EB",
    secondary: "#3B82F6",
    primaryDark: "#1E40AF",
    tealLight: "#EFF6FF",
    tealVeryLight: "#F8FAFC",
    background: "#F8FAFC",
    accent: "#F59E0B",
    accentLight: "#FEF3C7",
    border: "#DBEAFE",
    text: "#0F172A",
    textSecondary: "#475569",
    shadowRgb: "29, 78, 216",
  },
  royal_purple: {
    key: "royal_purple",
    name: "Royal Purple",
    concept: "Premium & sophisticated appearance",
    primary: "#6D28D9",
    primaryLight: "#7C3AED",
    secondary: "#8B5CF6",
    primaryDark: "#5B21B6",
    tealLight: "#F5F3FF",
    tealVeryLight: "#FAF5FF",
    background: "#FAF5FF",
    accent: "#F59E0B",
    accentLight: "#FEF3C7",
    border: "#E9D5FF",
    text: "#1E1B4B",
    textSecondary: "#6B7280",
    shadowRgb: "109, 40, 217",
  },
  sunset_orange: {
    key: "sunset_orange",
    name: "Sunset Orange",
    concept: "Warm, energetic & vibrant",
    primary: "#C2410C",
    primaryLight: "#EA580C",
    secondary: "#F97316",
    primaryDark: "#9A3412",
    tealLight: "#FFF7ED",
    tealVeryLight: "#FFFAF0",
    background: "#FFFBF7",
    accent: "#0D9488",
    accentLight: "#CCFBF1",
    border: "#FED7AA",
    text: "#1C1917",
    textSecondary: "#78716C",
    shadowRgb: "194, 65, 12",
  },
  rose_pink: {
    key: "rose_pink",
    name: "Rose Pink",
    concept: "Soft, welcoming & modern",
    primary: "#BE185D",
    primaryLight: "#DB2777",
    secondary: "#EC4899",
    primaryDark: "#9D174D",
    tealLight: "#FDF2F8",
    tealVeryLight: "#FFF1F2",
    background: "#FFF7F8",
    accent: "#0284C7",
    accentLight: "#E0F2FE",
    border: "#FBCFE8",
    text: "#1C1917",
    textSecondary: "#71717A",
    shadowRgb: "190, 24, 93",
  },
  emerald_teal: {
    key: "emerald_teal",
    name: "Emerald Teal",
    concept: "Fresh, distinct & eco-friendly",
    primary: "#0F766E",
    primaryLight: "#0D9488",
    secondary: "#14B8A6",
    primaryDark: "#115E59",
    tealLight: "#F0FDFA",
    tealVeryLight: "#F5FBFA",
    background: "#F8FAFA",
    accent: "#EA580C",
    accentLight: "#FFF7ED",
    border: "#CCFBF1",
    text: "#134E4A",
    textSecondary: "#475569",
    shadowRgb: "15, 118, 110",
  },
  midnight_navy: {
    key: "midnight_navy",
    name: "Midnight Navy",
    concept: "Deep, elegant & executive",
    primary: "#1E293B",
    primaryLight: "#334155",
    secondary: "#475569",
    primaryDark: "#0F172A",
    tealLight: "#F1F5F9",
    tealVeryLight: "#F8FAFC",
    background: "#F8FAFC",
    accent: "#0284C7",
    accentLight: "#E0F2FE",
    border: "#CBD5E1",
    text: "#0F172A",
    textSecondary: "#64748B",
    shadowRgb: "30, 41, 59",
  },
};

/**
 * Adjust hex color brightness
 */
function adjustBrightness(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 0 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

/**
 * Convert hex to RGB values
 */
function hexToRgb(hex) {
  const num = parseInt(hex.replace("#", ""), 16);
  const R = num >> 16;
  const G = (num >> 8) & 0x00ff;
  const B = num & 0x0000ff;
  return `${R}, ${G}, ${B}`;
}

/**
 * Dynamically constructs custom color palette configuration
 */
export function buildCustomPalette(primaryHex, secondaryHex) {
  const safePrimary = /^#[0-9A-F]{6}$/i.test(primaryHex) ? primaryHex : "#145C52";
  const safeSecondary = /^#[0-9A-F]{6}$/i.test(secondaryHex) ? secondaryHex : adjustBrightness(safePrimary, 15);

  return {
    key: "custom",
    name: "Custom Palette",
    concept: "User Tailored Color Palette",
    primary: safePrimary,
    primaryLight: adjustBrightness(safePrimary, 15),
    secondary: safeSecondary,
    primaryDark: adjustBrightness(safePrimary, -15),
    tealLight: adjustBrightness(safePrimary, 88),
    tealVeryLight: adjustBrightness(safePrimary, 94),
    background: "#F9FAF9",
    accent: safeSecondary,
    accentLight: adjustBrightness(safeSecondary, 80),
    border: adjustBrightness(safePrimary, 75),
    text: "#102A2A",
    textSecondary: "#687674",
    shadowRgb: hexToRgb(safePrimary),
  };
}

/**
 * Injects CSS variables onto :root
 */
export function applyThemeToDom(palette) {
  if (!palette || typeof document === "undefined") return;
  const root = document.documentElement;

  // Primary System Tokens
  root.style.setProperty("--fs-primary", palette.primary);
  root.style.setProperty("--fs-primary-light", palette.primaryLight);
  root.style.setProperty("--fs-secondary", palette.secondary);
  root.style.setProperty("--fs-primary-dark", palette.primaryDark);
  root.style.setProperty("--fs-teal-light", palette.tealLight);
  root.style.setProperty("--fs-teal-very-light", palette.tealVeryLight);
  root.style.setProperty("--fs-background", palette.background);
  root.style.setProperty("--fs-border", palette.border);
  root.style.setProperty("--fs-orange", palette.accent);

  // Mapped Semantic Tokens
  root.style.setProperty("--color-primary", palette.primary);
  root.style.setProperty("--color-primary-hover", palette.primaryLight);
  root.style.setProperty("--color-primary-dark", palette.primaryDark);
  root.style.setProperty("--color-primary-light", palette.tealLight);
  root.style.setProperty("--color-accent", palette.accent);
  root.style.setProperty("--color-accent-light", palette.accentLight);

  // Legacy Design Tokens
  root.style.setProperty("--primary", palette.primary);
  root.style.setProperty("--secondary", palette.primaryDark);
  root.style.setProperty("--accent", palette.accent);
  root.style.setProperty("--green-soft", palette.tealLight);
  root.style.setProperty("--rescue-soft", palette.tealLight);
  root.style.setProperty("--ember", palette.primary);
  root.style.setProperty("--rescue", palette.primary);

  // Dynamic Shadows with Palette Tint
  if (palette.shadowRgb) {
    root.style.setProperty("--shadow-card", `0 8px 25px rgba(${palette.shadowRgb}, 0.08)`);
    root.style.setProperty("--shadow-pop", `0 14px 36px rgba(${palette.shadowRgb}, 0.12)`);
    root.style.setProperty("--shadow-glow", `0 8px 24px rgba(${palette.shadowRgb}, 0.20)`);
  }
}

const ThemeContext = createContext({
  themeKey: "forest_green",
  activePalette: THEME_PALETTES.forest_green,
  previewKey: "forest_green",
  previewPalette: THEME_PALETTES.forest_green,
  customColors: { primary: "#145C52", secondary: "#FF9F43" },
  setPreview: () => {},
  setCustomPreview: () => {},
  applyTheme: () => {},
  resetPreview: () => {},
  restoreDefaultTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    try {
      return localStorage.getItem("foodsaver_theme") || "forest_green";
    } catch {
      return "forest_green";
    }
  });

  const [customColors, setCustomColors] = useState(() => {
    try {
      const saved = localStorage.getItem("foodsaver_custom_colors");
      return saved ? JSON.parse(saved) : { primary: "#145C52", secondary: "#FF9F43" };
    } catch {
      return { primary: "#145C52", secondary: "#FF9F43" };
    }
  });

  // Preview state allows immediate inspection before saving
  const [previewKey, setPreviewKey] = useState(themeKey);
  const [previewCustom, setPreviewCustomState] = useState(customColors);

  const getPaletteByKey = (key, custom) => {
    if (key === "custom") {
      return buildCustomPalette(custom?.primary || customColors.primary, custom?.secondary || customColors.secondary);
    }
    return THEME_PALETTES[key] || THEME_PALETTES.forest_green;
  };

  const activePalette = getPaletteByKey(themeKey, customColors);
  const previewPalette = getPaletteByKey(previewKey, previewCustom);

  // Keep DOM updated with preview or active palette
  useEffect(() => {
    applyThemeToDom(previewPalette);
  }, [previewPalette]);

  const setPreview = (key) => {
    setPreviewKey(key);
  };

  const setCustomPreview = (colors) => {
    setPreviewCustomState((prev) => ({ ...prev, ...colors }));
    setPreviewKey("custom");
  };

  const applyTheme = (key, newCustomColors = null) => {
    const chosenKey = key || previewKey;
    const finalCustom = newCustomColors || previewCustom;

    setThemeKey(chosenKey);
    setPreviewKey(chosenKey);
    if (finalCustom) {
      setCustomColors(finalCustom);
      setPreviewCustomState(finalCustom);
    }

    try {
      localStorage.setItem("foodsaver_theme", chosenKey);
      if (finalCustom) {
        localStorage.setItem("foodsaver_custom_colors", JSON.stringify(finalCustom));
      }
    } catch {}

    const chosenPalette = getPaletteByKey(chosenKey, finalCustom);
    applyThemeToDom(chosenPalette);

    // Asynchronously save to backend user preferences
    api.updatePreferences({
      preferredTheme: chosenKey,
      customThemeConfig: finalCustom,
    }).catch(() => {});
  };

  const resetPreview = () => {
    setPreviewKey(themeKey);
    setPreviewCustomState(customColors);
    applyThemeToDom(activePalette);
  };

  const restoreDefaultTheme = () => {
    applyTheme("forest_green", { primary: "#145C52", secondary: "#FF9F43" });
  };

  return (
    <ThemeContext.Provider
      value={{
        themeKey,
        activePalette,
        previewKey,
        previewPalette,
        customColors: previewCustom,
        setPreview,
        setCustomPreview,
        applyTheme,
        resetPreview,
        restoreDefaultTheme,
        palettes: THEME_PALETTES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
