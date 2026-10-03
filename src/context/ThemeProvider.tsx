import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  applyColorMode,
  applyThemePreference,
  DARK_MODE_AVAILABLE,
  readThemePreference,
  resolveColorMode,
  systemColorMode,
  type ColorMode,
  type ThemePreference,
} from "../lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  mode: ColorMode;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    DARK_MODE_AVAILABLE ? readThemePreference() : "light"
  );
  const [mode, setMode] = useState<ColorMode>(() =>
    DARK_MODE_AVAILABLE ? resolveColorMode(readThemePreference()) : "light"
  );
  const skipAnimate = useRef(true);

  useEffect(() => {
    applyThemePreference(preference, { animate: !skipAnimate.current });
    setMode(resolveColorMode(preference));
    skipAnimate.current = false;
  }, [preference]);

  useEffect(() => {
    if (!DARK_MODE_AVAILABLE || preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemColorMode();
      applyColorMode(next, { animate: true });
      setMode(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const value = useMemo(
    () => ({
      preference,
      setPreference: (next: ThemePreference) => {
        if (!DARK_MODE_AVAILABLE && next !== "light") return;
        setPreferenceState(next);
      },
      mode,
    }),
    [preference, mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
