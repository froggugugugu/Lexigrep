/**
 * 公式ドキュメントのクローラ。
 * - 指定ルート URL 配下だけを辿る(同一オリジン + パス前綴り)
 * - robots.txt を尊重し、リクエスト間隔(delayMs)を空ける
 * - 取得結果は PageText として保存する(HTML の原文は保持しない: 短文引用の原則)
 */
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { extractText, type PageText } from "./text";

/** 1 ページの取得タイムアウト(ms) */
const FETCH_TIMEOUT_MS = 20_000;

export const USER_AGENT =
  "lexigrep-crawler/0.1 (+https://github.com/froggugugugu/Lexigrep)";

export type CrawlOptions = {
  roots: string[];
  maxPages: number;
  delayMs: number;
  /** URL にこの文字列を含むページは辿らない(例: release-notes) */
  excludePaths?: readonly string[];
  /** 依存注入用(テストではモック) */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  log?: (line: string) => void;
};

export type CrawlResult = {
  pages: PageText[];
  skipped: { url: string; reason: string }[];
};

export function normalizeUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    u.search = "";
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function isUnderRoots(url: string, roots: readonly string[]): boolean {
  return roots.some((root) => {
    const r = normalizeUrl(root, root) ?? root;
    return url === r || url.startsWith(r.endsWith("/") ? r : r + "/");
  });
}

const SKIP_EXT =
  /\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|json|xml|pdf|zip|gz|woff2?|ttf|mp4|webm)$/i;

export async function crawl(options: CrawlOptions): Promise<CrawlResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep =
    options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? (() => new Date());
  const log = options.log ?? (() => {});
  const roots = options.roots
    .map((r) => normalizeUrl(r, r))
    .filter((r): r is string => r !== null);

  const robotsCache = new Map<string, ReturnType<typeof robotsParser> | null>();
  async function allowed(url: string): Promise<boolean> {
    const origin = new URL(url).origin;
    if (!robotsCache.has(origin)) {
      try {
        const res = await fetchImpl(`${origin}/robots.txt`, {
          headers: { "user-agent": USER_AGENT },
        });
        robotsCache.set(
          origin,
          res.ok
            ? robotsParser(`${origin}/robots.txt`, await res.text())
            : null,
        );
      } catch {
        robotsCache.set(origin, null);
      }
    }
    const robots = robotsCache.get(origin);
    return robots ? (robots.isAllowed(url, USER_AGENT) ?? true) : true;
  }

  const excludePaths = options.excludePaths ?? [];
  const excluded = (url: string) =>
    excludePaths.some((p) => p !== "" && url.includes(p));
  const queue = [...roots];
  const seen = new Set(roots);
  const pages: PageText[] = [];
  const skipped: CrawlResult["skipped"] = [];

  while (queue.length > 0 && pages.length < options.maxPages) {
    const url = queue.shift()!;
    if (SKIP_EXT.test(url)) continue;
    if (!(await allowed(url))) {
      skipped.push({ url, reason: "robots.txt" });
      continue;
    }
    let html: string;
    let finalUrl = url;
    try {
      const res = await fetchImpl(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html" },
        signal:
          typeof AbortSignal.timeout === "function"
            ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
            : undefined,
      });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.includes("text/html")) {
        skipped.push({ url, reason: `status ${res.status} / ${type}` });
        continue;
      }
      html = await res.text();
      // リダイレクト先を実 URL として扱う。ルートが移転していたら移転先もルートに加える
      const redirected = res.url ? normalizeUrl(res.url, url) : null;
      if (redirected && redirected !== url) {
        if (pages.some((p) => p.url === redirected)) continue;
        finalUrl = redirected;
        seen.add(finalUrl);
        if (roots.includes(url) && !isUnderRoots(finalUrl, roots)) {
          roots.push(finalUrl);
          log(`root が移転: ${url} → ${finalUrl}`);
        }
      }
    } catch (err) {
      skipped.push({ url, reason: (err as Error).message });
      continue;
    }
    const page = extractText(html, finalUrl, now().toISOString());
    pages.push(page);
    log(
      `[${pages.length}/${options.maxPages}] ${finalUrl} (${page.sentences.length} sentences)`,
    );

    const $ = cheerio.load(html);
    $("a[href]").each((_, a) => {
      const next = normalizeUrl($(a).attr("href") ?? "", finalUrl);
      if (
        next &&
        !seen.has(next) &&
        isUnderRoots(next, roots) &&
        !SKIP_EXT.test(next) &&
        !excluded(next)
      ) {
        seen.add(next);
        queue.push(next);
      }
    });
    if (queue.length > 0 && pages.length < options.maxPages)
      await sleep(options.delayMs);
  }
  return { pages, skipped };
}
