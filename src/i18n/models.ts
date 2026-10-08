/**
 * Localized model metadata.
 *
 * Model name / description come from the Rust backend in English. The list of
 * models is fixed and identified by a stable `id`, so the UI translates them
 * by id and falls back to the backend text for any unknown model. Descriptions
 * may contain a `{size}` placeholder, filled from the backend's byte count.
 */

import type { ModelInfo } from "../lib/types";
import { formatBytes } from "../lib/format";
import type { Lang } from "./types";

interface ModelText {
  name: string;
  short_desc: string;
  languages: string;
}

const MODEL_TEXT: Record<string, Record<Lang, ModelText>> = {
  "minilm-l6-en": {
    en: {
      name: "MiniLM-L6 (English)",
      short_desc:
        "English only · small & fast (~{size}). Best if your resumes are in English.",
      languages: "English",
    },
    ru: {
      name: "MiniLM-L6 (английская)",
      short_desc:
        "Только английский · компактная и быстрая (~{size}). Лучший выбор для резюме на английском.",
      languages: "Английский",
    },
  },
  "multilingual-l12": {
    en: {
      name: "Multilingual MiniLM-L12",
      short_desc:
        "50+ languages incl. Russian · larger & slower (~{size}). Pick this for non-English resumes.",
      languages: "50+ languages (incl. Russian, English)",
    },
    ru: {
      name: "Многоязычная MiniLM-L12",
      short_desc:
        "50+ языков, включая русский · крупнее и медленнее (~{size}). Выбирайте для резюме не на английском.",
      languages: "50+ языков (вкл. русский и английский)",
    },
  },
};

export function modelName(model: ModelInfo, lang: Lang): string {
  return MODEL_TEXT[model.id]?.[lang]?.name ?? model.name;
}

/**
 * Localized one-line model hint. The `{size}` placeholder is filled from the
 * backend's byte count so the description can never disagree with the size
 * shown next to the model name.
 */
export function modelShortDesc(model: ModelInfo, lang: Lang): string {
  const text = MODEL_TEXT[model.id]?.[lang]?.short_desc ?? model.short_desc;
  return text.replace(/\{size\}/g, formatBytes(model.size_bytes));
}

export function modelLanguages(model: ModelInfo, lang: Lang): string {
  return MODEL_TEXT[model.id]?.[lang]?.languages ?? model.languages;
}
