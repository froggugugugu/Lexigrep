/**
 * 語句(term)単位の扱い。同じ語句が複数の題材のカードになるため、
 * 「網羅」や辞書では カードではなく語句を単位に数える。
 */
export function normalizeTerm(target: string): string {
  return target.trim().replace(/\s+/g, " ").toLowerCase();
}
