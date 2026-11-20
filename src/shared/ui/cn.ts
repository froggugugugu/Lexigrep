/** クラス名を結合する(falsy を除外)。依存を増やさないための最小実装 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
