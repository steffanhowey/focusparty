"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import type { CharacterId } from "@/lib/types";
import { CHARACTERS } from "@/lib/constants";

const COLOR_MODE_KEY = "skillgap-color-mode";
const OLD_COLOR_MODE_KEY = "focusparty-color-mode";
export type ColorMode = "dark" | "light";

interface ThemeContextValue {
  characterAccent: CharacterId;
  colorMode: ColorMode;
  reducedMotion: boolean;
  setCharacterAccent: (character: CharacterId) => void;
  setColorMode: (mode: ColorMode) => void;
  setReducedMotion: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [characterAccent, setCharacterAccentState] =
    useState<CharacterId>("ember");
  // Always start with "dark" so server and client first render match (avoids hydration error).
  // Stored preference is applied in useEffect after mount.
  const [colorMode, setColorModeState] = useState<ColorMode>("dark");
  const [reducedMotion, setReducedMotion] = useState(false);

  // Apply stored color mode on client after mount so SSR and first client render match.
  useEffect(() => {
    try {
      let stored = localStorage.getItem(COLOR_MODE_KEY);
      if (!stored) {
        stored = localStorage.getItem(OLD_COLOR_MODE_KEY);
        if (stored) localStorage.setItem(COLOR_MODE_KEY, stored); // migrate forward
      }
      if (stored === "light" || stored === "dark") setColorModeState(stored);
    } catch {
      // ignore
    }
  }, []);

  const setCharacterAccent = useCallback((character: CharacterId) => {
    setCharacterAccentState(character);
  }, []);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    try {
      localStorage.setItem(COLOR_MODE_KEY, mode);
      document.documentElement.setAttribute("data-theme", mode);
    } catch {
      // ignore
    }
  }, []);

  // Apply data-theme and character accent CSS variables to document root
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", colorMode);
    const c = CHARACTERS[characterAccent];
    if (c) {
      root.style.setProperty("--color-accent-primary", c.primary);
      root.style.setProperty("--color-accent-secondary", c.secondary);
    }
  }, [characterAccent, colorMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      characterAccent,
      colorMode,
      reducedMotion,
      setCharacterAccent,
      setColorMode,
      setReducedMotion,
    }),
    [characterAccent, colorMode, reducedMotion, setCharacterAccent, setColorMode, setReducedMotion]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
