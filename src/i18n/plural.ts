/** Plural helpers used by dictionary entries. */

/** English: singular only for exactly 1. */
export function enPlural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Russian plural form: `one` for 1/21/31…, `few` for 2–4/22–24…, `many`
 * otherwise (including the 11–14 exception).
 */
export function ruPlural(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return many;
  if (mod10 > 1 && mod10 < 5) return few;
  if (mod10 === 1) return one;
  return many;
}
