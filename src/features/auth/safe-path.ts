/**
 * オープンリダイレクト防止: サイト内の相対パスだけを許可する。
 * 先頭が "/" で、"//" や "\\" で始まらず、制御文字(ブラウザが除去して "//" に化けうる)を含まないこと。
 * 念のため URL として解釈したときも同一オリジンに留まることを確認する。
 */
export function safeNextPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  )
    return "/";
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";
  try {
    const base = "http://lexigrep.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
