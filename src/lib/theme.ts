export type ColorMode = "light" | "dark";
export type ThemePreference = ColorMode | "system";

/** Set true to restore dark mode exactly as it was when this pause was added. */
export const DARK_MODE_AVAILABLE = false;

const KEY = "sarali.theme";
const THEME_FADE_MS = 1000;

let themeAnimTimer = 0;

export function systemColorMode(): ColorMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readThemePreference(): ThemePreference {
  const stored = localStorage.getItem(KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "light";
}

export function resolveColorMode(preference: ThemePreference): ColorMode {
  if (!DARK_MODE_AVAILABLE) return "light";
  return preference === "system" ? systemColorMode() : preference;
}

export function readColorMode(): ColorMode {
  return resolveColorMode(readThemePreference());
}

function paintColorMode(mode: ColorMode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    mode === "dark" ? "#3c2415" : "#f6d5c6"
  );
}

export function applyColorMode(mode: ColorMode, options?: { animate?: boolean }) {
  const next = DARK_MODE_AVAILABLE ? mode : "light";
  const root = document.documentElement;
  const apply = () => paintColorMode(next);

  if (themeAnimTimer) {
    window.clearTimeout(themeAnimTimer);
    themeAnimTimer = 0;
    root.classList.remove("theme-switching");
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = Boolean(options?.animate) && !reduceMotion;

  if (animate && typeof document.startViewTransition === "function") {
    document.startViewTransition(apply);
    return;
  }

  if (animate) {
    root.classList.add("theme-switching");
    void root.offsetWidth;
    apply();
    themeAnimTimer = window.setTimeout(() => {
      root.classList.remove("theme-switching");
      themeAnimTimer = 0;
    }, THEME_FADE_MS);
    return;
  }

  apply();
}

export function applyThemePreference(preference: ThemePreference, options?: { animate?: boolean }) {
  if (!DARK_MODE_AVAILABLE) {
    applyColorMode("light", options);
    return;
  }
  localStorage.setItem(KEY, preference);
  applyColorMode(resolveColorMode(preference), options);
}

export const APP_VERSION = "0.1.0";
