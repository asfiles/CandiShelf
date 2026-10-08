import type { TranslateFn } from "./context";

/** Localized experience label, e.g. "5 yrs" / "5 лет". */
export function experienceLabel(years: number | null, t: TranslateFn): string {
  if (years == null) return t("common.none");
  if (years < 1) return t("exp.lessThanOne");
  return t("exp.years", { count: years });
}
