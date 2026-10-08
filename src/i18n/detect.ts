/**
 * Language detection.
 *
 * Priority: an explicit choice saved by the user, then the operating system /
 * browser locale. Any Russian locale (`ru`, `ru-RU`, …) selects Russian;
 * everything else selects English. The webview exposes the OS locale through
 * `navigator.language(s)` (and `Intl`), so no extra plugin is needed and the
 * behaviour is identical in the desktop app and the browser demo.
 */

import type { Lang } from "./types";

export const LANG_STORAGE_KEY = "candishelf.lang";

const RUSSIAN = /^ru\b/i;

/**
 * Pick a language from a list of locale tags (highest priority first): any
 * Russian tag selects Russian, everything else falls back to English.
 */
export function langFromTags(tags: string[]): Lang {
  return tags.some((tag) => RUSSIAN.test(tag)) ? "ru" : "en";
}

/** The language implied by the current system locale. */
export function systemLang(): Lang {
  if (typeof navigator === "undefined") return "en";

  const tags: string[] = [];
  if (Array.isArray(navigator.languages)) tags.push(...navigator.languages);
  if (navigator.language) tags.push(navigator.language);
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
    if (resolved) tags.push(resolved);
  } catch {
    // `Intl` unavailable — the navigator tags above are enough.
  }

  return langFromTags(tags);
}

/** The language previously chosen by the user, if any. */
export function storedLang(): Lang | null {
  try {
    const value = localStorage.getItem(LANG_STORAGE_KEY);
    return value === "en" || value === "ru" ? value : null;
  } catch {
    // Storage can be unavailable (e.g. locked-down webview).
    return null;
  }
}

/** Effective language at startup: saved choice, else system locale. */
export function detectLang(): Lang {
  return storedLang() ?? systemLang();
}

export function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Non-fatal: the in-memory choice still applies for this session.
  }
}
