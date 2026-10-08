import { en, type TranslationKey } from "./en";
import { ru } from "./ru";
import type { Entry, Lang, TParams } from "./types";

function interpolate(template: string, params: TParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Resolve a dictionary key for `lang`, interpolating any placeholders. */
export function translate(
  lang: Lang,
  key: TranslationKey,
  params: TParams = {},
): string {
  const entry: Entry = (lang === "ru" ? ru[key] : en[key]) ?? en[key];
  return typeof entry === "function" ? entry(params) : interpolate(entry, params);
}
