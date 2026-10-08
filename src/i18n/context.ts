import { createContext } from "react";
import type { TranslationKey } from "./en";
import type { Lang, TParams } from "./types";

export type TranslateFn = (key: TranslationKey, params?: TParams) => string;

export interface I18nContextValue {
  /** Active interface language. */
  lang: Lang;
  /** Switch language; the choice is persisted for the next launch. */
  setLang: (lang: Lang) => void;
  /** Translate a key, interpolating `{placeholder}` tokens. */
  t: TranslateFn;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
