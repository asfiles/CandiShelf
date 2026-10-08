import { afterEach, describe, expect, it } from "vitest";
import { en } from "./en";
import { ru } from "./ru";
import { ruPlural, enPlural } from "./plural";
import { translate } from "./translate";
import { experienceLabel } from "./format";
import {
  LANG_STORAGE_KEY,
  detectLang,
  langFromTags,
  storedLang,
  storeLang,
} from "./detect";

afterEach(() => {
  localStorage.removeItem(LANG_STORAGE_KEY);
});

describe("dictionaries", () => {
  it("expose exactly the same key set in en and ru", () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });

  it("have no empty strings", () => {
    for (const dict of [en, ru]) {
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value === "string") {
          expect(value.length, `empty entry for ${key}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("translate", () => {
  it("interpolates named placeholders", () => {
    expect(translate("en", "home.exported", { path: "/tmp/x.csv" })).toBe(
      "Shortlist exported to /tmp/x.csv",
    );
    expect(translate("ru", "home.exported", { path: "/tmp/x.csv" })).toBe(
      "Шортлист экспортирован в /tmp/x.csv",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(translate("en", "home.exported")).toBe("Shortlist exported to {path}");
  });

  it("uses English plurals", () => {
    expect(translate("en", "exp.years", { count: 1 })).toBe("1 yr");
    expect(translate("en", "exp.years", { count: 5 })).toBe("5 yrs");
    expect(translate("en", "home.count", { count: 1 })).toContain("1 candidate ");
    expect(translate("en", "home.count", { count: 3 })).toContain("3 candidates ");
  });

  it("uses Russian plurals", () => {
    expect(translate("ru", "exp.years", { count: 1 })).toBe("1 год");
    expect(translate("ru", "exp.years", { count: 3 })).toBe("3 года");
    expect(translate("ru", "exp.years", { count: 5 })).toBe("5 лет");
    expect(translate("ru", "home.count", { count: 1 })).toContain("1 кандидат ");
    expect(translate("ru", "home.count", { count: 2 })).toContain("2 кандидата ");
    expect(translate("ru", "home.count", { count: 5 })).toContain("5 кандидатов ");
  });
});

describe("plurals", () => {
  it("enPlural", () => {
    expect(enPlural(1, "a", "b")).toBe("a");
    expect(enPlural(0, "a", "b")).toBe("b");
    expect(enPlural(2, "a", "b")).toBe("b");
  });

  it("ruPlural follows the one/few/many rule", () => {
    expect(ruPlural(1, "one", "few", "many")).toBe("one");
    expect(ruPlural(2, "one", "few", "many")).toBe("few");
    expect(ruPlural(4, "one", "few", "many")).toBe("few");
    expect(ruPlural(5, "one", "few", "many")).toBe("many");
    expect(ruPlural(11, "one", "few", "many")).toBe("many");
    expect(ruPlural(12, "one", "few", "many")).toBe("many");
    expect(ruPlural(14, "one", "few", "many")).toBe("many");
    expect(ruPlural(21, "one", "few", "many")).toBe("one");
    expect(ruPlural(22, "one", "few", "many")).toBe("few");
    expect(ruPlural(25, "one", "few", "many")).toBe("many");
  });
});

describe("experienceLabel", () => {
  const ruT = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
    translate("ru", key, params);
  const enT = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
    translate("en", key, params);

  it("labels experience in both languages", () => {
    expect(experienceLabel(null, enT)).toBe("—");
    expect(experienceLabel(0.5, enT)).toBe("<1 yr");
    expect(experienceLabel(5, enT)).toBe("5 yrs");
    expect(experienceLabel(1, ruT)).toBe("1 год");
    expect(experienceLabel(3, ruT)).toBe("3 года");
    expect(experienceLabel(8, ruT)).toBe("8 лет");
  });
});

describe("language detection", () => {
  it("selects Russian for any Russian locale tag", () => {
    expect(langFromTags(["ru"])).toBe("ru");
    expect(langFromTags(["ru-RU"])).toBe("ru");
    expect(langFromTags(["en-US", "de-DE", "ru-RU"])).toBe("ru");
    expect(langFromTags(["EN-GB"])).toBe("en");
  });

  it("defaults to English for non-Russian locales", () => {
    expect(langFromTags([])).toBe("en");
    expect(langFromTags(["en-US"])).toBe("en");
    expect(langFromTags(["de-DE"])).toBe("en");
  });

  it("persists and restores the user's choice", () => {
    storeLang("ru");
    expect(storedLang()).toBe("ru");
    // Even with an English system locale, the saved choice wins.
    expect(detectLang()).toBe("ru");
  });

  it("ignores unknown stored values", () => {
    localStorage.setItem(LANG_STORAGE_KEY, "fr");
    expect(storedLang()).toBeNull();
  });
});
