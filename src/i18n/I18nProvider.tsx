import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { I18nContext, type I18nContextValue } from "./context";
import { detectLang, storeLang } from "./detect";
import { translate } from "./translate";
import type { Lang, TParams } from "./types";
import type { TranslationKey } from "./en";

/** Provides the active language and translator to the whole app. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    storeLang(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TParams) => translate(lang, key, params),
    [lang],
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
