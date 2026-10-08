import { describe, expect, it } from "vitest";
import { formatBytes } from "../lib/format";
import { modelShortDesc } from "./models";
import type { ModelInfo } from "../lib/types";

const MULTILINGUAL_BYTES = 479_723_763; // weights + tokenizer + config
const ENGLISH_BYTES = 91_335_235;

function model(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id: "multilingual-l12",
    name: "Multilingual MiniLM-L12",
    description: "",
    short_desc:
      "50+ languages incl. Russian · larger & slower (~{size}). Pick this for non-English resumes.",
    languages: "50+ languages (incl. Russian, English)",
    size_bytes: MULTILINGUAL_BYTES,
    downloaded: false,
    recommended: false,
    active: false,
    url: "https://example.com/model.safetensors",
    dir: "/tmp/model",
    files: [],
    ...overrides,
  };
}

describe("localized model descriptions", () => {
  it("fills {size} from the backend byte count in both languages", () => {
    const m = model();
    for (const lang of ["en", "ru"] as const) {
      const text = modelShortDesc(m, lang);
      expect(text).toContain(formatBytes(m.size_bytes));
      expect(text).not.toContain("{size}");
    }
    expect(formatBytes(m.size_bytes)).toBe("458 MB");
  });

  it("interpolates the backend fallback for an unknown model", () => {
    const m = model({ id: "unknown", size_bytes: ENGLISH_BYTES });
    expect(modelShortDesc(m, "en")).toContain("87 MB");
  });
});
