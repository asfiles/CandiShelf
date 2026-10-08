import { afterEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "./I18nProvider";
import { LANG_STORAGE_KEY } from "./detect";
import { ToastProvider } from "../components/Toast";
import { CandidateRow } from "../components/CandidateRow";
import { SettingsScreen } from "../screens/SettingsScreen";
import { FirstRunGate } from "../screens/FirstRunGate";
import type { AppSettings, CandidateSummary } from "../lib/types";
import type { Lang } from "./types";

const settings: AppSettings = {
  data_dir: "/tmp/candishelf",
  version: "0.1.0",
  active_model: "minilm-l6-en",
  copy_originals: true,
};

const candidate: CandidateSummary = {
  id: 1,
  name: "Ada Kovács",
  email: "ada@example.com",
  location: "Budapest, HU",
  last_title: "Senior DevOps Engineer",
  experience_years: 5,
  skills: ["Kubernetes", "AWS"],
  languages: ["English"],
  in_shortlist: true,
  has_duplicates: true,
};

function render(lang: Lang, node: ReactNode): string {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  return renderToStaticMarkup(
    <I18nProvider>
      <ToastProvider>{node}</ToastProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  localStorage.removeItem(LANG_STORAGE_KEY);
});

describe("bilingual rendering", () => {
  it("renders Settings in Russian when the language is ru", () => {
    const html = render(
      "ru",
      <SettingsScreen settings={settings} onChange={async () => {}} />,
    );
    expect(html).toContain("Настройки");
    expect(html).toContain("Язык");
    expect(html).toContain("AI-модели");
    expect(html).not.toContain("Manage storage");
  });

  it("renders Settings in English when the language is en", () => {
    const html = render(
      "en",
      <SettingsScreen settings={settings} onChange={async () => {}} />,
    );
    expect(html).toContain("Settings");
    expect(html).toContain("Language");
    expect(html).toContain("AI models");
    expect(html).not.toContain("Настройки");
  });

  it("localizes the candidate row labels and experience", () => {
    const ru = render("ru", <CandidateRow candidate={candidate} onOpen={() => {}} />);
    expect(ru).toContain("Шортлист");
    expect(ru).toContain("Дубликат");
    expect(ru).toContain("5 лет");

    const en = render("en", <CandidateRow candidate={candidate} onOpen={() => {}} />);
    expect(en).toContain("Shortlist");
    expect(en).toContain("Duplicate");
    expect(en).toContain("5 yrs");
  });

  it("offers a RU/EN switch on the first-run screen", () => {
    const onReady = async () => {};
    const en = render("en", <FirstRunGate onReady={onReady} />);
    expect(en).toContain("Welcome to CandiShelf");
    expect(en).toContain("Language");
    expect(en).toContain("Русский");

    const ru = render("ru", <FirstRunGate onReady={onReady} />);
    expect(ru).toContain("Добро пожаловать в CandiShelf");
    expect(ru).toContain("Язык");
    expect(ru).toContain("English");
  });
});
