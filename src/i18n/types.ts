/**
 * Core types for the UI localization layer.
 *
 * The interface ships in two languages (`en`, `ru`). A dictionary entry is
 * either a plain string with `{placeholder}` tokens, or a function for cases
 * that need pluralization / number-aware wording.
 */

export type Lang = "en" | "ru";

export type TParams = Record<string, string | number>;

export type Entry = string | ((params: TParams) => string);

export type Dict = Record<string, Entry>;

/** Languages offered in Settings, in display order. */
export const LANGS: readonly Lang[] = ["en", "ru"];
